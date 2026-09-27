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

describe('Seat Hold & Payment Synchronization HTTP Integration Tests (10 Yêu Cầu Nghiệp Vụ)', () => {
  let app: INestApplication;
  let seatLockService: SeatLockService;
  let paymentService: PaymentService;

  // Mock Data
  const mockTripId = 'trip-2001-uuid';
  const mockVehicleId = 'vehicle-ev28-uuid';
  const mockRouteId = 'route-ct01-uuid';

  const mockRoute = {
    id: mockRouteId,
    routeCode: 'CT-01',
    name: 'Tuyến CT-01 Nội Thành Thái Nguyên',
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
    {
      id: 'seat-3-uuid',
      vehicleId: mockVehicleId,
      seatNumber: '02A',
      rowNumber: 2,
      columnLabel: 'A',
      seatType: 'standard',
    },
    {
      id: 'seat-4-uuid',
      vehicleId: mockVehicleId,
      seatNumber: '02B',
      rowNumber: 2,
      columnLabel: 'B',
      seatType: 'standard',
    },
  ];

  // In-memory repositories
  const storedHolds: any[] = [];
  const storedTickets: any[] = [];
  const storedBookings: any[] = [];
  const storedPayments: any[] = [];

  const mockUser1 = {
    id: 'user-1-uuid',
    email: 'user1@ictu.edu.vn',
    fullName: 'Nguyễn Văn A',
    phoneNumber: '0981111111',
    studentId: 'DTC215111',
  };

  const mockUser2 = {
    id: 'user-2-uuid',
    email: 'user2@ictu.edu.vn',
    fullName: 'Trần Thị B',
    phoneNumber: '0982222222',
    studentId: 'DTC215222',
  };

  const createMockToken = (user: any) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ ...user, sub: user.id })).toString('base64url');
    return `Bearer ${header}.${payload}.mockSignature`;
  };

  const tokenUser1 = createMockToken(mockUser1);
  const tokenUser2 = createMockToken(mockUser2);

  let simulatedCurrentUser: any = mockUser1;

  beforeAll(async () => {
    // Mock repositories
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
        if (opts?.where?.id === mockUser2.id) return Promise.resolve(mockUser2);
        return Promise.resolve(null);
      },
    };

    const mockVoucherRepo = {
      findOne: () => Promise.resolve(null),
      save: (v: any) => Promise.resolve(v),
    };

    const mockTicketRepo = {
      create: (data: any) => ({ id: `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...data }),
      save: (data: any) => {
        if (Array.isArray(data)) {
          storedTickets.push(...data);
          return Promise.resolve(data);
        }
        storedTickets.push(data);
        return Promise.resolve(data);
      },
      find: (opts: any) => {
        if (opts?.where?.bookingId) {
          return Promise.resolve(storedTickets.filter((t) => t.bookingId === opts.where.bookingId));
        }
        return Promise.resolve(storedTickets);
      },
      findOne: (opts: any) => {
        const ticket = storedTickets.find((t) => t.id === opts?.where?.id);
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
      createQueryBuilder: () => {
        let tripFilter: string | null = null;
        let seatFilter: string[] | null = null;

        const qb = {
          innerJoin: function () { return this; },
          leftJoinAndSelect: function () { return this; },
          select: function () { return this; },
          where: function (str: string, params: any) {
            if (params?.tripId) tripFilter = params.tripId;
            return this;
          },
          andWhere: function (str: string, params: any) {
            if (params?.seatIds) seatFilter = params.seatIds;
            return this;
          },
          getCount: () => {
            const active = storedTickets.filter((t) => {
              if (t.status === TicketStatus.CANCELLED || t.status === TicketStatus.EXPIRED) return false;
              const booking = storedBookings.find((b) => b.id === t.bookingId);
              if (booking && booking.status === BookingStatus.PENDING && booking.expiresAt <= new Date()) {
                return false;
              }
              return true;
            });
            return Promise.resolve(active.length);
          },
          getMany: () => {
            const now = new Date();
            const filtered = storedTickets.filter((t) => {
              if (tripFilter && t.tripId && t.tripId !== tripFilter) return false;
              if (seatFilter && !seatFilter.includes(t.seatId)) return false;
              if (t.status === TicketStatus.CANCELLED || t.status === TicketStatus.EXPIRED) return false;
              const booking = storedBookings.find((b) => b.id === t.bookingId);
              if (booking && booking.status === BookingStatus.PENDING && new Date(booking.expiresAt) <= now) {
                return false;
              }
              return true;
            });
            return Promise.resolve(filtered);
          },
        };
        return qb;
      },
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
        if (booking && opts?.relations?.tickets) {
          booking.tickets = storedTickets.filter((t) => t.bookingId === booking.id);
        }
        if (booking && opts?.relations?.payments) {
          booking.payments = storedPayments.filter((p) => p.bookingId === booking.id);
        }
        return Promise.resolve(booking || null);
      },
      find: (opts: any) => {
        let result = [...storedBookings];
        if (opts?.where?.status) {
          result = result.filter((b) => b.status === opts.where.status);
        }
        for (const b of result) {
          if (opts?.relations?.tickets) {
            b.tickets = storedTickets.filter((t) => t.bookingId === b.id);
          }
        }
        return Promise.resolve(result);
      },
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
      update: (criteria: any, values: any) => {
        let count = 0;
        for (const h of storedHolds) {
          let match = true;
          if (criteria.tripId && h.tripId !== criteria.tripId) match = false;
          if (criteria.seatId?._value && !criteria.seatId._value.includes(h.seatId)) match = false;
          if (criteria.status && h.status !== criteria.status) match = false;
          if (match) {
            Object.assign(h, values);
            count++;
          }
        }
        return Promise.resolve({ affected: count });
      },
      createQueryBuilder: () => {
        let tripFilter: string | null = null;
        let seatFilter: string[] | null = null;
        let statusFilter: string | null = null;
        let expiresAtMin: Date | null = null;

        const qb: any = {
          where: function (str: string, params: any) {
            if (params?.tripId) tripFilter = params.tripId;
            return this;
          },
          andWhere: function (str: string, params: any) {
            if (params?.seatIds) seatFilter = params.seatIds;
            if (params?.status) statusFilter = params.status;
            if (params?.now) expiresAtMin = params.now;
            return this;
          },
          getMany: () => {
            const res = storedHolds.filter((h) => {
              if (tripFilter && h.tripId !== tripFilter) return false;
              if (seatFilter && !seatFilter.includes(h.seatId)) return false;
              if (statusFilter && h.status !== statusFilter) return false;
              if (expiresAtMin && new Date(h.expiresAt) <= expiresAtMin) return false;
              return true;
            });
            return Promise.resolve(res);
          },
          update: function () {
            return {
              set: (values: any) => ({
                where: (cond: string, params: any) => ({
                  execute: () => {
                    let updated = 0;
                    for (const h of storedHolds) {
                      let match = true;
                      if (params?.status && h.status !== params.status) match = false;
                      if (params?.tripId && h.tripId !== params.tripId) match = false;
                      if (params?.userId && h.userId !== params.userId) match = false;
                      if (params?.seatIds && !params.seatIds.includes(h.seatId)) match = false;
                      if (params?.now && new Date(h.expiresAt) > params.now) match = false;
                      if (match) {
                        Object.assign(h, values);
                        updated++;
                      }
                    }
                    return Promise.resolve({ affected: updated });
                  },
                }),
              }),
            };
          },
        };
        return qb;
      },
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
            payment.booking.tickets = storedTickets.filter((t) => t.bookingId === payment.booking.id);
          }
        }
        return Promise.resolve(payment || null);
      },
    };

    // Testing Module
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TripsController, BookingController, PaymentController],
      providers: [
        TripsService,
        BookingService,
        SeatLockService,
        PaymentService,
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
    seatLockService = moduleRef.get(SeatLockService);
    paymentService = moduleRef.get(PaymentService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // TEST 1: Giữ chỗ tạm thời 10 phút & Lưu thông tin vào CSDL
  it('[TC-01] User 1 giữ thành công ghế 01A (seat-1) và 01B (seat-2) trong 10 phút, CSDL lưu SeatHoldEntity', async () => {
    simulatedCurrentUser = mockUser1;

    const res = await request(app.getHttpServer())
      .post('/api/v1/booking/hold-seats')
      .set('Authorization', tokenUser1)
      .send({
        tripId: mockTripId,
        seatIds: ['seat-1-uuid', 'seat-2-uuid'],
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('10 phút');
    expect(res.body.holdToken).toBeDefined();
    expect(res.body.lockedSeats).toEqual(['seat-1-uuid', 'seat-2-uuid']);
    expect(res.body.lockedSeatNumbers).toEqual(['01A', '01B']);
    expect(res.body.remainingSeconds).toBe(600);

    // Kiểm tra thời gian hết hạn đúng 10 phút (sai lệch không quá 2 giây)
    const startTime = new Date(res.body.startTime).getTime();
    const expiresAt = new Date(res.body.expiresAt).getTime();
    expect(expiresAt - startTime).toBeGreaterThanOrEqual(599000);
    expect(expiresAt - startTime).toBeLessThanOrEqual(601000);

    // Kiểm tra CSDL storedHolds có 2 bản ghi với status = 'holding'
    expect(storedHolds.length).toBe(2);
    expect(storedHolds[0].status).toBe('holding');
    expect(storedHolds[0].userId).toBe(mockUser1.id);
    expect(storedHolds[0].seatId).toBe('seat-1-uuid');
    expect(storedHolds[1].seatId).toBe('seat-2-uuid');
  });

  // TEST 2: Ngăn người dùng khác chọn ghế đang được giữ
  it('[TC-02] Ngăn User 2 chọn ghế 01A đang được User 1 giữ -> trả về 409 Conflict với failedSeats', async () => {
    simulatedCurrentUser = mockUser2;

    const res = await request(app.getHttpServer())
      .post('/api/v1/booking/hold-seats')
      .set('Authorization', tokenUser2)
      .send({
        tripId: mockTripId,
        seatIds: ['seat-1-uuid'],
      })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Ghế đang được giữ bởi hành khách khác');
    expect(res.body.failedSeats).toContain('01A');
  });

  // TEST 3: Cùng người dùng được phép gia hạn giữ chỗ
  it('[TC-03] User 1 gửi lại cùng ghế mình đang giữ -> cho phép gia hạn giữ chỗ (re-hold)', async () => {
    simulatedCurrentUser = mockUser1;

    const res = await request(app.getHttpServer())
      .post('/api/v1/booking/hold-seats')
      .set('Authorization', tokenUser1)
      .send({
        tripId: mockTripId,
        seatIds: ['seat-1-uuid', 'seat-2-uuid'],
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.lockedSeats).toEqual(['seat-1-uuid', 'seat-2-uuid']);
  });

  // TEST 4: Sơ đồ ghế hiển thị đúng trạng thái holding và isHeldByMe
  it('[TC-04] Sơ đồ ghế realtime phân biệt ghế đang giữ giữa User 1 và User 2', async () => {
    // Với User 1
    simulatedCurrentUser = mockUser1;
    const res1 = await request(app.getHttpServer())
      .get(`/api/v1/trips/${mockTripId}/seat-map`)
      .set('Authorization', tokenUser1)
      .expect(200);

    const seat1ForUser1 = res1.body.data.seats.find((s: any) => s.seatId === 'seat-1-uuid');
    expect(seat1ForUser1.bookingStatus).toBe('holding');
    expect(seat1ForUser1.isHeldByMe).toBe(true);
    expect(seat1ForUser1.holdExpiresAt).toBeDefined();

    // Với User 2
    simulatedCurrentUser = mockUser2;
    const res2 = await request(app.getHttpServer())
      .get(`/api/v1/trips/${mockTripId}/seat-map`)
      .set('Authorization', tokenUser2)
      .expect(200);

    const seat1ForUser2 = res2.body.data.seats.find((s: any) => s.seatId === 'seat-1-uuid');
    expect(seat1ForUser2.bookingStatus).toBe('holding');
    expect(seat1ForUser2.isHeldByMe).toBe(false);
  });

  // TEST 5: Tự động giải phóng ghế khi hết 10 phút, sơ đồ ghế cập nhật về còn trống
  it('[TC-05] Hết 10 phút giữ chỗ -> ghế tự động chuyển về available và User 2 giữ thành công', async () => {
    // Giả lập 10 phút đã trôi qua: chỉnh expiresAt của storedHolds và Redis lock về quá khứ
    const pastTime = new Date(Date.now() - 1000);
    for (const h of storedHolds) {
      h.expiresAt = pastTime;
    }
    // Xóa lock RAM để khớp với TTL hết hạn
    await seatLockService.releaseSeats(mockTripId, ['seat-1-uuid', 'seat-2-uuid'], mockUser1.id);

    // Gọi sơ đồ ghế: ghế 01A và 01B phải lập tức quay về 'available'
    const res = await request(app.getHttpServer())
      .get(`/api/v1/trips/${mockTripId}/seat-map`)
      .expect(200);

    const seat1 = res.body.data.seats.find((s: any) => s.seatId === 'seat-1-uuid');
    const seat2 = res.body.data.seats.find((s: any) => s.seatId === 'seat-2-uuid');
    expect(seat1.bookingStatus).toBe('available');
    expect(seat2.bookingStatus).toBe('available');
    expect(res.body.data.availableCount).toBe(4);
    expect(res.body.data.holdingCount).toBe(0);

    // User 2 lúc này giữ chỗ ghế 01A thành công mỹ mãn!
    simulatedCurrentUser = mockUser2;
    const holdRes = await request(app.getHttpServer())
      .post('/api/v1/booking/hold-seats')
      .set('Authorization', tokenUser2)
      .send({
        tripId: mockTripId,
        seatIds: ['seat-1-uuid'],
      })
      .expect(201);

    expect(holdRes.body.success).toBe(true);
    expect(holdRes.body.lockedSeats).toContain('seat-1-uuid');
  });

  // TEST 6: Dọn dẹp bản ghi hết hạn (Cleanup Expired Holds)
  it('[TC-06] Endpoint cleanup-expired cập nhật các bản ghi quá hạn sang status = expired', async () => {
    const cleanupRes = await request(app.getHttpServer())
      .post('/api/v1/booking/cleanup-expired')
      .expect(201);

    expect(cleanupRes.body.success).toBe(true);
    // Các bản ghi cũ quá hạn đã được chuyển sang 'expired'
    const expiredHolds = storedHolds.filter((h) => h.status === 'expired');
    expect(expiredHolds.length).toBeGreaterThan(0);
  });

  // TEST 7: Xác nhận giữ chỗ thành công khi thanh toán hoàn tất (Confirm Payment)
  it('[TC-07] Tạo đơn đặt vé -> thanh toán VNPay thành công -> booking & tickets sang PAID, seat_holds sang booked', async () => {
    simulatedCurrentUser = mockUser2;

    // User 2 đặt vé cho ghế 01A đang giữ
    const bookingRes = await request(app.getHttpServer())
      .post('/api/v1/booking/create')
      .send({
        tripId: mockTripId,
        passengers: [{ seatId: 'seat-1-uuid', passengerName: 'Trần Thị B' }],
      })
      .expect(201);

    const bookingId = bookingRes.body.data.bookingId;
    expect(bookingId).toBeDefined();

    // Tạo URL thanh toán
    const payUrlRes = await request(app.getHttpServer())
      .post('/api/v1/payment/create-url')
      .send({
        bookingId,
        paymentMethod: PaymentMethod.VNPAY,
      })
      .expect(201);

    const txnRef = payUrlRes.body.data.txnRef;
    expect(txnRef).toBeDefined();

    // Giả lập callback VNPay trả về thành công (vnp_ResponseCode = '00')
    const secretKey = process.env.VNPAY_HASH_SECRET || 'SECRETKEYICTU2026BUS';
    const params: Record<string, string> = {
      vnp_TxnRef: txnRef,
      vnp_ResponseCode: '00',
      vnp_Amount: '500000',
    };
    const signData = `vnp_Amount=${params.vnp_Amount}&vnp_ResponseCode=${params.vnp_ResponseCode}&vnp_TxnRef=${params.vnp_TxnRef}`;
    const secureHash = crypto.createHmac('sha512', secretKey).update(Buffer.from(signData, 'utf-8')).digest('hex');
    params['vnp_SecureHash'] = secureHash;

    const returnRes = await request(app.getHttpServer())
      .get('/api/v1/payment/vnpay-return')
      .query(params)
      .expect(200);

    expect(returnRes.body.data.isSuccess).toBe(true);

    // Kiểm tra booking và tickets đã chuyển sang PAID
    const paidBooking = storedBookings.find((b) => b.id === bookingId);
    expect(paidBooking.status).toBe(BookingStatus.PAID);

    const paidTickets = storedTickets.filter((t) => t.bookingId === bookingId);
    expect(paidTickets[0].status).toBe(TicketStatus.PAID);

    // Kiểm tra SeatHoldEntity được chuyển sang booked
    const bookedHold = storedHolds.find((h) => h.seatId === 'seat-1-uuid' && h.status === 'booked');
    expect(bookedHold).toBeDefined();

    // Sơ đồ ghế xác nhận seat-1 đã bán chính thức
    const mapRes = await request(app.getHttpServer())
      .get(`/api/v1/trips/${mockTripId}/seat-map`)
      .expect(200);

    const seat1 = mapRes.body.data.seats.find((s: any) => s.seatId === 'seat-1-uuid');
    expect(seat1.isBooked).toBe(true);
    expect(seat1.bookingStatus).toBe('paid');
  });

  // TEST 8: Xử lý thanh toán thất bại (Payment Failed)
  it('[TC-08] Thanh toán thất bại trên VNPay -> booking & tickets bị CANCELLED, ghế lập tức quay về available', async () => {
    simulatedCurrentUser = mockUser1;

    // User 1 giữ và đặt ghế 01B (seat-2)
    await request(app.getHttpServer())
      .post('/api/v1/booking/hold-seats')
      .send({ tripId: mockTripId, seatIds: ['seat-2-uuid'] })
      .expect(201);

    const bookingRes = await request(app.getHttpServer())
      .post('/api/v1/booking/create')
      .send({
        tripId: mockTripId,
        passengers: [{ seatId: 'seat-2-uuid', passengerName: 'Nguyễn Văn A' }],
      })
      .expect(201);

    const bookingId = bookingRes.body.data.bookingId;

    // Tạo thanh toán
    const payUrlRes = await request(app.getHttpServer())
      .post('/api/v1/payment/create-url')
      .send({ bookingId, paymentMethod: PaymentMethod.VNPAY })
      .expect(201);

    const txnRef = payUrlRes.body.data.txnRef;

    // Giả lập callback VNPay báo lỗi (vnp_ResponseCode = '24' - Khách hủy trên cổng VNPay)
    const secretKey = process.env.VNPAY_HASH_SECRET || 'SECRETKEYICTU2026BUS';
    const params: Record<string, string> = {
      vnp_TxnRef: txnRef,
      vnp_ResponseCode: '24',
      vnp_Amount: '500000',
    };
    const signData = `vnp_Amount=${params.vnp_Amount}&vnp_ResponseCode=${params.vnp_ResponseCode}&vnp_TxnRef=${params.vnp_TxnRef}`;
    const secureHash = crypto.createHmac('sha512', secretKey).update(Buffer.from(signData, 'utf-8')).digest('hex');
    params['vnp_SecureHash'] = secureHash;

    const returnRes = await request(app.getHttpServer())
      .get('/api/v1/payment/vnpay-return')
      .query(params)
      .expect(200);

    expect(returnRes.body.data.isSuccess).toBe(false);

    // Kiểm tra booking và tickets bị CANCELLED
    const cancelledBooking = storedBookings.find((b) => b.id === bookingId);
    expect(cancelledBooking.status).toBe(BookingStatus.CANCELLED);

    const cancelledTickets = storedTickets.filter((t) => t.bookingId === bookingId);
    expect(cancelledTickets[0].status).toBe(TicketStatus.CANCELLED);

    // Sơ đồ ghế lập tức phản ánh ghế 01B quay về available
    const mapRes = await request(app.getHttpServer())
      .get(`/api/v1/trips/${mockTripId}/seat-map`)
      .expect(200);

    const seat2 = mapRes.body.data.seats.find((s: any) => s.seatId === 'seat-2-uuid');
    expect(seat2.isBooked).toBe(false);
    expect(seat2.bookingStatus).toBe('available');
  });

  // TEST 9: Khách chủ động hủy thanh toán (Cancel Payment API)
  it('[TC-09] Khách bấm hủy thanh toán qua POST /payment/cancel/:bookingId -> giải phóng ghế ngay lập tức', async () => {
    simulatedCurrentUser = mockUser1;

    // User 1 giữ và đặt ghế 02A (seat-3)
    await request(app.getHttpServer())
      .post('/api/v1/booking/hold-seats')
      .send({ tripId: mockTripId, seatIds: ['seat-3-uuid'] })
      .expect(201);

    const bookingRes = await request(app.getHttpServer())
      .post('/api/v1/booking/create')
      .send({
        tripId: mockTripId,
        passengers: [{ seatId: 'seat-3-uuid', passengerName: 'Nguyễn Văn A' }],
      })
      .expect(201);

    const bookingId = bookingRes.body.data.bookingId;

    // Gọi endpoint hủy thanh toán
    const cancelRes = await request(app.getHttpServer())
      .post(`/api/v1/payment/cancel/${bookingId}`)
      .expect(201);

    expect(cancelRes.body.success).toBe(true);
    expect(cancelRes.body.message).toContain('giải phóng ghế thành công');

    // Sơ đồ ghế xác nhận seat-3 quay về available
    const mapRes = await request(app.getHttpServer())
      .get(`/api/v1/trips/${mockTripId}/seat-map`)
      .expect(200);

    const seat3 = mapRes.body.data.seats.find((s: any) => s.seatId === 'seat-3-uuid');
    expect(seat3.isBooked).toBe(false);
    expect(seat3.bookingStatus).toBe('available');
  });

  // TEST 10: Xử lý booking pending quá hạn 10 phút chưa thanh toán
  it('[TC-10] Đơn đặt vé pending quá 10 phút chưa trả tiền -> sơ đồ ghế tự động coi ghế còn trống', async () => {
    simulatedCurrentUser = mockUser1;

    // User 1 đặt ghế 02B (seat-4)
    const bookingRes = await request(app.getHttpServer())
      .post('/api/v1/booking/create')
      .send({
        tripId: mockTripId,
        passengers: [{ seatId: 'seat-4-uuid', passengerName: 'Nguyễn Văn A' }],
      })
      .expect(201);

    const bookingId = bookingRes.body.data.bookingId;
    const booking = storedBookings.find((b) => b.id === bookingId);
    expect(booking.status).toBe(BookingStatus.PENDING);

    // Khi vừa tạo: ghế 02B bị khóa bởi vé RESERVED
    const mapResBefore = await request(app.getHttpServer())
      .get(`/api/v1/trips/${mockTripId}/seat-map`)
      .expect(200);
    const seat4Before = mapResBefore.body.data.seats.find((s: any) => s.seatId === 'seat-4-uuid');
    expect(seat4Before.isBooked).toBe(true);

    // Giả lập sau 10 phút khách không thanh toán (chỉnh expiresAt về quá khứ)
    booking.expiresAt = new Date(Date.now() - 1000);

    // Sơ đồ ghế tự động loại trừ vé của booking pending quá hạn -> ghế 02B tự động quay lại available
    const mapResAfter = await request(app.getHttpServer())
      .get(`/api/v1/trips/${mockTripId}/seat-map`)
      .expect(200);
    const seat4After = mapResAfter.body.data.seats.find((s: any) => s.seatId === 'seat-4-uuid');
    expect(seat4After.isBooked).toBe(false);
    expect(seat4After.bookingStatus).toBe('available');
  });
});
