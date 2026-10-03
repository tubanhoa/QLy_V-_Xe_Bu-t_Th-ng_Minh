'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  Compass,
  ExternalLink,
  Eye,
  Info,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/utils/haptics'

interface VrStationTourModalProps {
  isOpen: boolean
  onClose: () => void
  stationName?: string
}

interface Hotspot {
  id: string
  title: string
  category: string
  x: number // percentage
  y: number // percentage
  desc: string
  eta?: string
  routes?: string[]
}

const HOTSPOTS: Hotspot[] = [
  {
    id: 'bus-shelter',
    title: 'Trạm Dừng Xe Buýt Thông Minh Cổng Chính',
    category: 'Điểm Đón Xe Buýt Điện',
    x: 48,
    y: 68,
    desc: 'Nhà chờ có mái che kính chịu lực, ghế ngồi inox, bảng LED hiển thị lộ trình thời gian thực và cổng quét mã QR thanh toán một chạm.',
    eta: '2 phút (CT-01) · 5 phút (CT-02)',
    routes: ['CT-01', 'CT-02'],
  },
  {
    id: 'main-gate',
    title: 'Cổng Vòm Biểu Tượng ICTU',
    category: 'Cửa Ngõ Trường Đại Học',
    x: 44,
    y: 42,
    desc: 'Cổng vòm mang sắc xanh dương và trắng truyền thống của ICTU, kết nối trục đường Z115 với Quảng trường Đổi mới sáng tạo và khối giảng đường.',
  },
  {
    id: 'tech-complex',
    title: 'Khu Giảng Đường & Viện Nghiên Cứu Công Nghệ',
    category: 'Khu Giảng Đường & Lab',
    x: 18,
    y: 35,
    desc: 'Hệ thống phòng học thông minh, trung tâm nghiên cứu AI, IoT và các phòng máy tính thực hành chuyên sâu của sinh viên.',
  },
  {
    id: 'tea-hills',
    title: 'Vùng Đồi Chè Sinh Thái Bao Quanh Khuôn Viên',
    category: 'Cảnh Quan Tự Nhiên',
    x: 78,
    y: 28,
    desc: 'Đồi chè xanh mướt đặc trưng xứ trà Thái Nguyên ôm trọn phía sau khuôn viên trường, tạo không khí trong lành, thoáng đãng quanh năm.',
  },
]

export function VrStationTourModal({
  isOpen,
  onClose,
  stationName = 'Trạm Cổng Chính ĐH CNTT & TT Thái Nguyên (ICTU)',
}: VrStationTourModalProps) {
  // Panoramic Viewer State
  const [panX, setPanX] = useState(0) // offset in px
  const [zoom, setZoom] = useState(1.15)
  const [isAutoRotate, setIsAutoRotate] = useState(true)
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(HOTSPOTS[0])
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setPanX(0)
      setZoom(1.15)
      setIsAutoRotate(true)
      setSelectedHotspot(HOTSPOTS[0])
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Auto rotation loop
  useEffect(() => {
    if (!isOpen || !isAutoRotate || isDragging) return

    const interval = setInterval(() => {
      setPanX((prev) => {
        // Loop around smoothly
        const next = prev - 0.4
        return next < -300 ? 300 : next
      })
    }, 30)

    return () => clearInterval(interval)
  }, [isOpen, isAutoRotate, isDragging])

  // Mouse / Touch Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStartX(e.clientX - panX)
    setIsAutoRotate(false)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    const newPan = e.clientX - dragStartX
    // clamp within reasonable bounds
    setPanX(Math.max(-450, Math.min(450, newPan)))
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true)
      setDragStartX(e.touches[0].clientX - panX)
      setIsAutoRotate(false)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return
    const newPan = e.touches[0].clientX - dragStartX
    setPanX(Math.max(-450, Math.min(450, newPan)))
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  if (!isOpen) return null

  // Calculate simulated compass degrees
  const compassDeg = Math.round((panX / 300) * 90)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vr-tour-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-xl transition-all animate-fadeIn select-none"
    >
      <div className="relative flex flex-col w-full max-w-6xl h-[92vh] max-h-[900px] bg-slate-950 rounded-3xl border border-white/20 shadow-2xl overflow-hidden text-white">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-white/10 bg-slate-900/95 shrink-0 z-20">
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-blue-600/30 border border-blue-400/40 text-cyan-300 shadow-inner">
              <Compass
                size={22}
                className="transition-transform duration-200"
                style={{ transform: `rotate(${compassDeg}deg)` }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 id="vr-tour-title" className="text-sm sm:text-base lg:text-lg font-black tracking-tight text-white">
                  Thực Tế Ảo 360° Điểm Đón Xe Buýt Cổng Trường ICTU
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-[11px] font-black text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                  TƯƠNG TÁC 360° LIVE
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 font-medium truncate max-w-sm sm:max-w-xl">
                {stationName}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            {/* Direct Official Link to thamquan.ictu.edu.vn */}
            <a
              href="https://thamquan.ictu.edu.vn/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black px-4 py-2 text-xs sm:text-sm shadow-md shadow-cyan-400/25 transition-all active:scale-95"
              title="Mở toàn cảnh 3D trên cổng tham quan chính thức trường ICTU"
            >
              <ExternalLink size={15} />
              <span className="hidden md:inline">Mở Toàn Cảnh 3D (thamquan.ictu.edu.vn)</span>
              <span className="md:hidden">Cổng 3D ↗</span>
            </a>

            <button
              type="button"
              onClick={() => {
                haptic.play('tap')
                onClose()
              }}
              aria-label="Đóng cửa sổ thực tế ảo"
              className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 360 Panoramic Viewport */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={cn(
            'relative flex-1 w-full bg-slate-950 overflow-hidden select-none',
            isDragging ? 'cursor-grabbing' : 'cursor-grab',
          )}
        >
          {/* Panoramic Image Container with smooth 2.5D Pan & Zoom */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-75 ease-out"
            style={{
              transform: `scale(${zoom}) translateX(${panX}px)`,
              willChange: 'transform',
            }}
          >
            <div className="relative w-[140%] h-[140%] max-w-none">
              <Image
                src="/images/ictu-campus-360-panorama.jpg"
                alt="Toàn cảnh thực tế ảo 360 độ điểm đón xe buýt Cổng trường Đại học Công nghệ Thông tin và Truyền thông ICTU"
                fill
                priority
                className="object-cover pointer-events-none"
              />

              {/* Interactive Hotspot Pins overlaying the panorama */}
              <div className="absolute inset-0 pointer-events-auto">
                {HOTSPOTS.map((spot) => {
                  const isSelected = selectedHotspot?.id === spot.id
                  return (
                    <button
                      key={spot.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedHotspot(spot)
                        setIsAutoRotate(false)
                        haptic.play('tap')
                      }}
                      style={{
                        left: `${spot.x}%`,
                        top: `${spot.y}%`,
                      }}
                      className={cn(
                        'group absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 p-1.5 rounded-full transition-all cursor-pointer z-10',
                        isSelected
                          ? 'bg-blue-600/90 text-white shadow-lg shadow-blue-500/50 scale-110 ring-4 ring-cyan-400/60'
                          : 'bg-slate-900/80 hover:bg-blue-600/80 text-cyan-300 hover:text-white border border-white/30 backdrop-blur-md shadow-md',
                      )}
                    >
                      <span className="flex size-7 items-center justify-center rounded-full bg-cyan-400 text-slate-950 font-black text-xs">
                        <MapPin size={15} />
                      </span>
                      <span className="hidden sm:inline-block pr-3 text-xs font-black tracking-tight drop-shadow-md">
                        {spot.title}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Compass & Floating Navigation HUD (Top-Left) */}
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-slate-900/80 backdrop-blur-md px-3.5 py-2 text-xs font-black text-white shadow-lg">
              <Navigation
                size={16}
                className="text-cyan-400 transition-transform duration-100"
                style={{ transform: `rotate(${compassDeg}deg)` }}
              />
              <span>Góc nhìn: {compassDeg > 0 ? `Đông +${compassDeg}°` : compassDeg < 0 ? `Tây ${compassDeg}°` : 'Chính Bắc (0°)'}</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/70 backdrop-blur-md px-3 py-1.5 text-[11px] font-semibold text-slate-300">
              <Sparkles size={12} className="text-cyan-400" />
              <span>Chế độ: Toàn Cảnh 360° ĐH CNTT & TT</span>
            </div>
          </div>

          {/* Viewport Control Tools (Top-Right) */}
          <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
            <div className="flex flex-col gap-1 rounded-2xl border border-white/20 bg-slate-900/80 backdrop-blur-md p-1.5 shadow-lg">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.2, z + 0.2))}
                title="Phóng to"
                className="flex size-8 items-center justify-center rounded-xl hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(1.0, z - 0.2))}
                title="Thu nhỏ"
                className="flex size-8 items-center justify-center rounded-xl hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setPanX(0)
                  setZoom(1.15)
                  haptic.play('tap')
                }}
                title="Đặt lại góc nhìn"
                className="flex size-8 items-center justify-center rounded-xl hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAutoRotate((r) => !r)
                  haptic.play('tap')
                }}
                title={isAutoRotate ? 'Tạm dừng xoay tự động' : 'Bật xoay tự động'}
                className={cn(
                  'flex size-8 items-center justify-center rounded-xl transition-colors cursor-pointer',
                  isAutoRotate ? 'bg-blue-600 text-white' : 'hover:bg-white/20 text-slate-300',
                )}
              >
                <Play size={14} className={isAutoRotate ? 'animate-pulse' : ''} />
              </button>
            </div>
          </div>

          {/* Selected Hotspot Detailed Floating Card (Bottom-Left) */}
          {selectedHotspot && (
            <div className="absolute bottom-5 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md z-20 rounded-3xl border border-cyan-400/40 bg-slate-900/95 backdrop-blur-xl p-5 shadow-2xl text-white animate-fadeIn">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-block rounded-full bg-cyan-500/20 border border-cyan-400/40 px-2.5 py-0.5 text-[10px] font-black text-cyan-300 uppercase tracking-wide">
                    {selectedHotspot.category}
                  </span>
                  <h4 className="text-base sm:text-lg font-black text-white mt-1">
                    {selectedHotspot.title}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedHotspot(null)}
                  className="text-slate-400 hover:text-white transition-colors p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                {selectedHotspot.desc}
              </p>

              {selectedHotspot.eta && (
                <div className="mt-3.5 flex items-center justify-between rounded-xl bg-blue-950/70 border border-blue-500/30 p-2.5 text-xs">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold">
                    <span className="size-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>Thời gian xe buýt đến (ETA):</span>
                  </div>
                  <span className="font-black text-white font-mono">{selectedHotspot.eta}</span>
                </div>
              )}
            </div>
          )}

          {/* Subtle Drag Hint Overlay */}
          <div className="pointer-events-none absolute bottom-4 right-4 hidden sm:flex items-center gap-2 rounded-full bg-slate-950/70 border border-white/10 px-3.5 py-1.5 text-[11px] font-semibold text-slate-400 backdrop-blur-md">
            <span>🖱️ Kéo chuột trái / vuốt ngang để xoay 360°</span>
          </div>
        </div>

        {/* Footer Bar with Official Source Attribution */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-5 sm:px-7 py-3 border-t border-white/10 bg-slate-900/95 text-xs text-slate-400 gap-2 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-cyan-400 shrink-0" />
            <span>
              Mô phỏng không gian số hóa khuôn viên trường & trạm xe buýt điện tử ICTU Transit.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-500">Hệ thống thực tế ảo chính thức:</span>
            <a
              href="https://thamquan.ictu.edu.vn/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center gap-1"
            >
              <span>thamquan.ictu.edu.vn</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
