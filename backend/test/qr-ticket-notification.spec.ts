import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

import { TripsController } from '../src/modules/trips/trips.controller.js';
import { TripsService } from '../src/modules/trips/trips.service.js';
import { BookingController } from '../src/modules/booking/booking.controller.js';
import { BookingService } from '../src/modules/booking/booking.service.js';
import { SeatLockService } from '../src/modules/booking/seat-lock.service.js';
import { PaymentController } from '../src/modules/payment/payment.controller.js';
import { PaymentService } from '../src/modules/payment/payment.service.js';
import { NotificationService } from '../src/modules/notification/notification.service.js';

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

import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor.js';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../src/common/guards/roles.guard.js';
import {
  TripStatus,
  TicketStatus,
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
} from '../src/common/constants/status.constant.js';
import { Role } from '../src/common/constants/roles.constant.js';
import {
  signQrPayload,
  verifyQrData,
  encryptQrPayload,
  decryptQrPayload,
} from '../src/common/utils/qr-code.util.js';

describe('QR Ticket, Anti-Counterfeiting, Verification & Email Notification HTTP Integration Tests', () => {
  let app: INestApplication;
  let notificationService: NotificationService;

  // Mock Data
  const mockTripId = 'trip-3001-uuid';
  const otherTripId = 'trip-9999-uuid';
  const mockVehicleId = 'vehicle-ev28-uuid';
  const mockRouteId = 'route-ct01-uuid';

  const mockRoute = {
    id: mockRouteId,
    routeCode: 'CT-01',
    name: 'Tuyến CT-01 Nội Thành Thái Nguyên',
    origin: 'Bến xe Trung Tâm',
    destination: 'Đại Học CNTT & TT (ICTU)',
    basePrice: 10000,
    studentPrice: 5000,
  };

  const mockVehicle = {
    id: mockVehicleId,
    plateNumber: '20B-999.88',
    licensePlate: '20B-999.88',
    seatCapacity: 4,
    vehicleType: 'electric_bus',
  };

  const mockTrip = {
    id: mockTripId,
    routeId: mockRouteId,
    vehicleId: mockVehicleId,
    departureTime: new Date('2026-09-28T07:15:00.000Z'),
    status: TripStatus.SCHEDULED,
    route: mockRoute,
    vehicle: mockVehicle,
  };

  const mockSeats = [
    {
      id: 'seat-1-uuid',
      vehicleId: mockVehicleId,
      seatNumber: '01A',
      rowNumber: 1,
      columnLabel: 'A',
      seatType: 'standard',
    },
    {
      id: 'seat-2-uuid',
      vehicleId: mockVehicleId,
      seatNumber: '01B',
      rowNumber: 1,
      columnLabel: 'B',
      seatType: 'standard',
    },
  ];

  const mockUser1 = {
    id: 'user-1-uuid',
    email: 'user1@ictu.edu.vn',
    fullName: 'Nguyễn Văn A',
    phoneNumber: '0981111111',
    role: Role.PASSENGER,
  };

  const mockConductor = {
    id: 'conductor-uuid',
    email: 'driver@ictu.edu.vn',
    fullName: 'Tài xế / Phụ xe ICTU',
    phoneNumber: '0989999999',
    role: Role.DRIVER,
  };

  const createMockToken = (user: any) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ ...user, sub: user.id })).toString('base64url');
    return `Bearer ${header}.${payload}.mockSignature`;
  };

  const tokenUser1 = createMockToken(mockUser1);
  const tokenConductor = createMockToken(mockConductor);

  // In-memory repositories
  const storedTickets: any[] = [];
  const storedBookings: any[] = [];
  const storedHolds: any[] = [];
  const storedPayments: any[] = [];

  let simulatedCurrentUser: any = mockUser1;

  beforeAll(async () => {
    const mockTripRepo = {
      findOne: (opts: any) => {
        if (opts?.where?.id === mockTripId) {
          return Promise.resolve({ ...mockTrip });
        }
        return Promise.resolve(null);
      },
      createQueryBuilder: () => ({
        innerJoinAndSelect: function () { return this; },
        leftJoinAndSelect: function () { return this; },
        where: function () { return this; },
        andWhere: function () { return this; },
        orderBy: function () { return this; },
        getMany: () => Promise.resolve([mockTrip]),
      }),
    };

    const mockSeatRepo = {
      find: (opts: any) => {
        if (opts?.where?.id?._value) {
          const ids = opts.where.id._value;
          return Promise.resolve(mockSeats.filter((s) => ids.includes(s.id)));
        }
        return Promise.resolve(mockSeats);
      },
      findOne: (opts: any) => {
        const seat = mockSeats.find((s) => s.id === opts?.where?.id);
        return Promise.resolve(seat || null);
      },
    };

    const mockUserRepo = {
      findOne: (opts: any) => {
        if (opts?.where?.id === mockUser1.id) return Promise.resolve(mockUser1);
        if (opts?.where?.id === mockConductor.id) return Promise.resolve(mockConductor);
        return Promise.resolve(null);
      },
    };

    const mockVoucherRepo = {
      findOne: () => Promise.resolve(null),
      save: (v: any) => Promise.resolve(v),
    };

    const mockTicketRepo = {
      create: (data: any) => ({
        id: `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date(),
        ...data,
      }),
      save: (data: any) => {
        if (Array.isArray(data)) {
          storedTickets.push(...data);
          return Promise.resolve(data);
        }
        const idx = storedTickets.findIndex((t) => t.id === data.id);
        if (idx >= 0) {
          storedTickets[idx] = { ...storedTickets[idx], ...data };
          return Promise.resolve(storedTickets[idx]);
        }
        storedTickets.push(data);
        return Promise.resolve(data);
      },
      find: (opts: any) => {
        let results = [...storedTickets];
        if (opts?.where?.bookingId) {
          results = results.filter((t) => t.bookingId === opts.where.bookingId);
        }
        for (const t of results) {
          if (opts?.relations?.seat) {
            t.seat = mockSeats.find((s) => s.id === t.seatId);
          }
        }
        return Promise.resolve(results);
      },
      findOne: (opts: any) => {
        let ticket: any = null;
        if (Array.isArray(opts?.where)) {
          for (const cond of opts.where) {
            ticket = storedTickets.find((t) => (cond.id && t.id === cond.id) || (cond.ticketCode && t.ticketCode === cond.ticketCode));
            if (ticket) break;
          }
        } else if (opts?.where?.ticketCode) {
          ticket = storedTickets.find((t) => t.ticketCode === opts.where.ticketCode);
        } else if (opts?.where?.id) {
          ticket = storedTickets.find((t) => t.id === opts.where.id);
        }

        if (ticket) {
          if (opts?.relations?.booking) {
            ticket.booking = storedBookings.find((b) => b.id === ticket.bookingId);
            if (ticket.booking) {
              ticket.booking.trip = mockTrip;
              ticket.booking.user = mockUser1;
            }
          }
          if (opts?.relations?.seat) {
            ticket.seat = mockSeats.find((s) => s.id === ticket.seatId);
          }
        }
        return Promise.resolve(ticket || null);
      },
      update: (criteria: any, values: any) => {
        for (const t of storedTickets) {
          if (criteria.bookingId && t.bookingId === criteria.bookingId) {
            Object.assign(t, values);
          }
        }
        return Promise.resolve({ affected: storedTickets.length });
      },
      createQueryBuilder: () => ({
        innerJoin: function () { return this; },
        leftJoinAndSelect: function () { return this; },
        select: function () { return this; },
        where: function () { return this; },
        andWhere: function () { return this; },
        getCount: () => Promise.resolve(storedTickets.length),
        getMany: () => Promise.resolve(storedTickets),
      }),
    };

    const mockBookingRepo = {
      create: (data: any) => ({
        id: `booking-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        bookingTime: new Date(),
        ...data,
      }),
      save: (data: any) => {
        const idx = storedBookings.findIndex((b) => b.id === data.id);
        if (idx >= 0) {
          storedBookings[idx] = { ...storedBookings[idx], ...data };
          return Promise.resolve(storedBookings[idx]);
        }
        storedBookings.push(data);
        return Promise.resolve(data);
      },
      findOne: (opts: any) => {
        const booking = storedBookings.find((b) => b.id === opts?.where?.id);
        if (booking) {
          booking.user = mockUser1;
          booking.trip = mockTrip;
          if (opts?.relations?.tickets) {
            booking.tickets = storedTickets.filter((t) => t.bookingId === booking.id);
          }
          if (opts?.relations?.payments) {
            booking.payments = storedPayments.filter((p) => p.bookingId === booking.id);
          }
        }
        return Promise.resolve(booking || null);
      },
      find: () => Promise.resolve(storedBookings),
      update: (id: string, values: any) => {
        const booking = storedBookings.find((b) => b.id === id);
        if (booking) Object.assign(booking, values);
        return Promise.resolve({ affected: 1 });
      },
    };

    const mockHoldRepo = {
      create: (data: any) => ({ id: `hold-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...data }),
      save: (data: any) => {
        if (Array.isArray(data)) {
          storedHolds.push(...data);
          return Promise.resolve(data);
        }
        storedHolds.push(data);
        return Promise.resolve(data);
      },
      update: () => Promise.resolve({ affected: 1 }),
      createQueryBuilder: () => ({
        where: function () { return this; },
        andWhere: function () { return this; },
        getMany: () => Promise.resolve([]),
        update: () => ({
          set: () => ({
            where: () => ({
              execute: () => Promise.resolve({ affected: 0 }),
            }),
          }),
        }),
      }),
    };

    const mockPaymentRepo = {
      create: (data: any) => ({
        id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date(),
        ...data,
      }),
      save: (data: any) => {
        const idx = storedPayments.findIndex((p) => p.id === data.id);
        if (idx >= 0) {
          storedPayments[idx] = { ...storedPayments[idx], ...data };
          return Promise.resolve(storedPayments[idx]);
        }
        storedPayments.push(data);
        return Promise.resolve(data);
      },
      findOne: (opts: any) => {
        const payment = storedPayments.find((p) => p.transactionId === opts?.where?.transactionId);
        if (payment && opts?.relations?.booking) {
          payment.booking = storedBookings.find((b) => b.id === payment.bookingId);
          if (payment.booking) {
            payment.booking.user = mockUser1;
            payment.booking.trip = mockTrip;
            payment.booking.tickets = storedTickets.filter((t) => t.bookingId === payment.booking.id);
          }
        }
        return Promise.resolve(payment || null);
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TripsController, BookingController, PaymentController],
      providers: [
        TripsService,
        BookingService,
        SeatLockService,
        PaymentService,
        NotificationService,
        { provide: getRepositoryToken(TripEntity), useValue: mockTripRepo },
        { provide: getRepositoryToken(RouteEntity), useValue: {} },
        { provide: getRepositoryToken(VehicleEntity), useValue: {} },
        { provide: getRepositoryToken(SeatEntity), useValue: mockSeatRepo },
        { provide: getRepositoryToken(TicketEntity), useValue: mockTicketRepo },
        { provide: getRepositoryToken(BookingEntity), useValue: mockBookingRepo },
        { provide: getRepositoryToken(VoucherEntity), useValue: mockVoucherRepo },
        { provide: getRepositoryToken(UserEntity), useValue: mockUserRepo },
        { provide: getRepositoryToken(SeatHoldEntity), useValue: mockHoldRepo },
        { provide: getRepositoryToken(PaymentEntity), useValue: mockPaymentRepo },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = simulatedCurrentUser;
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformResponseInterceptor());

    await app.init();
    notificationService = moduleRef.get(NotificationService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // TEST 1: Tạo đơn đặt vé và lấy mã QR độc lập
  let createdBookingId: string;
  let createdTicketId: string;
  let createdTicketCode: string;
  let rawQrData: string;

  it('[TC-01] Tạo đơn đặt vé -> API GET /tickets/:id/qr trả về đầy đủ mã vé, chữ ký số HMAC-SHA256 và ảnh Data URL', async () => {
    simulatedCurrentUser = mockUser1;

    // Giữ ghế 01A
    await request(app.getHttpServer())
      .post('/api/v1/booking/hold-seats')
      .set('Authorization', tokenUser1)
      .send({ tripId: mockTripId, seatIds: ['seat-1-uuid'] })
      .expect(201);

    // Tạo đơn đặt vé
    const bookingRes = await request(app.getHttpServer())
      .post('/api/v1/booking/create')
      .set('Authorization', tokenUser1)
      .send({
        tripId: mockTripId,
        passengers: [{ seatId: 'seat-1-uuid', passengerName: 'Nguyễn Văn A' }],
      })
      .expect(201);

    createdBookingId = bookingRes.body.data.bookingId;
    const ticket = bookingRes.body.data.tickets[0];
    createdTicketId = ticket.id;
    createdTicketCode = ticket.ticketCode;
    expect(createdTicketId).toBeDefined();

    // Gọi API lấy thông tin QR của vé
    const qrRes = await request(app.getHttpServer())
      .get(`/api/v1/booking/tickets/${createdTicketId}/qr`)
      .set('Authorization', tokenUser1)
      .expect(200);

    expect(qrRes.body.success).toBe(true);
    expect(qrRes.body.data.ticketCode).toBe(createdTicketCode);
    expect(qrRes.body.data.passengerName).toBe('Nguyễn Văn A');
    expect(qrRes.body.data.seatNumber).toBe('01A');
    expect(qrRes.body.data.qrData).toBeDefined();
    expect(qrRes.body.data.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(qrRes.body.data.signature).toBeDefined();

    rawQrData = qrRes.body.data.qrData;

    // Kiểm tra tính hợp lệ của chữ ký trong qrData
    const verifyResult = verifyQrData(rawQrData);
    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.payload?.ticketCode).toBe(createdTicketCode);
    expect(verifyResult.payload?.passengerName).toBe('Nguyễn Văn A');
  });

  // TEST 2: API Lấy chi tiết vé điện tử đầy đủ
  it('[TC-02] API GET /tickets/:id trả về đầy đủ metadata vé điện tử, lộ trình, giá vé và ảnh mã QR', async () => {
    simulatedCurrentUser = mockUser1;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/booking/tickets/${createdTicketId}`)
      .set('Authorization', tokenUser1)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.ticketId).toBe(createdTicketId);
    expect(res.body.data.ticketCode).toBe(createdTicketCode);
    expect(res.body.data.passengerName).toBe('Nguyễn Văn A');
    expect(res.body.data.seatNumber).toBe('01A');
    expect(res.body.data.status).toBe(TicketStatus.RESERVED);
    expect(res.body.data.routeName).toContain('CT-01');
    expect(res.body.data.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  // TEST 3: Quét mã QR khi vé CHƯA THANH TOÁN (RESERVED) -> Bị từ chối
  it('[TC-03] Tài xế quét mã QR của vé chưa thanh toán (RESERVED) -> Bị từ chối soát vé với 400 Bad Request', async () => {
    simulatedCurrentUser = mockConductor;

    const res = await request(app.getHttpServer())
      .post('/api/v1/trips/verify-qr')
      .set('Authorization', tokenConductor)
      .send({
        qrData: rawQrData,
        tripId: mockTripId,
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('chưa được thanh toán');
  });

  // TEST 4: Thanh toán thành công tự động gửi Email kèm ảnh mã QR
  it('[TC-04] Thanh toán VNPay thành công -> booking & ticket chuyển PAID, tự động kích hoạt gửi Email vé điện tử kèm mã QR', async () => {
    simulatedCurrentUser = mockUser1;

    // Tạo thanh toán
    const payUrlRes = await request(app.getHttpServer())
      .post('/api/v1/payment/create-url')
      .set('Authorization', tokenUser1)
      .send({
        bookingId: createdBookingId,
        paymentMethod: PaymentMethod.VNPAY,
      })
      .expect(201);

    const txnRef = payUrlRes.body.data.txnRef;

    // Giả lập callback VNPay thành công
    const secretKey = process.env.VNPAY_HASH_SECRET || 'SECRETKEYICTU2026BUS';
    const params: Record<string, string> = {
      vnp_TxnRef: txnRef,
      vnp_ResponseCode: '00',
      vnp_Amount: '1000000',
    };
    const signData = `vnp_Amount=${params.vnp_Amount}&vnp_ResponseCode=${params.vnp_ResponseCode}&vnp_TxnRef=${params.vnp_TxnRef}`;
    const secureHash = crypto.createHmac('sha512', secretKey).update(Buffer.from(signData, 'utf-8')).digest('hex');
    params['vnp_SecureHash'] = secureHash;

    const returnRes = await request(app.getHttpServer())
      .get('/api/v1/payment/vnpay-return')
      .query(params)
      .expect(200);

    expect(returnRes.body.data.isSuccess).toBe(true);

    // Kiểm tra NotificationService đã ghi nhận email gửi đi
    const sentEmails = notificationService.getSentNotifications({ ticketCode: createdTicketCode });
    expect(sentEmails.length).toBe(1);
    expect(sentEmails[0].recipientEmail).toBe(mockUser1.email);
    expect(sentEmails[0].subject).toContain(createdTicketCode);
    expect(sentEmails[0].htmlPreview).toContain('THANH TOÁN THÀNH CÔNG');
    expect(sentEmails[0].htmlPreview).toContain('data:image/png;base64,');
  });

  // TEST 5: Gửi lại Email vé điện tử theo yêu cầu hành khách
  it('[TC-05] Hành khách yêu cầu gửi lại Email vé điện tử qua POST /tickets/:id/resend-email thành công', async () => {
    simulatedCurrentUser = mockUser1;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/booking/tickets/${createdTicketId}/resend-email`)
      .set('Authorization', tokenUser1)
      .send({ email: 'nguyenvana.backup@gmail.com' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('gửi lại vé điện tử thành công');

    const sentEmails = notificationService.getSentNotifications({ recipientEmail: 'nguyenvana.backup@gmail.com' });
    expect(sentEmails.length).toBe(1);
    expect(sentEmails[0].ticketCode).toBe(createdTicketCode);
  });

  // TEST 6: Tài xế quét mã QR hợp lệ (vé PAID) -> Soát vé thành công
  it('[TC-06] Tài xế quét mã QR hợp lệ (vé PAID) -> Soát vé thành công, cập nhật ticket status = CHECKED_IN', async () => {
    simulatedCurrentUser = mockConductor;

    const res = await request(app.getHttpServer())
      .post('/api/v1/trips/verify-qr')
      .set('Authorization', tokenConductor)
      .send({
        qrData: rawQrData,
        tripId: mockTripId,
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
    expect(res.body.message).toContain('Soát vé thành công');
    expect(res.body.passenger).toBe('Nguyễn Văn A');
    expect(res.body.seat).toBe('01A');
    expect(res.body.ticketCode).toBe(createdTicketCode);
    expect(res.body.status).toBe(TicketStatus.CHECKED_IN);
    expect(res.body.checkedInAt).toBeDefined();

    // Kiểm tra trong CSDL vé đã là CHECKED_IN
    const ticketInDb = storedTickets.find((t) => t.id === createdTicketId);
    expect(ticketInDb.status).toBe(TicketStatus.CHECKED_IN);
    expect(ticketInDb.checkedInAt).toBeDefined();
    expect(ticketInDb.checkedInBy).toBe(mockConductor.id);
  });

  // TEST 7: Quét lại mã QR đã soát trước đó -> Báo động vé trùng lặp
  it('[TC-07] Quét lại mã QR đã soát vé trước đó -> Phát hiện gian lận và cảnh báo vé đã được soát trước đó', async () => {
    simulatedCurrentUser = mockConductor;

    const res = await request(app.getHttpServer())
      .post('/api/v1/trips/verify-qr')
      .set('Authorization', tokenConductor)
      .send({
        qrData: rawQrData,
        tripId: mockTripId,
      })
      .expect(201);

    expect(res.body.success).toBe(false);
    expect(res.body.valid).toBe(false);
    expect(res.body.alreadyCheckedIn).toBe(true);
    expect(res.body.message).toContain('CẢNH BÁO: Vé này đã được soát trước đó');
    expect(res.body.checkedInAt).toBeDefined();
    expect(res.body.passenger).toBe('Nguyễn Văn A');
  });

  // TEST 8: Quét mã QR bị can thiệp nội dung (tampered: sửa số ghế / tên khách) -> Chữ ký sai, bị từ chối
  it('[TC-08] Quét mã QR bị làm giả/chỉnh sửa nội dung (sửa số ghế từ 01A thành 02B) -> Chữ ký sai, bị từ chối 400', async () => {
    simulatedCurrentUser = mockConductor;

    // Giả mạo dữ liệu: thay đổi seatNumber nhưng giữ nguyên chữ ký sig
    const parsed = JSON.parse(rawQrData);
    parsed.seatNumber = '02B'; // Sửa số ghế trái phép
    const tamperedQrData = JSON.stringify(parsed);

    const res = await request(app.getHttpServer())
      .post('/api/v1/trips/verify-qr')
      .set('Authorization', tokenConductor)
      .send({
        qrData: tamperedQrData,
        tripId: mockTripId,
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Chữ ký số không hợp lệ');
  });

  // TEST 9: Quét mã QR của vé sai chuyến xe (khác tripId) -> Bị từ chối
  it('[TC-09] Quét mã QR của vé trên chuyến xe khác -> Bị từ chối với 400 Bad Request', async () => {
    simulatedCurrentUser = mockConductor;

    const res = await request(app.getHttpServer())
      .post('/api/v1/trips/verify-qr')
      .set('Authorization', tokenConductor)
      .send({
        qrData: rawQrData,
        tripId: otherTripId, // Chuyến xe khác
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('không thuộc về chuyến xe hiện tại');
  });

  // TEST 10: Chống làm giả nâng cao bằng mã hóa token AES-256 đối xứng
  it('[TC-10] Chức năng mã hóa AES-256 đối xứng biến thông tin vé thành chuỗi token an toàn chống dịch ngược', () => {
    const payload = {
      ticketCode: 'TIK-AES-TEST-001',
      bookingCode: 'BKG-AES-001',
      tripId: mockTripId,
      seatNumber: '01A',
      passengerName: 'Nguyễn Văn A',
      issuedAt: Date.now(),
    };

    const encryptedToken = encryptQrPayload(payload);
    expect(encryptedToken).toBeDefined();
    expect(encryptedToken).toContain('.'); // iv.cipher

    const decrypted = decryptQrPayload(encryptedToken);
    expect(decrypted).not.toBeNull();
    expect(decrypted?.ticketCode).toBe('TIK-AES-TEST-001');
    expect(decrypted?.passengerName).toBe('Nguyễn Văn A');
    expect(decrypted?.seatNumber).toBe('01A');
  });
});
