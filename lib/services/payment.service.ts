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
      console.error('[PaymentService.cancelPayment] Lỗi:', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối khi hủy giao dịch',
      }
    }
  }

  /**
   * Kiểm tra trạng thái thanh toán thực tế của đơn vé từ máy chủ
   * Giúp đối soát chính xác trước khi xuất vé thành công hoặc phát hiện giao dịch đã bị hủy
   */
  async checkPaymentStatus(
    bookingId: string,
  ): Promise<UnifiedApiResponse<{ status: 'PAID' | 'PENDING' | 'CANCELLED'; bookingId: string; message: string }>> {
    try {
      // 1. Thử kiểm tra qua endpoint danh sách vé gần nhất
      const response = await fetch(`${this.baseUrl}/booking/my-tickets?page=1&limit=5`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })

      const resJson = await response.json().catch(() => null)
      if (response.ok && resJson) {
        const items = resJson?.data?.items || resJson?.items || []
        const matched = items.find(
          (t: any) =>
            t.bookingId === bookingId ||
            t.bookingCode === bookingId ||
            (t.id && t.id === bookingId) ||
            (t.ticketId && t.ticketId === bookingId),
        )

        if (matched) {
          const raw = String(matched.status || '').toUpperCase()
          if (raw === 'PAID') {
            return {
              success: true,
              data: { status: 'PAID', bookingId, message: 'Đơn hàng đã được thanh toán thành công' },
            }
          }
          if (raw === 'CANCELLED' || raw === 'CANCELED') {
            return {
              success: true,
              data: { status: 'CANCELLED', bookingId, message: 'Giao dịch thanh toán đã bị hủy' },
            }
          }
          return {
            success: true,
            data: { status: 'PENDING', bookingId, message: 'Giao dịch đang chờ thanh toán' },
          }
        }
      }

      // Mặc định trả về PENDING nếu chưa tìm thấy giao dịch đã hoàn tất
      return {
        success: true,
        data: { status: 'PENDING', bookingId, message: 'Chưa nhận được xác nhận thanh toán' },
      }
    } catch (error: any) {
      console.warn('[PaymentService.checkPaymentStatus] Network warn:', error)
      return {
        success: false,
        message: error?.message || 'Không thể kiểm tra trạng thái thanh toán',
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
