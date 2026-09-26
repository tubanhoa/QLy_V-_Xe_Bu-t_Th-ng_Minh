import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global Exception Filter
 * Chuẩn hóa tất cả lỗi theo format:
 * { success: false, message: string, errorCode: string, statusCode: number }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj['message'] as string) || message;

        // Handle class-validator array messages
        if (Array.isArray(responseObj['message'])) {
          message = (responseObj['message'] as string[]).join('; ');
        }

        errorCode = (responseObj['error'] as string) || errorCode;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Log lỗi server-side
    if (statusCode >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} → ${statusCode}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} → ${statusCode}: ${message}`,
      );
    }

    response.status(statusCode).json({
      success: false,
      message,
      errorCode,
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

export { AllExceptionsFilter as HttpExceptionFilter };

