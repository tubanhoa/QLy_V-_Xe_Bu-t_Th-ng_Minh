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
import { SeatEntity } from './seat.entity.js';
import { UserEntity } from './user.entity.js';
import { TicketStatus } from '../../common/constants/status.constant.js';

@Entity('tickets')
@Index(['bookingId'])
@Index(['ticketCode'], { unique: true })
@Index(['status'])
export class TicketEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => BookingEntity, (booking) => booking.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: BookingEntity;

  @Column({ name: 'seat_id', type: 'uuid' })
  seatId: string;

  @ManyToOne(() => SeatEntity, { eager: true })
  @JoinColumn({ name: 'seat_id' })
  seat: SeatEntity;

  @Column({ name: 'ticket_code', type: 'varchar', length: 30, unique: true })
  ticketCode: string;

  @Column({ name: 'qr_data', type: 'text', nullable: true })
  qrData: string;

  @Column({ name: 'qr_signature_hash', type: 'varchar', length: 128, nullable: true })
  qrSignatureHash: string;

  @Column({ name: 'passenger_name', type: 'varchar', length: 100 })
  passengerName: string;

  @Column({ name: 'passenger_phone', type: 'varchar', length: 15, nullable: true })
  passengerPhone: string;

  @Column({ name: 'original_price', type: 'decimal', precision: 12, scale: 0 })
  originalPrice: number;

  @Column({ name: 'discount_price', type: 'decimal', precision: 12, scale: 0, nullable: true })
  discountPrice: number;

  @Column({ type: 'varchar', length: 20, default: TicketStatus.RESERVED })
  status: TicketStatus;

  @Column({ name: 'checked_in_at', type: 'timestamptz', nullable: true })
  checkedInAt: Date;

  @Column({ name: 'checked_in_by', type: 'uuid', nullable: true })
  checkedInBy: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'checked_in_by' })
  checkedInByUser: UserEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
