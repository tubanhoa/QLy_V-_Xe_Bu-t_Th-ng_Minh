import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsOptional,
  IsDateString,
  ValidateNested,
  IsEmail,
  ArrayNotEmpty,
  ArrayMaxSize,
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
  @ArrayNotEmpty({ message: 'Danh sách ghế không được để trống' })
  @ArrayMaxSize(5, { message: 'Chỉ được giữ tối đa 5 ghế trong một lần đặt' })
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
  @IsDateString({}, { message: 'Định dạng ngày không hợp lệ' })
  date?: string;
}

export class CancelTicketDto {
  @ApiPropertyOptional({ example: 'Bận việc đột xuất', description: 'Lý do hủy vé' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: 'req-cancel-12345', description: 'Khóa chống trùng lặp (Idempotency Key)' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class HoldExchangeSeatDto {
  @ApiProperty({ description: 'ID chuyến xe mới muốn đổi sang' })
  @IsString()
  @IsNotEmpty({ message: 'newTripId không được để trống' })
  newTripId: string;

  @ApiProperty({ description: 'ID ghế mới trên chuyến mới muốn giữ chỗ' })
  @IsString()
  @IsNotEmpty({ message: 'newSeatId không được để trống' })
  newSeatId: string;
}

export class ConfirmExchangeDto {
  @ApiProperty({ description: 'ID chuyến xe mới' })
  @IsString()
  @IsNotEmpty({ message: 'newTripId không được để trống' })
  newTripId: string;

  @ApiProperty({ description: 'ID ghế mới trên chuyến mới' })
  @IsString()
  @IsNotEmpty({ message: 'newSeatId không được để trống' })
  newSeatId: string;

  @ApiPropertyOptional({ example: 'vnpay', description: 'Phương thức thanh toán nếu có chênh lệch giá' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ example: 'req-exchange-12345', description: 'Khóa chống trùng lặp (Idempotency Key)' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
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

  @ApiPropertyOptional({ example: 'vnpay', description: 'Phương thức thanh toán khoản chênh lệch' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class ResendTicketByCodeDto {
  @ApiPropertyOptional({ example: 'TK-2026-02B', description: 'Mã vé xe buýt' })
  @IsOptional()
  @IsString()
  ticketCode?: string;

  @ApiPropertyOptional({ example: 'BK-ICTU-8168', description: 'Mã đơn đặt vé' })
  @IsOptional()
  @IsString()
  bookingCode?: string;

  @ApiPropertyOptional({ example: 'user@example.com', description: 'Email nhận lại vé (tùy chọn)' })
  @IsOptional()
  @IsEmail({}, { message: 'Địa chỉ email không đúng định dạng' })
  email?: string;
}
