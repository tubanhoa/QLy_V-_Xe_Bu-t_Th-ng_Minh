/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * Data Contracts & API Interfaces for Sprint 1
 * Phân hệ Frontend bàn giao cho Backend Team (Trí, Vinh, Việt)
 */

// 1. Phân hệ Xác thực & Đăng ký tài khoản (Auth & Register)
export type UserType = 'student' | 'passenger' | 'staff'

export interface RegisterPayload {
  userType: UserType
  fullName: string
  email: string
  phoneNumber: string
  password: string
  studentId?: string // Bắt buộc nếu userType === 'student'
  faculty?: string   // Khoa (nếu là sinh viên ICTU)
  className?: string // Lớp sinh hoạt
  idCardNumber?: string // CCCD / CMND
  studentCardImageUrl?: string // Ảnh thẻ SV để duyệt giảm 50%
}

export interface RegisterResponse {
  success: boolean
  message: string
  userId?: string
  data?: {
    id: string
    fullName: string
    email: string
    phoneNumber: string
    userType: UserType
    studentId?: string
    discountApproved: boolean
    createdAt: string
  }
  error?: string
}

// 2. User Story 1: Tra cứu tuyến xe (Route & Trip Lookup)
export interface Station {
  id: string
  name: string
  address?: string
  latitude?: string | number
  longitude?: string | number
  isHub?: boolean
  status?: string
  order?: number // Tương thích ngược
}

export interface RouteStationItem {
  id: string
  routeId: string
  stationId: string
  stopOrder: number
  distanceFromOriginKm?: string | number
  estimatedMinutes?: number
  distanceFromStartKm?: number
  durationFromStartMinutes?: number
  station: Station
}

export interface BusRoute {
  id: string
  routeCode: string // VD: CT-01, CT-02
  name: string // Tuyến KTX ICTU - Bến xe Thái Nguyên
  origin: string
  destination: string
  distanceKm: number | string
  basePrice: number | string
  studentPrice: number | string // Trợ giá 50%
  operatingStart: string // '05:30:00'
  operatingEnd: string   // '21:00:00'
  frequencyMinutes: number
  status: string
  routeStations?: RouteStationItem[]
  
  // Các trường alias hỗ trợ tương thích ngược Frontend cũ
  code?: string
  fareStandard?: number
  fareStudent?: number
  stations?: Station[]
  durationMinutes?: number
  operatingHours?: {
    start: string
    end: string
    frequencyMinutes: number
  }
}

// 2.1. Kết quả tìm kiếm chuyến xe theo hợp đồng API chốt (GET /api/v1/booking/search)
export interface TripSearchResult {
  id: string
  routeId: string
  routeName: string
  routeCode: string
  origin: string
  destination: string
  departureTime: string // ISO date string: 2026-09-27T07:00:00.000Z
  arrivalTime: string   // ISO date string: 2026-09-27T07:45:00.000Z
  status: 'scheduled' | 'running' | 'completed' | 'cancelled' | string
  basePrice: number
  studentPrice: number
  totalSeats: number
  availableSeats: number
  vehiclePlate: string
  vehicleType?: string
  createdAt?: string
  isAdhoc?: boolean
  isNew?: boolean
  isBookable?: boolean
}

export interface SearchTripsQuery {
  origin?: string
  destination?: string
  date?: string // YYYY-MM-DD
}

export interface UnifiedApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  errorCode?: string
  statusCode?: number
  retryAfterSeconds?: number
}

// 3. User Story 2: Chọn vị trí ghế (Seat Layout & Realtime Status)
export type SeatStatus = 'available' | 'occupied' | 'holding' | 'priority'

export interface BusSeat {
  id: string
  seatNumber: string // VD: '01A', '02B'
  row: number
  column: 'A' | 'B' | 'C' | 'D'
  status: SeatStatus
  isPriority: boolean // Dành cho người khuyết tật, thai phụ, người già
  price: number
}

export interface BusTripLayout {
  tripId: string
  routeCode: string
  busPlate: string
  busModel: string // VD: Smart EV Bus 28 chỗ
  totalSeats: number
  availableSeatsCount: number
  departureTime: string
  seats: BusSeat[]
}

// 4. User Story 3: Giữ chỗ tạm thời (Temporary Seat Hold - 10 phút)
export interface HoldSeatRequest {
  tripId: string
  seatIds: string[]
  passengerInfo: {
    fullName: string
    phoneNumber: string
    email?: string
    studentId?: string
  }
}

export interface HoldSeatResponse {
  success: boolean
  holdToken: string
  expiresAt: string // ISO timestamp (+10 phút)
  remainingSeconds: number
  totalAmount: number
  seatsHeld: string[]
  message: string
}
