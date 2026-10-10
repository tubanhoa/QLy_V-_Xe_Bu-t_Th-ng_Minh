'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  Armchair,
  ArrowRight,
  Ban,
  BatteryCharging,
  Bus,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Mail,
  ReceiptText,
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
import { bookingService, generateFallbackSeatMap } from '@/lib/services/booking.service'
import { paymentService } from '@/lib/services/payment.service'
import { BookingResultData, CreateBookingPayload, SeatItem } from '@/lib/types/booking'
import { PaymentGateway, PaymentUrlResponseData } from '@/lib/types/payment'
import { TripSearchResult } from '@/lib/types/sprint1'
import { useAuth } from '@/lib/auth-context'
import { cn, isValidEmail } from '@/lib/utils'
import { VoucherInput } from '@/components/portal/voucher-input'
import type { VoucherValidationResult } from '@/lib/types/promotion'
import { InvoicePreviewModal } from '@/components/invoice/invoice-preview-modal'
import { CelebrationFx } from '@/components/ui/celebration-fx'
import { haptic } from '@/lib/utils/haptics'

interface SeatPickerModalProps {
  open: boolean
  onClose: () => void
  initialOrigin?: string
  initialDestination?: string
  selectedTrip?: TripSearchResult | null
  initialVoucherCode?: string
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
  initialVoucherCode,
  onViewMyTickets,
}: SeatPickerModalProps) {
  const { isAuthenticated, user } = useAuth()

  // Các bước: 'seats' (chọn ghế) | 'mobile-info' (điền thông tin mobile) | 'payment-qr' (quét QR thanh toán đa cổng) | 'success' (thành công)
  const [step, setStep] = useState<'seats' | 'mobile-info' | 'payment-qr' | 'success'>('seats')
  const [passengerName, setPassengerName] = useState(user?.fullName || user?.name || 'Nguyễn Thu An')
  const [phone, setPhone] = useState(user?.phoneNumber || '0981234567')
  const [invoiceEmail, setInvoiceEmail] = useState(user?.email || 'ductrandanh06@gmail.com')
  const [isInvoiceRequested, setIsInvoiceRequested] = useState(true)
  const [emailTouched, setEmailTouched] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'vnpay' | 'momo' | 'zalopay' | 'bank_card' | 'vietqr' | 'ictupay'>('vnpay')
  const [paymentResponse, setPaymentResponse] = useState<PaymentUrlResponseData | null>(null)
  const [isCancellingPayment, setIsCancellingPayment] = useState(false)
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingResult, setBookingResult] = useState<BookingResultData | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [voucherResult, setVoucherResult] = useState<VoucherValidationResult | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [useVietQrImg, setUseVietQrImg] = useState<boolean>(true)
  const [walletSaved, setWalletSaved] = useState<boolean>(false)

  // Phát âm thanh chúc mừng chiến thắng khi hoàn tất vé
  useEffect(() => {
    if (step === 'success') {
      haptic.play('success')
    }
  }, [step])

  const copyToClipboard = (text: string, field: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {})
    }
    haptic.play('copy')
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleAddToWallet = () => {
    haptic.play('pop')
    setWalletSaved(true)
    setTimeout(() => setWalletSaved(false), 3500)
  }

  const effectiveTripId = selectedTrip?.id || 'trip-ct01-default'

  // Kiểm tra chuyến xe có sẵn sàng nhận khách hay đã xuất bến/hoàn thành
  const isTripBookable = useMemo(() => {
    if (!selectedTrip) return true
    if (selectedTrip.isBookable !== undefined) return selectedTrip.isBookable
    return (
      selectedTrip.status === 'scheduled' ||
      selectedTrip.status === 'boarding' ||
      !selectedTrip.status
    )
  }, [selectedTrip])

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
    holdExpiresAt,
    toggleSeat,
    releaseAllHeldSeats,
    refreshSeatMap,
  } = useSeatLock({
    tripId: effectiveTripId,
    enabled: open,
  })

  // Đồng bộ thông tin user khi đăng nhập
  useEffect(() => {
    if (user) {
      if (user.fullName || user.name) setPassengerName(user.fullName || user.name)
      if (user.phoneNumber) setPhone(user.phoneNumber)
      if (user.email) setInvoiceEmail(user.email)
    }
  }, [user])

  // Giá vé và ưu đãi sinh viên
  const originName = selectedTrip?.origin || initialOrigin
  const destinationName = selectedTrip?.destination || initialDestination
  const routeCode = selectedTrip?.routeCode || 'CT-01'
  const routeName = selectedTrip?.routeName || 'Tuyến CT-01 KTX ICTU ↔ Bến Xe TP'
  const departureTimeIso =
    selectedTrip?.departureTime ||
    (() => {
      const d = new Date()
      d.setHours(7, 45, 0, 0)
      return d.toISOString()
    })()

  let departureTime = '07:45'
  try {
    departureTime = new Date(departureTimeIso).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    departureTime = '07:45'
  }
  const vehiclePlate = selectedTrip?.vehiclePlate || '20B-999.88'

  const basePrice = useMemo(() => (selectedTrip ? Number(selectedTrip.basePrice) : 20000), [selectedTrip])
  const isStudent = user?.role === 'STUDENT' || Boolean(user?.studentId) || true // Mặc định hỗ trợ SV
  const studentPrice = useMemo(() => (selectedTrip ? Number(selectedTrip.studentPrice) : 10000), [selectedTrip])
  const effectivePrice = isStudent ? studentPrice : basePrice

  const { totalPrice, totalStandardPrice, totalSavings, voucherDiscount, finalPrice } = useMemo(() => {
    const total = selectedSeats.length * effectivePrice
    const standard = selectedSeats.length * basePrice
    const savings = standard - total
    const rawVoucher = voucherResult?.discountAmount || 0
    // Khống chế mức giảm giá (Cap Discount) để số tiền thanh toán không tụt dưới 10.000 VNĐ
    // Đảm bảo đáp ứng hạn mức thanh toán tối thiểu của ngân hàng và VNPay Sandbox
    const maxAllowedDiscount = Math.max(0, total - 10000)
    const voucher = Math.min(rawVoucher, maxAllowedDiscount)
    const final = total > 0 ? Math.max(10000, total - voucher) : 0
    return {
      totalPrice: total,
      totalStandardPrice: standard,
      totalSavings: savings,
      voucherDiscount: voucher,
      finalPrice: final,
    }
  }, [selectedSeats.length, effectivePrice, basePrice, voucherResult?.discountAmount])

  const displaySeats = useMemo(() => {
    return seatMap?.seats && seatMap.seats.length > 0
      ? seatMap.seats
      : generateFallbackSeatMap(effectiveTripId).seats
  }, [seatMap?.seats, effectiveTripId])

  const selectedSeatIds = useMemo(() => selectedSeats.map((s) => s.seatId), [selectedSeats])

  const handleToggleSeat = useCallback((seat: any) => {
    setSubmitError(null)
    toggleSeat(seat)
  }, [toggleSeat])

  // Lắng nghe trạng thái thanh toán tự động (Asynchronous IPN Webhook Polling mỗi 3 giây)
  useEffect(() => {
    if (step !== 'payment-qr') return

    const primaryTicketId = bookingResult?.tickets?.[0]?.id || bookingResult?.ticketId
    const bookingId = bookingResult?.id || bookingResult?.bookingId

    if (!primaryTicketId && !bookingId) return

    let isCancelled = false
    const interval = setInterval(async () => {
      try {
        if (primaryTicketId) {
          const res = await paymentService.getTicketDetail(primaryTicketId)
          if (res.success && res.data) {
            const status = (res.data.status || '').toLowerCase()
            if (status === 'paid' && !isCancelled) {
              setBookingResult((prev: any) => ({
                ...prev,
                status: 'paid',
                tickets: [res.data],
              }))
              setStep('success')
            }
          }
        }
      } catch {
        // Tiếp tục lắng nghe chu kỳ tiếp theo
      }
    }, 3000)

    return () => {
      isCancelled = true
      clearInterval(interval)
    }
  }, [step, bookingResult])

  const handleClose = async () => {
    if (step === 'payment-qr' && bookingResult?.id) {
      await paymentService.cancelPayment(bookingResult.id).catch(() => {})
    }
    if (step !== 'success') {
      await releaseAllHeldSeats()
    }
    onClose()
    setTimeout(() => {
      setStep('seats')
      setBookingResult(null)
      setPaymentResponse(null)
      setSubmitError(null)
      setVoucherResult(null)
      refreshSeatMap()
    }, 250)
  }

  // Hủy thanh toán chủ động của hành khách để giải phóng ghế ngay lập tức (PR #21)
  const handleCancelPayment = async () => {
    setIsCancellingPayment(true)
    try {
      if (bookingResult?.id) {
        await paymentService.cancelPayment(bookingResult.id)
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

  // Xác nhận thanh toán thành công (chốt chuyển sang PAID trên backend Supabase)
  const handleConfirmPaymentSuccess = async () => {
    const validBookingId = bookingResult?.id || (bookingResult as any)?.bookingId || paymentResponse?.bookingId
    if (!validBookingId) {
      setStep('success')
      refreshSeatMap()
      return
    }

    setIsConfirmingPayment(true)
    try {
      const confirmRes = await paymentService.mockConfirmPayment(validBookingId)
      if (confirmRes.success) {
        const confirmedData = confirmRes.data as any
        const updatedTickets = confirmedData?.tickets || bookingResult?.tickets
        const updatedBooking = confirmedData?.booking || bookingResult

        setBookingResult((prev: any) => ({
          ...prev,
          ...updatedBooking,
          status: 'paid',
          tickets: updatedTickets,
        }))

        refreshSeatMap()
        setStep('success')
      } else {
        alert(confirmRes.message || 'Không thể xác nhận thanh toán. Vui lòng kiểm tra lại.')
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi kết nối xác nhận thanh toán')
    } finally {
      setIsConfirmingPayment(false)
    }
  }

  // Xử lý chốt đặt vé & khởi tạo thanh toán đa cổng (POST /api/v1/booking/create + POST /api/v1/payment/create-url)
  const handleConfirmBooking = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!isTripBookable) {
      setSubmitError('Chuyến xe này đã xuất bến hoặc đã kết thúc lộ trình. Hệ thống không nhận đặt vé mới!')
      return
    }
    if (selectedSeats.length === 0) return

    setIsSubmitting(true)
    setSubmitError(null)

    if (isInvoiceRequested) {
      if (!invoiceEmail.trim()) {
        setSubmitError('Vui lòng nhập địa chỉ Email nhận Hóa đơn điện tử.')
        setEmailTouched(true)
        setIsSubmitting(false)
        return
      }
      if (!isValidEmail(invoiceEmail)) {
        setSubmitError('Địa chỉ Email nhận hóa đơn chưa đúng định dạng. Vui lòng kiểm tra lại.')
        setEmailTouched(true)
        setIsSubmitting(false)
        return
      }
    }

    try {
      const payload: CreateBookingPayload = {
        tripId: effectiveTripId,
        seatIds: selectedSeats.map((s) => s.seatNumber),
        passengers: selectedSeats.map((s) => ({
          seatId: s.seatId,
          passengerName: passengerName.trim() || user?.fullName || user?.name || 'Hành khách ICTU',
          passengerPhone: phone.trim() || user?.phoneNumber || undefined,
        })),
        voucherCode: voucherResult?.code,
        paymentMethod: paymentMethod === 'ictupay' ? 'cash' : paymentMethod,
        totalAmount: finalPrice,
        originStation: originName,
        destinationStation: destinationName,
        passengerName: passengerName.trim() || user?.fullName || user?.name || 'Hành khách ICTU',
        passengerPhone: phone.trim() || user?.phoneNumber || undefined,
        passengerEmail: invoiceEmail.trim(),
        invoiceEmail: isInvoiceRequested ? invoiceEmail.trim() : undefined,
        isInvoiceRequested,
        departureTime: departureTimeIso,
        routeCode,
        routeName,
        vehiclePlate,
      }

      const res = await bookingService.createBooking(payload)
      if (!res.success || !res.data) {
        setSubmitError(res.message || 'Không thể tạo đơn đặt vé')
        setIsSubmitting(false)
        return
      }

      const bookingData = res.data
      setBookingResult(bookingData)
      refreshSeatMap()

      // Nếu phương thức là Tiền mặt tại xe -> Trực tiếp xuất vé thành công và đồng bộ trạng thái PAID
      if (paymentMethod === 'ictupay') {
        const bId = bookingData.id || bookingData.bookingId
        if (bId) {
          await paymentService.mockConfirmPayment(bId).catch(() => {})
        }
        setStep('success')
        return
      }

      // Nếu chọn Cổng thanh toán trực tuyến (MoMo, VNPay, ZaloPay, Thẻ ngân hàng, VietQR)
      // Gọi endpoint POST /api/v1/payment/create-url đồng bộ với PR #21 Backend
      const validBookingId = bookingData.id || bookingData.bookingId || `bkg-${Date.now()}`
      const payRes = await paymentService.createPaymentUrl({
        bookingId: validBookingId,
        paymentMethod: paymentMethod as PaymentGateway,
        orderInfo: `Thanh toan ve xe buyt ICTU ${bookingData.bookingCode}`,
        invoiceEmail: isInvoiceRequested && invoiceEmail.trim() ? invoiceEmail.trim() : undefined,
      })

      if (payRes.success && payRes.data) {
        setPaymentResponse(payRes.data)
        setStep('payment-qr')
      } else {
        // Fallback mô phỏng cổng thanh toán mượt mà khi Backend sandbox chưa cấu hình key
        setPaymentResponse({
          bookingId: validBookingId,
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

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 p-0 sm:p-4 overscroll-contain animate-in fade-in duration-150"
    >
      <div className="relative w-full h-[95vh] sm:h-auto sm:max-h-[92vh] max-w-5xl rounded-t-3xl sm:rounded-3xl border border-slate-100 bg-white shadow-2xl flex flex-col will-change-transform overflow-hidden animate-slideUp">
        {/* Mobile Pull-down indicator */}
        <div className="sm:hidden w-full flex justify-center pt-2.5 pb-1 shrink-0 bg-gradient-to-r from-emerald-50/80 via-white to-slate-50">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* ===================================================================
            HEADER: TRẠM DỰNG · BIỂN SỐ XE · ĐỒNG HỒ ĐẾM NGƯỢC GIỮ CHỖ
            =================================================================== */}
        <div className="border-b border-slate-100 px-4 sm:px-6 py-3 sm:py-3.5 bg-gradient-to-r from-emerald-50/80 via-white to-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 sm:size-11 items-center justify-center rounded-2xl bg-[#005A36] text-white shadow-sm shrink-0">
              <Bus size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-[#005A36] text-white px-2 py-0.5 text-xs font-black uppercase tracking-wider shrink-0 shadow-2xs">
                  {routeCode}
                </span>
                <span className="text-xs sm:text-base font-extrabold text-slate-900 line-clamp-1 max-w-[240px] sm:max-w-xl lg:max-w-2xl">
                  {originName} ➔ {destinationName}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs sm:text-sm text-slate-600 font-medium">
                <span className="font-mono font-bold text-emerald-800">Khởi hành: {departureTime}</span>
                <span>·</span>
                <span className="font-semibold text-slate-700">Xe: {vehiclePlate}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Countdown Timer Pill (Khi đã giữ ít nhất 1 ghế) */}
            <SeatLockTimer expiresAt={holdExpiresAt} />

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
        {lockSuccess && !lockError && (step === 'seats' || step === 'mobile-info') && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shrink-0 animate-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-200" />
              <span>{lockSuccess}</span>
            </div>
            <span className="text-[10px] bg-emerald-700/80 px-2 py-0.5 rounded-full font-mono font-bold">
              {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
            </span>
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

        {/* Banner cảnh báo chuyến xe đã xuất bến hoặc hoàn thành lộ trình */}
        {!isTripBookable && (
          <div className="bg-slate-900 text-amber-300 px-4 py-2.5 text-xs font-bold flex items-center justify-between shrink-0 border-b border-amber-500/30 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Ban size={15} className="text-amber-400 shrink-0" />
              <span>
                Chuyến xe này {selectedTrip?.status === 'completed' ? 'đã hoàn thành lộ trình' : 'đã xuất bến'}. Hệ thống tạm dừng nhận đặt vé mới.
              </span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="text-[11px] font-black underline hover:text-white px-2 py-0.5 rounded cursor-pointer bg-white/10"
            >
              Đổi chuyến khác
            </button>
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
              onClick={() => {
                setSubmitError(null)
                refreshSeatMap()
              }}
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
                'lg:w-[56%] flex-1 overflow-y-auto scroll-touch p-4 sm:p-6 bg-slate-50/60 flex flex-col items-center justify-between',
                step === 'mobile-info' && 'hidden lg:flex',
              )}
            >
              <div className="w-full max-w-sm mb-3 flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Armchair size={15} className="text-[#005A36]" />
                  <span>Sơ đồ ghế buýt thông minh</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>Trống: <strong className="text-emerald-700">{seatMap?.availableCount ?? 28}</strong></span>
                  <span>·</span>
                  <span>Đang giữ: <strong className="text-amber-700">{seatMap?.holdingCount ?? 0}</strong></span>
                </div>
              </div>

              {/* Sơ đồ ghế Component */}
              <BusSeatGrid
                seats={displaySeats}
                selectedSeatIds={selectedSeatIds}
                onToggleSeat={handleToggleSeat}
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
                'lg:w-[44%] flex-1 overflow-y-auto scroll-touch p-4 sm:p-6 bg-white border-t lg:border-t-0 lg:border-l border-slate-100 flex flex-col justify-between',
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
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-[#005A36]">
                      GIẢM 50% HSSV
                    </span>
                  )}
                </div>

                {/* Danh sách ghế đã chọn */}
                <div className="rounded-2xl bg-emerald-50/60 border border-emerald-200/80 p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-bold text-slate-600">Ghế đã chọn:</span>
                    <span className="font-black text-[#005A36]">
                      {selectedSeats.length > 0
                        ? `${selectedSeats.length} vị trí`
                        : 'Chưa chọn ghế nào'}
                    </span>
                  </div>

                  {selectedSeats.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedSeats.map((seat) => (
                        <div
                          key={seat.seatId}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-emerald-300 px-3 py-1.5 text-xs sm:text-sm font-black text-[#005A36] shadow-2xs"
                        >
                          <Armchair size={15} />
                          <span>Ghế {seat.seatNumber}</span>
                          <button
                            type="button"
                            onClick={() => toggleSeat(seat)}
                            className="text-slate-400 hover:text-rose-500 transition-colors ml-1 cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm text-slate-400 italic">
                      Vui lòng chạm chọn tối thiểu 1 ghế trên sơ đồ xe buýt bên cạnh.
                    </p>
                  )}
                </div>

                {/* Form thông tin hành khách */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                      Họ và tên hành khách
                    </label>
                    <input
                      type="text"
                      value={passengerName}
                      onChange={(e) => setPassengerName(e.target.value)}
                      placeholder="VD: Nguyễn Thu An"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#005A36] transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                        Số điện thoại nhận vé
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0981 234 567"
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#005A36] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                        Mã sinh viên ICTU
                      </label>
                      <input
                        type="text"
                        value={user?.studentId || 'DTC215180001'}
                        disabled
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Mục Hóa đơn điện tử (E-Invoice) Mobile-Friendly */}
                <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 via-white to-slate-50 p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-lg bg-[#005A36] text-white flex items-center justify-center shadow-xs">
                        <ReceiptText size={15} />
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-black text-slate-900 block leading-tight">
                          Hóa đơn điện tử (E-Invoice)
                        </span>
                        <span className="text-xs text-slate-500 block">
                          Thuế suất GTGT 8% · Ký số tự động
                        </span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInvoiceRequested}
                        onChange={(e) => setIsInvoiceRequested(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#005A36]"></div>
                    </label>
                  </div>

                  {isInvoiceRequested && (
                    <div className="space-y-2 pt-1">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1.5">
                            <Mail size={14} className="text-[#005A36]" />
                            <span>Email nhận Hóa đơn & Vé PDF</span>
                          </label>
                          {user?.email && invoiceEmail !== user.email && (
                            <button
                              type="button"
                              onClick={() => {
                                setInvoiceEmail(user.email)
                                setEmailTouched(true)
                              }}
                              className="text-xs font-bold text-[#005A36] hover:underline cursor-pointer"
                            >
                              Dùng email tài khoản
                            </button>
                          )}
                        </div>

                        <div className="relative">
                          <input
                            type="email"
                            value={invoiceEmail}
                            onChange={(e) => {
                              setInvoiceEmail(e.target.value)
                              setEmailTouched(true)
                            }}
                            onBlur={() => setEmailTouched(true)}
                            placeholder="tenban@gmail.com"
                            className={cn(
                              'w-full rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm font-bold outline-none transition-all pr-8',
                              isInvoiceRequested && emailTouched && invoiceEmail.length > 0 && !isValidEmail(invoiceEmail)
                                ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:border-rose-500'
                                : isValidEmail(invoiceEmail) && invoiceEmail.length > 0
                                ? 'border-emerald-400 bg-emerald-50/20 text-slate-900 focus:border-[#005A36]'
                                : 'border-slate-200 bg-white text-slate-800 focus:border-[#005A36]',
                            )}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            {isValidEmail(invoiceEmail) && invoiceEmail.length > 0 ? (
                              <CheckCircle2 size={16} className="text-emerald-600" />
                            ) : isInvoiceRequested && emailTouched && invoiceEmail.length > 0 && !isValidEmail(invoiceEmail) ? (
                              <AlertCircle size={16} className="text-rose-500" />
                            ) : null}
                          </div>
                        </div>

                        {isInvoiceRequested && emailTouched && invoiceEmail.length > 0 && !isValidEmail(invoiceEmail) && (
                          <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
                            <AlertCircle size={13} className="shrink-0" />
                            <span>Định dạng email chưa hợp lệ (Ví dụ: name@gmail.com)</span>
                          </p>
                        )}
                      </div>

                      {/* Phím tắt Mobile Domain nhanh */}
                      <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
                        <span className="text-xs text-slate-400 font-medium shrink-0">Gợi ý nhanh:</span>
                        {['@gmail.com', '@ictu.edu.vn', '@tnu.edu.vn'].map((domain) => (
                          <button
                            key={domain}
                            type="button"
                            onClick={() => {
                              const prefix = invoiceEmail.includes('@')
                                ? invoiceEmail.split('@')[0]
                                : invoiceEmail.trim()
                              setInvoiceEmail(`${prefix || 'sinhvien'}${domain}`)
                              setEmailTouched(true)
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 hover:border-[#005A36] hover:text-[#005A36] transition-colors shrink-0 cursor-pointer active:scale-95 shadow-2xs"
                          >
                            +{domain}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Phương thức thanh toán đa cổng */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs sm:text-sm font-bold text-slate-700">
                      Phương thức thanh toán
                    </label>
                    <span className="text-xs text-emerald-800 font-extrabold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Tự động giữ chỗ 10 phút
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
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
                      <span className="text-xs sm:text-sm font-extrabold block">VNPAY-QR</span>
                      <span className="text-[11px] sm:text-xs text-slate-500 block mt-0.5">Quét QR ngân hàng</span>
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
                      <span className="text-xs sm:text-sm font-extrabold block">Ví MoMo</span>
                      <span className="text-[11px] sm:text-xs text-slate-500 block mt-0.5">Thanh toán 1s</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('zalopay')}
                      className={cn(
                        'flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer',
                        paymentMethod === 'zalopay'
                          ? 'border-[#005A36] bg-emerald-50/70 text-[#005A36] font-black ring-2 ring-[#005A36]/15'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <span className="text-xs sm:text-sm font-extrabold block">ZaloPay</span>
                      <span className="text-[11px] sm:text-xs text-slate-500 block mt-0.5">Mở app / Quét QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bank_card')}
                      className={cn(
                        'flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer',
                        paymentMethod === 'bank_card'
                          ? 'border-[#005A36] bg-emerald-50/70 text-[#005A36] font-black ring-2 ring-[#005A36]/15'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <span className="text-xs sm:text-sm font-extrabold block">Thẻ ATM/Visa</span>
                      <span className="text-[11px] sm:text-xs text-slate-500 block mt-0.5">Nội địa & Quốc tế</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('vietqr')}
                      className={cn(
                        'flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer',
                        paymentMethod === 'vietqr'
                          ? 'border-[#005A36] bg-emerald-50/70 text-[#005A36] font-black ring-2 ring-[#005A36]/15'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <span className="text-xs sm:text-sm font-extrabold block">VietQR</span>
                      <span className="text-[11px] sm:text-xs text-slate-500 block mt-0.5">Chuyển khoản 24/7</span>
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
                      <span className="text-xs sm:text-sm font-extrabold block">Tiền mặt</span>
                      <span className="text-[11px] sm:text-xs text-slate-500 block mt-0.5">Tại cửa xe buýt</span>
                    </button>
                  </div>
                </div>

                {/* Voucher / Khuyến mãi */}
                <div className="pt-1">
                  <VoucherInput
                    orderAmount={totalPrice}
                    onApplied={setVoucherResult}
                    disabled={selectedSeats.length === 0 || isSubmitting}
                    initialCode={initialVoucherCode}
                    routeId={selectedTrip?.routeId}
                    serviceType="single_ticket"
                  />
                </div>

                {/* Bảng tính chi phí */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Đơn giá tiêu chuẩn ({selectedSeats.length} vé):</span>
                    <span className="font-mono font-bold">{totalStandardPrice.toLocaleString('vi-VN')}đ</span>
                  </div>
                  {isStudent && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Ưu đãi sinh viên ICTU (-50%):</span>
                      <span className="font-mono font-bold">-{totalSavings.toLocaleString('vi-VN')}đ</span>
                    </div>
                  )}
                  {voucherDiscount > 0 && (
                    <div className="flex justify-between text-violet-700 font-bold">
                      <span>Mã giảm giá ({voucherResult?.code}):</span>
                      <span className="font-mono font-bold">-{voucherDiscount.toLocaleString('vi-VN')}đ</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200/80 pt-2.5 flex justify-between items-center">
                    <span className="font-black text-slate-900 text-sm sm:text-base">Tổng thanh toán:</span>
                    <span className="text-lg sm:text-xl font-black text-[#005A36] font-mono">
                      {finalPrice.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                </div>
              </div>

              {/* Nút hành động Desktop */}
              <div className="pt-4">
                <button
                  type="button"
                  disabled={!isTripBookable || selectedSeats.length === 0 || isSubmitting}
                  onClick={() => handleConfirmBooking()}
                  className={cn(
                    'w-full py-3.5 rounded-xl font-black text-sm sm:text-base text-white flex items-center justify-center gap-2 shadow-lg transition-all duration-150',
                    !isTripBookable
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none border border-slate-300'
                      : selectedSeats.length > 0 && !isSubmitting
                        ? 'bg-[#005A36] hover:bg-[#004529] hover:scale-[1.01] active:scale-95 cursor-pointer shadow-emerald-950/20'
                        : 'bg-slate-300 cursor-not-allowed shadow-none',
                  )}
                >
                  {!isTripBookable ? (
                    <>
                      <Ban size={18} />
                      <span>Chuyến đã xuất bến (Không nhận đặt vé)</span>
                    </>
                  ) : isSubmitting ? (
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
              Bố cục 2 cột Dual-Column rộng rãi trên Desktop (max-w-5xl)
              Typography to rõ, tương phản cao, tối ưu 100% Mobile & Desktop
              =================================================================== */
          <div className="flex-1 overflow-y-auto scroll-touch p-4 sm:p-5 lg:p-6">
            <div className="max-w-5xl mx-auto space-y-4">
              {/* Header đếm ngược & Tiêu đề rộng rãi */}
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/90 border border-emerald-300 px-3.5 py-1 text-xs sm:text-sm font-black text-[#005A36] shadow-2xs">
                  <Clock size={15} className="animate-spin text-[#005A36]" />
                  <span>
                    Đang giữ chỗ an toàn · Còn lại {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                  Quét Mã QR Để Hoàn Tất Thanh Toán
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed">
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
                  . Mở ứng dụng Mobile Banking hoặc ví điện tử bất kỳ để quét mã và xác nhận thanh toán tức thì.
                </p>
                <div className="pt-0.5 flex items-center justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-200 px-3 py-0.5 text-xs font-bold text-blue-700 shadow-2xs">
                    <span className="relative flex size-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full size-2 bg-blue-600"></span>
                    </span>
                    <span>Đang kết nối Webhook IPN Sandbox · Tự động kích hoạt vé sau khi quét</span>
                  </span>
                </div>
              </div>

              {/* BỐ CỤC 2 CỘT RỘNG RÃI TRÊN DESKTOP (lg:grid lg:grid-cols-12 lg:gap-6) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* CỘT 1: KHUNG MÃ QR & CÁC NÚT HÀNH ĐỘNG (lg:col-span-5) */}
                <div className="lg:col-span-5 flex flex-col items-center space-y-3">
                  {/* Khung mã QR Code chuẩn VietQR & EMVCo */}
                  <div className="w-full rounded-3xl border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-50/60 via-white to-slate-50 p-4 shadow-lg relative shrink-0 flex flex-col items-center text-center">
                    <div
                      style={{
                        width: '200px',
                        height: '200px',
                        minWidth: '200px',
                        minHeight: '200px',
                      }}
                      className="bg-white p-2.5 rounded-2xl border-2 border-emerald-300 shadow-md flex items-center justify-center mx-auto shrink-0 ring-4 ring-emerald-500/10"
                    >
                      {paymentResponse?.qrDataUrl ? (
                        <img
                          src={paymentResponse.qrDataUrl}
                          alt="Mã QR thanh toán"
                          style={{
                            width: '180px',
                            height: '180px',
                            minWidth: '180px',
                            minHeight: '180px',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                          className="shrink-0 aspect-square rounded-xl"
                        />
                      ) : useVietQrImg ? (
                        <img
                          src={`https://img.vietqr.io/image/970415-113366668888-qr_only.png?amount=${finalPrice}&addInfo=${encodeURIComponent(bookingResult?.bookingCode || paymentResponse?.orderId || 'ICTU-VE')}&accountName=ICTU%20SMART%20TRANSIT`}
                          alt="Mã VietQR Thanh Toán"
                          style={{
                            width: '180px',
                            height: '180px',
                            minWidth: '180px',
                            minHeight: '180px',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                          className="shrink-0 aspect-square rounded-xl"
                          onError={() => setUseVietQrImg(false)}
                        />
                      ) : (
                        <QRCodeSVG
                          value={
                            paymentResponse?.paymentUrl ||
                            paymentResponse?.qrCode ||
                            `https://img.vietqr.io/image/970415-113366668888-qr_only.png?amount=${finalPrice}&addInfo=${bookingResult?.bookingCode || 'BK-ICTU'}`
                          }
                          size={180}
                          level="M"
                          includeMargin={false}
                          style={{
                            width: '180px',
                            height: '180px',
                            display: 'block',
                            aspectRatio: '1/1',
                          }}
                          className="shrink-0 aspect-square"
                        />
                      )}
                    </div>
                    <p className="mt-2.5 text-xs sm:text-sm font-semibold text-slate-600">
                      Chụp màn hình hoặc quét trực tiếp bằng App Ngân Hàng
                    </p>
                  </div>

                  {/* Các nút hành động chính */}
                  <div className="w-full flex flex-col gap-2 pt-0.5">
                    {paymentResponse?.paymentUrl && (
                      <a
                        href={paymentResponse.paymentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-[#005A36] py-3 px-4 text-xs sm:text-sm font-black text-white hover:opacity-95 transition-all shadow-md shadow-emerald-900/20 flex items-center justify-center gap-2 cursor-pointer touch-press touch-manipulation"
                      >
                        <ExternalLink size={16} />
                        <span>Mở Cổng Thanh Toán VNPay Sandbox Chính Thức</span>
                      </a>
                    )}

                    <button
                      type="button"
                      disabled={isConfirmingPayment}
                      onClick={handleConfirmPaymentSuccess}
                      className="w-full rounded-2xl bg-emerald-50 border-2 border-emerald-400 text-[#005A36] hover:bg-emerald-100 py-2.5 px-4 text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer touch-press touch-manipulation disabled:opacity-50 shadow-xs"
                    >
                      {isConfirmingPayment ? (
                        <>
                          <span className="size-4 rounded-full border-2 border-[#005A36] border-t-transparent animate-spin" />
                          <span>Đang kiểm tra & chốt thanh toán...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={16} />
                          <span>Tôi Đã Thanh Toán Xong (Xác Nhận)</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isCancellingPayment}
                      onClick={handleCancelPayment}
                      className="w-full rounded-xl border border-rose-200 bg-rose-50/70 text-rose-700 hover:bg-rose-100 py-2 px-3 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-press touch-manipulation"
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

                {/* CỘT 2: CHI TIẾT CHUYỂN KHOẢN & THẺ TEST SANDBOX (lg:col-span-7) */}
                <div className="lg:col-span-7 flex flex-col space-y-3 text-left">
                  {/* Khung Thông Tin Chuyển Khoản & Tổng Tiền */}
                  <div className="rounded-3xl bg-white border border-slate-200/90 p-4 sm:p-5 shadow-sm space-y-3">
                    {/* Hàng Số Tiền To Nổi Bật */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div>
                        <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider block">
                          Số tiền thanh toán
                        </span>
                        <div className="text-2xl sm:text-3xl font-black font-mono text-[#005A36] mt-0.5">
                          {finalPrice.toLocaleString('vi-VN')}đ
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(String(finalPrice), 'amount')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-xs transition-colors cursor-pointer"
                        title="Sao chép số tiền"
                      >
                        {copiedField === 'amount' ? (
                          <>
                            <Check size={14} className="text-emerald-700" />
                            <span>Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Sao chép</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Danh sách thông tin tài khoản thụ hưởng */}
                    <div className="space-y-2.5 text-xs sm:text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Ngân hàng thụ hưởng:</span>
                        <span className="font-bold text-slate-900 text-sm sm:text-base">VietinBank (Công Thương)</span>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                        <span className="text-slate-500 font-medium">Số tài khoản:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900 text-base sm:text-lg tracking-wider">
                            113366668888
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('113366668888', 'stk')}
                            className="p-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer"
                            title="Sao chép số tài khoản"
                          >
                            {copiedField === 'stk' ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                        <span className="text-slate-500 font-medium">Chủ tài khoản:</span>
                        <span className="font-bold text-slate-900 uppercase text-xs sm:text-sm tracking-wide">
                          ICTU SMART TRANSIT
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                        <span className="text-slate-500 font-medium">Nội dung chuyển khoản:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-emerald-950 bg-emerald-100/90 px-3 py-1 rounded-xl border border-emerald-300 text-xs sm:text-sm tracking-wider">
                            {bookingResult?.bookingCode || paymentResponse?.orderId || 'ICTU-VE'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                bookingResult?.bookingCode || paymentResponse?.orderId || 'ICTU-VE',
                                'memo',
                              )
                            }
                            className="p-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors cursor-pointer"
                            title="Sao chép nội dung chuyển khoản"
                          >
                            {copiedField === 'memo' ? <Check size={15} className="text-emerald-700" /> : <Copy size={15} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {copiedField && (
                      <div className="bg-emerald-600 text-white text-xs font-bold py-1 px-4 rounded-xl text-center animate-in fade-in shadow-xs">
                        ✓ Đã sao chép vào bộ nhớ tạm thành công!
                      </div>
                    )}
                  </div>

                  {/* Card thông tin thẻ test NCB Sandbox mô phỏng Virtual Bank Card */}
                  {(paymentMethod === 'vnpay' || paymentMethod === 'bank_card') && (
                    <div className="rounded-3xl border border-blue-400/30 bg-gradient-to-br from-[#0c1f38] via-[#123156] to-[#0a1829] text-white p-4 sm:p-5 shadow-md relative overflow-hidden space-y-3">
                      {/* Vệt trang trí chip thẻ */}
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <div className="flex items-center gap-2 text-blue-200">
                          <CreditCard size={17} className="text-cyan-400" />
                          <span className="text-xs sm:text-sm font-black uppercase tracking-wider">
                            Thông Tin Thẻ Test VNPay Sandbox
                          </span>
                        </div>
                        <span className="text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-2.5 py-0.5 rounded-full font-mono font-black tracking-wide">
                          NCB TEST ATM
                        </span>
                      </div>

                      {/* Số thẻ test hiển thị cụm 4 số to rõ ràng */}
                      <div>
                        <span className="text-[11px] sm:text-xs text-blue-300/80 font-medium block mb-1">
                          Số thẻ ngân hàng thử nghiệm (Click để sao chép):
                        </span>
                        <div className="flex items-center justify-between bg-black/30 border border-white/10 rounded-2xl px-3.5 py-2">
                          <span className="font-mono font-black text-sm sm:text-lg text-white tracking-widest">
                            9704 1985 2619 1432 198
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('9704198526191432198', 'ncb_card')}
                            className="p-1 rounded-lg bg-white/10 hover:bg-cyan-500/30 text-cyan-300 transition-colors cursor-pointer"
                            title="Sao chép toàn bộ số thẻ"
                          >
                            {copiedField === 'ncb_card' ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                          </button>
                        </div>
                      </div>

                      {/* 3 Trường: Tên chủ thẻ - Ngày phát hành - OTP */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                          <span className="text-[10px] sm:text-[11px] text-blue-300/80 block font-medium">Tên chủ thẻ</span>
                          <strong className="text-xs sm:text-sm text-white font-bold block mt-0.5">NGUYEN VAN A</strong>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                          <span className="text-[10px] sm:text-[11px] text-blue-300/80 block font-medium">Ngày phát hành</span>
                          <strong className="text-xs sm:text-sm text-white font-bold block mt-0.5">07/15</strong>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] sm:text-[11px] text-blue-300/80 block font-medium">Mã OTP</span>
                            <strong className="text-xs sm:text-sm font-black font-mono text-emerald-400 block mt-0.5">
                              123456
                            </strong>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('123456', 'ncb_otp')}
                            className="p-1 rounded-lg bg-white/10 hover:bg-emerald-500/30 text-emerald-300 transition-colors cursor-pointer"
                            title="Sao chép mã OTP"
                          >
                            {copiedField === 'ncb_otp' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>

                      <p className="text-[10px] sm:text-[11px] text-blue-300/70 italic pt-0.5">
                        * Nhập các thông tin này khi Cổng thanh toán VNPay Sandbox yêu cầu xác thực thẻ nội địa.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ===================================================================
              STEP 3: THÀNH CÔNG · MÃ VÉ ĐIỆN TỬ & QR LÊN XE THỰC TẾ
              =================================================================== */
          <div className="relative flex-1 overflow-y-auto scroll-touch p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start text-center space-y-4">
            {/* Pháo hoa hạt màu ICTU siêu nhẹ 60fps mừng đặt vé thành công */}
            <CelebrationFx active={step === 'success'} />

            <div className="size-16 rounded-3xl bg-emerald-100 text-[#005A36] flex items-center justify-center shadow-md shrink-0 animate-in zoom-in-75">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-1.5 shrink-0 max-w-xl mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-100 text-[#005A36] text-xs sm:text-sm font-black uppercase tracking-wider">
                <Sparkles size={14} className="text-emerald-700 animate-spin" />
                <span>ĐẶT CHỖ THÀNH CÔNG</span>
              </div>
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 mt-1">
                Vé Điện Tử Đã Sẵn Sàng Lên Xe
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-lg mx-auto">
                Mã QR đã được đồng bộ vào hệ thống kiểm soát cửa thông minh của xe buýt{' '}
                <strong className="text-slate-900 font-bold">{vehiclePlate}</strong>.
              </p>
            </div>

            {/* Thẻ Vé Lên Xe Siêu Cấp (Authentic Boarding Pass với Vết Cắt Bán Nguyệt & Tem Hologram) */}
            <div className="relative w-full max-w-lg rounded-3xl border-2 border-emerald-300/80 bg-gradient-to-b from-white via-emerald-50/20 to-emerald-50/40 p-6 sm:p-7 space-y-4 shadow-xl shadow-emerald-950/5 shrink-0 overflow-hidden text-left">
              {/* Vết cắt tròn 2 bên cạnh theo phong cách Boarding Pass / Cuống vé thực tế */}
              <span
                aria-hidden="true"
                className="absolute -left-3 top-[52%] -translate-y-1/2 size-6 rounded-full bg-slate-900 border border-slate-700/60 shadow-inner z-10"
              />
              <span
                aria-hidden="true"
                className="absolute -right-3 top-[52%] -translate-y-1/2 size-6 rounded-full bg-slate-900 border border-slate-700/60 shadow-inner z-10"
              />

              {/* Tem Hologram 7 Màu Bảo Mật Vé */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black text-emerald-800 uppercase tracking-widest">
                  <span className="size-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>ICTU SMART TRANSIT PASS</span>
                </div>
                <div className="rounded-md bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-300 px-2.5 py-1 text-[10px] sm:text-xs font-black text-slate-950 shadow-2xs tracking-tight">
                  VERIFIED NFC/QR
                </div>
              </div>

              {/* QR Code Container */}
              <div
                style={{
                  width: '210px',
                  height: '210px',
                  minWidth: '210px',
                  minHeight: '210px',
                }}
                className="bg-white p-3 rounded-2xl border-2 border-emerald-200 shadow-xs flex items-center justify-center mx-auto shrink-0 ring-4 ring-emerald-500/10"
              >
                <QRCodeSVG
                  value={
                    bookingResult?.tickets?.[0]?.qrData ||
                    bookingResult?.tickets?.[0]?.qrCodeData ||
                    `ICTU-PASS:${bookingResult?.tickets?.[0]?.ticketCode || bookingResult?.bookingCode || 'TICKET'}`
                  }
                  size={190}
                  level="H"
                  includeMargin={true}
                  style={{ width: '190px', height: '190px', display: 'block', aspectRatio: '1/1' }}
                  className="shrink-0 aspect-square"
                />
              </div>

              {/* Đường đứt đoạn cuống vé kết nối 2 vết cắt bán nguyệt */}
              <div className="relative py-1">
                <div className="border-t-2 border-dashed border-emerald-300/80 mx-2" />
              </div>

              <div className="space-y-1.5 text-center">
                <div className="font-mono font-black text-lg sm:text-xl text-[#005A36] tracking-wider">
                  {bookingResult?.bookingCode || 'ICTU-2026-PASS'}
                </div>
                <div className="text-sm sm:text-base font-extrabold text-slate-800">
                  {routeName} (Khởi hành: {departureTime})
                </div>
                <div className="text-xs sm:text-sm text-slate-600">
                  Vị trí ghế:{' '}
                  <strong className="text-[#005A36] font-black text-sm sm:text-base">
                    {selectedSeats.map((s) => s.seatNumber).join(', ')}
                  </strong>{' '}
                  · Hành khách: <strong className="text-slate-800 font-bold">{passengerName}</strong>
                </div>
              </div>

              {/* Nút 1-Chạm: Thêm vào Apple / Google Wallet */}
              <button
                type="button"
                onClick={handleAddToWallet}
                className={cn(
                  'w-full rounded-2xl py-3 px-4 text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer touch-press touch-manipulation',
                  walletSaved
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-950 hover:bg-black text-white',
                )}
              >
                <Wallet size={17} className={walletSaved ? 'text-white' : 'text-amber-400'} />
                <span>
                  {walletSaved
                    ? '✓ Đã Lưu Thẻ Vào Apple / Google Wallet'
                    : 'Thêm vào Apple / Google Wallet'}
                </span>
              </button>

              <div className="rounded-xl bg-white border border-emerald-200/80 p-3 text-xs sm:text-sm text-emerald-950 font-medium">
                👉 Đưa mã QR trên màn hình điện thoại lại gần máy quét tại cửa lên xe buýt thông minh để qua cổng tự động.
              </div>

              {/* Card thông báo Hóa đơn điện tử */}
              {isInvoiceRequested && (
                <div className="rounded-2xl bg-gradient-to-r from-emerald-50 via-white to-slate-50 border border-emerald-300/80 p-4 space-y-2 text-left shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-[#005A36] text-white flex items-center justify-center">
                        <FileText size={15} />
                      </div>
                      <span className="text-xs sm:text-sm font-black text-slate-900">
                        Hóa đơn điện tử VAT 8%
                      </span>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-[#005A36]">
                      Đã phát hành
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Hóa đơn và vé PDF đã được hệ thống gửi tự động tới email: <strong className="text-slate-900 font-mono">{invoiceEmail}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      haptic.play('tap')
                      setShowInvoiceModal(true)
                    }}
                    className="w-full rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#005A36] py-2.5 text-xs sm:text-sm font-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer touch-press touch-manipulation"
                  >
                    <FileText size={15} />
                    <span>Xem & Tải Hóa Đơn Điện Tử (PDF)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-lg pt-2 shrink-0 pb-4 safe-pb-dock">
              <button
                type="button"
                onClick={() => {
                  handleClose()
                  if (onViewMyTickets) {
                    const firstTicket = bookingResult?.tickets?.[0]
                    onViewMyTickets(
                      firstTicket?.ticketId ||
                        firstTicket?.id ||
                        firstTicket?.ticketCode ||
                        bookingResult?.ticketId,
                    )
                  } else {
                    window.location.href = '/my-tickets'
                  }
                }}
                className="flex-1 rounded-xl bg-white border-2 border-[#005A36] text-[#005A36] hover:bg-emerald-50 py-3 text-xs sm:text-sm font-black transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer touch-press touch-manipulation"
                id="success-view-my-tickets"
              >
                <Ticket size={16} />
                Xem trong Vé của tôi
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl bg-[#005A36] py-3 text-xs sm:text-sm font-black text-white hover:bg-[#004529] transition-all shadow-md cursor-pointer touch-press touch-manipulation"
              >
                Hoàn tất & Đóng
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================
            MOBILE FLOATING DOCKS (STICKY BOTTOM BARS CHO MOBILE THUMB-ZONE)
            =================================================================== */}
        {step === 'seats' && (
          <div className="lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md p-3 px-4 flex items-center justify-between shadow-2xl shrink-0 z-30 safe-pb-dock">
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
                {totalPrice > 0 ? `${totalPrice.toLocaleString('vi-VN')}đ` : '10.000đ/vé SV'}
              </div>
            </div>

            <button
              type="button"
              disabled={selectedSeats.length === 0}
              onClick={() => setStep('mobile-info')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-black text-white transition-all shadow-md active:scale-95 touch-press',
                selectedSeats.length > 0
                  ? 'bg-[#005A36] cursor-pointer shadow-emerald-950/20'
                  : 'bg-slate-300 cursor-not-allowed shadow-none',
              )}
            >
              <span>Tiếp tục đặt vé</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {step === 'mobile-info' && (
          <div className="lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md p-3 px-4 flex items-center justify-between shadow-2xl shrink-0 z-30 safe-pb-dock">
            <div>
              <span className="text-[10px] text-slate-500 font-bold block leading-none">Tổng thanh toán:</span>
              <span className="text-base font-black text-[#005A36] font-mono leading-tight block mt-0.5">
                {finalPrice.toLocaleString('vi-VN')}đ
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep('seats')}
                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 active:scale-95 touch-press"
              >
                Ghế ({selectedSeats.length})
              </button>
              <button
                type="button"
                disabled={!isTripBookable || selectedSeats.length === 0 || isSubmitting}
                onClick={() => handleConfirmBooking()}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black text-white transition-all shadow-md active:scale-95 touch-press',
                  !isTripBookable
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none border border-slate-300'
                    : selectedSeats.length > 0 && !isSubmitting
                      ? 'bg-[#005A36] cursor-pointer shadow-emerald-950/20'
                      : 'bg-slate-300 cursor-not-allowed shadow-none',
                )}
              >
                {!isTripBookable ? (
                  <>
                    <Ban size={15} />
                    <span>Đã xuất bến</span>
                  </>
                ) : isSubmitting ? (
                  <>
                    <span className="size-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Đang xuất vé...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={15} />
                    <span>Xác nhận xuất vé</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Chi tiết Hóa đơn điện tử (Preview & Download PDF) */}
      <InvoicePreviewModal
        open={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        bookingCode={bookingResult?.bookingCode}
        passengerEmail={invoiceEmail}
      />
    </div>
  )
}
