import {
  ListDriverProfilesResponse,
  DriverWithProfileItem,
  UpdateDriverProfilePayload,
  ReviewDriverProfilePayload,
} from '@/lib/types/driver-profile'
import { authService } from './auth.service'

export interface UnifiedApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  statusCode?: number
}

class DriverProfileService {
  private baseUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001/api/v1'

  private getAuthHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    const token = authService.getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  /**
   * Lấy danh sách hồ sơ bằng lái của tất cả tài xế và KPIs
   */
  async getDriverProfiles(params?: {
    page?: number
    limit?: number
    status?: string
    search?: string
  }): Promise<UnifiedApiResponse<ListDriverProfilesResponse>> {
    try {
      const searchParams = new URLSearchParams()
      if (params?.page) searchParams.set('page', String(params.page))
      if (params?.limit) searchParams.set('limit', String(params.limit))
      if (params?.status && params.status !== 'all') searchParams.set('status', params.status)
      if (params?.search) searchParams.set('search', params.search)

      const url = `${this.baseUrl}/admin/driver-profiles?${searchParams.toString()}`
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tải danh sách hồ sơ bằng lái tài xế',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[DriverProfileService.getDriverProfiles]', error)
      return { success: false, message: error?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /**
   * Tài xế lấy thông tin chi tiết hồ sơ bằng lái của chính mình
   */
  async getMyDriverProfile(): Promise<UnifiedApiResponse<DriverWithProfileItem>> {
    try {
      const response = await fetch(`${this.baseUrl}/driver/my-profile`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tải hồ sơ bằng lái của bạn',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[DriverProfileService.getMyDriverProfile]', error)
      return { success: false, message: error?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /**
   * Tài xế tự nộp hoặc cập nhật hồ sơ bằng lái của mình
   */
  async updateMyDriverProfile(payload: UpdateDriverProfilePayload): Promise<UnifiedApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/driver/my-profile`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể cập nhật hồ sơ bằng lái của bạn',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[DriverProfileService.updateMyDriverProfile]', error)
      return { success: false, message: error?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /**
   * Lấy chi tiết hồ sơ bằng lái của một tài xế
   */
  async getDriverProfile(driverId: string): Promise<UnifiedApiResponse<DriverWithProfileItem>> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/driver-profiles/${driverId}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tải chi tiết hồ sơ tài xế',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[DriverProfileService.getDriverProfile]', error)
      return { success: false, message: error?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /**
   * Admin trực tiếp tạo hoặc cập nhật hồ sơ bằng lái tài xế
   */
  async upsertDriverProfile(
    driverId: string,
    payload: UpdateDriverProfilePayload,
  ): Promise<UnifiedApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/driver-profiles/${driverId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể cập nhật hồ sơ bằng lái',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[DriverProfileService.upsertDriverProfile]', error)
      return { success: false, message: error?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /**
   * Admin thẩm định hồ sơ: Phê duyệt hoặc Từ chối kèm lý do
   */
  async reviewDriverProfile(
    driverId: string,
    payload: ReviewDriverProfilePayload,
  ): Promise<UnifiedApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/driver-profiles/${driverId}/review`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể xử lý thẩm định hồ sơ bằng lái',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[DriverProfileService.reviewDriverProfile]', error)
      return { success: false, message: error?.message || 'Lỗi kết nối máy chủ' }
    }
  }
}

export const driverProfileService = new DriverProfileService()
