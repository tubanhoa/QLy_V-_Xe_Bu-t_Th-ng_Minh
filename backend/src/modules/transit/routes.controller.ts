import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RoutesService } from './routes.service.js';
import {
  CreateRouteDto,
  UpdateRouteDto,
  SearchRouteDto,
  UpdatePricingDto,
  CalculateFareDto,
  AddRouteStationDto,
  BulkUpdateRouteStationsDto,
} from './dto/transit.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Transit - Routes')
@Controller({
  path: 'routes',
  version: ['1', VERSION_NEUTRAL],
})
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary:
      'Lấy danh sách các tuyến xe buýt đang hoạt động hoặc tìm kiếm theo điểm đi, điểm đến, từ khóa',
  })
  async findAll(@Query() query?: SearchRouteDto) {
    return this.routesService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Lấy thông tin chi tiết tuyến xe, biểu giá và danh sách các trạm dừng theo thứ tự',
  })
  async findById(@Param('id') id: string) {
    return this.routesService.findById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Post()
  @ApiOperation({ summary: 'Tạo tuyến xe mới (Manager, Admin)' })
  async create(@Body() dto: CreateRouteDto) {
    return this.routesService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin tuyến xe (Manager, Admin)' })
  async update(@Param('id') id: string, @Body() dto: UpdateRouteDto) {
    return this.routesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Delete(':id')
  @ApiOperation({
    summary: 'Xóa tuyến xe với kiểm tra ràng buộc toàn vẹn chuyến xe và vé (Manager, Admin)',
  })
  async delete(@Param('id') id: string) {
    return this.routesService.delete(id);
  }

  // =========================================================================
  // QUẢN LÝ LỘ TRÌNH TRẠM DỪNG (ROUTE STATIONS)
  // =========================================================================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Put(':id/stations')
  @ApiOperation({ summary: 'Cập nhật lại toàn bộ danh sách và thứ tự trạm trên tuyến (Manager, Admin)' })
  async bulkUpdateStations(
    @Param('id') routeId: string,
    @Body() dto: BulkUpdateRouteStationsDto,
  ) {
    return this.routesService.bulkUpdateStations(routeId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Post(':id/stations')
  @ApiOperation({
    summary: 'Thêm một trạm mới vào lộ trình tuyến tại vị trí stopOrder chỉ định (Manager, Admin)',
  })
  async addStation(
    @Param('id') routeId: string,
    @Body() dto: AddRouteStationDto,
  ) {
    return this.routesService.addStation(routeId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Delete(':id/stations/:stationId')
  @ApiOperation({
    summary: 'Gỡ một trạm ra khỏi tuyến xe và tự động đánh số lại stopOrder liên tục từ 1..N (Manager, Admin)',
  })
  async removeStation(
    @Param('id') routeId: string,
    @Param('stationId') stationId: string,
  ) {
    return this.routesService.removeStation(routeId, stationId);
  }

  // =========================================================================
  // CẤU HÌNH VÀ TÍNH TOÁN GIÁ VÉ (PRICING & CALCULATE FARE)
  // =========================================================================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Put(':id/pricing')
  @ApiOperation({
    summary: 'Cấu hình cơ chế định giá vé và biểu phí (fixed / distance / stage) cho tuyến xe (Manager, Admin)',
  })
  async updatePricing(
    @Param('id') routeId: string,
    @Body() dto: UpdatePricingDto,
  ) {
    return this.routesService.updatePricing(routeId, dto);
  }

  @Public()
  @Post(':id/calculate-fare')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tra cứu và tính toán giá vé tức thì giữa 2 trạm dừng theo cơ chế định giá của tuyến',
  })
  async calculateFare(
    @Param('id') routeId: string,
    @Body() dto: CalculateFareDto,
  ) {
    return this.routesService.calculateFare(routeId, dto);
  }
}
