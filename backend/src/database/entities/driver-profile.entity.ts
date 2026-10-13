import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  type Relation,
} from 'typeorm';
import { UserEntity } from './user.entity.js';

export enum DriverLicenseStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum DriverLicenseClass {
  CLASS_D = 'D',
  CLASS_E = 'E',
  CLASS_FD = 'FD',
  CLASS_FE = 'FE',
}

@Entity({ name: 'driver_profiles' })
export class DriverProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<UserEntity>;

  @Column({ name: 'license_number', type: 'varchar', length: 50 })
  licenseNumber: string;

  @Column({ name: 'license_class', type: 'varchar', length: 10, default: DriverLicenseClass.CLASS_D })
  licenseClass: string;

  @Column({ name: 'issue_date', type: 'date', nullable: true })
  issueDate: string | null;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string | null;

  @Column({ name: 'front_image_url', type: 'varchar', length: 500 })
  frontImageUrl: string;

  @Column({ name: 'back_image_url', type: 'varchar', length: 500, nullable: true })
  backImageUrl: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: DriverLicenseStatus.PENDING,
  })
  status: DriverLicenseStatus;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 300, nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedByUser: Relation<UserEntity> | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
