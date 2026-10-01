/**
 * Booking Status Constants
 */
export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

/**
 * Ticket Status Constants
 */
export enum TicketStatus {
  RESERVED = 'reserved',
  PAID = 'paid',
  CHECKED_IN = 'checked_in',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  EXPIRED = 'expired',
}

/**
 * Trip Status Constants
 */
export enum TripStatus {
  SCHEDULED = 'scheduled',
  BOARDING = 'boarding',
  DEPARTED = 'departed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  DELAYED = 'delayed',
  CANCELLED = 'cancelled',
}

/**
 * Payment Status Constants
 */
export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  REFUND_PENDING = 'refund_pending',
}

/**
 * Payment Method Constants
 */
export enum PaymentMethod {
  VNPAY = 'vnpay',
  MOMO = 'momo',
  ZALOPAY = 'zalopay',
  BANK_CARD = 'bank_card',
  VIETQR = 'vietqr',
  CASH = 'cash',
}

/**
 * Vehicle Status Constants
 */
export enum VehicleStatus {
  ACTIVE = 'active',
  MAINTENANCE = 'maintenance',
  RETIRED = 'retired',
}

/**
 * Seat Type Constants
 */
export enum SeatType {
  STANDARD = 'standard',
  PRIORITY = 'priority',
}

/**
 * User Status Constants
 */
export enum UserStatus {
  ACTIVE = 'active',
  LOCKED = 'locked',
  PENDING = 'pending',
}

/**
 * Monthly Pass Category
 */
export enum MonthlyPassCategory {
  STUDENT = 'student',
  ELDERLY = 'elderly',
  WORKER = 'worker',
}

/**
 * Approval Status
 */
export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Incident Type
 */
export enum IncidentType {
  TRAFFIC_JAM = 'traffic_jam',
  BREAKDOWN = 'breakdown',
  ACCIDENT = 'accident',
  WEATHER = 'weather',
  OTHER = 'other',
}

/**
 * Incident Severity
 */
export enum IncidentSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}
