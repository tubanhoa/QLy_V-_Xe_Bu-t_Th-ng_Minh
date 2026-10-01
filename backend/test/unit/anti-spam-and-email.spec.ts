import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { BookingController } from '../../src/modules/booking/booking.controller.js';
import { BookingService } from '../../src/modules/booking/booking.service.js';
import { RateLimitGuard } from '../../src/common/guards/rate-limit.guard.js';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter.js';
import { Reflector } from '@nestjs/core';

describe('Anti-Spam & Resend Email Verification (Sprint 1 & Sprint 2)', () => {
  let app: INestApplication;
  let mockBookingService: {
    resendTicketEmail: any;
    resendTicketEmailByCode: any;
  };

  beforeEach(async () => {
    RateLimitGuard.clearMemory();

    mockBookingService = {
      resendTicketEmail: vi.fn().mockImplementation(async (ticketId, userId, email) => {
        return {
          success: true,
          message: `Đã gửi lại vé điện tử thành công tới email ${email || 'user@example.com'}`,
          recipientEmail: email || 'user@example.com',
        };
      }),
      resendTicketEmailByCode: vi.fn().mockImplementation(async (code, email) => {
        return {
          success: true,
          message: `Đã gửi lại vé điện tử thành công tới email ${email || 'guest@example.com'}`,
          recipientEmail: email || 'guest@example.com',
          ticketCode: code,
          bookingCode: 'BK-ICTU-8888',
        };
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [BookingController],
      providers: [
        {
          provide: BookingService,
          useValue: mockBookingService,
        },
        Reflector,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    RateLimitGuard.clearMemory();
    await app.close();
  });

  it('1. Cho phép gửi lại email vé mà KHÔNG bắt buộc có JWT (Hỗ trợ khách vãng lai & phiên hết hạn)', async () => {
    const res = await request(app.getHttpServer())
      .post('/booking/tickets/tkt-demo-123/resend-email')
      .send({ email: 'passenger@example.com' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Đã gửi lại vé điện tử thành công');
    expect(mockBookingService.resendTicketEmail).toHaveBeenCalledWith(
      'tkt-demo-123',
      undefined,
      'passenger@example.com',
    );
  });

  it('2. [Anti-Spam Per Ticket] Chặn gửi liên tiếp trong 60 giây cho cùng 1 vé -> Trả về HTTP 429 và Retry-After', async () => {
    // Lần 1: Thành công
    const r1 = await request(app.getHttpServer())
      .post('/booking/tickets/tkt-spam-test/resend-email')
      .send({ email: 'spam@example.com' })
      .expect(201);
    expect(r1.body.success).toBe(true);

    // Lần 2 liên tiếp: Phải bị chặn 429 Too Many Requests
    const r2 = await request(app.getHttpServer())
      .post('/booking/tickets/tkt-spam-test/resend-email')
      .send({ email: 'spam@example.com' })
      .expect(429);

    expect(r2.body.statusCode).toBe(429);
    expect(r2.body.message).toContain('Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau');
    expect(r2.body.retryAfterSeconds).toBeDefined();
    expect(r2.body.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(r2.headers['retry-after']).toBeDefined();
    expect(Number(r2.headers['retry-after'])).toBeGreaterThanOrEqual(1);
  });

  it('3. [Anti-Spam Per IP] Giới hạn tối đa 3 lần/10 phút theo IP đối với các vé khác nhau', async () => {
    // 3 lần với 3 vé khác nhau -> Hợp lệ
    await request(app.getHttpServer())
      .post('/booking/tickets/tkt-diff-1/resend-email')
      .send({ email: 'user@example.com' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/booking/tickets/tkt-diff-2/resend-email')
      .send({ email: 'user@example.com' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/booking/tickets/tkt-diff-3/resend-email')
      .send({ email: 'user@example.com' })
      .expect(201);

    // Lần 4 với vé khác (vé thứ 4) -> Quá giới hạn 3 lần/10 phút của IP
    const r4 = await request(app.getHttpServer())
      .post('/booking/tickets/tkt-diff-4/resend-email')
      .send({ email: 'user@example.com' })
      .expect(429);

    expect(r4.body.statusCode).toBe(429);
    expect(r4.body.message).toContain('Quá giới hạn gửi lại email vé điện tử');
    expect(r4.body.retryAfterSeconds).toBeDefined();
    expect(r4.headers['retry-after']).toBeDefined();
  });

  it('4. [Public Endpoint] POST /booking/tickets/resend-by-code gửi vé theo ticketCode/bookingCode thành công', async () => {
    const res = await request(app.getHttpServer())
      .post('/booking/tickets/resend-by-code')
      .send({
        ticketCode: 'TK-2026-02B',
        bookingCode: 'BK-ICTU-8168',
        email: 'guest.passenger@ictu.edu.vn',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Đã gửi lại vé điện tử thành công');
    expect(mockBookingService.resendTicketEmailByCode).toHaveBeenCalledWith(
      'TK-2026-02B',
      'guest.passenger@ictu.edu.vn',
    );
  });
});
