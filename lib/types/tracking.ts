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

export type IncidentSeverity =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'
  | 'minor'
  | 'moderate'
  | 'severe'

export type IncidentType =
  | 'traffic_jam'
  | 'breakdown'
  | 'accident'
  | 'weather'
  | 'delay'
  | 'other'

export interface TripIncident {
  id: string
  tripId: string
  type: IncidentType
  incidentType?: IncidentType
  severity: IncidentSeverity
  description: string
  delayMinutesEstimate?: number
  resolutionStatus?: 'pending' | 'acknowledged' | 'resolved'
  resolutionNotes?: string
  reportedBy?: string
  resolvedBy?: string
  latitude?: number
  longitude?: number
  reportedAt: string
  resolvedAt?: string
}

export interface ReportIncidentDto {
  tripId: string
  incidentType: IncidentType
  severity?: IncidentSeverity
  incidentSeverity?: 'minor' | 'moderate' | 'severe' | 'critical'
  description: string
  delayMinutesEstimate?: number
}

export interface ResolveIncidentDto {
  resolutionNotes?: string
}

export const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = {
  delay: '⏱️ Trễ giờ xuất bến / Chờ khách',
  traffic_jam: '🚦 Ùn tắc giao thông',
  breakdown: '🔧 Sự cố xe / Hỏng kỹ thuật',
  accident: '💥 Va chạm / Tai nạn giao thông',
  weather: '🌧️ Thời tiết xấu / Ngập úng',
  other: '📋 Sự cố khác',
}

export const INCIDENT_SEVERITY_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  minor: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  moderate: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  high: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  severe: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  critical: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
}

export const INCIDENT_SEVERITY_LABEL: Record<string, string> = {
  low: 'Thấp',
  minor: 'Thấp',
  medium: 'Trung bình',
  moderate: 'Trung bình',
  high: 'Nghiêm trọng',
  severe: 'Nghiêm trọng',
  critical: 'Khẩn cấp',
}

