/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * Trip & Dispatch Service: Quản trị Lịch trình chuyến xe, Điều phối tài xế & Xe buýt
 * Domain: trips / dispatch
 * Synchronized with Backend TripsController & Supabase Cloud
 */

import { authService } from './auth.service'

export interface TripItem {
  id: string
  routeId: string
  vehicleId?: string
  driverId?: string
  conductorId?: string
  departureTime: string
  arrivalTime?: string
  status: 'scheduled' | 'boarding' | 'departed' | 'in_progress' | 'completed' | 'delayed' | 'cancelled'
  basePrice?: number
  availableSeats?: number
  totalSeats?: number
  route?: {
    id: string
    routeCode: string
    name: string
    origin: string
    destination: string
  }
  vehicle?: {
    id: string
    licensePlate: string
    model: string
    seatCapacity: number
  }
  driver?: {
    id: string
    fullName: string
    phoneNumber: string
    email: string
  }
  conductor?: {
    id: string
    fullName: string
    phoneNumber: string
  }
}

export interface DispatchTripPayload {
  tripId: string
  vehicleId: string
  driverId: string
  conductorId?: string
}

export interface GenerateTripsPayload {
  routeId: string
  startDate: string
  endDate: string
  departures: string[]
}

export interface TripApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

class TripService {
  private baseUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

  private getAuthHeaders(): Record<string, string> {
    const token = authService.getToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  /** Lấy danh sách toàn bộ chuyến xe với phân trang và bộ lọc */
  async getTrips(query?: {
    page?: number
    limit?: number
    routeId?: string
    status?: string
    date?: string
    search?: string
  }): Promise<
    TripApiResponse<{
      items: TripItem[]
      meta: {
        page: number
        limit: number
        total: number
        totalPages: number
      }
    }>
  > {
    try {
      const params = new URLSearchParams()
      if (query?.page) params.append('page', String(query.page))
      if (query?.limit) params.append('limit', String(query.limit))
      if (query?.routeId) params.append('routeId', query.routeId)
      if (query?.status) params.append('status', query.status)
      if (query?.date) params.append('date', query.date)
      if (query?.search) params.append('search', query.search)

      const url = `${this.baseUrl}/trips${params.toString() ? `?${params.toString()}` : ''}`
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          data: { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } },
          message: json?.message || 'Không thể tải danh sách chuyến xe',
        }
      }
      return json
    } catch (err: any) {
      return {
        success: false,
        data: { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } },
        message: err.message || 'Lỗi kết nối máy chủ chuyến xe',
      }
    }
  }

  /** Điều phối: Gán xe buýt + Tài xế + Phụ xe cho chuyến */
  async dispatchTrip(payload: DispatchTripPayload): Promise<TripApiResponse<TripItem | null>> {
    try {
      const res = await fetch(`${this.baseUrl}/trips/dispatch`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          data: null,
          message: json?.message || 'Không thể điều phối chuyến xe này',
        }
      }
      return json
    } catch (err: any) {
      return {
        success: false,
        data: null,
        message: err.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /** Cập nhật trạng thái chuyến xe (in_progress, completed, delayed, cancelled) */
  async updateStatus(
    tripId: string,
    status: string
  ): Promise<TripApiResponse<TripItem | null>> {
    try {
      const res = await fetch(`${this.baseUrl}/trips/${tripId}/status`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ status }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          data: null,
          message: json?.message || 'Không thể cập nhật trạng thái chuyến',
        }
      }
      return json
    } catch (err: any) {
      return {
        success: false,
        data: null,
        message: err.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /** Tự động sinh lịch trình chạy xe theo ngày */
  async generateSchedule(
    payload: GenerateTripsPayload
  ): Promise<TripApiResponse<any>> {
    try {
      const res = await fetch(`${this.baseUrl}/trips/generate`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          data: null,
          message: json?.message || 'Không thể sinh lịch trình',
        }
      }
      return json
    } catch (err: any) {
      return {
        success: false,
        data: null,
        message: err.message || 'Lỗi kết nối máy chủ',
      }
    }
  }
}

export const tripService = new TripService()
