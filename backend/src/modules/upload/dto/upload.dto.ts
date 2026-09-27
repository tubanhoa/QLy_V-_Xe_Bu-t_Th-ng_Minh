import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadStudentCardDto {
  @ApiPropertyOptional({
    description: 'Chuỗi Base64 ảnh thẻ sinh viên (nếu tải qua JSON)',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
  })
  @IsOptional()
  @IsString()
  fileBase64?: string;

  @ApiPropertyOptional({ example: 'the_sinh_vien.jpg' })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  mimeType?: string;
}
