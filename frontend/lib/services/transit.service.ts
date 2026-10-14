/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * Transit Service: Quản trị Tuyến đường, Trạm dừng, Lộ trình & Biểu phí
 * Domain: transit
 * Synchronized with Backend PR #42 & Supabase Cloud
 */

import { authService } from './auth.service'
import { searchService } from './search.service'
import type {
  TransitRoute,
  TransitStation,
  CreateRoutePayload,
  UpdateRoutePayload,
  CreateStationPayload,
  UpdateStationPayload,
  AddRouteStationPayload,
  UpdatePricingPayload,
  CalculateFarePayload,
  CalculateFareResponse,
  TransitApiResponse,
} from '@/lib/types/transit'

class TransitService {
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

  // =========================================================================
  // 1. QUẢN LÝ TUYẾN ĐƯỜNG (ROUTES CRUD)
  // =========================================================================

  /** Lấy danh sách toàn bộ tuyến xe buýt */
  async getRoutes(query?: {
    keyword?: string
    origin?: string
    destination?: string
  }): Promise<TransitApiResponse<TransitRoute[]>> {
    try {
      const params = new URLSearchParams()
      if (query?.keyword) params.append('keyword', query.keyword)
      if (query?.origin) params.append('origin', query.origin)
      if (query?.destination) params.append('destination', query.destination)

      const url = `${this.baseUrl}/routes${params.toString() ? `?${params.toString()}` : ''}`
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        return {
          success: false,
          message: json?.message || 'Không thể tải danh sách tuyến xe',
          statusCode: res.status,
        }
      }

      return {
        success: true,
        data: Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [],
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Lỗi kết nối máy chủ khi tải danh sách tuyến',
      }
    }
  }

  /** Lấy chi tiết tuyến xe kèm danh sách trạm dừng theo thứ tự */
  async getRouteById(id: string): Promise<TransitApiResponse<TransitRoute>> {
    try {
      const res = await fetch(`${this.baseUrl}/routes/${id}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        return {
          success: false,
          message: json?.message || `Không tìm thấy tuyến xe ${id}`,
          statusCode: res.status,
        }
      }

      return {
        success: true,
        data: json?.data || json,
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /** Tạo tuyến xe buýt mới */
  async createRoute(
    payload: CreateRoutePayload,
  ): Promise<TransitApiResponse<TransitRoute>> {
    try {
      const res = await fetch(`${this.baseUrl}/routes`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        return {
          success: false,
          message: Array.isArray(json?.message)
            ? json.message.join(', ')
            : json?.message || 'Không thể tạo tuyến xe mới',
          statusCode: res.status,
        }
      }

      const createdRoute = json?.data || json

      if (typeof window !== 'undefined') {
        searchService.clearCache()
        window.dispatchEvent(
          new CustomEvent('ictu:route-created', {
            detail: createdRoute,
          }),
        )
        try {
          localStorage.setItem('ictu_route_created_ts', Date.now().toString())
        } catch {}
      }

      return {
        success: true,
        data: createdRoute,
        message: 'Tạo tuyến xe buýt thành công!',
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /** Cập nhật thông tin tuyến xe buýt */
  async updateRoute(
    id: string,
    payload: UpdateRoutePayload,
  ): Promise<TransitApiResponse<TransitRoute>> {
    try {
      const res = await fetch(`${this.baseUrl}/routes/${id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        return {
          success: false,
          message: Array.isArray(json?.message)
            ? json.message.join(', ')
            : json?.message || 'Không thể cập nhật tuyến xe',
          statusCode: res.status,
        }
      }

      return {
        success: true,
        data: json?.data || json,
        message: 'Cập nhật tuyến xe thành công!',
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /**
   * Xóa tuyến xe buýt kèm kiểm tra ràng buộc toàn vẹn dữ liệu
   * Nếu có chuyến xe hoạt động hoặc vé đã bán -> Backend trả về HTTP 409 Conflict
   */
  async deleteRoute(
    id: string,
  ): Promise<TransitApiResponse<{ message: string }>> {
    try {
      const res = await fetch(`${this.baseUrl}/routes/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        const isConflict = res.status === 409
        return {
          success: false,
          message: json?.message || 'Không thể xóa tuyến xe',
          statusCode: res.status,
          isIntegrityConflict: isConflict,
        }
      }

      return {
        success: true,
        data: json?.data || json,
        message: json?.message || 'Đã xóa tuyến xe thành công!',
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Lỗi kết nối máy chủ khi xóa tuyến',
      }
    }
  }

  /** Chuyển nhanh trạng thái tuyến sang Tạm ngưng hoạt động (inactive) khi bị chặn xóa */
  async deactivateRoute(id: string): Promise<TransitApiResponse<TransitRoute>> {
    return this.updateRoute(id, { status: 'inactive' })
  }

  // =========================================================================
  // 2. QUẢN LÝ LỘ TRÌNH TRẠM DỪNG (ROUTE STATIONS)
  // =========================================================================

  /** Cập nhật toàn bộ danh sách & thứ tự trạm trên tuyến (Bulk Re-order) */
  async bulkUpdateStations(
    routeId: string,
    stops: Array<{
      stationId: string
      stopOrder: number
      distanceFromOriginKm?: number
      estimatedMinutes?: number
    }>,
  ): Promise<TransitApiResponse<TransitRoute>> {
    try {
      const res = await fetch(`${this.baseUrl}/routes/${routeId}/stations`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ stops }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        return {
          success: false,
          message: json?.message || 'Không thể cập nhật danh sách trạm',
          statusCode: res.status,
        }
      }

      return {
        success: true,
        data: json?.data || json,
        message: 'Đã cập nhật lộ trình trạm dừng thành công!',
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /** Thêm một trạm vào tuyến tại vị trí stopOrder chỉ định */
  async addStationToRoute(
    routeId: string,
    payload: AddRouteStationPayload,
  ): Promise<TransitApiResponse<TransitRoute>> {
    try {
      const res = await fetch(`${this.baseUrl}/routes/${routeId}/stations`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        return {
          success: false,
          message: json?.message || 'Không thể thêm trạm vào tuyến',
          statusCode: res.status,
        }
      }

      return {
        success: true,
        data: json?.data || json,
        message: 'Đã thêm trạm vào tuyến thành công!',
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /** Gỡ một trạm ra khỏi tuyến (Backend tự động đánh số lại 1..N) */
  async removeStationFromRoute(
    routeId: string,
    stationId: string,
  ): Promise<TransitApiResponse<TransitRoute>> {
    try {
      const res = await fetch(
        `${this.baseUrl}/routes/${routeId}/stations/${stationId}`,
        {
          method: 'DELETE',
          headers: this.getAuthHeaders(),
        },
      )
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        return {
          success: false,
          message: json?.message || 'Không thể gỡ trạm khỏi tuyến',
          statusCode: res.status,
        }
      }

      return {
        success: true,
        data: json?.data || json,
        message: 'Đã gỡ trạm ra khỏi tuyến và cập nhật lại thứ tự!',
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  // =========================================================================
  // 3. CẤU HÌNH & TÍNH TOÁN GIÁ VÉ (PRICING & CALCULATE FARE)
  // =========================================================================

  /** Cấu hình biểu phí vé: fixed (đồng giá), distance (cự ly), hoặc stage (chặng) */
  async updatePricing(
    routeId: string,
    payload: UpdatePricingPayload,
  ): Promise<TransitApiResponse<TransitRoute>> {
    try {
      const res = await fetch(`${this.baseUrl}/routes/${routeId}/pricing`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        return {
          success: false,
          message: json?.message || 'Không thể cập nhật biểu phí',
          statusCode: res.status,
        }
      }

      return {
        success: true,
        data: json?.data || json,
        message: 'Cập nhật cấu hình biểu phí thành công!',
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /** Tra cứu và tính toán giá vé tức thì giữa 2 trạm đón/trả */
  async calculateFare(
    routeId: string,
    payload: CalculateFarePayload,
  ): Promise<TransitApiResponse<CalculateFareResponse>> {
    try {
      const res = await fetch(
        `${this.baseUrl}/routes/${routeId}/calculate-fare`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(payload),
        },
      )
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        return {
          success: false,
          message: json?.message || 'Không thể tính giá vé',
          statusCode: res.status,
        }
      }

      return {
        success: true,
        data: json?.data || json,
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  // =========================================================================
  // 4. QUẢN LÝ TRẠM DỪNG ĐỘC LẬP (STATIONS CRUD)
  // =========================================================================

  /** Lấy danh sách toàn bộ trạm dừng đang hoạt động */
  async getStations(): Promise<TransitApiResponse<TransitStation[]>> {
    try {
      const res = await fetch(`${this.baseUrl}/stations`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        return {
          success: false,
          message: json?.message || 'Không thể tải danh sách trạm dừng',
          statusCode: res.status,
        }
      }

      return {
        success: true,
        data: Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [],
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Lỗi kết nối máy chủ khi tải trạm dừng',
      }
    }
  }

  /** Lấy chi tiết trạm dừng kèm danh sách các tuyến xe đi qua */
  async getStationById(id: string): Promise<TransitApiResponse<TransitStation>> {
    try {
      const res = await fetch(`${this.baseUrl}/stations/${id}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        return {
          success: false,
          message: json?.message || 'Không tìm thấy trạm dừng',
          statusCode: res.status,
        }
      }

      return {
        success: true,
        data: json?.data || json,
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /** Tạo trạm dừng mới */
  async createStation(
    payload: CreateStationPayload,
  ): Promise<TransitApiResponse<TransitStation>> {
    try {
      const res = await fetch(`${this.baseUrl}/stations`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        return {
          success: false,
          message: Array.isArray(json?.message)
            ? json.message.join(', ')
            : json?.message || 'Không thể tạo trạm dừng mới',
          statusCode: res.status,
        }
      }

      return {
        success: true,
        data: json?.data || json,
        message: 'Tạo trạm dừng mới thành công!',
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /** Cập nhật thông tin trạm dừng */
  async updateStation(
    id: string,
    payload: UpdateStationPayload,
  ): Promise<TransitApiResponse<TransitStation>> {
    try {
      const res = await fetch(`${this.baseUrl}/stations/${id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        return {
          success: false,
          message: Array.isArray(json?.message)
            ? json.message.join(', ')
            : json?.message || 'Không thể cập nhật trạm dừng',
          statusCode: res.status,
        }
      }

      return {
        success: true,
        data: json?.data || json,
        message: 'Cập nhật trạm dừng thành công!',
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /**
   * Xóa trạm dừng kèm kiểm tra ràng buộc toàn vẹn
   * Nếu trạm đang nằm trong tuyến xe hoạt động -> Backend trả về HTTP 409 Conflict
   */
  async deleteStation(
    id: string,
  ): Promise<TransitApiResponse<{ message: string }>> {
    try {
      const res = await fetch(`${this.baseUrl}/stations/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        const isConflict = res.status === 409
        return {
          success: false,
          message: json?.message || 'Không thể xóa trạm dừng',
          statusCode: res.status,
          isIntegrityConflict: isConflict,
        }
      }

      return {
        success: true,
        data: json?.data || json,
        message: json?.message || 'Đã xóa trạm dừng thành công!',
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Lỗi kết nối máy chủ khi xóa trạm',
      }
    }
  }
}

export const transitService = new TransitService()
