import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { VehicleEntity } from './vehicle.entity.js';
import { SeatType } from '../../common/constants/status.constant.js';

@Entity('seats')
@Index(['vehicleId', 'seatNumber'], { unique: true })
export class SeatEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId: string;

  @ManyToOne(() => VehicleEntity, (vehicle) => vehicle.seats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: VehicleEntity;

  @Column({ name: 'seat_number', type: 'varchar', length: 5 })
  seatNumber: string;

  @Column({ name: 'row_number', type: 'integer' })
  rowNumber: number;

  @Column({ name: 'column_label', type: 'varchar', length: 1 })
  columnLabel: string;

  @Column({ name: 'seat_type', type: 'varchar', length: 20, default: SeatType.STANDARD })
  seatType: SeatType;

  @Column({ name: 'floor_number', type: 'integer', default: 1 })
  floorNumber: number;
}
