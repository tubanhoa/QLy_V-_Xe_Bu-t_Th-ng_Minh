import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { RouteEntity } from '../../database/entities/route.entity.js';
import { VehicleEntity } from '../../database/entities/vehicle.entity.js';
import { SeatEntity } from '../../database/entities/seat.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { SeatHoldEntity } from '../../database/entities/seat-hold.entity.js';
import { MonthlyPassEntity } from '../../database/entities/monthly-pass.entity.js';
import { TripsController } from './trips.controller.js';
import { TripsService } from './trips.service.js';
import { BookingModule } from '../booking/booking.module.js';
import { NotificationModule } from '../notification/notification.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TripEntity,
      RouteEntity,
      VehicleEntity,
      SeatEntity,
      TicketEntity,
      UserEntity,
      SeatHoldEntity,
      MonthlyPassEntity,
    ]),
    forwardRef(() => BookingModule),
    NotificationModule,
  ],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}

