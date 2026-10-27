import { IsIn, IsString, MaxLength } from 'class-validator';
export class CreatePaymentDto {
  @IsString() @MaxLength(100) orderId: string;
  @IsIn(['COD', 'BANK_TRANSFER', 'VNPAY', 'MOMO']) method: 'COD' | 'BANK_TRANSFER' | 'VNPAY' | 'MOMO';
}
