
import { UserRole } from '@prisma/client';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  CancelOrderDto,
  RequestCancellationDto,
  ReviewCancellationDto,
} from './orders.dto';
import { OrdersService } from './orders.service';

type AuthedRequest = Request & {
  user: { id: string; email: string; role: UserRole };
};

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private orders: OrdersService) {}

  private getMeta(req: AuthedRequest) {
    return {
      ipAddress: req.ip,
      userAgent:
        typeof req.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : undefined,
    };
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateOrderDto) {
    return this.orders.create(
      req.user.id,
      dto,
      req.user.role,
      this.getMeta(req),
    );
  }

  @Get('management')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  management(@Req() req: AuthedRequest) {
    return this.orders.managementOrders(
      req.user.id,
      req.user.role,
      this.getMeta(req),
    );
  }

  @Get('me')
  mine(@Req() req: AuthedRequest) {
    return this.orders.myOrders(req.user.id);
  }

  // Khách hủy đơn đang chờ thanh toán.
  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  cancel(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: CancelOrderDto,
  ) {
    return this.orders.cancelPendingOrder(
      req.user.id,
      id,
      body.reason,
      this.getMeta(req),
    );
  }

  // Khách gửi yêu cầu hủy đơn đã thanh toán hoặc đang pha chế.
  @Post(':id/cancellation-request')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  requestCancellation(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: RequestCancellationDto,
  ) {
    return this.orders.requestCancellation(
      req.user.id,
      id,
      body.reason,
      this.getMeta(req),
    );
  }

  // Nhân viên duyệt hoặc từ chối yêu cầu hủy.
  @Patch(':id/cancellation-request')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  reviewCancellation(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: ReviewCancellationDto,
  ) {
    if (typeof body?.approved !== 'boolean') {
      throw new BadRequestException(
        'Trường approved phải là true hoặc false',
      );
    }

    return this.orders.reviewCancellation(
      id,
      body.approved,
      req.user.id,
      req.user.role,
      this.getMeta(req),
    );
  }

  @Get(':id')
  one(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.orders.getOwned(req.user.id, id);
  }

  @Post(':id/staff-cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  staffCancel(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ) {
    return this.orders.staffCancelOrder(
      id,
      req.user.id,
      req.user.role,
      this.getMeta(req),
    );
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  updateStatus(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(
      id,
      dto.status,
      req.user.id,
      req.user.role,
      this.getMeta(req),
    );
  }
}
