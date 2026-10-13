import {
  Controller,
  Get,
  Put,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { DriverProfileService } from './driver-profile.service.js';
import {
  UpdateDriverProfileDto,
  ReviewDriverProfileDto,
  ListDriverProfilesQueryDto,
} from './dto/driver-profile.dto.js';

@ApiTags('Admin Driver Profiles - Hồ Sơ & Bằng Lái Tài Xế')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class DriverProfileController {
  constructor(private readonly driverProfileService: DriverProfileService) {}

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('admin/driver-profiles')
  @ApiOperation({ summary: 'Danh sách hồ sơ bằng lái của tất cả tài xế và số liệu KPI (Admin, Manager)' })
  async getDriverProfiles(@Query() query: ListDriverProfilesQueryDto) {
    return this.driverProfileService.findAll(query);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('admin/driver-profiles/:driverId')
  @ApiOperation({ summary: 'Xem chi tiết hồ sơ bằng lái của tài xế (Admin, Manager)' })
  async getDriverProfileDetail(@Param('driverId') driverId: string) {
    return this.driverProfileService.findByDriverId(driverId);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Put('admin/driver-profiles/:driverId')
  @ApiOperation({ summary: 'Tạo mới hoặc cập nhật thông tin GPLX trực tiếp cho tài xế (Admin, Manager)' })
  async upsertDriverProfile(
    @Param('driverId') driverId: string,
    @Body() dto: UpdateDriverProfileDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.driverProfileService.upsertProfile(driverId, dto, adminId);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch('admin/driver-profiles/:driverId/review')
  @ApiOperation({ summary: 'Thẩm định hồ sơ GPLX: Phê duyệt hoặc Từ chối kèm lý do (Admin, Manager)' })
  async reviewDriverProfile(
    @Param('driverId') driverId: string,
    @Body() dto: ReviewDriverProfileDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.driverProfileService.reviewProfile(driverId, dto, adminId);
  }
}
