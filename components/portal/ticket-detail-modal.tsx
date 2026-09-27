'use client'

/**
 * Modal Chi tiết vé — hiển thị QR code, thông tin vé và các hành động tiện ích
 * Thiết kế giao diện Light Theme chuẩn nhận diện thương hiệu ICTU Transit (#005A36)
 */

import { useState, useEffect, useCallback } from 'react'
import {
  X,
  QrCode,
  MapPin,
  Clock,
  Bus,
  User,
  Phone,
  Armchair,
  Hash,
  Ban,
  Loader2,
  CheckCircle2,
  Download,
  Share2,
  ArrowLeftRight,
  Radio,
  Star,
  AlertTriangle,
  Ticket,
} from 'lucide-react'
import Link from 'next/link'
import { ticketService } from '@/lib/services/ticket.service'
import type { TicketDetail } from '@/lib/types/ticket'
import {
  TICKET_STATUS_COLOR,
  TICKET_STATUS_LABEL,
} from '@/lib/types/ticket'
import { ExchangeTicketModal } from './exchange-ticket-modal'
import { FeedbackModal } from './feedback-modal'

interface TicketDetailModalProps {
  ticketId: string | null
  onClose: () => void
  onCancelled?: (ticketId: string) => void
}

export function TicketDetailModal({
  ticketId,
  onClose,
  onCancelled,
}: TicketDetailModalProps) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelSuccess, setCancelSuccess] = useState(false)
  const [showExchangeModal, setShowExchangeModal] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)

  const loadTicket = useCallback(async () => {
    if (!ticketId) return
    setLoading(true)
    setError(null)
    setTicket(null)

    const result = await ticketService.getTicketDetail(ticketId)
    setLoading(false)

    if (result.success && result.data) {
      setTicket(result.data)
    } else {
      setError(result.message || 'Không thể tải chi tiết vé')
    }
  }, [ticketId])

  useEffect(() => {
    if (ticketId) {
      setTicket(null)
      setError(null)
      setCancelConfirm(false)
      setCancelSuccess(false)
      loadTicket()
    }
  }, [ticketId, loadTicket])

  const handleCancel = async () => {
    if (!ticket) return
    setCancelling(true)
    const result = await ticketService.cancelTicket(ticket.ticketId)
    setCancelling(false)

    if (result.success) {
      setCancelSuccess(true)
      setCancelConfirm(false)
      setTicket((prev) => (prev ? { ...prev, status: 'CANCELLED' } : prev))
      onCancelled?.(ticket.ticketId)
    } else {
      setError(result.message || 'Không thể hủy vé')
      setCancelConfirm(false)
    }
  }

  const canCancel =
    ticket &&
    (ticket.status === 'PAID' || ticket.status === 'RESERVED') &&
    new Date(ticket.departureTime).getTime() - Date.now() >= 2 * 60 * 60 * 1000

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount)

  if (!ticketId) return null

  const statusColor = ticket
    ? TICKET_STATUS_COLOR[ticket.status] ?? TICKET_STATUS_COLOR['PENDING']
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 overscroll-contain animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Chi tiết vé xe điện tử"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col will-change-transform">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-gradient-to-r from-emerald-50/80 via-white to-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[#005A36] text-white shadow-sm shrink-0">
              <Ticket size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">Chi Tiết Vé Điện Tử</h3>
                {ticket && statusColor && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}>
                    {TICKET_STATUS_LABEL[ticket.status]}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {ticket ? `Mã vé: ${ticket.ticketCode}` : 'Hệ thống vé xe buýt thông minh ICTU'}
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

        {/* Body content */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-4 text-slate-700 text-sm">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-[#005A36] animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Đang tải thông tin vé...</p>
            </div>
          )}

          {!loading && error && !ticket && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 space-y-2 text-center">
              <AlertTriangle className="w-6 h-6 text-rose-600 mx-auto" />
              <p className="font-bold">{error}</p>
              <button
                type="button"
                onClick={loadTicket}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700"
              >
                Thử lại
              </button>
            </div>
          )}

          {!loading && ticket && (
            <>
              {/* QR Code Pass Card */}
              <div className="rounded-3xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-4 sm:p-5 space-y-3 text-center">
                {ticket.qrDataUrl ? (
                  <div className="bg-white p-3 rounded-2xl border border-emerald-100 shadow-xs inline-block mx-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ticket.qrDataUrl}
                      alt="Mã QR vé xe buýt"
                      className="w-40 h-40 object-contain mx-auto"
                    />
                  </div>
                ) : (
                  <div className="w-40 h-40 rounded-2xl bg-white border border-slate-200 flex flex-col items-center justify-center gap-2 mx-auto text-slate-400 text-xs">
                    <QrCode className="w-10 h-10 text-slate-300" />
                    <span>Mã QR chưa sẵn sàng</span>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="font-mono font-black text-base text-[#005A36]">
                    {ticket.ticketCode}
                  </div>
                  <div className="text-xs font-extrabold text-slate-800">
                    {ticket.routeName}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Chuyến đi: <strong>{ticket.origin}</strong> ➔ <strong>{ticket.destination}</strong>
                  </div>
                </div>

                <div className="rounded-xl bg-white border border-emerald-200/80 p-2.5 text-[11px] text-emerald-950 font-medium">
                  Đưa mã QR trên màn hình lại gần máy quét tại cửa lên xe buýt thông minh để mở cổng tự động.
                </div>
              </div>

              {/* Chi tiết lộ trình & Ghế */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-slate-200/80 pb-2.5">
                  <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                    <Clock className="w-4 h-4 text-[#005A36]" />
                    <span>Giờ khởi hành:</span>
                  </div>
                  <span className="font-bold text-slate-900">{formatDate(ticket.departureTime)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-bold block">Vị trí ghế</span>
                    <span className="text-sm font-black text-[#005A36] font-mono block mt-0.5">
                      Ghế {ticket.seatNumber}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {ticket.seatType || 'Ghế tiêu chuẩn'}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-bold block">Giá vé</span>
                    <span className="text-sm font-black text-slate-900 font-mono block mt-0.5">
                      {formatPrice(ticket.price)}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-bold">Đã thanh toán</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate text-slate-700 font-medium">
                      {ticket.passengerName}
                    </span>
                  </div>
                  {ticket.vehiclePlate && (
                    <div className="flex items-center gap-2">
                      <Bus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono text-slate-700 font-bold">
                        Biển số: {ticket.vehiclePlate}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Thông báo hủy thành công */}
              {cancelSuccess && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-center gap-2.5 text-xs text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Vé đã được hủy thành công. Chính sách hoàn tiền sẽ được xử lý theo quy định.</span>
                </div>
              )}

              {/* Xác nhận hủy vé */}
              {cancelConfirm && (
                <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 space-y-2.5 text-xs text-rose-900">
                  <div className="flex items-center gap-2 font-bold text-rose-700">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Xác nhận hủy vé xe buýt này?</span>
                  </div>
                  <p className="text-[11px] text-rose-700">
                    Hủy trước giờ khởi hành trên 2 tiếng được hoàn tiền theo chính sách. Vé sau khi hủy sẽ không thể hoàn tác.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCancelConfirm(false)}
                      className="flex-1 rounded-xl bg-white border border-slate-200 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Giữ lại vé
                    </button>
                    <button
                      type="button"
                      disabled={cancelling}
                      onClick={handleCancel}
                      className="flex-1 rounded-xl bg-rose-600 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {cancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Đồng ý hủy</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Các nút hành động thông minh */}
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Realtime GPS tracking link */}
                  <Link
                    href={`/tracking/${ticket.tripId || ticket.ticketId}`}
                    target="_blank"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-300 text-xs font-black text-[#005A36] transition-all text-center"
                    id={`track-ticket-btn-${ticket.ticketId}`}
                  >
                    <Radio className="w-3.5 h-3.5 text-[#005A36] animate-pulse" />
                    <span>Theo dõi xe realtime</span>
                  </Link>

                  {/* Exchange ticket button */}
                  {(ticket.status === 'PAID' || ticket.status === 'RESERVED') && canCancel && (
                    <button
                      type="button"
                      onClick={() => setShowExchangeModal(true)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-black text-blue-800 transition-all cursor-pointer"
                      id={`exchange-ticket-btn-${ticket.ticketId}`}
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-blue-700" />
                      <span>Đổi chuyến / đổi ghế</span>
                    </button>
                  )}

                  {/* Feedback button */}
                  {(ticket.status === 'CHECKED_IN' || ticket.status === 'PAID') && (
                    <button
                      type="button"
                      onClick={() => setShowFeedbackModal(true)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-xs font-black text-amber-900 transition-all cursor-pointer"
                      id={`feedback-ticket-btn-${ticket.ticketId}`}
                    >
                      <Star className="w-3.5 h-3.5 text-amber-600" />
                      <span>Đánh giá chuyến đi</span>
                    </button>
                  )}

                  {/* Hủy vé button */}
                  {canCancel && !cancelConfirm && !cancelSuccess && (
                    <button
                      type="button"
                      onClick={() => setCancelConfirm(true)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-black text-rose-700 transition-all cursor-pointer"
                      id={`cancel-ticket-btn-${ticket.ticketId}`}
                    >
                      <Ban className="w-3.5 h-3.5 text-rose-600" />
                      <span>Hủy vé (&gt; 2 tiếng)</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Exchange ticket modal */}
      {showExchangeModal && ticket && (
        <ExchangeTicketModal
          ticketId={ticket.ticketId}
          ticketCode={ticket.ticketCode}
          onClose={() => setShowExchangeModal(false)}
          onSuccess={() => {
            setShowExchangeModal(false)
            loadTicket()
          }}
        />
      )}

      {/* Feedback modal */}
      {showFeedbackModal && ticket && (
        <FeedbackModal
          tripId={ticket.tripId || ticket.ticketId}
          tripName={`${ticket.origin} ➔ ${ticket.destination}`}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}
    </div>
  )
}
