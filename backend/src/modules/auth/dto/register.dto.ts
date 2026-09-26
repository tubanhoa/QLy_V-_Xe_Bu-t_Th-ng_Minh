import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'nguyen.van.a@ictu.edu.vn', description: 'Email đăng ký' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  @MaxLength(150, { message: 'Email không được vượt quá 150 ký tự' })
  email: string;

  @ApiProperty({ example: 'Password@123', description: 'Mật khẩu (ít nhất 6 ký tự, phải có chữ hoa, số và ký tự đặc biệt)' })
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu không được vượt quá 72 ký tự' })
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/, {
    message: 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ số và 1 ký tự đặc biệt (!@#$%^&*)',
  })
  password: string;

  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Họ và tên' })
  @IsString({ message: 'Họ tên phải là chuỗi' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @MaxLength(100, { message: 'Họ tên không được vượt quá 100 ký tự' })
  fullName: string;

  @ApiPropertyOptional({ example: '0987654321', description: 'Số điện thoại VN (10 chữ số, bắt đầu bằng 03/05/07/08/09)' })
  @IsOptional()
  @IsString()
  @MaxLength(15, { message: 'Số điện thoại không được vượt quá 15 ký tự' })
  @Matches(/^(0[3|5|7|8|9])+([0-9]{8})$/, {
    message: 'Số điện thoại không hợp lệ (VD: 0987654321)',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'DTC215180001', description: 'Mã sinh viên ICTU' })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Mã sinh viên không được vượt quá 50 ký tự' })
  studentId?: string;

  @ApiPropertyOptional({ example: 'Công Nghệ Thông Tin', description: 'Khoa/Viện' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Tên khoa/viện không được vượt quá 100 ký tự' })
  faculty?: string;

  @ApiPropertyOptional({ example: '012345678901', description: 'CCCD/CMND (9-12 chữ số)' })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Số CCCD/CMND không được vượt quá 20 ký tự' })
  @Matches(/^[0-9]{9,12}$/, {
    message: 'Số CCCD/CMND phải là 9-12 chữ số',
  })
  idCardNumber?: string;
}
