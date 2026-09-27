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
import { UserEntity } from './user.entity.js';
import { IncidentType, IncidentSeverity } from '../../common/constants/status.constant.js';

@Entity('trip_incidents')
@Index(['tripId'])
@Index(['resolutionStatus'])
export class TripIncidentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  @ManyToOne(() => TripEntity)
  @JoinColumn({ name: 'trip_id' })
  trip: TripEntity;

  @Column({ name: 'reported_by', type: 'uuid' })
  reportedBy: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'reported_by' })
  reportedByUser: UserEntity;

  @Column({ name: 'incident_type', type: 'varchar', length: 30 })
  incidentType: IncidentType;

  @Column({ type: 'varchar', length: 20, default: IncidentSeverity.MEDIUM })
  severity: IncidentSeverity;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'delay_minutes_estimate', type: 'integer', nullable: true })
  delayMinutesEstimate: number;

  @Column({ name: 'resolution_status', type: 'varchar', length: 20, default: 'pending' })
  resolutionStatus: 'pending' | 'acknowledged' | 'resolved';

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'resolved_by' })
  resolvedByUser: UserEntity;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn({ name: 'reported_at', type: 'timestamptz' })
  reportedAt: Date;
}
