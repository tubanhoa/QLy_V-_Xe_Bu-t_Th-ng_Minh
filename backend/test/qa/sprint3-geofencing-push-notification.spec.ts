import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

/**
 * ======================================================================================
 * AUTOMATION TEST SUITE - SPRINT 3 TDD SPECIFICATION
 * SMART BUS TICKETING SYSTEM - ICTU TRANSIT
 *
 * PHÂN HỆ KIỂM THỬ:
 * 10. Module Geofencing Trạm đón (Geofence Engine) [TC-GEO-01 -> TC-GEO-04]
 * 11. Module Push Notification (FCM / Firebase Cloud Messaging) [TC-PUSH-01 -> TC-PUSH-04]
 * 12. Module Tương tác Thông báo Người dùng (Notification UX) [TC-FE-NOTIF-01 -> TC-FE-NOTIF-04]
 * 13. Module Xử lý Ngoại lệ & Biên (Edge Cases & Fault Tolerance) [TC-EDGE-01 -> TC-EDGE-04]
 * ======================================================================================
 */

// ======================================================================================
// TDD DOMAIN DEFINITIONS & REFERENCE IMPLEMENTATION (TEST HARNESS)
// ======================================================================================

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type GeofenceZoneType = 'urban' | 'suburban' | 'highway';

export interface StationGeofenceConfig {
  stationId: string;
  name: string;
  latitude: number;
  longitude: number;
  zoneType: GeofenceZoneType;
  customRadiusMeters?: number;
}

export interface FcmNotificationPayload {
  token: string;
  notification: {
    title: string;
    body: string;
  };
  data: Record<string, string>;
  android?: {
    priority: string;
    notification: {
      sound: string;
      channelId: string;
    };
  };
  apns?: {
    payload: {
      aps: {
        sound: string;
        badge: number;
      };
    };
  };
  webpush?: {
    headers: Record<string, string>;
    notification: {
      icon: string;
      badge: string;
    };
  };
}

export interface UserNotificationRecord {
  id: string;
  userId: string;
  tripId: string;
  stationId: string;
  type: string;
  title: string;
  message: string;
  deepLink: string;
  isRead: boolean;
  createdAt: Date;
}

export interface UserNotificationPreference {
  userId: string;
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
}

/**
 * Thuật toán tính khoảng cách Haversine chuẩn WGS84 (mét)
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3; // Bán kính Trái Đất (mét)
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * TDD Service: Geofencing Engine
 */
export class GeofenceEngineService {
  private activeGeofenceAlerts = new Set<string>();
  private stationsPassed = new Set<string>();

  public getGeofenceRadius(zoneType: GeofenceZoneType, customRadius?: number): number {
    if (customRadius && customRadius > 0) return customRadius;
    switch (zoneType) {
      case 'urban':
        return 300;
      case 'suburban':
        return 500;
      case 'highway':
        return 1000;
      default:
        return 500;
    }
  }

  public shouldTriggerApproachingAlert(
    tripId: string,
    station: StationGeofenceConfig,
    passengerId: string,
    busLat: number,
    busLng: number,
    etaMinutes: number,
  ): { shouldTrigger: boolean; distanceMeters: number; reason?: string } {
    const dist = calculateHaversineDistance(busLat, busLng, station.latitude, station.longitude);
    const radius = this.getGeofenceRadius(station.zoneType, station.customRadiusMeters);

    const alertKey = `${tripId}:${station.stationId}:${passengerId}`;

    // Kiểm tra debounce / deduplication: Chỉ gửi duy nhất 1 lần cho mỗi hành khách / trạm / chuyến
    if (this.activeGeofenceAlerts.has(alertKey)) {
      return { shouldTrigger: false, distanceMeters: dist, reason: 'ALREADY_ALERTED' };
    }

    // Điều kiện kích hoạt: khoảng cách <= bán kính geofence HOẶC eta <= 5 phút
    if (dist <= radius || etaMinutes <= 5) {
      this.activeGeofenceAlerts.add(alertKey);
      return { shouldTrigger: true, distanceMeters: dist };
    }

    return { shouldTrigger: false, distanceMeters: dist, reason: 'OUTSIDE_RADIUS' };
  }

  public checkExitGeofence(
    tripId: string,
    stationId: string,
    distanceMeters: number,
    previousDistanceMeters: number,
  ): { hasExited: boolean; status: 'inside' | 'passed' | 'approaching' } {
    const passedKey = `${tripId}:${stationId}`;
    if (this.stationsPassed.has(passedKey)) {
      return { hasExited: true, status: 'passed' };
    }

    // Xe đã vào trong trạm (< 100m) và nay khoảng cách đang tăng lên vượt quá 100m -> Đã rời trạm
    if (previousDistanceMeters <= 100 && distanceMeters > 100) {
      this.stationsPassed.add(passedKey);
      return { hasExited: true, status: 'passed' };
    }

    if (distanceMeters <= 100) {
      return { hasExited: false, status: 'inside' };
    }

    return { hasExited: false, status: 'approaching' };
  }

  public clearTripCache(tripId: string) {
    for (const key of this.activeGeofenceAlerts) {
      if (key.startsWith(`${tripId}:`)) this.activeGeofenceAlerts.delete(key);
    }
    for (const key of this.stationsPassed) {
      if (key.startsWith(`${tripId}:`)) this.stationsPassed.delete(key);
    }
  }
}

/**
 * TDD Service: Firebase Cloud Messaging (FCM) Push Service
 */
export class FcmPushNotificationService {
  public userTokensMap = new Map<string, Set<string>>();
  public deadTokensLog = new Set<string>();
  public sentPayloads: FcmNotificationPayload[] = [];

  constructor() {}

  public registerToken(userId: string, token: string) {
    if (!this.userTokensMap.has(userId)) {
      this.userTokensMap.set(userId, new Set());
    }
    this.userTokensMap.get(userId)!.add(token);
  }

  public getActiveTokens(userId: string): string[] {
    const tokens = this.userTokensMap.get(userId);
    return tokens ? Array.from(tokens) : [];
  }

  public invalidateDeadToken(userId: string, deadToken: string) {
    this.deadTokensLog.add(deadToken);
    const tokens = this.userTokensMap.get(userId);
    if (tokens) {
      tokens.delete(deadToken);
    }
  }

  public buildFcmPayload(
    token: string,
    title: string,
    body: string,
    data: Record<string, string>,
  ): FcmNotificationPayload {
    return {
      token,
      notification: { title, body },
      data,
      android: {
        priority: 'high',
        notification: {
          sound: 'bus_horn.mp3',
          channelId: 'bus_alerts',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      webpush: {
        headers: { Urgency: 'high' },
        notification: {
          icon: '/icons/bus-logo.png',
          badge: '/icons/badge.png',
        },
      },
    };
  }

  public async sendPushToUser(
    userId: string,
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<{ success: boolean; dispatchedCount: number; failedTokens: string[] }> {
    const tokens = this.getActiveTokens(userId);
    const failedTokens: string[] = [];
    let dispatchedCount = 0;

    for (const token of tokens) {
      // Giả lập phát hiện dead token
      if (token.includes('dead-token') || token.includes('expired-token')) {
        this.invalidateDeadToken(userId, token);
        failedTokens.push(token);
        continue;
      }

      const payload = this.buildFcmPayload(token, title, body, data);
      this.sentPayloads.push(payload);
      dispatchedCount++;
    }

    return {
      success: dispatchedCount > 0,
      dispatchedCount,
      failedTokens,
    };
  }
}

/**
 * TDD Service: Notification Center & Preferences
 */
export class NotificationCenterService {
  private notifications: UserNotificationRecord[] = [];
  private preferences = new Map<string, UserNotificationPreference>();

  public saveNotification(record: Omit<UserNotificationRecord, 'id' | 'isRead' | 'createdAt'>): UserNotificationRecord {
    const entity: UserNotificationRecord = {
      ...record,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      isRead: false,
      createdAt: new Date(),
    };
    this.notifications.push(entity);
    return entity;
  }

  public getUserNotifications(userId: string) {
    const userList = this.notifications.filter((n) => n.userId === userId);
    const unreadCount = userList.filter((n) => !n.isRead).length;
    return {
      notifications: userList,
      total: userList.length,
      unreadCount,
    };
  }

  public markAsRead(notificationId: string, userId: string): boolean {
    const notif = this.notifications.find((n) => n.id === notificationId && n.userId === userId);
    if (!notif) return false;
    notif.isRead = true;
    return true;
  }

  public setPreferences(pref: UserNotificationPreference) {
    this.preferences.set(pref.userId, pref);
  }

  public getPreferences(userId: string): UserNotificationPreference {
    return (
      this.preferences.get(userId) || {
        userId,
        pushEnabled: true,
        smsEnabled: false,
        emailEnabled: true,
      }
    );
  }
}

/**
 * TDD Service: GPS Noise Filtering & Anomaly Detector (Kalman / Outlier filter)
 */
export class GpsFilterService {
  private lastPingTimeMap = new Map<string, number>();
  private lastKnownCoordMap = new Map<string, Coordinates>();

  /**
   * Lọc bỏ nhiễu GPS và bước nhảy vọt tọa độ (Teleport / Outlier jumps)
   * Ngưỡng tối đa: Vận tốc tức thời <= 150 km/h và độ dịch chuyển <= 5000m trong 1 giây
   */
  public filterGpsPoint(
    tripId: string,
    lat: number,
    lng: number,
    timestampMs: number,
  ): { isValid: boolean; filteredLat: number; filteredLng: number; reason?: string } {
    const lastCoord = this.lastKnownCoordMap.get(tripId);
    const lastTime = this.lastPingTimeMap.get(tripId);

    if (!lastCoord || !lastTime) {
      this.lastKnownCoordMap.set(tripId, { latitude: lat, longitude: lng });
      this.lastPingTimeMap.set(tripId, timestampMs);
      return { isValid: true, filteredLat: lat, filteredLng: lng };
    }

    const deltaSeconds = Math.max(0.1, (timestampMs - lastTime) / 1000);
    const distanceMeters = calculateHaversineDistance(
      lastCoord.latitude,
      lastCoord.longitude,
      lat,
      lng,
    );
    const speedKmh = (distanceMeters / deltaSeconds) * 3.6;

    // Phát hiện bước nhảy vọt bất thường (> 150 km/h hoặc nhảy cóc > 5000m trong khoảng thời gian rất ngắn)
    if (speedKmh > 150 || (distanceMeters > 5000 && deltaSeconds < 5)) {
      return {
        isValid: false,
        filteredLat: lastCoord.latitude,
        filteredLng: lastCoord.longitude,
        reason: `GPS_JUMP_OUTLIER: Calculated speed ${speedKmh.toFixed(1)} km/h exceeds 150 km/h threshold`,
      };
    }

    this.lastKnownCoordMap.set(tripId, { latitude: lat, longitude: lng });
    this.lastPingTimeMap.set(tripId, timestampMs);
    return { isValid: true, filteredLat: lat, filteredLng: lng };
  }

  /**
   * Kiểm tra hướng di chuyển của xe (Vector Heading Guard)
   * Nếu khoảng cách tới trạm đang tăng dần -> Xe đang đi xa dần hoặc quay đầu
   */
  public isApproachingTarget(
    currentDistance: number,
    previousDistance: number,
    headingDegrees?: number,
    bearingToStation?: number,
  ): boolean {
    if (headingDegrees !== undefined && bearingToStation !== undefined) {
      const angleDiff = Math.abs(headingDegrees - bearingToStation);
      const normalizedDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;
      if (normalizedDiff > 120) {
        return false; // Hướng di chuyển ngược lại với hướng trạm (> 120 độ)
      }
    }
    return currentDistance <= previousDistance;
  }

  /**
   * Giám sát mất tín hiệu GPS (Signal Lost Heartbeat > 60s)
   */
  public checkGpsHeartbeat(tripId: string, currentTimestampMs: number): { isLost: boolean; elapsedSeconds: number } {
    const lastTime = this.lastPingTimeMap.get(tripId);
    if (!lastTime) return { isLost: false, elapsedSeconds: 0 };

    const elapsedSeconds = Math.round((currentTimestampMs - lastTime) / 1000);
    return {
      isLost: elapsedSeconds > 60,
      elapsedSeconds,
    };
  }
}

// ======================================================================================
// TEST SUITE EXECUTION
// ======================================================================================

describe('Sprint 3 TDD Test Suite - Geofencing & Push Notification [QA Specification]', () => {
  let geofenceService: GeofenceEngineService;
  let fcmService: FcmPushNotificationService;
  let notifCenterService: NotificationCenterService;
  let gpsFilterService: GpsFilterService;

  // Mock trạm xe Đại học Công nghệ Thông tin & Truyền thông (ICTU)
  const stationIctu: StationGeofenceConfig = {
    stationId: 'sta-ictu-z115',
    name: 'ĐH CNTT & TT (ICTU)',
    latitude: 21.585284,
    longitude: 105.806297,
    zoneType: 'suburban', // Bán kính mặc định 500m
  };

  // Mock hành khách và chuyến xe
  const mockPassengerId = 'user-passenger-ictu-01';
  const mockTripId = 'trip-ct02-morning-uuid';

  beforeEach(() => {
    geofenceService = new GeofenceEngineService();
    fcmService = new FcmPushNotificationService();
    notifCenterService = new NotificationCenterService();
    gpsFilterService = new GpsFilterService();
  });

  // ====================================================================================
  // PHÂN HỆ 10: GEOFENCING TRẠM ĐÓN [TC-GEO-01 -> TC-GEO-04]
  // ====================================================================================
  describe('[TC-GEO] Module Geofencing Trạm Đón (Geofence Engine)', () => {
    describe('[TC-GEO-01] Haversine Distance & Proximity Trigger', () => {
      it('Happy Path: Khi xe buýt tiến vào bán kính <= 500m (hoặc ETA <= 5 phút) -> Kích hoạt cảnh báo xe sắp đến', () => {
        // Tọa độ xe cách trạm ICTU ~400m
        const busLat = 21.588000;
        const busLng = 105.808000;
        const etaMinutes = 3;

        const check = geofenceService.shouldTriggerApproachingAlert(
          mockTripId,
          stationIctu,
          mockPassengerId,
          busLat,
          busLng,
          etaMinutes,
        );

        expect(check.shouldTrigger).toBe(true);
        expect(check.distanceMeters).toBeLessThanOrEqual(500);
      });

      it('Unhappy Path: Xe buýt ở khoảng cách xa (> 500m và ETA > 5 phút) -> Không kích hoạt cảnh báo', () => {
        // Tọa độ xe cách trạm ICTU ~2.5km
        const busFarLat = 21.605000;
        const busFarLng = 105.820000;
        const etaMinutes = 12;

        const check = geofenceService.shouldTriggerApproachingAlert(
          mockTripId,
          stationIctu,
          mockPassengerId,
          busFarLat,
          busFarLng,
          etaMinutes,
        );

        expect(check.shouldTrigger).toBe(false);
        expect(check.distanceMeters).toBeGreaterThan(500);
        expect(check.reason).toBe('OUTSIDE_RADIUS');
      });
    });

    describe('[TC-GEO-02] Deduplication / Debouncing (Chống Spam Notification)', () => {
      it('Happy Path: Khi xe buýt dừng đỗ hoặc di chuyển chậm trong vùng 500m -> Chỉ gửi duy nhất 1 lần', () => {
        const busLat = 21.587000;
        const busLng = 105.807000;

        // Lần 1: Xe vừa vào bán kính 500m
        const ping1 = geofenceService.shouldTriggerApproachingAlert(
          mockTripId,
          stationIctu,
          mockPassengerId,
          busLat,
          busLng,
          4,
        );
        expect(ping1.shouldTrigger).toBe(true);

        // Lần 2: 10 giây sau, xe vẫn ở vị trí đó
        const ping2 = geofenceService.shouldTriggerApproachingAlert(
          mockTripId,
          stationIctu,
          mockPassengerId,
          busLat,
          busLng,
          4,
        );
        expect(ping2.shouldTrigger).toBe(false);
        expect(ping2.reason).toBe('ALREADY_ALERTED');

        // Lần 3: 30 giây sau, xe nhích thêm 20m nhưng vẫn trong bán kính
        const ping3 = geofenceService.shouldTriggerApproachingAlert(
          mockTripId,
          stationIctu,
          mockPassengerId,
          busLat + 0.0001,
          busLng + 0.0001,
          3,
        );
        expect(ping3.shouldTrigger).toBe(false);
        expect(ping3.reason).toBe('ALREADY_ALERTED');
      });
    });

    describe('[TC-GEO-03] Dynamic Geofence Radius theo khu vực', () => {
      it('Happy Path: Cấu hình bán kính theo từng loại địa bàn (Đô thị 300m, Ngoại ô 500m, Quốc lộ 1000m)', () => {
        expect(geofenceService.getGeofenceRadius('urban')).toBe(300);
        expect(geofenceService.getGeofenceRadius('suburban')).toBe(500);
        expect(geofenceService.getGeofenceRadius('highway')).toBe(1000);

        // Hỗ trợ bán kính tùy biến riêng cho trạm đặc biệt
        expect(geofenceService.getGeofenceRadius('urban', 450)).toBe(450);
      });
    });

    describe('[TC-GEO-04] Exit Geofence & Dọn dẹp trạng thái', () => {
      it('Happy Path: Phát hiện xe buýt đã rời khỏi trạm (> 100m sau khi ghé trạm) -> Chuyển trạng thái PASSED', () => {
        // Ban đầu xe đã vào trạm (khoảng cách 30m)
        const inside = geofenceService.checkExitGeofence(mockTripId, stationIctu.stationId, 30, 80);
        expect(inside.hasExited).toBe(false);
        expect(inside.status).toBe('inside');

        // Xe rời trạm đi tiếp (khoảng cách tăng lên 150m)
        const exited = geofenceService.checkExitGeofence(mockTripId, stationIctu.stationId, 150, 30);
        expect(exited.hasExited).toBe(true);
        expect(exited.status).toBe('passed');
      });
    });
  });

  // ====================================================================================
  // PHÂN HỆ 11: PUSH NOTIFICATION (FIREBASE CLOUD MESSAGING) [TC-PUSH-01 -> TC-PUSH-04]
  // ====================================================================================
  describe('[TC-PUSH] Module Push Notification (FCM Engine)', () => {
    const validDeviceToken = 'fcm-device-token-valid-iphone-15';
    const deadDeviceToken = 'fcm-dead-token-unregistered-device';

    beforeEach(() => {
      fcmService.registerToken(mockPassengerId, validDeviceToken);
    });

    describe('[TC-PUSH-01] FCM Standard Payload Structure', () => {
      it('Happy Path: Sinh payload FCM chuẩn với đầy đủ Title, Body, Sound, Priority và Data deep link', () => {
        const payload = fcmService.buildFcmPayload(
          validDeviceToken,
          'Xe buýt đang đến trạm!',
          'Xe 20B-012.34 còn cách trạm ICTU 420m (khoảng 3 phút).',
          {
            tripId: mockTripId,
            stationId: stationIctu.stationId,
            etaMinutes: '3',
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
        );

        expect(payload.token).toBe(validDeviceToken);
        expect(payload.notification.title).toBe('Xe buýt đang đến trạm!');
        expect(payload.data.tripId).toBe(mockTripId);
        expect(payload.android?.priority).toBe('high');
        expect(payload.android?.notification.sound).toBe('bus_horn.mp3');
        expect(payload.apns?.payload.aps.badge).toBe(1);
        expect(payload.webpush?.headers.Urgency).toBe('high');
      });
    });

    describe('[TC-PUSH-02] Push Notification Latency Benchmark (< 2000ms)', () => {
      it('Happy Path: Thời gian xử lý và phát thông báo đẩy < 2000ms tính từ sự kiện geofence', async () => {
        const startTime = Date.now();

        const result = await fcmService.sendPushToUser(
          mockPassengerId,
          'Xe buýt đang tới!',
          'Vui lòng di chuyển ra vị trí đón xe.',
          { tripId: mockTripId },
        );

        const latency = Date.now() - startTime;
        expect(result.success).toBe(true);
        expect(result.dispatchedCount).toBe(1);
        expect(latency).toBeLessThan(2000); // Đảm bảo SLA độ trễ < 2 giây
      });
    });

    describe('[TC-PUSH-03] Dead / Invalid Token Cleanup', () => {
      it('Unhappy Path: Tự động vô hiệu hóa và xóa bỏ device token không hợp lệ (NotRegistered / Invalid)', async () => {
        fcmService.registerToken(mockPassengerId, deadDeviceToken);
        expect(fcmService.getActiveTokens(mockPassengerId)).toContain(deadDeviceToken);

        const result = await fcmService.sendPushToUser(
          mockPassengerId,
          'Thông báo kiểm tra',
          'Nội dung kiểm tra token hết hạn',
          {},
        );

        expect(result.failedTokens).toContain(deadDeviceToken);
        expect(fcmService.deadTokensLog.has(deadDeviceToken)).toBe(true);
        // Token lỗi đã bị loại khỏi danh sách token hoạt động
        expect(fcmService.getActiveTokens(mockPassengerId)).not.toContain(deadDeviceToken);
      });
    });

    describe('[TC-PUSH-04] Multi-Device & Multi-Platform Support', () => {
      it('Happy Path: Người dùng đăng nhập trên 2 thiết bị (iOS + Web PWA) -> Nhận đồng thời trên cả 2 thiết bị', async () => {
        const webPwaToken = 'fcm-token-web-chrome-desktop';
        fcmService.registerToken(mockPassengerId, webPwaToken);

        const result = await fcmService.sendPushToUser(
          mockPassengerId,
          'Xe sắp tới trạm',
          'Còn 2 phút nữa xe buýt sẽ cập trạm ICTU.',
          { tripId: mockTripId },
        );

        expect(result.dispatchedCount).toBe(2);
        expect(fcmService.sentPayloads.length).toBe(2);
      });
    });
  });

  // ====================================================================================
  // PHÂN HỆ 12: THÔNG BÁO NGƯỜI DÙNG & WEB CLIENT (NOTIFICATION UX) [TC-FE-NOTIF-01 -> 04]
  // ====================================================================================
  describe('[TC-FE-NOTIF] Module Trải nghiệm Thông báo (Notification UX & In-app)', () => {
    describe('[TC-FE-NOTIF-01] In-app Banner Broadcast', () => {
      it('Happy Path: Tạo bản ghi thông báo trong ứng dụng dạng in-app banner nổi với thời gian thực', () => {
        const notif = notifCenterService.saveNotification({
          userId: mockPassengerId,
          tripId: mockTripId,
          stationId: stationIctu.stationId,
          type: 'BUS_APPROACHING',
          title: 'Xe buýt đang đến!',
          message: 'Xe buýt tuyến CT-02 đang cách trạm ICTU 350m.',
          deepLink: `/trips/${mockTripId}/live?focusStation=${stationIctu.stationId}`,
        });

        expect(notif.id).toBeDefined();
        expect(notif.isRead).toBe(false);
        expect(notif.title).toContain('Xe buýt đang đến!');
      });
    });

    describe('[TC-FE-NOTIF-02] Deep Linking to Live Map', () => {
      it('Happy Path: Click vào notification dẫn trực tiếp đến trang Live Map và highlight trạm đón', () => {
        const deepLink = `/trips/${mockTripId}/live?focusStation=${stationIctu.stationId}`;
        const url = new URL(deepLink, 'https://smartbus.ictu.edu.vn');

        expect(url.pathname).toBe(`/trips/${mockTripId}/live`);
        expect(url.searchParams.get('focusStation')).toBe(stationIctu.stationId);
      });
    });

    describe('[TC-FE-NOTIF-03] Notification Center (Lưu trữ, Đánh dấu đã đọc & Đếm số chưa đọc)', () => {
      it('Happy Path: Quản lý danh sách thông báo, đánh dấu đã đọc và cập nhật unread count', () => {
        const notif1 = notifCenterService.saveNotification({
          userId: mockPassengerId,
          tripId: mockTripId,
          stationId: stationIctu.stationId,
          type: 'BUS_APPROACHING',
          title: 'Chuyến xe sắp đến trạm',
          message: 'Còn 3 phút',
          deepLink: '/trips/1',
        });

        const notif2 = notifCenterService.saveNotification({
          userId: mockPassengerId,
          tripId: mockTripId,
          stationId: stationIctu.stationId,
          type: 'TICKET_BOOKED',
          title: 'Đặt vé thành công',
          message: 'Vé số #ICTU-99',
          deepLink: '/tickets/1',
        });

        // 1. Kiểm tra số lượng ban đầu: 2 chưa đọc
        let state = notifCenterService.getUserNotifications(mockPassengerId);
        expect(state.total).toBe(2);
        expect(state.unreadCount).toBe(2);

        // 2. Đánh dấu đã đọc notif1
        const readSuccess = notifCenterService.markAsRead(notif1.id, mockPassengerId);
        expect(readSuccess).toBe(true);

        // 3. Số lượng chưa đọc giảm xuống còn 1
        state = notifCenterService.getUserNotifications(mockPassengerId);
        expect(state.unreadCount).toBe(1);
      });
    });

    describe('[TC-FE-NOTIF-04] Notification Preferences (Cài đặt Bật/Tắt)', () => {
      it('Happy Path: Hành khách chủ động tắt nhận Push Notification -> Hệ thống tuân thủ thiết lập', () => {
        notifCenterService.setPreferences({
          userId: mockPassengerId,
          pushEnabled: false,
          smsEnabled: false,
          emailEnabled: true,
        });

        const pref = notifCenterService.getPreferences(mockPassengerId);
        expect(pref.pushEnabled).toBe(false);
        expect(pref.emailEnabled).toBe(true);
      });
    });
  });

  // ====================================================================================
  // PHÂN HỆ 13: XỬ LÝ NGOẠI LỆ & BIÊN (EDGE CASES) [TC-EDGE-01 -> TC-EDGE-04]
  // ====================================================================================
  describe('[TC-EDGE] Module Xử lý Ngoại lệ & Biên (Edge Cases & Fault Tolerance)', () => {
    describe('[TC-EDGE-01] Kalman Filter / GPS Noise & Jumps Outlier', () => {
      it('Edge Case: Lọc bỏ tọa độ nhảy vọt ảo (Vận tốc tức thời > 150 km/h do lỗi chip GPS)', () => {
        const now = Date.now();

        // Tọa độ hợp lệ 1 tại trạm ICTU
        const p1 = gpsFilterService.filterGpsPoint(mockTripId, 21.585284, 105.806297, now);
        expect(p1.isValid).toBe(true);

        // 1 giây sau: GPS đột ngột nhảy sang Hà Nội cách đó 70km (vận tốc > 250,000 km/h)
        const p2 = gpsFilterService.filterGpsPoint(mockTripId, 21.028511, 105.854444, now + 1000);
        expect(p2.isValid).toBe(false);
        expect(p2.reason).toContain('GPS_JUMP_OUTLIER');
        // Tọa độ đầu ra được giữ nguyên ở vị trí an toàn trước đó
        expect(p2.filteredLat).toBe(21.585284);
      });
    });

    describe('[TC-EDGE-02] U-Turn & Wrong Direction (Vector Heading Guard)', () => {
      it('Edge Case: Xe buýt đang quay đầu hoặc đi xa dần khỏi trạm -> Không kích hoạt cảnh báo trạm', () => {
        const distT1 = 450;
        const distT2 = 490; // Khoảng cách đang tăng lên (xe đang đi ra xa trạm)

        const isApproaching = gpsFilterService.isApproachingTarget(distT2, distT1, 180, 0); // Đi hướng 180 ngược hướng trạm 0
        expect(isApproaching).toBe(false);
      });
    });

    describe('[TC-EDGE-03] GPS Signal Lost Heartbeat (> 60s timeout)', () => {
      it('Edge Case: Không nhận được GPS ping quá 60 giây -> Báo động mất tín hiệu (SIGNAL_LOST)', () => {
        const pingTime = Date.now();
        gpsFilterService.filterGpsPoint(mockTripId, 21.585284, 105.806297, pingTime);

        // Sau 30s: Tín hiệu vẫn trong ngưỡng bình thường
        const check30s = gpsFilterService.checkGpsHeartbeat(mockTripId, pingTime + 30000);
        expect(check30s.isLost).toBe(false);

        // Sau 75s (> 60s): Phát hiện mất tín hiệu GPS
        const check75s = gpsFilterService.checkGpsHeartbeat(mockTripId, pingTime + 75000);
        expect(check75s.isLost).toBe(true);
        expect(check75s.elapsedSeconds).toBe(75);
      });
    });

    describe('[TC-EDGE-04] Last-Minute Booking Geofence Catch-up', () => {
      it('Edge Case: Khách đặt vé khi xe buýt đã nằm trong bán kính 500m -> Gửi ngay cảnh báo khẩn', () => {
        // Tình huống: Xe buýt đã ở cách trạm 250m khi vé vừa được thanh toán thành công
        const busCurrentLat = 21.586000;
        const busCurrentLng = 105.807000;
        const dist = calculateHaversineDistance(
          busCurrentLat,
          busCurrentLng,
          stationIctu.latitude,
          stationIctu.longitude,
        );
        expect(dist).toBeLessThan(500);

        // Hệ thống ngay lập tức kích hoạt thông báo khẩn cấp cho hành khách vừa đặt vé
        const immediateCheck = geofenceService.shouldTriggerApproachingAlert(
          mockTripId,
          stationIctu,
          'user-last-minute-passenger',
          busCurrentLat,
          busCurrentLng,
          2,
        );

        expect(immediateCheck.shouldTrigger).toBe(true);
        expect(immediateCheck.distanceMeters).toBeLessThanOrEqual(500);
      });
    });
  });
});
