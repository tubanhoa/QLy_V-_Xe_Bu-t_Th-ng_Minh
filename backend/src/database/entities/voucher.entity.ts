import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('vouchers')
export class VoucherEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({ name: 'discount_type', type: 'varchar', length: 20 })
  discountType: 'percentage' | 'fixed_amount';

  @Column({ name: 'discount_value', type: 'decimal', precision: 12, scale: 2 })
  discountValue: number;

  @Column({ name: 'min_order_value', type: 'decimal', precision: 12, scale: 0, default: 0 })
  minOrderValue: number;

  @Column({ name: 'max_discount_amount', type: 'decimal', precision: 12, scale: 0, nullable: true })
  maxDiscountAmount: number;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ name: 'usage_limit', type: 'integer', default: 0 })
  usageLimit: number;

  @Column({ name: 'used_count', type: 'integer', default: 0 })
  usedCount: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
