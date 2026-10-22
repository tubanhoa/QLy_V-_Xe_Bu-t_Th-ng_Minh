'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Flashlight,
  QrCode,
  Search,
  Volume2,
  VolumeX,
  XCircle,
  ArrowLeft,
  ScanLine,
  AlertTriangle,
  Loader2,
  Upload,
  Bus,
  User,
  Clock,
  MapPin,
  FileCheck,
  FileUp,
  RotateCcw,
  ArrowRight,
  Laptop,
  Image as ImageIcon,
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
  bookingCode?: string
  seatNumber?: string
  route?: string
  pickupStation?: string
  dropoffStation?: string
  vehiclePlate?: string
  driverName?: string
  departureTime?: string
  message: string
  timestamp: string
  firstScannedAt?: string
  scanCount?: number
  isMonthlyPass?: boolean
  category?: string
  bookedTrip?: {
    tripId?: string
    routeCode?: string
    routeName?: string
    origin?: string
    destination?: string
    departureTime?: string
    vehiclePlate?: string
    driverName?: string
  }
  currentTrip?: {
    tripId?: string
    routeCode?: string
    routeName?: string
    vehiclePlate?: string
    driverName?: string
  }
}

export function DriverScanner({ onBack, tripId }: DriverScannerProps) {
  const [flashlight, setFlashlight] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const [activeTrip, setActiveTrip] = useState<DriverTripItem | null>(null)
  const [availableTrips, setAvailableTrips] = useState<DriverTripItem[]>([])

  // Quản lý Camera Scanner bằng html5-qrcode
  const [hasWebcam, setHasWebcam] = useState<boolean | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [autoResetSeconds, setAutoResetSeconds] = useState<number | null>(null)
  const autoResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoResetIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const html5QrCodeRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastScannedCodeRef = useRef<{ code: string; time: number } | null>(null)

  // Bộ nhớ đệm cục bộ lưu các vé đã check-in trên ca chạy hiện tại
  const [checkedInHistory, setCheckedInHistory] = useState<
    Record<string, { scannedAt: string; passengerName: string; seatNumber?: string; count: number }>
  >({})

  // Hàm chuyển nhanh sang lượt soát vé tiếp theo
  const resetScanner = useCallback(() => {
    if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current)
    if (autoResetIntervalRef.current) clearInterval(autoResetIntervalRef.current)
    setAutoResetSeconds(null)
    setScanResult(null)
    setManualCode('')
  }, [])

  // Tự động kiểm tra máy tính có webcam hay không
  useEffect(() => {
    async function checkCamera() {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const videoDevices = devices.filter((d) => d.kind === 'videoinput')
          setHasWebcam(videoDevices.length > 0)
        } catch {
          setHasWebcam(false)
        }
      } else {
        setHasWebcam(false)
      }
    }
    checkCamera()
  }, [])

  // Đếm ngược 6 giây tự động làm sạch màn hình để tài xế tiếp tục soát lượt kế tiếp
  useEffect(() => {
    if (scanResult) {
      setAutoResetSeconds(6)
      if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current)
      if (autoResetIntervalRef.current) clearInterval(autoResetIntervalRef.current)

      autoResetIntervalRef.current = setInterval(() => {
        setAutoResetSeconds((prev) => (prev && prev > 1 ? prev - 1 : 1))
      }, 1000)

      autoResetTimerRef.current = setTimeout(() => {
        resetScanner()
      }, 6000)
    } else {
      if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current)
      if (autoResetIntervalRef.current) clearInterval(autoResetIntervalRef.current)
      setAutoResetSeconds(null)
    }

    return () => {
      if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current)
      if (autoResetIntervalRef.current) clearInterval(autoResetIntervalRef.current)
    }
  }, [scanResult, resetScanner])

  // Lắng nghe phím Space / Enter để chuyển nhanh sang khách tiếp theo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.key === ' ' || e.key === 'Enter') && scanResult && !isVerifying) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          resetScanner()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [scanResult, isVerifying, resetScanner])

  useEffect(() => {
    async function fetchTrip() {
      const tripsRes = await driverService.getTodayTrips()
      if (tripsRes.success && tripsRes.data && tripsRes.data.length > 0) {
        setAvailableTrips(tripsRes.data)
        if (tripId) {
          const matched = tripsRes.data.find((t) => t.id === tripId)
          if (matched) {
            setActiveTrip(matched)
            return
          }
        }
        const found =
          tripsRes.data.find((t) => t.status === 'in_progress' || t.status === 'delayed') ||
          tripsRes.data.find((t) => t.status === 'scheduled') ||
          tripsRes.data[0]
        setActiveTrip(found)
      }
    }
    fetchTrip()
  }, [tripId])

  // Lắng nghe sự kiện Paste (Ctrl+V) ảnh chụp mã QR từ clipboard
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile()
          if (file) {
            e.preventDefault()
            await handleScanImageFile(file)
            break
          }
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [activeTrip])

  // Dọn dẹp camera khi unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            html5QrCodeRef.current?.clear()
          })
      }
    }
  }, [])

  // Bật/tắt Camera Scanner thời gian thực
  const toggleCamera = async () => {
    if (isCameraActive) {
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop()
          html5QrCodeRef.current.clear()
        } catch (err) {
          console.warn('Lỗi dừng camera:', err)
        }
        html5QrCodeRef.current = null
      }
      setIsCameraActive(false)
      setCameraError(null)
    } else {
      setCameraError(null)
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const html5Qr = new Html5Qrcode('qr-camera-viewport')
        html5QrCodeRef.current = html5Qr

        await html5Qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            const now = Date.now()
            // Chống quét liên tục cùng 1 mã trong 3 giây
            if (
              lastScannedCodeRef.current &&
              lastScannedCodeRef.current.code === decodedText &&
              now - lastScannedCodeRef.current.time < 3000
            ) {
              return
            }
            lastScannedCodeRef.current = { code: decodedText, time: now }
            handleVerifyTicketCode(decodedText)
          },
          () => {}
        )
        setIsCameraActive(true)
      } catch (err: any) {
        console.error('Không thể mở camera:', err)
        setCameraError(
          err?.message || 'Không thể truy cập camera. Vui lòng cấp quyền camera hoặc tải ảnh QR để soát vé.'
        )
        setIsCameraActive(false)
      }
    }
  }

  // Quét mã QR từ tệp ảnh hoặc ảnh dán Clipboard
  const handleScanImageFile = async (file: File) => {
    setIsVerifying(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const decoder = new Html5Qrcode('qr-file-decoder-temp')
      const decodedText = await decoder.scanFile(file, true)
      decoder.clear()
      await handleVerifyTicketCode(decodedText)
    } catch (err: any) {
      if (soundEnabled) driverHardware.playCue('ticketInvalid')
      setScanResult({
        status: 'invalid',
        ticketCode: 'FILE_SCAN',
        message: 'Không thể giải mã mã QR từ ảnh tải lên. Vui lòng thử lại với ảnh rõ nét hơn hoặc nhập mã vé.',
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      })
    } finally {
      setIsVerifying(false)
    }
  }

  // Xử lý xác thực mã vé QR / mã vé điện tử từ API Backend
  const handleVerifyTicketCode = async (rawCode: string) => {
    const trimmedInput = rawCode.trim()
    if (!trimmedInput) return

    // Nếu là chuỗi JSON (từ camera webcam quét mã QR), giữ nguyên case để bảo vệ chữ ký HMAC và định dạng JSON
    // Nếu là mã vé gõ tay (nhập trực tiếp như TKT-xxx), chuẩn hóa toUpperCase()
    const code = trimmedInput.startsWith('{') ? trimmedInput : trimmedInput.toUpperCase()

    // Khóa định danh vé dùng cho bộ nhớ đệm chống quét lặp
    let historyKey = code
    if (trimmedInput.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmedInput)
        historyKey = (parsed.ticketCode || parsed.passCode || parsed.bookingCode || trimmedInput).toUpperCase()
      } catch {}
    }

    setIsVerifying(true)
    const nowStr = new Date().toLocaleTimeString('vi-VN')

    // 1. Kiểm tra lặp cục bộ trên máy tài xế
    if (checkedInHistory[historyKey]) {
      const existing = checkedInHistory[historyKey]
      const newCount = existing.count + 1
      setCheckedInHistory((prev) => ({
        ...prev,
        [historyKey]: { ...existing, count: newCount },
      }))

      if (soundEnabled) driverHardware.playCue('ticketDuplicate')

      setScanResult({
        status: 'duplicate',
        ticketCode: historyKey,
        passengerName: existing.passengerName,
        seatNumber: existing.seatNumber,
        firstScannedAt: existing.scannedAt,
        scanCount: newCount,
        message: `CẢNH BÁO: Vé này đã được check-in lúc ${existing.scannedAt}! Đã quét ${newCount} lần.`,
        timestamp: nowStr,
      })
      setIsVerifying(false)
      return
    }

    // 2. Gọi API kiểm tra vé trực tuyến từ máy chủ (đối chiếu Đúng chuyến, Đúng xe, Đúng tài xế)
    const res = await driverService.verifyQrTicket(code, tripId || activeTrip?.id)

    if (res.success && res.data && res.data.valid) {
      const passenger = res.data.passenger || res.data.ticket?.user?.fullName || 'Hành khách sinh viên'
      const tripData = res.data.trip
      const seat =
        res.data.seat ||
        res.data.ticket?.seatNumber ||
        (res.data.isMonthlyPass ? 'Ghế tự do (Vé tháng HSSV)' : 'Ghế tiêu chuẩn')

      const finalTicketCode = res.data.ticketCode || historyKey

      setCheckedInHistory((prev) => ({
        ...prev,
        [historyKey]: { scannedAt: nowStr, passengerName: passenger, seatNumber: seat, count: 1 },
      }))

      if (soundEnabled) driverHardware.playCue('ticketSuccess')

      setScanResult({
        status: 'valid',
        passengerName: passenger,
        ticketCode: finalTicketCode,
        bookingCode: res.data.bookingCode,
        seatNumber: seat,
        route: tripData
          ? `${tripData.routeCode ? tripData.routeCode + ' - ' : ''}${tripData.routeName}`
          : activeTrip?.route?.name || 'Tuyến ICTU Transit',
        pickupStation: tripData?.origin || tripData?.pickupStation || 'Trạm đón quy hoạch',
        dropoffStation: tripData?.destination || tripData?.dropoffStation || 'Trạm kết thúc',
        vehiclePlate:
          tripData?.vehiclePlate ||
          (activeTrip?.vehicle as any)?.licensePlate ||
          activeTrip?.vehicle?.plateNumber ||
          'Xe buýt ICTU',
        driverName: tripData?.driverName || (activeTrip?.driver as any)?.fullName || 'Tài xế phụ trách',
        departureTime: tripData?.departureTime,
        message: res.data.message || 'Xác nhận lên xe thành công! Cho phép hành khách lên xe.',
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
        seatNumber: res.data.seat,
        message: res.data.message || 'Vé này đã được check-in trước đó!',
        timestamp: nowStr,
      })
    } else if (res.data?.isWrongTrip) {
      if (soundEnabled) driverHardware.playCue('ticketInvalid')

      const booked = res.data.bookedTrip || (res.data.correctTrip as any)
      setScanResult({
        status: 'wrong_trip',
        ticketCode: code,
        passengerName: res.data.passenger,
        seatNumber: res.data.seat,
        message: res.data.message || 'Vé không khớp với chuyến xe, phương tiện hoặc tài xế phụ trách ca này!',
        timestamp: nowStr,
        bookedTrip: booked,
        currentTrip:
          res.data.currentTrip ||
          (activeTrip
            ? {
                tripId: activeTrip.id,
                routeCode: activeTrip.route?.routeCode,
                routeName: activeTrip.route?.name,
                vehiclePlate: (activeTrip.vehicle as any)?.licensePlate || activeTrip.vehicle?.plateNumber,
                driverName: (activeTrip.driver as any)?.fullName,
              }
            : undefined),
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
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-5">
      {/* Container ẩn phục vụ giải mã tệp ảnh QR */}
      <div id="qr-file-decoder-temp" className="hidden" />

      {/* Input tệp ảnh ẩn */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            handleScanImageFile(file)
            e.target.value = ''
          }
        }}
      />

      {/* Header bar: Ca chạy & điều khiển */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-card p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-border shadow-xs">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 cursor-pointer shadow-2xs"
            >
              <ArrowLeft size={16} strokeWidth={2.5} />
            </button>
          )}
          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              Soát Vé Xe Buýt (QR & Mã Vé)
            </h1>
            <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">
              Xe:{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {(activeTrip?.vehicle as any)?.licensePlate || activeTrip?.vehicle?.plateNumber || 'Chưa gán xe'}
              </strong>{' '}
              • {activeTrip?.route?.name || 'Tuyến buýt ICTU'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Lựa chọn ca chạy */}
          {availableTrips.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-muted/40 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-border">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hidden sm:inline">
                Ca chạy:
              </span>
              <select
                value={activeTrip?.id || ''}
                onChange={(e) => {
                  const sel = availableTrips.find((t) => t.id === e.target.value)
                  if (sel) {
                    setActiveTrip(sel)
                    setScanResult(null)
                  }
                }}
                className="bg-transparent text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer max-w-[200px] truncate"
              >
                {availableTrips.map((t) => {
                  const depTime = new Date(t.departureTime).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  return (
                    <option key={t.id} value={t.id} className="text-slate-900 bg-white dark:bg-slate-900">
                      {depTime} • Tuyến {t.route?.routeCode || 'CT'} (
                      {(t.vehicle as any)?.licensePlate || t.vehicle?.plateNumber || 'Xe buýt'})
                    </option>
                  )
                })}
              </select>
            </div>
          )}

          {/* Nút bật/tắt chuông */}
          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            className={`flex size-10 items-center justify-center rounded-xl border transition-colors cursor-pointer shadow-2xs ${
              soundEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-slate-200 bg-white text-slate-400 dark:border-border dark:bg-card'
            }`}
            title={soundEnabled ? 'Đang bật chuông soát vé' : 'Đang tắt chuông'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </div>

      {/* Grid 2 cột: Quét Camera/Mã (Trái) & Kết quả xác thực (Phải) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* CỘT TRÁI: CAMERA SCANNER & NHẬP MÃ THỦ CÔNG */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="rounded-2xl bg-white dark:bg-card p-4 sm:p-5 border border-slate-200/90 dark:border-border shadow-xs space-y-4">
            {/* Viewport Quét QR: Tự động thích ứng nếu không có Webcam */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={async (e) => {
                e.preventDefault()
                setIsDragging(false)
                const file = e.dataTransfer.files?.[0]
                if (file && file.type.startsWith('image/')) {
                  await handleScanImageFile(file)
                }
              }}
              className={`relative overflow-hidden rounded-xl bg-slate-950 text-white border transition-all ${
                isDragging ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-slate-800'
              }`}
            >
              <div className="relative mx-auto flex aspect-square w-full max-w-[260px] flex-col items-center justify-center">
                {/* Vùng gắn stream camera thật của html5-qrcode */}
                <div
                  id="qr-camera-viewport"
                  className={`size-full ${isCameraActive ? 'block' : 'hidden'}`}
                />

                {/* Giao diện chờ khi camera tắt HOẶC máy tính không có webcam */}
                {!isCameraActive && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-4 text-center cursor-pointer group size-full"
                    title="Bấm để tải tệp ảnh mã QR hoặc kéo thả vào đây"
                  >
                    <div className="size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 mb-2.5 group-hover:scale-105 group-hover:border-emerald-500/50 transition-all">
                      {hasWebcam === false ? <FileUp size={28} /> : <QrCode size={28} />}
                    </div>

                    <p className="text-xs font-bold text-slate-200">
                      {hasWebcam === false ? 'Khu Vực Quét Vé Điện Tử' : 'Camera Quét Mã QR'}
                    </p>

                    <p className="text-[11px] text-slate-400 mt-1 max-w-[210px] leading-relaxed">
                      {hasWebcam === false
                        ? 'Kéo thả ảnh QR vào đây hoặc bấm Ctrl + V để dán ảnh chụp vé từ email'
                        : 'Bật camera webcam hoặc tải ảnh mã vé để hệ thống tự động nhận diện'}
                    </p>

                    <span className="inline-flex items-center gap-1 mt-2.5 px-2.5 py-1 rounded-lg bg-white/10 text-emerald-300 text-[10px] font-semibold group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <ImageIcon size={11} />
                      <span>Chọn ảnh QR từ máy</span>
                    </span>
                  </div>
                )}

                {/* Khung ngắm ảo khi camera hoạt động */}
                {isCameraActive && (
                  <div className="pointer-events-none absolute inset-6 rounded-xl border border-emerald-400/50">
                    <span className="absolute -left-1 -top-1 size-3.5 border-l-2 border-t-2 border-emerald-400" />
                    <span className="absolute -right-1 -top-1 size-3.5 border-r-2 border-t-2 border-emerald-400" />
                    <span className="absolute -bottom-1 -left-1 size-3.5 border-b-2 border-l-2 border-emerald-400" />
                    <span className="absolute -bottom-1 -right-1 size-3.5 border-b-2 border-r-2 border-emerald-400" />
                  </div>
                )}

                {/* Loading overlay khi đang xác thực vé */}
                {isVerifying && (
                  <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-2 rounded-xl backdrop-blur-xs z-20">
                    <Loader2 className="size-7 text-emerald-400 animate-spin" />
                    <p className="text-xs font-bold text-emerald-300">Đang đối chiếu dữ liệu vé...</p>
                  </div>
                )}
              </div>

              {/* Thông báo lỗi camera nếu có */}
              {cameraError && hasWebcam !== false && (
                <div className="p-2.5 bg-rose-950/90 border-t border-rose-800 text-[11px] text-rose-200 text-center">
                  {cameraError}
                </div>
              )}
            </div>

            {/* Các nút hành động: Tự thích ứng theo thiết bị */}
            {hasWebcam === false ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-10 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  <Upload size={14} />
                  <span>Tải ảnh mã vé QR (hoặc bấm Ctrl + V)</span>
                </button>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-muted-foreground">
                  <Laptop size={12} />
                  <span>Chế độ máy tính: Tối ưu cho việc tải ảnh QR hoặc gõ mã vé</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={toggleCamera}
                  className={`h-10 inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    isCameraActive
                      ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300'
                      : 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700 shadow-xs'
                  }`}
                >
                  {isCameraActive ? (
                    <>
                      <CameraOff size={14} />
                      <span>Tắt Camera</span>
                    </>
                  ) : (
                    <>
                      <Camera size={14} />
                      <span>Bật Camera Quét</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-muted dark:hover:bg-muted/80 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-border"
                  title="Tải tệp ảnh vé hoặc nhấn Ctrl+V để dán ảnh QR"
                >
                  <Upload size={14} />
                  <span>Tải / Dán ảnh QR</span>
                </button>
              </div>
            )}

            {/* Form nhập mã vé thủ công */}
            <div className="pt-2 border-t border-slate-100 dark:border-border">
              <form onSubmit={handleManualSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Nhập mã vé (VD: TKT-ICTU-...) hoặc mã thẻ..."
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-none dark:border-border dark:bg-muted/30 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isVerifying || !manualCode.trim()}
                  className="h-10 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 text-xs font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-xs dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  {isVerifying ? <Loader2 size={14} className="animate-spin" /> : 'Kiểm tra'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: KẾT QUẢ XÁC THỰC CHI TIẾT & LỊCH SỬ SOÁT */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {scanResult ? (
            <div
              className={`rounded-2xl border p-4 sm:p-5 shadow-xs transition-all ${
                scanResult.status === 'valid'
                  ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                  : scanResult.status === 'wrong_trip'
                  ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20'
                  : scanResult.status === 'duplicate'
                  ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20'
                  : 'border-rose-200 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20'
              }`}
            >
              {/* Header trạng thái */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/70 dark:border-border">
                <div className="flex items-center gap-2.5">
                  {scanResult.status === 'valid' && (
                    <CheckCircle2 className="size-6 text-emerald-600 shrink-0" />
                  )}
                  {scanResult.status === 'wrong_trip' && (
                    <AlertTriangle className="size-6 text-amber-600 shrink-0" />
                  )}
                  {scanResult.status === 'duplicate' && (
                    <AlertTriangle className="size-6 text-amber-600 shrink-0" />
                  )}
                  {scanResult.status === 'invalid' && (
                    <XCircle className="size-6 text-rose-600 shrink-0" />
                  )}
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      {scanResult.status === 'valid'
                        ? 'Xác Nhận Lên Xe Thành Công'
                        : scanResult.status === 'wrong_trip'
                        ? 'Cảnh Báo: Vé Không Khớp Với Xe Này'
                        : scanResult.status === 'duplicate'
                        ? 'Vé Đã Được Quét Trước Đó'
                        : 'Vé Không Hợp Lệ'}
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                      {scanResult.message}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-slate-400 shrink-0">{scanResult.timestamp}</span>
              </div>

              {/* Chi tiết khi xác thực thành công (Đúng chuyến, đúng xe, đúng tài xế) */}
              {scanResult.status === 'valid' && (
                <div className="mt-3.5 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-white dark:bg-card p-3 border border-slate-200/80 dark:border-border text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Hành khách</span>
                      <strong className="text-slate-900 dark:text-white text-xs block truncate">
                        {scanResult.passengerName}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Vị trí ghế</span>
                      <strong className="text-emerald-700 dark:text-emerald-400 text-xs block">
                        {scanResult.seatNumber || 'Ghế tiêu chuẩn'}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Mã vé điện tử</span>
                      <strong className="font-mono text-slate-800 dark:text-slate-200 text-xs block">
                        {scanResult.ticketCode}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Phương tiện</span>
                      <strong className="text-slate-900 dark:text-white text-xs block truncate">
                        {scanResult.vehiclePlate || 'Xe buýt ICTU'}
                      </strong>
                    </div>

                    <div className="col-span-2 pt-2 border-t border-slate-100 dark:border-border">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Tuyến xe</span>
                      <strong className="text-slate-900 dark:text-white text-xs block">
                        {scanResult.route}
                      </strong>
                    </div>

                    <div className="col-span-2 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 pt-1">
                      <span>Điểm đón: <strong>{scanResult.pickupStation}</strong></span>
                      <span>Điểm trả: <strong>{scanResult.dropoffStation}</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Chi tiết khi SAI chuyến / SAI xe / SAI tài xế (Bảng so sánh trực quan) */}
              {scanResult.status === 'wrong_trip' && scanResult.bookedTrip && (
                <div className="mt-3.5 space-y-2.5 text-xs">
                  {/* Hộp thông tin vé sinh viên đã đặt */}
                  <div className="rounded-xl bg-white dark:bg-card p-3 border border-amber-200 dark:border-amber-900/60">
                    <span className="text-[10px] text-amber-800 dark:text-amber-400 font-extrabold uppercase tracking-wider block mb-1">
                      👉 Thông tin chuyến xe sinh viên đã đặt:
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Tuyến xe:</span>
                        <strong className="text-slate-900 dark:text-white block truncate">
                          {scanResult.bookedTrip.routeCode ? `${scanResult.bookedTrip.routeCode} - ` : ''}
                          {scanResult.bookedTrip.routeName}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Xe buýt phân công:</span>
                        <strong className="text-slate-900 dark:text-white block">
                          {scanResult.bookedTrip.vehiclePlate || 'Chưa gán xe'}
                        </strong>
                      </div>
                      {scanResult.bookedTrip.departureTime && (
                        <div>
                          <span className="text-slate-400 text-[10px] block">Giờ xuất bến:</span>
                          <strong className="text-slate-900 dark:text-white block">
                            {new Date(scanResult.bookedTrip.departureTime).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </strong>
                        </div>
                      )}
                      {scanResult.bookedTrip.driverName && (
                        <div>
                          <span className="text-slate-400 text-[10px] block">Tài xế phụ trách:</span>
                          <strong className="text-slate-900 dark:text-white block truncate">
                            {scanResult.bookedTrip.driverName}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Xe hiện tại của tài xế */}
                  {scanResult.currentTrip && (
                    <div className="rounded-xl bg-slate-100/80 dark:bg-muted/40 p-2.5 border border-slate-200 dark:border-border text-[11px] text-slate-600 dark:text-slate-300">
                      <span>
                        Xe hiện tại của bạn: <strong>{scanResult.currentTrip.vehiclePlate || 'Xe buýt'}</strong> (
                        {scanResult.currentTrip.routeName || 'Tuyến này'})
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Thanh điều khiển Chuyển tiếp & Đếm ngược tự động làm sạch */}
              <div className="pt-3 mt-3 border-t border-slate-200/80 dark:border-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <RotateCcw size={12} className={autoResetSeconds ? 'animate-spin text-emerald-600' : ''} />
                  <span>
                    {autoResetSeconds !== null
                      ? `Tự động chuyển tiếp sau ${autoResetSeconds}s`
                      : 'Sẵn sàng soát vé tiếp theo'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={resetScanner}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  title="Nhấn phím Space hoặc Enter để chuyển nhanh sang khách tiếp theo"
                >
                  <span>Soát vé tiếp theo</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/90 dark:border-border bg-white dark:bg-card p-6 shadow-xs text-center space-y-2">
              <QrCode size={36} className="mx-auto text-emerald-600 opacity-60" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Sẵn Sàng Soát Vé</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Bật camera quét mã QR trên điện thoại sinh viên hoặc nhập mã vé để xác nhận lên xe.
              </p>
            </div>
          )}

          {/* Danh sách vé vừa soát thành công trong ca */}
          {historyList.length > 0 && (
            <div className="rounded-2xl border border-slate-200/90 dark:border-border bg-white dark:bg-card p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <h4 className="font-bold text-slate-800 dark:text-slate-200">
                  Khách vừa lên xe ca này ({historyList.length})
                </h4>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  Đã ghi nhận
                </span>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {historyList.map((item) => (
                  <div
                    key={item.code}
                    className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 dark:bg-muted/30 border border-slate-100 dark:border-border/60"
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {item.passengerName}{' '}
                        {item.seatNumber && <span className="text-slate-400 font-normal">({item.seatNumber})</span>}
                      </p>
                      <p className="font-mono text-[10px] text-slate-500">{item.code}</p>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                      {item.scannedAt}
                    </span>
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
