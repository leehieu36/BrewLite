import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOrderDto } from './orders.dto';
import { OrdersService } from './orders.service';

type AuthedRequest = Request & { user: { id: string; email: string } };
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private orders: OrdersService) { }
  @Post() create(@Req() req: AuthedRequest, @Body() dto: CreateOrderDto) { return this.orders.create(req.user.id, dto); }
  @Get('me') mine(@Req() req: AuthedRequest) { return this.orders.myOrders(req.user.id); }
  @Get(':id') one(@Req() req: AuthedRequest, @Param('id') id: string) { return this.orders.getOwned(req.user.id, id); }
}
