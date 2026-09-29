/**
 * Service lưu trữ tạm và quản lý vé ngoại tuyến (Offline Ticket Cache)
 * Hỗ trợ hành khách mở mã QR và chi tiết vé khi mất mạng / không có internet
 */

import type { TicketDetail, TicketSummary } from '@/lib/types/ticket'
import { authService } from './auth.service'

const TICKET_DETAIL_PREFIX = 'ictu_offline_ticket_'
const TICKETS_LIST_PREFIX = 'ictu_offline_tickets_list_'
const TICKETS_LIST_LEGACY_KEY = 'ictu_offline_tickets_list'
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
   * Lấy User ID của người dùng hiện tại đang đăng nhập
   */
  getCurrentUserId(): string | null {
    if (typeof window === 'undefined') return null
    const currentUser = authService.getUser()
    return currentUser?.id || currentUser?.email || null
  },

  /**
   * Lưu chi tiết 1 vé vào cache thiết bị và tự động cập nhật vào danh sách vé của người dùng đó
   */
  /**
   * Lưu chi tiết 1 vé vào cache thiết bị và tự động cập nhật vào danh sách vé của người dùng đó
   */
  saveTicket(ticket: TicketDetail, userId?: string): void {
    if (typeof window === 'undefined') return
    try {
      const targetUserId = userId || (ticket as any).userId || this.getCurrentUserId() || 'usr_guest'

      const ticketPayload = JSON.stringify({
        ...ticket,
        userId: targetUserId,
        cachedAt: new Date().toISOString(),
      })

      // Lưu chi tiết vé dưới ticketId
      if (ticket.ticketId) {
        localStorage.setItem(`${TICKET_DETAIL_PREFIX}${ticket.ticketId}`, ticketPayload)
      }

      // Lưu alias dưới id (nếu khác ticketId)
      if ((ticket as any).id && (ticket as any).id !== ticket.ticketId) {
        localStorage.setItem(`${TICKET_DETAIL_PREFIX}${(ticket as any).id}`, ticketPayload)
      }

      // Lưu alias dưới ticketCode (nếu khác ticketId)
      if (ticket.ticketCode && ticket.ticketCode !== ticket.ticketId) {
        localStorage.setItem(`${TICKET_DETAIL_PREFIX}${ticket.ticketCode}`, ticketPayload)
      }

      // Đồng thời cập nhật vào danh sách vé của riêng tài khoản này
      if (targetUserId) {
        const userTickets = this.getUserTicketsList(targetUserId)
        const summaryItem: TicketSummary = {
          ticketId: ticket.ticketId || (ticket as any).id || ticket.ticketCode,
          ticketCode: ticket.ticketCode || ticket.ticketId,
          seatNumber: ticket.seatNumber,
          routeName: ticket.routeName || 'Tuyến CT-01: ICTU ↔ Bến Xe TP',
          origin: ticket.origin || (ticket as any).originStation || 'ĐH CNTT & TT (ICTU)',
          destination: ticket.destination || (ticket as any).destinationStation || 'Bến Xe Trung Tâm Thái Nguyên',
          departureTime: ticket.departureTime || new Date().toISOString(),
          passengerName: ticket.passengerName,
          price: ticket.price,
          status: ticket.status || 'PAID',
          vehiclePlate: ticket.vehiclePlate || '20B-012.34',
          routeCode: ticket.routeCode || 'CT-01',
          busNumber: ticket.busNumber || 'CT-01',
          checkedInAt: ticket.checkedInAt || null,
        }

        const existingIdx = userTickets.findIndex(
          (t) =>
            t.ticketId === summaryItem.ticketId ||
            (t as any).id === summaryItem.ticketId ||
            t.ticketCode === summaryItem.ticketCode,
        )
        if (existingIdx >= 0) {
          userTickets[existingIdx] = summaryItem
        } else {
          userTickets.unshift(summaryItem)
        }

        this.saveUserTicketsList(targetUserId, userTickets)
      }
    } catch (e) {
      console.warn('[OfflineTicketCache] Không thể lưu vé vào cache:', e)
    }
  },

  /**
   * Lấy chi tiết vé từ cache thiết bị khi offline hoặc khi API backend chưa sẵn sàng
   */
  getTicket(ticketId: string): TicketDetail | null {
    if (typeof window === 'undefined' || !ticketId) return null
    try {
      // 1. Kiểm tra trực tiếp key theo ticketId / alias
      const raw = localStorage.getItem(`${TICKET_DETAIL_PREFIX}${ticketId}`)
      if (raw) {
        return JSON.parse(raw) as TicketDetail
      }

      // 2. Tìm kiếm trong danh sách vé của tài khoản hiện tại
      const targetUserId = this.getCurrentUserId()
      const userLists: TicketSummary[][] = []

      if (targetUserId) {
        userLists.push(this.getUserTicketsList(targetUserId))
      }
      userLists.push(this.getUserTicketsList('usr_guest'))

      // 3. Tìm trong toàn bộ các danh sách vé offline đã lưu trong localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(TICKETS_LIST_PREFIX)) {
          try {
            const parsed = JSON.parse(localStorage.getItem(key) || '[]')
            if (Array.isArray(parsed)) userLists.push(parsed)
          } catch {}
        }
      }

      for (const list of userLists) {
        const matched = list.find(
          (t) =>
            t.ticketId === ticketId ||
            (t as any).id === ticketId ||
            t.ticketCode === ticketId ||
            (ticketId.includes('-') && t.ticketCode?.includes(ticketId)) ||
            (ticketId.includes('-') && t.ticketId?.includes(ticketId)),
        )

        if (matched) {
          const detail: TicketDetail = {
            ticketId: matched.ticketId,
            ticketCode: matched.ticketCode,
            bookingCode: (matched as any).bookingCode || 'BK-ICTU-' + matched.ticketCode.slice(-4),
            passengerName: matched.passengerName || 'Hành khách ICTU',
            passengerPhone: (matched as any).passengerPhone || '0981234567',
            seatNumber: matched.seatNumber || '01A',
            seatType: (matched as any).seatType || 'Ghế tiêu chuẩn',
            price: Number(matched.price || 5000),
            status: matched.status || 'PAID',
            routeName: matched.routeName || 'ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên',
            origin: matched.origin || 'ĐH CNTT & TT (ICTU)',
            destination: matched.destination || 'Bến Xe Trung Tâm Thái Nguyên',
            departureTime: matched.departureTime || new Date().toISOString(),
            vehiclePlate: matched.vehiclePlate || '20B-012.34',
            qrDataUrl: (matched as any).qrDataUrl || '',
            qrData: (matched as any).qrData || `ICTU-PASS:${matched.ticketCode}`,
            signature: (matched as any).signature,
            busNumber: matched.busNumber || 'CT-01',
            routeCode: matched.routeCode || 'CT-01',
            checkedInAt: matched.checkedInAt || null,
            tripId: (matched as any).tripId || 'trip-demo-01',
            createdAt: (matched as any).createdAt || new Date().toISOString(),
          }

          // Tự động cache ngược lại dưới key tìm kiếm để lần sau đọc tức thì
          try {
            localStorage.setItem(`${TICKET_DETAIL_PREFIX}${ticketId}`, JSON.stringify(detail))
          } catch {}

          return detail
        }
      }

      return null
    } catch (e) {
      console.warn('[OfflineTicketCache] Lỗi đọc vé từ cache:', e)
      return null
    }
  },

  /**
   * Cập nhật trạng thái vé (VD: CANCELLED, EXCHANGED) trong cả chi tiết lẫn danh sách vé của người dùng
   */
  updateTicketStatus(ticketId: string, status: any, userId?: string): void {
    if (typeof window === 'undefined') return
    try {
      const targetUserId = userId || this.getCurrentUserId()

      // 1. Cập nhật chi tiết vé
      const detail = this.getTicket(ticketId)
      if (detail) {
        detail.status = status
        localStorage.setItem(
          `${TICKET_DETAIL_PREFIX}${ticketId}`,
          JSON.stringify({
            ...detail,
            cachedAt: new Date().toISOString(),
          }),
        )
      }

      // 2. Cập nhật trong danh sách vé của người dùng
      if (targetUserId) {
        const userTickets = this.getUserTicketsList(targetUserId)
        const updated = userTickets.map((t) => (t.ticketId === ticketId ? { ...t, status } : t))
        this.saveUserTicketsList(targetUserId, updated)
      }
    } catch (e) {
      console.warn('[OfflineTicketCache] Lỗi khi cập nhật trạng thái vé:', e)
    }
  },

  /**
   * Lưu danh sách tóm tắt vé của một tài khoản cụ thể
   */
  saveUserTicketsList(userId: string, tickets: TicketSummary[]): void {
    if (typeof window === 'undefined' || !userId) return
    try {
      localStorage.setItem(`${TICKETS_LIST_PREFIX}${userId}`, JSON.stringify(tickets))
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
    } catch (e) {
      console.warn('[OfflineTicketCache] Không thể lưu danh sách vé theo user:', e)
    }
  },

  /**
   * Lấy danh sách tóm tắt vé của một tài khoản cụ thể (bảo đảm tính bảo mật phân quyền dữ liệu)
   */
  getUserTicketsList(userId: string): TicketSummary[] {
    if (typeof window === 'undefined' || !userId) return []
    try {
      const raw = localStorage.getItem(`${TICKETS_LIST_PREFIX}${userId}`)
      if (!raw) return []
      return JSON.parse(raw) as TicketSummary[]
    } catch {
      return []
    }
  },

  /**
   * Lưu danh sách tóm tắt vé (Tương thích ngược, tự động phân quyền theo user đang đăng nhập)
   */
  saveTicketsList(tickets: TicketSummary[], userId?: string): void {
    const targetUserId = userId || this.getCurrentUserId()
    if (targetUserId) {
      this.saveUserTicketsList(targetUserId, tickets)
    } else {
      try {
        localStorage.setItem(TICKETS_LIST_LEGACY_KEY, JSON.stringify(tickets))
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
      } catch (e) {
        console.warn('[OfflineTicketCache] Không thể lưu danh sách vé:', e)
      }
    }
  },

  /**
   * Lấy danh sách tóm tắt vé từ cache của tài khoản hiện tại
   */
  getTicketsList(userId?: string): TicketSummary[] | null {
    if (typeof window === 'undefined') return null
    const targetUserId = userId || this.getCurrentUserId()
    if (targetUserId) {
      return this.getUserTicketsList(targetUserId)
    }
    return []
  },

  /**
   * Lấy thời gian đồng bộ cuối cùng
   */
  getLastSyncTime(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(LAST_SYNC_KEY)
  },
}
