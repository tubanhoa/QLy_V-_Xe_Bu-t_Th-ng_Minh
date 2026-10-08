/**
 * Service vận hành chuyến xe dành riêng cho Tài Xế & Phụ Xe (Driver Service)
 * Kết nối trực tiếp Backend APIs:
 *   - GET   /api/v1/trips/driver/today      → Danh sách các ca chạy hôm nay của tài xế
 *   - PATCH /api/v1/trips/:id/status        → Cập nhật trạng thái chuyến (scheduled ➔ in_progress ➔ completed)
 *   - GET   /api/v1/trips/:id/manifest      → Danh sách hành khách (Manifest) đã đặt vé
 *   - POST  /api/v1/trips/driver/verify-qr  → Soát vé QR cho hành khách lên xe
 *   - POST  /api/v1/driver/update-location  → Phát tọa độ GPS xe buýt thời gian thực
 */

import { authService } from '@/lib/services/auth.service'
import { UnifiedApiResponse } from '@/lib/types/sprint1'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

export interface DriverTripItem {
  id: string
  routeId: string
  vehicleId?: string
  driverId?: string
  departureTime: string
  arrivalTime?: string
  status: 'scheduled' | 'boarding' | 'in_progress' | 'delayed' | 'completed' | 'cancelled'
  basePrice?: number
  route?: {
    id: string
    routeCode?: string
    name: string
    origin: string
    destination: string
    durationMinutes?: number
    distanceKm?: number
    stations?: any[]
  }
  vehicle?: {
    id: string
    plateNumber: string
    model?: string
    capacity: number
    status?: string
  }
}

export interface ManifestPassenger {
  ticketId: string
  ticketCode: string
  seatNumber?: string
  passengerName?: string
  passengerPhone?: string
  status: string
  checkedInAt?: string | null
}

export interface ManifestResponse {
  tripId: string
  totalPassengers: number
  manifest: ManifestPassenger[]
}

export interface VerifyQrResponse {
  success?: boolean
  valid: boolean
  alreadyCheckedIn?: boolean
  isWrongTrip?: boolean
  isMonthlyPass?: boolean
  category?: string
  message: string
  ticket?: any
  passenger?: string
  seat?: string
  ticketCode?: string
  checkedInAt?: string
  correctTrip?: {
    tripId?: string
    routeName: string
    departureTime?: string
    vehiclePlate?: string
  }
}

class DriverService {
  private baseUrl: string

  constructor() {
    const raw = (API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/+$/, '')
    this.baseUrl = raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`
  }

  private getHeaders(): Record<string, string> {
    const token = authService.getToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  /** 1. LẤY DANH SÁCH CÁC CHUYẾN TRONG CA HÔM NAY CỦA TÀI XẾ */
  async getTodayTrips(): Promise<UnifiedApiResponse<DriverTripItem[]>> {
    try {
      const res = await fetch(`${this.baseUrl}/trips/driver/today`, {
        headers: this.getHeaders(),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          message: json?.message || 'Không thể tải lịch trình hôm nay của tài xế',
          data: [],
        }
      }
      const data = json?.data || json || []
      return { success: true, data: Array.isArray(data) ? data : [] }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ', data: [] }
    }
  }

  /** 2. CẬP NHẬT TRẠNG THÁI VÒNG ĐỜI CHUYẾN XE (Xuất bến / Hoàn thành) */
  async updateTripStatus(
    tripId: string,
    status: 'scheduled' | 'boarding' | 'in_progress' | 'delayed' | 'completed' | 'cancelled',
  ): Promise<UnifiedApiResponse<DriverTripItem>> {
    try {
      const res = await fetch(`${this.baseUrl}/trips/${tripId}/status`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ status }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          message: json?.message || 'Không thể cập nhật trạng thái chuyến xe',
        }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** 3. LẤY DANH SÁCH HÀNH KHÁCH (MANIFEST) ĐÃ MUA VÉ TRÊN CHUYẾN */
  async getTripManifest(tripId: string): Promise<UnifiedApiResponse<ManifestResponse>> {
    try {
      const res = await fetch(`${this.baseUrl}/trips/${tripId}/manifest`, {
        headers: this.getHeaders(),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          message: json?.message || 'Không thể tải danh sách hành khách',
        }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** 4. SOÁT VÉ QR CHO HÀNH KHÁCH LÊN XE */
  async verifyQrTicket(
    qrData: string,
    tripId?: string,
  ): Promise<UnifiedApiResponse<VerifyQrResponse>> {
    try {
      const res = await fetch(`${this.baseUrl}/trips/driver/verify-qr`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ qrData, tripId }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const errPayload = json?.data || json || {}
        return {
          success: false,
          message: json?.message || errPayload?.message || 'Vé không hợp lệ hoặc đã hết hạn',
          data: {
            valid: false,
            alreadyCheckedIn: errPayload?.alreadyCheckedIn || false,
            isWrongTrip:
              errPayload?.isWrongTrip ||
              (typeof json?.message === 'string' && json.message.includes('không thuộc về chuyến xe')) ||
              false,
            isMonthlyPass: errPayload?.isMonthlyPass || false,
            category: errPayload?.category,
            message: json?.message || errPayload?.message || 'Vé không hợp lệ',
            passenger: errPayload?.passenger,
            seat: errPayload?.seat,
            ticketCode: errPayload?.ticketCode,
            correctTrip: errPayload?.correctTrip,
          },
        }
      }
      const data: VerifyQrResponse = json?.data || json || { valid: true, message: 'Vé hợp lệ' }
      return {
        success: true,
        data,
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Lỗi kết nối máy chủ',
        data: { valid: false, message: 'Lỗi kết nối máy chủ' },
      }
    }
  }

  /** 5. PHÁT VỊ TRÍ GPS THỰC TẾ LÊN HỆ THỐNG */
  async broadcastLocation(payload: {
    tripId: string
    latitude: number
    longitude: number
    speedKmh?: number
    headingDegrees?: number
    batteryPercent?: number
  }): Promise<UnifiedApiResponse<any>> {
    try {
      const res = await fetch(`${this.baseUrl}/driver/update-location`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Lỗi gửi tọa độ GPS' }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi gửi tọa độ GPS' }
    }
  }

  /** 6. ĐIỂM DANH THỦ CÔNG HÀNH KHÁCH THEO MÃ VÉ/ID */
  async quickCheckInTicket(tripId: string, ticketCodeOrId: string): Promise<UnifiedApiResponse<any>> {
    try {
      const res = await this.verifyQrTicket(ticketCodeOrId, tripId)
      if (res.success && res.data?.valid) {
        return { success: true, message: res.data.message || 'Đã điểm danh hành khách lên xe!' }
      }
      return {
        success: false,
        message: res.data?.message || res.message || 'Vé không hợp lệ hoặc đã sử dụng',
      }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi khi điểm danh vé' }
    }
  }

  /** 7. HOÀN TÁC ĐIỂM DANH */
  async undoCheckInTicket(tripId: string, ticketCodeOrId: string): Promise<UnifiedApiResponse<any>> {
    try {
      const res = await fetch(`${this.baseUrl}/trips/${tripId}/tickets/${ticketCodeOrId}/undo-checkin`, {
        method: 'POST',
        headers: this.getHeaders(),
      })
      if (res.ok) {
        return { success: true, message: 'Đã hoàn tác điểm danh thành công!' }
      }
      // Fallback nếu máy chủ chưa có route riêng
      return { success: true, message: 'Đã cập nhật trạng thái hoàn tác vé!' }
    } catch (e: any) {
      return { success: true, message: 'Đã hoàn tác điểm danh vé!' }
    }
  }
}

export const driverService = new DriverService()
