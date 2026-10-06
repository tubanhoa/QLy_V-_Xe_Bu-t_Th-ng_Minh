/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * User Management Service: Quản lý người dùng, cán bộ và phân quyền RBAC
 * Domain: users / rbac
 * Synchronized with Backend & Supabase Cloud
 */

import { authService } from './auth.service'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

export interface BackendUser {
  id: string
  fullName: string
  email: string
  phoneNumber?: string | null
  avatarUrl?: string | null
  studentId?: string | null
  faculty?: string | null
  idCardNumber?: string | null
  status: 'active' | 'inactive' | 'suspended' | string
  createdAt: string
  updatedAt: string
  role?: {
    id: string
    name: 'admin' | 'manager' | 'driver' | 'passenger' | string
    description?: string
  }
  isTestAccount?: boolean
  classification?: 'official' | 'test' | string
}

export interface GetUsersResponse {
  items: BackendUser[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

class UserService {
  private baseUrl: string

  constructor() {
    const raw = (API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/+$/, '')
    this.baseUrl = raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`
  }

  /** Lấy Authorization Header từ phiên đăng nhập thực tế của người dùng */
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

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = this.getAuthHeaders()
    const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } })

    if (res.status === 401 && typeof window !== 'undefined') {
      authService.clearSession()
    }
    return res
  }

  /** Lấy danh sách người dùng thực tế từ Supabase qua Backend */
  async getUsers(params?: {
    search?: string
    role?: string
    status?: string
    classification?: string
    page?: number
    limit?: number
  }): Promise<{ success: boolean; data?: GetUsersResponse; message?: string }> {
    try {
      const q = new URLSearchParams()
      if (params?.search) q.append('search', params.search)
      if (params?.role) q.append('role', params.role)
      if (params?.status) q.append('status', params.status)
      if (params?.classification && params.classification !== 'all') {
        q.append('classification', params.classification)
      }
      if (params?.page) q.append('page', String(params.page))
      const safeLimit = Math.min(Math.max(params?.limit || 50, 1), 100)
      q.append('limit', String(safeLimit))

      const res = await this.fetchWithAuth(`${this.baseUrl}/admin/users?${q.toString()}`, {
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể tải danh sách nhân sự' }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** Cập nhật phân quyền vai trò người dùng (Admin RBAC) */
  async changeRole(
    userId: string,
    role: string,
  ): Promise<{ success: boolean; data?: BackendUser; message?: string }> {
    try {
      const res = await this.fetchWithAuth(`${this.baseUrl}/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể cập nhật phân quyền' }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** Cập nhật trạng thái hoạt động của tài khoản */
  async changeStatus(
    userId: string,
    status: 'active' | 'inactive' | 'suspended',
  ): Promise<{ success: boolean; data?: BackendUser; message?: string }> {
    try {
      const res = await this.fetchWithAuth(`${this.baseUrl}/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể đổi trạng thái tài khoản' }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** Xóa tài khoản người dùng hoặc tài khoản rác */
  async deleteUser(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await this.fetchWithAuth(`${this.baseUrl}/admin/users/${userId}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể xóa tài khoản' }
      }
      return { success: true, message: json?.message || 'Đã xóa tài khoản thành công' }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** Dọn dẹp toàn bộ tài khoản kiểm thử và dữ liệu rác (1-Click Clean) */
  async cleanupTestData(): Promise<{
    success: boolean
    deletedCount?: number
    deletedEmails?: string[]
    message?: string
  }> {
    try {
      const res = await this.fetchWithAuth(`${this.baseUrl}/admin/users/cleanup-test-data`, {
        method: 'POST',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể thực hiện dọn dẹp' }
      }
      const data = json?.data || json
      return {
        success: true,
        deletedCount: data.deletedCount,
        deletedEmails: data.deletedEmails,
        message: data.message || 'Đã dọn dẹp dữ liệu kiểm thử thành công',
      }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** Cấp tài khoản nhân sự / tài xế nội bộ mới (Admin) */
  async createUser(payload: {
    fullName: string
    email: string
    password?: string
    role: 'admin' | 'manager' | 'driver' | 'passenger' | string
    phoneNumber?: string
    idCardNumber?: string
    faculty?: string
  }): Promise<{ success: boolean; data?: BackendUser; message?: string }> {
    try {
      const res = await this.fetchWithAuth(`${this.baseUrl}/admin/users`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể cấp tài khoản mới' }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** Lấy hồ sơ hoạt động, lịch sử chuyến chạy và soát vé của tài xế */
  async getDriverActivity(driverId: string): Promise<{
    success: boolean
    data?: DriverActivityResponse
    message?: string
  }> {
    try {
      const res = await this.fetchWithAuth(`${this.baseUrl}/admin/users/${driverId}/driver-activity`, {
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể tải nhật ký hoạt động tài xế' }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }
}

export interface DriverActivityStats {
  totalTrips: number
  completedTrips: number
  inProgressTrips: number
  totalTicketsCheckedIn: number
}

export interface DriverTripActivity {
  id: string
  departureTime: string
  status: string
  routeName: string
  routeCode?: string
  vehiclePlate: string
  capacity?: number
}

export interface DriverCheckInActivity {
  ticketCode: string
  passengerName: string
  seatNumber: string
  routeName: string
  checkedInAt: string
}

export interface DriverActivityResponse {
  driver: {
    id: string
    fullName: string
    email: string
    phoneNumber?: string
    idCardNumber?: string
    status: string
    licenseClass: string
    role: string
    createdAt: string
  }
  stats: DriverActivityStats
  trips: DriverTripActivity[]
  recentCheckIns: DriverCheckInActivity[]
}

export const userService = new UserService()
