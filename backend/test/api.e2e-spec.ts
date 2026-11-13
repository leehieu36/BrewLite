
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { OrdersController } from '../src/orders/orders.controller';
import { OrdersService } from '../src/orders/orders.service';
import { PaymentsController } from '../src/payments/payments.controller';
import { PaymentsService } from '../src/payments/payments.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { RolesGuard } from '../src/common/roles.guard';
import { PrismaService } from '../src/database/prisma.service';

describe('Orders and payments API authorization (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwtService: JwtService;

  const JWT_SECRET = 'test-secret-for-api-e2e-123456789';
  let testUserRole = 'CUSTOMER';

  const ordersService = {
    cancelPendingOrder: jest.fn().mockResolvedValue({ id: 'order-1' }),
    requestCancellation: jest.fn().mockResolvedValue({ id: 'order-1' }),
    reviewCancellation: jest.fn().mockResolvedValue({ id: 'order-1' }),
    updateStatus: jest.fn().mockResolvedValue({ id: 'order-1' }),
  };

  const paymentsService = {
    confirm: jest.fn().mockResolvedValue({ id: 'payment-1' }),
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn().mockImplementation(() => ({
        id: 'test-user',
        email: 'test@example.com',
        role: testUserRole,
      })),
    },
  };

  async function authHeaders(role: 'CUSTOMER' | 'STAFF' | 'ADMIN') {
    testUserRole = role;

    const token = await jwtService.signAsync({
      sub: 'test-user',
      email: 'test@example.com',
    });

    return {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret: JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [OrdersController, PaymentsController],
      providers: [
        Reflector,
        JwtAuthGuard,
        JwtStrategy,
        RolesGuard,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) =>
              key === 'JWT_SECRET' ? JWT_SECRET : defaultValue,
          },
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        { provide: OrdersService, useValue: ordersService },
        { provide: PaymentsService, useValue: paymentsService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    jwtService = moduleRef.get(JwtService);

    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    testUserRole = 'CUSTOMER';
  });

  it('rejects requests without an access token', async () => {
    const response = await fetch(`${baseUrl}/orders/order-1/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Customer request' }),
    });

    expect(response.status).toBe(401);
    expect(ordersService.cancelPendingOrder).not.toHaveBeenCalled();
  });

  it('rejects requests with an invalid access token', async () => {
    const response = await fetch(`${baseUrl}/orders/order-1/cancel`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer invalid-token',
      },
      body: JSON.stringify({ reason: 'Customer request' }),
    });

    expect(response.status).toBe(401);
    expect(ordersService.cancelPendingOrder).not.toHaveBeenCalled();
  });

  it('allows a customer to cancel their pending order through the API', async () => {
    const response = await fetch(`${baseUrl}/orders/order-1/cancel`, {
      method: 'POST',
      headers: await authHeaders('CUSTOMER'),
      body: JSON.stringify({ reason: 'Customer request' }),
    });

    expect(response.status).toBe(201);
    expect(ordersService.cancelPendingOrder).toHaveBeenCalledWith(
      'test-user',
      'order-1',
      'Customer request',
      expect.any(Object),
    );
  });

  it('rejects invalid request bodies before calling the service', async () => {
    const response = await fetch(`${baseUrl}/orders/order-1/cancel`, {
      method: 'POST',
      headers: await authHeaders('CUSTOMER'),
      body: JSON.stringify({ reason: 123 }),
    });

    expect(response.status).toBe(400);
    expect(ordersService.cancelPendingOrder).not.toHaveBeenCalled();
  });

  it('rejects unexpected fields in request bodies', async () => {
    const response = await fetch(`${baseUrl}/orders/order-1/cancel`, {
      method: 'POST',
      headers: await authHeaders('CUSTOMER'),
      body: JSON.stringify({
        reason: 'Customer request',
        isAdmin: true,
      }),
    });

    expect(response.status).toBe(400);
    expect(ordersService.cancelPendingOrder).not.toHaveBeenCalled();
  });

  it('blocks staff from using the customer-only direct cancellation API', async () => {
    const response = await fetch(`${baseUrl}/orders/order-1/cancel`, {
      method: 'POST',
      headers: await authHeaders('STAFF'),
      body: JSON.stringify({ reason: 'Staff attempt' }),
    });

    expect(response.status).toBe(403);
    expect(ordersService.cancelPendingOrder).not.toHaveBeenCalled();
  });

  it('blocks customers from changing order status', async () => {
    const response = await fetch(`${baseUrl}/orders/order-1/status`, {
      method: 'PATCH',
      headers: await authHeaders('CUSTOMER'),
      body: JSON.stringify({ status: 'COMPLETED' }),
    });

    expect(response.status).toBe(403);
    expect(ordersService.updateStatus).not.toHaveBeenCalled();
  });

  it('allows staff to update order status', async () => {
    const response = await fetch(`${baseUrl}/orders/order-1/status`, {
      method: 'PATCH',
      headers: await authHeaders('STAFF'),
      body: JSON.stringify({ status: 'COMPLETED' }),
    });

    expect(response.status).toBe(200);
    expect(ordersService.updateStatus).toHaveBeenCalled();
  });

  it('blocks customers from confirming a payment', async () => {
    const response = await fetch(`${baseUrl}/payments/order-1/confirm`, {
      method: 'POST',
      headers: await authHeaders('CUSTOMER'),
    });

    expect(response.status).toBe(403);
    expect(paymentsService.confirm).not.toHaveBeenCalled();
  });

  it('allows staff to confirm a pending payment', async () => {
    const response = await fetch(`${baseUrl}/payments/order-1/confirm`, {
      method: 'POST',
      headers: await authHeaders('STAFF'),
    });

    expect(response.status).toBe(201);
    expect(paymentsService.confirm).toHaveBeenCalled();
  });
});
