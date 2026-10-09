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
  status: 'valid' | 'invalid' | 'duplicate' | 'wrong_trip'
  passengerName?: string
  ticketCode: string
  seatNumber?: string
  route?: string
  pickupStation?: string
  message: string
  timestamp: string
  firstScannedAt?: string
  scanCount?: number
  isMonthlyPass?: boolean
  category?: string
  correctTrip?: {
    tripId?: string
    routeName?: string
    departureTime?: string
    vehiclePlate?: string
  }
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
        seatNumber: res.data.seat || res.data.ticket?.seatNumber || (res.data.isMonthlyPass ? 'Ghế tự do (Vé tháng HSSV)' : 'Ghế tiêu chuẩn'),
        route: activeTrip?.route?.name || 'Tuyến ICTU Transit',
        pickupStation: res.data.ticket?.pickupStation?.name || 'Trạm đón đăng ký',
        message: res.data.message || res.message || 'Vé hợp lệ - Đã ghi nhận check-in lên xe thành công',
        timestamp: nowStr,
        scanCount: 1,
        isMonthlyPass: res.data.isMonthlyPass,
        category: res.data.category,
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
    } else if (res.data?.isWrongTrip) {
      if (soundEnabled) driverHardware.playCue('ticketInvalid')

      setScanResult({
        status: 'wrong_trip',
        ticketCode: code,
        passengerName: res.data.passenger,
        seatNumber: res.data.seat,
        route: res.data.correctTrip?.routeName,
        message: res.data.message || 'Vé hợp lệ nhưng KHÔNG THUỘC CHUYẾN XE NÀY!',
        timestamp: nowStr,
        correctTrip: res.data.correctTrip,
      })
    } else {
      if (soundEnabled) driverHardware.playCue('ticketInvalid')

      setScanResult({
        status: 'invalid',
        ticketCode: code,
        message: res.data?.message || res.message || 'Vé không hợp lệ hoặc không tìm thấy trong hệ thống!',
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

  const historyList = Object.entries(checkedInHistory).map(([code, data]) => ({
    code,
    ...data,
  }))

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-card p-5 rounded-3xl border border-slate-200/90 dark:border-border shadow-xs">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 cursor-pointer shadow-2xs"
            >
              <ArrowLeft size={18} strokeWidth={2} />
            </button>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              Máy Soát Vé QR Trực Tuyến
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Xe {activeTrip?.vehicle?.plateNumber || '20B-012.34'} • {activeTrip?.route?.name || 'Tuyến CT-01'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            className={`flex size-11 items-center justify-center rounded-2xl border transition-colors cursor-pointer shadow-2xs ${
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
            className={`flex size-11 items-center justify-center rounded-2xl border transition-colors cursor-pointer shadow-2xs ${
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

      {/* Grid 2 cột: Khung ngắm & Kết quả */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CỘT TRÁI: CAMERA VIEWFINDER & NHẬP THỦ CÔNG */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-2xl border border-slate-800">
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
                  placeholder="Nhập mã vé (VD: TKT-ICTU-2026-NUJIO2)..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 text-xs sm:text-sm text-white placeholder:text-white/40 focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isVerifying || !manualCode.trim()}
                className="flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-5 text-xs font-bold text-white transition-all hover:bg-emerald-400 disabled:opacity-50 cursor-pointer shadow-md"
              >
                {isVerifying ? <Loader2 size={16} className="animate-spin" /> : 'Kiểm tra'}
              </button>
            </form>
          </div>
        </div>

        {/* CỘT PHẢI: KẾT QUẢ QUÉT & LỊCH SỬ KHÁCH LÊN XE */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {/* Kết quả quét vé */}
          {scanResult ? (
            <div
              className={`rounded-3xl border p-6 shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2 ${
                scanResult.status === 'valid'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
                  : scanResult.status === 'wrong_trip'
                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-950 dark:text-amber-100 ring-2 ring-amber-400/30'
                  : scanResult.status === 'duplicate'
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-950 dark:text-rose-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {scanResult.status === 'valid' && (
                    <CheckCircle2 className="size-9 text-emerald-500 shrink-0" />
                  )}
                  {scanResult.status === 'wrong_trip' && (
                    <AlertTriangle className="size-9 text-amber-500 shrink-0 animate-bounce" />
                  )}
                  {scanResult.status === 'duplicate' && (
                    <AlertTriangle className="size-9 text-amber-500 shrink-0" />
                  )}
                  {scanResult.status === 'invalid' && (
                    <XCircle className="size-9 text-rose-500 shrink-0" />
                  )}
                  <div>
                    <h3 className="text-base sm:text-lg font-bold">
                      {scanResult.status === 'valid'
                        ? 'Vé Hợp Lệ - Đã Check-in'
                        : scanResult.status === 'wrong_trip'
                        ? 'CẢNH BÁO: KHÁCH ĐI NHẦM CHUYẾN XE!'
                        : scanResult.status === 'duplicate'
                        ? 'Vé Đã Quét Trước Đó'
                        : 'Vé Không Hợp Lệ'}
                    </h3>
                    <p className="text-xs opacity-90 font-medium mt-0.5">{scanResult.message}</p>
                  </div>
                </div>
                <span className="font-mono text-xs opacity-60 shrink-0">{scanResult.timestamp}</span>
              </div>

              {scanResult.passengerName && (
                <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-black/20 p-4 text-xs">
                  {scanResult.isMonthlyPass && (
                    <div className="col-span-2 py-2 px-3 rounded-xl bg-teal-500/20 text-teal-800 dark:text-teal-200 font-extrabold text-xs flex items-center justify-between border border-teal-500/30">
                      <span>🎓 THẺ VÉ THÁNG HSSV HỢP LỆ</span>
                      <span className="uppercase text-[10px] tracking-wider opacity-80">{scanResult.category || 'Sinh viên ICTU'}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[11px] opacity-70">Hành khách:</span>
                    <p className="font-bold text-sm text-foreground">{scanResult.passengerName}</p>
                  </div>
                  <div>
                    <span className="text-[11px] opacity-70">Mã vé:</span>
                    <p className="font-mono font-bold text-sm text-foreground">{scanResult.ticketCode}</p>
                  </div>
                  <div>
                    <span className="text-[11px] opacity-70">Vị trí ghế:</span>
                    <p className="font-bold text-sm text-foreground">{scanResult.seatNumber || 'Ghế tự do'}</p>
                  </div>
                  <div>
                    <span className="text-[11px] opacity-70">Trạng thái:</span>
                    <p
                      className={`font-bold text-sm ${
                        scanResult.status === 'valid'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : scanResult.status === 'wrong_trip'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {scanResult.status === 'valid'
                        ? 'Đã lên xe'
                        : scanResult.status === 'wrong_trip'
                        ? 'Sai chuyến xe'
                        : 'Chưa hợp lệ'}
                    </p>
                  </div>
                  {scanResult.correctTrip && (
                    <div className="col-span-2 pt-2 mt-1 border-t border-amber-300/40 dark:border-amber-700/40 text-amber-900 dark:text-amber-200">
                      <p className="text-[11px] font-bold">👉 Thông tin chuyến đúng của khách:</p>
                      <p className="font-medium text-xs mt-0.5">
                        • Tuyến: <strong>{scanResult.correctTrip.routeName || 'Tuyến ICTU'}</strong>
                      </p>
                      {scanResult.correctTrip.departureTime && (
                        <p className="font-medium text-xs">
                          • Giờ chạy: <strong>{new Date(scanResult.correctTrip.departureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}</strong>
                        </p>
                      )}
                      {scanResult.correctTrip.vehiclePlate && (
                        <p className="font-medium text-xs">
                          • Biển số xe: <strong>{scanResult.correctTrip.vehiclePlate}</strong>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200/90 dark:border-border/90 bg-white dark:bg-card p-6 shadow-xs text-center space-y-2">
              <QrCode size={40} className="mx-auto text-emerald-500 opacity-60" />
              <h3 className="text-base font-bold text-foreground">Sẵn Sàng Soát Vé</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Đưa mã QR vé sinh viên vào khung camera bên trái hoặc nhập mã vé để hệ thống xác thực tức thì.
              </p>
            </div>
          )}

          {/* Lịch sử vé đã soát gần nhất */}
          {historyList.length > 0 && (
            <div className="rounded-3xl border border-slate-200/90 dark:border-border/90 bg-white dark:bg-card p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Vé vừa soát trên ca này ({historyList.length})</span>
                <span className="text-[10px] text-emerald-600 font-bold">Thời gian thực</span>
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {historyList.map((item) => (
                  <div key={item.code} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-muted/20 border border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="font-bold text-foreground">{item.passengerName}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{item.code}</p>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-600 font-bold">{item.scannedAt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
