/**
 * Service gọi API Live Tracking, ETA & GPS Simulator
 * Endpoints:
 *   GET  /api/v1/trips/:id/live-tracking     → Vị trí GPS & ETA trạm (Low Latency Cache < 5ms)
 *   GET  /api/v1/trips/:id/tracking/stream   → SSE Stream liên tục
 *   POST /api/v1/tracking/simulator/start    → Bật mô phỏng di chuyển GPS
 *   POST /api/v1/tracking/simulator/stop     → Tắt mô phỏng
 *   GET  /api/v1/tracking/simulator/status/:tripId → Trạng thái mô phỏng
 *   GET  /api/v1/trips/:id/incidents         → Danh sách sự cố
 * Branch: feature/SBTS-frontend-realtime-tracking-and-eta
 */

import type {
  LiveLocation,
  LiveTrackingResponse,
  SimulatorStatus,
  TripIncident,
} from '@/lib/types/tracking'
import { UnifiedApiResponse } from '@/lib/types/sprint1'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

class TrackingService {
  private baseUrl: string
  private socketUrl: string

  constructor() {
    const raw = (API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/+$/, '')
    this.baseUrl = raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`
    // Socket server listens on the root server port (e.g., http://localhost:3001)
    this.socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      this.baseUrl.replace(/\/api\/v1$/, '').replace(/\/api$/, '')
  }

  /** Lấy URL máy chủ WebSocket */
  getSocketUrl(): string {
    return this.socketUrl
  }

  /** Lấy vị trí GPS & danh sách ETA trạm mới nhất từ Redis Cache (< 5ms) */
  async getLiveTrackingWithEta(
    tripId: string,
  ): Promise<UnifiedApiResponse<LiveTrackingResponse>> {
    try {
      const res = await fetch(`${this.baseUrl}/trips/${tripId}/live-tracking`, {
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          message: json?.message || 'Không thể lấy thông tin định vị và ETA',
        }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** Lấy vị trí GPS mới nhất (tương thích ngược) */
  async getLatestLocation(
    tripId: string,
  ): Promise<UnifiedApiResponse<LiveLocation>> {
    return this.getLiveTrackingWithEta(tripId)
  }

  /** Tạo kết nối Server-Sent Events (SSE) dự phòng */
  createTrackingEventSource(tripId: string): EventSource {
    return new EventSource(`${this.baseUrl}/trips/${tripId}/tracking/stream`)
  }

  /** Bắt đầu mô phỏng GPS xe buýt cho chuyến đi */
  async startSimulator(
    tripId: string,
    speedMultiplier: number = 1,
  ): Promise<UnifiedApiResponse<SimulatorStatus>> {
    try {
      const res = await fetch(`${this.baseUrl}/tracking/simulator/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, speedMultiplier }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          message: json?.message || 'Không thể khởi động bộ mô phỏng GPS',
        }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** Dừng mô phỏng GPS xe buýt */
  async stopSimulator(
    tripId: string,
  ): Promise<UnifiedApiResponse<{ message: string }>> {
    try {
      const res = await fetch(`${this.baseUrl}/tracking/simulator/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          message: json?.message || 'Không thể dừng bộ mô phỏng GPS',
        }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** Lấy trạng thái bộ mô phỏng GPS */
  async getSimulatorStatus(
    tripId: string,
  ): Promise<UnifiedApiResponse<SimulatorStatus>> {
    try {
      const res = await fetch(
        `${this.baseUrl}/tracking/simulator/status/${tripId}`,
        {
          cache: 'no-store',
        },
      )
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          message: json?.message || 'Không thể kiểm tra trạng thái mô phỏng',
        }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** Lấy danh sách sự cố trên chuyến */
  async getTripIncidents(
    tripId: string,
  ): Promise<UnifiedApiResponse<TripIncident[]>> {
    try {
      const res = await fetch(`${this.baseUrl}/trips/${tripId}/incidents`, {
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể tải sự cố' }
      }
      return { success: true, data: json?.data || json || [] }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối' }
    }
  }
}

export const trackingService = new TrackingService()
