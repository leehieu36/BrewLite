import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { JwtStrategy } from '../auth/jwt.strategy';
@Module({ imports: [PassportModule], controllers: [OrdersController], providers: [OrdersService, JwtStrategy] })
export class OrdersModule { }
