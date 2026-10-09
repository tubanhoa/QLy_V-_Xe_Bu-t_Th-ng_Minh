import { BadRequestException } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export interface ImageValidationResult {
  isValid: boolean;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
}

/**
 * Kiểm định ảnh minh chứng HSSV / CCCD người cao tuổi (Magic Bytes, Max 3MB, chặn SVG)
 * Magic Bytes signatures:
 * - JPEG: FF D8 FF
 * - PNG:  89 50 4E 47 0D 0A 1A 0A
 * - WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
 */
export function validateProofImage(
  buffer: Buffer,
  originalFilename?: string,
  declaredMimeType?: string,
): ImageValidationResult {
  if (!buffer || buffer.length === 0) {
    throw new BadRequestException('Vui lòng chọn tệp ảnh minh chứng (Thẻ HSSV hoặc CCCD/CMND)');
  }

  // 1. Kiểm tra dung lượng tối đa 3MB (3 * 1024 * 1024 = 3,145,728 bytes)
  const MAX_SIZE_BYTES = 3 * 1024 * 1024;
  if (buffer.length > MAX_SIZE_BYTES) {
    const sizeInMb = (buffer.length / (1024 * 1024)).toFixed(2);
    throw new BadRequestException(
      `Dung lượng tệp ảnh vượt quá giới hạn tối đa 3MB (dung lượng hiện tại: ${sizeInMb}MB)`,
    );
  }

  // 2. Chặn hoàn toàn file SVG và các file tài liệu/mã nguồn qua tên file và declared mime
  const filename = (originalFilename || '').toLowerCase();
  const mime = (declaredMimeType || '').toLowerCase();

  if (
    filename.endsWith('.svg') ||
    mime.includes('svg') ||
    filename.endsWith('.html') ||
    filename.endsWith('.htm') ||
    filename.endsWith('.exe') ||
    filename.endsWith('.php') ||
    filename.endsWith('.js') ||
    filename.endsWith('.sh')
  ) {
    throw new BadRequestException(
      'Chặn hoàn toàn tệp SVG và các định dạng không an toàn. Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.',
    );
  }

  // Kiểm tra chuỗi buffer nếu chứa mã SVG XML độc hại
  const previewStr = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8').toLowerCase();
  if (previewStr.includes('<svg') || previewStr.includes('<?xml')) {
    throw new BadRequestException(
      'Chặn hoàn toàn tệp chứa mã SVG/XML. Chỉ chấp nhận ảnh JPG, PNG hoặc WebP thực sự.',
    );
  }

  // 3. Kiểm tra Magic Bytes thực sự ở đầu tệp
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 && // P
    buffer[2] === 0x4e && // N
    buffer[3] === 0x47 && // G
    buffer[4] === 0x0d && // \r
    buffer[5] === 0x0a && // \n
    buffer[6] === 0x1a && // EOF
    buffer[7] === 0x0a; // \n

  const isWebp =
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 && // RIFF
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50; // WEBP

  if (!isJpeg && !isPng && !isWebp) {
    throw new BadRequestException(
      'Tệp tải lên không phải ảnh JPG, PNG hoặc WebP hợp lệ (Magic Bytes đầu tệp không khớp).',
    );
  }

  const mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = isJpeg
    ? 'image/jpeg'
    : isPng
    ? 'image/png'
    : 'image/webp';

  return {
    isValid: true,
    mimeType,
    sizeBytes: buffer.length,
  };
}

/** Tương thích ngược */
export function validateStudentCardImage(
  buffer: Buffer,
  originalFilename?: string,
  declaredMimeType?: string,
): ImageValidationResult {
  return validateProofImage(buffer, originalFilename, declaredMimeType);
}

/**
 * Lưu trữ tệp ảnh vật lý an toàn chống path traversal và trùng lặp
 */
export async function saveUploadedFileLocally(
  buffer: Buffer,
  subDir: string,
  extension: string,
): Promise<{ filename: string; fileUrl: string; fullPath: string }> {
  const safeSubDir = subDir.replace(/[^a-zA-Z0-9_-]/g, '');
  const uploadDir = path.resolve(process.cwd(), 'uploads', safeSubDir);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = extension.replace('.', '').toLowerCase();
  const secureFilename = `proof_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const fullPath = path.join(uploadDir, secureFilename);

  await fs.promises.writeFile(fullPath, buffer);

  const fileUrl = `/uploads/${safeSubDir}/${secureFilename}`;
  return {
    filename: secureFilename,
    fileUrl,
    fullPath,
  };
}
