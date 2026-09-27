import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  type Relation,
} from 'typeorm';
import { PaymentEntity } from './payment.entity.js';

@Entity('payment_logs')
@Index(['paymentId'])
@Index(['bookingId'])
@Index(['gateway'])
@Index(['eventType'])
@Index(['createdAt'])
export class PaymentLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string;

  @ManyToOne(() => PaymentEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'payment_id' })
  payment?: Relation<PaymentEntity>;

  @Column({ name: 'booking_id', type: 'uuid', nullable: true })
  bookingId: string;

  @Column({ name: 'booking_code', type: 'varchar', length: 50, nullable: true })
  bookingCode: string;

  @Column({ type: 'varchar', length: 30 })
  gateway: string;

  @Column({ name: 'event_type', type: 'varchar', length: 50 })
  eventType: string;

  @Column({ name: 'request_data', type: 'jsonb', nullable: true })
  requestData: Record<string, any>;

  @Column({ name: 'response_data', type: 'jsonb', nullable: true })
  responseData: Record<string, any>;

  @Column({ type: 'varchar', length: 30, default: 'success' })
  status: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 50, nullable: true })
  ipAddress: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
