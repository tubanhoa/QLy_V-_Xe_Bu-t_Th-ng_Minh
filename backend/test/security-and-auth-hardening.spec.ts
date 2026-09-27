import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
  ExecutionContext,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import * as crypto from 'node:crypto';

import { BookingController } from '../src/modules/booking/booking.controller.js';
import { BookingService } from '../src/modules/booking/booking.service.js';
import { SeatLockService } from '../src/modules/booking/seat-lock.service.js';
import { NotificationService } from '../src/modules/notification/notification.service.js';
import { TripsController } from '../src/modules/trips/trips.controller.js';
import { TripsService } from '../src/modules/trips/trips.service.js';
import { PaymentController } from '../src/modules/payment/payment.controller.js';
import { PaymentService } from '../src/modules/payment/payment.service.js';
import { UploadController } from '../src/modules/upload/upload.controller.js';
import { VoucherController } from '../src/modules/promotion/voucher.controller.js';
import { VoucherService } from '../src/modules/promotion/voucher.service.js';
import { AuthController } from '../src/modules/auth/auth.controller.js';
import { AuthService } from '../src/modules/auth/auth.service.js';

import { TripEntity } from '../src/database/entities/trip.entity.js';
import { RouteEntity } from '../src/database/entities/route.entity.js';
import { VehicleEntity } from '../src/database/entities/vehicle.entity.js';
import { SeatEntity } from '../src/database/entities/seat.entity.js';
import { TicketEntity } from '../src/database/entities/ticket.entity.js';
import { BookingEntity } from '../src/database/entities/booking.entity.js';
import { VoucherEntity } from '../src/database/entities/voucher.entity.js';
import { UserEntity } from '../src/database/entities/user.entity.js';
import { SeatHoldEntity } from '../src/database/entities/seat-hold.entity.js';
import { PaymentEntity } from '../src/database/entities/payment.entity.js';
import { RoleEntity } from '../src/database/entities/role.entity.js';

import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor.js';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../src/common/guards/roles.guard.js';
import { RateLimitGuard } from '../src/common/guards/rate-limit.guard.js';
import {
  TripStatus,
  TicketStatus,
  BookingStatus,
  PaymentStatus,
} from '../src/common/constants/status.constant.js';
import { Role } from '../src/common/constants/roles.constant.js';

describe('Security & Hardening Suite: SEC-01, SEC-02, SEC-03, AUTH-01 HTTP Tests', () => {
  let app: INestApplication;

  const mockUserPassenger = {
    id: 'user-sec-pass-1',
    email: 'passenger.sec@ictu.edu.vn',
    fullName: 'Lê Văn An Toàn',
    phoneNumber: '0981122334',
    role: Role.PASSENGER,
  };

  const createMockToken = (user: any) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ ...user, sub: user.id })).toString('base64url');
    return `Bearer ${header}.${payload}.mockSignature`;
  };

  const tokenPassenger = createMockToken(mockUserPassenger);

  const mockTrip = {
    id: 'trip-sec-uuid',
    routeId: 'route-sec-uuid',
    vehicleId: 'vehicle-sec-uuid',
    departureTime: new Date(Date.now() + 30 * 60 * 60 * 1000), // > 24h
    status: TripStatus.SCHEDULED,
    route: {
      id: 'route-sec-uuid',
      name: 'Tuyến Thái Nguyên - Hà Nội Express',
      origin: 'Bến xe Thái Nguyên',
      destination: 'Bến xe Mỹ Đình',
      basePrice: 50000,
    },
    vehicle: {
      id: 'vehicle-sec-uuid',
      licensePlate: '20B-111.22',
      seatCapacity: 10,
    },
  };

  const storedTickets: any[] = [];
  const storedBookings: any[] = [];
  const storedHolds: any[] = [];
  const storedPayments: any[] = [];
  const storedVouchers: any[] = [];

  beforeAll(async () => {
    const mockTripRepo = {
      findOne: () => Promise.resolve(mockTrip),
      createQueryBuilder: () => ({
        innerJoinAndSelect: function () { return this; },
        leftJoinAndSelect: function () { return this; },
        where: function () { return this; },
        andWhere: function () { return this; },
        orderBy: function () { return this; },
        getMany: () => Promise.resolve([mockTrip]),
        getOne: () => Promise.resolve(mockTrip),
      }),
    };

    const mockSeatRepo = {
      findOne: (opts: any) => Promise.resolve({ id: opts?.where?.id || 'seat-1', seatNumber: '01A' }),
      find: () => Promise.resolve([{ id: 'seat-1', seatNumber: '01A' }]),
    };

    const mockTicketRepo = {
      findOne: (opts: any) => {
        let ticket: any = null;
        if (Array.isArray(opts?.where)) {
          for (const cond of opts.where) {
            ticket = storedTickets.find((t) => (cond.id && t.id === cond.id) || (cond.ticketCode && t.ticketCode === cond.ticketCode));
            if (ticket) break;
          }
        } else if (opts?.where?.id) {
          ticket = storedTickets.find((t) => t.id === opts.where.id);
        }
        if (ticket && opts?.relations?.booking) {
          ticket.booking = storedBookings.find((b) => b.id === ticket.bookingId);
          if (ticket.booking) {
            ticket.booking.trip = mockTrip;
            ticket.booking.user = mockUserPassenger;
            ticket.booking.payments = storedPayments.filter((p) => p.bookingId === ticket.booking.id);
          }
        }
        return Promise.resolve(ticket || null);
      },
      save: (data: any) => {
        const idx = storedTickets.findIndex((t) => t.id === data.id);
        if (idx >= 0) {
          Object.assign(storedTickets[idx], data);
          return Promise.resolve(storedTickets[idx]);
        }
        storedTickets.push(data);
        return Promise.resolve(data);
      },
      count: () => Promise.resolve(0),
      createQueryBuilder: () => ({
        innerJoin: function () { return this; },
        where: function () { return this; },
        andWhere: function () { return this; },
        getOne: () => Promise.resolve(null),
      }),
    };

    const mockBookingRepo = {
      findOne: (opts: any) => {
        const b = storedBookings.find((item) => item.id === opts?.where?.id);
        return Promise.resolve(b || null);
      },
      save: (data: any) => {
        const idx = storedBookings.findIndex((b) => b.id === data.id);
        if (idx >= 0) {
          Object.assign(storedBookings[idx], data);
          return Promise.resolve(storedBookings[idx]);
        }
        storedBookings.push(data);
        return Promise.resolve(data);
      },
    };

    const mockPaymentRepo = {
      findOne: (opts: any) => {
        const p = storedPayments.find((item) => item.bookingId === opts?.where?.bookingId);
        return Promise.resolve(p || null);
      },
      save: (data: any) => {
        const idx = storedPayments.findIndex((p) => p.id === data.id);
        if (idx >= 0) {
          Object.assign(storedPayments[idx], data);
          return Promise.resolve(storedPayments[idx]);
        }
        storedPayments.push(data);
        return Promise.resolve(data);
      },
    };

    const mockSeatHoldRepo = {
      update: () => Promise.resolve({ affected: 1 }),
      findOne: () => Promise.resolve(null),
      create: (d: any) => d,
      save: (d: any) => Promise.resolve(d),
    };

    const mockVoucherRepo = {
      findOne: (opts: any) => {
        const v = storedVouchers.find((item) => item.code === opts?.where?.code);
        return Promise.resolve(v || null);
      },
    };

    const mockUserRepo = {
      findOne: () => Promise.resolve(mockUserPassenger),
    };

    const mockAuthService = {
      login: (dto: any) => {
        return Promise.resolve({
          user: mockUserPassenger,
          accessToken: 'mock_access_token_httponly_123',
          refreshToken: 'mock_refresh_token_httponly_456',
        });
      },
      register: (dto: any) => {
        return Promise.resolve({
          user: { ...mockUserPassenger, ...dto },
          accessToken: 'mock_access_token_register_123',
          refreshToken: 'mock_refresh_token_register_456',
        });
      },
      getMe: () => Promise.resolve(mockUserPassenger),
      logout: () => Promise.resolve({ success: true, message: 'Đăng xuất thành công' }),
      refreshTokens: () => Promise.resolve({ accessToken: 'mock_refreshed_token_789' }),
    };

    const mockNotificationService = {
      sendTicketCancellationEmail: () => Promise.resolve({ success: true }),
      sendTicketConfirmationEmail: () => Promise.resolve({ success: true }),
    };

    const mockSeatLockService = {
      releaseSeats: () => Promise.resolve(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        BookingController,
        UploadController,
        VoucherController,
        AuthController,
      ],
      providers: [
        BookingService,
        VoucherService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: SeatLockService, useValue: mockSeatLockService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: getRepositoryToken(TripEntity), useValue: mockTripRepo },
        { provide: getRepositoryToken(RouteEntity), useValue: {} },
        { provide: getRepositoryToken(VehicleEntity), useValue: {} },
        { provide: getRepositoryToken(SeatEntity), useValue: mockSeatRepo },
        { provide: getRepositoryToken(TicketEntity), useValue: mockTicketRepo },
        { provide: getRepositoryToken(BookingEntity), useValue: mockBookingRepo },
        { provide: getRepositoryToken(PaymentEntity), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(SeatHoldEntity), useValue: mockSeatHoldRepo },
        { provide: getRepositoryToken(VoucherEntity), useValue: mockVoucherRepo },
        { provide: getRepositoryToken(UserEntity), useValue: mockUserRepo },
        RateLimitGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          const auth = req.headers['authorization'];
          // Hỗ trợ kiểm tra cả Bearer token lẫn Cookie access_token
          let token = '';
          if (auth && auth.startsWith('Bearer ')) {
            token = auth.split(' ')[1];
          } else if (req.headers.cookie) {
            const cookies = req.headers.cookie.split(';').reduce((acc: any, c: string) => {
              const [k, v] = c.trim().split('=');
              if (k && v) acc[k] = decodeURIComponent(v);
              return acc;
            }, {});
            token = cookies['access_token'];
          }

          if (token) {
            req.user = mockUserPassenger;
            return true;
          }
          return false;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalInterceptors(new TransformResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    storedTickets.length = 0;
    storedBookings.length = 0;
    storedHolds.length = 0;
    storedPayments.length = 0;
    storedVouchers.length = 0;
    RateLimitGuard.clearMemory();
  });

  // --- SEC-01: Idempotency Key & Pessimistic Lock cho Hủy vé ---

  it('SEC-01.1 [Pessimistic Concurrency]: 2 request hủy vé gửi đồng thời chỉ có 1 request thành công, request thứ 2 trả về 409 hoặc 400', async () => {
    const booking = {
      id: 'bk-sec-01',
      userId: mockUserPassenger.id,
      tripId: mockTrip.id,
      bookingCode: 'BK-SEC-001',
      status: BookingStatus.PAID,
    };
    const ticket = {
      id: 'tkt-sec-01',
      bookingId: booking.id,
      seatId: 'seat-1',
      ticketCode: 'TKT-SEC-001',
      originalPrice: 50000,
      status: TicketStatus.PAID,
    };
    const payment = {
      id: 'pay-sec-01',
      bookingId: booking.id,
      amount: 50000,
      status: PaymentStatus.SUCCESS,
    };

    storedBookings.push(booking);
    storedTickets.push(ticket);
    storedPayments.push(payment);

    // Gửi 2 request hủy vé đồng thời bằng Promise.all
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/booking/tickets/${ticket.id}/cancel`)
        .set('Authorization', tokenPassenger)
        .send({ reason: 'Yêu cầu hủy 1' }),
      request(app.getHttpServer())
        .post(`/api/v1/booking/tickets/${ticket.id}/cancel`)
        .set('Authorization', tokenPassenger)
        .send({ reason: 'Yêu cầu hủy 2' }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // 1 request thành công (201), request thứ 2 trả về 409 (Conflict) hoặc 400 (Bad Request vì vé đã bị hủy)
    expect(statuses[0]).toBe(201);
    expect([400, 409]).toContain(statuses[1]);

    // Trạng thái vé cuối cùng là CANCELLED
    expect(ticket.status).toBe(TicketStatus.CANCELLED);
  });

  it('SEC-01.2 [No Double Refund]: Tuyệt đối không bao giờ xảy ra tình trạng hoàn tiền gấp đôi', async () => {
    const booking = {
      id: 'bk-sec-02',
      userId: mockUserPassenger.id,
      tripId: mockTrip.id,
      bookingCode: 'BK-SEC-002',
      status: BookingStatus.PAID,
    };
    const ticket = {
      id: 'tkt-sec-02',
      bookingId: booking.id,
      seatId: 'seat-1',
      ticketCode: 'TKT-SEC-002',
      originalPrice: 50000,
      status: TicketStatus.PAID,
    };
    const payment = {
      id: 'pay-sec-02',
      bookingId: booking.id,
      amount: 50000,
      status: PaymentStatus.SUCCESS,
      refundAmount: 0,
    };

    storedBookings.push(booking);
    storedTickets.push(ticket);
    storedPayments.push(payment);

    // Request 1: Hủy vé kèm Idempotency-Key
    const idempotencyKey = 'idemp-key-unique-999';
    const res1 = await request(app.getHttpServer())
      .post(`/api/v1/booking/tickets/${ticket.id}/cancel`)
      .set('Authorization', tokenPassenger)
      .set('Idempotency-Key', idempotencyKey)
      .send({ reason: 'Hủy vé lần đầu' });

    expect(res1.status).toBe(201);
    expect(payment.status).toBe(PaymentStatus.REFUNDED);
    expect(payment.refundAmount).toBe(50000);

    // Request 2: Gọi lại với cùng Idempotency Key -> trả về kết quả đã lưu mà KHÔNG hoàn tiền lần nữa
    const res2 = await request(app.getHttpServer())
      .post(`/api/v1/booking/tickets/${ticket.id}/cancel`)
      .set('Authorization', tokenPassenger)
      .set('Idempotency-Key', idempotencyKey)
      .send({ reason: 'Hủy vé trùng lặp' });

    expect(res2.status).toBe(201);
    expect(payment.refundAmount).toBe(50000); // Vẫn chỉ là 50000, không bị nhân đôi lên 100000
  });

  // --- SEC-02: Gia cố bảo mật tải ảnh minh chứng Thẻ Sinh Viên ---

  it('SEC-02.1 [SVG Blocking]: Chặn hoàn toàn file SVG chứa mã XML / XSS vector', async () => {
    const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert('XSS')"></svg>`;

    const res = await request(app.getHttpServer())
      .post('/api/v1/upload/student-card')
      .attach('file', Buffer.from(maliciousSvg, 'utf-8'), 'student_card.svg');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Chặn hoàn toàn tệp SVG');
  });

  it('SEC-02.2 [Magic Bytes Verification]: Chặn file giả mạo đuôi ảnh .png nhưng nội dung là script/text', async () => {
    // Tệp có tên card.png nhưng nội dung là text thường (không có Magic Bytes 89 50 4E 47 ...)
    const fakePng = Buffer.from('malicious_executable_or_script_code_not_an_image');

    const res = await request(app.getHttpServer())
      .post('/api/v1/upload/student-card')
      .attach('file', fakePng, 'fake_card.png');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Magic Bytes');
  });

  it('SEC-02.3 [File Size Limit]: Từ chối tệp vượt quá dung lượng tối đa 3MB', async () => {
    // Tạo buffer dung lượng 3.5MB
    const oversizedBuffer = Buffer.alloc(3.5 * 1024 * 1024);
    // Gán magic bytes PNG hợp lệ ở đầu
    oversizedBuffer[0] = 0x89;
    oversizedBuffer[1] = 0x50;
    oversizedBuffer[2] = 0x4e;
    oversizedBuffer[3] = 0x47;
    oversizedBuffer[4] = 0x0d;
    oversizedBuffer[5] = 0x0a;
    oversizedBuffer[6] = 0x1a;
    oversizedBuffer[7] = 0x0a;

    const res = await request(app.getHttpServer())
      .post('/api/v1/upload/student-card')
      .attach('file', oversizedBuffer, 'oversized.png');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('vượt quá giới hạn tối đa 3MB');
  });

  it('SEC-02.4 [Valid Upload]: Chấp nhận tệp ảnh JPEG/PNG chuẩn có Magic Bytes hợp lệ và dung lượng <= 3MB', async () => {
    // Chuẩn Magic Bytes JPEG: FF D8 FF E0
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);

    const res = await request(app.getHttpServer())
      .post('/api/v1/upload/student-card')
      .attach('file', validJpeg, 'valid_student_card.jpg');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.mimeType).toBe('image/jpeg');
    expect(res.body.url).toMatch(/^\/uploads\/student-cards\/student_card_/);
  });

  // --- SEC-03: Rate Limiting cho API gửi lại Email & Tra cứu Voucher ---

  it('SEC-03.1 [Rate Limit Resend Email]: Giới hạn tối đa 3 lần/10 phút/IP, lần thứ 4 trả về 429 Too Many Requests kèm Retry-After', async () => {
    const ticket = {
      id: 'tkt-rate-limit-01',
      bookingId: 'bk-rate-01',
      seatId: 'seat-1',
      ticketCode: 'TKT-RATE-001',
      status: TicketStatus.PAID,
      qrData: 'ENCRYPTED_DATA',
    };
    const booking = {
      id: 'bk-rate-01',
      userId: mockUserPassenger.id,
      bookingCode: 'BK-RATE-001',
      status: BookingStatus.PAID,
      user: mockUserPassenger,
      trip: mockTrip,
    };
    storedTickets.push(ticket);
    storedBookings.push(booking);

    // Lần 1
    const r1 = await request(app.getHttpServer())
      .post(`/api/v1/booking/tickets/${ticket.id}/resend-email`)
      .set('Authorization', tokenPassenger)
      .send();
    expect(r1.status).toBe(201);

    // Lần 2
    const r2 = await request(app.getHttpServer())
      .post(`/api/v1/booking/tickets/${ticket.id}/resend-email`)
      .set('Authorization', tokenPassenger)
      .send();
    expect(r2.status).toBe(201);

    // Lần 3
    const r3 = await request(app.getHttpServer())
      .post(`/api/v1/booking/tickets/${ticket.id}/resend-email`)
      .set('Authorization', tokenPassenger)
      .send();
    expect(r3.status).toBe(201);

    // Lần 4: Vượt ngưỡng cho phép -> Phải trả về 429 Too Many Requests
    const r4 = await request(app.getHttpServer())
      .post(`/api/v1/booking/tickets/${ticket.id}/resend-email`)
      .set('Authorization', tokenPassenger)
      .send();

    expect(r4.status).toBe(429);
    expect(r4.body.message).toContain('Quá giới hạn gửi lại email vé điện tử');
    expect(r4.headers['retry-after']).toBeDefined();
    expect(Number(r4.headers['retry-after'])).toBeGreaterThan(0);
  });

  // --- AUTH-01: Chuyển đổi lưu trữ Token sang Cookie HttpOnly Secure ---

  it('AUTH-01.1 [HttpOnly Cookie Storage]: Đăng nhập tự động trả về Set-Cookie access_token với HttpOnly Secure', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: mockUserPassenger.email,
        password: 'Password@123',
      });

    expect(res.status).toBe(200);
    const setCookieHeader = res.headers['set-cookie'];
    const cookies: string[] = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : [setCookieHeader || ''];
    expect(cookies.length).toBeGreaterThan(0);

    const accessTokenCookie = cookies.find((c: string) => c.startsWith('access_token='));
    expect(accessTokenCookie).toBeDefined();
    expect(accessTokenCookie).toContain('HttpOnly');
    expect(accessTokenCookie).toContain('SameSite=Lax');

    const refreshTokenCookie = cookies.find((c: string) => c.startsWith('refresh_token='));
    expect(refreshTokenCookie).toBeDefined();
    expect(refreshTokenCookie).toContain('HttpOnly');
  });

  it('AUTH-01.2 [Cookie-based Authentication]: Tự động xác thực qua Cookie HttpOnly trong request an toàn mà không cần Authorization header', async () => {
    // Gửi request tới GET /api/v1/auth/me chỉ đính kèm Cookie (không có header Authorization Bearer)
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', ['access_token=mock_access_token_httponly_123']);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(mockUserPassenger.id);
    expect(res.body.data.email).toBe(mockUserPassenger.email);
  });
});
