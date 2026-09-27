'use client'

/**
 * Panel theo dõi xe realtime + danh sách sự cố
 * Polling mỗi 10 giây, hiển thị bản đồ ICTU embedded
 * File mới — không chạm file cũ
 * Branch: feature/SBTS-live-tracking-fe
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MapPin,
  Gauge,
  Navigation,
  Battery,
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Loader2,
  Wifi,
  WifiOff,
  Bus,
} from 'lucide-react'
import { trackingService } from '@/lib/services/tracking.service'
import type { LiveLocation, TripIncident } from '@/lib/types/tracking'
import {
  INCIDENT_SEVERITY_COLOR,
  INCIDENT_SEVERITY_LABEL,
  INCIDENT_TYPE_LABEL,
} from '@/lib/types/tracking'

const POLL_INTERVAL_MS = 10_000 // 10 seconds

interface LiveTrackingPanelProps {
  tripId: string
  tripName?: string
}

export function LiveTrackingPanel({ tripId, tripName }: LiveTrackingPanelProps) {
  const [location, setLocation] = useState<LiveLocation | null>(null)
  const [incidents, setIncidents] = useState<TripIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const fetchData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true)

    const [locResult, incResult] = await Promise.all([
      trackingService.getLatestLocation(tripId),
      trackingService.getTripIncidents(tripId),
    ])

    if (showLoader) setLoading(false)

    if (locResult.success && locResult.data) {
      setLocation(locResult.data)
      setIsOnline(true)
      setLastRefresh(new Date())
    } else {
      setIsOnline(false)
    }

    if (incResult.success && incResult.data) {
      setIncidents(incResult.data)
    }
  }, [tripId])

  // Initial load + polling
  useEffect(() => {
    fetchData(true)
    pollRef.current = setInterval(() => fetchData(false), POLL_INTERVAL_MS)
    return () => clearInterval(pollRef.current)
  }, [fetchData])

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const timeSince = (date: Date | null) => {
    if (!date) return 'Chưa cập nhật'
    const secs = Math.round((Date.now() - date.getTime()) / 1000)
    if (secs < 60) return `${secs}s trước`
    return `${Math.round(secs / 60)}m trước`
  }

  const googleMapsUrl = location
    ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}&z=16&output=embed`
    : null

  // Battery color
  const batteryColor =
    (location?.batteryPercent ?? 100) > 50
      ? 'text-emerald-400'
      : (location?.batteryPercent ?? 100) > 20
      ? 'text-amber-400'
      : 'text-red-400'

  const activeIncidents = incidents.filter((i) => !i.resolvedAt)
  const highSeverity = activeIncidents.some(
    (i) => i.severity === 'high' || i.severity === 'critical',
  )

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/4 border border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="p-2 rounded-xl bg-[#00d4aa]/10">
              <Bus className="w-4 h-4 text-[#00d4aa]" />
            </div>
            {isOnline && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {tripName || `Chuyến ${tripId.slice(0, 8)}`}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isOnline ? (
                <Wifi className="w-3 h-3 text-emerald-400" />
              ) : (
                <WifiOff className="w-3 h-3 text-red-400" />
              )}
              <span className="text-xs text-white/40">
                {isOnline ? `Cập nhật: ${timeSince(lastRefresh)}` : 'Mất kết nối'}
              </span>
            </div>
          </div>
        </div>

        {/* Alert badge + refresh */}
        <div className="flex items-center gap-2">
          {activeIncidents.length > 0 && (
            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              highSeverity
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            }`}>
              <AlertTriangle className="w-3 h-3" />
              {activeIncidents.length} sự cố
            </span>
          )}
          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            className="p-2 rounded-xl hover:bg-white/8 text-white/40 hover:text-white disabled:opacity-40 transition-all"
            id="refresh-tracking-btn"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && !location && (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="w-8 h-8 text-[#00d4aa] animate-spin" />
          <p className="text-sm text-white/40">Đang lấy vị trí xe…</p>
        </div>
      )}

      {/* Map */}
      {location && (
        <div className="rounded-2xl overflow-hidden border border-white/8 bg-white/4">
          {/* Map embed */}
          <div className="relative h-56 sm:h-72 bg-slate-900">
            {googleMapsUrl ? (
              <iframe
                src={googleMapsUrl}
                title="Bản đồ vị trí xe buýt"
                className="absolute inset-0 w-full h-full"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <MapPin className="w-10 h-10 text-white/20" />
              </div>
            )}

            {/* Simulated badge */}
            {location.isSimulated && (
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-amber-500/90 text-xs font-semibold text-amber-950">
                Vị trí mô phỏng
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 divide-x divide-white/8 border-t border-white/8">
            {[
              {
                icon: <MapPin className="w-3.5 h-3.5 text-[#00d4aa]" />,
                label: 'Tọa độ',
                value: `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
                small: true,
              },
              {
                icon: <Gauge className="w-3.5 h-3.5 text-blue-400" />,
                label: 'Tốc độ',
                value: `${location.speedKmh} km/h`,
              },
              {
                icon: <Navigation className="w-3.5 h-3.5 text-violet-400" />,
                label: 'Hướng',
                value: `${location.headingDegrees}°`,
              },
              {
                icon: <Battery className={`w-3.5 h-3.5 ${batteryColor}`} />,
                label: 'Pin TB',
                value: `${location.batteryPercent}%`,
              },
            ].map(({ icon, label, value, small }) => (
              <div key={label} className="flex flex-col items-center py-3 px-2 gap-1">
                {icon}
                <p className="text-[10px] text-white/40">{label}</p>
                <p className={`font-semibold text-white leading-none ${small ? 'text-[10px]' : 'text-xs'}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incidents */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Sự cố trên chuyến
          </p>
          {incidents.length > 0 && (
            <span className="text-xs text-white/30">{incidents.length} tổng</span>
          )}
        </div>

        {incidents.length === 0 ? (
          <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/15 p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <p className="text-sm text-emerald-300/80">Không có sự cố trên chuyến này</p>
          </div>
        ) : (
          <div className="space-y-2">
            {incidents.map((incident) => {
              const sevColor = INCIDENT_SEVERITY_COLOR[incident.severity]
              return (
                <div
                  key={incident.id}
                  className={`rounded-2xl border ${sevColor.bg} ${sevColor.border} p-4 space-y-2`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-white">
                      {INCIDENT_TYPE_LABEL[incident.type]}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${sevColor.bg} ${sevColor.text} ${sevColor.border}`}>
                        {INCIDENT_SEVERITY_LABEL[incident.severity]}
                      </span>
                      {incident.resolvedAt && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                  </div>

                  {incident.description && (
                    <p className="text-xs text-white/60">{incident.description}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-white/40">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(incident.reportedAt)}
                    </span>
                    {incident.resolvedAt && (
                      <span className="text-emerald-400/60">
                        Đã giải quyết lúc {formatTime(incident.resolvedAt)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
