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
  VoucherItem,
  CreateVoucherPayload,
  UpdateVoucherPayload,
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
   * Danh sách mã voucher khuyến mại (Admin / Marketing / Manager)
   * Endpoint: GET /api/v1/admin/vouchers
   */
  async getAdminVouchers(query?: {
    search?: string
    status?: string
    page?: number
    limit?: number
  }): Promise<UnifiedApiResponse<{ items: VoucherItem[]; meta?: any }>> {
    try {
      const params = new URLSearchParams()
      if (query?.search) params.append('search', query.search)
      if (query?.status && query.status !== 'all') params.append('status', query.status)
      if (query?.page) params.append('page', String(query.page))
      if (query?.limit) params.append('limit', String(query.limit))

      const url = `${this.baseUrl}/admin/vouchers${params.toString() ? `?${params.toString()}` : ''}`
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
          message: resJson?.message || 'Không thể tải danh sách voucher',
        }
      }

      const rawData = resJson?.data || resJson
      const items = Array.isArray(rawData) ? rawData : rawData?.items || []
      const meta = rawData?.meta || resJson?.meta
      return { success: true, data: { items, meta } }
    } catch (error: any) {
      console.error('[PromotionService.getAdminVouchers]', error)
      return { success: false, message: error?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /**
   * Lấy danh sách Voucher khả dụng cho khách hàng (Public / Customer Vault)
   */
  async getAvailableVouchers(): Promise<UnifiedApiResponse<VoucherItem[]>> {
    try {
      // Thử gọi API admin nếu đang có token hợp lệ
      const adminRes = await this.getAdminVouchers({ status: 'active', limit: 50 })
      if (adminRes.success && adminRes.data?.items?.length) {
        return { success: true, data: adminRes.data.items }
      }
      return { success: true, data: [] }
    } catch (error: any) {
      return { success: true, data: [] }
    }
  }

  /**
   * Tạo mới mã voucher (Admin / Marketing)
   * Endpoint: POST /api/v1/admin/vouchers
   */
  async createVoucher(payload: CreateVoucherPayload): Promise<UnifiedApiResponse<VoucherItem>> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/vouchers`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tạo mã voucher',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[PromotionService.createVoucher]', error)
      return { success: false, message: error?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /**
   * Cập nhật thông tin voucher
   * Endpoint: PATCH /api/v1/admin/vouchers/:id
   */
  async updateVoucher(id: string, payload: UpdateVoucherPayload): Promise<UnifiedApiResponse<VoucherItem>> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/vouchers/${id}`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể cập nhật mã voucher',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[PromotionService.updateVoucher]', error)
      return { success: false, message: error?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /**
   * Bật / Tắt trạng thái kích hoạt voucher (Toggle active / inactive)
   * Endpoint: PATCH /api/v1/admin/vouchers/:id/toggle-status
   */
  async toggleVoucherStatus(id: string): Promise<UnifiedApiResponse<VoucherItem>> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/vouchers/${id}/toggle-status`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể đổi trạng thái voucher',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[PromotionService.toggleVoucherStatus]', error)
      return { success: false, message: error?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /**
   * Xóa mã voucher chưa từng được sử dụng
   * Endpoint: DELETE /api/v1/admin/vouchers/:id
   */
  async deleteVoucher(id: string): Promise<UnifiedApiResponse<{ message: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/vouchers/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể xóa mã voucher',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[PromotionService.deleteVoucher]', error)
      return { success: false, message: error?.message || 'Lỗi kết nối máy chủ' }
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
      const cleanPayload: Record<string, any> = { ...payload }
      if (!cleanPayload.endDate || (typeof cleanPayload.endDate === 'string' && cleanPayload.endDate.trim() === '')) {
        delete cleanPayload.endDate
      }
      if (!cleanPayload.startDate || (typeof cleanPayload.startDate === 'string' && cleanPayload.startDate.trim() === '')) {
        delete cleanPayload.startDate
      }

      const response = await fetch(`${this.baseUrl}/monthly-passes/register`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(cleanPayload),
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

  /**
   * Cập nhật lại ảnh minh chứng cho vé tháng bị từ chối và gửi lại yêu cầu duyệt
   * Endpoint: PATCH /api/v1/monthly-passes/:id/resubmit-proof
   */
  async resubmitMonthlyPassProof(
    id: string,
    proofImageUrl: string,
    proofType?: string,
  ): Promise<UnifiedApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/monthly-passes/${id}/resubmit-proof`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ proofImageUrl, proofType }),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể gửi lại minh chứng vé tháng',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[PromotionService.resubmitMonthlyPassProof]', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /**
   * Tải ảnh minh chứng Thẻ Sinh Viên / CCCD lên máy chủ
   * Endpoint: POST /api/v1/monthly-passes/upload-proof (Multipart Form-Data)
   */
  async uploadProofImage(file: File): Promise<UnifiedApiResponse<{ url: string; filename: string }>> {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const token = authService.getToken()
      const headers: Record<string, string> = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${this.baseUrl}/monthly-passes/upload-proof`, {
        method: 'POST',
        headers,
        body: formData,
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tải ảnh minh chứng lên máy chủ',
        }
      }

      return {
        success: true,
        data: resJson,
      }
    } catch (error: any) {
      console.error('[PromotionService.uploadProofImage]', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ khi tải ảnh',
      }
    }
  }

  /**
   * Tính giá vé tháng theo đối tượng, kỳ hạn và phạm vi tuyến
   * Endpoint: POST /api/v1/monthly-passes/calculate-price
   */
  async calculatePrice(payload: {
    category: string
    durationMonths: number
    isAllRoutes?: boolean
    routeId?: string
  }): Promise<UnifiedApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/monthly-passes/calculate-price`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tính giá vé tháng',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[PromotionService.calculatePrice]', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /**
   * Gia hạn vé tháng trực tuyến (Cộng dồn thời hạn thông minh)
   * Endpoint: POST /api/v1/monthly-passes/:id/renew
   */
  async renewMonthlyPass(
    id: string,
    payloadOrMonths:
      | number
      | {
          durationMonths: number
          paymentMethod?: string
          autoConfirmPayment?: boolean
        },
    autoConfirm?: boolean,
  ): Promise<UnifiedApiResponse<any>> {
    try {
      const payload =
        typeof payloadOrMonths === 'number'
          ? { durationMonths: payloadOrMonths, autoConfirmPayment: autoConfirm }
          : payloadOrMonths

      const response = await fetch(`${this.baseUrl}/monthly-passes/${id}/renew`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể gia hạn vé tháng',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[PromotionService.renewMonthlyPass]', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ khi gia hạn',
      }
    }
  }

  /**
   * Tạo yêu cầu thanh toán cho vé tháng (VNPay Sandbox / VietQR)
   * Endpoint: POST /api/v1/monthly-passes/:id/create-payment
   */
  async createMonthlyPassPayment(
    id: string,
    payloadOrMethod?: string | { paymentMethod?: string },
  ): Promise<UnifiedApiResponse<any>> {
    try {
      const payload =
        typeof payloadOrMethod === 'string'
          ? { paymentMethod: payloadOrMethod }
          : payloadOrMethod || {}

      const response = await fetch(`${this.baseUrl}/monthly-passes/${id}/create-payment`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tạo yêu cầu thanh toán vé tháng',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[PromotionService.createMonthlyPassPayment]', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ khi tạo thanh toán',
      }
    }
  }

  /**
   * Xác nhận thanh toán chốt kích hoạt vé tháng
   * Endpoint: POST /api/v1/monthly-passes/:id/confirm-payment
   */
  async confirmMonthlyPassPayment(
    id: string,
    payload?: { paymentMethod?: string; transactionCode?: string },
  ): Promise<UnifiedApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/monthly-passes/${id}/confirm-payment`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload || {}),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể xác nhận thanh toán vé tháng',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[PromotionService.confirmMonthlyPassPayment]', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ khi xác nhận thanh toán',
      }
    }
  }

  /**
   * Xem lịch sử giao dịch và gia hạn của vé tháng
   * Endpoint: GET /api/v1/monthly-passes/:id/history
   */
  async getMonthlyPassHistory(id: string): Promise<UnifiedApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/monthly-passes/${id}/history`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tải lịch sử vé tháng',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[PromotionService.getMonthlyPassHistory]', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }
}

export const promotionService = new PromotionService()
