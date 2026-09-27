import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export interface RateLimitOptions {
  limit: number; // Tối đa số lần gọi
  windowSeconds: number; // Trong khoảng thời gian (giây)
  actionName?: string; // Tên hành động để thông báo
}

export const RATE_LIMIT_KEY = 'rate_limit';
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

// In-memory sliding window rate limiter
interface RateLimitRecord {
  timestamps: number[];
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly records = new Map<string, RateLimitRecord>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const clientIp =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

    const handlerName = context.getHandler().name;
    const key = `${clientIp}:${handlerName}`;
    const now = Date.now();
    const windowMs = options.windowSeconds * 1000;

    let record = RateLimitGuard.records.get(key);
    if (!record) {
      record = { timestamps: [] };
      RateLimitGuard.records.set(key, record);
    }

    // Lọc bỏ các timestamp ngoài khoảng thời gian window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    if (record.timestamps.length >= options.limit) {
      const oldestTimestamp = record.timestamps[0];
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldestTimestamp + windowMs - now) / 1000),
      );

      const minutes = Math.floor(retryAfterSeconds / 60);
      const seconds = retryAfterSeconds % 60;
      const timeStr =
        minutes > 0 ? `${minutes} phút ${seconds} giây` : `${seconds} giây`;

      if (res && typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', retryAfterSeconds.toString());
      }

      const action = options.actionName || 'yêu cầu';
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Quá giới hạn ${action}. Bạn chỉ được thực hiện tối đa ${options.limit} lần trong ${Math.round(options.windowSeconds / 60)} phút. Vui lòng thử lại sau ${timeStr}.`,
          retryAfter: retryAfterSeconds,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Ghi nhận lần gọi hợp lệ
    record.timestamps.push(now);
    return true;
  }

  /**
   * Helper để xóa sạch bộ nhớ (hữu ích cho unit testing)
   */
  static clearMemory() {
    RateLimitGuard.records.clear();
  }
}
