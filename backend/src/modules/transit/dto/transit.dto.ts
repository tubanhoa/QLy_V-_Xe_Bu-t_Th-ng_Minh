import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsIn,
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

  @ApiPropertyOptional({ example: 35, description: 'Thời gian dự kiến di chuyển toàn tuyến (phút)' })
  @IsOptional()
  @IsNumber()
  estimatedDurationMinutes?: number;

  @ApiProperty({ example: 10000, description: 'Giá vé gốc / cơ sở (VND)' })
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

  @ApiPropertyOptional({
    enum: ['fixed', 'distance', 'stage'],
    example: 'fixed',
    description: 'Kiểu biểu phí: fixed (đồng giá) | distance (cự ly) | stage (chặng)',
  })
  @IsOptional()
  @IsString()
  @IsIn(['fixed', 'distance', 'stage'])
  pricingType?: string;

  @ApiPropertyOptional({
    example: [
      { minKm: 0, maxKm: 5, price: 20000, studentPrice: 10000 },
      { minKm: 5, maxKm: 10, price: 25000, studentPrice: 12000 },
      { minKm: 10, maxKm: 999, price: 30000, studentPrice: 15000 },
    ],
    description: 'Quy tắc biểu phí chi tiết theo khoảng cách hoặc số chặng',
  })
  @IsOptional()
  fareRules?: any;

  @ApiPropertyOptional({ type: [RouteStopDto], description: 'Danh sách các trạm dừng theo thứ tự' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteStopDto)
  stops?: RouteStopDto[];

  @ApiPropertyOptional({ example: 'uuid-driver-id', description: 'ID tài xế được phân quyền phụ trách tuyến xe' })
  @IsOptional()
  @IsString()
  assignedDriverId?: string;

  @ApiPropertyOptional({ example: 'uuid-vehicle-id', description: 'ID phương tiện xe buýt điện chạy tuyến' })
  @IsOptional()
  @IsString()
  assignedVehicleId?: string;
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

  @ApiPropertyOptional({ example: 35, description: 'Thời gian dự kiến di chuyển toàn tuyến (phút)' })
  @IsOptional()
  @IsNumber()
  estimatedDurationMinutes?: number;

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

  @ApiPropertyOptional({ enum: ['fixed', 'distance', 'stage'] })
  @IsOptional()
  @IsString()
  @IsIn(['fixed', 'distance', 'stage'])
  pricingType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  fareRules?: any;

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

export class UpdatePricingDto {
  @ApiProperty({
    enum: ['fixed', 'distance', 'stage'],
    example: 'distance',
    description: 'Kiểu tính giá: fixed, distance hoặc stage',
  })
  @IsString()
  @IsIn(['fixed', 'distance', 'stage'])
  pricingType: string;

  @ApiProperty({ example: 10000, description: 'Giá vé gốc / mở cửa (VND)' })
  @IsNumber()
  basePrice: number;

  @ApiPropertyOptional({ example: 5000, description: 'Giá vé ưu đãi sinh viên' })
  @IsOptional()
  @IsNumber()
  studentPrice?: number;

  @ApiPropertyOptional({
    example: [
      { minKm: 0, maxKm: 5, price: 20000, studentPrice: 10000 },
      { minKm: 5, maxKm: 10, price: 25000, studentPrice: 12000 },
      { minKm: 10, maxKm: 999, price: 30000, studentPrice: 15000 },
    ],
    description: 'Bảng quy tắc bậc thang tính theo cự ly km hoặc số chặng',
  })
  @IsOptional()
  fareRules?: any;
}

export class CalculateFareDto {
  @ApiProperty({ example: 'station-uuid-1', description: 'ID trạm đón khách' })
  @IsString()
  @IsNotEmpty()
  pickupStationId: string;

  @ApiProperty({ example: 'station-uuid-2', description: 'ID trạm trả khách' })
  @IsString()
  @IsNotEmpty()
  dropoffStationId: string;

  @ApiPropertyOptional({ example: true, description: 'Khách hàng có phải là Học sinh - Sinh viên không' })
  @IsOptional()
  @IsBoolean()
  isStudent?: boolean;
}

export class AddRouteStationDto {
  @ApiProperty({ description: 'Station ID' })
  @IsString()
  @IsNotEmpty()
  stationId: string;

  @ApiProperty({ example: 3, description: 'Thứ tự dừng chỉ định (stopOrder)' })
  @IsNumber()
  @Min(1)
  stopOrder: number;

  @ApiPropertyOptional({ example: 4.5, description: 'Khoảng cách từ điểm xuất phát (km)' })
  @IsOptional()
  @IsNumber()
  distanceFromOriginKm?: number;

  @ApiPropertyOptional({ example: 12, description: 'Thời gian di chuyển dự kiến (phút)' })
  @IsOptional()
  @IsNumber()
  estimatedMinutes?: number;
}

export class BulkUpdateRouteStationsDto {
  @ApiProperty({ type: [RouteStopDto], description: 'Danh sách toàn bộ trạm trên tuyến theo thứ tự mới' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteStopDto)
  stops: RouteStopDto[];
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

  @ApiProperty({ example: 21.585284, description: 'Vĩ độ GPS [-90, 90]' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: 105.806297, description: 'Kinh độ GPS [-180, 180]' })
  @IsNumber()
  @Min(-180)
  @Max(180)
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

  @ApiPropertyOptional({ description: 'Vĩ độ GPS [-90, 90]' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Kinh độ GPS [-180, 180]' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
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

export class UpdateVehicleStatusDto {
  @ApiProperty({ enum: ['active', 'maintenance', 'retired'], example: 'maintenance' })
  @IsNotEmpty()
  @IsString()
  status: any;
}

export class UpdateVehicleDto {
  @ApiPropertyOptional({ example: 'VinFast eBus 2024' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 'electric' })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({ example: 2024 })
  @IsOptional()
  @IsNumber()
  manufactureYear?: number;

  @ApiPropertyOptional({ example: 281.9 })
  @IsOptional()
  @IsNumber()
  batteryCapacityKwh?: number;

  @ApiPropertyOptional({ enum: ['active', 'maintenance', 'retired'] })
  @IsOptional()
  @IsString()
  status?: any;
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
