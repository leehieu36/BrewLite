
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { LoginDto, RegisterDto } from './dto';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  async register(dto: RegisterDto, meta: { ipAddress?: string; userAgent?: string } = {}) {
    const email = dto.email.trim().toLowerCase();

    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Email đã được đăng ký');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, name: dto.name?.trim() },
    });

    await this.audit.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'REGISTER',
      entity: 'USER',
      entityId: user.id,
      description: 'Tạo tài khoản mới',
      ...meta,
    });

    return this.makeAuthResponse(user);
  }

  async login(dto: LoginDto, meta: { ipAddress?: string; userAgent?: string } = {}) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.audit.record({
        action: 'LOGIN_FAILED',
        entity: 'AUTH',
        description: 'Đăng nhập thất bại',
        ...meta,
      });

      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    await this.audit.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'LOGIN',
      entity: 'AUTH',
      entityId: user.id,
      description: 'Đăng nhập thành công',
      ...meta,
    });

    return this.makeAuthResponse(user);
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        address: true,
        role: true,
        loyaltyPoints: true,
        createdAt: true,
      },
    });
  }

  async updateProfile(
    userId: string,
    dto: { name?: string; phone?: string; address?: string },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
        ...(dto.address !== undefined && { address: dto.address.trim() }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        address: true,
        role: true,
        loyaltyPoints: true,
        createdAt: true,
      },
    });
  }

  private async makeAuthResponse(user: {
    id: string;
    email: string;
    name: string | null;
    loyaltyPoints: number;
    role: UserRole;
  }) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        loyaltyPoints: user.loyaltyPoints,
        role: user.role,
      },
    };
  }
}
