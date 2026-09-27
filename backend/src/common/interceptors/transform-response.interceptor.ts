import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Response chuẩn hóa cho tất cả API
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * Interceptor tự động bọc response theo chuẩn:
 * { success: true, data: ..., message: '...' }
 */
@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((responseData) => {
        // Nếu response đã có format chuẩn → giữ nguyên
        if (
          responseData &&
          typeof responseData === 'object' &&
          'success' in responseData
        ) {
          return responseData as ApiResponse<T>;
        }

        return {
          success: true,
          data: responseData as T,
          message: 'Thao tác thành công',
        };
      }),
    );
  }
}
