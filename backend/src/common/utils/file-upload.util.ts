import { BadRequestException } from '@nestjs/common';

export interface ImageValidationResult {
  isValid: boolean;
  mimeType: 'image/jpeg' | 'image/png';
  sizeBytes: number;
}

/**
 * Magic Bytes signatures:
 * JPEG: FF D8 FF
 * PNG:  89 50 4E 47 0D 0A 1A 0A
 */
export function validateStudentCardImage(
  buffer: Buffer,
  originalFilename?: string,
  declaredMimeType?: string,
): ImageValidationResult {
  if (!buffer || buffer.length === 0) {
    throw new BadRequestException('Vui lòng chọn tệp ảnh minh chứng thẻ sinh viên');
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
    filename.endsWith('.js')
  ) {
    throw new BadRequestException(
      'Chặn hoàn toàn tệp SVG và các định dạng không hợp lệ. Chỉ chấp nhận ảnh JPEG hoặc PNG.',
    );
  }

  // Kiểm tra chuỗi buffer nếu chứa mã SVG XML độc hại
  const previewStr = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8').toLowerCase();
  if (previewStr.includes('<svg') || previewStr.includes('<?xml')) {
    throw new BadRequestException(
      'Chặn hoàn toàn tệp chứa mã SVG/XML. Chỉ chấp nhận ảnh JPEG hoặc PNG thực sự.',
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

  if (!isJpeg && !isPng) {
    throw new BadRequestException(
      'Tệp tải lên không phải ảnh JPEG hoặc PNG hợp lệ (Magic Bytes đầu tệp không khớp).',
    );
  }

  return {
    isValid: true,
    mimeType: isJpeg ? 'image/jpeg' : 'image/png',
    sizeBytes: buffer.length,
  };
}
