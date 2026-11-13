
import { UserRole } from '@prisma/client';
import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreatePaymentDto } from './payments.dto';
import { PaymentsService } from './payments.service';

type AuthedRequest = Request & {
  user: { id: string; email: string; role: UserRole };
};

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Headers('idempotency-key') key: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.payments.create(
      req.user.id,
      key,
      dto,
      req.user.role,
      {
        ipAddress: req.ip,
        userAgent:
          typeof req.headers['user-agent'] === 'string'
            ? req.headers['user-agent']
            : undefined,
      },
    );
  }

  @Post(':orderId/confirm')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  confirm(
    @Req() req: AuthedRequest,
    @Param('orderId') orderId: string,
  ) {
    return this.payments.confirm(
      orderId,
      req.user.id,
      req.user.role,
      {
        ipAddress: req.ip,
        userAgent:
          typeof req.headers['user-agent'] === 'string'
            ? req.headers['user-agent']
            : undefined,
      },
    );
  }
}
