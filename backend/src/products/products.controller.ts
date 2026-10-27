import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
class ProductQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit = 20;
}
@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) { }
  @Get() list(@Query() query: ProductQueryDto) { return this.products.list(query); }
  @Get(':id') async get(@Param('id') id: string) {
    const product = await this.products.get(id);
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
    return product;
  }
}
