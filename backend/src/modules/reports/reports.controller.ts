import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProduces } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RevenueReportQueryDto } from './dto/revenue-query.dto.js';
import { OccupancyReportQueryDto } from './dto/occupancy-query.dto.js';

@ApiTags('Reports & Analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@ApiBearerAuth('JWT')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue')
  @ApiOperation({
    summary: 'Báo cáo doanh thu & hiệu quả tài chính (SQL Aggregation tối ưu cao)',
    description:
      'Hỗ trợ lọc linh hoạt theo startDate, endDate, groupBy (day/month/year), routeId, tripId, paymentMethod. Trả về KPIs, chuỗi thời gian, phân bổ theo tuyến, cơ cấu kênh thanh toán và chi tiết chuyến xe.',
  })
  async getRevenueStats(@Query() query: RevenueReportQueryDto) {
    return this.reportsService.getRevenueStats(query);
  }

  @Get('revenue/export/excel')
  @ApiOperation({ summary: 'Xuất Báo cáo Doanh thu ra file Excel (.xlsx) với stream response' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportRevenueExcel(@Query() query: RevenueReportQueryDto, @Res() res: Response) {
    return this.reportsService.exportRevenueExcel(query, res);
  }

  @Get('revenue/export/pdf')
  @ApiOperation({ summary: 'Xuất Báo cáo Doanh thu ra file PDF (.pdf) với stream response' })
  @ApiProduces('application/pdf')
  async exportRevenuePdf(@Query() query: RevenueReportQueryDto, @Res() res: Response) {
    return this.reportsService.exportRevenuePdf(query, res);
  }

  @Get('occupancy-rate')
  @ApiOperation({
    summary: 'Thống kê tỷ lệ lấp đầy chỗ & phân tích tối ưu chuyến xe (SQL Aggregation)',
    description:
      'Hỗ trợ lọc linh hoạt theo startDate, endDate, date, routeId, tripId, timeSlot. Trả về KPIs phụ tải, phân tích mật độ giờ cao điểm/thấp điểm, ma trận Heatmap khung giờ x thứ trong tuần, và các đề xuất điều chỉnh quy mô/tần suất xe.',
  })
  async getOccupancyRate(@Query() query: OccupancyReportQueryDto) {
    return this.reportsService.getOccupancyRate(query);
  }

  @Get('occupancy-rate/export/excel')
  @ApiOperation({ summary: 'Xuất Báo cáo Tỷ lệ lấp đầy ra file Excel (.xlsx) với stream response' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportOccupancyExcel(@Query() query: OccupancyReportQueryDto, @Res() res: Response) {
    return this.reportsService.exportOccupancyExcel(query, res);
  }

  @Get('occupancy-rate/export/pdf')
  @ApiOperation({ summary: 'Xuất Báo cáo Tỷ lệ lấp đầy ra file PDF (.pdf) với stream response' })
  @ApiProduces('application/pdf')
  async exportOccupancyPdf(@Query() query: OccupancyReportQueryDto, @Res() res: Response) {
    return this.reportsService.exportOccupancyPdf(query, res);
  }
}
