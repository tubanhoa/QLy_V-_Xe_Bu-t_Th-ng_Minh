'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  BatteryCharging,
  Bus,
  MapPin,
  Phone,
  Radio,
  Zap,
  Play,
  Square,
  RefreshCw,
  Gauge,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Compass,
  ArrowRight,
} from 'lucide-react'
import { tripService, type TripItem } from '@/lib/services/trip.service'
import { transitService } from '@/lib/services/transit.service'
import { trackingService } from '@/lib/services/tracking.service'
import type { TransitRoute, TransitStation } from '@/lib/types/transit'
import type { LiveTrackingResponse, SimulatorStatus, StationEtaItem } from '@/lib/types/tracking'

interface ProjectedStation {
  id: string
  name: string
  order: number
  lat: number
  lng: number
  x: number // percent 0 - 100
  y: number // percent 0 - 100
  etaMinutes?: number
  isPassed?: boolean
}

export function DispatcherGpsMap() {
  const [trips, setTrips] = useState<TripItem[]>([])
  const [routes, setRoutes] = useState<TransitRoute[]>([])
  const [selectedTripId, setSelectedTripId] = useState<string>('')
  const [selectedRouteCode, setSelectedRouteCode] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(2)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Real-time telemetry state for selected trip
  const [telemetry, setTelemetry] = useState<LiveTrackingResponse | null>(null)
  const [simStatus, setSimStatus] = useState<SimulatorStatus | null>(null)
  const [sseActive, setSseActive] = useState<boolean>(false)
  const sseRef = useRef<EventSource | null>(null)

  // 1. Tải danh sách chuyến xe và tuyến đường từ backend
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

      // Chọn chuyến đầu tiên nếu chưa chọn hoặc đã bị hủy
      if (fetchedTrips.length > 0 && !selectedTripId) {
        setSelectedTripId(fetchedTrips[0].id)
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

  // Chuyến xe đang được chọn
  const selectedTrip = useMemo(() => {
    return trips.find((t) => t.id === selectedTripId) || trips[0] || null
  }, [trips, selectedTripId])

  // Tuyến đường tương ứng với chuyến đang chọn
  const activeRoute = useMemo(() => {
    if (!selectedTrip) return null
    return (
      routes.find((r) => r.id === selectedTrip.routeId) ||
      (selectedTrip.route as any) ||
      null
    )
  }, [selectedTrip, routes])

  // 2. Kiểm tra trạng thái Simulator và dữ liệu Live Tracking ban đầu
  const checkTelemetry = useCallback(async (tripId: string) => {
    try {
      const [simRes, liveRes] = await Promise.all([
        trackingService.getSimulatorStatus(tripId),
        trackingService.getLiveTrackingWithEta(tripId),
      ])

      if (simRes.success && simRes.data) {
        setSimStatus(simRes.data)
      }
      if (liveRes.success && liveRes.data) {
        setTelemetry(liveRes.data)
      }
    } catch {
      // ignore
    }
  }, [])

  // 3. Kết nối Server-Sent Events (SSE) theo tripId
  useEffect(() => {
    if (!selectedTripId) return

    // Cleanup previous SSE
    if (sseRef.current) {
      sseRef.current.close()
      sseRef.current = null
      setSseActive(false)
    }

    checkTelemetry(selectedTripId)

    try {
      const es = trackingService.createTrackingEventSource(selectedTripId)
      sseRef.current = es

      es.onopen = () => {
        setSseActive(true)
      }

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
              speedKmh: busLoc.speedKmh ?? prev?.speedKmh ?? 0,
              headingDegrees: busLoc.headingDegrees ?? prev?.headingDegrees ?? 0,
              batteryPercent: busLoc.batteryPercent ?? prev?.batteryPercent ?? 90,
              lastUpdated: busLoc.lastUpdated || new Date().toISOString(),
              isSimulated: busLoc.isSimulated ?? true,
              stationEtas: update.stationEtas || prev?.stationEtas || [],
            }))
          }
        } catch {
          // ignore parse error
        }
      }

      es.onerror = () => {
        setSseActive(false)
      }
    } catch {
      setSseActive(false)
    }

    // Polling fallback every 3s to keep simulator progress synchronized
    const timer = setInterval(() => {
      checkTelemetry(selectedTripId)
    }, 3000)

    return () => {
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
      clearInterval(timer)
      setSseActive(false)
    }
  }, [selectedTripId, checkTelemetry])

  // 4. Bật / Tắt Simulator
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
          setSimStatus((prev) =>
            prev
              ? { ...prev, isRunning: true, speedKmh: 45 * speedMultiplier }
              : ({
                  tripId: selectedTripId,
                  isRunning: true,
                  currentStep: 0,
                  totalSteps: (res.data as any)?.totalWaypoints || 40,
                  progressPercent: 0,
                  speedKmh: 45 * speedMultiplier,
                } as any),
          )
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

  // 5. Chuẩn hóa trạm dừng và tính tọa độ hiển thị (x%, y%)
  const { projectedStations, busPosition, pathD } = useMemo(() => {
    const rawStations: Array<{ id: string; name: string; lat: number; lng: number; order: number }> = []

    if (activeRoute?.routeStations && activeRoute.routeStations.length > 0) {
      const sorted = [...activeRoute.routeStations].sort(
        (a, b) => (a.stopOrder || 0) - (b.stopOrder || 0),
      )
      sorted.forEach((rs, idx) => {
        const st = rs.station || (rs as any)
        if (st && st.latitude && st.longitude) {
          rawStations.push({
            id: st.id || `st-${idx}`,
            name: st.name || `Trạm ${idx + 1}`,
            lat: Number(st.latitude),
            lng: Number(st.longitude),
            order: rs.stopOrder || idx + 1,
          })
        }
      })
    }

    // Nếu tuyến chưa có trạm trong routeStations, fallback trạm mặc định ICTU -> BX Thái Nguyên
    if (rawStations.length === 0) {
      rawStations.push(
        { id: 'st-1', name: 'ĐH CNTT & TT Thái Nguyên (ICTU)', lat: 21.585284, lng: 105.806297, order: 1 },
        { id: 'st-2', name: 'Cổng KTX ĐH Thái Nguyên', lat: 21.590123, lng: 105.815234, order: 2 },
        { id: 'st-3', name: 'Ngã 3 Mỏ Chè', lat: 21.595432, lng: 105.823456, order: 3 },
        { id: 'st-4', name: 'BV Đa Khoa Trung Ương', lat: 21.598765, lng: 105.832109, order: 4 },
        { id: 'st-5', name: 'Bến Xe Trung Tâm Thái Nguyên', lat: 21.604321, lng: 105.845678, order: 5 },
      )
    }

    const lats = rawStations.map((s) => s.lat)
    const lngs = rawStations.map((s) => s.lng)

    // Bounding box với padding 15%
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)

    const latSpan = Math.max(maxLat - minLat, 0.005)
    const lngSpan = Math.max(maxLng - minLng, 0.005)

    const project = (lat: number, lng: number) => {
      const x = ((lng - minLng) / lngSpan) * 78 + 11 // padding 11%
      const y = 100 - (((lat - minLat) / latSpan) * 70 + 15) // inverted Y for SVG
      return {
        x: Math.max(8, Math.min(92, x)),
        y: Math.max(12, Math.min(88, y)),
      }
    }

    const projected: ProjectedStation[] = rawStations.map((s) => {
      const coords = project(s.lat, s.lng)
      const etaItem = telemetry?.stationEtas?.find(
        (e: StationEtaItem) => e.stationId === s.id || e.stationName === s.name,
      )
      return {
        ...s,
        x: coords.x,
        y: coords.y,
        etaMinutes: etaItem?.etaMinutes,
        isPassed: etaItem ? etaItem.status === 'passed' : false,
      }
    })

    // Tọa độ bus tức thời
    const currentLat = telemetry?.latitude || rawStations[0].lat
    const currentLng = telemetry?.longitude || rawStations[0].lng
    const busPos = project(currentLat, currentLng)

    // Tạo chuỗi đường cong SVG nối các trạm
    let d = ''
    if (projected.length > 0) {
      d = `M ${projected[0].x * 8} ${projected[0].y * 5}`
      for (let i = 1; i < projected.length; i++) {
        d += ` L ${projected[i].x * 8} ${projected[i].y * 5}`
      }
    }

    return { projectedStations: projected, busPosition: busPos, pathD: d }
  }, [activeRoute, telemetry])

  // Lọc chuyến theo routeCode
  const filteredTrips = useMemo(() => {
    if (selectedRouteCode === 'all') return trips
    return trips.filter(
      (t) =>
        t.route?.routeCode === selectedRouteCode ||
        t.route?.name?.toLowerCase().includes(selectedRouteCode.toLowerCase()),
    )
  }, [trips, selectedRouteCode])

  const nextApproachingStation = useMemo(() => {
    return (
      projectedStations.find((s) => !s.isPassed) ||
      projectedStations[projectedStations.length - 1]
    )
  }, [projectedStations])

  const passengersCount = 18 // Trung bình giờ cao điểm
  const maxSeats = selectedTrip?.vehicle?.seatCapacity || 28
  const batteryPct = telemetry?.batteryPercent ?? 88
  const currentSpeed = telemetry?.speedKmh ?? (simStatus?.isRunning ? 38 : 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Radio className="size-6 text-[#00A86B] animate-pulse" />
            Bản đồ Giám sát GPS Đội xe Thời Gian Thực
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Giám sát vị trí viễn thông, telemetry pin EV, trạm đón và điều khiển bộ giả lập GPS IoT
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Lọc theo tuyến */}
          <div className="flex rounded-xl border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setSelectedRouteCode('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedRouteCode === 'all'
                  ? 'bg-[#00A86B] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Tất cả tuyến
            </button>
            <button
              type="button"
              onClick={() => setSelectedRouteCode('CT-01')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedRouteCode === 'CT-01'
                  ? 'bg-[#00A86B] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              CT-01: Tuyến ICTU
            </button>
            <button
              type="button"
              onClick={() => setSelectedRouteCode('CT-02')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedRouteCode === 'CT-02'
                  ? 'bg-[#00A86B] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              CT-02: Sông Công
            </button>
          </div>

          <button
            type="button"
            onClick={fetchTripsAndRoutes}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
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

      {/* Quick Bus Selector Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap pl-1">
          Chọn xe buýt:
        </span>
        {filteredTrips.map((t) => {
          const isSelected = t.id === selectedTripId
          const plate = t.vehicle?.licensePlate || 'Chưa gán xe'
          const routeCode = t.route?.routeCode || 'Tuyến'
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTripId(t.id)}
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                isSelected
                  ? 'bg-[#00A86B] text-white font-bold shadow-md'
                  : 'border border-border bg-card text-foreground hover:bg-accent'
              }`}
            >
              <Bus className="size-3.5" />
              <span>{plate}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  isSelected ? 'bg-black/20 text-white' : 'bg-muted text-muted-foreground'
                }`}
              >
                {routeCode}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Radar Map Canvas (Left 8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl border border-border bg-slate-950 p-6 shadow-2xl">
            {/* Map Grid Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40" />

            {/* Radar Circular Grid (Sonar feel) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="size-[280px] rounded-full border border-emerald-500/10" />
              <div className="size-[540px] rounded-full border border-emerald-500/5 absolute" />
            </div>

            {/* Simulated Road Vectors SVG Canvas (viewBox 0 0 800 500) */}
            <svg
              viewBox="0 0 800 500"
              className="absolute inset-0 size-full pointer-events-none"
              fill="none"
            >
              {/* Route Glow Path */}
              {pathD && (
                <>
                  <path
                    d={pathD}
                    stroke="#10b981"
                    strokeWidth="8"
                    strokeOpacity="0.15"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={pathD}
                    stroke="#34d399"
                    strokeWidth="3"
                    strokeDasharray="6 6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}
            </svg>

            {/* Station Pins */}
            {projectedStations.map((st) => (
              <div
                key={st.id}
                style={{ left: `${st.x}%`, top: `${st.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto group cursor-pointer"
              >
                <div className="relative flex flex-col items-center">
                  <span
                    className={`size-3 rounded-full border-2 border-slate-950 transition-transform group-hover:scale-125 ${
                      st.isPassed
                        ? 'bg-emerald-500'
                        : 'bg-cyan-400 ring-2 ring-cyan-400/40'
                    }`}
                  />
                  <div className="mt-1.5 whitespace-nowrap rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm border border-white/10 shadow-lg pointer-events-none">
                    {st.order}. {st.name}
                    {st.etaMinutes != null && !st.isPassed && (
                      <span className="ml-1 text-emerald-400 font-bold">
                        (~{st.etaMinutes}p)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Moving Bus Node */}
            {selectedTrip && (
              <div
                style={{ left: `${busPosition.x}%`, top: `${busPosition.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out z-20 pointer-events-auto"
              >
                <div className="relative flex flex-col items-center">
                  {/* Radar Pulse Ping */}
                  <span
                    className={`absolute -inset-2.5 rounded-full animate-ping opacity-60 ${
                      simStatus?.isRunning ? 'bg-emerald-400' : 'bg-cyan-400'
                    }`}
                  />
                  <div className="relative flex items-center gap-1.5 rounded-full bg-[#00A86B] text-white px-3 py-1.5 shadow-2xl ring-2 ring-white/80 scale-105">
                    <Bus className="size-3.5" />
                    <span className="font-mono text-xs font-bold">
                      {selectedTrip.vehicle?.licensePlate || 'BUS-01'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 rounded bg-black/85 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300 border border-emerald-500/20 shadow">
                    <span>{currentSpeed} km/h</span>
                    {simStatus?.isRunning && (
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Map Telemetry Header Badge */}
            <div className="absolute left-6 top-6 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3.5 py-1.5 text-xs text-white backdrop-blur-md">
                <span
                  className={`size-2 rounded-full ${
                    sseActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span>
                  {sseActive
                    ? 'SSE Trực Tuyến • GPS Latency: 18ms'
                    : 'Đang duy trì kết nối vệ tinh (Fallback Polling)'}
                </span>
              </div>

              {simStatus?.isRunning && (
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-md">
                  <Play className="size-3 fill-emerald-400 text-emerald-400" />
                  <span>Simulator Active ({speedMultiplier}x)</span>
                </div>
              )}
            </div>

            {/* Simulator Interactive Control Toolbar at Bottom */}
            <div className="absolute left-6 right-6 bottom-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/90 p-3 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleSimulator}
                  disabled={actionLoading || !selectedTripId}
                  className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all shadow-md ${
                    simStatus?.isRunning
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-[#00A86B] hover:bg-[#00925d]'
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

                {/* Speed Multiplier */}
                <div className="flex items-center gap-1 text-xs text-white/80">
                  <span className="text-[11px] text-white/60">Tốc độ:</span>
                  {[1, 2, 5].map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setSpeedMultiplier(speed)}
                      disabled={simStatus?.isRunning}
                      className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
                        speedMultiplier === speed
                          ? 'bg-white/20 text-white'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress percentage */}
              {simStatus?.isRunning && (
                <div className="flex items-center gap-3 text-xs text-white">
                  <span className="text-white/70">Tiến độ chuyến:</span>
                  <div className="w-32 h-2 rounded-full bg-white/10 overflow-hidden">
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
                  {selectedTrip?.vehicle?.licensePlate || '20B-012.34'}
                </span>
                <h3 className="mt-2 text-base font-bold text-foreground line-clamp-1">
                  {selectedTrip?.route?.name || 'Tuyến Smart Bus ICTU'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  Mã tuyến: {selectedTrip?.route?.routeCode || 'CT-01'}
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
              <div className="rounded-2xl border border-border p-3">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Gauge className="size-3.5 text-amber-500" /> Tốc độ GPS
                </span>
                <p className="mt-1 text-xl font-bold font-mono text-foreground">
                  {currentSpeed} <span className="text-xs font-normal">km/h</span>
                </p>
              </div>

              <div className="rounded-2xl border border-border p-3">
                <span className="text-muted-foreground flex items-center gap-1">
                  <BatteryCharging className="size-3.5 text-emerald-500" /> Dung lượng Pin EV
                </span>
                <p className="mt-1 text-xl font-bold font-mono text-foreground">
                  {batteryPct}%
                </p>
              </div>

              <div className="rounded-2xl border border-border p-3 col-span-2">
                <span className="text-muted-foreground flex items-center gap-1">
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
            <div className="mt-4 rounded-2xl bg-accent/40 p-3.5 text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="size-3.5 text-cyan-500" /> Trạm đón kế tiếp:
              </span>
              <p className="font-semibold text-foreground mt-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-[#00A86B]" />
                  {nextApproachingStation?.name || 'Trạm trung tâm'}
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
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
                Lộ trình các trạm dừng ({projectedStations.length} trạm)
              </h4>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {projectedStations.map((st, i) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between text-xs p-2 rounded-xl border border-border/50 bg-background/50"
                  >
                    <div className="flex items-center gap-2">
                      {st.isPassed ? (
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                      ) : (
                        <span className="size-2 rounded-full bg-cyan-400" />
                      )}
                      <span
                        className={`line-clamp-1 ${
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
                          {st.etaMinutes}p
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
                  {selectedTrip?.driver?.fullName || 'Trần Văn Nam (Tài Xế)'}
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
