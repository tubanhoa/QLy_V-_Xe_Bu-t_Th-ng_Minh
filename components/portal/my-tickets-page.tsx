'use client'

/**
 * Trang Lịch sử vé của hành khách
 * Thiết kế giao diện Light Theme chuẩn nhận diện thương hiệu ICTU Transit (#005A36)
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Ticket,
  Clock,
  MapPin,
  Armchair,
  ChevronRight,
  Loader2,
  RefreshCw,
  InboxIcon,
  Filter,
  LogIn,
  QrCode,
  Bus,
  WifiOff,
} from 'lucide-react'
import Link from 'next/link'
import { ticketService } from '@/lib/services/ticket.service'
import { offlineTicketCache } from '@/lib/services/offline-ticket-cache'
import { useAuth } from '@/lib/auth-context'
import type { TicketSummary, TicketFilterStatus } from '@/lib/types/ticket'
import {
  TICKET_STATUS_COLOR,
  TICKET_STATUS_LABEL,
} from '@/lib/types/ticket'
import { TicketDetailModal } from './ticket-detail-modal'
import { ExchangeTicketModal } from './exchange-ticket-modal'
import { CancellationPolicyModal } from './cancellation-policy-modal'

const FILTER_TABS: { key: TicketFilterStatus; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'upcoming', label: 'Sắp đi' },
  { key: 'past', label: 'Đã đi' },
  { key: 'cancelled', label: 'Đã hủy' },
]

function filterTickets(tickets: TicketSummary[], filter: TicketFilterStatus): TicketSummary[] {
  const now = Date.now()
  switch (filter) {
    case 'upcoming':
      return tickets.filter(
        (t) =>
          (t.status === 'PAID' || t.status === 'RESERVED' || t.status === 'PENDING') &&
          new Date(t.departureTime).getTime() > now - 24 * 3600 * 1000,
      )
    case 'past':
      return tickets.filter(
        (t) =>
          t.status === 'CHECKED_IN' ||
          (t.status !== 'CANCELLED' && t.status !== 'EXPIRED' && new Date(t.departureTime).getTime() <= now - 24 * 3600 * 1000),
      )
    case 'cancelled':
      return tickets.filter((t) => t.status === 'CANCELLED' || t.status === 'EXPIRED')
    default:
      return tickets
  }
}

interface TicketCardProps {
  ticket: TicketSummary
  onClick: () => void
  onExchange?: () => void
  onCancel?: () => void
}

function TicketCard({ ticket, onClick, onExchange, onCancel }: TicketCardProps) {
  const statusColor = TICKET_STATUS_COLOR[ticket.status] ?? TICKET_STATUS_COLOR['PENDING']

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-2xl border border-slate-200/80 bg-white hover:border-[#005A36] hover:shadow-md p-4 transition-all shadow-2xs space-y-3 cursor-pointer touch-press touch-manipulation select-none"
      id={`ticket-card-${ticket.ticketId}`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-[#005A36] text-white px-2.5 py-1 text-xs font-black shadow-2xs">
            {ticket.routeCode || ticket.busNumber || 'CT-01'}
          </span>
          <div>
            <h4 className="font-extrabold text-xs text-slate-900 group-hover:text-[#005A36] transition-colors leading-snug">
              {ticket.routeName || 'Tuyến CT-01 KTX ICTU ↔ Bến Xe TP'}
            </h4>
            <span className="text-[10px] font-mono text-slate-400">
              Mã: {ticket.ticketCode}
            </span>
          </div>
        </div>

        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}>
          {TICKET_STATUS_LABEL[ticket.status]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Clock className="w-3.5 h-3.5 text-[#005A36]" />
          <span>{formatDate(ticket.departureTime)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <Armchair className="w-3.5 h-3.5 text-amber-600" />
          <span>Ghế <strong className="text-[#005A36]">{ticket.seatNumber}</strong></span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 gap-2 text-xs">
        <span className="font-mono font-black text-sm text-[#005A36]">
          {formatPrice(ticket.price)}
        </span>
        <div className="flex items-center gap-1.5">
          {(ticket.status === 'PAID' || ticket.status === 'RESERVED' || ticket.status === 'VALID') && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onExchange?.()
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 transition-colors cursor-pointer touch-press touch-manipulation"
              >
                Đổi chuyến
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onCancel?.()
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200 transition-colors cursor-pointer touch-press touch-manipulation"
              >
                Hủy vé
              </button>
            </>
          )}
          <div className="inline-flex items-center gap-1 font-bold text-slate-500 group-hover:text-[#005A36] transition-colors text-[11px] ml-1">
            <QrCode size={13} />
            <span>Chi tiết & QR</span>
            <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </button>
  )
}

export function MyTicketsPage() {
  const { isAuthenticated, user } = useAuth()
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<TicketFilterStatus>('all')
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [cancellingTicket, setCancellingTicket] = useState<TicketSummary | null>(null)
  const [exchangingTicket, setExchangingTicket] = useState<TicketSummary | null>(null)
  const [isOffline, setIsOffline] = useState(false)

  const loadTickets = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    const res = await ticketService.getMyTickets(1, 20)
    setLoading(false)

    if (res.success && res.data) {
      setTickets(res.data.items)
    } else {
      setError(res.message || 'Chưa tải được danh sách vé')
    }
  }, [isAuthenticated])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  useEffect(() => {
    setIsOffline(!offlineTicketCache.isOnline())
    const handleOnline = () => {
      setIsOffline(false)
      loadTickets()
    }
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [loadTickets])

  const displayedTickets = filterTickets(tickets, filter)

  return (
    <div className="space-y-4">
      {/* Offline Mode Alert */}
      {isOffline && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 flex items-center justify-between text-xs text-amber-900 gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <WifiOff className="w-5 h-5 text-amber-600 shrink-0 animate-pulse" />
            <div>
              <p className="font-bold">Chế độ Ngoại tuyến (Offline Mode)</p>
              <p className="text-[11px] text-amber-700">
                Đang hiển thị danh sách vé lưu tạm trên thiết bị. Bạn vẫn có thể bấm vào vé để mở mã QR quét cổng xe buýt bình thường.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadTickets()}
            className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 font-bold hover:bg-amber-100/50 shrink-0 cursor-pointer shadow-2xs"
          >
            Thử tải lại
          </button>
        </div>
      )}
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-[#005A36] text-white shadow-sm shrink-0">
            <Ticket size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Vé Điện Tử Của Tôi
              </h2>
              {tickets.length > 0 && (
                <span className="rounded-full bg-emerald-100 text-[#005A36] px-2.5 py-0.5 text-[10px] font-black">
                  {tickets.length} VÉ
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Quét mã QR qua cổng soát vé thông minh & đổi vé trước 2 tiếng khởi hành
            </p>
          </div>
        </div>

        {/* Filter Pills Horizontal Scroll Touch */}
        <div className="flex items-center overflow-x-auto no-scrollbar scroll-touch rounded-xl bg-slate-100 p-1 text-xs font-bold shrink-0 max-w-full">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 touch-press touch-manipulation ${
                filter === tab.key
                  ? 'bg-white text-[#005A36] shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body Area */}
      {!isAuthenticated ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-3 shadow-xs">
          <div className="size-12 rounded-2xl bg-emerald-100 text-[#005A36] flex items-center justify-center mx-auto">
            <LogIn size={24} />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">
            Đăng Nhập Để Xem Vé Đã Mua
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Đăng nhập tài khoản sinh viên hoặc tài khoản hành khách để tự động đồng bộ lịch sử vé điện tử, mã QR và thẻ xe buýt.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-[#005A36] hover:bg-[#004529] px-5 py-2.5 text-xs font-black text-white shadow-md transition-all"
            >
              <LogIn size={15} />
              <span>Đăng nhập ngay</span>
            </Link>
          </div>
        </div>
      ) : loading ? (
        <div className="py-12 text-center space-y-2">
          <Loader2 size={28} className="text-[#005A36] animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Đang tải lịch sử vé điện tử...</p>
        </div>
      ) : displayedTickets.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-3 shadow-xs">
          <div className="size-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Ticket size={24} />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">
            Không Tìm Thấy Vé Nào ({FILTER_TABS.find((t) => t.key === filter)?.label})
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Bạn chưa có vé xe buýt nào trong danh mục này. Hãy chọn tuyến xe và đặt vé trực tuyến ngay hôm nay!
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#005A36] hover:bg-[#004529] px-5 py-2.5 text-xs font-black text-white shadow-md"
            >
              <Bus size={15} />
              <span>Đặt vé xe buýt ngay</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {displayedTickets.map((t) => (
            <TicketCard
              key={t.ticketId}
              ticket={t}
              onClick={() => setSelectedTicketId(t.ticketId)}
              onExchange={() => setExchangingTicket(t)}
              onCancel={() => setCancellingTicket(t)}
            />
          ))}
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicketId && (
        <TicketDetailModal
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
          onCancelled={() => {
            loadTickets()
          }}
        />
      )}

      {/* Direct Exchange Modal */}
      {exchangingTicket && (
        <ExchangeTicketModal
          ticketId={exchangingTicket.ticketId}
          ticketCode={exchangingTicket.ticketCode}
          currentSeatNumber={exchangingTicket.seatNumber}
          currentDepartureTime={exchangingTicket.departureTime}
          currentPrice={exchangingTicket.price}
          routeName={exchangingTicket.routeName}
          onClose={() => setExchangingTicket(null)}
          onSuccess={() => {
            setExchangingTicket(null)
            loadTickets()
          }}
        />
      )}

      {/* Direct Cancel Modal */}
      {cancellingTicket && (
        <CancellationPolicyModal
          ticketId={cancellingTicket.ticketId}
          ticketCode={cancellingTicket.ticketCode}
          seatNumber={cancellingTicket.seatNumber}
          departureTime={cancellingTicket.departureTime}
          price={cancellingTicket.price}
          onClose={() => setCancellingTicket(null)}
          onSuccess={() => {
            setCancellingTicket(null)
            loadTickets()
          }}
        />
      )}
    </div>
  )
}
