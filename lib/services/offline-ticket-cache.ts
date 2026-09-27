/**
 * Service lưu trữ tạm và quản lý vé ngoại tuyến (Offline Ticket Cache)
 * Hỗ trợ hành khách mở mã QR và chi tiết vé khi mất mạng / không có internet
 */

import type { TicketDetail, TicketSummary } from '@/lib/types/ticket'

const TICKET_DETAIL_PREFIX = 'ictu_offline_ticket_'
const TICKETS_LIST_KEY = 'ictu_offline_tickets_list'
const LAST_SYNC_KEY = 'ictu_offline_last_sync'

export const offlineTicketCache = {
  /**
   * Kiểm tra thiết bị có đang online không
   */
  isOnline(): boolean {
    if (typeof window === 'undefined') return true
    return navigator.onLine
  },

  /**
   * Lưu chi tiết 1 vé vào cache thiết bị
   */
  saveTicket(ticket: TicketDetail): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(
        `${TICKET_DETAIL_PREFIX}${ticket.ticketId}`,
        JSON.stringify({
          ...ticket,
          cachedAt: new Date().toISOString(),
        }),
      )
    } catch (e) {
      console.warn('[OfflineTicketCache] Không thể lưu vé vào cache:', e)
    }
  },

  /**
   * Lấy chi tiết vé từ cache thiết bị khi offline
   */
  getTicket(ticketId: string): TicketDetail | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(`${TICKET_DETAIL_PREFIX}${ticketId}`)
      if (!raw) return null
      return JSON.parse(raw) as TicketDetail
    } catch (e) {
      console.warn('[OfflineTicketCache] Lỗi đọc vé từ cache:', e)
      return null
    }
  },

  /**
   * Lưu danh sách tóm tắt vé
   */
  saveTicketsList(tickets: TicketSummary[]): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(TICKETS_LIST_KEY, JSON.stringify(tickets))
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
    } catch (e) {
      console.warn('[OfflineTicketCache] Không thể lưu danh sách vé:', e)
    }
  },

  /**
   * Lấy danh sách tóm tắt vé từ cache
   */
  getTicketsList(): TicketSummary[] | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(TICKETS_LIST_KEY)
      if (!raw) return null
      return JSON.parse(raw) as TicketSummary[]
    } catch (e) {
      return null
    }
  },

  /**
   * Lấy thời gian đồng bộ cuối cùng
   */
  getLastSyncTime(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(LAST_SYNC_KEY)
  },
}
