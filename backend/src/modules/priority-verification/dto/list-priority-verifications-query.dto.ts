import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListPriorityVerificationsQueryDto {
  @ApiPropertyOptional({ example: 'all', description: 'Trạng thái: all | pending | verified | rejected' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'all', description: 'Đối tượng: all | student | elderly' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Nguyen Thu An', description: 'Từ khóa tìm kiếm (họ tên, email, MSSV, CCCD)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
