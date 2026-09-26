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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RoutesService } from './routes.service.js';
import { CreateRouteDto, UpdateRouteDto, SearchRouteDto } from './dto/transit.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Transit - Routes')
@Controller(['api/v1/routes', 'api/routes'])
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các tuyến xe buýt đang hoạt động hoặc tìm kiếm theo điểm đi, điểm đến, từ khóa' })
  async findAll(@Query() query?: SearchRouteDto) {
    return this.routesService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết tuyến xe và các trạm dừng' })
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
  @ApiOperation({ summary: 'Xóa tuyến xe (Manager, Admin)' })
  async delete(@Param('id') id: string) {
    return this.routesService.delete(id);
  }
}
