import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, UserRole } from '@prisma/client';
import { PaymentsService } from '../src/payments/payments.service';
import { POINT_REDEMPTION_VALUE } from '../src/common/loyalty.constants';

describe('PaymentsService - loyalty points', () => {
  let service: PaymentsService;
  let prisma: any;
  let audit: any;
  let tx: any;

  const order = {
    id: 'order-1',
    userId: 'user-1',
    status: OrderStatus.PENDING,
    total: 50_000,
    payments: [],
  };

  beforeEach(() => {
    tx = {
      order: {
        findFirst: jest.fn().mockResolvedValue(order),
        findUnique: jest.fn().mockResolvedValue(order),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ loyaltyPoints: 200 }),
      },
      payment: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'payment-1',
          ...data,
        })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'payment-1',
          status: PaymentStatus.SUCCEEDED,
        }),
      },
    };
    prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(null) },
      order: { findFirst: jest.fn().mockResolvedValue({ id: 'order-1' }) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    audit = { record: jest.fn().mockResolvedValue(null) };
    service = new PaymentsService(prisma, audit);
  });

  it('deducts the exact required points and marks the order as paid', async () => {
    const result = await service.create(
      'user-1',
      'points-key-001',
      { orderId: 'order-1', method: 'LOYALTY_POINTS' },
      UserRole.CUSTOMER,
    );

    const required = Math.ceil(order.total / POINT_REDEMPTION_VALUE);
    expect(required).toBe(100);
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', loyaltyPoints: { gte: required } },
      data: { loyaltyPoints: { decrement: required } },
    });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', userId: 'user-1', status: OrderStatus.PENDING },
      data: { status: OrderStatus.PAID },
    });
    expect(result.status).toBe(PaymentStatus.SUCCEEDED);
    expect(result.providerRef).toBe('POINTS-100');
  });

  it('rejects payment when the balance is insufficient and does not create a payment', async () => {
    tx.user.updateMany.mockResolvedValue({ count: 0 });
    tx.user.findUnique.mockResolvedValue({ loyaltyPoints: 99 });

    await expect(
      service.create(
        'user-1',
        'points-key-002',
        { orderId: 'order-1', method: 'LOYALTY_POINTS' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('rejects an order that already has a successful payment', async () => {
    tx.order.findFirst.mockResolvedValue({
      ...order,
      payments: [{ status: PaymentStatus.SUCCEEDED }],
    });

    await expect(
      service.create(
        'user-1',
        'points-key-003',
        { orderId: 'order-1', method: 'LOYALTY_POINTS' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });


  it('rejects an idempotency key that is too short', async () => {
    await expect(
      service.create(
        'user-1',
        'short',
        { orderId: 'order-1', method: 'LOYALTY_POINTS' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key reused for another order', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'payment-old',
      orderId: 'order-1',
      method: 'LOYALTY_POINTS',
    });

    await expect(
      service.create(
        'user-1',
        'points-key-004',
        { orderId: 'order-2', method: 'LOYALTY_POINTS' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an idempotency key reused with another payment method', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'payment-old',
      orderId: 'order-1',
      method: 'LOYALTY_POINTS',
    });

    await expect(
      service.create(
        'user-1',
        'points-key-005',
        { orderId: 'order-1', method: 'CASH' as any },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects payment for an order that does not belong to the user', async () => {
    tx.order.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        'user-1',
        'points-key-006',
        { orderId: 'order-foreign', method: 'LOYALTY_POINTS' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('rejects confirmation when the order has no pending payment', async () => {
    tx.order.findFirst.mockResolvedValue({
      ...order,
      payments: [],
    });

    await expect(
      service.confirm(
        'order-1',
        'staff-1',
        UserRole.STAFF,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects confirmation when the order is already paid', async () => {
    tx.order.findUnique.mockResolvedValue({
      ...order,
      status: OrderStatus.PAID,
      payments: [
        { status: PaymentStatus.PENDING },
      ],
    });

    await expect(
      service.confirm(
        'order-1',
        'staff-1',
        UserRole.STAFF,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('confirms a pending payment successfully', async () => {
    tx.order.findUnique.mockResolvedValue({
      ...order,
      payments: [
        {
          id: 'payment-1',
          method: 'CASH',
          status: PaymentStatus.PENDING,
        },
      ],
    });

    tx.payment.findUniqueOrThrow.mockResolvedValue({
      id: 'payment-1',
      status: PaymentStatus.SUCCEEDED,
    });

    const result = await service.confirm(
      'order-1',
      'staff-1',
      UserRole.STAFF,
    );

    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'order-1',
        status: OrderStatus.PENDING,
      },
      data: {
        status: OrderStatus.PAID,
      },
    });

    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'payment-1',
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.SUCCEEDED,
      },
    });

    expect(result.status).toBe(PaymentStatus.SUCCEEDED);
    expect(audit.record).toHaveBeenCalled();
  });

  it('rejects confirmation when another staff has already claimed the order', async () => {
    tx.order.findUnique.mockResolvedValue({
      ...order,
      payments: [
        {
          id: 'payment-1',
          method: 'CASH',
          status: PaymentStatus.PENDING,
        },
      ],
    });

    tx.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.confirm(
        'order-1',
        'staff-2',
        UserRole.STAFF,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
