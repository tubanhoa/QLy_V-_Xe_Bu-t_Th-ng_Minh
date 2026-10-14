import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service.js';
import { QueryAuditLogsDto } from './dto/query-audit.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Audit & Activity Logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth('JWT')
@Controller('admin/activity-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Thống kê tổng quan tình hình an ninh & kiểm toán' })
  @ApiResponse({ status: 200, description: 'Dữ liệu thống kê logs' })
  async getStats() {
    return this.auditService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết một bản ghi nhật ký kiểm toán' })
  @ApiResponse({ status: 200, description: 'Chi tiết log' })
  async findById(@Param('id') id: string) {
    return this.auditService.findById(id);
  }

  @Get()
  @ApiOperation({ summary: 'Xem danh sách nhật ký hoạt động hệ thống kèm bộ lọc đa tiêu chí (Admin)' })
  @ApiResponse({ status: 200, description: 'Danh sách activity logs kèm meta phân trang' })
  async findAll(@Query() query: QueryAuditLogsDto) {
    return this.auditService.findAll(query);
  }
}
