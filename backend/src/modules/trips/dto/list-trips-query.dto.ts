import {
  IsOptional,
  IsDateString,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TripStatus } from '../../../common/constants/status.constant.js';

export class ListTripsQueryDto {
  @ApiPropertyOptional({
    example: '2026-09-27',
    description: 'Lọc theo ngày (YYYY-MM-DD). Mặc định: hôm nay',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Định dạng ngày không hợp lệ (YYYY-MM-DD)' })
  date?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo ID tuyến xe',
  })
  @IsOptional()
  @IsUUID('4', { message: 'routeId phải là UUID hợp lệ' })
  routeId?: string;

  @ApiPropertyOptional({
    enum: TripStatus,
    description: 'Lọc theo trạng thái chuyến xe',
  })
  @IsOptional()
  @IsEnum(TripStatus, { message: 'Trạng thái không hợp lệ' })
  status?: TripStatus;

  @ApiPropertyOptional({
    example: true,
    description: 'STT6: true = loại bỏ chuyến đã xuất bến (departed/in_progress/completed)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean({ message: 'excludeDeparted phải là true hoặc false' })
  excludeDeparted?: boolean;

  @ApiPropertyOptional({ example: 1, description: 'Số trang (mặc định 1)' })
  @IsOptional()
  @IsInt({ message: 'page phải là số nguyên' })
  @Min(1, { message: 'page phải >= 1' })
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Số item/trang (mặc định 20, tối đa 100)' })
  @IsOptional()
  @IsInt({ message: 'limit phải là số nguyên' })
  @Min(1, { message: 'limit phải >= 1' })
  @Max(100, { message: 'limit không được vượt quá 100' })
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 'departureTime',
    enum: ['departureTime', 'status', 'createdAt'],
    description: 'Trường sắp xếp (mặc định: departureTime)',
  })
  @IsOptional()
  @IsIn(['departureTime', 'status', 'createdAt'], {
    message: 'sortBy phải là: departureTime, status, hoặc createdAt',
  })
  sortBy?: string = 'departureTime';

  @ApiPropertyOptional({
    example: 'ASC',
    enum: ['ASC', 'DESC'],
    description: 'Thứ tự sắp xếp (mặc định: ASC)',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'], { message: 'sortOrder phải là ASC hoặc DESC' })
  sortOrder?: 'ASC' | 'DESC' = 'ASC';
}
