import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export type AuditInput = {
  actorUserId?: string | null;
  actorRole?: UserRole | null;
  action: string;
  entity: string;
  entityId?: string | null;
  description: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput) {
    try {
      return await this.prisma.activityLog.create({
        data: {
          actorUserId: input.actorUserId ?? null,
          actorRole: input.actorRole ?? null,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId ?? null,
          description: input.description,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent?.slice(0, 500) ?? null,
        },
      });
    } catch (error) {
      // Audit failures are logged server-side; they must not expose internals to clients.
      this.logger.error('Could not persist activity log', error instanceof Error ? error.stack : undefined);
      return null;
    }
  }
}
