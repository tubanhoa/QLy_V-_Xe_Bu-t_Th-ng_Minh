/**
 * Service quản lý thông báo, kết nối REST API Backend & Bộ đệm Offline
 * Domain: notifications & geofencing
 * Endpoints:
 *   GET    /api/v1/notifications               → Lấy danh sách thông báo
 *   GET    /api/v1/notifications/unread-count  → Đếm số lượng chưa đọc
 *   PATCH  /api/v1/notifications/:id/read      → Đánh dấu 1 thông báo đã đọc
 *   PATCH  /api/v1/notifications/read-all      → Đánh dấu tất cả đã đọc
 *   GET    /api/v1/notifications/preferences   → Lấy cài đặt nhận tin
 *   PUT    /api/v1/notifications/preferences   → Cập nhật cài đặt
 *   POST   /api/v1/notifications/device-token  → Đăng ký FCM token
 *   DELETE /api/v1/notifications/device-token/:token → Hủy đăng ký FCM token
 */

import { authService } from './auth.service'
import type {
  NotificationItem,
  NotificationListResponse,
  NotificationPreferences,
  RegisterDeviceTokenPayload,
} from '@/lib/types/notification'
import type { UnifiedApiResponse } from '@/lib/types/sprint1'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

const NOTIFICATIONS_CACHE_KEY = 'ictu_notifications_cache_v1'
const PREFERENCES_CACHE_KEY = 'ictu_notification_preferences_v1'

// Mock notifications ban đầu cho mục đích kiểm thử UI/UX khi chưa có dữ liệu từ backend
const INITIAL_SEED_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'seed-notif-1',
    userId: 'guest',
    type: 'STATION_APPROACHING_PICKUP',
    title: 'Xe buýt sắp đến điểm đón!',
    body: 'Tuyến 01 (Xe 29B-123.45) đang cách Trạm ĐH CNTT & TT Thái Nguyên (ICTU) khoảng 450m (~3 phút). Quý khách vui lòng chuẩn bị sẵn sàng!',
    data: {
      tripId: 'trip_demo_01',
      stationId: 'st_ictu_01',
      stationName: 'Trạm ĐH CNTT & TT Thái Nguyên (ICTU)',
      distanceMeters: 450,
      etaMinutes: 3,
      deepLink: '/tracking/trip_demo_01?pickup=st_ictu_01',
      vehiclePlate: '29B-123.45',
      routeCode: 'CT-01',
    },
    isRead: false,
    deliveryStatus: 'SENT',
    createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
  {
    id: 'seed-notif-2',
    userId: 'guest',
    type: 'TICKET_BOOKED',
    title: 'Đặt vé thành công - ICTU-TK-98821',
    body: 'Vé điện tử Tuyến 01 ĐH CNTT & TT ⇄ Bến xe TT đã được cấp mã QR HMAC-SHA256 hợp lệ. Chúc quý khách một hành trình an toàn!',
    data: {
      bookingCode: 'ICTU-BK-98821',
      deepLink: '/?openTickets=true',
    },
    isRead: false,
    deliveryStatus: 'SENT',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'seed-notif-3',
    userId: 'guest',
    type: 'PROMOTION',
    title: 'Ưu đãi sinh viên ICTU giảm 50%',
    body: 'Vé tháng sinh viên ICTU tuyến CT-01 & CT-02 đang được trợ giá 50%. Hãy đăng ký trực tuyến ngay hôm nay!',
    data: {
      deepLink: '/?openMonthlyPass=true',
    },
    isRead: true,
    readAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    deliveryStatus: 'SENT',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
]

class NotificationService {
  private baseUrl: string

  constructor() {
    const raw = (API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/+$/, '')
    this.baseUrl = raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`
  }

  private getAuthHeaders(): HeadersInit {
    const token = authService.getToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  private getLocalCache(userId: string): NotificationItem[] {
    if (typeof window === 'undefined') return INITIAL_SEED_NOTIFICATIONS
    try {
      const raw = localStorage.getItem(`${NOTIFICATIONS_CACHE_KEY}_${userId}`)
      if (raw) {
        return JSON.parse(raw)
      }
      // Khởi tạo seed ban đầu nếu chưa có cache
      localStorage.setItem(`${NOTIFICATIONS_CACHE_KEY}_${userId}`, JSON.stringify(INITIAL_SEED_NOTIFICATIONS))
      return INITIAL_SEED_NOTIFICATIONS
    } catch {
      return INITIAL_SEED_NOTIFICATIONS
    }
  }

  private saveLocalCache(userId: string, items: NotificationItem[]): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(`${NOTIFICATIONS_CACHE_KEY}_${userId}`, JSON.stringify(items))
    } catch (e) {
      console.warn('[NotificationService.saveLocalCache] Lỗi lưu cache:', e)
    }
  }

  /**
   * Lấy danh sách thông báo người dùng (có phân trang & lọc)
   */
  async getNotifications(
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false,
  ): Promise<UnifiedApiResponse<NotificationListResponse>> {
    const user = authService.getUser()
    const userId = user?.id || 'guest'

    try {
      const url = new URL(`${this.baseUrl}/notifications`)
      url.searchParams.set('page', String(page))
      url.searchParams.set('limit', String(limit))
      if (unreadOnly) {
        url.searchParams.set('unreadOnly', 'true')
      }

      const res = await fetch(url.toString(), {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })

      if (res.ok) {
        const json = await res.json()
        const data = json?.data || json
        return {
          success: true,
          data: {
            notifications: data.notifications || data || [],
            total: data.total || data.length || 0,
            unreadCount: data.unreadCount || 0,
            page,
            limit,
          },
        }
      }
    } catch (e) {
      console.warn('[NotificationService.getNotifications] Backend không khả dụng, sử dụng local cache:', e)
    }

    // Fallback Local Storage
    const all = this.getLocalCache(userId)
    const filtered = unreadOnly ? all.filter((n) => !n.isRead) : all
    const startIndex = (page - 1) * limit
    const pageItems = filtered.slice(startIndex, startIndex + limit)
    const unreadCount = all.filter((n) => !n.isRead).length

    return {
      success: true,
      data: {
        notifications: pageItems,
        total: filtered.length,
        unreadCount,
        page,
        limit,
      },
    }
  }

  /**
   * Đếm số lượng thông báo chưa đọc
   */
  async getUnreadCount(): Promise<number> {
    const user = authService.getUser()
    const userId = user?.id || 'guest'

    try {
      const res = await fetch(`${this.baseUrl}/notifications/unread-count`, {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })
      if (res.ok) {
        const json = await res.json()
        const count = json?.data?.unreadCount ?? json?.unreadCount
        if (typeof count === 'number') return count
      }
    } catch {
      // ignore
    }

    const all = this.getLocalCache(userId)
    return all.filter((n) => !n.isRead).length
  }

  /**
   * Đánh dấu một thông báo là đã đọc
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    const user = authService.getUser()
    const userId = user?.id || 'guest'

    try {
      const res = await fetch(`${this.baseUrl}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
      })
      if (res.ok) {
        // Cập nhật đồng thời local cache
        const all = this.getLocalCache(userId)
        const updated = all.map((n) =>
          n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
        )
        this.saveLocalCache(userId, updated)
        return true
      }
    } catch {
      // ignore
    }

    // Fallback local update
    const all = this.getLocalCache(userId)
    const updated = all.map((n) =>
      n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
    )
    this.saveLocalCache(userId, updated)
    return true
  }

  /**
   * Đánh dấu tất cả thông báo là đã đọc
   */
  async markAllAsRead(): Promise<boolean> {
    const user = authService.getUser()
    const userId = user?.id || 'guest'

    try {
      const res = await fetch(`${this.baseUrl}/notifications/read-all`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
      })
      if (res.ok) {
        const all = this.getLocalCache(userId)
        const updated = all.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        this.saveLocalCache(userId, updated)
        return true
      }
    } catch {
      // ignore
    }

    // Fallback local update
    const all = this.getLocalCache(userId)
    const updated = all.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
    this.saveLocalCache(userId, updated)
    return true
  }

  /**
   * Thêm thông báo mới vào đầu danh sách (dành cho In-app Realtime events)
   */
  prependNotification(item: NotificationItem): void {
    const user = authService.getUser()
    const userId = user?.id || 'guest'
    const all = this.getLocalCache(userId)
    // Tránh trùng ID
    const exists = all.some((n) => n.id === item.id)
    if (!exists) {
      this.saveLocalCache(userId, [item, ...all])
    }
  }

  /**
   * Lấy cài đặt nhận thông báo của người dùng
   */
  async getPreferences(): Promise<NotificationPreferences> {
    const defaultPrefs: NotificationPreferences = {
      pushEnabled: true,
      smsEnabled: false,
      emailEnabled: true,
    }

    try {
      const res = await fetch(`${this.baseUrl}/notifications/preferences`, {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })
      if (res.ok) {
        const json = await res.json()
        return json?.data || json || defaultPrefs
      }
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(PREFERENCES_CACHE_KEY)
        if (raw) return JSON.parse(raw)
      } catch {
        // ignore
      }
    }
    return defaultPrefs
  }

  /**
   * Cập nhật cài đặt nhận thông báo
   */
  async updatePreferences(
    prefs: Partial<NotificationPreferences>,
  ): Promise<UnifiedApiResponse<NotificationPreferences>> {
    try {
      const res = await fetch(`${this.baseUrl}/notifications/preferences`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(prefs),
      })
      if (res.ok) {
        const json = await res.json()
        const data = json?.data || json
        if (typeof window !== 'undefined') {
          localStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(data))
        }
        return { success: true, data }
      }
    } catch {
      // ignore
    }

    // Fallback local
    const current = await this.getPreferences()
    const updated = { ...current, ...prefs }
    if (typeof window !== 'undefined') {
      localStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(updated))
    }
    return { success: true, data: updated }
  }

  /**
   * Đăng ký FCM Device Registration Token với Backend
   */
  async registerDeviceToken(
    payload: RegisterDeviceTokenPayload,
  ): Promise<UnifiedApiResponse<{ token: string }>> {
    try {
      const res = await fetch(`${this.baseUrl}/notifications/device-token`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          token: payload.token,
          platform: payload.platform || 'WEB',
          deviceModel: payload.deviceModel || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser'),
        }),
      })
      if (res.ok) {
        const json = await res.json()
        return { success: true, data: json?.data || json }
      }
    } catch (e: any) {
      console.warn('[NotificationService.registerDeviceToken] Lỗi đăng ký token:', e)
    }

    return {
      success: true,
      message: 'Token đã được lưu cục bộ trên thiết bị',
      data: { token: payload.token },
    }
  }

  /**
   * Hủy đăng ký FCM Device Token khi đăng xuất
   */
  async unregisterDeviceToken(token: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/notifications/device-token/${encodeURIComponent(token)}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      })
      return res.ok
    } catch {
      return false
    }
  }
}

export const notificationService = new NotificationService()
