'use client'

/**
 * Modal đổi vé — 3 bước: chọn chuyến mới → chọn ghế mới → xác nhận
 * File mới — không chạm file cũ
 * Branch: feature/SBTS-exchange-refund-fe
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
    'select-trip': 'Chọn chuyến mới',
    'select-seat': 'Chọn ghế mới',
    'confirm': 'Xác nhận',
  }

  const handleNext = () => {
    if (step === 'select-trip') {
      if (!newTripId.trim()) { setError('Vui lòng nhập ID chuyến xe mới'); return }
      setError('')
      setStep('select-seat')
    } else if (step === 'select-seat') {
      if (!newSeatId.trim()) { setError('Vui lòng nhập ID ghế mới'); return }
      setError('')
      setStep('confirm')
    }
  }

  const handleSubmit = async () => {
    if (!ticketId) return
    setSubmitting(true)
    setError('')

    const payload: ExchangeTicketPayload = { newTripId: newTripId.trim(), newSeatId: newSeatId.trim() }
    const result = await exchangeService.exchangeTicket(ticketId, payload)
    setSubmitting(false)

    if (result.success) {
      setSuccess(true)
      setTimeout(() => { onSuccess?.(); onClose() }, 2500)
    } else {
      setError(result.message || 'Không thể đổi vé. Vui lòng thử lại.')
    }
  }

  if (!ticketId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" />
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[#0d1117] border border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10">
              <ArrowLeftRight className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Đổi vé xe</h2>
              {ticketCode && <p className="text-xs text-white/40">{ticketCode}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/8 text-white/40 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex h-0.5">
          {STEPS.map((s, i) => (
            <div key={s} className={`flex-1 transition-all duration-500 ${i <= stepIndex ? 'bg-blue-400' : 'bg-white/10'}`} />
          ))}
        </div>

        <div className="p-5 space-y-4">
          {/* Step label */}
          <div className="flex items-center justify-center gap-2 text-xs text-white/40">
            {STEPS.map((s, i) => (
              <span key={s} className={`flex items-center gap-1.5 ${i === stepIndex ? 'text-blue-400 font-semibold' : ''}`}>
                {i > 0 && <ArrowRight className="w-3 h-3" />}
                {STEP_LABELS[s]}
              </span>
            ))}
          </div>

          {/* Success state */}
          {success && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="p-4 rounded-full bg-emerald-500/15">
                <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-white">Đổi vé thành công!</p>
                <p className="text-sm text-white/50 mt-1">Vé mới đã được cấp.</p>
              </div>
            </div>
          )}

          {/* Step content */}
          {!success && (
            <>
              {/* Warning notice */}
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  Chỉ đổi vé trước giờ khởi hành tối thiểu 2 tiếng. Chênh lệch giá sẽ được tính theo chính sách.
                </p>
              </div>

              {/* Step 1: Trip */}
              {step === 'select-trip' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-white">Chuyến xe mới</p>
                  <div className="relative">
                    <Bus className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      id="new-trip-id-input"
                      type="text"
                      value={newTripId}
                      onChange={(e) => setNewTripId(e.target.value)}
                      placeholder="Nhập ID chuyến xe mới…"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30 outline-none focus:border-blue-400/60 focus:bg-white/8 transition-all font-mono"
                    />
                  </div>
                  <p className="text-xs text-white/30">Lấy ID từ kết quả tìm kiếm chuyến xe</p>
                </div>
              )}

              {/* Step 2: Seat */}
              {step === 'select-seat' && (
                <div className="space-y-2">
                  <div className="rounded-xl bg-white/4 border border-white/8 p-3 text-xs text-white/50">
                    Chuyến mới: <span className="text-white font-mono">{newTripId}</span>
                  </div>
                  <p className="text-sm font-medium text-white">Ghế mới</p>
                  <div className="relative">
                    <Armchair className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      id="new-seat-id-input"
                      type="text"
                      value={newSeatId}
                      onChange={(e) => setNewSeatId(e.target.value)}
                      placeholder="Nhập ID ghế mới…"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30 outline-none focus:border-blue-400/60 focus:bg-white/8 transition-all font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Confirm */}
              {step === 'confirm' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-white">Xác nhận đổi vé</p>
                  <div className="rounded-xl bg-white/4 border border-white/8 divide-y divide-white/6">
                    {[
                      ['Vé hiện tại', ticketCode || ticketId],
                      ['Chuyến mới', newTripId],
                      ['Ghế mới', newSeatId],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs text-white/50">{label}</span>
                        <span className="text-sm font-medium text-white font-mono">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && <p className="text-xs text-red-400">{error}</p>}

              {/* Navigation */}
              <div className="flex gap-2 pt-1">
                {step !== 'select-trip' ? (
                  <button
                    onClick={() => setStep(STEPS[stepIndex - 1])}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/6 hover:bg-white/10 text-sm text-white/60 hover:text-white transition-all"
                    id="exchange-prev-btn"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Quay lại
                  </button>
                ) : (
                  <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-white/6 hover:bg-white/10 text-sm text-white/60 hover:text-white transition-all">
                    Hủy
                  </button>
                )}

                {step !== 'confirm' ? (
                  <button
                    onClick={handleNext}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-sm font-semibold text-white transition-all"
                    id="exchange-next-btn"
                  >
                    Tiếp theo <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-sm font-semibold text-white transition-all"
                    id="exchange-confirm-btn"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {submitting ? 'Đang xử lý…' : 'Xác nhận đổi vé'}
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
