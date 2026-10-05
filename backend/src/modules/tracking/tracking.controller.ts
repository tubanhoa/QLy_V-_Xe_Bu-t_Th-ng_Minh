import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Observable } from 'rxjs';

import { TrackingService } from './tracking.service.js';
import {
  ReportIncidentDto,
  ResolveIncidentDto,
  UpdateLocationDto,
  GpsPingDto,
  SimulatorControlDto,
  LiveTrackingResponseDto,
} from './dto/tracking.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Tracking & Real-time GPS')
@Controller()
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Public()
  @Get('trips/:id/live-tracking')
  @ApiOperation({
    summary: 'Lấy vị trí GPS và danh sách ETA các trạm mới nhất (Low Latency Cache < 5ms)',
  })
  @ApiResponse({
    status: 200,
    description: 'Thông tin GPS và toàn bộ Station ETAs',
    type: LiveTrackingResponseDto,
  })
  async getLiveTracking(@Param('id') tripId: string) {
    return this.trackingService.getLiveTrackingWithEta(tripId);
  }

  @Public()
  @Sse('trips/:id/tracking/stream')
  @ApiOperation({
    summary: 'SSE Stream truyền luồng vị trí xe và ETA liên tục (Server-Sent Events)',
  })
  streamTracking(@Param('id') tripId: string): Observable<MessageEvent> {
    return this.trackingService.getTrackingStream(tripId);
  }

  @Public()
  @Post('tracking/gps')
  @ApiOperation({
    summary: 'REST fallback tiếp nhận tọa độ GPS từ thiết bị IoT / hộp đen định vị',
  })
  async recordGpsPing(@Body() dto: GpsPingDto) {
    return this.trackingService.recordLocation(dto);
  }

  @Public()
  @Post('driver/update-location')
  @ApiOperation({
    summary: 'REST fallback để tài xế cập nhật vị trí GPS (hỗ trợ cả REST và WS)',
  })
  async updateLocationRest(@Body() dto: UpdateLocationDto) {
    return this.trackingService.recordLocation(dto);
  }

  @Public()
  @Post('tracking/simulator/start')
  @ApiOperation({
    summary: 'Khởi động bộ giả lập GPS di chuyển xe buýt dọc theo lộ trình chuyến',
  })
  async startSimulator(@Body() dto: SimulatorControlDto) {
    return this.trackingService.startSimulator(dto.tripId, dto.speedMultiplier || 1);
  }

  @Public()
  @Post('tracking/simulator/stop')
  @ApiOperation({
    summary: 'Dừng bộ giả lập GPS di chuyển xe buýt của chuyến xe',
  })
  async stopSimulator(@Body() body: { tripId: string }) {
    return this.trackingService.stopSimulator(body.tripId);
  }

  @Public()
  @Get('tracking/simulator/status/:tripId')
  @ApiOperation({
    summary: 'Kiểm tra trạng thái xe buýt mô phỏng theo ID chuyến xe',
  })
  async getSimulatorStatus(@Param('tripId') tripId: string) {
    return this.trackingService.getSimulatorStatus(tripId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DRIVER, Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Post('driver/incidents')
  @ApiOperation({
    summary: 'Tài xế báo cáo sự cố trên đường (ùn tắc, hỏng hóc, tai nạn)',
  })
  async reportIncident(
    @Body() dto: ReportIncidentDto,
    @CurrentUser('id') reportedBy: string,
  ) {
    return this.trackingService.reportIncident(dto, reportedBy);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DRIVER, Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Patch('driver/incidents/:id/resolve')
  @ApiOperation({
    summary: 'Đóng/hủy sự cố khi chuyến xe trở lại bình thường và tự động khôi phục trạng thái chuyến xe về in_progress',
  })
  async resolveIncident(
    @Param('id') incidentId: string,
    @Body() dto: ResolveIncidentDto,
    @CurrentUser('id') resolvedBy: string,
  ) {
    return this.trackingService.resolveIncident(incidentId, resolvedBy, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DRIVER, Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Get(['driver/incidents', 'tracking/incidents', 'admin/incidents'])
  @ApiOperation({
    summary: 'Lấy toàn bộ danh sách sự cố trên toàn hệ thống (Admin, Dispatcher)',
  })
  async getAllIncidents(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    return this.trackingService.getAllIncidents(status, severity);
  }

  @Public()
  @Get('trips/:id/incidents')
  @ApiOperation({
    summary: 'Lấy danh sách các sự cố được báo cáo trên chuyến xe',
  })
  async getTripIncidents(@Param('id') tripId: string) {
    return this.trackingService.getTripIncidents(tripId);
  }
}
