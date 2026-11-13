
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
} from './promotions.dto';

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private validatePromotion(
    discountType: DiscountType,
    discountValue: number,
    maxDiscount?: number | null,
  ) {
    if (
      !Number.isSafeInteger(discountValue) ||
      discountValue <= 0
    ) {
      throw new BadRequestException('Giá trị giảm giá không hợp lệ');
    }

    if (
      discountType === DiscountType.PERCENTAGE &&
      discountValue > 100
    ) {
      throw new BadRequestException(
        'Mức giảm theo phần trăm không được vượt quá 100%',
      );
    }

    if (
      maxDiscount !== undefined &&
      maxDiscount !== null &&
      (!Number.isSafeInteger(maxDiscount) || maxDiscount <= 0)
    ) {
      throw new BadRequestException('Mức giảm tối đa không hợp lệ');
    }
  }

  async create(
    actorId: string,
    actorRole: UserRole,
    dto: CreatePromotionDto,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const code = dto.code.trim().toUpperCase();
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (!code) {
      throw new BadRequestException('Mã khuyến mãi không được để trống');
    }

    if (endAt <= startAt) {
      throw new BadRequestException(
        'Thời gian kết thúc phải sau thời gian bắt đầu',
      );
    }

    this.validatePromotion(
      dto.discountType,
      dto.discountValue,
      dto.maxDiscount,
    );

    try {
      const promotion = await this.prisma.promotion.create({
        data: {
          code,
          discountType: dto.discountType,
          discountValue: dto.discountValue,
          minOrderValue: dto.minOrderValue ?? 0,
          maxDiscount: dto.maxDiscount ?? null,
          startAt,
          endAt,
          usageLimit: dto.usageLimit ?? null,
        },
      });

      await this.audit.record({
        actorUserId: actorId,
        actorRole,
        action: 'PROMOTION_CREATED',
        entity: 'PROMOTION',
        entityId: promotion.id,
        description: `Tạo mã khuyến mãi ${code}`,
        ...meta,
      });

      return promotion;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Mã khuyến mãi đã tồn tại');
      }
      throw error;
    }
  }

  async findAll() {
    return this.prisma.promotion.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    actorId: string,
    actorRole: UserRole,
    id: string,
    dto: UpdatePromotionDto,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const current = await this.prisma.promotion.findUnique({
      where: { id },
    });

    if (!current) {
      throw new NotFoundException('Không tìm thấy mã khuyến mãi');
    }

    const startAt = dto.startAt
      ? new Date(dto.startAt)
      : current.startAt;

    const endAt = dto.endAt
      ? new Date(dto.endAt)
      : current.endAt;

    if (endAt <= startAt) {
      throw new BadRequestException(
        'Thời gian kết thúc phải sau thời gian bắt đầu',
      );
    }

    const discountType = dto.discountType ?? current.discountType;
    const discountValue = dto.discountValue ?? current.discountValue;
    const maxDiscount =
      dto.maxDiscount === undefined
        ? current.maxDiscount
        : dto.maxDiscount;

    this.validatePromotion(
      discountType,
      discountValue,
      maxDiscount,
    );

    const usageLimit =
      dto.usageLimit === undefined
        ? current.usageLimit
        : dto.usageLimit;

    if (usageLimit !== null && usageLimit < current.usedCount) {
      throw new BadRequestException(
        'Giới hạn lượt sử dụng không được nhỏ hơn số lượt đã dùng',
      );
    }

    try {
      const promotion = await this.prisma.promotion.update({
        where: { id },
        data: {
          ...(dto.code !== undefined
            ? { code: dto.code.trim().toUpperCase() }
            : {}),
          ...(dto.discountType !== undefined
            ? { discountType: dto.discountType }
            : {}),
          ...(dto.discountValue !== undefined
            ? { discountValue: dto.discountValue }
            : {}),
          ...(dto.minOrderValue !== undefined
            ? { minOrderValue: dto.minOrderValue }
            : {}),
          ...(dto.maxDiscount !== undefined
            ? { maxDiscount: dto.maxDiscount }
            : {}),
          ...(dto.startAt !== undefined ? { startAt } : {}),
          ...(dto.endAt !== undefined ? { endAt } : {}),
          ...(dto.usageLimit !== undefined ? { usageLimit } : {}),
          ...(dto.isActive !== undefined
            ? { isActive: dto.isActive }
            : {}),
        },
      });

      await this.audit.record({
        actorUserId: actorId,
        actorRole,
        action: 'PROMOTION_UPDATED',
        entity: 'PROMOTION',
        entityId: promotion.id,
        description: `Cập nhật mã khuyến mãi ${promotion.code}`,
        ...meta,
      });

      return promotion;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Mã khuyến mãi đã tồn tại');
      }
      throw error;
    }
  }
}
