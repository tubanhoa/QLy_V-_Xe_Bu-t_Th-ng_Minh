import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service.js';
import { CreateVehicleDto } from './dto/transit.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Transit - Vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
@Controller('api/v1/vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các phương tiện xe buýt' })
  async findAll() {
    return this.vehiclesService.findAll();
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết xe' })
  async findById(@Param('id') id: string) {
    return this.vehiclesService.findById(id);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get(':id/seats')
  @ApiOperation({ summary: 'Lấy sơ đồ cấu hình ghế của xe' })
  async getSeats(@Param('id') id: string) {
    return this.vehiclesService.getSeats(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Thêm phương tiện mới và tự động sinh 28 ghế (Admin)' })
  async create(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }
}
