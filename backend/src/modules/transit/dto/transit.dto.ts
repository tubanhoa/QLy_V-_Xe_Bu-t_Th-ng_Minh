import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RouteStopDto {
  @ApiProperty({ description: 'Station ID' })
  @IsString()
  @IsNotEmpty()
  stationId: string;

  @ApiProperty({ example: 1, description: 'Thứ tự trạm' })
  @IsNumber()
  stopOrder: number;

  @ApiPropertyOptional({ example: 2.5, description: 'Khoảng cách từ điểm xuất phát (km)' })
  @IsOptional()
  @IsNumber()
  distanceFromOriginKm?: number;

  @ApiPropertyOptional({ example: 5, description: 'Thời gian di chuyển dự kiến (phút)' })
  @IsOptional()
  @IsNumber()
  estimatedMinutes?: number;
}

export class CreateRouteDto {
  @ApiProperty({ example: 'CT-01', description: 'Mã tuyến' })
  @IsString()
  @IsNotEmpty()
  routeCode: string;

  @ApiProperty({ example: 'ĐH CNTT & TT ↔ Bến xe Trung tâm Thái Nguyên', description: 'Tên tuyến' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'ĐH CNTT & TT Thái Nguyên' })
  @IsString()
  @IsNotEmpty()
  origin: string;

  @ApiProperty({ example: 'Bến xe Trung tâm Thái Nguyên' })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiPropertyOptional({ example: 14.5 })
  @IsOptional()
  @IsNumber()
  distanceKm?: number;

  @ApiProperty({ example: 10000, description: 'Giá vé gốc (VND)' })
  @IsNumber()
  basePrice: number;

  @ApiPropertyOptional({ example: 5000, description: 'Giá vé sinh viên (-50%)' })
  @IsOptional()
  @IsNumber()
  studentPrice?: number;

  @ApiPropertyOptional({ example: '05:30:00' })
  @IsOptional()
  @IsString()
  operatingStart?: string;

  @ApiPropertyOptional({ example: '21:00:00' })
  @IsOptional()
  @IsString()
  operatingEnd?: string;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber()
  frequencyMinutes?: number;

  @ApiPropertyOptional({ type: [RouteStopDto], description: 'Danh sách các trạm dừng theo thứ tự' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteStopDto)
  stops?: RouteStopDto[];
}

export class UpdateRouteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  distanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  basePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  studentPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operatingStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operatingEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  frequencyMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ type: [RouteStopDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteStopDto)
  stops?: RouteStopDto[];
}

export class CreateStationDto {
  @ApiProperty({ example: 'Trạm ĐH CNTT & TT Thái Nguyên' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 21.585284 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: 105.806297 })
  @IsNumber()
  longitude: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isHub?: boolean;
}

export class UpdateStationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isHub?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateVehicleDto {
  @ApiProperty({ example: '20B-123.45', description: 'Biển số xe' })
  @IsString()
  @IsNotEmpty()
  licensePlate: string;

  @ApiPropertyOptional({ example: 'VinFast eBus 2024' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 'electric' })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({ example: 28, description: 'Số chỗ ngồi (mặc định 28)' })
  @IsOptional()
  @IsNumber()
  seatCapacity?: number;

  @ApiPropertyOptional({ example: 2024 })
  @IsOptional()
  @IsNumber()
  manufactureYear?: number;

  @ApiPropertyOptional({ example: 281.9, description: 'Dung lượng pin kWh' })
  @IsOptional()
  @IsNumber()
  batteryCapacityKwh?: number;
}

export class SearchRouteDto {
  @ApiPropertyOptional({ example: 'ĐH CNTT & TT Thái Nguyên', description: 'Điểm khởi hành / trạm đi' })
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiPropertyOptional({ example: 'Bến xe Trung tâm Thái Nguyên', description: 'Điểm đến / trạm đến' })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional({ example: 'CT-01', description: 'Từ khóa tìm kiếm (mã tuyến hoặc tên tuyến)' })
  @IsOptional()
  @IsString()
  keyword?: string;
}
