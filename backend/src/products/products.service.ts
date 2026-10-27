import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) { }
  async list(query: { q?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const where = { isActive: true, ...(query.q ? { name: { contains: query.q.trim(), mode: 'insensitive' as const } } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.product.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  get(id: string) { return this.prisma.product.findFirst({ where: { id, isActive: true } }); }
}
