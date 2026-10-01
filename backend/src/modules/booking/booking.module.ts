import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingEntity } from '../../database/entities/booking.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { SeatEntity } from '../../database/entities/seat.entity.js';
import { VoucherEntity } from '../../database/entities/voucher.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { SeatHoldEntity } from '../../database/entities/seat-hold.entity.js';
import { PaymentEntity } from '../../database/entities/payment.entity.js';
import { BookingController } from './booking.controller.js';
import { BookingService } from './booking.service.js';
import { SeatLockService } from './seat-lock.service.js';
import { NotificationModule } from '../notification/notification.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BookingEntity,
      TicketEntity,
      TripEntity,
      SeatEntity,
      VoucherEntity,
      UserEntity,
      SeatHoldEntity,
      PaymentEntity,
    ]),
    NotificationModule,
  ],
  controllers: [BookingController],
  providers: [BookingService, SeatLockService],
  exports: [BookingService, SeatLockService],
})
export class BookingModule {}
