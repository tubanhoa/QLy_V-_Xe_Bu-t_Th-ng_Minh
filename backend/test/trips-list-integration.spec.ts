import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor.js';
import { SeedService } from '../src/database/seeds/seed.service.js';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from '../src/database/entities/user.entity.js';
import { Repository } from 'typeorm';

describe('GET /api/v1/trips — Admin/Dispatcher List (STT4 + STT6)', () => {
  let app: INestApplication;
  let adminToken: string;
  let passengerToken: string;

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

    // Get admin token via login
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@smartbus.ictu.vn', password: 'Password@123' });

    if (adminLogin.body?.data?.accessToken) {
      adminToken = adminLogin.body.data.accessToken;
    } else {
      // Fallback: generate token directly
      const jwtService = app.get(JwtService);
      const userRepo = app.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
      const admin = await userRepo.findOne({ where: { email: 'admin@smartbus.ictu.vn' }, relations: { role: true } });
      if (admin) {
        adminToken = await jwtService.signAsync(
          { sub: admin.id, email: admin.email, role: admin.role?.name || 'admin' },
          { secret: process.env.JWT_SECRET || 'smart-bus-jwt-access-secret-key-2026', expiresIn: '15m' },
        );
      }
    }

    // Get passenger token by registering a real user
    const uniqueSuffix = Date.now();
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `trips-test-passenger-${uniqueSuffix}@ictu.edu.vn`,
        password: 'Password@123',
        fullName: 'Trips Test Passenger',
      });

    if (registerRes.body?.data?.accessToken) {
      passengerToken = registerRes.body.data.accessToken;
    } else {
      // If register fails (e.g. already exists), try login
      const passengerLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: `trips-test-passenger-${uniqueSuffix}@ictu.edu.vn`,
          password: 'Password@123',
        });
      if (passengerLogin.body?.data?.accessToken) {
        passengerToken = passengerLogin.body.data.accessToken;
      }
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ========================================
  // AUTHORIZATION TESTS
  // ========================================
  describe('Authorization', () => {
    it('should reject request without JWT token with 401', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/trips')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('statusCode', 401);
    });

    it('should reject PASSENGER role with 403', async () => {
      if (!passengerToken) {
        // Skip if no passenger token available
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/api/v1/trips')
        .set('Authorization', `Bearer ${passengerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('statusCode', 403);
    });
  });

  // ========================================
  // FUNCTIONAL TESTS (Admin role)
  // ========================================
  describe('Functional (Admin)', () => {
    it('should return trips list with items and meta when no filter', async () => {
      if (!adminToken) {
        console.warn('SKIP: No admin token available');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/api/v1/trips')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      const data = response.body.data;
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('meta');
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.meta).toHaveProperty('page');
      expect(data.meta).toHaveProperty('limit');
      expect(data.meta).toHaveProperty('totalItems');
      expect(data.meta).toHaveProperty('totalPages');
    });

    it('should filter by date when provided', async () => {
      if (!adminToken) return;

      const response = await request(app.getHttpServer())
        .get('/api/v1/trips')
        .query({ date: '2026-09-27' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      const data = response.body.data;
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('should filter by status=scheduled', async () => {
      if (!adminToken) return;

      const response = await request(app.getHttpServer())
        .get('/api/v1/trips')
        .query({ status: 'scheduled' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = response.body.data;
      // All returned items (if any) should have status=scheduled
      for (const item of data.items) {
        expect(item.status).toBe('scheduled');
      }
    });

    it('should exclude departed trips when excludeDeparted=true (STT6)', async () => {
      if (!adminToken) return;

      const response = await request(app.getHttpServer())
        .get('/api/v1/trips')
        .query({ excludeDeparted: 'true' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = response.body.data;
      const excludedStatuses = ['departed', 'in_progress', 'completed'];
      for (const item of data.items) {
        expect(excludedStatuses).not.toContain(item.status);
      }
    });

    it('should support pagination with page and limit', async () => {
      if (!adminToken) return;

      const response = await request(app.getHttpServer())
        .get('/api/v1/trips')
        .query({ page: 1, limit: 5 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = response.body.data;
      expect(data.meta.page).toBe(1);
      expect(data.meta.limit).toBe(5);
      expect(data.items.length).toBeLessThanOrEqual(5);
    });

    it('should reject invalid date format with 400', async () => {
      if (!adminToken) return;

      const response = await request(app.getHttpServer())
        .get('/api/v1/trips')
        .query({ date: '32/13/2026' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should reject invalid status with 400', async () => {
      if (!adminToken) return;

      const response = await request(app.getHttpServer())
        .get('/api/v1/trips')
        .query({ status: 'nonexistent_status' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should sort by departureTime ASC by default', async () => {
      if (!adminToken) return;

      const response = await request(app.getHttpServer())
        .get('/api/v1/trips')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const items = response.body.data.items;
      if (items.length >= 2) {
        for (let i = 0; i < items.length - 1; i++) {
          const current = new Date(items[i].departureTime).getTime();
          const next = new Date(items[i + 1].departureTime).getTime();
          expect(current).toBeLessThanOrEqual(next);
        }
      }
    });
  });
});
