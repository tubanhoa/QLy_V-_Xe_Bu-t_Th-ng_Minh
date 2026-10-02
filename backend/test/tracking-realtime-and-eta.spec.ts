import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { firstValueFrom, take } from 'rxjs';

import { AppModule } from '../src/app.module.js';
import { TrackingService } from '../src/modules/tracking/tracking.service.js';
import { TrackingGateway } from '../src/modules/tracking/tracking.gateway.js';
import { TripEntity } from '../src/database/entities/trip.entity.js';
import { RouteStationEntity } from '../src/database/entities/route-station.entity.js';
import { TripIncidentEntity } from '../src/database/entities/trip-incident.entity.js';
import { UserEntity } from '../src/database/entities/user.entity.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor.js';
import { IncidentType, IncidentSeverity } from '../src/common/constants/status.constant.js';

describe('Real-time GPS Tracking, ETA Calculation, Redis Cache & WebSocket/SSE Stream Tests', () => {
  let app: INestApplication;
  let trackingService: TrackingService;
  let trackingGateway: TrackingGateway;
  let tripRepo: Repository<TripEntity>;
  let routeStationRepo: Repository<RouteStationEntity>;
  let incidentRepo: Repository<TripIncidentEntity>;
  let userRepo: Repository<UserEntity>;

  let testTripId: string;
  let testRouteStations: RouteStationEntity[];
  let testUserId: string;

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
    tripRepo = moduleFixture.get<Repository<TripEntity>>(getRepositoryToken(TripEntity));
    routeStationRepo = moduleFixture.get<Repository<RouteStationEntity>>(
      getRepositoryToken(RouteStationEntity),
    );
    incidentRepo = moduleFixture.get<Repository<TripIncidentEntity>>(
      getRepositoryToken(TripIncidentEntity),
    );
    userRepo = moduleFixture.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));

    // Lấy một người dùng mẫu trong CSDL để làm reportedBy
    const user = await userRepo.findOne({ where: {} });
    if (user) {
      testUserId = user.id;
    }

    // Lấy một chuyến xe mẫu trong CSDL để chạy kiểm thử
    const trips = await tripRepo.find({
      relations: { route: true },
      take: 5,
    });

    // Tìm chuyến xe có ít nhất 2 trạm
    for (const t of trips) {
      if (t.routeId) {
        const rs = await routeStationRepo.find({
          where: { routeId: t.routeId },
          relations: { station: true },
          order: { stopOrder: 'ASC' },
        });
        if (rs && rs.length >= 2) {
          testTripId = t.id;
          testRouteStations = rs;
          break;
        }
      }
    }

    expect(testTripId).toBeDefined();
    expect(testRouteStations.length).toBeGreaterThanOrEqual(2);
  }, 30000);

  afterAll(async () => {
    // Dừng toàn bộ simulator đang chạy
    if (testTripId) {
      trackingService.stopSimulator(testTripId);
    }
    await app.close();
  });

  // =========================================================================
  // 1. HAVERSINE DISTANCE & THUẬT TOÁN TÍNH TOÁN ETA
  // =========================================================================
  describe('Hạng mục 1: Thuật toán Haversine Distance & Tính toán ETA', () => {
    it('1.1. Tính chính xác khoảng cách Haversine giữa 2 tọa độ (ICTU và Trạm Bến Xe)', () => {
      const ictuLat = 21.585284;
      const ictuLng = 105.806297;
      const bxLat = 21.594123;
      const bxLng = 105.845678;

      const dist = trackingService.haversineDistance(ictuLat, ictuLng, bxLat, bxLng);
      expect(dist).toBeGreaterThan(3000); // Khoảng cách > 3km
      expect(dist).toBeLessThan(6000); // < 6km

      // Khoảng cách giữa cùng 1 điểm phải bằng 0
      const distZero = trackingService.haversineDistance(ictuLat, ictuLng, ictuLat, ictuLng);
      expect(distZero).toBe(0);

      // Tính đối xứng
      const distReverse = trackingService.haversineDistance(bxLat, bxLng, ictuLat, ictuLng);
      expect(Math.round(dist)).toBe(Math.round(distReverse));
    });

    it('1.2. Tính toán ETA và phân loại trạng thái trạm: approaching (<= 500m) và upcoming (> 500m)', async () => {
      const firstStation = testRouteStations[0].station;
      const sLat = Number(firstStation.latitude);
      const sLng = Number(firstStation.longitude);

      // Đặt vị trí xe cách trạm đầu tiên ~200m (vào geofence approaching)
      const busLat = sLat + 0.001; // ~111m
      const busLng = sLng + 0.001;

      const { stationEtas, alerts } = await trackingService.calculateTripEta(
        testTripId,
        busLat,
        busLng,
        0, // Xe đang dừng -> dùng vận tốc mặc định đô thị 25 km/h
      );

      expect(stationEtas).toBeDefined();
      expect(stationEtas.length).toBe(testRouteStations.length);

      // Trạm 1 phải ở trạng thái approaching và là nextStop
      const eta1 = stationEtas[0];
      expect(eta1.stationId).toBe(firstStation.id);
      expect(eta1.distanceMeters).toBeLessThanOrEqual(500);
      expect(eta1.status).toBe('approaching');
      expect(eta1.isNextStop).toBe(true);
      expect(eta1.etaMinutes).toBeGreaterThanOrEqual(1);
      expect(eta1.estimatedArrivalIso).toBeDefined();

      // Cảnh báo trạm (stationAlerts) phải có thông báo sắp đến trạm 1
      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts.some((a) => a.stationId === firstStation.id)).toBe(true);

      // Trạm tiếp theo (trạm 2) phải ở trạng thái upcoming và không phải nextStop
      const eta2 = stationEtas[1];
      expect(eta2.status).toBe('upcoming');
      expect(eta2.isNextStop).toBe(false);
      expect(eta2.distanceMeters).toBeGreaterThan(500);
    });

    it('1.3. Tích hợp độ trễ sự cố (delayMinutesEstimate) vào ETA khi chuyến xe có sự cố chưa xử lý', async () => {
      // Báo cáo 1 sự cố với độ trễ 12 phút
      const incident = incidentRepo.create({
        tripId: testTripId,
        reportedBy: testUserId,
        incidentType: IncidentType.TRAFFIC_JAM,
        severity: IncidentSeverity.HIGH,
        description: 'Tắc đường cục bộ đường Z115',
        delayMinutesEstimate: 12,
        resolutionStatus: 'pending',
      });
      await incidentRepo.save(incident);

      const firstStation = testRouteStations[0].station;
      const { stationEtas } = await trackingService.calculateTripEta(
        testTripId,
        Number(firstStation.latitude) + 0.01,
        Number(firstStation.longitude) + 0.01,
        30,
      );

      // ETA phải được cộng thêm độ trễ sự cố 12 phút
      const nextEta = stationEtas.find((e) => e.isNextStop);
      expect(nextEta).toBeDefined();
      expect(nextEta!.etaMinutes).toBeGreaterThanOrEqual(12);

      // Dọn dẹp sự cố sau test
      await incidentRepo.delete({ id: incident.id });
    });
  });

  // =========================================================================
  // 2. REDIS LOW-LATENCY CACHE & IN-MEMORY FALLBACK
  // =========================================================================
  describe('Hạng mục 2: Tối ưu Cache Redis & Graceful Fallback In-Memory', () => {
    it('2.1. Đọc và ghi dữ liệu bộ nhớ đệm (cacheSet / cacheGet) độ trễ dưới 5ms', async () => {
      const testKey = `tracking:test:cache:${Date.now()}`;
      const payload = {
        tripId: testTripId,
        latitude: 21.585284,
        longitude: 105.806297,
        speedKmh: 42.5,
        testTime: new Date().toISOString(),
      };

      const startSet = performance.now();
      await trackingService.cacheSet(testKey, payload, 60);
      const setDuration = performance.now() - startSet;
      expect(setDuration).toBeLessThan(50); // Rất nhanh

      const startGet = performance.now();
      const cached = await trackingService.cacheGet<typeof payload>(testKey);
      const getDuration = performance.now() - startGet;

      expect(getDuration).toBeLessThan(50);
      expect(cached).toEqual(payload);

      // Xóa cache
      await trackingService.cacheDel(testKey);
      const deleted = await trackingService.cacheGet(testKey);
      expect(deleted).toBeNull();
    });

    it('2.2. Ghi nhận vị trí (recordLocation) lưu tức thì vào cache và trả về Station ETAs', async () => {
      const pingDto = {
        tripId: testTripId,
        latitude: Number(testRouteStations[0].station.latitude),
        longitude: Number(testRouteStations[0].station.longitude),
        speedKmh: 35.0,
        headingDegrees: 90.0,
        batteryPercent: 88.0,
      };

      const result = await trackingService.recordLocation(pingDto);
      expect(result).toBeDefined();
      expect(result.stationEtas).toBeDefined();
      expect(result.stationEtas.length).toBe(testRouteStations.length);

      // Kiểm tra trong Cache xem có tồn tại snapshot vừa lưu không
      const cached = await trackingService.cacheGet<any>(`tracking:trip:${testTripId}:current`);
      expect(cached).toBeDefined();
      expect(cached.tripId).toBe(testTripId);
      expect(Number(cached.latitude)).toBeCloseTo(pingDto.latitude, 4);
      expect(Number(cached.speedKmh)).toBe(35.0);
    });

    it('2.3. getLiveTrackingWithEta truy vấn từ Cache với độ trễ cực thấp', async () => {
      const startTime = performance.now();
      const liveData = await trackingService.getLiveTrackingWithEta(testTripId);
      const duration = performance.now() - startTime;

      expect(liveData).toBeDefined();
      expect(liveData.tripId).toBe(testTripId);
      expect(Array.isArray(liveData.stationEtas)).toBe(true);
      expect(liveData.stationEtas.length).toBeGreaterThanOrEqual(2);
      expect(duration).toBeLessThan(100);
    });
  });

  // =========================================================================
  // 3. BỘ SIMULATOR GIẢ LẬP XE CHẠY
  // =========================================================================
  describe('Hạng mục 3: Bộ GPS Simulator giả lập di chuyển xe buýt', () => {
    it('3.1. Khởi động simulator cho chuyến xe thành công', async () => {
      const startResult = await trackingService.startSimulator(testTripId, 2);
      expect(startResult.success).toBe(true);
      expect(startResult.tripId).toBe(testTripId);
      expect(startResult.totalWaypoints).toBeGreaterThan(10);
    });

    it('3.2. Kiểm tra trạng thái simulator (getSimulatorStatus) đang chạy', async () => {
      const status = trackingService.getSimulatorStatus(testTripId);
      expect(status.tripId).toBe(testTripId);
      expect(status.isRunning).toBe(true);
      expect(status.totalSteps).toBeGreaterThan(0);
      expect(status.currentLat).toBeDefined();
      expect(status.currentLng).toBeDefined();
    });

    it('3.3. Dừng simulator thành công', async () => {
      const stopResult = trackingService.stopSimulator(testTripId);
      expect(stopResult.success).toBe(true);
      expect(stopResult.isRunning).toBe(false);

      const statusAfter = trackingService.getSimulatorStatus(testTripId);
      expect(statusAfter.isRunning).toBe(false);
    });
  });

  // =========================================================================
  // 4. WEBSOCKET GATEWAY & SỰ KIỆN THỜI GIAN THỰC
  // =========================================================================
  describe('Hạng mục 4: WebSocket Gateway & Phát sóng sự kiện thời gian thực', () => {
    it('4.1. Khách hàng join-trip -> Gateway phản hồi event joined và đẩy ngay snapshot', async () => {
      const emittedEvents: Array<{ event: string; data: any }> = [];
      const joinedRooms: string[] = [];

      const mockSocket: any = {
        id: 'mock-socket-client-1',
        join: (room: string) => {
          joinedRooms.push(room);
        },
        emit: (event: string, data: any) => {
          emittedEvents.push({ event, data });
        },
      };

      const res = await trackingGateway.handleJoinTrip(mockSocket, { tripId: testTripId });
      expect(res).toEqual({ event: 'joined', room: `trip:${testTripId}` });
      expect(joinedRooms).toContain(`trip:${testTripId}`);

      // Kiểm tra socket nhận ngay lập tức passenger:bus-location và passenger:eta-update
      const busLocationEvent = emittedEvents.find((e) => e.event === 'passenger:bus-location');
      const etaUpdateEvent = emittedEvents.find((e) => e.event === 'passenger:eta-update');

      expect(busLocationEvent).toBeDefined();
      expect(busLocationEvent!.data.tripId).toBe(testTripId);
      expect(etaUpdateEvent).toBeDefined();
      expect(etaUpdateEvent!.data.stationEtas).toBeDefined();
    });

    it('4.2. Xử lý driver:update-location và bus:gps-update', async () => {
      const mockSocket: any = {
        id: 'driver-socket-1',
      };

      const updateDto = {
        tripId: testTripId,
        latitude: 21.585284,
        longitude: 105.806297,
        speedKmh: 40.0,
        headingDegrees: 180.0,
        batteryPercent: 92.0,
      };

      const driverRes = await trackingGateway.handleDriverLocation(mockSocket, updateDto);
      expect(driverRes.success).toBe(true);
      expect(driverRes.tripId).toBe(testTripId);

      const gpsRes = await trackingGateway.handleBusGpsUpdate(mockSocket, updateDto);
      expect(gpsRes.success).toBe(true);
    });

    it('4.3. Phát sóng cảnh báo trạm passenger:station-alert qua Gateway khi xe vào geofence <= 500m', async () => {
      const broadcastEvents: Array<{ room: string; event: string; data: any }> = [];

      // Mock server to catch broadcasts
      (trackingGateway as any).server = {
        to: (room: string) => ({
          emit: (event: string, data: any) => {
            broadcastEvents.push({ room, event, data });
          },
        }),
      };
      // Re-trigger afterInit to register callback
      trackingGateway.afterInit();

      // Gửi tọa độ sát trạm đầu tiên (cách ~150m)
      const firstStation = testRouteStations[0].station;
      await trackingService.recordLocation({
        tripId: testTripId,
        latitude: Number(firstStation.latitude) + 0.001,
        longitude: Number(firstStation.longitude) + 0.001,
        speedKmh: 20,
      });

      // Kiểm tra có phát sóng passenger:bus-location, passenger:eta-update và passenger:station-alert
      const busLocationBroadcast = broadcastEvents.find(
        (b) => b.event === 'passenger:bus-location',
      );
      const etaBroadcast = broadcastEvents.find((b) => b.event === 'passenger:eta-update');
      const stationAlertBroadcast = broadcastEvents.find(
        (b) => b.event === 'passenger:station-alert',
      );

      expect(busLocationBroadcast).toBeDefined();
      expect(etaBroadcast).toBeDefined();
      expect(stationAlertBroadcast).toBeDefined();
      expect(stationAlertBroadcast!.data.stationId).toBe(firstStation.id);
      expect(stationAlertBroadcast!.data.distanceMeters).toBeLessThanOrEqual(500);
    });
  });

  // =========================================================================
  // 5. REST VÀ SSE HTTP ENDPOINTS INTEGRATION
  // =========================================================================
  describe('Hạng mục 5: HTTP REST & SSE Endpoints Integration', () => {
    it('5.1. GET /api/v1/trips/:id/live-tracking trả về vị trí xe kèm đầy đủ mảng stationEtas chuẩn định dạng', async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/trips/${testTripId}/live-tracking`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data).toHaveProperty('tripId', testTripId);
      expect(data).toHaveProperty('latitude');
      expect(data).toHaveProperty('longitude');
      expect(data).toHaveProperty('speedKmh');
      expect(data).toHaveProperty('headingDegrees');
      expect(data).toHaveProperty('batteryPercent');
      expect(data).toHaveProperty('stationEtas');
      expect(Array.isArray(data.stationEtas)).toBe(true);
      expect(data.stationEtas.length).toBe(testRouteStations.length);

      const firstEta = data.stationEtas[0];
      expect(firstEta).toHaveProperty('stationId');
      expect(firstEta).toHaveProperty('stationName');
      expect(firstEta).toHaveProperty('distanceMeters');
      expect(firstEta).toHaveProperty('etaMinutes');
      expect(firstEta).toHaveProperty('status');
      expect(firstEta).toHaveProperty('isNextStop');
    });

    it('5.2. POST /api/v1/tracking/gps tiếp nhận tọa độ GPS từ thiết bị IoT / hộp đen xe', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/tracking/gps')
        .send({
          tripId: testTripId,
          latitude: 21.585284,
          longitude: 105.806297,
          speedKmh: 38.5,
          headingDegrees: 90,
          batteryPercent: 95,
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tracking).toBeDefined();
    });

    it('5.3. POST /api/v1/driver/update-location cập nhật tọa độ fallback qua REST API', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/driver/update-location')
        .send({
          tripId: testTripId,
          latitude: 21.586,
          longitude: 105.807,
          speedKmh: 30,
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    it('5.4. Endpoints mô phỏng: POST /api/v1/tracking/simulator/start & status & stop', async () => {
      // 1. Start Simulator
      const startRes = await request(app.getHttpServer())
        .post('/api/v1/tracking/simulator/start')
        .send({ tripId: testTripId, speedMultiplier: 1.5 });

      expect([200, 201]).toContain(startRes.status);
      expect(startRes.body.success).toBe(true);
      const startPayload = startRes.body.data || startRes.body;
      expect(startPayload.tripId).toBe(testTripId);

      // 2. Status
      const statusRes = await request(app.getHttpServer()).get(
        `/api/v1/tracking/simulator/status/${testTripId}`,
      );

      expect(statusRes.status).toBe(200);
      const statusPayload = statusRes.body.data || statusRes.body;
      expect(statusPayload.isRunning).toBe(true);

      // 3. Stop Simulator
      const stopRes = await request(app.getHttpServer())
        .post('/api/v1/tracking/simulator/stop')
        .send({ tripId: testTripId });

      expect([200, 201]).toContain(stopRes.status);
      const stopPayload = stopRes.body.data || stopRes.body;
      expect(stopPayload.isRunning).toBe(false);
    });

    it('5.5. SSE Stream: getTrackingStream phát sinh sự kiện tracking-update chu kỳ', async () => {
      const stream$ = trackingService.getTrackingStream(testTripId);
      const firstMessage = await firstValueFrom(stream$.pipe(take(1)));

      expect(firstMessage).toBeDefined();
      expect(firstMessage.data).toBeDefined();
      const payload = firstMessage.data as any;
      expect(payload.type).toBe('tracking-update');
      expect(payload.tripId).toBe(testTripId);
      expect(payload.busLocation).toBeDefined();
      expect(payload.stationEtas).toBeDefined();
      expect(Array.isArray(payload.stationEtas)).toBe(true);
    });
  });
});
