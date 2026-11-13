
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { ProductsController } from '../src/products/products.controller';
import { ProductsService } from '../src/products/products.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { RolesGuard } from '../src/auth/roles.guard';
import { PrismaService } from '../src/database/prisma.service';

describe('Products API (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwtService: JwtService;

  const JWT_SECRET = 'test-secret-products-api-123456789';
  let testUserRole = 'CUSTOMER';

  const product = {
    id: 'product-1',
    name: 'Milk Coffee',
    description: 'Coffee with milk',
    price: 30000,
    imageUrl: 'https://example.com/coffee.jpg',
    stock: 50,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((operations: Promise<any>[]) =>
      Promise.all(operations),
    ),
  };

  async function authHeaders(
    role: 'CUSTOMER' | 'STAFF' | 'ADMIN',
  ) {
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
      controllers: [ProductsController],
      providers: [
        ProductsService,
        JwtStrategy,
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

    prismaMock.user.findUnique.mockImplementation(async () => ({
      id: 'test-user',
      email: 'test@example.com',
      role: testUserRole,
    }));

    prismaMock.product.findMany.mockResolvedValue([product]);
    prismaMock.product.count.mockResolvedValue(1);
    prismaMock.product.findFirst.mockResolvedValue(product);
    prismaMock.product.findUnique.mockResolvedValue(product);
    prismaMock.product.create.mockResolvedValue(product);
    prismaMock.product.update.mockResolvedValue(product);
  });

  // PUBLIC API

  it('allows public access to the product list', async () => {
    const response = await fetch(`${baseUrl}/products`);

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.items).toHaveLength(1);
    expect(body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });

    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        take: 20,
        skip: 0,
      }),
    );
  });

  it('limits the product page size to 100', async () => {
    const response = await fetch(
      `${baseUrl}/products?page=1&limit=500`,
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.pagination.limit).toBe(100);
    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it('allows public access to an active product', async () => {
    const response = await fetch(
      `${baseUrl}/products/product-1`,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: 'product-1',
      name: 'Milk Coffee',
    });

    expect(prismaMock.product.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'product-1',
        isActive: true,
      },
    });
  });

  it('returns 404 when an active product does not exist', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);

    const response = await fetch(
      `${baseUrl}/products/not-found`,
    );

    expect(response.status).toBe(404);
  });

  it('does not expose inactive products through the public detail API', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);

    const response = await fetch(
      `${baseUrl}/products/inactive-product`,
    );

    expect(response.status).toBe(404);
  });

  // MANAGEMENT API

  it('rejects management access without a token', async () => {
    const response = await fetch(
      `${baseUrl}/products/management`,
    );

    expect(response.status).toBe(401);
  });

  it('rejects management access with an invalid token', async () => {
    const response = await fetch(
      `${baseUrl}/products/management`,
      {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      },
    );

    expect(response.status).toBe(401);
  });

  it('blocks customers from accessing the management list', async () => {
    const response = await fetch(
      `${baseUrl}/products/management`,
      {
        headers: await authHeaders('CUSTOMER'),
      },
    );

    expect(response.status).toBe(403);
    expect(prismaMock.product.findMany).not.toHaveBeenCalled();
  });

  it.each(['STAFF', 'ADMIN'])(
    'allows %s to access the management list',
    async (role) => {
      const response = await fetch(
        `${baseUrl}/products/management`,
        {
          headers: await authHeaders(role as 'STAFF' | 'ADMIN'),
        },
      );

      expect(response.status).toBe(200);
      expect(prismaMock.product.findMany).toHaveBeenCalled();
    },
  );

  // CREATE

  it('rejects product creation without authentication', async () => {
    const response = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'New Coffee',
        price: 30000,
        stock: 20,
      }),
    });

    expect(response.status).toBe(401);
  });

  it.each(['CUSTOMER', 'STAFF'])(
    'blocks %s from creating products',
    async (role) => {
      const response = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: await authHeaders(role as 'CUSTOMER' | 'STAFF'),
        body: JSON.stringify({
          name: 'New Coffee',
          price: 30000,
          stock: 20,
        }),
      });

      expect(response.status).toBe(403);
      expect(prismaMock.product.create).not.toHaveBeenCalled();
    },
  );

  it('allows ADMIN to create a product', async () => {
    const response = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: await authHeaders('ADMIN'),
      body: JSON.stringify({
        name: 'New Coffee',
        description: 'New product',
        price: 30000,
        stock: 20,
      }),
    });

    expect(response.status).toBe(201);
    expect(prismaMock.product.create).toHaveBeenCalledWith({
      data: {
        name: 'New Coffee',
        description: 'New product',
        price: 30000,
        stock: 20,
        imageUrl: null,
      },
    });
  });

  // UPDATE

  it.each(['CUSTOMER', 'STAFF'])(
    'blocks %s from updating products',
    async (role) => {
      const response = await fetch(
        `${baseUrl}/products/product-1`,
        {
          method: 'PATCH',
          headers: await authHeaders(role as 'CUSTOMER' | 'STAFF'),
          body: JSON.stringify({ price: 35000 }),
        },
      );

      expect(response.status).toBe(403);
      expect(prismaMock.product.update).not.toHaveBeenCalled();
    },
  );

  it('allows ADMIN to update a product', async () => {
    const response = await fetch(
      `${baseUrl}/products/product-1`,
      {
        method: 'PATCH',
        headers: await authHeaders('ADMIN'),
        body: JSON.stringify({
          price: 35000,
          isActive: false,
        }),
      },
    );

    expect(response.status).toBe(200);

    expect(prismaMock.product.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: {
        price: 35000,
        isActive: false,
      },
    });
  });

  it('returns 404 when ADMIN updates a nonexistent product', async () => {
    prismaMock.product.findUnique.mockResolvedValue(null);

    const response = await fetch(
      `${baseUrl}/products/not-found`,
      {
        method: 'PATCH',
        headers: await authHeaders('ADMIN'),
        body: JSON.stringify({ price: 35000 }),
      },
    );

    expect(response.status).toBe(404);
    expect(prismaMock.product.update).not.toHaveBeenCalled();
  });

  // DELETE

  it.each(['CUSTOMER', 'STAFF'])(
    'blocks %s from deleting products',
    async (role) => {
      const response = await fetch(
        `${baseUrl}/products/product-1`,
        {
          method: 'DELETE',
          headers: await authHeaders(role as 'CUSTOMER' | 'STAFF'),
        },
      );

      expect(response.status).toBe(403);
      expect(prismaMock.product.update).not.toHaveBeenCalled();
    },
  );

  it('allows ADMIN to soft-delete a product', async () => {
    const response = await fetch(
      `${baseUrl}/products/product-1`,
      {
        method: 'DELETE',
        headers: await authHeaders('ADMIN'),
      },
    );

    expect(response.status).toBe(200);

    expect(prismaMock.product.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: { isActive: false },
    });
  });

  it('returns 404 when ADMIN deletes a nonexistent product', async () => {
    prismaMock.product.findUnique.mockResolvedValue(null);

    const response = await fetch(
      `${baseUrl}/products/not-found`,
      {
        method: 'DELETE',
        headers: await authHeaders('ADMIN'),
      },
    );

    expect(response.status).toBe(404);
    expect(prismaMock.product.update).not.toHaveBeenCalled();
  });
});
