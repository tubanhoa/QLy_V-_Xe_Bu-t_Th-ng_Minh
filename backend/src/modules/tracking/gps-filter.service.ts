import { Injectable, Logger } from '@nestjs/common';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

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

@Injectable()
export class GpsFilterService {
  private readonly logger = new Logger(GpsFilterService.name);
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
      const reason = `GPS_JUMP_OUTLIER: Calculated speed ${speedKmh.toFixed(1)} km/h exceeds 150 km/h threshold`;
      this.logger.warn(`Trip ${tripId}: ${reason}`);
      return {
        isValid: false,
        filteredLat: lastCoord.latitude,
        filteredLng: lastCoord.longitude,
        reason,
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
  public checkGpsHeartbeat(
    tripId: string,
    currentTimestampMs: number,
  ): { isLost: boolean; elapsedSeconds: number } {
    const lastTime = this.lastPingTimeMap.get(tripId);
    if (!lastTime) return { isLost: false, elapsedSeconds: 0 };

    const elapsedSeconds = Math.round((currentTimestampMs - lastTime) / 1000);
    const isLost = elapsedSeconds > 60;
    if (isLost) {
      this.logger.warn(`Trip ${tripId}: GPS_SIGNAL_LOST - No ping received for ${elapsedSeconds}s (> 60s)`);
    }
    return {
      isLost,
      elapsedSeconds,
    };
  }

  public clearTripState(tripId: string) {
    this.lastPingTimeMap.delete(tripId);
    this.lastKnownCoordMap.delete(tripId);
  }
}
