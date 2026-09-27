import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../../../common/constants/status.constant.js';

export class CreatePaymentUrlDto {
  @ApiProperty({ description: 'ID đơn đặt vé (Booking ID)' })
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.VNPAY })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'Thanh toan ve xe buyt ICTU' })
  @IsOptional()
  @IsString()
  orderInfo?: string;

  @ApiPropertyOptional({ example: '127.0.0.1' })
  @IsOptional()
  @IsString()
  ipAddress?: string;
}

export class RefundTicketDto {
  @ApiPropertyOptional({ example: 'Hành khách yêu cầu hủy chuyến trước 24h' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: 100, description: '% hoàn tiền (ví dụ 100% hoặc 80%)' })
  @IsOptional()
  @IsNumber()
  refundPercentage?: number;
}
