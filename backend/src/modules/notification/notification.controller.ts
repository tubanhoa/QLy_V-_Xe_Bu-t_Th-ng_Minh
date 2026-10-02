import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { FcmService } from './fcm.service.js';
import { NotificationCenterService } from './notification-center.service.js';
import {
  RegisterDeviceTokenDto,
  NotificationQueryDto,
  UpdateNotificationPreferencesDto,
} from './dto/notification.dto.js';

@ApiTags('Notifications & Geofence Push')
@Controller({
  path: ['notifications', 'notification'],
  version: ['1', VERSION_NEUTRAL],
})
export class NotificationController {
  constructor(
    private readonly fcmService: FcmService,
    private readonly notificationCenterService: NotificationCenterService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post('device-token')
  @ApiOperation({ summary: 'Đăng ký hoặc cập nhật FCM Device Token của người dùng' })
  @ApiResponse({ status: 200, description: 'Đăng ký token thiết bị thành công' })
  async registerDeviceToken(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    await this.fcmService.registerToken(userId, dto.token, dto.platform, dto.deviceModel);
    return {
      success: true,
      message: 'Đăng ký FCM Device Token thành công',
      token: dto.token,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Delete('device-token/:token')
  @ApiOperation({ summary: 'Hủy đăng ký FCM Device Token khi đăng xuất khỏi thiết bị' })
  @ApiResponse({ status: 200, description: 'Hủy token thành công' })
  async unregisterDeviceToken(
    @CurrentUser('id') userId: string,
    @Param('token') token: string,
  ) {
    await this.fcmService.invalidateDeadToken(userId, token);
    return {
      success: true,
      message: 'Hủy đăng ký FCM Device Token thành công',
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách lịch sử thông báo của người dùng (phân trang)' })
  async getNotifications(
    @CurrentUser('id') userId: string,
    @Query() query: NotificationQueryDto,
  ) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    const unreadOnly = String(query.unreadOnly) === 'true';

    return this.notificationCenterService.getUserNotifications(
      userId,
      page,
      limit,
      unreadOnly,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get('unread-count')
  @ApiOperation({ summary: 'Đếm số lượng thông báo chưa đọc' })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    const unreadCount = await this.notificationCenterService.getUnreadCount(userId);
    return {
      unreadCount,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu 1 thông báo là đã đọc' })
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') notificationId: string,
  ) {
    const success = await this.notificationCenterService.markAsRead(notificationId, userId);
    return {
      success,
      message: success ? 'Đánh dấu đã đọc thành công' : 'Không tìm thấy thông báo',
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Patch('read-all')
  @ApiOperation({ summary: 'Đánh dấu toàn bộ thông báo của người dùng là đã đọc' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    const updatedCount = await this.notificationCenterService.markAllAsRead(userId);
    return {
      success: true,
      updatedCount,
      message: `Đã đánh dấu ${updatedCount} thông báo là đã đọc`,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get('preferences')
  @ApiOperation({ summary: 'Lấy cài đặt thông báo của người dùng' })
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.notificationCenterService.getPreferences(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Put('preferences')
  @ApiOperation({ summary: 'Cập nhật cài đặt nhận thông báo (Push/SMS/Email)' })
  async updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationCenterService.setPreferences({
      userId,
      pushEnabled: dto.pushEnabled,
      smsEnabled: dto.smsEnabled,
      emailEnabled: dto.emailEnabled,
    });
  }
}
