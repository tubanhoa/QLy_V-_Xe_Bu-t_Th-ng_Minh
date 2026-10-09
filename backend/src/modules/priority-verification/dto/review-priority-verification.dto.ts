import { IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewPriorityVerificationDto {
  @ApiProperty({
    enum: ['approved', 'rejected'],
    example: 'approved',
    description: 'Quyết định thẩm định: approved (Phê duyệt) hoặc rejected (Từ chối)',
  })
  @IsIn(['approved', 'rejected'], { message: 'Trạng thái chỉ có thể là approved hoặc rejected' })
  status: 'approved' | 'rejected';

  @ApiPropertyOptional({
    example: 'Ảnh thẻ sinh viên bị mờ không nhìn rõ niên khóa. Vui lòng chụp lại ảnh rõ nét.',
    description: 'Lý do từ chối (Bắt buộc khi status = rejected)',
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
