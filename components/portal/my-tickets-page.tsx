'use client'

/**
 * Trang Lịch sử vé của hành khách
 * - Hiển thị tất cả vé đã mua, filter theo trạng thái
 * - Click vào vé mở TicketDetailModal
 * - Responsive: list trên mobile, grid trên desktop
 * File mới hoàn toàn — không chạm file cũ
 * Branch: feature/SBTS-my-tickets-fe
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
} from 'lucide-react'
import { ticketService } from '@/lib/services/ticket.service'
import type { TicketSummary, TicketFilterStatus } from '@/lib/types/ticket'
import {
  TICKET_STATUS_COLOR,
  TICKET_STATUS_LABEL,
} from '@/lib/types/ticket'
import { TicketDetailModal } from './ticket-detail-modal'

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
          new Date(t.departureTime).getTime() > now,
      )
    case 'past':
      return tickets.filter(
        (t) =>
          t.status === 'CHECKED_IN' ||
          new Date(t.departureTime).getTime() <= now,
      )
    case 'cancelled':
      return tickets.filter((t) => t.status === 'CANCELLED' || t.status === 'EXPIRED')
    default:
      return tickets
  }
}

function TicketCard({
  ticket,
  onClick,
}: {
  ticket: TicketSummary
  onClick: () => void
}) {
  const statusColor = TICKET_STATUS_COLOR[ticket.status] ?? TICKET_STATUS_COLOR['PENDING']
  const isPast = new Date(ticket.departureTime).getTime() < Date.now()

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

  return (
    <button
      onClick={onClick}
      className={`group w-full text-left rounded-2xl border transition-all duration-200 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/40 overflow-hidden ${
        isPast && ticket.status !== 'CHECKED_IN'
          ? 'bg-white/3 border-white/6 opacity-70 hover:opacity-100'
          : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/15'
      }`}
      id={`ticket-card-${ticket.ticketId}`}
    >
      {/* Top accent bar */}
      <div
        className={`h-0.5 w-full ${
          ticket.status === 'PAID' || ticket.status === 'CHECKED_IN'
            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
            : ticket.status === 'PENDING' || ticket.status === 'RESERVED'
            ? 'bg-gradient-to-r from-amber-500 to-orange-400'
            : 'bg-gradient-to-r from-slate-600 to-slate-500'
        }`}
      />

      <div className="p-4 space-y-3">
        {/* Header: route + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate leading-snug">
              {ticket.routeName || 'Chuyến xe buýt'}
            </p>
            <p className="text-xs text-white/40 mt-0.5 font-mono">{ticket.bookingCode}</p>
          </div>
          <span
            className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
          >
            <span className="w-1 h-1 rounded-full bg-current" />
            {TICKET_STATUS_LABEL[ticket.status]}
          </span>
        </div>

        {/* Info row */}
        <div className="flex items-center gap-4 text-xs text-white/50">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            {formatDate(ticket.departureTime)}
          </span>
          <span className="flex items-center gap-1.5">
            <Armchair className="w-3.5 h-3.5 text-amber-400" />
            Ghế {ticket.seatNumber}
          </span>
        </div>

        {/* Footer: price + arrow */}
        <div className="flex items-center justify-between pt-1 border-t border-white/6">
          <span className="text-sm font-bold text-[#00d4aa]">
            {formatPrice(ticket.price)}
          </span>
          <div className="flex items-center gap-1 text-xs text-white/30 group-hover:text-white/60 transition-colors">
            <span>Xem QR</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </button>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/8 overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-white/10 to-white/5" />
      <div className="p-4 space-y-3">
        <div className="flex justify-between gap-3">
          <div className="space-y-1.5 flex-1">
            <div className="h-4 w-3/4 rounded-lg bg-white/8 animate-pulse" />
            <div className="h-3 w-1/3 rounded-md bg-white/5 animate-pulse" />
          </div>
          <div className="h-6 w-20 rounded-full bg-white/8 animate-pulse" />
        </div>
        <div className="flex gap-4">
          <div className="h-3 w-32 rounded-md bg-white/5 animate-pulse" />
          <div className="h-3 w-16 rounded-md bg-white/5 animate-pulse" />
        </div>
        <div className="flex justify-between border-t border-white/6 pt-1">
          <div className="h-4 w-24 rounded-md bg-white/8 animate-pulse" />
          <div className="h-3 w-16 rounded-md bg-white/5 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export function MyTicketsPage() {
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<TicketFilterStatus>('all')
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadTickets = useCallback(async (reset = false) => {
    const targetPage = reset ? 1 : page
    if (reset) {
      setLoading(true)
      setTickets([])
    } else {
      setLoadingMore(true)
    }
    setError(null)

    const result = await ticketService.getMyTickets(targetPage, 12)

    if (reset) setLoading(false)
    else setLoadingMore(false)

    if (result.success && result.data) {
      const newItems = result.data.items
      setTickets((prev) => (reset ? newItems : [...prev, ...newItems]))
      setHasMore(targetPage < result.data!.meta.totalPages)
      if (reset) setPage(1)
    } else {
      setError(result.message || 'Không thể tải vé')
    }
  }, [page])

  useEffect(() => {
    loadTickets(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLoadMore = async () => {
    const nextPage = page + 1
    setPage(nextPage)
    setLoadingMore(true)
    setError(null)

    const result = await ticketService.getMyTickets(nextPage, 12)
    setLoadingMore(false)

    if (result.success && result.data) {
      setTickets((prev) => [...prev, ...result.data!.items])
      setHasMore(nextPage < result.data!.meta.totalPages)
    }
  }

  const handleCancelled = useCallback((ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.ticketId === ticketId ? { ...t, status: 'CANCELLED' as const } : t,
      ),
    )
  }, [])

  const filtered = filterTickets(tickets, filter)

  return (
    <div className="min-h-screen bg-[#060a0f] text-white">
      {/* Page header */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#00d4aa]/10 border border-[#00d4aa]/20">
                <Ticket className="w-5 h-5 text-[#00d4aa]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Vé của tôi</h1>
                <p className="text-xs text-white/40">Lịch sử & mã QR điện tử</p>
              </div>
            </div>

            <button
              onClick={() => loadTickets(true)}
              disabled={loading}
              className="p-2 rounded-xl hover:bg-white/8 text-white/40 hover:text-white disabled:opacity-40 transition-all"
              title="Làm mới"
              id="refresh-tickets-btn"
            >
              <RefreshCw className={`w-4.5 h-4.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Stats */}
          {!loading && tickets.length > 0 && (
            <div className="mt-3 flex items-center gap-4 text-xs text-white/40">
              <span>{tickets.length} vé tổng cộng</span>
              <span>·</span>
              <span>
                {tickets.filter((t) => t.status === 'PAID' || t.status === 'RESERVED').length} đang hoạt động
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-4 sm:px-6 mb-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/4 border border-white/8 w-fit">
            <Filter className="w-3.5 h-3.5 text-white/30 ml-2 mr-1" />
            {FILTER_TABS.map((tab) => {
              const count =
                tab.key === 'all' ? tickets.length : filterTickets(tickets, tab.key).length
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`relative px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                    filter === tab.key
                      ? 'bg-[#00d4aa] text-[#060a0f] shadow-sm'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                  id={`filter-tab-${tab.key}`}
                >
                  {tab.label}
                  {count > 0 && filter !== tab.key && (
                    <span className="ml-1 text-[10px] text-white/30">{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 pb-8">
        <div className="max-w-2xl mx-auto space-y-3">
          {/* Loading skeletons */}
          {loading &&
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}

          {/* Error */}
          {error && !loading && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-6 text-center space-y-3">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={() => loadTickets(true)}
                className="text-xs text-white/50 hover:text-white underline transition-colors"
              >
                Thử lại
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-20">
              <div className="p-5 rounded-3xl bg-white/4 border border-white/8">
                <InboxIcon className="w-10 h-10 text-white/20" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/60">
                  {filter === 'all'
                    ? 'Bạn chưa có vé nào'
                    : `Không có vé nào trong mục "${FILTER_TABS.find((t) => t.key === filter)?.label}"`}
                </p>
                <p className="text-xs text-white/30 mt-1">
                  Đặt vé ngay để trải nghiệm hệ thống
                </p>
              </div>
            </div>
          )}

          {/* Ticket list */}
          {!loading &&
            filtered.map((ticket) => (
              <TicketCard
                key={ticket.ticketId}
                ticket={ticket}
                onClick={() => setSelectedTicketId(ticket.ticketId)}
              />
            ))}

          {/* Load more */}
          {!loading && hasMore && filtered.length > 0 && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/4 hover:bg-white/8 border border-white/8 text-sm text-white/50 hover:text-white disabled:opacity-50 transition-all"
              id="load-more-tickets-btn"
            >
              {loadingMore ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Xem thêm vé</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Ticket Detail Modal */}
      <TicketDetailModal
        ticketId={selectedTicketId}
        onClose={() => setSelectedTicketId(null)}
        onCancelled={handleCancelled}
      />
    </div>
  )
}
