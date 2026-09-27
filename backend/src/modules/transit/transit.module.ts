import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouteEntity } from '../../database/entities/route.entity.js';
import { StationEntity } from '../../database/entities/station.entity.js';
import { RouteStationEntity } from '../../database/entities/route-station.entity.js';
import { VehicleEntity } from '../../database/entities/vehicle.entity.js';
import { SeatEntity } from '../../database/entities/seat.entity.js';
import { RoutesService } from './routes.service.js';
import { RoutesController } from './routes.controller.js';
import { StationsService } from './stations.service.js';
import { StationsController } from './stations.controller.js';
import { VehiclesService } from './vehicles.service.js';
import { VehiclesController } from './vehicles.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RouteEntity,
      StationEntity,
      RouteStationEntity,
      VehicleEntity,
      SeatEntity,
    ]),
  ],
  controllers: [RoutesController, StationsController, VehiclesController],
  providers: [RoutesService, StationsService, VehiclesService],
  exports: [RoutesService, StationsService, VehiclesService],
})
export class TransitModule {}
