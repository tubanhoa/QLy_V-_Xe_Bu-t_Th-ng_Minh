'use client'

import React, { useState, useMemo } from 'react'
import {
  Flame,
  Users,
  Bus,
  AlertTriangle,
  TrendingUp,
  Percent,
  Layers,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  Filter,
  Eye,
  X,
  RefreshCw,
  Coins,
  ChevronRight,
  HelpCircle,
  Download,
} from 'lucide-react'
import type {
  OccupancyReportResponse,
  OccupancyTripItem,
  FleetRecommendation,
  HeatmapDayRow,
  OccupancyHourlyDensityItem,
  OccupancyRouteItem,
} from '@/lib/services/analytics.service'
import type { TransitRoute } from '@/lib/types/transit'

interface AdminOccupancyDashboardProps {
  data: OccupancyReportResponse | null
  loading: boolean
  onRefresh: () => void
  startDate: string
  endDate: string
  routesList: TransitRoute[]
  selectedRouteId: string
  onSelectRouteId: (id: string) => void
  onExportCSV: () => void
}

export function AdminOccupancyDashboard({
  data,
  loading,
  onRefresh,
  startDate,
  endDate,
  routesList,
  selectedRouteId,
  onSelectRouteId,
  onExportCSV,
}: AdminOccupancyDashboardProps) {
  // Bộ lọc cấp độ phụ tải cho bảng chi tiết
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVERLOADED' | 'OPTIMAL' | 'LOW' | 'UNDERUTILIZED'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // State cell heatmap đang chọn để xem chi tiết
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<{
    dayName: string
    hour: number
    rate: number
    booked: number
    capacity: number
    tripCount: number
  } | null>(null)

  // State xem sơ đồ ghế realtime của một chuyến
  const [inspectingTrip, setInspectingTrip] = useState<OccupancyTripItem | null>(null)

  // Danh sách chuyến xe sau khi lọc
  const filteredTrips = useMemo(() => {
    if (!data?.trips) return []
    return data.trips.filter((trip) => {
      // Lọc theo trạng thái phụ tải
      if (statusFilter !== 'ALL' && trip.statusLevel !== statusFilter) {
        return false
      }
      // Lọc theo từ khóa tìm kiếm
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchRoute = (trip.routeCode || '').toLowerCase().includes(q) || trip.routeName.toLowerCase().includes(q)
        const matchPlate = (trip.vehiclePlate || '').toLowerCase().includes(q)
        const matchId = (trip.tripId || '').toLowerCase().includes(q)
        if (!matchRoute && !matchPlate && !matchId) return false
      }
      return true
    })
  }, [data?.trips, statusFilter, searchQuery])

  // Dữ liệu tóm tắt KPI
  const summary = data?.summary || {
    overallOccupancyPercentage: data?.overallOccupancyPercentage || 0,
    totalTrips: data?.totalTrips || 0,
    totalCapacity: 0,
    totalBooked: 0,
    overloadedTripsCount: 0,
    optimalTripsCount: 0,
    lowTripsCount: 0,
    underutilizedTripsCount: 0,
  }

  // Khuyến nghị điều phối
  const recommendations: FleetRecommendation[] = data?.recommendations || []

  // Ma trận Heatmap
  const heatmapRows: HeatmapDayRow[] = data?.heatmapMatrix || []

  // Mật độ theo khung giờ
  const hourlyDensity: OccupancyHourlyDensityItem[] = data?.hourlyDensity || []
  const maxHourlyCapacity = useMemo(() => {
    if (hourlyDensity.length === 0) return 100
    return Math.max(...hourlyDensity.map((h) => h.capacity), 50)
  }, [hourlyDensity])

  // Phân bổ theo tuyến xe
  const routeStats: OccupancyRouteItem[] = data?.occupancyByRoute || []

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* =========================================================================
          1. HEADER TỔNG QUAN & NÚT THAO TÁC NHANH
      ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20">
              <Flame className="size-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                Phân Tích Tỷ Lệ Lấp Đầy & Tối Ưu Xe
                <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
                  Phụ Tải Realtime
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kỳ thống kê: <strong className="text-foreground font-mono">{startDate}</strong> đến{' '}
                <strong className="text-foreground font-mono">{endDate}</strong> • Phân tích mật độ cao điểm & cân đối quy mô xe
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 text-amber-500 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Đang cập nhật...' : 'Cập nhật phụ tải'}</span>
          </button>

          <button
            type="button"
            onClick={onExportCSV}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-md shadow-amber-500/20 hover:from-amber-700 hover:to-orange-700 active:scale-95 transition-all cursor-pointer"
          >
            <Download className="size-4" />
            <span>Xuất Báo Cáo Phụ Tải (CSV)</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. HỆ THỐNG CARDS KPI PHỤ TẢI (4 CARDS THEO CHUẨN VẬN TẢI)
      ========================================================================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Tỷ lệ lấp đầy toàn mạng */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-amber-500/5 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <Percent className="size-4 text-amber-500" /> Hệ số lấp đầy trung bình
            </span>
            <span
              className={`rounded-lg px-2 py-0.5 text-[11px] font-bold font-mono ${
                summary.overallOccupancyPercentage >= 85
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  : summary.overallOccupancyPercentage >= 50
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}
            >
              {summary.overallOccupancyPercentage >= 85
                ? 'Quá tải'
                : summary.overallOccupancyPercentage >= 50
                ? 'Đạt chuẩn'
                : 'Thấp'}
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold font-mono text-foreground tracking-tight">
            {summary.overallOccupancyPercentage}%
          </p>
          <div className="mt-3 w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                summary.overallOccupancyPercentage >= 85
                  ? 'bg-rose-500'
                  : summary.overallOccupancyPercentage >= 50
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, summary.overallOccupancyPercentage)}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Ngưỡng chuẩn tối ưu:</span>
            <span className="font-semibold text-foreground font-mono">50% - 85%</span>
          </div>
        </div>

        {/* Card 2: Tổng cung ứng ghế & Vé thực bán */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-blue-500/5 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <Users className="size-4 text-blue-500" /> Ghế cung ứng vs Đã bán
            </span>
            <span className="rounded-lg bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 font-mono">
              {summary.totalTrips} chuyến
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-extrabold font-mono text-foreground tracking-tight">
            {summary.totalBooked}{' '}
            <span className="text-sm font-normal text-muted-foreground font-sans">/ {summary.totalCapacity} ghế</span>
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Ghế còn trống:</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">
              {Math.max(0, summary.totalCapacity - summary.totalBooked)} chỗ
            </span>
          </div>
        </div>

        {/* Card 3: Chuyến quá tải (> 85%) */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'OVERLOADED' ? 'ALL' : 'OVERLOADED')}
          className={`relative overflow-hidden rounded-3xl border p-6 shadow-sm hover:shadow-md transition-all cursor-pointer ${
            statusFilter === 'OVERLOADED'
              ? 'border-rose-500 bg-rose-500/10 ring-2 ring-rose-500/30'
              : 'border-border bg-gradient-to-br from-card to-rose-500/5'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <AlertTriangle className="size-4 text-rose-500" /> Chuyến xe quá tải
            </span>
            <span className="rounded-lg bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 font-mono">
              &gt; 85%
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold font-mono text-rose-600 dark:text-rose-400 tracking-tight">
            {summary.overloadedTripsCount}{' '}
            <span className="text-sm font-normal text-muted-foreground font-sans">chuyến</span>
          </p>
          <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Đề xuất:</span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">Tăng chuyến / Xe lớn</span>
          </div>
        </div>

        {/* Card 4: Chuyến rỗng khách (< 30%) */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'UNDERUTILIZED' ? 'ALL' : 'UNDERUTILIZED')}
          className={`relative overflow-hidden rounded-3xl border p-6 shadow-sm hover:shadow-md transition-all cursor-pointer ${
            statusFilter === 'UNDERUTILIZED'
              ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/30'
              : 'border-border bg-gradient-to-br from-card to-orange-500/5'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <Bus className="size-4 text-orange-500" /> Chuyến xe rỗng khách
            </span>
            <span className="rounded-lg bg-orange-500/10 px-2 py-0.5 text-[11px] font-bold text-orange-600 dark:text-orange-400 font-mono">
              &lt; 30%
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold font-mono text-orange-600 dark:text-orange-400 tracking-tight">
            {summary.underutilizedTripsCount}{' '}
            <span className="text-sm font-normal text-muted-foreground font-sans">chuyến</span>
          </p>
          <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Đề xuất:</span>
            <span className="font-semibold text-orange-600 dark:text-orange-400">Đổi Minibus / Giãn ca</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. KHỐI CẢNH BÁO TRỰC QUAN & ĐỀ XUẤT ĐIỀU CHỈNH TẦN SUẤT / QUY MÔ XE
      ========================================================================= */}
      {recommendations.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Sparkles className="size-4" />
              </div>
              <h3 className="font-bold text-base text-foreground">
                Đề Xuất Điều Phối Tần Suất & Quy Mô Xe (Fleet & Frequency Optimization)
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">
              Phân tích tự động dựa trên số liệu vé bán thực tế
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className={`rounded-2xl border p-4.5 transition-all ${
                  rec.priority === 'HIGH'
                    ? 'border-rose-500/30 bg-rose-500/5'
                    : rec.priority === 'MEDIUM'
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-emerald-500/30 bg-emerald-500/5'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {rec.priority === 'HIGH' ? (
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-rose-500 text-white">
                        <AlertTriangle className="size-3.5" />
                      </span>
                    ) : rec.priority === 'MEDIUM' ? (
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                        <Bus className="size-3.5" />
                      </span>
                    ) : (
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
                        <CheckCircle2 className="size-3.5" />
                      </span>
                    )}
                    <h4 className="font-bold text-xs sm:text-sm text-foreground">{rec.title}</h4>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold font-mono ${
                      rec.priority === 'HIGH'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        : rec.priority === 'MEDIUM'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    Ưu tiên {rec.priority}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{rec.message}</p>
                {rec.targetRoute && (
                  <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-foreground">
                    <span className="rounded bg-muted px-2 py-0.5 font-mono">{rec.targetRoute}</span>
                    {rec.targetTime && <span className="font-mono text-muted-foreground">Khung giờ: {rec.targetTime}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          4. BIỂU ĐỒ NHIỆT (HEATMAP MATRIX): KHUNG GIỜ × NGÀY TRONG TUẦN
      ========================================================================= */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Layers className="size-4 text-amber-500" />
              Biểu Đồ Nhiệt Mật Độ Khách (Occupancy Heatmap Matrix)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tỷ lệ lấp đầy theo Khung giờ (06:00 – 21:00) × Ngày trong tuần (Thứ 2 – Chủ Nhật)
            </p>
          </div>

          {/* Chú thích màu Heatmap */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-3 rounded-sm bg-muted/60 border border-border" /> 0% (Trống)
            </span>
            <span className="flex items-center gap-1">
              <span className="size-3 rounded-sm bg-amber-500/20 border border-amber-500/40" /> &lt;30% (Rỗng)
            </span>
            <span className="flex items-center gap-1">
              <span className="size-3 rounded-sm bg-yellow-500/25 border border-yellow-500/40" /> 30-50% (Thấp)
            </span>
            <span className="flex items-center gap-1">
              <span className="size-3 rounded-sm bg-emerald-500/30 border border-emerald-500/40" /> 50-85% (Tối ưu)
            </span>
            <span className="flex items-center gap-1">
              <span className="size-3 rounded-sm bg-rose-500 text-white font-bold" /> &gt;85% (Quá tải)
            </span>
          </div>
        </div>

        {/* Lưới Heatmap cuộn ngang */}
        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[760px]">
            {/* Header hàng: các khung giờ từ 06 đến 21 */}
            <div className="grid grid-cols-17 gap-1.5 pb-2 text-center text-[11px] font-mono font-semibold text-muted-foreground border-b border-border/60">
              <div className="text-left font-sans font-bold text-foreground">Thứ / Giờ</div>
              {Array.from({ length: 16 }, (_, i) => i + 6).map((hour) => (
                <div key={hour} className="py-1">
                  {hour}h
                </div>
              ))}
            </div>

            {/* Các hàng thứ trong tuần */}
            <div className="divide-y divide-border/40">
              {heatmapRows.map((row) => (
                <div key={row.dayOfWeek} className="grid grid-cols-17 gap-1.5 py-2 items-center">
                  <div className="text-xs font-bold text-foreground truncate pr-2">
                    {row.dayName}
                  </div>
                  {row.hours.map((cell) => {
                    let cellBg = 'bg-muted/40 text-muted-foreground/50 border border-transparent'
                    if (cell.tripCount > 0) {
                      if (cell.rate >= 85) {
                        cellBg = 'bg-rose-500 text-white font-extrabold shadow-xs shadow-rose-500/20 border-rose-600'
                      } else if (cell.rate >= 50) {
                        cellBg = 'bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 font-semibold border-emerald-500/30'
                      } else if (cell.rate >= 30) {
                        cellBg = 'bg-yellow-500/25 text-yellow-800 dark:text-yellow-300 border-yellow-500/30'
                      } else {
                        cellBg = 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30'
                      }
                    }

                    const isSelected =
                      selectedHeatmapCell &&
                      selectedHeatmapCell.dayName === row.dayName &&
                      selectedHeatmapCell.hour === cell.hour

                    return (
                      <div
                        key={cell.hour}
                        onClick={() =>
                          setSelectedHeatmapCell({
                            dayName: row.dayName,
                            hour: cell.hour,
                            rate: cell.rate,
                            booked: cell.booked,
                            capacity: cell.capacity,
                            tripCount: cell.tripCount,
                          })
                        }
                        className={`group relative flex h-9 items-center justify-center rounded-lg text-[11px] font-mono transition-all cursor-pointer hover:scale-105 ${cellBg} ${
                          isSelected ? 'ring-2 ring-foreground ring-offset-2' : ''
                        }`}
                        title={`${row.dayName} ${cell.hour}:00: ${cell.rate}% (${cell.booked}/${cell.capacity} chỗ - ${cell.tripCount} chuyến)`}
                      >
                        {cell.tripCount > 0 ? `${cell.rate}%` : '—'}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Thông tin chi tiết khi click vào một cell Heatmap */}
        {selectedHeatmapCell && (
          <div className="mt-4 rounded-2xl border border-border bg-accent/30 p-4 text-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 font-bold font-mono">
                {selectedHeatmapCell.hour}h
              </span>
              <div>
                <span className="font-bold text-foreground">
                  Chi tiết {selectedHeatmapCell.dayName} lúc {selectedHeatmapCell.hour}:00 – {selectedHeatmapCell.hour}:59:
                </span>
                <span className="ml-2 text-muted-foreground font-mono">
                  Phụ tải: <strong className="text-foreground">{selectedHeatmapCell.rate}%</strong> • Đã bán:{' '}
                  <strong className="text-foreground">{selectedHeatmapCell.booked}</strong> / {selectedHeatmapCell.capacity} ghế • Số chuyến:{' '}
                  <strong className="text-foreground">{selectedHeatmapCell.tripCount} chuyến</strong>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedHeatmapCell(null)}
              className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
            >
              Đóng xem nhanh
            </button>
          </div>
        )}
      </div>

      {/* =========================================================================
          5. HỆ THỐNG BIỂU ĐỒ KÉP: MẬT ĐỘ GIỜ CAO ĐIỂM & SO SÁNH THEO TUYẾN
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* BIỂU ĐỒ 1: MẬT ĐỘ HÀNH KHÁCH THEO 24 KHUNG GIỜ (LEFT 8 COLS) */}
        <div className="lg:col-span-8 rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <TrendingUp className="size-4 text-amber-500" />
                  Mật Độ Hành Khách Khung Giờ Cao Điểm / Thấp Điểm
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Phân tích số vé bán và tỷ lệ lấp đầy theo 16 khung giờ chạy thực tế
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-rose-500 animate-pulse" /> Giờ cao điểm ICTU
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-emerald-500" /> Giờ tiêu chuẩn
                </span>
              </div>
            </div>

            {/* Biểu đồ thanh dọc trực quan */}
            <div className="mt-6 h-64 w-full flex items-end gap-2 pt-6 pb-2 px-2 border-b border-border/80 overflow-x-auto">
              {hourlyDensity.map((h) => {
                const heightPercent = maxHourlyCapacity > 0 ? Math.min(100, Math.max(8, (h.capacity / maxHourlyCapacity) * 100)) : 8
                const bookedPercent = h.capacity > 0 ? (h.booked / h.capacity) * 100 : 0

                return (
                  <div
                    key={h.hour}
                    className="flex-1 min-w-[36px] h-full flex flex-col items-center justify-end group cursor-pointer relative"
                  >
                    {/* Tooltip hover */}
                    <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center rounded-xl bg-slate-900 text-white px-2.5 py-1 text-[10px] font-mono shadow-xl whitespace-nowrap">
                      <span>{h.label}</span>
                      <span className="text-amber-400 font-bold">
                        {h.rate}% ({h.booked}/{h.capacity} ghế)
                      </span>
                    </div>

                    {/* Chỉ báo Peak Hour */}
                    {h.isPeak && (
                      <span className="size-1.5 rounded-full bg-rose-500 mb-1 group-hover:scale-150 transition-transform" />
                    )}

                    {/* Thanh cột kép (Capacity x Booked) */}
                    <div
                      className="w-full max-w-[28px] rounded-t-lg bg-muted/60 relative overflow-hidden flex flex-col justify-end transition-all group-hover:opacity-90"
                      style={{ height: `${heightPercent}%` }}
                    >
                      <div
                        className={`w-full rounded-t-lg transition-all duration-700 ${
                          h.rate >= 85
                            ? 'bg-rose-500'
                            : h.rate >= 50
                            ? 'bg-emerald-500'
                            : h.rate >= 30
                            ? 'bg-yellow-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ height: `${bookedPercent}%` }}
                      />
                    </div>

                    {/* Nhãn giờ */}
                    <span className="mt-2 text-[10px] font-mono text-muted-foreground group-hover:text-foreground group-hover:font-bold">
                      {h.hour}h
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="font-semibold text-foreground">3 khung giờ cao điểm:</span>
              <span className="font-mono bg-muted px-2 py-0.5 rounded">06:00 - 08:30 (Vào ca sáng)</span>
              <span className="font-mono bg-muted px-2 py-0.5 rounded">11:00 - 13:00 (Tan ca trưa)</span>
              <span className="font-mono bg-muted px-2 py-0.5 rounded">16:30 - 18:30 (Tan ca chiều)</span>
            </span>
          </div>
        </div>

        {/* BIỂU ĐỒ 2: SO SÁNH PHỤ TẢI THEO TUYẾN XE (RIGHT 4 COLS) */}
        <div className="lg:col-span-4 rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Bus className="size-4 text-amber-500" />
                  So Sánh Theo Tuyến
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tỷ lệ lấp đầy giữa các tuyến xe buýt
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {routeStats.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Chưa có dữ liệu tuyến xe trong khoảng thời gian này.
                </div>
              ) : (
                routeStats.map((r) => {
                  return (
                    <div
                      key={r.routeId || r.routeCode}
                      className="space-y-1.5 p-3 rounded-2xl border border-border bg-accent/20 hover:bg-accent/40 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">
                          [{r.routeCode}] {r.routeName}
                        </span>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                          {r.occupancyRate}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            r.occupancyRate >= 85
                              ? 'bg-rose-500'
                              : r.occupancyRate >= 50
                              ? 'bg-emerald-500'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, r.occupancyRate)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                        <span>{r.tripCount} chuyến chạy</span>
                        <span>
                          {r.booked} / {r.capacity} chỗ
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-border text-[11px] text-muted-foreground">
            💡 <em>Gợi ý: Tuyến có tỷ lệ lấp đầy &gt;80% cần ưu tiên phân bổ xe buýt điện 28-35 chỗ ngồi.</em>
          </div>
        </div>
      </div>

      {/* =========================================================================
          6. BẢNG KÊ CHI TIẾT PHỤ TẢI TỪNG CHUYẾN XE (DETAILED TRIP MANIFEST)
      ========================================================================= */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Bus className="size-4 text-amber-500" />
              Bảng Kê Chi Tiết Phụ Tải Từng Chuyến Xe ({filteredTrips.length} chuyến)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Theo dõi trực quan tỷ lệ lấp đầy và kiểm tra sơ đồ ghế 28 chỗ realtime
            </p>
          </div>

          {/* Bộ lọc trạng thái & Tìm kiếm */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Lọc 4 cấp độ */}
            <div className="flex rounded-xl border border-border bg-muted/40 p-1">
              {(
                [
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'OVERLOADED', label: 'Quá tải (>85%)' },
                  { id: 'OPTIMAL', label: 'Tối ưu (50-85%)' },
                  { id: 'LOW', label: 'Thấp (30-50%)' },
                  { id: 'UNDERUTILIZED', label: 'Rỗng (<30%)' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Ô tìm kiếm */}
            <div className="relative">
              <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm mã tuyến, biển số..."
                className="h-8 w-44 rounded-xl border border-border bg-background pl-8 pr-3 text-xs text-foreground focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Bảng chuyến xe */}
        <div className="overflow-x-auto">
          {filteredTrips.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Không tìm thấy chuyến xe nào phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2.5 font-semibold">Tuyến & Giờ chạy</th>
                  <th className="py-2.5 font-semibold">Phương tiện</th>
                  <th className="py-2.5 font-semibold text-right">Sức chứa</th>
                  <th className="py-2.5 font-semibold text-right">Vé đã đặt</th>
                  <th className="py-2.5 font-semibold text-right">Tỷ lệ lấp đầy</th>
                  <th className="py-2.5 font-semibold text-center">Đánh giá tải</th>
                  <th className="py-2.5 font-semibold text-center">Sơ đồ ghế</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTrips.map((tr) => (
                  <tr key={tr.tripId} className="hover:bg-accent/40 transition-colors">
                    <td className="py-3">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        {tr.routeCode && (
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            {tr.routeCode}
                          </span>
                        )}
                        <span>
                          {new Date(tr.departureTime).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{tr.routeName}</div>
                    </td>
                    <td className="py-3 font-mono text-foreground">{tr.vehiclePlate || 'Xe buýt ICTU'}</td>
                    <td className="py-3 font-mono text-right text-muted-foreground">{tr.capacity} chỗ</td>
                    <td className="py-3 font-mono text-right font-bold text-foreground">{tr.booked} vé</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-mono font-bold text-foreground">{tr.rate ?? 0}%</span>
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              (tr.rate ?? 0) >= 85
                                ? 'bg-rose-500'
                                : (tr.rate ?? 0) >= 50
                                ? 'bg-emerald-500'
                                : (tr.rate ?? 0) >= 30
                                ? 'bg-yellow-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, tr.rate ?? 0)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          tr.statusLevel === 'OVERLOADED'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            : tr.statusLevel === 'OPTIMAL'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : tr.statusLevel === 'LOW'
                            ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {tr.statusText || 'Tối ưu'}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setInspectingTrip(tr)}
                        className="rounded-lg border border-border bg-muted/40 hover:bg-accent px-2.5 py-1 text-[11px] font-semibold text-foreground flex items-center gap-1 mx-auto transition-colors cursor-pointer"
                        title="Xem ma trận sơ đồ 28 ghế realtime"
                      >
                        <Eye className="size-3 text-amber-500" /> Xem ghế
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* =========================================================================
          7. MODAL SƠ ĐỒ GHẾ REALTIME (ADMIN REALTIME SEAT MANIFEST MODAL)
      ========================================================================= */}
      {inspectingTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Bus className="size-4 text-amber-500" />
                  Sơ Đồ Ghế Chuyến: {inspectingTrip.routeCode || inspectingTrip.routeName}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Khởi hành:{' '}
                  <strong className="text-foreground">
                    {new Date(inspectingTrip.departureTime).toLocaleTimeString('vi-VN')}
                  </strong>{' '}
                  ngày {new Date(inspectingTrip.departureTime).toLocaleDateString('vi-VN')} • Biển số:{' '}
                  <strong className="text-foreground font-mono">{inspectingTrip.vehiclePlate || 'Xe ICTU'}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingTrip(null)}
                className="rounded-xl p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Thống kê nhanh ghế */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl border border-border bg-muted/40 p-2.5">
                <div className="text-muted-foreground text-[11px]">Tổng ghế</div>
                <div className="font-bold font-mono text-base text-foreground">{inspectingTrip.capacity} chỗ</div>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                <div className="text-emerald-600 dark:text-emerald-400 text-[11px]">Đã đặt</div>
                <div className="font-bold font-mono text-base text-emerald-600 dark:text-emerald-400">
                  {inspectingTrip.booked} vé ({inspectingTrip.rate}%)
                </div>
              </div>
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-2.5">
                <div className="text-blue-600 dark:text-blue-400 text-[11px]">Còn trống</div>
                <div className="font-bold font-mono text-base text-blue-600 dark:text-blue-400">
                  {Math.max(0, inspectingTrip.capacity - inspectingTrip.booked)} chỗ
                </div>
              </div>
            </div>

            {/* Ma trận sơ đồ 28 ghế tiêu chuẩn ICTU (7 hàng x 4 ghế) */}
            <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/40 pb-2">
                <span className="font-semibold text-foreground">Khoang hành khách:</span>
                <span className="text-[11px] font-mono">Đầu xe ⬆️</span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs">
                {Array.from({ length: inspectingTrip.capacity }, (_, idx) => {
                  const seatNum = idx + 1
                  const isBooked = seatNum <= inspectingTrip.booked
                  return (
                    <div
                      key={seatNum}
                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                        isBooked
                          ? 'bg-emerald-500 text-white font-bold border-emerald-600 shadow-xs'
                          : 'bg-card text-muted-foreground border-border hover:border-amber-500/40'
                      }`}
                    >
                      <span className="text-[10px] opacity-80">Ghế</span>
                      <span className="font-extrabold">{seatNum}</span>
                      <span className="text-[9px] mt-0.5">{isBooked ? 'Đã bán' : 'Trống'}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Tỷ lệ tải: <strong className="text-foreground">{inspectingTrip.rate}%</strong>
              </span>
              <button
                type="button"
                onClick={() => setInspectingTrip(null)}
                className="rounded-xl bg-muted px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                Đóng sơ đồ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
