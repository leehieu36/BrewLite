import {
  Body,
  Controller,
  Post,
  Req,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

type RequestMeta = { ipAddress?: string; userAgent?: string };

type AuthRequest = Request & {
  user: { id: string; email: string; role: string };
};

const meta = (req: Request): RequestMeta => ({
  ipAddress: req.ip,
  userAgent:
    typeof req.headers['user-agent'] === 'string'
      ? req.headers['user-agent']
      : undefined,
});

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, meta(req));
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, meta(req));
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Req() req: AuthRequest) {
    return this.auth.getProfile(req.user.id);
  }

  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  updateProfile(
    @Req() req: AuthRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.auth.updateProfile(req.user.id, dto);
  }
}