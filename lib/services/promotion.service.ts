/**
 * Service gọi API Voucher & Vé tháng
 * Endpoints:
 *   POST /api/v1/vouchers/validate          → Kiểm tra mã giảm giá (Public)
 *   POST /api/v1/monthly-passes/register    → Đăng ký vé tháng
 *   GET  /api/v1/monthly-passes/my-passes   → Xem vé tháng của tôi
 * Branch: feature/SBTS-voucher-monthly-pass-fe
 */

import { authService } from './auth.service'
import type {
  MonthlyPass,
  RegisterMonthlyPassPayload,
  ValidateVoucherPayload,
  VoucherValidationResult,
} from '@/lib/types/promotion'
import { UnifiedApiResponse } from '@/lib/types/sprint1'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

class PromotionService {
  private baseUrl: string

  constructor() {
    const raw = (API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/+$/, '')
    this.baseUrl = raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`
  }

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
   * Kiểm tra và tính toán giảm giá của mã voucher
   * Endpoint: POST /api/v1/vouchers/validate (Public)
   */
  async validateVoucher(
    payload: ValidateVoucherPayload,
  ): Promise<UnifiedApiResponse<VoucherValidationResult>> {
    try {
      const response = await fetch(`${this.baseUrl}/vouchers/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const resJson = await response.json().catch(() => null)

      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Mã voucher không hợp lệ',
        }
      }

      const data: VoucherValidationResult = resJson?.data || resJson
      return { success: true, data }
    } catch (error: any) {
      console.error('[PromotionService.validateVoucher]', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /**
   * Đăng ký vé tháng xe buýt
   * Endpoint: POST /api/v1/monthly-passes/register
   */
  async registerMonthlyPass(
    payload: RegisterMonthlyPassPayload,
  ): Promise<UnifiedApiResponse<MonthlyPass>> {
    try {
      const response = await fetch(`${this.baseUrl}/monthly-passes/register`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      const resJson = await response.json().catch(() => null)

      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể đăng ký vé tháng',
        }
      }

      const data: MonthlyPass = resJson?.data || resJson
      return { success: true, data }
    } catch (error: any) {
      console.error('[PromotionService.registerMonthlyPass]', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /**
   * Xem danh sách vé tháng của người dùng hiện tại
   * Endpoint: GET /api/v1/monthly-passes/my-passes
   */
  async getMyPasses(): Promise<UnifiedApiResponse<MonthlyPass[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/monthly-passes/my-passes`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })

      const resJson = await response.json().catch(() => null)

      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tải danh sách vé tháng',
        }
      }

      const data: MonthlyPass[] = resJson?.data || resJson
      return { success: true, data }
    } catch (error: any) {
      console.error('[PromotionService.getMyPasses]', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /**
   * Xem danh sách hồ sơ đăng ký vé tháng (Admin, Manager)
   * Endpoint: GET /api/v1/admin/monthly-passes
   */
  async getAdminMonthlyPasses(query?: {
    page?: number
    limit?: number
    status?: string
  }): Promise<UnifiedApiResponse<{ items: any[]; meta: any }>> {
    try {
      const params = new URLSearchParams()
      if (query?.page) params.append('page', String(query.page))
      if (query?.limit) params.append('limit', String(query.limit))
      if (query?.status) params.append('status', query.status)

      const url = `${this.baseUrl}/admin/monthly-passes${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tải danh sách hồ sơ vé tháng',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[PromotionService.getAdminMonthlyPasses]', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /**
   * Phê duyệt hoặc từ chối hồ sơ vé tháng (Admin, Manager)
   * Endpoint: PATCH /api/v1/admin/monthly-passes/:id/review
   */
  async reviewMonthlyPass(
    id: string,
    status: 'approved' | 'rejected',
    rejectionReason?: string,
  ): Promise<UnifiedApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/monthly-passes/${id}/review`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ status, rejectionReason }),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể duyệt hồ sơ vé tháng',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[PromotionService.reviewMonthlyPass]', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }
}

export const promotionService = new PromotionService()
