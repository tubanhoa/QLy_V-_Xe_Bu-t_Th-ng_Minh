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
  seatCapacity?: number
  totalSeats: number
  bookedCount?: number
  holdingCount?: number
  availableCount?: number
  availableSeatsCount?: number
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
  holdToken?: string
  expiresAt?: string | number
  remainingSeconds?: number
  totalAmount?: number
  seatsHeld?: string[]
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
  seatIds?: string[]
  voucherCode?: string
  paymentMethod?: string
  totalAmount?: number
  originStation?: string
  destinationStation?: string
  passengerName?: string
  passengerPhone?: string
  departureTime?: string
  routeCode?: string
  routeName?: string
  vehiclePlate?: string
}

export interface TicketResultItem {
  id: string
  ticketId?: string
  ticketCode: string
  seatNumber: string
  passengerName: string
  passengerPhone?: string
  price: number
  status: string
  qrCodeData?: string
  qrDataUrl?: string
}

export interface BookingResultData {
  id: string
  bookingId?: string
  bookingCode: string
  totalAmount: number
  discountAmount?: number
  finalAmount?: number
  paymentStatus: string
  tickets: TicketResultItem[]
  ticketId?: string
  ticketCode?: string
  qrCodeUrl?: string
  qrDataUrl?: string
  message?: string
}
