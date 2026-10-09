import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PriorityCategory } from '../../../database/entities/priority-verification.entity.js';

export class CreatePriorityVerificationDto {
  @ApiProperty({
    enum: PriorityCategory,
    example: PriorityCategory.STUDENT,
    description: 'Đối tượng ưu đãi: student (Sinh viên) hoặc elderly (Người cao tuổi)',
  })
  @IsEnum(PriorityCategory)
  category: PriorityCategory;

  @ApiPropertyOptional({ example: 'DTC215180001', description: 'Mã số sinh viên (nếu là HSSV)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  studentId?: string;

  @ApiPropertyOptional({ example: 'Trường Đại học Công nghệ Thông tin & Truyền thông (ICTU)' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  schoolName?: string;

  @ApiPropertyOptional({ example: '019203004567', description: 'Số CCCD / CMND' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  idCardNumber?: string;

  @ApiProperty({
    example: '/uploads/verifications/proof_front_123.jpg',
    description: 'URL ảnh mặt trước thẻ SV hoặc CCCD',
  })
  @IsNotEmpty({ message: 'Ảnh mặt trước minh chứng không được để trống' })
  @IsString()
  frontImageUrl: string;

  @ApiPropertyOptional({ example: '/uploads/verifications/proof_back_123.jpg' })
  @IsOptional()
  @IsString()
  backImageUrl?: string;

  @ApiPropertyOptional({ example: '/uploads/verifications/portrait_123.jpg' })
  @IsOptional()
  @IsString()
  portraitImageUrl?: string;
}
