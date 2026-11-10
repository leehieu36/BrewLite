import { UserRole } from '@prisma/client';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOrderDto, UpdateOrderStatusDto } from './orders.dto';
import { OrdersService } from './orders.service';

type AuthedRequest = Request & { user: { id: string; email: string; role: UserRole } };
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private orders: OrdersService) { }
  @Post() create(@Req() req: AuthedRequest, @Body() dto: CreateOrderDto) { return this.orders.create(req.user.id, dto, req.user.role, { ipAddress: req.ip, userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined }); }
  @Get('management')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  management(@Req() req: AuthedRequest) {
    return this.orders.managementOrders(req.user.id, req.user.role, {
      ipAddress: req.ip,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }
  @Get('me') mine(@Req() req: AuthedRequest) { return this.orders.myOrders(req.user.id); }
  @Get(':id') one(@Req() req: AuthedRequest, @Param('id') id: string) { return this.orders.getOwned(req.user.id, id); }
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  updateStatus(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orders.updateStatus(id, dto.status, req.user.id, req.user.role, {
      ipAddress: req.ip,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }
}
