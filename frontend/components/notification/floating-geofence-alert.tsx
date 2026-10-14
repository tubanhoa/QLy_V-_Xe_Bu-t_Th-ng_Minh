'use client'

/**
 * Banner Cảnh Báo Nổi In-App (Floating Geofence Alert)
 * Hiển thị tức thì khi xe buýt tiến vào bán kính <= 500m hoặc ETA <= 5 phút
 * Domain: notifications & geofencing
 * Branch: feature/SBTS-frontend-geofencing-and-push-notification
 */

import React from 'react'
import Link from 'next/link'
import {
  Bus,
  MapPin,
  Clock,
  Radio,
  ChevronRight,
  X,
  Sparkles,
  Volume2,
} from 'lucide-react'
import { haptic } from '@/lib/utils/haptics'
import type { GeofenceStationAlert } from '@/lib/types/notification'

interface FloatingGeofenceAlertProps {
  alert: GeofenceStationAlert | null
  onDismiss: () => void
}

export function FloatingGeofenceAlert({
  alert,
  onDismiss,
}: FloatingGeofenceAlertProps) {
  if (!alert) return null

  const isDropoff = alert.type === 'dropoff'
  const targetUrl = `/tracking/${alert.tripId}?pickup=${encodeURIComponent(alert.stationName)}`

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-18 sm:top-20 inset-x-3 sm:inset-x-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-top-4 duration-300"
    >
      <div className="relative overflow-hidden rounded-2xl border border-emerald-400/80 bg-slate-900/95 p-4 text-white shadow-2xl shadow-emerald-950/40 backdrop-blur-xl ring-1 ring-white/10">
        {/* Glow ambient background effect */}
        <div
          className={`absolute -right-8 -top-8 size-32 rounded-full blur-2xl pointer-events-none opacity-40 ${
            isDropoff ? 'bg-amber-500' : 'bg-emerald-400'
          }`}
        />

        <div className="relative flex items-start gap-3.5">
          {/* Pulsing Radar Icon */}
          <div className="relative shrink-0 mt-0.5">
            <div
              className={`size-11 rounded-xl flex items-center justify-center border shadow-inner ${
                isDropoff
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                  : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
              }`}
            >
              <Bus className="size-5.5 animate-pulse" />
            </div>
            <span
              className={`absolute -top-1 -right-1 flex size-3`}
            >
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
                  isDropoff ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              />
              <span
                className={`relative inline-flex size-3 rounded-full ${
                  isDropoff ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
            </span>
          </div>

          {/* Alert Content */}
          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                  isDropoff
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-400/40'
                    : 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40'
                }`}
              >
                <Radio className="size-3 animate-spin" />
                {isDropoff ? 'Chuẩn Bị Xuống Xe' : 'Xe Sắp Cập Bến'}
              </span>

              <span className="text-[11px] text-slate-400 font-medium">Vùng Geofence &le; 500m</span>
            </div>

            <h4 className="mt-1 text-sm font-black text-white leading-tight truncate">
              {alert.stationName}
            </h4>

            <p className="mt-0.5 text-xs text-slate-300 line-clamp-2 leading-relaxed">
              {alert.message}
            </p>

            {/* Distance & ETA chips */}
            <div className="mt-2.5 flex items-center gap-2 text-xs">
              <div className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-0.5 font-bold text-emerald-300 border border-white/5">
                <MapPin className="size-3" />
                <span>{alert.distanceMeters}m</span>
              </div>

              {alert.etaMinutes !== undefined && (
                <div className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-0.5 font-bold text-amber-300 border border-white/5">
                  <Clock className="size-3" />
                  <span>~{alert.etaMinutes} phút</span>
                </div>
              )}

              {/* Action Link */}
              <Link
                href={targetUrl}
                onClick={() => {
                  haptic.play('tap')
                  onDismiss()
                }}
                className="ml-auto inline-flex items-center gap-1 rounded-xl bg-[#005A36] hover:bg-emerald-600 active:scale-95 text-white font-extrabold px-3 py-1 text-xs transition-all shadow-md shadow-emerald-950/40 touch-press cursor-pointer"
                id="btn-geofence-view-live"
              >
                <span>Xem Live</span>
                <ChevronRight className="size-3" />
              </Link>
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={() => {
              haptic.play('pop')
              onDismiss()
            }}
            className="absolute -top-1 -right-1 size-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label="Đóng cảnh báo"
            id="btn-geofence-dismiss"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Subtle timer progress bar at bottom */}
        <div className="mt-3 h-1 w-full bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full animate-[progress_12s_linear_forwards] ${
              isDropoff ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  )
}
