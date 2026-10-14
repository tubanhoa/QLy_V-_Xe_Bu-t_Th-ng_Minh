import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

export class QueryAuditLogsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo loại hành động (vd: LOGIN, CREATE_USER, CHANGE_ROLE, MUTATION_POST...)' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Lọc theo tài nguyên tác động (vd: auth, users, trips, tickets, vouchers...)' })
  @IsOptional()
  @IsString()
  resourceName?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID người thực hiện' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo địa chỉ IP thực hiện' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái (vd: SUCCESS, FAILED, 200, 400, 401, 403...)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Lọc từ thời điểm (ISO date hoặc YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Lọc đến thời điểm (ISO date hoặc YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;
}
