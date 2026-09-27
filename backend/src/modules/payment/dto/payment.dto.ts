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

  @ApiPropertyOptional({ example: 'NCB', description: 'Mã ngân hàng / loại thẻ (VNBANK, INTCARD, NCB, VCB...)' })
  @IsOptional()
  @IsString()
  bankCode?: string;

  @ApiPropertyOptional({ example: 'Thanh toan ve xe buyt ICTU' })
  @IsOptional()
  @IsString()
  orderInfo?: string;

  @ApiPropertyOptional({ example: '127.0.0.1' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ example: 'http://localhost:3000/payment/result' })
  @IsOptional()
  @IsString()
  returnUrl?: string;
}

export class MoMoIpnDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partnerCode?: string;

  @ApiProperty()
  @IsString()
  orderId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderInfo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  transId?: number | string;

  @ApiProperty({ example: 0, description: '0: Thành công, khác 0: Thất bại/bị từ chối' })
  @IsNumber()
  resultCode: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  responseTime?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  extraData?: string;

  @ApiProperty()
  @IsString()
  signature: string;
}

export class ZaloPayIpnDto {
  @ApiProperty({ description: 'Dữ liệu giao dịch JSON string từ ZaloPay' })
  @IsString()
  @IsNotEmpty()
  data: string;

  @ApiProperty({ description: 'Chữ ký MAC HMAC-SHA256 từ ZaloPay' })
  @IsString()
  @IsNotEmpty()
  mac: string;

  @ApiPropertyOptional()
  @IsOptional()
  type?: number;
}

export class ReconciliationQueryDto {
  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'vnpay', description: 'vnpay, momo, zalopay, bank_card' })
  @IsOptional()
  @IsString()
  gateway?: string;

  @ApiPropertyOptional({ example: 'success' })
  @IsOptional()
  @IsString()
  status?: string;
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
