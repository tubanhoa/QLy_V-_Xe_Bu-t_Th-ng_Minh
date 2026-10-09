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

export enum PriorityCategory {
  STUDENT = 'student',
  ELDERLY = 'elderly',
  REGULAR = 'regular',
}

export enum VerificationStatus {
  UNVERIFIED = 'unverified',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

@Entity('priority_verifications')
export class PriorityVerificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<UserEntity>;

  @Column({
    type: 'varchar',
    length: 20,
    default: PriorityCategory.STUDENT,
  })
  category: PriorityCategory;

  @Column({ name: 'student_id', type: 'varchar', length: 50, nullable: true })
  studentId: string | null;

  @Column({ name: 'school_name', type: 'varchar', length: 150, nullable: true })
  schoolName: string | null;

  @Column({ name: 'id_card_number', type: 'varchar', length: 20, nullable: true })
  idCardNumber: string | null;

  @Column({ name: 'front_image_url', type: 'text' })
  frontImageUrl: string;

  @Column({ name: 'back_image_url', type: 'text', nullable: true })
  backImageUrl: string | null;

  @Column({ name: 'portrait_image_url', type: 'text', nullable: true })
  portraitImageUrl: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: VerificationStatus.PENDING,
  })
  status: VerificationStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedByUser: Relation<UserEntity> | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
