
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreatePromotionDto, UpdatePromotionDto } from './promotions.dto';
import { PromotionsService } from './promotions.service';

type AdminRequest = Request & {
  user: { id: string; email: string; role: UserRole };
};

@Controller('admin/promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  private getMeta(req: AdminRequest) {
    return {
      ipAddress: req.ip,
      userAgent:
        typeof req.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : undefined,
    };
  }

  @Post()
  create(
    @Req() req: AdminRequest,
    @Body() dto: CreatePromotionDto,
  ) {
    return this.promotions.create(
      req.user.id,
      req.user.role,
      dto,
      this.getMeta(req),
    );
  }

  @Get()
  findAll() {
    return this.promotions.findAll();
  }

  @Patch(':id')
  update(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.promotions.update(
      req.user.id,
      req.user.role,
      id,
      dto,
      this.getMeta(req),
    );
  }
}
