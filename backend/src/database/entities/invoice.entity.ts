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
import { BookingEntity } from './booking.entity.js';
import { PaymentEntity } from './payment.entity.js';
import { UserEntity } from './user.entity.js';

@Entity('invoices')
@Index(['bookingId'])
@Index(['paymentId'])
@Index(['invoiceNumber'], { unique: true })
@Index(['lookupCode'], { unique: true })
export class InvoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50, unique: true })
  invoiceNumber: string;

  @Column({ name: 'lookup_code', type: 'varchar', length: 50, unique: true })
  lookupCode: string;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId: string;

  @ManyToOne(() => PaymentEntity, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment: Relation<PaymentEntity>;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => BookingEntity, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Relation<BookingEntity>;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string;

  @ManyToOne(() => UserEntity, { eager: true, nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'subtotal_amount', type: 'decimal', precision: 12, scale: 0 })
  subtotalAmount: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 0, default: 0 })
  discountAmount: number;

  @Column({ name: 'vat_rate', type: 'decimal', precision: 5, scale: 2, default: 0.08 })
  vatRate: number;

  @Column({ name: 'vat_amount', type: 'decimal', precision: 12, scale: 0, default: 0 })
  vatAmount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 0 })
  totalAmount: number;

  @Column({ name: 'currency', type: 'varchar', length: 10, default: 'VND' })
  currency: string;

  @Column({ name: 'invoice_data', type: 'jsonb', nullable: true })
  invoiceData: Record<string, any>;

  @Column({ name: 'pdf_url', type: 'varchar', length: 300, nullable: true })
  pdfUrl: string;

  @Column({ name: 'issued_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  issuedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
