'use client'

import { useEffect, useState, useCallback, useMemo, memo } from 'react'
import {
  Armchair,
  Bus,
  MapPin,
  QrCode,
  Timer,
  Radio,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Bell,
  CheckCheck,
  ChevronRight,
  Send,
  Siren,
  Phone,
  Gauge,
  Clock,
  Users,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Volume2,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { driverService, DriverTripItem } from '@/lib/services/driver.service'
import { notificationService } from '@/lib/services/notification.service'
import { authService } from '@/lib/services/auth.service'
import { driverHardware } from '@/lib/utils/driver-hardware'
import { DriverLiveMap } from '@/components/portal/dashboard/driver-live-map'
import type { NotificationItem } from '@/lib/types/notification'

interface DriverDashboardProps {
  onNavigate: (key: string) => void
  onOpenCockpit?: () => void
}

interface StationItem {
  name: string
  time: string
  state: 'done' | 'current' | 'upcoming'
}

/** Component đếm ngược độc lập ngăn chặn render lại toàn bộ trang mỗi giây */
const DepartureCountdown = memo(function DepartureCountdown({
  departureTime,
}: {
  departureTime?: string
}) {
  const [countdownText, setCountdownText] = useState('00:00')

  useEffect(() => {
    if (!departureTime) return

    const targetTime = new Date(departureTime).getTime()

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((targetTime - Date.now()) / 1000))
      const minutes = String(Math.floor(diff / 60)).padStart(2, '0')
      const seconds = String(diff % 60).padStart(2, '0')
      setCountdownText(`${minutes}:${seconds}`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [departureTime])

  return (
    <span className="font-mono text-4xl sm:text-5xl lg:text-6xl font-black tabular-nums tracking-tight text-emerald-300">
      {countdownText}
    </span>
  )
})

export function DriverDashboard({ onNavigate, onOpenCockpit }: DriverDashboardProps) {
  const [trips, setTrips] = useState<DriverTripItem[]>([])
  const [activeTrip, setActiveTrip] = useState<DriverTripItem | null>(null)
  const [manifestCount, setManifestCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  // Thông báo phân công & lịch trình ca chạy
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const [stationNotice, setStationNotice] = useState<string | null>(null)

  // Bộ lọc & tìm kiếm danh sách ca chạy bên cột phải
  const [tripFilter, setTripFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [searchTripQuery, setSearchTripQuery] = useState('')

  // Tab chuyển đổi Bản đồ GPS / Lộ trình trạm dừng bên cột trái
  const [telematicsTab, setTelematicsTab] = useState<'map' | 'stations'>('map')

  // Thông tin người dùng đăng nhập hiện tại
  const currentUser = useMemo(() => authService.getUser(), [])
  const isConductor = currentUser?.role === 'conductor'

  // Tải danh sách ca chạy từ API Backend với thuật toán chọn ca thông minh
  const loadTrips = useCallback(async () => {
    setIsLoading(true)
    const res = await driverService.getTodayTrips()
    if (res.success && res.data && res.data.length > 0) {
      setTrips(res.data)

      const now = Date.now()
      // 1. Ưu tiên chuyến đang chạy / đón khách
      let current = res.data.find(
        (t) => t.status === 'in_progress' || t.status === 'boarding' || t.status === 'delayed'
      )

      // 2. Ưu tiên chuyến sắp chạy gần nhất tính từ thời điểm hiện tại
      if (!current) {
        const scheduledTrips = res.data
          .filter((t) => t.status === 'scheduled')
          .sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime())

        // Tìm chuyến có giờ xuất bến >= now - 15 phút
        const nextTrip = scheduledTrips.find(
          (t) => new Date(t.departureTime).getTime() >= now - 15 * 60 * 1000
        )
        current = nextTrip || scheduledTrips[0]
      }

      // 3. Nếu toàn bộ chuyến trong ngày đã hoàn thành, chọn chuyến vừa xong gần nhất
      if (!current) {
        const sortedByNearNow = [...res.data].sort((a, b) => {
          return (
            Math.abs(new Date(a.departureTime).getTime() - now) -
            Math.abs(new Date(b.departureTime).getTime() - now)
          )
        })
        current = sortedByNearNow[0] || res.data[0]
      }

      setActiveTrip(current)

      // Tải số lượng hành khách đã đặt vé trong manifest
      if (current?.id) {
        try {
          const mRes = await driverService.getTripManifest(current.id)
          if (mRes.success && mRes.data) {
            setManifestCount(mRes.data.totalPassengers || mRes.data.manifest?.length || 0)
          }
        } catch (e) {
          console.warn('[DriverDashboard] Không thể tải manifest:', e)
        }
      }
    } else {
      setTrips([])
      setActiveTrip(null)
      setManifestCount(0)
    }
    setIsLoading(false)
  }, [])

  // Tải danh sách thông báo điều phối từ Backend
  const loadNotifications = useCallback(async () => {
    try {
      const res = await notificationService.getNotifications(1, 10, false)
      if (res && res.success && res.data) {
        const list = res.data.notifications || []
        setNotifications(list)
        setUnreadNotifCount(res.data.unreadCount ?? list.filter((n) => !n.isRead).length)
      }
    } catch (e) {
      console.warn('[DriverDashboard] Không thể tải thông báo:', e)
    }
  }, [])

  useEffect(() => {
    loadTrips()
    loadNotifications()
    const timer = setInterval(loadNotifications, 30000)
    return () => clearInterval(timer)
  }, [loadTrips, loadNotifications])

  // Tiếp nhận ca chạy từ thông báo
  const handleAcceptDispatch = async (notif: NotificationItem) => {
    try {
      await notificationService.markAsRead(notif.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      )
      setUnreadNotifCount((prev) => Math.max(0, prev - 1))
      await loadTrips()
      const targetTripId = notif.data?.tripId || notif.tripId
      if (targetTripId) {
        const found = trips.find((t) => t.id === targetTripId)
        if (found) {
          setActiveTrip(found)
        }
      }
    } catch (e) {
      console.warn('[DriverDashboard] Lỗi tiếp nhận ca chạy:', e)
    }
  }

  // Đánh dấu tất cả thông báo là đã đọc
  const handleMarkAllNotifsAsRead = async () => {
    try {
      await notificationService.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadNotifCount(0)
    } catch (e) {
      console.warn('[DriverDashboard] Lỗi đánh dấu đọc toàn bộ:', e)
    }
  }

  // Phát chuông cập trạm
  const handleChimeNextStation = (stationName: string) => {
    driverHardware.playCue('stationArrival')
    setStationNotice(`Đã phát chuông cập trạm: ${stationName}`)
    setTimeout(() => setStationNotice(null), 3000)
  }

  // Trích xuất lộ trình trạm dừng thực tế từ DB
  const routeStops: StationItem[] = useMemo(() => {
    const rawStations =
      (activeTrip?.route as any)?.routeStations ||
      activeTrip?.route?.stations ||
      []

    if (rawStations.length > 0) {
      return [...rawStations]
        .sort((a: any, b: any) => (a.stopOrder || 0) - (b.stopOrder || 0))
        .map((s: any, idx: number) => ({
          name: s.station?.name || s.name || `Trạm ${idx + 1}`,
          time:
            s.time ||
            (s.departureTime
              ? new Date(s.departureTime).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : `+${(s.stopOrder || idx + 1) * 7}m`),
          state: (idx === 0 ? 'current' : 'upcoming') as StationItem['state'],
        }))
    }

    return [
      {
        name: activeTrip?.route?.origin || 'Trạm ĐH CNTT & TT Thái Nguyên (ICTU)',
        time: '07:00',
        state: 'current' as const,
      },
      {
        name: 'Trạm Cổng KTX ĐH Thái Nguyên',
        time: '+8m',
        state: 'upcoming' as const,
      },
      {
        name: 'Trạm Bệnh Viện Đa Khoa Trung Ương',
        time: '+24m',
        state: 'upcoming' as const,
      },
      {
        name: activeTrip?.route?.destination || 'Trạm Bến Xe Trung Tâm Thái Nguyên',
        time: '+35m',
        state: 'upcoming' as const,
      },
    ]
  }, [activeTrip])

  const departureTimeString = useMemo(() => {
    if (!activeTrip?.departureTime) return '---'
    return new Date(activeTrip.departureTime).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [activeTrip?.departureTime])

  const vehicleLicensePlate =
    (activeTrip?.vehicle as any)?.licensePlate ||
    activeTrip?.vehicle?.plateNumber ||
    (activeTrip ? 'Chưa gán xe' : '---')

  const greetingText = useMemo(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return 'Chào buổi sáng'
    if (hour >= 12 && hour < 18) return 'Chào buổi chiều'
    return 'Chào buổi tối'
  }, [])

  // Chuẩn hóa tên hiển thị: loại bỏ dính chữ và hậu tố vai trò trùng lặp như "(Tài Xế)"
  const cleanDisplayName = useMemo(() => {
    if (!currentUser?.fullName) return ''
    return currentUser.fullName
      .replace(/\s*\((tài xế|phụ xe|nhân viên|cán bộ|admin|quản trị|tài xế xe buýt)\)/gi, '')
      .trim()
  }, [currentUser?.fullName])

  const scheduledCount = useMemo(() => {
    return trips.filter(
      (t) =>
        t.status === 'scheduled' ||
        t.status === 'in_progress' ||
        t.status === 'boarding' ||
        t.status === 'delayed'
    ).length
  }, [trips])

  const completedCount = useMemo(() => {
    return trips.filter((t) => t.status === 'completed').length
  }, [trips])

  const filteredTrips = useMemo(() => {
    let list = trips
    if (tripFilter === 'active') {
      list = list.filter(
        (t) =>
          t.status === 'in_progress' ||
          t.status === 'boarding' ||
          t.status === 'scheduled' ||
          t.status === 'delayed'
      )
    } else if (tripFilter === 'completed') {
      list = list.filter((t) => t.status === 'completed')
    }
    if (searchTripQuery.trim()) {
      const q = searchTripQuery.toLowerCase().trim()
      list = list.filter((t) => {
        const code = (t.route?.routeCode || '').toLowerCase()
        const name = (t.route?.name || '').toLowerCase()
        const plate = (
          (t.vehicle as any)?.licensePlate ||
          t.vehicle?.plateNumber ||
          ''
        ).toLowerCase()
        const dep = new Date(t.departureTime).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        })
        return code.includes(q) || name.includes(q) || plate.includes(q) || dep.includes(q)
      })
    }
    return list
  }, [trips, tripFilter, searchTripQuery])

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 pb-28 lg:pb-8">
      {/* ========================================================================= */}
      {/* 1. THANH HEADER ĐIỀU HÀNH RỘNG RÃI & CHUYỂN NHANH BUỒNG LÁI HUD           */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-card p-5 sm:p-6 rounded-3xl border border-slate-200/90 dark:border-border/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              {isConductor ? 'Soát Vé & Phụ Xe' : 'Tài Xế Trực Tuyến'}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-muted-foreground">
              {isConductor ? 'Chào ca trực, Phụ xe' : `${greetingText}, Bác tài`}
              {cleanDisplayName ? ` ${cleanDisplayName}` : ''}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground mt-1.5">
            Bảng Điều Hành Ca Chạy & Lịch Trình Xe Buýt
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Hệ thống Quản lý Vận hành Trực tuyến Tuyến Nội Đô ICTU Transit
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Nút Chuông Thông Báo */}
          <button
            type="button"
            onClick={() => setIsNotifOpen((prev) => !prev)}
            title="Thông báo lịch trình & phân công ca chạy"
            className="relative size-11 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
          >
            <Bell size={18} />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm">
                {unreadNotifCount}
              </span>
            )}
          </button>

          {/* Nút Làm Mới */}
          <button
            type="button"
            onClick={() => {
              loadTrips()
              loadNotifications()
            }}
            title="Làm mới dữ liệu từ máy chủ"
            className="size-11 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>

          {/* Nút Hero: Chuyển Sang Buồng Lái Số HUD */}
          {onOpenCockpit && (
            <button
              type="button"
              onClick={onOpenCockpit}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 px-4 sm:px-5 py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-emerald-700/20 hover:from-emerald-500 hover:to-teal-600 active:scale-95 transition-all cursor-pointer"
            >
              <Radio className="size-4 sm:size-5 animate-pulse shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">Vào Buồng Lái HUD (Táp-lô số)</span>
              <span className="sm:hidden whitespace-nowrap">Vào Buồng Lái HUD</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. WIDGET THÔNG BÁO ĐIỀU PHỐI (DRAWER THÔNG BÁO KHI MỞ)                   */}
      {/* ========================================================================= */}
      {isNotifOpen && (
        <section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm sm:text-base font-bold text-foreground">
                Thông Báo Phân Công & Ca Trực Từ Ban Điều Hành
              </h2>
              {unreadNotifCount > 0 && (
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-600 dark:text-red-400">
                  {unreadNotifCount} chưa đọc
                </span>
              )}
            </div>
            {unreadNotifCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllNotifsAsRead}
                className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1.5"
              >
                <CheckCheck size={14} />
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>

          <div className="mt-4 space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Chưa có thông báo phân công ca chạy nào.
              </p>
            ) : (
              notifications.map((notif) => {
                const isDispatch =
                  notif.type === 'TRIP_DISPATCHED' ||
                  notif.type === 'TRIP_SCHEDULE_UPDATE' ||
                  notif.title.toLowerCase().includes('phân công') ||
                  notif.title.toLowerCase().includes('lịch trình')
                const isUnassigned = notif.type === 'TRIP_UNASSIGNED'

                return (
                  <div
                    key={notif.id}
                    className={cn(
                      'rounded-2xl border p-3.5 text-xs transition-colors',
                      !notif.isRead
                        ? 'border-emerald-500/40 bg-white dark:bg-card shadow-xs'
                        : 'border-border/60 bg-muted/20'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'mt-0.5 rounded-xl p-2 shrink-0',
                            isUnassigned
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                              : isDispatch
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          )}
                        >
                          {isUnassigned ? (
                            <AlertCircle size={16} />
                          ) : isDispatch ? (
                            <Calendar size={16} />
                          ) : (
                            <Bell size={16} />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{notif.title}</p>
                          <p className="text-muted-foreground mt-0.5 leading-relaxed">{notif.body}</p>
                          <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                            {new Date(notif.createdAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>

                      {!notif.isRead && (
                        <button
                          type="button"
                          onClick={() => handleAcceptDispatch(notif)}
                          className="shrink-0 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
                        >
                          {isUnassigned ? 'Đã hiểu' : 'Tiếp nhận ca'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 3. THANH TỔNG QUAN VẬN HÀNH NHANH (QUICK TELEMATICS KPI BAR)               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Ca Hiện Tại */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-border/80 bg-white dark:bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Ca chạy đang chọn</span>
            <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Bus size={16} />
            </div>
          </div>
          <p className="mt-2 font-mono text-xl sm:text-2xl font-black text-foreground">
            {activeTrip?.route?.routeCode || '---'}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {activeTrip?.route?.name || (isLoading ? 'Đang tải dữ liệu...' : 'Chưa có ca chạy')}
          </p>
        </div>

        {/* KPI 2: Giờ Xuất Bến */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-border/80 bg-white dark:bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Giờ xuất bến</span>
            <div className="size-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <p className="mt-2 font-mono text-xl sm:text-2xl font-black text-foreground">
            {activeTrip ? departureTimeString : '---'}
          </p>
          <p
            className={cn(
              'text-xs font-bold mt-0.5 flex items-center gap-1',
              activeTrip?.status === 'completed'
                ? 'text-slate-500 dark:text-slate-400'
                : activeTrip?.status === 'delayed'
                ? 'text-amber-600 dark:text-amber-400'
                : activeTrip
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-muted-foreground'
            )}
          >
            <span
              className={cn(
                'size-1.5 rounded-full',
                activeTrip?.status === 'completed'
                  ? 'bg-slate-400'
                  : activeTrip?.status === 'delayed'
                  ? 'bg-amber-500 animate-ping'
                  : activeTrip
                  ? 'bg-emerald-500 animate-ping'
                  : 'bg-slate-400'
              )}
            />
            {activeTrip?.status === 'completed'
              ? 'Đã hoàn thành ca'
              : activeTrip?.status === 'delayed'
              ? 'Chậm giờ xuất bến'
              : activeTrip
              ? 'Đúng lịch trình'
              : 'Chưa xếp lịch'}
          </p>
        </div>

        {/* KPI 3: Sĩ Số Vé & Ghế */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-border/80 bg-white dark:bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Hành khách / Sĩ số</span>
            <div className="size-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <p className="mt-2 font-mono text-xl sm:text-2xl font-black text-foreground">
            {activeTrip ? manifestCount : 0}{' '}
            <span className="text-xs font-bold text-muted-foreground">
              / {activeTrip?.vehicle?.capacity ?? (activeTrip?.vehicle as any)?.seatCapacity ?? 28} khách
            </span>
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {activeTrip
              ? `Còn trống: ${Math.max(0, (activeTrip?.vehicle?.capacity ?? (activeTrip?.vehicle as any)?.seatCapacity ?? 28) - manifestCount)} ghế`
              : 'Chưa có hành khách'}
          </p>
        </div>

        {/* KPI 4: Phương Tiện Vận Hành */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-border/80 bg-white dark:bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Xe phân công</span>
            <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Gauge size={16} />
            </div>
          </div>
          <p className="mt-2 font-mono text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {vehicleLicensePlate}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {activeTrip ? ((activeTrip?.vehicle as any)?.model || 'VinFast eBus 2024 (EV)') : 'Chưa gán xe'}
          </p>
        </div>
      </div>

      {/* Trường hợp chưa có chuyến xe được phân công */}
      {!isLoading && !activeTrip ? (
        <div className="rounded-3xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-12 text-center space-y-4">
          <AlertCircle size={44} className="mx-auto text-amber-600" />
          <h3 className="text-lg font-black text-amber-950 dark:text-amber-200">
            Chưa Có Ca Chạy Nào Được Phân Quyền Hôm Nay
          </h3>
          <p className="text-xs sm:text-sm text-amber-800/80 dark:text-amber-300/80 max-w-lg mx-auto">
            Hệ thống chưa tìm thấy chuyến xe nào gán cho tài khoản của bạn hôm nay. Khi Quản trị viên
            tạo tuyến mới và chỉ định bạn phụ trách, các ca chạy sẽ lập tức xuất hiện tại đây.
          </p>
          <button
            type="button"
            onClick={loadTrips}
            className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-500 cursor-pointer transition-all shadow-md"
          >
            Kiểm tra lại
          </button>
        </div>
      ) : (
        /* ========================================================================= */
        /* 4. KHU VỰC VẬN HÀNH CHÍNH: BỐ CỤC 2 CỘT RỘNG RÃI VÀ THOÁNG ĐÃNG           */
        /* ========================================================================= */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* ======================================================== */}
          {/* CỘT TRÁI (XL:COL-SPAN-7 - 60%): LIVE HERO CARD & TRẠM DỪNG */}
          {/* ======================================================== */}
          <div className="xl:col-span-7 flex flex-col gap-6">
            {/* Thẻ Chuyến Xe Trọng Tâm (Cockpit Glassmorphism Live Hero Card) */}
            <article className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#061217] via-[#092225] to-[#03362a] p-6 sm:p-8 text-white shadow-2xl shadow-emerald-950/25 border border-emerald-500/30">
              {/* Ambient Background Glow */}
              <div
                aria-hidden="true"
                className="absolute -right-20 -top-20 size-72 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none"
              />
              <div
                aria-hidden="true"
                className="absolute -left-20 -bottom-20 size-72 rounded-full bg-teal-500/15 blur-3xl pointer-events-none"
              />

              {/* Header Thẻ: Biển số xe & Trạng thái */}
              <div className="relative flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-400/15 px-3 py-1.5 text-xs sm:text-sm font-bold text-emerald-300 border border-emerald-400/30">
                    <Bus size={16} strokeWidth={2} aria-hidden="true" />
                    <span>Xe {vehicleLicensePlate}</span>
                  </span>
                  {activeTrip?.status === 'completed' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-500/25 px-3 py-1.5 text-xs font-black text-slate-300 uppercase tracking-wider border border-slate-400/30">
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      Đã hoàn thành ca
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider border',
                        activeTrip?.status === 'in_progress'
                          ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/30'
                          : activeTrip?.status === 'delayed'
                          ? 'bg-amber-500/25 text-amber-300 border-amber-400/30'
                          : 'bg-blue-500/25 text-blue-300 border-blue-400/30'
                      )}
                    >
                      <span className="size-2 rounded-full bg-current animate-ping" />
                      {activeTrip?.status === 'in_progress'
                        ? 'Đang chạy'
                        : activeTrip?.status === 'delayed'
                        ? 'Chậm chuyến'
                        : 'Sẵn sàng khởi hành'}
                    </span>
                  )}
                </div>
                <span className="font-mono text-xs sm:text-sm font-bold text-white/60 bg-white/10 px-3 py-1 rounded-xl">
                  Tuyến {activeTrip?.route?.routeCode || 'CT-01'}
                </span>
              </div>

              {/* Tiêu đề chặng đường xe chạy */}
              <h2 className="relative mt-5 text-balance text-2xl sm:text-3xl lg:text-4xl font-black leading-tight tracking-tight text-white">
                {activeTrip?.route?.name ||
                  `${activeTrip?.route?.origin || 'ICTU'} ↔ ${activeTrip?.route?.destination || 'Bến xe TT'}`}
              </h2>

              {/* Đồng hồ số táp-lô & Giờ xuất bến */}
              <div className="relative mt-6 flex flex-wrap items-end justify-between gap-4 pt-4 border-t border-white/10">
                <div>
                  <p className="flex items-center gap-2 text-xs sm:text-sm text-white/70 font-semibold mb-1">
                    <Timer size={16} strokeWidth={2} className="text-emerald-400" aria-hidden="true" />
                    {activeTrip?.status === 'completed'
                      ? 'Trạng thái ca chạy'
                      : activeTrip?.status === 'in_progress'
                      ? 'Thời gian ca chạy đã diễn ra'
                      : 'Đếm ngược giờ xuất bến'}
                  </p>
                  {activeTrip?.status === 'completed' ? (
                    <div className="flex items-center gap-2 text-emerald-300 font-mono text-2xl sm:text-3xl font-black">
                      <CheckCircle2 size={26} className="text-emerald-400 shrink-0" />
                      <span>Ca chạy đã hoàn tất</span>
                    </div>
                  ) : (
                    <DepartureCountdown departureTime={activeTrip?.departureTime} />
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs sm:text-sm text-white/70 font-semibold mb-1">Giờ xuất bến ấn định</p>
                  <p className="font-mono text-3xl sm:text-4xl font-black text-white">{departureTimeString}</p>
                </div>
              </div>

              {/* NÚT HÀNH ĐỘNG TRỌNG TÂM: VÀO BUỒNG LÁI HUD CHO CA CHẠY NÀY */}
              {onOpenCockpit && (
                <div className="relative mt-6">
                  <button
                    type="button"
                    onClick={onOpenCockpit}
                    className="w-full flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 px-5 py-3.5 text-white shadow-xl shadow-emerald-950/40 transition-all active:scale-[0.99] cursor-pointer border border-emerald-400/40 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Radio size={20} className="animate-pulse text-white" />
                      </div>
                      <div className="text-left">
                        <span className="text-sm sm:text-base font-black tracking-wide uppercase block">
                          VÀO BUỒNG LÁI HUD (TÁP-LÔ SỐ) CHO CA NÀY
                        </span>
                        <span className="text-xs text-emerald-100 font-medium">
                          Mở giao diện vận hành thời gian thực, định vị GPS OSRM & chuông trạm dừng
                        </span>
                      </div>
                    </div>
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform shrink-0" />
                  </button>
                </div>
              )}

              {/* BỘ BA NÚT TÁC VỤ CỰC ĐẠI CHO TÀI XẾ & PHỤ XE */}
              <div className="relative mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Nút 1: Soát Vé QR */}
                <button
                  type="button"
                  onClick={() => onNavigate('scanner')}
                  className="group flex min-h-[64px] items-center justify-start gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-4 py-3 text-white shadow-xl shadow-emerald-500/25 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <div className="size-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <QrCode size={22} strokeWidth={2.2} />
                  </div>
                  <div className="text-left">
                    <div className="text-xs sm:text-sm font-black tracking-wide uppercase">SOÁT VÉ QR</div>
                    <div className="text-[11px] text-emerald-100 font-medium">Camera quét mã</div>
                  </div>
                </button>

                {/* Nút 2: Sĩ Số Khách & Sơ Đồ Ghế */}
                <button
                  type="button"
                  onClick={() => onNavigate('manifest')}
                  className="group flex min-h-[64px] items-center justify-start gap-3 rounded-2xl border border-white/20 bg-white/10 hover:bg-white/15 px-4 py-3 text-white transition-all active:scale-[0.98] cursor-pointer backdrop-blur-md"
                >
                  <div className="size-11 rounded-xl bg-blue-500/30 text-blue-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Armchair size={22} strokeWidth={2.2} />
                  </div>
                  <div className="text-left">
                    <div className="text-xs sm:text-sm font-black tracking-wide uppercase">SĨ SỐ XE</div>
                    <div className="text-[11px] text-white/80 font-medium">{manifestCount}/28 Hành khách</div>
                  </div>
                </button>

                {/* Nút 3: Báo Sự Cố SOS */}
                <button
                  type="button"
                  onClick={() => onNavigate('incident-report')}
                  className="group flex min-h-[64px] items-center justify-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/20 hover:bg-rose-500/30 px-4 py-3 text-rose-100 transition-all active:scale-[0.98] cursor-pointer backdrop-blur-md"
                >
                  <div className="size-11 rounded-xl bg-rose-500/30 text-rose-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Siren size={22} strokeWidth={2.2} className="animate-pulse" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs sm:text-sm font-black tracking-wide uppercase">BÁO SỰ CỐ SOS</div>
                    <div className="text-[11px] text-rose-200/80 font-medium">Ùn tắc, xe hỏng</div>
                  </div>
                </button>
              </div>
            </article>

            {/* CONTAINER ĐIỀU HÀNH TELEMATICS: BẢN ĐỒ GPS HOẶC LỘ TRÌNH TRẠM DỪNG */}
            <div className="rounded-3xl border border-slate-200/90 dark:border-border/90 bg-white dark:bg-card p-5 sm:p-6 shadow-xs flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/80">
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-muted/40 border border-slate-200 dark:border-border">
                  <button
                    type="button"
                    onClick={() => setTelematicsTab('map')}
                    className={cn(
                      'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
                      telematicsTab === 'map'
                        ? 'bg-white dark:bg-card text-foreground shadow-xs border border-border/60'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Radio size={14} className={telematicsTab === 'map' ? 'text-emerald-600' : ''} />
                    <span>Bản Đồ GPS Live</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTelematicsTab('stations')}
                    className={cn(
                      'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
                      telematicsTab === 'stations'
                        ? 'bg-white dark:bg-card text-foreground shadow-xs border border-border/60'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <MapPin size={14} className={telematicsTab === 'stations' ? 'text-emerald-600' : ''} />
                    <span>Lộ Trình Trạm Dừng ({routeStops.length})</span>
                  </button>
                </div>

                {stationNotice && (
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 animate-in fade-in">
                    <Volume2 size={14} className="animate-bounce" />
                    {stationNotice}
                  </span>
                )}
              </div>

              {telematicsTab === 'map' ? (
                <DriverLiveMap activeTrip={activeTrip} onOpenCockpit={onOpenCockpit} className="!border-0 !p-0 !shadow-none" />
              ) : (
                <div className="max-h-[420px] overflow-y-auto pr-1">
                  <ol className="space-y-3.5">
                    {routeStops.map((stop, index) => {
                      const isLast = index === routeStops.length - 1
                      const current = stop.state === 'current'
                      return (
                        <li key={`${stop.name}-${index}`} className="relative flex items-start gap-4">
                          {!isLast && (
                            <span
                              aria-hidden="true"
                              className="absolute left-[13px] top-6 h-[calc(100%+14px)] w-0.5 bg-slate-200 dark:bg-slate-800"
                            />
                          )}
                          <span
                            className={cn(
                              'relative mt-1 size-7 shrink-0 rounded-full border-2 flex items-center justify-center font-mono text-xs font-black transition-all',
                              current
                                ? 'border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                                : 'border-slate-300 dark:border-slate-700 bg-background text-muted-foreground'
                            )}
                          >
                            {current && (
                              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/40" />
                            )}
                            <span>{index + 1}</span>
                          </span>

                          <div className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-muted/10 p-3.5 hover:bg-slate-50 dark:hover:bg-muted/20 transition-colors">
                            <div>
                              <p
                                className={cn(
                                  'text-sm font-bold',
                                  current ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'
                                )}
                              >
                                {stop.name}
                              </p>
                              {current ? (
                                <span className="inline-flex items-center gap-1.5 mt-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                  <span className="size-1.5 rounded-full bg-emerald-600 animate-ping" />
                                  Trạm hiện tại (Đang mở cửa đón khách)
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground mt-0.5 block">
                                  Dự kiến ghé trạm
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs font-bold text-muted-foreground bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                {stop.time}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleChimeNextStation(stop.name)}
                                title="Phát chuông thông báo trạm này"
                                className="size-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400 flex items-center justify-center transition-all cursor-pointer"
                              >
                                <Volume2 size={15} />
                              </button>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* CỘT PHẢI (XL:COL-SPAN-5 - 40%): LỊCH TRÌNH & ĐIỀU PHỐI    */}
          {/* ======================================================== */}
          <div className="xl:col-span-5 flex flex-col gap-6">
            {/* Card 1: Tất Cả Ca Chạy Hôm Nay (Schedule Roster) */}
            <section className="rounded-3xl border border-slate-200/90 dark:border-border/90 bg-white dark:bg-card p-5 sm:p-6 shadow-xs flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-border/80">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-base font-bold text-foreground">
                    Tất Cả Ca Chạy Hôm Nay
                  </h3>
                </div>
                <span className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 text-xs font-bold font-mono">
                  {trips.length} chuyến
                </span>
              </div>

              {/* Ô TÌM KIẾM NHANH */}
              <div className="relative mt-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTripQuery}
                  onChange={(e) => setSearchTripQuery(e.target.value)}
                  placeholder="Tìm theo tuyến, xe, giờ xuất bến..."
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/20 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-muted-foreground transition-all"
                />
              </div>

              {/* BỘ LỌC TRẠNG THÁI CA CHẠY */}
              <div className="flex items-center gap-1.5 mt-2.5 mb-3 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setTripFilter('all')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors',
                    tripFilter === 'all'
                      ? 'bg-foreground text-background shadow-2xs'
                      : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                  )}
                >
                  Tất cả ({trips.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTripFilter('active')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors',
                    tripFilter === 'active'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                  )}
                >
                  Chờ / Đang chạy ({scheduledCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTripFilter('completed')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors',
                    tripFilter === 'completed'
                      ? 'bg-slate-700 text-white dark:bg-slate-600 shadow-2xs'
                      : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                  )}
                >
                  Đã xong ({completedCount})
                </button>
              </div>

              <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                {filteredTrips.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Không tìm thấy ca chạy nào phù hợp.
                  </p>
                ) : (
                  filteredTrips.map((t) => {
                    const isSelected = activeTrip?.id === t.id
                    const depTime = new Date(t.departureTime).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    const isRunning = t.status === 'in_progress' || t.status === 'boarding'

                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setActiveTrip(t)
                          if (t.id) {
                            driverService
                              .getTripManifest(t.id)
                              .then((mRes) => {
                                if (mRes.success && mRes.data) {
                                  setManifestCount(
                                    mRes.data.totalPassengers || mRes.data.manifest?.length || 0
                                  )
                                }
                              })
                              .catch(() => {})
                          }
                        }}
                        className={cn(
                          'w-full text-left rounded-2xl border p-3.5 transition-all cursor-pointer flex items-center justify-between gap-3',
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30 shadow-xs'
                            : 'border-slate-200/80 dark:border-border bg-card hover:bg-muted/40 hover:border-slate-300'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              'size-11 rounded-xl flex flex-col items-center justify-center font-mono shrink-0 font-black',
                              isSelected
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-foreground'
                            )}
                          >
                            <span className="text-xs leading-none">{depTime}</span>
                            <span className="text-[9px] font-sans opacity-80 mt-0.5">XUẤT</span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-foreground">
                                {t.route?.routeCode || 'Tuyến'}
                              </span>
                              <span className="text-[11px] font-mono text-muted-foreground">
                                Xe: {(t.vehicle as any)?.licensePlate || t.vehicle?.plateNumber || '20B-012.34'}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-muted-foreground truncate mt-0.5">
                              {t.route?.name || t.route?.destination || 'Lộ trình'}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider',
                              isRunning
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                : t.status === 'completed'
                                ? 'bg-gray-500/20 text-gray-600 dark:text-gray-300'
                                : 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                            )}
                          >
                            {isRunning ? 'Đang chạy' : t.status === 'completed' ? 'Đã xong' : 'Sẵn sàng'}
                          </span>
                          <ChevronRight
                            size={16}
                            className={cn(isSelected ? 'text-emerald-600' : 'text-muted-foreground/50')}
                          />
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </section>

            {/* Card 2: Hỗ Trợ Điều Hành & Đội Ngũ (Crew & Hotline Support) */}
            <section className="rounded-3xl border border-slate-200/90 dark:border-border/90 bg-white dark:bg-card p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>Hỗ Trợ Kỹ Thuật & Điều Phối Trung Tâm</span>
              </h3>

              <div className="rounded-2xl bg-slate-50 dark:bg-muted/20 border border-slate-200/80 dark:border-border/80 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tổng đài điều phối:</span>
                  <a
                    href="tel:02083846115"
                    className="font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Phone size={12} />
                    0208 3846 115
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Kênh bộ đàm nội bộ:</span>
                  <span className="font-mono font-bold text-foreground">Kênh 04 (Tuyến ICTU)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Đồng bộ GPS Telematics:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Trực tuyến 100%
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
