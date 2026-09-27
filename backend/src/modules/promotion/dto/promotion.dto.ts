import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MonthlyPassCategory, ApprovalStatus } from '../../../common/constants/status.constant.js';

export class RegisterMonthlyPassDto {
  @ApiProperty({ description: 'ID tuyến xe buýt đăng ký' })
  @IsString()
  @IsNotEmpty()
  routeId: string;

  @ApiProperty({ enum: MonthlyPassCategory, example: MonthlyPassCategory.STUDENT })
  @IsEnum(MonthlyPassCategory)
  category: MonthlyPassCategory;

  @ApiProperty({ example: '2026-10-01', description: 'Ngày bắt đầu hiệu lực (YYYY-MM-DD)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-10-31', description: 'Ngày hết hạn (YYYY-MM-DD)' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ example: 'https://storage.ictu.edu.vn/cards/student_card.jpg' })
  @IsOptional()
  @IsString()
  proofImageUrl?: string;
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
