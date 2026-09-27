import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../../common/constants/roles.constant.js';
import { UserStatus } from '../../../common/constants/status.constant.js';

export class CreateUserDto {
  @ApiProperty({ example: 'driver.nam@ictu.edu.vn' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({ example: 'Password@123' })
  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải từ 6 ký tự' })
  password: string;

  @ApiProperty({ example: 'Trần Văn Nam' })
  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  fullName: string;

  @ApiProperty({ example: Role.DRIVER, enum: Role })
  @IsString()
  @IsNotEmpty()
  role: Role;

  @ApiPropertyOptional({ example: '0912345678' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  faculty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idCardNumber?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Trần Văn Nam' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '0912345678' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  faculty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idCardNumber?: string;
}

export class ChangeRoleDto {
  @ApiProperty({ example: Role.MANAGER, enum: Role })
  @IsString()
  @IsNotEmpty()
  role: Role;
}

export class ChangeStatusDto {
  @ApiProperty({ example: UserStatus.LOCKED, enum: UserStatus })
  @IsString()
  @IsNotEmpty()
  status: UserStatus;
}
