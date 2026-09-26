import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BookingEntity } from './booking.entity.js';
import { PaymentMethod, PaymentStatus } from '../../common/constants/status.constant.js';

@Entity('payments')
@Index(['bookingId'])
@Index(['status'])
@Index(['transactionId'], { unique: true })
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => BookingEntity, (booking) => booking.payments)
  @JoinColumn({ name: 'booking_id' })
  booking: BookingEntity;

  @Column({ name: 'payment_method', type: 'varchar', length: 20 })
  paymentMethod: PaymentMethod;

  @Column({ name: 'transaction_id', type: 'varchar', length: 100, unique: true, nullable: true })
  transactionId: string;

  @Column({ type: 'decimal', precision: 12, scale: 0 })
  amount: number;

  @Column({ type: 'varchar', length: 20, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ name: 'payment_time', type: 'timestamptz', nullable: true })
  paymentTime: Date;

  @Column({ name: 'refund_time', type: 'timestamptz', nullable: true })
  refundTime: Date;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 12, scale: 0, nullable: true })
  refundAmount: number;

  @Column({ name: 'refund_reason', type: 'varchar', length: 300, nullable: true })
  refundReason: string;

  @Column({ name: 'payment_details', type: 'jsonb', nullable: true })
  paymentDetails: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
