import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType, Controller, Get } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor.js';
import { SeedService } from '../src/database/seeds/seed.service.js';

@Controller('test-error')
class TestErrorController {
  @Get('unhandled')
  triggerUnhandledError() {
    throw new Error('Internal DB failure: SELECT * FROM secret_table WHERE leak=true');
  }
}

describe('Phase 1 Step 3 - Entrypoint Standardization Verification', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestErrorController],
    }).compile();

    app = moduleFixture.createNestApplication();

    // 1. Global Prefix
    app.setGlobalPrefix('api', {
      exclude: ['/'],
    });

    // 2. URI Versioning
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    // 3. Global Pipes
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

    // 4. Global Filter and Interceptor
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformResponseInterceptor());

    // 5. Swagger Setup
    const config = new DocumentBuilder()
      .setTitle('Hệ Thống Quản Lý Vé Xe Buýt Thông Minh ICTU')
      .setVersion('1.0.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    await app.init();

    // Seed database
    const seedService = app.get(SeedService);
    await seedService.runSeed();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // --- KIỂM CHỨNG 1: Swagger /api/docs ---
  describe('1. Swagger Documentation (/api/docs)', () => {
    it('GET /api/docs and GET /api/docs/ accessible and serves HTML UI', async () => {
      const resRedirect = await request(app.getHttpServer()).get('/api/docs');
      expect([200, 301, 302, 307, 308]).toContain(resRedirect.status);

      const res = await request(app.getHttpServer()).get('/api/docs/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Swagger UI');
    });

    it('GET /api/docs-json returns 200 and contains new standardized endpoint paths', async () => {
      const res = await request(app.getHttpServer()).get('/api/docs-json');
      expect(res.status).toBe(200);
      const paths = Object.keys(res.body.paths);

      // Verify standardized paths exist in Swagger
      expect(paths.some((p) => p.includes('/routes'))).toBe(true);
      expect(paths.some((p) => p.includes('/auth/login'))).toBe(true);
      expect(paths.some((p) => p.includes('/booking/search') || p.includes('/bookings/search'))).toBe(true);
      expect(paths.some((p) => p.includes('/stations'))).toBe(true);
      expect(paths.some((p) => p.includes('/trips'))).toBe(true);
      expect(paths.some((p) => p.includes('/payment/create-url'))).toBe(true);
    });
  });

  // --- KIỂM CHỨNG 2: Routes & Auth Alias ---
  describe('2. Routes & Auth: /api/v1/... and /api/... aliases match identically', () => {
    it('Routes: GET /api/v1/routes and GET /api/routes return identical data', async () => {
      const resV1 = await request(app.getHttpServer()).get('/api/v1/routes');
      const resNeutral = await request(app.getHttpServer()).get('/api/routes');

      expect(resV1.status).toBe(200);
      expect(resNeutral.status).toBe(200);
      expect(resV1.body.success).toBe(true);
      expect(resNeutral.body.success).toBe(true);
      expect(resV1.body.data).toEqual(resNeutral.body.data);
      expect(resV1.body.data.length).toBeGreaterThan(0);
    });

    it('Auth: POST /api/v1/auth/login and POST /api/auth/login return identical structure', async () => {
      const badCredentials = { email: 'nonexistent@example.com', password: 'wrongpassword' };
      const resV1 = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(badCredentials);
      const resNeutral = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(badCredentials);

      expect(resV1.status).toBe(401);
      expect(resNeutral.status).toBe(401);
      expect(resV1.body.success).toBe(false);
      expect(resNeutral.body.success).toBe(false);
      expect(resV1.body.message).toBe(resNeutral.body.message);
      expect(resV1.body.errorCode).toBe(resNeutral.body.errorCode);
    });
  });

  // --- KIỂM CHỨNG 3: Booking 4 tổ hợp ---
  describe('3. Booking: 4 combinations (/api/v1/booking, /api/v1/bookings, /api/booking, /api/bookings)', () => {
    it('All 4 combinations of /search return identical responses', async () => {
      const queryParams = {
        origin: 'ĐH CNTT & TT Thái Nguyên',
        destination: 'Bến Xe Trung Tâm Thái Nguyên',
        date: '2026-09-26',
      };

      const res1 = await request(app.getHttpServer()).get('/api/v1/booking/search').query(queryParams);
      const res2 = await request(app.getHttpServer()).get('/api/v1/bookings/search').query(queryParams);
      const res3 = await request(app.getHttpServer()).get('/api/booking/search').query(queryParams);
      const res4 = await request(app.getHttpServer()).get('/api/bookings/search').query(queryParams);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res3.status).toBe(200);
      expect(res4.status).toBe(200);

      expect(res1.body.success).toBe(true);
      expect(res2.body.success).toBe(true);
      expect(res3.body.success).toBe(true);
      expect(res4.body.success).toBe(true);

      expect(res1.body.data).toEqual(res2.body.data);
      expect(res2.body.data).toEqual(res3.body.data);
      expect(res3.body.data).toEqual(res4.body.data);

      console.log('=== BOOKING COMBINATIONS REAL HTTP JSON SAMPLE (/api/v1/booking/search) ===');
      console.log(JSON.stringify(res1.body, null, 2));
      console.log('Combo 1 (/api/v1/booking):', res1.status, 'Items:', res1.body.data.length);
      console.log('Combo 2 (/api/v1/bookings):', res2.status, 'Items:', res2.body.data.length);
      console.log('Combo 3 (/api/booking):', res3.status, 'Items:', res3.body.data.length);
      console.log('Combo 4 (/api/bookings):', res4.status, 'Items:', res4.body.data.length);
    });
  });

  // --- KIỂM CHỨNG 4: 11 module rút gọn relative path ---
  describe('4. Representative relative modules: /api/v1/... works without VERSION_NEUTRAL', () => {
    it('Stations: GET /api/v1/stations returns 200 OK', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/stations');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('Trips: GET /api/v1/trips/:id returns 200 OK', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/trips/8e1b2a65-840a-4d2d-8b20-f2b88dbb8d80');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('8e1b2a65-840a-4d2d-8b20-f2b88dbb8d80');
    });

    it('Voucher: POST /api/v1/vouchers/validate returns 201 OK', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/vouchers/validate')
        .send({ code: 'ICTU2026', orderAmount: 50000 });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
    });

    it('Relative modules do NOT have VERSION_NEUTRAL (e.g. GET /api/stations returns 404)', async () => {
      const res = await request(app.getHttpServer()).get('/api/stations');
      expect(res.status).toBe(404);
    });
  });

  // --- KIỂM CHỨNG 5: forbidNonWhitelisted ---
  describe('5. forbidNonWhitelisted rejects unknown fields and formats via AllExceptionsFilter', () => {
    it('Rejects unknown extra fields in DTO with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/vouchers/validate')
        .send({
          code: 'ICTU2026',
          orderValue: 20000,
          unexpected_extra_field: 'malicious_or_unknown_payload',
        });

      console.log('=== FORBID NON WHITELISTED 400 REAL RESPONSE ===');
      console.log(JSON.stringify(res.body, null, 2));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.errorCode).toBe('Bad Request');
      expect(res.body.message).toContain('property unexpected_extra_field should not exist');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.path).toBe('/api/v1/vouchers/validate');
    });
  });

  // --- KIỂM CHỨNG 6: NODE_ENV production vs development error shielding ---
  describe('6. NODE_ENV error shielding in AllExceptionsFilter', () => {
    const originalEnv = process.env.NODE_ENV;

    afterAll(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('development: reveals error details for debugging', async () => {
      process.env.NODE_ENV = 'development';
      const res = await request(app.getHttpServer()).get('/api/v1/test-error/unhandled');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Internal DB failure: SELECT * FROM secret_table WHERE leak=true');
    });

    it('production: hides technical details and returns generic message', async () => {
      process.env.NODE_ENV = 'production';
      const res = await request(app.getHttpServer()).get('/api/v1/test-error/unhandled');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.');
      expect(res.body.message).not.toContain('secret_table');
    });
  });
});
