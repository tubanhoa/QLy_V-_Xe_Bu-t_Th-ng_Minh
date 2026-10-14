import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsArray,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

export class CreateFeedbackDto {
  @ApiPropertyOptional({ description: 'ID chuyến xe được đánh giá' })
  @IsOptional()
  @IsString()
  tripId?: string;

  @ApiPropertyOptional({ example: 5, description: 'Điểm đánh giá từ 1 đến 5 sao' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  ratingScore?: number;

  @ApiProperty({ example: 'Xe chạy êm ái, tài xế thân thiện, xe buýt điện không có mùi xăng dầu.' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: 'service', description: 'Danh mục: service, cleanliness, punctuality, safety, other' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'rating', enum: ['rating', 'complaint', 'suggestion'] })
  @IsOptional()
  @IsIn(['rating', 'complaint', 'suggestion'])
  type?: 'rating' | 'complaint' | 'suggestion';

  @ApiPropertyOptional({ example: 'Đánh giá chất lượng chuyến xe' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'TIC-12345678' })
  @IsOptional()
  @IsString()
  ticketCode?: string;

  @ApiPropertyOptional({ example: ['/uploads/verifications/proof-123.jpg'], type: [String] })
  @IsOptional()
  @IsArray()
  attachments?: string[];
}

export class CreateComplaintDto {
  @ApiProperty({ example: 'Tài xế bỏ trạm và thái độ chưa đúng mực' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Chuyến xe lúc 7h30 sáng nay tại trạm ICTU không dừng đón khách dù còn nhiều ghế trống...' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ example: 'driver_attitude', description: 'Danh mục: driver_attitude, cleanliness, punctuality, lost_item, safety, other' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({ description: 'ID chuyến xe liên quan (nếu có)' })
  @IsOptional()
  @IsString()
  tripId?: string;

  @ApiPropertyOptional({ example: 'TIC-98765432' })
  @IsOptional()
  @IsString()
  ticketCode?: string;

  @ApiPropertyOptional({ example: 1, description: 'Mức độ hài lòng (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  ratingScore?: number;

  @ApiPropertyOptional({
    description: 'Danh sách URLs ảnh minh chứng (chụp ảnh vé, hiện trường, xe)',
    type: [String],
    example: ['/uploads/verifications/proof-001.jpg'],
  })
  @IsOptional()
  @IsArray()
  attachments?: string[];
}

export class QueryFeedbackDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'new', enum: ['all', 'new', 'in_review', 'resolved'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 5, description: 'Lọc theo số sao (1-5)' })
  @IsOptional()
  ratingScore?: number;

  @ApiPropertyOptional({ example: 'complaint', enum: ['all', 'rating', 'complaint', 'suggestion'] })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'driver_attitude' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID chuyến xe' })
  @IsOptional()
  @IsString()
  tripId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID hành khách' })
  @IsOptional()
  @IsString()
  userId?: string;
}

export class RespondFeedbackDto {
  @ApiProperty({ example: 'Cảm ơn bạn đã phản ánh! Ban điều hành đã nhắc nhở tài xế và kiểm tra camera hành trình.' })
  @IsString()
  @IsNotEmpty()
  adminResponse: string;

  @ApiPropertyOptional({ example: 'resolved', enum: ['in_review', 'resolved'] })
  @IsOptional()
  @IsString()
  status?: 'in_review' | 'resolved';
}
