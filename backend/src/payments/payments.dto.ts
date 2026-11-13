import { IsIn, IsString, MaxLength } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @MaxLength(100)
  orderId: string;

  @IsIn(['LOYALTY_POINTS', 'BANK_TRANSFER', 'VNPAY', 'MOMO'])
  method: 'LOYALTY_POINTS' | 'BANK_TRANSFER' | 'VNPAY' | 'MOMO';
}