import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TripEntity } from './trip.entity.js';

@Entity('vehicle_tracking')
@Index(['tripId'])
@Index(['lastUpdated'])
export class VehicleTrackingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  @ManyToOne(() => TripEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id' })
  trip: TripEntity;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column({ name: 'speed_kmh', type: 'decimal', precision: 5, scale: 1, nullable: true })
  speedKmh: number;

  @Column({ name: 'heading_degrees', type: 'decimal', precision: 5, scale: 1, nullable: true })
  headingDegrees: number;

  @Column({ name: 'battery_percent', type: 'decimal', precision: 4, scale: 1, nullable: true })
  batteryPercent: number;

  @UpdateDateColumn({ name: 'last_updated', type: 'timestamptz' })
  lastUpdated: Date;
}
