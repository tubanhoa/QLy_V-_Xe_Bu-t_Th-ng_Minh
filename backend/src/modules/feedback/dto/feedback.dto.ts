import { IsNotEmpty, IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFeedbackDto {
  @ApiPropertyOptional({ description: 'ID chuyến xe được đánh giá' })
  @IsOptional()
  @IsString()
  tripId?: string;

  @ApiProperty({ example: 5, description: 'Điểm đánh giá từ 1 đến 5 sao' })
  @IsNumber()
  @Min(1)
  @Max(5)
  ratingScore: number;

  @ApiProperty({ example: 'Xe chạy êm ái, tài xế thân thiện, xe buýt điện không có mùi xăng dầu.' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: 'service', description: 'Danh mục: service, cleanliness, punctuality, safety, other' })
  @IsOptional()
  @IsString()
  category?: string;
}

export class RespondFeedbackDto {
  @ApiProperty({ example: 'Cảm ơn bạn đã đóng góp ý kiến! Nhà trường và đội xe luôn ghi nhận.' })
  @IsString()
  @IsNotEmpty()
  adminResponse: string;

  @ApiPropertyOptional({ example: 'resolved', enum: ['in_review', 'resolved'] })
  @IsOptional()
  @IsString()
  status?: 'in_review' | 'resolved';
}
