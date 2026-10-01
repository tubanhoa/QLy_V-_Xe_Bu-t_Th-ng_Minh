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
import { PaymentEntity } from './payment.entity.js';
import { BookingEntity } from './booking.entity.js';
import { TicketEntity } from './ticket.entity.js';

@Entity('refund_logs')
@Index(['gateway'])
@Index(['status'])
@Index(['paymentId'])
@Index(['bookingId'])
@Index(['ticketId'])
@Index(['createdAt'])
export class RefundLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string;

  @ManyToOne(() => PaymentEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payment_id' })
  payment?: Relation<PaymentEntity>;

  @Column({ name: 'booking_id', type: 'uuid', nullable: true })
  bookingId: string;

  @ManyToOne(() => BookingEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'booking_id' })
  booking?: Relation<BookingEntity>;

  @Column({ name: 'ticket_id', type: 'uuid', nullable: true })
  ticketId: string;

  @ManyToOne(() => TicketEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ticket_id' })
  ticket?: Relation<TicketEntity>;

  @Column({ name: 'gateway', type: 'varchar', length: 50 })
  gateway: string; // 'vnpay' | 'momo' | 'zalopay' | 'bank_transfer'

  @Column({ name: 'refund_transaction_id', type: 'varchar', length: 150, nullable: true })
  refundTransactionId: string; // Mã giao dịch hoàn trả từ Gateway

  @Column({ name: 'original_amount', type: 'decimal', precision: 12, scale: 0 })
  originalAmount: number;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 12, scale: 0 })
  refundAmount: number;

  @Column({ name: 'fee_amount', type: 'decimal', precision: 12, scale: 0, default: 0 })
  feeAmount: number;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'SUCCESS' })
  status: 'PENDING' | 'SUCCESS' | 'FAILED'; // Trạng thái đối soát

  @Column({ name: 'raw_request', type: 'jsonb', nullable: true })
  rawRequest: any;

  @Column({ name: 'raw_response', type: 'jsonb', nullable: true })
  rawResponse: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
