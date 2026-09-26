import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsOptional,
  IsDateString,
  ValidateNested,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HoldSeatsDto {
  @ApiProperty({ description: 'ID chuyến xe' })
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @ApiProperty({ example: ['uuid-seat-1', 'uuid-seat-2'], description: 'Danh sách ID các ghế muốn giữ chỗ' })
  @IsArray()
  @IsString({ each: true })
  seatIds: string[];
}

export class PassengerInfoDto {
  @ApiProperty({ description: 'ID ghế được chọn' })
  @IsString()
  @IsNotEmpty()
  seatId: string;

  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Tên hành khách' })
  @IsString()
  @IsNotEmpty()
  passengerName: string;

  @ApiPropertyOptional({ example: '0987654321', description: 'Số điện thoại hành khách' })
  @IsOptional()
  @IsString()
  passengerPhone?: string;
}

export class CreateBookingDto {
  @ApiProperty({ description: 'ID chuyến xe' })
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @ApiProperty({ type: [PassengerInfoDto], description: 'Danh sách vé và thông tin từng hành khách' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PassengerInfoDto)
  passengers: PassengerInfoDto[];

  @ApiPropertyOptional({ example: 'TAN_SINH_VIEN', description: 'Mã khuyến mại nếu có' })
  @IsOptional()
  @IsString()
  voucherCode?: string;

  @ApiPropertyOptional({ example: 'vnpay', description: 'Phương thức thanh toán: vnpay, momo, vietqr, cash' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class SearchTripsDto {
  @ApiPropertyOptional({ example: 'ĐH CNTT & TT Thái Nguyên', description: 'Điểm khởi hành' })
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiPropertyOptional({ example: 'Bến xe Trung tâm Thái Nguyên', description: 'Điểm đến' })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional({ example: '2026-09-26', description: 'Ngày đi (YYYY-MM-DD), mặc định hôm nay nếu bỏ trống' })
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class ExchangeTicketDto {
  @ApiProperty({ description: 'ID chuyến xe mới' })
  @IsString()
  @IsNotEmpty()
  newTripId: string;

  @ApiProperty({ description: 'ID ghế mới trên chuyến mới' })
  @IsString()
  @IsNotEmpty()
  newSeatId: string;
}
