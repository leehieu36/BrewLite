import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../src/auth/jwt.strategy';

describe('JwtStrategy user validation', () => {
  it('loads only the authenticated user fields from the database', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'customer@example.com',
          role: 'CUSTOMER',
        }),
      },
    };
    const config = { get: jest.fn().mockReturnValue('test-secret') };
    const strategy = new JwtStrategy(config as any, prisma as any);

    await expect(
      strategy.validate({ sub: 'user-1', email: 'customer@example.com' }),
    ).resolves.toEqual({
      id: 'user-1',
      email: 'customer@example.com',
      role: 'CUSTOMER',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, email: true, role: true },
    });
  });

  it('rejects a token whose user no longer exists', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const config = { get: jest.fn().mockReturnValue('test-secret') };
    const strategy = new JwtStrategy(config as any, prisma as any);

    await expect(
      strategy.validate({ sub: 'deleted-user', email: 'gone@example.com' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects production startup when JWT_SECRET is missing', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return undefined;
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      }),
    };

    expect(
      () => new JwtStrategy(config as any, {} as any),
    ).toThrow('JWT_SECRET must be configured in production');
  });

  it('allows development startup with the fallback secret', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return undefined;
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      }),
    };

    expect(
      () => new JwtStrategy(config as any, {} as any),
    ).not.toThrow();
  });

});
