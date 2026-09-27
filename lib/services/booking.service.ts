import { authService } from './auth.service'
import {
  BookingResultData,
  CancelPaymentResult,
  CreateBookingPayload,
  CreatePaymentUrlPayload,
  CreatePaymentUrlResult,
  HoldSeatsPayload,
  HoldSeatsResult,
  SeatMapData,
} from '@/lib/types/booking'
import { UnifiedApiResponse } from '@/lib/types/sprint1'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

class BookingService {
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
   * Lấy sơ đồ ghế và tình trạng đặt chỗ realtime của chuyến
   * Endpoint: GET /api/v1/trips/:id/seat-map
   * Kèm JWT token nếu đã đăng nhập để backend đánh dấu `isHeldByMe`
   */
  async getSeatMap(tripId: string): Promise<UnifiedApiResponse<SeatMapData>> {
    try {
      const response = await fetch(`${this.baseUrl}/trips/${tripId}/seat-map`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })

      const resJson = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(resJson?.message || `Lỗi tải sơ đồ ghế (${response.status})`)
      }

      const data: SeatMapData = resJson?.data || resJson
      return {
        success: true,
        data,
      }
    } catch (error: any) {
      console.error('[BookingService.getSeatMap] Lỗi:', error)
      return {
        success: false,
        message: error?.message || 'Không thể tải sơ đồ ghế từ máy chủ',
      }
    }
  }

  /**
   * Giữ chỗ ghế tạm thời trong 10 phút (Redis SETNX + TTL chống Race Condition)
   * Endpoint: POST /api/v1/booking/hold-seats
   */
  async holdSeats(payload: HoldSeatsPayload): Promise<UnifiedApiResponse<HoldSeatsResult>> {
    try {
      const response = await fetch(`${this.baseUrl}/booking/hold-seats`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      const resJson = await response.json().catch(() => null)

      if (!response.ok) {
        // Xử lý 409 Conflict (ghế đã có người giữ)
        const failedSeats = resJson?.failedSeats || []
        const message = resJson?.message || 'Ghế đã được giữ bởi người khác'
        return {
          success: false,
          statusCode: response.status,
          message,
          data: {
            success: false,
            lockedSeats: [],
            failedSeats,
            message,
          },
        }
      }

      const data: HoldSeatsResult = resJson?.data || resJson
      return {
        success: true,
        data,
      }
    } catch (error: any) {
      console.error('[BookingService.holdSeats] Lỗi:', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối khi gửi yêu cầu giữ ghế',
      }
    }
  }

  /**
   * Hủy giữ chỗ ghế sớm khi người dùng bỏ chọn hoặc đóng modal
   * Endpoint: POST /api/v1/booking/release-seats
   */
  async releaseSeats(payload: HoldSeatsPayload): Promise<UnifiedApiResponse<{ message: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/booking/release-seats`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          message: resJson?.message || 'Không thể hủy giữ chỗ',
        }
      }

      return {
        success: true,
        data: resJson?.data || { message: 'Đã hủy giữ chỗ thành công' },
      }
    } catch (error: any) {
      console.error('[BookingService.releaseSeats] Lỗi:', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối',
      }
    }
  }

  /**
   * Tạo đơn đặt vé và xuất vé QR (Bypass lock an toàn nếu là người giữ ghế)
   * Endpoint: POST /api/v1/booking/create
   */
  async createBooking(payload: CreateBookingPayload): Promise<UnifiedApiResponse<BookingResultData>> {
    try {
      const response = await fetch(`${this.baseUrl}/booking/create`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      const resJson = await response.json().catch(() => null)

      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tạo vé đặt',
        }
      }

      const data: BookingResultData = resJson?.data || resJson
      return {
        success: true,
        data,
      }
    } catch (error: any) {
      console.error('[BookingService.createBooking] Lỗi:', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối khi đặt vé',
      }
    }
  }

  /**
   * Tạo URL thanh toán VNPay / VietQR cho đơn đặt vé
   * Endpoint: POST /api/v1/payment/create-url
   */
  async createPaymentUrl(
    payload: CreatePaymentUrlPayload,
  ): Promise<UnifiedApiResponse<CreatePaymentUrlResult>> {
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
          message: resJson?.message || 'Không thể tạo cổng thanh toán',
        }
      }

      const data: CreatePaymentUrlResult = resJson?.data || resJson
      return {
        success: true,
        data,
      }
    } catch (error: any) {
      console.error('[BookingService.createPaymentUrl] Lỗi:', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối khi tạo thanh toán',
      }
    }
  }

  /**
   * Hủy thanh toán đơn đặt vé và giải phóng ghế lập tức
   * Endpoint: POST /api/v1/payment/cancel/:bookingId
   */
  async cancelPayment(
    bookingId: string,
  ): Promise<UnifiedApiResponse<CancelPaymentResult>> {
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
          message: resJson?.message || 'Không thể hủy thanh toán',
        }
      }

      const data: CancelPaymentResult = resJson?.data || resJson
      return {
        success: true,
        data,
      }
    } catch (error: any) {
      console.error('[BookingService.cancelPayment] Lỗi:', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối khi hủy thanh toán',
      }
    }
  }

  /**
   * Hủy đơn đặt vé khi chưa thanh toán (tùy chọn thay thế qua module booking)
   * Endpoint: POST /api/v1/booking/cancel-booking/:bookingId
   */
  async cancelBooking(
    bookingId: string,
  ): Promise<UnifiedApiResponse<{ message: string; bookingId: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/booking/cancel-booking/${bookingId}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể hủy đơn đặt vé',
        }
      }

      return {
        success: true,
        data: resJson?.data || resJson,
      }
    } catch (error: any) {
      console.error('[BookingService.cancelBooking] Lỗi:', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối khi hủy đơn vé',
      }
    }
  }
}

export const bookingService = new BookingService()
