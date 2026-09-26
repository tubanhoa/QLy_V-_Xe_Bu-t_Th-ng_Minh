import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StationsService } from './stations.service.js';
import { CreateStationDto, UpdateStationDto } from './dto/transit.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Transit - Stations')
@Controller('api/v1/stations')
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các trạm dừng xe buýt' })
  async findAll() {
    return this.stationsService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết trạm dừng' })
  async findById(@Param('id') id: string) {
    return this.stationsService.findById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Post()
  @ApiOperation({ summary: 'Tạo trạm dừng mới (Manager, Admin)' })
  async create(@Body() dto: CreateStationDto) {
    return this.stationsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin trạm dừng (Manager, Admin)' })
  async update(@Param('id') id: string, @Body() dto: UpdateStationDto) {
    return this.stationsService.update(id, dto);
  }
}
