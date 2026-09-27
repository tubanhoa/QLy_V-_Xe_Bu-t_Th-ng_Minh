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
    this.baseUrl = API_BASE_URL.replace(/\/+$/, '')
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
}

export const promotionService = new PromotionService()
