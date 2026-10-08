'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  Users,
  Video,
  VideoOff,
  UserCheck,
  Check,
  SwitchCamera,
  History,
  Clock,
  Layers,
  Phone,
  Flame,
  Zap,
} from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { driverService, DriverTripItem, ManifestPassenger } from '@/lib/services/driver.service'
import { driverHardware } from '@/lib/utils/driver-hardware'

interface DriverScannerProps {
  onBack?: () => void
  tripId?: string
}

export interface ScanResultItem {
  id: string
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
  // State ca chạy và cấu hình
  const [activeTrip, setActiveTrip] = useState<DriverTripItem | null>(null)
  const [flashlight, setFlashlight] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isContinuousMode, setIsContinuousMode] = useState(true) // Mặc định bật chế độ quét liên tục
  const [currentTab, setCurrentTab] = useState<'scanner' | 'manifest' | 'history'>('scanner')

  // State nhập mã và trạng thái xử lý
  const [manualCode, setManualCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [currentResult, setCurrentResult] = useState<ScanResultItem | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanResultItem[]>([])

  // State Camera html5-qrcode
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)

  // Bộ đệm Debounce / Cooldown chống quét trùng lặp trong thời gian ngắn (2.5 giây)
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 })

  // State Manifest hành khách
  const [manifest, setManifest] = useState<ManifestPassenger[]>([])
  const [isLoadingManifest, setIsLoadingManifest] = useState(false)
  const [manifestSearch, setManifestSearch] = useState('')
  const [manifestFilter, setManifestFilter] = useState<'all' | 'checked' | 'pending'>('all')

  // Bộ nhớ đệm cục bộ lưu các vé đã check-in trên chuyến xe (Chống Replay Attack)
  const [checkedInHistory, setCheckedInHistory] = useState<
    Record<string, { scannedAt: string; passengerName: string; count: number }>
  >({})

  // 1. TẢI THÔNG TIN CA CHẠY HÔM NAY
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

  // 2. TẢI DANH SÁCH MANIFEST HÀNH KHÁCH
  const loadManifest = useCallback(async () => {
    const targetTripId = tripId || activeTrip?.id
    if (!targetTripId) return

    setIsLoadingManifest(true)
    try {
      const res = await driverService.getTripManifest(targetTripId)
      if (res.success && res.data) {
        setManifest(res.data.manifest || [])
      }
    } catch (e) {
      console.warn('[DriverScanner] Khong the tai manifest:', e)
    } finally {
      setIsLoadingManifest(false)
    }
  }, [tripId, activeTrip?.id])

  useEffect(() => {
    if (activeTrip?.id) {
      loadManifest()
    }
  }, [activeTrip?.id, loadManifest])

  // 3. KHỞI TẠO VÀ LẤY DANH SÁCH CAMERA THIẾT BỊ
  useEffect(() => {
    if (typeof window === 'undefined') return

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices)
          // Ưu tiên chọn camera sau (Back / Environment camera) nếu có
          const backCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('sau') ||
              d.label.toLowerCase().includes('environment')
          )
          setSelectedCameraId(backCam ? backCam.id : devices[0].id)
        }
      })
      .catch((err) => {
        console.warn('[DriverScanner] Khong the lay danh sach camera:', err)
      })
  }, [])

  // 4. HÀM XỬ LÝ XÁC THỰC MÃ VÉ QR TRỰC TUYẾN
  const handleVerifyTicketCode = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim().toUpperCase()
      if (!code) return

      // Cơ chế Debounce Cooldown: Bỏ qua nếu quét cùng 1 mã trong vòng 2.5 giây
      const nowMs = Date.now()
      if (lastScannedRef.current.code === code && nowMs - lastScannedRef.current.time < 2500) {
        return
      }
      lastScannedRef.current = { code, time: nowMs }

      setIsVerifying(true)
      const nowStr = new Date().toLocaleTimeString('vi-VN')
      const resultId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

      // A. KIỂM TRA LẶP CỤC BỘ TRÊN BỘ NHỚ CLIENT
      if (checkedInHistory[code]) {
        const existing = checkedInHistory[code]
        const newCount = existing.count + 1
        setCheckedInHistory((prev) => ({
          ...prev,
          [code]: { ...existing, count: newCount },
        }))

        if (soundEnabled) driverHardware.playCue('ticketDuplicate')

        const dupResult: ScanResultItem = {
          id: resultId,
          status: 'duplicate',
          ticketCode: code,
          passengerName: existing.passengerName,
          firstScannedAt: existing.scannedAt,
          scanCount: newCount,
          message: `CANH BAO: Ve nay da duoc check-in luc ${existing.scannedAt}! Da quet ${newCount} lan.`,
          timestamp: nowStr,
        }

        setCurrentResult(dupResult)
        setScanHistory((prev) => [dupResult, ...prev.slice(0, 9)])
        setIsVerifying(false)
        return
      }

      // B. GỌI API BACKEND XÁC THỰC VÉ VÀ TRẠNG THÁI CHỮ KÝ HMAC
      try {
        const res = await driverService.verifyQrTicket(code, tripId || activeTrip?.id)

        if (res.success && res.data && res.data.valid) {
          const passenger = res.data.passenger || res.data.ticket?.user?.fullName || 'Hanh khach sinh vien'
          setCheckedInHistory((prev) => ({
            ...prev,
            [code]: { scannedAt: nowStr, passengerName: passenger, count: 1 },
          }))

          if (soundEnabled) driverHardware.playCue('ticketSuccess')

          const validResult: ScanResultItem = {
            id: resultId,
            status: 'valid',
            passengerName: passenger,
            ticketCode: code,
            seatNumber:
              res.data.seat ||
              res.data.ticket?.seatNumber ||
              (res.data.isMonthlyPass ? 'Ghe tu do (Ve thang HSSV)' : 'Ghe tieu chuan'),
            route: activeTrip?.route?.name || 'Tuyen ICTU Transit',
            pickupStation: res.data.ticket?.pickupStation?.name || 'Tram don dang ky',
            message: res.data.message || 'Ve hop le - Da ghi nhan check-in len xe thanh cong',
            timestamp: nowStr,
            scanCount: 1,
            isMonthlyPass: res.data.isMonthlyPass,
            category: res.data.category,
          }

          setCurrentResult(validResult)
          setScanHistory((prev) => [validResult, ...prev.slice(0, 9)])
          loadManifest()
        } else if (res.data?.alreadyCheckedIn) {
          if (soundEnabled) driverHardware.playCue('ticketDuplicate')

          const dupResult: ScanResultItem = {
            id: resultId,
            status: 'duplicate',
            ticketCode: code,
            passengerName: res.data.passenger,
            message: res.data.message || 'Ve nay da duoc check-in truoc do tren he thong!',
            timestamp: nowStr,
          }
          setCurrentResult(dupResult)
          setScanHistory((prev) => [dupResult, ...prev.slice(0, 9)])
        } else if (res.data?.isWrongTrip) {
          if (soundEnabled) driverHardware.playCue('ticketInvalid')

          const wrongResult: ScanResultItem = {
            id: resultId,
            status: 'wrong_trip',
            ticketCode: code,
            passengerName: res.data.passenger,
            seatNumber: res.data.seat,
            route: res.data.correctTrip?.routeName,
            message: res.data.message || 'Ve hop le nhung KHONG THUOC CHUYEN XE NAY!',
            timestamp: nowStr,
            correctTrip: res.data.correctTrip,
          }
          setCurrentResult(wrongResult)
          setScanHistory((prev) => [wrongResult, ...prev.slice(0, 9)])
        } else {
          if (soundEnabled) driverHardware.playCue('ticketInvalid')

          const invalidResult: ScanResultItem = {
            id: resultId,
            status: 'invalid',
            ticketCode: code,
            message: res.data?.message || res.message || 'Ve khong hop le hoac khong tim thay trong he thong!',
            timestamp: nowStr,
          }
          setCurrentResult(invalidResult)
          setScanHistory((prev) => [invalidResult, ...prev.slice(0, 9)])
        }
      } catch (err: any) {
        if (soundEnabled) driverHardware.playCue('ticketInvalid')
        const errResult: ScanResultItem = {
          id: resultId,
          status: 'invalid',
          ticketCode: code,
          message: err?.message || 'Loi ket noi den may chu soat ve',
          timestamp: nowStr,
        }
        setCurrentResult(errResult)
        setScanHistory((prev) => [errResult, ...prev.slice(0, 9)])
      } finally {
        setIsVerifying(false)
      }
    },
    [checkedInHistory, soundEnabled, tripId, activeTrip, loadManifest]
  )

  // 5. KHỞI ĐỘNG VÀ DỪNG CAMERA HTML5-QRCODE
  const startCamera = async () => {
    setCameraError(null)
    const readerElement = document.getElementById('qr-reader-container')
    if (!readerElement) {
      setCameraError('Khong tim thay khung hien thi camera.')
      return
    }

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader-container')
      }

      const cameraIdOrConfig = selectedCameraId
        ? { deviceId: { exact: selectedCameraId } }
        : { facingMode: 'environment' }

      await html5QrCodeRef.current.start(
        cameraIdOrConfig,
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
            const qrEdge = Math.floor(minEdge * 0.75)
            return { width: qrEdge, height: qrEdge }
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Khi phát hiện mã QR thành công từ camera
          handleVerifyTicketCode(decodedText)

          // Nếu KHÔNG ở chế độ quét liên tục -> Dừng camera để xem kết quả
          if (!isContinuousMode) {
            stopCamera()
          }
        },
        () => {
          // Bỏ qua lỗi parse frame định kỳ của camera
        }
      )

      setIsCameraActive(true)
    } catch (err: any) {
      console.warn('[DriverScanner] Loi khoi dong camera:', err)
      setCameraError(err?.message || 'Khong the truy cap camera. Vui long cap quyen camera.')
      setIsCameraActive(false)
    }
  }

  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop()
      } catch (e) {
        console.warn('[DriverScanner] Loi dung camera:', e)
      }
    }
    setIsCameraActive(false)
  }

  // Tự động dừng camera khi unmount hoặc chuyển tab
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {})
      }
    }
  }, [])

  // Đổi camera trước / sau
  const handleSwitchCamera = async () => {
    if (cameras.length <= 1) return
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId)
    const nextIndex = (currentIndex + 1) % cameras.length
    const nextCamera = cameras[nextIndex]
    setSelectedCameraId(nextCamera.id)

    if (isCameraActive) {
      await stopCamera()
      setTimeout(() => {
        startCamera()
      }, 300)
    }
  }

  // Bật / Tắt đèn Flash (Torch)
  const handleToggleFlashlight = async () => {
    if (!isCameraActive || !html5QrCodeRef.current) return
    try {
      const nextState = !flashlight
      // html5-qrcode torch API
      await (html5QrCodeRef.current as any).applyVideoConstraints({
        advanced: [{ torch: nextState }],
      })
      setFlashlight(nextState)
    } catch (e) {
      console.warn('[DriverScanner] Thiet bi khong ho tro den flash:', e)
    }
  }

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    handleVerifyTicketCode(manualCode)
    setManualCode('')
  }

  // Sĩ số xe buýt
  const checkedInCount = manifest.filter((m) => m.status === 'CHECKED_IN').length
  const totalBooked = manifest.length
  const busCapacity = activeTrip?.vehicle?.capacity || 28

  // Lọc manifest
  const filteredManifest = manifest.filter((p) => {
    const isChecked = p.status === 'CHECKED_IN'
    const nameMatch = (p.passengerName || 'Hanh khach').toLowerCase().includes(manifestSearch.toLowerCase())
    const seatMatch = (p.seatNumber || '').toLowerCase().includes(manifestSearch.toLowerCase())
    const phoneMatch = (p.passengerPhone || '').includes(manifestSearch)
    const codeMatch = (p.ticketCode || '').toLowerCase().includes(manifestSearch.toLowerCase())

    const matchesSearch = nameMatch || seatMatch || phoneMatch || codeMatch
    if (!matchesSearch) return false

    if (manifestFilter === 'checked') return isChecked
    if (manifestFilter === 'pending') return !isChecked
    return true
  })

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 font-sans select-none pb-8">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={() => {
                stopCamera()
                onBack()
              }}
              className="flex size-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 cursor-pointer shadow-2xs"
            >
              <ArrowLeft size={18} strokeWidth={2} />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 border border-emerald-300 dark:border-emerald-800">
                May Soat Ve Chuyen Dung
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {activeTrip?.route?.routeCode || 'CT-01'}
              </span>
            </div>
            <h1 className="text-lg font-black tracking-tight text-foreground sm:text-xl">
              Xe {activeTrip?.vehicle?.plateNumber || '20B-009.77'} • Soat Ve QR
            </h1>
          </div>
        </div>

        {/* Nút điều khiển âm thanh & flash */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            className={`flex size-9 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
              soundEnabled
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-border bg-card text-muted-foreground'
            }`}
            title={soundEnabled ? 'Am thanh & Rung dang bat' : 'Am thanh & Rung dang tat'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          {isCameraActive && (
            <button
              type="button"
              onClick={handleToggleFlashlight}
              className={`flex size-9 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                flashlight
                  ? 'border-amber-500/30 bg-amber-500/20 text-amber-600'
                  : 'border-border bg-card text-muted-foreground'
              }`}
              title="Bat/Tat den Flash soi toi"
            >
              <Flashlight size={16} />
            </button>
          )}
          {cameras.length > 1 && (
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Doi camera truoc / sau"
            >
              <SwitchCamera size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Overview Stat Badges: Sĩ số xe buýt */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl border border-border bg-card p-2.5 shadow-2xs">
          <p className="text-[11px] font-medium text-muted-foreground">Suc chua xe</p>
          <p className="mt-0.5 text-xl font-black text-foreground font-mono">{busCapacity}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-emerald-800 dark:text-emerald-300 shadow-2xs">
          <p className="text-[11px] font-bold">Da len xe</p>
          <p className="mt-0.5 text-xl font-black font-mono">{checkedInCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-800 dark:text-amber-300 shadow-2xs">
          <p className="text-[11px] font-bold">Cho don</p>
          <p className="mt-0.5 text-xl font-black font-mono">{Math.max(0, totalBooked - checkedInCount)}</p>
        </div>
      </div>

      {/* Tabs Chuyển Đổi: Máy Quét vs Danh Sách Hành Khách vs Lịch Sử Quét */}
      <div className="flex rounded-2xl bg-muted/60 p-1 text-xs font-bold border border-border">
        <button
          type="button"
          onClick={() => setCurrentTab('scanner')}
          className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            currentTab === 'scanner'
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <QrCode size={14} />
          <span>May Quet QR</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setCurrentTab('manifest')
            loadManifest()
          }}
          className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            currentTab === 'manifest'
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users size={14} />
          <span>Hanh Khach ({checkedInCount}/{totalBooked})</span>
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('history')}
          className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            currentTab === 'history'
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <History size={14} />
          <span>Lich Su ({scanHistory.length})</span>
        </button>
      </div>

      {/* ===================================================================
          TAB 1: MÁY QUÉT QR & CAMERA VIEW CHUYÊN DỤNG
          =================================================================== */}
      {currentTab === 'scanner' && (
        <div className="flex flex-col gap-3">
          {/* Thanh Công Tắc: Chế độ quét liên tục (Continuous Scanning Mode) */}
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-2.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <Zap size={16} className={isContinuousMode ? 'text-amber-500' : 'text-muted-foreground'} />
              <div>
                <p className="text-xs font-bold text-foreground">Che Do Quet Lien Tuc (Continuous)</p>
                <p className="text-[10px] text-muted-foreground">
                  {isContinuousMode
                    ? 'Camera giu luong video quet lien tuc cho nhieu hanh khach'
                    : 'Dung camera sau moi luot quet de xem chi tiet'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsContinuousMode((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                isContinuousMode ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isContinuousMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Khung Camera Viewfinder Chuyên Dụng Html5Qrcode */}
          <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-4 text-white shadow-2xl border border-slate-800">
            {/* Vùng gắn stream html5-qrcode */}
            <div className="relative mx-auto aspect-square w-full max-w-[290px] rounded-2xl overflow-hidden border-2 border-dashed border-emerald-500/40 bg-black/60 flex items-center justify-center">
              <div id="qr-reader-container" className="h-full w-full object-cover" />

              {/* Viewfinder Target Focus Corners */}
              <div className="absolute inset-4 rounded-xl border-2 border-emerald-400/80 pointer-events-none z-10">
                <span className="absolute -left-1 -top-1 size-4 border-l-4 border-t-4 border-emerald-400" />
                <span className="absolute -right-1 -top-1 size-4 border-r-4 border-t-4 border-emerald-400" />
                <span className="absolute -bottom-1 -left-1 size-4 border-b-4 border-l-4 border-emerald-400" />
                <span className="absolute -bottom-1 -right-1 size-4 border-b-4 border-r-4 border-emerald-400" />
              </div>

              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center z-10 bg-slate-950/80 backdrop-blur-2xs">
                  <ScanLine className="size-14 text-emerald-400/80 animate-pulse" />
                  <p className="text-xs font-bold text-emerald-300">
                    Camera dang o trang thai cho
                  </p>
                  <p className="text-[10px] text-white/50 max-w-[200px]">
                    Bam nut ben duoi de kich hoat camera quet ma QR ve dien tu
                  </p>
                </div>
              )}

              {/* Lớp phủ xoay kiểm tra vé */}
              {isVerifying && (
                <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-2 rounded-xl backdrop-blur-xs z-20">
                  <Loader2 className="size-8 text-emerald-400 animate-spin" />
                  <p className="text-xs font-bold text-emerald-300">Dang kiem tra chu ky ve...</p>
                </div>
              )}
            </div>

            {/* Nút Bật / Tắt Camera */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={isCameraActive ? stopCamera : startCamera}
                className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-black transition-all cursor-pointer shadow-md ${
                  isCameraActive
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'bg-emerald-500 text-white hover:bg-emerald-400'
                }`}
              >
                {isCameraActive ? (
                  <>
                    <VideoOff size={15} />
                    <span>Tat Camera Live</span>
                  </>
                ) : (
                  <>
                    <Video size={15} />
                    <span>Bat Camera Quet QR</span>
                  </>
                )}
              </button>
            </div>

            {cameraError && (
              <p className="text-center text-xs text-rose-400 mt-2 font-medium px-2">{cameraError}</p>
            )}

            {/* Ô Nhập Mã Vé Thủ Công (Manual Fallback) */}
            <form onSubmit={handleManualSearch} className="mt-4 flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Nhap ma ve (VD: TKT-ICTU-... hoac dan chu ky)..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 text-xs text-white placeholder:text-white/40 focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isVerifying || !manualCode.trim()}
                className="flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-xs font-bold text-white transition-all hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
              >
                {isVerifying ? <Loader2 size={15} className="animate-spin" /> : 'Kiem tra'}
              </button>
            </form>
          </div>

          {/* ===================================================================
              TASK 2: MÀN HÌNH PHẢN HỒI THỊ GIÁC TỨC THÌ (INSTANT FEEDBACK)
              XANH LÁ (valid) | VÀNG (duplicate) | CAM (wrong_trip) | ĐỎ (invalid)
              =================================================================== */}
          {currentResult && (
            <div
              className={`rounded-3xl border-2 p-4 shadow-xl transition-all animate-in fade-in zoom-in-95 ${
                currentResult.status === 'valid'
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-950 dark:text-emerald-50 ring-4 ring-emerald-500/20'
                  : currentResult.status === 'wrong_trip'
                  ? 'border-orange-500 bg-orange-500/15 text-orange-950 dark:text-orange-50 ring-4 ring-orange-500/20'
                  : currentResult.status === 'duplicate'
                  ? 'border-amber-500 bg-amber-500/15 text-amber-950 dark:text-amber-50 ring-4 ring-amber-500/20'
                  : 'border-rose-500 bg-rose-500/15 text-rose-950 dark:text-rose-50 ring-4 ring-rose-500/20'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {currentResult.status === 'valid' && (
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shrink-0">
                      <CheckCircle2 size={24} />
                    </div>
                  )}
                  {currentResult.status === 'wrong_trip' && (
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-md shrink-0 animate-bounce">
                      <AlertTriangle size={24} />
                    </div>
                  )}
                  {currentResult.status === 'duplicate' && (
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-600 text-white shadow-md shrink-0">
                      <AlertTriangle size={24} />
                    </div>
                  )}
                  {currentResult.status === 'invalid' && (
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-md shrink-0">
                      <XCircle size={24} />
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider opacity-75">
                      {currentResult.status === 'valid'
                        ? 'XAC THUC THANH CONG'
                        : currentResult.status === 'wrong_trip'
                        ? 'CANH BAO SAI CHUYEN'
                        : currentResult.status === 'duplicate'
                        ? 'CANH BAO TRUNG LAP'
                        : 'VE KHONG HOP LE'}
                    </span>
                    <h3 className="text-base font-black leading-tight">
                      {currentResult.status === 'valid'
                        ? 'Ve Hop Le - Cho Phep Len Xe'
                        : currentResult.status === 'wrong_trip'
                        ? 'Khach Di Nham Chuyen Xe!'
                        : currentResult.status === 'duplicate'
                        ? 'Ve Da Quet Truoc Do!'
                        : 'Ve Khong Hop Le Hoac Bi Huy!'}
                    </h3>
                  </div>
                </div>
                <span className="font-mono text-xs opacity-70 font-bold">{currentResult.timestamp}</span>
              </div>

              {/* Chi tiết vé */}
              <div className="mt-3.5 grid grid-cols-2 gap-2 rounded-2xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-black/30 p-3 text-xs">
                {currentResult.isMonthlyPass && (
                  <div className="col-span-2 py-1.5 px-3 rounded-xl bg-teal-500/20 text-teal-900 dark:text-teal-200 font-black text-[11px] flex items-center justify-between border border-teal-500/30">
                    <span>[V] THE VE THANG HSSV HOP LE</span>
                    <span className="uppercase text-[10px] tracking-wider opacity-80">
                      {currentResult.category || 'Sinh vien ICTU'}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-[11px] opacity-70">Hanh khach:</span>
                  <p className="font-black text-sm">{currentResult.passengerName || 'Hanh khach'}</p>
                </div>
                <div>
                  <span className="text-[11px] opacity-70">Ma ve:</span>
                  <p className="font-mono font-bold">{currentResult.ticketCode}</p>
                </div>
                <div>
                  <span className="text-[11px] opacity-70">Vi tri ghe:</span>
                  <p className="font-black text-emerald-800 dark:text-emerald-300">
                    {currentResult.seatNumber || 'Ghe tu do'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] opacity-70">Trang thai:</span>
                  <p
                    className={`font-black ${
                      currentResult.status === 'valid'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : currentResult.status === 'wrong_trip'
                        ? 'text-orange-700 dark:text-orange-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {currentResult.status === 'valid'
                      ? 'Da len xe'
                      : currentResult.status === 'wrong_trip'
                      ? 'Sai chuyen'
                      : 'Chua hop le'}
                  </p>
                </div>

                {/* Thông tin chuyến đúng nếu khách đi nhầm */}
                {currentResult.correctTrip && (
                  <div className="col-span-2 pt-2 mt-1 border-t border-orange-300/40 text-orange-950 dark:text-orange-200">
                    <p className="text-[11px] font-bold">[-] Thong tin chuyen dung cua khach:</p>
                    <p className="font-medium text-xs mt-0.5">
                      • Tuyen: <strong>{currentResult.correctTrip.routeName || 'Tuyen ICTU'}</strong>
                    </p>
                    {currentResult.correctTrip.departureTime && (
                      <p className="font-medium text-xs">
                        • Gio chay: <strong>
                          {new Date(currentResult.correctTrip.departureTime).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                        </strong>
                      </p>
                    )}
                    {currentResult.correctTrip.vehiclePlate && (
                      <p className="font-medium text-xs">
                        • Bien so xe: <strong>{currentResult.correctTrip.vehiclePlate}</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Phím tắt Kịch Bản Test Nhanh 1-Chạm (1-Click Presets) */}
          <div className="rounded-2xl border border-border bg-card p-3 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                Kich Ban Test Nhanh (1-Click Presets Cho Demo)
              </span>
              <span className="text-[10px] text-muted-foreground">Thu nghiem 4 kich ban</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  const firstPaid = manifest.find((m) => m.status === 'PAID') || manifest[0]
                  if (firstPaid) {
                    handleVerifyTicketCode(firstPaid.ticketCode)
                  } else {
                    handleVerifyTicketCode('TKT-ICTU-2026-DEMO01')
                  }
                }}
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2 text-left hover:bg-emerald-500/20 transition-all cursor-pointer"
              >
                <p className="font-black text-emerald-800 dark:text-emerald-300">[1] Ve hop le</p>
                <p className="text-[10px] text-muted-foreground truncate">Dung chuyen, chua len xe</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (currentResult?.ticketCode) {
                    handleVerifyTicketCode(currentResult.ticketCode)
                  } else {
                    handleVerifyTicketCode('TKT-ICTU-2026-DEMO01')
                  }
                }}
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-left hover:bg-amber-500/20 transition-all cursor-pointer"
              >
                <p className="font-black text-amber-800 dark:text-amber-300">[2] Quet lai (Trung lap)</p>
                <p className="text-[10px] text-muted-foreground truncate">Canh bao da check-in</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleVerifyTicketCode('TKT-WRONG-TRIP-999')
                }}
                className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-2 text-left hover:bg-orange-500/20 transition-all cursor-pointer"
              >
                <p className="font-black text-orange-800 dark:text-orange-300">[3] Di nham chuyen</p>
                <p className="text-[10px] text-muted-foreground truncate">Ve khong thuoc xe nay</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleVerifyTicketCode('TKT-FAKE-INVALID-000')
                }}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-left hover:bg-rose-500/20 transition-all cursor-pointer"
              >
                <p className="font-black text-rose-800 dark:text-rose-300">[4] Ve khong ton tai</p>
                <p className="text-[10px] text-muted-foreground truncate">Ve gia mao hoac bi huy</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 2: DANH SÁCH HÀNH KHÁCH MANIFEST CHECKLIST
          =================================================================== */}
      {currentTab === 'manifest' && (
        <div className="rounded-3xl border border-border bg-card p-4 space-y-3 shadow-sm">
          {/* Header Manifest */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-foreground">Danh Sach Hanh Khach Len Xe</h3>
              <p className="text-xs text-muted-foreground">
                Da len xe: {checkedInCount} / Tong {totalBooked} ve da dat
              </p>
            </div>
            <button
              type="button"
              onClick={loadManifest}
              disabled={isLoadingManifest}
              className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <RefreshCw size={14} className={isLoadingManifest ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Thanh tìm kiếm & bộ lọc */}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tim theo ten, so ghe (03B), SDT, ma ve..."
                value={manifestSearch}
                onChange={(e) => setManifestSearch(e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex rounded-xl border border-border bg-muted/40 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setManifestFilter('all')}
                className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  manifestFilter === 'all' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'
                }`}
              >
                Tat ca ({totalBooked})
              </button>
              <button
                type="button"
                onClick={() => setManifestFilter('checked')}
                className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  manifestFilter === 'checked' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'
                }`}
              >
                Da len ({checkedInCount})
              </button>
              <button
                type="button"
                onClick={() => setManifestFilter('pending')}
                className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  manifestFilter === 'pending' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'
                }`}
              >
                Cho don ({Math.max(0, totalBooked - checkedInCount)})
              </button>
            </div>
          </div>

          {/* Danh sách hành khách cuộn */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {isLoadingManifest ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <RefreshCw size={20} className="animate-spin text-emerald-500" />
                <p>Dang tai danh sach tu may chu...</p>
              </div>
            ) : filteredManifest.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">
                {totalBooked === 0
                  ? 'Chua co hanh khach nao dat ve tren chuyen xe nay.'
                  : 'Khong tim thay hanh khach phu hop.'}
              </p>
            ) : (
              filteredManifest.map((item, idx) => {
                const isCheckedIn = item.status === 'CHECKED_IN'
                return (
                  <div
                    key={item.ticketId || item.ticketCode || idx}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-xs transition-all ${
                      isCheckedIn
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-border bg-background'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`size-9 rounded-xl flex items-center justify-center font-black text-xs font-mono ${
                          isCheckedIn
                            ? 'bg-emerald-500 text-white shadow-2xs'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}
                      >
                        {item.seatNumber || '01'}
                      </div>
                      <div>
                        <p className="font-black text-foreground text-sm">
                          {item.passengerName || 'Hanh khach'}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                          <span>{item.ticketCode}</span>
                          {item.passengerPhone && (
                            <>
                              <span>•</span>
                              <span>{item.passengerPhone}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {isCheckedIn ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          <Check size={11} strokeWidth={3} />
                          <span>Da len xe</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentTab('scanner')
                            handleVerifyTicketCode(item.ticketCode)
                          }}
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition active:scale-95 cursor-pointer shadow-2xs"
                        >
                          Check-in
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 3: LỊCH SỬ CÁC VÉ VỪA QUÉT TRONG CA (SCAN FEED)
          =================================================================== */}
      {currentTab === 'history' && (
        <div className="rounded-3xl border border-border bg-card p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-foreground">Lich Su Soat Ve Trong Ca</h3>
              <p className="text-xs text-muted-foreground">Tong so luot da quet: {scanHistory.length}</p>
            </div>
            {scanHistory.length > 0 && (
              <button
                type="button"
                onClick={() => setScanHistory([])}
                className="text-[11px] text-muted-foreground hover:text-rose-500 cursor-pointer font-bold"
              >
                Xoa lich su
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-[380px] overflow-y-auto">
            {scanHistory.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">
                Chua co luot quet nao duoc ghi nhan trong phien lam viec nay.
              </p>
            ) : (
              scanHistory.map((scan) => (
                <div
                  key={scan.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border text-xs ${
                    scan.status === 'valid'
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : scan.status === 'wrong_trip'
                      ? 'border-orange-500/20 bg-orange-500/5'
                      : scan.status === 'duplicate'
                      ? 'border-amber-500/20 bg-amber-500/5'
                      : 'border-rose-500/20 bg-rose-500/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {scan.status === 'valid' && (
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    )}
                    {scan.status === 'wrong_trip' && (
                      <AlertTriangle size={16} className="text-orange-500 shrink-0" />
                    )}
                    {scan.status === 'duplicate' && (
                      <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                    )}
                    {scan.status === 'invalid' && (
                      <XCircle size={16} className="text-rose-500 shrink-0" />
                    )}
                    <div>
                      <p className="font-bold text-foreground">
                        {scan.passengerName || scan.ticketCode}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {scan.seatNumber ? `Ghe ${scan.seatNumber} • ` : ''}
                        {scan.ticketCode}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{scan.timestamp}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
