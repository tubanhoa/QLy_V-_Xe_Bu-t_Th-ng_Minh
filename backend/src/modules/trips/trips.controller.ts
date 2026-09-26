import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TripsService } from './trips.service.js';
import {
  GenerateTripsDto,
  DispatchTripDto,
  UpdateTripStatusDto,
  VerifyQrDto,
} from './dto/trip.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Trips & Dispatch')
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Post('generate')
  @ApiOperation({ summary: 'Tự động sinh lịch trình chạy xe theo ngày (Manager, Admin)' })
  async generateSchedule(@Body() dto: GenerateTripsDto) {
    return this.tripsService.generateSchedule(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Post('dispatch')
  @ApiOperation({ summary: 'Điều phối: Gán xe + tài xế + phụ xe cho chuyến (Manager, Admin)' })
  async dispatch(@Body() dto: DispatchTripDto) {
    return this.tripsService.dispatch(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DRIVER, Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Get('driver/today')
  @ApiOperation({ summary: 'Lấy danh sách các chuyến hôm nay của tài xế (Driver)' })
  async getDriverTodayTrips(@CurrentUser('id') driverId: string) {
    return this.tripsService.getDriverTodayTrips(driverId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DRIVER, Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Post('driver/verify-qr')
  @ApiOperation({ summary: 'Soát vé QR online cho hành khách khi lên xe (Driver, Conductor)' })
  async verifyQr(@Body() dto: VerifyQrDto, @CurrentUser('id') conductorId: string) {
    return this.tripsService.verifyQr(dto, conductorId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DRIVER, Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Get(':id/manifest')
  @ApiOperation({ summary: 'Danh sách hành khách (manifest) của chuyến xe (Driver, Manager)' })
  async getManifest(@Param('id') id: string) {
    return this.tripsService.getManifest(id);
  }

  @Public()
  @Get(':id/seat-map')
  @ApiOperation({ summary: 'Lấy sơ đồ ghế và tình trạng đặt chỗ realtime của chuyến' })
  async getSeatMap(@Param('id') id: string) {
    return this.tripsService.getSeatMap(id);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Xem thông tin chi tiết một chuyến xe' })
  async findById(@Param('id') id: string) {
    return this.tripsService.findById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DRIVER, Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Patch(':id/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái chuyến xe (Driver, Manager)' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateTripStatusDto) {
    return this.tripsService.updateStatus(id, dto.status);
  }
}
