/**
 * Types cho module Lịch sử vé & Chi tiết vé
 * Domain: booking/my-tickets
 * Branch: feature/SBTS-my-tickets-fe
 */

export type TicketStatus =
  | 'PENDING'
  | 'PAID'
  | 'VALID'
  | 'RESERVED'
  | 'CANCELLED'
  | 'CHECKED_IN'
  | 'EXPIRED'
  | 'REFUNDED'

export interface RefundInfo {
  refundAmount: number
  originalPrice: number
  cancellationFee: number
  feePercent: number
  refundMethod: 'vnpay' | 'momo' | 'zalopay' | 'bank_transfer' | 'cash' | string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  refundTransactionId?: string
  refundTime?: string | Date
  failureReason?: string
  autoRefundReason?: string
  gatewayResponseCode?: string
  estimatedArrival?: string
}

export interface TicketSummary {
  ticketId: string
  ticketCode: string
  bookingCode?: string
  passengerName: string
  seatNumber: string
  status: TicketStatus
  price: number
  routeName: string
  departureTime: string
  createdAt?: string
  tripId?: string
  origin?: string
  destination?: string
  vehiclePlate?: string
  routeCode?: string
  busNumber?: string
  checkedInAt?: string | null
  refundInfo?: RefundInfo
  tripStatus?: 'scheduled' | 'in_progress' | 'delayed' | 'completed' | 'cancelled' | string
  delayMinutes?: number
  incidentDescription?: string
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
  refundInfo?: RefundInfo
}

export type TicketFilterStatus = 'all' | 'upcoming' | 'past' | 'cancelled' | 'refunded'

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  VALID: 'Vé hợp lệ',
  RESERVED: 'Đã đặt chỗ',
  CANCELLED: 'Đã hủy',
  CHECKED_IN: 'Đã check-in',
  EXPIRED: 'Hết hạn',
  REFUNDED: 'Đã hoàn tiền',
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
  VALID: {
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
  REFUNDED: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-300',
  },
}
