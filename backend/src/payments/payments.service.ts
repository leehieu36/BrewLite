import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreatePaymentDto } from './payments.dto';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) { }
  async create(userId: string, key: string, dto: CreatePaymentDto) {
    if (!key || key.trim().length < 8 || key.length > 200) throw new BadRequestException('Header Idempotency-Key là bắt buộc (8–200 ký tự)');
    const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey: key } });
    if (existing) {
      const ownerOrder = await this.prisma.order.findFirst({ where: { id: existing.orderId, userId } });
      if (!ownerOrder) throw new NotFoundException('Không tìm thấy đơn hàng');
      if (existing.orderId !== dto.orderId) throw new ConflictException('Idempotency-Key đã được dùng cho đơn hàng khác');
      return existing;
    }
    const order = await this.prisma.order.findFirst({ where: { id: dto.orderId, userId }, include: { payments: true } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.status !== OrderStatus.PENDING) throw new BadRequestException(`Đơn hàng đang ở trạng thái ${order.status}, không thể thanh toán`);
    if (order.payments.some(p => p.status === PaymentStatus.SUCCEEDED)) throw new ConflictException('Đơn hàng đã thanh toán');
    // All online methods are simulated until real bank, VNPay, or MoMo credentials are configured.
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Compare-and-set makes only one concurrent payment attempt win for a pending order.
        const claimed = await tx.order.updateMany({ where: { id: order.id, userId, status: OrderStatus.PENDING }, data: { status: OrderStatus.PAID } });
        if (claimed.count !== 1) throw new BadRequestException('Đơn hàng không còn ở trạng thái chờ thanh toán');
        const payment = await tx.payment.create({ data: { orderId: order.id, idempotencyKey: key, amount: order.total, method: dto.method, status: PaymentStatus.SUCCEEDED, providerRef: `DEMO-${dto.method}-${Date.now()}` } });
        // Simple loyalty rule: 1 point per 10,000 VND, credited once after successful mock payment.
        const points = Math.floor(order.total / 10000);
        if (points > 0) await tx.user.update({ where: { id: userId }, data: { loyaltyPoints: { increment: points } } });
        return payment;
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      // A parallel retry can win the unique idempotency-key race; return the stored result.
      const raced = await this.prisma.payment.findUnique({ where: { idempotencyKey: key } });
      if (raced && raced.orderId === dto.orderId) return raced;
      throw error;
    }
  }
}
