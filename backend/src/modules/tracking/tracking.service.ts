import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  MessageEvent,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Redis } from 'ioredis';
import { Observable, interval, from, switchMap, startWith, map } from 'rxjs';

import { VehicleTrackingEntity } from '../../database/entities/vehicle-tracking.entity.js';
import { TripIncidentEntity } from '../../database/entities/trip-incident.entity.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { RouteStationEntity } from '../../database/entities/route-station.entity.js';
import { BookingEntity } from '../../database/entities/booking.entity.js';
import {
  UpdateLocationDto,
  GpsPingDto,
  ReportIncidentDto,
  ResolveIncidentDto,
  StationEtaItem,
  LiveTrackingResponseDto,
} from './dto/tracking.dto.js';
import {
  IncidentSeverity,
  TripStatus,
  BookingStatus,
} from '../../common/constants/status.constant.js';
import { GpsFilterService } from './gps-filter.service.js';
import { GeofencingService } from './geofencing.service.js';
import { NotificationCenterService } from '../notification/notification-center.service.js';
import { FcmService } from '../notification/fcm.service.js';

export interface IncidentGatewayEmitter {
  emitAlert: (tripId: string, payload: any) => void;
  emitResolved: (tripId: string, payload: any) => void;
}

interface SimulatorState {
  interval: NodeJS.Timeout;
  currentStep: number;
  totalSteps: number;
  waypoints: Array<{ latitude: number; longitude: number; heading: number }>;
  isRunning: boolean;
  speedKmh: number;
  currentLat: number;
  currentLng: number;
}

export type BroadcastCallback = (
  tripId: string,
  location: any,
  etas: StationEtaItem[],
  alerts: any[],
) => void;

@Injectable()
export class TrackingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackingService.name);

  // Redis Client & In-memory Fallback
  private redisClient: Redis | null = null;
  private isRedisConnected = false;
  private readonly memoryStore = new Map<string, { value: any; expiresAt: number }>();

  // DB Write Throttling: tripId -> lastSavedTimestamp (ms)
  private readonly lastDbSaveMap = new Map<string, number>();

  // Active GPS Simulators: tripId -> SimulatorState
  private readonly simulatorMap = new Map<string, SimulatorState>();

  // Broadcast callback to WebSocket Gateway
  private broadcastCallback: BroadcastCallback | null = null;
  private incidentGatewayEmitter: IncidentGatewayEmitter | null = null;

  public readonly gpsFilter: GpsFilterService;
  public readonly geofencing: GeofencingService;

  constructor(
    @InjectRepository(VehicleTrackingEntity)
    private readonly trackingRepository: Repository<VehicleTrackingEntity>,
    @InjectRepository(TripIncidentEntity)
    private readonly incidentRepository: Repository<TripIncidentEntity>,
    @InjectRepository(TripEntity)
    private readonly tripRepository: Repository<TripEntity>,
    @InjectRepository(RouteStationEntity)
    private readonly routeStationRepository: Repository<RouteStationEntity>,
    @InjectRepository(BookingEntity)
    private readonly bookingRepository: Repository<BookingEntity>,
    @Optional() gpsFilterService?: GpsFilterService,
    @Optional() geofencingService?: GeofencingService,
    @Optional()
    private readonly notificationCenterService?: NotificationCenterService,
    @Optional()
    private readonly fcmService?: FcmService,
  ) {
    this.gpsFilter = gpsFilterService || new GpsFilterService();
    this.geofencing = geofencingService || new GeofencingService();

    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD || undefined;

    try {
      this.redisClient = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
      });

      this.redisClient.on('error', () => {
        this.isRedisConnected = false;
      });
    } catch {
      this.isRedisConnected = false;
      this.logger.warn('Using in-memory store for GPS tracking cache.');
    }
  }

  async onModuleInit() {
    if (this.redisClient) {
      try {
        await this.redisClient.connect();
        this.isRedisConnected = true;
        this.logger.log('Redis connected successfully for Real-time GPS Tracking.');
      } catch {
        this.isRedisConnected = false;
        this.logger.warn('Redis not available; falling back to in-memory GPS cache.');
      }
    }
  }

  async onModuleDestroy() {
    // Clear all running simulators
    for (const [tripId, sim] of this.simulatorMap.entries()) {
      if (sim.interval) {
        clearInterval(sim.interval);
      }
    }
    this.simulatorMap.clear();

    if (this.redisClient && this.isRedisConnected) {
      try {
        await this.redisClient.quit();
      } catch {
        // ignore
      }
    }
  }

  /**
   * Register WebSocket Gateway broadcast callback
   */
  public setBroadcastCallback(cb: BroadcastCallback) {
    this.broadcastCallback = cb;
  }

  /**
   * Register WebSocket Gateway incident emitter
   */
  public setIncidentGatewayEmitter(emitter: IncidentGatewayEmitter) {
    this.incidentGatewayEmitter = emitter;
  }

  /**
   * Emit incident alert to WebSocket Gateway
   */
  public emitIncidentAlertToGateway(tripId: string, payload: any) {
    if (this.incidentGatewayEmitter) {
      try {
        this.incidentGatewayEmitter.emitAlert(tripId, payload);
      } catch (err: any) {
        this.logger.warn(`Could not emit incident alert via callback: ${err.message}`);
      }
    }
  }

  /**
   * Emit incident resolved to WebSocket Gateway
   */
  public emitIncidentResolvedToGateway(tripId: string, payload: any) {
    if (this.incidentGatewayEmitter) {
      try {
        this.incidentGatewayEmitter.emitResolved(tripId, payload);
      } catch (err: any) {
        this.logger.warn(`Could not emit incident resolved via callback: ${err.message}`);
      }
    }
  }

  // ==========================================
  // CACHE ABSTRACTION (REDIS / IN-MEMORY)
  // ==========================================

  public async cacheSet(key: string, value: any, ttlSeconds = 120): Promise<void> {
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch {
        this.isRedisConnected = false;
      }
    }
    this.memoryStore.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  public async cacheGet<T = any>(key: string): Promise<T | null> {
    if (this.isRedisConnected && this.redisClient) {
      try {
        const data = await this.redisClient.get(key);
        return data ? (JSON.parse(data) as T) : null;
      } catch {
        this.isRedisConnected = false;
      }
    }
    const item = this.memoryStore.get(key);
    if (!item) return null;
    if (item.expiresAt <= Date.now()) {
      this.memoryStore.delete(key);
      return null;
    }
    return item.value as T;
  }

  public async cacheSetAdd(key: string, member: string, ttlSeconds = 7200): Promise<void> {
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.sadd(key, member);
        await this.redisClient.expire(key, ttlSeconds);
        return;
      } catch {
        this.isRedisConnected = false;
      }
    }
    const item = this.memoryStore.get(key);
    const set: Set<string> = (item && item.expiresAt > Date.now()) ? new Set(item.value) : new Set();
    set.add(member);
    this.memoryStore.set(key, {
      value: Array.from(set),
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  public async cacheSetGet(key: string): Promise<string[]> {
    if (this.isRedisConnected && this.redisClient) {
      try {
        return await this.redisClient.smembers(key);
      } catch {
        this.isRedisConnected = false;
      }
    }
    const item = this.memoryStore.get(key);
    if (!item) return [];
    if (item.expiresAt <= Date.now()) {
      this.memoryStore.delete(key);
      return [];
    }
    return Array.isArray(item.value) ? item.value : [];
  }

  public async cacheDel(key: string): Promise<void> {
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.del(key);
        return;
      } catch {
        this.isRedisConnected = false;
      }
    }
    this.memoryStore.delete(key);
  }

  // ==========================================
  // RECORD LOCATION & DB THROTTLE
  // ==========================================

  async recordLocation(dto: UpdateLocationDto | GpsPingDto) {
    const tripId = dto.tripId;
    const rawLat = Number(dto.latitude);
    const rawLng = Number(dto.longitude);
    const speedKmh = Number(dto.speedKmh) || 0;
    const headingDegrees = Number(dto.headingDegrees) || 0;
    const batteryPercent = Number(dto.batteryPercent) || 100;
    const isSimulated = (dto as UpdateLocationDto).isSimulated || false;
    const now = new Date();
    const nowMs = now.getTime();

    // 0. Lọc nhiễu GPS (Kalman / Speed Outlier Guard) & Giám sát tín hiệu
    const filterRes = this.gpsFilter.filterGpsPoint(tripId, rawLat, rawLng, nowMs);
    const currentLat = filterRes.isValid ? rawLat : filterRes.filteredLat;
    const currentLng = filterRes.isValid ? rawLng : filterRes.filteredLng;
    this.gpsFilter.checkGpsHeartbeat(tripId, nowMs);

    const locationSnapshot = {
      tripId,
      latitude: currentLat,
      longitude: currentLng,
      speedKmh,
      headingDegrees,
      batteryPercent,
      lastUpdated: now.toISOString(),
      isSimulated,
    };

    // 1. Ghi tức thì vào Redis Cache (Low latency < 5ms)
    const currentKey = `tracking:trip:${tripId}:current`;
    await this.cacheSet(currentKey, locationSnapshot, 120);

    // 2. Tính toán ETA và cảnh báo trạm
    const { stationEtas, alerts, newlyPassedStations } = await this.calculateTripEta(
      tripId,
      currentLat,
      currentLng,
      speedKmh,
    );

    // 3. Cache danh sách ETA trạm
    const etaKey = `tracking:trip:${tripId}:eta`;
    await this.cacheSet(etaKey, stationEtas, 120);

    // 4. Cơ chế Throttle / Debounce ghi PostgreSQL (VehicleTrackingEntity)
    // Chỉ ghi DB định kỳ mỗi 20s hoặc khi cập bến/vừa qua một trạm mới
    const lastSaved = this.lastDbSaveMap.get(tripId) || 0;
    const shouldSaveDb =
      nowMs - lastSaved >= 20000 || newlyPassedStations.length > 0 || lastSaved === 0;

    let savedTrackingEntity: VehicleTrackingEntity | null = null;
    if (shouldSaveDb) {
      try {
        const tracking = this.trackingRepository.create({
          tripId,
          latitude: currentLat,
          longitude: currentLng,
          speedKmh,
          headingDegrees,
          batteryPercent,
        });
        savedTrackingEntity = await this.trackingRepository.save(tracking);
        this.lastDbSaveMap.set(tripId, nowMs);
      } catch (err: any) {
        this.logger.warn(`Could not persist tracking record to database: ${err.message}`);
      }
    }

    // 5. Broadcast thời gian thực tới WebSocket Clients
    if (this.broadcastCallback) {
      try {
        this.broadcastCallback(tripId, locationSnapshot, stationEtas, alerts);
      } catch (err: any) {
        this.logger.error(`Error in broadcast callback: ${err.message}`);
      }
    }

    // 6. Tự động kiểm tra Geofencing & phát Push Notification cho hành khách
    this.geofencing
      .evaluateTripGeofences(tripId, currentLat, currentLng, stationEtas)
      .catch((err: any) => {
        this.logger.warn(`Geofence evaluation error: ${err.message}`);
      });

    return {
      tracking: savedTrackingEntity || locationSnapshot,
      stationAlerts: alerts,
      stationEtas,
    };
  }

  // ==========================================
  // THUẬT TOÁN HAVERSINE & TÍNH TOÁN ETA
  // ==========================================

  public haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Bán kính Trái Đất (mét)
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  public async calculateTripEta(
    tripId: string,
    currentLat: number,
    currentLng: number,
    speedKmh?: number,
  ): Promise<{
    stationEtas: StationEtaItem[];
    alerts: Array<{ stationId: string; stationName: string; distanceMeters: number; message: string }>;
    newlyPassedStations: string[];
  }> {
    const trip = await this.tripRepository.findOne({
      where: { id: tripId },
      relations: { route: true },
    });

    if (!trip || !trip.routeId) {
      return { stationEtas: [], alerts: [], newlyPassedStations: [] };
    }

    const routeStations = await this.routeStationRepository.find({
      where: { routeId: trip.routeId },
      relations: { station: true },
      order: { stopOrder: 'ASC' },
    });

    if (!routeStations || routeStations.length === 0) {
      return { stationEtas: [], alerts: [], newlyPassedStations: [] };
    }

    // 1. Tích hợp độ trễ sự cố chưa giải quyết
    let incidentDelayMinutes = 0;
    try {
      const activeIncidents = await this.incidentRepository.find({
        where: { tripId, resolutionStatus: 'pending' },
      });
      incidentDelayMinutes = activeIncidents.reduce(
        (sum, inc) => sum + (inc.delayMinutesEstimate || 0),
        0,
      );
    } catch {
      // ignore
    }

    // 2. Vận tốc hiệu dụng (nếu dừng hoặc < 5 km/h thì lấy mặc định đô thị 25 km/h)
    const rawSpeed = Number(speedKmh) || 0;
    const effectiveSpeedKmh = rawSpeed < 5 ? 25 : rawSpeed;

    // 3. Đọc danh sách trạm đã đi qua từ cache
    const passedKey = `tracking:trip:${tripId}:stations_passed`;
    const passedList = await this.cacheSetGet(passedKey);
    const passedSet = new Set(passedList);
    const newlyPassedStations: string[] = [];

    // Tính khoảng cách tới từng trạm trên lộ trình
    const stationsWithDistance = routeStations.map((rs) => {
      const stationLat = Number(rs.station?.latitude || 0);
      const stationLng = Number(rs.station?.longitude || 0);
      const distMeters = Math.round(
        this.haversineDistance(currentLat, currentLng, stationLat, stationLng),
      );
      return {
        rs,
        station: rs.station,
        distMeters,
      };
    });

    // 4. Nhận diện các trạm đã qua:
    // Nếu xe tiến sát trạm (<= 150m) hoặc đã vượt qua trạm đó theo thứ tự hành trình
    // Tìm trạm chưa đánh dấu passed gần nhất
    for (let i = 0; i < stationsWithDistance.length; i++) {
      const item = stationsWithDistance[i];
      const stationId = item.station?.id;
      if (!stationId) continue;

      if (!passedSet.has(stationId)) {
        // Nếu xe cách trạm <= 150m và có trạm tiếp theo gần hơn hoặc ngang bằng
        const nextItem = stationsWithDistance[i + 1];
        if (
          item.distMeters <= 150 &&
          nextItem &&
          nextItem.distMeters < item.distMeters + 100
        ) {
          passedSet.add(stationId);
          newlyPassedStations.push(stationId);
          await this.cacheSetAdd(passedKey, stationId);
        }
      }
    }

    // 5. Xác định trạm kế tiếp (Next Stop)
    let foundNextStop = false;
    const ALERT_RADIUS_METERS = parseInt(process.env.STATION_ALERT_RADIUS_METERS || '500', 10);
    const alerts: Array<{ stationId: string; stationName: string; distanceMeters: number; message: string }> = [];
    const stationEtas: StationEtaItem[] = [];
    const now = new Date();

    for (let i = 0; i < stationsWithDistance.length; i++) {
      const item = stationsWithDistance[i];
      const station = item.station;
      if (!station) continue;

      const isPassed = passedSet.has(station.id);

      if (isPassed) {
        stationEtas.push({
          stationId: station.id,
          stationName: station.name,
          stopOrder: item.rs.stopOrder,
          latitude: Number(station.latitude),
          longitude: Number(station.longitude),
          distanceMeters: item.distMeters,
          etaMinutes: 0,
          estimatedArrivalIso: now.toISOString(),
          status: 'passed',
          isNextStop: false,
        });
      } else {
        const isNext = !foundNextStop;
        if (isNext) {
          foundNextStop = true;
        }

        const isApproaching = item.distMeters <= ALERT_RADIUS_METERS;
        const status: 'approaching' | 'upcoming' = isApproaching ? 'approaching' : 'upcoming';

        // Tính ETA (phút) = ceil((distanceKm / effectiveSpeed) * 60) + incidentDelay
        const distanceKm = item.distMeters / 1000;
        const rawMinutes = Math.ceil((distanceKm / effectiveSpeedKmh) * 60);
        const etaMinutes = Math.max(1, rawMinutes) + incidentDelayMinutes;
        const arrivalDate = new Date(now.getTime() + etaMinutes * 60 * 1000);

        stationEtas.push({
          stationId: station.id,
          stationName: station.name,
          stopOrder: item.rs.stopOrder,
          latitude: Number(station.latitude),
          longitude: Number(station.longitude),
          distanceMeters: item.distMeters,
          etaMinutes,
          estimatedArrivalIso: arrivalDate.toISOString(),
          status,
          isNextStop: isNext,
        });

        if (isApproaching) {
          alerts.push({
            stationId: station.id,
            stationName: station.name,
            distanceMeters: item.distMeters,
            message: `Xe buýt sắp đến trạm ${station.name} (còn khoảng ${item.distMeters}m)`,
          });
        }
      }
    }

    return { stationEtas, alerts, newlyPassedStations };
  }

  // ==========================================
  // FAST LIVE TRACKING (< 5ms LATENCY)
  // ==========================================

  async getLiveTrackingWithEta(tripId: string): Promise<LiveTrackingResponseDto> {
    const currentKey = `tracking:trip:${tripId}:current`;
    const etaKey = `tracking:trip:${tripId}:eta`;

    const cachedCurrent = await this.cacheGet<any>(currentKey);
    const cachedEtas = await this.cacheGet<StationEtaItem[]>(etaKey);

    if (cachedCurrent && cachedEtas) {
      return {
        ...cachedCurrent,
        stationEtas: cachedEtas,
      };
    }

    // Nếu Cache chưa có hoặc hết hạn, lấy vị trí mới nhất từ DB hoặc mặc định
    let location = cachedCurrent;
    if (!location) {
      const latestDb = await this.trackingRepository.findOne({
        where: { tripId },
        order: { lastUpdated: 'DESC' },
      });

      if (latestDb) {
        location = {
          tripId,
          latitude: Number(latestDb.latitude),
          longitude: Number(latestDb.longitude),
          speedKmh: Number(latestDb.speedKmh) || 0,
          headingDegrees: Number(latestDb.headingDegrees) || 0,
          batteryPercent: Number(latestDb.batteryPercent) || 100,
          lastUpdated: latestDb.lastUpdated.toISOString(),
          isSimulated: false,
        };
      } else {
        location = {
          tripId,
          latitude: 21.585284,
          longitude: 105.806297,
          speedKmh: 0,
          headingDegrees: 0,
          batteryPercent: 100,
          lastUpdated: new Date().toISOString(),
          isSimulated: true,
        };
      }
      await this.cacheSet(currentKey, location, 120);
    }

    let stationEtas = cachedEtas;
    if (!stationEtas) {
      const etaRes = await this.calculateTripEta(
        tripId,
        location.latitude,
        location.longitude,
        location.speedKmh,
      );
      stationEtas = etaRes.stationEtas;
      await this.cacheSet(etaKey, stationEtas, 120);
    }

    return {
      ...location,
      stationEtas,
    };
  }

  async getLatestLocation(tripId: string) {
    return this.getLiveTrackingWithEta(tripId);
  }

  // ==========================================
  // GPS SIMULATOR (GIẢ LẬP XE CHẠY)
  // ==========================================

  async startSimulator(tripId: string, speedMultiplier = 1) {
    if (this.simulatorMap.has(tripId)) {
      const existing = this.simulatorMap.get(tripId)!;
      return {
        success: true,
        message: 'Mô phỏng xe buýt đã đang chạy cho chuyến này',
        tripId,
        isRunning: true,
        progressPercent: Math.round((existing.currentStep / existing.totalSteps) * 100),
      };
    }

    const trip = await this.tripRepository.findOne({
      where: { id: tripId },
      relations: { route: true },
    });

    if (!trip || !trip.routeId) {
      throw new NotFoundException(`Không tìm thấy chuyến xe hoặc tuyến tương ứng cho ID: ${tripId}`);
    }

    const routeStations = await this.routeStationRepository.find({
      where: { routeId: trip.routeId },
      relations: { station: true },
      order: { stopOrder: 'ASC' },
    });

    if (!routeStations || routeStations.length < 2) {
      throw new BadRequestException('Tuyến xe cần có ít nhất 2 trạm dừng để chạy mô phỏng');
    }

    // Reset lại trạm đã qua trong cache
    await this.cacheDel(`tracking:trip:${tripId}:stations_passed`);

    // Tạo danh sách waypoints nội suy (interpolation) giữa các trạm
    const waypoints: Array<{ latitude: number; longitude: number; heading: number }> = [];
    const STEPS_PER_SEGMENT = 10;

    for (let i = 0; i < routeStations.length - 1; i++) {
      const s1 = routeStations[i].station;
      const s2 = routeStations[i + 1].station;

      const lat1 = Number(s1.latitude);
      const lon1 = Number(s1.longitude);
      const lat2 = Number(s2.latitude);
      const lon2 = Number(s2.longitude);

      // Tính góc hướng (heading)
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
      const x =
        Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
        Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
      const heading = (Math.atan2(y, x) * 180) / Math.PI;
      const normalizedHeading = Math.round((heading + 360) % 360);

      for (let step = 0; step < STEPS_PER_SEGMENT; step++) {
        const factor = step / STEPS_PER_SEGMENT;
        waypoints.push({
          latitude: Number((lat1 + (lat2 - lat1) * factor).toFixed(6)),
          longitude: Number((lon1 + (lon2 - lon1) * factor).toFixed(6)),
          heading: normalizedHeading,
        });
      }
    }

    // Thêm điểm cuối cùng (trạm cuối)
    const lastStation = routeStations[routeStations.length - 1].station;
    waypoints.push({
      latitude: Number(lastStation.latitude),
      longitude: Number(lastStation.longitude),
      heading: waypoints[waypoints.length - 1]?.heading || 0,
    });

    const speedKmh = 35 * Math.min(3, Math.max(0.5, speedMultiplier));
    const tickIntervalMs = Math.max(500, Math.round(2000 / Math.max(0.5, speedMultiplier)));

    const state: SimulatorState = {
      interval: null as any,
      currentStep: 0,
      totalSteps: waypoints.length,
      waypoints,
      isRunning: true,
      speedKmh,
      currentLat: waypoints[0].latitude,
      currentLng: waypoints[0].longitude,
    };

    // Bắn ngay điểm đầu tiên
    await this.recordLocation({
      tripId,
      latitude: waypoints[0].latitude,
      longitude: waypoints[0].longitude,
      speedKmh,
      headingDegrees: waypoints[0].heading,
      batteryPercent: 95,
      isSimulated: true,
    });

    state.interval = setInterval(async () => {
      state.currentStep++;
      if (state.currentStep >= state.totalSteps) {
        // Đến trạm cuối -> lặp lại từ đầu
        state.currentStep = 0;
        await this.cacheDel(`tracking:trip:${tripId}:stations_passed`);
      }

      const wp = waypoints[state.currentStep];
      state.currentLat = wp.latitude;
      state.currentLng = wp.longitude;

      try {
        await this.recordLocation({
          tripId,
          latitude: wp.latitude,
          longitude: wp.longitude,
          speedKmh: state.speedKmh,
          headingDegrees: wp.heading,
          batteryPercent: Math.max(20, 95 - Math.round((state.currentStep / state.totalSteps) * 20)),
          isSimulated: true,
        });
      } catch (err: any) {
        this.logger.error(`Error in simulation step for trip ${tripId}: ${err.message}`);
      }
    }, tickIntervalMs);

    this.simulatorMap.set(tripId, state);

    return {
      success: true,
      message: `Đã khởi chạy mô phỏng di chuyển xe buýt cho chuyến xe ${tripId}`,
      tripId,
      totalWaypoints: waypoints.length,
      speedKmh,
      intervalMs: tickIntervalMs,
    };
  }

  stopSimulator(tripId: string) {
    const sim = this.simulatorMap.get(tripId);
    if (!sim) {
      return { success: true, message: 'Chuyến xe không có tiến trình mô phỏng nào đang chạy', isRunning: false };
    }

    if (sim.interval) {
      clearInterval(sim.interval);
    }
    this.simulatorMap.delete(tripId);

    return {
      success: true,
      message: `Đã dừng thành công mô phỏng xe buýt cho chuyến xe ${tripId}`,
      tripId,
      isRunning: false,
    };
  }

  getSimulatorStatus(tripId: string) {
    const sim = this.simulatorMap.get(tripId);
    if (!sim) {
      return {
        tripId,
        isRunning: false,
        currentStep: 0,
        totalSteps: 0,
        progressPercent: 0,
      };
    }

    return {
      tripId,
      isRunning: sim.isRunning,
      currentStep: sim.currentStep,
      totalSteps: sim.totalSteps,
      progressPercent: Math.round((sim.currentStep / sim.totalSteps) * 100),
      currentLat: sim.currentLat,
      currentLng: sim.currentLng,
      speedKmh: sim.speedKmh,
    };
  }

  // ==========================================
  // SERVER-SENT EVENTS (SSE) STREAM
  // ==========================================

  getTrackingStream(tripId: string): Observable<MessageEvent> {
    return interval(2500).pipe(
      startWith(0),
      switchMap(() => from(this.getLiveTrackingWithEta(tripId))),
      map((data) => {
        return {
          data: {
            type: 'tracking-update',
            tripId,
            busLocation: {
              tripId,
              latitude: data.latitude,
              longitude: data.longitude,
              speedKmh: data.speedKmh,
              headingDegrees: data.headingDegrees,
              batteryPercent: data.batteryPercent,
              lastUpdated: data.lastUpdated,
              isSimulated: data.isSimulated,
            },
            stationEtas: data.stationEtas,
          },
        } as MessageEvent;
      }),
    );
  }

  // ==========================================
  // INCIDENT REPORTING & RESOLUTION
  // ==========================================

  async reportIncident(dto: ReportIncidentDto, reportedBy: string) {
    // 1. Kiểm tra tồn tại của chuyến xe trong CSDL Supabase
    const trip = await this.tripRepository.findOne({ where: { id: dto.tripId } });
    if (!trip) {
      throw new NotFoundException('Không tìm thấy chuyến xe');
    }

    // 2. Tạo và lưu bản ghi TripIncidentEntity vào Supabase DB
    const incident = this.incidentRepository.create({
      tripId: dto.tripId,
      reportedBy,
      incidentType: dto.incidentType,
      severity: dto.severity || IncidentSeverity.MEDIUM,
      description: dto.description,
      delayMinutesEstimate: dto.delayMinutesEstimate,
      resolutionStatus: 'pending',
      reportedAt: new Date(),
    });

    const savedIncident = await this.incidentRepository.save(incident);

    // 3. Tự động chuyển đổi trạng thái chuyến xe sang 'delayed'
    trip.status = TripStatus.DELAYED;
    await this.tripRepository.save(trip);

    // 4. Cập nhật cache thời gian trễ ETA cho các trạm tiếp theo
    try {
      const current = await this.cacheGet<any>(`tracking:trip:${dto.tripId}:current`);
      if (current) {
        const { stationEtas, alerts } = await this.calculateTripEta(
          dto.tripId,
          current.latitude,
          current.longitude,
          current.speedKmh,
        );
        await this.cacheSet(`tracking:trip:${dto.tripId}:eta`, stationEtas, 120);
        if (this.broadcastCallback) {
          this.broadcastCallback(dto.tripId, current, stationEtas, alerts);
        }
      }
    } catch {
      // ignore
    }

    // 5. Lấy danh sách hành khách đã đặt vé/mua vé trên chuyến xe từ CSDL Supabase
    const bookings = await this.bookingRepository.find({
      where: {
        tripId: dto.tripId,
        status: In([BookingStatus.PAID, BookingStatus.CONFIRMED]),
      },
      select: { userId: true },
    });
    const passengerUserIds = Array.from(new Set(bookings.map((b) => b.userId).filter(Boolean)));

    // 6. Phát sóng WebSocket tới phòng trip:${tripId} (passenger:incident-alert)
    const alertPayload = {
      tripId: dto.tripId,
      incidentId: savedIncident.id,
      incidentType: savedIncident.incidentType,
      severity: savedIncident.severity,
      delayMinutesEstimate: savedIncident.delayMinutesEstimate,
      description: savedIncident.description,
      tripStatus: trip.status,
      reportedAt: savedIncident.reportedAt,
    };
    this.emitIncidentAlertToGateway(dto.tripId, alertPayload);

    // 7. Lưu Notification Center & Bắn Firebase FCM Push Notification
    const incidentTypeLabels: Record<string, string> = {
      traffic_jam: 'kẹt xe',
      breakdown: 'hỏng xe',
      accident: 'tai nạn giao thông',
      weather: 'thời tiết cực đoan',
      delay: 'trễ chuyến xe',
      other: 'sự cố kỹ thuật',
    };
    const typeLabel = incidentTypeLabels[savedIncident.incidentType] || savedIncident.incidentType;
    const title = `⚠️ Cảnh báo: Chuyến xe gặp sự cố ${typeLabel}`;
    const delayText = savedIncident.delayMinutesEstimate
      ? ` Dự kiến trễ ${savedIncident.delayMinutesEstimate} phút.`
      : '';
    const body = `Chuyến xe của bạn bị ${typeLabel}.${delayText} Vui lòng theo dõi lộ trình xe trực tiếp.`;
    const deepLink = `/trips/${dto.tripId}/live`;

    for (const userId of passengerUserIds) {
      if (this.notificationCenterService) {
        try {
          await this.notificationCenterService.saveNotification({
            userId,
            tripId: dto.tripId,
            type: 'INCIDENT_ALERT',
            title,
            body,
            deepLink,
            data: {
              tripId: dto.tripId,
              incidentId: savedIncident.id,
              incidentType: savedIncident.incidentType,
              severity: savedIncident.severity,
              delayMinutesEstimate: savedIncident.delayMinutesEstimate,
              tripStatus: trip.status,
            },
          });
        } catch (err: any) {
          this.logger.warn(`Could not save incident alert notification for user ${userId}: ${err.message}`);
        }
      }

      if (this.fcmService) {
        try {
          await this.fcmService.sendPushToUser(userId, title, body, {
            tripId: dto.tripId,
            incidentId: savedIncident.id,
            type: 'INCIDENT_ALERT',
            deepLink,
          });
        } catch (err: any) {
          this.logger.warn(`Could not dispatch FCM alert for user ${userId}: ${err.message}`);
        }
      }
    }

    return savedIncident;
  }

  async resolveIncident(incidentId: string, resolvedBy: string, dto?: ResolveIncidentDto) {
    // 1. Tìm sự cố trong Supabase trip_incidents theo ID
    const incident = await this.incidentRepository.findOne({ where: { id: incidentId } });
    if (!incident) {
      throw new NotFoundException(`Không tìm thấy sự cố với ID: ${incidentId}`);
    }

    // 2. Cập nhật trạng thái sự cố đã giải quyết
    incident.resolutionStatus = 'resolved';
    incident.resolvedBy = resolvedBy;
    incident.resolvedAt = new Date();
    if (dto?.resolutionNotes) {
      incident.description = incident.description
        ? `${incident.description} [Đã khắc phục: ${dto.resolutionNotes}]`
        : dto.resolutionNotes;
    }

    const savedIncident = await this.incidentRepository.save(incident);

    // 3. Đếm số sự cố còn pending trên chuyến xe
    const activePending = await this.incidentRepository.count({
      where: { tripId: incident.tripId, resolutionStatus: 'pending' },
    });

    // 4. Nếu không còn sự cố nào pending -> Khôi phục trạng thái chuyến xe về 'in_progress'
    const trip = await this.tripRepository.findOne({ where: { id: incident.tripId } });
    let currentTripStatus: TripStatus = TripStatus.IN_PROGRESS;
    if (activePending === 0 && trip) {
      trip.status = TripStatus.IN_PROGRESS;
      await this.tripRepository.save(trip);
      currentTripStatus = trip.status;
    } else if (trip) {
      currentTripStatus = trip.status;
    }

    // 5. Phát sóng WebSocket tới phòng trip:${tripId} (passenger:incident-resolved)
    const resolvedPayload = {
      incidentId: savedIncident.id,
      tripId: incident.tripId,
      tripStatus: currentTripStatus,
      resolutionNotes: dto?.resolutionNotes || null,
      resolvedAt: savedIncident.resolvedAt,
    };
    this.emitIncidentResolvedToGateway(incident.tripId, resolvedPayload);

    // 6. Lấy danh sách hành khách đã đặt vé/mua vé và gửi Push Notification
    const bookings = await this.bookingRepository.find({
      where: {
        tripId: incident.tripId,
        status: In([BookingStatus.PAID, BookingStatus.CONFIRMED]),
      },
      select: { userId: true },
    });
    const passengerUserIds = Array.from(new Set(bookings.map((b) => b.userId).filter(Boolean)));

    const resolvedTitle = '✅ Sự cố đã giải tỏa: Xe buýt đang tiếp tục lộ trình bình thường';
    const resolvedBody = dto?.resolutionNotes
      ? `Sự cố trên chuyến xe đã được khắc phục (${dto.resolutionNotes}). Xe đang tiếp tục hành trình.`
      : 'Sự cố trên chuyến xe đã giải tỏa: Xe buýt đang tiếp tục lộ trình bình thường.';
    const deepLink = `/trips/${incident.tripId}/live`;

    for (const userId of passengerUserIds) {
      if (this.notificationCenterService) {
        try {
          await this.notificationCenterService.saveNotification({
            userId,
            tripId: incident.tripId,
            type: 'INCIDENT_RESOLVED',
            title: resolvedTitle,
            body: resolvedBody,
            deepLink,
            data: {
              tripId: incident.tripId,
              incidentId: savedIncident.id,
              tripStatus: currentTripStatus,
            },
          });
        } catch (err: any) {
          this.logger.warn(`Could not save incident resolved notification for user ${userId}: ${err.message}`);
        }
      }

      if (this.fcmService) {
        try {
          await this.fcmService.sendPushToUser(userId, resolvedTitle, resolvedBody, {
            tripId: incident.tripId,
            incidentId: savedIncident.id,
            type: 'INCIDENT_RESOLVED',
            deepLink,
          });
        } catch (err: any) {
          this.logger.warn(`Could not dispatch FCM resolved for user ${userId}: ${err.message}`);
        }
      }
    }

    // 7. Cập nhật lại cache thời gian trễ ETA
    try {
      const current = await this.cacheGet<any>(`tracking:trip:${incident.tripId}:current`);
      if (current) {
        const { stationEtas, alerts } = await this.calculateTripEta(
          incident.tripId,
          current.latitude,
          current.longitude,
          current.speedKmh,
        );
        await this.cacheSet(`tracking:trip:${incident.tripId}:eta`, stationEtas, 120);
        if (this.broadcastCallback) {
          this.broadcastCallback(incident.tripId, current, stationEtas, alerts);
        }
      }
    } catch {
      // ignore
    }

    return savedIncident;
  }

  async getTripIncidents(tripId: string) {
    return this.incidentRepository.find({
      where: { tripId },
      order: { reportedAt: 'DESC' },
    });
  }

  async getAllIncidents(status?: string, severity?: string) {
    const qb = this.incidentRepository
      .createQueryBuilder('inc')
      .leftJoinAndSelect('inc.trip', 'trip')
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .leftJoinAndSelect('trip.driver', 'driver')
      .leftJoinAndSelect('inc.reportedByUser', 'reportedByUser');

    if (status && status !== 'all') {
      qb.andWhere('inc.resolutionStatus = :status', { status });
    }

    if (severity && severity !== 'all') {
      qb.andWhere('inc.severity = :severity', { severity });
    }

    qb.orderBy('inc.reportedAt', 'DESC');
    return qb.getMany();
  }
}
