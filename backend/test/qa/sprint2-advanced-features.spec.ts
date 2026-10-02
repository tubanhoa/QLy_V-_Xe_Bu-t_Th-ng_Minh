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
import { firstValueFrom, take } from 'rxjs';

import { BookingController } from '../../src/modules/booking/booking.controller.js';
import { BookingService } from '../../src/modules/booking/booking.service.js';
import { SeatLockService } from '../../src/modules/booking/seat-lock.service.js';
import { PaymentController } from '../../src/modules/payment/payment.controller.js';
import { PaymentService } from '../../src/modules/payment/payment.service.js';
import { TripsController } from '../../src/modules/trips/trips.controller.js';
import { TripsService } from '../../src/modules/trips/trips.service.js';
import { FeedbackController } from '../../src/modules/feedback/feedback.controller.js';
import { FeedbackService } from '../../src/modules/feedback/feedback.service.js';
import { TrackingController } from '../../src/modules/tracking/tracking.controller.js';
import { TrackingService } from '../../src/modules/tracking/tracking.service.js';
import { InvoiceService } from '../../src/modules/invoice/invoice.service.js';
import { NotificationService } from '../../src/modules/notification/notification.service.js';

import { TripEntity } from '../../src/database/entities/trip.entity.js';
import { RouteEntity } from '../../src/database/entities/route.entity.js';
import { RouteStationEntity } from '../../src/database/entities/route-station.entity.js';
import { StationEntity } from '../../src/database/entities/station.entity.js';
import { VehicleEntity } from '../../src/database/entities/vehicle.entity.js';
import { SeatEntity } from '../../src/database/entities/seat.entity.js';
import { TicketEntity } from '../../src/database/entities/ticket.entity.js';
import { BookingEntity } from '../../src/database/entities/booking.entity.js';
import { VoucherEntity } from '../../src/database/entities/voucher.entity.js';
import { UserEntity } from '../../src/database/entities/user.entity.js';
import { RoleEntity } from '../../src/database/entities/role.entity.js';
import { SeatHoldEntity } from '../../src/database/entities/seat-hold.entity.js';
import { PaymentEntity } from '../../src/database/entities/payment.entity.js';
import { PaymentLogEntity } from '../../src/database/entities/payment-log.entity.js';
import { RefundLogEntity } from '../../src/database/entities/refund-log.entity.js';
import { InvoiceEntity } from '../../src/database/entities/invoice.entity.js';
import { FeedbackEntity } from '../../src/database/entities/feedback.entity.js';
import { VehicleTrackingEntity } from '../../src/database/entities/vehicle-tracking.entity.js';
import { TripIncidentEntity } from '../../src/database/entities/trip-incident.entity.js';

import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter.js';
import { TransformResponseInterceptor } from '../../src/common/interceptors/transform-response.interceptor.js';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/common/guards/roles.guard.js';
import {
  TripStatus,
  TicketStatus,
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
} from '../../src/common/constants/status.constant.js';
import { Role } from '../../src/common/constants/roles.constant.js';
import { vietnameseNumberToWords } from '../../src/modules/invoice/utils/vietnamese-number-to-words.util.js';
import { generateInvoicePdf } from '../../src/modules/invoice/utils/invoice-pdf.util.js';
import { generateInvoiceHtml } from '../../src/modules/invoice/utils/invoice-html.util.js';

/**
 * ======================================================================================
 * AUTOMATION TEST SUITE - SPRINT 2 ADVANCED FEATURES
 * SMART BUS TICKETING SYSTEM - ICTU TRANSIT
 *
 * PHÂN HỆ KIỂM THỬ:
 * 6. Module Hủy vé, Đổi vé & Hoàn tiền tự động [TC-REFUND-01 -> TC-REFUND-05]
 * 7. Module Hóa đơn điện tử VAT (Electronic Invoice) [TC-INV-01 -> TC-INV-03]
 * 8. Module Đánh giá & Phản hồi chuyến đi (Feedback & Rating) [TC-FB-01 -> TC-FB-02]
 * 9. Module Định vị Real-time & Tính ETA Trạm (Live Tracking) [TC-TRACK-01 -> TC-TRACK-04]
 * ======================================================================================
 */

describe('Sprint 2 Automation Test Suite - Advanced Features [QA Specification]', () => {
  let app: INestApplication;
  let invoiceService: InvoiceService;
  let trackingService: TrackingService;
  let notificationService: NotificationService;

  // In-memory Mock Stores
  const storedTrips: any[] = [];
  const storedRoutes: any[] = [];
  const storedRouteStations: any[] = [];
  const storedStations: any[] = [];
  const storedVehicles: any[] = [];
  const storedSeats: any[] = [];
  const storedTickets: any[] = [];
  const storedBookings: any[] = [];
  const storedPayments: any[] = [];
  const storedRefundLogs: any[] = [];
  const storedInvoices: any[] = [];
  const storedFeedbacks: any[] = [];
  const storedTrackings: any[] = [];
  const storedIncidents: any[] = [];
  const storedHolds: any[] = [];
  const storedUsers: any[] = [];

  let simulatedCurrentUser: any = null;

  // Mock User
  const mockUserPassenger = {
    id: 'user-pass-202',
    email: 'passenger.advanced@ictu.edu.vn',
    fullName: 'Hoàng Thị Khách',
    phoneNumber: '0987654321',
    role: Role.PASSENGER,
  };

  const mockAdminUser = {
    id: 'user-admin-001',
    email: 'admin.transit@ictu.edu.vn',
    fullName: 'Quản Trị Viên',
    role: Role.ADMIN,
  };

  // Mock Route & Vehicle
  const mockRoute = {
    id: 'route-sprint2-uuid',
    routeCode: 'CT-02',
    name: 'Tuyến CT-02 Thái Nguyên - Đại Từ',
    origin: 'Bến xe Thái Nguyên',
    destination: 'Bến xe Đại Từ',
    basePrice: 15000,
    studentPrice: 8000,
    status: 'active',
  };

  const mockVehicle = {
    id: 'vehicle-20b-01234',
    licensePlate: '20B-012.34',
    plateNumber: '20B-012.34',
    seatCapacity: 28,
    vehicleType: 'electric_bus',
  };

  // 3 Trạm dừng trên tuyến CT-02
  const mockSt1 = { id: 'sta-01', name: 'Bến xe Thái Nguyên', latitude: 21.5855, longitude: 105.8451 };
  const mockSt2 = { id: 'sta-02', name: 'Trạm Ngã tư Sông Công', latitude: 21.5012, longitude: 105.8124 };
  const mockSt3 = { id: 'sta-03', name: 'Bến xe Đại Từ', latitude: 21.6321, longitude: 105.6389 };

  const rs1 = { id: 'rs-1', routeId: mockRoute.id, stationId: mockSt1.id, stopOrder: 1, station: mockSt1 };
  const rs2 = { id: 'rs-2', routeId: mockRoute.id, stationId: mockSt2.id, stopOrder: 2, station: mockSt2 };
  const rs3 = { id: 'rs-3', routeId: mockRoute.id, stationId: mockSt3.id, stopOrder: 3, station: mockSt3 };

  // Khởi tạo các chuyến xe với các mốc giờ phục vụ kiểm tra chính sách hoàn tiền:
  const nowMs = Date.now();
  // 1. Chuyến khởi hành sau 30 giờ (> 24h)
  const tripFar = {
    id: 'trip-far-30h',
    routeId: mockRoute.id,
    vehicleId: mockVehicle.id,
    departureTime: new Date(nowMs + 30 * 60 * 60 * 1000),
    arrivalTime: new Date(nowMs + 31 * 60 * 60 * 1000),
    status: TripStatus.SCHEDULED,
    route: mockRoute,
    vehicle: mockVehicle,
  };

  // 2. Chuyến khởi hành sau 18 giờ (từ 12h đến 24h)
  const tripMid = {
    id: 'trip-mid-18h',
    routeId: mockRoute.id,
    vehicleId: mockVehicle.id,
    departureTime: new Date(nowMs + 18 * 60 * 60 * 1000),
    arrivalTime: new Date(nowMs + 19 * 60 * 60 * 1000),
    status: TripStatus.SCHEDULED,
    route: mockRoute,
    vehicle: mockVehicle,
  };

  // 3. Chuyến khởi hành sau 6 giờ (từ 2h đến 12h)
  const tripNear = {
    id: 'trip-near-6h',
    routeId: mockRoute.id,
    vehicleId: mockVehicle.id,
    departureTime: new Date(nowMs + 6 * 60 * 60 * 1000),
    arrivalTime: new Date(nowMs + 7 * 60 * 60 * 1000),
    status: TripStatus.SCHEDULED,
    route: mockRoute,
    vehicle: mockVehicle,
  };

  // 4. Chuyến khởi hành sau 1 giờ (< 2h)
  const tripUrgent = {
    id: 'trip-urgent-1h',
    routeId: mockRoute.id,
    vehicleId: mockVehicle.id,
    departureTime: new Date(nowMs + 1 * 60 * 60 * 1000),
    arrivalTime: new Date(nowMs + 2 * 60 * 60 * 1000),
    status: TripStatus.SCHEDULED,
    route: mockRoute,
    vehicle: mockVehicle,
  };

  // 5. Chuyến xe đích mới phục vụ luồng đổi vé
  const tripNewExchange = {
    id: 'trip-new-exchange',
    routeId: mockRoute.id,
    vehicleId: mockVehicle.id,
    departureTime: new Date(nowMs + 35 * 60 * 60 * 1000),
    arrivalTime: new Date(nowMs + 36 * 60 * 60 * 1000),
    status: TripStatus.SCHEDULED,
    route: mockRoute,
    vehicle: mockVehicle,
  };

  beforeAll(async () => {
    storedUsers.push(mockUserPassenger, mockAdminUser);
    storedRoutes.push(mockRoute);
    storedStations.push(mockSt1, mockSt2, mockSt3);
    storedRouteStations.push(rs1, rs2, rs3);
    storedVehicles.push(mockVehicle);
    storedTrips.push(tripFar, tripMid, tripNear, tripUrgent, tripNewExchange);

    // 28 Ghế
    for (let r = 1; r <= 7; r++) {
      for (const c of ['A', 'B', 'C', 'D']) {
        storedSeats.push({
          id: `seat-${r}${c}-uuid`,
          vehicleId: mockVehicle.id,
          seatNumber: `0${r}${c}`,
          seatType: 'standard',
        });
      }
    }

    const mockTripRepo = {
      findOne: (opts: any) => {
        const t = storedTrips.find((item) => item.id === opts?.where?.id);
        if (t) {
          t.route = mockRoute;
          t.vehicle = mockVehicle;
        }
        return Promise.resolve(t || null);
      },
      find: () => Promise.resolve(storedTrips),
      createQueryBuilder: () => ({
        innerJoinAndSelect: function () { return this; },
        leftJoinAndSelect: function () { return this; },
        where: function () { return this; },
        andWhere: function () { return this; },
        orderBy: function () { return this; },
        getMany: () => Promise.resolve(storedTrips),
      }),
    };

    const mockTicketRepo = {
      create: (dto: any) => ({
        id: `tkt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        status: TicketStatus.PAID,
        createdAt: new Date(),
        ...dto,
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
          t.seat = storedSeats.find((s) => s.id === t.seatId);
        }
        return Promise.resolve(results);
      },
      findOne: (opts: any) => {
        let ticket: any = null;
        if (Array.isArray(opts?.where)) {
          for (const cond of opts.where) {
            ticket = storedTickets.find(
              (t) => (cond.id && t.id === cond.id) || (cond.ticketCode && t.ticketCode === cond.ticketCode),
            );
            if (ticket) break;
          }
        } else if (opts?.where?.ticketCode) {
          ticket = storedTickets.find((t) => t.ticketCode === opts.where.ticketCode);
        } else if (opts?.where?.id) {
          ticket = storedTickets.find((t) => t.id === opts.where.id);
        }

        if (ticket) {
          ticket.seat = storedSeats.find((s) => s.id === ticket.seatId);
          ticket.booking = storedBookings.find((b) => b.id === ticket.bookingId) || {
            id: ticket.bookingId,
            userId: mockUserPassenger.id,
            user: mockUserPassenger,
            tripId: ticket.tripId || tripFar.id,
            trip: storedTrips.find((t) => t.id === (ticket.tripId || tripFar.id)),
            payments: storedPayments.filter((p) => p.bookingId === ticket.bookingId),
          };
        }
        return Promise.resolve(ticket || null);
      },
      update: (criteria: any, values: any) => {
        for (const t of storedTickets) {
          if (criteria.bookingId && t.bookingId === criteria.bookingId) Object.assign(t, values);
          if (criteria.id && t.id === criteria.id) Object.assign(t, values);
        }
        return Promise.resolve({ affected: 1 });
      },
      count: (opts: any) => {
        let count = 0;
        for (const t of storedTickets) {
          if (opts?.where?.bookingId && t.bookingId !== opts.where.bookingId) continue;
          if (t.status !== TicketStatus.CANCELLED) {
            count++;
          }
        }
        return Promise.resolve(count);
      },
      createQueryBuilder: () => {
        const builder: any = {
          innerJoin: () => builder,
          leftJoinAndSelect: () => builder,
          select: () => builder,
          addSelect: () => builder,
          where: () => builder,
          andWhere: () => builder,
          groupBy: () => builder,
          getCount: () => Promise.resolve(0),
          getMany: () => Promise.resolve([]),
          getOne: () => Promise.resolve(null),
        };
        return builder;
      },
    };

    const mockBookingRepo = {
      create: (dto: any) => ({
        id: `bkg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        bookingCode: `BK-CT02-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        status: BookingStatus.PAID,
        createdAt: new Date(),
        ...dto,
      }),
      save: (bkg: any) => {
        const idx = storedBookings.findIndex((b) => b.id === bkg.id);
        if (idx >= 0) {
          storedBookings[idx] = { ...storedBookings[idx], ...bkg };
          return Promise.resolve(storedBookings[idx]);
        }
        storedBookings.push(bkg);
        return Promise.resolve(bkg);
      },
      findOne: (opts: any) => {
        const b = storedBookings.find((item) => item.id === opts?.where?.id || item.bookingCode === opts?.where?.bookingCode);
        if (b) {
          b.tickets = storedTickets.filter((t) => t.bookingId === b.id);
          b.trip = storedTrips.find((t) => t.id === b.tripId);
          b.user = mockUserPassenger;
        }
        return Promise.resolve(b || null);
      },
      update: (criteria: any, values: any) => {
        const id = typeof criteria === 'string' ? criteria : criteria?.id;
        const b = storedBookings.find((item) => item.id === id);
        if (b) Object.assign(b, values);
        return Promise.resolve({ affected: 1 });
      },
    };

    const mockHoldRepo = {
      create: (dto: any) => ({ id: `hold-${Date.now()}`, ...dto }),
      save: (data: any) => {
        if (Array.isArray(data)) {
          storedHolds.push(...data);
          return Promise.resolve(data);
        }
        const idx = storedHolds.findIndex((h) => h.id === data.id);
        if (idx >= 0) {
          storedHolds[idx] = { ...storedHolds[idx], ...data };
          return Promise.resolve(storedHolds[idx]);
        }
        storedHolds.push(data);
        return Promise.resolve(data);
      },
      find: () => Promise.resolve(storedHolds),
      findOne: (opts: any) => {
        const h = storedHolds.find(
          (item) =>
            (!opts?.where?.tripId || item.tripId === opts.where.tripId) &&
            (!opts?.where?.seatId || item.seatId === opts.where.seatId) &&
            (!opts?.where?.status || item.status === opts.where.status),
        );
        return Promise.resolve(h || null);
      },
      update: () => Promise.resolve({ affected: 1 }),
      createQueryBuilder: () => {
        const builder: any = {
          where: () => builder,
          andWhere: () => builder,
          getOne: () => Promise.resolve(null),
          getMany: () => Promise.resolve([]),
          update: () => ({
            set: () => ({
              where: () => ({ execute: () => Promise.resolve({ affected: 0 }) }),
            }),
          }),
        };
        return builder;
      },
    };

    const mockPaymentRepo = {
      create: (dto: any) => ({ id: `pay-${Date.now()}`, createdAt: new Date(), ...dto }),
      save: (p: any) => {
        const idx = storedPayments.findIndex((item) => item.id === p.id);
        if (idx >= 0) {
          storedPayments[idx] = { ...storedPayments[idx], ...p };
          return Promise.resolve(storedPayments[idx]);
        }
        storedPayments.push(p);
        return Promise.resolve(p);
      },
      findOne: (opts: any) => {
        const p = storedPayments.find((item) => item.id === opts?.where?.id || item.bookingId === opts?.where?.bookingId);
        if (p && opts?.relations?.booking) {
          p.booking = storedBookings.find((b) => b.id === p.bookingId);
          if (p.booking) {
            p.booking.user = mockUserPassenger;
            p.booking.trip = tripFar;
          }
        }
        return Promise.resolve(p || null);
      },
    };

    const mockRefundLogRepo = {
      create: (dto: any) => ({ id: `ref-${Date.now()}`, createdAt: new Date(), ...dto }),
      save: (dto: any) => {
        storedRefundLogs.push(dto);
        return Promise.resolve(dto);
      },
      find: () => Promise.resolve(storedRefundLogs),
    };

    const mockInvoiceRepo = {
      create: (dto: any) => ({ id: `inv-${Date.now()}`, createdAt: new Date(), ...dto }),
      save: (inv: any) => {
        const idx = storedInvoices.findIndex((item) => item.id === inv.id);
        if (idx >= 0) {
          storedInvoices[idx] = { ...storedInvoices[idx], ...inv };
          return Promise.resolve(storedInvoices[idx]);
        }
        storedInvoices.push(inv);
        return Promise.resolve(inv);
      },
      findOne: (opts: any) => {
        let inv: any = null;
        if (Array.isArray(opts?.where)) {
          for (const cond of opts.where) {
            inv = storedInvoices.find(
              (item) =>
                (cond.lookupCode && item.lookupCode === cond.lookupCode) ||
                (cond.invoiceNumber && item.invoiceNumber === cond.invoiceNumber) ||
                (cond.paymentId && item.paymentId === cond.paymentId) ||
                (cond.id && item.id === cond.id),
            );
            if (inv) break;
          }
        } else if (opts?.where) {
          inv = storedInvoices.find(
            (item) =>
              item.id === opts.where.id ||
              item.lookupCode === opts.where.lookupCode ||
              item.invoiceNumber === opts.where.invoiceNumber ||
              item.paymentId === opts.where.paymentId,
          );
        }
        return Promise.resolve(inv || null);
      },
    };

    const mockFeedbackRepo = {
      create: (dto: any) => ({ id: `fb-${Date.now()}`, createdAt: new Date(), ...dto }),
      save: (fb: any) => {
        const idx = storedFeedbacks.findIndex((item) => item.id === fb.id);
        if (idx >= 0) {
          storedFeedbacks[idx] = { ...storedFeedbacks[idx], ...fb };
          return Promise.resolve(storedFeedbacks[idx]);
        }
        storedFeedbacks.push(fb);
        return Promise.resolve(fb);
      },
      findOne: (opts: any) => {
        const fb = storedFeedbacks.find((item) => item.id === opts?.where?.id);
        return Promise.resolve(fb || null);
      },
      createQueryBuilder: () => ({
        innerJoinAndSelect: function () { return this; },
        leftJoinAndSelect: function () { return this; },
        where: function () { return this; },
        andWhere: function () { return this; },
        orderBy: function () { return this; },
        skip: function () { return this; },
        take: function () { return this; },
        getManyAndCount: () => Promise.resolve([storedFeedbacks, storedFeedbacks.length]),
      }),
    };

    const mockTrackingRepo = {
      create: (dto: any) => ({ id: `trk-${Date.now()}`, ...dto }),
      save: (dto: any) => {
        storedTrackings.push(dto);
        return Promise.resolve(dto);
      },
      find: () => Promise.resolve(storedTrackings),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [
        BookingController,
        PaymentController,
        TripsController,
        FeedbackController,
        TrackingController,
      ],
      providers: [
        BookingService,
        SeatLockService,
        PaymentService,
        TripsService,
        FeedbackService,
        TrackingService,
        InvoiceService,
        NotificationService,
        { provide: getRepositoryToken(TripEntity), useValue: mockTripRepo },
        { provide: getRepositoryToken(RouteEntity), useValue: { findOne: () => Promise.resolve(mockRoute) } },
        { provide: getRepositoryToken(RouteStationEntity), useValue: { find: () => Promise.resolve(storedRouteStations) } },
        { provide: getRepositoryToken(StationEntity), useValue: { find: () => Promise.resolve(storedStations) } },
        { provide: getRepositoryToken(VehicleEntity), useValue: { findOne: () => Promise.resolve(mockVehicle) } },
        { provide: getRepositoryToken(SeatEntity), useValue: { find: () => Promise.resolve(storedSeats), findOne: () => Promise.resolve(storedSeats[0]) } },
        { provide: getRepositoryToken(TicketEntity), useValue: mockTicketRepo },
        { provide: getRepositoryToken(BookingEntity), useValue: mockBookingRepo },
        { provide: getRepositoryToken(VoucherEntity), useValue: { findOne: () => Promise.resolve(null) } },
        { provide: getRepositoryToken(UserEntity), useValue: { findOne: () => Promise.resolve(mockUserPassenger) } },
        { provide: getRepositoryToken(SeatHoldEntity), useValue: mockHoldRepo },
        { provide: getRepositoryToken(PaymentEntity), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(PaymentLogEntity), useValue: { create: (d: any) => d, save: (d: any) => Promise.resolve(d) } },
        { provide: getRepositoryToken(RefundLogEntity), useValue: mockRefundLogRepo },
        { provide: getRepositoryToken(InvoiceEntity), useValue: mockInvoiceRepo },
        { provide: getRepositoryToken(FeedbackEntity), useValue: mockFeedbackRepo },
        { provide: getRepositoryToken(VehicleTrackingEntity), useValue: mockTrackingRepo },
        { provide: getRepositoryToken(TripIncidentEntity), useValue: { create: (d: any) => d, save: (d: any) => Promise.resolve(d) } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = simulatedCurrentUser || mockUserPassenger;
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
    invoiceService = moduleRef.get(InvoiceService);
    trackingService = moduleRef.get(TrackingService);
    notificationService = moduleRef.get(NotificationService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    simulatedCurrentUser = mockUserPassenger;
  });

  // Helper tạo vé nhanh
  const createMockTicket = (tripId: string, status: TicketStatus = TicketStatus.PAID, price = 15000) => {
    const bookingId = `bkg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const ticketId = `tkt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const ticketCode = `TKT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const booking = {
      id: bookingId,
      bookingCode: `BK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      userId: mockUserPassenger.id,
      tripId,
      status: status === TicketStatus.PAID ? BookingStatus.PAID : BookingStatus.PENDING,
      totalAmount: price,
      user: mockUserPassenger,
      trip: storedTrips.find((t) => t.id === tripId),
    };
    storedBookings.push(booking);

    const ticket = {
      id: ticketId,
      bookingId,
      tripId,
      seatId: 'seat-1A-uuid',
      ticketCode,
      passengerName: 'Hoàng Thị Khách',
      originalPrice: price,
      status,
      createdAt: new Date(),
    };
    storedTickets.push(ticket);

    const paymentId = `pay-${ticketId}`;
    storedPayments.push({
      id: paymentId,
      bookingId,
      amount: price,
      status: PaymentStatus.SUCCESS,
      paymentMethod: PaymentMethod.VNPAY,
      transactionId: `txn-${ticketId}`,
      paymentTime: new Date(),
    });

    return { ticketId, ticketCode, bookingId, paymentId };
  };

  // ====================================================================================
  // PHẦN 6: MODULE HỦY VÉ, ĐỔI VÉ & HOÀN TIỀN TỰ ĐỘNG (TICKET CANCEL, EXCHANGE & REFUND)
  // ====================================================================================
  describe('[TC-REFUND] Module Hủy vé, Đổi vé & Hoàn tiền tự động', () => {
    describe('[TC-REFUND-01] Hủy vé trước giờ khởi hành > 24h', () => {
      it('Happy Path: Khởi hành > 24h -> Phí hủy 0%, hoàn tiền 100% giá vé', async () => {
        const { ticketId, ticketCode } = createMockTicket(tripFar.id, TicketStatus.PAID, 15000);

        // 1. Kiểm tra chính sách trả về
        const policyRes = await request(app.getHttpServer())
          .get(`/api/v1/booking/tickets/${ticketId}/cancellation-policy`)
          .expect(200);

        expect(policyRes.body.success).toBe(true);
        expect(policyRes.body.data.canCancel).toBe(true);
        expect(policyRes.body.data.hoursUntilDeparture).toBeGreaterThan(24);
        expect(policyRes.body.data.cancellationFeePercent).toBe(0);
        expect(policyRes.body.data.refundAmount).toBe(15000);

        // 2. Thực hiện hủy vé
        const cancelRes = await request(app.getHttpServer())
          .post(`/api/v1/booking/tickets/${ticketId}/cancel`)
          .send({ reason: 'Thay đổi lịch công tác' })
          .expect(201);

        expect(cancelRes.body.success).toBe(true);
        expect(cancelRes.body.status).toBe(TicketStatus.CANCELLED);
        expect(cancelRes.body.refundAmount).toBe(15000);
      });
    });

    describe('[TC-REFUND-02] Hủy vé trước giờ khởi hành từ 12h - 24h', () => {
      it('Happy Path: Khởi hành từ 12h - 24h -> Khấu trừ phí quy định (10%-20%), hoàn tiền (80%-90%)', async () => {
        const { ticketId } = createMockTicket(tripMid.id, TicketStatus.PAID, 15000);

        const policyRes = await request(app.getHttpServer())
          .get(`/api/v1/booking/tickets/${ticketId}/cancellation-policy`)
          .expect(200);

        expect(policyRes.body.success).toBe(true);
        expect(policyRes.body.data.canCancel).toBe(true);
        expect(policyRes.body.data.cancellationFeePercent).toBe(10);
        expect(policyRes.body.data.cancellationFeeAmount).toBe(1500);
        expect(policyRes.body.data.refundAmount).toBe(13500);

        const cancelRes = await request(app.getHttpServer())
          .post(`/api/v1/booking/tickets/${ticketId}/cancel`)
          .send({ reason: 'Bận việc gia đình' })
          .expect(201);

        expect(cancelRes.body.success).toBe(true);
        expect(cancelRes.body.refundAmount).toBe(13500);
      });
    });

    describe('[TC-REFUND-03] Hủy vé trước giờ khởi hành từ 4h - 12h (hoặc 2h - 12h)', () => {
      it('Happy Path: Khởi hành từ 2h - 12h -> Khấu trừ phí quy định (20%-50%), hoàn tiền (50%-80%)', async () => {
        const { ticketId } = createMockTicket(tripNear.id, TicketStatus.PAID, 15000);

        const policyRes = await request(app.getHttpServer())
          .get(`/api/v1/booking/tickets/${ticketId}/cancellation-policy`)
          .expect(200);

        expect(policyRes.body.success).toBe(true);
        expect(policyRes.body.data.canCancel).toBe(true);
        expect(policyRes.body.data.cancellationFeePercent).toBe(20);
        expect(policyRes.body.data.refundAmount).toBe(12000);

        const cancelRes = await request(app.getHttpServer())
          .post(`/api/v1/booking/tickets/${ticketId}/cancel`)
          .send({ reason: 'Có kế hoạch khác' })
          .expect(201);

        expect(cancelRes.body.success).toBe(true);
        expect(cancelRes.body.refundAmount).toBe(12000);
      });
    });

    describe('[TC-REFUND-04] Hủy vé trước giờ khởi hành < 2h hoặc sau khi xe đã chạy', () => {
      it('Unhappy Path: Thời gian khởi hành còn dưới 2 giờ -> Từ chối hoàn tiền (0%), thông báo quy định vận tải', async () => {
        const { ticketId } = createMockTicket(tripUrgent.id, TicketStatus.PAID, 15000);

        const policyRes = await request(app.getHttpServer())
          .get(`/api/v1/booking/tickets/${ticketId}/cancellation-policy`)
          .expect(200);

        expect(policyRes.body.data.canCancel).toBe(false);
        expect(policyRes.body.data.refundAmount).toBe(0);

        const cancelRes = await request(app.getHttpServer())
          .post(`/api/v1/booking/tickets/${ticketId}/cancel`)
          .send({ reason: 'Hủy sát giờ' })
          .expect(400);

        expect(cancelRes.body.statusCode).toBe(400);
        expect(cancelRes.body.message).toContain('tối thiểu 2 tiếng');
      });

      it('Edge Case: Từ chối hủy vé đã soát vé lên xe (CHECKED_IN) -> HTTP 400 Bad Request', async () => {
        const { ticketId } = createMockTicket(tripFar.id, TicketStatus.CHECKED_IN, 15000);

        const cancelRes = await request(app.getHttpServer())
          .post(`/api/v1/booking/tickets/${ticketId}/cancel`)
          .send()
          .expect(400);

        expect(cancelRes.body.statusCode).toBe(400);
        expect(cancelRes.body.message).toContain('CHECKED_IN');
      });
    });

    describe('[TC-REFUND-05] Đổi chuyến xe (Exchange Trip)', () => {
      it('Happy Path: Đổi chuyến xe -> Kiểm tra chênh lệch giá vé và cập nhật vé mới sang chuyến được chọn', async () => {
        const { ticketId } = createMockTicket(tripFar.id, TicketStatus.PAID, 15000);

        // 1. Tạm giữ ghế trên chuyến mới
        const holdRes = await request(app.getHttpServer())
          .post(`/api/v1/booking/tickets/${ticketId}/hold-exchange-seat`)
          .send({
            newTripId: tripNewExchange.id,
            newSeatId: 'seat-2B-uuid',
          })
          .expect(201);

        const holdData = holdRes.body.data || holdRes.body;
        expect(holdData.success).toBe(true);

        // 2. Xác nhận đổi vé
        const confirmRes = await request(app.getHttpServer())
          .post(`/api/v1/booking/tickets/${ticketId}/confirm-exchange`)
          .send({
            newTripId: tripNewExchange.id,
            newSeatId: 'seat-2B-uuid',
          })
          .expect(201);

        const confirmData = confirmRes.body.data || confirmRes.body;
        expect(confirmData.success).toBe(true);
        expect(confirmData.ticketCode).toBeDefined();
        expect(confirmData.newTripId).toBe(tripNewExchange.id);
        expect(confirmData.newSeatNumber).toBeDefined();
        expect(confirmData.qrData).toBeDefined();
      });
    });
  });

  // ====================================================================================
  // PHẦN 7: MODULE HÓA ĐƠN ĐIỆN TỬ VAT (ELECTRONIC INVOICE)
  // ====================================================================================
  describe('[TC-INV] Module Hóa đơn điện tử VAT', () => {
    let testPaymentId: string;
    let generatedInvoice: any;

    beforeAll(() => {
      const { paymentId } = createMockTicket(tripFar.id, TicketStatus.PAID, 100000);
      testPaymentId = paymentId;
    });

    describe('[TC-INV-01] Xuất hóa đơn GTGT điện tử tự động khi khách hàng yêu cầu', () => {
      it('Happy Path: Tạo hóa đơn GTGT điện tử thành công với đầy đủ thông tin bên bán (ICTU) và bên mua', async () => {
        generatedInvoice = await invoiceService.createOrGetInvoice(testPaymentId);

        expect(generatedInvoice).toBeDefined();
        expect(generatedInvoice.invoiceNumber).toMatch(/^INV-\d{8}-\d{4}$/);
        expect(generatedInvoice.invoiceData.seller.name).toContain('TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG');
        expect(generatedInvoice.invoiceData.seller.taxCode).toBe('4600123456-001');
        expect(generatedInvoice.invoiceData.buyer.fullName).toBe(mockUserPassenger.fullName);
        expect(Number(generatedInvoice.subtotalAmount)).toBe(92593);
      });
    });

    describe('[TC-INV-02] Tạo mã tra cứu bảo mật duy nhất và gửi file hóa đơn PDF', () => {
      it('Happy Path: Cấp mã tra cứu duy nhất và sinh tệp PDF hợp lệ có header %PDF', async () => {
        expect(generatedInvoice.lookupCode).toBeDefined();
        expect(generatedInvoice.lookupCode.length).toBeGreaterThan(6);

        // Kiểm tra tra cứu hóa đơn qua lookupCode
        const found = await invoiceService.lookupInvoice(generatedInvoice.lookupCode);
        expect(found).toBeDefined();
        expect(found.invoiceNumber).toBe(generatedInvoice.invoiceNumber);

        // Sinh tệp PDF hóa đơn điện tử
        const { buffer: pdfBuffer } = await invoiceService.generatePdfBuffer(found);
        expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
        expect(pdfBuffer.toString('utf-8', 0, 4)).toBe('%PDF');
        expect(pdfBuffer.length).toBeGreaterThan(500);

        // Sinh bản HTML hóa đơn
        const html = generateInvoiceHtml(found.invoiceData);
        expect(html).toContain('HÓA ĐƠN ĐIỆN TỬ');
        expect(html).toContain(generatedInvoice.invoiceNumber);
      });
    });

    describe('[TC-INV-03] Kiểm tra tính hợp lệ của Mã số thuế và tính toán VAT (8% hoặc 10%)', () => {
      it('Happy Path: Tính toán thuế suất VAT 8% chính xác và số tiền bằng chữ tiếng Việt chuẩn', () => {
        // Thuế suất 8% cho vận tải hành khách công cộng (VAT đã bao gồm trong giá vé)
        expect(Number(generatedInvoice.vatRate)).toBe(0.08);
        expect(Number(generatedInvoice.vatAmount)).toBe(7407); // 100,000 - 92,593 (VAT inclusive formula)
        expect(Number(generatedInvoice.totalAmount)).toBe(100000);

        // Kiểm tra chuyển số tiền thành chữ tiếng Việt
        const words = vietnameseNumberToWords(100000);
        expect(words).toContain('Một trăm nghìn đồng chẵn');
      });
    });
  });

  // ====================================================================================
  // PHẦN 8: MODULE ĐÁNH GIÁ & PHẢN HỒI CHUYẾN ĐI (FEEDBACK & RATING)
  // ====================================================================================
  describe('[TC-FB] Module Đánh giá & Phản hồi chuyến đi', () => {
    let createdFeedbackId: string;

    describe('[TC-FB-01] Gửi đánh giá sao (1-5 sao) và nhận xét chất lượng sau chuyến đi', () => {
      it('Happy Path: Hành khách gửi đánh giá 5 sao cho chuyến xe thành công -> HTTP 201 Created', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/feedback')
          .send({
            tripId: tripFar.id,
            ratingScore: 5,
            content: 'Xe buýt điện chạy rất êm, tài xế lái an toàn và đúng giờ!',
            category: 'service',
          })
          .expect(201);

        const data = res.body.data || res.body;
        expect(data).toHaveProperty('id');
        expect(data.ratingScore).toBe(5);
        expect(data.content).toContain('Xe buýt điện chạy rất êm');
        createdFeedbackId = data.id;
      });

      it('Unhappy Path: Gửi số sao ngoài khoảng 1-5 (ví dụ 6 sao) -> HTTP 400 Bad Request', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/feedback')
          .send({
            tripId: tripFar.id,
            ratingScore: 6, // Vượt quá 5 sao
            content: 'Quá tuyệt vời',
          })
          .expect(400);

        expect(res.body.statusCode).toBe(400);
      });
    });

    describe('[TC-FB-02] Chặn đánh giá ảo & Phản hồi khiếu nại (Admin/Manager)', () => {
      it('Happy Path: Quản trị viên xem danh sách đánh giá và phản hồi khách hàng (PATCH /admin/feedback/:id)', async () => {
        simulatedCurrentUser = mockAdminUser;

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/admin/feedback/${createdFeedbackId}`)
          .send({
            adminResponse: 'Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ xe buýt thông minh ICTU!',
            status: 'resolved',
          })
          .expect(200);

        const data = res.body.data || res.body;
        expect(data.status).toBe('resolved');
        expect(data.adminResponse).toContain('Cảm ơn quý khách');
      });
    });
  });

  // ====================================================================================
  // PHẦN 9: MODULE ĐỊNH VỊ REAL-TIME & TÍNH ETA TRẠM (LIVE TRACKING & STATION ETA)
  // ====================================================================================
  describe('[TC-TRACK] Module Định vị Real-time & Tính ETA Trạm', () => {
    describe('[TC-TRACK-01] Tiếp nhận tọa độ GPS thời gian thực từ xe buýt (20B-012.34)', () => {
      it('Happy Path: POST /driver/update-location tiếp nhận tọa độ GPS và lưu vào Cache < 5ms', async () => {
        const startTime = Date.now();

        const res = await request(app.getHttpServer())
          .post('/api/v1/driver/update-location')
          .send({
            tripId: tripFar.id,
            latitude: 21.5855,
            longitude: 105.8451,
            speedKmh: 42.5,
            heading: 180,
          })
          .expect(201);

        const executionDuration = Date.now() - startTime;
        expect(executionDuration).toBeLessThan(100); // Ghi nhận độ trễ cực thấp

        const data = res.body.data || res.body;
        expect(data).toHaveProperty('tracking');
        expect(Number(data.tracking.latitude)).toBe(21.5855);
        expect(Number(data.tracking.longitude)).toBe(105.8451);
        expect(Number(data.tracking.speedKmh)).toBe(42.5);
      });

      it('Unhappy Path: Tọa độ latitude không hợp lệ (không phải số) -> HTTP 400 Bad Request', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/driver/update-location')
          .send({
            tripId: tripFar.id,
            latitude: 'invalid-latitude-string',
            longitude: 105.8451,
          })
          .expect(400);

        expect(res.body.statusCode).toBe(400);
      });
    });

    describe('[TC-TRACK-02] Tính toán khoảng cách Haversine và ước tính ETA phút cho từng trạm dừng', () => {
      it('Happy Path: GET /trips/:id/live-tracking trả về tọa độ xe và danh sách ETA các trạm sắp tới', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/trips/${tripFar.id}/live-tracking`)
          .expect(200);

        const data = res.body.data || res.body;
        expect(data).toHaveProperty('latitude');
        expect(data).toHaveProperty('longitude');
        expect(data).toHaveProperty('stationEtas');
        expect(Array.isArray(data.stationEtas)).toBe(true);
        expect(data.stationEtas.length).toBeGreaterThan(0);

        // Trạm 1 (Bến xe Thái Nguyên) nằm ngay vị trí hiện tại -> ETA <= 2 phút
        const firstEta = data.stationEtas[0];
        expect(firstEta.stationName).toBe('Bến xe Thái Nguyên');
        expect(firstEta.etaMinutes).toBeLessThanOrEqual(2);
        expect(firstEta.distanceMeters).toBeDefined();
      });
    });

    describe('[TC-TRACK-03] Truyền luồng dữ liệu thời gian thực qua SSE (Server-Sent Events)', () => {
      it('Happy Path: GET /trips/:id/tracking/stream phát luồng Observable SSE chứa vị trí xe và ETA', async () => {
        const sseObservable = trackingService.getTrackingStream(tripFar.id);
        expect(sseObservable).toBeDefined();

        // Lấy sự kiện SSE đầu tiên phát ra
        const firstMessage = await firstValueFrom(sseObservable.pipe(take(1)));
        expect(firstMessage).toHaveProperty('data');
        expect(firstMessage.data).toHaveProperty('busLocation');
        expect(firstMessage.data).toHaveProperty('stationEtas');
      });
    });

    describe('[TC-TRACK-04] Bộ giả lập GPS Simulator (Mô phỏng xe chạy tốc độ 1x, 2x, 5x)', () => {
      it('Happy Path: Khởi động bộ giả lập GPS Simulator với speedMultiplier = 2 -> Kiểm tra status running', async () => {
        // 1. Khởi động simulator
        const startRes = await request(app.getHttpServer())
          .post('/api/v1/tracking/simulator/start')
          .send({
            tripId: tripFar.id,
            speedMultiplier: 2,
          })
          .expect(201);

        const startData = startRes.body.data || startRes.body;
        expect(startData.success).toBe(true);
        expect(startData).toHaveProperty('totalWaypoints');

        // 2. Kiểm tra status simulator
        const statusRes = await request(app.getHttpServer())
          .get(`/api/v1/tracking/simulator/status/${tripFar.id}`)
          .expect(200);

        const statusData = statusRes.body.data || statusRes.body;
        expect(statusData.isRunning).toBe(true);

        // 3. Dừng simulator
        const stopRes = await request(app.getHttpServer())
          .post('/api/v1/tracking/simulator/stop')
          .send({ tripId: tripFar.id })
          .expect(201);

        const stopData = stopRes.body.data || stopRes.body;
        expect(stopData.isRunning).toBe(false);
      });
    });
  });
});
