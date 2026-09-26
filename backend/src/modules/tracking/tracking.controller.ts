import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TrackingService } from './tracking.service.js';
import { ReportIncidentDto, UpdateLocationDto } from './dto/tracking.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Tracking & Incidents')
@Controller('api/v1')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Public()
  @Get('trips/:id/live-tracking')
  @ApiOperation({ summary: 'Lấy vị trí GPS và thông số mới nhất của xe buýt trên chuyến' })
  async getLatestLocation(@Param('id') tripId: string) {
    return this.trackingService.getLatestLocation(tripId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DRIVER, Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Post('driver/incidents')
  @ApiOperation({ summary: 'Tài xế báo cáo sự cố trên đường (ùn tắc, hỏng hóc, tai nạn)' })
  async reportIncident(@Body() dto: ReportIncidentDto, @CurrentUser('id') reportedBy: string) {
    return this.trackingService.reportIncident(dto, reportedBy);
  }

  @Public()
  @Get('trips/:id/incidents')
  @ApiOperation({ summary: 'Lấy danh sách các sự cố được báo cáo trên chuyến xe' })
  async getTripIncidents(@Param('id') tripId: string) {
    return this.trackingService.getTripIncidents(tripId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DRIVER, Role.ADMIN)
  @ApiBearerAuth('JWT')
  @Post('driver/update-location')
  @ApiOperation({ summary: 'REST fallback để tài xế cập nhật vị trí GPS (nếu không dùng WS)' })
  async updateLocationRest(@Body() dto: UpdateLocationDto) {
    return this.trackingService.recordLocation(dto);
  }
}
