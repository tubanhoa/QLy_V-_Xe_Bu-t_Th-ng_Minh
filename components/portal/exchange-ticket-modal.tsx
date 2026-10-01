'use client'

/**
 * Modal đổi vé 3 bước chuyên nghiệp:
 *   Bước 1: Chọn ngày & chuyến xe thay thế (GET /booking/tickets/:id/exchange-trips)
 *   Bước 2: Chọn ghế mới & Tạm giữ chỗ 10 phút (POST /booking/tickets/:id/hold-exchange-seat)
 *   Bước 3: Xác nhận đổi chuyến, tính chênh lệch & nhận vé mới (POST /booking/tickets/:id/confirm-exchange)
 * Thiết kế giao diện Light Theme ICTU Transit (#005A36)
 */

import { useState, useEffect, useMemo } from 'react'
import {
  X,
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Bus,
  Armchair,
  AlertTriangle,
  Info,
  Calendar,
  Clock,
  Clock3,
  CreditCard,
  ShieldCheck,
  Check,
} from 'lucide-react'
import { exchangeService } from '@/lib/services/exchange.service'
import type {
  ExchangeStep,
  ExchangeTripItem,
  ConfirmExchangeResult,
} from '@/lib/types/exchange'

interface ExchangeTicketModalProps {
  ticketId: string | null
  ticketCode?: string
  currentSeatNumber?: string
  currentTripId?: string
  currentDepartureTime?: string
  currentPrice?: number
  routeName?: string
  onClose: () => void
  onSuccess?: (result?: ConfirmExchangeResult) => void
}

// Danh sách 28 ghế tiêu chuẩn
const SEATS_LAYOUT = [
  ['01A', '01B', '01C', '01D'],
  ['02A', '02B', '02C', '02D'],
  ['03A', '03B', '03C', '03D'],
  ['04A', '04B', '04C', '04D'],
  ['05A', '05B', '05C', '05D'],
  ['06A', '06B', '06C', '06D'],
  ['07A', '07B', '07C', '07D'],
]

export function ExchangeTicketModal({
  ticketId,
  ticketCode,
  currentSeatNumber = '01A',
  currentDepartureTime,
  currentPrice = 10000,
  routeName = 'ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên',
  onClose,
  onSuccess,
}: ExchangeTicketModalProps) {
  const [step, setStep] = useState<ExchangeStep>('select-trip')
  const [selectedDate, setSelectedDate] = useState(() => {
    if (currentDepartureTime) {
      try {
        return new Date(currentDepartureTime).toISOString().split('T')[0]
      } catch {
        // fallback
      }
    }
    return new Date().toISOString().split('T')[0]
  })

  // Dữ liệu chuyến xe thay thế
  const [tripsLoading, setTripsLoading] = useState(false)
  const [availableTrips, setAvailableTrips] = useState<ExchangeTripItem[]>([])
  const [selectedTrip, setSelectedTrip] = useState<ExchangeTripItem | null>(null)

  // Dữ liệu chọn ghế & giữ chỗ
  const [selectedSeat, setSelectedSeat] = useState<string>('')
  const [holdingSeat, setHoldingSeat] = useState(false)
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null)
  const [holdSecondsLeft, setHoldSecondsLeft] = useState<number>(600) // 10 phút

  // Dữ liệu xác nhận & thanh toán chênh lệch
  const [paymentMethod, setPaymentMethod] = useState<'vnpay' | 'vietqr' | 'momo' | 'cash'>('vnpay')
  const [submitting, setSubmitting] = useState(false)
  const [exchangeResult, setExchangeResult] = useState<ConfirmExchangeResult | null>(null)
  const [error, setError] = useState('')

  // 1. Tải danh sách chuyến xe cùng tuyến
  useEffect(() => {
    if (!ticketId) return
    let active = true
    setTripsLoading(true)
    setError('')

    exchangeService
      .getExchangeTrips(ticketId, selectedDate)
      .then((res) => {
        if (!active) return
        setTripsLoading(false)
        if (res.success && res.data) {
          setAvailableTrips(res.data.availableTrips || [])
          if (res.data.availableTrips?.length > 0) {
            setSelectedTrip(res.data.availableTrips[0])
          } else {
            setSelectedTrip(null)
          }
        } else {
          setError(res.message || 'Không thể tải danh sách chuyến đổi')
        }
      })
      .catch((e) => {
        if (!active) return
        setTripsLoading(false)
        setError('Lỗi khi tải danh sách chuyến xe')
      })

    return () => {
      active = false
    }
  }, [ticketId, selectedDate])

  // 2. Countdown đếm ngược khi giữ chỗ
  useEffect(() => {
    if (!holdExpiresAt) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000))
      setHoldSecondsLeft(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        setError('Hết thời gian 10 phút giữ chỗ. Vui lòng chọn lại ghế mới.')
        setHoldExpiresAt(null)
        setStep('select-seat')
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [holdExpiresAt])

  const STEPS: ExchangeStep[] = ['select-trip', 'select-seat', 'confirm']
  const stepIndex = STEPS.indexOf(step)
  const STEP_LABELS: Record<ExchangeStep, string> = {
    'select-trip': '1. Chuyến Mới',
    'select-seat': '2. Ghế Mới (Giữ Chỗ 10p)',
    confirm: '3. Xác Nhận & Cấp QR',
  }

  // Tạm giữ chỗ 10 phút
  const handleHoldSeat = async () => {
    if (!ticketId || !selectedTrip || !selectedSeat) {
      setError('Vui lòng chọn một vị trí ghế trống trên chuyến mới')
      return
    }
    setHoldingSeat(true)
    setError('')

    const res = await exchangeService.holdExchangeSeat(
      ticketId,
      selectedTrip.tripId,
      selectedSeat,
    )
    setHoldingSeat(false)

    if (res.success && res.data) {
      setHoldExpiresAt(res.data.holdExpiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString())
      setHoldSecondsLeft(600)
      setStep('confirm')
    } else {
      setError(res.message || 'Không thể tạm giữ ghế này. Vui lòng thử chọn ghế khác.')
    }
  }

  // Xác nhận đổi vé
  const handleConfirmExchange = async () => {
    if (!ticketId || !selectedTrip || !selectedSeat) return
    setSubmitting(true)
    setError('')

    const payload = {
      newTripId: selectedTrip.tripId,
      newSeatId: selectedSeat,
      newDepartureTime: selectedTrip.departureTime,
      vehiclePlate: selectedTrip.vehiclePlate,
      paymentMethod,
    }

    const res = await exchangeService.confirmExchange(ticketId, payload)
    setSubmitting(false)

    if (res.success && res.data) {
      setExchangeResult(res.data)
      setTimeout(() => {
        onSuccess?.(res.data)
        onClose()
      }, 2500)
    } else {
      setError(res.message || 'Không thể hoàn tất đổi chuyến. Vui lòng kiểm tra lại điều kiện.')
    }
  }

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--'
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
    } catch {
      return isoString.substring(11, 16)
    }
  }

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Tính chênh lệch giá
  const priceDiff = useMemo(() => {
    if (!selectedTrip) return 0
    const newTotal = (selectedTrip.tripPrice || currentPrice) + (selectedTrip.exchangeFee || 0)
    return newTotal - currentPrice
  }, [selectedTrip, currentPrice])

  if (!ticketId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 overscroll-contain animate-in fade-in duration-150 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Đổi vé xe buýt thông minh"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col will-change-transform animate-slideUp">
        {/* Mobile Pull-down indicator */}
        <div className="sm:hidden w-full flex justify-center pt-2.5 pb-1 shrink-0 bg-gradient-to-r from-emerald-50/90 via-white to-slate-50">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-gradient-to-r from-emerald-50/90 via-white to-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[#005A36] text-white shadow-sm shrink-0">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">Đổi Chuyến & Ghế Mới</h2>
                <span className="rounded-full bg-emerald-100 text-[#005A36] px-2 py-0.5 text-[10px] font-black uppercase">
                  3 Bước Nhanh
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {ticketCode ? `Vé gốc: ${ticketCode}` : 'Hệ thống đổi vé tự động ICTU'} · Ghế hiện tại: <strong>{currentSeatNumber}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stepper bar */}
        <div className="px-5 pt-3 pb-1 border-b border-slate-100 bg-slate-50/60">
          <div className="flex rounded-xl bg-slate-200/70 p-1 text-[11px] font-bold">
            {STEPS.map((s, idx) => (
              <div
                key={s}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  s === step
                    ? 'bg-white text-[#005A36] shadow-xs font-black'
                    : idx < stepIndex
                    ? 'text-emerald-700 font-bold'
                    : 'text-slate-400'
                }`}
              >
                {STEP_LABELS[s]}
              </div>
            ))}
          </div>
        </div>

        {/* Thanh đếm ngược giữ chỗ (khi đang ở bước 3) */}
        {step === 'confirm' && holdExpiresAt && (
          <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs font-bold text-amber-900">
            <span className="flex items-center gap-1.5">
              <Clock3 className="w-4 h-4 text-amber-600 animate-spin" />
              Đang giữ ghế mới <strong className="text-[#005A36] underline">{selectedSeat}</strong> trong:
            </span>
            <span className="font-mono text-sm px-2.5 py-0.5 rounded-lg bg-amber-200/80 text-amber-950 font-black">
              {formatCountdown(holdSecondsLeft)}
            </span>
          </div>
        )}

        {/* Body content scrollable */}
        <div className="p-4 sm:p-5 overflow-y-auto scroll-touch space-y-4 text-slate-700 text-xs">
          {/* Thông báo thành công */}
          {exchangeResult ? (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-[#005A36] animate-bounce">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900">Đổi Chuyến & Ghế Thành Công!</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                  Vé mới với ghế <strong>{exchangeResult.newSeatNumber}</strong> và mã QR chữ ký số mới đã được phát hành.
                </p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 max-w-sm mx-auto text-[11px] text-emerald-800">
                Email vé mới kèm mã QR đã được gửi tự động tới hộp thư của bạn. Đang đóng và làm mới dữ liệu...
              </div>
            </div>
          ) : (
            <>
              {/* BƯỚC 1: CHỌN NGÀY & CHUYẾN XE MỚI */}
              {step === 'select-trip' && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-900">
                        Chọn Ngày Muốn Đi
                      </label>
                      <span className="text-[11px] text-slate-500">{routeName}</span>
                    </div>
                    <div className="relative">
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 outline-none focus:border-[#005A36] focus:ring-2 focus:ring-[#005A36]/10"
                      />
                    </div>
                  </div>

                  {/* Danh sách chuyến xe */}
                  <div className="space-y-2 pt-1">
                    <label className="block text-xs font-extrabold text-slate-900">
                      Các Chuyến Xe Thay Thế Trong Ngày
                    </label>

                    {tripsLoading ? (
                      <div className="p-8 text-center space-y-2">
                        <Loader2 className="w-6 h-6 animate-spin text-[#005A36] mx-auto" />
                        <p className="text-xs text-slate-500">Đang tìm các chuyến xe cùng tuyến...</p>
                      </div>
                    ) : availableTrips.length === 0 ? (
                      <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-500 space-y-1">
                        <Bus className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="font-bold text-xs text-slate-700">Không tìm thấy chuyến xe nào khác</p>
                        <p className="text-[11px]">Vui lòng chọn một ngày khác để tìm chuyến đổi thích hợp.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                        {availableTrips.map((t) => {
                          const isSelected = selectedTrip?.tripId === t.tripId
                          return (
                            <div
                              key={t.tripId}
                              onClick={() => setSelectedTrip(t)}
                              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'border-[#005A36] bg-emerald-50/60 shadow-xs ring-1 ring-[#005A36]'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                              }`}
                            >
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black text-slate-900">
                                    {formatTime(t.departureTime)}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold">
                                    Xe: {t.vehiclePlate || '20B-012.34'}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold">
                                    Còn {t.availableSeats} chỗ
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 truncate">
                                  {t.origin || 'ĐH CNTT & TT (ICTU)'} ➔ {t.destination || 'Bến Xe Trung Tâm'}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div className="text-xs font-black text-[#005A36]">
                                  {formatPrice(t.tripPrice)}
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium">
                                  Phí đổi: {formatPrice(t.exchangeFee || 0)}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* BƯỚC 2: CHỌN GHẾ MỚI & TẠM GIỮ CHỖ 10 PHÚT */}
              {step === 'select-seat' && selectedTrip && (
                <div className="space-y-3.5">
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-emerald-800 font-medium">Chuyến đã chọn:</div>
                      <div className="text-xs font-bold text-slate-900">
                        Khởi hành lúc {formatTime(selectedTrip.departureTime)} · Xe {selectedTrip.vehiclePlate || '20B-012.34'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep('select-trip')}
                      className="text-xs text-[#005A36] font-bold underline cursor-pointer"
                    >
                      Đổi chuyến
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-extrabold text-slate-900">
                        Chọn Vị Trí Ghế Trống Trên Chuyến Mới
                      </label>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="size-3 rounded-md bg-white border border-slate-300 inline-block" />
                          Trống
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="size-3 rounded-md bg-[#005A36] inline-block" />
                          Đang chọn
                        </span>
                      </div>
                    </div>

                    {/* Sơ đồ ghế 28 chỗ */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 max-h-[260px] overflow-y-auto">
                      <div className="text-center text-[10px] font-bold text-slate-400 pb-2 uppercase tracking-widest border-b border-slate-200/80 mb-3">
                        Đầu Xe (Tài xế)
                      </div>
                      <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
                        {SEATS_LAYOUT.flat().map((seatNum) => {
                          const isCurrent = seatNum === currentSeatNumber
                          const isSelected = seatNum === selectedSeat
                          return (
                            <button
                              key={seatNum}
                              type="button"
                              disabled={isCurrent}
                              onClick={() => setSelectedSeat(seatNum)}
                              className={`py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                                isCurrent
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                                  : isSelected
                                  ? 'bg-[#005A36] text-white shadow-xs font-black ring-2 ring-[#005A36]/30'
                                  : 'bg-white hover:border-[#005A36] hover:bg-emerald-50/50 border border-slate-200 text-slate-800'
                              }`}
                            >
                              <Armchair size={14} className={isSelected ? 'text-white' : 'text-slate-400'} />
                              <span>{seatNum}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-2.5 text-amber-900 flex items-start gap-2 text-[11px]">
                      <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <span>
                        Ghế cũ <strong>{currentSeatNumber}</strong> của bạn vẫn được <strong>bảo toàn tuyệt đối</strong> trong suốt quá trình đổi chuyến này.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* BƯỚC 3: XÁC NHẬN ĐỔI CHUYẾN & THANH TOÁN CHÊNH LỆCH */}
              {step === 'confirm' && selectedTrip && (
                <div className="space-y-3.5">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                    <h4 className="font-extrabold text-xs uppercase tracking-tight text-slate-900">
                      Tóm Tắt Đổi Vé
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Vé Hiện Tại</span>
                        <div className="font-bold text-slate-900">Ghế {currentSeatNumber}</div>
                        <div className="text-[11px] text-slate-500">{formatTime(currentDepartureTime)}</div>
                        <div className="text-xs font-black text-slate-800">{formatPrice(currentPrice)}</div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-300 space-y-1">
                        <span className="text-[10px] font-bold text-[#005A36] uppercase">Vé Mới Đổi Sang</span>
                        <div className="font-bold text-[#005A36]">Ghế {selectedSeat}</div>
                        <div className="text-[11px] text-slate-600">{formatTime(selectedTrip.departureTime)}</div>
                        <div className="text-xs font-black text-[#005A36]">{formatPrice(selectedTrip.tripPrice)}</div>
                      </div>
                    </div>

                    {/* Bảng chi phí chênh lệch */}
                    <div className="border-t border-slate-200/80 pt-2 space-y-1.5 text-[11px]">
                      <div className="flex justify-between text-slate-500">
                        <span>Phí đổi chuyến theo quy định:</span>
                        <span className="font-bold text-slate-800">{formatPrice(selectedTrip.exchangeFee || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-black pt-1 border-t border-slate-200 text-slate-900">
                        <span>Tổng tiền chênh lệch cần thanh toán:</span>
                        <span className="text-sm text-[#005A36]">{formatPrice(Math.max(0, priceDiff))}</span>
                      </div>
                    </div>
                  </div>

                  {/* Chọn phương thức nếu chênh lệch > 0 */}
                  {priceDiff > 0 && (
                    <div className="space-y-2">
                      <label className="block text-xs font-extrabold text-slate-900">
                        Chọn Phương Thức Thanh Toán Khoản Chênh Lệch
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'vnpay', name: 'VNPay QR / Thẻ', icon: CreditCard },
                          { id: 'vietqr', name: 'VietQR Chuyển khoản', icon: CreditCard },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setPaymentMethod(m.id as any)}
                            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                              paymentMethod === m.id
                                ? 'border-[#005A36] bg-emerald-50 text-[#005A36] font-black ring-1 ring-[#005A36]'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <m.icon size={15} />
                            <span>{m.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Lỗi hiển thị nếu có */}
              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex items-start gap-2 text-rose-700 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Hàng nút bấm điều hướng */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 safe-pb-dock">
                {step !== 'select-trip' && (
                  <button
                    type="button"
                    onClick={() => {
                      setError('')
                      if (step === 'select-seat') setStep('select-trip')
                      if (step === 'confirm') setStep('select-seat')
                    }}
                    className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer touch-press touch-manipulation active:scale-95"
                  >
                    <ArrowLeft size={14} />
                    <span>Quay lại</span>
                  </button>
                )}

                {step === 'select-trip' && (
                  <button
                    type="button"
                    disabled={!selectedTrip}
                    onClick={() => {
                      if (!selectedTrip) {
                        setError('Vui lòng chọn một chuyến xe thay thế')
                        return
                      }
                      setError('')
                      setStep('select-seat')
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-[#005A36] text-white text-xs font-bold hover:bg-[#00472b] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs touch-press touch-manipulation active:scale-95"
                  >
                    <span>Tiếp tục chọn ghế mới</span>
                    <ArrowRight size={14} />
                  </button>
                )}

                {step === 'select-seat' && (
                  <button
                    type="button"
                    disabled={!selectedSeat || holdingSeat}
                    onClick={handleHoldSeat}
                    className="flex-1 py-2.5 rounded-xl bg-[#005A36] text-white text-xs font-bold hover:bg-[#00472b] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs touch-press touch-manipulation active:scale-95"
                  >
                    {holdingSeat ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                    <span>Tạm giữ ghế này 10 phút</span>
                    <ArrowRight size={14} />
                  </button>
                )}

                {step === 'confirm' && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleConfirmExchange}
                    className="flex-1 py-2.5 rounded-xl bg-[#005A36] text-white text-xs font-black hover:bg-[#00472b] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm touch-press touch-manipulation active:scale-95"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check size={16} />
                    )}
                    <span>Xác nhận đổi chuyến & Nhận vé mới</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
