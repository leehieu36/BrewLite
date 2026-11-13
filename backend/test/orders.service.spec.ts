
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  CancellationRequestStatus,
  OrderStatus,
  PaymentStatus,
  UserRole,
  DiscountType,
} from '@prisma/client';
import { OrdersService } from '../src/orders/orders.service';

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
        create: jest.fn().mockResolvedValue({ id: 'order-new' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'order-1' }),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
      product: {
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue({
          id: 'product-1',
          name: 'Milk Tea',
          price: 100000,
          stock: 20,
          version: 0,
          isActive: true,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      promotion: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };

    prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };

    prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    audit = { record: jest.fn().mockResolvedValue(null) };
    service = new OrdersService(prisma, audit);
  });

  it('does not award points again when an order transitions to COMPLETED', async () => {
    tx.order.findUnique
      .mockResolvedValueOnce({
        id: 'order-1',
        userId: 'user-1',
        status: OrderStatus.READY,
        total: 50_000,
      })
      .mockResolvedValueOnce({
        id: 'order-1',
        status: OrderStatus.COMPLETED,
      });

    await service.updateStatus(
      'order-1',
      OrderStatus.COMPLETED,
      'staff-1',
      UserRole.STAFF,
    );

    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'order-1',
        status: OrderStatus.READY,
      },
      data: {
        status: OrderStatus.COMPLETED,
      },
    });

    expect(tx.user.update).not.toHaveBeenCalled();
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
      payments: [
        {
          id: 'payment-1',
          method: 'LOYALTY_POINTS',
          status: PaymentStatus.SUCCEEDED,
          providerRef: 'POINTS-100',
        },
      ],
    });

    await service.reviewCancellation(
      'order-1',
      true,
      'staff-1',
      UserRole.STAFF,
    );

    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'payment-1',
        status: PaymentStatus.SUCCEEDED,
      },
      data: {
        status: PaymentStatus.REFUNDED,
      },
    });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        loyaltyPoints: { increment: 100 },
      },
    });

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: {
        stock: { increment: 2 },
        version: { increment: 1 },
      },
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
      payments: [
        {
          id: 'payment-1',
          method: 'LOYALTY_POINTS',
          status: PaymentStatus.SUCCEEDED,
          providerRef: null,
        },
      ],
    });

    await expect(
      service.reviewCancellation(
        'order-1',
        true,
        'staff-1',
        UserRole.STAFF,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.user.update).not.toHaveBeenCalled();
  });

    const createOrderDto = (promotionCode = 'SALE10') =>
    ({
      items: [
        {
          productId: 'product-1',
          qty: 1,
          size: 'S',
          toppings: [],
        },
      ],
      promotionCode,
    }) as any;

  const validPromotion = (overrides = {}) => ({
    id: 'promotion-1',
    code: 'SALE10',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 10,
    minOrderValue: 0,
    maxDiscount: null,
    startAt: new Date(Date.now() - 86400000),
    endAt: new Date(Date.now() + 86400000),
    usageLimit: 100,
    usedCount: 0,
    isActive: true,
    ...overrides,
  });

  it('applies percentage discount correctly', async () => {
    tx.promotion.findUnique.mockResolvedValue(validPromotion());

    await service.create(
      'user-1',
      'idempotency-001',
      createOrderDto(),
    );

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: 90000,
          discountAmount: 10000,
          promotionCode: 'SALE10',
        }),
      }),
    );

    expect(tx.promotion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          usedCount: { increment: 1 },
        },
      }),
    );
  });

  it('applies fixed amount discount correctly', async () => {
    tx.promotion.findUnique.mockResolvedValue(
      validPromotion({
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: 20000,
      }),
    );

    await service.create(
      'user-1',
      'idempotency-002',
      createOrderDto(),
    );

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: 80000,
          discountAmount: 20000,
        }),
      }),
    );
  });

  it('rejects an expired promotion', async () => {
    tx.promotion.findUnique.mockResolvedValue(
      validPromotion({
        endAt: new Date(Date.now() - 86400000),
      }),
    );

    await expect(
      service.create(
        'user-1',
        'idempotency-003',
        createOrderDto(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.order.create).not.toHaveBeenCalled();
    expect(tx.promotion.updateMany).not.toHaveBeenCalled();
  });

  it('rejects promotion when order value is below minimum', async () => {
    tx.promotion.findUnique.mockResolvedValue(
      validPromotion({
        minOrderValue: 150000,
      }),
    );

    await expect(
      service.create(
        'user-1',
        'idempotency-004',
        createOrderDto(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('rejects promotion when its usage limit has been reached', async () => {
    tx.promotion.findUnique.mockResolvedValue(
      validPromotion({
        usageLimit: 10,
        usedCount: 10,
      }),
    );

    tx.promotion.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.create(
        'user-1',
        'idempotency-005',
        createOrderDto(),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('rejects promotion when another request claims the last available use', async () => {
    tx.promotion.findUnique.mockResolvedValue(
      validPromotion({
        usageLimit: 1,
        usedCount: 0,
      }),
    );

    tx.promotion.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.create(
        'user-1',
        'idempotency-006',
        createOrderDto(),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.promotion.updateMany).toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });
});
