/**
 * Feature: Bus Booking, Trip Search & Seat Selection
 * Tìm chuyến xe, chọn ghế sơ đồ 28 chỗ, khóa giữ ghế và xác nhận đặt vé
 * Ánh xạ Backend Module: backend/src/modules/booking & backend/src/modules/trips
 */
export { BusSeatGrid } from '@/components/booking/bus-seat-grid';
export { SeatLockTimer } from '@/components/booking/seat-lock-timer';
export { TripSearchModal } from '@/components/landing/trip-search-modal';
export { SeatPickerModal } from '@/components/landing/seat-picker-modal';
export { bookingService } from '@/lib/services/booking.service';
export { tripService } from '@/lib/services/trip.service';
export { useSeatLock } from '@/hooks/use-seat-lock';
