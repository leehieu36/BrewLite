import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async activityLogs(pageInput = 1, limitInput = 25) {
    const page = Math.max(1, Number.isFinite(pageInput) ? Math.floor(pageInput) : 1);
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitInput) ? Math.floor(limitInput) : 25));
    const [items, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.activityLog.count(),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async users(
    pageInput = 1,
    limitInput = 25,
    q?: string,
    actorId?: string,
    actorRole?: UserRole,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const page = Math.max(
      1,
      Number.isFinite(pageInput) ? Math.floor(pageInput) : 1,
    );

    const limit = Math.min(
      100,
      Math.max(1, Number.isFinite(limitInput) ? Math.floor(limitInput) : 25),
    );

    if (actorId) {
      await this.audit.record({
        actorUserId: actorId,
        actorRole,
        action: 'CUSTOMER_DATA_ACCESSED',
        entity: 'USER',
        description: 'Quản trị viên truy cập danh sách tài khoản',
        ...meta,
      });
    }

    const search = q?.trim();

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          loyaltyPoints: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateUserRole(
    actorId: string,
    actorRole: UserRole,
    targetId: string,
    role: UserRole,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    if (actorId === targetId) {
      throw new ForbiddenException(
        'Không thể tự thay đổi quyền của chính mình',
      );
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const updated = await this.prisma.$transaction(
          async (tx) => {
            const target = await tx.user.findUnique({
              where: { id: targetId },
              select: { id: true, role: true },
            });

            if (!target) {
              throw new NotFoundException('Không tìm thấy tài khoản');
            }

            if (
              target.role === UserRole.ADMIN &&
              role !== UserRole.ADMIN
            ) {
              const admins = await tx.user.count({
                where: { role: UserRole.ADMIN },
              });

              if (admins <= 1) {
                throw new BadRequestException(
                  'Hệ thống phải có ít nhất một quản trị viên',
                );
              }
            }

            return tx.user.update({
              where: { id: targetId },
              data: { role },
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                updatedAt: true,
              },
            });
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );

        await this.audit.record({
          actorUserId: actorId,
          actorRole,
          action: 'USER_ROLE_UPDATED',
          entity: 'USER',
          entityId: targetId,
          description: `Cập nhật vai trò tài khoản thành ${role}`,
          ...meta,
        });

        return updated;
      } catch (error) {
        const isSerializationConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';

        if (isSerializationConflict && attempt < 3) {
          continue;
        }

        throw error;
      }
    }

    throw new Error('Không thể cập nhật quyền người dùng');
  }

  async summary(role: UserRole) {
    const [customers, staff, orders, pendingOrders, logs] = await Promise.all([
      this.prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
      role === UserRole.ADMIN ? this.prisma.user.count({ where: { role: UserRole.STAFF } }) : Promise.resolve(null),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.activityLog.count(),
    ]);
    return { customers, staff, orders, pendingOrders, activityLogs: logs };
  }
}
