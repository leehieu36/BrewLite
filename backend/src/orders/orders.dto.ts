import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderLineDto {
  @IsString()
  @MaxLength(100)
  productId: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  qty: number;

  @IsOptional()
  @IsString()
  @IsIn(['S', 'M', 'L'])
  size?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(['Trân châu', 'Kem cheese', 'Thạch cà phê'], { each: true })
  toppings?: string[];
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items: OrderLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  promotionCode?: string;
}
