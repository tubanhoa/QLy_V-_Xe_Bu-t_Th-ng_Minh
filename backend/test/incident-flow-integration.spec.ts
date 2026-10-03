import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';

import { AppModule } from '../src/app.module.js';
import { TrackingService } from '../src/modules/tracking/tracking.service.js';
import { TrackingGateway } from '../src/modules/tracking/tracking.gateway.js';
import { NotificationCenterService } from '../src/modules/notification/notification-center.service.js';
import { FcmService } from '../src/modules/notification/fcm.service.js';
import { TripEntity } from '../src/database/entities/trip.entity.js';
import { TripIncidentEntity } from '../src/database/entities/trip-incident.entity.js';
import { BookingEntity } from '../src/database/entities/booking.entity.js';
import { UserEntity } from '../src/database/entities/user.entity.js';
import { RoleEntity } from '../src/database/entities/role.entity.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor.js';
import {
  TripStatus,
  IncidentType,
  IncidentSeverity,
  BookingStatus,
} from '../src/common/constants/status.constant.js';

describe('[TASK-BACKEND] Incident Management & Real-time Notification Integration Flow', () => {
  let app: INestApplication;
  let trackingService: TrackingService;
  let trackingGateway: TrackingGateway;
  let notificationCenterService: NotificationCenterService;
  let fcmService: FcmService;

  let tripRepo: Repository<TripEntity>;
  let incidentRepo: Repository<TripIncidentEntity>;
  let userRepo: Repository<UserEntity>;
  let bookingRepo: Repository<BookingEntity>;
  let roleRepo: Repository<RoleEntity>;

  let driverUser: UserEntity;
  let passengerUser: UserEntity;
  let driverToken: string;
  let testTrip: TripEntity;
  let testBooking: BookingEntity;
  let createdIncidentId: string;

  // Mock spies
  let gatewayEmitAlertSpy: any;
  let gatewayEmitResolvedSpy: any;
  let notifSaveSpy: any;
  let fcmSendSpy: any;

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

    trackingService = moduleFixture.get<TrackingService>(TrackingService);
    trackingGateway = moduleFixture.get<TrackingGateway>(TrackingGateway);
    notificationCenterService = moduleFixture.get<NotificationCenterService>(NotificationCenterService);
    fcmService = moduleFixture.get<FcmService>(FcmService);

    tripRepo = moduleFixture.get<Repository<TripEntity>>(getRepositoryToken(TripEntity));
    incidentRepo = moduleFixture.get<Repository<TripIncidentEntity>>(
      getRepositoryToken(TripIncidentEntity),
    );
    userRepo = moduleFixture.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
    bookingRepo = moduleFixture.get<Repository<BookingEntity>>(
      getRepositoryToken(BookingEntity),
    );
    roleRepo = moduleFixture.get<Repository<RoleEntity>>(getRepositoryToken(RoleEntity));

    // 1. Chuẩn bị tài khoản tài xế có role = 'driver'
    let driverRole = await roleRepo.findOne({ where: { name: 'driver' } });
    if (!driverRole) {
      driverRole = await roleRepo.save(roleRepo.create({ name: 'driver', description: 'Tài xế' }));
    }

    let foundDriver = await userRepo.findOne({
      where: { roleId: driverRole.id },
      relations: { role: true },
    });
    if (!foundDriver) {
      foundDriver = await userRepo.save(
        userRepo.create({
          email: `test.driver.${Date.now()}@smartbus.ictu.vn`,
          fullName: 'Tài Xế Test Nam',
          passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
          roleId: driverRole.id,
          role: driverRole,
        }),
      );
    }
    driverUser = foundDriver;

    // Ký JWT Token cho tài xế
    const jwtService = moduleFixture.get<JwtService>(JwtService);
    const jwtSecret = process.env.JWT_SECRET || 'smart-bus-jwt-access-secret-key-2026';
    driverToken = await jwtService.signAsync(
      { sub: driverUser.id, email: driverUser.email, role: 'driver' },
      { secret: jwtSecret, expiresIn: '1h' },
    );

    // 2. Chuẩn bị hành khách và chuyến xe thử nghiệm
    let passengerRole = await roleRepo.findOne({ where: { name: 'passenger' } });
    if (!passengerRole) {
      passengerRole = await roleRepo.save(roleRepo.create({ name: 'passenger', description: 'Hành khách' }));
    }

    let foundPassenger = await userRepo.findOne({
      where: { roleId: passengerRole.id },
    });
    if (!foundPassenger) {
      foundPassenger = await userRepo.save(
        userRepo.create({
          email: `test.passenger.${Date.now()}@ictu.edu.vn`,
          fullName: 'Hành Khách Thử Nghiệm',
          passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
          roleId: passengerRole.id,
          role: passengerRole,
        }),
      );
    }
    passengerUser = foundPassenger;

    // Tìm chuyến xe hợp lệ
    const trips = await tripRepo.find({ take: 5 });
    if (trips.length > 0) {
      testTrip = trips[0];
    } else {
      throw new Error('Không có chuyến xe nào trong CSDL để chạy kiểm thử');
    }

    // Đặt lại trạng thái ban đầu của chuyến xe thành 'in_progress' để kiểm tra chuyển đổi trạng thái
    testTrip.status = TripStatus.IN_PROGRESS;
    await tripRepo.save(testTrip);

    // Xóa các incident cũ của trip nếu có để đảm bảo môi trường sạch
    await incidentRepo.delete({ tripId: testTrip.id });

    // Tạo booking thử nghiệm cho hành khách trên chuyến xe này (trạng thái PAID)
    const existingBooking = await bookingRepo.findOne({
      where: { tripId: testTrip.id, userId: passengerUser.id },
    });
    if (!existingBooking) {
      testBooking = await bookingRepo.save(
        bookingRepo.create({
          bookingCode: `BK-TEST-${Date.now().toString().slice(-6)}`,
          tripId: testTrip.id,
          userId: passengerUser.id,
          totalAmount: 10000,
          discountAmount: 0,
          finalAmount: 10000,
          status: BookingStatus.PAID,
        }),
      );
    } else {
      existingBooking.status = BookingStatus.PAID;
      testBooking = await bookingRepo.save(existingBooking);
    }

    // 3. Spy vào các dịch vụ Real-time & Push Notification
    gatewayEmitAlertSpy = vi.spyOn(trackingGateway, 'emitIncidentAlert');
    gatewayEmitResolvedSpy = vi.spyOn(trackingGateway, 'emitIncidentResolved');
    notifSaveSpy = vi.spyOn(notificationCenterService, 'saveNotification');
    fcmSendSpy = vi.spyOn(fcmService, 'sendPushToUser');
  }, 35000);

  afterAll(async () => {
    // Dọn dẹp dữ liệu test
    if (createdIncidentId && incidentRepo) {
      await incidentRepo.delete({ id: createdIncidentId }).catch(() => {});
    }
    if (testBooking?.id && bookingRepo) {
      await bookingRepo.delete({ id: testBooking.id }).catch(() => {});
    }
    if (app) {
      await app.close();
    }
  }, 30000);

  // =========================================================================
  // 1. TÀI XẾ BÁO CÁO SỰ CỐ (POST /api/v1/driver/incidents)
  // =========================================================================
  describe('Yêu cầu 4.2 & 4.3: POST /api/v1/driver/incidents', () => {
    it('1.1. Báo cáo sự cố thành công: Lưu DB Supabase, trip.status -> "delayed", WebSocket emit và gửi FCM cho hành khách', async () => {
      const payload = {
        tripId: testTrip.id,
        incidentType: IncidentType.TRAFFIC_JAM,
        severity: IncidentSeverity.HIGH,
        delayMinutesEstimate: 20,
        description: 'Đang ùn tắc nghiêm trọng tại Ngã 3 Mỏ Chè do trời mưa lớn',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/driver/incidents')
        .set('Authorization', `Bearer ${driverToken}`)
        .send(payload);

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);

      const incidentData = res.body.data;
      expect(incidentData).toBeDefined();
      expect(incidentData.id).toBeDefined();
      expect(incidentData.tripId).toBe(testTrip.id);
      expect(incidentData.incidentType).toBe(IncidentType.TRAFFIC_JAM);
      expect(incidentData.severity).toBe(IncidentSeverity.HIGH);
      expect(incidentData.delayMinutesEstimate).toBe(20);
      expect(incidentData.resolutionStatus).toBe('pending');
      createdIncidentId = incidentData.id;

      // 1. Kiểm tra CSDL Supabase: Có bản ghi trong trip_incidents
      const savedInDb = await incidentRepo.findOne({ where: { id: createdIncidentId } });
      expect(savedInDb).toBeDefined();
      expect(savedInDb?.description).toContain('ùn tắc nghiêm trọng');
      expect(savedInDb?.reportedBy).toBe(driverUser.id);
      expect(savedInDb?.resolutionStatus).toBe('pending');

      // 2. Kiểm tra CSDL Supabase: trip.status đã tự động chuyển đổi sang 'delayed'
      const updatedTrip = await tripRepo.findOne({ where: { id: testTrip.id } });
      expect(updatedTrip).toBeDefined();
      expect(updatedTrip?.status).toBe(TripStatus.DELAYED);

      // 3. Kiểm tra WebSocket Gateway: Đã nhận đúng event 'passenger:incident-alert'
      expect(gatewayEmitAlertSpy).toHaveBeenCalledWith(
        testTrip.id,
        expect.objectContaining({
          tripId: testTrip.id,
          incidentId: createdIncidentId,
          incidentType: IncidentType.TRAFFIC_JAM,
          severity: IncidentSeverity.HIGH,
          delayMinutesEstimate: 20,
          tripStatus: TripStatus.DELAYED,
        }),
      );

      // 4. Kiểm tra NotificationCenterService: Lưu thông báo vào bảng notifications
      expect(notifSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: passengerUser.id,
          tripId: testTrip.id,
          type: 'INCIDENT_ALERT',
          title: expect.stringContaining('Cảnh báo'),
          deepLink: `/trips/${testTrip.id}/live`,
        }),
      );

      // 5. Kiểm tra FcmService: Bắn Push Notification tới thiết bị hành khách
      expect(fcmSendSpy).toHaveBeenCalledWith(
        passengerUser.id,
        expect.stringContaining('Cảnh báo'),
        expect.stringContaining('20 phút'),
        expect.objectContaining({
          tripId: testTrip.id,
          incidentId: createdIncidentId,
          type: 'INCIDENT_ALERT',
          deepLink: `/trips/${testTrip.id}/live`,
        }),
      );
    });

    it('1.2. Trả về 401 khi không truyền Authorization Bearer Token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/driver/incidents')
        .send({
          tripId: testTrip.id,
          incidentType: IncidentType.BREAKDOWN,
          description: 'Hỏng xe giữa đường',
        });

      expect(res.status).toBe(401);
    });

    it('1.3. Trả về 404 khi báo cáo sự cố cho chuyến xe không tồn tại', async () => {
      const nonExistentTripId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app.getHttpServer())
        .post('/api/v1/driver/incidents')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          tripId: nonExistentTripId,
          incidentType: IncidentType.ACCIDENT,
          description: 'Tai nạn nhẹ',
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Không tìm thấy chuyến xe');
    });

    it('1.4. Trả về 400 khi payload không hợp lệ (thiếu description hoặc sai enum)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/driver/incidents')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          tripId: testTrip.id,
          incidentType: 'invalid_type_123',
          description: '',
        });

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // 2. LẤY DANH SÁCH SỰ CỐ THEO CHUYẾN XE (GET /api/v1/trips/:id/incidents)
  // =========================================================================
  describe('GET /api/v1/trips/:id/incidents', () => {
    it('2.1. Lấy danh sách sự cố của chuyến xe trả về đúng danh sách đã ghi nhận', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/trips/${testTrip.id}/incidents`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const found = res.body.data.find((inc: any) => inc.id === createdIncidentId);
      expect(found).toBeDefined();
      expect(found.incidentType).toBe(IncidentType.TRAFFIC_JAM);
      expect(found.resolutionStatus).toBe('pending');
    });
  });

  // =========================================================================
  // 3. ĐÓNG / GIẢI QUYẾT SỰ CỐ (PATCH /api/v1/driver/incidents/:id/resolve)
  // =========================================================================
  describe('Yêu cầu 4.4: PATCH /api/v1/driver/incidents/:id/resolve', () => {
    it('3.1. Đóng sự cố thành công: Cập nhật DB Supabase -> resolutionStatus="resolved", trip.status khôi phục về "in_progress", emit WebSocket và Push Notification', async () => {
      const resolvePayload = {
        resolutionNotes: 'Đường đã thông thoáng, xe tiếp tục lộ trình bình thường',
      };

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/driver/incidents/${createdIncidentId}/resolve`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send(resolvePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const resolvedData = res.body.data;
      expect(resolvedData.id).toBe(createdIncidentId);
      expect(resolvedData.resolutionStatus).toBe('resolved');
      expect(resolvedData.resolvedBy).toBe(driverUser.id);
      expect(resolvedData.resolvedAt).toBeDefined();

      // 1. Kiểm tra CSDL Supabase: trip_incidents đã được cập nhật
      const dbIncident = await incidentRepo.findOne({ where: { id: createdIncidentId } });
      expect(dbIncident?.resolutionStatus).toBe('resolved');
      expect(dbIncident?.resolvedBy).toBe(driverUser.id);
      expect(dbIncident?.description).toContain('Đã khắc phục: Đường đã thông thoáng');

      // 2. Kiểm tra CSDL Supabase: trip.status đã được khôi phục về 'in_progress'
      const recoveredTrip = await tripRepo.findOne({ where: { id: testTrip.id } });
      expect(recoveredTrip?.status).toBe(TripStatus.IN_PROGRESS);

      // 3. Kiểm tra WebSocket Gateway: Nhận event 'passenger:incident-resolved'
      expect(gatewayEmitResolvedSpy).toHaveBeenCalledWith(
        testTrip.id,
        expect.objectContaining({
          incidentId: createdIncidentId,
          tripId: testTrip.id,
          tripStatus: TripStatus.IN_PROGRESS,
          resolutionNotes: 'Đường đã thông thoáng, xe tiếp tục lộ trình bình thường',
        }),
      );

      // 4. Kiểm tra NotificationCenterService: Lưu thông báo giải tỏa cho hành khách
      expect(notifSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: passengerUser.id,
          tripId: testTrip.id,
          type: 'INCIDENT_RESOLVED',
          title: expect.stringContaining('Sự cố đã giải tỏa'),
          deepLink: `/trips/${testTrip.id}/live`,
        }),
      );

      // 5. Kiểm tra FcmService: Bắn Push Notification giải tỏa tới hành khách
      expect(fcmSendSpy).toHaveBeenCalledWith(
        passengerUser.id,
        expect.stringContaining('Sự cố đã giải tỏa'),
        expect.stringContaining('Xe đang tiếp tục hành trình'),
        expect.objectContaining({
          tripId: testTrip.id,
          incidentId: createdIncidentId,
          type: 'INCIDENT_RESOLVED',
        }),
      );
    });

    it('3.2. Trả về 404 khi giải quyết sự cố với ID không tồn tại', async () => {
      const nonExistentIncidentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/driver/incidents/${nonExistentIncidentId}/resolve`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ resolutionNotes: 'Khắc phục sự cố không tồn tại' });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Không tìm thấy sự cố');
    });
  });
});
