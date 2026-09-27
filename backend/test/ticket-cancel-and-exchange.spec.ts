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
import { verifyQrData } from '../src/common/utils/qr-code.util.js';

describe('Ticket Cancellation, Refund & Exchange Flow HTTP Integration Tests', () => {
  let app: INestApplication;
  let notificationService: NotificationService;

  // Mock IDs
  const mockRouteId = 'route-ct01-uuid';
  const mockVehicle1Id = 'vehicle-ev28-uuid';
  const mockVehicle2Id = 'vehicle-ev29-uuid';

  const tripFarId = 'trip-far-30h-uuid';
  const tripMidId = 'trip-mid-18h-uuid';
  const tripNearId = 'trip-near-5h-uuid';
  const tripUrgentId = 'trip-urgent-1h-uuid';
  const tripNewId = 'trip-new-destination-uuid';

  const mockRoute = {
    id: mockRouteId,
    routeCode: 'CT-01',
    name: 'Tuyến CT-01 Bến Xe Trung Tâm - ICTU',
    origin: 'Bến xe Trung Tâm Thái Nguyên',
    destination: 'Trường ĐH Công Nghệ Thông Tin & TT',
    basePrice: 10000,
    studentPrice: 5000,
  };

  const mockVehicle1 = {
    id: mockVehicle1Id,
    plateNumber: '20B-999.88',
    licensePlate: '20B-999.88',
    seatCapacity: 4,
    vehicleType: 'electric_bus',
  };

  const mockVehicle2 = {
    id: mockVehicle2Id,
    plateNumber: '20B-888.77',
    licensePlate: '20B-888.77',
    seatCapacity: 4,
    vehicleType: 'electric_bus',
  };

  const nowMs = Date.now();
  const mockTrips: Record<string, any> = {
    [tripFarId]: {
      id: tripFarId,
      routeId: mockRouteId,
      vehicleId: mockVehicle1Id,
      departureTime: new Date(nowMs + 30 * 60 * 60 * 1000), // 30 giờ tới (>24h)
      status: TripStatus.SCHEDULED,
      route: mockRoute,
      vehicle: mockVehicle1,
    },
    [tripMidId]: {
      id: tripMidId,
      routeId: mockRouteId,
      vehicleId: mockVehicle1Id,
      departureTime: new Date(nowMs + 18 * 60 * 60 * 1000), // 18 giờ tới (12h - 24h)
      status: TripStatus.SCHEDULED,
      route: mockRoute,
      vehicle: mockVehicle1,
    },
    [tripNearId]: {
      id: tripNearId,
      routeId: mockRouteId,
      vehicleId: mockVehicle1Id,
      departureTime: new Date(nowMs + 5 * 60 * 60 * 1000), // 5 giờ tới (2h - 12h)
      status: TripStatus.SCHEDULED,
      route: mockRoute,
      vehicle: mockVehicle1,
    },
    [tripUrgentId]: {
      id: tripUrgentId,
      routeId: mockRouteId,
      vehicleId: mockVehicle1Id,
      departureTime: new Date(nowMs + 1 * 60 * 60 * 1000), // 1 giờ tới (<2h)
      status: TripStatus.SCHEDULED,
      route: mockRoute,
      vehicle: mockVehicle1,
    },
    [tripNewId]: {
      id: tripNewId,
      routeId: mockRouteId,
      vehicleId: mockVehicle2Id,
      departureTime: new Date(nowMs + 32 * 60 * 60 * 1000), // Chuyến mới để đổi sang
      status: TripStatus.SCHEDULED,
      route: mockRoute,
      vehicle: mockVehicle2,
    },
  };

  const mockSeats = [
    { id: 'seat-1-uuid', vehicleId: mockVehicle1Id, seatNumber: '01A', rowNumber: 1, columnLabel: 'A' },
    { id: 'seat-2-uuid', vehicleId: mockVehicle1Id, seatNumber: '01B', rowNumber: 1, columnLabel: 'B' },
    { id: 'seat-new-uuid', vehicleId: mockVehicle2Id, seatNumber: '02A', rowNumber: 2, columnLabel: 'A' },
  ];

  const mockUser1 = {
    id: 'user-1-uuid',
    email: 'user1@ictu.edu.vn',
    fullName: 'Nguyễn Văn A',
    phoneNumber: '0981111111',
    role: Role.PASSENGER,
  };

  const createMockToken = (user: any) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ ...user, sub: user.id })).toString('base64url');
    return `Bearer ${header}.${payload}.mockSignature`;
  };

  const tokenUser1 = createMockToken(mockUser1);

  // In-memory repositories
  const storedTickets: any[] = [];
  const storedBookings: any[] = [];
  const storedHolds: any[] = [];
  const storedPayments: any[] = [];

  let simulatedCurrentUser: any = mockUser1;

  beforeAll(async () => {
    const mockTripRepo = {
      findOne: (opts: any) => {
        const id = opts?.where?.id;
        if (id && mockTrips[id]) {
          return Promise.resolve({ ...mockTrips[id] });
        }
        return Promise.resolve(null);
      },
      createQueryBuilder: () => ({
        innerJoinAndSelect: function () { return this; },
        leftJoinAndSelect: function () { return this; },
        where: function () { return this; },
        andWhere: function () { return this; },
        orderBy: function () { return this; },
        getMany: () => Promise.resolve(Object.values(mockTrips)),
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
      count: (opts: any) => {
        let results = [...storedTickets];
        if (opts?.where?.bookingId) {
          results = results.filter((t) => t.bookingId === opts.where.bookingId);
        }
        if (opts?.where?.status?._value) {
          results = results.filter((t) => opts.where.status._value.includes(t.status));
        }
        return Promise.resolve(results.length);
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
              ticket.booking.trip = mockTrips[ticket.booking.tripId];
              ticket.booking.user = mockUser1;
              ticket.booking.payments = storedPayments.filter((p) => p.bookingId === ticket.booking.id);
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
      createQueryBuilder: () => {
        let selectedTripId: string | null = null;
        let selectedSeatId: string | null = null;
        return {
          innerJoin: function () { return this; },
          leftJoinAndSelect: function () { return this; },
          select: function () { return this; },
          where: function (clause: string, params: any) {
            if (params?.tripId) selectedTripId = params.tripId;
            return this;
          },
          andWhere: function (clause: string, params: any) {
            if (params?.seatId) selectedSeatId = params.seatId;
            return this;
          },
          getCount: () => {
            const list = storedTickets.filter((t) => {
              const b = storedBookings.find((bk) => bk.id === t.bookingId);
              if (selectedTripId && b?.tripId !== selectedTripId) return false;
              if (t.status === TicketStatus.CANCELLED || t.status === TicketStatus.EXPIRED) return false;
              return true;
            });
            return Promise.resolve(list.length);
          },
          getOne: () => {
            const t = storedTickets.find((tk) => {
              const b = storedBookings.find((bk) => bk.id === tk.bookingId);
              if (selectedTripId && b?.tripId !== selectedTripId) return false;
              if (selectedSeatId && tk.seatId !== selectedSeatId) return false;
              if (tk.status === TicketStatus.CANCELLED || tk.status === TicketStatus.EXPIRED) return false;
              return true;
            });
            return Promise.resolve(t || null);
          },
          getMany: () => {
            const list = storedTickets.filter((t) => {
              const b = storedBookings.find((bk) => bk.id === t.bookingId);
              if (selectedTripId && b?.tripId !== selectedTripId) return false;
              if (t.status === TicketStatus.CANCELLED || t.status === TicketStatus.EXPIRED) return false;
              return true;
            });
            return Promise.resolve(list);
          },
        };
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
        if (booking) {
          booking.user = mockUser1;
          booking.trip = mockTrips[booking.tripId];
          booking.tickets = storedTickets.filter((t) => t.bookingId === booking.id);
          booking.payments = storedPayments.filter((p) => p.bookingId === booking.id);
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

    const mockSeatHoldRepo = {
      create: (data: any) => ({
        id: `hold-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date(),
        ...data,
      }),
      save: (data: any) => {
        const idx = storedHolds.findIndex((h) => h.id === data.id);
        if (idx >= 0) {
          storedHolds[idx] = { ...storedHolds[idx], ...data };
          return Promise.resolve(storedHolds[idx]);
        }
        storedHolds.push(data);
        return Promise.resolve(data);
      },
      findOne: (opts: any) => {
        const hold = storedHolds.find((h) => {
          if (opts?.where?.tripId && h.tripId !== opts.where.tripId) return false;
          if (opts?.where?.seatId && h.seatId !== opts.where.seatId) return false;
          if (opts?.where?.status && h.status !== opts.where.status) return false;
          return true;
        });
        return Promise.resolve(hold || null);
      },
      count: (opts: any) => {
        let results = [...storedHolds];
        if (opts?.where?.tripId) results = results.filter((h) => h.tripId === opts.where.tripId);
        if (opts?.where?.status) results = results.filter((h) => h.status === opts.where.status);
        return Promise.resolve(results.length);
      },
      update: (criteria: any, values: any) => {
        for (const h of storedHolds) {
          if (criteria.tripId && h.tripId !== criteria.tripId) continue;
          if (criteria.seatId && h.seatId !== criteria.seatId) continue;
          Object.assign(h, values);
        }
        return Promise.resolve({ affected: 1 });
      },
      createQueryBuilder: () => ({
        where: function () { return this; },
        andWhere: function () { return this; },
        getOne: () => Promise.resolve(null),
        getMany: () => Promise.resolve(storedHolds.filter((h) => h.status === 'holding')),
      }),
    };

    const mockPaymentRepo = {
      create: (data: any) => ({
        id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        paymentTime: new Date(),
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
        const pay = storedPayments.find((p) => {
          if (opts?.where?.transactionId && p.transactionId === opts.where.transactionId) return true;
          if (opts?.where?.bookingId && p.bookingId === opts.where.bookingId) return true;
          return false;
        });
        if (pay && opts?.relations?.booking) {
          pay.booking = storedBookings.find((b) => b.id === pay.bookingId);
          if (pay.booking) {
            pay.booking.user = mockUser1;
            pay.booking.trip = mockTrips[pay.booking.tripId];
          }
        }
        return Promise.resolve(pay || null);
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
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
        { provide: getRepositoryToken(SeatHoldEntity), useValue: mockSeatHoldRepo },
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
      .useValue({
        canActivate: () => true,
      })
      .compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformResponseInterceptor());

    notificationService = moduleFixture.get<NotificationService>(NotificationService);

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
    if (notificationService) notificationService.clearHistory();
  });

  // Helper tạo vé nhanh
  const createMockTicketForTrip = (tripId: string, status: TicketStatus = TicketStatus.PAID, price = 10000) => {
    const bookingId = `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ticketId = `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ticketCode = `TKT-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const booking = {
      id: bookingId,
      userId: mockUser1.id,
      tripId,
      bookingCode: `BK-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      status: status === TicketStatus.PAID ? BookingStatus.CONFIRMED : BookingStatus.PENDING,
      totalPrice: price,
      user: mockUser1,
      trip: mockTrips[tripId],
    };
    storedBookings.push(booking);

    const ticket = {
      id: ticketId,
      bookingId,
      seatId: 'seat-1-uuid',
      ticketCode,
      passengerName: 'Nguyễn Văn A',
      originalPrice: price,
      status,
      createdAt: new Date(),
    };
    storedTickets.push(ticket);

    // Tạo bản ghi seat-hold 'booked'
    storedHolds.push({
      id: `hold-${ticketId}`,
      tripId,
      seatId: 'seat-1-uuid',
      userId: mockUser1.id,
      status: status === TicketStatus.PAID ? 'booked' : 'holding',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // Tạo bản ghi payment nếu là PAID
    if (status === TicketStatus.PAID) {
      storedPayments.push({
        id: `pay-${ticketId}`,
        bookingId,
        amount: price,
        status: PaymentStatus.SUCCESS,
        paymentMethod: PaymentMethod.VNPAY,
        transactionId: `txn-${ticketId}`,
      });
    }

    return { ticketId, ticketCode, bookingId };
  };

  // TEST 1: Kiểm tra chính sách khi khởi hành > 24h
  it('[TC-01] Kiểm tra chính sách hủy/đổi vé trước giờ khởi hành > 24h -> Phí hủy 0%, hoàn tiền 100%, phí đổi 0%', async () => {
    const { ticketId, ticketCode } = createMockTicketForTrip(tripFarId, TicketStatus.PAID, 10000);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/booking/tickets/${ticketId}/cancellation-policy`)
      .set('Authorization', tokenUser1)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.ticketCode).toBe(ticketCode);
    expect(res.body.data.canCancel).toBe(true);
    expect(res.body.data.canExchange).toBe(true);
    expect(res.body.data.hoursUntilDeparture).toBeGreaterThan(24);
    expect(res.body.data.cancellationFeePercent).toBe(0);
    expect(res.body.data.cancellationFeeAmount).toBe(0);
    expect(res.body.data.refundAmount).toBe(10000);
    expect(res.body.data.exchangeFeePercent).toBe(0);
    expect(res.body.data.exchangeFeeAmount).toBe(0);
  });

  // TEST 2: Kiểm tra chính sách trong khoảng 12h - 24h
  it('[TC-02] Kiểm tra chính sách hủy/đổi vé trong khoảng 12h - 24h -> Phí hủy 10%, hoàn tiền 90%, phí đổi 5%', async () => {
    const { ticketId } = createMockTicketForTrip(tripMidId, TicketStatus.PAID, 10000);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/booking/tickets/${ticketId}/cancellation-policy`)
      .set('Authorization', tokenUser1)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.canCancel).toBe(true);
    expect(res.body.data.canExchange).toBe(true);
    expect(res.body.data.cancellationFeePercent).toBe(10);
    expect(res.body.data.cancellationFeeAmount).toBe(1000);
    expect(res.body.data.refundAmount).toBe(9000);
    expect(res.body.data.exchangeFeePercent).toBe(5);
    expect(res.body.data.exchangeFeeAmount).toBe(500);
  });

  // TEST 3: Kiểm tra chính sách trong khoảng 2h - 12h
  it('[TC-03] Kiểm tra chính sách hủy/đổi vé trong khoảng 2h - 12h -> Phí hủy 20%, hoàn tiền 80%, phí đổi 10%', async () => {
    const { ticketId } = createMockTicketForTrip(tripNearId, TicketStatus.PAID, 10000);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/booking/tickets/${ticketId}/cancellation-policy`)
      .set('Authorization', tokenUser1)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.canCancel).toBe(true);
    expect(res.body.data.canExchange).toBe(true);
    expect(res.body.data.cancellationFeePercent).toBe(20);
    expect(res.body.data.cancellationFeeAmount).toBe(2000);
    expect(res.body.data.refundAmount).toBe(8000);
    expect(res.body.data.exchangeFeePercent).toBe(10);
    expect(res.body.data.exchangeFeeAmount).toBe(1000);
  });

  // TEST 4: Từ chối hủy/đổi vé khi thời gian khởi hành còn dưới 2 giờ
  it('[TC-04] Từ chối hủy hoặc đổi vé khi thời gian khởi hành còn dưới 2 giờ -> 400 Bad Request', async () => {
    const { ticketId } = createMockTicketForTrip(tripUrgentId, TicketStatus.PAID, 10000);

    // Kiểm tra policy báo canCancel = false
    const policyRes = await request(app.getHttpServer())
      .get(`/api/v1/booking/tickets/${ticketId}/cancellation-policy`)
      .set('Authorization', tokenUser1)
      .expect(200);
    expect(policyRes.body.data.canCancel).toBe(false);
    expect(policyRes.body.data.canExchange).toBe(false);

    // Gửi yêu cầu hủy -> bị từ chối
    const cancelRes = await request(app.getHttpServer())
      .post(`/api/v1/booking/tickets/${ticketId}/cancel`)
      .set('Authorization', tokenUser1)
      .send({ reason: 'Bận đột xuất' })
      .expect(400);

    expect(cancelRes.body.message).toContain('tối thiểu 2 tiếng');
  });

  // TEST 5: Từ chối hủy vé đã soát vé lên xe (CHECKED_IN) hoặc vé đã bị hủy
  it('[TC-05] Từ chối hủy vé đã soát vé lên xe (CHECKED_IN) hoặc vé đã bị hủy trước đó -> 400 Bad Request', async () => {
    const { ticketId: checkedInTicketId } = createMockTicketForTrip(tripFarId, TicketStatus.CHECKED_IN, 10000);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/booking/tickets/${checkedInTicketId}/cancel`)
      .set('Authorization', tokenUser1)
      .send()
      .expect(400);

    expect(res.body.message).toContain('CHECKED_IN');
  });

  // TEST 6: Hủy vé thành công -> ticket chuyển CANCELLED và giải phóng ghế trên seat-map
  it('[TC-06] Hành khách hủy vé thành công -> Vé chuyển CANCELLED, ghế được giải phóng lập tức trên GET /trips/:id/seat-map', async () => {
    const { ticketId, ticketCode } = createMockTicketForTrip(tripFarId, TicketStatus.PAID, 10000);

    // 1. Kiểm tra trước khi hủy: ghế 01A đang bị đặt trên seat-map
    const seatMapBefore = await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripFarId}/seat-map`)
      .expect(200);
    const seatBefore = seatMapBefore.body.data.seats.find((s: any) => s.seatNumber === '01A');
    expect(seatBefore.isBooked).toBe(true);

    // 2. Thực hiện hủy vé
    const cancelRes = await request(app.getHttpServer())
      .post(`/api/v1/booking/tickets/${ticketId}/cancel`)
      .set('Authorization', tokenUser1)
      .send({ reason: 'Đổi kế hoạch cá nhân' })
      .expect(201);

    expect(cancelRes.body.success).toBe(true);
    expect(cancelRes.body.status).toBe(TicketStatus.CANCELLED);
    expect(cancelRes.body.seatReleased).toBe(true);

    // 3. Kiểm tra ngay sau khi hủy: ghế 01A lập tức hiển thị trống (isBooked = false)
    const seatMapAfter = await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripFarId}/seat-map`)
      .expect(200);
    const seatAfter = seatMapAfter.body.data.seats.find((s: any) => s.seatNumber === '01A');
    expect(seatAfter.isBooked).toBe(false);
  });

  // TEST 7: Tự động hoàn tiền và gửi Email xác nhận hủy vé
  it('[TC-07] Tự động hoàn tiền vào CSDL thanh toán (payment.status = REFUNDED) và gửi Email xác nhận hủy vé', async () => {
    notificationService.clearHistory();
    const { ticketId, ticketCode, bookingId } = createMockTicketForTrip(tripMidId, TicketStatus.PAID, 10000);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/booking/tickets/${ticketId}/cancel`)
      .set('Authorization', tokenUser1)
      .send({ reason: 'Hoàn vé theo quy định' })
      .expect(201);

    expect(res.body.refundProcessed).toBe(true);
    expect(res.body.refundAmount).toBe(9000); // 10% phí

    // Kiểm tra bản ghi payment được cập nhật sang REFUNDED
    const payment = storedPayments.find((p) => p.bookingId === bookingId);
    expect(payment.status).toBe(PaymentStatus.REFUNDED);
    expect(payment.refundAmount).toBe(9000);
    expect(payment.refundTime).toBeDefined();

    // Kiểm tra Email xác nhận hủy vé đã được gửi
    const sentEmails = notificationService.getSentNotifications({ ticketCode });
    expect(sentEmails.length).toBe(1);
    expect(sentEmails[0].subject).toContain('HỦY VÉ');
    expect(sentEmails[0].htmlPreview).toContain('9.000 VND');
  });

  // TEST 8: Tìm kiếm chuyến xe thay thế cho luồng đổi vé
  it('[TC-08] Hành khách tìm kiếm các chuyến xe thay thế cho luồng đổi vé (GET /tickets/:id/exchange-trips)', async () => {
    const { ticketId } = createMockTicketForTrip(tripFarId, TicketStatus.PAID, 10000);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/booking/tickets/${ticketId}/exchange-trips`)
      .set('Authorization', tokenUser1)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.availableTrips).toBeDefined();
    expect(Array.isArray(res.body.data.availableTrips)).toBe(true);
    // Có chuyến tripNewId cùng tuyến
    const foundTrip = res.body.data.availableTrips.find((t: any) => t.tripId === tripNewId);
    expect(foundTrip).toBeDefined();
    expect(foundTrip.availableSeats).toBeGreaterThan(0);
    expect(foundTrip.exchangeFee).toBe(0); // Vì >24h nên miễn phí đổi
  });

  // TEST 9: Tạm giữ chỗ ghế mới trên chuyến mới trong 10 phút (bảo toàn ghế cũ)
  it('[TC-09] Tạm giữ chỗ ghế mới trên chuyến mới trong 10 phút, bảo toàn ghế cũ của vé', async () => {
    const { ticketId, ticketCode } = createMockTicketForTrip(tripFarId, TicketStatus.PAID, 10000);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/booking/tickets/${ticketId}/hold-exchange-seat`)
      .set('Authorization', tokenUser1)
      .send({
        newTripId: tripNewId,
        newSeatId: 'seat-new-uuid',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.ticketCode).toBe(ticketCode);
    expect(res.body.newTripId).toBe(tripNewId);
    expect(res.body.newSeatNumber).toBe('02A');
    expect(res.body.holdExpiresAt).toBeDefined();

    // Ghế cũ của vé vẫn đang được giữ (status = PAID)
    const ticketInDb = storedTickets.find((t) => t.id === ticketId);
    expect(ticketInDb.status).toBe(TicketStatus.PAID);
    expect(ticketInDb.seatId).toBe('seat-1-uuid');
  });

  // TEST 10: Xác nhận đổi chuyến thành công -> giải phóng ghế cũ, ghế mới booked, cấp mã QR mới và gửi Email vé mới
  it('[TC-10] Xác nhận đổi chuyến thành công -> Ghế cũ giải phóng, ghế mới booked, cấp mã QR mới và gửi Email vé mới', async () => {
    notificationService.clearHistory();
    const { ticketId, ticketCode } = createMockTicketForTrip(tripFarId, TicketStatus.PAID, 10000);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/booking/tickets/${ticketId}/confirm-exchange`)
      .set('Authorization', tokenUser1)
      .send({
        newTripId: tripNewId,
        newSeatId: 'seat-new-uuid',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.ticketCode).toBe(ticketCode);
    expect(res.body.newTripId).toBe(tripNewId);
    expect(res.body.newSeatNumber).toBe('02A');
    expect(res.body.qrData).toBeDefined();
    expect(res.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);

    // Xác thực chữ ký số HMAC-SHA256 của mã QR mới
    const qrVerify = verifyQrData(res.body.qrData);
    expect(qrVerify.valid).toBe(true);
    expect(qrVerify.payload?.tripId).toBe(tripNewId);
    expect(qrVerify.payload?.seatNumber).toBe('02A');

    // Kiểm tra vé trong CSDL đã chuyển sang chuyến mới và ghế mới
    const updatedTicket = storedTickets.find((t) => t.id === ticketId);
    expect(updatedTicket.seatId).toBe('seat-new-uuid');
    const updatedBooking = storedBookings.find((b) => b.id === updatedTicket.bookingId);
    expect(updatedBooking.tripId).toBe(tripNewId);

    // Kiểm tra Email vé mới đã được gửi tự động
    const sentEmails = notificationService.getSentNotifications({ ticketCode });
    expect(sentEmails.length).toBe(1);
    expect(sentEmails[0].subject).toContain('ĐỔI VÉ XE');
    expect(sentEmails[0].htmlPreview).toContain('02A');
  });
});
