
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import { RolesGuard } from '../common/roles.guard';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PassportModule, AuditModule],
  controllers: [PromotionsController],
  providers: [PromotionsService, JwtStrategy, RolesGuard],
})
export class PromotionsModule {}
