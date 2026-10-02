import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentType, IncidentSeverity } from '../../../common/constants/status.constant.js';

export class UpdateLocationDto {
  @ApiProperty({ description: 'ID chuyến xe' })
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @ApiProperty({ example: 21.585284, description: 'Vĩ độ' })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: 105.806297, description: 'Kinh độ' })
  @IsNumber()
  longitude: number;

  @ApiPropertyOptional({ example: 35.5, description: 'Tốc độ hiện tại (km/h)' })
  @IsOptional()
  @IsNumber()
  speedKmh?: number;

  @ApiPropertyOptional({ example: 180.0, description: 'Hướng di chuyển (độ)' })
  @IsOptional()
  @IsNumber()
  headingDegrees?: number;

  @ApiPropertyOptional({ example: 85.0, description: 'Mức pin xe điện (%)' })
  @IsOptional()
  @IsNumber()
  batteryPercent?: number;

  @ApiPropertyOptional({ example: false, description: 'Cờ định danh dữ liệu mô phỏng' })
  @IsOptional()
  isSimulated?: boolean;
}

export class GpsPingDto {
  @ApiProperty({ description: 'ID chuyến xe' })
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @ApiProperty({ example: 21.585284, description: 'Vĩ độ thiết bị GPS' })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: 105.806297, description: 'Kinh độ thiết bị GPS' })
  @IsNumber()
  longitude: number;

  @ApiPropertyOptional({ example: 32.0, description: 'Tốc độ (km/h)' })
  @IsOptional()
  @IsNumber()
  speedKmh?: number;

  @ApiPropertyOptional({ example: 90.0, description: 'Hướng di chuyển (độ)' })
  @IsOptional()
  @IsNumber()
  headingDegrees?: number;

  @ApiPropertyOptional({ example: 95.0, description: 'Mức pin (%)' })
  @IsOptional()
  @IsNumber()
  batteryPercent?: number;
}

export class SimulatorControlDto {
  @ApiProperty({ description: 'ID chuyến xe cần mô phỏng' })
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @ApiPropertyOptional({ example: 1, description: 'Hệ số tăng tốc mô phỏng (1 = bình thường, 2 = gấp đôi)' })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(10)
  speedMultiplier?: number;
}

export interface StationEtaItem {
  stationId: string;
  stationName: string;
  stopOrder: number;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  etaMinutes: number;
  estimatedArrivalIso: string;
  status: 'passed' | 'approaching' | 'upcoming';
  isNextStop: boolean;
}

export class StationEtaResponseDto implements StationEtaItem {
  @ApiProperty({ example: 'station-uuid-1', description: 'ID trạm xe' })
  stationId: string;

  @ApiProperty({ example: 'ĐH CNTT & TT (ICTU)', description: 'Tên trạm' })
  stationName: string;

  @ApiProperty({ example: 1, description: 'Thứ tự đón trả' })
  stopOrder: number;

  @ApiProperty({ example: 21.585284, description: 'Vĩ độ trạm' })
  latitude: number;

  @ApiProperty({ example: 105.806297, description: 'Kinh độ trạm' })
  longitude: number;

  @ApiProperty({ example: 450, description: 'Khoảng cách từ xe tới trạm (mét)' })
  distanceMeters: number;

  @ApiProperty({ example: 2, description: 'Thời gian dự kiến đến (phút)' })
  etaMinutes: number;

  @ApiProperty({ example: '2026-10-02T15:30:00.000Z', description: 'Thời điểm dự kiến đến trạm ISO' })
  estimatedArrivalIso: string;

  @ApiProperty({ enum: ['passed', 'approaching', 'upcoming'], example: 'approaching' })
  status: 'passed' | 'approaching' | 'upcoming';

  @ApiProperty({ example: true, description: 'Có phải là trạm kế tiếp hay không' })
  isNextStop: boolean;
}

export class LiveTrackingResponseDto {
  @ApiProperty({ example: 'trip-uuid-1' })
  tripId: string;

  @ApiProperty({ example: 21.585284 })
  latitude: number;

  @ApiProperty({ example: 105.806297 })
  longitude: number;

  @ApiProperty({ example: 35.0 })
  speedKmh: number;

  @ApiProperty({ example: 180.0 })
  headingDegrees: number;

  @ApiProperty({ example: 90.0 })
  batteryPercent: number;

  @ApiProperty({ example: '2026-10-02T15:30:00.000Z' })
  lastUpdated: Date | string;

  @ApiProperty({ example: false })
  isSimulated: boolean;

  @ApiProperty({ type: [StationEtaResponseDto] })
  stationEtas: StationEtaItem[];
}

export class ReportIncidentDto {
  @ApiProperty({ description: 'ID chuyến xe' })
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @ApiProperty({ enum: IncidentType, example: IncidentType.TRAFFIC_JAM })
  @IsEnum(IncidentType)
  incidentType: IncidentType;

  @ApiPropertyOptional({ enum: IncidentSeverity, example: IncidentSeverity.MEDIUM })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @ApiPropertyOptional({ example: 'Đang ùn tắc tại ngã ba đường Z115 và Quang Trung' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 15, description: 'Thời gian trễ dự kiến (phút)' })
  @IsOptional()
  @IsNumber()
  delayMinutesEstimate?: number;
}
