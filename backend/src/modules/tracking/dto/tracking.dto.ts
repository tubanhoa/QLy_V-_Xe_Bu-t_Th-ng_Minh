import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
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
