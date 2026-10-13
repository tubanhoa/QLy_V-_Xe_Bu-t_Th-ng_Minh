import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsIn, IsDateString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { DriverLicenseStatus, DriverLicenseClass } from '../../../database/entities/driver-profile.entity.js';

export class CreateDriverProfileDto {
  @ApiProperty({ example: '0e4170aa-68fb-4e6c-95c1-5988f3037ab1', description: 'ID tài khoản tài xế' })
  @IsNotEmpty({ message: 'ID tài xế không được để trống' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 'GPLX-20-D-199887', description: 'Số Giấy phép lái xe' })
  @IsNotEmpty({ message: 'Số GPLX không được để trống' })
  @IsString()
  licenseNumber: string;

  @ApiProperty({ example: 'D', enum: DriverLicenseClass, description: 'Hạng bằng lái xe (D, E, FD, FE)' })
  @IsNotEmpty({ message: 'Hạng bằng lái xe không được để trống' })
  @IsIn([DriverLicenseClass.CLASS_D, DriverLicenseClass.CLASS_E, DriverLicenseClass.CLASS_FD, DriverLicenseClass.CLASS_FE], {
    message: 'Hạng bằng lái xe phải là D, E, FD hoặc FE để đủ điều kiện lái xe buýt',
  })
  licenseClass: string;

  @ApiPropertyOptional({ example: '2023-01-15', description: 'Ngày cấp bằng (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày cấp bằng phải đúng định dạng YYYY-MM-DD' })
  issueDate?: string;

  @ApiPropertyOptional({ example: '2028-01-15', description: 'Ngày hết hạn bằng (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày hết hạn phải đúng định dạng YYYY-MM-DD' })
  expiryDate?: string;

  @ApiProperty({ example: 'https://storage.ictu.edu.vn/drivers/gplx_front.jpg', description: 'Ảnh mặt trước GPLX' })
  @IsNotEmpty({ message: 'Ảnh mặt trước GPLX không được để trống' })
  @IsString()
  frontImageUrl: string;

  @ApiPropertyOptional({ example: 'https://storage.ictu.edu.vn/drivers/gplx_back.jpg', description: 'Ảnh mặt sau GPLX' })
  @IsOptional()
  @IsString()
  backImageUrl?: string;
  @ApiPropertyOptional({ example: 'approved', enum: DriverLicenseStatus, description: 'Trạng thái ban đầu' })
  @IsOptional()
  @IsIn([DriverLicenseStatus.PENDING, DriverLicenseStatus.APPROVED, DriverLicenseStatus.REJECTED])
  status?: DriverLicenseStatus;
}

export class UpdateDriverProfileDto {
  @ApiPropertyOptional({ example: 'GPLX-20-D-199887', description: 'Số Giấy phép lái xe' })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'D', enum: DriverLicenseClass, description: 'Hạng bằng lái xe' })
  @IsOptional()
  @IsIn([DriverLicenseClass.CLASS_D, DriverLicenseClass.CLASS_E, DriverLicenseClass.CLASS_FD, DriverLicenseClass.CLASS_FE], {
    message: 'Hạng bằng lái xe phải là D, E, FD hoặc FE để đủ điều kiện lái xe buýt',
  })
  licenseClass?: string;

  @ApiPropertyOptional({ example: '2023-01-15', description: 'Ngày cấp bằng (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày cấp bằng phải đúng định dạng YYYY-MM-DD' })
  issueDate?: string;

  @ApiPropertyOptional({ example: '2028-01-15', description: 'Ngày hết hạn bằng (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày hết hạn phải đúng định dạng YYYY-MM-DD' })
  expiryDate?: string;

  @ApiPropertyOptional({ example: 'https://storage.ictu.edu.vn/drivers/gplx_front.jpg', description: 'Ảnh mặt trước GPLX' })
  @IsOptional()
  @IsString()
  frontImageUrl?: string;

  @ApiPropertyOptional({ example: 'https://storage.ictu.edu.vn/drivers/gplx_back.jpg', description: 'Ảnh mặt sau GPLX' })
  @IsOptional()
  @IsString()
  backImageUrl?: string;

  @ApiPropertyOptional({ example: 'approved', enum: DriverLicenseStatus, description: 'Trạng thái thẩm định của Admin' })
  @IsOptional()
  @IsIn([DriverLicenseStatus.PENDING, DriverLicenseStatus.APPROVED, DriverLicenseStatus.REJECTED])
  status?: DriverLicenseStatus;
}

export class ReviewDriverProfileDto {
  @ApiProperty({ example: 'approved', enum: [DriverLicenseStatus.APPROVED, DriverLicenseStatus.REJECTED], description: 'Quyết định phê duyệt hoặc từ chối' })
  @IsNotEmpty({ message: 'Quyết định xét duyệt không được để trống' })
  @IsIn([DriverLicenseStatus.APPROVED, DriverLicenseStatus.REJECTED], {
    message: 'Trạng thái xét duyệt chỉ có thể là approved hoặc rejected',
  })
  status: DriverLicenseStatus;

  @ApiPropertyOptional({ example: 'Ảnh bằng lái bị lóa sáng không rõ số hiệu và niên hạn', description: 'Lý do từ chối nếu không đạt' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class ListDriverProfilesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'pending', description: 'Lọc theo trạng thái duyệt: pending, approved, rejected, all' })
  @IsOptional()
  @IsString()
  status?: string;
}
