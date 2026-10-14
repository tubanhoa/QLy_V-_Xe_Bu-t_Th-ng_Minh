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
  ChevronDown,
  ChevronUp,
  RotateCcw,
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
  Crosshair,
  Square,
  Power,
} from 'lucide-react'
import { driverHardware } from '@/lib/utils/driver-hardware'
import { driverService, DriverTripItem, ManifestPassenger } from '@/lib/services/driver.service'
import { trackingService } from '@/lib/services/tracking.service'
import {
  fetchRoadGeometry,
  DEFAULT_THAI_NGUYEN_STOPS,
  calculateDistanceMeters,
  calculateBearing,
  StationLocation,
} from '@/lib/utils/map-routing'
import type { IncidentType, LiveTrackingResponse, StationEtaItem, SimulatorStatus } from '@/lib/types/tracking'

interface DriverCockpitProps {
  onSwitchToOfficeView?: () => void
}

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
  const [selectedPassenger, setSelectedPassenger] = useState<ManifestPassenger | null>(null)
  const [isStopCardMinimized, setIsStopCardMinimized] = useState(false)

  // 7. Trạng thái Báo sự cố SOS & Điểm danh
  const [selectedIncidentType, setSelectedIncidentType] = useState<IncidentType>('traffic_jam')
  const [delayMinutes, setDelayMinutes] = useState(15)
  const [incidentDescription, setIncidentDescription] = useState('')
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false)
  const [incidentSuccessNotice, setIncidentSuccessNotice] = useState<string | null>(null)
  const [manifestNotice, setManifestNotice] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Sĩ số hành khách & Sức chứa ca chạy
  const checkedInCount = useMemo(() => {
    return manifestList.filter((m) => m.status === 'checked_in' || !!m.checkedInAt).length
  }, [manifestList])
  const totalBooked = manifestList.length
  const totalCapacity = activeTrip?.vehicle?.capacity || 28



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

  // Điểm danh vé thủ công bằng ID vé / mã ghế (Chuyển xanh lá tức thì)
  const handleQuickCheckIn = useCallback(async (ticketId: string) => {
    if (!activeTrip?.id) return
    driverHardware.playCue('ticketSuccess')
    // Cập nhật giao diện tức thì sang màu xanh lá (Optimistic UI)
    setManifestList((prev) =>
      prev.map((item) =>
        item.ticketId === ticketId || item.ticketCode === ticketId
          ? { ...item, status: 'checked_in', checkedInAt: new Date().toISOString() }
          : item
      )
    )
    setSelectedPassenger((prev) =>
      prev && (prev.ticketId === ticketId || prev.ticketCode === ticketId)
        ? { ...prev, status: 'checked_in', checkedInAt: new Date().toISOString() }
        : prev
    )

    const res = await driverService.quickCheckInTicket(activeTrip.id, ticketId)
    if (res.success) {
      setManifestNotice({ text: res.message || 'Đã điểm danh hành khách lên xe!', type: 'success' })
      loadManifest()
    } else {
      setManifestNotice({ text: res.message || 'Không thể điểm danh vé này', type: 'error' })
      loadManifest()
    }
    setTimeout(() => setManifestNotice(null), 3500)
  }, [activeTrip?.id, loadManifest])

  // Hoàn tác điểm danh (nếu ấn nhầm)
  const handleUndoCheckIn = useCallback(async (ticketId: string) => {
    if (!activeTrip?.id) return
    driverHardware.playCue('tap')
    // Cập nhật giao diện hoàn tác tức thì
    setManifestList((prev) =>
      prev.map((item) =>
        item.ticketId === ticketId || item.ticketCode === ticketId
          ? { ...item, status: 'booked', checkedInAt: null }
          : item
      )
    )
    setSelectedPassenger((prev) =>
      prev && (prev.ticketId === ticketId || prev.ticketCode === ticketId)
        ? { ...prev, status: 'booked', checkedInAt: null }
        : prev
    )

    const res = await driverService.undoCheckInTicket(activeTrip.id, ticketId)
    if (res.success) {
      setManifestNotice({ text: res.message || 'Đã hoàn tác điểm danh!', type: 'info' })
      loadManifest()
    } else {
      setManifestNotice({ text: res.message || 'Không thể hoàn tác điểm danh', type: 'error' })
      loadManifest()
    }
    setTimeout(() => setManifestNotice(null), 3500)
  }, [activeTrip?.id, loadManifest])

  // Leaflet refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const leafletModuleRef = useRef<typeof import('leaflet') | null>(null)
  const busMarkerRef = useRef<any>(null)
  const routePolylineRef = useRef<any>(null)
  const glowPolylineRef = useRef<any>(null)
  const stationMarkersRef = useRef<any[]>([])
  const sseRef = useRef<EventSource | null>(null)
  const geoWatchRef = useRef<number | null>(null)

  // Real-time Telemetry states
  const [telemetry, setTelemetry] = useState<LiveTrackingResponse | null>(null)
  const [simStatus, setSimStatus] = useState<SimulatorStatus | null>(null)
  const [isDeviceGpsActive, setIsDeviceGpsActive] = useState<boolean>(false)
  const [followBus, setFollowBus] = useState<boolean>(true)
  const [tickIntervalMs, setTickIntervalMs] = useState<number>(1000)
  const [currentHeading, setCurrentHeading] = useState<number>(0)
  const [sseActive, setSseActive] = useState<boolean>(false)

  // Trích xuất trạm dừng thực tế từ chuyến xe phân công
  const stops = useMemo<StationLocation[]>(() => {
    const rawStations =
      (activeTrip?.route as any)?.routeStations ||
      activeTrip?.route?.stations ||
      []

    if (Array.isArray(rawStations) && rawStations.length > 0) {
      const sorted = [...rawStations].sort(
        (a: any, b: any) => (a.stopOrder || 0) - (b.stopOrder || 0),
      )
      const list: StationLocation[] = []
      sorted.forEach((rs: any, idx: number) => {
        const st = rs.station || rs
        const lat = Number(st.latitude || st.lat)
        const lng = Number(st.longitude || st.lng)
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
          const etaItem = telemetry?.stationEtas?.find(
            (e: StationEtaItem) => e.stationId === st.id || e.stationName === st.name,
          )
          list.push({
            id: st.id || `st-${idx + 1}`,
            name: st.name || `Trạm ${idx + 1}`,
            shortName: st.shortName || st.name?.slice(0, 18),
            order: rs.stopOrder || idx + 1,
            lat,
            lng,
            etaMinutes: etaItem?.etaMinutes,
            isPassed: etaItem ? etaItem.status === 'passed' : idx < currentStopIndex,
            isNext: etaItem ? etaItem.isNextStop : idx === currentStopIndex,
          })
        }
      })
      if (list.length > 0) return list
    }

    return DEFAULT_THAI_NGUYEN_STOPS.map((st, idx) => ({
      ...st,
      isPassed: idx < currentStopIndex,
      isNext: idx === currentStopIndex,
    }))
  }, [activeTrip, telemetry, currentStopIndex])

  // 1. Lắng nghe luồng SSE Real-time từ chuyến xe
  useEffect(() => {
    if (!activeTrip?.id) return

    if (sseRef.current) {
      sseRef.current.close()
      sseRef.current = null
      setSseActive(false)
    }

    // Nạp telemetry và simulator status ban đầu
    trackingService.getLiveTrackingWithEta(activeTrip.id).then((res) => {
      if (res.success && res.data) {
        setTelemetry(res.data)
        if (res.data.speedKmh != null) setSpeedKmh(res.data.speedKmh)
        if (res.data.headingDegrees != null) setCurrentHeading(res.data.headingDegrees)
      }
    })
    trackingService.getSimulatorStatus(activeTrip.id).then((res) => {
      if (res.success && res.data) {
        setSimStatus(res.data)
      }
    })

    try {
      const es = trackingService.createTrackingEventSource(activeTrip.id)
      sseRef.current = es
      es.onopen = () => setSseActive(true)
      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)
          if (parsed?.data) {
            const update = parsed.data
            setTelemetry((prev) => {
              const base: LiveTrackingResponse = prev || {
                tripId: activeTrip.id,
                latitude: Number(update.latitude ?? stops[0]?.lat ?? 21.585284),
                longitude: Number(update.longitude ?? stops[0]?.lng ?? 105.807361),
                speedKmh: Number(update.speedKmh ?? 30),
                headingDegrees: Number(update.headingDegrees ?? 0),
                batteryPercent: 95,
                lastUpdated: new Date().toISOString(),
                stationEtas: [],
              }
              return {
                ...base,
                ...update,
                tripId: update.tripId || activeTrip.id,
                latitude: Number(update.latitude ?? base.latitude),
                longitude: Number(update.longitude ?? base.longitude),
                speedKmh: Number(update.speedKmh ?? base.speedKmh),
                headingDegrees: Number(update.headingDegrees ?? base.headingDegrees),
                batteryPercent: Number(update.batteryPercent ?? base.batteryPercent),
                lastUpdated: update.lastUpdated || new Date().toISOString(),
                stationEtas: update.stationEtas ?? base.stationEtas,
              }
            })
            if (update.speedKmh != null) setSpeedKmh(update.speedKmh)
            if (update.headingDegrees != null) setCurrentHeading(update.headingDegrees)
            if (update.tickIntervalMs != null) setTickIntervalMs(update.tickIntervalMs)
          }
        } catch {
          // ignore
        }
      }
      es.onerror = () => setSseActive(false)
    } catch {
      setSseActive(false)
    }

    return () => {
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
      setSseActive(false)
    }
  }, [activeTrip?.id, stops])

  // 2. Định vị GPS Thiết Bị (Device Geolocation Watcher)
  useEffect(() => {
    if (!isDeviceGpsActive || !activeTrip?.id) {
      if (geoWatchRef.current != null && typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(geoWatchRef.current)
        geoWatchRef.current = null
      }
      return
    }

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      geoWatchRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          const speed = position.coords.speed ? Math.round(position.coords.speed * 3.6) : 32
          const heading = position.coords.heading ?? 0

          setSpeedKmh(speed)
          setCurrentHeading(heading)
          setTelemetry((prev) => {
            const base: LiveTrackingResponse = prev || {
              tripId: activeTrip.id,
              latitude: lat,
              longitude: lng,
              speedKmh: speed,
              headingDegrees: heading,
              batteryPercent: 95,
              lastUpdated: new Date().toISOString(),
              stationEtas: [],
            }
            return {
              ...base,
              tripId: activeTrip.id,
              latitude: lat,
              longitude: lng,
              speedKmh: speed,
              headingDegrees: heading,
              lastUpdated: new Date().toISOString(),
            }
          })

          driverService.broadcastLocation({
            tripId: activeTrip.id,
            latitude: lat,
            longitude: lng,
            speedKmh: speed,
            headingDegrees: heading,
          })
        },
        (error) => {
          console.warn('[DriverCockpit] Geolocation error:', error)
          setIsDeviceGpsActive(false)
          setAudioNotice('Không thể truy cập GPS thiết bị')
          setTimeout(() => setAudioNotice(null), 3000)
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 },
      )
    }

    return () => {
      if (geoWatchRef.current != null && typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(geoWatchRef.current)
        geoWatchRef.current = null
      }
    }
  }, [isDeviceGpsActive, activeTrip?.id])

  // 3. Khởi tạo Bản đồ Leaflet (SSR-Safe)
  useEffect(() => {
    let isMounted = true

    async function initLeaflet() {
      if (!mapContainerRef.current || mapInstanceRef.current) return
      const L = await import('leaflet')
      if (!isMounted || !mapContainerRef.current) return
      leafletModuleRef.current = L

      const centerLat = stops[0]?.lat || 21.585284
      const centerLng = stops[0]?.lng || 105.807361

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: 15,
        zoomControl: false,
      })

      const tileUrl = isDayMode
        ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png'

      const tileLayer = L.tileLayer(tileUrl, {
        attribution: '&copy; CARTO &copy; OpenStreetMap',
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map)
      tileLayerRef.current = tileLayer

      L.control.zoom({ position: 'bottomright' }).addTo(map)
      mapInstanceRef.current = map
    }

    initLeaflet()

    return () => {
      isMounted = false
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Đổi Tile Layer khi chuyển Day / Night Mode
  useEffect(() => {
    const map = mapInstanceRef.current
    const L = leafletModuleRef.current
    if (!map || !L) return

    if (tileLayerRef.current) {
      tileLayerRef.current.remove()
    }

    const tileUrl = isDayMode
      ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png'

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: '&copy; CARTO &copy; OpenStreetMap',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map)
  }, [isDayMode])

  // 4. Vẽ Lộ trình OSRM Road Geometry & Trạm dừng trên Leaflet
  useEffect(() => {
    const map = mapInstanceRef.current
    const L = leafletModuleRef.current
    if (!map || !L || stops.length === 0) return

    stationMarkersRef.current.forEach((m) => m.remove())
    stationMarkersRef.current = []

    if (routePolylineRef.current) routePolylineRef.current.remove()
    if (glowPolylineRef.current) glowPolylineRef.current.remove()

    let isSubscribed = true

    async function drawRouteAndStations() {
      if (!map || !L) return
      const roadCoords = await fetchRoadGeometry(stops)
      if (!isSubscribed) return

      const glow = L.polyline(roadCoords, {
        color: '#00A86B',
        weight: 9,
        opacity: 0.25,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)
      glowPolylineRef.current = glow

      const poly = L.polyline(roadCoords, {
        color: '#00A86B',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)
      routePolylineRef.current = poly

      // Marker trạm dừng
      stops.forEach((st, idx) => {
        const isCurrent = idx === currentStopIndex
        const isPassed = idx < currentStopIndex
        const bg = isCurrent ? '#00A86B' : isPassed ? '#64748b' : '#0284c7'
        const border = isCurrent ? '#10b981' : '#ffffff'
        const shadow = isCurrent ? '0 0 16px rgba(0, 168, 107, 0.8)' : '0 2px 6px rgba(0,0,0,0.3)'

        const icon = L.divIcon({
          className: 'cockpit-station-pin',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          html: `
            <div style="position: relative; width: 30px; height: 30px; border-radius: 9999px; background: ${bg}; border: 2.5px solid ${border}; display: flex; align-items: center; justify-content: center; box-shadow: ${shadow}; color: white; font-size: 12px; font-weight: 800; font-family: monospace; cursor: pointer;">
              ${st.order}
              ${
                isCurrent
                  ? '<div style="position: absolute; inset: -5px; border-radius: 9999px; border: 2.5px solid #00A86B; animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>'
                  : ''
              }
            </div>
          `,
        })

        const marker = L.marker([st.lat, st.lng], { icon }).addTo(map)
        marker.on('click', () => setCurrentStopIndex(idx))
        stationMarkersRef.current.push(marker)
      })
    }

    drawRouteAndStations()

    return () => {
      isSubscribed = false
    }
  }, [stops, currentStopIndex])

  // 5. Marker Xe Buýt 360 Lướt Mượt Trên Mặt Đường
  useEffect(() => {
    const map = mapInstanceRef.current
    const L = leafletModuleRef.current
    if (!map || !L) return

    const lat = telemetry?.latitude || stops[0]?.lat || 21.585284
    const lng = telemetry?.longitude || stops[0]?.lng || 105.807361
    const heading = currentHeading
    const speed = speedKmh
    const plate = activeTrip?.vehicle?.plateNumber || '20B-009.77'

    const busIcon = L.divIcon({
      className: 'cockpit-bus-glide-marker',
      iconSize: [56, 56],
      iconAnchor: [28, 28],
      html: `
        <div style="position: relative; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; transition: all ${tickIntervalMs}ms linear;">
          <!-- Radar Pulse Ring -->
          <div style="position: absolute; inset: -4px; border-radius: 9999px; background-color: rgba(0, 168, 107, 0.3); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <!-- Heading Arrow -->
          <div style="position: absolute; width: 48px; height: 48px; transform: rotate(${heading}deg); transition: transform ${tickIntervalMs}ms linear; pointer-events: none;">
            <div style="position: absolute; top: -7px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 12px solid #00A86B; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"></div>
          </div>
          <!-- 3D Bus Badge -->
          <div style="position: relative; width: 44px; height: 44px; border-radius: 9999px; background: linear-gradient(135deg, #00A86B 0%, #047857 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 18px rgba(0, 168, 107, 0.55); border: 3px solid #ffffff;">
            <svg style="width: 24px; height: 24px; fill: white;" viewBox="0 0 24 24">
              <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
            </svg>
          </div>
          <!-- Floating Plate & Speed Tag -->
          <div style="position: absolute; top: -22px; left: 50%; transform: translateX(-50%); background: #0f172a; color: #ffffff; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; white-space: nowrap; border: 1px solid rgba(255,255,255,0.25); box-shadow: 0 3px 8px rgba(0,0,0,0.35); font-family: monospace;">
            ${plate} • ${speed} km/h
          </div>
        </div>
      `,
    })

    if (!busMarkerRef.current) {
      const marker = L.marker([lat, lng], { icon: busIcon, zIndexOffset: 1000 }).addTo(map)
      busMarkerRef.current = marker
    } else {
      busMarkerRef.current.setIcon(busIcon)
      busMarkerRef.current.setLatLng([lat, lng])
    }

    if (followBus) {
      map.panTo([lat, lng], { animate: true, duration: tickIntervalMs / 1000 })
    }
  }, [telemetry, stops, activeTrip, followBus, tickIntervalMs, speedKmh, currentHeading])

  // Trạm hiện tại và trạm kế tiếp
  const currentStop = stops[currentStopIndex] || stops[0]
  const isFinalStop = currentStopIndex >= stops.length - 1

  // Tính khoảng cách mét thực tế từ vị trí xe đến trạm tiếp theo
  const distanceToNextStop = useMemo(() => {
    if (!currentStop) return 150
    const busLat = telemetry?.latitude || stops[0]?.lat || 21.585284
    const busLng = telemetry?.longitude || stops[0]?.lng || 105.807361
    return calculateDistanceMeters(busLat, busLng, currentStop.lat, currentStop.lng)
  }, [telemetry, currentStop, stops])

  // XỬ LÝ CẬP TRẠM (DING-DONG TRANSIT AUDIO)
  const handleArriveStation = () => {
    driverHardware.playCue('stationArrival')
    setAudioNotice(`Đã cập bến: ${currentStop.name}`)
    setTimeout(() => setAudioNotice(null), 3500)

    if (activeTrip?.id) {
      driverService.broadcastLocation({
        tripId: activeTrip.id,
        latitude: currentStop.lat,
        longitude: currentStop.lng,
        speedKmh: 0,
      })
    }

    if (!isFinalStop) {
      setCurrentStopIndex((prev) => prev + 1)
    }
  }

  // Điều khiển Bật/Tắt Simulator trực tiếp từ Buồng lái
  const handleToggleSimulator = async () => {
    if (!activeTrip?.id) return
    try {
      if (simStatus?.isRunning) {
        await trackingService.stopSimulator(activeTrip.id)
        setSimStatus((prev) => (prev ? { ...prev, isRunning: false } : null))
        setAudioNotice('Đã dừng bộ giả lập tuyến')
      } else {
        await trackingService.startSimulator(activeTrip.id, 2)
        setSimStatus({
          tripId: activeTrip.id,
          isRunning: true,
          speedMultiplier: 2,
          currentStep: 0,
          totalSteps: 100,
          progressPercent: 0,
          tickIntervalMs: 1000,
        })
        setAudioNotice('Đã kích hoạt bộ giả lập GPS OSRM (2x)')
      }
      setTimeout(() => setAudioNotice(null), 3000)
    } catch (err: any) {
      setAudioNotice(err.message || 'Lỗi điều khiển bộ giả lập')
      setTimeout(() => setAudioNotice(null), 3000)
    }
  }

  // Điều khiển Bật/Tắt GPS Thiết Bị
  const handleToggleDeviceGps = () => {
    if (isDeviceGpsActive) {
      setIsDeviceGpsActive(false)
      setAudioNotice('Đã tắt định vị GPS thiết bị')
    } else {
      setIsDeviceGpsActive(true)
      setAudioNotice('Đã bật định vị GPS thời gian thực từ thiết bị')
    }
    setTimeout(() => setAudioNotice(null), 3000)
  }

  // Căn khung toàn tuyến
  const handleFitRoute = () => {
    const map = mapInstanceRef.current
    if (!map || !routePolylineRef.current) return
    try {
      const bounds = routePolylineRef.current.getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
      }
    } catch {
      // ignore
    }
  }

  // Bám theo xe
  const handleCenterBus = () => {
    const map = mapInstanceRef.current
    if (!map) return
    const lat = telemetry?.latitude || stops[0]?.lat || 21.585284
    const lng = telemetry?.longitude || stops[0]?.lng || 105.807361
    map.setView([lat, lng], 16, { animate: true })
    setFollowBus(true)
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
      const passengerName = res.data.passenger || 'Hành khách sinh viên ICTU'
      const seatNo = res.data.seat || 'Ghế tiêu chuẩn'

      setTicketResult({
        status: 'success',
        passenger: passengerName,
        seat: seatNo,
        ticketCode: code,
        message: 'Vé hợp lệ - Đã ghi nhận check-in lên xe thành công!',
        time: nowTime,
      })

      // TỰ ĐỘNG CHUYỂN ĐỔI MÃ MÀU HÀNH KHÁCH SANG MÀU XANH LÁ (EMERALD)
      setManifestList((prev) => {
        const found = prev.some(
          (m) =>
            m.ticketCode.toUpperCase() === code ||
            m.ticketId === code ||
            (m.seatNumber && seatNo && m.seatNumber.toUpperCase() === seatNo.toUpperCase())
        )
        if (found) {
          return prev.map((m) =>
            m.ticketCode.toUpperCase() === code ||
            m.ticketId === code ||
            (m.seatNumber && seatNo && m.seatNumber.toUpperCase() === seatNo.toUpperCase())
              ? { ...m, status: 'checked_in', checkedInAt: new Date().toISOString() }
              : m
          )
        } else {
          return [
            ...prev,
            {
              ticketId: code,
              ticketCode: code,
              seatNumber: seatNo,
              passengerName: passengerName,
              status: 'checked_in',
              checkedInAt: new Date().toISOString(),
            },
          ]
        }
      })

      // Đồng bộ từ máy chủ
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

  return (
    <div
      className={`fixed inset-0 h-dvh w-full overflow-hidden select-none font-sans transition-colors duration-300 ${
        isDayMode
          ? 'bg-slate-100 text-slate-900'
          : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* ========================================================================= */}
      {/* 1. BẢN ĐỒ TOÀN MÀN HÌNH (LEAFLET GPS REAL-TIME TRANSIT MAP)                */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full z-0" />
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
              {activeTrip?.route?.name || 'Tuyến 01: ICTU ↔ Bến xe TT Thái Nguyên'}
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
            <span
              className={`size-2 rounded-full ${sseActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}
              title={sseActive ? 'GPS Trực tuyến SSE' : 'Đang đồng bộ'}
            />
          </div>
        </div>

        {/* Right: Bộ công cụ Telemetry, Bản đồ & Phần cứng */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1.5 shadow-lg border border-slate-200/90 dark:border-slate-800">
          {/* Nút Bật / Tắt Định vị Thiết Bị Thực */}
          <button
            type="button"
            onClick={handleToggleDeviceGps}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              isDeviceGpsActive
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Bật/Tắt truyền vị trí GPS thật từ thiết bị di động / máy tính bảng"
          >
            <Radio size={14} className={isDeviceGpsActive ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">GPS Thiết Bị</span>
          </button>

          {/* Nút Bật / Tắt Simulator Mô Phỏng */}
          <button
            type="button"
            onClick={handleToggleSimulator}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              simStatus?.isRunning
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Bật/Tắt bộ giả lập lộ trình OSRM chạy tự động"
          >
            {simStatus?.isRunning ? <Square size={13} /> : <Play size={13} />}
            <span className="hidden sm:inline">
              {simStatus?.isRunning ? 'Dừng Sim' : 'Chạy Sim'}
            </span>
          </button>

          {/* Nút Bám Theo Xe (Follow Bus) */}
          <button
            type="button"
            onClick={handleCenterBus}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              followBus
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Định vị tâm xe buýt"
          >
            <Crosshair size={16} />
          </button>

          {/* Nút Căn Toàn Tuyến (Fit Route) */}
          <button
            type="button"
            onClick={handleFitRoute}
            className="p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title="Xem toàn bộ tuyến đường"
          >
            <Compass size={16} />
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
      <div className="absolute top-20 sm:top-22 left-4 z-20 w-[calc(100%-2rem)] max-w-md lg:max-w-lg pointer-events-none">
        {isStopCardMinimized ? (
          /* Chế độ thu gọn: Dải thanh mỏng không che khuất lộ trình bản đồ */
          <div className="pointer-events-auto flex items-center justify-between gap-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-2.5 shadow-xl border border-slate-200/90 dark:border-slate-800 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-2 rounded-full bg-emerald-600 animate-ping shrink-0" />
              <div className="truncate">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  Stop {currentStopIndex + 1}/{stops.length}: {currentStop.name}
                </span>
                <span className="text-[11px] font-mono text-slate-500 ml-2">
                  (~{distanceToNextStop}m)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleArriveStation}
                className="h-8 px-2.5 rounded-xl bg-[#005A36] hover:bg-[#00472b] text-white text-[11px] font-black flex items-center gap-1 shadow active:scale-95 cursor-pointer"
              >
                <CheckCheck size={13} />
                <span>Cập trạm 🔔</span>
              </button>
              <button
                type="button"
                onClick={() => setIsStopCardMinimized(false)}
                className="size-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer"
                title="Mở rộng thông tin trạm"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>
        ) : (
          /* Chế độ mở rộng đầy đủ thông tin đón/trả */
          <div className="pointer-events-auto rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-4 sm:p-5 shadow-2xl border border-slate-200/90 dark:border-slate-800 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-2 pb-2">
              <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-600 animate-ping" />
                Trạm Dừng Kế Tiếp (Stop {currentStopIndex + 1}/{stops.length})
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-500">
                  Cách ~{distanceToNextStop}m
                </span>
                <button
                  type="button"
                  onClick={() => setIsStopCardMinimized(true)}
                  className="size-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer"
                  title="Thu gọn thẻ trạm"
                >
                  <ChevronUp size={15} />
                </button>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight leading-snug">
              {currentStop.name}
            </h2>

            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-slate-700 dark:text-slate-300">
                <Clock size={14} className="text-amber-600" />
                <span>Dự kiến tới: ~1.5 phút</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1">
                <CheckCircle2 size={14} />
                <span>
                  {currentStop.etaMinutes != null
                    ? `Dự kiến: ~${currentStop.etaMinutes} phút`
                    : `Trạm số ${currentStop.order} trên lộ trình`}
                </span>
              </div>
            </div>

            {/* NÚT CỰC ĐẠI: XÁC NHẬN CẬP TRẠM (1 CHẠM PHÁT CHUÔNG DING-DONG) */}
            <button
              type="button"
              onClick={handleArriveStation}
              className="mt-3.5 flex w-full h-14 sm:h-15 items-center justify-center gap-3 rounded-2xl bg-[#005A36] hover:bg-[#00472b] active:scale-[0.98] text-white shadow-xl shadow-emerald-950/20 font-black text-base sm:text-lg transition-all cursor-pointer"
            >
              <CheckCheck className="size-6 stroke-[2.5]" />
              <span>{isFinalStop ? 'XÁC NHẬN VỀ BẾN CUỐI' : 'XÁC NHẬN CẬP TRẠM (PHÁT CHUÔNG)'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Thông báo phản hồi âm thanh dạng Ribbon nổi */}
      {audioNotice && (
        <div className="absolute top-22 right-4 z-30 animate-in fade-in slide-in-from-top-3 flex items-center gap-2.5 rounded-2xl bg-emerald-600 text-white px-4 py-3 shadow-xl">
          <Volume2 size={20} className="animate-bounce" />
          <span className="text-xs font-bold">{audioNotice}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DOCK ĐIỀU KHIỂN BÊN HÔNG (SIDE PANEL DRAWER - KHÔNG CHE NÚT XUẤT BẾN)  */}
      {/* ========================================================================= */}
      {activeTab !== 'none' && (
        <aside className="absolute top-0 right-0 bottom-0 z-40 w-full sm:w-[480px] lg:w-[540px] bg-white/98 dark:bg-slate-900/98 backdrop-blur-2xl shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between p-5 animate-in slide-in-from-right duration-250">
          {/* Header Panel */}
          <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {activeTab === 'scanner' && <QrCode className="size-6 text-emerald-600" />}
                {activeTab === 'manifest' && <Armchair className="size-6 text-blue-600" />}
                {activeTab === 'incident' && <Siren className="size-6 text-rose-600 animate-pulse" />}
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white">
                    {activeTab === 'scanner'
                      ? 'Máy Soát Vé QR Cửa Xe'
                      : activeTab === 'manifest'
                      ? 'Sơ Đồ Ghế & Danh Sách Khách'
                      : 'Báo Cáo Sự Cố SOS'}
                  </h3>
                  {activeTab === 'manifest' && (
                    <p className="text-xs font-bold text-slate-500">
                      <span className="text-emerald-600 font-black">{checkedInCount} đã lên</span> · {totalBooked} vé đã đặt · {totalCapacity} chỗ
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('none')}
                className="size-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer"
                title="Đóng bảng thao tác"
              >
                <X size={18} />
              </button>
            </div>

            {/* Thông báo thao tác Manifest (nếu có) */}
            {manifestNotice && (
              <div
                className={`mt-2.5 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
                  manifestNotice.type === 'success'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                    : manifestNotice.type === 'info'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                }`}
              >
                <CheckCircle2 size={15} />
                <span>{manifestNotice.text}</span>
              </div>
            )}
          </div>

          {/* TAB 1: SOÁT VÉ QR (ZERO-SCROLL CAMERA & SCANNER) */}
          {activeTab === 'scanner' && (
            <div className="flex-1 flex flex-col justify-between py-3 overflow-y-auto">
              <div>
                {/* Khung ngắm Camera Soát vé rộng rãi */}
                <div className="relative mx-auto flex aspect-video w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-emerald-500 bg-slate-900 text-white p-6 shadow-inner">
                  <ScanLine className="size-14 text-emerald-400 animate-pulse mb-2" />
                  <p className="text-xs font-bold text-emerald-300">
                    Đưa mã QR vé sinh viên vào khung ngắm camera
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Hệ thống sẽ tự động check-in và đổi ghế sang XANH LÁ
                  </p>

                  {isVerifyingTicket && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center gap-2 rounded-3xl backdrop-blur-xs">
                      <Loader2 size={24} className="animate-spin text-emerald-400" />
                      <span className="text-xs font-bold text-white">Đang giải mã chữ ký & check-in...</span>
                    </div>
                  )}
                </div>

                {/* Ô nhập mã vé thủ công */}
                <div className="mt-3 flex gap-2">
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
                    className="h-12 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Check-in
                  </button>
                </div>

                {/* Thẻ kết quả quét vé */}
                {ticketResult ? (
                  <div
                    className={`mt-3 rounded-2xl p-4 border shadow-md transition-all ${
                      ticketResult.status === 'success'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 dark:bg-emerald-950/50 dark:border-emerald-700 dark:text-emerald-100 ring-2 ring-emerald-500/20'
                        : ticketResult.status === 'duplicate' || ticketResult.status === 'wrong_trip'
                        ? 'bg-amber-50 border-amber-300 text-amber-950 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-200'
                        : 'bg-rose-50 border-rose-300 text-rose-950 dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {ticketResult.status === 'success' && <CheckCircle2 size={26} className="text-emerald-600 shrink-0 mt-0.5" />}
                      {(ticketResult.status === 'duplicate' || ticketResult.status === 'wrong_trip') && (
                        <AlertTriangle size={26} className="text-amber-600 shrink-0 mt-0.5" />
                      )}
                      {ticketResult.status === 'error' && <ShieldAlert size={26} className="text-rose-600 shrink-0 mt-0.5" />}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-sm">{ticketResult.message}</h4>
                        {ticketResult.passenger && (
                          <div className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                            <span>Khách: <strong className="font-black text-emerald-700 dark:text-emerald-300">{ticketResult.passenger}</strong></span>
                            <span className="mx-2">·</span>
                            <span>Số ghế: <strong className="font-mono font-black text-emerald-700 dark:text-emerald-300">{ticketResult.seat || 'Tiêu chuẩn'}</strong></span>
                          </div>
                        )}
                        {ticketResult.status === 'success' && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('manifest')
                              setManifestSubTab('seatmap')
                            }}
                            className="mt-2.5 h-8 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow active:scale-95 cursor-pointer"
                          >
                            <Armchair size={14} />
                            <span>Xem ghế xanh trên sơ đồ xe →</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2">
                    <span>Mẹo: Quét mã QR từ điện thoại hoặc thẻ sinh viên ICTU</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleVerifyTicket('TXT-ICTU-2025-01002')}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        Thử vé mẫu
                      </button>
                    </div>
                  </div>
                )}
              </div>

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

          {/* TAB 2: MANIFEST & SƠ ĐỒ 28 GHẾ ĐƠN GIẢN CHUẨN XE BUÝT ICTU */}
          {activeTab === 'manifest' && (
            <div className="flex-1 flex flex-col justify-between py-3 overflow-hidden">
              <div>
                {/* Thanh chuyển đổi 2 chế độ: Sơ đồ 28 ghế đơn giản vs Danh sách chi tiết */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-3">
                  <button
                    type="button"
                    onClick={() => setManifestSubTab('seatmap')}
                    className={`h-10 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      manifestSubTab === 'seatmap'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Armchair size={15} />
                    <span>Sơ Đồ 28 Ghế Xe Buýt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManifestSubTab('list')}
                    className={`h-10 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      manifestSubTab === 'list'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Users size={15} />
                    <span>Danh Sách Vé ({manifestList.length})</span>
                  </button>
                </div>
              </div>

              {/* PHÂN HỆ 1: SƠ ĐỒ 28 GHẾ ĐƠN GIẢN (SIMPLE INTUITIVE SEAT MAP) */}
              {manifestSubTab === 'seatmap' && (
                <div className="flex-1 flex flex-col justify-between overflow-hidden">
                  {/* Chú thích màu sắc trực quan theo đúng luồng nghiệp vụ */}
                  <div className="flex items-center justify-around py-2 px-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 mb-2">
                    <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <span className="size-3 rounded-full bg-emerald-600 inline-block shadow-xs" />
                      Đã lên xe ({checkedInCount})
                    </span>
                    <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                      <span className="size-3 rounded-full bg-blue-400 inline-block" />
                      Chờ đón ({Math.max(0, totalBooked - checkedInCount)})
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className="size-3 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />
                      Ghế trống ({Math.max(0, totalCapacity - totalBooked)})
                    </span>
                  </div>

                  {/* Sơ đồ cấu trúc 28 ghế dạng xe buýt đơn giản (7 hàng x 4 ghế) */}
                  <div className="flex-1 overflow-y-auto pr-1">
                    {/* Chỉ báo đầu xe & Cửa lên xuống */}
                    <div className="text-center py-1.5 mb-2 bg-slate-200/80 dark:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 rounded-lg flex items-center justify-center gap-2">
                      <Bus size={13} />
                      <span>Khoang Lái & Cửa Lên Xuống (Đầu Xe)</span>
                    </div>

                    <div className="space-y-1.5">
                      {SEAT_ROWS_28.map((row) => (
                        <div key={row.row} className="flex items-center gap-2">
                          {/* Cặp ghế bên trái: A & B */}
                          <div className="grid grid-cols-2 gap-1.5 flex-1">
                            {row.left.map((seatCode) => {
                              const ticket = manifestList.find(
                                (m) => (m.seatNumber || '').trim().toUpperCase() === seatCode.toUpperCase()
                              )
                              const isChecked = ticket ? (ticket.status === 'checked_in' || !!ticket.checkedInAt) : false
                              const isSelected = selectedPassenger && ticket && (selectedPassenger.ticketId === ticket.ticketId || selectedPassenger.ticketCode === ticket.ticketCode)

                              if (ticket) {
                                return (
                                  <button
                                    key={seatCode}
                                    type="button"
                                    onClick={() => setSelectedPassenger(ticket)}
                                    className={`h-11 rounded-xl border flex flex-col items-center justify-center p-1 transition-all active:scale-95 cursor-pointer ${
                                      isChecked
                                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm ring-2 ring-emerald-400/40'
                                        : 'bg-blue-50 dark:bg-blue-950/70 border-blue-400 dark:border-blue-600 text-blue-950 dark:text-blue-100 hover:bg-blue-100'
                                    } ${isSelected ? 'scale-105 ring-2 ring-amber-400' : ''}`}
                                  >
                                    <div className="flex items-center gap-1 font-mono font-black text-xs leading-none">
                                      {isChecked && <Check size={11} strokeWidth={3} />}
                                      <span>{seatCode}</span>
                                    </div>
                                    <span className="text-[9px] font-bold truncate max-w-full px-0.5 mt-0.5 opacity-90">
                                      {ticket.passengerName ? ticket.passengerName.split(' ').slice(-1)[0] : isChecked ? 'Đã lên' : 'Chờ lên'}
                                    </span>
                                  </button>
                                )
                              }

                              return (
                                <div
                                  key={seatCode}
                                  className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 flex flex-col items-center justify-center p-1"
                                >
                                  <span className="font-mono text-[11px] font-bold">{seatCode}</span>
                                  <span className="text-[8px] font-medium opacity-60">Trống</span>
                                </div>
                              )
                            })}
                          </div>

                          {/* Lối đi ở giữa có số hàng */}
                          <div className="w-6 flex items-center justify-center">
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              {row.label}
                            </span>
                          </div>

                          {/* Cặp ghế bên phải: C & D */}
                          <div className="grid grid-cols-2 gap-1.5 flex-1">
                            {row.right.map((seatCode) => {
                              const ticket = manifestList.find(
                                (m) => (m.seatNumber || '').trim().toUpperCase() === seatCode.toUpperCase()
                              )
                              const isChecked = ticket ? (ticket.status === 'checked_in' || !!ticket.checkedInAt) : false
                              const isSelected = selectedPassenger && ticket && (selectedPassenger.ticketId === ticket.ticketId || selectedPassenger.ticketCode === ticket.ticketCode)

                              if (ticket) {
                                return (
                                  <button
                                    key={seatCode}
                                    type="button"
                                    onClick={() => setSelectedPassenger(ticket)}
                                    className={`h-11 rounded-xl border flex flex-col items-center justify-center p-1 transition-all active:scale-95 cursor-pointer ${
                                      isChecked
                                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm ring-2 ring-emerald-400/40'
                                        : 'bg-blue-50 dark:bg-blue-950/70 border-blue-400 dark:border-blue-600 text-blue-950 dark:text-blue-100 hover:bg-blue-100'
                                    } ${isSelected ? 'scale-105 ring-2 ring-amber-400' : ''}`}
                                  >
                                    <div className="flex items-center gap-1 font-mono font-black text-xs leading-none">
                                      {isChecked && <Check size={11} strokeWidth={3} />}
                                      <span>{seatCode}</span>
                                    </div>
                                    <span className="text-[9px] font-bold truncate max-w-full px-0.5 mt-0.5 opacity-90">
                                      {ticket.passengerName ? ticket.passengerName.split(' ').slice(-1)[0] : isChecked ? 'Đã lên' : 'Chờ lên'}
                                    </span>
                                  </button>
                                )
                              }

                              return (
                                <div
                                  key={seatCode}
                                  className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 flex flex-col items-center justify-center p-1"
                                >
                                  <span className="font-mono text-[11px] font-bold">{seatCode}</span>
                                  <span className="text-[8px] font-medium opacity-60">Trống</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* THẺ THAO TÁC NHANH KHI CHỌN GHẾ */}
                  {selectedPassenger ? (
                    <div className="mt-2.5 p-3 rounded-2xl bg-white dark:bg-slate-800 border-2 border-emerald-500 shadow-xl animate-in fade-in">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              Ghế {selectedPassenger.seatNumber}
                            </span>
                            <span className="font-black text-sm text-slate-900 dark:text-white">
                              {selectedPassenger.passengerName || 'Khách Sinh Viên'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Mã vé: {selectedPassenger.ticketCode}
                          </p>
                        </div>
                        <span
                          className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                            selectedPassenger.status === 'checked_in' || !!selectedPassenger.checkedInAt
                              ? 'bg-emerald-500 text-white'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
                          }`}
                        >
                          {selectedPassenger.status === 'checked_in' || !!selectedPassenger.checkedInAt ? '✓ Đã lên xe' : 'Chờ lên'}
                        </span>
                      </div>

                      {selectedPassenger.status === 'checked_in' || !!selectedPassenger.checkedInAt ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                            <CheckCircle2 size={16} /> Đã chuyển sang màu Xanh Lá
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUndoCheckIn(selectedPassenger.ticketId || selectedPassenger.ticketCode)}
                            className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                          >
                            Hoàn tác
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQuickCheckIn(selectedPassenger.ticketId || selectedPassenger.ticketCode)}
                          className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 cursor-pointer"
                        >
                          <CheckCircle2 size={16} />
                          <span>XÁC NHẬN LÊN XE (ĐỔI SANG XANH LÁ)</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-center text-xs text-slate-400 py-1">
                      Chạm vào ghế để xem thông tin hoặc điểm danh trực tiếp
                    </div>
                  )}
                </div>
              )}

              {/* PHÂN HỆ 2: DANH SÁCH VÉ CHI TIẾT (PASSENGER LIST TOUCH TARGETS) */}
              {manifestSubTab === 'list' && (
                <div className="flex-1 flex flex-col justify-between overflow-hidden">
                  {/* Ô tìm kiếm nhanh */}
                  <div className="relative mb-2">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên SV, số ghế, SĐT, mã vé..."
                      value={manifestSearch}
                      onChange={(e) => setManifestSearch(e.target.value)}
                      className="h-10 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-3 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  {/* Danh sách thẻ hành khách thoải mái, không co giãn dị thường */}
                  <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                    {isLoadingManifest ? (
                      <div className="flex items-center justify-center py-12 text-xs text-slate-500 gap-2">
                        <Loader2 size={18} className="animate-spin text-blue-600" />
                        <span>Đang tải dữ liệu hành khách...</span>
                      </div>
                    ) : filteredManifest.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-xs text-slate-400">
                        <p>Không tìm thấy hành khách phù hợp.</p>
                      </div>
                    ) : (
                      filteredManifest.map((m) => {
                        const isChecked = m.status === 'checked_in' || !!m.checkedInAt
                        return (
                          <div
                            key={m.ticketId || m.ticketCode}
                            className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                              isChecked
                                ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 ring-1 ring-emerald-400/30'
                                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                            }`}
                          >
                            {/* Khối huy hiệu Ghế to bản */}
                            <div
                              className={`size-11 rounded-xl flex flex-col items-center justify-center font-mono font-black text-xs shrink-0 ${
                                isChecked
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700'
                              }`}
                            >
                              <span>{m.seatNumber || 'Ghế'}</span>
                              {isChecked && <Check size={11} strokeWidth={3} className="mt-0.5" />}
                            </div>

                            {/* Thông tin khách hàng rõ ràng */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-sm text-slate-900 dark:text-white truncate">
                                  {m.passengerName || 'Khách Sinh Viên'}
                                </span>
                                <span
                                  className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                                    isChecked
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
                                  }`}
                                >
                                  {isChecked ? 'Đã lên xe' : 'Chờ đón'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                                <span>{m.ticketCode}</span>
                                {m.passengerPhone && (
                                  <span className="flex items-center gap-1">
                                    <Phone size={11} /> {m.passengerPhone}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Nút tác vụ 1 chạm */}
                            <div className="shrink-0">
                              {isChecked ? (
                                <button
                                  type="button"
                                  onClick={() => handleUndoCheckIn(m.ticketId || m.ticketCode)}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                                  title="Hoàn tác điểm danh"
                                >
                                  Hoàn tác
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleQuickCheckIn(m.ticketId || m.ticketCode)}
                                  className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs shadow-md shadow-emerald-900/20 flex items-center gap-1 transition-all cursor-pointer"
                                >
                                  <Check size={14} strokeWidth={2.5} />
                                  <span>Lên xe</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Nút đóng panel */}
              <button
                type="button"
                onClick={() => setActiveTab('none')}
                className="mt-3 h-12 w-full rounded-2xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
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
      <footer className="absolute bottom-4 left-4 right-4 z-30 flex items-center justify-between gap-3 pointer-events-none">
        {/* Nhóm phím bấm điều khiển xúc giác to bản - Bố trí bên trái & giữa, không bị che bởi Drawer */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* NÚT 1: ĐIỀU KHIỂN VÒNG ĐỜI CA CHẠY (XUẤT BẾN / HOÀN THÀNH) */}
          <button
            type="button"
            onClick={handleToggleTripLifecycle}
            className={`flex items-center gap-2.5 px-5 sm:px-6 h-14 sm:h-16 rounded-2xl font-black text-xs sm:text-sm shadow-xl border active:scale-95 transition-all cursor-pointer ${
              activeTrip?.status === 'in_progress'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-600/30'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 shadow-amber-500/30'
            }`}
          >
            <Play size={18} fill="currentColor" />
            <div className="text-left">
              <div>
                {activeTrip?.status === 'scheduled'
                  ? 'BẮT ĐẦU XUẤT BẾN'
                  : activeTrip?.status === 'in_progress'
                  ? 'VỀ BẾN / HOÀN THÀNH'
                  : 'CHẠY LƯỢT TIẾP'}
              </div>
              <div className="text-[10px] font-semibold opacity-80 hidden sm:block">
                {activeTrip?.status === 'in_progress' ? 'Đang chạy trên tuyến' : 'Nhấn để bắt đầu ca'}
              </div>
            </div>
          </button>

          {/* Nút 2: SOÁT VÉ QR */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'scanner' ? 'none' : 'scanner')}
            className={`flex items-center gap-2.5 px-4 sm:px-5 h-14 sm:h-16 rounded-2xl text-xs sm:text-sm font-black shadow-xl transition-all active:scale-95 cursor-pointer border ${
              activeTab === 'scanner'
                ? 'bg-emerald-600 text-white border-emerald-400 scale-105'
                : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-800 hover:border-emerald-500'
            }`}
          >
            <QrCode size={20} className={activeTab === 'scanner' ? 'text-white' : 'text-emerald-600'} />
            <div className="text-left">
              <div>SOÁT VÉ QR</div>
              <div className="text-[10px] font-semibold text-slate-500 hidden sm:block">Quét vé điện tử</div>
            </div>
          </button>

          {/* Nút 3: HÀNH KHÁCH & SƠ ĐỒ GHẾ */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'manifest' ? 'none' : 'manifest')}
            className={`flex items-center gap-2.5 px-4 sm:px-5 h-14 sm:h-16 rounded-2xl text-xs sm:text-sm font-black shadow-xl transition-all active:scale-95 cursor-pointer border ${
              activeTab === 'manifest'
                ? 'bg-blue-600 text-white border-blue-400 scale-105'
                : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-800 hover:border-blue-500'
            }`}
          >
            <Armchair size={20} className={activeTab === 'manifest' ? 'text-white' : 'text-blue-600'} />
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span>HÀNH KHÁCH: {checkedInCount}/{totalBooked} ĐÃ LÊN</span>
                {checkedInCount > 0 && (
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>
              <div className="text-[10px] font-semibold text-slate-500 hidden sm:block">
                {totalBooked} vé đặt · Sức chứa {totalCapacity} chỗ
              </div>
            </div>
          </button>

          {/* Nút 4: BÁO SỰ CỐ SOS KHẨN CẤP */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'incident' ? 'none' : 'incident')}
            className={`flex items-center gap-2.5 px-4 sm:px-5 h-14 sm:h-16 rounded-2xl text-xs sm:text-sm font-black shadow-xl transition-all active:scale-95 cursor-pointer border ${
              activeTab === 'incident'
                ? 'bg-rose-600 text-white border-rose-400 scale-105'
                : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-900 hover:border-rose-500'
            }`}
          >
            <Siren size={20} className="animate-pulse" />
            <div className="text-left">
              <div>BÁO SỰ CỐ SOS</div>
              <div className="text-[10px] font-semibold text-rose-600/80 dark:text-rose-400/80 hidden sm:block">
                Ùn tắc, hỏng xe
              </div>
            </div>
          </button>
        </div>
      </footer>
    </div>
  )
}
