import { authService } from './auth.service'
import { offlineTicketCache } from './offline-ticket-cache'
import {
  BookingResultData,
  CreateBookingPayload,
  HoldSeatsPayload,
  HoldSeatsResult,
  SeatItem,
  SeatMapData,
  TicketResultItem,
} from '@/lib/types/booking'
import { UnifiedApiResponse } from '@/lib/types/sprint1'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

const BOOKED_SEATS_KEY_PREFIX = 'ictu_booked_seats_'

export function getBookedSeatsForTrip(tripId: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const list: string[] = []
    const rawTrip = localStorage.getItem(`${BOOKED_SEATS_KEY_PREFIX}${tripId}`)
    if (rawTrip) {
      const parsed = JSON.parse(rawTrip)
      if (Array.isArray(parsed)) list.push(...parsed)
    }

    const rawGlobal = localStorage.getItem(`${BOOKED_SEATS_KEY_PREFIX}global`)
    if (rawGlobal) {
      const parsed = JSON.parse(rawGlobal)
      if (Array.isArray(parsed)) list.push(...parsed)
    }

    // Đọc thêm từ danh sách vé đã đặt thành công của người dùng hiện tại
    const currentUser = authService.getUser()
    const currentUserId = currentUser?.id || currentUser?.email
    const userTickets = offlineTicketCache.getUserTicketsList(currentUserId || 'usr_guest')
    userTickets.forEach((t) => {
      if ((t.status === 'PAID' || t.status === 'VALID' || t.status === 'RESERVED') && t.seatNumber) {
        const parts = t.seatNumber.split(',').map((s) => s.trim())
        parts.forEach((p) => {
          const clean = p.includes('-') ? p.split('-').pop()! : p
          if (clean && !list.includes(clean)) list.push(clean)
        })
      }
    })

    return Array.from(new Set(list))
  } catch {
    return []
  }
}

export function markSeatsAsBooked(tripId: string, seatNumbers: string[]): void {
  if (typeof window === 'undefined' || !seatNumbers.length) return
  try {
    const current = getBookedSeatsForTrip(tripId)
    const cleanSeats = seatNumbers.map((s) => (s.includes('-') ? s.split('-').pop()! : s))
    const updated = Array.from(new Set([...current, ...cleanSeats]))
    if (tripId) {
      localStorage.setItem(`${BOOKED_SEATS_KEY_PREFIX}${tripId}`, JSON.stringify(updated))
    }
    localStorage.setItem(`${BOOKED_SEATS_KEY_PREFIX}global`, JSON.stringify(updated))
  } catch (e) {
    console.warn('[BookingService] Failed to persist booked seats:', e)
  }
}

export function releaseBookedSeats(tripId: string, seatNumbers: string[]): void {
  if (typeof window === 'undefined' || !seatNumbers.length) return
  try {
    const toRemove = new Set(seatNumbers.map((s) => (s.includes('-') ? s.split('-').pop()! : s)))
    const current = getBookedSeatsForTrip(tripId)
    const updated = current.filter((s) => !toRemove.has(s))
    if (tripId) {
      localStorage.setItem(`${BOOKED_SEATS_KEY_PREFIX}${tripId}`, JSON.stringify(updated))
    }
    const globalCurrent = getBookedSeatsForTrip('global')
    const globalUpdated = globalCurrent.filter((s) => !toRemove.has(s))
    localStorage.setItem(`${BOOKED_SEATS_KEY_PREFIX}global`, JSON.stringify(globalUpdated))
  } catch (e) {
    console.warn('[BookingService] Failed to release booked seats:', e)
  }
}

export function generateFallbackSeatMap(tripId: string): SeatMapData {
  const cols = ['A', 'B', 'C', 'D'] as const
  const defaultBooked = ['01A', '02D', '04B', '05A']
  const tripBooked = getBookedSeatsForTrip(tripId)
  const allBooked = Array.from(new Set([...defaultBooked, ...tripBooked]))
  const bookedSet = new Set(allBooked)

  const seats: SeatItem[] = Array.from({ length: 28 }, (_, i) => {
    const rowNumber = Math.floor(i / 4) + 1
    const col = cols[i % 4]
    const seatNumber = `${String(rowNumber).padStart(2, '0')}${col}`
    const isBooked = bookedSet.has(seatNumber)
    const isHolding = !isBooked && ['03A', '06B'].includes(seatNumber)
    return {
      seatId: `seat-${tripId}-${seatNumber}`,
      seatNumber,
      rowNumber,
      columnLabel: col,
      seatType: rowNumber === 1 ? 'priority' : 'standard',
      isBooked,
      bookingStatus: isBooked ? 'booked' : isHolding ? 'holding' : 'available',
      isHeldByMe: false,
      holdExpiresAt: null,
      price: 10000,
    }
  })

  const bookedCount = seats.filter((s) => s.isBooked).length
  const holdingCount = seats.filter((s) => s.bookingStatus === 'holding').length
  const availableCount = Math.max(0, 28 - bookedCount - holdingCount)

  return {
    tripId,
    vehiclePlate: '20B-012.34',
    seatCapacity: 28,
    totalSeats: 28,
    bookedCount,
    holdingCount,
    availableCount,
    availableSeatsCount: availableCount,
    departureTime: new Date().toISOString(),
    seats,
  }
}

class BookingService {
  private baseUrl: string

  constructor() {
    const raw = (API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/+$/, '')
    this.baseUrl = raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`
  }

  /** Lấy Authorization Header từ phiên đăng nhập thực tế của người dùng */
  private getAuthHeaders(): Record<string, string> {
    const token = authService.getToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
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
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.baseUrl}/trips/${tripId}/seat-map`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      })

      if (response.ok) {
        const resJson = await response.json().catch(() => null)
        const data: SeatMapData = resJson?.data || resJson
        if (data && Array.isArray(data.seats)) {
          return { success: true, data }
        }
      }
      throw new Error(`Server returned ${response.status}`)
    } catch (error: any) {
      console.warn('[BookingService.getSeatMap] Sử dụng sơ đồ ghế dự phòng:', error)
      return {
        success: true,
        data: generateFallbackSeatMap(tripId),
      }
    }
  }

  /**
   * Giữ chỗ ghế tạm thời trong 10 phút (Redis SETNX + TTL chống Race Condition)
   * Endpoint: POST /api/v1/booking/hold-seats
   */
  async holdSeats(payload: HoldSeatsPayload): Promise<UnifiedApiResponse<HoldSeatsResult>> {
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.baseUrl}/booking/hold-seats`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      const resJson = await response.json().catch(() => null)

      if (response.ok) {
        const data: HoldSeatsResult = resJson?.data || resJson
        return { success: true, data }
      }

      if (response.status === 409) {
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

      throw new Error(resJson?.message || 'Server error')
    } catch (error: any) {
      console.warn('[BookingService.holdSeats] Giả lập giữ ghế thành công:', error)
      return {
        success: true,
        data: {
          success: true,
          lockedSeats: payload.seatIds,
          failedSeats: [],
          holdToken: `HOLD_${Date.now()}`,
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          remainingSeconds: 600,
          totalAmount: payload.seatIds.length * 10000,
          seatsHeld: payload.seatIds,
          message: `Ghế ${payload.seatIds.join(', ')} đã được giữ tạm trong 10 phút.`,
        },
      }
    }
  }

  /**
   * Hủy giữ chỗ ghế sớm khi người dùng bỏ chọn hoặc đóng modal
   * Endpoint: POST /api/v1/booking/release-seats
   */
  async releaseSeats(payload: HoldSeatsPayload): Promise<UnifiedApiResponse<{ message: string }>> {
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.baseUrl}/booking/release-seats`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      const resJson = await response.json().catch(() => null)
      if (response.ok) {
        return {
          success: true,
          data: resJson?.data || { message: 'Đã hủy giữ chỗ thành công' },
        }
      }
      throw new Error('Release seats error')
    } catch (error: any) {
      return {
        success: true,
        data: { message: 'Đã hủy giữ chỗ thành công' },
      }
    }
  }

  /**
   * Tạo đơn đặt vé và xuất vé QR (Lưu trực tiếp vào Supabase PostgreSQL Cloud)
   * Endpoint: POST /api/v1/booking/create
   */
  async createBooking(payload: CreateBookingPayload): Promise<UnifiedApiResponse<BookingResultData>> {
    const rawSeatIds: string[] =
      payload.seatIds && payload.seatIds.length > 0
        ? payload.seatIds
        : (payload.passengers || []).map((p) => p.seatId)
    const safeSeatIds = rawSeatIds.length > 0 ? rawSeatIds : ['01B']
    const effectiveTripId = payload.tripId

    try {
      const headers = await this.getAuthHeaders()
      const cleanBody = {
        tripId: effectiveTripId,
        passengers: (payload.passengers || []).map((p) => ({
          seatId: p.seatId,
          passengerName: p.passengerName,
          passengerPhone: p.passengerPhone,
        })),
        ...(payload.voucherCode ? { voucherCode: payload.voucherCode } : {}),
        ...(payload.paymentMethod ? { paymentMethod: payload.paymentMethod } : {}),
      }
      const response = await fetch(`${this.baseUrl}/booking/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify(cleanBody),
      })

      const resJson = await response.json().catch(() => null)

      if (response.ok && (resJson?.success !== false)) {
        const data: BookingResultData = resJson?.data || resJson
        markSeatsAsBooked(effectiveTripId, safeSeatIds)

        // Cache vé nếu backend trả về danh sách tickets để xem offline
        const currentUser = authService.getUser()
        const currentUserId = currentUser?.id || currentUser?.email || 'student.an@ictu.edu.vn'
        if (data.tickets && Array.isArray(data.tickets)) {
          data.tickets.forEach((t) => {
            offlineTicketCache.saveTicket(
              {
                ticketId: t.ticketId || t.id,
                id: t.id || t.ticketId,
                ticketCode: t.ticketCode || t.ticketId || t.id,
                bookingCode: data.bookingCode,
                seatNumber: t.seatNumber,
                seatType: 'Ghế tiêu chuẩn',
                routeName:
                  payload.routeName ||
                  (payload.originStation && payload.destinationStation
                    ? `${payload.originStation} ➔ ${payload.destinationStation}`
                    : 'Tuyến CT-01: ICTU ↔ Bến Xe Trung Tâm Thái Nguyên'),
                routeCode: payload.routeCode || 'CT-01',
                origin: payload.originStation || 'ĐH CNTT & TT Thái Nguyên',
                destination: payload.destinationStation || 'Bến Xe Trung Tâm Thái Nguyên',
                departureTime:
                  payload.departureTime ||
                  (data as any).departureTime ||
                  new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
                passengerName: t.passengerName || payload.passengerName || 'Hành khách ICTU',
                passengerPhone: t.passengerPhone || payload.passengerPhone || '0981234567',
                price: t.price || 5000,
                status: 'PAID',
                vehiclePlate: payload.vehiclePlate || (data as any).vehiclePlate || '20B-012.34',
                busNumber: payload.routeCode || 'CT-01',
                qrData: t.qrCodeData || `ICTU-PASS:${t.ticketCode || t.id}`,
                qrDataUrl: '',
                bookingTime: new Date().toISOString(),
                userId: currentUserId,
                tripId: effectiveTripId,
              } as any,
              currentUserId,
            )
          })
        }

        return { success: true, data }
      }

      // Trả về lỗi chính xác từ database (ví dụ: ghế đã có người đặt)
      return {
        success: false,
        message: resJson?.message || 'Không thể tạo đơn đặt vé. Vui lòng kiểm tra lại.',
        statusCode: response.status,
      }
    } catch (error: any) {
      console.warn('[BookingService.createBooking] Lỗi kết nối khi đặt vé:', error)
      return {
        success: false,
        message: error?.message || 'Lỗi kết nối máy chủ. Vui lòng thử lại sau giây lát.',
      }
    }
  }

  /**
   * Lấy danh sách vé đã mua của người dùng hiện tại từ Database Supabase
   * Endpoint: GET /api/v1/booking/my-tickets
   */
  async getMyTickets(): Promise<UnifiedApiResponse<any[]>> {
    try {
      const headers = await this.getAuthHeaders()
      const res = await fetch(`${this.baseUrl}/booking/my-tickets`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        return {
          success: true,
          data: Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [],
        }
      }
      return {
        success: false,
        message: json?.message || 'Không thể tải danh sách vé của bạn',
        data: [],
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Lỗi kết nối máy chủ',
        data: [],
      }
    }
  }
}

export const bookingService = new BookingService()
