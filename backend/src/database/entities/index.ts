export * from './role.entity.js';
export * from './user.entity.js';
export * from './route.entity.js';
export * from './station.entity.js';
export * from './route-station.entity.js';
export * from './vehicle.entity.js';
export * from './seat.entity.js';
export * from './trip.entity.js';
export * from './booking.entity.js';
export * from './ticket.entity.js';
export * from './payment.entity.js';
export * from './monthly-pass.entity.js';
export * from './voucher.entity.js';
export * from './vehicle-tracking.entity.js';
export * from './trip-incident.entity.js';
export * from './feedback.entity.js';
export * from './activity-log.entity.js';

import { RoleEntity } from './role.entity.js';
import { UserEntity } from './user.entity.js';
import { RouteEntity } from './route.entity.js';
import { StationEntity } from './station.entity.js';
import { RouteStationEntity } from './route-station.entity.js';
import { VehicleEntity } from './vehicle.entity.js';
import { SeatEntity } from './seat.entity.js';
import { TripEntity } from './trip.entity.js';
import { BookingEntity } from './booking.entity.js';
import { TicketEntity } from './ticket.entity.js';
import { PaymentEntity } from './payment.entity.js';
import { MonthlyPassEntity } from './monthly-pass.entity.js';
import { VoucherEntity } from './voucher.entity.js';
import { VehicleTrackingEntity } from './vehicle-tracking.entity.js';
import { TripIncidentEntity } from './trip-incident.entity.js';
import { FeedbackEntity } from './feedback.entity.js';
import { ActivityLogEntity } from './activity-log.entity.js';

export const ALL_ENTITIES = [
  RoleEntity,
  UserEntity,
  RouteEntity,
  StationEntity,
  RouteStationEntity,
  VehicleEntity,
  SeatEntity,
  TripEntity,
  BookingEntity,
  TicketEntity,
  PaymentEntity,
  MonthlyPassEntity,
  VoucherEntity,
  VehicleTrackingEntity,
  TripIncidentEntity,
  FeedbackEntity,
  ActivityLogEntity,
];
