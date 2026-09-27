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
  lockedSeatNumbers?: string[]
  failedSeats: string[]
  expiresAt?: string | number
  startTime?: string
  remainingSeconds?: number
  holdToken?: string
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
  pickupStationId?: string
  dropoffStationId?: string
  holdToken?: string
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
  status?: string
  expiresAt?: string | Date
  tickets: TicketResultItem[]
}

export interface CreatePaymentUrlPayload {
  bookingId: string
  paymentMethod?: 'VNPAY' | 'CASH' | 'VIETQR' | 'WALLET' | string
  bankCode?: string
  orderInfo?: string
  ipAddress?: string
}

export interface CreatePaymentUrlResult {
  paymentId: string
  paymentMethod: string
  paymentUrl: string
  amount: number
  txnRef: string
}

export interface CancelPaymentResult {
  success: boolean
  message: string
  bookingId: string
}

