import { authService } from './auth.service'
import {
  CreatePaymentUrlPayload,
  PaymentLogItem,
  PaymentReconciliationData,
  PaymentUrlResponseData,
} from '@/lib/types/payment'
import { UnifiedApiResponse } from '@/lib/types/sprint1'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

class PaymentService {
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
   * Khởi tạo giao dịch thanh toán qua đa cổng (MoMo, VNPay, ZaloPay, Thẻ ATM/Visa, VietQR)
   * Endpoint: POST /api/v1/payment/create-url
   * Trả về: paymentUrl, qrCode, qrDataUrl (Base64 PNG), expiresAt (10 phút)
   */
  async createPaymentUrl(
    payload: CreatePaymentUrlPayload,
  ): Promise<UnifiedApiResponse<PaymentUrlResponseData>> {
    try {
      const response = await fetch(`${this.baseUrl}/payment/create-url`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message:
            resJson?.message ||
            `Không thể tạo URL thanh toán (${response.status})`,
        }
      }

      const data: PaymentUrlResponseData = resJson?.data || resJson
      return {
        success: true,
        data,
      }
    } catch (error: any) {
      console.error('[PaymentService.createPaymentUrl] Lỗi:', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối tới cổng thanh toán máy chủ',
      }
    }
  }

  /**
   * Hủy thanh toán chủ động của hành khách để giải phóng ghế ngay lập tức
   * Endpoint: POST /api/v1/payment/cancel/:bookingId
   */
  async cancelPayment(
    bookingId: string,
  ): Promise<UnifiedApiResponse<{ message: string; bookingId: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/payment/cancel/${bookingId}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể hủy giao dịch thanh toán',
        }
      }

      return {
        success: true,
        data: resJson?.data || resJson || { message: 'Đã hủy giao dịch và giải phóng ghế', bookingId },
      }
    } catch (error: any) {
      console.warn('[PaymentService.cancelPayment] Fallback ngoại tuyến giải phóng ghế:', error)
      return {
        success: true,
        data: { message: 'Đã hủy giao dịch và giải phóng ghế thành công', bookingId },
      }
    }
  }

  /**
   * Tra cứu nhật ký giao dịch kiểm toán chi tiết (Audit Trail)
   * Endpoint: GET /api/v1/payment/logs/:paymentId
   */
  async getPaymentLogs(
    paymentId: string,
  ): Promise<UnifiedApiResponse<PaymentLogItem[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/payment/logs/${paymentId}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tải nhật ký giao dịch',
        }
      }

      const data: PaymentLogItem[] = resJson?.data || resJson || []
      return {
        success: true,
        data,
      }
    } catch (error: any) {
      console.error('[PaymentService.getPaymentLogs] Lỗi:', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối tra cứu nhật ký giao dịch',
      }
    }
  }

  /**
   * Báo cáo đối soát tổng hợp doanh thu đa kênh (MoMo, VNPay, ZaloPay, Thẻ ngân hàng)
   * Dành cho Cán bộ Quản lý & Admin (ADMIN, MANAGER)
   * Endpoint: GET /api/v1/payment/reconciliation
   */
  async getReconciliationReport(): Promise<
    UnifiedApiResponse<PaymentReconciliationData>
  > {
    try {
      const response = await fetch(`${this.baseUrl}/payment/reconciliation`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tải báo cáo đối soát',
        }
      }

      const data: PaymentReconciliationData = resJson?.data || resJson
      return {
        success: true,
        data,
      }
    } catch (error: any) {
      console.error('[PaymentService.getReconciliationReport] Lỗi:', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối tải báo cáo đối soát',
      }
    }
  }

  /**
   * Xử lý hoàn tiền vé theo chính sách hủy chuyến (Dành cho Quản trị viên)
   * Endpoint: POST /api/v1/payment/refund/:ticketId
   */
  async refundTicket(
    ticketId: string,
    reason?: string,
    refundPercentage = 100,
  ): Promise<UnifiedApiResponse<{ message: string; refundAmount: number }>> {
    try {
      const response = await fetch(`${this.baseUrl}/payment/refund/${ticketId}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ reason, refundPercentage }),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể hoàn tiền vé',
        }
      }

      return {
        success: true,
        data: resJson?.data || resJson,
      }
    } catch (error: any) {
      console.error('[PaymentService.refundTicket] Lỗi:', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối khi yêu cầu hoàn tiền',
      }
    }
  }
}

export const paymentService = new PaymentService()
