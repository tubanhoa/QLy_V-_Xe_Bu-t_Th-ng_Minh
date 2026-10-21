import { IsNotEmpty, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'DTC2151800001',
    description: 'Mã sinh viên ICTU (DTC...) hoặc địa chỉ Email sinh viên (@ictu.edu.vn)',
  })
  @IsString({ message: 'Tài khoản định danh phải là chuỗi' })
  @IsNotEmpty({ message: 'Vui lòng nhập Mã sinh viên hoặc Email ICTU của bạn' })
  identifier: string;
}

export class VerifyResetOtpDto {
  @ApiProperty({
    example: 'dtc2151800001@ictu.edu.vn',
    description: 'Mã sinh viên hoặc Email sinh viên',
  })
  @IsString({ message: 'Tài khoản định danh phải là chuỗi' })
  @IsNotEmpty({ message: 'Tài khoản định danh không được để trống' })
  identifier: string;

  @ApiProperty({
    example: '123456',
    description: 'Mã xác thực OTP gồm 6 chữ số gửi qua email',
  })
  @IsString({ message: 'Mã OTP phải là chuỗi' })
  @IsNotEmpty({ message: 'Mã OTP không được để trống' })
  @Matches(/^\d{6}$/, { message: 'Mã OTP phải gồm chính xác 6 chữ số' })
  otp: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'dtc2151800001@ictu.edu.vn',
    description: 'Mã sinh viên hoặc Email sinh viên',
  })
  @IsString({ message: 'Tài khoản định danh phải là chuỗi' })
  @IsNotEmpty({ message: 'Tài khoản định danh không được để trống' })
  identifier: string;

  @ApiProperty({
    example: 'rst_abc123...',
    description: 'Mã Token xác thực đặt lại mật khẩu nhận được sau khi nhập OTP đúng',
  })
  @IsString({ message: 'Reset token phải là chuỗi' })
  @IsNotEmpty({ message: 'Reset token không được để trống' })
  resetToken: string;

  @ApiProperty({
    example: 'Password@123',
    description: 'Mật khẩu mới (ít nhất 6 ký tự, gồm chữ hoa, số và ký tự đặc biệt)',
  })
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu không được vượt quá 72 ký tự' })
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/, {
    message: 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ số và 1 ký tự đặc biệt (!@#$%^&*)',
  })
  newPassword: string;
}
