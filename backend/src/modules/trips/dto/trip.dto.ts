import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripStatus } from '../../../common/constants/status.constant.js';

export class GenerateTripsDto {
  @ApiProperty({ description: 'ID tuyến xe' })
  @IsString()
  @IsNotEmpty()
  routeId: string;

  @ApiProperty({ example: '2026-09-26', description: 'Ngày áp dụng (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: '06:00:00' })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional({ example: '20:00:00' })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiPropertyOptional({ example: 30, description: 'Tần suất chạy xe (phút/chuyến)' })
  @IsOptional()
  @IsNumber()
  intervalMinutes?: number;
}

export class DispatchTripDto {
  @ApiProperty({ description: 'ID chuyến xe' })
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @ApiPropertyOptional({ description: 'ID phương tiện xe' })
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'ID tài xế' })
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiPropertyOptional({ description: 'ID phụ xe' })
  @IsOptional()
  @IsString()
  conductorId?: string;
}

export class UpdateTripStatusDto {
  @ApiProperty({ enum: TripStatus, example: TripStatus.BOARDING })
  @IsEnum(TripStatus)
  status: TripStatus;
}

export class VerifyQrDto {
  @ApiProperty({ description: 'Chuỗi JSON mã QR quét được từ vé của hành khách' })
  @IsString()
  @IsNotEmpty()
  qrData: string;

  @ApiPropertyOptional({ description: 'ID chuyến xe để xác thực vé đúng chuyến' })
  @IsOptional()
  @IsString()
  tripId?: string;
}

export class CreateAdhocTripDto {
  @ApiProperty({ description: 'ID tuyến xe' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn tuyến xe' })
  routeId: string;

  @ApiProperty({ example: '2026-10-06T08:30:00.000Z', description: 'Thời điểm khởi hành (ISO string)' })
  @IsDateString({}, { message: 'Thời điểm khởi hành không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng chọn thời gian khởi hành' })
  departureTime: string;

  @ApiPropertyOptional({ example: '2026-10-06T09:15:00.000Z', description: 'Thời điểm đến bến dự kiến' })
  @IsOptional()
  @IsDateString()
  arrivalTime?: string;

  @ApiPropertyOptional({ description: 'ID phương tiện xe buýt' })
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'ID tài xế' })
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiPropertyOptional({ description: 'ID phụ xe' })
  @IsOptional()
  @IsString()
  conductorId?: string;

  @ApiPropertyOptional({ example: 'adhoc', default: 'adhoc' })
  @IsOptional()
  @IsString()
  tripType?: 'adhoc' | 'special' | 'regular';

  @ApiPropertyOptional({ description: 'Ghi chú lý do tăng cường' })
  @IsOptional()
  @IsString()
  note?: string;
}
