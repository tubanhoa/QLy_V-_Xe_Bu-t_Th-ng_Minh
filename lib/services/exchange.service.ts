/**
 * Service gọi API Đổi vé & Hoàn tiền
 * Endpoints:
 *   POST /api/v1/booking/exchange/:ticketId  → Đổi vé sang chuyến/ghế mới
 *   POST /api/v1/payment/refund/:ticketId    → Yêu cầu hoàn tiền
 * Branch: feature/SBTS-exchange-refund-fe
 */

import { authService } from './auth.service'
import type { ExchangeTicketPayload, ExchangeTicketResult, RefundResult } from '@/lib/types/exchange'
import { UnifiedApiResponse } from '@/lib/types/sprint1'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

class ExchangeService {
  private baseUrl: string

  constructor() {
    this.baseUrl = API_BASE_URL.replace(/\/+$/, '')
  }

  private getAuthHeaders(): HeadersInit {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = authService.getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  }

  /** Đổi vé sang chuyến/ghế mới */
  async exchangeTicket(
    ticketId: string,
    payload: ExchangeTicketPayload,
  ): Promise<UnifiedApiResponse<ExchangeTicketResult>> {
    try {
      const res = await fetch(`${this.baseUrl}/booking/exchange/${ticketId}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) return { success: false, statusCode: res.status, message: json?.message || 'Không thể đổi vé' }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối' }
    }
  }

  /** Yêu cầu hoàn tiền */
  async refundTicket(ticketId: string): Promise<UnifiedApiResponse<RefundResult>> {
    try {
      const res = await fetch(`${this.baseUrl}/payment/refund/${ticketId}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) return { success: false, statusCode: res.status, message: json?.message || 'Không thể yêu cầu hoàn tiền' }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối' }
    }
  }
}

export const exchangeService = new ExchangeService()
