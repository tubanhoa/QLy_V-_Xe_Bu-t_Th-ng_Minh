'use client'

import React, { useState, useMemo } from 'react'
import {
  Bus,
  User,
  Users,
  Clock,
  AlertTriangle,
  Send,
  Zap,
  CheckCircle2,
  Edit2,
  Calendar,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Fuel,
} from 'lucide-react'
import type { TripItem } from '@/lib/services/trip.service'
import type { Vehicle } from '@/lib/services/vehicle.service'
import type { BackendUser } from '@/lib/services/user.service'

interface RosterGroupedViewProps {
  trips: TripItem[]
  vehicles: Vehicle[]
  drivers: BackendUser[]
  onOpenDispatch: (trip: TripItem) => void
  onNotifyCrew?: (tripId: string) => void
}

export function RosterGroupedView({
  trips,
  vehicles,
  drivers,
  onOpenDispatch,
  onNotifyCrew,
}: RosterGroupedViewProps) {
  const [groupBy, setGroupBy] = useState<'vehicle' | 'driver'>('vehicle')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Toggle thu gọn/mở rộng từng thẻ
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Chuyến chưa gán xe hoặc chưa gán tài xế
  const unassignedTrips = useMemo(() => {
    return trips.filter((t) => (!t.vehicleId && !t.vehicle) || (!t.driverId && !t.driver))
  }, [trips])

  return (
    <div className="flex flex-col gap-5">
      {/* THANH ĐIỀU KHIỂN CHỌN PHƯƠNG THỨC GOM NHÓM */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-3xl bg-card border border-border shadow-xs">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Users size={18} className="text-indigo-500" />
            Bảng Kê Phân Công Lịch Trình Chi Tiết
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Theo dõi phân bổ phụ tải và ca làm việc chi tiết theo từng phương tiện hoặc từng nhân sự
          </p>
        </div>

        <div className="flex items-center rounded-xl bg-muted/60 p-1 border border-border">
          <button
            type="button"
            onClick={() => setGroupBy('vehicle')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              groupBy === 'vehicle'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bus size={13} />
            <span>Gom Theo Xe Buýt ({vehicles.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setGroupBy('driver')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              groupBy === 'driver'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User size={13} />
            <span>Gom Theo Tài Xế ({drivers.length})</span>
          </button>
        </div>
      </div>

      {/* DANH SÁCH CHUYẾN CHƯA PHÂN CÔNG (CẦN XỬ LÝ GẤP) */}
      {unassignedTrips.length > 0 && (
        <div className="p-4 rounded-3xl border border-amber-500/30 bg-amber-500/5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-amber-500/20 mb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <AlertTriangle size={15} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                  Chuyến Xe Chưa Hoàn Tất Phân Công ({unassignedTrips.length} chuyến)
                </h3>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                  Cần bổ sung xe buýt hoặc tài xế cầm lái trước thời điểm xuất bến
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unassignedTrips.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between gap-2.5"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      {t.route?.routeCode ? `Tuyến ${t.route.routeCode}` : 'Tuyến đang cập nhật'}
                    </span>
                    <span className="font-mono text-xs font-black text-amber-600 dark:text-amber-400">
                      {new Date(t.departureTime).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {t.route?.name}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                  <span className="text-[11px] text-rose-500 font-semibold">
                    {!t.vehicleId && !t.driverId
                      ? 'Thiếu xe & tài xế'
                      : !t.vehicleId
                        ? 'Chưa gán xe'
                        : 'Chưa gán tài xế'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenDispatch(t)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition cursor-pointer"
                  >
                    <Edit2 size={12} />
                    <span>Điều phối</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DANH SÁCH GOM NHÓM THEO XE BUÝT */}
      {groupBy === 'vehicle' && (
        <div className="flex flex-col gap-3">
          {vehicles.map((v) => {
            const vehicleTrips = trips.filter(
              (t) => (t.vehicleId === v.id || t.vehicle?.id === v.id) && t.status !== 'cancelled',
            )
            const isMaintenance = v.status === 'maintenance'
            const isExpanded = expandedIds.has(v.id) || vehicleTrips.length > 0

            return (
              <div
                key={v.id}
                className={`rounded-3xl border transition-all ${
                  isMaintenance
                    ? 'border-border/60 bg-muted/20 opacity-70'
                    : 'border-border bg-card shadow-xs'
                }`}
              >
                {/* HEADER XE BUÝT */}
                <div
                  onClick={() => toggleExpand(v.id)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition rounded-3xl"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`size-10 rounded-2xl flex items-center justify-center border ${
                        isMaintenance
                          ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                          : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                      }`}
                    >
                      <Bus size={20} />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-foreground">
                          {v.licensePlate}
                        </span>
                        <span
                          className={`px-2 py-0.2 rounded-md text-[10px] font-bold uppercase ${
                            isMaintenance
                              ? 'bg-rose-500/10 text-rose-600'
                              : 'bg-emerald-500/10 text-emerald-600'
                          }`}
                        >
                          {isMaintenance ? 'Bảo Dưỡng' : 'Sẵn Sàng'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {v.model} · {v.seatCapacity} chỗ · {v.vehicleType}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-xl bg-muted text-foreground">
                      {vehicleTrips.length} chuyến chạy
                    </span>
                    <button
                      type="button"
                      className="size-7 rounded-lg flex items-center justify-center text-muted-foreground"
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </div>
                </div>

                {/* DANH SÁCH CHUYẾN CỦA XE (KHI MỞ RỘNG) */}
                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-border/60">
                    {vehicleTrips.length === 0 ? (
                      <div className="text-center py-4 text-xs text-muted-foreground italic">
                        Xe chưa có chuyến chạy nào được phân công trong kỳ này.
                      </div>
                    ) : (
                      <div className="overflow-x-auto mt-3">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-border text-[11px] font-bold uppercase text-muted-foreground">
                              <th className="py-2.5 px-3">Khởi Hành</th>
                              <th className="py-2.5 px-3">Tuyến Chạy</th>
                              <th className="py-2.5 px-3">Tài Xế</th>
                              <th className="py-2.5 px-3">Phụ Xe</th>
                              <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                              <th className="py-2.5 px-3 text-right">Thao Tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {vehicleTrips.map((t) => (
                              <tr key={t.id} className="hover:bg-muted/40 transition">
                                <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                                  {new Date(t.departureTime).toLocaleTimeString('vi-VN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-foreground">
                                  {t.route?.routeCode ? `Tuyến ${t.route.routeCode}` : 'Tuyến buýt'} -{' '}
                                  <span className="text-muted-foreground font-normal">{t.route?.name}</span>
                                </td>
                                <td className="py-2.5 px-3 text-foreground">
                                  {t.driver?.fullName || (
                                    <span className="text-amber-500 font-semibold">Chưa gán</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-foreground">
                                  {t.conductor?.fullName || (
                                    <span className="text-muted-foreground italic">Không có</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      t.status === 'in_progress' || t.status === 'departed'
                                        ? 'bg-emerald-500/20 text-emerald-600'
                                        : 'bg-muted text-muted-foreground'
                                    }`}
                                  >
                                    {t.status === 'in_progress'
                                      ? 'Đang chạy'
                                      : t.status === 'completed'
                                        ? 'Đã hoàn thành'
                                        : 'Chờ xuất bến'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {onNotifyCrew && (t.driverId || t.conductorId) && (
                                      <button
                                        type="button"
                                        onClick={() => onNotifyCrew(t.id)}
                                        className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition cursor-pointer"
                                        title="Gửi lại thông báo lịch làm việc cho tổ xe"
                                      >
                                        <Send size={13} />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => onOpenDispatch(t)}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition cursor-pointer"
                                    >
                                      <Edit2 size={11} />
                                      <span>Đổi ca</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* DANH SÁCH GOM NHÓM THEO TÀI XẾ */}
      {groupBy === 'driver' && (
        <div className="flex flex-col gap-3">
          {drivers.map((d) => {
            const driverTrips = trips.filter(
              (t) => (t.driverId === d.id || t.driver?.id === d.id) && t.status !== 'cancelled',
            )
            const isLocked = d.status === 'locked'
            const isExpanded = expandedIds.has(d.id) || driverTrips.length > 0

            return (
              <div
                key={d.id}
                className={`rounded-3xl border transition-all ${
                  isLocked ? 'border-border/60 bg-muted/20 opacity-70' : 'border-border bg-card shadow-xs'
                }`}
              >
                {/* HEADER TÀI XẾ */}
                <div
                  onClick={() => toggleExpand(d.id)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition rounded-3xl"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`size-10 rounded-2xl flex items-center justify-center border ${
                        isLocked
                          ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                          : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30'
                      }`}
                    >
                      <User size={20} />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">
                          {d.fullName}
                        </span>
                        <span className="px-2 py-0.2 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                          {d.faculty || 'Bằng Hạng D'}
                        </span>
                        {isLocked && (
                          <span className="px-1.5 py-0.2 rounded-md bg-rose-500/10 text-rose-600 text-[10px] font-bold">
                            Tài khoản khóa
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        SĐT: {d.phoneNumber || 'N/A'} · Email: {d.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-xl bg-muted text-foreground">
                      {driverTrips.length} ca chạy
                    </span>
                    <button
                      type="button"
                      className="size-7 rounded-lg flex items-center justify-center text-muted-foreground"
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </div>
                </div>

                {/* DANH SÁCH CHUYẾN CỦA TÀI XẾ (KHI MỞ RỘNG) */}
                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-border/60">
                    {driverTrips.length === 0 ? (
                      <div className="text-center py-4 text-xs text-muted-foreground italic">
                        Tài xế chưa có ca chạy nào được phân công trong kỳ này.
                      </div>
                    ) : (
                      <div className="overflow-x-auto mt-3">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-border text-[11px] font-bold uppercase text-muted-foreground">
                              <th className="py-2.5 px-3">Giờ Xuất Bến</th>
                              <th className="py-2.5 px-3">Tuyến Vận Hành</th>
                              <th className="py-2.5 px-3">Xe Buýt Phụ Trách</th>
                              <th className="py-2.5 px-3">Phụ Xe Cùng Ca</th>
                              <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                              <th className="py-2.5 px-3 text-right">Thao Tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {driverTrips.map((t) => (
                              <tr key={t.id} className="hover:bg-muted/40 transition">
                                <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                                  {new Date(t.departureTime).toLocaleTimeString('vi-VN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-foreground">
                                  {t.route?.routeCode ? `Tuyến ${t.route.routeCode}` : 'Tuyến buýt'} -{' '}
                                  <span className="text-muted-foreground font-normal">{t.route?.name}</span>
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                                  {t.vehicle?.licensePlate || (
                                    <span className="text-amber-500 font-sans font-semibold">Chưa gán xe</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-foreground">
                                  {t.conductor?.fullName || (
                                    <span className="text-muted-foreground italic">Không có</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      t.status === 'in_progress' || t.status === 'departed'
                                        ? 'bg-emerald-500/20 text-emerald-600'
                                        : 'bg-muted text-muted-foreground'
                                    }`}
                                  >
                                    {t.status === 'in_progress'
                                      ? 'Đang chạy'
                                      : t.status === 'completed'
                                        ? 'Đã hoàn thành'
                                        : 'Chờ xuất bến'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {onNotifyCrew && (
                                      <button
                                        type="button"
                                        onClick={() => onNotifyCrew(t.id)}
                                        className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition cursor-pointer"
                                        title="Gửi thông báo lịch làm việc cho tài xế này"
                                      >
                                        <Send size={13} />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => onOpenDispatch(t)}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition cursor-pointer"
                                    >
                                      <Edit2 size={11} />
                                      <span>Điều chuyển</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
