'use client'

/**
 * Modal đổi vé — 3 bước: chọn chuyến mới → chọn ghế mới → xác nhận
 * Thiết kế giao diện Light Theme chuẩn nhận diện thương hiệu ICTU Transit (#005A36)
 */

import { useState } from 'react'
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
} from 'lucide-react'
import { exchangeService } from '@/lib/services/exchange.service'
import type { ExchangeTicketPayload, ExchangeStep } from '@/lib/types/exchange'

interface ExchangeTicketModalProps {
  ticketId: string | null
  ticketCode?: string
  onClose: () => void
  onSuccess?: () => void
}

export function ExchangeTicketModal({
  ticketId,
  ticketCode,
  onClose,
  onSuccess,
}: ExchangeTicketModalProps) {
  const [step, setStep] = useState<ExchangeStep>('select-trip')
  const [newTripId, setNewTripId] = useState('')
  const [newSeatId, setNewSeatId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const STEPS: ExchangeStep[] = ['select-trip', 'select-seat', 'confirm']
  const stepIndex = STEPS.indexOf(step)

  const STEP_LABELS: Record<ExchangeStep, string> = {
    'select-trip': '1. Chuyến mới',
    'select-seat': '2. Ghế mới',
    'confirm': '3. Xác nhận',
  }

  const handleNext = () => {
    if (step === 'select-trip') {
      if (!newTripId.trim()) {
        setError('Vui lòng nhập ID chuyến xe mới mong muốn đổi')
        return
      }
      setError('')
      setStep('select-seat')
    } else if (step === 'select-seat') {
      if (!newSeatId.trim()) {
        setError('Vui lòng nhập ID vị trí ghế mới')
        return
      }
      setError('')
      setStep('confirm')
    }
  }

  const handleSubmit = async () => {
    if (!ticketId) return
    setSubmitting(true)
    setError('')

    const payload: ExchangeTicketPayload = {
      newTripId: newTripId.trim(),
      newSeatId: newSeatId.trim(),
    }
    const result = await exchangeService.exchangeTicket(ticketId, payload)
    setSubmitting(false)

    if (result.success) {
      setSuccess(true)
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 2000)
    } else {
      setError(result.message || 'Không thể đổi vé. Vui lòng kiểm tra điều kiện đổi vé trước giờ khởi hành > 2 tiếng.')
    }
  }

  if (!ticketId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 overscroll-contain animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Đổi vé xe buýt"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col will-change-transform">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-gradient-to-r from-emerald-50/80 via-white to-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[#005A36] text-white shadow-sm shrink-0">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Đổi Chuyến & Ghế Mới</h2>
              <p className="text-xs text-slate-500 font-medium">
                {ticketCode ? `Vé gốc: ${ticketCode}` : 'Hệ thống đổi vé tự động ICTU'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stepper bar */}
        <div className="px-5 pt-3.5 pb-1">
          <div className="flex rounded-xl bg-slate-100 p-1 text-[11px] font-bold">
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

        {/* Body content */}
        <div className="p-5 sm:p-6 space-y-4 text-slate-700 text-xs">
          {/* Policy banner */}
          <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-3 text-amber-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Quy định: Vé chỉ được đổi trước giờ xuất bến tối thiểu <strong>2 tiếng</strong>. Giá vé sẽ được bảo lưu hoặc bù chênh lệch (nếu có).
            </p>
          </div>

          {/* Success state */}
          {success ? (
            <div className="py-6 text-center space-y-3">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-[#005A36]">
                <CheckCircle2 size={32} />
              </div>
              <h4 className="text-base font-bold text-slate-900">Đổi Vé Thành Công!</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Vé mới đã được cập nhật vào tài khoản của bạn. Đang tự động làm mới...
              </p>
            </div>
          ) : (
            <>
              {/* Step 1: Chọn chuyến */}
              {step === 'select-trip' && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-800">
                    Nhập ID Chuyến Xe Mới *
                  </label>
                  <div className="relative">
                    <Bus className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={newTripId}
                      onChange={(e) => setNewTripId(e.target.value)}
                      placeholder="VD: d290f1ee-6c54-4b01-90e6-d701748f0851"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-medium text-slate-900 outline-none focus:border-[#005A36] focus:bg-white focus:ring-1 focus:ring-[#005A36]/20 transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Bạn có thể tra cứu ID chuyến trong mục <strong>&quot;Tìm Kiếm Tuyến&quot;</strong> tại trang chủ.
                  </p>
                </div>
              )}

              {/* Step 2: Chọn ghế */}
              {step === 'select-seat' && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-800">
                    Nhập ID Ghế Mới *
                  </label>
                  <div className="relative">
                    <Armchair className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={newSeatId}
                      onChange={(e) => setNewSeatId(e.target.value)}
                      placeholder="VD: seat-02b hoặc UUID ghế"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-medium text-slate-900 outline-none focus:border-[#005A36] focus:bg-white focus:ring-1 focus:ring-[#005A36]/20 transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Hệ thống sẽ giữ chỗ vị trí mới và giải phóng ghế cũ ngay khi xác nhận.
                  </p>
                </div>
              )}

              {/* Step 3: Xác nhận */}
              {step === 'confirm' && (
                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 space-y-2.5">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-tight">
                    Xác Nhận Đổi Vé
                  </h4>
                  <div className="space-y-1.5 text-xs text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Mã vé cần đổi:</span>
                      <span className="font-mono font-bold text-slate-900">{ticketCode || ticketId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Chuyến mới:</span>
                      <span className="font-mono text-slate-900 truncate max-w-[180px]">{newTripId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ghế mới:</span>
                      <span className="font-mono font-bold text-[#005A36]">{newSeatId}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error inline */}
              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex items-start gap-2 text-rose-700 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                {step !== 'select-trip' && (
                  <button
                    type="button"
                    onClick={() => {
                      setError('')
                      if (step === 'confirm') setStep('select-seat')
                      else if (step === 'select-seat') setStep('select-trip')
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowLeft size={14} />
                    <span>Quay lại</span>
                  </button>
                )}

                {step !== 'confirm' ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#005A36] hover:bg-[#004529] py-2.5 text-xs font-black text-white shadow-md active:scale-95 transition-all"
                  >
                    <span>Tiếp tục</span>
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSubmit}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#005A36] hover:bg-[#004529] py-2.5 text-xs font-black text-white shadow-md disabled:opacity-50 active:scale-95 transition-all"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    <span>{submitting ? 'Đang gửi...' : 'Xác nhận đổi vé'}</span>
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
