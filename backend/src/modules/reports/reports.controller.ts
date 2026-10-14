import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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

  @Get('occupancy-rate')
  @ApiOperation({
    summary: 'Thống kê tỷ lệ lấp đầy chỗ & phân tích tối ưu chuyến xe (SQL Aggregation)',
    description:
      'Hỗ trợ lọc linh hoạt theo startDate, endDate, date, routeId, tripId, timeSlot. Trả về KPIs phụ tải, phân tích mật độ giờ cao điểm/thấp điểm, ma trận Heatmap khung giờ x thứ trong tuần, và các đề xuất điều chỉnh quy mô/tần suất xe.',
  })
  async getOccupancyRate(@Query() query: OccupancyReportQueryDto) {
    return this.reportsService.getOccupancyRate(query);
  }
}
