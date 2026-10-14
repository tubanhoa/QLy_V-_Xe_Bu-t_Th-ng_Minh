import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service.js';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const method = (req.method || 'GET').toUpperCase();
    const originalUrl = req.originalUrl || req.url || '';

    // Bỏ qua các request GET thông thường hoặc endpoint chính của activity-logs và healthcheck để tránh vòng lặp
    const isMutatingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isExcluded =
      originalUrl.includes('/admin/activity-logs') ||
      originalUrl.includes('/health') ||
      originalUrl.endsWith('.ico') ||
      originalUrl.endsWith('.png');

    if (!isMutatingMethod || isExcluded) {
      return next.handle();
    }

    const startTime = Date.now();
    const clientIp = this.extractClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown Client';
    const resourceName = this.extractResourceName(originalUrl);
    const action = this.resolveAction(method, originalUrl);
    const sanitizedBody = this.sanitizePayload(req.body);

    return next.handle().pipe(
      tap((responseBody) => {
        const executionTimeMs = Date.now() - startTime;
        const statusCode = res.statusCode || 200;

        // Trích xuất userId từ req.user hoặc responseBody nếu là luồng auth
        let userId = req.user?.id || req.user?.sub;
        if (!userId && responseBody?.user?.id) {
          userId = responseBody.user.id;
        }

        const changes: Record<string, any> = {
          params: req.params,
          query: req.query,
          payload: sanitizedBody,
          statusCode,
        };

        this.auditService
          .log({
            action,
            resourceName,
            endpoint: originalUrl,
            method,
            status: statusCode < 400 ? 'SUCCESS' : 'FAILED',
            executionTimeMs,
            changes,
            userId,
            ipAddress: clientIp,
            userAgent,
          })
          .catch((err) => {
            this.logger.debug(`Audit log tap error: ${err?.message}`);
          });
      }),
      catchError((error) => {
        const executionTimeMs = Date.now() - startTime;
        const statusCode = error.status || error.statusCode || 500;
        const userId = req.user?.id || req.user?.sub;

        const changes: Record<string, any> = {
          params: req.params,
          query: req.query,
          payload: sanitizedBody,
          statusCode,
          errorMessage: error.message || 'Lỗi xử lý request',
        };

        this.auditService
          .log({
            action,
            resourceName,
            endpoint: originalUrl,
            method,
            status: 'FAILED',
            executionTimeMs,
            changes,
            userId,
            ipAddress: clientIp,
            userAgent,
          })
          .catch((err) => {
            this.logger.debug(`Audit log catchError error: ${err?.message}`);
          });

        throw error;
      }),
    );
  }

  private extractClientIp(req: any): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const parts = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
      return parts[0].trim();
    }
    return req.socket?.remoteAddress || req.ip || '127.0.0.1';
  }

  private extractResourceName(url: string): string {
    const cleanUrl = url.split('?')[0].replace(/^\/api\/v\d+\//, '').replace(/^\/api\//, '');
    const segments = cleanUrl.split('/').filter(Boolean);
    if (segments.length === 0) return 'system';
    if (segments[0] === 'admin' && segments.length > 1) {
      return segments[1];
    }
    return segments[0];
  }

  private resolveAction(method: string, url: string): string {
    const clean = url.toLowerCase();

    if (clean.includes('/auth/login')) return 'LOGIN';
    if (clean.includes('/auth/register')) return 'REGISTER';
    if (clean.includes('/auth/logout')) return 'LOGOUT';
    if (clean.includes('/auth/change-password')) return 'CHANGE_PASSWORD';
    if (clean.includes('/auth/profile')) return 'UPDATE_PROFILE';

    if (clean.includes('/users') || clean.includes('/admin/users')) {
      if (clean.includes('/role')) return 'CHANGE_ROLE';
      if (clean.includes('/status')) return 'CHANGE_STATUS';
      if (clean.includes('/cleanup-test-data')) return 'CLEANUP_TEST_DATA';
      if (method === 'POST') return 'CREATE_USER';
      if (method === 'PATCH' || method === 'PUT') return 'UPDATE_USER';
      if (method === 'DELETE') return 'DELETE_USER';
    }

    if (clean.includes('/bookings')) {
      if (method === 'POST') return 'CREATE_BOOKING';
      if (clean.includes('/cancel')) return 'CANCEL_BOOKING';
    }

    if (clean.includes('/tickets')) {
      if (clean.includes('/check-in')) return 'CHECKIN_TICKET';
      if (clean.includes('/cancel')) return 'CANCEL_TICKET';
      if (clean.includes('/exchange')) return 'EXCHANGE_TICKET';
    }

    if (clean.includes('/vouchers')) {
      if (method === 'POST') return 'CREATE_VOUCHER';
      if (method === 'PATCH' || method === 'PUT') return 'UPDATE_VOUCHER';
      if (method === 'DELETE') return 'DELETE_VOUCHER';
    }

    if (clean.includes('/schedules') || clean.includes('/trips')) {
      if (method === 'POST') return 'CREATE_TRIP';
      if (method === 'PATCH' || method === 'PUT') return 'UPDATE_TRIP';
      if (method === 'DELETE') return 'DELETE_TRIP';
    }

    return `${method}_${this.extractResourceName(url).toUpperCase()}`;
  }

  private sanitizePayload(body: any): any {
    if (!body || typeof body !== 'object') return body;
    const sensitiveKeys = ['password', 'oldpassword', 'newpassword', 'refreshtoken', 'token', 'secret'];

    const cloned = Array.isArray(body) ? [...body] : { ...body };
    for (const key of Object.keys(cloned)) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        cloned[key] = '****** [MASKED FOR SECURITY]';
      } else if (cloned[key] && typeof cloned[key] === 'object') {
        cloned[key] = this.sanitizePayload(cloned[key]);
      }
    }
    return cloned;
  }
}
