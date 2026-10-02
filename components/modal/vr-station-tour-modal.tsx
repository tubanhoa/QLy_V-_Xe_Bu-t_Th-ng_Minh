'use client'

import { useEffect, useState } from 'react'
import {
  Compass,
  ExternalLink,
  Info,
  Maximize2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { haptic } from '@/lib/utils/haptics'

interface VrStationTourModalProps {
  isOpen: boolean
  onClose: () => void
  stationName?: string
}

export function VrStationTourModal({
  isOpen,
  onClose,
  stationName = 'Trạm Cổng Chính ĐH CNTT & TT Thái Nguyên (ICTU)',
}: VrStationTourModalProps) {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      document.body.style.overflow = 'hidden'
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

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vr-tour-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md transition-all animate-fadeIn select-none"
    >
      <div className="relative flex flex-col w-full max-w-5xl h-[90vh] max-h-[850px] bg-slate-900 rounded-3xl border border-white/20 shadow-2xl overflow-hidden text-white">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-600/30 border border-blue-400/40 text-cyan-300">
              <Compass size={20} className="animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="vr-tour-title" className="text-sm sm:text-base font-black tracking-tight text-white">
                  Thực Tế Ảo 360° Điểm Đón Xe Buýt ICTU
                </h3>
                <span className="hidden sm:inline-block rounded-full bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.5 text-[10px] font-black text-cyan-300">
                  VR 360° LIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium truncate max-w-[280px] sm:max-w-md">
                {stationName}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <a
              href="https://thamquan.ictu.edu.vn/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/20 transition-colors"
            >
              <span>Mở Toàn Màn Hình</span>
              <ExternalLink size={13} />
            </a>

            <button
              type="button"
              onClick={() => {
                haptic.play('tap')
                onClose()
              }}
              aria-label="Đóng cửa sổ thực tế ảo"
              className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Viewport Frame */}
        <div className="relative flex-1 w-full bg-slate-950 overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/90 text-center px-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-600/20 border border-blue-500/30 text-cyan-400">
                <RefreshCw size={26} className="animate-spin text-cyan-400" />
              </div>
              <p className="text-sm font-bold text-white">Đang tải không gian thực tế ảo 360°...</p>
              <p className="text-xs text-slate-400 max-w-xs">
                Hệ thống đang kết nối trực tiếp với máy chủ Tham quan thực tế ảo ICTU Campus.
              </p>
            </div>
          )}

          <iframe
            src="https://thamquan.ictu.edu.vn/"
            title="Thực tế ảo 360 độ trường ĐH Công nghệ Thông tin và Truyền thông - ICTU"
            className="w-full h-full border-0"
            allow="accelerometer; gyroscope; magnetometer; xr-spatial-tracking; fullscreen"
            loading="lazy"
            onLoad={() => setIsLoading(false)}
          />
        </div>

        {/* Footer Navigation Tip */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-2.5 border-t border-white/10 bg-slate-900/90 text-[11px] text-slate-400 gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Info size={13} className="text-cyan-400 shrink-0" />
            <span>Mẹo: Kéo chuột hoặc nghiêng điện thoại để xoay góc nhìn 360 độ quanh điểm đón xe buýt Cổng Chính ICTU.</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Nguồn dữ liệu:</span>
            <span className="font-semibold text-slate-300">thamquan.ictu.edu.vn</span>
          </div>
        </div>
      </div>
    </div>
  )
}
