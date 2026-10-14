import { IsOptional, IsDateString, IsUUID, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class OccupancyReportQueryDto {
  @ApiPropertyOptional({
    description: 'Ngày bắt đầu thống kê (YYYY-MM-DD)',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'startDate phải là định dạng ISO date (YYYY-MM-DD)' })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Ngày kết thúc thống kê (YYYY-MM-DD)',
    example: '2026-10-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'endDate phải là định dạng ISO date (YYYY-MM-DD)' })
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Ngày đơn lẻ cần thống kê (YYYY-MM-DD - Tương thích ngược)',
    example: '2026-10-14',
  })
  @IsOptional()
  @IsDateString({}, { message: 'date phải là định dạng ISO date (YYYY-MM-DD)' })
  date?: string;

  @ApiPropertyOptional({
    description: 'Lọc phụ tải theo ID tuyến xe (UUID v4)',
    example: '6a30fd78-6733-4f91-b728-4b8810cbc392',
  })
  @IsOptional()
  @IsUUID('4', { message: 'routeId phải là định dạng UUID hợp lệ' })
  routeId?: string;

  @ApiPropertyOptional({
    description: 'Lọc phụ tải theo ID chuyến xe (UUID v4)',
    example: 'c7ff7f00-8fee-4fcf-926b-96a591c026ff',
  })
  @IsOptional()
  @IsUUID('4', { message: 'tripId phải là định dạng UUID hợp lệ' })
  tripId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo khung giờ (all, peak_morning, peak_evening, midday, evening)',
    example: 'all',
  })
  @IsOptional()
  @IsString()
  timeSlot?: string;
}
