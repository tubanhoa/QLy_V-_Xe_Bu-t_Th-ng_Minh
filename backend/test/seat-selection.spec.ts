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

import { TripsController } from '../src/modules/trips/trips.controller.js';
import { TripsService } from '../src/modules/trips/trips.service.js';
import { BookingController } from '../src/modules/booking/booking.controller.js';
import { BookingService } from '../src/modules/booking/booking.service.js';
import { SeatLockService } from '../src/modules/booking/seat-lock.service.js';

import { TripEntity } from '../src/database/entities/trip.entity.js';
import { RouteEntity } from '../src/database/entities/route.entity.js';
import { VehicleEntity } from '../src/database/entities/vehicle.entity.js';
import { SeatEntity } from '../src/database/entities/seat.entity.js';
import { TicketEntity } from '../src/database/entities/ticket.entity.js';
import { BookingEntity } from '../src/database/entities/booking.entity.js';
import { VoucherEntity } from '../src/database/entities/voucher.entity.js';
import { UserEntity } from '../src/database/entities/user.entity.js';

import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor.js';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard.js';
import { TripStatus, TicketStatus } from '../src/common/constants/status.constant.js';

describe('Seat Selection & Realtime Seat Map HTTP Integration Tests (Story Chọn Ghế)', () => {
  let app: INestApplication;
  let seatLockService: SeatLockService;

  // Mock Data
  const mockTripId = 'trip-1001-uuid';
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
    capacity: 4,
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

  // 4 seats for testing: 01A, 01B, 02A, 02B
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

  // In-memory persistent stores for the test session
  const storedTickets: any[] = [];
  const storedBookings: any[] = [];

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

  // Helper to generate a valid base64url JWT payload
  const createMockToken = (user: any) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ ...user, sub: user.id })).toString('base64url');
    return `Bearer ${header}.${payload}.mockSignature`;
  };

  const tokenUser1 = createMockToken(mockUser1);
  const tokenUser2 = createMockToken(mockUser2);

  beforeAll(async () => {
    const mockTripRepo = {
      findOne: (opts: any) => {
        if (opts?.where?.id === mockTripId) {
          return Promise.resolve(mockTrip);
        }
        return Promise.resolve(null);
      },
    };

    const mockSeatRepo = {
      find: (opts: any) => {
        if (opts?.where?.vehicleId === mockVehicleId) {
          return Promise.resolve(mockSeats);
        }
        if (opts?.where?.id?._value) {
          const ids = opts.where.id._value;
          return Promise.resolve(mockSeats.filter((s) => ids.includes(s.id)));
        }
        return Promise.resolve(mockSeats);
      },
      findOne: (opts: any) => {
        const found = mockSeats.find((s) => s.id === opts?.where?.id);
        return Promise.resolve(found || null);
      },
    };

    const mockTicketRepo = {
      createQueryBuilder: () => {
        let selectedSeatIds: string[] = [];
        const builder = {
          innerJoin: () => builder,
          leftJoinAndSelect: () => builder,
          where: () => builder,
          andWhere: (clause: string, params: any) => {
            if (params?.seatIds) {
              selectedSeatIds = params.seatIds;
            }
            return builder;
          },
          select: () => builder,
          getMany: async () => {
            return storedTickets.filter((t) => {
              const matchesSeat = selectedSeatIds.length === 0 || selectedSeatIds.includes(t.seatId);
              const active = t.status !== TicketStatus.CANCELLED && t.status !== TicketStatus.EXPIRED;
              return matchesSeat && active;
            });
          },
        };
        return builder;
      },
      create: (data: any) => ({
        id: `ticket-${Date.now()}-${Math.random()}`,
        ...data,
        seat: mockSeats.find((s) => s.id === data.seatId),
      }),
      save: async (tickets: any) => {
        const arr = Array.isArray(tickets) ? tickets : [tickets];
        storedTickets.push(...arr);
        return tickets;
      },
    };

    const mockBookingRepo = {
      create: (data: any) => ({ id: `booking-${Date.now()}`, ...data }),
      save: async (booking: any) => {
        storedBookings.push(booking);
        return booking;
      },
    };

    const mockUserRepo = {
      findOne: (opts: any) => {
        if (opts?.where?.id === mockUser1.id) return Promise.resolve(mockUser1);
        if (opts?.where?.id === mockUser2.id) return Promise.resolve(mockUser2);
        return Promise.resolve(null);
      },
    };

    const mockVehicleRepo = {
      findOne: () => Promise.resolve(mockVehicle),
    };

    const mockRouteRepo = {
      findOne: () => Promise.resolve(mockRoute),
    };

    const mockVoucherRepo = {
      findOne: () => Promise.resolve(null),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TripsController, BookingController],
      providers: [
        TripsService,
        BookingService,
        SeatLockService,
        { provide: getRepositoryToken(TripEntity), useValue: mockTripRepo },
        { provide: getRepositoryToken(SeatEntity), useValue: mockSeatRepo },
        { provide: getRepositoryToken(TicketEntity), useValue: mockTicketRepo },
        { provide: getRepositoryToken(BookingEntity), useValue: mockBookingRepo },
        { provide: getRepositoryToken(UserEntity), useValue: mockUserRepo },
        { provide: getRepositoryToken(VehicleEntity), useValue: mockVehicleRepo },
        { provide: getRepositoryToken(RouteEntity), useValue: mockRouteRepo },
        { provide: getRepositoryToken(VoucherEntity), useValue: mockVoucherRepo },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest();
          const auth = req.headers?.authorization;
          if (auth === tokenUser1) {
            req.user = mockUser1;
            return true;
          }
          if (auth === tokenUser2) {
            req.user = mockUser2;
            return true;
          }
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api', { exclude: ['/'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformResponseInterceptor());

    await app.init();

    seatLockService = app.get(SeatLockService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('Yêu cầu 1, 2, 3, 8: Sơ đồ ghế Realtime (GET /api/v1/trips/:id/seat-map)', () => {
    it('lấy sơ đồ ghế ban đầu: tất cả 4 ghế đều ở trạng thái available', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/trips/${mockTripId}/seat-map`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tripId).toBe(mockTripId);
      expect(res.body.data.totalSeats).toBe(4);
      expect(res.body.data.bookedCount).toBe(0);
      expect(res.body.data.holdingCount).toBe(0);
      expect(res.body.data.availableCount).toBe(4);
      expect(res.body.data.seats).toHaveLength(4);

      const seat1 = res.body.data.seats.find((s: any) => s.seatNumber === '01A');
      expect(seat1).toBeDefined();
      expect(seat1.bookingStatus).toBe('available');
      expect(seat1.isBooked).toBe(false);
      expect(seat1.isHeldByMe).toBe(false);
      expect(seat1.holdExpiresAt).toBeNull();
    });

    it('trả về 404 khi tripId không tồn tại', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/trips/non-existent-trip-id/seat-map');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Yêu cầu 4, 5, 6: Giữ chỗ ghế (POST /api/v1/booking/hold-seats) & Phản ánh lên sơ đồ', () => {
    it('User 1 giữ thành công 2 ghế 01A (seat-1) và 01B (seat-2)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/booking/hold-seats')
        .set('Authorization', tokenUser1)
        .send({
          tripId: mockTripId,
          seatIds: ['seat-1-uuid', 'seat-2-uuid'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.lockedSeats).toEqual(['seat-1-uuid', 'seat-2-uuid']);
      expect(res.body.expiresAt).toBeDefined();
    });

    it('sau khi User 1 giữ chỗ, sơ đồ ghế phản ánh trạng thái holding và phân biệt isHeldByMe', async () => {
      // 1. User 1 xem sơ đồ ghế: isHeldByMe phải là TRUE
      const resUser1 = await request(app.getHttpServer())
        .get(`/api/v1/trips/${mockTripId}/seat-map`)
        .set('Authorization', tokenUser1);

      expect(resUser1.status).toBe(200);
      expect(resUser1.body.data.holdingCount).toBe(2);
      expect(resUser1.body.data.availableCount).toBe(2);

      const seat1User1 = resUser1.body.data.seats.find((s: any) => s.seatId === 'seat-1-uuid');
      expect(seat1User1.bookingStatus).toBe('holding');
      expect(seat1User1.isHeldByMe).toBe(true);
      expect(seat1User1.holdExpiresAt).toBeDefined();

      // 2. User 2 xem sơ đồ ghế: isHeldByMe phải là FALSE
      const resUser2 = await request(app.getHttpServer())
        .get(`/api/v1/trips/${mockTripId}/seat-map`)
        .set('Authorization', tokenUser2);

      expect(resUser2.status).toBe(200);
      const seat1User2 = resUser2.body.data.seats.find((s: any) => s.seatId === 'seat-1-uuid');
      expect(seat1User2.bookingStatus).toBe('holding');
      expect(seat1User2.isHeldByMe).toBe(false);
    });
  });

  describe('Yêu cầu 7 & 9: Ngăn hai người chọn cùng một ghế (Race Condition & Conflict)', () => {
    it('User 2 chọn ghế 01A mà User 1 đang giữ -> trả về 409 Conflict với failedSeats', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/booking/hold-seats')
        .set('Authorization', tokenUser2)
        .send({
          tripId: mockTripId,
          seatIds: ['seat-1-uuid'],
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toMatch(/conflict/i);
      expect(res.body.message).toContain('đang được giữ bởi hành khách khác');
      expect(res.body.failedSeats).toBeDefined();
      expect(res.body.failedSeats).toContain('01A');
    });

    it('User 1 gửi lại cùng ghế mình đang giữ -> cho phép gia hạn (re-hold)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/booking/hold-seats')
        .set('Authorization', tokenUser1)
        .send({
          tripId: mockTripId,
          seatIds: ['seat-1-uuid'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.lockedSeats).toContain('seat-1-uuid');
    });
  });

  describe('Validation & Edge Cases', () => {
    it('từ chối yêu cầu giữ hơn 5 ghế với 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/booking/hold-seats')
        .set('Authorization', tokenUser1)
        .send({
          tripId: mockTripId,
          seatIds: ['s1', 's2', 's3', 's4', 's5', 's6'],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('tối đa 5 ghế');
    });

    it('từ chối danh sách ghế rỗng với 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/booking/hold-seats')
        .set('Authorization', tokenUser1)
        .send({
          tripId: mockTripId,
          seatIds: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('từ chối ghế không tồn tại hoặc không thuộc xe với 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/booking/hold-seats')
        .set('Authorization', tokenUser1)
        .send({
          tripId: mockTripId,
          seatIds: ['seat-invalid-999'],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('không tồn tại');
    });
  });

  describe('Huỷ giữ chỗ (POST /api/v1/booking/release-seats)', () => {
    it('User 1 huỷ giữ ghế 01B (seat-2) -> ghế quay lại available', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/booking/release-seats')
        .set('Authorization', tokenUser1)
        .send({
          tripId: mockTripId,
          seatIds: ['seat-2-uuid'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Kiểm tra lại sơ đồ ghế: seat-2 quay lại available, seat-1 vẫn holding
      const resMap = await request(app.getHttpServer())
        .get(`/api/v1/trips/${mockTripId}/seat-map`);

      const seat2 = resMap.body.data.seats.find((s: any) => s.seatId === 'seat-2-uuid');
      expect(seat2.bookingStatus).toBe('available');
      expect(seat2.isBooked).toBe(false);

      const seat1 = resMap.body.data.seats.find((s: any) => s.seatId === 'seat-1-uuid');
      expect(seat1.bookingStatus).toBe('holding');
    });
  });

  describe('Chống Bypass & Đồng bộ Tạo Vé (POST /api/v1/booking/create)', () => {
    it('User 2 gọi createBooking mua đè ghế 01A mà User 1 đang giữ -> bị chặn với 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/booking/create')
        .set('Authorization', tokenUser2)
        .send({
          tripId: mockTripId,
          passengers: [
            {
              seatId: 'seat-1-uuid',
              passengerName: 'Hành khách B',
            },
          ],
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toMatch(/conflict/i);
      expect(res.body.message).toContain('đang được giữ bởi hành khách khác');
      expect(res.body.failedSeats).toBeDefined();
      expect(res.body.failedSeats).toContain('01A');
    });

    it('User 1 tạo vé cho ghế 01A thành công -> ghế chuyển sang booked và giải phóng lock', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/booking/create')
        .set('Authorization', tokenUser1)
        .send({
          tripId: mockTripId,
          passengers: [
            {
              seatId: 'seat-1-uuid',
              passengerName: 'Nguyễn Văn A',
              passengerPhone: '0981111111',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tickets).toHaveLength(1);
      expect(res.body.data.tickets[0].seatNumber).toBe('01A');

      // Verify lock is released in SeatLockService
      const lockInfo = await seatLockService.isSeatLocked(mockTripId, 'seat-1-uuid');
      expect(lockInfo.isLocked).toBe(false);

      // Verify seat-map reflects 'booked'
      const resMap = await request(app.getHttpServer())
        .get(`/api/v1/trips/${mockTripId}/seat-map`);

      const seat1 = resMap.body.data.seats.find((s: any) => s.seatId === 'seat-1-uuid');
      expect(seat1.isBooked).toBe(true);
      expect(seat1.bookingStatus).toBe('reserved');
    });

    it('sau khi ghế đã bán, bất kỳ ai cố giữ chỗ lại ghế 01A đều bị 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/booking/hold-seats')
        .set('Authorization', tokenUser2)
        .send({
          tripId: mockTripId,
          seatIds: ['seat-1-uuid'],
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toMatch(/conflict/i);
      expect(res.body.message).toContain('đã có người đặt mua trước');
      expect(res.body.failedSeats).toContain('01A');
    });
  });
});
