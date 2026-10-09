import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriorityVerificationEntity } from '../../database/entities/priority-verification.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { NotificationModule } from '../notification/notification.module.js';
import { PriorityVerificationService } from './priority-verification.service.js';
import { PriorityVerificationController } from './priority-verification.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PriorityVerificationEntity, UserEntity]),
    NotificationModule,
  ],
  controllers: [PriorityVerificationController],
  providers: [PriorityVerificationService],
  exports: [PriorityVerificationService],
})
export class PriorityVerificationModule {}
