/**
 * Types cho module Lịch sử vé & Chi tiết vé
 * Domain: booking/my-tickets
 * Branch: feature/SBTS-my-tickets-fe
 */

export type TicketStatus = 'PENDING' | 'PAID' | 'RESERVED' | 'CANCELLED' | 'CHECKED_IN' | 'EXPIRED'

export interface TicketSummary {
  ticketId: string
  ticketCode: string
  bookingCode: string
  passengerName: string
  seatNumber: string
  status: TicketStatus
  price: number
  routeName: string
  departureTime: string
  createdAt: string
  tripId?: string
}

export interface TicketDetail extends TicketSummary {
  passengerPhone: string
  seatType: string
  origin: string
  destination: string
  vehiclePlate: string
  qrDataUrl: string
  qrData?: string
  signature?: string
  busNumber?: string
  routeCode?: string
  checkedInAt: string | null
  cachedAt?: string
}

export interface ResendTicketEmailResult {
  success: boolean
  message: string
  recipientEmail?: string
}

export interface MyTicketsResponse {
  items: TicketSummary[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface CancelTicketResult {
  success: boolean
  message: string
  ticketId: string
  status: TicketStatus
}

export type TicketFilterStatus = 'all' | 'upcoming' | 'past' | 'cancelled'

/**
 * Chuẩn hóa trạng thái vé từ Backend (thường là lowercase như 'cancelled', 'paid', 'reserved')
 * hoặc Frontend (uppercase 'CANCELLED', 'PAID') về enum chuẩn TicketStatus
 */
export function normalizeTicketStatus(rawStatus?: string | null): TicketStatus {
  if (!rawStatus) return 'PENDING'
  const upper = String(rawStatus).toUpperCase().trim()
  if (upper === 'PAID') return 'PAID'
  if (upper === 'CANCELLED' || upper === 'CANCELED') return 'CANCELLED'
  if (upper === 'CHECKED_IN' || upper === 'CHECKEDIN') return 'CHECKED_IN'
  if (upper === 'EXPIRED') return 'EXPIRED'
  if (upper === 'RESERVED') return 'RESERVED'
  return 'PENDING'
}

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  RESERVED: 'Đã đặt chỗ',
  CANCELLED: 'Đã hủy',
  CHECKED_IN: 'Đã check-in',
  EXPIRED: 'Hết hạn',
}

export const TICKET_STATUS_COLOR: Record<TicketStatus, { bg: string; text: string; border: string }> = {
  PENDING: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-300',
  },
  PAID: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
  },
  RESERVED: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
  },
  CANCELLED: {
    bg: 'bg-rose-100',
    text: 'text-rose-800',
    border: 'border-rose-300',
  },
  CHECKED_IN: {
    bg: 'bg-teal-100',
    text: 'text-teal-800',
    border: 'border-teal-300',
  },
  EXPIRED: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
  },
}

/**
 * Lấy nhãn hiển thị trạng thái vé an toàn tuyệt đối (hỗ trợ cả lowercase/uppercase)
 */
export function getTicketStatusLabel(status?: string | null): string {
  const normalized = normalizeTicketStatus(status)
  return TICKET_STATUS_LABEL[normalized] || 'Chờ thanh toán'
}

/**
 * Lấy màu sắc nhãn trạng thái vé an toàn tuyệt đối
 */
export function getTicketStatusColor(status?: string | null): { bg: string; text: string; border: string } {
  const normalized = normalizeTicketStatus(status)
  return TICKET_STATUS_COLOR[normalized] || TICKET_STATUS_COLOR.PENDING
}

