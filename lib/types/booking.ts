export type SeatStatus = 'available' | 'holding' | 'booked'

export interface SeatItem {
  seatId: string
  seatNumber: string
  rowNumber: number
  columnLabel: 'A' | 'B' | 'C' | 'D'
  seatType?: string
  isBooked: boolean
  bookingStatus: SeatStatus
  isHeldByMe: boolean
  holdExpiresAt: string | null
}

export interface SeatMapData {
  tripId: string
  routeName?: string
  departureTime?: string
  vehiclePlate?: string
  totalSeats: number
  bookedCount: number
  holdingCount: number
  availableCount: number
  seats: SeatItem[]
}

export interface HoldSeatsPayload {
  tripId: string
  seatIds: string[]
}

export interface HoldSeatsResult {
  success: boolean
  lockedSeats: string[]
  failedSeats: string[]
  expiresAt?: string | number
  message?: string
}

export interface PassengerInfoPayload {
  seatId: string
  passengerName: string
  passengerPhone?: string
}

export interface CreateBookingPayload {
  tripId: string
  passengers: PassengerInfoPayload[]
  voucherCode?: string
  paymentMethod?: string
}

export interface TicketResultItem {
  id: string
  ticketCode: string
  seatNumber: string
  passengerName: string
  passengerPhone?: string
  price: number
  status: string
  qrCodeData?: string
}

export interface BookingResultData {
  id: string
  bookingCode: string
  totalAmount: number
  discountAmount: number
  finalAmount: number
  paymentStatus: string
  tickets: TicketResultItem[]
}
