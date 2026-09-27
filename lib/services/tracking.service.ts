/**
 * Service gọi API Live Tracking & Sự cố
 * Endpoints:
 *   GET /api/v1/trips/:id/live-tracking  → Vị trí GPS mới nhất (Public)
 *   GET /api/v1/trips/:id/incidents      → Danh sách sự cố (Public)
 * Branch: feature/SBTS-live-tracking-fe
 */

import type { LiveLocation, TripIncident } from '@/lib/types/tracking'
import { UnifiedApiResponse } from '@/lib/types/sprint1'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

class TrackingService {
  private baseUrl: string

  constructor() {
    this.baseUrl = API_BASE_URL.replace(/\/+$/, '')
  }

  /** Lấy vị trí GPS mới nhất của xe trên chuyến */
  async getLatestLocation(tripId: string): Promise<UnifiedApiResponse<LiveLocation>> {
    try {
      const res = await fetch(`${this.baseUrl}/trips/${tripId}/live-tracking`, {
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể lấy vị trí xe' }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối' }
    }
  }

  /** Lấy danh sách sự cố trên chuyến */
  async getTripIncidents(tripId: string): Promise<UnifiedApiResponse<TripIncident[]>> {
    try {
      const res = await fetch(`${this.baseUrl}/trips/${tripId}/incidents`, {
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể tải sự cố' }
      }
      return { success: true, data: json?.data || json || [] }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối' }
    }
  }
}

export const trackingService = new TrackingService()
