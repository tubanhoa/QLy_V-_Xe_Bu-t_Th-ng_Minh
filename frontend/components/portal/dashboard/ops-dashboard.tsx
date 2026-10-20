'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  ShieldCheck,
  Lock,
  ShieldAlert,
  RefreshCw,
  Activity,
  Wifi,
  AlertCircle,
  Database,
  Clock,
  UserCheck,
  Calendar,
  CalendarDays,
  Filter,
  IdCard,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import type { Role } from '@/lib/rbac'
import type { Trip, TripStatus } from '@/lib/mock-data'
import {
  analyticsService,
  type AdminDashboardData,
  type LiveTripItem,
} from '@/lib/services/analytics.service'
import { driverProfileService } from '@/lib/services/driver-profile.service'
import { authService } from '@/lib/services/auth.service'
import { KpiCard } from './kpi-card'
import { IncidentsCard, RevenueChannelsCard } from './side-panels'
import { TripsPanel } from './trips-panel'
import { AnalyticsCharts } from './analytics-charts'
import { AuditLogDrawer } from './audit-log-drawer'
import { SessionTimeoutModal } from './session-timeout-modal'
import { DailyRevenueModal } from './daily-revenue-modal'

const COPY = {
  admin: {
    title: 'Bàn Điều Hành Trung Tâm & Giám Sát Thời Gian Thực',
    subtitle:
      'Dữ liệu live từ Supabase Cloud: Doanh thu, vé số hóa, phụ tải đội xe và nhật ký kiểm toán.',
  },
  dispatcher: {
    title: 'Bàn Làm Việc Điều Phối Xe Buýt',
    subtitle:
      'Giám sát chuyến xe, phân tài xế và xử lý cảnh báo hành trình thời gian thực.',
  },
}

export function OpsDashboard({
  role,
  onNavigate,
}: {
  role: Exclude<Role, 'driver'>
  onNavigate?: (key: string) => void
}) {
  const copy = COPY[role]
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date())
  const [isAuditOpen, setIsAuditOpen] = useState(false)
  const [isSessionLocked, setIsSessionLocked] = useState(false)
  const [isDailyModalOpen, setIsDailyModalOpen] = useState(false)

  // Quản lý bộ lọc doanh thu theo ngày
  const [activePreset, setActivePreset] = useState<'all' | 'today' | '7days' | 'custom'>('all')
  const [customDate, setCustomDate] = useState<string>('')
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({})
  const dateRangeRef = useRef<{ start?: string; end?: string }>({})

  // KPI Hồ sơ & Bằng lái 3 tài xế hoạt động
  const [driverKpis, setDriverKpis] = useState<{ total: number; approved: number; pending: number }>({
    total: 3,
    approved: 2,
    pending: 1,
  })

  const currentUser = authService.getUser()

  // Định dạng ngày theo lịch địa phương YYYY-MM-DD
  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Inactivity timeout watchdog (Tự động khóa phiên sau 15 phút không tương tác để bảo vệ bàn điều hành)
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityTimeRef = useRef<number>(Date.now())
  const INACTIVITY_LIMIT_MS = 15 * 60 * 1000 // 15 phút

  const resetInactivityTimer = useCallback(() => {
    const now = Date.now()
    // Throttle: Chỉ xử lý lại nếu lần reset trước đã cách hơn 30 giây để tránh giật lag scroll/mouse
    if (now - lastActivityTimeRef.current < 30_000 && inactivityTimerRef.current) {
      return
    }
    lastActivityTimeRef.current = now

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }
    inactivityTimerRef.current = setTimeout(() => {
      setIsSessionLocked(true)
    }, INACTIVITY_LIMIT_MS)
  }, [INACTIVITY_LIMIT_MS])

  useEffect(() => {
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll']
    const handleActivity = () => resetInactivityTimer()

    activityEvents.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }))
    resetInactivityTimer()

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, handleActivity))
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    }
  }, [resetInactivityTimer])

  // Tải dữ liệu Dashboard từ Backend Supabase (hỗ trợ lọc linh hoạt theo ngày)
  const loadDashboardData = useCallback(async (isSilent = false, start?: string, end?: string) => {
    if (!isSilent) setRefreshing(true)
    const effectiveStart = start !== undefined ? start : dateRangeRef.current.start
    const effectiveEnd = end !== undefined ? end : dateRangeRef.current.end
    try {
      const [summaryRes, profileRes] = await Promise.allSettled([
        analyticsService.getAdminDashboardSummary(effectiveStart, effectiveEnd),
        driverProfileService.getDriverProfiles({ limit: 1 }),
      ])

      if (summaryRes.status === 'fulfilled') {
        setData(summaryRes.value)
      }
      if (profileRes.status === 'fulfilled' && profileRes.value.success && profileRes.value.data?.kpis) {
        setDriverKpis({
          total: profileRes.value.data.kpis.totalDrivers,
          approved: profileRes.value.data.kpis.approvedCount,
          pending: profileRes.value.data.kpis.pendingCount,
        })
      }
      setLastSyncTime(new Date())
    } catch (err) {
      console.error('[OpsDashboard] Lỗi tải dữ liệu thời gian thực:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const handlePresetChange = (preset: 'all' | 'today' | '7days') => {
    setActivePreset(preset)
    setCustomDate('')
    let start: string | undefined = undefined
    let end: string | undefined = undefined

    if (preset === 'today') {
      const todayStr = formatLocalDate(new Date())
      start = todayStr
      end = todayStr
    } else if (preset === '7days') {
      const now = new Date()
      const past = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
      start = formatLocalDate(past)
      end = formatLocalDate(now)
    }

    dateRangeRef.current = { start, end }
    setDateRange({ start, end })
    loadDashboardData(false, start, end)
  }

  const handleCustomDateChange = (dateVal: string) => {
    if (!dateVal) {
      handlePresetChange('all')
      return
    }
    setActivePreset('custom')
    setCustomDate(dateVal)
    dateRangeRef.current = { start: dateVal, end: dateVal }
    setDateRange({ start: dateVal, end: dateVal })
    loadDashboardData(false, dateVal, dateVal)
  }

  const handleSelectDateFromModal = (dateVal: string) => {
    handleCustomDateChange(dateVal)
  }

  useEffect(() => {
    loadDashboardData()

    // Auto-sync polling mỗi 30 giây để cập nhật trạng thái chuyến xe & doanh thu
    const interval = setInterval(() => {
      loadDashboardData(true)
    }, 30000)

    return () => clearInterval(interval)
  }, [loadDashboardData])

  // Chuyển đổi dữ liệu Live Trip sang cấu trúc giao diện TripsPanel có memoization
  const mappedTrips: Trip[] = useMemo(() => {
    return (data?.liveTrips || []).map((t: LiveTripItem, idx: number) => {
      let tripStatus: TripStatus = 'scheduled'
      if (t.status === 'RUNNING' || t.status === 'in_progress') tripStatus = 'running'
      else if (t.status === 'COMPLETED' || t.status === 'completed') tripStatus = 'arriving'
      else if (t.status === 'DELAYED' || t.status === 'delayed') tripStatus = 'delayed'

      const departureStr = t.departureTime
        ? new Date(t.departureTime).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Chưa xếp giờ'

      const hasVehicle = Boolean(t.vehicle?.licensePlate || t.vehicleId)
      const hasDriver = Boolean(t.driver?.fullName || t.driverId)
      const isAssigned = hasVehicle && hasDriver

      return {
        id: t.id || `trip_${idx}`,
        code: t.route?.routeCode ? `${t.route.routeCode}-#${idx + 1}` : `BUS-${idx + 101}`,
        route: t.route ? `${t.route.routeCode} · ${t.route.name}` : 'Tuyến đang cập nhật',
        plate: t.vehicle?.licensePlate || '',
        driver: t.driver?.fullName || '',
        conductor: t.conductor?.fullName || '',
        vehicleId: t.vehicleId || t.vehicle?.id,
        driverId: t.driverId || t.driver?.id,
        conductorId: t.conductorId || t.conductor?.id,
        departure: departureStr,
        occupancy: t.bookedSeatsCount ?? 0,
        capacity: t.vehicle?.seatCapacity || 28,
        status: tripStatus,
        isAssigned,
        tripType: (t as any).tripType || 'regular',
      }
    })
  }, [data?.liveTrips])

  // Dynamic KPIs từ dữ liệu thực tế 100% từ Supabase có memoization
  const dynamicKpis = useMemo(() => {
    const rev = data?.kpis.totalRevenue ?? 0
    const ticketsCount = data?.kpis.totalTicketsSold ?? 0
    return [
      {
        key: 'revenue',
        label: 'Doanh thu kỳ này',
        value: `${rev.toLocaleString('vi-VN')} đ`,
        delta: `${data?.kpis.totalRevenueGrowth !== undefined && data.kpis.totalRevenueGrowth >= 0 ? '+' : ''}${data?.kpis.totalRevenueGrowth ?? 0}%`,
        progress: rev > 0 ? Math.min(100, Math.round((rev / 2000000) * 100)) : 0,
        hint: 'Dữ liệu giao dịch live từ Supabase',
      },
      {
        key: 'trips',
        label: 'Vé số hóa đã phát hành',
        value: `${ticketsCount.toLocaleString('vi-VN')} vé`,
        delta: `${data?.kpis.ticketsGrowth !== undefined && data.kpis.ticketsGrowth >= 0 ? '+' : ''}${data?.kpis.ticketsGrowth ?? 0}%`,
        progress: ticketsCount > 0 ? Math.min(100, Math.round((ticketsCount / 200) * 100)) : 0,
        hint: 'Vé lượt QR Code & Thẻ sinh viên',
      },
      {
        key: 'occupancy',
        label: 'Hệ số lấp đầy TB',
        value: `${data?.kpis.averageOccupancyRate ?? 0}%`,
        delta: `${data?.kpis.averageOccupancyRate ?? 0}%`,
        progress: data?.kpis.averageOccupancyRate ?? 0,
        hint: 'Theo lịch trình các cổng trường ICTU',
      },
      {
        key: 'speed',
        label: 'Đội xe đang vận hành',
        value: `${data?.kpis.activeVehiclesCount ?? 0} xe`,
        delta: `${data?.kpis.activeIncidentsCount ?? 0} cảnh báo`,
        progress: (data?.kpis.activeVehiclesCount ?? 0) > 0 ? 100 : 0,
        hint: 'Giám sát kết nối GPS thời gian thực',
      },
    ]
  }, [data?.kpis])

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header & Security Action Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 p-4.5 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE SUPABASE SYNC
            </span>
            <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
              <Clock size={12} />
              Cập nhật: {lastSyncTime.toLocaleTimeString('vi-VN')}
            </span>
            {driverKpis.pending > 0 && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('driver-licenses')}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/60 transition-colors cursor-pointer"
                title="Có hồ sơ bằng lái xe chờ thẩm định"
              >
                <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                {driverKpis.pending} GPLX Chờ Thẩm Định →
              </button>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {copy.title}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">{copy.subtitle}</p>
        </div>

        {/* Security & Action Buttons - Dàn ngang cân đối, không rớt dòng */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('schedule')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer shadow-xs active:scale-95"
              title="Mở Bàn Điều Phối & Lịch Gantt phân công xe, tài xế"
            >
              <CalendarDays size={14} />
              <span>Điều Phối Chuyến Xe</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => loadDashboardData()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            title="Tải lại số liệu mới nhất từ máy chủ"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-emerald-600' : ''} />
            <span className="hidden sm:inline">Làm Mới</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAuditOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <ShieldAlert size={14} />
            <span>Audit Trail</span>
            <span className="px-1.5 py-0.2 rounded-full bg-indigo-200 dark:bg-indigo-800 text-[10px] font-mono">
              {data?.recentAuditLogs?.length ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsSessionLocked(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Khóa bảng điều khiển khi rời khỏi vị trí làm việc"
          >
            <Lock size={13} />
            <span>Khóa Phiên</span>
          </button>
        </div>
      </div>

      {/* THANH ĐIỀU KHIỂN LỌC DOANH THU THEO NGÀY & ĐỐI SOÁT */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mr-1">
            <Calendar size={14} className="text-emerald-500" />
            Kỳ Doanh Thu:
          </span>
          <button
            type="button"
            onClick={() => handlePresetChange('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95 ${
              activePreset === 'all'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Toàn Kỳ
          </button>
          <button
            type="button"
            onClick={() => handlePresetChange('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95 ${
              activePreset === 'today'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Hôm Nay
          </button>
          <button
            type="button"
            onClick={() => handlePresetChange('7days')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95 ${
              activePreset === '7days'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            7 Ngày
          </button>

          {/* Chọn ngày cụ thể */}
          <div className="flex items-center gap-1.5 pl-2 sm:border-l border-slate-200 dark:border-slate-700">
            <span className="text-[11px] text-slate-400 font-medium">Ngày:</span>
            <input
              type="date"
              value={customDate}
              onChange={(e) => handleCustomDateChange(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              title="Chọn ngày cụ thể để xem số liệu doanh thu"
            />
            {activePreset === 'custom' && (
              <button
                type="button"
                onClick={() => handlePresetChange('all')}
                className="text-[11px] text-rose-500 hover:underline font-semibold cursor-pointer"
              >
                Xóa
              </button>
            )}
          </div>
        </div>

        {/* Nút Mở Bảng Kê Đối Soát Từng Ngày */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDailyModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <CalendarDays size={14} />
            <span>Bảng Kê Chi Tiết Từng Ngày</span>
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-200/80 dark:bg-emerald-800 text-[10px] font-mono">
              {data?.dailyBreakdown?.length ?? 0} ngày
            </span>
          </button>
        </div>
      </div>

      {/* Thông báo nếu lọc hôm nay mà chưa có thanh toán phát sinh */}
      {activePreset === 'today' && (data?.kpis.totalRevenue ?? 0) === 0 && (
        <div className="px-4 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              Hôm nay ({formatLocalDate(new Date())}) chưa phát sinh thanh toán mới. Các số liệu hiển thị là 0 đ theo đúng CSDL.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsDailyModalOpen(true)}
            className="font-bold underline hover:opacity-80 shrink-0 ml-2 cursor-pointer"
          >
            Xem các ngày trước →
          </button>
        </div>
      )}

      {/* THẺ CẢNH BÁO THẨM ĐỊNH GPLX TINH GỌN (CHỈ HIỂN THỊ KHI CÓ HỒ SƠ CHỜ DUYỆT) */}
      {driverKpis.pending > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800/50 text-xs shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
              <IdCard size={15} />
            </div>
            <div>
              <span className="font-bold text-amber-950 dark:text-amber-200">
                Thẩm định GPLX: Có {driverKpis.pending} hồ sơ tài xế đang chờ duyệt
              </span>
              <span className="text-amber-800/80 dark:text-amber-400/80 ml-1.5 hidden md:inline">
                ({driverKpis.approved}/{driverKpis.total} tài xế đã đạt chuẩn Hạng E)
              </span>
            </div>
          </div>
          {onNavigate && (
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => onNavigate('staff')}
                className="text-[11px] font-semibold text-amber-900 dark:text-amber-300 hover:underline cursor-pointer"
              >
                Nhân sự
              </button>
              <button
                type="button"
                onClick={() => onNavigate('driver-licenses')}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors cursor-pointer shadow-xs active:scale-95"
              >
                <span>Thẩm Định Ngay</span>
                <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards Hàng Ngang (Tối ưu breakpoint lg:grid-cols-4 cho màn hình laptop 1024px+) */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {dynamicKpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </div>

      {/* BIỂU ĐỒ TRỰC QUAN HÓA TOÀN DIỆN (Visual Analytics Charts) */}
      <AnalyticsCharts
        revenueTrend={data?.revenueTrend || []}
        revenueByRoute={data?.revenueByRoute || []}
        totalRevenue={data?.kpis.totalRevenue ?? 0}
        occupancyTrips={data?.occupancyTrips || []}
      />

      {/* DANH SÁCH CHUYẾN XE LIVE & CÁC BẢNG PHỤ TRỢ */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TripsPanel
            trips={mappedTrips}
            onNavigateToSchedule={() => onNavigate?.('schedule')}
            onOpenDispatch={(trip) => onNavigate?.('schedule')}
          />
        </div>
        <div className="flex flex-col gap-6">
          <IncidentsCard incidents={data?.activeIncidentsList} />
          {role === 'admin' && (
            <RevenueChannelsCard channels={data?.revenueByChannel} />
          )}
        </div>
      </div>

      {/* DRAWER NHẬT KÝ KIỂM TOÁN AN NINH (AUDIT TRAIL) */}
      <AuditLogDrawer
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
        logs={data?.recentAuditLogs || []}
      />

      {/* MODAL KHÓA PHIÊN AN TOÀN (SESSION WATCHDOG LOCK) */}
      <SessionTimeoutModal
        isOpen={isSessionLocked}
        onUnlock={() => setIsSessionLocked(false)}
        onLogout={() => {
          authService.clearSession()
          window.location.href = '/login'
        }}
        adminName={currentUser?.fullName || 'Quản trị viên Hệ thống'}
        adminEmail={currentUser?.email || 'admin@smartbus.ictu.vn'}
      />

      {/* MODAL BẢNG KÊ ĐỐI SOÁT DOANH THU TỪNG NGÀY */}
      <DailyRevenueModal
        isOpen={isDailyModalOpen}
        onClose={() => setIsDailyModalOpen(false)}
        data={data?.dailyBreakdown || []}
        onSelectDate={handleSelectDateFromModal}
      />
    </div>
  )
}
