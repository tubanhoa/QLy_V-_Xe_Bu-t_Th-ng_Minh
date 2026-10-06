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
  ReportIncidentDto,
  ResolveIncidentDto,
} from '@/lib/types/tracking'
import { UnifiedApiResponse } from '@/lib/types/sprint1'
import { authService } from '@/lib/services/auth.service'

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

  /** Báo cáo sự cố trên đường cho chuyến xe (Tài xế / Phụ xe) */
  async reportIncident(
    dto: ReportIncidentDto,
    token?: string,
  ): Promise<UnifiedApiResponse<TripIncident>> {
    try {
      const authToken = token || authService.getToken()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      // Chuẩn hóa severity sang enum backend ('low' | 'medium' | 'high' | 'critical')
      const severityMap: Record<string, string> = {
        minor: 'low',
        moderate: 'medium',
        severe: 'high',
        critical: 'critical',
      }
      const rawSeverity = dto.severity || dto.incidentSeverity || 'medium'
      const severity = severityMap[rawSeverity] || rawSeverity

      const payload = {
        tripId: dto.tripId,
        incidentType: dto.incidentType,
        severity,
        description: dto.description,
        ...(dto.delayMinutesEstimate != null
          ? { delayMinutesEstimate: Number(dto.delayMinutesEstimate) }
          : {}),
      }

      const res = await fetch(`${this.baseUrl}/driver/incidents`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          message: json?.message || 'Không thể gửi báo cáo sự cố',
        }
      }

      const item = json?.data || json
      const formatted: TripIncident = {
        ...item,
        type: item.incidentType || item.type,
      }
      return { success: true, data: formatted }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** Đóng/Giải tỏa sự cố và khôi phục trạng thái chuyến xe */
  async resolveIncident(
    incidentId: string,
    notes?: string,
    token?: string,
  ): Promise<UnifiedApiResponse<TripIncident>> {
    try {
      const authToken = token || authService.getToken()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      const res = await fetch(
        `${this.baseUrl}/driver/incidents/${incidentId}/resolve`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            resolutionNotes:
              notes || 'Đoạn đường đã thông thoáng, tiếp tục đón khách bình thường',
          }),
        },
      )

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          message: json?.message || 'Không thể giải tỏa sự cố',
        }
      }

      const item = json?.data || json
      const formatted: TripIncident = {
        ...item,
        type: item.incidentType || item.type,
      }
      return { success: true, data: formatted }
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
      const rawList: any[] = json?.data || json || []
      const list: TripIncident[] = Array.isArray(rawList)
        ? rawList.map((item) => ({
            ...item,
            type: item.incidentType || item.type,
          }))
        : []
      return { success: true, data: list }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối' }
    }
  }

  /** Lấy toàn bộ sự cố trên toàn hệ thống (Dành cho Quản trị & Điều độ) */
  async getAllIncidents(
    status?: string,
    severity?: string,
  ): Promise<UnifiedApiResponse<any[]>> {
    try {
      const token = authService.getToken()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const params = new URLSearchParams()
      if (status) params.append('status', status)
      if (severity) params.append('severity', severity)

      const url = `${this.baseUrl}/driver/incidents${params.toString() ? `?${params.toString()}` : ''}`
      const res = await fetch(url, {
        method: 'GET',
        headers,
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, data: [], message: json?.message || 'Không thể tải danh sách sự cố' }
      }
      return { success: true, data: json?.data || json || [] }
    } catch (e: any) {
      return { success: false, data: [], message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }
}

export const trackingService = new TrackingService()
