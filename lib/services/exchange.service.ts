/**
 * Service gọi API Đổi vé 3 bước, Tìm chuyến mới & Tạm giữ chỗ 10 phút
 * Endpoints:
 *   GET  /api/v1/booking/tickets/:ticketId/exchange-trips?date=...   → Tìm kiếm chuyến mới cùng tuyến
 *   POST /api/v1/booking/tickets/:ticketId/hold-exchange-seat        → Tạm giữ chỗ 10 phút (bảo toàn ghế cũ)
 *   POST /api/v1/booking/tickets/:ticketId/confirm-exchange         → Xác nhận đổi chuyến, tính chênh lệch & cấp mã QR mới
 *   POST /api/v1/payment/refund/:ticketId                            → Yêu cầu hoàn tiền
 * Tương thích Backend PR #20 (feature/SBTS-ticket-cancellation-and-exchange)
 */

import { authService } from './auth.service'
import { offlineTicketCache } from './offline-ticket-cache'
import type {
  ConfirmExchangePayload,
  ConfirmExchangeResult,
  ExchangeTicketPayload,
  ExchangeTicketResult,
  ExchangeTripsResponse,
  HoldExchangeSeatResult,
  RefundResult,
} from '@/lib/types/exchange'
import { UnifiedApiResponse } from '@/lib/types/sprint1'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

class ExchangeService {
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
   * 1. Tìm kiếm chuyến xe thay thế cho luồng đổi vé
   * GET /api/v1/booking/tickets/:ticketId/exchange-trips?date=...
   */
  async getExchangeTrips(
    ticketId: string,
    date?: string,
  ): Promise<UnifiedApiResponse<ExchangeTripsResponse>> {
    try {
      const url = new URL(`${this.baseUrl}/booking/tickets/${ticketId}/exchange-trips`)
      if (date) {
        url.searchParams.set('date', date)
      }

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          statusCode: res.status,
          message: json?.message || 'Không thể tìm kiếm chuyến đổi',
        }
      }

      return { success: true, data: json?.data || json }
    } catch (e: any) {
      console.warn('[ExchangeService.getExchangeTrips] Fallback demo:', e)
      // Fallback demo chuyến đổi nếu backend chưa sẵn sàng
      const today = date || new Date().toISOString().split('T')[0]
      return {
        success: true,
        data: {
          currentTicket: {
            ticketId,
            ticketCode: 'TKT-ICTU-DEMO',
            seatNumber: '01A',
            currentDepartureTime: `${today}T07:00:00.000Z`,
            originalPrice: 10000,
          },
          availableTrips: [
            {
              tripId: 'trip-ictu-ex-01',
              routeCode: 'CT-01',
              routeName: 'ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên',
              origin: 'ĐH CNTT & TT (ICTU)',
              destination: 'Bến Xe Trung Tâm Thái Nguyên',
              departureTime: `${today}T08:30:00.000Z`,
              vehiclePlate: '20B-012.88',
              availableSeats: 18,
              tripPrice: 10000,
              exchangeFee: 500,
              estimatedDifference: 500,
            },
            {
              tripId: 'trip-ictu-ex-02',
              routeCode: 'CT-01',
              routeName: 'ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên',
              origin: 'ĐH CNTT & TT (ICTU)',
              destination: 'Bến Xe Trung Tâm Thái Nguyên',
              departureTime: `${today}T10:00:00.000Z`,
              vehiclePlate: '20B-015.66',
              availableSeats: 22,
              tripPrice: 10000,
              exchangeFee: 500,
              estimatedDifference: 500,
            },
            {
              tripId: 'trip-ictu-ex-03',
              routeCode: 'CT-01',
              routeName: 'ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên',
              origin: 'ĐH CNTT & TT (ICTU)',
              destination: 'Bến Xe Trung Tâm Thái Nguyên',
              departureTime: `${today}T13:30:00.000Z`,
              vehiclePlate: '20B-019.22',
              availableSeats: 15,
              tripPrice: 10000,
              exchangeFee: 500,
              estimatedDifference: 500,
            },
          ],
        },
      }
    }
  }

  /**
   * 2. Tạm giữ chỗ 10 phút trên chuyến mới (bảo toàn ghế cũ)
   * POST /api/v1/booking/tickets/:ticketId/hold-exchange-seat
   */
  async holdExchangeSeat(
    ticketId: string,
    newTripId: string,
    newSeatId: string,
  ): Promise<UnifiedApiResponse<HoldExchangeSeatResult>> {
    try {
      const res = await fetch(
        `${this.baseUrl}/booking/tickets/${ticketId}/hold-exchange-seat`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ newTripId, newSeatId }),
        },
      )

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          statusCode: res.status,
          message: json?.message || 'Không thể tạm giữ ghế trên chuyến mới',
        }
      }

      return { success: true, data: json?.data || json }
    } catch (e: any) {
      console.warn('[ExchangeService.holdExchangeSeat] Fallback demo:', e)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      return {
        success: true,
        data: {
          success: true,
          message:
            'Đã tạm giữ chỗ trên chuyến mới thành công trong 10 phút. Ghế cũ của bạn vẫn được bảo toàn.',
          ticketId,
          newTripId,
          newSeatId,
          newSeatNumber: '02B',
          holdExpiresAt: expiresAt,
        },
      }
    }
  }

  /**
   * 3. Xác nhận đổi chuyến, tính chênh lệch & cấp mã QR mới
   * POST /api/v1/booking/tickets/:ticketId/confirm-exchange
   */
  async confirmExchange(
    ticketId: string,
    payload: ConfirmExchangePayload,
  ): Promise<UnifiedApiResponse<ConfirmExchangeResult>> {
    try {
      // Gọi endpoint chuẩn PR #20, fallback sang alias cũ nếu backend cũ
      let res = await fetch(
        `${this.baseUrl}/booking/tickets/${ticketId}/confirm-exchange`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(payload),
        },
      )

      if (!res.ok && res.status === 404) {
        res = await fetch(`${this.baseUrl}/booking/exchange/${ticketId}`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(payload),
        })
      }

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          statusCode: res.status,
          message: json?.message || 'Không thể đổi vé sang chuyến mới',
        }
      }

      return { success: true, data: json?.data || json }
    } catch (e: any) {
      console.warn('[ExchangeService.confirmExchange] Fallback demo:', e)
      const currentUser = authService.getUser()
      const oldTicket = offlineTicketCache.getTicket(ticketId)
      const newTicketId = `tkt_ex_${Date.now()}`
      const newTicketCode = `TK-EX-${payload.newSeatId || '02B'}-${Date.now().toString().slice(-4)}`
      const newDepartureTime =
        payload.newDepartureTime || new Date(Date.now() + 3600 * 1000 * 2).toISOString()

      // Đánh dấu vé cũ đã hủy / chuyển đổi
      if (oldTicket) {
        offlineTicketCache.updateTicketStatus(ticketId, 'CANCELLED', currentUser?.id)
      }

      // Tạo vé mới cho chuyến vừa đổi sang
      offlineTicketCache.saveTicket({
        ticketId: newTicketId,
        ticketCode: newTicketCode,
        seatNumber: payload.newSeatId || '02B',
        seatType: 'Ghế tiêu chuẩn',
        routeName: oldTicket?.routeName || 'Tuyến CT-01: ICTU ↔ Bến Xe TP',
        routeCode: oldTicket?.routeCode || 'CT-01',
        origin: oldTicket?.origin || 'ĐH CNTT & TT (ICTU)',
        destination: oldTicket?.destination || 'Bến Xe Trung Tâm Thái Nguyên',
        departureTime: newDepartureTime,
        passengerName: oldTicket?.passengerName || currentUser?.fullName || 'Hành khách',
        passengerPhone: oldTicket?.passengerPhone || currentUser?.phoneNumber || '0981234567',
        price: oldTicket?.price || 10000,
        status: 'PAID',
        qrData: `ICTU-PASS:${newTicketCode}`,
        qrDataUrl: '',
        vehiclePlate: payload.vehiclePlate || oldTicket?.vehiclePlate || '20B-015.66',
        createdAt: new Date().toISOString(),
        userId: currentUser?.id,
      } as any, currentUser?.id)

      return {
        success: true,
        data: {
          success: true,
          message: 'Đổi vé sang chuyến mới thành công!',
          ticketId: newTicketId,
          ticketCode: newTicketCode,
          oldSeatNumber: oldTicket?.seatNumber || '01A',
          newTripId: payload.newTripId,
          newSeatNumber: payload.newSeatId || '02B',
          newDepartureTime,
          exchangeFee: 500,
          priceDifference: 500,
        },
      }
    }
  }

  /**
   * Alias tương thích ngược cho exchangeTicket
   */
  async exchangeTicket(
    ticketId: string,
    payload: ExchangeTicketPayload,
  ): Promise<UnifiedApiResponse<ExchangeTicketResult>> {
    const res = await this.confirmExchange(ticketId, payload)
    if (res.success && res.data) {
      return {
        success: true,
        data: {
          success: true,
          message: res.data.message,
          newTicketId: res.data.ticketId,
          newSeatNumber: res.data.newSeatNumber,
          priceDifference: res.data.priceDifference,
          qrDataUrl: res.data.qrDataUrl,
        },
      }
    }
    return {
      success: false,
      statusCode: res.statusCode,
      message: res.message || 'Không thể đổi vé',
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
      if (!res.ok) {
        return {
          success: false,
          statusCode: res.status,
          message: json?.message || 'Không thể yêu cầu hoàn tiền',
        }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối' }
    }
  }
}

export const exchangeService = new ExchangeService()
