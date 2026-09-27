'use client'

/**
 * Modal Chi tiết vé — hiển thị QR code, thông tin vé và nút Hủy vé
 * File mới hoàn toàn — không chạm file cũ
 * Branch: feature/SBTS-my-tickets-fe
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
} from 'lucide-react'
import { ticketService } from '@/lib/services/ticket.service'
import type { TicketDetail } from '@/lib/types/ticket'
import {
  TICKET_STATUS_COLOR,
  TICKET_STATUS_LABEL,
} from '@/lib/types/ticket'

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Chi tiết vé xe"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* Panel */}
      <div className="relative w-full sm:max-w-lg max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#0d1117] border border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-[#0d1117]/95 backdrop-blur-sm border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#00d4aa]/10">
              <QrCode className="w-5 h-5 text-[#00d4aa]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Chi tiết vé</h2>
              {ticket && (
                <p className="text-xs text-white/50">{ticket.ticketCode}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/8 text-white/50 hover:text-white transition-all"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-4 py-16">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-[#00d4aa]/10 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 text-[#00d4aa] animate-spin" />
                </div>
                <div className="absolute inset-0 rounded-2xl border border-[#00d4aa]/20 animate-ping" />
              </div>
              <p className="text-sm text-white/50">Đang tải thông tin vé…</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-5 text-center">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={loadTicket}
                className="mt-3 text-xs text-white/50 hover:text-white transition-colors underline"
              >
                Thử lại
              </button>
            </div>
          )}

          {/* Ticket data */}
          {ticket && !loading && (
            <>
              {/* Status badge */}
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${statusColor?.bg} ${statusColor?.text} ${statusColor?.border}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {TICKET_STATUS_LABEL[ticket.status]}
                </span>
                <span className="text-xs text-white/40">
                  Đặt lúc {formatDate(ticket.createdAt)}
                </span>
              </div>

              {/* QR Code */}
              {ticket.qrDataUrl && (
                <div className="rounded-2xl bg-white p-4 flex items-center justify-center shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ticket.qrDataUrl}
                    alt={`QR vé ${ticket.ticketCode}`}
                    className="w-52 h-52 object-contain"
                    id={`ticket-qr-${ticket.ticketId}`}
                  />
                </div>
              )}
              {!ticket.qrDataUrl && (
                <div className="rounded-2xl bg-white/5 border border-white/8 p-8 flex flex-col items-center gap-2">
                  <QrCode className="w-12 h-12 text-white/20" />
                  <p className="text-xs text-white/30">Mã QR chưa khả dụng</p>
                </div>
              )}

              {/* QR action buttons */}
              {ticket.qrDataUrl && (
                <div className="flex gap-2">
                  <a
                    href={ticket.qrDataUrl}
                    download={`ve-${ticket.ticketCode}.png`}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/6 hover:bg-white/10 border border-white/8 text-xs text-white/70 hover:text-white transition-all"
                    id={`download-qr-${ticket.ticketId}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Tải QR
                  </a>
                  <button
                    onClick={() =>
                      navigator.share?.({
                        title: `Vé xe ${ticket.routeName}`,
                        text: `Mã vé: ${ticket.ticketCode}`,
                      })
                    }
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/6 hover:bg-white/10 border border-white/8 text-xs text-white/70 hover:text-white transition-all"
                    id={`share-ticket-${ticket.ticketId}`}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Chia sẻ
                  </button>
                </div>
              )}

              {/* Info grid */}
              <div className="space-y-3">
                {/* Route */}
                <div className="rounded-2xl bg-white/4 border border-white/8 p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                    Thông tin chuyến
                  </h3>

                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-[#00d4aa] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-white/50">Tuyến</p>
                      <p className="text-sm font-medium text-white truncate">
                        {ticket.routeName || `${ticket.origin} → ${ticket.destination}`}
                      </p>
                    </div>
                  </div>

                  {ticket.origin && ticket.destination && (
                    <div className="flex items-start gap-3">
                      <div className="w-4 flex flex-col items-center gap-1 mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-[#00d4aa]" />
                        <div className="w-px h-4 bg-white/20" />
                        <div className="w-2 h-2 rounded-full bg-orange-400" />
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-white/40">Điểm xuất phát</p>
                          <p className="text-sm text-white">{ticket.origin}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/40">Điểm đến</p>
                          <p className="text-sm text-white">{ticket.destination}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-white/50">Giờ khởi hành</p>
                      <p className="text-sm font-medium text-white">
                        {formatDate(ticket.departureTime)}
                      </p>
                    </div>
                  </div>

                  {ticket.vehiclePlate && (
                    <div className="flex items-center gap-3">
                      <Bus className="w-4 h-4 text-violet-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-white/50">Biển số xe</p>
                        <p className="text-sm font-medium text-white font-mono">
                          {ticket.vehiclePlate}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Passenger info */}
                <div className="rounded-2xl bg-white/4 border border-white/8 p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                    Thông tin hành khách
                  </h3>

                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-white/50">Họ tên</p>
                      <p className="text-sm font-medium text-white">
                        {ticket.passengerName}
                      </p>
                    </div>
                  </div>

                  {ticket.passengerPhone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-white/50">Số điện thoại</p>
                        <p className="text-sm font-medium text-white">
                          {ticket.passengerPhone}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Armchair className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-white/50">Ghế</p>
                      <p className="text-sm font-medium text-white">
                        {ticket.seatNumber}
                        {ticket.seatType && (
                          <span className="ml-1.5 text-xs text-white/40">
                            ({ticket.seatType})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Booking codes + price */}
                <div className="rounded-2xl bg-white/4 border border-white/8 p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                    Mã vé & Giá tiền
                  </h3>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Hash className="w-4 h-4 text-white/30 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-white/50">Mã đơn</p>
                        <p className="text-sm font-mono text-white">{ticket.bookingCode}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/50">Giá vé</p>
                      <p className="text-base font-bold text-[#00d4aa]">
                        {formatPrice(ticket.price)}
                      </p>
                    </div>
                  </div>

                  {ticket.checkedInAt && (
                    <div className="flex items-center gap-2 pt-1 border-t border-white/6">
                      <CheckCircle2 className="w-4 h-4 text-violet-400" />
                      <p className="text-xs text-white/60">
                        Check-in lúc {formatDate(ticket.checkedInAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Cancel success */}
              {cancelSuccess && (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <p className="text-sm text-emerald-300">
                    Vé đã được hủy thành công. Chúng tôi sẽ xem xét hoàn tiền theo chính sách.
                  </p>
                </div>
              )}

              {/* Error inline */}
              {error && (
                <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Cancel confirm */}
              {cancelConfirm && (
                <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 space-y-3">
                  <p className="text-sm text-white font-medium">
                    ⚠️ Xác nhận hủy vé?
                  </p>
                  <p className="text-xs text-white/60">
                    Vé sẽ bị hủy không thể khôi phục. Hoàn tiền sẽ được xử lý trong 3–5 ngày làm việc.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCancelConfirm(false)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 text-sm text-white/70 hover:text-white transition-all"
                      id="cancel-confirm-no"
                    >
                      Không, giữ vé
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-sm font-semibold text-white transition-all"
                      id="cancel-confirm-yes"
                    >
                      {cancelling ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Ban className="w-4 h-4" />
                      )}
                      {cancelling ? 'Đang hủy…' : 'Xác nhận hủy'}
                    </button>
                  </div>
                </div>
              )}

              {/* Cancel button */}
              {canCancel && !cancelConfirm && !cancelSuccess && (
                <button
                  onClick={() => setCancelConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-sm font-medium text-red-400 hover:text-red-300 transition-all"
                  id={`cancel-ticket-btn-${ticket.ticketId}`}
                >
                  <Ban className="w-4 h-4" />
                  Hủy vé
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
