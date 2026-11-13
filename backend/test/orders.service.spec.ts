import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  CancellationRequestStatus,
  OrderStatus,
  PaymentStatus,
  UserRole,
} from '@prisma/client';
import { OrdersService } from '../src/orders/orders.service';
import { SPENDING_PER_POINT } from '../src/common/loyalty.constants';

describe('OrdersService - loyalty points', () => {
  let service: OrdersService;
  let prisma: any;
  let audit: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      order: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'order-1' }),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
      product: { update: jest.fn().mockResolvedValue({}) },
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    audit = { record: jest.fn().mockResolvedValue(null) };
    service = new OrdersService(prisma, audit);
  });

  it('awards points only when an order transitions to COMPLETED', async () => {
    tx.order.findUnique
      .mockResolvedValueOnce({
        id: 'order-1',
        userId: 'user-1',
        status: OrderStatus.READY,
        total: 50_000,
      })
      .mockResolvedValueOnce({ id: 'order-1', status: OrderStatus.COMPLETED });

    await service.updateStatus(
      'order-1',
      OrderStatus.COMPLETED,
      'staff-1',
      UserRole.STAFF,
    );

    const earned = Math.floor(50_000 / SPENDING_PER_POINT);
    expect(earned).toBe(5);
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', status: OrderStatus.READY },
      data: {
        status: OrderStatus.COMPLETED,
        loyaltyPointsEarned: earned,
      },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { loyaltyPoints: { increment: earned } },
    });
  });

  it('does not award points again for an already completed order', async () => {
    tx.order.findUnique.mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: OrderStatus.COMPLETED,
      total: 50_000,
    });

    await expect(
      service.updateStatus('order-1', OrderStatus.COMPLETED),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('refunds the exact points after staff approves cancellation of a paid order', async () => {
    tx.order.findUnique.mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: OrderStatus.PAID,
      inventoryRestored: false,
      cancellationRequestStatus: CancellationRequestStatus.PENDING,
      items: [{ productId: 'product-1', qty: 2 }],
      payments: [{
        id: 'payment-1',
        method: 'LOYALTY_POINTS',
        status: PaymentStatus.SUCCEEDED,
        providerRef: 'POINTS-100',
      }],
    });

    await service.reviewCancellation(
      'order-1',
      true,
      'staff-1',
      UserRole.STAFF,
    );

    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: PaymentStatus.SUCCEEDED },
      data: { status: PaymentStatus.REFUNDED },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { loyaltyPoints: { increment: 100 } },
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: { stock: { increment: 2 } },
    });
  });

  it('rejects refund when the stored points reference is invalid', async () => {
    tx.order.findUnique.mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: OrderStatus.PAID,
      inventoryRestored: false,
      cancellationRequestStatus: CancellationRequestStatus.PENDING,
      items: [],
      payments: [{
        id: 'payment-1',
        method: 'LOYALTY_POINTS',
        status: PaymentStatus.SUCCEEDED,
        providerRef: null,
      }],
    });

    await expect(
      service.reviewCancellation(
        'order-1', true, 'staff-1', UserRole.STAFF,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.user.update).not.toHaveBeenCalled();
  });


});
