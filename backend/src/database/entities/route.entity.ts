import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { RouteStationEntity } from './route-station.entity.js';

@Entity('routes')
export class RouteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'route_code', type: 'varchar', length: 20, unique: true })
  routeCode: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 200 })
  origin: string;

  @Column({ type: 'varchar', length: 200 })
  destination: string;

  @Column({ name: 'distance_km', type: 'decimal', precision: 10, scale: 2, nullable: true })
  distanceKm: number;

  @Column({ name: 'base_price', type: 'decimal', precision: 12, scale: 0 })
  basePrice: number;

  @Column({ name: 'student_price', type: 'decimal', precision: 12, scale: 0, nullable: true })
  studentPrice: number;

  @Column({ name: 'operating_start', type: 'time', nullable: true })
  operatingStart: string;

  @Column({ name: 'operating_end', type: 'time', nullable: true })
  operatingEnd: string;

  @Column({ name: 'frequency_minutes', type: 'integer', nullable: true })
  frequencyMinutes: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => RouteStationEntity, (rs) => rs.route, { cascade: true })
  routeStations: RouteStationEntity[];
}
