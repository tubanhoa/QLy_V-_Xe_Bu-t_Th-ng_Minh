/**
 * Service gọi API Lịch sử vé & Chi tiết vé
 * Endpoints:
 *   GET  /api/v1/booking/my-tickets          → Danh sách vé
 *   GET  /api/v1/booking/my-tickets/:id      → Chi tiết vé + QR
 *   POST /api/v1/booking/cancel/:ticketId    → Hủy vé
 * Branch: feature/SBTS-my-tickets-fe
 */

import { authService } from './auth.service'
import { offlineTicketCache } from './offline-ticket-cache'
import type {
  CancelTicketResult,
  MyTicketsResponse,
  ResendTicketEmailResult,
  TicketDetail,
} from '@/lib/types/ticket'
import { UnifiedApiResponse } from '@/lib/types/sprint1'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

class TicketService {
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
   * Lấy danh sách tất cả vé đã mua của người dùng hiện tại
   * Tự động cache vào LocalStorage và fallback sang Offline Cache khi mất mạng
   */
  async getMyTickets(
    page = 1,
    limit = 10,
  ): Promise<UnifiedApiResponse<MyTicketsResponse>> {
    // Nếu offline từ trước, đọc trực tiếp từ cache
    if (!offlineTicketCache.isOnline()) {
      const cached = offlineTicketCache.getTicketsList()
      if (cached && cached.length > 0) {
        return {
          success: true,
          data: {
            items: cached,
            meta: {
              page,
              limit,
              total: cached.length,
              totalPages: Math.ceil(cached.length / limit) || 1,
            },
          },
          message: 'Dữ liệu được tải từ bộ nhớ tạm trên thiết bị (Ngoại tuyến)',
        }
      }
    }

    try {
      const url = new URL(`${this.baseUrl}/booking/my-tickets`)
      url.searchParams.set('page', String(page))
      url.searchParams.set('limit', String(limit))

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })

      const resJson = await response.json().catch(() => null)

      if (!response.ok) {
        // Nếu server lỗi hoặc 5xx, thử fallback cache
        const cached = offlineTicketCache.getTicketsList()
        if (cached && cached.length > 0) {
          return {
            success: true,
            data: {
              items: cached,
              meta: {
                page,
                limit,
                total: cached.length,
                totalPages: 1,
              },
            },
            message: 'Đang hiển thị vé từ bộ nhớ tạm trên thiết bị',
          }
        }
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tải danh sách vé',
        }
      }

      const data: MyTicketsResponse = resJson?.data || resJson
      // Tự động lưu cache cho chế độ ngoại tuyến
      if (data && Array.isArray(data.items)) {
        offlineTicketCache.saveTicketsList(data.items)
      }

      return { success: true, data }
    } catch (error: any) {
      console.warn('[TicketService.getMyTickets] Network error, fallback cache:', error)
      const cached = offlineTicketCache.getTicketsList()
      if (cached && cached.length > 0) {
        return {
          success: true,
          data: {
            items: cached,
            meta: {
              page,
              limit,
              total: cached.length,
              totalPages: 1,
            },
          },
          message: 'Mất kết nối mạng. Đã tải danh sách vé từ bộ nhớ tạm ngoại tuyến.',
        }
      }
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /**
   * Lấy chi tiết một vé (bao gồm mã QR base64 và chữ ký HMAC)
   * Tự động cache và fallback sang Offline Cache khi không có internet
   */
  async getTicketDetail(
    ticketId: string,
  ): Promise<UnifiedApiResponse<TicketDetail>> {
    // Nếu offline từ trước, đọc trực tiếp từ cache
    if (!offlineTicketCache.isOnline()) {
      const cachedTicket = offlineTicketCache.getTicket(ticketId)
      if (cachedTicket) {
        return {
          success: true,
          data: cachedTicket,
          message: 'Vé được tải từ bộ nhớ tạm trên máy (Chế độ Ngoại tuyến)',
        }
      }
    }

    try {
      // Ưu tiên endpoint /booking/tickets/:id hoặc /booking/my-tickets/:id
      const response = await fetch(
        `${this.baseUrl}/booking/tickets/${ticketId}`,
        {
          method: 'GET',
          headers: this.getAuthHeaders(),
          cache: 'no-store',
        },
      )

      let resJson = await response.json().catch(() => null)

      // Fallback sang endpoint /booking/my-tickets/:id nếu /booking/tickets/:id 404
      if (!response.ok && response.status === 404) {
        const fallbackRes = await fetch(
          `${this.baseUrl}/booking/my-tickets/${ticketId}`,
          {
            method: 'GET',
            headers: this.getAuthHeaders(),
            cache: 'no-store',
          },
        )
        if (fallbackRes.ok) {
          resJson = await fallbackRes.json().catch(() => null)
        }
      }

      if (!response.ok && !resJson) {
        // Fallback cache nếu có
        const cachedTicket = offlineTicketCache.getTicket(ticketId)
        if (cachedTicket) {
          return { success: true, data: cachedTicket }
        }
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không tìm thấy vé',
        }
      }

      const data: TicketDetail = resJson?.data || resJson
      // Tự động lưu cache offline
      if (data && data.ticketId) {
        offlineTicketCache.saveTicket(data)
      }

      return { success: true, data }
    } catch (error: any) {
      console.warn('[TicketService.getTicketDetail] Lỗi mạng, fallback cache:', error)
      const cachedTicket = offlineTicketCache.getTicket(ticketId)
      if (cachedTicket) {
        return {
          success: true,
          data: cachedTicket,
          message: 'Mất kết nối mạng. Đã tải vé từ bộ nhớ tạm trên thiết bị.',
        }
      }
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /**
   * Lấy mã QR có chữ ký số HMAC-SHA256 của vé (Backend PR #16)
   */
  async getTicketQr(ticketId: string): Promise<
    UnifiedApiResponse<{
      ticketId: string
      ticketCode: string
      qrData: string
      qrDataUrl: string
      signature?: string
      status: string
    }>
  > {
    try {
      const response = await fetch(
        `${this.baseUrl}/booking/tickets/${ticketId}/qr`,
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
          message: resJson?.message || 'Không thể lấy dữ liệu QR',
        }
      }
      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ khi lấy mã QR',
      }
    }
  }

  /**
   * Gửi lại vé điện tử kèm mã QR qua email (Backend PR #16)
   */
  async resendTicketEmail(
    ticketId: string,
    email?: string,
  ): Promise<UnifiedApiResponse<ResendTicketEmailResult>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/booking/tickets/${ticketId}/resend-email`,
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
          message: resJson?.message || 'Không thể gửi lại email vé',
        }
      }
      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ khi gửi lại email vé',
      }
    }
  }

  /**
   * Kiểm tra điều kiện hủy/đổi vé và tính phí theo thời gian thực (Backend PR #20)
   * GET /api/v1/booking/tickets/:ticketId/cancellation-policy
   */
  async getCancellationPolicy(
    ticketId: string,
  ): Promise<UnifiedApiResponse<any>> {
    try {
      let res = await fetch(
        `${this.baseUrl}/booking/tickets/${ticketId}/cancellation-policy`,
        {
          method: 'GET',
          headers: this.getAuthHeaders(),
          cache: 'no-store',
        },
      )

      if (!res.ok && res.status === 404) {
        res = await fetch(
          `${this.baseUrl}/booking/${ticketId}/cancellation-policy`,
          {
            method: 'GET',
            headers: this.getAuthHeaders(),
            cache: 'no-store',
          },
        )
      }

      const resJson = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          statusCode: res.status,
          message: resJson?.message || 'Không thể lấy chính sách hủy vé',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.warn('[TicketService.getCancellationPolicy] Fallback client calculation:', error)
      const cached = offlineTicketCache.getTicket(ticketId)
      const depTime = cached?.departureTime ? new Date(cached.departureTime).getTime() : Date.now() + 25 * 3600 * 1000
      const diffHours = Math.max(0, (depTime - Date.now()) / (1000 * 60 * 60))
      const originalPrice = Number(cached?.price) || 10000

      let cancellationFeePercent = 0
      let exchangeFeePercent = 0
      let canCancel = true
      let canExchange = true
      let reason: string | undefined

      if (diffHours < 2) {
        canCancel = false
        canExchange = false
        reason = 'Chỉ được hủy hoặc đổi vé trước giờ khởi hành tối thiểu 2 tiếng theo quy định'
      } else if (diffHours >= 24) {
        cancellationFeePercent = 0
        exchangeFeePercent = 0
      } else if (diffHours >= 12) {
        cancellationFeePercent = 10
        exchangeFeePercent = 5
      } else {
        cancellationFeePercent = 20
        exchangeFeePercent = 10
      }

      const cancellationFeeAmount = Math.round((originalPrice * cancellationFeePercent) / 100)
      const refundAmount = canCancel ? originalPrice - cancellationFeeAmount : 0
      const exchangeFeeAmount = Math.round((originalPrice * exchangeFeePercent) / 100)

      return {
        success: true,
        data: {
          ticketId,
          ticketCode: cached?.ticketCode || 'TKT-DEMO',
          passengerName: cached?.passengerName || 'Hành khách',
          seatNumber: cached?.seatNumber || '01A',
          departureTime: cached?.departureTime || new Date(depTime).toISOString(),
          ticketStatus: cached?.status || 'PAID',
          canCancel,
          canExchange,
          hoursUntilDeparture: Number(diffHours.toFixed(1)),
          originalPrice,
          cancellationFeePercent,
          cancellationFeeAmount,
          refundAmount,
          exchangeFeePercent,
          exchangeFeeAmount,
          reason,
          policyRules: [
            { condition: 'Trước giờ khởi hành >= 24h', cancellationFeePercent: 0, refundPercent: 100, exchangeFeePercent: 0 },
            { condition: 'Trước giờ khởi hành từ 12h đến 24h', cancellationFeePercent: 10, refundPercent: 90, exchangeFeePercent: 5 },
            { condition: 'Trước giờ khởi hành từ 2h đến 12h', cancellationFeePercent: 20, refundPercent: 80, exchangeFeePercent: 10 },
            { condition: 'Trước giờ khởi hành < 2h hoặc đã chạy', canCancel: false, canExchange: false, refundPercent: 0 },
          ],
        },
      }
    }
  }

  /**
   * Hủy vé, giải phóng ghế lập tức và tự động hoàn tiền (Backend PR #20)
   * POST /api/v1/booking/tickets/:ticketId/cancel
   */
  async cancelTicket(
    ticketId: string,
    reason?: string,
  ): Promise<UnifiedApiResponse<any>> {
    try {
      let response = await fetch(
        `${this.baseUrl}/booking/tickets/${ticketId}/cancel`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ reason: reason || 'Hành khách hủy vé theo quy định' }),
        },
      )

      if (!response.ok && response.status === 404) {
        response = await fetch(
          `${this.baseUrl}/booking/cancel/${ticketId}`,
          {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ reason }),
          },
        )
      }

      const resJson = await response.json().catch(() => null)

      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể hủy vé',
        }
      }

      // Cập nhật trạng thái vé trong local cache
      const cached = offlineTicketCache.getTicket(ticketId)
      if (cached) {
        cached.status = 'CANCELLED'
        offlineTicketCache.saveTicket(cached)
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[TicketService.cancelTicket]', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }
}

export const ticketService = new TicketService()
