
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Prisma, UserRole } from '@prisma/client';

import { AdminController } from '../src/admin/admin.controller';
import { AdminService } from '../src/admin/admin.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/common/roles.guard';
import { PrismaService } from '../src/database/prisma.service';
import { AuditService } from '../src/audit/audit.service';

describe('Admin API (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwtService: JwtService;

  const JWT_SECRET = 'test-secret-admin-api-123456789';
  let testUserRole: UserRole = UserRole.CUSTOMER;

  const adminUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin',
    role: UserRole.ADMIN,
    loyaltyPoints: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const targetUser = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Customer',
    role: UserRole.CUSTOMER,
    loyaltyPoints: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    activityLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    order: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const auditMock = {
    record: jest.fn(),
  };

  async function authHeaders(role: UserRole) {
    testUserRole = role;

    const token = await jwtService.signAsync({
      sub: role === UserRole.ADMIN ? 'admin-1' : 'test-user',
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
      controllers: [AdminController],
      providers: [
        AdminService,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        Reflector,
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
        {
          provide: AuditService,
          useValue: auditMock,
        },
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
    testUserRole = UserRole.CUSTOMER;

    prismaMock.user.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === 'missing-user') return null;

        if (where.id === 'admin-1' || where.id === 'last-admin') {
          return { id: where.id, role: UserRole.ADMIN };
        }

        return { id: where.id, role: testUserRole };
      },
    );

    prismaMock.user.findMany.mockResolvedValue([targetUser]);
    prismaMock.user.count.mockImplementation(
      async ({ where }: { where?: { role?: UserRole } } = {}) => {
        if (where?.role === UserRole.ADMIN) return 2;
        if (where?.role === UserRole.STAFF) return 1;
        if (where?.role === UserRole.CUSTOMER) return 3;
        return 6;
      },
    );

    prismaMock.user.update.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Customer',
      role: UserRole.STAFF,
      updatedAt: new Date(),
    });

    prismaMock.activityLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        action: 'LOGIN',
        entity: 'AUTH',
        description: 'Đăng nhập thành công',
        createdAt: new Date(),
        actor: {
          id: 'admin-1',
          name: 'Admin',
          email: 'admin@example.com',
        },
      },
    ]);

    prismaMock.activityLog.count.mockResolvedValue(1);

    prismaMock.order.count.mockImplementation(
      async ({ where }: { where?: { status?: string } } = {}) =>
        where?.status === 'PENDING' ? 2 : 10,
    );

    prismaMock.$transaction.mockImplementation(
      async (operation: any, _options?: any) => {
        if (Array.isArray(operation)) {
          return Promise.all(operation);
        }

        return operation(prismaMock);
      },
    );

    auditMock.record.mockResolvedValue(undefined);
  });

  // AUTHENTICATION

  it('rejects requests without JWT', async () => {
    const response = await fetch(`${baseUrl}/admin/summary`);

    expect(response.status).toBe(401);
  });

  it('rejects requests with an invalid JWT', async () => {
    const response = await fetch(`${baseUrl}/admin/summary`, {
      headers: {
        authorization: 'Bearer invalid-token',
      },
    });

    expect(response.status).toBe(401);
  });

  // ACTIVITY LOGS

  it.each([UserRole.CUSTOMER])(
    'blocks %s from viewing activity logs',
    async (role) => {
      const response = await fetch(
        `${baseUrl}/admin/activity-logs`,
        {
          headers: await authHeaders(role),
        },
      );

      expect(response.status).toBe(403);
      expect(prismaMock.activityLog.findMany).not.toHaveBeenCalled();
    },
  );

  it.each([UserRole.ADMIN, UserRole.STAFF])(
    'allows %s to view activity logs',
    async (role) => {
      const response = await fetch(
        `${baseUrl}/admin/activity-logs?page=1&limit=25`,
        {
          headers: await authHeaders(role),
        },
      );

      expect(response.status).toBe(200);

      const body = await response.json();

      expect(body.items).toHaveLength(1);
      expect(body.pagination).toMatchObject({
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
      });
    },
  );

  it('limits activity log page size to 100', async () => {
    const response = await fetch(
      `${baseUrl}/admin/activity-logs?page=1&limit=500`,
      {
        headers: await authHeaders(UserRole.ADMIN),
      },
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.pagination.limit).toBe(100);
    expect(prismaMock.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  // USER MANAGEMENT

  it.each([UserRole.CUSTOMER, UserRole.STAFF])(
    'blocks %s from viewing users',
    async (role) => {
      const response = await fetch(`${baseUrl}/admin/users`, {
        headers: await authHeaders(role),
      });

      expect(response.status).toBe(403);
      expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    },
  );

  it('allows ADMIN to view users without exposing password hashes', async () => {
    const response = await fetch(
      `${baseUrl}/admin/users?page=1&limit=25`,
      {
        headers: await authHeaders(UserRole.ADMIN),
      },
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.items).toHaveLength(1);
    expect(body.items[0]).not.toHaveProperty('passwordHash');

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          email: true,
          role: true,
          loyaltyPoints: true,
        }),
      }),
    );

    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        actorRole: UserRole.ADMIN,
        action: 'CUSTOMER_DATA_ACCESSED',
      }),
    );
  });

  // UPDATE USER ROLE

  it('rejects role updates without authentication', async () => {
    const response = await fetch(
      `${baseUrl}/admin/users/user-1/role`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: UserRole.STAFF }),
      },
    );

    expect(response.status).toBe(401);
  });

  it.each([UserRole.CUSTOMER, UserRole.STAFF])(
    'blocks %s from updating user roles',
    async (role) => {
      const response = await fetch(
        `${baseUrl}/admin/users/user-1/role`,
        {
          method: 'PATCH',
          headers: await authHeaders(role),
          body: JSON.stringify({ role: UserRole.STAFF }),
        },
      );

      expect(response.status).toBe(403);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    },
  );

  it('allows ADMIN to update a user role', async () => {
    const response = await fetch(
      `${baseUrl}/admin/users/user-1/role`,
      {
        method: 'PATCH',
        headers: await authHeaders(UserRole.ADMIN),
        body: JSON.stringify({ role: UserRole.STAFF }),
      },
    );

    expect(response.status).toBe(200);

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { role: UserRole.STAFF },
      }),
    );

    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        actorRole: UserRole.ADMIN,
        action: 'USER_ROLE_UPDATED',
        entityId: 'user-1',
      }),
    );
  });

  it('prevents ADMIN from changing their own role', async () => {
    const response = await fetch(
      `${baseUrl}/admin/users/admin-1/role`,
      {
        method: 'PATCH',
        headers: await authHeaders(UserRole.ADMIN),
        body: JSON.stringify({ role: UserRole.STAFF }),
      },
    );

    expect(response.status).toBe(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('prevents removing the last ADMIN', async () => {
    prismaMock.user.count.mockResolvedValue(1);

    const response = await fetch(
      `${baseUrl}/admin/users/last-admin/role`,
      {
        method: 'PATCH',
        headers: await authHeaders(UserRole.ADMIN),
        body: JSON.stringify({ role: UserRole.STAFF }),
      },
    );

    expect(response.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the target user does not exist', async () => {
    const response = await fetch(
      `${baseUrl}/admin/users/missing-user/role`,
      {
        method: 'PATCH',
        headers: await authHeaders(UserRole.ADMIN),
        body: JSON.stringify({ role: UserRole.STAFF }),
      },
    );

    expect(response.status).toBe(404);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects an invalid role', async () => {
    const response = await fetch(
      `${baseUrl}/admin/users/user-1/role`,
      {
        method: 'PATCH',
        headers: await authHeaders(UserRole.ADMIN),
        body: JSON.stringify({ role: 'SUPER_ADMIN' }),
      },
    );

    expect(response.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects additional fields in role update requests', async () => {
    const response = await fetch(
      `${baseUrl}/admin/users/user-1/role`,
      {
        method: 'PATCH',
        headers: await authHeaders(UserRole.ADMIN),
        body: JSON.stringify({
          role: UserRole.STAFF,
          loyaltyPoints: 999999,
        }),
      },
    );

    expect(response.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('retries a role update after a serialization conflict', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError(
      'Transaction failed due to a write conflict or a deadlock.',
      {
        code: 'P2034',
        clientVersion: 'test',
      },
    );

    prismaMock.$transaction.mockRejectedValueOnce(conflict);

    const response = await fetch(
      `${baseUrl}/admin/users/user-1/role`,
      {
        method: 'PATCH',
        headers: await authHeaders(UserRole.ADMIN),
        body: JSON.stringify({ role: UserRole.STAFF }),
      },
    );

    expect(response.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
  });

  // SUMMARY

  it('blocks CUSTOMER from viewing admin summary', async () => {
    const response = await fetch(`${baseUrl}/admin/summary`, {
      headers: await authHeaders(UserRole.CUSTOMER),
    });

    expect(response.status).toBe(403);
    expect(prismaMock.order.count).not.toHaveBeenCalled();
  });

  it.each([UserRole.ADMIN, UserRole.STAFF])(
    'allows %s to view summary',
    async (role) => {
      const response = await fetch(`${baseUrl}/admin/summary`, {
        headers: await authHeaders(role),
      });

      expect(response.status).toBe(200);

      const body = await response.json();

      expect(body).toEqual({
        customers: 3,
        staff: role === UserRole.ADMIN ? 1 : null,
        orders: 10,
        pendingOrders: 2,
        activityLogs: 1,
      });
    },
  );

  it('does not count staff for STAFF summary requests', async () => {
    const response = await fetch(`${baseUrl}/admin/summary`, {
      headers: await authHeaders(UserRole.STAFF),
    });

    expect(response.status).toBe(200);

    expect(prismaMock.user.count).not.toHaveBeenCalledWith({
      where: { role: UserRole.STAFF },
    });
  });
});
