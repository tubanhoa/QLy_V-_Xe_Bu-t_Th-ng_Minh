import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity.js';
import { TripEntity } from './trip.entity.js';
import { VoucherEntity } from './voucher.entity.js';
import { BookingStatus } from '../../common/constants/status.constant.js';
import { TicketEntity } from './ticket.entity.js';
import { PaymentEntity } from './payment.entity.js';

@Entity('bookings')
@Index(['userId'])
@Index(['tripId'])
@Index(['status'])
@Index(['bookingCode'], { unique: true })
export class BookingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_code', type: 'varchar', length: 30, unique: true })
  bookingCode: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  @ManyToOne(() => TripEntity, (trip) => trip.bookings, { eager: true })
  @JoinColumn({ name: 'trip_id' })
  trip: TripEntity;

  @Column({ name: 'voucher_id', type: 'uuid', nullable: true })
  voucherId: string;

  @ManyToOne(() => VoucherEntity, { eager: true, nullable: true })
  @JoinColumn({ name: 'voucher_id' })
  voucher: VoucherEntity;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 0 })
  totalAmount: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 0, default: 0 })
  discountAmount: number;

  @Column({ name: 'final_amount', type: 'decimal', precision: 12, scale: 0 })
  finalAmount: number;

  @Column({ type: 'varchar', length: 20, default: BookingStatus.PENDING })
  status: BookingStatus;

  @CreateDateColumn({ name: 'booking_time', type: 'timestamptz' })
  bookingTime: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date;

  @OneToMany(() => TicketEntity, (ticket) => ticket.booking, { cascade: true })
  tickets: TicketEntity[];

  @OneToMany(() => PaymentEntity, (payment) => payment.booking)
  payments: PaymentEntity[];
}
