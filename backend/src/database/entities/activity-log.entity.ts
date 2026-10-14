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

@Entity('activity_logs')
@Index(['userId'])
@Index(['action'])
@Index(['resourceName'])
@Index(['status'])
@Index(['endpoint'])
@Index(['timestamp'])
export class ActivityLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string;

  @ManyToOne(() => UserEntity, { eager: true, nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ name: 'resource_name', type: 'varchar', length: 50 })
  resourceName: string;

  @Column({ name: 'resource_id', type: 'varchar', length: 50, nullable: true })
  resourceId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  endpoint: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  method: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  status: string;

  @Column({ name: 'execution_time_ms', type: 'int', nullable: true })
  executionTimeMs: number;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, any>;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent: string;

  @CreateDateColumn({ name: 'timestamp', type: 'timestamptz' })
  timestamp: Date;
}
