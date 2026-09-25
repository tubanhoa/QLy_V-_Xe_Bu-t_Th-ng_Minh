'use client'

import { useState } from 'react'
import {
  Camera,
  CheckCircle2,
  Flashlight,
  QrCode,
  RotateCcw,
  Search,
  Sparkles,
  Volume2,
  XCircle,
  ArrowLeft,
  ScanLine,
} from 'lucide-react'

interface DriverScannerProps {
  onBack?: () => void
}

interface ScanResult {
  status: 'valid' | 'invalid'
  passengerName?: string
  ticketCode: string
  seatNumber?: string
  route?: string
  pickupStation?: string
  message: string
  timestamp: string
}

export function DriverScanner({ onBack }: DriverScannerProps) {
  const [flashlight, setFlashlight] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)

  const handleSimulateScan = (type: 'valid' | 'invalid') => {
    if (type === 'valid') {
      setScanResult({
        status: 'valid',
        passengerName: 'Nguyễn Hoàng Long',
        ticketCode: 'TK-ICTU-8921',
        seatNumber: 'Ghế 14A (Cạnh cửa sổ)',
        route: 'Tuyến 01: KTX ICTU → Bến xe Trung tâm',
        pickupStation: 'Trạm Cổng chính ĐH CNTT & TT',
        message: 'Vé hợp lệ - Đã check-in thành công',
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      })
    } else {
      setScanResult({
        status: 'invalid',
        ticketCode: 'TK-ICTU-0042',
        message: 'Vé đã được sử dụng lúc 06:45 sáng nay hoặc không thuộc chuyến xe này!',
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      })
    }
  }

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    if (manualCode.toUpperCase().includes('ICTU')) {
      handleSimulateScan('valid')
    } else {
      handleSimulateScan('invalid')
    }
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
              className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <ArrowLeft size={18} strokeWidth={1.75} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Máy quét vé QR
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Chuyến CT-01-0745 • Xe 20B-009.77
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`flex size-10 items-center justify-center rounded-xl border transition-colors ${
              soundEnabled
                ? 'border-emerald-500/30 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'border-slate-200 bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900'
            }`}
            title="Âm thanh quét vé"
          >
            <Volume2 size={18} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => setFlashlight((prev) => !prev)}
            className={`flex size-10 items-center justify-center rounded-xl border transition-colors ${
              flashlight
                ? 'border-amber-500/30 bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                : 'border-slate-200 bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900'
            }`}
            title="Bật đèn Flash"
          >
            <Flashlight size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Camera Viewfinder Simulator */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-950 shadow-2xl">
        <div className="relative aspect-square max-h-[380px] w-full flex items-center justify-center p-8">
          {/* Subtle live radar grid background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,168,107,0.15),transparent_70%)]" />

          {/* Flash indicator */}
          {flashlight && (
            <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] transition-all" />
          )}

          {/* Viewfinder Target Frame */}
          <div className="relative size-64 rounded-2xl border-2 border-emerald-400/40 p-4">
            {/* 4 Corners */}
            <span className="absolute -left-1 -top-1 size-6 border-l-4 border-t-4 border-emerald-400 rounded-tl-lg" />
            <span className="absolute -right-1 -top-1 size-6 border-r-4 border-t-4 border-emerald-400 rounded-tr-lg" />
            <span className="absolute -bottom-1 -left-1 size-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
            <span className="absolute -bottom-1 -right-1 size-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

            {/* Moving Laser Scan Line */}
            <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#00A86B] animate-bounce" />

            <div className="flex h-full flex-col items-center justify-center text-center text-white/60">
              <ScanLine size={48} strokeWidth={1.25} className="animate-pulse text-emerald-400/80" />
              <p className="mt-3 text-xs font-medium">Hướng camera vào mã QR vé xe</p>
            </div>
          </div>

          <div className="absolute bottom-4 inset-x-4 flex justify-between items-center text-[11px] text-white/50 px-2">
            <span>Độ phân giải: 1080p HD</span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
              Đang chờ quét...
            </span>
          </div>
        </div>
      </div>

      {/* Quick Testing Simulation Buttons */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Sparkles size={14} className="text-emerald-500" />
          Bộ thử nghiệm nhanh (Demo Barcode Simulator)
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => handleSimulateScan('valid')}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs sm:text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600 active:scale-95 transition-all"
          >
            <CheckCircle2 size={16} />
            Quét vé hợp lệ
          </button>
          <button
            type="button"
            onClick={() => handleSimulateScan('invalid')}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-500 px-3 py-2 text-xs sm:text-sm font-semibold text-white shadow-md shadow-red-500/20 hover:bg-red-600 active:scale-95 transition-all"
          >
            <XCircle size={16} />
            Quét vé lỗi / đã dùng
          </button>
        </div>
      </div>

      {/* Result Display Card */}
      {scanResult && (
        <div
          className={`animate-in fade-in slide-in-from-top-2 rounded-2xl border p-5 shadow-lg ${
            scanResult.status === 'valid'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
              : 'border-red-500/30 bg-red-500/10 text-red-950 dark:text-red-100'
          }`}
        >
          <div className="flex items-start gap-3">
            {scanResult.status === 'valid' ? (
              <CheckCircle2 size={24} className="text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={24} className="text-red-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-wider">
                  {scanResult.ticketCode}
                </span>
                <span className="text-[11px] opacity-75">{scanResult.timestamp}</span>
              </div>
              <p className="mt-1 font-bold text-base">{scanResult.message}</p>

              {scanResult.status === 'valid' && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-emerald-500/20 pt-3">
                  <div>
                    <span className="opacity-70">Hành khách:</span>
                    <p className="font-semibold">{scanResult.passengerName}</p>
                  </div>
                  <div>
                    <span className="opacity-70">Vị trí ghế:</span>
                    <p className="font-semibold">{scanResult.seatNumber}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="opacity-70">Điểm đón:</span>
                    <p className="font-semibold">{scanResult.pickupStation}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Input Fallback */}
      <form onSubmit={handleManualSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Nhập mã vé thủ công (ví dụ: TK-ICTU-8921)..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <button
          type="submit"
          className="h-11 rounded-xl bg-slate-900 px-4 text-xs sm:text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
        >
          Kiểm tra
        </button>
      </form>
    </div>
  )
}
