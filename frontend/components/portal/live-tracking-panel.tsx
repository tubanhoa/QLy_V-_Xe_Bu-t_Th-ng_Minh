'use client'

/**
 * Panel Theo Dõi Xe Buýt Realtime, Tính Toán ETA Trạm & Bộ Giả Lập Simulator
 * Thiết kế giao diện Light Theme chuẩn nhận diện thương hiệu ICTU Transit (#005A36)
 * Trải nghiệm chuẩn ứng dụng công nghệ Mobile-First (Grab / XanhSM):
 *  - Bản đồ Hero đặt ngay vị trí trung tâm tầm nhìn của người dùng
 *  - Thẻ thông tin hành trình Bottom Sheet đếm ngược ETA nổi bật
 *  - Băng chuyền chọn trạm đón nhanh (Quick Station Chips Carousel)
 *  - Hàng nút thao tác nhanh chuẩn công nghệ (Chuông báo, Định vị tôi, Chia sẻ, Làm mới)
 *  - Chuông âm thanh & Rung thông minh (Transit Chime & Haptic Alert) khi xe tới
 *  - Chỉ báo Mức độ đông đúc & Ghế trống (Bus Occupancy Realtime)
 * 
 * Domain: Tracking & ETA
 * Branch: feature/SBTS-frontend-realtime-tracking-and-eta
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  MapPin,
  Gauge,
  Navigation,
  Battery,
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Radio,
  Wifi,
  Sparkles,
  Bus,
  User,
  Locate,
  Check,
  Bell,
  BellOff,
  Share2,
  Armchair,
  Volume2,
  VolumeX,
  ChevronRight,
  Sliders,
  AlertCircle,
  Zap,
} from 'lucide-react'
import { useBusTracking, ConnectionMode } from '@/hooks/use-bus-tracking'
import { haptic } from '@/lib/utils/haptics'
import { LiveBusMap } from './live-bus-map'
import { StationEtaTimeline } from './station-eta-timeline'
import { SimulatorControlWidget } from './simulator-control-widget'
import {
  INCIDENT_SEVERITY_COLOR,
  INCIDENT_SEVERITY_LABEL,
  INCIDENT_TYPE_LABEL,
} from '@/lib/types/tracking'

interface LiveTrackingPanelProps {
  tripId: string
  tripName?: string
  pickupStation?: string
}

export function LiveTrackingPanel({
  tripId,
  tripName,
  pickupStation,
}: LiveTrackingPanelProps) {
  const {
    location,
    stationEtas,
    stationAlert,
    incidents,
    activePendingIncident,
    resolvedNotice,
    clearResolvedNotice,
    simulatorStatus,
    connectionMode,
    isConnected,
    isLoading,
    lastUpdated,
    clearStationAlert,
    refreshData,
    startSimulator,
    stopSimulator,
    isSimulating,
  } = useBusTracking(tripId)

  const [refreshing, setRefreshing] = useState(false)
  const [selectedPickup, setSelectedPickup] = useState<string>(
    pickupStation || 'Trạm ĐH CNTT & TT Thái Nguyên (ICTU)',
  )
  const [userDeviceLocation, setUserDeviceLocation] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [locationToast, setLocationToast] = useState<string | null>(null)
  const [chimeEnabled, setChimeEnabled] = useState<boolean>(true)
  const [isSharing, setIsSharing] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'timeline' | 'simulator' | 'incidents'>('timeline')
  const [showResolvedBanner, setShowResolvedBanner] = useState(false)
  const resolvedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (resolvedNotice) {
      setShowResolvedBanner(true)
      if (resolvedTimerRef.current) clearTimeout(resolvedTimerRef.current)
      resolvedTimerRef.current = setTimeout(() => {
        setShowResolvedBanner(false)
        clearResolvedNotice()
      }, 5000)
    }
    return () => {
      if (resolvedTimerRef.current) clearTimeout(resolvedTimerRef.current)
    }
  }, [resolvedNotice, clearResolvedNotice])

  const lastChimedStationRef = useRef<string | null>(null)

  const handleRefresh = async () => {
    setRefreshing(true)
    haptic.play('tap')
    try {
      await refreshData()
    } finally {
      setRefreshing(false)
    }
  }

  // Định vị GPS HTML5 thiết bị của hành khách (chuẩn Grab / XanhSM)
  const handleLocateMe = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationToast('Trình duyệt không hỗ trợ Geolocation.')
      setTimeout(() => setLocationToast(null), 3500)
      return
    }

    setIsLocating(true)
    haptic.play('tap')

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserDeviceLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        })
        setIsLocating(false)
        haptic.play('success')
        setLocationToast('Đã định vị thành công vị trí của bạn tại TP. Thái Nguyên!')
        setTimeout(() => setLocationToast(null), 3500)
      },
      (err) => {
        console.warn('Geolocation warning, fallback to ICTU campus:', err)
        setUserDeviceLocation({
          latitude: 21.585284,
          longitude: 105.806297,
        })
        setIsLocating(false)
        haptic.play('select')
        setLocationToast('Đã nhận diện vị trí gần bạn: Khuôn viên ĐH CNTT & TT Thái Nguyên')
        setTimeout(() => setLocationToast(null), 3500)
      },
      { timeout: 8000, enableHighAccuracy: true },
    )
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

  const timeSince = (date: Date | null) => {
    if (!date) return 'Chưa cập nhật'
    const secs = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000))
    if (secs < 60) return `${secs}s trước`
    return `${Math.round(secs / 60)} phút trước`
  }

  // Tọa độ hiện tại xe buýt tại TP Thái Nguyên
  const lat = location?.latitude ?? 21.585284
  const lng = location?.longitude ?? 105.807361
  const speed = Math.round(location?.speedKmh ?? 32)
  const heading = Math.round(location?.headingDegrees ?? 45)
  const battery = location?.batteryPercent ?? 98

  // Tìm thông tin trạm đón của người dùng
  const userPickupItem = useMemo(() => {
    if (stationEtas.length === 0) return null
    return (
      stationEtas.find(
        (s) =>
          s.stationName.toLowerCase().includes(selectedPickup.toLowerCase()) ||
          selectedPickup.toLowerCase().includes(s.stationName.toLowerCase()),
      ) ||
      stationEtas.find((s) => s.isNextStop) ||
      stationEtas[0]
    )
  }, [selectedPickup, stationEtas])

  // CHUÔNG BÁO VÀ RUNG PHẢN HỒI KHI XE TIẾN VÀO BÁN KÍNH <= 500M ĐIỂM ĐÓN
  useEffect(() => {
    if (!userPickupItem || !chimeEnabled) return
    const dist = userPickupItem.distanceMeters

    if (dist > 0 && dist <= 500 && lastChimedStationRef.current !== userPickupItem.stationId) {
      lastChimedStationRef.current = userPickupItem.stationId
      haptic.play('busArrival')

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ictu:station-alert', {
            detail: {
              tripId,
              stationId: userPickupItem.stationId,
              stationName: userPickupItem.stationName,
              distanceMeters: Math.round(dist),
              etaMinutes: userPickupItem.etaMinutes,
              type: 'pickup',
              message: `Xe buýt đang tiến vào trạm ${userPickupItem.stationName} (còn ~${Math.round(dist)}m)! Quý khách vui lòng chuẩn bị ra điểm đón.`,
            },
          }),
        )

        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('SmartBus ICTU Transit', {
              body: `🚌 Xe buýt 20B-012.34 đang tiến vào trạm ${userPickupItem.stationName} (${Math.round(dist)}m)! Quý khách vui lòng chuẩn bị ra điểm đón.`,
            })
          } catch {
            // ignore
          }
        }
      }
    }
  }, [userPickupItem, chimeEnabled, tripId])

  // CHIA SẺ CHUYẾN ĐI (LIVE TRIP SHARING)
  const handleShareTrip = async () => {
    setIsSharing(true)
    haptic.play('tap')

    const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
    const shareText = `🚌 Theo dõi xe buýt điện ICTU Transit (20B-012.34) trên chuyến ${tripName || tripId}.\n📍 Điểm đón: ${userPickupItem?.stationName || selectedPickup}\n⏱️ Khoảng cách: ${userPickupItem ? userPickupItem.distanceMeters + 'm' : 'ít phút'}\n👉 Xem trực tiếp vị trí xe:`

    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: 'Định Vị Xe Buýt Realtime | ICTU Transit',
          text: shareText,
          url: currentUrl,
        })
        setIsSharing(false)
        return
      } catch {
        // user cancelled or share failed
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${currentUrl}`)
        haptic.play('copy')
        setLocationToast('Đã sao chép liên kết chia sẻ lộ trình xe buýt thành công!')
        setTimeout(() => setLocationToast(null), 3500)
      } catch {
        setLocationToast('Không thể sao chép liên kết.')
        setTimeout(() => setLocationToast(null), 3500)
      }
    }
    setIsSharing(false)
  }

  // Mức độ đông đúc trên xe (28 chỗ ngồi xe buýt điện ICTU)
  const totalSeats = 28
  const availableSeats = 18

  // Badge protocol mạng
  const renderConnectionBadge = (mode: ConnectionMode) => {
    switch (mode) {
      case 'websocket':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-[#005A36] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border border-emerald-300">
            <span className="size-1.5 rounded-full bg-[#005A36] animate-ping" />
            Live &lt;5ms
          </span>
        )
      case 'sse':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border border-blue-300">
            <span className="size-1.5 rounded-full bg-blue-600 animate-pulse" />
            SSE Stream
          </span>
        )
      case 'polling':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-amber-300">
            <Wifi size={10} />
            Polling (5s)
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-bold border border-slate-300">
            Kết nối lại...
          </span>
        )
    }
  }

  const currentPendingIncident =
    activePendingIncident ||
    incidents.find(
      (i) =>
        i.resolutionStatus === 'pending' ||
        (!i.resolvedAt && i.resolutionStatus !== 'resolved'),
    ) ||
    null

  const activeIncidents = incidents.filter(
    (i) =>
      i.resolutionStatus === 'pending' ||
      (!i.resolvedAt && i.resolutionStatus !== 'resolved'),
  )

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Toast thông báo nổi */}
      {locationToast && (
        <div className="rounded-2xl bg-[#005A36] text-white p-3 text-xs font-bold shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Check size={16} />
            <span>{locationToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setLocationToast(null)}
            className="text-white/80 hover:text-white cursor-pointer px-1 touch-press"
          >
            ✕
          </button>
        </div>
      )}

      {/* CẢNH BÁO SỰ CỐ THỜI GIAN THỰC (HERO INCIDENT BANNER) */}
      {currentPendingIncident && (
        <div
          id="hero-incident-banner"
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-amber-500/70 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/20 p-4 sm:p-5 backdrop-blur-xl shadow-lg shadow-amber-500/10 animate-in fade-in slide-in-from-top-2 text-amber-950"
        >
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="size-11 sm:size-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-md animate-pulse">
              <AlertTriangle size={24} className="stroke-[2.5]" />
            </div>

            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs">
                  <span className="size-1.5 rounded-full bg-white animate-ping" />
                  ⚠️ TRỄ CHUYẾN / SỰ CỐ
                </span>

                {currentPendingIncident.delayMinutesEstimate != null && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                    <Clock size={11} />
                    Chậm ~{currentPendingIncident.delayMinutesEstimate} phút
                  </span>
                )}

                <span className="text-[10px] text-slate-500 font-medium">
                  Báo cáo: {formatTime(currentPendingIncident.reportedAt)}
                </span>
              </div>

              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                ⚠️ Chuyến xe đang bị chậm {currentPendingIncident.delayMinutesEstimate ? `~${currentPendingIncident.delayMinutesEstimate} phút` : ''} do {INCIDENT_TYPE_LABEL[currentPendingIncident.incidentType || currentPendingIncident.type] || currentPendingIncident.type}
              </h3>

              {currentPendingIncident.description && (
                <p className="text-xs text-slate-700 bg-white/80 rounded-xl p-2.5 border border-amber-200/70 font-medium leading-relaxed">
                  &ldquo;{currentPendingIncident.description}&rdquo;
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BANNER THÔNG BÁO GIẢI TỎA SỰ CỐ (TỰ TẮT SAU 5 GIÂY) */}
      {showResolvedBanner && !currentPendingIncident && (
        <div
          id="hero-incident-resolved-banner"
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-emerald-500/50 bg-emerald-500/10 p-4 sm:p-5 text-emerald-950 backdrop-blur-xl shadow-md animate-in fade-in slide-in-from-top-2 transition-opacity duration-700"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="size-11 sm:size-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <CheckCircle2 size={24} className="stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-emerald-950">
                ✅ Sự cố đã giải tỏa: Xe buýt đang tiếp tục lộ trình bình thường
              </h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                {resolvedNotice?.resolutionNotes ||
                  'Đoạn đường đã thông thoáng, chuyến xe tiếp tục đón trả khách bình thường.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 1. HERO MAP (BẢN ĐỒ TƯƠNG TÁC CHIẾM TRỌN TẦM MẮT NGƯỜI DÙNG) */}
      <LiveBusMap
        location={location}
        stationEtas={stationEtas}
        tripName={tripName}
        isSimulating={isSimulating}
        pickupStationName={selectedPickup}
        userDeviceLocation={userDeviceLocation}
        onLocateMe={handleLocateMe}
        onSelectPickupStation={(name) => {
          setSelectedPickup(name)
          haptic.play('select')
        }}
      />

      {/* 2. GRAB/XANHSM STYLE BOTTOM SHEET RIDE CARD */}
      <div className="rounded-2xl sm:rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-white via-emerald-50/20 to-slate-50 p-3.5 sm:p-5 shadow-sm space-y-3.5">
        {/* Drag handle pill */}
        <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto -mt-1" />

        {/* Hàng 1: ETA Lớn & Thông tin chuyến xe đón bạn */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="size-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Bus size={22} className="drop-shadow-xs" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 bg-blue-100 border border-blue-200 px-2 py-0.2 rounded-md">
                  Điểm Đón Của Bạn
                </span>
                <span className="text-[10px] font-mono text-slate-500 font-semibold">
                  Tuyến 01 TP. Thái Nguyên
                </span>
                {currentPendingIncident && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.2 rounded-md animate-pulse">
                    TRỄ CHUYẾN / SỰ CỐ
                  </span>
                )}
              </div>
              <h4 className="font-extrabold text-sm sm:text-base text-slate-900 mt-1 truncate">
                {userPickupItem?.stationName || selectedPickup}
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Xe <strong className="text-slate-900 font-mono font-bold">20B-012.34</strong> đang cách bạn:{' '}
                <strong className="text-[#005A36] font-mono font-extrabold text-sm">
                  {userPickupItem
                    ? userPickupItem.distanceMeters > 1000
                      ? `${(userPickupItem.distanceMeters / 1000).toFixed(1)} km`
                      : `${userPickupItem.distanceMeters} m`
                    : '450 m'}
                </strong>
              </p>
            </div>
          </div>

          {/* Khung Countdown ETA nổi bật kiểu Grab/XanhSM */}
          <div className="bg-gradient-to-br from-[#005A36] to-[#004529] text-white rounded-2xl px-3.5 py-2 text-right shadow-md shrink-0 border border-emerald-400/30">
            <span className="text-[9px] uppercase font-black tracking-wider text-emerald-200 block">
              Dự kiến đến
            </span>
            <span className="text-lg sm:text-xl font-black font-mono block leading-tight text-white">
              {userPickupItem?.etaMinutes !== undefined
                ? userPickupItem.etaMinutes <= 1
                  ? '< 1 ph'
                  : `~${userPickupItem.etaMinutes} ph`
                : '--'}
            </span>
            <span className="text-[9px] text-emerald-300 font-medium block mt-0.5">
              {userPickupItem?.distanceMeters && userPickupItem.distanceMeters <= 500
                ? 'Đang tới gần'
                : 'Đang di chuyển'}
            </span>
          </div>
        </div>

        {/* Hàng 2: Băng chuyền chọn trạm đón nhanh (Quick Station Carousel Chips) */}
        {stationEtas.length > 0 && (
          <div className="pt-1">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span className="text-[11px] font-bold text-slate-700">Chọn nhanh điểm đón của bạn:</span>
              <span className="text-[10px] text-slate-400">Vuốt ngang 👉</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {stationEtas.map((st) => {
                const isSelected =
                  userPickupItem?.stationId === st.stationId ||
                  selectedPickup.toLowerCase().includes(st.stationName.toLowerCase())
                return (
                  <button
                    key={st.stationId}
                    type="button"
                    onClick={() => {
                      setSelectedPickup(st.stationName)
                      haptic.play('select')
                    }}
                    className={`shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer touch-press border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin size={11} className={isSelected ? 'text-white' : 'text-blue-500'} />
                    <span className="truncate max-w-[130px]">{st.stationName.replace('Trạm ', '')}</span>
                    <span
                      className={`text-[10px] font-mono px-1 rounded ${
                        isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      ~{st.etaMinutes}p
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Hàng 3: 4 Nút Thao Tác Nhanh Công Nghệ (Chuông, Định vị, Share, Refresh) */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200/70">
          {/* Nút Chuông thông minh */}
          <button
            type="button"
            onClick={() => {
              const next = !chimeEnabled
              setChimeEnabled(next)
              haptic.play('tap')
            }}
            className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer touch-press ${
              chimeEnabled
                ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs'
                : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            {chimeEnabled ? <Volume2 size={16} className="text-amber-600" /> : <VolumeX size={16} />}
            <span className="text-[10px] font-bold">
              {chimeEnabled ? 'Chuông: BẬT' : 'Chuông: TẮT'}
            </span>
          </button>

          {/* Nút Định vị tôi */}
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocating}
            className="py-2 px-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer touch-press shadow-2xs"
          >
            <Locate size={16} className={isLocating ? 'animate-spin text-blue-600' : 'text-blue-600'} />
            <span className="text-[10px] font-bold">Định vị tôi</span>
          </button>

          {/* Nút Chia sẻ chuyến */}
          <button
            type="button"
            onClick={handleShareTrip}
            disabled={isSharing}
            className="py-2 px-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer touch-press shadow-2xs"
          >
            <Share2 size={16} className="text-[#005A36]" />
            <span className="text-[10px] font-bold">Chia sẻ</span>
          </button>

          {/* Nút Làm mới */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || isLoading}
            className="py-2 px-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer touch-press shadow-2xs"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin text-[#005A36]' : 'text-slate-600'} />
            <span className="text-[10px] font-bold">Làm mới</span>
          </button>
        </div>

        {/* Hàng 4: Tình trạng ghế & Vận tốc xe */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[#005A36] font-bold text-[11px]">
              <Armchair size={13} /> {availableSeats}/{totalSeats} ghế trống (Thoáng)
            </span>
          </div>

          <div className="flex items-center gap-3 text-slate-600 font-semibold text-[11px]">
            <span className="flex items-center gap-1">
              <Gauge size={13} /> {speed} km/h
            </span>
            <span>·</span>
            <span className="flex items-center gap-1 text-emerald-600 font-bold">
              <Zap size={13} /> {battery}% Pin
            </span>
          </div>
        </div>
      </div>

      {/* 3. SEGMENTED TABS (LỘ TRÌNH | BỘ MÔ PHỎNG | SỰ CỐ) */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm space-y-3">
        {/* Tab Buttons */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('timeline')
              haptic.play('tap')
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-press ${
              activeTab === 'timeline'
                ? 'bg-white text-[#005A36] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock size={13} />
            <span>Tiến trình trạm ({stationEtas.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('simulator')
              haptic.play('tap')
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-press ${
              activeTab === 'simulator'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles size={13} />
            <span>Mô phỏng demo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('incidents')
              haptic.play('tap')
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-press ${
              activeTab === 'incidents'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle size={13} />
            <span>Sự cố ({activeIncidents.length})</span>
          </button>
        </div>

        {/* Tab Content 1: Station Timeline */}
        {activeTab === 'timeline' && (
          <div className="pt-1 animate-in fade-in duration-200">
            <StationEtaTimeline
              stationEtas={stationEtas}
              stationAlert={stationAlert}
              onDismissAlert={clearStationAlert}
              pickupStationName={selectedPickup}
              onSelectPickupStation={(name) => {
                setSelectedPickup(name)
                haptic.play('select')
              }}
            />
          </div>
        )}

        {/* Tab Content 2: Simulator Controls */}
        {activeTab === 'simulator' && (
          <div className="pt-1 animate-in fade-in duration-200">
            <SimulatorControlWidget
              isSimulating={isSimulating}
              simulatorStatus={simulatorStatus}
              onStart={startSimulator}
              onStop={stopSimulator}
            />
          </div>
        )}

        {/* Tab Content 3: Incidents & Traffic */}
        {activeTab === 'incidents' && (
          <div className="pt-1 space-y-2 animate-in fade-in duration-200">
            {incidents.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 font-medium">
                <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                <span>Lộ trình thông thoáng, xe buýt đang di chuyển đúng lịch trình dự kiến tại TP. Thái Nguyên.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {incidents.map((incident) => {
                  const sevColor = INCIDENT_SEVERITY_COLOR[incident.severity] || INCIDENT_SEVERITY_COLOR['medium']
                  const isPending =
                    incident.resolutionStatus === 'pending' ||
                    (!incident.resolvedAt && incident.resolutionStatus !== 'resolved')

                  return (
                    <div
                      key={incident.id}
                      className={`rounded-2xl border p-3.5 space-y-1.5 text-xs shadow-2xs transition-all ${
                        isPending
                          ? 'border-amber-300 bg-amber-50/40'
                          : 'border-slate-200 bg-white opacity-85'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-900">
                            {INCIDENT_TYPE_LABEL[incident.incidentType || incident.type] || incident.type}
                          </span>
                          {incident.delayMinutesEstimate != null && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              +~{incident.delayMinutesEstimate}p
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sevColor.bg} ${sevColor.text} ${sevColor.border}`}
                          >
                            {INCIDENT_SEVERITY_LABEL[incident.severity] || incident.severity}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              isPending
                                ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {isPending ? 'Đang diễn ra' : 'Đã giải tỏa'}
                          </span>
                        </div>
                      </div>

                      <p className="text-slate-700 text-xs font-medium leading-relaxed">
                        {incident.description}
                      </p>

                      {incident.resolutionNotes && (
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200/80 p-2 text-emerald-900 text-[11px]">
                          <strong>Ghi chú giải tỏa:</strong> {incident.resolutionNotes}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                        <span>Báo cáo: {formatTime(incident.reportedAt)}</span>
                        {incident.resolvedAt && (
                          <span className="text-emerald-700 font-medium">
                            Giải tỏa lúc: {formatTime(incident.resolvedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

