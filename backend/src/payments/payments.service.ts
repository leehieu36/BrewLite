
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, OrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreatePaymentDto } from './payments.dto';
import { AuditService } from '../audit/audit.service';
import { POINT_REDEMPTION_VALUE } from '../common/loyalty.constants';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(
    userId: string,
    key: string,
    dto: CreatePaymentDto,
    role: UserRole = UserRole.CUSTOMER,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    if (!key || key.trim().length < 8 || key.length > 200) {
      throw new BadRequestException(
        'Header Idempotency-Key là bắt buộc (8–200 ký tự)',
      );
    }

    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: key },
    });

    if (existing) {
      const ownerOrder = await this.prisma.order.findFirst({
        where: { id: existing.orderId, userId },
      });

      if (!ownerOrder) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      if (existing.orderId !== dto.orderId) {
        throw new ConflictException(
          'Idempotency-Key đã được dùng cho đơn hàng khác',
        );
      }

      if (existing.method !== dto.method) {
        throw new ConflictException(
          'Idempotency-Key đã được dùng cho phương thức thanh toán khác',
        );
      }

      return existing;
    }

    try {
      const payment = await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.findFirst({
          where: {
            id: dto.orderId,
            userId,
          },
          include: { payments: true },
        });

        if (!order) {
          throw new NotFoundException('Không tìm thấy đơn hàng');
        }

        if (order.status !== OrderStatus.PENDING) {
          throw new BadRequestException(
            `Đơn hàng đang ở trạng thái ${order.status}, không thể thanh toán`,
          );
        }

        if (
          order.payments.some(
            (p) => p.status === PaymentStatus.SUCCEEDED,
          )
        ) {
          throw new ConflictException('Đơn hàng đã thanh toán');
        }

        if (
          order.payments.some(
            (p) => p.status === PaymentStatus.PENDING,
          )
        ) {
          throw new ConflictException(
            'Đơn hàng đang có yêu cầu thanh toán chờ xác nhận',
          );
        }

        const isPoints = dto.method === 'LOYALTY_POINTS';

        if (isPoints) {
          const pointsRequired = Math.ceil(
            Number(order.total) / POINT_REDEMPTION_VALUE,
          );

          const deducted = await tx.user.updateMany({
            where: {
              id: userId,
              loyaltyPoints: { gte: pointsRequired },
            },
            data: {
              loyaltyPoints: { decrement: pointsRequired },
            },
          });

          if (deducted.count !== 1) {
            const user = await tx.user.findUnique({
              where: { id: userId },
              select: { loyaltyPoints: true },
            });

            throw new BadRequestException(
              `Không đủ điểm thanh toán. Cần ${pointsRequired} điểm, hiện có ${user?.loyaltyPoints ?? 0} điểm.`,
            );
          }

          const claimed = await tx.order.updateMany({
            where: {
              id: order.id,
              userId,
              status: OrderStatus.PENDING,
            },
            data: {
              status: OrderStatus.PAID,
            },
          });

          if (claimed.count !== 1) {
            throw new BadRequestException(
              'Đơn hàng không còn ở trạng thái chờ thanh toán',
            );
          }
        }

        const pointsRequired = Math.ceil(
          Number(order.total) / POINT_REDEMPTION_VALUE,
        );

        return tx.payment.create({
          data: {
            orderId: order.id,
            idempotencyKey: key,
            amount: order.total,
            method: dto.method,
            status: isPoints
              ? PaymentStatus.SUCCEEDED
              : PaymentStatus.PENDING,
            providerRef: isPoints
              ? `POINTS-${pointsRequired}`
              : null,
          },
        });
      });

      await this.audit.record({
        actorUserId: userId,
        actorRole: role,
        action:
          payment.status === PaymentStatus.SUCCEEDED
            ? 'PAYMENT_SUCCEEDED'
            : 'PAYMENT_PENDING',
        entity: 'PAYMENT',
        entityId: payment.id,
        description:
          payment.status === PaymentStatus.SUCCEEDED
            ? 'Thanh toán đơn hàng bằng điểm tích lũy'
            : `Khách hàng gửi yêu cầu thanh toán bằng ${payment.method}, đang chờ xác nhận`,
        ...meta,
      });

      return payment;
    } catch (error) {
        if (
          error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ConflictException
        ) {
          throw error;
        }

        const isUniqueConstraintError =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002';

        if (isUniqueConstraintError) {
          const raced = await this.prisma.payment.findUnique({
            where: { idempotencyKey: key },
          });

          if (raced) {
            const ownerOrder = await this.prisma.order.findFirst({
              where: {
                id: raced.orderId,
                userId,
              },
            });

            if (!ownerOrder) {
              throw new NotFoundException('Không tìm thấy đơn hàng');
            }

            if (raced.orderId !== dto.orderId) {
              throw new ConflictException(
                'Idempotency-Key đã được dùng cho đơn hàng khác',
              );
            }

            if (raced.method !== dto.method) {
              throw new ConflictException(
                'Idempotency-Key đã được dùng cho phương thức thanh toán khác',
              );
            }

            return raced;
          }
        }

        throw error;
      }
  }

  async confirm(
    orderId: string,
    actorId: string,
    actorRole: UserRole,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const payment = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { payments: true },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new ConflictException(
          'Đơn hàng không còn ở trạng thái chờ thanh toán',
        );
      }

      const pendingPayment = order.payments.find(
        (p) => p.status === PaymentStatus.PENDING,
      );

      if (!pendingPayment) {
        throw new ConflictException(
          'Không tìm thấy yêu cầu thanh toán đang chờ xác nhận',
        );
      }

      if (pendingPayment.method === 'LOYALTY_POINTS') {
        throw new BadRequestException(
          'Thanh toán bằng điểm không cần xác nhận thủ công',
        );
      }

      const claimed = await tx.order.updateMany({
        where: {
          id: orderId,
          status: OrderStatus.PENDING,
        },
        data: {
          status: OrderStatus.PAID,
        },
      });

      if (claimed.count !== 1) {
        throw new ConflictException(
          'Đơn hàng đã được xử lý bởi nhân viên khác',
        );
      }

      const updatedPayment = await tx.payment.updateMany({
        where: {
          id: pendingPayment.id,
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.SUCCEEDED,
        },
      });

      if (updatedPayment.count !== 1) {
        throw new ConflictException(
          'Thanh toán đã được xử lý bởi nhân viên khác',
        );
      }

      return tx.payment.findUniqueOrThrow({
        where: { id: pendingPayment.id },
      });
    });

    await this.audit.record({
      actorUserId: actorId,
      actorRole,
      action: 'PAYMENT_CONFIRMED',
      entity: 'PAYMENT',
      entityId: payment.id,
      description: `Nhân viên xác nhận đã nhận thanh toán đơn hàng ${orderId}`,
      ...meta,
    });

    return payment;
  }
}
