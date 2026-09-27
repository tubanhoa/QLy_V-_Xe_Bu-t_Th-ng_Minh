/**
 * Service gọi API Lịch sử vé & Chi tiết vé
 * Endpoints:
 *   GET  /api/v1/booking/my-tickets          → Danh sách vé
 *   GET  /api/v1/booking/my-tickets/:id      → Chi tiết vé + QR
 *   POST /api/v1/booking/cancel/:ticketId    → Hủy vé
 * Branch: feature/SBTS-my-tickets-fe
 */

import { authService } from './auth.service'
import type {
  CancelTicketResult,
  MyTicketsResponse,
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
   */
  async getMyTickets(
    page = 1,
    limit = 10,
  ): Promise<UnifiedApiResponse<MyTicketsResponse>> {
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
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tải danh sách vé',
        }
      }

      const data: MyTicketsResponse = resJson?.data || resJson
      return { success: true, data }
    } catch (error: any) {
      console.error('[TicketService.getMyTickets]', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /**
   * Lấy chi tiết một vé (bao gồm mã QR base64)
   */
  async getTicketDetail(
    ticketId: string,
  ): Promise<UnifiedApiResponse<TicketDetail>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/booking/my-tickets/${ticketId}`,
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
          message: resJson?.message || 'Không tìm thấy vé',
        }
      }

      const data: TicketDetail = resJson?.data || resJson
      return { success: true, data }
    } catch (error: any) {
      console.error('[TicketService.getTicketDetail]', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /**
   * Hủy vé (chỉ được hủy trước giờ khởi hành ≥ 2 tiếng)
   */
  async cancelTicket(
    ticketId: string,
  ): Promise<UnifiedApiResponse<CancelTicketResult>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/booking/cancel/${ticketId}`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
        },
      )

      const resJson = await response.json().catch(() => null)

      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể hủy vé',
        }
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
