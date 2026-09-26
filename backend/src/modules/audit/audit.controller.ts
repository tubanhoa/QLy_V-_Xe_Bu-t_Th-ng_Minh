import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
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

  @Get()
  @ApiOperation({ summary: 'Xem nhật ký hoạt động hệ thống (Admin)' })
  @ApiQuery({ name: 'action', required: false, example: 'LOGIN' })
  @ApiQuery({ name: 'resourceName', required: false, example: 'booking' })
  @ApiQuery({ name: 'userId', required: false })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('action') action?: string,
    @Query('resourceName') resourceName?: string,
    @Query('userId') userId?: string,
  ) {
    return this.auditService.findAll(pagination, action, resourceName, userId);
  }
}
