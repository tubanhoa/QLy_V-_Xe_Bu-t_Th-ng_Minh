/**
 * Types cho module Live Tracking & Sự cố
 * Domain: tracking
 * Branch: feature/SBTS-live-tracking-fe
 */

export interface StationEtaItem {
  stationId: string
  stationName: string
  stopOrder: number
  latitude: number
  longitude: number
  distanceMeters: number
  etaMinutes: number
  estimatedArrivalIso: string
  status: 'passed' | 'approaching' | 'upcoming'
  isNextStop: boolean
}

export interface StationAlert {
  stationId: string
  stationName: string
  distanceMeters: number
  message: string
}

export interface SimulatorStatus {
  isRunning: boolean
  tripId: string
  currentStep?: number
  totalSteps?: number
  speedMultiplier?: number
  currentLat?: number
  currentLng?: number
  speedKmh?: number
  message?: string
}

export interface LiveLocation {
  tripId: string
  latitude: number
  longitude: number
  speedKmh: number
  headingDegrees: number
  batteryPercent: number
  lastUpdated: string
  isSimulated?: boolean
  stationEtas?: StationEtaItem[]
}

export interface LiveTrackingResponse extends LiveLocation {
  stationEtas: StationEtaItem[]
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
  low: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  high: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  critical: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
}

export const INCIDENT_SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Nghiêm trọng',
}

