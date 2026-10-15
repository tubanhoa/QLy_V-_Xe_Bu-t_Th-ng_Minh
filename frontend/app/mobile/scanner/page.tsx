'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Smartphone,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Wifi,
  Battery,
  Signal,
  Bus,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'
import { DriverScanner } from '@/components/portal/dashboard/driver-scanner'
import { driverHardware } from '@/lib/utils/driver-hardware'

export default function MobileScannerPage() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [deviceTime, setDeviceTime] = useState('09:41')
  const [isMobileDevice, setIsMobileDevice] = useState(false)

  // Đồng hồ thời gian thực tế trên thanh trạng thái điện thoại
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setDeviceTime(
        now.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Nhận diện thiết bị di động thực tế
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkMobile = () => {
        setIsMobileDevice(window.innerWidth < 768)
      }
      checkMobile()
      window.addEventListener('resize', checkMobile)
      return () => window.removeEventListener('resize', checkMobile)
    }
  }, [])

  const handleToggleFullscreen = () => {
    const active = driverHardware.toggleFullscreen()
    setIsFullscreen(active)
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-0 sm:py-6 sm:px-4 font-sans select-none">
      {/* Thanh điều khiển phụ trên Desktop (chỉ hiển thị khi xem trên màn hình lớn máy tính) */}
      {!isMobileDevice && (
        <div className="w-full max-w-md flex items-center justify-between py-2 px-4 mb-2 text-xs text-slate-400">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Ve Dashboard Tai Xe</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
              <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
              Chuan Mobile-First
            </span>
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span>{isFullscreen ? 'Thu nho' : 'Toan man hinh'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Khung Smartphone Chân Thực (Authentic Smartphone Mockup) */}
      <div
        className={`w-full max-w-md flex flex-col transition-all duration-300 ${
          isMobileDevice
            ? 'h-screen min-h-screen'
            : 'rounded-[44px] border-[6px] border-slate-700/80 bg-slate-900 shadow-2xl shadow-emerald-950/20 ring-1 ring-white/10 overflow-hidden min-h-[820px]'
        }`}
      >
        {/* Dynamic Island & Status Bar của Smartphone */}
        <div className="relative shrink-0 w-full pt-3 pb-2 px-6 flex items-center justify-between text-xs font-bold text-white bg-slate-900 z-30">
          {/* Giờ điện thoại */}
          <span className="font-mono text-xs tracking-tight">{deviceTime}</span>

          {/* Dynamic Island / Loa thoại */}
          <div className="absolute left-1/2 -translate-x-1/2 top-2 h-4 w-28 rounded-full bg-black flex items-center justify-center">
            <span className="size-2 rounded-full bg-slate-800" />
          </div>

          {/* Biểu tượng trạng thái: Sóng 5G, Wifi, Pin 100% */}
          <div className="flex items-center gap-1.5 text-white/80">
            <Signal size={12} strokeWidth={2.5} />
            <Wifi size={12} strokeWidth={2.5} />
            <span className="text-[10px] font-mono">100%</span>
            <Battery size={14} strokeWidth={2.5} className="text-emerald-400" />
          </div>
        </div>

        {/* Nội dung ứng dụng soát vé bên trong màn hình điện thoại */}
        <div className="flex-1 overflow-y-auto scroll-touch p-3 sm:p-4 bg-background text-foreground">
          <DriverScanner onBack={() => {
            if (typeof window !== 'undefined' && window.history.length > 1) {
              window.history.back()
            }
          }} />
        </div>

        {/* Thanh điều hướng cử chỉ đáy màn hình Smartphone (Home Indicator Bar) */}
        <div className="w-full py-2 flex justify-center shrink-0 bg-background">
          <div className="h-1 w-32 rounded-full bg-slate-400/40" />
        </div>
      </div>
    </div>
  )
}
