import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import { RolesGuard } from '../common/roles.guard';
@Module({ imports: [PassportModule], controllers: [OrdersController], providers: [OrdersService, JwtStrategy, RolesGuard] })
export class OrdersModule { }
