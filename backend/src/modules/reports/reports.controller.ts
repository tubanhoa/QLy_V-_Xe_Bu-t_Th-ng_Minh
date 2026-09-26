import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Reports & Analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@ApiBearerAuth('JWT')
@Controller('api/v1/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue')
  @ApiOperation({ summary: 'Thống kê doanh thu bán vé theo tuyến và theo ngày' })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-09-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-09-30' })
  async getRevenueStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getRevenueStats(startDate, endDate);
  }

  @Get('occupancy-rate')
  @ApiOperation({ summary: 'Thống kê tỷ lệ lấp đầy ghế theo chuyến xe' })
  @ApiQuery({ name: 'date', required: false, example: '2026-09-26' })
  async getOccupancyRate(@Query('date') date?: string) {
    return this.reportsService.getOccupancyRate(date);
  }
}
