'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  BatteryCharging,
  Bus,
  MapPin,
  Phone,
  Radio,
  Play,
  Square,
  RefreshCw,
  Gauge,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Compass,
  Crosshair,
  Layers,
  ChevronRight,
  Maximize2,
  Siren,
} from 'lucide-react'
import { tripService, type TripItem } from '@/lib/services/trip.service'
import { transitService } from '@/lib/services/transit.service'
import { trackingService } from '@/lib/services/tracking.service'
import type { TransitRoute } from '@/lib/types/transit'
import type { LiveTrackingResponse, SimulatorStatus, StationEtaItem, TripIncident } from '@/lib/types/tracking'
import { calculateDistanceMeters } from '@/lib/utils/map-routing'

interface StationCoord {
  id: string
  name: string
  order: number
  lat: number
  lng: number
  etaMinutes?: number
  isPassed?: boolean
  isNext?: boolean
}

/**
 * Gọi OSRM Routing API để lấy tọa độ theo mặt đường thực tế (Grab / Be style)
 * Fallback về đường thẳng giữa các trạm nếu OSRM lỗi hoặc offline
 */
async function fetchRoadGeometry(
  stations: Array<{ lat: number; lng: number }>,
): Promise<Array<[number, number]>> {
  if (stations.length < 2) return stations.map((s) => [s.lat, s.lng])

  try {
    const coordsStr = stations.map((s) => `${s.lng.toFixed(6)},${s.lat.toFixed(6)}`).join(';')
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      if (data?.routes?.[0]?.geometry?.coordinates?.length) {
        return data.routes[0].geometry.coordinates.map((pt: [number, number]) => [pt[1], pt[0]])
      }
    }
  } catch {
    // Fallback nối trạm an toàn
  }

  return stations.map((s) => [s.lat, s.lng])
}

export function DispatcherGpsMap() {
  const [trips, setTrips] = useState<TripItem[]>([])
  const [routes, setRoutes] = useState<TransitRoute[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState<string>('all')
  const [selectedTripId, setSelectedTripId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(2)
  const [tickIntervalMs, setTickIntervalMs] = useState<number>(1000)
  const [followBus, setFollowBus] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Real-time telemetry state
  const [telemetry, setTelemetry] = useState<LiveTrackingResponse | null>(null)
  const [simStatus, setSimStatus] = useState<SimulatorStatus | null>(null)
  const [sseActive, setSseActive] = useState<boolean>(false)

  // Leaflet refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const leafletModuleRef = useRef<typeof import('leaflet') | null>(null)
  const busMarkerRef = useRef<any>(null)
  const routePolylineRef = useRef<any>(null)
  const glowPolylineRef = useRef<any>(null)
  const stationMarkersRef = useRef<any[]>([])
  const sseRef = useRef<EventSource | null>(null)

  // 1. Tải danh sách chuyến xe và tuyến đường từ Backend API
  const fetchTripsAndRoutes = useCallback(async () => {
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const [tripsRes, routesRes] = await Promise.all([
        tripService.getTrips({ limit: 50 }),
        transitService.getRoutes(),
      ])

      const fetchedTrips = tripsRes.data?.items || []
      const fetchedRoutes = routesRes.data || []

      setTrips(fetchedTrips)
      setRoutes(fetchedRoutes)

      // Tự động chọn chuyến đầu tiên nếu chưa chọn
      if (fetchedTrips.length > 0 && !selectedTripId) {
        setSelectedTripId(fetchedTrips[0].id)
        if (fetchedTrips[0].routeId) {
          setSelectedRouteId(fetchedTrips[0].routeId)
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi nạp dữ liệu chuyến xe từ máy chủ')
    } finally {
      setIsLoading(false)
    }
  }, [selectedTripId])

  useEffect(() => {
    fetchTripsAndRoutes()
  }, [fetchTripsAndRoutes])

  // Lọc chuyến xe theo tuyến đã chọn
  const filteredTrips = useMemo(() => {
    if (selectedRouteId === 'all') return trips
    return trips.filter((t) => t.routeId === selectedRouteId || t.route?.id === selectedRouteId)
  }, [trips, selectedRouteId])

  // Chuyến xe đang được chọn
  const selectedTrip = useMemo(() => {
    if (selectedTripId) {
      const found = filteredTrips.find((t) => t.id === selectedTripId)
      if (found) return found
    }
    return filteredTrips[0] || trips[0] || null
  }, [filteredTrips, selectedTripId, trips])

  // Đồng bộ lại selectedTripId khi lọc tuyến
  useEffect(() => {
    if (filteredTrips.length > 0) {
      const exists = filteredTrips.some((t) => t.id === selectedTripId)
      if (!exists) {
        setSelectedTripId(filteredTrips[0].id)
      }
    }
  }, [filteredTrips, selectedTripId])

  // Tuyến đường tương ứng với chuyến đang chọn
  const activeRoute = useMemo(() => {
    if (!selectedTrip) return null
    return (
      routes.find((r) => r.id === selectedTrip.routeId) ||
      (selectedTrip.route as any) ||
      null
    )
  }, [selectedTrip, routes])

  // Danh sách các trạm dừng của tuyến hiện tại
  const stationsList = useMemo<StationCoord[]>(() => {
    const raw: StationCoord[] = []
    if (activeRoute?.routeStations && activeRoute.routeStations.length > 0) {
      const sorted = [...activeRoute.routeStations].sort(
        (a, b) => (a.stopOrder || 0) - (b.stopOrder || 0),
      )
      sorted.forEach((rs, idx) => {
        const st = rs.station || (rs as any)
        if (st && st.latitude && st.longitude) {
          const etaItem = telemetry?.stationEtas?.find(
            (e: StationEtaItem) => e.stationId === st.id || e.stationName === st.name,
          )
          raw.push({
            id: st.id || `st-${idx}`,
            name: st.name || `Trạm ${idx + 1}`,
            order: rs.stopOrder || idx + 1,
            lat: Number(st.latitude),
            lng: Number(st.longitude),
            etaMinutes: etaItem?.etaMinutes,
            isPassed: etaItem ? etaItem.status === 'passed' : false,
            isNext: etaItem ? etaItem.isNextStop : idx === 0,
          })
        }
      })
    }

    // Fallback tọa độ thực tế các điểm chính tại TP Thái Nguyên (ICTU -> Bến xe Thái Nguyên)
    if (raw.length === 0) {
      raw.push(
        { id: 'st-1', name: 'ĐH CNTT & TT Thái Nguyên (ICTU)', order: 1, lat: 21.585284, lng: 105.806297 },
        { id: 'st-2', name: 'Cổng KTX ĐH Thái Nguyên', order: 2, lat: 21.590123, lng: 105.815234 },
        { id: 'st-3', name: 'Ngã 3 Mỏ Chè', order: 3, lat: 21.595432, lng: 105.823456 },
        { id: 'st-4', name: 'Bệnh Viện Đa Khoa Trung Ương TN', order: 4, lat: 21.598765, lng: 105.832109 },
        { id: 'st-5', name: 'Bến Xe Trung Tâm Thái Nguyên', order: 5, lat: 21.604321, lng: 105.845678 },
      )
    }

    return raw
  }, [activeRoute, telemetry])

  // Trạm dừng tiếp theo
  const nextApproachingStation = useMemo(() => {
    return stationsList.find((s) => !s.isPassed) || stationsList[stationsList.length - 1]
  }, [stationsList])

  const [activeIncidents, setActiveIncidents] = useState<TripIncident[]>([])

  // 2. Kiểm tra trạng thái Simulator, Telemetry và Sự cố SOS từ tài xế
  const checkTelemetry = useCallback(async (tripId: string) => {
    try {
      const [simRes, liveRes, incRes] = await Promise.all([
        trackingService.getSimulatorStatus(tripId),
        trackingService.getLiveTrackingWithEta(tripId),
        trackingService.getTripIncidents(tripId),
      ])

      if (simRes.success && simRes.data) {
        setSimStatus(simRes.data)
        if (simRes.data.speedMultiplier) {
          setSpeedMultiplier(simRes.data.speedMultiplier)
        }
        if (simRes.data.tickIntervalMs) {
          setTickIntervalMs(simRes.data.tickIntervalMs)
        }
      }
      if (liveRes.success && liveRes.data) {
        setTelemetry(liveRes.data)
      }
      if (incRes.success && Array.isArray(incRes.data)) {
        setActiveIncidents(incRes.data.filter((i) => i.resolutionStatus !== 'resolved'))
      }
    } catch {
      // ignore
    }
  }, [])

  // Xử lý xác nhận/giải tỏa sự cố khẩn cấp
  const handleResolveIncident = async (incidentId: string) => {
    try {
      const res = await trackingService.resolveIncident(incidentId)
      if (res.success) {
        setActiveIncidents((prev) => prev.filter((i) => i.id !== incidentId))
      }
    } catch {
      // ignore
    }
  }

  // 3. Kết nối SSE để nhận tọa độ xe buýt thời gian thực
  useEffect(() => {
    if (!selectedTripId) return

    if (sseRef.current) {
      sseRef.current.close()
      sseRef.current = null
      setSseActive(false)
    }

    checkTelemetry(selectedTripId)

    try {
      const es = trackingService.createTrackingEventSource(selectedTripId)
      sseRef.current = es

      es.onopen = () => setSseActive(true)

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)
          if (parsed?.data) {
            const update = parsed.data
            const busLoc = update.busLocation || {}
            setTelemetry((prev) => ({
              ...prev,
              tripId: update.tripId,
              latitude: busLoc.latitude ?? prev?.latitude ?? 21.585284,
              longitude: busLoc.longitude ?? prev?.longitude ?? 105.806297,
              speedKmh: busLoc.speedKmh ?? prev?.speedKmh ?? 35,
              headingDegrees: busLoc.headingDegrees ?? prev?.headingDegrees ?? 0,
              batteryPercent: busLoc.batteryPercent ?? prev?.batteryPercent ?? 92,
              lastUpdated: busLoc.lastUpdated || new Date().toISOString(),
              isSimulated: busLoc.isSimulated ?? true,
              stationEtas: update.stationEtas || prev?.stationEtas || [],
            }))
          }
        } catch {
          // parse error ignored
        }
      }

      es.onerror = () => setSseActive(false)
    } catch {
      setSseActive(false)
    }

    const timer = setInterval(() => {
      checkTelemetry(selectedTripId)
    }, 2500)

    return () => {
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
      clearInterval(timer)
      setSseActive(false)
    }
  }, [selectedTripId, checkTelemetry])

  // 4. Khởi tạo Leaflet Map (SSR-Safe)
  useEffect(() => {
    let isMounted = true

    async function initLeaflet() {
      if (!mapContainerRef.current || mapInstanceRef.current) return

      const L = await import('leaflet')
      if (!isMounted || !mapContainerRef.current) return
      leafletModuleRef.current = L

      // Khởi tạo bản đồ lấy tâm tại TP Thái Nguyên
      const map = L.map(mapContainerRef.current, {
        center: [21.585284, 105.806297],
        zoom: 14,
        zoomControl: false,
      })

      // Layer OpenStreetMap chuẩn, miễn phí 100%, không cần API Key, địa danh tiếng Việt chuẩn xác
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        subdomains: 'abc',
      }).addTo(map)

      // Zoom control góc trên bên phải
      L.control.zoom({ position: 'topright' }).addTo(map)

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

  // 5. Cập nhật Lộ trình đường bộ OSRM và Trạm dừng trên bản đồ Leaflet
  useEffect(() => {
    const map = mapInstanceRef.current
    const L = leafletModuleRef.current
    if (!map || !L || stationsList.length === 0) return

    // Xóa các marker trạm dừng cũ
    stationMarkersRef.current.forEach((m) => m.remove())
    stationMarkersRef.current = []

    // Xóa polyline cũ
    if (routePolylineRef.current) routePolylineRef.current.remove()
    if (glowPolylineRef.current) glowPolylineRef.current.remove()

    let isSubscribed = true

    async function renderRoadAndStations() {
      if (!map || !L) return

      // Lấy tọa độ đường bộ thực tế (OSRM Road Routing)
      const roadCoords = await fetchRoadGeometry(stationsList)
      if (!isSubscribed) return

      // Vẽ vệt sáng glow đường chạy
      const glow = L.polyline(roadCoords, {
        color: '#00A86B',
        weight: 9,
        opacity: 0.22,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)
      glowPolylineRef.current = glow

      // Vẽ đường lộ trình chính
      const poly = L.polyline(roadCoords, {
        color: '#00A86B',
        weight: 4.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)
      routePolylineRef.current = poly

      // Căn khung nhìn bao quát toàn bộ lộ trình
      try {
        const bounds = poly.getBounds()
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
        }
      } catch {
        // ignore
      }

      // Tạo marker cho từng trạm dừng
      stationsList.forEach((st) => {
        const bg = st.isPassed ? '#64748b' : st.isNext ? '#00A86B' : '#0284c7'
        const border = st.isNext ? '#10b981' : '#ffffff'
        const shadow = st.isNext ? '0 0 14px rgba(0, 168, 107, 0.8)' : '0 2px 6px rgba(0,0,0,0.3)'

        const stationIcon = L.divIcon({
          className: 'custom-station-icon',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          html: `
            <div style="position: relative; width: 28px; height: 28px; border-radius: 9999px; background: ${bg}; border: 2.5px solid ${border}; display: flex; align-items: center; justify-content: center; box-shadow: ${shadow}; color: white; font-size: 11px; font-weight: 800; font-family: monospace;">
              ${st.order}
              ${
                st.isNext
                  ? '<div style="position: absolute; inset: -5px; border-radius: 9999px; border: 2.5px solid #00A86B; animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>'
                  : ''
              }
            </div>
          `,
        })

        const marker = L.marker([st.lat, st.lng], { icon: stationIcon }).addTo(map)
        marker.bindPopup(`
          <div style="font-family: inherit; padding: 4px;">
            <div style="font-size: 11px; color: #64748b; font-weight: 600;">Trạm dừng số ${st.order}</div>
            <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">${st.name}</div>
            <div style="font-size: 11px; color: #00A86B; font-weight: 700; margin-top: 4px;">
              ${st.isPassed ? '✓ Đã đón' : st.etaMinutes != null ? `Dự kiến đến: ~${st.etaMinutes} phút` : 'Sắp đến'}
            </div>
          </div>
        `)
        stationMarkersRef.current.push(marker)
      })
    }

    renderRoadAndStations()

    return () => {
      isSubscribed = false
    }
  }, [stationsList])

  // 6. Cập nhật vị trí Xe Buýt mượt mà (Grab/Be Gliding Transition)
  useEffect(() => {
    const map = mapInstanceRef.current
    const L = leafletModuleRef.current
    if (!map || !L) return

    // Xác thực tọa độ xe buýt thông minh: nếu chưa có hoặc lệch tuyến xa, ưu tiên hiển thị tại trạm xuất phát
    let lat = telemetry?.latitude
    let lng = telemetry?.longitude

    if (stationsList.length > 0) {
      const firstSt = stationsList[0]
      if (!lat || !lng) {
        lat = firstSt.lat
        lng = firstSt.lng
      } else {
        const d = calculateDistanceMeters(lat, lng, firstSt.lat, firstSt.lng)
        // Nếu cách trạm 1 quá 20km (tọa độ cũ của tuyến khác) và chưa chạy mô phỏng, snap về trạm 1
        if (d > 20000 && !simStatus?.isRunning) {
          lat = firstSt.lat
          lng = firstSt.lng
        }
      }
    } else {
      lat = lat || 21.585284
      lng = lng || 105.806297
    }

    const heading = telemetry?.headingDegrees || 0
    const speed = telemetry?.speedKmh ?? (simStatus?.isRunning ? 38 : 0)
    const plate = selectedTrip?.vehicle?.licensePlate || (selectedTrip?.vehicle as any)?.plateNumber || '20B-056.78'

    const busIcon = L.divIcon({
      className: 'custom-bus-glide-marker',
      iconSize: [52, 52],
      iconAnchor: [26, 26],
      html: `
        <div style="position: relative; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; transition: all ${tickIntervalMs}ms linear;">
          <!-- GPS Pulse Ring (Grab style) -->
          <div style="position: absolute; inset: -4px; border-radius: 9999px; background-color: rgba(0, 168, 107, 0.28); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <!-- Heading Arrow -->
          <div style="position: absolute; width: 44px; height: 44px; transform: rotate(${heading}deg); transition: transform ${tickIntervalMs}ms linear; pointer-events: none;">
            <div style="position: absolute; top: -7px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 11px solid #00A86B; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"></div>
          </div>
          <!-- 3D Bus Badge -->
          <div style="position: relative; width: 40px; height: 40px; border-radius: 9999px; background: linear-gradient(135deg, #00A86B 0%, #047857 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 18px rgba(0, 168, 107, 0.6); border: 2.5px solid #ffffff;">
            <svg style="width: 22px; height: 22px; fill: white;" viewBox="0 0 24 24">
              <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
            </svg>
          </div>
          <!-- Floating License Plate & Speed Tag -->
          <div style="position: absolute; top: -22px; left: 50%; transform: translateX(-50%); background: #0f172a; color: #ffffff; padding: 2px 7px; border-radius: 6px; font-size: 10px; font-weight: 800; white-space: nowrap; border: 1px solid rgba(255, 255, 255, 0.25); box-shadow: 0 3px 8px rgba(0,0,0,0.35); font-family: monospace;">
            ${plate} • ${speed} km/h
          </div>
        </div>
      `,
    })

    if (!busMarkerRef.current) {
      const marker = L.marker([lat, lng], { icon: busIcon, zIndexOffset: 3000 }).addTo(map)
      busMarkerRef.current = marker
    } else {
      busMarkerRef.current.setIcon(busIcon)
      busMarkerRef.current.setLatLng([lat, lng])
      busMarkerRef.current.setZIndexOffset(3000)
    }

    // Bám theo xe buýt (Follow Bus Mode)
    if (followBus) {
      map.panTo([lat, lng], { animate: true, duration: tickIntervalMs / 1000 })
    }
  }, [telemetry, stationsList, selectedTrip, followBus, tickIntervalMs, simStatus])

  // 7. Bật / Tắt Simulator
  const handleToggleSimulator = async () => {
    if (!selectedTripId) return
    setActionLoading(true)
    setErrorMsg(null)

    try {
      if (simStatus?.isRunning) {
        const res = await trackingService.stopSimulator(selectedTripId)
        if (res.success) {
          setSimStatus((prev) => (prev ? { ...prev, isRunning: false } : null))
        } else {
          setErrorMsg(res.message || 'Không thể dừng mô phỏng')
        }
      } else {
        const res = await trackingService.startSimulator(selectedTripId, speedMultiplier)
        if (res.success) {
          const newInterval = (res.data as any)?.intervalMs || Math.round(2000 / speedMultiplier)
          setTickIntervalMs(newInterval)
          setSimStatus((prev) =>
            prev
              ? { ...prev, isRunning: true, speedKmh: 35 * speedMultiplier, speedMultiplier }
              : ({
                  tripId: selectedTripId,
                  isRunning: true,
                  currentStep: 0,
                  totalSteps: (res.data as any)?.totalWaypoints || 40,
                  progressPercent: 0,
                  speedKmh: 35 * speedMultiplier,
                  speedMultiplier,
                } as any),
          )
          setFollowBus(true)
          if (stationsList[0]) {
            setTelemetry((prev) => ({
              ...prev,
              tripId: selectedTripId,
              latitude: stationsList[0].lat,
              longitude: stationsList[0].lng,
              speedKmh: 35 * speedMultiplier,
              headingDegrees: 90,
              batteryPercent: 95,
              lastUpdated: new Date().toISOString(),
              isSimulated: true,
              stationEtas: prev?.stationEtas || [],
            }))
          }
        } else {
          setErrorMsg(res.message || 'Không thể khởi động bộ mô phỏng GPS')
        }
      }
      await checkTelemetry(selectedTripId)
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi thao tác với bộ giả lập GPS')
    } finally {
      setActionLoading(false)
    }
  }

  // 8. Đổi tốc độ Simulator Tức Thời (On-the-fly Dynamic Speed: 1x, 2x, 5x, 10x)
  const handleSpeedChange = async (speed: number) => {
    setSpeedMultiplier(speed)
    const newInterval = Math.max(200, Math.round(2000 / speed))
    setTickIntervalMs(newInterval)

    if (simStatus?.isRunning && selectedTripId) {
      try {
        const res = await trackingService.updateSimulatorSpeed(selectedTripId, speed)
        if (res.success && res.data) {
          setSimStatus((prev) =>
            prev
              ? {
                  ...prev,
                  speedMultiplier: speed,
                  speedKmh: res.data?.speedKmh || 35 * speed,
                  tickIntervalMs: newInterval,
                }
              : null,
          )
        }
      } catch {
        // Fallback local update
      }
    }
  }

  // Căn chỉnh lại bản đồ bao trọn tuyến xe
  const handleFitRouteBounds = () => {
    const map = mapInstanceRef.current
    if (!map || !routePolylineRef.current) return
    try {
      const bounds = routePolylineRef.current.getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
      }
    } catch {
      // ignore
    }
  }

  const passengersCount = 18
  const maxSeats = selectedTrip?.vehicle?.seatCapacity || 28
  const batteryPct = telemetry?.batteryPercent ?? 92
  const currentSpeed = telemetry?.speedKmh ?? (simStatus?.isRunning ? 35 * speedMultiplier : 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Radio className="size-6 text-[#00A86B] animate-pulse" />
            Bản đồ Giám sát GPS Đội xe (Grab & Be Style)
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Bản đồ đường phố OpenStreetMap thời gian thực, bám sát mặt đường lộ trình và điều khiển tốc độ tức thời
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Lọc Tuyến Đường Động Từ API */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-card p-1 max-w-full overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedRouteId('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                selectedRouteId === 'all'
                  ? 'bg-[#00A86B] text-white shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Tất cả tuyến
            </button>
            {routes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRouteId(r.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedRouteId === r.id
                    ? 'bg-[#00A86B] text-white shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.routeCode || 'Tuyến'}: {r.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={fetchTripsAndRoutes}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors shadow-sm"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Quick Bus Selector Bar: Danh sách xe buýt thuộc tuyến */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap pl-1">
          Chọn xe buýt:
        </span>
        {filteredTrips.map((t) => {
          const isSelected = t.id === selectedTrip?.id
          const plate = t.vehicle?.licensePlate || '20B-056.78'
          const routeCode = t.route?.routeCode || activeRoute?.routeCode || 'CT'
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTripId(t.id)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                isSelected
                  ? 'bg-[#00A86B] text-white font-bold shadow-md ring-2 ring-emerald-500/30'
                  : 'border border-border bg-card text-foreground hover:bg-accent'
              }`}
            >
              <Bus className="size-3.5" />
              <span>{plate}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  isSelected ? 'bg-black/25 text-white' : 'bg-muted text-muted-foreground'
                }`}
              >
                {routeCode}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Real Leaflet Map Container (Left 8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="relative aspect-[16/10] min-h-[500px] w-full overflow-hidden rounded-3xl border border-border shadow-xl bg-slate-100 dark:bg-slate-900">
            {/* The Actual Leaflet Map DOM Element */}
            <div ref={mapContainerRef} className="absolute inset-0 z-0 w-full h-full" />

            {/* Top Status Bar Overlay */}
            <div className="absolute top-4 left-4 right-4 z-[400] flex flex-col gap-2.5 pointer-events-none">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 rounded-2xl bg-slate-900/85 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md border border-white/10 pointer-events-auto">
                  <span
                    className={`size-2 rounded-full ${
                      sseActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span>
                    {sseActive ? 'SSE Trực Tuyến • GPS Latency: 16ms' : 'Polling Sync Mode'}
                  </span>
                  {simStatus?.isRunning && (
                    <span className="ml-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                      Simulator {speedMultiplier}x
                    </span>
                  )}
                </div>

                {/* Action Buttons: Follow Bus & Fit Bounds */}
                <div className="flex items-center gap-2 pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => setFollowBus((prev) => !prev)}
                    className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-semibold backdrop-blur-md shadow-lg transition-all border ${
                      followBus
                        ? 'bg-[#00A86B] text-white border-emerald-400'
                        : 'bg-slate-900/85 text-white/80 border-white/10 hover:text-white'
                    }`}
                  >
                    <Crosshair className={`size-3.5 ${followBus ? 'animate-spin' : ''}`} />
                    {followBus ? 'Đang bám xe' : 'Bám theo xe'}
                  </button>

                  <button
                    type="button"
                    onClick={handleFitRouteBounds}
                    className="flex items-center gap-1.5 rounded-2xl bg-slate-900/85 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-md border border-white/10 shadow-lg hover:text-white transition-colors"
                  >
                    <Maximize2 className="size-3.5" />
                    Xem toàn tuyến
                  </button>
                </div>
              </div>

              {/* Banner Cảnh Báo Khẩn Cấp SOS Do Tài Xế Gửi Lên Hệ Thống */}
              {activeIncidents.length > 0 && (
                <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-red-500/80 bg-red-950/90 p-3 text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-xl bg-red-600 flex items-center justify-center animate-bounce shrink-0">
                      <Siren className="size-4 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-red-300">
                          TÍN HIỆU SOS TỪ TÀI XẾ XE {selectedTrip?.vehicle?.licensePlate || '20B'}
                        </span>
                        <span className="rounded-md bg-red-500 px-1.5 py-0.2 text-[10px] font-black uppercase text-white">
                          Khẩn cấp
                        </span>
                      </div>
                      <p className="text-xs text-red-100 font-medium mt-0.5">
                        {activeIncidents[0].description || 'Có sự cố khẩn cấp trên tuyến xe chạy'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleResolveIncident(activeIncidents[0].id)}
                    className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    Xác nhận giải tỏa sự cố
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Floating Control Bar (Grab / Be Control Dock) */}
            <div className="absolute bottom-4 left-4 right-4 z-[400] flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-slate-950/90 p-3.5 shadow-2xl backdrop-blur-md text-white">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleSimulator}
                  disabled={actionLoading || !selectedTripId}
                  className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all shadow-md active:scale-95 ${
                    simStatus?.isRunning
                      ? 'bg-rose-600 hover:bg-rose-700 ring-2 ring-rose-500/40'
                      : 'bg-[#00A86B] hover:bg-[#00925d] ring-2 ring-emerald-500/40'
                  }`}
                >
                  {actionLoading ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : simStatus?.isRunning ? (
                    <>
                      <Square className="size-3.5 fill-white" />
                      Dừng Simulator
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5 fill-white" />
                      Khởi Động Simulator (Demo)
                    </>
                  )}
                </button>

                {/* Speed Multipliers - HOÀN TOÀN MỞ KHÓA KHI ĐANG MÔ PHỎNG */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[11px] text-white/60 font-semibold">Tốc độ:</span>
                  {[1, 2, 5, 10].map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => handleSpeedChange(speed)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                        speedMultiplier === speed
                          ? 'bg-emerald-500 text-white shadow-md ring-1 ring-emerald-400'
                          : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress percentage bar */}
              {simStatus?.isRunning && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-white/70 font-medium">Tiến độ chuyến:</span>
                  <div className="w-28 h-2 rounded-full bg-white/15 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-500 rounded-full"
                      style={{ width: `${simStatus.progressPercent || 0}%` }}
                    />
                  </div>
                  <span className="font-mono font-bold text-emerald-400">
                    {simStatus.progressPercent || 0}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Selected Vehicle Telemetry Details (Right 4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <Bus className="size-3.5" />
                  {selectedTrip?.vehicle?.licensePlate || '20B-056.78'}
                </span>
                <h3 className="mt-2 text-base font-bold text-foreground line-clamp-1">
                  {selectedTrip?.route?.name || activeRoute?.name || 'Tuyến Smart Bus ICTU'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  Mã tuyến: {selectedTrip?.route?.routeCode || activeRoute?.routeCode || 'CT-35'}
                </p>
              </div>

              <span
                className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${
                  simStatus?.isRunning
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : selectedTrip?.status === 'in_progress'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {simStatus?.isRunning
                  ? 'Đang mô phỏng'
                  : selectedTrip?.status === 'in_progress'
                  ? 'Đang vận hành'
                  : 'Sắp khởi hành'}
              </span>
            </div>

            {/* Quick Metrics Grid */}
            <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl border border-border p-3 bg-card">
                <span className="text-muted-foreground flex items-center gap-1 font-medium">
                  <Gauge className="size-3.5 text-amber-500" /> Tốc độ GPS
                </span>
                <p className="mt-1 text-xl font-bold font-mono text-foreground">
                  {currentSpeed} <span className="text-xs font-normal">km/h</span>
                </p>
              </div>

              <div className="rounded-2xl border border-border p-3 bg-card">
                <span className="text-muted-foreground flex items-center gap-1 font-medium">
                  <BatteryCharging className="size-3.5 text-emerald-500" /> Dung lượng Pin EV
                </span>
                <p className="mt-1 text-xl font-bold font-mono text-foreground">
                  {batteryPct}%
                </p>
              </div>

              <div className="rounded-2xl border border-border p-3 col-span-2 bg-card">
                <span className="text-muted-foreground flex items-center gap-1 font-medium">
                  <Users className="size-3.5 text-blue-500" /> Phụ tải hành khách
                </span>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-sm font-bold text-foreground">
                    {passengersCount} / {maxSeats} chỗ (
                    {Math.round((passengersCount / maxSeats) * 100)}%)
                  </p>
                  <span className="text-xs text-muted-foreground font-mono">
                    Còn {maxSeats - passengersCount} ghế trống
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-[#00A86B] rounded-full transition-all"
                    style={{ width: `${(passengersCount / maxSeats) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Next Station Info */}
            <div className="mt-4 rounded-2xl bg-accent/40 p-3.5 text-xs border border-border/50">
              <span className="text-muted-foreground flex items-center gap-1 font-medium">
                <Clock className="size-3.5 text-cyan-500" /> Trạm đón kế tiếp:
              </span>
              <p className="font-semibold text-foreground mt-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 line-clamp-1">
                  <MapPin className="size-3.5 text-[#00A86B] shrink-0" />
                  {nextApproachingStation?.name || 'Trạm trung tâm'}
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap ml-2">
                  {nextApproachingStation?.etaMinutes != null
                    ? `~${nextApproachingStation.etaMinutes} phút`
                    : 'Đang đến'}
                </span>
              </p>
            </div>

            {/* Station Route Timeline */}
            <div className="mt-4 border-t border-border pt-4">
              <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                <Compass className="size-3.5 text-[#00A86B]" />
                Lộ trình các trạm dừng ({stationsList.length} trạm)
              </h4>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {stationsList.map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-xl border border-border/60 bg-background/50 hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {st.isPassed ? (
                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <span className="size-2 rounded-full bg-cyan-400 shrink-0" />
                      )}
                      <span
                        className={`truncate ${
                          st.isPassed ? 'line-through text-muted-foreground' : 'font-medium'
                        }`}
                      >
                        {st.order}. {st.name}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap ml-2">
                      {st.isPassed ? (
                        'Đã qua'
                      ) : st.etaMinutes != null ? (
                        <span className="text-emerald-600 font-bold dark:text-emerald-400">
                          ~{st.etaMinutes}p
                        </span>
                      ) : (
                        'Dự kiến'
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Assigned Driver */}
            <div className="mt-4 border-t border-border pt-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Tài xế phụ trách:</p>
                <p className="text-sm font-semibold text-foreground">
                  {selectedTrip?.driver?.fullName || 'Lê Hoàng Nam (Tài Xế)'}
                </p>
              </div>
              <a
                href={`tel:${selectedTrip?.driver?.phoneNumber || '0903456789'}`}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600 shadow-sm transition-colors"
              >
                <Phone className="size-3.5" /> Gọi tài xế
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
