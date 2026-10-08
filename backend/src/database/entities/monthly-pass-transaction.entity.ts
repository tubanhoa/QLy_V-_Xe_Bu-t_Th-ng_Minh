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
import type { MonthlyPassEntity } from './monthly-pass.entity.js';
import { UserEntity } from './user.entity.js';
import { PaymentMethod } from '../../common/constants/status.constant.js';

@Entity('monthly_pass_transactions')
@Index(['monthlyPassId'])
@Index(['userId'])
export class MonthlyPassTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'monthly_pass_id', type: 'uuid' })
  monthlyPassId: string;

  @ManyToOne('MonthlyPassEntity', 'transactions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'monthly_pass_id' })
  monthlyPass: Relation<MonthlyPassEntity>;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 20, default: 'register' })
  type: string; // 'register' | 'renew'

  @Column({ name: 'duration_months', type: 'int', default: 1 })
  durationMonths: number;

  @Column({ name: 'previous_end_date', type: 'date', nullable: true })
  previousEndDate: string;

  @Column({ name: 'new_end_date', type: 'date' })
  newEndDate: string;

  @Column({ type: 'decimal', precision: 12, scale: 0 })
  amount: number;

  @Column({ name: 'payment_method', type: 'varchar', length: 20, default: PaymentMethod.VIETQR })
  paymentMethod: PaymentMethod;

  @Column({ name: 'payment_status', type: 'varchar', length: 20, default: 'completed' })
  paymentStatus: string;

  @Column({ name: 'transaction_code', type: 'varchar', length: 50, nullable: true })
  transactionCode: string;

  @Column({ name: 'notes', type: 'varchar', length: 255, nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
