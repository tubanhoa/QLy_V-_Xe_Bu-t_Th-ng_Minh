import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { RouteEntity } from './route.entity.js';
import { VehicleEntity } from './vehicle.entity.js';
import { UserEntity } from './user.entity.js';
import { TripStatus } from '../../common/constants/status.constant.js';
import { BookingEntity } from './booking.entity.js';

@Entity('trips')
@Index(['routeId', 'departureTime'])
@Index(['driverId'])
@Index(['status'])
export class TripEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'route_id', type: 'uuid' })
  routeId: string;

  @ManyToOne(() => RouteEntity, { eager: true })
  @JoinColumn({ name: 'route_id' })
  route: RouteEntity;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId: string;

  @ManyToOne(() => VehicleEntity, { eager: true, nullable: true })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: VehicleEntity;

  @Column({ name: 'driver_id', type: 'uuid', nullable: true })
  driverId: string;

  @ManyToOne(() => UserEntity, { eager: true, nullable: true })
  @JoinColumn({ name: 'driver_id' })
  driver: UserEntity;

  @Column({ name: 'conductor_id', type: 'uuid', nullable: true })
  conductorId: string;

  @ManyToOne(() => UserEntity, { eager: true, nullable: true })
  @JoinColumn({ name: 'conductor_id' })
  conductor: UserEntity;

  @Column({ name: 'departure_time', type: 'timestamptz' })
  departureTime: Date;

  @Column({ name: 'arrival_time', type: 'timestamptz', nullable: true })
  arrivalTime: Date;

  @Column({ name: 'actual_departure', type: 'timestamptz', nullable: true })
  actualDeparture: Date;

  @Column({ name: 'actual_arrival', type: 'timestamptz', nullable: true })
  actualArrival: Date;

  @Column({ type: 'varchar', length: 20, default: TripStatus.SCHEDULED })
  status: TripStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => BookingEntity, (booking) => booking.trip)
  bookings: BookingEntity[];
}
