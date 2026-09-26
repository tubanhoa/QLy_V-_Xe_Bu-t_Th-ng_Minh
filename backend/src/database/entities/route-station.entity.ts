import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RouteEntity } from './route.entity.js';
import { StationEntity } from './station.entity.js';

@Entity('route_stations')
@Index(['routeId', 'stationId'], { unique: true })
@Index(['routeId', 'stopOrder'], { unique: true })
export class RouteStationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'route_id', type: 'uuid' })
  routeId: string;

  @ManyToOne(() => RouteEntity, (route) => route.routeStations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route: RouteEntity;

  @Column({ name: 'station_id', type: 'uuid' })
  stationId: string;

  @ManyToOne(() => StationEntity, (station) => station.routeStations, { eager: true })
  @JoinColumn({ name: 'station_id' })
  station: StationEntity;

  @Column({ name: 'stop_order', type: 'integer' })
  stopOrder: number;

  @Column({ name: 'distance_from_origin_km', type: 'decimal', precision: 10, scale: 2, nullable: true })
  distanceFromOriginKm: number;

  @Column({ name: 'estimated_minutes', type: 'integer', nullable: true })
  estimatedMinutes: number;
}
