'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  Armchair,
  ArrowRight,
  BatteryCharging,
  Bus,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  CreditCard,
  Download,
  Flame,
  Info,
  Lock,
  LogIn,
  MapPin,
  QrCode,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Ticket,
  User,
  Users,
  Wifi,
  Wind,
  X,
  Zap,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

import { BusSeatGrid } from '@/components/booking/bus-seat-grid'
import { SeatLockTimer } from '@/components/booking/seat-lock-timer'
import { useSeatLock } from '@/hooks/use-seat-lock'
import { bookingService } from '@/lib/services/booking.service'
import { BookingResultData, SeatItem } from '@/lib/types/booking'
import { TripSearchResult } from '@/lib/types/sprint1'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { VoucherInput } from '@/components/portal/voucher-input'
import type { VoucherValidationResult } from '@/lib/types/promotion'

interface SeatPickerModalProps {
  open: boolean
  onClose: () => void
  initialOrigin?: string
  initialDestination?: string
  selectedTrip?: TripSearchResult | null
}

// Fallback 28 ghế tiêu chuẩn khi chưa có dữ liệu backend
const FALLBACK_SEATS: SeatItem[] = Array.from({ length: 28 }, (_, i) => {
  const rowNumber = Math.floor(i / 4) + 1
  const cols = ['A', 'B', 'C', 'D'] as const
  const col = cols[i % 4]
  const seatNumber = `${String(rowNumber).padStart(2, '0')}${col}`
  // Demo một số ghế đã bán hoặc đang giữ
  const isBooked = ['01A', '02D', '04B', '05A'].includes(seatNumber)
  const isHolding = ['03A', '06B'].includes(seatNumber)
  return {
    seatId: `fallback-seat-${seatNumber}`,
    seatNumber,
    rowNumber,
    columnLabel: col,
    isBooked,
    bookingStatus: isBooked ? 'booked' : isHolding ? 'holding' : 'available',
    isHeldByMe: false,
    holdExpiresAt: null,
  }
})

export function SeatPickerModal({
  open,
  onClose,
  initialOrigin = 'KTX ICTU',
  initialDestination = 'Bến xe Đồng Quang',
  selectedTrip = null,
}: SeatPickerModalProps) {
  const { isAuthenticated, user } = useAuth()

  // Các bước: 'seats' (chọn ghế) | 'mobile-info' (điền thông tin mobile) | 'success' (thành công)
  const [step, setStep] = useState<'seats' | 'mobile-info' | 'success'>('seats')
  const [passengerName, setPassengerName] = useState(user?.fullName || user?.name || 'Nguyễn Thu An')
  const [phone, setPhone] = useState(user?.phoneNumber || '0981234567')
  const [paymentMethod, setPaymentMethod] = useState<'vnpay' | 'momo' | 'ictupay'>('vnpay')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingResult, setBookingResult] = useState<BookingResultData | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [voucherResult, setVoucherResult] = useState<VoucherValidationResult | null>(null)

  // Tích hợp Hook Realtime Seat Locking & Anti-Race-Condition
  const {
    seatMap,
    selectedSeats,
    isLoading: isSeatMapLoading,
    isHoldingAction,
    conflictedSeatId,
    errorMessage: lockError,
    successMessage: lockSuccess,
    isExpired: isHoldExpired,
    remainingSeconds,
    toggleSeat,
    releaseAllHeldSeats,
    refreshSeatMap,
  } = useSeatLock({
    tripId: selectedTrip?.id,
    enabled: open,
  })

  // Đồng bộ thông tin user khi đăng nhập
  useEffect(() => {
    if (user) {
      if (user.fullName || user.name) setPassengerName(user.fullName || user.name)
      if (user.phoneNumber) setPhone(user.phoneNumber)
    }
  }, [user])

  if (!open) return null

  // Giá vé và ưu đãi sinh viên
  const originName = selectedTrip?.origin || initialOrigin
  const destinationName = selectedTrip?.destination || initialDestination
  const routeCode = selectedTrip?.routeCode || 'CT-01'
  const routeName = selectedTrip?.routeName || 'Tuyến CT-01 KTX ICTU ↔ Bến Xe TP'
  const departureTime = selectedTrip?.departureTime
    ? new Date(selectedTrip.departureTime).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '07:45'
  const vehiclePlate = selectedTrip?.vehiclePlate || '20B-999.88'

  const basePrice = selectedTrip ? Number(selectedTrip.basePrice) : 10000
  const isStudent = user?.role === 'STUDENT' || Boolean(user?.studentId) || true // Mặc định hỗ trợ SV
  const studentPrice = selectedTrip ? Number(selectedTrip.studentPrice) : 5000
  const effectivePrice = isStudent ? studentPrice : basePrice
  const totalPrice = selectedSeats.length * effectivePrice
  const totalStandardPrice = selectedSeats.length * basePrice
  const totalSavings = totalStandardPrice - totalPrice
  const voucherDiscount = voucherResult?.discountAmount || 0
  const finalPrice = Math.max(0, totalPrice - voucherDiscount)

  const displaySeats = seatMap?.seats && seatMap.seats.length > 0 ? seatMap.seats : FALLBACK_SEATS

  const handleClose = async () => {
    await releaseAllHeldSeats()
    onClose()
    setTimeout(() => {
      setStep('seats')
      setBookingResult(null)
      setSubmitError(null)
      setVoucherResult(null)
    }, 250)
  }

  // Xử lý chốt đặt vé (POST /api/v1/booking/create)
  const handleConfirmBooking = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (selectedSeats.length === 0) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      if (selectedTrip?.id) {
        const payload = {
          tripId: selectedTrip.id,
          passengers: selectedSeats.map((s) => ({
            seatId: s.seatId,
            passengerName: passengerName.trim() || 'Hành khách',
            passengerPhone: phone.trim() || undefined,
          })),
          paymentMethod: paymentMethod === 'ictupay' ? 'cash' : paymentMethod,
        }

        const res = await bookingService.createBooking(payload)
        if (res.success && res.data) {
          setBookingResult(res.data)
          setStep('success')
          return
        } else {
          setSubmitError(res.message || 'Không thể tạo đơn đặt vé')
        }
      } else {
        // Mock hoàn tất khi mở chế độ demo trực tiếp
        const mockResult: BookingResultData = {
          id: `bkg-${Date.now()}`,
          bookingCode: `ICTU-${Math.floor(100000 + Math.random() * 900000)}`,
          totalAmount: totalStandardPrice,
          discountAmount: totalSavings,
          finalAmount: totalPrice,
          paymentStatus: 'PAID',
          tickets: selectedSeats.map((s) => ({
            id: `tkt-${s.seatNumber}`,
            ticketCode: `TK-2026-${s.seatNumber}`,
            seatNumber: s.seatNumber,
            passengerName: passengerName.trim() || 'Hành khách',
            passengerPhone: phone.trim() || undefined,
            price: effectivePrice,
            status: 'VALID',
            qrCodeData: `ICTU-PASS:${routeCode}-${s.seatNumber}-${user?.studentId || 'SV'}`,
          })),
        }
        setBookingResult(mockResult)
        setStep('success')
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Lỗi kết nối khi thanh toán')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 p-0 sm:p-4 overscroll-contain animate-in fade-in duration-150"
    >
      <div className="relative w-full h-[95vh] sm:h-auto sm:max-h-[92vh] max-w-5xl rounded-t-3xl sm:rounded-3xl border border-slate-100 bg-white shadow-2xl flex flex-col will-change-transform overflow-hidden">
        {/* ===================================================================
            HEADER: TRẠM DỰNG · BIỂN SỐ XE · ĐỒNG HỒ ĐẾM NGƯỢC GIỮ CHỖ
            =================================================================== */}
        <div className="border-b border-slate-100 px-4 sm:px-6 py-3 sm:py-3.5 bg-gradient-to-r from-emerald-50/80 via-white to-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 sm:size-10 items-center justify-center rounded-2xl bg-[#005A36] text-white shadow-sm shrink-0">
              <Bus size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-[#005A36] text-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                  {routeCode}
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate max-w-[220px] sm:max-w-md">
                  {originName} ➔ {destinationName}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-medium">
                <span className="font-mono font-bold text-emerald-800">Khởi hành: {departureTime}</span>
                <span>·</span>
                <span>Xe: {vehiclePlate}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Countdown Timer Pill (Khi đã giữ ít nhất 1 ghế) */}
            <SeatLockTimer remainingSeconds={remainingSeconds} />

            <button
              type="button"
              onClick={handleClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 1. Thông báo khi ghế được giữ thành công (Point 1) */}
        {lockSuccess && !lockError && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shrink-0 animate-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-200" />
              <span>{lockSuccess}</span>
            </div>
            <span className="text-[10px] bg-emerald-700/80 px-2 py-0.5 rounded-full font-mono font-bold">10:00</span>
          </div>
        )}

        {/* 2. Cảnh báo khi thời gian giữ chỗ sắp hết (dưới 2 phút) (Point 4) */}
        {remainingSeconds > 0 && remainingSeconds <= 120 && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-black flex items-center justify-between shrink-0 animate-pulse">
            <div className="flex items-center gap-2">
              <Flame size={15} className="shrink-0 text-white fill-white" />
              <span>Thời gian giữ chỗ sắp hết! Vui lòng hoàn tất thanh toán trước khi ghế bị giải phóng.</span>
            </div>
            <span className="font-mono text-xs bg-amber-600/40 text-slate-950 px-2 py-0.5 rounded-md font-black">
              {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
            </span>
          </div>
        )}

        {/* 3. Cảnh báo Xung đột Race Condition hoặc Hết hạn giữ chỗ (Points 5 & 9) */}
        {(lockError || submitError) && (
          <div className={cn(
            "text-white px-4 py-2 text-xs font-bold flex items-center justify-between shrink-0 animate-in fade-in",
            isHoldExpired ? "bg-rose-600" : "bg-amber-600"
          )}>
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{lockError || submitError}</span>
            </div>
            <button
              type="button"
              onClick={() => refreshSeatMap()}
              className="underline text-[11px] font-black hover:opacity-90 flex items-center gap-1 cursor-pointer bg-black/20 px-2.5 py-1 rounded-lg"
            >
              <RefreshCw size={12} />
              <span>{isHoldExpired ? 'Chọn lại ghế' : 'Tải lại'}</span>
            </button>
          </div>
        )}

        {/* ===================================================================
            BODY: DUAL-COLUMN DESKTOP SPLIT VIEW / SINGLE COLUMN MOBILE
            =================================================================== */}
        {step !== 'success' ? (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
            {/* CỘT TRÁI: SƠ ĐỒ GHẾ XE BUÝT 28 CHỖ (Chiếm 56% trên Desktop) */}
            <div
              className={cn(
                'lg:w-[56%] flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/60 flex flex-col items-center justify-between',
                step === 'mobile-info' && 'hidden lg:flex',
              )}
            >
              <div className="w-full max-w-sm mb-3 flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Armchair size={15} className="text-[#005A36]" />
                  <span>Sơ đồ ghế buýt thông minh</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>Trống: <strong className="text-emerald-700">{seatMap?.availableCount ?? 24}</strong></span>
                  <span>·</span>
                  <span>Đang giữ: <strong className="text-amber-700">{seatMap?.holdingCount ?? 2}</strong></span>
                </div>
              </div>

              {/* Sơ đồ ghế Component */}
              <BusSeatGrid
                seats={displaySeats}
                selectedSeatIds={selectedSeats.map((s) => s.seatId)}
                onToggleSeat={toggleSeat}
                conflictedSeatId={conflictedSeatId}
                isLoading={isSeatMapLoading || isHoldingAction}
              />

              <div className="mt-4 text-center text-[11px] text-slate-400">
                Chạm vào vị trí ghế mong muốn để giữ chỗ tức thì trong 10 phút.
              </div>
            </div>

            {/* CỘT PHẢI: BẢNG CHECKOUT, THÔNG TIN HÀNH KHÁCH & THANH TOÁN (Chiếm 44% trên Desktop) */}
            <div
              className={cn(
                'lg:w-[44%] flex-1 overflow-y-auto p-4 sm:p-6 bg-white border-t lg:border-t-0 lg:border-l border-slate-100 flex flex-col justify-between',
                step === 'seats' && 'hidden lg:flex',
              )}
            >
              <div className="space-y-4">
                {/* Tiêu đề & Nút quay lại (nếu ở mobile view) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {step === 'mobile-info' && (
                      <button
                        type="button"
                        onClick={() => setStep('seats')}
                        className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 lg:hidden"
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                      Thông Tin Đặt Vé & Thanh Toán
                    </h4>
                  </div>
                  {isStudent && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-[#005A36]">
                      GIẢM 50% HSSV
                    </span>
                  )}
                </div>

                {/* Danh sách ghế đã chọn */}
                <div className="rounded-2xl bg-emerald-50/60 border border-emerald-200/80 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">Ghế đã chọn:</span>
                    <span className="font-black text-[#005A36]">
                      {selectedSeats.length > 0
                        ? `${selectedSeats.length} vị trí`
                        : 'Chưa chọn ghế nào'}
                    </span>
                  </div>

                  {selectedSeats.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedSeats.map((seat) => (
                        <div
                          key={seat.seatId}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-emerald-300 px-2.5 py-1 text-xs font-black text-[#005A36] shadow-2xs"
                        >
                          <Armchair size={13} />
                          <span>Ghế {seat.seatNumber}</span>
                          <button
                            type="button"
                            onClick={() => toggleSeat(seat)}
                            className="text-slate-400 hover:text-rose-500 transition-colors ml-0.5"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      Vui lòng chạm chọn tối thiểu 1 ghế trên sơ đồ xe buýt bên cạnh.
                    </p>
                  )}
                </div>

                {/* Form thông tin hành khách */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Họ và tên hành khách
                    </label>
                    <input
                      type="text"
                      value={passengerName}
                      onChange={(e) => setPassengerName(e.target.value)}
                      placeholder="VD: Nguyễn Thu An"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#005A36] transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Số điện thoại nhận vé
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0981 234 567"
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#005A36] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Mã sinh viên ICTU
                      </label>
                      <input
                        type="text"
                        value={user?.studentId || 'DTC215180001'}
                        disabled
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Phương thức thanh toán 1-chạm */}
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Phương thức thanh toán
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('vnpay')}
                      className={cn(
                        'flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer',
                        paymentMethod === 'vnpay'
                          ? 'border-[#005A36] bg-emerald-50/70 text-[#005A36] font-black ring-2 ring-[#005A36]/15'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <span className="text-xs font-extrabold block">VNPAY-QR</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">Quét QR ngân hàng</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('momo')}
                      className={cn(
                        'flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer',
                        paymentMethod === 'momo'
                          ? 'border-[#005A36] bg-emerald-50/70 text-[#005A36] font-black ring-2 ring-[#005A36]/15'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <span className="text-xs font-extrabold block">Ví MoMo</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">Thanh toán 1s</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('ictupay')}
                      className={cn(
                        'flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer',
                        paymentMethod === 'ictupay'
                          ? 'border-[#005A36] bg-emerald-50/70 text-[#005A36] font-black ring-2 ring-[#005A36]/15'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <span className="text-xs font-extrabold block">Tiền mặt</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">Tại cửa xe buýt</span>
                    </button>
                  </div>
                </div>

                {/* Voucher / Khuyến mãi */}
                <div className="pt-1">
                  <VoucherInput
                    orderAmount={totalPrice}
                    onApplied={setVoucherResult}
                    disabled={selectedSeats.length === 0 || isSubmitting}
                  />
                </div>

                {/* Bảng tính chi phí */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Đơn giá tiêu chuẩn ({selectedSeats.length} vé):</span>
                    <span className="font-mono">{totalStandardPrice.toLocaleString('vi-VN')}đ</span>
                  </div>
                  {isStudent && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Ưu đãi sinh viên ICTU (-50%):</span>
                      <span className="font-mono">-{totalSavings.toLocaleString('vi-VN')}đ</span>
                    </div>
                  )}
                  {voucherDiscount > 0 && (
                    <div className="flex justify-between text-violet-700 font-bold">
                      <span>Mã giảm giá ({voucherResult?.code}):</span>
                      <span className="font-mono">-{voucherDiscount.toLocaleString('vi-VN')}đ</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200/80 pt-2 flex justify-between items-center">
                    <span className="font-black text-slate-900">Tổng thanh toán:</span>
                    <span className="text-base font-black text-[#005A36] font-mono">
                      {finalPrice.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                </div>
              </div>

              {/* Nút hành động Desktop */}
              <div className="pt-4">
                <button
                  type="button"
                  disabled={selectedSeats.length === 0 || isSubmitting}
                  onClick={() => handleConfirmBooking()}
                  className={cn(
                    'w-full py-3 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 shadow-lg transition-all duration-150',
                    selectedSeats.length > 0 && !isSubmitting
                      ? 'bg-[#005A36] hover:bg-[#004529] hover:scale-[1.01] active:scale-95 cursor-pointer shadow-emerald-950/20'
                      : 'bg-slate-300 cursor-not-allowed shadow-none',
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <span className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Đang xuất vé an toàn...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>Xác Nhận & Xuất Vé ({finalPrice.toLocaleString('vi-VN')}đ)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ===================================================================
              STEP 3: THÀNH CÔNG · MÃ VÉ ĐIỆN TỬ & QR LÊN XE THỰC TẾ
              =================================================================== */
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="size-14 rounded-3xl bg-emerald-100 text-[#005A36] flex items-center justify-center shadow-md animate-in zoom-in-75">
              <CheckCircle2 size={32} />
            </div>

            <div className="space-y-1">
              <span className="rounded-full bg-emerald-100 text-[#005A36] px-3 py-1 text-xs font-black uppercase tracking-wider">
                ĐẶT CHỖ THÀNH CÔNG
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-2">
                Vé Điện Tử Đã Sẵn Sàng Lên Xe
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Mã QR đã được đồng bộ vào hệ thống kiểm soát cửa thông minh của xe buýt{' '}
                <strong className="text-slate-800">{vehiclePlate}</strong>.
              </p>
            </div>

            {/* QR Code Pass Card */}
            <div className="w-full max-w-sm rounded-3xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-5 space-y-3.5 shadow-sm">
              <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-xs flex items-center justify-center mx-auto w-fit">
                <QRCodeSVG
                  value={
                    bookingResult?.tickets[0]?.qrCodeData ||
                    `ICTU-PASS:${bookingResult?.bookingCode || 'TICKET'}`
                  }
                  size={170}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="space-y-1">
                <div className="font-mono font-black text-base text-[#005A36]">
                  {bookingResult?.bookingCode || 'ICTU-2026-PASS'}
                </div>
                <div className="text-xs font-extrabold text-slate-800">
                  {routeName} (Khởi hành: {departureTime})
                </div>
                <div className="text-xs text-slate-600">
                  Ghế:{' '}
                  <strong className="text-[#005A36]">
                    {selectedSeats.map((s) => s.seatNumber).join(', ')}
                  </strong>{' '}
                  · Hành khách: <strong>{passengerName}</strong>
                </div>
              </div>

              <div className="rounded-xl bg-white border border-emerald-200/80 p-2.5 text-[11px] text-emerald-950 font-medium">
                Đưa mã QR trên màn hình điện thoại lại gần máy quét tại cửa lên xe buýt thông minh để qua cổng tự động.
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-sm pt-2">
              <Link
                href="/my-tickets"
                onClick={handleClose}
                className="flex-1 rounded-xl bg-white border border-[#005A36] text-[#005A36] hover:bg-emerald-50 py-2.5 text-xs font-black transition-all shadow-xs flex items-center justify-center gap-1.5"
                id="success-view-my-tickets"
              >
                <Ticket size={14} />
                Xem trong Vé của tôi
              </Link>
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl bg-[#005A36] py-2.5 text-xs font-black text-white hover:bg-[#004529] transition-all shadow-md cursor-pointer"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================
            MOBILE FLOATING DOCK (STICKY BOTTOM BAR KHI Ở STEP 'seats')
            =================================================================== */}
        {step === 'seats' && (
          <div className="lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md p-3 px-4 flex items-center justify-between shadow-2xl shrink-0 z-30">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-bold">
                  {selectedSeats.length > 0 ? `${selectedSeats.length} ghế:` : 'Chưa chọn ghế'}
                </span>
                <span className="text-xs font-black text-[#005A36]">
                  {selectedSeats.length > 0
                    ? selectedSeats.map((s) => s.seatNumber).join(', ')
                    : '---'}
                </span>
              </div>
              <div className="text-sm font-black text-slate-900 font-mono">
                {totalPrice > 0 ? `${totalPrice.toLocaleString('vi-VN')}đ` : '5.000đ/vé SV'}
              </div>
            </div>

            <button
              type="button"
              disabled={selectedSeats.length === 0}
              onClick={() => setStep('mobile-info')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-black text-white transition-all shadow-md',
                selectedSeats.length > 0
                  ? 'bg-[#005A36] active:scale-95 cursor-pointer shadow-emerald-950/20'
                  : 'bg-slate-300 cursor-not-allowed shadow-none',
              )}
            >
              <span>Tiếp tục đặt vé</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
