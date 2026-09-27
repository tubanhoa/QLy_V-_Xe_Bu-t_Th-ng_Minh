/**
 * Types cho module Live Tracking & Sự cố
 * Domain: tracking
 * Branch: feature/SBTS-live-tracking-fe
 */

export interface LiveLocation {
  tripId: string
  latitude: number
  longitude: number
  speedKmh: number
  headingDegrees: number
  batteryPercent: number
  lastUpdated: string
  isSimulated?: boolean
}

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'
export type IncidentType = 'traffic_jam' | 'breakdown' | 'accident' | 'weather' | 'other'

export interface TripIncident {
  id: string
  tripId: string
  type: IncidentType
  severity: IncidentSeverity
  description: string
  latitude?: number
  longitude?: number
  reportedAt: string
  resolvedAt?: string
}

export const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = {
  traffic_jam: '🚦 Ùn tắc giao thông',
  breakdown: '🔧 Hỏng xe',
  accident: '💥 Tai nạn',
  weather: '🌧️ Thời tiết xấu',
  other: '📋 Sự cố khác',
}

export const INCIDENT_SEVERITY_COLOR: Record<IncidentSeverity, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  medium: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  high: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  critical: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
}

export const INCIDENT_SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Nghiêm trọng',
}
