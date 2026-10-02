import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceTokenEntity } from '../../database/entities/device-token.entity.js';
import { NotificationEntity } from '../../database/entities/notification.entity.js';
import { NotificationPreferenceEntity } from '../../database/entities/notification-preference.entity.js';
import { NotificationService } from './notification.service.js';
import { FcmService } from './fcm.service.js';
import { NotificationCenterService } from './notification-center.service.js';
import { NotificationController } from './notification.controller.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeviceTokenEntity,
      NotificationEntity,
      NotificationPreferenceEntity,
    ]),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, FcmService, NotificationCenterService],
  exports: [NotificationService, FcmService, NotificationCenterService],
})
export class NotificationModule {}
