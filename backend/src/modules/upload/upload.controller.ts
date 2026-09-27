import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import * as crypto from 'node:crypto';
import { validateStudentCardImage } from '../../common/utils/file-upload.util.js';
import { UploadStudentCardDto } from './dto/upload.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { Public } from '../../common/decorators/public.decorator.js';

interface UploadedMulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@ApiTags('Uploads & Verification')
@Controller()
export class UploadController {
  @Public()
  @Post(['upload/student-card', 'users/upload-student-card', 'monthly-passes/upload-proof'])
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Tải ảnh minh chứng Thẻ Sinh Viên (Kiểm định Magic Bytes, max 3MB, chặn SVG)',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  async uploadStudentCard(
    @UploadedFile() file?: UploadedMulterFile,
    @Body() dto?: UploadStudentCardDto,
  ) {
    let buffer: Buffer | null = null;
    let originalFilename = '';
    let declaredMimeType = '';

    if (file && file.buffer) {
      buffer = file.buffer;
      originalFilename = file.originalname;
      declaredMimeType = file.mimetype;
    } else if (dto?.fileBase64) {
      originalFilename = dto.filename || 'student-card.jpg';
      declaredMimeType = dto.mimeType || '';

      let rawBase64 = dto.fileBase64;
      if (rawBase64.includes(';base64,')) {
        const parts = rawBase64.split(';base64,');
        if (!declaredMimeType && parts[0].startsWith('data:')) {
          declaredMimeType = parts[0].replace('data:', '');
        }
        rawBase64 = parts[1];
      }
      try {
        buffer = Buffer.from(rawBase64, 'base64');
      } catch {
        throw new BadRequestException('Chuỗi ảnh Base64 không hợp lệ');
      }
    }

    if (!buffer || buffer.length === 0) {
      throw new BadRequestException(
        'Vui lòng tải lên tệp ảnh (form-data: "file") hoặc truyền chuỗi Base64 (fileBase64)',
      );
    }

    // Kiểm định nghiêm ngặt: Dung lượng <= 3MB, chặn SVG, kiểm tra Magic Bytes đầu tệp
    const validation = validateStudentCardImage(
      buffer,
      originalFilename,
      declaredMimeType,
    );

    const ext = validation.mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const secureFilename = `student_card_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const fileUrl = `/uploads/student-cards/${secureFilename}`;

    return {
      success: true,
      message:
        'Tải ảnh minh chứng thẻ sinh viên hợp lệ và an toàn (Đã kiểm tra Magic Bytes thành công)',
      url: fileUrl,
      filename: secureFilename,
      mimeType: validation.mimeType,
      sizeBytes: validation.sizeBytes,
    };
  }
}
