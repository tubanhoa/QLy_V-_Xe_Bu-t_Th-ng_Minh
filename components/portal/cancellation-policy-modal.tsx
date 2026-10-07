'use client'

/**
 * Modal Kiểm tra điều kiện hủy vé theo thời gian thực & Xác nhận hủy vé tự động hoàn tiền
 * Backend PR #20:
 *   GET  /api/v1/booking/tickets/:id/cancellation-policy
 *   POST /api/v1/booking/tickets/:id/cancel
 * Thiết kế giao diện Light Theme ICTU Transit (#005A36)
 */

import { useState, useEffect } from 'react'
import {
  X,
  Ban,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Clock,
  ShieldAlert,
  Coins,
  ArrowRight,
  Info,
  Calendar,
  Copy,
  Check,
  Receipt,
} from 'lucide-react'
import { ticketService } from '@/lib/services/ticket.service'
import type { CancellationPolicyResponse, CancelTicketResponse } from '@/lib/types/exchange'
import { RefundDetailModal } from './refund-detail-modal'

interface CancellationPolicyModalProps {
  ticketId: string | null
  ticketCode?: string
  seatNumber?: string
  departureTime?: string
  price?: number
  onClose: () => void
  onSuccess?: (result?: CancelTicketResponse) => void
}

const COMMON_REASONS = [
  'Bận việc học tập / thi cử đột xuất tại trường',
  'Thay đổi lịch trình di chuyển cá nhân',
  'Đặt nhầm chuyến hoặc nhầm giờ xuất bến',
  'Có người nhà đưa đón, không cần đi xe buýt',
  'Lý do cá nhân khác...',
]

export function CancellationPolicyModal({
  ticketId,
  ticketCode,
  seatNumber = '01A',
  departureTime,
  price = 10000,
  onClose,
  onSuccess,
}: CancellationPolicyModalProps) {
  const [loading, setLoading] = useState(true)
  const [policy, setPolicy] = useState<CancellationPolicyResponse | null>(null)
  const [selectedReason, setSelectedReason] = useState(COMMON_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelResult, setCancelResult] = useState<CancelTicketResponse | null>(null)
  const [error, setError] = useState('')
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [copiedTxn, setCopiedTxn] = useState(false)

  const copyTxn = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {})
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(20)
      }
      setCopiedTxn(true)
      setTimeout(() => setCopiedTxn(false), 2000)
    }
  }

  // 1. Tải chính sách hủy vé theo thời gian thực từ Backend
  useEffect(() => {
    if (!ticketId) return
    let active = true
    setLoading(true)
    setError('')

    ticketService
      .getCancellationPolicy(ticketId)
      .then((res) => {
        if (!active) return
        setLoading(false)
        if (res.success && res.data) {
          setPolicy(res.data)
        } else {
          setError(res.message || 'Không thể kiểm tra chính sách hủy vé')
        }
      })
      .catch((e) => {
        if (!active) return
        setLoading(false)
        setError('Lỗi khi tải chính sách hủy vé')
      })

    return () => {
      active = false
    }
  }, [ticketId])

  // 2. Gửi yêu cầu hủy vé & hoàn tiền
  const handleConfirmCancel = async () => {
    if (!ticketId) return
    setCancelling(true)
    setError('')

    const finalReason =
      selectedReason === 'Lý do cá nhân khác...' && customReason.trim()
        ? customReason.trim()
        : selectedReason

    const res = await ticketService.cancelTicket(ticketId, finalReason)
    setCancelling(false)

    if (res.success && res.data) {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([20, 40, 20])
      }
      setCancelResult(res.data)
    } else {
      setError(res.message || 'Không thể hủy vé. Vui lòng kiểm tra lại điều kiện.')
    }
  }

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

  if (!ticketId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 overscroll-contain animate-in fade-in duration-150 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Hủy vé và Hoàn tiền tự động"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col will-change-transform animate-slideUp">
        {/* Mobile Pull-down indicator */}
        <div className="sm:hidden w-full flex justify-center pt-2.5 pb-1 shrink-0 bg-gradient-to-r from-rose-50/90 via-white to-slate-50">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-gradient-to-r from-rose-50/90 via-white to-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-sm shrink-0">
              <Ban size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">Hủy Vé & Hoàn Tiền</h2>
                <span className="rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-[10px] font-black uppercase">
                  Realtime Policy
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Mã vé: <strong>{ticketCode || ticketId}</strong> · Ghế: <strong>{seatNumber}</strong>
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

        {/* Body content scrollable */}
        <div className="p-4 sm:p-5 overflow-y-auto scroll-touch space-y-4 text-slate-700 text-xs">
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-rose-600 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                Đang kiểm tra điều kiện khởi hành & tính phí hoàn vé theo thời gian thực...
              </p>
            </div>
          ) : cancelResult ? (
            /* Trạng thái hủy thành công với Digital Refund Receipt Card */
            <div className="py-4 space-y-4">
              <div className="text-center space-y-1.5">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-xs">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-base sm:text-lg font-black text-slate-900">
                  Hủy Vé & Khởi Tạo Hoàn Tiền Thành Công!
                </h4>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  {cancelResult.message}
                </p>
              </div>

              {/* Digital Refund Receipt Card */}
              <div className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-4 space-y-2.5 text-xs text-slate-800">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Mã vé đã hủy:</span>
                  <strong className="font-mono text-slate-900">{cancelResult.ticketCode || ticketCode}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Giá vé ban đầu:</span>
                  <span className="font-mono font-bold text-slate-800">{formatPrice(cancelResult.originalPrice || price)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Phí hủy vé theo quy định:</span>
                  <span className="font-mono font-bold text-rose-600">-{formatPrice(cancelResult.cancellationFee || 0)}</span>
                </div>
                <div className="pt-2 border-t border-emerald-200 flex justify-between items-center text-sm">
                  <span className="font-black text-slate-900">Số tiền hoàn lại:</span>
                  <strong className="font-mono text-base font-black text-[#005A36]">
                    {formatPrice(cancelResult.refundAmount || 0)}
                  </strong>
                </div>

                {cancelResult.refundTransactionId && (
                  <div className="pt-2 border-t border-emerald-200/80 flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Mã GD hoàn tiền:</span>
                    <div className="flex items-center gap-1 font-mono font-bold text-slate-800">
                      <span>{cancelResult.refundTransactionId}</span>
                      <button
                        type="button"
                        onClick={() => copyTxn(cancelResult.refundTransactionId!)}
                        className="p-1 text-slate-400 hover:text-emerald-700"
                        title="Sao chép"
                      >
                        {copiedTxn ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
                  <span>Thời gian tiền về:</span>
                  <span className="font-bold text-slate-700">Ví MoMo/VNPay: Tức thì - 24h | Ngân hàng: 1-3 ngày</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setShowDetailModal(true)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-2xs inline-flex items-center justify-center gap-1.5"
                >
                  <Receipt size={14} className="text-[#005A36]" />
                  <span>Xem biên lai chi tiết</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSuccess?.(cancelResult)
                    onClose()
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#005A36] hover:bg-emerald-800 text-white font-black text-xs shadow-sm transition-all"
                >
                  Hoàn tất & Đóng
                </button>
              </div>
            </div>
          ) : policy ? (
            <>
              {/* Box trạng thái điều kiện */}
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3 ${
                  policy.canCancel
                    ? policy.cancellationFeePercent === 0
                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                      : 'bg-amber-50/80 border-amber-300 text-amber-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}
              >
                {policy.canCancel ? (
                  <Clock className={`w-5 h-5 shrink-0 mt-0.5 ${policy.cancellationFeePercent === 0 ? 'text-emerald-600' : 'text-amber-600'}`} />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-extrabold text-xs flex items-center gap-2">
                    <span>Thời gian trước giờ khởi hành:</span>
                    <span className="font-mono text-sm underline font-black">
                      {policy.hoursUntilDeparture} giờ
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {policy.canCancel
                      ? policy.cancellationFeePercent === 0
                        ? 'Đủ điều kiện hoàn 100% tiền vé (miễn 100% phí hủy do trước giờ chạy ≥ 24 tiếng).'
                        : `Áp dụng phí hủy vé ${policy.cancellationFeePercent}% theo quy định (do trước giờ chạy từ 2h đến 24h).`
                      : policy.reason || 'Vé không đủ điều kiện để hủy do trước giờ khởi hành < 2 tiếng hoặc xe đã chạy.'}
                  </p>
                </div>
              </div>

              {/* Bảng chi tiết tính phí & tiền hoàn lại */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                <h4 className="font-extrabold text-xs uppercase tracking-tight text-slate-900 flex items-center justify-between">
                  <span>Chi Tiết Hoàn Tiền Vé</span>
                  <Coins className="w-4 h-4 text-amber-500" />
                </h4>

                <div className="space-y-1.5 border-t border-slate-200/80 pt-2 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Giá vé ban đầu:</span>
                    <span className="font-bold text-slate-900">{formatPrice(policy.originalPrice)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Phí hủy vé ({policy.cancellationFeePercent}%):</span>
                    <span className="font-bold text-rose-600">
                      -{formatPrice(policy.cancellationFeeAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-black pt-2 border-t border-slate-200 text-slate-900">
                    <span>Số tiền thực nhận hoàn lại:</span>
                    <span className="text-base text-[#005A36] font-black">
                      {formatPrice(policy.refundAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bảng quy tắc chính sách thời gian */}
              <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/50 p-3 space-y-2">
                <div className="text-[11px] font-extrabold text-emerald-900 flex items-center gap-1.5">
                  <Info size={13} className="text-emerald-600" />
                  <span>Chính Sách Hỗ Trợ Hủy Vé Linh Hoạt ICTU Transit</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="p-2.5 rounded-xl border bg-white border-emerald-200 text-slate-700 space-y-0.5">
                    <div className="font-bold text-emerald-800">Miễn Phí 100%</div>
                    <div className="text-slate-500">Hoàn lại <strong>100% tiền vé</strong> khi hủy trước khi lên xe</div>
                  </div>
                  <div className="p-2.5 rounded-xl border bg-white border-emerald-200 text-slate-700 space-y-0.5">
                    <div className="font-bold text-emerald-800">Giải Phóng Ghế Lập Tức</div>
                    <div className="text-slate-500">Ghế ngồi tự động mở lại cho hành khách khác đặt ngay</div>
                  </div>
                </div>
              </div>

              {/* Form chọn lý do hủy vé */}
              {policy.canCancel && (
                <div className="space-y-2">
                  <label className="block text-xs font-extrabold text-slate-900">
                    Lý Do Hủy Vé *
                  </label>
                  <select
                    value={selectedReason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600/20"
                  >
                    {COMMON_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>

                  {selectedReason === 'Lý do cá nhân khác...' && (
                    <input
                      type="text"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Nhập lý do cụ thể của bạn..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 outline-none focus:border-rose-600 focus:bg-white"
                    />
                  )}
                </div>
              )}

              {/* Thông báo lỗi nếu có */}
              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex items-start gap-2 text-rose-700 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Nút hành động */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 safe-pb-dock">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer touch-press touch-manipulation active:scale-95"
                >
                  Giữ lại vé
                </button>

                {policy.canCancel ? (
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={handleConfirmCancel}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all touch-press touch-manipulation active:scale-95"
                  >
                    {cancelling ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Ban size={15} />
                    )}
                    <span>Xác nhận Hủy & Nhận {formatPrice(policy.refundAmount)}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="flex-1 py-2.5 rounded-xl bg-slate-200 text-slate-400 text-xs font-bold cursor-not-allowed"
                  >
                    Không thể hủy vé này
                  </button>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Modal Chi tiết Hoàn tiền khi người dùng bấm xem biên lai */}
      {showDetailModal && cancelResult && (
        <RefundDetailModal
          open={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          ticketId={ticketId || cancelResult.ticketId}
          ticketCode={cancelResult.ticketCode || ticketCode}
          passengerName={policy?.passengerName}
          seatNumber={seatNumber}
          refundInfo={{
            refundAmount: cancelResult.refundAmount || 0,
            originalPrice: cancelResult.originalPrice || price,
            cancellationFee: cancelResult.cancellationFee || 0,
            feePercent: policy?.cancellationFeePercent || 0,
            refundMethod: cancelResult.refundMethod || 'vnpay',
            status: 'SUCCESS',
            refundTransactionId: cancelResult.refundTransactionId || undefined,
            refundTime: new Date().toISOString(),
            estimatedArrival: 'Ví điện tử: Tức thì - 24h | Ngân hàng: 1-3 ngày làm việc',
          }}
        />
      )}
    </div>
  )
}
