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
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  CreditCard,
  Download,
  ExternalLink,
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
  Wallet,
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

  // Các bước: 'seats' (chọn ghế) | 'mobile-info' (thông tin mobile) | 'payment' (cổng thanh toán) | 'success' (vé)
  const [step, setStep] = useState<'seats' | 'mobile-info' | 'payment' | 'success'>('seats')
  const [passengerName, setPassengerName] = useState(user?.fullName || user?.name || 'Nguyễn Thu An')
  const [phone, setPhone] = useState(user?.phoneNumber || '0981234567')
  const [paymentMethod, setPaymentMethod] = useState<'vnpay' | 'atm' | 'ictupay'>('vnpay')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancellingPayment, setIsCancellingPayment] = useState(false)
  const [bookingResult, setBookingResult] = useState<BookingResultData | null>(null)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null)

  // Tích hợp Hook Realtime Seat Locking & Anti-Race-Condition
  const {
    seatMap,
    selectedSeats,
    isLoading: isSeatMapLoading,
    isHoldingAction,
    conflictedSeatId,
    errorMessage: lockError,
    remainingSeconds,
    holdToken,
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

  const displaySeats = seatMap?.seats && seatMap.seats.length > 0 ? seatMap.seats : FALLBACK_SEATS

  const handleClose = async () => {
    // Nếu đang ở bước payment mà người dùng bấm tắt -> Hủy payment giải phóng ghế
    if (step === 'payment' && bookingResult?.id) {
      try {
        await bookingService.cancelPayment(bookingResult.id)
      } catch {
        // cleanup silent
      }
    } else {
      await releaseAllHeldSeats()
    }
    onClose()
    setTimeout(() => {
      setStep('seats')
      setBookingResult(null)
      setPaymentUrl(null)
      setSubmitError(null)
      setNoticeMessage(null)
    }, 250)
  }

  // Bước 1 -> Bước 2: Chuyển sang Cổng Thanh Toán (Tạo đơn PENDING & Tạo link VNPay)
  const handleProceedToPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (selectedSeats.length === 0) return

    setIsSubmitting(true)
    setSubmitError(null)
    setNoticeMessage(null)

    try {
      if (selectedTrip?.id) {
        const payload = {
          tripId: selectedTrip.id,
          passengers: selectedSeats.map((s) => ({
            seatId: s.seatId,
            passengerName: passengerName.trim() || 'Hành khách',
            passengerPhone: phone.trim() || undefined,
          })),
          holdToken: holdToken || undefined,
          paymentMethod: 'VNPAY',
        }

        const res = await bookingService.createBooking(payload)
        if (res.success && res.data) {
          const bookingData = res.data
          const bookingId = bookingData.id || (bookingData as any).bookingId
          setBookingResult(bookingData)

          // Tạo URL thanh toán VNPay thực tế từ backend
          const payRes = await bookingService.createPaymentUrl({
            bookingId,
            paymentMethod: 'VNPAY',
          })

          if (payRes.success && payRes.data?.paymentUrl) {
            setPaymentUrl(payRes.data.paymentUrl)
          }

          setStep('payment')
          return
        } else {
          setSubmitError(res.message || 'Không thể tạo đơn đặt vé. Vui lòng thử lại.')
        }
      } else {
        // Mock hoàn tất khi mở chế độ demo trực tiếp
        const mockResult: BookingResultData = {
          id: `bkg-${Date.now()}`,
          bookingCode: `ICTU-${Math.floor(100000 + Math.random() * 900000)}`,
          totalAmount: totalStandardPrice,
          discountAmount: totalSavings,
          finalAmount: totalPrice,
          paymentStatus: 'PENDING',
          tickets: selectedSeats.map((s) => ({
            id: `tkt-${s.seatNumber}`,
            ticketCode: `TK-2026-${s.seatNumber}`,
            seatNumber: s.seatNumber,
            passengerName: passengerName.trim() || 'Hành khách',
            passengerPhone: phone.trim() || undefined,
            price: effectivePrice,
            status: 'RESERVED',
            qrCodeData: `ICTU-PASS:${routeCode}-${s.seatNumber}-${user?.studentId || 'SV'}`,
          })),
        }
        setBookingResult(mockResult)
        setStep('payment')
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Lỗi kết nối khi chuẩn bị thanh toán')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Bước 2: Khách chủ động bấm "HỦY THANH TOÁN" -> Gọi POST /api/v1/payment/cancel/:bookingId giải phóng ghế ngay lập tức!
  const handleCancelPayment = async () => {
    setIsCancellingPayment(true)
    setSubmitError(null)

    try {
      if (bookingResult?.id) {
        const res = await bookingService.cancelPayment(bookingResult.id)
        if (res.success) {
          setNoticeMessage('Đã hủy thanh toán và giải phóng ghế tức thì thành công. Bạn có thể chọn lại vị trí khác.')
        } else {
          setNoticeMessage('Đã hủy đơn đặt vé. Ghế đã được đưa về trạng thái trống.')
        }
      } else {
        await releaseAllHeldSeats()
        setNoticeMessage('Đã giải phóng ghế thành công.')
      }

      // Quay lại bước chọn ghế và tải mới lại sơ đồ ghế
      setBookingResult(null)
      setPaymentUrl(null)
      setStep('seats')
      refreshSeatMap()
    } catch (err: any) {
      console.error('Lỗi khi hủy thanh toán:', err)
      setNoticeMessage('Đã hủy giao dịch.')
      setStep('seats')
      refreshSeatMap()
    } finally {
      setIsCancellingPayment(false)
    }
  }

  // Bước 2 -> Bước 3: Xác nhận thanh toán thành công (Mô phỏng VNPay Return / Callback 00)
  const handlePaymentSuccess = () => {
    setStep('success')
  }

  if (!open) return null

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

        {/* Thông báo xanh thành công / hoàn tất hủy */}
        {noticeMessage && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shrink-0 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{noticeMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setNoticeMessage(null)}
              className="text-white/80 hover:text-white ml-2 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Cảnh báo Conflict Race Condition (Nếu có) */}
        {(lockError || submitError) && (
          <div className="bg-amber-500 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shrink-0 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{lockError || submitError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSubmitError(null)}
              className="text-white/80 hover:text-white ml-2 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* ===================================================================
            BODY NỘI DUNG THEO TỪNG BƯỚC (STEPS)
            =================================================================== */}
        {step === 'seats' || step === 'mobile-info' ? (
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
            {/* CỘT TRÁI: SƠ ĐỒ GHẾ CABIN 28 CHỖ (Chiếm 56% trên Desktop) */}
            <div
              className={cn(
                'lg:w-[56%] flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 flex flex-col items-center justify-start',
                step === 'mobile-info' && 'hidden lg:flex',
              )}
            >
              <div className="w-full flex items-center justify-between mb-3 text-xs">
                <span className="font-extrabold text-slate-700 uppercase tracking-tight flex items-center gap-1.5">
                  <Armchair size={15} className="text-[#005A36]" />
                  <span>Sơ đồ cabin xe buýt 28 chỗ</span>
                </span>
                <button
                  type="button"
                  onClick={refreshSeatMap}
                  disabled={isSeatMapLoading}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-[#005A36] transition-colors"
                >
                  <RefreshCw size={12} className={cn(isSeatMapLoading && 'animate-spin')} />
                  <span>Làm mới</span>
                </button>
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

            {/* CỘT PHẢI: BẢNG CHECKOUT, THÔNG TIN HÀNH KHÁCH & TIẾP TỤC (Chiếm 44% trên Desktop) */}
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
                      Thông Tin Đặt Chỗ
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
                    <span className="font-bold text-slate-600">Ghế đang giữ (10 phút):</span>
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
                  <div className="border-t border-slate-200/80 pt-2 flex justify-between items-center">
                    <span className="font-black text-slate-900">Tổng thanh toán:</span>
                    <span className="text-base font-black text-[#005A36] font-mono">
                      {totalPrice.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                </div>
              </div>

              {/* Nút hành động Desktop */}
              <div className="pt-4">
                <button
                  type="button"
                  disabled={selectedSeats.length === 0 || isSubmitting}
                  onClick={() => handleProceedToPayment()}
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
                      <span>Đang tạo phiên thanh toán...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>Tiến Hành Thanh Toán ({totalPrice.toLocaleString('vi-VN')}đ)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : step === 'payment' ? (
          /* ===================================================================
              STEP 2: CỔNG THANH TOÁN ĐA KÊNH VIETCOMBANK & VNPAY
              =================================================================== */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 flex flex-col items-center justify-start">
            <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-lg p-5 sm:p-7 space-y-5 animate-in fade-in">
              {/* Header Cổng Thanh Toán */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="size-10 rounded-2xl bg-emerald-100 text-[#005A36] flex items-center justify-center shrink-0">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Cổng Thanh Toán Vé Xe Buýt</h3>
                    <p className="text-xs text-slate-500">Mã đơn: <span className="font-mono font-bold text-slate-800">{bookingResult?.bookingCode || 'BK-PENDING'}</span></p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Cần thanh toán</span>
                  <span className="text-lg font-black text-[#005A36] font-mono">
                    {totalPrice.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>

              {/* Thông tin đơn vé ngắn gọn */}
              <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-3.5 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 font-bold block">Tuyến xe:</span>
                  <span className="font-extrabold text-slate-900">{routeName}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 font-bold block">Vị trí ghế đã giữ:</span>
                  <span className="font-mono font-black text-sm text-[#005A36]">
                    {selectedSeats.map((s) => s.seatNumber).join(', ')}
                  </span>
                </div>
              </div>

              {/* Lựa chọn phương thức thanh toán */}
              <div className="space-y-3">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-tight">
                  Chọn phương thức thanh toán
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('vnpay')}
                    className={cn(
                      'flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer',
                      paymentMethod === 'vnpay'
                        ? 'border-[#005A36] bg-emerald-50 text-[#005A36] font-black ring-2 ring-[#005A36]/20 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    <QrCode size={20} className="mb-1 text-[#005A36]" />
                    <span className="text-xs font-extrabold block">VNPAY-QR</span>
                    <span className="text-[10px] text-slate-400 block">Quét QR ngân hàng</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('atm')}
                    className={cn(
                      'flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer',
                      paymentMethod === 'atm'
                        ? 'border-[#005A36] bg-emerald-50 text-[#005A36] font-black ring-2 ring-[#005A36]/20 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    <CreditCard size={20} className="mb-1 text-slate-700" />
                    <span className="text-xs font-extrabold block">Thẻ ATM / VCB</span>
                    <span className="text-[10px] text-slate-400 block">Napas nội địa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('ictupay')}
                    className={cn(
                      'flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer',
                      paymentMethod === 'ictupay'
                        ? 'border-[#005A36] bg-emerald-50 text-[#005A36] font-black ring-2 ring-[#005A36]/20 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    <Wallet size={20} className="mb-1 text-emerald-600" />
                    <span className="text-xs font-extrabold block">Ví ICTU Pay</span>
                    <span className="text-[10px] text-slate-400 block">Thẻ sinh viên 1s</span>
                  </button>
                </div>
              </div>

              {/* Chi tiết theo Phương thức */}
              {paymentMethod === 'vnpay' && (
                <div className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-4 text-center space-y-3">
                  <div className="bg-white p-3 rounded-2xl border border-emerald-100 shadow-xs inline-block mx-auto">
                    <QRCodeSVG
                      value={
                        paymentUrl ||
                        `https://api.vietqr.io/image/970422-0987654321-compact2.jpg?amount=${totalPrice}&addInfo=${bookingResult?.bookingCode || 'ICTU'}`
                      }
                      size={160}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-900">
                      Quét mã QR bằng App Ngân hàng hoặc Ví VNPay
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Tự động điền số tiền <strong className="text-[#005A36]">{totalPrice.toLocaleString('vi-VN')}đ</strong> và nội dung chuyển khoản.
                    </p>
                  </div>

                  {paymentUrl && (
                    <a
                      href={paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#005A36] hover:underline pt-1"
                    >
                      <span>Mở trang thanh toán VNPay Sandbox</span>
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              )}

              {paymentMethod === 'atm' && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <ShieldCheck size={16} className="text-[#005A36]" />
                    <span>Cổng thanh toán thẻ ATM Vietcombank & Liên ngân hàng Napas</span>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Số thẻ (VD: 9704 2200 1234 5678)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 outline-none focus:border-[#005A36]"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Tên in trên thẻ (KHONG DAU)"
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#005A36]"
                      />
                      <input
                        type="text"
                        placeholder="Tháng/Năm (MM/YY)"
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 outline-none focus:border-[#005A36]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'ictupay' && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">Tài khoản sinh viên:</span>
                    <span className="font-mono font-bold text-slate-900">{user?.studentId || 'DTC215180001'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">Số dư khả dụng:</span>
                    <span className="font-mono font-black text-sm text-[#005A36]">150.000đ</span>
                  </div>
                  <p className="text-[11px] text-slate-500 pt-1">
                    Thanh toán 1 chạm trực tiếp từ ví sinh viên ICTU, tự động đối soát và kích hoạt vé ngay lập tức.
                  </p>
                </div>
              )}

              {/* Các nút hành động chính */}
              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  onClick={handlePaymentSuccess}
                  className="w-full py-3.5 rounded-xl font-black text-sm text-white bg-[#005A36] hover:bg-[#004529] hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 cursor-pointer transition-all"
                >
                  <CheckCircle2 size={18} />
                  <span>Xác Nhận Đã Thanh Toán ({totalPrice.toLocaleString('vi-VN')}đ)</span>
                </button>

                {/* NÚT HỦY THANH TOÁN & GIẢI PHÓNG GHẾ NGAY LẬP TỨC (YÊU CẦU 10/10 CỦA PR #14) */}
                <button
                  type="button"
                  disabled={isCancellingPayment}
                  onClick={handleCancelPayment}
                  className="w-full py-2.5 rounded-xl font-bold text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 active:scale-95 flex items-center justify-center gap-1.5 border border-rose-200 transition-all cursor-pointer"
                >
                  {isCancellingPayment ? (
                    <>
                      <span className="size-3.5 rounded-full border-2 border-rose-600 border-t-transparent animate-spin" />
                      <span>Đang giải phóng ghế...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw size={14} />
                      <span>Hủy Thanh Toán & Trả Lại Ghế Về Trống</span>
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
                ĐÃ THANH TOÁN THÀNH CÔNG (PAID)
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-2">
                Vé Điện Tử Đã Sẵn Sàng Lên Xe
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Ghế đã được chốt và mã QR đã được đồng bộ vào hệ thống kiểm soát cửa thông minh của xe buýt{' '}
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
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl bg-[#005A36] py-2.5 text-xs font-black text-white hover:bg-[#004529] transition-all shadow-md cursor-pointer"
              >
                Hoàn tất & Về trang chủ
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
