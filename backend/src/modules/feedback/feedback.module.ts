import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackEntity } from '../../database/entities/feedback.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { FeedbackController } from './feedback.controller.js';
import { FeedbackService } from './feedback.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([FeedbackEntity, UserEntity, TripEntity])],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}

