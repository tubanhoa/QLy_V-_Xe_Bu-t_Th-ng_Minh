/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * Audit Logs & Security Service
 * Quản trị nhật ký truy cập, lưu vết thao tác và kiểm toán hệ thống
 */

import { authService } from './auth.service'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

export interface AuditLogItem {
  id: string
  action: string
  resourceName: string
  resourceId?: string | null
  endpoint?: string | null
  method?: string | null
  status?: string | null
  executionTimeMs?: number | null
  changes?: Record<string, any> | null
  ipAddress?: string | null
  userAgent?: string | null
  userId?: string | null
  timestamp: string
  user?: {
    id: string
    fullName: string
    email: string
  } | null
}

export interface AuditStatsResponse {
  totalLogs: number
  logs24h: number
  failedLogs: number
  uniqueUsersCount: number
  topActions: Array<{
    action: string
    count: number
  }>
}

export interface GetAuditLogsResponse {
  items: AuditLogItem[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface QueryAuditLogsParams {
  search?: string
  action?: string
  resourceName?: string
  userId?: string
  ipAddress?: string
  status?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

class AuditService {
  private baseUrl: string

  constructor() {
    const raw = (API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/+$/, '')
    this.baseUrl = raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`
  }

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
    return fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } })
  }

  /**
   * Lấy danh sách nhật ký hoạt động có bộ lọc đa tiêu chí và phân trang
   */
  async getAuditLogs(
    params?: QueryAuditLogsParams,
  ): Promise<{ success: boolean; data?: GetAuditLogsResponse; message?: string }> {
    try {
      const q = new URLSearchParams()
      if (params?.search) q.append('search', params.search)
      if (params?.action && params.action !== 'all') q.append('action', params.action)
      if (params?.resourceName && params.resourceName !== 'all') q.append('resourceName', params.resourceName)
      if (params?.userId) q.append('userId', params.userId)
      if (params?.ipAddress) q.append('ipAddress', params.ipAddress)
      if (params?.status && params.status !== 'all') q.append('status', params.status)
      if (params?.startDate) q.append('startDate', params.startDate)
      if (params?.endDate) q.append('endDate', params.endDate)
      if (params?.page) q.append('page', String(params.page))
      if (params?.limit) q.append('limit', String(params.limit))

      const res = await this.fetchWithAuth(`${this.baseUrl}/admin/activity-logs?${q.toString()}`, {
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể tải danh sách nhật ký' }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /**
   * Lấy thống kê tổng quan kiểm toán & an ninh
   */
  async getAuditStats(): Promise<{ success: boolean; data?: AuditStatsResponse; message?: string }> {
    try {
      const res = await this.fetchWithAuth(`${this.baseUrl}/admin/activity-logs/stats`, {
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể tải thống kê nhật ký' }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /**
   * Lấy chi tiết một bản ghi nhật ký kiểm toán
   */
  async getAuditLogById(id: string): Promise<{ success: boolean; data?: AuditLogItem; message?: string }> {
    try {
      const res = await this.fetchWithAuth(`${this.baseUrl}/admin/activity-logs/${id}`, {
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể tải chi tiết nhật ký' }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }
}

export const auditService = new AuditService()
