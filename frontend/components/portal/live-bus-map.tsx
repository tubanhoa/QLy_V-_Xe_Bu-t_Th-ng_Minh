'use client'

/**
 * Bản đồ Định vị Realtime & Marker Xe Buýt Động Chuẩn Trải Nghiệm Mobile-First (Grab / XanhSM)
 * - Tối ưu 100% không gian hiển thị di động, loại bỏ hoàn toàn lỗi tràn chữ và đè lớp giao diện
 * - Tuyến đường đồ hoạ mềm mại (Organic Curved Transit Path) mô phỏng mạng lưới giao thông TP. Thái Nguyên
 * - Chuyển động xe buýt mượt mà (SVG Path Interpolation & Headlight Cone)
 * - Điểm đón hành khách nổi bật với radar phát sóng và cự ly tiếp cận
 * - Chuyển đổi linh hoạt giữa Bản đồ Đô thị Vector & Bản đồ Vệ tinh Google Maps
 * 
 * Domain: Tracking
 * Branch: feature/SBTS-frontend-realtime-tracking-and-eta
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  MapPin,
  Navigation,
  Compass,
  Bus,
  Maximize2,
  Minimize2,
  Layers,
  Sparkles,
  Gauge,
  Locate,
  User,
  Clock,
  ExternalLink,
  Armchair,
  Route,
  Zap,
  Info,
  Check,
  ChevronRight,
} from 'lucide-react'
import type { LiveLocation, StationEtaItem } from '@/lib/types/tracking'

interface LiveBusMapProps {
  location: LiveLocation | null
  stationEtas: StationEtaItem[]
  tripName?: string
  isSimulating?: boolean
  pickupStationName?: string
  userDeviceLocation?: { latitude: number; longitude: number } | null
  onLocateMe?: () => void
  onSelectPickupStation?: (stationName: string) => void
}

// 6 mốc trạm chuẩn dọc tuyến 01 TP. Thái Nguyên trên bản đồ SVG (ViewBox: 800 x 360)
const ROUTE_WAYPOINTS = [
  { x: 70, y: 250, label: 'ICTU', sub: 'ĐH CNTT & TT' },
  { x: 190, y: 175, label: 'KTX ICTU', sub: 'Khu KTX Sinh Viên' },
  { x: 320, y: 215, label: 'Sư Phạm', sub: 'ĐH Sư Phạm' },
  { x: 450, y: 135, label: 'Đồng Quang', sub: 'Bến xe Đồng Quang' },
  { x: 590, y: 185, label: 'BVĐK TW', sub: 'BV Đa Khoa TW TN' },
  { x: 720, y: 110, label: 'Bến xe TT', sub: 'Bến xe TP. Thái Nguyên' },
]

export function LiveBusMap({
  location,
  stationEtas,
  tripName,
  isSimulating,
  pickupStationName,
  userDeviceLocation,
  onLocateMe,
  onSelectPickupStation,
}: LiveBusMapProps) {
  const [mapMode, setMapMode] = useState<'vector' | 'satellite'>('vector')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedStationPopup, setSelectedStationPopup] = useState<StationEtaItem | null>(null)
  const [focusTarget, setFocusTarget] = useState<'bus' | 'user' | null>(null)

  // Tọa độ xe buýt hiện tại tại TP Thái Nguyên (mặc định ĐH CNTT&TT Thái Nguyên ICTU: 21.585284, 105.807361)
  const lat = location?.latitude ?? 21.585284
  const lng = location?.longitude ?? 105.807361
  const speed = Math.round(location?.speedKmh ?? 32)
  const heading = Math.round(location?.headingDegrees ?? 45)

  // Tìm Trạm đón của hành khách (ưu tiên pickupStationName -> trạm kế tiếp -> trạm đầu tiên)
  const userPickupStation = useMemo(() => {
    if (pickupStationName && stationEtas.length > 0) {
      const found = stationEtas.find(
        (s) =>
          s.stationName.toLowerCase().includes(pickupStationName.toLowerCase()) ||
          pickupStationName.toLowerCase().includes(s.stationName.toLowerCase()),
      )
      if (found) return found
    }
    return stationEtas.find((s) => s.isNextStop) || stationEtas[0] || null
  }, [pickupStationName, stationEtas])

  // Tọa độ trạm đón của hành khách (hoặc GPS thiết bị)
  const pickupLat = userDeviceLocation?.latitude ?? userPickupStation?.latitude ?? 21.587123
  const pickupLng = userDeviceLocation?.longitude ?? userPickupStation?.longitude ?? 105.808234

  // URL Google Maps nhúng tập trung tại TP. Thái Nguyên
  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`
  const googleMapsDirectionUrl = `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${pickupLat},${pickupLng}&travelmode=driving`

  // Tính tỷ lệ tiến trình của xe dọc tuyến (0.0 -> 1.0)
  const progressRatio = useMemo(() => {
    if (!stationEtas.length) return 0.28
    const passedCount = stationEtas.filter((s) => s.status === 'passed').length
    const nextIdx = stationEtas.findIndex((s) => s.isNextStop)
    if (nextIdx === -1) {
      return Math.min(0.96, Math.max(0.04, passedCount / stationEtas.length))
    }
    const base = nextIdx / Math.max(1, stationEtas.length - 1)
    return Math.min(0.94, Math.max(0.06, base - 0.08))
  }, [stationEtas])

  // Tính tọa độ nội suy (x, y) trên đường cong SVG cho Xe Buýt
  // SVG Curve: M 70 250 C 130 200, 160 180, 190 175 C 240 170, 270 225, 320 215 C 380 205, 400 135, 450 135 C 500 135, 540 195, 590 185 C 640 175, 680 120, 720 110
  const busCoordinates = useMemo(() => {
    // 5 đoạn Bezier nối 6 điểm mốc
    const t = Math.min(0.999, Math.max(0.001, progressRatio))
    const totalSegments = ROUTE_WAYPOINTS.length - 1
    const scaledT = t * totalSegments
    const segIdx = Math.min(totalSegments - 1, Math.floor(scaledT))
    const segT = scaledT - segIdx

    const p0 = ROUTE_WAYPOINTS[segIdx]
    const p1 = ROUTE_WAYPOINTS[segIdx + 1]

    // Tuyến đường có độ uốn lượn nhẹ
    const midX = (p0.x + p1.x) / 2
    const midY = (p0.y + p1.y) / 2 + (segIdx % 2 === 0 ? -12 : 12)

    // Quadratic interpolation
    const oneMinusT = 1 - segT
    const x = oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * segT * midX + segT * segT * p1.x
    const y = oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * segT * midY + segT * segT * p1.y

    // Tangent angle
    const dx = 2 * oneMinusT * (midX - p0.x) + 2 * segT * (p1.x - midX)
    const dy = 2 * oneMinusT * (midY - p0.y) + 2 * segT * (p1.y - midY)
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI

    return { x: Math.round(x), y: Math.round(y), angle: Math.round(angleDeg) }
  }, [progressRatio])

  // Tìm waypoint trạm đón của người dùng
  const pickupWaypoint = useMemo(() => {
    if (!userPickupStation || !stationEtas.length) return ROUTE_WAYPOINTS[0]
    const idx = stationEtas.findIndex((s) => s.stationId === userPickupStation.stationId)
    if (idx === -1) return ROUTE_WAYPOINTS[1]
    const mappedIdx = Math.min(ROUTE_WAYPOINTS.length - 1, Math.floor((idx / Math.max(1, stationEtas.length - 1)) * (ROUTE_WAYPOINTS.length - 1)))
    return ROUTE_WAYPOINTS[mappedIdx] || ROUTE_WAYPOINTS[1]
  }, [userPickupStation, stationEtas])

  return (
    <div
      className={`relative w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-700/60 bg-gradient-to-b from-[#07131b] via-[#051811] to-[#04100c] text-white shadow-xl transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-2 sm:inset-4 z-50 rounded-2xl h-[calc(100vh-16px)] sm:h-[calc(100vh-32px)]'
          : 'h-[360px] sm:h-[410px]'
      }`}
    >
      {/* 1. TOP FLOATING APP BAR (Clean, non-cluttered icons & live telemetry) */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between pointer-events-none gap-1.5">
        {/* Left: Bus Vehicle Status Chip */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-white/10 px-2.5 py-1.5 shadow-md">
          <div className="relative flex items-center justify-center">
            <span className="size-2 rounded-full bg-emerald-400" />
            <span className="absolute size-3.5 rounded-full bg-emerald-400/40 animate-ping" />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-extrabold tracking-wide text-white">ICTU Transit</span>
            <span className="font-mono text-[10px] text-emerald-300 bg-emerald-950/90 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold">
              20B-012.34
            </span>
          </div>
          {isSimulating && (
            <span className="text-[9px] text-amber-300 font-bold bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
              <Sparkles size={9} /> Sim
            </span>
          )}
        </div>

        {/* Right: Compact Icon Button Group */}
        <div className="pointer-events-auto flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-white/10 p-1 rounded-xl shadow-md">
          {/* Nút Định vị tôi (HTML5 Geolocation) */}
          {onLocateMe && (
            <button
              type="button"
              onClick={onLocateMe}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer touch-press ${
                userDeviceLocation
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title="Định vị GPS vị trí của bạn tại Thái Nguyên"
            >
              <Locate size={14} className={userDeviceLocation ? 'animate-pulse' : 'text-blue-400'} />
            </button>
          )}

          {/* Nút Chuyển Google Maps Vệ Tinh / Vector */}
          <button
            type="button"
            onClick={() => setMapMode(mapMode === 'vector' ? 'satellite' : 'vector')}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer touch-press ${
              mapMode === 'satellite'
                ? 'bg-[#005A36] text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            title="Chuyển đổi kiểu bản đồ"
          >
            <Layers size={13} />
            <span className="hidden xs:inline">{mapMode === 'vector' ? 'Vệ tinh' : 'Đô thị'}</span>
          </button>

          {/* Nút Toàn màn hình */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer touch-press"
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* 2. MAP BODY */}
      {mapMode === 'satellite' ? (
        <div className="w-full h-full relative">
          <iframe
            title="Google Maps Định Vị Xe Buýt TP Thái Nguyên"
            src={googleMapsUrl}
            className="w-full h-full border-0 filter contrast-[105%]"
            loading="lazy"
            allowFullScreen
          />
          {/* Nút chỉ đường ngoài */}
          <div className="absolute bottom-3 right-3 z-10">
            <a
              href={googleMapsDirectionUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-bold shadow-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ExternalLink size={12} />
              <span>Chỉ đường ngoài</span>
            </a>
          </div>
        </div>
      ) : (
        /* INTERACTIVE TRANSIT URBAN MAP OF THAI NGUYEN (SVG ROAD CORRIDOR) */
        <div className="w-full h-full relative overflow-hidden flex flex-col justify-between select-none">
          {/* A. MAP CANVAS SVG (ĐƯỜNG PHỐ & LỘ TRÌNH UỐN LƯỢN TP THÁI NGUYÊN) */}
          <svg
            viewBox="0 0 800 360"
            className="w-full h-full absolute inset-0 preserve-3d"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Vệt sáng lộ trình Gradient */}
              <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#059669" />
                <stop offset="100%" stopColor="#005A36" />
              </linearGradient>

              {/* Nón ánh sáng đèn pha xe buýt */}
              <radialGradient id="headlightBeam" cx="0%" cy="50%" r="90%">
                <stop offset="0%" stopColor="rgba(253, 224, 71, 0.45)" />
                <stop offset="60%" stopColor="rgba(253, 224, 71, 0.15)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>

              {/* Pattern lưới bản đồ đô thị */}
              <pattern id="urbanGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
              </pattern>
            </defs>

            {/* Nền lưới tọa độ đô thị */}
            <rect width="800" height="360" fill="url(#urbanGrid)" />

            {/* Vùng sinh thái: Đồi chè & Khuôn viên ICTU */}
            <path
              d="M 20 220 Q 90 280, 160 260 T 260 320 L 20 340 Z"
              fill="rgba(16, 185, 129, 0.08)"
            />
            <path
              d="M 520 80 Q 640 40, 780 90 L 780 20 L 540 20 Z"
              fill="rgba(16, 185, 129, 0.06)"
            />

            {/* Đường phố phụ (Secondary City Streets - Z115, Lương Ngọc Quyến, Hoàng Văn Thụ) */}
            <path
              d="M 30 110 L 770 190"
              stroke="rgba(255, 255, 255, 0.07)"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 200 30 L 170 330"
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M 480 30 L 430 330"
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M 620 40 L 610 320"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="6"
              strokeLinecap="round"
            />

            {/* Nhãn tên đường phố Thái Nguyên (Street Watermarks) */}
            <text x="110" y="85" fill="rgba(255,255,255,0.18)" fontSize="10" fontWeight="bold" letterSpacing="2">
              ĐƯỜNG Z115 (KHU ICTU)
            </text>
            <text x="420" y="80" fill="rgba(255,255,255,0.18)" fontSize="10" fontWeight="bold" letterSpacing="2">
              ĐƯỜNG LƯƠNG NGỌC QUYẾN
            </text>
            <text x="590" y="270" fill="rgba(255,255,255,0.18)" fontSize="10" fontWeight="bold" letterSpacing="2">
              ĐƯỜNG HOÀNG VĂN THỤ
            </text>

            {/* DẢI ĐƯỜNG CHÍNH (ASPHALT ROAD BED) */}
            <path
              d="M 70 250 C 130 200, 160 180, 190 175 C 240 170, 270 225, 320 215 C 380 205, 400 135, 450 135 C 500 135, 540 195, 590 185 C 640 175, 680 120, 720 110"
              fill="none"
              stroke="#0f261d"
              strokeWidth="20"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Vạch tim đường đứt nét (Road Center Dash) */}
            <path
              d="M 70 250 C 130 200, 160 180, 190 175 C 240 170, 270 225, 320 215 C 380 205, 400 135, 450 135 C 500 135, 540 195, 590 185 C 640 175, 680 120, 720 110"
              fill="none"
              stroke="rgba(255, 255, 255, 0.18)"
              strokeWidth="2"
              strokeDasharray="6,8"
              strokeLinecap="round"
            />

            {/* TUYẾN XE BUÝT ĐIỆN PHÁT SÁNG (GLOWING TRANSIT LINE) */}
            <path
              d="M 70 250 C 130 200, 160 180, 190 175 C 240 170, 270 225, 320 215 C 380 205, 400 135, 450 135 C 500 135, 540 195, 590 185 C 640 175, 680 120, 720 110"
              fill="none"
              stroke="url(#routeGradient)"
              strokeWidth="6"
              strokeLinecap="round"
              className="drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]"
            />

            {/* Vệt ánh sáng chạy động dọc tuyến (Flowing Transit Animation) */}
            <path
              d="M 70 250 C 130 200, 160 180, 190 175 C 240 170, 270 225, 320 215 C 380 205, 400 135, 450 135 C 500 135, 540 195, 590 185 C 640 175, 680 120, 720 110"
              fill="none"
              stroke="#6ee7b7"
              strokeWidth="3"
              strokeDasharray="16,120"
              strokeLinecap="round"
              className="animate-dash-flow opacity-90"
            />

            {/* ĐƯỜNG DẪN KẾT NỐI XE ĐẾN ĐIỂM ĐÓN CỦA BẠN (Dotted Guidance Beam) */}
            {userPickupStation && (
              <line
                x1={busCoordinates.x}
                y1={busCoordinates.y}
                x2={pickupWaypoint.x}
                y2={pickupWaypoint.y}
                stroke="#60a5fa"
                strokeWidth="2"
                strokeDasharray="4,6"
                strokeOpacity="0.75"
                className="animate-pulse"
              />
            )}

            {/* CÁC ĐIỂM TRẠM DỌC ĐƯỜNG CONG (STATION NODES) */}
            {ROUTE_WAYPOINTS.map((wp, idx) => {
              const matchedStation = stationEtas[idx] || {
                stationId: `st-${idx}`,
                stationName: wp.label,
                stopOrder: idx + 1,
                etaMinutes: idx * 3 + 2,
                distanceMeters: idx * 600 + 400,
                status: idx < 1 ? 'passed' : 'upcoming',
                isNextStop: idx === 1,
              }
              const isPassed = matchedStation.status === 'passed'
              const isNext = matchedStation.isNextStop
              const isUserPickup =
                userPickupStation &&
                (userPickupStation.stationId === matchedStation.stationId ||
                  userPickupStation.stationName.includes(wp.label))

              return (
                <g
                  key={wp.label}
                  className="cursor-pointer group"
                  onClick={() => setSelectedStationPopup(matchedStation as StationEtaItem)}
                >
                  {/* Vòng hào quang trạm kế hoặc trạm đón */}
                  {isUserPickup && (
                    <circle cx={wp.x} cy={wp.y} r="18" fill="rgba(59, 130, 246, 0.25)" className="animate-ping" />
                  )}
                  {isNext && !isUserPickup && (
                    <circle cx={wp.x} cy={wp.y} r="16" fill="rgba(251, 191, 36, 0.25)" className="animate-ping" />
                  )}

                  {/* Vòng viền trạm */}
                  <circle
                    cx={wp.x}
                    cy={wp.y}
                    r={isUserPickup ? 8 : isNext ? 7 : 5.5}
                    fill={isUserPickup ? '#2563eb' : isNext ? '#f59e0b' : isPassed ? '#10b981' : '#1e293b'}
                    stroke={isUserPickup ? '#ffffff' : isNext ? '#ffffff' : '#475569'}
                    strokeWidth={isUserPickup || isNext ? 2.5 : 1.5}
                    className="transition-all group-hover:scale-125 origin-center"
                  />

                  {/* Tên trạm nổi bật trên bản đồ: Vị trí sole trên/dưới tránh đè chữ hoàn toàn */}
                  <g transform={`translate(${wp.x}, ${idx % 2 === 0 ? wp.y - 14 : wp.y + 18})`}>
                    <rect
                      x="-38"
                      y="-10"
                      width="76"
                      height="16"
                      rx="8"
                      fill={isUserPickup ? 'rgba(37,99,235,0.92)' : isNext ? 'rgba(217,119,6,0.92)' : 'rgba(15,23,42,0.85)'}
                      stroke={isUserPickup ? '#93c5fd' : isNext ? '#fde68a' : 'rgba(255,255,255,0.12)'}
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="1"
                      fill="#ffffff"
                      fontSize="8.5"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {wp.label}
                    </text>
                  </g>
                </g>
              )
            })}

            {/* B. ĐIỂM ĐÓN CỦA BẠN (USER PICKUP BEACON PIN) */}
            {userPickupStation && (
              <g
                transform={`translate(${pickupWaypoint.x}, ${pickupWaypoint.y})`}
                className="pointer-events-none"
              >
                {/* Vòng beacon mở rộng */}
                <circle cx="0" cy="0" r="24" fill="none" stroke="#60a5fa" strokeWidth="1.5" className="animate-ping opacity-60" />
                <circle cx="0" cy="0" r="14" fill="rgba(37,99,235,0.3)" />

                {/* Banner nhãn Điểm đón của bạn */}
                <g transform="translate(0, -32)">
                  <rect
                    x="-42"
                    y="-11"
                    width="84"
                    height="18"
                    rx="9"
                    fill="#2563eb"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    className="shadow-lg"
                  />
                  <text
                    x="0"
                    y="1"
                    fill="#ffffff"
                    fontSize="8.5"
                    fontWeight="900"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    📍 ĐIỂM ĐÓN BẠN
                  </text>
                </g>
              </g>
            )}

            {/* C. XE BUÝT ICTU CHẠY THỜI GIAN THỰC (ANIMATED BUS VEHICLE) */}
            <g
              transform={`translate(${busCoordinates.x}, ${busCoordinates.y})`}
              className="transition-transform duration-1000 ease-out"
            >
              {/* Nón đèn pha chiếu sáng phía trước theo góc đường */}
              <g transform={`rotate(${busCoordinates.angle})`}>
                <polygon
                  points="0,-8 75,-32 75,32 0,8"
                  fill="url(#headlightBeam)"
                  className="pointer-events-none"
                />
              </g>

              {/* Sóng radar của xe */}
              <circle cx="0" cy="0" r="22" fill="none" stroke="#10b981" strokeWidth="1.5" className="animate-ping opacity-50" />
              <circle cx="0" cy="0" r="12" fill="rgba(16, 185, 129, 0.3)" className="animate-pulse" />

              {/* Thân xe buýt bo góc sang trọng */}
              <g transform={`rotate(${busCoordinates.angle})`}>
                {/* Thân xe */}
                <rect
                  x="-15"
                  y="-10"
                  width="30"
                  height="20"
                  rx="6"
                  fill="#005A36"
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="filter drop-shadow-[0_0_8px_rgba(16,185,129,0.9)]"
                />
                {/* Kính chắn gió phía trước */}
                <rect x="7" y="-7" width="5" height="14" rx="2" fill="#a7f3d0" />
                {/* Đèn hậu đỏ */}
                <circle cx="-14" cy="-6" r="1.5" fill="#ef4444" />
                <circle cx="-14" cy="6" r="1.5" fill="#ef4444" />
                {/* Đèn pha trước */}
                <circle cx="14" cy="-6" r="1.8" fill="#fef08a" />
                <circle cx="14" cy="6" r="1.8" fill="#fef08a" />
              </g>

              {/* Chip tốc độ km/h gắn trên nóc xe */}
              <g transform="translate(0, -22)" className="pointer-events-none">
                <rect
                  x="-22"
                  y="-8"
                  width="44"
                  height="14"
                  rx="7"
                  fill="#042f1a"
                  stroke="#34d399"
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="1"
                  fill="#6ee7b7"
                  fontSize="8"
                  fontWeight="900"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  ⚡ {speed} km/h
                </text>
              </g>
            </g>
          </svg>

          {/* Compass góc phải */}
          <div className="absolute top-14 right-3 z-10 hidden sm:flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-xl text-xs shadow-md">
            <Compass
              size={15}
              className="text-amber-400 transition-transform duration-700 ease-out"
              style={{ transform: `rotate(${heading}deg)` }}
            />
            <span className="text-[11px] font-mono font-bold text-white">{heading}°</span>
          </div>

          {/* B. POPUP TRẠM DỪNG THÔNG MINH KHI CLICK VÀO TRẠM TRÊN BẢN ĐỒ */}
          {selectedStationPopup && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 backdrop-blur-xl border border-emerald-500/50 rounded-2xl p-3 shadow-2xl max-w-xs w-[90%] text-center animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <span className="text-[10px] font-bold uppercase text-emerald-400">
                  Trạm thứ #{selectedStationPopup.stopOrder} · Tuyến 01
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedStationPopup(null)}
                  className="text-slate-400 hover:text-white text-xs px-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <h5 className="font-extrabold text-xs sm:text-sm text-white mt-1">
                {selectedStationPopup.stationName}
              </h5>
              <div className="flex items-center justify-center gap-2 mt-1 text-[11px] font-mono text-amber-300">
                <span>⏱️ {selectedStationPopup.etaMinutes <= 1 ? 'Dưới 1 ph' : `~${selectedStationPopup.etaMinutes} ph`}</span>
                <span>·</span>
                <span>Cách {selectedStationPopup.distanceMeters > 1000 ? `${(selectedStationPopup.distanceMeters / 1000).toFixed(1)}km` : `${selectedStationPopup.distanceMeters}m`}</span>
              </div>
              {onSelectPickupStation && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectPickupStation(selectedStationPopup.stationName)
                    setSelectedStationPopup(null)
                  }}
                  className="mt-2 w-full py-1.5 rounded-lg bg-[#005A36] hover:bg-[#004529] text-[11px] font-black text-white transition-colors cursor-pointer touch-press"
                >
                  Chọn làm điểm đón của tôi
                </button>
              )}
            </div>
          )}

          {/* C. BOTTOM FLOATING QUICK-HUD (Súc tích, thanh lịch, không trùng lặp) */}
          <div className="relative z-10 flex items-center justify-between px-3 py-2 bg-slate-950/80 backdrop-blur-md border-t border-white/10 text-xs">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-emerald-300 font-bold text-[11px]">
                <Route size={13} className="text-emerald-400" />
                <span>Hành lang TP. Thái Nguyên</span>
              </div>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300 text-[11px]">
                6 trạm chính
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
              <span className="hidden xs:inline">Chạm vào trạm để xem chi tiết</span>
              <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

