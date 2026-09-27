/**
 * Types cho module Đổi vé & Hoàn tiền
 * Domain: exchange-refund
 * Branch: feature/SBTS-exchange-refund-fe
 */

export interface ExchangeTicketPayload {
  newTripId: string
  newSeatId: string
}

export interface ExchangeTicketResult {
  success: boolean
  message: string
  newTicketId?: string
  newSeatNumber?: string
  priceDifference?: number
}

export interface RefundResult {
  success: boolean
  message: string
  refundAmount?: number
  ticketId: string
}

export type ExchangeStep = 'select-trip' | 'select-seat' | 'confirm'
