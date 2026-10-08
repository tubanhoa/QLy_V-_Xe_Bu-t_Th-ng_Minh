'use client'

import { useEffect, useState, useCallback, useMemo, memo } from 'react'
import Link from 'next/link'
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
  Smartphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { driverService, DriverTripItem } from '@/lib/services/driver.service'
import { notificationService } from '@/lib/services/notification.service'
import { authService } from '@/lib/services/auth.service'
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
    <p className="mt-1 font-mono text-4xl sm:text-5xl font-bold tabular-nums tracking-tight text-emerald-300">
      {countdownText}
    </p>
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

  // Thông tin người dùng đăng nhập hiện tại
  const currentUser = useMemo(() => authService.getUser(), [])
  const isConductor = currentUser?.role === 'conductor'

  // Tải danh sách ca chạy từ API Backend
  const loadTrips = useCallback(async () => {
    setIsLoading(true)
    const res = await driverService.getTodayTrips()
    if (res.success && res.data && res.data.length > 0) {
      setTrips(res.data)
      const current =
        res.data.find((t) => t.status === 'in_progress' || t.status === 'delayed') ||
        res.data.find((t) => t.status === 'scheduled') ||
        res.data[0]
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

  // Trích xuất lộ trình trạm dừng thực tế từ Supabase DB (routeStations) có memoization
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
    if (!activeTrip?.departureTime) return 'Chưa xếp lịch'
    return new Date(activeTrip.departureTime).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [activeTrip?.departureTime])

  const vehicleLicensePlate =
    (activeTrip?.vehicle as any)?.licensePlate ||
    activeTrip?.vehicle?.plateNumber ||
    '20B-012.34'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {/* Tiêu đề & Chuyển đổi nhanh sang Buồng Lái Số HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground">
              {isConductor ? 'Chào ca trực, Phụ xe' : 'Chào buổi sáng, Bác tài'}
              {currentUser?.fullName ? ` ${currentUser.fullName}` : ''}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              {isConductor ? 'Soát Vé & Phụ Xe' : 'Tài Xế Trực Tuyến'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Lịch Trình Vận Hành Hôm Nay
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Nút chuông thông báo điều phối */}
          <button
            type="button"
            onClick={() => setIsNotifOpen((prev) => !prev)}
            title="Thông báo lịch trình & phân công ca chạy"
            className="relative p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
          >
            <Bell size={15} />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white shadow-sm">
                {unreadNotifCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              loadTrips()
              loadNotifications()
            }}
            title="Làm mới dữ liệu từ máy chủ"
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
          {onOpenCockpit && (
            <button
              type="button"
              onClick={onOpenCockpit}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:from-emerald-500 hover:to-teal-600 active:scale-95 transition-all cursor-pointer"
            >
              <Radio className="size-4 animate-pulse" />
              <span>Vào Buồng Lái HUD</span>
            </button>
          )}
        </div>
      </div>

      {/* WIDGET: THÔNG BÁO LỊCH TRÌNH & ĐIỀU PHỐI TỔ XE */}
      {isNotifOpen && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-foreground">
                Thông Báo Phân Công & Ca Trực
              </h2>
              {unreadNotifCount > 0 && (
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                  {unreadNotifCount} chưa đọc
                </span>
              )}
            </div>
            {unreadNotifCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllNotifsAsRead}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
              >
                <CheckCheck size={12} />
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>

          <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
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
                      'rounded-xl border p-3 text-xs transition-colors',
                      !notif.isRead
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-border bg-muted/20'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <div
                          className={cn(
                            'mt-0.5 rounded-lg p-1.5 shrink-0',
                            isUnassigned
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                              : isDispatch
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          )}
                        >
                          {isUnassigned ? (
                            <AlertCircle size={14} />
                          ) : isDispatch ? (
                            <Calendar size={14} />
                          ) : (
                            <Bell size={14} />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{notif.title}</p>
                          <p className="text-muted-foreground mt-0.5 leading-relaxed">{notif.body}</p>
                          <p className="text-[10px] text-muted-foreground mt-1 font-mono">
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
                          className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition cursor-pointer"
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

      {/* DANH SÁCH CA CHẠY TRONG NGÀY (KHI CÓ NHIỀU HƠN 1 CHUYẾN) */}
      {!isLoading && trips.length > 1 && (
        <section className="rounded-2xl border border-border bg-card p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Calendar size={13} className="text-emerald-600 dark:text-emerald-400" />
              Tất Cả Ca Chạy Hôm Nay ({trips.length} chuyến)
            </span>
            <span className="text-[11px] text-muted-foreground">Bấm chọn để chuyển ca</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {trips.map((t) => {
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
                            setManifestCount(mRes.data.totalPassengers || mRes.data.manifest?.length || 0)
                          }
                        })
                        .catch(() => {})
                    }
                  }}
                  className={cn(
                    'rounded-xl border p-2.5 text-left transition-all cursor-pointer',
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                      : 'border-border bg-background hover:border-border/80 hover:bg-muted/40'
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-xs font-bold text-foreground">{depTime}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase',
                        isRunning
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          : t.status === 'completed'
                          ? 'bg-gray-500/20 text-gray-600 dark:text-gray-300'
                          : 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                      )}
                    >
                      {isRunning ? 'Đang chạy' : t.status === 'completed' ? 'Xong' : 'Sẵn sàng'}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-foreground truncate mt-1">
                    {t.route?.routeCode || 'Tuyến'} - {t.route?.name || t.route?.destination || 'Lộ trình'}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    Xe: {(t.vehicle as any)?.licensePlate || t.vehicle?.plateNumber || 'Chưa gán'}
                  </p>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Trường hợp chưa có chuyến xe được phân công */}
      {!isLoading && !activeTrip ? (
        <div className="rounded-3xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-8 text-center space-y-3">
          <AlertCircle size={36} className="mx-auto text-amber-600" />
          <h3 className="text-base font-black text-amber-950 dark:text-amber-200">
            Chưa Có Ca Chạy Nào Được Phân Quyền Hôm Nay
          </h3>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80 max-w-md mx-auto">
            Hệ thống chưa tìm thấy chuyến xe nào gán cho tài khoản của bạn hôm nay. Khi Quản trị viên
            tạo tuyến mới và chỉ định bạn phụ trách, các ca chạy sẽ lập tức xuất hiện tại đây.
          </p>
          <button
            type="button"
            onClick={loadTrips}
            className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-500 cursor-pointer transition-all"
          >
            Kiểm tra lại
          </button>
        </div>
      ) : (
        <>
          {/* Thẻ chuyến xe chính (Live Connected Card) */}
          <article className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0A131C] via-[#0B2226] to-[#04332B] p-5 text-white shadow-xl shadow-emerald-900/20 sm:p-6">
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-16 size-56 rounded-full bg-emerald-400/15 blur-3xl"
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                  <Bus size={14} strokeWidth={1.75} aria-hidden="true" />
                  {vehicleLicensePlate}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[11px] font-bold text-blue-300 uppercase tracking-wide">
                  {activeTrip?.status === 'in_progress'
                    ? 'Đang chạy'
                    : activeTrip?.status === 'delayed'
                      ? 'Chậm chuyến'
                      : 'Đã sẵn sàng'}
                </span>
              </div>
              <span className="font-mono text-xs text-white/50">
                {activeTrip?.route?.routeCode || 'CT-01'}
              </span>
            </div>

            <h2 className="relative mt-4 text-balance text-xl font-bold leading-snug sm:text-2xl">
              {activeTrip?.route?.name ||
                `${activeTrip?.route?.origin || 'ICTU'} ↔ ${activeTrip?.route?.destination || 'Bến xe TT'}`}
            </h2>

            <div className="relative mt-5 flex items-end justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs text-white/55">
                  <Timer size={14} strokeWidth={1.75} aria-hidden="true" />
                  {activeTrip?.status === 'in_progress' ? 'Thời gian ca chạy' : 'Khởi hành sau'}
                </p>
                <DepartureCountdown departureTime={activeTrip?.departureTime} />
              </div>
              <div className="text-right">
                <p className="text-xs text-white/55">Giờ xuất bến</p>
                <p className="text-2xl font-bold">{departureTimeString}</p>
              </div>
            </div>

            <div className="relative mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onNavigate('scanner')}
                className="flex min-h-14 sm:min-h-16 flex-col items-center justify-center gap-1 rounded-2xl py-3 text-xs sm:flex-row sm:gap-2 sm:text-sm bg-emerald-500 px-4 font-bold text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-400 active:scale-[0.97] cursor-pointer"
              >
                <QrCode size={18} strokeWidth={1.75} aria-hidden="true" />
                <span>Mở Camera Soát Vé</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('manifest')}
                className="flex min-h-14 sm:min-h-16 flex-col items-center justify-center gap-1 rounded-2xl py-3 text-xs sm:flex-row sm:gap-2 sm:text-sm border border-white/15 bg-white/[0.06] px-4 font-bold text-white transition-all hover:bg-white/10 active:scale-[0.97] cursor-pointer"
              >
                <Armchair size={18} strokeWidth={1.75} aria-hidden="true" />
                <span>Sĩ số: {manifestCount}/28 Khách</span>
              </button>
            </div>

            {/* Liên kết mở ứng dụng Mobile Scanner riêng */}
            <div className="relative mt-3 flex justify-end">
              <Link
                href="/mobile/scanner"
                target="_blank"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:text-white transition-colors cursor-pointer"
              >
                <Smartphone size={13} />
                <span>Mở Giao Diện Mobile App Riêng</span>
              </Link>
            </div>
          </article>

          {/* Lộ trình trạm đón (Live Route Progression) */}
          <section
            className="rounded-2xl border border-border bg-card p-5"
            aria-labelledby="stops-heading"
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                id="stops-heading"
                className="flex items-center gap-2 text-base font-semibold text-foreground"
              >
                <MapPin
                  size={18}
                  strokeWidth={1.75}
                  className="text-emerald-500"
                  aria-hidden="true"
                />
                Lộ trình trạm đón thực tế
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                {routeStops.length} trạm dừng
              </span>
            </div>
            <ol className="mt-2">
              {routeStops.map((stop, index) => {
                const isLast = index === routeStops.length - 1
                const current = stop.state === 'current'
                return (
                  <li
                    key={`${stop.name}-${index}`}
                    className="relative flex gap-4 pb-5 last:pb-0"
                  >
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        className="absolute left-[7px] top-4 h-full w-0.5 bg-border"
                      />
                    )}
                    <span
                      className={cn(
                        'relative mt-1 size-4 shrink-0 rounded-full border-2',
                        current
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-border bg-card',
                      )}
                    >
                      {current && (
                        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/40" />
                      )}
                    </span>
                    <div className="flex flex-1 items-baseline justify-between gap-3">
                      <div className="flex flex-col">
                        <p
                          className={cn(
                            'text-sm',
                            current
                              ? 'font-semibold text-foreground'
                              : 'text-muted-foreground',
                          )}
                        >
                          {stop.name}
                        </p>
                        {current && (
                          <span className="mt-1 w-fit rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            Trạm hiện tại (Đang đón khách)
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">
                        {stop.time}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        </>
      )}
    </div>
  )
}
