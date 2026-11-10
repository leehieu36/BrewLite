import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import { RolesGuard } from '../common/roles.guard';

@Module({
  imports: [PassportModule],
  controllers: [AdminController],
  providers: [AdminService, JwtStrategy, RolesGuard],
})
export class AdminModule {}
