import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({ imports: [PassportModule, JwtModule.registerAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({ secret: config.get<string>('JWT_SECRET') || 'local_dev_only_change_me_please_0123456789', signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1d') as any } }) })], controllers: [AuthController], providers: [AuthService, JwtStrategy], exports: [JwtModule] })
export class AuthModule { }
