import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn A', description: 'Họ và tên' })
  @IsOptional()
  @IsString({ message: 'Họ tên phải là chuỗi' })
  fullName?: string;

  @ApiPropertyOptional({ example: '0987654321', description: 'Số điện thoại liên hệ' })
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'https://avatar.iran.liara.run/public/boy', description: 'Ảnh đại diện' })
  @IsOptional()
  @IsString({ message: 'URL ảnh đại diện phải là chuỗi' })
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'DTC2151800001', description: 'Mã sinh viên ICTU (nếu có)' })
  @IsOptional()
  @IsString({ message: 'Mã sinh viên phải là chuỗi' })
  studentId?: string;

  @ApiPropertyOptional({ example: 'Công nghệ thông tin', description: 'Khoa / Viện đào tạo' })
  @IsOptional()
  @IsString({ message: 'Khoa phải là chuỗi' })
  faculty?: string;

  @ApiPropertyOptional({ example: '012345678901', description: 'Số CMND / CCCD' })
  @IsOptional()
  @IsString({ message: 'Số CCCD phải là chuỗi' })
  idCardNumber?: string;
}
