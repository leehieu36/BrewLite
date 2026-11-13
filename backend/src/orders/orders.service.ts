
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  OrderStatus,
  PaymentStatus,
  UserRole,
  CancellationRequestStatus,
  DiscountType,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateOrderDto } from './orders.dto';
import { AuditService } from '../audit/audit.service';

const transitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'PAYMENT_FAILED'],
  PAID: ['PREPARING'],
  PREPARING: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  PAYMENT_FAILED: [],
  CANCELLED: [],
};

type NormalizedOrderLine = {
  productId: string;
  qty: number;
  size: string;
  toppings: string[];
};

function normalizeOrderItems(dto: CreateOrderDto): NormalizedOrderLine[] {
  const merged = new Map<string, NormalizedOrderLine>();

  for (const item of dto.items) {
    const size = item.size || 'M';
    const toppings = Array.from(new Set(item.toppings ?? [])).sort();
    const key = JSON.stringify([item.productId, size, toppings]);

    const old = merged.get(key);

    merged.set(key, {
      productId: item.productId,
      qty: (old?.qty ?? 0) + item.qty,
      size,
      toppings,
    });
  }

  return Array.from(merged.values()).sort((a, b) =>
    JSON.stringify([a.productId, a.size, a.toppings]).localeCompare(
      JSON.stringify([b.productId, b.size, b.toppings]),
    ),
  );
}

function matchesOrderPayload(
  order: Prisma.OrderGetPayload<{ include: { items: true } }>,
  promotionCode: string | null,
  requestedItems: NormalizedOrderLine[],
): boolean {
  if (order.promotionCode !== promotionCode) {
    return false;
  }

  const existingItems = [...order.items]
    .map((item) => ({
      productId: item.productId,
      qty: item.qty,
      size: item.size,
      toppings: [...item.toppings].sort(),
    }))
    .sort((a, b) =>
      JSON.stringify([a.productId, a.size, a.toppings]).localeCompare(
        JSON.stringify([b.productId, b.size, b.toppings]),
      ),
    );

  return JSON.stringify(existingItems) === JSON.stringify(requestedItems);
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async validatePromotion(dto: CreateOrderDto) {
    const requestedItems = normalizeOrderItems(dto);

    let subtotal = 0;

    for (const item of requestedItems) {
      const product = await this.prisma.product.findFirst({
        where: {
          id: item.productId,
          isActive: true,
          stock: { gte: item.qty },
        },
      });

      if (!product) {
        throw new BadRequestException(
          `Sản phẩm ${item.productId} không tồn tại, đã ngừng bán hoặc không đủ tồn kho`,
        );
      }

      const sizePrice =
        item.size === 'M' ? 5000 : item.size === 'L' ? 10000 : 0;

      const unitPrice =
        product.price + sizePrice + item.toppings.length * 7000;

      subtotal += unitPrice * item.qty;

      if (!Number.isSafeInteger(subtotal)) {
        throw new BadRequestException('Tổng tiền đơn hàng không hợp lệ');
      }
    }

    const promotionCode = dto.promotionCode?.trim().toUpperCase();

    if (!promotionCode) {
      throw new BadRequestException('Vui lòng nhập mã khuyến mãi');
    }

    const promotion = await this.prisma.promotion.findUnique({
      where: { code: promotionCode },
    });

    if (!promotion || !promotion.isActive) {
      throw new BadRequestException(
        'Mã khuyến mãi không tồn tại hoặc đã bị vô hiệu hóa',
      );
    }

    const now = new Date();

    if (now < promotion.startAt || now > promotion.endAt) {
      throw new BadRequestException(
        'Mã khuyến mãi đã hết hạn hoặc chưa đến thời gian sử dụng',
      );
    }

    if (
      promotion.usageLimit !== null &&
      promotion.usedCount >= promotion.usageLimit
    ) {
      throw new BadRequestException(
        'Mã khuyến mãi đã hết lượt sử dụng',
      );
    }

    if (subtotal < promotion.minOrderValue) {
      throw new BadRequestException(
        `Đơn hàng phải đạt tối thiểu ${promotion.minOrderValue.toLocaleString('vi-VN')}đ để sử dụng mã này`,
      );
    }

    if (
      !Number.isSafeInteger(promotion.discountValue) ||
      promotion.discountValue <= 0
    ) {
      throw new BadRequestException('Giá trị khuyến mãi không hợp lệ');
    }

    let discountAmount = 0;

    if (promotion.discountType === DiscountType.PERCENTAGE) {
      if (promotion.discountValue > 100) {
        throw new BadRequestException(
          'Phần trăm giảm giá không được vượt quá 100%',
        );
      }

      discountAmount = Math.floor(
        (subtotal * promotion.discountValue) / 100,
      );
    } else if (promotion.discountType === DiscountType.FIXED_AMOUNT) {
      discountAmount = promotion.discountValue;
    } else {
      throw new BadRequestException('Loại khuyến mãi không hợp lệ');
    }

    if (
      promotion.maxDiscount !== null &&
      promotion.maxDiscount <= 0
    ) {
      throw new BadRequestException(
        'Mức giảm tối đa của mã khuyến mãi không hợp lệ',
      );
    }

    if (promotion.maxDiscount !== null) {
      discountAmount = Math.min(
        discountAmount,
        promotion.maxDiscount,
      );
    }

    discountAmount = Math.min(discountAmount, subtotal);

    return {
      valid: true,
      promotionCode: promotion.code,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      subtotal,
      discountAmount,
      total: subtotal - discountAmount,
    };
  }

  async create(
    userId: string,
    key: string,
    dto: CreateOrderDto,
    role: UserRole = UserRole.CUSTOMER,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const idempotencyKey = key?.trim();

    if (
      !idempotencyKey ||
      idempotencyKey.length < 8 ||
      idempotencyKey.length > 200
    ) {
      throw new BadRequestException(
        'Idempotency-Key phải có độ dài từ 8 đến 200 ký tự',
      );
    }

    const requestedItems = normalizeOrderItems(dto);
    const promotionCode = dto.promotionCode?.trim().toUpperCase() || null;

    const existingOrder = await this.prisma.order.findUnique({
      where: { idempotencyKey },
      include: { items: true },
    });

    if (existingOrder) {
      if (existingOrder.userId !== userId) {
        throw new ConflictException('Idempotency-Key đã được sử dụng');
      }

      if (
        !matchesOrderPayload(
          existingOrder,
          promotionCode,
          requestedItems,
        )
      ) {
        throw new ConflictException(
          'Idempotency-Key đã được sử dụng cho nội dung đơn hàng khác',
        );
      }

      return existingOrder;
    }

    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          const orderLines: {
            productId: string;
            qty: number;
            size: string;
            toppings: string[];
            unitPrice: number;
            lineTotal: number;
          }[] = [];

          let total = 0;

          for (const item of requestedItems) {
            const product = await tx.product.findFirst({
              where: {
                id: item.productId,
                isActive: true,
              },
            });

            if (!product) {
              throw new BadRequestException(
                `Sản phẩm ${item.productId} không tồn tại hoặc đã ngừng bán`,
              );
            }

            const changed = await tx.product.updateMany({
              where: {
                id: product.id,
                isActive: true,
                stock: { gte: item.qty },
                version: product.version,
              },
              data: {
                stock: { decrement: item.qty },
                version: { increment: 1 },
              },
            });

            if (changed.count !== 1) {
              throw new ConflictException(
                `Sản phẩm "${product.name}" vừa thay đổi tồn kho hoặc không đủ số lượng. Vui lòng thử lại.`,
              );
            }

            const sizePrice =
              item.size === 'M' ? 5000 : item.size === 'L' ? 10000 : 0;

            const unitPrice =
              product.price + sizePrice + item.toppings.length * 7000;

            const lineTotal = unitPrice * item.qty;
            total += lineTotal;

            orderLines.push({
              productId: product.id,
              qty: item.qty,
              size: item.size,
              toppings: item.toppings,
              unitPrice,
              lineTotal,
            });
          }

          let discountAmount = 0;

          if (promotionCode) {
            const promotion = await tx.promotion.findUnique({
              where: { code: promotionCode },
            });

            if (!promotion || !promotion.isActive) {
              throw new BadRequestException(
                'Mã khuyến mãi không tồn tại hoặc đã bị vô hiệu hóa',
              );
            }

            const now = new Date();

            if (now < promotion.startAt || now > promotion.endAt) {
              throw new BadRequestException(
                'Mã khuyến mãi đã hết hạn hoặc chưa đến thời gian sử dụng',
              );
            }

            if (total < promotion.minOrderValue) {
              throw new BadRequestException(
                `Đơn hàng phải đạt tối thiểu ${promotion.minOrderValue.toLocaleString('vi-VN')}đ để sử dụng mã này`,
              );
            }

            if (
              !Number.isSafeInteger(promotion.discountValue) ||
              promotion.discountValue <= 0
            ) {
              throw new BadRequestException(
                'Giá trị khuyến mãi không hợp lệ',
              );
            }

            if (
              promotion.discountType === DiscountType.PERCENTAGE &&
              promotion.discountValue > 100
            ) {
              throw new BadRequestException(
                'Phần trăm giảm giá không được vượt quá 100%',
              );
            }

            if (
              promotion.maxDiscount !== null &&
              promotion.maxDiscount <= 0
            ) {
              throw new BadRequestException(
                'Mức giảm tối đa của mã khuyến mãi không hợp lệ',
              );
            }

            if (promotion.discountType === DiscountType.PERCENTAGE) {
              discountAmount = Math.floor(
                (total * promotion.discountValue) / 100,
              );
            } else if (
              promotion.discountType === DiscountType.FIXED_AMOUNT
            ) {
              discountAmount = promotion.discountValue;
            } else {
              throw new BadRequestException(
                'Loại khuyến mãi không hợp lệ',
              );
            }

            if (promotion.maxDiscount !== null) {
              discountAmount = Math.min(
                discountAmount,
                promotion.maxDiscount,
              );
            }

            discountAmount = Math.min(discountAmount, total);

            const claimedPromotion = await tx.promotion.updateMany({
              where: {
                id: promotion.id,
                isActive: true,
                startAt: { lte: now },
                endAt: { gte: now },
                ...(promotion.usageLimit !== null
                  ? { usedCount: { lt: promotion.usageLimit } }
                  : {}),
              },
              data: {
                usedCount: { increment: 1 },
              },
            });

            if (claimedPromotion.count !== 1) {
              throw new ConflictException(
                'Mã khuyến mãi vừa hết lượt sử dụng hoặc không còn hiệu lực',
              );
            }
          }

          return tx.order.create({
            data: {
              userId,
              idempotencyKey,
              total: total - discountAmount,
              discountAmount,
              promotionCode,
              items: {
                create: orderLines,
              },
            },
            include: {
              items: {
                include: { product: true },
              },
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      await this.audit.record({
        actorUserId: userId,
        actorRole: role,
        action: 'ORDER_CREATED',
        entity: 'ORDER',
        entityId: created.id,
        description: 'Tạo đơn hàng mới',
        ...meta,
      });

      return created;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        const racedOrder = await this.prisma.order.findUnique({
          where: { idempotencyKey },
          include: { items: true },
        });

        if (racedOrder) {
          if (racedOrder.userId !== userId) {
            throw new ConflictException('Idempotency-Key đã được sử dụng');
          }

          if (
            !matchesOrderPayload(
              racedOrder,
              promotionCode,
              requestedItems,
            )
          ) {
            throw new ConflictException(
              'Idempotency-Key đã được sử dụng cho nội dung đơn hàng khác',
            );
          }

          return racedOrder;
        }

        if (error.code === 'P2034') {
          throw new BadRequestException(
            'Có cập nhật tồn kho đồng thời; vui lòng tạo lại đơn hàng',
          );
        }
      }

      throw error;
    }
  }

  async myOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: { product: true },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async managementOrders(
    actorId: string,
    actorRole: UserRole,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const orders = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        cancellationRequestStatus: true,
        cancellationReason: true,
        cancellationRequestedAt: true,
        cancellationReviewedAt: true,
        cancellationReviewedBy: true,
        inventoryRestored: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          select: {
            id: true,
            qty: true,
            size: true,
            toppings: true,
            lineTotal: true,
            product: {
              select: { name: true },
            },
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
          },
        },
      },
    });

    await this.audit.record({
      actorUserId: actorId,
      actorRole,
      action: 'CUSTOMER_ORDER_DATA_ACCESSED',
      entity: 'ORDER',
      description: 'Nhân viên truy cập danh sách đơn hàng khách hàng',
      ...meta,
    });

    return orders;
  }

  async getOwned(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        items: {
          include: { product: true },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    return order;
  }

  async cancelPendingOrder(
    userId: string,
    orderId: string,
    reason: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const normalizedReason = reason?.trim();

    if (!normalizedReason) {
      throw new BadRequestException('Vui lòng chọn lý do hủy đơn hàng');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          userId,
        },
        include: {
          items: true,
          payments: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException(
          'Chỉ có thể hủy trực tiếp đơn hàng đang chờ thanh toán',
        );
      }

      return this.cancelInTransaction(tx, order, {
        reason: normalizedReason,
      });
    });

    await this.audit.record({
      actorUserId: userId,
      actorRole: UserRole.CUSTOMER,
      action: 'ORDER_CANCELLED_BY_CUSTOMER',
      entity: 'ORDER',
      entityId: orderId,
      description: `Khách hàng trực tiếp hủy đơn hàng. Lý do: ${normalizedReason}`,
      ...meta,
    });

    return result;
  }

  async requestCancellation(
    userId: string,
    orderId: string,
    reason?: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    const normalizedReason = reason?.trim();

    if (!normalizedReason) {
      throw new BadRequestException('Vui lòng chọn lý do hủy đơn hàng');
    }

    if (
      order.status !== OrderStatus.PAID &&
      order.status !== OrderStatus.PREPARING
    ) {
      throw new BadRequestException(
        'Chỉ có thể yêu cầu hủy đơn đã thanh toán hoặc đang pha chế',
      );
    }

    if (
      order.cancellationRequestStatus ===
      CancellationRequestStatus.PENDING
    ) {
      throw new ConflictException('Đơn hàng đã có yêu cầu hủy đang chờ xử lý');
    }

    const updated = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        userId,
        status: order.status,
        cancellationRequestStatus: {
          not: CancellationRequestStatus.PENDING,
        },
      },
      data: {
        cancellationRequestStatus: CancellationRequestStatus.PENDING,
        cancellationReason: normalizedReason,
        cancellationRequestedAt: new Date(),
        cancellationReviewedAt: null,
        cancellationReviewedBy: null,
      },
    });

    if (updated.count !== 1) {
      throw new ConflictException(
        'Đơn hàng vừa được cập nhật, vui lòng tải lại',
      );
    }

    await this.audit.record({
      actorUserId: userId,
      actorRole: UserRole.CUSTOMER,
      action: 'ORDER_CANCELLATION_REQUESTED',
      entity: 'ORDER',
      entityId: orderId,
      description: 'Khách hàng gửi yêu cầu hủy đơn hàng',
      ...meta,
    });

    return this.getOwned(userId, orderId);
  }

  async reviewCancellation(
    orderId: string,
    approved: boolean,
    actorId: string,
    actorRole: UserRole,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true, payments: true },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      if (
        order.cancellationRequestStatus !==
        CancellationRequestStatus.PENDING
      ) {
        throw new BadRequestException(
          'Đơn hàng không có yêu cầu hủy đang chờ xử lý',
        );
      }

      if (
        order.status !== OrderStatus.PAID &&
        order.status !== OrderStatus.PREPARING
      ) {
        throw new BadRequestException(
          'Trạng thái đơn hàng không còn phù hợp để xử lý yêu cầu hủy',
        );
      }

      if (!approved) {
        const rejected = await tx.order.updateMany({
          where: {
            id: orderId,
            status: order.status,
            cancellationRequestStatus: CancellationRequestStatus.PENDING,
          },
          data: {
            cancellationRequestStatus: CancellationRequestStatus.REJECTED,
            cancellationReviewedAt: new Date(),
            cancellationReviewedBy: actorId,
          },
        });

        if (rejected.count !== 1) {
          throw new ConflictException(
            'Yêu cầu hủy vừa được xử lý bởi nhân viên khác',
          );
        }

        return tx.order.findUniqueOrThrow({
          where: { id: orderId },
        });
      }

      return this.cancelInTransaction(tx, order, {
        reviewedBy: actorId,
      });
    });

    await this.audit.record({
      actorUserId: actorId,
      actorRole,
      action: approved
        ? 'ORDER_CANCELLATION_APPROVED'
        : 'ORDER_CANCELLATION_REJECTED',
      entity: 'ORDER',
      entityId: orderId,
      description: approved
        ? 'Nhân viên duyệt yêu cầu hủy đơn hàng'
        : 'Nhân viên từ chối yêu cầu hủy đơn hàng',
      ...meta,
    });

    return result;
  }

  async staffCancelOrder(
    orderId: string,
    actorId: string,
    actorRole: UserRole,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true, payments: true },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException(
          'Chỉ có thể ghi nhận lỗi thanh toán cho đơn hàng đang chờ thanh toán',
        );
      }

      const hasPendingPayment = order.payments.some(
        (payment) =>
          payment.status === PaymentStatus.PENDING &&
          ['BANK_TRANSFER', 'VNPAY', 'MOMO'].includes(payment.method),
      );

      if (!hasPendingPayment) {
        throw new BadRequestException(
          'Đơn hàng không có giao dịch thanh toán đang chờ xử lý',
        );
      }

      const hasSucceededPayment = order.payments.some(
        (payment) => payment.status === PaymentStatus.SUCCEEDED,
      );

      if (hasSucceededPayment) {
        throw new BadRequestException(
          'Đơn hàng đã có thanh toán thành công, không thể ghi nhận lỗi thanh toán',
        );
      }

      return this.cancelInTransaction(tx, order);
    });

    await this.audit.record({
      actorUserId: actorId,
      actorRole,
      action: 'ORDER_CANCELLED_BY_STAFF',
      entity: 'ORDER',
      entityId: orderId,
      description: 'Nhân viên ghi nhận lỗi thanh toán và hủy đơn hàng',
      ...meta,
    });

    return result;
  }

  private async cancelInTransaction(
    tx: Prisma.TransactionClient,
    order: Prisma.OrderGetPayload<{
      include: {
        items: true;
        payments: true;
      };
    }>,
    options: {
      reviewedBy?: string;
      reason?: string;
    } = {},
  ) {
    const cancellableStatuses = [
      OrderStatus.PENDING,
      OrderStatus.PAID,
      OrderStatus.PREPARING,
    ] as OrderStatus[];

    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Không thể hủy đơn hàng ở trạng thái ${order.status}`,
      );
    }

    const shouldRestoreInventory = true;

    const claimed = await tx.order.updateMany({
      where: {
        id: order.id,
        status: order.status,
        inventoryRestored: false,
      },
      data: {
        status: OrderStatus.CANCELLED,
        inventoryRestored: shouldRestoreInventory
          ? true
          : order.inventoryRestored,
        cancellationRequestStatus: options.reviewedBy
          ? CancellationRequestStatus.APPROVED
          : order.cancellationRequestStatus,
        cancellationReviewedAt: options.reviewedBy ? new Date() : undefined,
        cancellationReviewedBy: options.reviewedBy,
        cancellationReason: options.reason ?? undefined,
      },
    });

    if (claimed.count !== 1) {
      throw new ConflictException(
        'Đơn hàng đã được xử lý hoặc đã bị hủy trước đó',
      );
    }

    if (shouldRestoreInventory) {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.qty },
            version: { increment: 1 },
          },
        });
      }
    }

    for (const payment of order.payments) {
      if (payment.status === PaymentStatus.PENDING) {
        await tx.payment.updateMany({
          where: {
            id: payment.id,
            status: PaymentStatus.PENDING,
          },
          data: {
            status: PaymentStatus.FAILED,
          },
        });
      }

      if (payment.status === PaymentStatus.SUCCEEDED) {
        if (payment.method === 'LOYALTY_POINTS') {
          const match = payment.providerRef?.match(/^POINTS-(\d+)$/);
          const pointsToRefund = match ? Number(match[1]) : 0;

          if (!Number.isSafeInteger(pointsToRefund) || pointsToRefund <= 0) {
            throw new ConflictException(
              'Không thể hoàn điểm vì dữ liệu thanh toán không hợp lệ',
            );
          }

          const refunded = await tx.payment.updateMany({
            where: {
              id: payment.id,
              status: PaymentStatus.SUCCEEDED,
            },
            data: {
              status: PaymentStatus.REFUNDED,
            },
          });

          if (refunded.count !== 1) {
            throw new ConflictException(
              'Thanh toán đã được xử lý hoàn tiền trước đó',
            );
          }

          await tx.user.update({
            where: { id: order.userId },
            data: {
              loyaltyPoints: { increment: pointsToRefund },
            },
          });
        } else {
          await tx.payment.updateMany({
            where: {
              id: payment.id,
              status: PaymentStatus.SUCCEEDED,
            },
            data: {
              status: PaymentStatus.REFUND_PENDING,
            },
          });
        }
      }
    }

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: {
        items: {
          include: { product: true },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async updateStatus(
    orderId: string,
    status: OrderStatus,
    actorId?: string,
    actorRole: UserRole = UserRole.STAFF,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      if (!transitions[order.status].includes(status)) {
        throw new BadRequestException(
          `Không thể chuyển trạng thái ${order.status} sang ${status}`,
        );
      }

      const result = await tx.order.updateMany({
        where: {
          id: orderId,
          status: order.status,
        },
        data: { status },
      });

      if (result.count !== 1) {
        throw new BadRequestException(
          'Đơn hàng đã được cập nhật bởi một thao tác khác',
        );
      }

      const resultOrder = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!resultOrder) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      return resultOrder;
    });

    if (actorId) {
      await this.audit.record({
        actorUserId: actorId,
        actorRole,
        action: 'ORDER_STATUS_UPDATED',
        entity: 'ORDER',
        entityId: orderId,
        description: `Nhân viên cập nhật trạng thái đơn hàng thành ${status}`,
        ...meta,
      });
    }

    return updated;
  }
}
