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
  limit: number; // Tối đa số lần gọi cho IP / Tài khoản (VD: 3)
  windowSeconds: number; // Trong khoảng thời gian (giây, VD: 600)
  actionName?: string; // Tên hành động để thông báo
  perTicketLimit?: number; // Tối đa số lần gửi cho mỗi vé (VD: 1)
  perTicketWindowSeconds?: number; // Cooldown cho mỗi vé (giây, VD: 60)
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
    const now = Date.now();

    // 1. Trích xuất mã nhận diện vé (nếu có) để áp dụng Per-Ticket Cooldown
    const ticketKey =
      req.params?.id ||
      req.params?.ticketId ||
      req.body?.ticketCode ||
      req.body?.bookingCode;

    if (options.perTicketLimit && ticketKey) {
      const ticketWindowMs = (options.perTicketWindowSeconds || 60) * 1000;
      const ticketLimit = options.perTicketLimit;
      const ticketRecordKey = `ticket:${ticketKey}`;

      let ticketRecord = RateLimitGuard.records.get(ticketRecordKey);
      if (!ticketRecord) {
        ticketRecord = { timestamps: [] };
        RateLimitGuard.records.set(ticketRecordKey, ticketRecord);
      }

      ticketRecord.timestamps = ticketRecord.timestamps.filter(
        (ts) => now - ts < ticketWindowMs,
      );

      if (ticketRecord.timestamps.length >= ticketLimit) {
        const oldestTimestamp = ticketRecord.timestamps[0];
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((oldestTimestamp + ticketWindowMs - now) / 1000),
        );

        if (res && typeof res.setHeader === 'function') {
          res.setHeader('Retry-After', retryAfterSeconds.toString());
        }

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau ${retryAfterSeconds} giây.`,
            retryAfterSeconds,
            retryAfter: retryAfterSeconds,
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // 2. Kiểm tra giới hạn theo IP / Tài khoản người dùng (Per IP / User Rate Limit)
    const clientIp =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

    const userId = req.user?.id || req.user?.sub;
    const userIdentifier = userId ? `user:${userId}` : `ip:${clientIp}`;
    const handlerName = context.getHandler().name;
    const key = `${userIdentifier}:${handlerName}`;
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
          message: `Quá giới hạn ${action}. Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau ${timeStr}.`,
          retryAfterSeconds,
          retryAfter: retryAfterSeconds,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Ghi nhận lần gọi hợp lệ cho cả vé (nếu có) và IP/User
    if (options.perTicketLimit && ticketKey) {
      const ticketRecordKey = `ticket:${ticketKey}`;
      const ticketRecord = RateLimitGuard.records.get(ticketRecordKey);
      if (ticketRecord) {
        ticketRecord.timestamps.push(now);
      }
    }
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
