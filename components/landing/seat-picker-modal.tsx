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
import { paymentService } from '@/lib/services/payment.service'
import { BookingResultData, SeatItem } from '@/lib/types/booking'
import { PaymentGateway, PaymentUrlResponseData } from '@/lib/types/payment'
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
  onViewMyTickets?: (ticketId?: string) => void
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
  onViewMyTickets,
}: SeatPickerModalProps) {
  const { isAuthenticated, user } = useAuth()

  // Các bước: 'seats' (chọn ghế) | 'mobile-info' (điền thông tin mobile) | 'payment-qr' (quét QR thanh toán đa cổng) | 'success' (thành công)
  const [step, setStep] = useState<'seats' | 'mobile-info' | 'payment-qr' | 'success'>('seats')
  const [passengerName, setPassengerName] = useState(user?.fullName || user?.name || 'Nguyễn Thu An')
  const [phone, setPhone] = useState(user?.phoneNumber || '0981234567')
  const [paymentMethod, setPaymentMethod] = useState<'vnpay' | 'momo' | 'zalopay' | 'bank_card' | 'vietqr' | 'ictupay'>('vnpay')
  const [paymentResponse, setPaymentResponse] = useState<PaymentUrlResponseData | null>(null)
  const [isCancellingPayment, setIsCancellingPayment] = useState(false)
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false)
  const [paymentNotice, setPaymentNotice] = useState<{ type: 'error' | 'warning' | 'info'; text: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingResult, setBookingResult] = useState<BookingResultData | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [voucherResult, setVoucherResult] = useState<VoucherValidationResult | null>(null)

  // Tự động polling đối soát trạng thái giao dịch định kỳ khi đang mở QR thanh toán
  useEffect(() => {
    if (step !== 'payment-qr' || !bookingResult?.id) return

    const interval = setInterval(async () => {
      try {
        const res = await paymentService.checkPaymentStatus(bookingResult.id)
        if (res.success && res.data) {
          if (res.data.status === 'PAID') {
            clearInterval(interval)
            setBookingResult((prev) => (prev ? { ...prev, paymentStatus: 'PAID' } : prev))
            setStep('success')
          } else if (res.data.status === 'CANCELLED') {
            clearInterval(interval)
            setPaymentNotice({
              type: 'error',
              text: 'Đơn đặt vé đã bị hủy trên cổng thanh toán. Ghế của bạn đang được giải phóng.',
            })
            setTimeout(() => {
              handleCancelPayment()
            }, 1800)
          }
        }
      } catch (e) {
        // Silent poll warn
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [step, bookingResult?.id])

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
    if (step === 'payment-qr' && bookingResult?.id) {
      await paymentService.cancelPayment(bookingResult.id).catch(() => {})
    }
    await releaseAllHeldSeats()
    onClose()
    setTimeout(() => {
      setStep('seats')
      setBookingResult(null)
      setPaymentResponse(null)
      setSubmitError(null)
      setVoucherResult(null)
    }, 250)
  }

  // Hủy thanh toán chủ động của hành khách để giải phóng ghế ngay lập tức (PR #21)
  const handleCancelPayment = async () => {
    setIsCancellingPayment(true)
    setPaymentNotice(null)
    try {
      if (bookingResult?.id) {
        await paymentService.cancelPayment(bookingResult.id).catch(() => {})
      }
      await releaseAllHeldSeats()
      setPaymentResponse(null)
      setBookingResult(null)
      setStep('seats')
      refreshSeatMap()
    } catch (err: any) {
      console.warn('Lỗi khi hủy thanh toán:', err)
      setStep('seats')
    } finally {
      setIsCancellingPayment(false)
    }
  }

  // Đối soát trạng thái thanh toán thực tế với Backend trước khi cấp vé thành công
  // Ngăn chặn tuyệt đối việc người dùng hủy thanh toán nhưng hệ thống vẫn xuất vé PAID
  const handleVerifyPayment = async () => {
    if (!bookingResult?.id) {
      setPaymentNotice({
        type: 'error',
        text: 'Không tìm thấy mã đơn đặt vé để kiểm tra giao dịch.',
      })
      return
    }

    setIsVerifyingPayment(true)
    setPaymentNotice(null)

    try {
      const statusRes = await paymentService.checkPaymentStatus(bookingResult.id)
      if (statusRes.success && statusRes.data) {
        const { status } = statusRes.data
        if (status === 'PAID') {
          // Giao dịch đã được cổng thanh toán xác nhận thành công
          setBookingResult((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              paymentStatus: 'PAID',
              tickets: prev.tickets.map((t) => ({ ...t, status: 'PAID' })),
            }
          })
          setStep('success')
          return
        }

        if (status === 'CANCELLED') {
          // Giao dịch đã bị hủy hoặc cổng thanh toán báo FAILED
          setPaymentNotice({
            type: 'error',
            text: 'Giao dịch thanh toán đã bị hủy. Hệ thống không xuất vé và ghế đã được giải phóng.',
          })
          setTimeout(() => {
            handleCancelPayment()
          }, 1800)
          return
        }
      }

      // Trường hợp PENDING: Cổng thanh toán chưa ghi nhận tiền
      setPaymentNotice({
        type: 'warning',
        text: 'Hệ thống chưa nhận được xác nhận thanh toán từ ngân hàng / ví điện tử. Vui lòng hoàn tất quét mã QR chuyển khoản hoặc thử lại sau vài giây.',
      })
    } catch (err: any) {
      setPaymentNotice({
        type: 'error',
        text: err?.message || 'Không thể kiểm tra trạng thái thanh toán. Vui lòng thử lại.',
      })
    } finally {
      setIsVerifyingPayment(false)
    }
  }

  // Xử lý chốt đặt vé & khởi tạo thanh toán đa cổng (POST /api/v1/booking/create + POST /api/v1/payment/create-url)
  const handleConfirmBooking = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (selectedSeats.length === 0) return

    setIsSubmitting(true)
    setSubmitError(null)
    setPaymentNotice(null)

    try {
      let bookingData: BookingResultData | null = null

      if (selectedTrip?.id) {
        const payload = {
          tripId: selectedTrip.id,
          passengers: selectedSeats.map((s) => ({
            seatId: s.seatId,
            passengerName: passengerName.trim() || 'Hành khách',
            passengerPhone: phone.trim() || undefined,
          })),
          voucherCode: voucherResult?.code,
          paymentMethod: paymentMethod === 'ictupay' ? 'cash' : paymentMethod,
        }

        const res = await bookingService.createBooking(payload)
        if (res.success && res.data) {
          bookingData = res.data
        } else {
          setSubmitError(res.message || 'Không thể tạo đơn đặt vé')
          setIsSubmitting(false)
          return
        }
      } else {
        // Mock hoàn tất khi mở chế độ demo trực tiếp: vé ban đầu ở trạng thái PENDING, KHÔNG PHẢI PAID
        bookingData = {
          id: `bkg-${Date.now()}`,
          bookingCode: `ICTU-${Math.floor(100000 + Math.random() * 900000)}`,
          totalAmount: totalStandardPrice,
          discountAmount: totalSavings + voucherDiscount,
          finalAmount: finalPrice,
          paymentStatus: paymentMethod === 'ictupay' ? 'PAID' : 'PENDING',
          tickets: selectedSeats.map((s) => ({
            id: `tkt-${s.seatNumber}`,
            ticketCode: `TK-2026-${s.seatNumber}`,
            seatNumber: s.seatNumber,
            passengerName: passengerName.trim() || 'Hành khách',
            passengerPhone: phone.trim() || undefined,
            price: effectivePrice,
            status: paymentMethod === 'ictupay' ? 'PAID' : 'PENDING',
            qrCodeData: `ICTU-PASS:${routeCode}-${s.seatNumber}-${user?.studentId || 'SV'}`,
          })),
        }
      }

      setBookingResult(bookingData)

      // Nếu phương thức là Tiền mặt tại xe -> Trực tiếp xuất vé thành công
      if (paymentMethod === 'ictupay') {
        setStep('success')
        return
      }

      // Nếu chọn Cổng thanh toán trực tuyến (MoMo, VNPay, ZaloPay, Thẻ ngân hàng, VietQR)
      // Gọi endpoint POST /api/v1/payment/create-url đồng bộ với PR #21 Backend
      const payRes = await paymentService.createPaymentUrl({
        bookingId: bookingData.id,
        paymentMethod: paymentMethod as PaymentGateway,
        orderInfo: `Thanh toan ve xe buyt ICTU ${bookingData.bookingCode}`,
      })

      if (payRes.success && payRes.data) {
        setPaymentResponse(payRes.data)
        setStep('payment-qr')
      } else {
        // Fallback mô phỏng cổng thanh toán mượt mà khi Backend sandbox chưa cấu hình key
        setPaymentResponse({
          bookingId: bookingData.id,
          orderId: bookingData.bookingCode,
          paymentUrl: `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?orderId=${bookingData.bookingCode}`,
          qrCode: `ICTU-GATEWAY:${paymentMethod.toUpperCase()}:${bookingData.bookingCode}:${finalPrice}`,
          expiresAt: Date.now() + 10 * 60 * 1000,
          amount: finalPrice,
          paymentMethod: paymentMethod as PaymentGateway,
        })
        setStep('payment-qr')
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
        {step === 'seats' || step === 'mobile-info' ? (
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

                {/* Phương thức thanh toán đa cổng (PR #21 Backend: VNPay, MoMo, ZaloPay, Thẻ ngân hàng, VietQR, Tiền mặt) */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      Phương thức thanh toán
                    </label>
                    <span className="text-[10px] text-emerald-800 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Tự động giữ chỗ 10 phút
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('vnpay')}
                      className={cn(
                        'flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer',
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
                        'flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer',
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
                      onClick={() => setPaymentMethod('zalopay')}
                      className={cn(
                        'flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer',
                        paymentMethod === 'zalopay'
                          ? 'border-[#005A36] bg-emerald-50/70 text-[#005A36] font-black ring-2 ring-[#005A36]/15'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <span className="text-xs font-extrabold block">ZaloPay</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">Mở app / Quét QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bank_card')}
                      className={cn(
                        'flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer',
                        paymentMethod === 'bank_card'
                          ? 'border-[#005A36] bg-emerald-50/70 text-[#005A36] font-black ring-2 ring-[#005A36]/15'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <span className="text-xs font-extrabold block">Thẻ ATM/Visa</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">Nội địa & Quốc tế</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('vietqr')}
                      className={cn(
                        'flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer',
                        paymentMethod === 'vietqr'
                          ? 'border-[#005A36] bg-emerald-50/70 text-[#005A36] font-black ring-2 ring-[#005A36]/15'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <span className="text-xs font-extrabold block">VietQR</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">Chuyển khoản 24/7</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('ictupay')}
                      className={cn(
                        'flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer',
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
        ) : step === 'payment-qr' ? (
          /* ===================================================================
              STEP 2.5: CỔNG THANH TOÁN ĐA PHƯƠNG THỨC · QR CODE TỨC THÌ (Base64)
              Đồng bộ với PR #21 Backend: MoMo, VNPay, ZaloPay, Thẻ ATM/Visa, VietQR
              Khắc phục dứt điểm lỗi tràn trục dọc bị mất nửa trên mã QR (Flexbox overflow)
              =================================================================== */
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:p-6 flex flex-col items-center justify-start text-center space-y-3.5 my-auto">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/90 border border-emerald-300 px-3.5 py-1 text-xs font-black text-[#005A36]">
                <Clock size={13} className="animate-spin text-[#005A36]" />
                <span>
                  Đang giữ chỗ an toàn · Còn lại {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                Quét Mã QR Để Hoàn Tất Thanh Toán
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Cổng thanh toán{' '}
                <strong className="text-[#005A36] uppercase font-black">
                  {paymentMethod === 'vnpay'
                    ? 'VNPAY-QR'
                    : paymentMethod === 'momo'
                    ? 'Ví MoMo'
                    : paymentMethod === 'zalopay'
                    ? 'Ví ZaloPay'
                    : paymentMethod === 'bank_card'
                    ? 'Thẻ ATM / Thẻ Quốc Tế'
                    : 'VietQR Chuyển Khoản'}
                </strong>
                . Mở ứng dụng ngân hàng hoặc ví điện tử để quét mã.
              </p>
            </div>

            {/* Thông báo đối soát / lỗi thanh toán (nếu có) */}
            {paymentNotice && (
              <div
                className={cn(
                  'w-full max-w-sm p-3 rounded-2xl text-xs font-bold text-left flex items-start gap-2 animate-in fade-in slide-in-from-top-1 shadow-sm',
                  paymentNotice.type === 'error'
                    ? 'bg-rose-50 border border-rose-300 text-rose-800'
                    : paymentNotice.type === 'warning'
                    ? 'bg-amber-50 border border-amber-300 text-amber-900'
                    : 'bg-emerald-50 border border-emerald-300 text-[#005A36]',
                )}
              >
                {paymentNotice.type === 'error' ? (
                  <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                ) : paymentNotice.type === 'warning' ? (
                  <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 leading-snug">{paymentNotice.text}</div>
              </div>
            )}

            {/* Khung mã QR Code Base64 từ Backend hoặc SVG fallback */}
            <div className="w-full max-w-sm rounded-3xl border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-50/50 via-white to-slate-50 p-4 sm:p-5 space-y-3 shadow-lg relative overflow-hidden shrink-0">
              {/* 4 góc ngắm quét Finder Corners */}
              <div className="absolute top-2.5 left-2.5 w-3.5 h-3.5 border-t-2 border-l-2 border-[#005A36] rounded-tl-sm pointer-events-none" />
              <div className="absolute top-2.5 right-2.5 w-3.5 h-3.5 border-t-2 border-r-2 border-[#005A36] rounded-tr-sm pointer-events-none" />
              <div className="absolute bottom-2.5 left-2.5 w-3.5 h-3.5 border-b-2 border-l-2 border-[#005A36] rounded-bl-sm pointer-events-none" />
              <div className="absolute bottom-2.5 right-2.5 w-3.5 h-3.5 border-b-2 border-r-2 border-[#005A36] rounded-br-sm pointer-events-none" />

              <div className="bg-white p-3 rounded-2xl border border-emerald-200/80 shadow-md flex items-center justify-center mx-auto w-fit shrink-0">
                {paymentResponse?.qrDataUrl ? (
                  <img
                    src={paymentResponse.qrDataUrl}
                    alt="Mã QR thanh toán"
                    className="w-36 h-36 sm:w-40 sm:h-40 object-contain rounded-xl shrink-0"
                  />
                ) : (
                  <QRCodeSVG
                    value={
                      paymentResponse?.qrCode ||
                      paymentResponse?.paymentUrl ||
                      `ICTU-PAY:${bookingResult?.bookingCode || 'DEMO'}`
                    }
                    size={148}
                    level="H"
                    includeMargin={true}
                  />
                )}
              </div>

              {/* Thông tin chuyển khoản / thanh toán */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-3 text-xs space-y-1.5 text-left">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Mã đơn đặt vé:</span>
                  <span className="font-mono font-black text-slate-800">
                    {bookingResult?.bookingCode || paymentResponse?.orderId}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Số tiền thanh toán:</span>
                  <span className="font-mono font-black text-base text-[#005A36]">
                    {finalPrice.toLocaleString('vi-VN')}đ
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Tuyến xe:</span>
                  <span className="font-bold text-slate-800">{routeCode} ({departureTime})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Ghế chọn:</span>
                  <span className="font-bold text-emerald-800">
                    {selectedSeats.map((s) => s.seatNumber).join(', ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Các nút hành động */}
            <div className="flex flex-col gap-2 w-full max-w-sm pt-0.5">
              {paymentResponse?.paymentUrl && (
                <a
                  href={paymentResponse.paymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-[#005A36] py-3 text-xs font-black text-white hover:opacity-95 transition-all shadow-md shadow-emerald-900/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ExternalLink size={15} />
                  <span>Mở Trang Thanh Toán Cổng {paymentMethod.toUpperCase()}</span>
                </a>
              )}

              <button
                type="button"
                disabled={isVerifyingPayment}
                onClick={handleVerifyPayment}
                className="w-full rounded-xl bg-emerald-50 border border-emerald-300 text-[#005A36] hover:bg-emerald-100/70 py-2.5 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isVerifyingPayment ? (
                  <>
                    <span className="size-3.5 rounded-full border-2 border-[#005A36] border-t-transparent animate-spin" />
                    <span>Đang đối soát giao dịch...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Tôi Đã Thanh Toán Xong (Xác Nhận)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isCancellingPayment}
                onClick={handleCancelPayment}
                className="w-full rounded-xl border border-rose-200 bg-rose-50/60 text-rose-700 hover:bg-rose-100 py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isCancellingPayment ? (
                  <>
                    <span className="size-3.5 rounded-full border-2 border-rose-700 border-t-transparent animate-spin" />
                    <span>Đang giải phóng ghế...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={14} />
                    <span>Hủy Thanh Toán & Giải Phóng Ghế Ngay</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* ===================================================================
              STEP 3: THÀNH CÔNG · MÃ VÉ ĐIỆN TỬ & QR LÊN XE THỰC TẾ
              =================================================================== */
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:p-6 flex flex-col items-center justify-start text-center space-y-4 my-auto">
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
              <button
                type="button"
                onClick={() => {
                  handleClose()
                  if (onViewMyTickets) {
                    onViewMyTickets(bookingResult?.tickets?.[0]?.id || bookingResult?.tickets?.[0]?.ticketCode)
                  } else {
                    window.location.href = '/my-tickets'
                  }
                }}
                className="flex-1 rounded-xl bg-white border border-[#005A36] text-[#005A36] hover:bg-emerald-50 py-2.5 text-xs font-black transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                id="success-view-my-tickets"
              >
                <Ticket size={14} />
                Xem trong Vé của tôi
              </button>
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
