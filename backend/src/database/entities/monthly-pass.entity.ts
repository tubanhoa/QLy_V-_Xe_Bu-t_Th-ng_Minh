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
import { RouteEntity } from './route.entity.js';
import { MonthlyPassCategory, ApprovalStatus } from '../../common/constants/status.constant.js';

@Entity('monthly_passes')
@Index(['userId'])
@Index(['approvalStatus'])
@Index(['passCode'], { unique: true })
export class MonthlyPassEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'route_id', type: 'uuid' })
  routeId: string;

  @ManyToOne(() => RouteEntity, { eager: true })
  @JoinColumn({ name: 'route_id' })
  route: RouteEntity;

  @Column({ name: 'pass_code', type: 'varchar', length: 30, unique: true })
  passCode: string;

  @Column({ type: 'varchar', length: 30 })
  category: MonthlyPassCategory;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ name: 'proof_image_url', type: 'varchar', length: 500, nullable: true })
  proofImageUrl: string;

  @Column({ name: 'approval_status', type: 'varchar', length: 20, default: ApprovalStatus.PENDING })
  approvalStatus: ApprovalStatus;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedByUser: UserEntity;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 300, nullable: true })
  rejectionReason: string;

  @Column({ type: 'decimal', precision: 12, scale: 0, nullable: true })
  price: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
