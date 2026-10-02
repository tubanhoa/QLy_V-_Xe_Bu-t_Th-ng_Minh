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

import { NotificationController } from '../../src/modules/notification/notification.controller.js';
import { FcmService } from '../../src/modules/notification/fcm.service.js';
import { NotificationCenterService } from '../../src/modules/notification/notification-center.service.js';
import { NotificationService } from '../../src/modules/notification/notification.service.js';
import { DeviceTokenEntity } from '../../src/database/entities/device-token.entity.js';
import { NotificationEntity } from '../../src/database/entities/notification.entity.js';
import { NotificationPreferenceEntity } from '../../src/database/entities/notification-preference.entity.js';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard.js';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter.js';
import { TransformResponseInterceptor } from '../../src/common/interceptors/transform-response.interceptor.js';
import { GeofencingService } from '../../src/modules/tracking/geofencing.service.js';
import { GpsFilterService } from '../../src/modules/tracking/gps-filter.service.js';
import { TripEntity } from '../../src/database/entities/trip.entity.js';
import { BookingEntity } from '../../src/database/entities/booking.entity.js';
import { StationEntity } from '../../src/database/entities/station.entity.js';

describe('NotificationController & Geofencing HTTP Integration Tests', () => {
  let app: INestApplication;
  let fcmService: FcmService;
  let notifCenterService: NotificationCenterService;
  let geofencingService: GeofencingService;
  let gpsFilterService: GpsFilterService;

  const mockUserId = 'usr-ictu-passenger-99';
  const mockUserToken = 'Bearer mock-valid-jwt-token-99';

  beforeAll(async () => {
    const mockDeviceTokenRepo = {
      findOne: () => Promise.resolve(null),
      create: (dto: any) => ({ id: 'token-uuid-1', ...dto }),
      save: (item: any) => Promise.resolve({ id: 'token-uuid-1', ...item }),
      update: () => Promise.resolve({ affected: 1 }),
      find: () => Promise.resolve([]),
    };

    const mockStoredNotifications: any[] = [];
    const mockNotificationRepo = {
      create: (dto: any) => ({
        id: `notif-${Date.now()}`,
        createdAt: new Date(),
        ...dto,
      }),
      save: (item: any) => {
        const entity = { id: `notif-${Date.now()}`, createdAt: new Date(), ...item };
        mockStoredNotifications.push(entity);
        return Promise.resolve(entity);
      },
      update: () => Promise.resolve({ affected: 1 }),
      count: () => Promise.resolve(mockStoredNotifications.filter((n) => !n.isRead).length),
      createQueryBuilder: () => ({
        where: function () { return this; },
        andWhere: function () { return this; },
        orderBy: function () { return this; },
        skip: function () { return this; },
        take: function () { return this; },
        getManyAndCount: () => Promise.resolve([mockStoredNotifications, mockStoredNotifications.length]),
      }),
    };

    const mockPreferenceRepo = {
      findOne: () => Promise.resolve(null),
      create: (dto: any) => ({ id: 'pref-uuid-1', ...dto }),
      save: (item: any) => Promise.resolve({ id: 'pref-uuid-1', ...item }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        FcmService,
        NotificationCenterService,
        NotificationService,
        GeofencingService,
        GpsFilterService,
        { provide: getRepositoryToken(DeviceTokenEntity), useValue: mockDeviceTokenRepo },
        { provide: getRepositoryToken(NotificationEntity), useValue: mockNotificationRepo },
        { provide: getRepositoryToken(NotificationPreferenceEntity), useValue: mockPreferenceRepo },
        { provide: getRepositoryToken(TripEntity), useValue: {} },
        { provide: getRepositoryToken(BookingEntity), useValue: {} },
        { provide: getRepositoryToken(StationEntity), useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest();
          if (req.headers?.authorization === mockUserToken) {
            req.user = { id: mockUserId, email: 'passenger99@ictu.edu.vn' };
            return true;
          }
          return false;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api', { exclude: ['/'] });
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

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

    fcmService = moduleFixture.get<FcmService>(FcmService);
    notifCenterService = moduleFixture.get<NotificationCenterService>(NotificationCenterService);
    geofencingService = moduleFixture.get<GeofencingService>(GeofencingService);
    gpsFilterService = moduleFixture.get<GpsFilterService>(GpsFilterService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Device Token Registration & Lifecycle', () => {
    it('POST /api/v1/notifications/device-token: Đăng ký FCM token mới cho người dùng', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/device-token')
        .set('Authorization', mockUserToken)
        .send({
          token: 'fcm-sample-token-123456',
          platform: 'ANDROID',
          deviceModel: 'Samsung Galaxy S24',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(fcmService.getActiveTokens(mockUserId)).toContain('fcm-sample-token-123456');
    });

    it('DELETE /api/v1/notifications/device-token/:token: Hủy đăng ký token khi logout', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/notifications/device-token/fcm-sample-token-123456')
        .set('Authorization', mockUserToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(fcmService.getActiveTokens(mockUserId)).not.toContain('fcm-sample-token-123456');
    });
  });

  describe('In-App Notification Feed & Reading Status', () => {
    it('GET /api/v1/notifications: Lấy danh sách lịch sử thông báo của người dùng', async () => {
      await notifCenterService.saveNotification({
        userId: mockUserId,
        type: 'STATION_APPROACHING_PICKUP',
        title: 'Xe sắp đến trạm!',
        message: 'Tuyến CT-01 còn 3 phút nữa đến trạm ICTU',
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', mockUserToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/notifications/unread-count: Đếm số lượng thông báo chưa đọc', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', mockUserToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.unreadCount).toBe('number');
    });

    it('PATCH /api/v1/notifications/read-all: Đánh dấu toàn bộ thông báo đã đọc', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', mockUserToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Notification Preferences', () => {
    it('GET /api/v1/notifications/preferences: Lấy cài đặt thông báo', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications/preferences')
        .set('Authorization', mockUserToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(mockUserId);
    });

    it('PUT /api/v1/notifications/preferences: Cập nhật bật/tắt Push notification', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/notifications/preferences')
        .set('Authorization', mockUserToken)
        .send({
          pushEnabled: false,
          emailEnabled: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pushEnabled).toBe(false);
      expect(res.body.data.emailEnabled).toBe(true);
    });
  });
});
