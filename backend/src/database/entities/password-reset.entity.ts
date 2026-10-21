import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  type Relation,
} from 'typeorm';
import { UserEntity } from './user.entity.js';

@Entity('password_resets')
export class PasswordResetEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<UserEntity>;

  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Column({ name: 'student_id', type: 'varchar', length: 50, nullable: true })
  studentId: string | null;

  @Column({ name: 'otp_hash', type: 'varchar', length: 255 })
  otpHash: string;

  @Column({ name: 'reset_token', type: 'varchar', length: 255, nullable: true })
  resetToken: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'is_used', type: 'boolean', default: false })
  isUsed: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
