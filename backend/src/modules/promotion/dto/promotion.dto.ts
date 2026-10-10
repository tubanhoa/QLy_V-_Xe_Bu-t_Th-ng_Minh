import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MonthlyPassCategory, ApprovalStatus, PaymentMethod } from '../../../common/constants/status.constant.js';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

export class ListAdminMonthlyPassesQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ApprovalStatus,
    description: 'Lọc theo trạng thái xét duyệt: pending, approved, rejected',
  })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;
}

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
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @ValidateIf((o) => typeof o.startDate === 'string' && o.startDate.trim().length > 0)
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-10-31', description: 'Ngày hết hạn (YYYY-MM-DD) - tự động tính nếu bỏ trống' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @ValidateIf((o) => typeof o.endDate === 'string' && o.endDate.trim().length > 0)
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'https://storage.ictu.edu.vn/cards/student_card.jpg' })
  @IsOptional()
  @IsString()
  proofImageUrl?: string;

  @ApiPropertyOptional({ example: 'student_card', description: 'Loại giấy tờ minh chứng: student_card hoặc id_card' })
  @IsOptional()
  @IsString()
  proofType?: string;

  @ApiPropertyOptional({ example: false, description: 'Tự động duyệt hồ sơ (Chế độ Demo)' })
  @IsOptional()
  @IsBoolean()
  autoApprove?: boolean;
}

export class ResubmitMonthlyPassProofDto {
  @ApiProperty({ example: 'https://storage.ictu.edu.vn/cards/student_card_new.jpg', description: 'URL ảnh minh chứng mới' })
  @IsNotEmpty({ message: 'URL ảnh minh chứng không được để trống' })
  @IsString()
  proofImageUrl: string;

  @ApiPropertyOptional({ example: 'student_card', description: 'Loại giấy tờ minh chứng: student_card hoặc id_card' })
  @IsOptional()
  @IsString()
  proofType?: string;
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
  @ApiProperty({ example: 'ICTU2026', description: 'Mã voucher (tự động in hoa)' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 'Chào mừng năm học mới 2026 - Giảm giá vé xe buýt', description: 'Mô tả chiến dịch' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'percentage', enum: ['percentage', 'fixed_amount'], description: 'Loại giảm giá' })
  @IsEnum(['percentage', 'fixed_amount'])
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

  @ApiProperty({ example: '2026-09-01', description: 'Ngày bắt đầu áp dụng (YYYY-MM-DD)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-12-31', description: 'Ngày hết hạn sử dụng (YYYY-MM-DD)' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ example: 1000, description: 'Số lượt dùng tối đa (0 = không giới hạn)' })
  @IsOptional()
  @IsNumber()
  usageLimit?: number;

  @ApiPropertyOptional({
    example: 'all',
    enum: ['all', 'single_ticket', 'monthly_pass'],
    description: 'Áp dụng cho vé lượt, vé tháng hoặc tất cả',
  })
  @IsOptional()
  @IsEnum(['all', 'single_ticket', 'monthly_pass'])
  applicableType?: 'all' | 'single_ticket' | 'monthly_pass';

  @ApiPropertyOptional({
    example: ['uuid-tuyen-1', 'uuid-tuyen-2'],
    description: 'Danh sách ID tuyến xe áp dụng (rỗng = mọi tuyến)',
  })
  @IsOptional()
  applicableRouteIds?: string[];

  @ApiPropertyOptional({ example: 'active', enum: ['active', 'inactive'], description: 'Trạng thái kích hoạt' })
  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateVoucherDto {
  @ApiPropertyOptional({ example: 'Khuyến mãi đặc biệt dành cho sinh viên ICTU' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'percentage', enum: ['percentage', 'fixed_amount'] })
  @IsOptional()
  @IsEnum(['percentage', 'fixed_amount'])
  discountType?: 'percentage' | 'fixed_amount';

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  discountValue?: number;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsNumber()
  minOrderValue?: number;

  @ApiPropertyOptional({ example: 20000 })
  @IsOptional()
  @IsNumber()
  maxDiscountAmount?: number;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsNumber()
  usageLimit?: number;

  @ApiPropertyOptional({ enum: ['all', 'single_ticket', 'monthly_pass'] })
  @IsOptional()
  @IsEnum(['all', 'single_ticket', 'monthly_pass'])
  applicableType?: 'all' | 'single_ticket' | 'monthly_pass';

  @ApiPropertyOptional()
  @IsOptional()
  applicableRouteIds?: string[];

  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsString()
  status?: string;
}

export class ValidateVoucherDto {
  @ApiProperty({ example: 'ICTU2026', description: 'Mã voucher' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 50000, description: 'Tổng tiền đơn hàng trước giảm giá' })
  @IsNumber()
  orderAmount: number;

  @ApiPropertyOptional({
    example: 'single_ticket',
    enum: ['single_ticket', 'monthly_pass'],
    description: 'Loại dịch vụ thanh toán',
  })
  @IsOptional()
  @IsEnum(['single_ticket', 'monthly_pass'])
  serviceType?: 'single_ticket' | 'monthly_pass';

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', description: 'ID tuyến xe buýt (nếu có)' })
  @IsOptional()
  @IsString()
  routeId?: string;
}

export class QueryVoucherDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ example: 'ICTU', description: 'Tìm theo mã hoặc mô tả' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'active', enum: ['all', 'active', 'inactive', 'expired'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['all', 'single_ticket', 'monthly_pass'] })
  @IsOptional()
  @IsString()
  applicableType?: string;
}
