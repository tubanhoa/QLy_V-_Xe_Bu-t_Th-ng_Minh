'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Armchair,
  ArrowRight,
  BatteryCharging,
  Bus,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  CreditCard,
  Download,
  Info,
  Lock,
  LogIn,
  MapPin,
  QrCode,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Wifi,
  Wind,
  X,
  Zap,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

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

interface SeatInfo {
  id: string
  number: string
  status: 'available' | 'occupied' | 'priority'
  row: number
  column: 'A' | 'B' | 'C' | 'D'
}

// Danh sách chuẩn 28 ghế (7 hàng x 4 ghế: 2 bên trái - lối đi - 2 bên phải)
const SEATS_28: SeatInfo[] = [
  // Hàng 1 (Ưu tiên người già, khuyết tật, phụ nữ mang thai)
  { id: '01A', number: '01A', status: 'occupied', row: 1, column: 'A' },
  { id: '01B', number: '01B', status: 'occupied', row: 1, column: 'B' },
  { id: '01C', number: '01C', status: 'priority', row: 1, column: 'C' },
  { id: '01D', number: '01D', status: 'priority', row: 1, column: 'D' },

  // Hàng 2
  { id: '02A', number: '02A', status: 'occupied', row: 2, column: 'A' },
  { id: '02B', number: '02B', status: 'available', row: 2, column: 'B' },
  { id: '02C', number: '02C', status: 'available', row: 2, column: 'C' },
  { id: '02D', number: '02D', status: 'occupied', row: 2, column: 'D' },

  // Hàng 3
  { id: '03A', number: '03A', status: 'occupied', row: 3, column: 'A' },
  { id: '03B', number: '03B', status: 'available', row: 3, column: 'B' },
  { id: '03C', number: '03C', status: 'occupied', row: 3, column: 'C' },
  { id: '03D', number: '03D', status: 'available', row: 3, column: 'D' },

  // Hàng 4
  { id: '04A', number: '04A', status: 'available', row: 4, column: 'A' },
  { id: '04B', number: '04B', status: 'occupied', row: 4, column: 'B' },
  { id: '04C', number: '04C', status: 'occupied', row: 4, column: 'C' },
  { id: '04D', number: '04D', status: 'available', row: 4, column: 'D' },

  // Hàng 5
  { id: '05A', number: '05A', status: 'occupied', row: 5, column: 'A' },
  { id: '05B', number: '05B', status: 'available', row: 5, column: 'B' },
  { id: '05C', number: '05C', status: 'available', row: 5, column: 'C' },
  { id: '05D', number: '05D', status: 'occupied', row: 5, column: 'D' },

  // Hàng 6
  { id: '06A', number: '06A', status: 'occupied', row: 6, column: 'A' },
  { id: '06B', number: '06B', status: 'occupied', row: 6, column: 'B' },
  { id: '06C', number: '06C', status: 'available', row: 6, column: 'C' },
  { id: '06D', number: '06D', status: 'available', row: 6, column: 'D' },

  // Hàng 7 (Hàng cuối)
  { id: '07A', number: '07A', status: 'available', row: 7, column: 'A' },
  { id: '07B', number: '07B', status: 'available', row: 7, column: 'B' },
  { id: '07C', number: '07C', status: 'available', row: 7, column: 'C' },
  { id: '07D', number: '07D', status: 'available', row: 7, column: 'D' },
]

export function SeatPickerModal({
  open,
  onClose,
  initialOrigin = 'KTX ICTU',
  initialDestination = 'Bến xe Đồng Quang',
  selectedTrip = null,
}: SeatPickerModalProps) {
  const { isAuthenticated, user } = useAuth()
  const [step, setStep] = useState<'seats' | 'info' | 'ticket'>('seats')
  const [selectedSeats, setSelectedSeats] = useState<string[]>(['02B'])
  const [selectedTripTime, setSelectedTripTime] = useState('07:45')
  const [passengerName, setPassengerName] = useState(user?.fullName || user?.name || '')
  const [phone, setPhone] = useState(user?.phoneNumber || '')
  const [paymentMethod, setPaymentMethod] = useState<'vnpay' | 'momo' | 'ictupay'>('vnpay')

  useEffect(() => {
    if (user) {
      if (user.fullName || user.name) setPassengerName(user.fullName || user.name)
      if (user.phoneNumber) setPhone(user.phoneNumber)
    }
  }, [user])

  if (!open) return null

  const originName = selectedTrip?.origin || initialOrigin
  const destinationName = selectedTrip?.destination || initialDestination
  const basePrice = selectedTrip ? Number(selectedTrip.basePrice) : 10000
  const isStudent = user?.role === 'STUDENT' || Boolean(user?.studentId)
  const studentPrice = selectedTrip ? Number(selectedTrip.studentPrice) : 5000
  const effectivePricePerSeat = isStudent ? studentPrice : basePrice
  const totalPrice = selectedSeats.length * effectivePricePerSeat
  const totalStandardPrice = selectedSeats.length * basePrice
  const totalSavings = totalStandardPrice - totalPrice

  const toggleSeat = (id: string, status: string) => {
    if (status === 'occupied') return
    setSelectedSeats((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault()
    setStep('ticket')
  }

  const handleClose = () => {
    onClose()
    setTimeout(() => {
      setStep('seats')
      setSelectedSeats(['02B'])
    }, 250)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-100 bg-white shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
        {/* Step Indicator Header */}
        <div className="border-b border-slate-100 px-6 py-4 bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/80 sticky top-0 z-20 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#005A36] text-white shadow-md shadow-emerald-900/10">
              <Bus size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-[#005A36] tracking-wider uppercase">
                  {selectedTrip ? selectedTrip.routeCode : 'ICTU TRANSIT'}
                </span>
                <span className="size-1 rounded-full bg-slate-300" />
                <span className="text-xs font-bold text-slate-700">Xe Buýt Điện 28 Chỗ</span>
              </div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                {step === 'seats' && 'Sơ Đồ Ghế & Đặt Chỗ Trực Quan'}
                {step === 'info' && 'Xác Nhận Hành Khách & Thanh Toán'}
                {step === 'ticket' && 'Vé Điện Tử & Thẻ Lên Xe QR'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Step badges */}
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold">
              <span
                className={cn(
                  'size-6 rounded-full flex items-center justify-center transition-all',
                  step === 'seats'
                    ? 'bg-[#005A36] text-white shadow-xs'
                    : 'bg-emerald-100 text-[#005A36]',
                )}
              >
                1
              </span>
              <span className="h-0.5 w-3 bg-slate-200" />
              <span
                className={cn(
                  'size-6 rounded-full flex items-center justify-center transition-all',
                  step === 'info'
                    ? 'bg-[#005A36] text-white shadow-xs'
                    : step === 'ticket'
                    ? 'bg-emerald-100 text-[#005A36]'
                    : 'bg-slate-100 text-slate-400',
                )}
              >
                2
              </span>
              <span className="h-0.5 w-3 bg-slate-200" />
              <span
                className={cn(
                  'size-6 rounded-full flex items-center justify-center transition-all',
                  step === 'ticket'
                    ? 'bg-[#005A36] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-400',
                )}
              >
                3
              </span>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors ml-2"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Step 1: Seat Selection with Bus Chassis Frame */}
        {step === 'seats' && (
          <div className="p-5 sm:p-6 space-y-5">
            {/* Route Summary Pill */}
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <MapPin size={16} className="text-[#005A36] shrink-0" />
                <div>
                  <span className="font-extrabold text-slate-900 block sm:inline">
                    {originName}
                  </span>
                  <span className="text-slate-400 mx-1.5 font-bold hidden sm:inline">➔</span>
                  <span className="font-extrabold text-[#005A36] block sm:inline">
                    {destinationName}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600 shrink-0">
                <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 shadow-xs border border-emerald-100">
                  <Clock size={11} className="text-emerald-700" />
                  <span>
                    {selectedTrip
                      ? new Date(selectedTrip.departureTime).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })
                      : selectedTripTime}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 shadow-xs border border-emerald-100">
                  <Zap size={11} className="text-emerald-700" />
                  <span>{selectedTrip?.vehiclePlate || '20B-EV'}</span>
                </span>
              </div>
            </div>

            {/* Guest Auth Reminder */}
            {!isAuthenticated && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-3 text-xs text-amber-900 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <Lock size={15} className="text-amber-600 shrink-0" />
                  <span>Khách vãng lai cần đăng nhập để xác nhận giữ chỗ và nhận mã vé QR.</span>
                </div>
                <Link
                  href="/login?redirect=/"
                  className="rounded-xl bg-[#005A36] px-3.5 py-1.5 font-bold text-white text-xs hover:bg-[#004529] shrink-0 shadow-xs"
                >
                  Đăng nhập
                </Link>
              </div>
            )}

            {/* Bus Chassis Container */}
            <div className="rounded-3xl border-2 border-slate-200 bg-slate-50/80 p-4 sm:p-5 relative overflow-hidden shadow-inner">
              {/* Bus Windshield & Cockpit Area */}
              <div className="relative mb-5 pb-4 border-b border-dashed border-slate-200">
                <div className="w-full rounded-2xl bg-gradient-to-b from-sky-100 via-sky-50 to-white p-3 border border-sky-200/80 flex items-center justify-between shadow-xs">
                  {/* Driver Cockpit */}
                  <div className="flex items-center gap-2">
                    <div className="size-9 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-xs">
                      <Compass size={18} className="animate-spin-slow" />
                    </div>
                    <div>
                      <span className="text-[11px] font-black text-slate-900 block">Buồng Lái Bác Tài ICTU</span>
                      <span className="text-[10px] text-slate-500 font-medium">Camera AI giám sát an toàn</span>
                    </div>
                  </div>

                  {/* Front Entry Door */}
                  <div className="flex items-center gap-1 rounded-lg bg-emerald-100/80 border border-emerald-300 px-2.5 py-1 text-[10px] font-black text-[#005A36]">
                    <span>CỬA LÊN XE ↑</span>
                  </div>
                </div>
              </div>

              {/* Seat Legend */}
              <div className="mb-4 flex flex-wrap items-center justify-center gap-3 text-[11px] font-bold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="size-3.5 rounded-md border border-emerald-400 bg-white shadow-2xs" /> Ghế Trống
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3.5 rounded-md bg-[#005A36] shadow-2xs" /> Đang Chọn
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3.5 rounded-md bg-slate-300 text-slate-400" /> Đã Bán
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3.5 rounded-md border border-amber-400 bg-amber-50" /> Ưu Tiên
                </span>
              </div>

              {/* 28-Seat Bus Grid (7 Rows: 2 Left, Center Aisle, 2 Right) */}
              <div className="space-y-2 max-w-sm mx-auto">
                {[1, 2, 3, 4, 5, 6, 7].map((rowNum) => {
                  const seatA = SEATS_28.find((s) => s.row === rowNum && s.column === 'A')!
                  const seatB = SEATS_28.find((s) => s.row === rowNum && s.column === 'B')!
                  const seatC = SEATS_28.find((s) => s.row === rowNum && s.column === 'C')!
                  const seatD = SEATS_28.find((s) => s.row === rowNum && s.column === 'D')!

                  const renderSeatButton = (seat: SeatInfo) => {
                    const isSelected = selectedSeats.includes(seat.id)
                    const isOccupied = seat.status === 'occupied'
                    const isPriority = seat.status === 'priority'

                    return (
                      <button
                        key={seat.id}
                        type="button"
                        disabled={isOccupied}
                        onClick={() => toggleSeat(seat.id, seat.status)}
                        className={cn(
                          'relative flex flex-col items-center justify-center size-11 sm:size-12 rounded-xl font-mono text-xs font-black transition-all active:scale-95 shadow-xs group',
                          isSelected
                            ? 'bg-[#005A36] text-white ring-2 ring-emerald-600 shadow-md shadow-emerald-900/20'
                            : isOccupied
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-transparent'
                            : isPriority
                            ? 'bg-amber-50 border border-amber-300 text-amber-900 hover:border-amber-400'
                            : 'bg-white border border-emerald-200 text-emerald-900 hover:border-[#005A36] hover:bg-emerald-50/50',
                        )}
                      >
                        {/* Headrest Pill */}
                        <span
                          className={cn(
                            'h-1 w-5 rounded-full mb-1 transition-colors',
                            isSelected
                              ? 'bg-emerald-300'
                              : isOccupied
                              ? 'bg-slate-300'
                              : isPriority
                              ? 'bg-amber-300'
                              : 'bg-emerald-200',
                          )}
                        />
                        <div className="flex items-center gap-0.5">
                          {isSelected ? (
                            <Check size={12} strokeWidth={3} className="text-white" />
                          ) : (
                            <span>{seat.number}</span>
                          )}
                        </div>
                      </button>
                    )
                  }

                  return (
                    <div key={rowNum} className="flex items-center justify-between gap-2">
                      {/* Left Pair (A & B) */}
                      <div className="flex items-center gap-1.5">
                        {renderSeatButton(seatA)}
                        {renderSeatButton(seatB)}
                      </div>

                      {/* Center Walking Aisle */}
                      <div className="flex-1 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest select-none">
                          {rowNum === 1 ? 'LỐI ĐI' : '•'}
                        </span>
                      </div>

                      {/* Right Pair (C & D) */}
                      <div className="flex items-center gap-1.5">
                        {renderSeatButton(seatC)}
                        {renderSeatButton(seatD)}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Rear Exit Door Area */}
              <div className="mt-4 pt-3 border-t border-dashed border-slate-200 flex items-center justify-between text-[10px] font-bold text-slate-500">
                <span>Đuôi xe buýt</span>
                <span className="rounded-lg bg-slate-200 px-2.5 py-1 text-slate-700">
                  CỬA XUỐNG XE ↓
                </span>
              </div>
            </div>

            {/* Selected Seats Floating Dock & Checkout Bar */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs">
                  <span className="text-slate-500 font-medium">Ghế đã chọn: </span>
                  {selectedSeats.length > 0 ? (
                    <div className="inline-flex flex-wrap gap-1.5 mt-1">
                      {selectedSeats.map((seatId) => (
                        <span
                          key={seatId}
                          onClick={() => toggleSeat(seatId, 'available')}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#005A36] text-white px-2.5 py-0.5 text-xs font-mono font-bold cursor-pointer hover:bg-rose-700 transition-colors shadow-xs"
                          title="Bấm để bỏ chọn ghế này"
                        >
                          {seatId} <X size={11} />
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-rose-500 font-bold">Chưa chọn ghế nào</span>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-lg sm:text-xl font-black text-[#005A36]">
                    {totalPrice.toLocaleString('vi-VN')} đ
                  </div>
                  {isStudent && totalSavings > 0 && (
                    <div className="text-[11px] font-bold text-emerald-700">
                      Tiết kiệm {totalSavings.toLocaleString('vi-VN')}đ (Ưu đãi SV -50%)
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  Hủy thao tác
                </button>

                {!isAuthenticated ? (
                  <Link
                    href="/login?redirect=/"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#005A36] px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md hover:bg-[#004529] active:scale-95 transition-all"
                  >
                    <LogIn size={15} />
                    <span>Đăng nhập để đặt vé</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={selectedSeats.length === 0}
                    onClick={() => setStep('info')}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#005A36] px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md hover:bg-[#004529] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Tiếp tục điền thông tin</span>
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Step 2: Passenger Info & Secured Payment */}
        {step === 'info' && (
          <form onSubmit={handleConfirmBooking} className="p-5 sm:p-6 space-y-5">
            <div>
              <span className="text-xs font-bold text-[#005A36] uppercase tracking-wider block mb-1">
                Bước 2/3: Xác nhận thông tin
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Thông Tin Hành Khách & Hình Thức Thanh Toán
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chuyến {selectedTrip ? `${new Date(selectedTrip.departureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} (${selectedTrip.routeCode})` : selectedTripTime} • Ghế {selectedSeats.join(', ')}
              </p>
            </div>

            {/* ICTU Student Verification Box */}
            {isStudent && (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-3.5 flex items-center justify-between text-xs text-emerald-950">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-[#005A36] text-white flex items-center justify-center font-black">
                    🎓
                  </div>
                  <div>
                    <span className="font-extrabold block">Xác thực Sinh viên ICTU hợp lệ</span>
                    <span className="text-[11px] text-emerald-800">
                      Mã SV: <strong>{user?.studentId || 'DTC215180001'}</strong> · Đã áp dụng giảm giá 50%
                    </span>
                  </div>
                </div>
                <span className="rounded-full bg-[#005A36] px-2.5 py-1 text-[10px] font-black text-white">
                  -50% TRỢ GIÁ
                </span>
              </div>
            )}

            {/* Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Họ và tên hành khách
                </label>
                <div className="relative flex items-center">
                  <User size={15} className="absolute left-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={passengerName}
                    onChange={(e) => setPassengerName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:border-[#005A36] focus:ring-2 focus:ring-[#005A36]/15"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Số điện thoại nhận vé SMS / Zalo
                </label>
                <div className="relative flex items-center">
                  <CreditCard size={15} className="absolute left-3 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0987654321"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:border-[#005A36] focus:ring-2 focus:ring-[#005A36]/15"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Cards */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Phương thức thanh toán bảo mật
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('vnpay')}
                  className={cn(
                    'rounded-2xl border p-3.5 text-left transition-all flex flex-col justify-between gap-2 shadow-2xs',
                    paymentMethod === 'vnpay'
                      ? 'border-[#005A36] bg-emerald-50/70 ring-2 ring-[#005A36]/20'
                      : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-xs text-slate-900">VNPay Sandbox</span>
                    <CreditCard size={16} className="text-[#005A36]" />
                  </div>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    Mã QR ngân hàng, Internet Banking, ATM
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('momo')}
                  className={cn(
                    'rounded-2xl border p-3.5 text-left transition-all flex flex-col justify-between gap-2 shadow-2xs',
                    paymentMethod === 'momo'
                      ? 'border-pink-500 bg-pink-50/70 ring-2 ring-pink-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-xs text-slate-900">Ví MoMo</span>
                    <CreditCard size={16} className="text-pink-600" />
                  </div>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    Thanh toán 1 chạm siêu nhanh qua app MoMo
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('ictupay')}
                  className={cn(
                    'rounded-2xl border p-3.5 text-left transition-all flex flex-col justify-between gap-2 shadow-2xs',
                    paymentMethod === 'ictupay'
                      ? 'border-teal-600 bg-teal-50/70 ring-2 ring-teal-600/20'
                      : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-xs text-slate-900">Thẻ SV ICTU Pay</span>
                    <Sparkles size={16} className="text-teal-600" />
                  </div>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    Trừ trực tiếp số dư tài khoản sinh viên
                  </span>
                </button>
              </div>
            </div>

            {/* Price Confirmation & Submit */}
            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500">Tổng thanh toán ({selectedSeats.length} vé):</span>
                <div className="text-lg font-black text-[#005A36]">
                  {totalPrice.toLocaleString('vi-VN')} đ
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep('seats')}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Quay lại
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#005A36] px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md hover:bg-[#004529] active:scale-95 transition-all"
                >
                  <ShieldCheck size={16} />
                  <span>Xác Nhận & Xuất Vé QR</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Modal Step 3: Airline-Style Electronic Boarding Pass */}
        {step === 'ticket' && (
          <div className="p-5 sm:p-6 flex flex-col items-center gap-5 text-center animate-in zoom-in-95 duration-200">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-[#005A36] shadow-sm">
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                Đặt Vé & Giữ Chỗ Thành Công!
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Vé điện tử đã được ghi nhận trên hệ thống trung tâm ICTU Transit và gửi mã xác nhận qua SMS tới <strong>{phone}</strong>
              </p>
            </div>

            {/* Boarding Pass Ticket Component */}
            <div className="w-full max-w-md rounded-3xl border border-emerald-300/80 bg-gradient-to-b from-emerald-50/50 via-white to-teal-50/40 p-5 shadow-xl relative overflow-hidden text-left">
              {/* Top Bar */}
              <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-[#005A36] text-white flex items-center justify-center text-xs font-black">
                    <Bus size={14} />
                  </div>
                  <div>
                    <span className="font-black text-xs text-slate-900 block leading-tight">ICTU SMART TRANSIT</span>
                    <span className="text-[10px] text-slate-400 font-mono">E-BOARDING PASS</span>
                  </div>
                </div>
                <span className="font-mono text-xs font-black text-[#005A36] bg-emerald-100/80 px-2 py-0.5 rounded-md">
                  TK-2026-ICTU
                </span>
              </div>

              {/* QR Code Frame */}
              <div className="my-4 flex flex-col items-center justify-center">
                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <QRCodeSVG
                    value={`https://transit.ictu.edu.vn/verify?ticket=TK-2026-ICTU&seats=${selectedSeats.join(',')}&time=${selectedTripTime}`}
                    size={148}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-400 mt-2">
                  Quét mã QR tại cửa lên xe buýt điện để check-in
                </span>
              </div>

              {/* Ticket Details */}
              <div className="grid grid-cols-2 gap-3 text-xs border-t border-dashed border-slate-200 pt-3">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Hành khách</span>
                  <p className="font-extrabold text-slate-900">{passengerName}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Vị trí ghế ngồi</span>
                  <p className="font-mono font-black text-sm text-[#005A36]">{selectedSeats.join(', ')}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Tuyến xe</span>
                  <p className="font-bold text-slate-900">{selectedTrip?.routeCode || 'CT-01'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Giờ xuất bến</span>
                  <p className="font-mono font-bold text-slate-900">
                    {selectedTrip
                      ? new Date(selectedTrip.departureTime).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })
                      : selectedTripTime}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Lộ trình</span>
                  <p className="font-semibold text-slate-800 text-[11px] truncate">
                    {originName} ➔ {destinationName}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Đóng cửa sổ
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#005A36] px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-[#004529] active:scale-95 transition-all"
              >
                <Download size={14} />
                <span>Tải vé về máy</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
