import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor.js';
import { SeedService } from '../src/database/seeds/seed.service.js';

describe('Real Dev Environment Verification (Postgres & Redis, HTTP Pipeline with Interceptor & Filter)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Enable Global ValidationPipe, Filter, and Interceptor exactly as in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformResponseInterceptor());

    await app.init();

    // Ensure database seed data is populated
    const seedService = app.get(SeedService);
    await seedService.runSeed();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('Scenario a: GET /api/routes without query parameters', async () => {
    const res = await request(app.getHttpServer()).get('/api/routes');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Thao tác thành công');

    const data = res.body.data;
    console.log('=== SCENARIO A REAL HTTP JSON ===');
    console.log(JSON.stringify(res.body, null, 2));

    expect(data.length).toBe(2);
    const ct01 = data.find((r: any) => r.routeCode === 'CT-01');
    const ct02 = data.find((r: any) => r.routeCode === 'CT-02');
    expect(ct01).toBeDefined();
    expect(ct02).toBeDefined();
    expect(ct01.routeStations.length).toBe(5);
    expect(ct02.routeStations.length).toBe(3);
  });

  it('Scenario b1: GET /api/routes with origin as intermediate station (Cổng KTX)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/routes')
      .query({ origin: 'Cổng KTX' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    console.log('=== SCENARIO B1 REAL HTTP JSON ===');
    console.log(JSON.stringify(res.body, null, 2));

    // Tuyến CT-01 được tìm thấy và giữ ĐẦY ĐỦ 5 trạm dừng
    expect(data.length).toBe(1);
    expect(data[0].routeCode).toBe('CT-01');
    expect(data[0].routeStations.length).toBe(5);

    // Tuyến CT-02 không đi qua Cổng KTX -> Phải bị loại bỏ
    const hasCT02 = data.some((r: any) => r.routeCode === 'CT-02');
    expect(hasCT02).toBe(false);
  });

  it('Scenario b2: GET /api/routes with destination as intermediate station (Bệnh Viện)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/routes')
      .query({ destination: 'Bệnh Viện' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    console.log('=== SCENARIO B2 REAL HTTP JSON ===');
    console.log(JSON.stringify(res.body, null, 2));

    // Tuyến CT-01 được tìm thấy và giữ ĐẦY ĐỦ 5 trạm dừng
    expect(data.length).toBe(1);
    expect(data[0].routeCode).toBe('CT-01');
    expect(data[0].routeStations.length).toBe(5);

    // Tuyến CT-02 không đi qua Bệnh Viện -> Phải bị loại bỏ
    const hasCT02 = data.some((r: any) => r.routeCode === 'CT-02');
    expect(hasCT02).toBe(false);
  });

  it('Scenario c: GET /api/v1/booking/search without date parameter', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/booking/search')
      .query({
        origin: 'ĐH CNTT & TT',
        destination: 'Bến xe',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    console.log('=== SCENARIO C REAL HTTP JSON ===');
    console.log(JSON.stringify(res.body, null, 2));

    expect(data.length).toBeGreaterThan(0);
    expect(data[0].routeCode).toBe('CT-01');
  });
});
