'use client'

/**
 * BUỒNG LÁI TÀI XẾ SỐ KHÔNG THANH CUỘN (CLEAN DAYLIGHT NO-SCROLL BUS DRIVER COCKPIT)
 * Chuẩn công nghệ thiết bị hiển thị buồng lái Mobile Data Terminal (MDT / In-Vehicle Tablet):
 *  - 100% Giao diện màu sáng ban ngày (Clean Daylight Fleet Theme) độ tương phản cao, dễ nhìn ngoài trời
 *  - 100% Single-Surface Zero-Scroll: Bỏ hoàn toàn modal pop-up hẹp và thanh scroll
 *  - Bản đồ toàn màn hình (Full-screen Map): Bản đồ Đô thị TP. Thái Nguyên tương tác + Nút chuyển Google Maps vệ tinh
 *  - Đồng bộ GPS và di chuyển thời gian thực giữa các điểm đón sinh viên ICTU
 *  - Dock điều khiển bên hông (Side Control Panel) mở rộng thoải mái cho Soát vé QR, Manifest và SOS
 *  - Phản hồi xúc giác & âm thanh Web Audio Ding-Dong xe buýt khi cập trạm
 * 
 * Domain: Fleet Operations & In-Vehicle Telematics
 * Branch: feature/SBTS-frontend-incident-management-and-realtime-alerts
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import {
  Bus,
  Clock,
  Compass,
  MapPin,
  QrCode,
  Armchair,
  AlertTriangle,
  Siren,
  Wifi,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  CheckCircle2,
  ArrowRight,
  Play,
  CheckCheck,
  ChevronRight,
  X,
  Volume2,
  VolumeX,
  RefreshCw,
  Phone,
  Search,
  Check,
  Radio,
  Sparkles,
  Layers,
  Locate,
  Navigation,
  Gauge,
  ScanLine,
  Loader2,
  Send,
  ShieldAlert,
  User,
  Users,
} from 'lucide-react'
import { driverHardware } from '@/lib/utils/driver-hardware'
import { driverService, DriverTripItem, ManifestPassenger } from '@/lib/services/driver.service'
import { trackingService } from '@/lib/services/tracking.service'
import type { IncidentType } from '@/lib/types/tracking'

interface DriverCockpitProps {
  onSwitchToOfficeView?: () => void
}

// Tọa độ các trạm dừng chuẩn dọc tuyến 01 TP. Thái Nguyên
interface StationStop {
  order: number
  id: string
  name: string
  shortName: string
  latitude: number
  longitude: number
  svgX: number // Tọa độ X trên bản đồ phẳng
  svgY: number // Tọa độ Y trên bản đồ phẳng
  forecastPickup: number
  forecastDropoff: number
}

const THAI_NGUYEN_STOPS: StationStop[] = [
  {
    order: 1,
    id: 'st-01',
    name: 'ĐH CNTT & TT Thái Nguyên (ICTU)',
    shortName: 'Cổng chính ICTU',
    latitude: 21.585284,
    longitude: 105.807361,
    svgX: 120,
    svgY: 520,
    forecastPickup: 14,
    forecastDropoff: 0,
  },
  {
    order: 2,
    id: 'st-02',
    name: 'Ký túc xá Sinh viên ICTU',
    shortName: 'KTX Sinh viên',
    latitude: 21.587123,
    longitude: 105.803521,
    svgX: 250,
    svgY: 410,
    forecastPickup: 8,
    forecastDropoff: 1,
  },
  {
    order: 3,
    id: 'st-03',
    name: 'Đại học Sư Phạm Thái Nguyên',
    shortName: 'ĐH Sư Phạm',
    latitude: 21.583210,
    longitude: 105.828450,
    svgX: 450,
    svgY: 480,
    forecastPickup: 6,
    forecastDropoff: 3,
  },
  {
    order: 4,
    id: 'st-04',
    name: 'Ngã tư Mỏ Bạch / Bến xe Đồng Quang',
    shortName: 'BX Đồng Quang',
    latitude: 21.586450,
    longitude: 105.836120,
    svgX: 620,
    svgY: 340,
    forecastPickup: 4,
    forecastDropoff: 4,
  },
  {
    order: 5,
    id: 'st-05',
    name: 'Quảng trường Võ Nguyên Giáp',
    shortName: 'Quảng Trường',
    latitude: 21.593250,
    longitude: 105.845100,
    svgX: 780,
    svgY: 260,
    forecastPickup: 3,
    forecastDropoff: 6,
  },
  {
    order: 6,
    id: 'st-06',
    name: 'Bến xe Trung tâm TP. Thái Nguyên',
    shortName: 'Bến xe TT',
    latitude: 21.579620,
    longitude: 105.844350,
    svgX: 920,
    svgY: 180,
    forecastPickup: 0,
    forecastDropoff: 12,
  },
]

/** Sơ đồ cấu trúc 28 ghế tiêu chuẩn xe buýt điện thông minh ICTU (7 hàng x 4 ghế) */
const SEAT_ROWS_28 = [
  { row: 1, label: '01', left: ['01A', '01B'], right: ['01C', '01D'] },
  { row: 2, label: '02', labelDesc: 'Hàng 2', left: ['02A', '02B'], right: ['02C', '02D'] },
  { row: 3, label: '03', labelDesc: 'Hàng 3', left: ['03A', '03B'], right: ['03C', '03D'] },
  { row: 4, label: '04', labelDesc: 'Hàng 4', left: ['04A', '04B'], right: ['04C', '04D'] },
  { row: 5, label: '05', labelDesc: 'Hàng 5', left: ['05A', '05B'], right: ['05C', '05D'] },
  { row: 6, label: '06', labelDesc: 'Hàng 6', left: ['06A', '06B'], right: ['06C', '06D'] },
  { row: 7, label: '07', labelDesc: 'Hàng 7', left: ['07A', '07B'], right: ['07C', '07D'] },
]

type SidePanelTab = 'none' | 'scanner' | 'manifest' | 'incident'

/** Đồng hồ độc lập ngăn toàn bộ buồng lái 1200 dòng re-render mỗi giây */
const CockpitClock = memo(function CockpitClock() {
  const [currentTime, setCurrentTime] = useState('')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <span className="font-mono text-xl font-black text-slate-900 dark:text-white">
      {currentTime}
    </span>
  )
})

export function DriverCockpit({ onSwitchToOfficeView }: DriverCockpitProps) {
  // 1. Data State từ API Backend
  const [trips, setTrips] = useState<DriverTripItem[]>([])
  const [activeTrip, setActiveTrip] = useState<DriverTripItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 2. Chế độ hiển thị & Bản đồ
  const [mapType, setMapType] = useState<'vector' | 'google'>('vector')
  const [isDayMode, setIsDayMode] = useState(true) // Mặc định Giao diện Sáng Ban Ngày theo yêu cầu
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isWakeLocked, setIsWakeLocked] = useState(false)

  // 3. Tiến trình xe & Trạm dừng
  const [currentStopIndex, setCurrentStopIndex] = useState(0)
  const [busProgress, setBusProgress] = useState(0.12) // 0 -> 1 dọc tuyến
  const [speedKmh, setSpeedKmh] = useState(32)
  const [isGpsActive, setIsGpsActive] = useState(true)
  const [audioNotice, setAudioNotice] = useState<string | null>(null)

  // 4. Panel bên hông (Single-Surface Zero-Scroll Drawer)
  const [activeTab, setActiveTab] = useState<SidePanelTab>('none')

  // 5. Trạng thái Soát vé QR
  const [manualCode, setManualCode] = useState('')
  const [isVerifyingTicket, setIsVerifyingTicket] = useState(false)
  const [ticketResult, setTicketResult] = useState<{
    status: 'success' | 'duplicate' | 'error' | 'wrong_trip'
    message: string
    passenger?: string
    seat?: string
    ticketCode?: string
    time?: string
    correctTrip?: {
      routeName?: string
      departureTime?: string
      vehiclePlate?: string
    }
  } | null>(null)

  // 6. Trạng thái Manifest & Sơ đồ ghế
  const [manifestList, setManifestList] = useState<ManifestPassenger[]>([])
  const [manifestSearch, setManifestSearch] = useState('')
  const [isLoadingManifest, setIsLoadingManifest] = useState(false)
  const [manifestSubTab, setManifestSubTab] = useState<'seatmap' | 'list'>('seatmap')
  const [selectedSeatNo, setSelectedSeatNo] = useState<string | null>(null)

  // 7. Trạng thái Báo sự cố SOS & Điểm danh
  const [selectedIncidentType, setSelectedIncidentType] = useState<IncidentType>('traffic_jam')
  const [delayMinutes, setDelayMinutes] = useState(15)
  const [incidentDescription, setIncidentDescription] = useState('')
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false)
  const [incidentSuccessNotice, setIncidentSuccessNotice] = useState<string | null>(null)
  const [manifestNotice, setManifestNotice] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)



  // Tự động giữ màn hình luôn sáng bằng Screen Wake Lock
  useEffect(() => {
    driverHardware.requestWakeLock().then((active) => {
      setIsWakeLocked(active)
    })
    return () => {
      driverHardware.releaseWakeLock()
      driverHardware.stopGpsBroadcasting()
    }
  }, [])

  // Tải thông tin ca chạy từ Backend
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
    } else {
      // Fallback chuyến xe mẫu ICTU
      const fallbackTrip: DriverTripItem = {
        id: '03f4e044-8445-4a37-8841-5526da46b340',
        routeId: '5f8d76d7-717b-4904-ac52-dd64b0a515c0',
        departureTime: '2026-10-04T07:15:00.000Z',
        status: 'in_progress',
        route: {
          id: '5f8d76d7-717b-4904-ac52-dd64b0a515c0',
          routeCode: 'CT-01',
          name: 'ĐH CNTT & TT (ICTU) ↔ Bến Xe TT Thái Nguyên',
          origin: 'ĐH CNTT & TT Thái Nguyên',
          destination: 'Bến xe TT Thái Nguyên',
          durationMinutes: 45,
          distanceKm: 14.5,
        },
        vehicle: {
          id: 'veh-01',
          plateNumber: '20B-009.77',
          model: 'VinFast Bus EV 28 chỗ',
          capacity: 28,
        },
      }
      setTrips([fallbackTrip])
      setActiveTrip(fallbackTrip)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadTrips()
  }, [loadTrips])

  // Tải danh sách Manifest khi mở tab
  const loadManifest = useCallback(async () => {
    if (!activeTrip?.id) return
    setIsLoadingManifest(true)
    const res = await driverService.getTripManifest(activeTrip.id)
    if (res.success && res.data && res.data.manifest) {
      setManifestList(res.data.manifest)
    } else {
      setManifestList([])
    }
    setIsLoadingManifest(false)
  }, [activeTrip?.id])

  useEffect(() => {
    if (activeTab === 'manifest') {
      loadManifest()
    }
  }, [activeTab, loadManifest])

  // Điểm danh vé thủ công bằng ID vé / mã ghế
  const handleQuickCheckIn = useCallback(async (ticketId: string) => {
    if (!activeTrip?.id) return
    const res = await driverService.quickCheckInTicket(activeTrip.id, ticketId)
    if (res.success) {
      setManifestNotice({ text: res.message || 'Đã điểm danh hành khách lên xe!', type: 'success' })
      loadManifest()
    } else {
      setManifestNotice({ text: res.message || 'Không thể điểm danh vé này', type: 'error' })
    }
    setTimeout(() => setManifestNotice(null), 4000)
  }, [activeTrip?.id, loadManifest])

  // Hoàn tác điểm danh (nếu ấn nhầm)
  const handleUndoCheckIn = useCallback(async (ticketId: string) => {
    if (!activeTrip?.id) return
    const res = await driverService.undoCheckInTicket(activeTrip.id, ticketId)
    if (res.success) {
      setManifestNotice({ text: res.message || 'Đã hoàn tác điểm danh!', type: 'info' })
      loadManifest()
    } else {
      setManifestNotice({ text: res.message || 'Không thể hoàn tác điểm danh', type: 'error' })
    }
    setTimeout(() => setManifestNotice(null), 4000)
  }, [activeTrip?.id, loadManifest])

  // Mô phỏng di chuyển xe buýt thời gian thực giữa các trạm dừng
  useEffect(() => {
    if (!isGpsActive) return

    const moveTimer = setInterval(() => {
      setBusProgress((prev) => {
        // Tỷ lệ dừng mục tiêu ứng với trạm hiện tại
        const targetRatio = (currentStopIndex + 0.3) / THAI_NGUYEN_STOPS.length
        if (prev < targetRatio) {
          return Math.min(targetRatio, prev + 0.006)
        }
        return prev
      })

      // Biến thiên tốc độ xe ngẫu nhiên 28 - 42 km/h cho chân thực
      setSpeedKmh(Math.floor(28 + Math.random() * 12))
    }, 1500)

    return () => clearInterval(moveTimer)
  }, [isGpsActive, currentStopIndex])

  // Trạm hiện tại và trạm kế tiếp
  const stops = THAI_NGUYEN_STOPS
  const currentStop = stops[currentStopIndex] || stops[0]
  const isFinalStop = currentStopIndex >= stops.length - 1

  // Tính tọa độ pixel của xe buýt trên bản đồ nội suy
  const busPosition = useMemo(() => {
    const totalSegments = stops.length - 1
    const t = Math.min(0.999, Math.max(0.001, busProgress))
    const scaledT = t * totalSegments
    const segIdx = Math.min(totalSegments - 1, Math.floor(scaledT))
    const segT = scaledT - segIdx

    const p0 = stops[segIdx]
    const p1 = stops[segIdx + 1]

    const x = p0.svgX + (p1.svgX - p0.svgX) * segT
    const y = p0.svgY + (p1.svgY - p0.svgY) * segT

    // Tính góc nghiêng của xe buýt
    const dx = p1.svgX - p0.svgX
    const dy = p1.svgY - p0.svgY
    const angle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI)

    return { x, y, angle }
  }, [busProgress, stops])

  // Khoảng cách ước lượng đến trạm kế tiếp
  const distanceToNextStop = useMemo(() => {
    const nextStop = stops[Math.min(stops.length - 1, currentStopIndex + 1)]
    if (!nextStop) return 120
    const raw = Math.round(350 - (busProgress * 1000) % 300)
    return Math.max(50, raw)
  }, [busProgress, currentStopIndex, stops])

  // XỬ LÝ CẬP TRẠM (DING-DONG TRANSIT AUDIO)
  const handleArriveStation = () => {
    driverHardware.playCue('stationArrival')
    setAudioNotice(`Đã cập bến: ${currentStop.name}`)
    setTimeout(() => setAudioNotice(null), 3500)

    if (!isFinalStop) {
      setCurrentStopIndex((prev) => prev + 1)
    }
  }

  // XỬ LÝ SOÁT VÉ QR TRỰC TIẾP
  const handleVerifyTicket = async (codeToVerify?: string) => {
    const code = (codeToVerify || manualCode).trim().toUpperCase()
    if (!code) return

    setIsVerifyingTicket(true)
    const res = await driverService.verifyQrTicket(code, activeTrip?.id)
    const nowTime = new Date().toLocaleTimeString('vi-VN')

    if (res.success && res.data && res.data.valid) {
      driverHardware.playCue('ticketSuccess')
      setTicketResult({
        status: 'success',
        passenger: res.data.passenger || 'Hành khách sinh viên ICTU',
        seat: res.data.seat || 'Ghế tiêu chuẩn',
        ticketCode: code,
        message: 'Vé hợp lệ - Đã ghi nhận check-in lên xe thành công!',
        time: nowTime,
      })
      // Cập nhật số lượng manifest
      loadManifest()
    } else if (res.data?.alreadyCheckedIn) {
      driverHardware.playCue('ticketDuplicate')
      setTicketResult({
        status: 'duplicate',
        passenger: res.data.passenger || 'Hành khách đã lên',
        ticketCode: code,
        message: 'CẢNH BÁO: Vé này đã được check-in trước đó!',
        time: nowTime,
      })
    } else if (res.data?.isWrongTrip) {
      driverHardware.playCue('ticketInvalid')
      setTicketResult({
        status: 'wrong_trip',
        passenger: res.data.passenger,
        seat: res.data.seat,
        ticketCode: code,
        message: res.data.message || 'CẢNH BÁO: Vé hợp lệ nhưng KHÔNG THUỘC CHUYẾN XE NÀY!',
        time: nowTime,
        correctTrip: res.data.correctTrip,
      })
    } else {
      driverHardware.playCue('ticketInvalid')
      setTicketResult({
        status: 'error',
        ticketCode: code,
        message: res.data?.message || res.message || 'Mã vé không hợp lệ hoặc không tìm thấy!',
        time: nowTime,
      })
    }

    setManualCode('')
    setIsVerifyingTicket(false)
  }

  // XỬ LÝ GỬI BÁO CÁO SỰ CỐ SOS
  const handleSendSosIncident = async () => {
    if (!activeTrip?.id) return
    setIsSubmittingIncident(true)

    try {
      const res = await trackingService.reportIncident({
        tripId: activeTrip.id,
        incidentType: selectedIncidentType,
        description: incidentDescription
          ? `${incidentDescription} (Tại: ${currentStop.name})`
          : `Báo cáo sự cố trên xe ${activeTrip.vehicle?.plateNumber || '20B-009.77'} tại ${currentStop.name}`,
        delayMinutesEstimate: delayMinutes,
        severity: 'medium',
      })

      if (res.success) {
        driverHardware.playCue('tripStart')
        setIncidentSuccessNotice('Đã phát tín hiệu SOS về Trung tâm Điều hành & gửi thông báo tới SV!')
        setIncidentDescription('')
        setTimeout(() => {
          setIncidentSuccessNotice(null)
          setActiveTab('none')
        }, 3000)
      }
    } catch {
      setIncidentSuccessNotice('Lỗi khi gửi sự cố, vui lòng thử lại!')
    } finally {
      setIsSubmittingIncident(false)
    }
  }

  // VÒNG ĐỜI CHUYẾN XE (XUẤT BẾN / VỀ BẾN)
  const handleToggleTripLifecycle = async () => {
    if (!activeTrip) return
    driverHardware.playCue('tap')

    if (activeTrip.status === 'scheduled') {
      const res = await driverService.updateTripStatus(activeTrip.id, 'in_progress')
      if (res.success) {
        setActiveTrip((prev) => (prev ? { ...prev, status: 'in_progress' } : null))
        driverHardware.playCue('tripStart')
        setAudioNotice('Chuyến xe xuất bến thành công!')
        setTimeout(() => setAudioNotice(null), 3000)
      }
    } else if (activeTrip.status === 'in_progress' || activeTrip.status === 'delayed') {
      const res = await driverService.updateTripStatus(activeTrip.id, 'completed')
      if (res.success) {
        setActiveTrip((prev) => (prev ? { ...prev, status: 'completed' } : null))
        driverHardware.playCue('tripEnd')
        setAudioNotice('Chuyến xe đã về bến an toàn!')
        setTimeout(() => setAudioNotice(null), 3000)
      }
    } else {
      setActiveTrip((prev) => (prev ? { ...prev, status: 'in_progress' } : null))
    }
  }

  // Bật/tắt Fullscreen Kiosk
  const handleToggleFullscreen = () => {
    const fs = driverHardware.toggleFullscreen()
    setIsFullscreen(fs)
  }

  // Lọc hành khách manifest
  const filteredManifest = manifestList.filter((m) => {
    const q = manifestSearch.toLowerCase()
    return (
      (m.passengerName || '').toLowerCase().includes(q) ||
      (m.seatNumber || '').toLowerCase().includes(q) ||
      (m.ticketCode || '').toLowerCase().includes(q) ||
      (m.passengerPhone || '').includes(q)
    )
  })

  // URL nhúng Google Maps tập trung tại TP. Thái Nguyên
  const googleMapsUrl = `https://www.google.com/maps?q=${currentStop.latitude},${currentStop.longitude}&z=15&output=embed`

  return (
    <div
      className={`fixed inset-0 h-dvh w-full overflow-hidden select-none font-sans transition-colors duration-300 ${
        isDayMode
          ? 'bg-slate-100 text-slate-900'
          : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* ========================================================================= */}
      {/* 1. BẢN ĐỒ TOÀN MÀN HÌNH (FULLSCREEN THAI NGUYEN TRANSIT MAP CANVAS)        */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {mapType === 'google' ? (
          // Chế độ Bản đồ Vệ tinh / Google Maps nhúng trực tiếp
          <iframe
            title="Bản đồ Google Maps Thành phố Thái Nguyên"
            src={googleMapsUrl}
            className="w-full h-full border-0 pointer-events-auto"
            loading="lazy"
          />
        ) : (
          // Chế độ Bản đồ Đô thị Thái Nguyên (Vector Transit Map) màu sáng cực nét
          <div className="relative w-full h-full bg-[#f1f5f9] overflow-hidden">
            {/* Họa tiết đường phố mạng lưới đô thị Thái Nguyên */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 1000 600"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                {/* Lưới phân khối đô thị nhẹ nhàng */}
                <pattern id="city-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
                </pattern>
                {/* Gradient tuyến xe buýt xanh ICTU */}
                <linearGradient id="bus-route-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#005A36" />
                  <stop offset="50%" stopColor="#059669" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>

              {/* Lớp nền đô thị */}
              <rect width="100%" height="100%" fill="#f8fafc" />
              <rect width="100%" height="100%" fill="url(#city-grid)" />

              {/* Sông Cầu uốn lượn qua TP. Thái Nguyên */}
              <path
                d="M 0 380 C 200 350, 350 280, 500 290 C 650 300, 800 210, 1000 180"
                fill="none"
                stroke="#bae6fd"
                strokeWidth="28"
                strokeLinecap="round"
                opacity="0.6"
              />
              <text x="360" y="270" fill="#0284c7" fontSize="11" fontWeight="bold" opacity="0.6">
                Sông Cầu · TP. Thái Nguyên
              </text>

              {/* Các trục đại lộ chính TP. Thái Nguyên */}
              <path d="M 50 560 L 950 140" stroke="#e2e8f0" strokeWidth="18" strokeLinecap="round" />
              <path d="M 100 80 L 900 550" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
              <path d="M 300 580 L 350 20" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
              <path d="M 700 580 L 720 20" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />

              {/* Tuyến Xe Buýt Tuyến 01 (Lộ trình phát sáng) */}
              <path
                d="M 120 520 L 250 410 L 450 480 L 620 340 L 780 260 L 920 180"
                fill="none"
                stroke="#d1fae5"
                strokeWidth="14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 120 520 L 250 410 L 450 480 L 620 340 L 780 260 L 920 180"
                fill="none"
                stroke="url(#bus-route-gradient)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Điểm mốc các trạm đón sinh viên */}
              {stops.map((stop, idx) => {
                const isPassed = idx < currentStopIndex
                const isCurrent = idx === currentStopIndex
                return (
                  <g
                    key={stop.id}
                    className="cursor-pointer transition-all"
                    onClick={() => setCurrentStopIndex(idx)}
                  >
                    {/* Sóng radar cho trạm hiện tại */}
                    {isCurrent && (
                      <circle
                        cx={stop.svgX}
                        cy={stop.svgY}
                        r="24"
                        fill="#10b981"
                        fillOpacity="0.25"
                        className="animate-ping"
                      />
                    )}

                    {/* Vòng tròn trạm */}
                    <circle
                      cx={stop.svgX}
                      cy={stop.svgY}
                      r={isCurrent ? 14 : 9}
                      fill={isCurrent ? '#005A36' : isPassed ? '#10b981' : '#ffffff'}
                      stroke={isCurrent ? '#ffffff' : '#059669'}
                      strokeWidth={isCurrent ? 3 : 2}
                      className="shadow-md"
                    />

                    {/* Số thứ tự trạm */}
                    <text
                      x={stop.svgX}
                      y={stop.svgY + (isCurrent ? 4 : 3)}
                      textAnchor="middle"
                      fill={isCurrent || isPassed ? '#ffffff' : '#005A36'}
                      fontSize={isCurrent ? '11' : '8'}
                      fontWeight="900"
                    >
                      {stop.order}
                    </text>

                    {/* Tên trạm nổi trên bản đồ */}
                    <rect
                      x={stop.svgX - 55}
                      y={stop.svgY - 32}
                      width="110"
                      height="20"
                      rx="6"
                      fill="#ffffff"
                      stroke={isCurrent ? '#005A36' : '#cbd5e1'}
                      strokeWidth={isCurrent ? 1.5 : 1}
                      filter="drop-shadow(0 2px 4px rgba(0,0,0,0.08))"
                    />
                    <text
                      x={stop.svgX}
                      y={stop.svgY - 18}
                      textAnchor="middle"
                      fill={isCurrent ? '#005A36' : '#334155'}
                      fontSize="9"
                      fontWeight="800"
                    >
                      {stop.shortName}
                    </text>
                  </g>
                )
              })}

              {/* Marker Xe Buýt Di Chuyển Thời Gian Thực */}
              <g
                transform={`translate(${busPosition.x}, ${busPosition.y}) rotate(${busPosition.angle})`}
                className="transition-transform duration-1000 ease-linear"
              >
                {/* Vùng phát đèn pha phía trước xe */}
                <polygon
                  points="0,0 80,-35 80,35"
                  fill="#fef08a"
                  fillOpacity="0.4"
                  className="pointer-events-none"
                />

                {/* Thân xe buýt biểu tượng */}
                <rect
                  x="-20"
                  y="-12"
                  width="40"
                  height="24"
                  rx="6"
                  fill="#005A36"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  filter="drop-shadow(0 4px 6px rgba(0,0,0,0.25))"
                />

                {/* Đèn trước xe */}
                <circle cx="18" cy="-8" r="2.5" fill="#fef08a" />
                <circle cx="18" cy="8" r="2.5" fill="#fef08a" />

                {/* Biển số trên nóc xe */}
                <text
                  x="0"
                  y="3"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="7"
                  fontWeight="900"
                  transform="rotate(0)"
                >
                  20B
                </text>
              </g>
            </svg>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. THANH HUD ĐỈNH NỔI DẠNG KÍNH (TOP FLOATING COCKPIT BAR)               */}
      {/* ========================================================================= */}
      <header className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: Thông tin xe & Tuyến */}
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-2.5 shadow-lg border border-slate-200/90 dark:border-slate-800">
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
            <Bus size={22} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-black tracking-tight text-slate-900 dark:text-white">
                {activeTrip?.vehicle?.plateNumber || '20B - 009.77'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-extrabold uppercase">
                <span className="size-1.5 rounded-full bg-emerald-600 animate-ping" />
                {activeTrip?.status === 'in_progress' ? 'Đang chạy' : activeTrip?.status === 'delayed' ? 'Trễ giờ' : 'Sẵn sàng'}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Tuyến 01: ICTU ↔ Bến xe TT Thái Nguyên
            </p>
          </div>
        </div>

        {/* Center: Đồng hồ điện tử & Tốc độ GPS */}
        <div className="pointer-events-auto hidden md:flex items-center gap-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-5 py-2.5 shadow-lg border border-slate-200/90 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-slate-500" />
            <CockpitClock />
          </div>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-2">
            <Gauge size={16} className="text-emerald-600" />
            <span className="font-mono text-lg font-black text-emerald-700 dark:text-emerald-400">
              {speedKmh} <span className="text-xs font-bold">km/h</span>
            </span>
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" title="GPS Trực tuyến" />
          </div>
        </div>

        {/* Right: Bộ công cụ bản đồ & phần cứng */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1.5 shadow-lg border border-slate-200/90 dark:border-slate-800">
          {/* Nút Chuyển Đổi Bản Đồ Google Maps / Đô Thị */}
          <button
            type="button"
            onClick={() => setMapType(mapType === 'vector' ? 'google' : 'vector')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              mapType === 'google'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Chuyển chế độ xem bản đồ Google Maps / Đô thị Thái Nguyên"
          >
            <Layers size={15} />
            <span>{mapType === 'google' ? 'Google Maps' : 'Bản Đồ Đô Thị'}</span>
          </button>

          {/* Nút Đổi Ban Ngày / Ban Đêm */}
          <button
            type="button"
            onClick={() => setIsDayMode(!isDayMode)}
            className="p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title={isDayMode ? 'Chuyển sang Chế độ Tối' : 'Chuyển sang Chế độ Sáng Ban Ngày'}
          >
            {isDayMode ? <Sun size={17} className="text-amber-500" /> : <Moon size={17} className="text-blue-400" />}
          </button>

          {/* Nút Toàn màn hình */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title="Bật / Tắt Toàn màn hình Kiosk"
          >
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>

          {/* Nút Xem Văn Phòng */}
          {onSwitchToOfficeView && (
            <button
              type="button"
              onClick={onSwitchToOfficeView}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Văn phòng →
            </button>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. THẺ TRẠM DỪNG TIẾP THEO (FLOATING NEXT STOP CARD - TOP LEFT)           */}
      {/* ========================================================================= */}
      <div className="absolute top-22 left-4 z-20 w-[calc(100%-2rem)] max-w-lg pointer-events-none">
        <div className="pointer-events-auto rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-5 shadow-2xl border border-slate-200/90 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2 pb-2">
            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-600 animate-ping" />
              Trạm Dừng Kế Tiếp (Stop {currentStopIndex + 1}/{stops.length})
            </span>
            <span className="text-xs font-mono font-bold text-slate-500">
              Cách ~{distanceToNextStop}m
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tracking-tight leading-snug">
            {currentStop.name}
          </h2>

          <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-1">
              <Clock size={14} className="text-amber-600" />
              <span>Dự kiến tới: ~1.5 phút</span>
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1">
              <CheckCircle2 size={14} />
              <span>Đón: {currentStop.forecastPickup} SV · Xuống: {currentStop.forecastDropoff} SV</span>
            </div>
          </div>

          {/* NÚT CỰC ĐẠI: XÁC NHẬN CẬP TRẠM (1 CHẠM PHÁT CHUÔNG DING-DONG) */}
          <button
            type="button"
            onClick={handleArriveStation}
            className="mt-4 flex w-full h-15 sm:h-16 items-center justify-center gap-3 rounded-2xl bg-[#005A36] hover:bg-[#00472b] active:scale-[0.98] text-white shadow-xl shadow-emerald-950/20 font-black text-base sm:text-lg transition-all cursor-pointer"
          >
            <CheckCheck className="size-6 stroke-[2.5]" />
            <span>{isFinalStop ? 'XÁC NHẬN VỀ BẾN CUỐI' : 'XÁC NHẬN CẬP TRẠM (PHÁT CHUÔNG)'}</span>
          </button>
        </div>
      </div>

      {/* Thông báo phản hồi âm thanh dạng Ribbon nổi */}
      {audioNotice && (
        <div className="absolute top-22 right-4 z-30 animate-in fade-in slide-in-from-top-3 flex items-center gap-2.5 rounded-2xl bg-emerald-600 text-white px-4 py-3 shadow-xl">
          <Volume2 size={20} className="animate-bounce" />
          <span className="text-xs font-bold">{audioNotice}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DOCK ĐIỀU KHIỂN BÊN HÔNG (SIDE PANEL DRAWER - 100% ZERO-SCROLL)         */}
      {/* ========================================================================= */}
      {activeTab !== 'none' && (
        <aside className="absolute top-0 right-0 bottom-0 z-40 w-full sm:w-[460px] lg:w-[520px] bg-white/98 dark:bg-slate-900/98 backdrop-blur-2xl shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between p-5 sm:p-6 animate-in slide-in-from-right duration-250">
          {/* Header Panel */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              {activeTab === 'scanner' && <QrCode className="size-6 text-emerald-600" />}
              {activeTab === 'manifest' && <Armchair className="size-6 text-blue-600" />}
              {activeTab === 'incident' && <Siren className="size-6 text-rose-600 animate-pulse" />}
              <h3 className="text-lg font-black text-slate-950 dark:text-white">
                {activeTab === 'scanner'
                  ? 'Máy Soát Vé QR Cửa Xe'
                  : activeTab === 'manifest'
                  ? 'Sơ Đồ Ghế & Danh Sách Khách'
                  : 'Báo Cáo Sự Cố SOS'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('none')}
              className="size-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* TAB 1: SOÁT VÉ QR (ZERO-SCROLL CAMERA & SCANNER) */}
          {activeTab === 'scanner' && (
            <div className="flex-1 flex flex-col justify-between py-4">
              {/* Khung ngắm Camera Soát vé rộng rãi */}
              <div className="relative mx-auto flex aspect-video w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-emerald-500 bg-slate-900 text-white p-6 shadow-inner">
                <ScanLine className="size-16 text-emerald-400 animate-pulse mb-2" />
                <p className="text-xs font-bold text-emerald-300">
                  Đưa mã QR vé sinh viên vào khung ngắm camera
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Khoảng cách quét tối ưu: 15 – 25 cm
                </p>

                {isVerifyingTicket && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center gap-2 rounded-3xl backdrop-blur-xs">
                    <Loader2 size={24} className="animate-spin text-emerald-400" />
                    <span className="text-xs font-bold text-white">Đang giải mã chữ ký...</span>
                  </div>
                )}
              </div>

              {/* Ô nhập mã vé thủ công */}
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Nhập mã vé hoặc mã sinh viên (VD: TK-01A)..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyTicket()}
                  className="h-12 flex-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleVerifyTicket()}
                  disabled={isVerifyingTicket || !manualCode.trim()}
                  className="h-12 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  Kiểm tra
                </button>
              </div>

              {/* Thẻ kết quả quét vé */}
              {ticketResult ? (
                <div
                  className={`mt-4 rounded-3xl p-4 border shadow-md transition-all ${
                    ticketResult.status === 'success'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-200'
                      : ticketResult.status === 'duplicate' || ticketResult.status === 'wrong_trip'
                      ? 'bg-amber-50 border-amber-300 text-amber-950 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-200'
                      : 'bg-rose-50 border-rose-300 text-rose-950 dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {ticketResult.status === 'success' && <CheckCircle2 size={28} className="text-emerald-600 shrink-0 mt-0.5" />}
                    {(ticketResult.status === 'duplicate' || ticketResult.status === 'wrong_trip') && (
                      <AlertTriangle size={28} className="text-amber-600 shrink-0 mt-0.5" />
                    )}
                    {ticketResult.status === 'error' && <ShieldAlert size={28} className="text-rose-600 shrink-0 mt-0.5" />}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black text-sm">{ticketResult.message}</h4>
                      {ticketResult.passenger && (
                        <p className="text-xs font-bold mt-1 text-slate-700 dark:text-slate-300">
                          Hành khách: {ticketResult.passenger} · Ghế: {ticketResult.seat || 'Tiêu chuẩn'}
                        </p>
                      )}
                      {ticketResult.correctTrip && (
                        <div className="mt-2.5 rounded-xl bg-amber-100/80 dark:bg-amber-900/40 p-2.5 text-xs text-amber-900 dark:text-amber-200 border border-amber-300/50">
                          <p className="font-bold">Hướng dẫn khách sang đúng xe:</p>
                          <p className="mt-0.5">· Tuyến: <span className="font-semibold">{ticketResult.correctTrip.routeName}</span></p>
                          {ticketResult.correctTrip.vehiclePlate && (
                            <p>· Xe: <span className="font-semibold">{ticketResult.correctTrip.vehiclePlate}</span></p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500 pt-2">
                  <span>Mẹo: Quét mã QR từ điện thoại hoặc thẻ vé tháng HSSV</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleVerifyTicket('TK-01A')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Thử vé mẫu
                    </button>
                  </div>
                </div>
              )}

              {/* Nút đóng panel */}
              <button
                type="button"
                onClick={() => setActiveTab('none')}
                className="mt-4 h-12 w-full rounded-2xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
              >
                Hoàn tất & Quay về Buồng lái
              </button>
            </div>
          )}

          {/* TAB 2: MANIFEST HÀNH KHÁCH (2-COLUMN ZERO-SCROLL GRID) */}
          {activeTab === 'manifest' && (
            <div className="flex-1 flex flex-col justify-between py-4">
              <div>
                {/* Thanh tìm kiếm nhanh */}
                <div className="relative mb-3">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên SV, số ghế, SĐT..."
                    value={manifestSearch}
                    onChange={(e) => setManifestSearch(e.target.value)}
                    className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-3 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                  <span>Tổng số vé: {manifestList.length}</span>
                  <span>Sức chứa: {activeTrip?.vehicle?.capacity || 28} chỗ</span>
                </div>
              </div>

              {/* Lưới danh sách ghế ngồi (Không scroll, gói gọn trong panel) */}
              <div className="grid grid-cols-2 gap-2 my-2 flex-1 overflow-hidden">
                {isLoadingManifest ? (
                  <div className="col-span-2 flex items-center justify-center py-10 text-xs text-slate-500 gap-2">
                    <Loader2 size={18} className="animate-spin text-blue-600" />
                    <span>Đang tải danh sách vé...</span>
                  </div>
                ) : filteredManifest.length === 0 ? (
                  <div className="col-span-2 flex flex-col items-center justify-center py-10 text-xs text-slate-400">
                    <p>Chưa có hành khách nào đặt chỗ.</p>
                  </div>
                ) : (
                  filteredManifest.slice(0, 10).map((m) => {
                    const isChecked = m.status === 'checked_in' || !!m.checkedInAt
                    return (
                      <div
                        key={m.ticketId || m.ticketCode}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border text-xs transition-all ${
                          isChecked
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-slate-900 dark:text-white">
                              {m.seatNumber || 'Ghế'}
                            </span>
                            <span className="truncate font-bold text-slate-700 dark:text-slate-300">
                              {m.passengerName || 'Khách SV'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">{m.ticketCode}</span>
                        </div>
                        <span
                          className={`size-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                            isChecked
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                          }`}
                        >
                          {isChecked ? '✓' : '...'}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Nút đóng panel */}
              <button
                type="button"
                onClick={() => setActiveTab('none')}
                className="h-12 w-full rounded-2xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
              >
                Đóng danh sách khách
              </button>
            </div>
          )}

          {/* TAB 3: BÁO CÁO SỰ CỐ KHẨN CẤP (QUICK SOS DISPATCH) */}
          {activeTab === 'incident' && (
            <div className="flex-1 flex flex-col justify-between py-4">
              <div>
                <p className="text-xs text-slate-500 mb-3 font-semibold">
                  Chọn nhanh loại sự cố để báo về Phòng Điều Hành ICTU:
                </p>

                {/* 6 Phím chọn loại sự cố to bản */}
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  {[
                    { id: 'traffic_jam' as IncidentType, label: 'Ùn tắc giao thông', icon: Clock },
                    { id: 'breakdown' as IncidentType, label: 'Hỏng hóc / Nổ lốp', icon: AlertTriangle },
                    { id: 'accident' as IncidentType, label: 'Va chạm giao thông', icon: Siren },
                    { id: 'weather' as IncidentType, label: 'Mưa lớn / Ngập lụt', icon: Radio },
                    { id: 'delay' as IncidentType, label: 'Chờ đón sinh viên', icon: Armchair },
                    { id: 'other' as IncidentType, label: 'Sự cố phát sinh khác', icon: Sparkles },
                  ].map((item) => {
                    const Icon = item.icon
                    const isSelected = selectedIncidentType === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedIncidentType(item.id)}
                        className={`flex items-center gap-2 p-3 rounded-2xl border text-xs font-black transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-700 dark:text-rose-300 shadow-md'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <Icon size={16} className={isSelected ? 'text-rose-600' : 'text-slate-500'} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Chọn số phút trễ dự kiến */}
                <div className="mb-4">
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    Dự kiến trễ thêm:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 15, 30].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDelayMinutes(mins)}
                        className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          delayMinutes === mins
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        +{mins} phút
                      </button>
                    ))}
                  </div>
                </div>

                {incidentSuccessNotice && (
                  <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-400 text-emerald-900 dark:text-emerald-200 text-xs font-bold mb-3">
                    {incidentSuccessNotice}
                  </div>
                )}
              </div>

              {/* Nút gửi SOS khẩn cấp */}
              <button
                type="button"
                onClick={handleSendSosIncident}
                disabled={isSubmittingIncident}
                className="h-14 w-full rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white font-black text-sm shadow-xl shadow-rose-900/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
              >
                {isSubmittingIncident ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                <span>GỬI BÁO CÁO SOS KHẨN CẤP</span>
              </button>
            </div>
          )}
        </aside>
      )}

      {/* ========================================================================= */}
      {/* 5. DOCK ĐIỀU KHIỂN ĐÁY NỔI DẠNG KÍNH (BOTTOM FLOATING ACTION DECK)         */}
      {/* ========================================================================= */}
      <footer className="absolute bottom-4 left-4 right-4 z-30 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Nhóm 3 phím bấm điều khiển xúc giác to bản */}
        <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3">
          {/* Nút 1: SOÁT VÉ QR */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'scanner' ? 'none' : 'scanner')}
            className={`flex items-center gap-2.5 px-4 sm:px-6 h-14 sm:h-16 rounded-2xl text-xs sm:text-sm font-black shadow-xl transition-all active:scale-95 cursor-pointer border ${
              activeTab === 'scanner'
                ? 'bg-emerald-600 text-white border-emerald-400 scale-105'
                : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-800 hover:border-emerald-500'
            }`}
          >
            <QrCode size={20} className="text-emerald-600" />
            <div className="text-left">
              <div>SOÁT VÉ QR</div>
              <div className="text-[10px] font-semibold text-slate-500 hidden sm:block">Camera & Máy quét</div>
            </div>
          </button>

          {/* Nút 2: HÀNH KHÁCH / MANIFEST */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'manifest' ? 'none' : 'manifest')}
            className={`flex items-center gap-2.5 px-4 sm:px-6 h-14 sm:h-16 rounded-2xl text-xs sm:text-sm font-black shadow-xl transition-all active:scale-95 cursor-pointer border ${
              activeTab === 'manifest'
                ? 'bg-blue-600 text-white border-blue-400 scale-105'
                : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-800 hover:border-blue-500'
            }`}
          >
            <Armchair size={20} className="text-blue-600" />
            <div className="text-left">
              <div>HÀNH KHÁCH: {manifestList.filter((m) => m.status === 'checked_in' || !!m.checkedInAt).length}/{activeTrip?.vehicle?.capacity || 28}</div>
              <div className="text-[10px] font-semibold text-slate-500 hidden sm:block">Xem sơ đồ ghế</div>
            </div>
          </button>

          {/* Nút 3: BÁO SỰ CỐ SOS KHẨN CẤP */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'incident' ? 'none' : 'incident')}
            className={`flex items-center gap-2.5 px-4 sm:px-6 h-14 sm:h-16 rounded-2xl text-xs sm:text-sm font-black shadow-xl transition-all active:scale-95 cursor-pointer border ${
              activeTab === 'incident'
                ? 'bg-rose-600 text-white border-rose-400 scale-105'
                : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-900 hover:border-rose-500'
            }`}
          >
            <Siren size={20} className="animate-pulse" />
            <div className="text-left">
              <div>BÁO SỰ CỐ SOS</div>
              <div className="text-[10px] font-semibold text-slate-500 hidden sm:block">Ùn tắc, hỏng xe</div>
            </div>
          </button>
        </div>

        {/* Nút 4: ĐIỀU KHIỂN VÒNG ĐỜI CA CHẠY (XUẤT BẾN / HOÀN THÀNH) */}
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={handleToggleTripLifecycle}
            className="flex items-center gap-2.5 px-6 sm:px-8 h-14 sm:h-16 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 border border-amber-300 transition-all cursor-pointer"
          >
            <Play size={18} fill="currentColor" />
            <span>
              {activeTrip?.status === 'scheduled'
                ? 'BẮT ĐẦU XUẤT BẾN'
                : activeTrip?.status === 'in_progress'
                ? 'VỀ BẾN / KẾT THÚC'
                : 'CHẠY LƯỢT TIẾP'}
            </span>
          </button>
        </div>
      </footer>
    </div>
  )
}
