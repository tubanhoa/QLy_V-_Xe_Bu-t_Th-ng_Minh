import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  UseGuards,
  Get,
  Param,
  Res,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { validateProofImage, saveUploadedFileLocally } from '../../common/utils/file-upload.util.js';
import { UploadStudentCardDto } from './dto/upload.dto.js';
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
  @Post(['upload/student-card', 'users/upload-student-card', 'monthly-passes/upload-proof', 'priority-verifications/upload-proof'])
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Tải ảnh minh chứng Thẻ Sinh Viên / CCCD (Kiểm định Magic Bytes, max 3MB, chặn SVG)',
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
      originalFilename = dto.filename || 'proof-image.jpg';
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
    const validation = validateProofImage(
      buffer,
      originalFilename,
      declaredMimeType,
    );

    const ext = validation.mimeType === 'image/jpeg' ? 'jpg' : validation.mimeType === 'image/png' ? 'png' : 'webp';
    const saved = await saveUploadedFileLocally(buffer, 'verifications', ext);

    return {
      success: true,
      message:
        'Tải ảnh minh chứng hợp lệ và an toàn (Đã kiểm tra Magic Bytes thành công)',
      url: saved.fileUrl,
      filename: saved.filename,
      mimeType: validation.mimeType,
      sizeBytes: validation.sizeBytes,
    };
  }

  @Public()
  @Get(['uploads/:subDir/:filename', 'api/v1/uploads/:subDir/:filename', 'api/uploads/:subDir/:filename'])
  @ApiOperation({ summary: 'Xem ảnh minh chứng đã tải lên' })
  async getUploadedFile(
    @Param('subDir') subDir: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const safeSubDir = subDir.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeFilename = path.basename(filename);
    const filePath = path.resolve(process.cwd(), 'uploads', safeSubDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Không tìm thấy tệp ảnh minh chứng: ${safeFilename}`);
    }

    const ext = path.extname(safeFilename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}
