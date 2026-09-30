import { authService } from './auth.service'
import type { InvoiceData, ResendEmailResult } from '@/lib/types/invoice'
import type { UnifiedApiResponse } from '@/lib/types/sprint1'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

class InvoiceService {
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
   * Lấy thông tin hóa đơn điện tử theo mã đơn đặt vé (Booking Code)
   * GET /api/v1/invoices/booking/:bookingCode
   */
  async getInvoiceByBookingCode(
    bookingCode: string,
  ): Promise<UnifiedApiResponse<InvoiceData>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/invoices/booking/${encodeURIComponent(bookingCode)}`,
        {
          method: 'GET',
          headers: this.getAuthHeaders(),
          cache: 'no-store',
        },
      )

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không tìm thấy hóa đơn điện tử',
        }
      }

      const data: InvoiceData = resJson?.data || resJson
      return {
        success: true,
        data,
      }
    } catch (error: any) {
      console.warn('[InvoiceService.getInvoiceByBookingCode] Network error:', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ khi tải hóa đơn',
      }
    }
  }

  /**
   * Tải tệp PDF hóa đơn điện tử về máy người dùng
   * GET /api/v1/invoices/booking/:bookingCode/pdf
   */
  async downloadPdfByBookingCode(bookingCode: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/invoices/booking/${encodeURIComponent(bookingCode)}/pdf`,
        {
          method: 'GET',
          headers: this.getAuthHeaders(),
        },
      )

      if (!response.ok) {
        throw new Error(`Không thể tải PDF hóa đơn (${response.status})`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Hoa_don_dien_tu_${bookingCode}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      return true
    } catch (error) {
      console.error('[InvoiceService.downloadPdfByBookingCode]', error)
      return false
    }
  }

  /**
   * Gửi lại email hóa đơn điện tử kèm tệp PDF cho hành khách
   * POST /api/v1/invoices/booking/:bookingCode/resend-email
   */
  async resendInvoiceEmail(
    bookingCode: string,
    email?: string,
  ): Promise<UnifiedApiResponse<ResendEmailResult>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/invoices/booking/${encodeURIComponent(bookingCode)}/resend-email`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ email }),
        },
      )

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể gửi lại email hóa đơn',
        }
      }

      return {
        success: true,
        data: resJson?.data || resJson,
        message: resJson?.message || 'Đã gửi hóa đơn điện tử qua email thành công!',
      }
    } catch (error: any) {
      console.error('[InvoiceService.resendInvoiceEmail]', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối khi gửi email hóa đơn',
      }
    }
  }

  /**
   * Tra cứu hóa đơn điện tử trực tuyến bằng mã tra cứu (Lookup Code)
   * GET /api/v1/invoices/lookup?code=...
   */
  async lookupInvoice(
    lookupCode: string,
    invoiceNumber?: string,
  ): Promise<UnifiedApiResponse<InvoiceData>> {
    try {
      const url = new URL(`${this.baseUrl}/invoices/lookup`)
      url.searchParams.set('code', lookupCode.trim())
      if (invoiceNumber) url.searchParams.set('invoice', invoiceNumber.trim())

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Mã tra cứu hóa đơn không tồn tại',
        }
      }

      return {
        success: true,
        data: resJson?.data || resJson,
      }
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối tra cứu hóa đơn',
      }
    }
  }

  /**
   * Lấy đường dẫn xem trực tiếp HTML hóa đơn trên trình duyệt
   */
  getInvoiceHtmlUrl(bookingCodeOrId: string): string {
    return `${this.baseUrl}/invoices/${encodeURIComponent(bookingCodeOrId)}/html`
  }

  /**
   * Lấy đường dẫn tải trực tiếp PDF hóa đơn
   */
  getInvoicePdfUrl(bookingCode: string): string {
    return `${this.baseUrl}/invoices/booking/${encodeURIComponent(bookingCode)}/pdf`
  }
}

export const invoiceService = new InvoiceService()
