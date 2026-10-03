'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Camera,
  CheckCircle2,
  Flashlight,
  QrCode,
  RotateCcw,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  XCircle,
  ArrowLeft,
  ScanLine,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { driverService, DriverTripItem } from '@/lib/services/driver.service'
import { driverHardware } from '@/lib/utils/driver-hardware'

interface DriverScannerProps {
  onBack?: () => void
  tripId?: string
}

interface ScanResult {
  status: 'valid' | 'invalid' | 'duplicate'
  passengerName?: string
  ticketCode: string
  seatNumber?: string
  route?: string
  pickupStation?: string
  message: string
  timestamp: string
  firstScannedAt?: string
  scanCount?: number
}

export function DriverScanner({ onBack, tripId }: DriverScannerProps) {
  const [flashlight, setFlashlight] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const [activeTrip, setActiveTrip] = useState<DriverTripItem | null>(null)

  // Bộ nhớ đệm cục bộ lưu các vé đã check-in trên chuyến xe (Chống Replay Attack / Quét trùng lặp)
  const [checkedInHistory, setCheckedInHistory] = useState<Record<string, { scannedAt: string; passengerName: string; count: number }>>({})

  useEffect(() => {
    async function fetchTrip() {
      if (tripId) return
      const tripsRes = await driverService.getTodayTrips()
      if (tripsRes.success && tripsRes.data && tripsRes.data.length > 0) {
        const found =
          tripsRes.data.find((t) => t.status === 'in_progress' || t.status === 'delayed') ||
          tripsRes.data.find((t) => t.status === 'scheduled') ||
          tripsRes.data[0]
        setActiveTrip(found)
      }
    }
    fetchTrip()
  }, [tripId])

  // Xử lý xác thực mã vé QR thực tế từ API Backend
  const handleVerifyTicketCode = async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase()
    if (!code) return

    setIsVerifying(true)
    const nowStr = new Date().toLocaleTimeString('vi-VN')

    // 1. Kiểm tra lặp cục bộ (Client duplicate check)
    if (checkedInHistory[code]) {
      const existing = checkedInHistory[code]
      const newCount = existing.count + 1
      setCheckedInHistory((prev) => ({
        ...prev,
        [code]: { ...existing, count: newCount },
      }))

      if (soundEnabled) driverHardware.playCue('ticketDuplicate')

      setScanResult({
        status: 'duplicate',
        ticketCode: code,
        passengerName: existing.passengerName,
        firstScannedAt: existing.scannedAt,
        scanCount: newCount,
        message: `CẢNH BÁO: Vé này đã được check-in lúc ${existing.scannedAt}! Đã quét ${newCount} lần.`,
        timestamp: nowStr,
      })
      setIsVerifying(false)
      return
    }

    // 2. Gọi API kiểm tra vé trực tuyến từ máy chủ
    const res = await driverService.verifyQrTicket(code, tripId || activeTrip?.id)

    if (res.success && res.data && res.data.valid) {
      const passenger = res.data.passenger || res.data.ticket?.user?.fullName || 'Hành khách sinh viên'
      setCheckedInHistory((prev) => ({
        ...prev,
        [code]: { scannedAt: nowStr, passengerName: passenger, count: 1 },
      }))

      if (soundEnabled) driverHardware.playCue('ticketSuccess')

      setScanResult({
        status: 'valid',
        passengerName: passenger,
        ticketCode: code,
        seatNumber: res.data.seat || res.data.ticket?.seatNumber || 'Ghế tiêu chuẩn',
        route: activeTrip?.route?.name || 'Tuyến ICTU Transit',
        pickupStation: res.data.ticket?.pickupStation?.name || 'Trạm đón đăng ký',
        message: res.data.message || res.message || 'Vé hợp lệ - Đã ghi nhận check-in lên xe thành công',
        timestamp: nowStr,
        scanCount: 1,
      })
    } else if (res.data?.alreadyCheckedIn) {
      if (soundEnabled) driverHardware.playCue('ticketDuplicate')

      setScanResult({
        status: 'duplicate',
        ticketCode: code,
        passengerName: res.data.passenger,
        message: res.data.message || 'Vé này đã được check-in trước đó!',
        timestamp: nowStr,
      })
    } else {
      if (soundEnabled) driverHardware.playCue('ticketInvalid')

      setScanResult({
        status: 'invalid',
        ticketCode: code,
        message: res.data?.message || res.message || 'Vé không hợp lệ hoặc không thuộc chuyến xe này!',
        timestamp: nowStr,
      })
    }

    setIsVerifying(false)
  }

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    handleVerifyTicketCode(manualCode)
    setManualCode('')
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
            >
              <ArrowLeft size={18} strokeWidth={1.75} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Máy Soát Vé QR Trực Tuyến
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Xe {activeTrip?.vehicle?.plateNumber || '20B-009.77'} • {activeTrip?.route?.routeCode || 'CT-01'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            className={`flex size-10 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
              soundEnabled
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-border bg-card text-muted-foreground'
            }`}
            title={soundEnabled ? 'Đang bật chuông soát vé' : 'Đang tắt chuông'}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            type="button"
            onClick={() => setFlashlight((v) => !v)}
            className={`flex size-10 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
              flashlight
                ? 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-border bg-card text-muted-foreground'
            }`}
            title="Đèn flash hỗ trợ trời tối"
          >
            <Flashlight size={18} />
          </button>
        </div>
      </div>

      {/* Camera Viewfinder */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-2xl">
        <div className="relative mx-auto flex aspect-square w-full max-w-[280px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-500/50 bg-black/40">
          <div className="absolute inset-4 rounded-xl border-2 border-emerald-400/80">
            <span className="absolute -left-1 -top-1 size-4 border-l-4 border-t-4 border-emerald-400" />
            <span className="absolute -right-1 -top-1 size-4 border-r-4 border-t-4 border-emerald-400" />
            <span className="absolute -bottom-1 -left-1 size-4 border-b-4 border-l-4 border-emerald-400" />
            <span className="absolute -bottom-1 -right-1 size-4 border-b-4 border-r-4 border-emerald-400" />
          </div>

          <ScanLine className="size-16 text-emerald-400/80 animate-pulse" />
          <p className="mt-4 text-xs font-semibold text-emerald-300">
            Hướng camera vào mã QR vé sinh viên
          </p>
          <p className="mt-1 text-[10px] text-white/50">
            Xác thực chữ ký số thời gian thực
          </p>

          {isVerifying && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 rounded-xl backdrop-blur-xs">
              <Loader2 className="size-8 text-emerald-400 animate-spin" />
              <p className="text-xs font-bold text-emerald-300">Đang kiểm tra vé...</p>
            </div>
          )}
        </div>

        {/* Nhập mã vé thủ công */}
        <form onSubmit={handleManualSearch} className="mt-5 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Nhập mã vé hoặc mã sinh viên (VD: TK-01A)..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 text-xs sm:text-sm text-white placeholder:text-white/40 focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isVerifying || !manualCode.trim()}
            className="flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-xs font-bold text-white transition-all hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
          >
            {isVerifying ? <Loader2 size={16} className="animate-spin" /> : 'Kiểm tra'}
          </button>
        </form>
      </div>

      {/* Kết quả quét vé */}
      {scanResult && (
        <div
          className={`rounded-3xl border p-5 shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2 ${
            scanResult.status === 'valid'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
              : scanResult.status === 'duplicate'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-950 dark:text-rose-100'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {scanResult.status === 'valid' && (
                <CheckCircle2 className="size-8 text-emerald-500 shrink-0" />
              )}
              {scanResult.status === 'duplicate' && (
                <AlertTriangle className="size-8 text-amber-500 shrink-0" />
              )}
              {scanResult.status === 'invalid' && (
                <XCircle className="size-8 text-rose-500 shrink-0" />
              )}
              <div>
                <h3 className="text-base font-bold">
                  {scanResult.status === 'valid'
                    ? 'Vé Hợp Lệ - Đã Check-in'
                    : scanResult.status === 'duplicate'
                    ? 'Vé Đã Quét Trước Đó'
                    : 'Vé Không Hợp Lệ'}
                </h3>
                <p className="text-xs opacity-80">{scanResult.message}</p>
              </div>
            </div>
            <span className="font-mono text-xs opacity-60">{scanResult.timestamp}</span>
          </div>

          {scanResult.passengerName && (
            <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-2xl border border-black/5 dark:border-white/10 bg-white/40 dark:bg-black/20 p-3 text-xs">
              <div>
                <span className="text-[11px] opacity-70">Hành khách:</span>
                <p className="font-bold">{scanResult.passengerName}</p>
              </div>
              <div>
                <span className="text-[11px] opacity-70">Mã vé:</span>
                <p className="font-mono font-bold">{scanResult.ticketCode}</p>
              </div>
              <div>
                <span className="text-[11px] opacity-70">Vị trí ghế:</span>
                <p className="font-bold">{scanResult.seatNumber || 'Ghế tự do'}</p>
              </div>
              <div>
                <span className="text-[11px] opacity-70">Trạng thái:</span>
                <p className="font-bold text-emerald-600 dark:text-emerald-400">Đã lên xe</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
