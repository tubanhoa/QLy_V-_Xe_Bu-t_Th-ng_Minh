import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor.js';
import { SeedService } from '../src/database/seeds/seed.service.js';

describe('Search Hardening Tests (VIỆC A & VIỆC B)', () => {
  let app: INestApplication;

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

    const seedService = app.get(SeedService);
    await seedService.runSeed();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('VIỆC A: Validate date sai định dạng', () => {
    it('gửi date="32/13/2026" vào search endpoint trả về 400 "Định dạng ngày không hợp lệ"', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/booking/search')
        .query({ date: '32/13/2026' });

      console.log('=== REAL HTTP RESPONSE FOR date="32/13/2026" ===');
      console.log('STATUS:', res.status);
      console.log('BODY:', JSON.stringify(res.body, null, 2));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.errorCode).toBe('Bad Request');
      expect(res.body.message).toContain('Định dạng ngày không hợp lệ');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.path).toContain('/api/v1/booking/search?date=32%2F13%2F2026');
    });

    it('không truyền date vẫn fallback về ngày hôm nay và trả về 200 OK', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/booking/search')
        .query({
          origin: 'ĐH CNTT & TT Thái Nguyên',
          destination: 'Bến Xe Trung Tâm Thái Nguyên',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('VIỆC B: Sắp xếp theo giờ khởi hành tăng dần (ORDER BY departureTime ASC)', () => {
    it('kết quả tìm kiếm chuyến xe phải được sắp xếp tăng dần theo giờ khởi hành', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/booking/search')
        .query({
          origin: 'ĐH CNTT & TT Thái Nguyên',
          destination: 'Bến Xe Trung Tâm Thái Nguyên',
          date: '2026-09-26',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const trips = res.body.data;
      expect(trips.length).toBeGreaterThan(1);

      console.log('=== TRIPS DEPARTURE TIMES (ORDER VERIFICATION) ===');
      const departureTimes = trips.map((t: any) => t.departureTime);
      console.log(departureTimes);

      for (let i = 0; i < trips.length - 1; i++) {
        const timeCurrent = new Date(trips[i].departureTime).getTime();
        const timeNext = new Date(trips[i + 1].departureTime).getTime();
        expect(timeCurrent).toBeLessThanOrEqual(timeNext);
      }
    });
  });
});
