'use client'

/**
 * Bảng Tiến trình Trạm Dừng & Đếm ngược ETA (Station ETA Timeline)
 * - Thiết kế tối ưu Mobile-First chuẩn Metro Transit (Citymapper / Grab Transit)
 * - Mỗi trạm dừng được tinh gọn thành hàng điều hướng sắc nét (52px - 62px)
 * - Hiển thị trực quan: Trạm đã qua, Trạm kế tiếp, Điểm đón của bạn, Trạm sắp tới
 * - Đếm ngược thời gian xe đến (ETA Countdown) & Khoảng cách thực tế
 * - Geofence Proximity Alert Banner khi xe cách trạm <= 500m
 * 
 * Domain: Tracking & Station ETA
 * Branch: feature/SBTS-frontend-realtime-tracking-and-eta
 */

import { useMemo } from 'react'
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Bell,
  Navigation,
  ChevronRight,
  ShieldCheck,
  X,
  Bus,
} from 'lucide-react'
import type { StationEtaItem, StationAlert } from '@/lib/types/tracking'

interface StationEtaTimelineProps {
  stationEtas: StationEtaItem[]
  stationAlert: StationAlert | null
  onDismissAlert?: () => void
  pickupStationName?: string
  onSelectPickupStation?: (name: string) => void
}

export function StationEtaTimeline({
  stationEtas,
  stationAlert,
  onDismissAlert,
  pickupStationName,
  onSelectPickupStation,
}: StationEtaTimelineProps) {
  // Tìm trạm kế tiếp
  const nextStop = useMemo(
    () => stationEtas.find((s) => s.isNextStop) || stationEtas.find((s) => s.status !== 'passed'),
    [stationEtas],
  )

  // Kiểm tra điều kiện bắn banner cảnh báo cận trạm (<= 500m)
  const isCloseToNextStation =
    stationAlert != null || (nextStop != null && nextStop.distanceMeters > 0 && nextStop.distanceMeters <= 500)

  const alertStationName = stationAlert?.stationName || nextStop?.stationName
  const alertDistance = stationAlert?.distanceMeters ?? nextStop?.distanceMeters ?? 0

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`
    }
    return `${Math.round(meters)} m`
  }

  const formatIsoTime = (iso?: string) => {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <div className="space-y-3">
      {/* 1. GEOFENCE PROXIMITY ALERT BANNER (KHI XE CÁCH TRẠM <= 500M) */}
      {isCloseToNextStation && alertStationName && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-400/80 bg-gradient-to-r from-amber-50 via-amber-100/60 to-emerald-50 p-3 sm:p-3.5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative size-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <Bell size={18} className="animate-bounce" />
                <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-rose-500 ring-2 ring-white animate-ping" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/90 px-2 py-0.2 rounded-md">
                    Cận Trạm 500M
                  </span>
                  <span className="text-[11px] font-mono font-bold text-amber-900">
                    Cách {formatDistance(alertDistance)}
                  </span>
                </div>
                <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 mt-0.5 truncate">
                  Xe đang tiến vào: <span className="text-[#005A36]">{alertStationName}</span>
                </h4>
              </div>
            </div>

            {onDismissAlert && (
              <button
                type="button"
                onClick={onDismissAlert}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Đóng cảnh báo"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. COMPACT TIMELINE HEADER */}
      <div className="flex items-center justify-between px-1 py-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
          <Navigation size={13} className="text-[#005A36]" />
          <span>Danh sách trạm đón ({stationEtas.length} trạm)</span>
        </div>
        <span className="text-[11px] text-slate-400">Chạm để chọn điểm đón</span>
      </div>

      {/* 3. SLEEK METRO-STYLE VERTICAL STEPPER (TIẾT KIỆM KHÔNG GIAN, KHÔNG TRÀN CHỮ) */}
      <div className="relative pl-6 sm:pl-7 space-y-1.5 before:absolute before:left-[13px] sm:before:left-[15px] before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
        {stationEtas.map((st, idx) => {
          const isPassed = st.status === 'passed'
          const isNext = st.isNextStop
          const isUserPickup =
            pickupStationName &&
            (st.stationName.toLowerCase().includes(pickupStationName.toLowerCase()) ||
              pickupStationName.toLowerCase().includes(st.stationName.toLowerCase()))

          return (
            <div
              key={st.stationId || idx}
              className={`relative transition-all duration-200 ${
                isUserPickup || isNext ? 'scale-[1.008]' : ''
              }`}
            >
              {/* Stepper Node on the Line */}
              <div
                className={`absolute -left-[24px] sm:-left-[26px] top-3 size-5 sm:size-5.5 rounded-full border-2 flex items-center justify-center z-10 transition-all ${
                  isUserPickup
                    ? 'bg-blue-600 border-white shadow-[0_0_8px_rgba(37,99,235,0.8)] ring-3 ring-blue-100 text-white'
                    : isNext
                    ? 'bg-[#005A36] border-white shadow-[0_0_8px_rgba(0,90,54,0.7)] ring-3 ring-emerald-100 text-white'
                    : isPassed
                    ? 'bg-emerald-500 border-white text-white shadow-2xs'
                    : 'bg-white border-slate-300 text-slate-400'
                }`}
              >
                {isPassed ? (
                  <CheckCircle2 size={11} className="text-white" />
                ) : isUserPickup ? (
                  <MapPin size={10} className="text-white" />
                ) : isNext ? (
                  <Bus size={10} className="text-white animate-pulse" />
                ) : (
                  <span className="text-[9px] font-mono font-bold text-slate-500">
                    {st.stopOrder || idx + 1}
                  </span>
                )}
              </div>

              {/* Station Row Item (50px - 60px height) */}
              <div
                onClick={() => onSelectPickupStation && onSelectPickupStation(st.stationName)}
                className={`rounded-xl px-3 py-2.5 border transition-all cursor-pointer touch-press flex items-center justify-between gap-2 ${
                  isUserPickup
                    ? 'border-blue-500 bg-blue-50/70 shadow-xs ring-1 ring-blue-500/30'
                    : isNext
                    ? 'border-[#005A36] bg-emerald-50/70 shadow-xs ring-1 ring-[#005A36]/30'
                    : isPassed
                    ? 'border-slate-200/50 bg-slate-50/40 opacity-70'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {/* Left: Station Name & Inline Badges */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-xs sm:text-sm font-bold truncate ${
                        isUserPickup
                          ? 'text-blue-900 font-extrabold'
                          : isNext
                          ? 'text-[#005A36] font-extrabold'
                          : isPassed
                          ? 'text-slate-500 line-through decoration-slate-300'
                          : 'text-slate-800'
                      }`}
                    >
                      {st.stationName}
                    </span>

                    {isUserPickup && (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-600 text-white px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider shrink-0">
                        <MapPin size={9} />
                        Điểm đón
                      </span>
                    )}

                    {isNext && !isUserPickup && (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-[#005A36] text-white px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider shrink-0 animate-pulse">
                        <Clock size={9} />
                        Kế tiếp
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                    <span>Thứ tự #{st.stopOrder || idx + 1}</span>
                    {st.estimatedArrivalIso && !isPassed && (
                      <span>· Đến lúc: {formatIsoTime(st.estimatedArrivalIso)}</span>
                    )}
                  </div>
                </div>

                {/* Right: ETA & Distance Pill */}
                <div className="shrink-0 text-right">
                  {isPassed ? (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
                      Đã qua
                    </span>
                  ) : isNext ? (
                    <div className="bg-[#005A36] text-white px-2.5 py-1 rounded-xl shadow-xs text-right">
                      <div className="text-xs font-black font-mono">
                        {st.etaMinutes <= 1 ? '< 1 ph' : `~${st.etaMinutes} ph`}
                      </div>
                      <div className="text-[9px] font-mono text-emerald-200">
                        {formatDistance(st.distanceMeters)}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-lg text-right">
                      <div className="text-xs font-bold text-slate-800 font-mono">
                        ~{st.etaMinutes} ph
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">
                        {formatDistance(st.distanceMeters)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {stationEtas.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500 text-xs">
            Đang tải dữ liệu các trạm dừng trên tuyến xe buýt...
          </div>
        )}
      </div>
    </div>
  )
}

