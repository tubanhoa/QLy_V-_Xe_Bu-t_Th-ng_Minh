'use client'

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import {
  Bus,
  Compass,
  Crosshair,
  Maximize2,
  Radio,
  RefreshCw,
  Gauge,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react'
import { DriverTripItem } from '@/lib/services/driver.service'
import { trackingService } from '@/lib/services/tracking.service'
import {
  fetchRoadGeometry,
  DEFAULT_THAI_NGUYEN_STOPS,
  StationLocation,
} from '@/lib/utils/map-routing'
import type { LiveTrackingResponse, StationEtaItem } from '@/lib/types/tracking'

interface DriverLiveMapProps {
  activeTrip: DriverTripItem | null
  onOpenCockpit?: () => void
  className?: string
}

export function DriverLiveMap({
  activeTrip,
  onOpenCockpit,
  className = '',
}: DriverLiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const leafletModuleRef = useRef<typeof import('leaflet') | null>(null)
  const busMarkerRef = useRef<any>(null)
  const routePolylineRef = useRef<any>(null)
  const glowPolylineRef = useRef<any>(null)
  const stationMarkersRef = useRef<any[]>([])
  const sseRef = useRef<EventSource | null>(null)

  const [followBus, setFollowBus] = useState<boolean>(true)
  const [sseActive, setSseActive] = useState<boolean>(false)
  const [telemetry, setTelemetry] = useState<LiveTrackingResponse | null>(null)
  const [speedKmh, setSpeedKmh] = useState<number>(32)
  const [tickIntervalMs, setTickIntervalMs] = useState<number>(1000)

  // 1. Trích xuất trạm dừng thực tế từ activeTrip
  const stations = useMemo<StationLocation[]>(() => {
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
            isPassed: etaItem ? etaItem.status === 'passed' : false,
            isNext: etaItem ? etaItem.isNextStop : idx === 0,
          })
        }
      })
      if (list.length > 0) return list
    }

    return DEFAULT_THAI_NGUYEN_STOPS
  }, [activeTrip, telemetry])

  // Trạm dừng tiếp theo
  const nextStation = useMemo(() => {
    return stations.find((s) => !s.isPassed) || stations[0]
  }, [stations])

  // 2. Kết nối SSE để nhận vị trí thời gian thực từ chuyến xe
  useEffect(() => {
    if (!activeTrip?.id) return

    if (sseRef.current) {
      sseRef.current.close()
      sseRef.current = null
      setSseActive(false)
    }

    // Tải vị trí ban đầu
    trackingService.getLiveTrackingWithEta(activeTrip.id).then((res) => {
      if (res.success && res.data) {
        setTelemetry(res.data)
        if (res.data.speedKmh) setSpeedKmh(res.data.speedKmh)
      }
    })

    // Lắng nghe luồng SSE
    try {
      const es = trackingService.createTrackingEventSource(activeTrip.id)
      sseRef.current = es

      es.onopen = () => setSseActive(true)

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)
          if (parsed?.data) {
            const update = parsed.data
            setTelemetry((prev) => ({
              ...(prev || {}),
              ...update,
              tripId: update.tripId || activeTrip.id,
              latitude: Number(update.latitude ?? prev?.latitude ?? stations[0]?.lat),
              longitude: Number(update.longitude ?? prev?.longitude ?? stations[0]?.lng),
              speedKmh: Number(update.speedKmh ?? prev?.speedKmh ?? 30),
              headingDegrees: Number(update.headingDegrees ?? prev?.headingDegrees ?? 0),
            }))
            if (update.speedKmh != null) setSpeedKmh(update.speedKmh)
            if (update.tickIntervalMs != null) setTickIntervalMs(update.tickIntervalMs)
          }
        } catch {
          // parse ignore
        }
      }

      es.onerror = () => {
        setSseActive(false)
      }
    } catch {
      setSseActive(false)
    }

    // Polling nhẹ nếu SSE không phản hồi
    const fallbackTimer = setInterval(() => {
      trackingService.getLiveTrackingWithEta(activeTrip.id).then((res) => {
        if (res.success && res.data) {
          setTelemetry(res.data)
          if (res.data.speedKmh) setSpeedKmh(res.data.speedKmh)
        }
      })
    }, 10000)

    return () => {
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
      clearInterval(fallbackTimer)
      setSseActive(false)
    }
  }, [activeTrip?.id, stations])

  // 3. Khởi tạo Bản đồ Leaflet (SSR-Safe)
  useEffect(() => {
    let isMounted = true

    async function initLeaflet() {
      if (!mapContainerRef.current || mapInstanceRef.current) return

      const L = await import('leaflet')
      if (!isMounted || !mapContainerRef.current) return
      leafletModuleRef.current = L

      const map = L.map(mapContainerRef.current, {
        center: [stations[0]?.lat || 21.585284, stations[0]?.lng || 105.807361],
        zoom: 14,
        zoomControl: false,
      })

      // Tile layer OpenStreetMap chuẩn, miễn phí 100%, không cần API Key
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        subdomains: 'abc',
      }).addTo(map)

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

  // 4. Vẽ Lộ trình OSRM bám mặt đường & Trạm dừng
  useEffect(() => {
    const map = mapInstanceRef.current
    const L = leafletModuleRef.current
    if (!map || !L || stations.length === 0) return

    stationMarkersRef.current.forEach((m) => m.remove())
    stationMarkersRef.current = []

    if (routePolylineRef.current) routePolylineRef.current.remove()
    if (glowPolylineRef.current) glowPolylineRef.current.remove()

    let isSubscribed = true

    async function renderRoute() {
      if (!map || !L) return

      const roadCoords = await fetchRoadGeometry(stations)
      if (!isSubscribed) return

      // Vệt sáng glow
      const glow = L.polyline(roadCoords, {
        color: '#00A86B',
        weight: 8,
        opacity: 0.22,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)
      glowPolylineRef.current = glow

      // Tuyến chính
      const poly = L.polyline(roadCoords, {
        color: '#00A86B',
        weight: 4.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)
      routePolylineRef.current = poly

      try {
        const bounds = poly.getBounds()
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 })
        }
      } catch {
        // ignore
      }

      // Marker các trạm đón
      stations.forEach((st) => {
        const bg = st.isPassed ? '#64748b' : st.isNext ? '#00A86B' : '#0284c7'
        const border = st.isNext ? '#10b981' : '#ffffff'
        const shadow = st.isNext ? '0 0 12px rgba(0, 168, 107, 0.7)' : '0 2px 6px rgba(0,0,0,0.3)'

        const icon = L.divIcon({
          className: 'custom-station-pin',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
          html: `
            <div style="position: relative; width: 26px; height: 26px; border-radius: 9999px; background: ${bg}; border: 2.5px solid ${border}; display: flex; align-items: center; justify-content: center; box-shadow: ${shadow}; color: white; font-size: 11px; font-weight: 800; font-family: monospace;">
              ${st.order}
              ${
                st.isNext
                  ? '<div style="position: absolute; inset: -4px; border-radius: 9999px; border: 2px solid #00A86B; animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>'
                  : ''
              }
            </div>
          `,
        })

        const marker = L.marker([st.lat, st.lng], { icon }).addTo(map)
        marker.bindPopup(`
          <div style="font-family: inherit; padding: 4px;">
            <div style="font-size: 11px; color: #64748b; font-weight: 600;">Trạm số ${st.order}</div>
            <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">${st.name}</div>
            <div style="font-size: 11px; color: #00A86B; font-weight: 700; margin-top: 4px;">
              ${st.isPassed ? '✓ Đã đón' : st.etaMinutes != null ? `Dự kiến: ~${st.etaMinutes} phút` : 'Sắp đến'}
            </div>
          </div>
        `)
        stationMarkersRef.current.push(marker)
      })
    }

    renderRoute()

    return () => {
      isSubscribed = false
    }
  }, [stations])

  // 5. Cập nhật vị trí Xe Buýt mượt mà (360 Glide)
  useEffect(() => {
    const map = mapInstanceRef.current
    const L = leafletModuleRef.current
    if (!map || !L) return

    const lat = telemetry?.latitude || stations[0]?.lat || 21.585284
    const lng = telemetry?.longitude || stations[0]?.lng || 105.807361
    const heading = telemetry?.headingDegrees || 0
    const speed = speedKmh
    const plate =
      (activeTrip?.vehicle as any)?.licensePlate ||
      activeTrip?.vehicle?.plateNumber ||
      '20B-012.34'

    const busIcon = L.divIcon({
      className: 'driver-bus-live-marker',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      html: `
        <div style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; transition: all ${tickIntervalMs}ms linear;">
          <!-- Radar Pulse -->
          <div style="position: absolute; inset: -4px; border-radius: 9999px; background-color: rgba(0, 168, 107, 0.28); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <!-- Heading Arrow -->
          <div style="position: absolute; width: 40px; height: 40px; transform: rotate(${heading}deg); transition: transform ${tickIntervalMs}ms linear; pointer-events: none;">
            <div style="position: absolute; top: -6px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 10px solid #00A86B; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));"></div>
          </div>
          <!-- 3D Bus Core -->
          <div style="position: relative; width: 36px; height: 36px; border-radius: 9999px; background: linear-gradient(135deg, #00A86B 0%, #047857 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0, 168, 107, 0.5); border: 2.5px solid #ffffff;">
            <svg style="width: 20px; height: 20px; fill: white;" viewBox="0 0 24 24">
              <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
            </svg>
          </div>
          <!-- Plate Tag -->
          <div style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%); background: #0f172a; color: #ffffff; padding: 1.5px 6px; border-radius: 5px; font-size: 9px; font-weight: 800; white-space: nowrap; border: 1px solid rgba(255,255,255,0.25); box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-family: monospace;">
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
  }, [telemetry, stations, activeTrip, followBus, tickIntervalMs, speedKmh])

  // Căn toàn tuyến
  const handleFitRoute = () => {
    const map = mapInstanceRef.current
    if (!map || !routePolylineRef.current) return
    try {
      const bounds = routePolylineRef.current.getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 })
      }
    } catch {
      // ignore
    }
  }

  // Bám theo xe
  const handleCenterBus = () => {
    const map = mapInstanceRef.current
    if (!map) return
    const lat = telemetry?.latitude || stations[0]?.lat || 21.585284
    const lng = telemetry?.longitude || stations[0]?.lng || 105.807361
    map.setView([lat, lng], 15, { animate: true })
    setFollowBus(true)
  }

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-slate-200/90 dark:border-border/90 bg-white dark:bg-card p-5 sm:p-6 shadow-xs flex flex-col gap-4 ${className}`}
    >
      {/* 1. Header Mini-Map */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Radio size={20} className={sseActive ? 'animate-pulse text-emerald-500' : ''} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-foreground">
                Bản Đồ GPS Vị Trí Xe Buýt Thời Gian Thực
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  sseActive
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    sseActive ? 'bg-emerald-500 animate-ping' : 'bg-emerald-500'
                  }`}
                />
                {sseActive ? 'Real-time SSE Live' : 'Định vị GPS Sẵn sàng'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tuyến {activeTrip?.route?.routeCode || 'CT-01'} • Điểm kế: {nextStation?.name || 'ĐH CNTT & TT Thái Nguyên'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Nút Bám theo xe */}
          <button
            type="button"
            onClick={handleCenterBus}
            title="Định vị tâm xe buýt"
            className={`px-3 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              followBus
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            <Crosshair size={14} />
            <span className="hidden sm:inline">Bám xe</span>
          </button>

          {/* Nút Căn toàn tuyến */}
          <button
            type="button"
            onClick={handleFitRoute}
            title="Xem toàn bộ tuyến đường"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Compass size={14} />
            <span className="hidden sm:inline">Toàn tuyến</span>
          </button>

          {/* Nút Vào Buồng Lái HUD */}
          {onOpenCockpit && (
            <button
              type="button"
              onClick={onOpenCockpit}
              title="Mở Buồng Lái HUD Toàn Màn Hình"
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-black shadow-md shadow-emerald-700/20 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Maximize2 size={14} />
              <span>Mở Buồng Lái HUD</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Container Bản Đồ Leaflet */}
      <div className="relative w-full h-[320px] sm:h-[380px] rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Telematics Badge */}
        <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2 pointer-events-none">
          <div className="bg-slate-900/90 text-white backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 shadow-lg flex items-center gap-2 pointer-events-auto">
            <Gauge size={14} className="text-emerald-400" />
            <span className="text-xs font-mono font-black text-emerald-300">
              {speedKmh} km/h
            </span>
            <span className="text-white/40">|</span>
            <span className="text-xs font-mono text-white/90">
              Trạm {nextStation?.order}/{stations.length}
            </span>
          </div>

          {nextStation?.etaMinutes != null && (
            <div className="bg-emerald-900/90 text-white backdrop-blur-md px-3 py-1.5 rounded-xl border border-emerald-400/30 shadow-lg flex items-center gap-1.5 pointer-events-auto">
              <Clock size={13} className="text-emerald-300" />
              <span className="text-xs font-bold text-emerald-100">
                Đến {nextStation.shortName || nextStation.name}: ~{nextStation.etaMinutes}p
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
