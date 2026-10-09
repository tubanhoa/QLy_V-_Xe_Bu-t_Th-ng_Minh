import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MonthlyPassCategory, ApprovalStatus, PaymentMethod } from '../../../common/constants/status.constant.js';

export class CalculateMonthlyPassPriceDto {
  @ApiProperty({ enum: MonthlyPassCategory, example: MonthlyPassCategory.STUDENT })
  @IsEnum(MonthlyPassCategory)
  category: MonthlyPassCategory;

  @ApiPropertyOptional({ example: 1, description: 'Số tháng đăng ký (1, 3, 6)' })
  @IsOptional()
  @IsNumber()
  durationMonths?: number;

  @ApiPropertyOptional({ example: false, description: 'Có phải vé liên tuyến toàn mạng không' })
  @IsOptional()
  @IsBoolean()
  isAllRoutes?: boolean;

  @ApiPropertyOptional({ example: 'all-routes', description: 'ID tuyến xe buýt hoặc all-routes' })
  @IsOptional()
  @IsString()
  routeId?: string;
}

export class RegisterMonthlyPassDto {
  @ApiPropertyOptional({ description: 'ID tuyến xe buýt đăng ký (hoặc all-routes)', example: 'all-routes' })
  @IsOptional()
  @IsString()
  routeId?: string;

  @ApiProperty({ enum: MonthlyPassCategory, example: MonthlyPassCategory.STUDENT })
  @IsEnum(MonthlyPassCategory)
  category: MonthlyPassCategory;

  @ApiPropertyOptional({ example: 1, description: 'Thời hạn (1, 3, 6 tháng)' })
  @IsOptional()
  @IsNumber()
  durationMonths?: number;

  @ApiPropertyOptional({ example: '2026-10-01', description: 'Ngày bắt đầu hiệu lực (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-10-31', description: 'Ngày hết hạn (YYYY-MM-DD) - tự động tính nếu bỏ trống' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'https://storage.ictu.edu.vn/cards/student_card.jpg' })
  @IsOptional()
  @IsString()
  proofImageUrl?: string;
}

export class CreateMonthlyPassPaymentDto {
  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.VIETQR })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

export class ConfirmMonthlyPassPaymentDto {
  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.VIETQR })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: 'DEMO-MP-PAY-778899' })
  @IsOptional()
  @IsString()
  transactionCode?: string;
}

export class RenewMonthlyPassDto {
  @ApiProperty({ example: 1, description: 'Số tháng gia hạn (1, 3, 6)' })
  @IsNumber()
  @IsNotEmpty()
  durationMonths: number;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.VIETQR })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: false, description: 'Tự động xác nhận thanh toán (Demo Quick Pay)' })
  @IsOptional()
  @IsBoolean()
  autoConfirmPayment?: boolean;
}

export class ReviewMonthlyPassDto {
  @ApiProperty({ enum: ApprovalStatus, example: ApprovalStatus.APPROVED })
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;

  @ApiPropertyOptional({ example: 'Ảnh thẻ sinh viên không rõ nét' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class CreateVoucherDto {
  @ApiProperty({ example: 'ICTU2026', description: 'Mã voucher' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'percentage', enum: ['percentage', 'fixed_amount'] })
  @IsString()
  discountType: 'percentage' | 'fixed_amount';

  @ApiProperty({ example: 20, description: 'Giá trị giảm (20% hoặc 10000 VND)' })
  @IsNumber()
  discountValue: number;

  @ApiPropertyOptional({ example: 50000, description: 'Đơn hàng tối thiểu (VND)' })
  @IsOptional()
  @IsNumber()
  minOrderValue?: number;

  @ApiPropertyOptional({ example: 20000, description: 'Giảm tối đa (VND) nếu là percentage' })
  @IsOptional()
  @IsNumber()
  maxDiscountAmount?: number;

  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-12-31' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ example: 1000, description: 'Số lượt dùng tối đa (0 = không giới hạn)' })
  @IsOptional()
  @IsNumber()
  usageLimit?: number;
}

export class ValidateVoucherDto {
  @ApiProperty({ example: 'ICTU2026' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 50000, description: 'Tổng tiền đơn hàng' })
  @IsNumber()
  orderAmount: number;
}
