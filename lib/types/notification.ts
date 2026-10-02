/**
 * Types cho Phân hệ Thông báo & Cảnh báo Geofencing
 * Domain: notifications & geofencing
 * Branch: feature/SBTS-frontend-geofencing-and-push-notification
 */

export type NotificationType =
  | 'STATION_APPROACHING_PICKUP'
  | 'STATION_APPROACHING_DROPOFF'
  | 'TRIP_DELAY'
  | 'TRIP_CANCELLED'
  | 'PROMOTION'
  | 'SYSTEM'
  | 'BUS_APPROACHING'
  | 'TICKET_BOOKED'

export type NotificationDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED'

export type DevicePlatform = 'WEB' | 'ANDROID' | 'IOS'

export interface NotificationDataPayload {
  tripId?: string
  stationId?: string
  stationName?: string
  distanceMeters?: number
  etaMinutes?: number
  deepLink?: string
  routeCode?: string
  routeName?: string
  vehiclePlate?: string
  bookingCode?: string
  [key: string]: any
}

export interface NotificationItem {
  id: string
  userId: string
  tripId?: string
  stationId?: string
  type: NotificationType
  title: string
  body: string
  data?: NotificationDataPayload
  isRead: boolean
  readAt?: string | null
  deliveryStatus: NotificationDeliveryStatus
  createdAt: string
}

export interface NotificationPreferences {
  userId?: string
  pushEnabled: boolean
  smsEnabled: boolean
  emailEnabled: boolean
}

export interface RegisterDeviceTokenPayload {
  token: string
  platform?: DevicePlatform
  deviceModel?: string
}

export interface NotificationListResponse {
  notifications: NotificationItem[]
  total: number
  unreadCount: number
  page: number
  limit: number
}

export interface GeofenceStationAlert {
  tripId: string
  stationId: string
  stationName: string
  distanceMeters: number
  etaMinutes?: number
  type: 'pickup' | 'dropoff' | 'passing'
  message: string
  timestamp: string
}
