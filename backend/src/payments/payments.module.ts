import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import { RolesGuard } from '../common/roles.guard';
@Module({ imports: [PassportModule], controllers: [PaymentsController], providers: [PaymentsService, JwtStrategy, RolesGuard] })
export class PaymentsModule { }
