import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TripEntity } from './trip.entity.js';
import { SeatEntity } from './seat.entity.js';
import { UserEntity } from './user.entity.js';

export type SeatHoldStatus = 'holding' | 'released' | 'expired' | 'booked';

@Entity('seat_holds')
@Index(['tripId'])
@Index(['seatId'])
@Index(['userId'])
@Index(['status'])
@Index(['expiresAt'])
export class SeatHoldEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  @ManyToOne(() => TripEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'trip_id' })
  trip?: TripEntity;

  @Column({ name: 'seat_id', type: 'uuid' })
  seatId: string;

  @ManyToOne(() => SeatEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'seat_id' })
  seat?: SeatEntity;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @Column({ name: 'hold_token', type: 'varchar', length: 64 })
  holdToken: string;

  @Column({ type: 'varchar', length: 20, default: 'holding' })
  status: SeatHoldStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
