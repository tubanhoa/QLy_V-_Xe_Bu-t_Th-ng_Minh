import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';

import { AppModule } from '../src/app.module.js';
import { RouteEntity } from '../src/database/entities/route.entity.js';
import { StationEntity } from '../src/database/entities/station.entity.js';
import { RouteStationEntity } from '../src/database/entities/route-station.entity.js';
import { TripEntity } from '../src/database/entities/trip.entity.js';
import { BookingEntity } from '../src/database/entities/booking.entity.js';
import { TicketEntity } from '../src/database/entities/ticket.entity.js';
import { UserEntity } from '../src/database/entities/user.entity.js';
import { RoleEntity } from '../src/database/entities/role.entity.js';
import { SeatEntity } from '../src/database/entities/seat.entity.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor.js';
import { TripStatus, TicketStatus, BookingStatus } from '../src/common/constants/status.constant.js';
import { Role } from '../src/common/constants/roles.constant.js';

describe('Transit Management: Routes, Stations, Pricing & Data Integrity Integration Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let adminToken: string;

  let routeRepo: Repository<RouteEntity>;
  let stationRepo: Repository<StationEntity>;
  let routeStationRepo: Repository<RouteStationEntity>;
  let tripRepo: Repository<TripEntity>;
  let bookingRepo: Repository<BookingEntity>;
  let ticketRepo: Repository<TicketEntity>;
  let userRepo: Repository<UserEntity>;
  let seatRepo: Repository<SeatEntity>;

  let testUserId: string;
  let testSeatId: string;
  let testStationA: StationEntity;
  let testStationB: StationEntity;
  let testStationC: StationEntity;
  let testStationD: StationEntity;
  let testRoute: RouteEntity;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api', {
      exclude: ['/'],
    });

    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformResponseInterceptor());

    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    routeRepo = moduleFixture.get<Repository<RouteEntity>>(getRepositoryToken(RouteEntity));
    stationRepo = moduleFixture.get<Repository<StationEntity>>(getRepositoryToken(StationEntity));
    routeStationRepo = moduleFixture.get<Repository<RouteStationEntity>>(
      getRepositoryToken(RouteStationEntity),
    );
    tripRepo = moduleFixture.get<Repository<TripEntity>>(getRepositoryToken(TripEntity));
    bookingRepo = moduleFixture.get<Repository<BookingEntity>>(getRepositoryToken(BookingEntity));
    ticketRepo = moduleFixture.get<Repository<TicketEntity>>(getRepositoryToken(TicketEntity));
    userRepo = moduleFixture.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
    seatRepo = moduleFixture.get<Repository<SeatEntity>>(getRepositoryToken(SeatEntity));

    // Lấy real user và real seat
    const sampleUser = await userRepo.findOne({ where: {} });
    testUserId = sampleUser ? sampleUser.id : '00000000-0000-0000-0000-000000000001';

    const sampleSeat = await seatRepo.findOne({ where: {} });
    testSeatId = sampleSeat ? sampleSeat.id : '00000000-0000-0000-0000-000000000001';

    // Lấy hoặc tạo admin user để generate JWT token
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@smartbus.ictu.vn',
        password: 'Password@123',
      });

    if (loginRes.body?.data?.accessToken) {
      adminToken = loginRes.body.data.accessToken;
    } else {
      adminToken = jwtService.sign(
        {
          sub: testUserId,
          id: testUserId,
          email: 'admin@smartbus.ictu.vn',
          role: Role.ADMIN,
        },
        { secret: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production' },
      );
    }

    // Dọn dẹp các tuyến test và trạm test nếu còn sót lại từ lần chạy trước
    const staleRoutes = await routeRepo.find({
      where: [{ routeCode: 'TEST-01' }, { routeCode: 'SAFE-01' }],
    });
    for (const r of staleRoutes) {
      const trips = await tripRepo.find({ where: { routeId: r.id } });
      for (const t of trips) {
        const bookings = await bookingRepo.find({ where: { tripId: t.id } });
        for (const b of bookings) {
          await ticketRepo.delete({ bookingId: b.id });
        }
        await bookingRepo.delete({ tripId: t.id });
      }
      await tripRepo.delete({ routeId: r.id });
      await routeStationRepo.delete({ routeId: r.id });
      await routeRepo.delete({ id: r.id });
    }

    const staleStations = await stationRepo.find({
      where: [
        { name: 'Trạm Test A - ĐH CNTT & TT' },
        { name: 'Trạm Test B - Cổng ĐH Sư Phạm' },
        { name: 'Trạm Test C - Ngã Ba Đồng Quang' },
        { name: 'Trạm Test D - Bến Xe Trung Tâm' },
        { name: 'Trạm Test Mới Tinh' },
      ],
    });
    for (const s of staleStations) {
      await routeStationRepo.delete({ stationId: s.id });
      await stationRepo.delete({ id: s.id });
    }

    // Tạo các trạm dừng độc lập phục vụ test
    testStationA = await stationRepo.save(
      stationRepo.create({
        name: 'Trạm Test A - ĐH CNTT & TT',
        address: 'Đường Z115, TP Thái Nguyên',
        latitude: 21.585284,
        longitude: 105.806297,
        isHub: true,
        status: 'active',
      }),
    );

    testStationB = await stationRepo.save(
      stationRepo.create({
        name: 'Trạm Test B - Cổng ĐH Sư Phạm',
        address: 'Đường Lương Ngọc Quyến, TP Thái Nguyên',
        latitude: 21.589123,
        longitude: 105.819456,
        isHub: false,
        status: 'active',
      }),
    );

    testStationC = await stationRepo.save(
      stationRepo.create({
        name: 'Trạm Test C - Ngã Ba Đồng Quang',
        address: 'Đường Hoàng Văn Thụ, TP Thái Nguyên',
        latitude: 21.592543,
        longitude: 105.832789,
        isHub: false,
        status: 'active',
      }),
    );

    testStationD = await stationRepo.save(
      stationRepo.create({
        name: 'Trạm Test D - Bến Xe Trung Tâm',
        address: 'Phường Đồng Quang, TP Thái Nguyên',
        latitude: 21.598765,
        longitude: 105.845678,
        isHub: true,
        status: 'active',
      }),
    );
  }, 30000);

  afterAll(async () => {
    // Dọn dẹp dữ liệu test
    if (testRoute?.id) {
      const trips = await tripRepo.find({ where: { routeId: testRoute.id } });
      for (const t of trips) {
        const bookings = await bookingRepo.find({ where: { tripId: t.id } });
        for (const b of bookings) {
          await ticketRepo.delete({ bookingId: b.id });
        }
        await bookingRepo.delete({ tripId: t.id });
      }
      await tripRepo.delete({ routeId: testRoute.id });
      await routeStationRepo.delete({ routeId: testRoute.id });
      await routeRepo.delete({ id: testRoute.id });
    }
    const stationIds = [testStationA?.id, testStationB?.id, testStationC?.id, testStationD?.id].filter(Boolean);
    for (const sId of stationIds) {
      await routeStationRepo.delete({ stationId: sId });
      await stationRepo.delete({ id: sId });
    }
    await app.close();
  }, 30000);

  // =========================================================================
  // PHẦN 1: QUẢN LÝ TUYẾN ĐƯỜNG (ROUTES CRUD & DURATION/PRICING/FARES)
  // =========================================================================
  describe('Phần 1: Quản lý Tuyến đường (Routes CRUD & Thông tin Mở rộng)', () => {
    it('1.1. POST /api/v1/routes tạo tuyến xe mới với mã tự động in hoa và biểu giá', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/routes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          routeCode: 'test-01',
          name: 'Tuyến Xe Buýt Kiểm Thử Số 01',
          origin: testStationA.name,
          destination: testStationD.name,
          distanceKm: 12.5,
          estimatedDurationMinutes: 35,
          basePrice: 10000,
          studentPrice: 5000,
          operatingStart: '05:30:00',
          operatingEnd: '21:00:00',
          frequencyMinutes: 15,
          pricingType: 'distance',
          fareRules: [
            { minKm: 0, maxKm: 5, price: 7000, studentPrice: 4000 },
            { minKm: 5, maxKm: 10, price: 10000, studentPrice: 5000 },
            { minKm: 10, maxKm: 999, price: 15000, studentPrice: 8000 },
          ],
          stops: [
            { stationId: testStationA.id, stopOrder: 1, distanceFromOriginKm: 0, estimatedMinutes: 0 },
            { stationId: testStationB.id, stopOrder: 2, distanceFromOriginKm: 3.5, estimatedMinutes: 10 },
            { stationId: testStationD.id, stopOrder: 3, distanceFromOriginKm: 12.5, estimatedMinutes: 35 },
          ],
        });

      expect([200, 201]).toContain(res.status);
      const data = res.body.data || res.body;
      expect(data.routeCode).toBe('TEST-01');
      expect(data.estimatedDurationMinutes).toBe(35);
      expect(data.pricingType).toBe('distance');
      expect(data.fareRules).toHaveLength(3);
      expect(data.totalStations).toBe(3);
      expect(data.routeStations).toHaveLength(3);

      testRoute = data;
    });

    it('1.2. POST /api/v1/routes từ chối tạo mã tuyến trùng lặp với lỗi 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/routes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          routeCode: 'TEST-01',
          name: 'Tuyến Trùng Lặp',
          origin: 'Origin',
          destination: 'Dest',
          basePrice: 10000,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('đã tồn tại');
    });

    it('1.3. GET /api/v1/routes trả về danh sách kèm totalStations và trạm sắp xếp stopOrder ASC', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/routes');

      expect(res.status).toBe(200);
      const routes = res.body.data || res.body;
      expect(Array.isArray(routes)).toBe(true);

      const found = routes.find((r: any) => r.id === testRoute.id);
      expect(found).toBeDefined();
      expect(found.totalStations).toBe(3);
      expect(found.routeStations[0].stopOrder).toBe(1);
      expect(found.routeStations[1].stopOrder).toBe(2);
      expect(found.routeStations[2].stopOrder).toBe(3);
    });

    it('1.4. GET /api/v1/routes/:id trả về chi tiết tuyến xe và các trạm dừng', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/routes/${testRoute.id}`);

      expect(res.status).toBe(200);
      const route = res.body.data || res.body;
      expect(route.id).toBe(testRoute.id);
      expect(route.routeCode).toBe('TEST-01');
      expect(route.totalStations).toBe(3);
    });

    it('1.5. PUT /api/v1/routes/:id cập nhật từng phần thông tin tuyến xe', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/routes/${testRoute.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          estimatedDurationMinutes: 40,
          frequencyMinutes: 10,
        });

      expect([200, 201]).toContain(res.status);
      const route = res.body.data || res.body;
      expect(route.estimatedDurationMinutes).toBe(40);
      expect(route.frequencyMinutes).toBe(10);
    });
  });

  // =========================================================================
  // PHẦN 2: RÀNG BUỘC TOÀN VẸN DỮ LIỆU KHI XÓA TUYẾN ĐƯỜNG (CRITICAL INTEGRITY)
  // =========================================================================
  describe('Phần 2: Ràng buộc Toàn vẹn Dữ liệu khi Xóa Tuyến Đường (DELETE /routes/:id)', () => {
    it('2.1. Chặn xóa tuyến khi đang có chuyến xe SCHEDULED hoặc IN_PROGRESS (Conflict 409)', async () => {
      // Tạo chuyến xe mẫu cho testRoute ở trạng thái scheduled
      const activeTrip = await tripRepo.save(
        tripRepo.create({
          routeId: testRoute.id,
          departureTime: new Date(Date.now() + 3600000),
          status: TripStatus.SCHEDULED,
        }),
      );

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/routes/${testRoute.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Tuyến đường đang có chuyến xe hoạt động hoặc đã lên lịch chạy');

      // Xóa chuyến xe test
      await tripRepo.delete({ id: activeTrip.id });
    });

    it('2.2. Chặn xóa tuyến khi đã phát sinh vé chưa hủy của hành khách (Conflict 409)', async () => {
      // Tạo chuyến xe completed nhưng có vé chưa hủy
      const completedTrip = await tripRepo.save(
        tripRepo.create({
          routeId: testRoute.id,
          departureTime: new Date(Date.now() - 7200000),
          status: TripStatus.COMPLETED,
        }),
      );

      let booking: any;
      let activeTicket: any;
      try {
        booking = await bookingRepo.save(
          bookingRepo.create({
            bookingCode: `BK-TEST-${Date.now()}`,
            userId: testUserId,
            tripId: completedTrip.id,
            totalAmount: 10000,
            discountAmount: 0,
            finalAmount: 10000,
            status: BookingStatus.PAID,
          }),
        );

        activeTicket = await ticketRepo.save(
          ticketRepo.create({
            bookingId: booking.id,
            seatId: testSeatId,
            ticketCode: `TK-TEST-${Date.now()}`,
            passengerName: 'Nguyễn Văn Test',
            originalPrice: 10000,
            status: TicketStatus.PAID,
          }),
        );

        const res = await request(app.getHttpServer())
          .delete(`/api/v1/routes/${testRoute.id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(409);
        expect(res.body.message).toContain(
          'Tuyến đường đã phát sinh giao dịch đặt vé của hành khách. Vui lòng chuyển trạng thái sang tạm ngưng (inactive) thay vì xóa.',
        );
      } finally {
        // Dọn dẹp vé và chuyến xe test
        if (activeTicket?.id) await ticketRepo.delete({ id: activeTicket.id });
        if (booking?.id) await bookingRepo.delete({ id: booking.id });
        await tripRepo.delete({ id: completedTrip.id });
      }
    });

    it('2.3. Cho phép xóa mềm (status = deleted) khi tuyến an toàn không có chuyến/vé active', async () => {
      // Tạo tuyến phụ không có chuyến hay vé để test xóa mềm
      const safeRoute = await routeRepo.save(
        routeRepo.create({
          routeCode: 'SAFE-01',
          name: 'Tuyến An Toàn Để Xóa',
          origin: 'A',
          destination: 'B',
          basePrice: 5000,
          status: 'active',
        }),
      );

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/routes/${safeRoute.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message || res.body.data?.message).toContain('thành công');

      const check = await routeRepo.findOne({ where: { id: safeRoute.id } });
      expect(check?.status).toBe('deleted');

      await routeRepo.delete({ id: safeRoute.id });
    });
  });

  // =========================================================================
  // PHẦN 3: QUẢN LÝ TRẠM DỪNG VÀ THỨ TỰ TRẠM TRÊN LỘ TRÌNH (ROUTE STATIONS)
  // =========================================================================
  describe('Phần 3: Quản lý Trạm dừng độc lập & Thứ tự trạm trên tuyến', () => {
    it('3.1. POST /api/v1/stations tạo trạm mới và validate tọa độ GPS hợp lệ', async () => {
      // 1. Tọa độ hợp lệ
      const resValid = await request(app.getHttpServer())
        .post('/api/v1/stations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Trạm Test Mới Tinh',
          address: 'Đường Quang Trung, TP Thái Nguyên',
          latitude: 21.578912,
          longitude: 105.812345,
          isHub: false,
        });

      expect([200, 201]).toContain(resValid.status);
      const station = resValid.body.data || resValid.body;
      expect(station.id).toBeDefined();

      // 2. Tọa độ vượt quá giới hạn -> 400 Bad Request
      const resInvalid = await request(app.getHttpServer())
        .post('/api/v1/stations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Trạm Lỗi Tọa Độ',
          latitude: 195.0, // Vượt quá 90
          longitude: 105.0,
        });

      expect(resInvalid.status).toBe(400);

      // Xóa trạm vừa tạo
      await stationRepo.delete({ id: station.id });
    });

    it('3.2. DELETE /api/v1/stations/:id chặn xóa trạm đang nằm trong tuyến xe active (409 Conflict)', async () => {
      // testStationA đang nằm trong testRoute (active)
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/stations/${testStationA.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Trạm dừng đang thuộc các tuyến xe hoạt động');
    });

    it('3.3. POST /api/v1/routes/:id/stations chèn trạm C vào vị trí stopOrder = 2 và dồn các trạm sau', async () => {
      // Trước: A (order 1), B (order 2), D (order 3)
      // Thêm C vào vị trí 2 -> Dự kiến: A (1), C (2), B (3), D (4)
      const res = await request(app.getHttpServer())
        .post(`/api/v1/routes/${testRoute.id}/stations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stationId: testStationC.id,
          stopOrder: 2,
          distanceFromOriginKm: 7.0,
          estimatedMinutes: 20,
        });

      expect([200, 201]).toContain(res.status);
      const route = res.body.data || res.body;
      expect(route.routeStations).toHaveLength(4);

      const stops = route.routeStations;
      expect(stops[0].stationId).toBe(testStationA.id);
      expect(stops[0].stopOrder).toBe(1);

      expect(stops[1].stationId).toBe(testStationC.id);
      expect(stops[1].stopOrder).toBe(2);

      expect(stops[2].stationId).toBe(testStationB.id);
      expect(stops[2].stopOrder).toBe(3);

      expect(stops[3].stationId).toBe(testStationD.id);
      expect(stops[3].stopOrder).toBe(4);
    });

    it('3.4. DELETE /api/v1/routes/:id/stations/:stationId gỡ trạm và tự động đánh số lại 1..N', async () => {
      // Gỡ trạm C (order 2) -> Các trạm còn lại phải được đánh số lại 1, 2, 3
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/routes/${testRoute.id}/stations/${testStationC.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const route = res.body.data || res.body;
      expect(route.routeStations).toHaveLength(3);

      const stops = route.routeStations;
      expect(stops[0].stationId).toBe(testStationA.id);
      expect(stops[0].stopOrder).toBe(1);

      expect(stops[1].stationId).toBe(testStationB.id);
      expect(stops[1].stopOrder).toBe(2);

      expect(stops[2].stationId).toBe(testStationD.id);
      expect(stops[2].stopOrder).toBe(3);
    });
  });

  // =========================================================================
  // PHẦN 4: CẤU HÌNH VÀ TÍNH TOÁN GIÁ VÉ LINH HOẠT (PRICING & CALCULATE FARE)
  // =========================================================================
  describe('Phần 4: Cấu hình và Tính toán Giá vé Linh hoạt', () => {
    it('4.1. PUT /api/v1/routes/:id/pricing cập nhật cơ chế định giá theo khoảng cách', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/routes/${testRoute.id}/pricing`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          pricingType: 'distance',
          basePrice: 10000,
          studentPrice: 5000,
          fareRules: [
            { minKm: 0, maxKm: 4, price: 7000, studentPrice: 3500 },
            { minKm: 4.01, maxKm: 8, price: 10000, studentPrice: 5000 },
            { minKm: 8.01, maxKm: 999, price: 14000, studentPrice: 7000 },
          ],
        });

      expect([200, 201]).toContain(res.status);
      const route = res.body.data || res.body;
      expect(route.pricingType).toBe('distance');
      expect(route.fareRules).toHaveLength(3);
    });

    it('4.2. POST /api/v1/routes/:id/calculate-fare tính đúng biểu phí theo cự ly khoảng cách', async () => {
      // Trạm A (0 km) -> Trạm D (12.5 km) => distanceKm = 12.5 km -> Rule 8.01 - 999 km -> 14.000đ (SV: 7.000đ)
      const res = await request(app.getHttpServer())
        .post(`/api/v1/routes/${testRoute.id}/calculate-fare`)
        .send({
          pickupStationId: testStationA.id,
          dropoffStationId: testStationD.id,
          isStudent: true,
        });

      expect(res.status).toBe(200);
      const result = res.body.data || res.body;
      expect(result.distanceKm).toBe(12.5);
      expect(result.stationsPassed).toBe(2); // Trạm 1 -> Trạm 3 => 2 chặng
      expect(result.finalPrice).toBe(7000);
      expect(result.isStudent).toBe(true);

      // Khách hàng thông thường không có thẻ HSSV
      const resNormal = await request(app.getHttpServer())
        .post(`/api/v1/routes/${testRoute.id}/calculate-fare`)
        .send({
          pickupStationId: testStationA.id,
          dropoffStationId: testStationD.id,
          isStudent: false,
        });

      expect(resNormal.status).toBe(200);
      expect(resNormal.body.data.finalPrice || resNormal.body.finalPrice).toBe(14000);
    });

    it('4.3. POST /api/v1/routes/:id/calculate-fare từ chối nếu trạm đón sau trạm trả (400 Bad Request)', async () => {
      // Đón tại Trạm D (order 3) và Trả tại Trạm A (order 1) -> Đi ngược chiều lộ trình
      const res = await request(app.getHttpServer())
        .post(`/api/v1/routes/${testRoute.id}/calculate-fare`)
        .send({
          pickupStationId: testStationD.id,
          dropoffStationId: testStationA.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Trạm đón phải trước trạm trả trên lộ trình xe chạy');
    });

    it('4.4. Tính biểu phí theo chặng (pricingType = stage)', async () => {
      // Đổi sang định giá theo chặng
      await request(app.getHttpServer())
        .put(`/api/v1/routes/${testRoute.id}/pricing`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          pricingType: 'stage',
          basePrice: 10000,
          fareRules: [
            { minStage: 1, maxStage: 1, price: 6000, studentPrice: 3000 },
            { minStage: 2, maxStage: 5, price: 11000, studentPrice: 5500 },
          ],
        });

      // Đi từ A (order 1) đến B (order 2) -> 1 chặng -> 6.000đ
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/routes/${testRoute.id}/calculate-fare`)
        .send({
          pickupStationId: testStationA.id,
          dropoffStationId: testStationB.id,
          isStudent: false,
        });

      expect(res1.status).toBe(200);
      expect(res1.body.data.finalPrice || res1.body.finalPrice).toBe(6000);

      // Đi từ A (order 1) đến D (order 3) -> 2 chặng -> 11.000đ
      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/routes/${testRoute.id}/calculate-fare`)
        .send({
          pickupStationId: testStationA.id,
          dropoffStationId: testStationD.id,
          isStudent: true,
        });

      expect(res2.status).toBe(200);
      expect(res2.body.data.finalPrice || res2.body.finalPrice).toBe(5500);
    });
  });
});
