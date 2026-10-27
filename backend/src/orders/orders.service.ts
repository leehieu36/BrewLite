import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateOrderDto } from './orders.dto';

const transitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'PAYMENT_FAILED', 'CANCELLED'],
  PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  PAYMENT_FAILED: [],
  CANCELLED: [],
};

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) { }

  async create(userId: string, dto: CreateOrderDto) {
    const merged = new Map<
      string,
      { productId: string; qty: number; size: string; toppings: string[] }
    >();

    for (const item of dto.items) {
      const size = item.size || 'M';
      const toppings = [...new Set(item.toppings || [])].sort();
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
      return await this.prisma.$transaction(
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
              where: { id: item.productId, isActive: true },
            });

            if (!product) {
              throw new BadRequestException(
                `Sản phẩm ${item.productId} không tồn tại hoặc đã ngừng bán`,
              );
            }

            // Atomically decrement stock to prevent overselling.
            const changed = await tx.product.updateMany({
              where: {
                id: product.id,
                isActive: true,
                stock: { gte: item.qty },
              },
              data: { stock: { decrement: item.qty } },
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

          // Promotion codes are recorded, but no discount is applied yet.
          return tx.order.create({
            data: {
              userId,
              total,
              promotionCode: dto.promotionCode?.trim() || null,
              items: { create: orderLines },
            },
            include: { items: { include: { product: true } } },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

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
        items: { include: { product: true } },
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

  async getOwned(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: { include: { product: true } }, payments: true },
    });

    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }

  async updateStatus(orderId: string, status: OrderStatus) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });

      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
      if (!transitions[order.status].includes(status)) {
        throw new BadRequestException(
          `Không thể chuyển trạng thái ${order.status} sang ${status}`,
        );
      }

      return tx.order.update({ where: { id: orderId }, data: { status } });
    });
  }
}
