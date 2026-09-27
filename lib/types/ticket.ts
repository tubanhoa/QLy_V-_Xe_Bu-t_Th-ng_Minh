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
}

export interface TicketDetail extends TicketSummary {
  passengerPhone: string
  seatType: string
  origin: string
  destination: string
  vehiclePlate: string
  qrDataUrl: string
  checkedInAt: string | null
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
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  PAID: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  RESERVED: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  CANCELLED: {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
  CHECKED_IN: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-400',
    border: 'border-violet-500/30',
  },
  EXPIRED: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
  },
}
