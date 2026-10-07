'use client'

import React, { useState, useMemo } from 'react'
import {
  Bus,
  User,
  Clock,
  AlertTriangle,
  Send,
  Zap,
  Flame,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import type { TripItem } from '@/lib/services/trip.service'
import type { Vehicle } from '@/lib/services/vehicle.service'
import type { BackendUser } from '@/lib/services/user.service'

interface GanttTimelineChartProps {
  trips: TripItem[]
  vehicles: Vehicle[]
  drivers: BackendUser[]
  onOpenDispatch: (trip: TripItem) => void
  onNotifyCrew?: (tripId: string) => void
  selectedDate?: string
}

export function GanttTimelineChart({
  trips,
  vehicles,
  drivers,
  onOpenDispatch,
  onNotifyCrew,
  selectedDate,
}: GanttTimelineChartProps) {
  // Trục tung hiển thị: theo Xe ('vehicle') hoặc theo Tài xế ('driver')
  const [rowType, setRowType] = useState<'vehicle' | 'driver'>('vehicle')

  // Timeline bắt đầu từ 05:00 (300 phút) đến 22:00 (1320 phút) -> Tổng 17 tiếng (1020 phút)
  const START_HOUR = 5
  const END_HOUR = 22
  const TOTAL_HOURS = END_HOUR - START_HOUR
  const TOTAL_MINUTES = TOTAL_HOURS * 60

  // Danh sách các mốc giờ trên trục hoành
  const hourMarks = useMemo(() => {
    const marks: string[] = []
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      marks.push(`${String(h).padStart(2, '0')}:00`)
    }
    return marks
  }, [START_HOUR, END_HOUR])

  // Vị trí vạch giờ hiện tại
  const currentTimePercentage = useMemo(() => {
    const now = new Date()
    const currentH = now.getHours()
    const currentM = now.getMinutes()
    if (currentH < START_HOUR || currentH > END_HOUR) return null
    const passedMinutes = (currentH - START_HOUR) * 60 + currentM
    return Math.min(100, Math.max(0, (passedMinutes / TOTAL_MINUTES) * 100))
  }, [START_HOUR, END_HOUR, TOTAL_MINUTES])

  // Thuật toán phát hiện xung đột lịch trình (Conflict Detection Engine)
  const conflictTripIds = useMemo(() => {
    const conflicts = new Set<string>()

    // 1. Quét xung đột theo Xe Buýt
    const tripsByVehicle = new Map<string, TripItem[]>()
    trips.forEach((t) => {
      const vId = t.vehicleId || t.vehicle?.id
      if (vId && t.status !== 'cancelled' && t.status !== 'completed') {
        const arr = tripsByVehicle.get(vId) || []
        arr.push(t)
        tripsByVehicle.set(vId, arr)
      }
    })

    tripsByVehicle.forEach((vTrips) => {
      // Sắp xếp theo giờ xuất bến
      vTrips.sort(
        (a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime(),
      )
      for (let i = 0; i < vTrips.length - 1; i++) {
        const cur = vTrips[i]
        const nxt = vTrips[i + 1]
        const curArr = cur.arrivalTime
          ? new Date(cur.arrivalTime).getTime()
          : new Date(cur.departureTime).getTime() + 60 * 60 * 1000
        const nxtDep = new Date(nxt.departureTime).getTime()

        if (nxtDep < curArr) {
          conflicts.add(cur.id)
          conflicts.add(nxt.id)
        }
      }
    })

    // 2. Quét xung đột theo Tài Xế
    const tripsByDriver = new Map<string, TripItem[]>()
    trips.forEach((t) => {
      const dId = t.driverId || t.driver?.id
      if (dId && t.status !== 'cancelled' && t.status !== 'completed') {
        const arr = tripsByDriver.get(dId) || []
        arr.push(t)
        tripsByDriver.set(dId, arr)
      }
    })

    tripsByDriver.forEach((dTrips) => {
      dTrips.sort(
        (a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime(),
      )
      for (let i = 0; i < dTrips.length - 1; i++) {
        const cur = dTrips[i]
        const nxt = dTrips[i + 1]
        const curArr = cur.arrivalTime
          ? new Date(cur.arrivalTime).getTime()
          : new Date(cur.departureTime).getTime() + 60 * 60 * 1000
        const nxtDep = new Date(nxt.departureTime).getTime()

        if (nxtDep < curArr) {
          conflicts.add(cur.id)
          conflicts.add(nxt.id)
        }
      }
    })

    // 3. Quét xung đột theo Phụ Xe
    const tripsByConductor = new Map<string, TripItem[]>()
    trips.forEach((t) => {
      const cId = t.conductorId || t.conductor?.id
      if (cId && t.status !== 'cancelled' && t.status !== 'completed') {
        const arr = tripsByConductor.get(cId) || []
        arr.push(t)
        tripsByConductor.set(cId, arr)
      }
    })

    tripsByConductor.forEach((cTrips) => {
      cTrips.sort(
        (a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime(),
      )
      for (let i = 0; i < cTrips.length - 1; i++) {
        const cur = cTrips[i]
        const nxt = cTrips[i + 1]
        const curArr = cur.arrivalTime
          ? new Date(cur.arrivalTime).getTime()
          : new Date(cur.departureTime).getTime() + 60 * 60 * 1000
        const nxtDep = new Date(nxt.departureTime).getTime()

        if (nxtDep < curArr) {
          conflicts.add(cur.id)
          conflicts.add(nxt.id)
        }
      }
    })

    return conflicts
  }, [trips])

  // Chuyến chưa gán xe hoặc chưa gán tài xế (Hàng chờ điều phối)
  const unassignedTrips = useMemo(() => {
    return trips.filter((t) => (!t.vehicleId && !t.vehicle) || (!t.driverId && !t.driver))
  }, [trips])

  // Tính tọa độ vị trí Left (%) và Width (%) của khối chuyến trên timeline
  const getTripTimelineStyle = (trip: TripItem) => {
    const dep = new Date(trip.departureTime)
    const depH = dep.getHours()
    const depM = dep.getMinutes()

    const arr = trip.arrivalTime
      ? new Date(trip.arrivalTime)
      : new Date(dep.getTime() + 60 * 60 * 1000)
    const arrH = arr.getHours()
    const arrM = arr.getMinutes()

    const startTotalMin = (depH - START_HOUR) * 60 + depM
    const endTotalMin = (arrH - START_HOUR) * 60 + arrM

    const durationMin = Math.max(30, endTotalMin - startTotalMin)

    const leftPercent = Math.max(0, Math.min(100, (startTotalMin / TOTAL_MINUTES) * 100))
    const widthPercent = Math.max(4.5, Math.min(100 - leftPercent, (durationMin / TOTAL_MINUTES) * 100))

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm overflow-hidden">
      {/* HEADER & CHUYỂN ĐỔI CHẾ ĐỘ TRỤC TUNG GANTT */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Layers size={18} className="text-emerald-500" />
            Lịch Gantt Điều Phối & Trục Thời Gian Vận Hành
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Trực quan hóa ca chạy từ 05:00 đến 22:00, tự động cảnh báo chồng chéo giờ xe và tài xế
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Cảnh báo tổng số xung đột nếu có */}
          {conflictTripIds.size > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse">
              <ShieldAlert size={13} />
              {conflictTripIds.size} Chuyến Xung Đột
            </span>
          )}

          {/* Toggle Trục Tung: Xe Buýt vs Tài Xế */}
          <div className="flex items-center rounded-xl bg-muted/60 p-1 border border-border">
            <button
              type="button"
              onClick={() => setRowType('vehicle')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                rowType === 'vehicle'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bus size={13} />
              <span>Theo Xe Buýt ({vehicles.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setRowType('driver')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                rowType === 'driver'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <User size={13} />
              <span>Theo Tài Xế ({drivers.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* BIỂU ĐỒ GANTT CONTAINER (SCROLLABLE NGANG) */}
      <div className="overflow-x-auto min-h-[450px]">
        <div className="min-w-[1050px]">
          {/* DÒNG TIÊU ĐỀ TRỤC THỜI GIAN (TIME AXIS 05:00 -> 22:00) */}
          <div className="grid grid-cols-[220px_1fr] border-b border-border/80 pb-2">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-2 flex items-center gap-1">
              <Clock size={13} />
              <span>Tài Nguyên / Khung Giờ</span>
            </div>
            <div className="relative flex justify-between pr-2 text-[11px] font-mono font-semibold text-muted-foreground select-none">
              {hourMarks.map((hm) => (
                <span key={hm} className="shrink-0 -translate-x-1/2">
                  {hm}
                </span>
              ))}
            </div>
          </div>

          {/* HÀNG 1: CHỜ PHÂN CÔNG (UNASSIGNED POOL) */}
          <div className="grid grid-cols-[220px_1fr] border-b border-dashed border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors py-2.5">
            <div className="flex items-center justify-between pr-3 pl-2">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  Chờ Phân Công
                </span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                {unassignedTrips.length} chuyến
              </span>
            </div>

            <div className="relative h-10 w-full rounded-xl bg-amber-500/5 border border-amber-500/10">
              {/* Vạch giờ hiện tại */}
              {currentTimePercentage !== null && (
                <div
                  className="absolute top-0 bottom-0 z-30 w-0.5 bg-rose-500 shadow-sm pointer-events-none"
                  style={{ left: `${currentTimePercentage}%` }}
                />
              )}

              {unassignedTrips.map((t) => {
                const style = getTripTimelineStyle(t)
                const isConflict = conflictTripIds.has(t.id)
                return (
                  <div
                    key={t.id}
                    onClick={() => onOpenDispatch(t)}
                    style={style}
                    className={`absolute top-1 bottom-1 rounded-xl p-1.5 flex items-center justify-between gap-1 shadow-xs cursor-pointer transition-all hover:scale-[1.02] hover:z-20 border ${
                      isConflict
                        ? 'bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/40'
                        : 'bg-amber-100 dark:bg-amber-950/70 border-amber-300/80 text-amber-900 dark:text-amber-200'
                    }`}
                    title={`Chuyến ${t.route?.routeCode || ''} (${new Date(t.departureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}) - Bấm để phân công xe & tài xế`}
                  >
                    <div className="flex items-center gap-1 truncate text-[11px] font-bold">
                      {isConflict ? (
                        <AlertTriangle size={12} className="text-rose-600 shrink-0" />
                      ) : (
                        <Zap size={11} className="text-amber-600 shrink-0" />
                      )}
                      <span className="truncate">{t.route?.routeCode || 'Chuyến xe'}</span>
                      <span className="text-[10px] font-mono opacity-80">
                        {new Date(t.departureTime).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                      Gán ngay →
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* CÁC HÀNG THEO XE BUÝT (FLEET TIMELINE) */}
          {rowType === 'vehicle' &&
            vehicles.map((v) => {
              const vehicleTrips = trips.filter(
                (t) =>
                  (t.vehicleId === v.id || t.vehicle?.id === v.id) &&
                  t.status !== 'cancelled',
              )
              const isMaintenance = v.status === 'maintenance'

              return (
                <div
                  key={v.id}
                  className={`grid grid-cols-[220px_1fr] border-b border-border/70 py-2.5 transition-colors ${
                    isMaintenance ? 'bg-slate-100/60 dark:bg-slate-900/60 opacity-60' : 'hover:bg-muted/30'
                  }`}
                >
                  {/* Cột Tên Xe Buýt */}
                  <div className="flex items-center justify-between pr-3 pl-2">
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <Bus size={13} className="text-emerald-500 shrink-0" />
                        <span className="text-xs font-bold text-foreground font-mono">
                          {v.licensePlate}
                        </span>
                        {isMaintenance && (
                          <span className="px-1.5 py-0.2 rounded-md bg-rose-500/10 text-rose-600 text-[10px] font-bold">
                            Bảo Dưỡng
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {v.model} · {v.seatCapacity} chỗ · {v.vehicleType}
                      </p>
                    </div>

                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold shrink-0">
                      {vehicleTrips.length} chuyến
                    </span>
                  </div>

                  {/* Cột Timeline Bar */}
                  <div className="relative h-10 w-full rounded-xl bg-muted/20 border border-border/50">
                    {/* Vạch giờ hiện tại */}
                    {currentTimePercentage !== null && (
                      <div
                        className="absolute top-0 bottom-0 z-30 w-0.5 bg-rose-500 pointer-events-none"
                        style={{ left: `${currentTimePercentage}%` }}
                      />
                    )}

                    {isMaintenance ? (
                      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-muted-foreground italic">
                        🔧 Xe đang bảo dưỡng định kỳ - Ngừng điều phối
                      </div>
                    ) : (
                      vehicleTrips.map((t) => {
                        const style = getTripTimelineStyle(t)
                        const isConflict = conflictTripIds.has(t.id)
                        const isLive = t.status === 'in_progress' || t.status === 'departed'

                        return (
                          <div
                            key={t.id}
                            onClick={() => onOpenDispatch(t)}
                            style={style}
                            className={`absolute top-1 bottom-1 rounded-xl p-1.5 flex items-center justify-between gap-1 shadow-xs cursor-pointer transition-all hover:scale-[1.02] hover:z-20 border ${
                              isConflict
                                ? 'bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/50 animate-pulse'
                                : isLive
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-800 dark:text-emerald-200'
                                  : 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200/80 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200'
                            }`}
                            title={`Chuyến: ${t.route?.routeCode} | Tài xế: ${t.driver?.fullName || 'Chưa gán'} | Khởi hành: ${new Date(t.departureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}${isConflict ? ' [CẢNH BÁO: Xung đột lịch trình]' : ''}`}
                          >
                            <div className="flex items-center gap-1 truncate text-[11px] font-bold">
                              {isConflict ? (
                                <AlertTriangle size={12} className="text-rose-600 shrink-0" />
                              ) : isLive ? (
                                <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                              ) : (
                                <span className="size-1.5 rounded-full bg-indigo-500" />
                              )}
                              <span className="truncate">{t.route?.routeCode || 'Tuyến'}</span>
                              <span className="text-[10px] font-mono opacity-80">
                                {new Date(t.departureTime).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>

                            <span className="text-[10px] font-semibold opacity-75 truncate max-w-[80px]">
                              {t.driver?.fullName ? t.driver.fullName.split(' ').slice(-1)[0] : 'Chưa gán'}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}

          {/* CÁC HÀNG THEO TÀI XẾ (CREW TIMELINE) */}
          {rowType === 'driver' &&
            drivers.map((d) => {
              const driverTrips = trips.filter(
                (t) =>
                  (t.driverId === d.id || t.driver?.id === d.id) &&
                  t.status !== 'cancelled',
              )
              const isLocked = d.status === 'locked'

              return (
                <div
                  key={d.id}
                  className={`grid grid-cols-[220px_1fr] border-b border-border/70 py-2.5 transition-colors ${
                    isLocked ? 'bg-slate-100/60 dark:bg-slate-900/60 opacity-60' : 'hover:bg-muted/30'
                  }`}
                >
                  {/* Cột Tên Tài Xế */}
                  <div className="flex items-center justify-between pr-3 pl-2">
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <User size={13} className="text-indigo-500 shrink-0" />
                        <span className="text-xs font-bold text-foreground truncate">
                          {d.fullName}
                        </span>
                        {isLocked && (
                          <span className="px-1.5 py-0.2 rounded-md bg-rose-500/10 text-rose-600 text-[10px] font-bold">
                            Khóa
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {d.faculty || 'Bằng Hạng D'} · {d.phoneNumber || 'SĐT N/A'}
                      </p>
                    </div>

                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold shrink-0">
                      {driverTrips.length} ca
                    </span>
                  </div>

                  {/* Cột Timeline Bar */}
                  <div className="relative h-10 w-full rounded-xl bg-muted/20 border border-border/50">
                    {/* Vạch giờ hiện tại */}
                    {currentTimePercentage !== null && (
                      <div
                        className="absolute top-0 bottom-0 z-30 w-0.5 bg-rose-500 pointer-events-none"
                        style={{ left: `${currentTimePercentage}%` }}
                      />
                    )}

                    {isLocked ? (
                      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-muted-foreground italic">
                        ⛔ Tài khoản tài xế đang bị tạm khóa
                      </div>
                    ) : (
                      driverTrips.map((t) => {
                        const style = getTripTimelineStyle(t)
                        const isConflict = conflictTripIds.has(t.id)
                        const isLive = t.status === 'in_progress' || t.status === 'departed'

                        return (
                          <div
                            key={t.id}
                            onClick={() => onOpenDispatch(t)}
                            style={style}
                            className={`absolute top-1 bottom-1 rounded-xl p-1.5 flex items-center justify-between gap-1 shadow-xs cursor-pointer transition-all hover:scale-[1.02] hover:z-20 border ${
                              isConflict
                                ? 'bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/50 animate-pulse'
                                : isLive
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-800 dark:text-emerald-200'
                                  : 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200/80 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                            }`}
                            title={`Chuyến: ${t.route?.routeCode} | Xe: ${t.vehicle?.licensePlate || 'Chưa gán'} | Khởi hành: ${new Date(t.departureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}${isConflict ? ' [CẢNH BÁO: Xung đột lịch làm việc]' : ''}`}
                          >
                            <div className="flex items-center gap-1 truncate text-[11px] font-bold">
                              {isConflict ? (
                                <AlertTriangle size={12} className="text-rose-600 shrink-0" />
                              ) : isLive ? (
                                <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                              ) : (
                                <span className="size-1.5 rounded-full bg-emerald-500" />
                              )}
                              <span className="truncate">{t.route?.routeCode || 'Tuyến'}</span>
                              <span className="text-[10px] font-mono opacity-80">
                                {new Date(t.departureTime).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>

                            <span className="text-[10px] font-mono font-semibold opacity-75 truncate max-w-[80px]">
                              {t.vehicle?.licensePlate || 'Chưa xe'}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* CHÚ THÍCH MÀU SẮC (LEGEND) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-md bg-amber-100 dark:bg-amber-950 border border-amber-300" />
            <span>Chờ phân công</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-md bg-indigo-50 dark:bg-indigo-950 border border-indigo-200" />
            <span>Đã điều phối hợp lệ</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-md bg-emerald-500/20 border border-emerald-500" />
            <span>Đang chạy (Live)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-md bg-rose-500/20 border border-rose-500 ring-1 ring-rose-500/50" />
            <span className="font-bold text-rose-600 dark:text-rose-400">⚠️ Xung đột lịch trình</span>
          </div>
        </div>

        <span className="text-[11px] italic">
          * Bấm trực tiếp vào khối chuyến xe trên biểu đồ để mở nhanh cửa sổ điều phối.
        </span>
      </div>
    </div>
  )
}
