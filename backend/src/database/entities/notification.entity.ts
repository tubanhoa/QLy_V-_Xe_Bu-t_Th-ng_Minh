import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  type Relation,
} from 'typeorm';
import { UserEntity } from './user.entity.js';
import { TripEntity } from './trip.entity.js';
import { StationEntity } from './station.entity.js';

export type NotificationType =
  | 'STATION_APPROACHING_PICKUP'
  | 'STATION_APPROACHING_DROPOFF'
  | 'TRIP_DELAY'
  | 'TRIP_CANCELLED'
  | 'PROMOTION'
  | 'SYSTEM'
  | 'BUS_APPROACHING'
  | 'TICKET_BOOKED';

export type NotificationDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED';

@Entity('notifications')
@Index(['userId'])
@Index(['type'])
@Index(['isRead'])
@Index(['createdAt'])
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<UserEntity>;

  @Column({ name: 'trip_id', type: 'uuid', nullable: true })
  tripId?: string;

  @ManyToOne(() => TripEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'trip_id' })
  trip?: Relation<TripEntity>;

  @Column({ name: 'station_id', type: 'uuid', nullable: true })
  stationId?: string;

  @ManyToOne(() => StationEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'station_id' })
  station?: Relation<StationEntity>;

  @Column({ type: 'varchar', length: 50 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, any>;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date;

  @Column({ name: 'delivery_status', type: 'varchar', length: 20, default: 'PENDING' })
  deliveryStatus: NotificationDeliveryStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
