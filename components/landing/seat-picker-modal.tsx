'use client'

import { useState } from 'react'
import {
  Armchair,
  ArrowRight,
  Bus,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  MapPin,
  QrCode,
  ShieldCheck,
  User,
  X,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

interface SeatPickerModalProps {
  open: boolean
  onClose: () => void
  initialOrigin?: string
  initialDestination?: string
}

interface SeatInfo {
  id: string
  number: string
  status: 'available' | 'occupied' | 'priority'
}

const SEATS: SeatInfo[] = [
  { id: '01A', number: '01A', status: 'occupied' },
  { id: '01B', number: '01B', status: 'occupied' },
  { id: '02A', number: '02A', status: 'occupied' },
  { id: '02B', number: '02B', status: 'available' },
  { id: '03A', number: '03A', status: 'occupied' },
  { id: '03B', number: '03B', status: 'available' },
  { id: '04A', number: '04A', status: 'priority' },
  { id: '04B', number: '04B', status: 'occupied' },
  { id: '05A', number: '05A', status: 'occupied' },
  { id: '05B', number: '05B', status: 'available' },
  { id: '06A', number: '06A', status: 'occupied' },
  { id: '06B', number: '06B', status: 'occupied' },
  { id: '07A', number: '07A', status: 'available' },
  { id: '07B', number: '07B', status: 'available' },
]

export function SeatPickerModal({
  open,
  onClose,
  initialOrigin = 'KTX ICTU',
  initialDestination = 'Bến xe Đồng Quang',
}: SeatPickerModalProps) {
  const [step, setStep] = useState<'seats' | 'info' | 'ticket'>('seats')
  const [selectedSeats, setSelectedSeats] = useState<string[]>(['02B'])
  const [selectedTrip, setSelectedTrip] = useState('07:45')
  const [passengerName, setPassengerName] = useState('Nguyễn Hoàng Long')
  const [phone, setPhone] = useState('0981.234.567')
  const [paymentMethod, setPaymentMethod] = useState<'vnpay' | 'momo'>('vnpay')

  if (!open) return null

  const basePrice = 10000
  const totalPrice = selectedSeats.length * basePrice

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-5 top-5 flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
        >
          <X size={18} />
        </button>

        {/* Modal Steps */}
        {step === 'seats' && (
          <div className="flex flex-col gap-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <Bus size={13} /> Tuyến 01: Xe Buýt Điện Thông Minh
              </span>
              <h2 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Chọn Chuyến & Vị Trí Ghế Ngồi
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {initialOrigin} ⇄ {initialDestination}
              </p>
            </div>

            {/* Trip Selector Chips */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
                Chọn giờ xuất bến hôm nay
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { time: '07:45', available: '6 chỗ' },
                  { time: '08:15', available: '14 chỗ' },
                  { time: '08:45', available: '18 chỗ' },
                ].map((t) => (
                  <button
                    key={t.time}
                    type="button"
                    onClick={() => setSelectedTrip(t.time)}
                    className={`flex flex-col items-center justify-center rounded-2xl border p-3 transition-all ${
                      selectedTrip === t.time
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-200'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'
                    }`}
                  >
                    <span className="font-mono text-base font-bold">{t.time}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Còn {t.available}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive 28-Seat Bus Map */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Armchair size={15} /> Sơ đồ ghế xe buýt điện 28 chỗ
                </span>
                <span className="text-xs text-slate-500">Đầu xe (Bác tài) ↑</span>
              </div>

              {/* Seat Legend */}
              <div className="my-3 flex flex-wrap items-center justify-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded border border-emerald-500 bg-white" /> Trống
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded bg-[#005A36]" /> Đang chọn
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded bg-slate-300 dark:bg-slate-700" /> Đã bán
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded border border-[#005A36] bg-[#005A36]/15" /> Ưu tiên
                </span>
              </div>

              {/* Seats Grid */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 max-w-xs mx-auto py-2">
                {SEATS.map((seat) => {
                  const isSelected = selectedSeats.includes(seat.id)
                  const isOccupied = seat.status === 'occupied'
                  const isPriority = seat.status === 'priority'

                  return (
                    <button
                      key={seat.id}
                      type="button"
                      disabled={isOccupied}
                      onClick={() => toggleSeat(seat.id, seat.status)}
                      className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border font-mono text-xs font-bold transition-all active:scale-95 ${
                        isSelected
                          ? 'border-[#005A36] bg-[#005A36] text-white shadow-md shadow-emerald-950/20'
                          : isOccupied
                          ? 'cursor-not-allowed border-transparent bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                          : isPriority
                          ? 'border-[#005A36]/40 bg-[#005A36]/10 text-[#005A36] hover:border-[#005A36]'
                          : 'border-emerald-300 bg-white text-emerald-800 hover:border-emerald-500 dark:bg-slate-900 dark:text-emerald-300'
                      }`}
                    >
                      <Armchair size={14} />
                      {seat.number}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Price & Continue CTA */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
              <div>
                <span className="text-xs text-slate-500">
                  Đã chọn: <strong>{selectedSeats.join(', ') || 'Chưa chọn ghế'}</strong>
                </span>
                <p className="font-mono text-xl font-bold text-[#00A86B]">
                  {totalPrice.toLocaleString('vi-VN')} đ
                </p>
              </div>

              <button
                type="button"
                disabled={selectedSeats.length === 0}
                onClick={() => setStep('info')}
                className="flex items-center gap-2 rounded-xl bg-[#00A86B] px-6 py-3 font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition-all text-sm"
              >
                Tiếp tục điền thông tin <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Passenger Info & Payment */}
        {step === 'info' && (
          <form onSubmit={handleConfirmBooking} className="flex flex-col gap-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Thông Tin Hành Khách & Thanh Toán
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Chuyến {selectedTrip} • Ghế {selectedSeats.join(', ')} • Tổng:{' '}
                {totalPrice.toLocaleString('vi-VN')} đ
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Họ và tên hành khách
                </label>
                <input
                  type="text"
                  required
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Số điện thoại nhận vé SMS
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
                Chọn phương thức thanh toán bảo mật
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('vnpay')}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
                    paymentMethod === 'vnpay'
                      ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 dark:bg-emerald-950/40'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <CreditCard size={20} className="text-emerald-600" />
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">VNPay Sandbox</p>
                    <p className="text-[11px] text-slate-500">Mã QR ngân hàng, ATM nội địa</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('momo')}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
                    paymentMethod === 'momo'
                      ? 'border-pink-500 bg-pink-50/60 ring-2 ring-pink-500/20 dark:bg-pink-950/40'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <CreditCard size={20} className="text-pink-600" />
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">Ví MoMo Sandbox</p>
                    <p className="text-[11px] text-slate-500">Thanh toán 1 chạm siêu nhanh</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStep('seats')}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900"
              >
                ← Quay lại chọn ghế
              </button>

              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-[#00A86B] px-6 py-3 font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 active:scale-95 transition-all text-sm"
              >
                <ShieldCheck size={16} /> Thanh toán {totalPrice.toLocaleString('vi-VN')} đ
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Instant Electronic QR Ticket */}
        {step === 'ticket' && (
          <div className="flex flex-col items-center gap-5 text-center py-2 animate-in zoom-in-95">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Đặt Vé Thành Công!
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Vé điện tử đã được phát hành và gửi mã xác nhận qua số điện thoại {phone}
              </p>
            </div>

            {/* Boarding Pass Card */}
            <div className="w-full max-w-sm rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50/50 to-white p-6 shadow-xl dark:from-slate-900 dark:to-slate-950">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  MÃ VÉ: TK-ICTU-8921
                </span>
                <span className="text-[11px] text-slate-400">Tuyến 01</span>
              </div>

              {/* Real QR Code */}
              <div className="my-5 flex justify-center p-3 bg-white rounded-2xl border border-slate-100 shadow-inner inline-block mx-auto">
                <QRCodeSVG
                  value="https://transit.ictu.edu.vn/ticket/TK-ICTU-8921"
                  size={160}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-left text-xs border-t border-emerald-500/20 pt-3">
                <div>
                  <span className="text-slate-400">Hành khách:</span>
                  <p className="font-bold text-slate-900 dark:text-white">{passengerName}</p>
                </div>
                <div>
                  <span className="text-slate-400">Ghế ngồi:</span>
                  <p className="font-bold text-[#00A86B] font-mono text-sm">{selectedSeats.join(', ')}</p>
                </div>
                <div className="col-span-2 mt-1">
                  <span className="text-slate-400">Chuyến xuất bến:</span>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {selectedTrip} hôm nay • {initialOrigin}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200"
              >
                Đóng cửa sổ
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="flex items-center gap-1.5 rounded-xl bg-[#00A86B] px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20"
              >
                <Download size={14} /> Tải vé về điện thoại
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
