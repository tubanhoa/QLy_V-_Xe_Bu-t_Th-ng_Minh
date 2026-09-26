import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleTrackingEntity } from '../../database/entities/vehicle-tracking.entity.js';
import { TripIncidentEntity } from '../../database/entities/trip-incident.entity.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { RouteStationEntity } from '../../database/entities/route-station.entity.js';
import { TrackingController } from './tracking.controller.js';
import { TrackingService } from './tracking.service.js';
import { TrackingGateway } from './tracking.gateway.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VehicleTrackingEntity,
      TripIncidentEntity,
      TripEntity,
      RouteStationEntity,
    ]),
  ],
  controllers: [TrackingController],
  providers: [TrackingService, TrackingGateway],
  exports: [TrackingService, TrackingGateway],
})
export class TrackingModule {}
