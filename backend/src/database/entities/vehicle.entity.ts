import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { SeatEntity } from './seat.entity.js';
import { VehicleStatus } from '../../common/constants/status.constant.js';

@Entity('vehicles')
export class VehicleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'license_plate', type: 'varchar', length: 15, unique: true })
  licensePlate: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string;

  @Column({ name: 'vehicle_type', type: 'varchar', length: 20, default: 'electric' })
  vehicleType: string;

  @Column({ name: 'seat_capacity', type: 'integer', default: 28 })
  seatCapacity: number;

  @Column({ name: 'manufacture_year', type: 'integer', nullable: true })
  manufactureYear: number;

  @Column({ name: 'battery_capacity_kwh', type: 'decimal', precision: 5, scale: 1, nullable: true })
  batteryCapacityKwh: number;

  @Column({ type: 'varchar', length: 20, default: VehicleStatus.ACTIVE })
  status: VehicleStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => SeatEntity, (seat) => seat.vehicle, { cascade: true })
  seats: SeatEntity[];
}
