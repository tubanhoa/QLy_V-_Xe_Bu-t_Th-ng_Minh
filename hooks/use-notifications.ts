'use client'

/**
 * Hook quản lý Thông báo & Cảnh báo Geofencing Realtime
 * Domain: notifications & geofencing
 * Branch: feature/SBTS-frontend-geofencing-and-push-notification
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { notificationService } from '@/lib/services/notification.service'
import { haptic } from '@/lib/utils/haptics'
import type {
  NotificationItem,
  NotificationPreferences,
  GeofenceStationAlert,
} from '@/lib/types/notification'

export interface UseNotificationsReturn {
  notifications: NotificationItem[]
  unreadCount: number
  isLoading: boolean
  isRefreshing: boolean
  preferences: NotificationPreferences | null
  activeGeofenceAlert: GeofenceStationAlert | null
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  refreshNotifications: () => Promise<void>
  dismissGeofenceAlert: () => void
  updatePreferences: (partial: Partial<NotificationPreferences>) => Promise<boolean>
  triggerMockGeofenceAlert: (customAlert?: Partial<GeofenceStationAlert>) => void
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [activeGeofenceAlert, setActiveGeofenceAlert] = useState<GeofenceStationAlert | null>(null)

  const isMounted = useRef<boolean>(true)
  const alertTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 1. Tải danh sách thông báo & đếm chưa đọc
  const fetchNotifications = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true)
    try {
      const [resList, prefs] = await Promise.all([
        notificationService.getNotifications(1, 20),
        notificationService.getPreferences(),
      ])

      if (!isMounted.current) return

      if (resList.success && resList.data) {
        setNotifications(resList.data.notifications)
        setUnreadCount(resList.data.unreadCount)
      }
      setPreferences(prefs)
    } finally {
      if (isMounted.current && !isSilent) {
        setIsLoading(false)
      }
    }
  }, [])

  // 2. Làm mới dữ liệu
  const refreshNotifications = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetchNotifications(true)
    } finally {
      if (isMounted.current) {
        setIsRefreshing(false)
      }
    }
  }, [fetchNotifications])

  // 3. Đánh dấu đã đọc 1 thông báo
  const markAsRead = useCallback(async (id: string) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)),
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))

    haptic.play('tap')
    await notificationService.markAsRead(id)
  }, [])

  // 4. Đánh dấu tất cả đã đọc
  const markAllAsRead = useCallback(async () => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
    )
    setUnreadCount(0)

    haptic.play('success')
    await notificationService.markAllAsRead()
  }, [])

  // 5. Cập nhật cài đặt nhận thông báo
  const updatePreferences = useCallback(
    async (partial: Partial<NotificationPreferences>): Promise<boolean> => {
      haptic.play('select')
      const res = await notificationService.updatePreferences(partial)
      if (res.success && res.data) {
        setPreferences(res.data)
        return true
      }
      return false
    },
    [],
  )

  // 6. Tắt cảnh báo nổi Geofence
  const dismissGeofenceAlert = useCallback(() => {
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current)
      alertTimerRef.current = null
    }
    setActiveGeofenceAlert(null)
  }, [])

  // 7. Kích hoạt cảnh báo Geofence (Realtime hoặc Test demo)
  const triggerMockGeofenceAlert = useCallback((customAlert?: Partial<GeofenceStationAlert>) => {
    const alert: GeofenceStationAlert = {
      tripId: customAlert?.tripId || 'trip_ct01_live',
      stationId: customAlert?.stationId || 'st_ictu_gate1',
      stationName: customAlert?.stationName || 'Trạm ĐH CNTT & TT Thái Nguyên (ICTU)',
      distanceMeters: customAlert?.distanceMeters ?? 450,
      etaMinutes: customAlert?.etaMinutes ?? 3,
      type: customAlert?.type || 'pickup',
      message:
        customAlert?.message ||
        'Xe buýt số 01 (29B-123.45) sắp đến Trạm ĐH CNTT & TT Thái Nguyên (còn ~450m)! Vui lòng chuẩn bị ra điểm đón.',
      timestamp: new Date().toISOString(),
    }

    // Phát âm thanh transit chime & rung
    haptic.play('busArrival')

    // Lưu vào thông báo in-app
    const newNotifItem: NotificationItem = {
      id: `alert-${Date.now()}`,
      userId: 'guest',
      tripId: alert.tripId,
      stationId: alert.stationId,
      type: alert.type === 'dropoff' ? 'STATION_APPROACHING_DROPOFF' : 'STATION_APPROACHING_PICKUP',
      title: alert.type === 'dropoff' ? 'Chuẩn bị xuống xe!' : 'Xe buýt sắp đến điểm đón!',
      body: alert.message,
      data: {
        tripId: alert.tripId,
        stationId: alert.stationId,
        stationName: alert.stationName,
        distanceMeters: alert.distanceMeters,
        etaMinutes: alert.etaMinutes,
        deepLink: `/tracking/${alert.tripId}?pickup=${encodeURIComponent(alert.stationName)}`,
      },
      isRead: false,
      deliveryStatus: 'SENT',
      createdAt: new Date().toISOString(),
    }

    notificationService.prependNotification(newNotifItem)
    setNotifications((prev) => [newNotifItem, ...prev.filter((n) => n.id !== newNotifItem.id)])
    setUnreadCount((prev) => prev + 1)

    // Hiển thị banner nổi
    setActiveGeofenceAlert(alert)

    // Tự động đóng sau 12 giây nếu người dùng không tương tác
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current)
    alertTimerRef.current = setTimeout(() => {
      setActiveGeofenceAlert(null)
    }, 12000)
  }, [])

  // 8. Lifecycle Effect: Fetch dữ liệu & Lắng nghe Custom Window Event / Polling
  useEffect(() => {
    isMounted.current = true
    fetchNotifications()

    // Lắng nghe sự kiện toàn cục khi WebSocket hoặc trang tracking phát hiện xe vào geofence
    const handleGlobalStationAlert = (e: CustomEvent<any>) => {
      const data = e.detail
      if (data) {
        triggerMockGeofenceAlert({
          tripId: data.tripId,
          stationId: data.stationId,
          stationName: data.stationName || data.message,
          distanceMeters: data.distanceMeters || 500,
          etaMinutes: data.etaMinutes || 3,
          message: data.message || `Xe buýt sắp đến ${data.stationName || 'trạm đón'}`,
          type: data.type || 'pickup',
        })
      }
    }

    window.addEventListener('ictu:station-alert' as any, handleGlobalStationAlert)

    // Polling định kỳ mỗi 20s cập nhật unread count trong background
    const interval = setInterval(() => {
      notificationService.getUnreadCount().then((count) => {
        if (isMounted.current) {
          setUnreadCount(count)
        }
      })
    }, 20000)

    return () => {
      isMounted.current = false
      window.removeEventListener('ictu:station-alert' as any, handleGlobalStationAlert)
      clearInterval(interval)
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current)
    }
  }, [fetchNotifications, triggerMockGeofenceAlert])

  return {
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    preferences,
    activeGeofenceAlert,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    dismissGeofenceAlert,
    updatePreferences,
    triggerMockGeofenceAlert,
  }
}
