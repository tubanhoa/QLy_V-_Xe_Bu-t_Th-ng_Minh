import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity.js';
import { TripEntity } from './trip.entity.js';

@Entity('feedback')
@Index(['userId'])
@Index(['tripId'])
@Index(['status'])
@Index(['type'])
@Index(['ratingScore'])
@Index(['createdAt'])
export class FeedbackEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'trip_id', type: 'uuid', nullable: true })
  tripId: string;

  @ManyToOne(() => TripEntity, { eager: true, nullable: true })
  @JoinColumn({ name: 'trip_id' })
  trip: TripEntity;

  @Column({ type: 'varchar', length: 20, default: 'rating' })
  type: 'rating' | 'complaint' | 'suggestion';

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string;

  @Column({ name: 'rating_score', type: 'integer' })
  ratingScore: number;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string;

  @Column({ name: 'ticket_code', type: 'varchar', length: 50, nullable: true })
  ticketCode: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments: string[];

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: 'new' | 'in_review' | 'resolved';

  @Column({ name: 'admin_response', type: 'text', nullable: true })
  adminResponse: string;

  @Column({ name: 'responded_by', type: 'uuid', nullable: true })
  respondedBy: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'responded_by' })
  respondedByUser: UserEntity;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
