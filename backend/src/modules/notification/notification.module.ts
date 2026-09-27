import { Module, Global } from '@nestjs/common';
import { NotificationService } from './notification.service.js';

@Global()
@Module({
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
