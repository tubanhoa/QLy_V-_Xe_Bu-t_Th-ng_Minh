import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { calculateHaversineDistance } from './gps-filter.service.js';
import { FcmService } from '../notification/fcm.service.js';
import { NotificationCenterService } from '../notification/notification-center.service.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { BookingEntity } from '../../database/entities/booking.entity.js';
import { StationEntity } from '../../database/entities/station.entity.js';
import { BookingStatus } from '../../common/constants/status.constant.js';

export type GeofenceZoneType = 'urban' | 'suburban' | 'highway';

export interface StationGeofenceConfig {
  stationId: string;
  name: string;
  latitude: number;
  longitude: number;
  zoneType: GeofenceZoneType;
  customRadiusMeters?: number;
}

@Injectable()
export class GeofencingService {
  private readonly logger = new Logger(GeofencingService.name);

  // In-memory sets for deduplication / debouncing & state transitions
  public activeGeofenceAlerts = new Set<string>();
  public stationsPassed = new Set<string>();

  constructor(
    private readonly fcmService?: FcmService,
    private readonly notifCenterService?: NotificationCenterService,
    @InjectRepository(TripEntity)
    private readonly tripRepository?: Repository<TripEntity>,
    @InjectRepository(BookingEntity)
    private readonly bookingRepository?: Repository<BookingEntity>,
    @InjectRepository(StationEntity)
    private readonly stationRepository?: Repository<StationEntity>,
  ) {}

  /**
   * Tính toán bán kính Geofence động theo phân loại khu vực trạm
   * Đô thị (urban): 300m | Ngoại ô (suburban): 500m | Cao tốc/Quốc lộ (highway): 1000m
   */
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

  /**
   * Kiểm tra điều kiện kích hoạt cảnh báo trạm sắp tới & Chống spam thông báo (Debounce)
   */
  public shouldTriggerApproachingAlert(
    tripId: string,
    station: StationGeofenceConfig,
    passengerId: string,
    busLat: number,
    busLng: number,
    etaMinutes: number,
    alertType: 'STATION_APPROACHING_PICKUP' | 'STATION_APPROACHING_DROPOFF' = 'STATION_APPROACHING_PICKUP',
  ): { shouldTrigger: boolean; distanceMeters: number; reason?: string } {
    const dist = calculateHaversineDistance(busLat, busLng, station.latitude, station.longitude);
    const radius = this.getGeofenceRadius(station.zoneType, station.customRadiusMeters);

    // Key chống spam theo chuyến xe, trạm và hành khách
    const alertKey = `${tripId}:${station.stationId}:${passengerId}`;

    // Kiểm tra debounce / deduplication: Chỉ gửi duy nhất 1 lần cho mỗi hành khách / trạm / chuyến
    if (this.activeGeofenceAlerts.has(alertKey)) {
      return { shouldTrigger: false, distanceMeters: dist, reason: 'ALREADY_ALERTED' };
    }

    // Ngưỡng kích hoạt:
    // Đón xe: khoảng cách <= bán kính geofence HOẶC eta <= 5 phút
    // Xuống xe: khoảng cách <= bán kính geofence HOẶC eta <= 3 phút
    const maxEtaMinutes = alertType === 'STATION_APPROACHING_DROPOFF' ? 3 : 5;

    if (dist <= radius || etaMinutes <= maxEtaMinutes) {
      this.activeGeofenceAlerts.add(alertKey);
      return { shouldTrigger: true, distanceMeters: dist };
    }

    return { shouldTrigger: false, distanceMeters: dist, reason: 'OUTSIDE_RADIUS' };
  }

  /**
   * Nhận diện trạng thái khi xe rời khỏi trạm (Exit Geofence)
   */
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

  /**
   * Dọn dẹp cache chuyến xe khi chuyến kết thúc
   */
  public clearTripCache(tripId: string) {
    for (const key of this.activeGeofenceAlerts) {
      if (key.startsWith(`${tripId}:`)) this.activeGeofenceAlerts.delete(key);
    }
    for (const key of this.stationsPassed) {
      if (key.startsWith(`${tripId}:`)) this.stationsPassed.delete(key);
    }
  }

  /**
   * Tự động quét và kích hoạt thông báo đẩy theo thời gian thực cho từng hành khách trên chuyến xe
   */
  public async evaluateTripGeofences(
    tripId: string,
    busLat: number,
    busLng: number,
    stationEtas: Array<{
      stationId: string;
      stationName: string;
      etaMinutes: number;
      distanceMeters: number;
    }>,
  ): Promise<void> {
    if (!this.bookingRepository || !this.fcmService || !this.notifCenterService) {
      return;
    }
    if (!this.bookingRepository.manager?.connection?.isInitialized) {
      return;
    }

    try {
      // 1. Lấy danh sách các vé/booking đang hoạt động trên chuyến xe
      const activeBookings = await this.bookingRepository.find({
        where: {
          tripId,
          status: In([
            BookingStatus.CONFIRMED,
            BookingStatus.PAID,
            'CONFIRMED' as any,
            'PAID' as any,
            'CHECKED_IN' as any,
          ]),
        },
        relations: {
          user: true,
          tickets: {
            seat: true,
          },
        },
      });

      if (!activeBookings || activeBookings.length === 0) return;

      for (const booking of activeBookings) {
        const userId = booking.userId;
        if (!userId) continue;

        for (const etaItem of stationEtas) {
          const stationConfig: StationGeofenceConfig = {
            stationId: etaItem.stationId,
            name: etaItem.stationName,
            latitude: busLat,
            longitude: busLng,
            zoneType: 'suburban',
          };

          const check = this.shouldTriggerApproachingAlert(
            tripId,
            stationConfig,
            userId,
            busLat,
            busLng,
            etaItem.etaMinutes,
            'STATION_APPROACHING_PICKUP',
          );

          if (check.shouldTrigger) {
            const title = 'Xe buýt đang đến gần!';
            const body = `Xe buýt sắp đến trạm ${etaItem.stationName} (còn ~${etaItem.etaMinutes} phút, cách ~${check.distanceMeters}m). Quý khách vui lòng chuẩn bị.`;
            const deepLink = `/trips/${tripId}/live?focusStation=${etaItem.stationId}`;

            // Lưu bản ghi thông báo
            await this.notifCenterService.saveNotification({
              userId,
              tripId,
              stationId: etaItem.stationId,
              type: 'STATION_APPROACHING_PICKUP',
              title,
              body,
              deepLink,
              data: {
                tripId,
                stationId: etaItem.stationId,
                etaMinutes: String(etaItem.etaMinutes),
                distanceMeters: String(check.distanceMeters),
                deepLink,
              },
            });

            // Gửi FCM Push Notification
            await this.fcmService.sendPushToUser(userId, title, body, {
              tripId,
              stationId: etaItem.stationId,
              etaMinutes: String(etaItem.etaMinutes),
              deepLink,
            });
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Error evaluating geofences for trip ${tripId}: ${err.message}`);
    }
  }
}

// Export class alias matching QA test specification harness
export { GeofencingService as GeofenceEngineService };
