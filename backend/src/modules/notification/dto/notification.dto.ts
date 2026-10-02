import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsUUID, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DevicePlatformEnum {
  WEB = 'WEB',
  ANDROID = 'ANDROID',
  IOS = 'IOS',
}

export class RegisterDeviceTokenDto {
  @ApiProperty({ description: 'FCM Device Registration Token' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiPropertyOptional({ enum: DevicePlatformEnum, default: DevicePlatformEnum.WEB })
  @IsOptional()
  @IsEnum(DevicePlatformEnum)
  platform?: DevicePlatformEnum;

  @ApiPropertyOptional({ description: 'Tên dòng máy / model thiết bị' })
  @IsOptional()
  @IsString()
  deviceModel?: string;
}

export class NotificationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Lọc thông báo chưa đọc (true) hoặc tất cả' })
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;
}

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({ description: 'Bật/tắt thông báo đẩy Push FCM' })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Bật/tắt thông báo SMS' })
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Bật/tắt thông báo Email' })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;
}
