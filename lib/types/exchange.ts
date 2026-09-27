/**
 * Types cho module Đổi vé, Hủy vé & Hoàn tiền tự động
 * Tương thích 100% với Backend PR #20 (feature/SBTS-ticket-cancellation-and-exchange)
 * Branch: feature/SBTS-ticket-cancellation-and-exchange-fe
 */

export interface CancellationPolicyRule {
  condition: string
  cancellationFeePercent?: number
  refundPercent?: number
  exchangeFeePercent?: number
  canCancel?: boolean
  canExchange?: boolean
}

export interface CancellationPolicyResponse {
  ticketId: string
  ticketCode: string
  passengerName: string
  seatNumber: string
  departureTime: string
  ticketStatus: string
  canCancel: boolean
  canExchange: boolean
  hoursUntilDeparture: number
  originalPrice: number
  cancellationFeePercent: number
  cancellationFeeAmount: number
  refundAmount: number
  exchangeFeePercent: number
  exchangeFeeAmount: number
  reason?: string
  policyRules: CancellationPolicyRule[]
}

export interface ExchangeTripItem {
  tripId: string
  routeCode?: string
  routeName?: string
  origin?: string
  destination?: string
  departureTime: string
  vehiclePlate?: string
  availableSeats: number
  tripPrice: number
  exchangeFee: number
  estimatedDifference: number
}

export interface ExchangeTripsResponse {
  currentTicket: {
    ticketId: string
    ticketCode: string
    seatNumber?: string
    currentDepartureTime: string
    originalPrice: number
  }
  availableTrips: ExchangeTripItem[]
}

export interface HoldExchangeSeatPayload {
  newTripId: string
  newSeatId: string
}

export interface HoldExchangeSeatResult {
  success: boolean
  message: string
  ticketId?: string
  ticketCode?: string
  newTripId?: string
  newSeatId?: string
  newSeatNumber?: string
  holdExpiresAt?: string
}

export interface ConfirmExchangePayload {
  newTripId: string
  newSeatId: string
  paymentMethod?: string
}

export interface ConfirmExchangeResult {
  success: boolean
  message: string
  ticketId?: string
  ticketCode?: string
  oldSeatNumber?: string
  newTripId?: string
  newSeatNumber?: string
  newDepartureTime?: string
  exchangeFee?: number
  priceDifference?: number
  qrData?: string
  qrDataUrl?: string
}

export interface CancelTicketPayload {
  reason?: string
  bankAccountNumber?: string
  bankName?: string
  accountHolderName?: string
}

export interface CancelTicketResponse {
  success: boolean
  message: string
  ticketId: string
  ticketCode: string
  status: string
  originalPrice: number
  cancellationFee: number
  refundAmount: number
  refundProcessed: boolean
  seatReleased: boolean
}

// Giữ lại các alias cũ để tương thích ngược code cũ
export type ExchangeTicketPayload = ConfirmExchangePayload
export interface ExchangeTicketResult {
  success: boolean
  message: string
  newTicketId?: string
  newSeatNumber?: string
  priceDifference?: number
  qrDataUrl?: string
}

export interface RefundResult {
  success: boolean
  message: string
  refundAmount?: number
  ticketId: string
}

export type ExchangeStep = 'select-trip' | 'select-seat' | 'confirm'
