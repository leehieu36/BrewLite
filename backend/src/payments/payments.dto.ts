import { IsIn, IsString, MaxLength } from 'class-validator';
export class CreatePaymentDto {
  @IsString() @MaxLength(100) orderId: string;
  @IsIn(['MOCK', 'COD']) method: 'MOCK' | 'COD';
}
