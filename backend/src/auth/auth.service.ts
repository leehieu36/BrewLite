import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private config: ConfigService) { }
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('Email đã được đăng ký');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({ data: { email, passwordHash, name: dto.name?.trim() } });
    return this.makeAuthResponse(user);
  }
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    return this.makeAuthResponse(user);
  }
  private async makeAuthResponse(user: { id: string; email: string; name: string | null; loyaltyPoints: number }) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { accessToken, tokenType: 'Bearer', user: { id: user.id, email: user.email, name: user.name, loyaltyPoints: user.loyaltyPoints } };
  }
}
