import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { UpdateUserRoleDto } from './admin.dto';

type AdminRequest = Request & { user: { id: string; email: string; role: UserRole } };

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('activity-logs')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  activityLogs(@Query('page') page = '1', @Query('limit') limit = '25') {
    return this.admin.activityLogs(Number(page), Number(limit));
  }

  @Get('users')
  @Roles(UserRole.ADMIN)
  users(@Req() req: AdminRequest, @Query('page') page = '1', @Query('limit') limit = '25', @Query('q') q?: string) {
    return this.admin.users(Number(page), Number(limit), q, req.user.id, { ipAddress: req.ip, userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined });
  }

  @Patch('users/:id/role')
  @Roles(UserRole.ADMIN)
  updateUserRole(@Req() req: AdminRequest, @Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.admin.updateUserRole(req.user.id, id, dto.role, { ipAddress: req.ip, userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined });
  }

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  summary(@Req() req: AdminRequest) {
    return this.admin.summary(req.user.role);
  }
}
