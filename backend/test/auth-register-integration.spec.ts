import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor.js';
import { SeedService } from '../src/database/seeds/seed.service.js';

describe('Auth Register Integration Tests', () => {
  let app: INestApplication;

  // Generate unique email for each test run to avoid conflicts
  const uniqueSuffix = Date.now();
  const testEmail = `integration-test-${uniqueSuffix}@ictu.edu.vn`;

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

  // ========================================
  // REGISTER ENDPOINT TESTS
  // ========================================
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: testEmail,
          password: 'Password@123',
          fullName: 'Integration Test User',
          phoneNumber: '0987654321',
        })
        .expect(201);

      // Response wrapped by TransformResponseInterceptor: { success, data, message }
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');

      const data = response.body.data;
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('accessToken');
      expect(data).toHaveProperty('refreshToken');
      expect(data).toHaveProperty('tokenType', 'Bearer');
      expect(data.user.email).toBe(testEmail);
      expect(data.user.fullName).toBe('Integration Test User');
      expect(data.user.role).toBe('passenger');
      // Should NOT return password hash
      expect(data.user).not.toHaveProperty('passwordHash');
    });

    it('should reject duplicate email with 409', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: testEmail, // Same email as above
          password: 'Password@123',
          fullName: 'Duplicate User',
        })
        .expect(409);

      expect(response.body).toHaveProperty('statusCode', 409);
      expect(response.body.message).toContain('đã được đăng ký');
    });

    it('should reject weak password (no uppercase) with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `weak-pw-${uniqueSuffix}@ictu.edu.vn`,
          password: 'password@123', // No uppercase
          fullName: 'Weak Password User',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body.message).toBeDefined();
    });

    it('should reject password without special character with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `no-special-${uniqueSuffix}@ictu.edu.vn`,
          password: 'Password123', // No special char
          fullName: 'No Special Char User',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should reject short password (<6 chars) with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `short-pw-${uniqueSuffix}@ictu.edu.vn`,
          password: 'Ab@1', // Too short
          fullName: 'Short Password User',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should reject invalid email format with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: 'Password@123',
          fullName: 'Bad Email User',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should reject invalid phone number format with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `bad-phone-${uniqueSuffix}@ictu.edu.vn`,
          password: 'Password@123',
          fullName: 'Bad Phone User',
          phoneNumber: '12345', // Not a valid VN phone
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should reject missing required fields with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `missing-${uniqueSuffix}@ictu.edu.vn`,
          // Missing password and fullName
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should reject extra/unknown fields (forbidNonWhitelisted)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `extra-${uniqueSuffix}@ictu.edu.vn`,
          password: 'Password@123',
          fullName: 'Extra Fields User',
          unknownField: 'should be rejected',
          hackerField: 'also rejected',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  // ========================================
  // LOGIN ENDPOINT TESTS
  // ========================================
  describe('POST /api/v1/auth/login', () => {
    it('should login with the registered account', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'Password@123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');

      const data = response.body.data;
      expect(data).toHaveProperty('accessToken');
      expect(data).toHaveProperty('refreshToken');
      expect(data).toHaveProperty('tokenType', 'Bearer');
      expect(data.user.email).toBe(testEmail);
    });

    it('should reject wrong password with 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword@999',
        })
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
    });

    it('should reject non-existent email with 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nobody@ictu.edu.vn',
          password: 'Password@123',
        })
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
    });
  });

  // ========================================
  // ALIAS COMPATIBILITY TEST
  // ========================================
  describe('VERSION_NEUTRAL alias compatibility', () => {
    it('should respond on /api/auth/register (no version) as alias', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `alias-test-${uniqueSuffix}@ictu.edu.vn`,
          password: 'Password@123',
          fullName: 'Alias Test User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
    });
  });
});
