
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
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateOrderDto } from './orders.dto';
import { AuditService } from '../audit/audit.service';
import {
  POINT_REDEMPTION_VALUE,
  SPENDING_PER_POINT,
} from '../common/loyalty.constants';

const transitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'PAYMENT_FAILED'],
  PAID: ['PREPARING'],
  PREPARING: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  PAYMENT_FAILED: [],
  CANCELLED: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(
    userId: string,
    dto: CreateOrderDto,
    role: UserRole = UserRole.CUSTOMER,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const merged = new Map<
      string,
      { productId: string; qty: number; size: string; toppings: string[] }
    >();

    for (const item of dto.items) {
      const size = item.size || 'M';
      const toppings: string[] = Array.from(
        new Set<string>(item.toppings ?? []),
      ).sort();

      const key = `${item.productId}:${size}:${toppings.join(',')}`;
      const old = merged.get(key);

      merged.set(key, {
        productId: item.productId,
        qty: (old?.qty || 0) + item.qty,
        size,
        toppings,
      });
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

          for (const item of merged.values()) {
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
              },
              data: {
                stock: { decrement: item.qty },
              },
            });

            if (changed.count !== 1) {
              throw new BadRequestException(
                `Sản phẩm "${product.name}" không đủ tồn kho`,
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

          return tx.order.create({
            data: {
              userId,
              total,
              promotionCode: dto.promotionCode?.trim() || null,
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
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new BadRequestException(
          'Có cập nhật tồn kho đồng thời; vui lòng tạo lại đơn hàng',
        );
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

  // Khách hàng hủy trực tiếp đơn chưa thanh toán.
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

  // Khách gửi yêu cầu hủy đơn đã thanh toán hoặc đang pha chế.
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

  // Nhân viên duyệt hoặc từ chối yêu cầu hủy.
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

      const cancelled = await this.cancelInTransaction(tx, order, {
        reviewedBy: actorId,
      });

      return cancelled;
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

  // Nhân viên chủ động hủy đơn hàng.
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

      if (
        !(
          [
            OrderStatus.PENDING,
            OrderStatus.PAID,
            OrderStatus.PREPARING,
          ] as OrderStatus[]
        ).includes(order.status)
      ) {
        throw new BadRequestException(
          `Không thể hủy đơn hàng ở trạng thái ${order.status}`,
        );
      }

      return this.cancelInTransaction(tx, order, {
        reviewedBy: actorId,
      });
    });

    await this.audit.record({
      actorUserId: actorId,
      actorRole,
      action: 'ORDER_CANCELLED_BY_STAFF',
      entity: 'ORDER',
      entityId: orderId,
      description: 'Nhân viên chủ động hủy đơn hàng',
      ...meta,
    });

    return result;
  }

  // Hàm xử lý hủy dùng chung, chạy bên trong transaction.
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

      // Chỉ cộng điểm khi đơn chuyển sang COMPLETED
      const pointsEarned =
        status === OrderStatus.COMPLETED
          ? Math.floor(Number(order.total) / SPENDING_PER_POINT)
          : 0;

      // Cập nhật có điều kiện để tránh cộng điểm nhiều lần
      const result = await tx.order.updateMany({
        where: {
          id: orderId,
          status: order.status,
        },
        data: {
          status,
          ...(status === OrderStatus.COMPLETED
            ? { loyaltyPointsEarned: pointsEarned }
            : {}),
        },
      });

      if (result.count !== 1) {
        throw new BadRequestException(
          'Đơn hàng đã được cập nhật bởi một thao tác khác',
        );
      }

      // Cộng điểm vào tài khoản người dùng
      if (status === OrderStatus.COMPLETED && pointsEarned > 0) {
        await tx.user.update({
          where: { id: order.userId },
          data: {
            loyaltyPoints: {
              increment: pointsEarned,
            },
          },
        });
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
