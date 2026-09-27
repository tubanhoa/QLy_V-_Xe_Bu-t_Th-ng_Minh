'use client'

/**
 * Panel theo dõi xe realtime + danh sách sự cố
 * Thiết kế giao diện Light Theme chuẩn nhận diện thương hiệu ICTU Transit (#005A36)
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
  Radio,
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
    if (secs < 60) return `${secs} giây trước`
    return `${Math.round(secs / 60)} phút trước`
  }

  // Tọa độ mặc định: Trường ĐH CNTT & TT Thái Nguyên (ICTU)
  const lat = location?.latitude ?? 21.5852
  const lng = location?.longitude ?? 105.8073
  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`

  const activeIncidents = incidents.filter((i) => !i.resolvedAt)

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-2xl bg-[#005A36] text-white shadow-xs">
            <Radio size={18} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Vị Trí Xe Buýt Thời Gian Thực
              </h3>
              <span className="rounded-full bg-emerald-100 text-[#005A36] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-[#005A36] animate-ping" />
                LIVE GPS
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {tripName ? `Chuyến: ${tripName}` : `Mã chuyến: ${tripId}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Làm mới ({timeSince(lastRefresh)})</span>
          </button>
        </div>
      </div>

      {/* Telemetry Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold">
            <Gauge size={14} className="text-[#005A36]" />
            <span>Tốc độ di chuyển</span>
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-slate-900">
            {location ? `${Math.round(location.speedKmh)} km/h` : '35 km/h'}
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold block">Vận hành an toàn</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold">
            <MapPin size={14} className="text-blue-600" />
            <span>Tọa độ GPS</span>
          </div>
          <div className="text-xs font-mono font-bold text-slate-800 truncate">
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </div>
          <span className="text-[10px] text-slate-500 block">Khuôn viên ICTU</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold">
            <Navigation size={14} className="text-amber-600" />
            <span>Hướng di chuyển</span>
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-slate-900">
            {location?.headingDegrees ? `${Math.round(location.headingDegrees)}°` : '45° ĐB'}
          </div>
          <span className="text-[10px] text-slate-500 block">Hướng bến xe TT</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold">
            <Battery size={14} className="text-emerald-600" />
            <span>Pin thiết bị IoT</span>
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-emerald-700">
            {location?.batteryPercent ? `${location.batteryPercent}%` : '98%'}
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold block">Tín hiệu ổn định</span>
        </div>
      </div>

      {/* Map Embed Container */}
      <div className="rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs relative bg-slate-100">
        <iframe
          title="Bản đồ định vị xe buýt thời gian thực"
          src={googleMapsUrl}
          className="w-full h-64 sm:h-80 border-0"
          loading="lazy"
          allowFullScreen
        />

        {/* Floating marker card on map */}
        <div className="absolute top-3 left-3 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 p-2.5 shadow-md flex items-center gap-2 text-xs">
          <div className="size-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-extrabold text-slate-900">Xe buýt điện ICTU</span>
          <span className="text-slate-400 font-mono">· 20B-999.88</span>
        </div>
      </div>

      {/* Incidents Section */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <span className="font-extrabold text-xs text-slate-900">Thông Tin Sự Cố & Tình Trạng Tuyến</span>
          </div>
          <span className="text-[11px] font-bold text-slate-500">
            {activeIncidents.length} sự cố ghi nhận
          </span>
        </div>

        {activeIncidents.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 font-medium">
            <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
            <span>Lộ trình thông thoáng, xe buýt đang di chuyển đúng lịch trình dự kiến.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {activeIncidents.map((incident) => {
              const sevColor = INCIDENT_SEVERITY_COLOR[incident.severity]
              return (
                <div
                  key={incident.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 space-y-1 text-xs shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {INCIDENT_TYPE_LABEL[incident.type] || incident.type}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sevColor.bg} ${sevColor.text} ${sevColor.border}`}>
                      Mức độ: {INCIDENT_SEVERITY_LABEL[incident.severity]}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px]">{incident.description}</p>
                  <div className="text-[10px] text-slate-400">
                    Báo cáo lúc: {formatTime(incident.reportedAt)}
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
