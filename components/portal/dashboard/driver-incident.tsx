'use client'

/**
 * Giao diện Báo Cáo Sự Cố Chuyến Xe cho Tài Xế & Phụ Xe (Driver Incident Portal)
 * Thiết kế công thái học Driver-First:
 *  - Phím bấm siêu to, dễ thao tác một chạm trên di động khi xe rung lắc
 *  - 6 thẻ preset phân loại sự cố trực quan
 *  - Hàng Quick Pills chọn nhanh số phút trễ (+5p, +10p, +15p, +30p, >45p)
 *  - Chọn 4 mức độ nghiêm trọng (Thấp, Trung bình, Nghiêm trọng, Khẩn cấp)
 *  - Nút phát cảnh báo khẩn cấp tích hợp haptic warning & loading
 *  - Quản lý danh sách sự cố đang mở (Pending) & 1 chạm Giải tỏa / Khôi phục chuyến xe
 *
 * Domain: Incident Management & Real-time Alert
 * Branch: feature/SBTS-frontend-incident-management-and-realtime-alerts
 */

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Send,
  Siren,
  Wrench,
  CloudRain,
  Timer,
  FileText,
  Check,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  Loader2,
  Bus,
  Sparkles,
  ShieldAlert,
  X,
} from 'lucide-react'
import { trackingService } from '@/lib/services/tracking.service'
import { haptic } from '@/lib/utils/haptics'
import type {
  IncidentType,
  TripIncident,
} from '@/lib/types/tracking'
import {
  INCIDENT_TYPE_LABEL,
  INCIDENT_SEVERITY_COLOR,
  INCIDENT_SEVERITY_LABEL,
} from '@/lib/types/tracking'

interface DriverIncidentProps {
  tripId?: string
  onBack?: () => void
}

type SeverityOption = 'minor' | 'moderate' | 'severe' | 'critical'

interface PresetItem {
  id: IncidentType
  label: string
  sublabel: string
  icon: any
  defaultMinutes: number
  color: string
  borderColor: string
  bgColor: string
  activeRing: string
}

const PRESET_TYPES: PresetItem[] = [
  {
    id: 'traffic_jam',
    label: 'Ùn tắc giao thông',
    sublabel: 'Kẹt xe giờ cao điểm / công trường',
    icon: Clock,
    defaultMinutes: 15,
    color: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-300 dark:border-amber-700',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    activeRing: 'ring-amber-500 border-amber-500',
  },
  {
    id: 'breakdown',
    label: 'Sự cố xe / Hỏng kỹ thuật',
    sublabel: 'Hỏng máy, nổ lốp, lỗi ắc quy',
    icon: Wrench,
    defaultMinutes: 30,
    color: 'text-rose-600 dark:text-rose-400',
    borderColor: 'border-rose-300 dark:border-rose-700',
    bgColor: 'bg-rose-50 dark:bg-rose-950/30',
    activeRing: 'ring-rose-500 border-rose-500',
  },
  {
    id: 'accident',
    label: 'Va chạm / Tai nạn',
    sublabel: 'Va chạm trên đường, chờ xử lý',
    icon: Siren,
    defaultMinutes: 45,
    color: 'text-red-700 dark:text-red-400',
    borderColor: 'border-red-400 dark:border-red-700',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    activeRing: 'ring-red-600 border-red-600',
  },
  {
    id: 'weather',
    label: 'Thời tiết xấu / Ngập úng',
    sublabel: 'Mưa to bão lớn, đường ngập',
    icon: CloudRain,
    defaultMinutes: 20,
    color: 'text-sky-600 dark:text-sky-400',
    borderColor: 'border-sky-300 dark:border-sky-700',
    bgColor: 'bg-sky-50 dark:bg-sky-950/30',
    activeRing: 'ring-sky-500 border-sky-500',
  },
  {
    id: 'delay',
    label: 'Trễ xuất bến / Chờ khách',
    sublabel: 'Chờ sinh viên, xử lý hành lý',
    icon: Timer,
    defaultMinutes: 10,
    color: 'text-orange-600 dark:text-orange-400',
    borderColor: 'border-orange-300 dark:border-orange-700',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    activeRing: 'ring-orange-500 border-orange-500',
  },
  {
    id: 'other',
    label: 'Sự cố phát sinh khác',
    sublabel: 'Cấm đường, điều chuyển hướng',
    icon: FileText,
    defaultMinutes: 15,
    color: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-300 dark:border-purple-700',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    activeRing: 'ring-purple-500 border-purple-500',
  },
]

const QUICK_MINUTES = [5, 10, 15, 30, 45, 60]

const QUICK_LOCATION_SNIPPETS = [
  'Ngã tư Ga Thái Nguyên',
  'Đường Z115 cổng ICTU',
  'Đường Lương Ngọc Quyến',
  'Cầu Gia Bảy',
  'Bến xe TT Thái Nguyên',
  'Đoạn ngã ba Mỏ Bạch',
]

const RESOLUTION_PRESETS = [
  'Đoạn đường đã thông thoáng, tiếp tục đón khách bình thường',
  'Xe đã khắc phục xong sự cố kỹ thuật, tiếp tục lộ trình',
  'Giao thông ổn định trở lại, xe đang đón khách theo lịch',
  'Đã xử lý xong hiện trường, xe tiếp tục hành trình',
]

export function DriverIncident({
  tripId = '5f8d76d7-717b-4904-ac52-dd64b0a515c0',
  onBack,
}: DriverIncidentProps) {
  const [currentTripId, setCurrentTripId] = useState(tripId)
  const [showTripIdInput, setShowTripIdInput] = useState(false)

  // Form State
  const [selectedType, setSelectedType] = useState<IncidentType>('traffic_jam')
  const [selectedSeverity, setSelectedSeverity] = useState<SeverityOption>('moderate')
  const [delayMinutes, setDelayMinutes] = useState<number>(15)
  const [customMinutes, setCustomMinutes] = useState<string>('15')
  const [description, setDescription] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedbackToast, setFeedbackToast] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // Incident List State
  const [incidents, setIncidents] = useState<TripIncident[]>([])
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(false)
  const [tripRecoveryBanner, setTripRecoveryBanner] = useState<string | null>(null)

  // Resolve Dialog State
  const [resolvingIncident, setResolvingIncident] = useState<TripIncident | null>(null)
  const [resolutionNote, setResolutionNote] = useState<string>(RESOLUTION_PRESETS[0])
  const [isResolving, setIsResolving] = useState(false)

  // Load incidents for trip
  const loadTripIncidents = useCallback(async () => {
    if (!currentTripId) return
    setIsLoadingIncidents(true)
    try {
      const res = await trackingService.getTripIncidents(currentTripId)
      if (res.success && res.data) {
        setIncidents(res.data)
      }
    } finally {
      setIsLoadingIncidents(false)
    }
  }, [currentTripId])

  useEffect(() => {
    loadTripIncidents()
  }, [loadTripIncidents])

  // Select incident type and sync default minutes
  const handleSelectType = (preset: PresetItem) => {
    setSelectedType(preset.id)
    setDelayMinutes(preset.defaultMinutes)
    setCustomMinutes(String(preset.defaultMinutes))
    haptic.play('select')
  }

  // Handle Quick Delay Pill click
  const handleQuickMinute = (mins: number) => {
    setDelayMinutes(mins)
    setCustomMinutes(String(mins))
    haptic.play('tap')
  }

  // Append quick location snippet to description
  const handleAddLocationSnippet = (snippet: string) => {
    setDescription((prev) => {
      const trimmed = prev.trim()
      if (!trimmed) return `Đang gặp sự cố tại ${snippet}`
      return `${trimmed} (tại ${snippet})`
    })
    haptic.play('tap')
  }

  // Submit Driver Incident Report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault()

    const finalDescription = description.trim() || `Tài xế báo cáo: ${INCIDENT_TYPE_LABEL[selectedType]}`
    const finalDelay = Math.max(1, parseInt(customMinutes, 10) || delayMinutes || 15)

    setIsSubmitting(true)
    haptic.notification('warning')

    try {
      const res = await trackingService.reportIncident({
        tripId: currentTripId,
        incidentType: selectedType,
        incidentSeverity: selectedSeverity,
        severity: selectedSeverity,
        description: finalDescription,
        delayMinutesEstimate: finalDelay,
      })

      if (res.success) {
        haptic.play('success')
        setFeedbackToast({
          type: 'success',
          message: `Đã phát cảnh báo khẩn cấp thành công! Chuyến xe chuyển sang trạng thái Trễ (+${finalDelay} phút).`,
        })
        setDescription('')
        await loadTripIncidents()
      } else {
        haptic.play('warning')
        setFeedbackToast({
          type: 'error',
          message: res.message || 'Không thể gửi báo cáo sự cố. Vui lòng thử lại.',
        })
      }
    } catch (err: any) {
      haptic.play('warning')
      setFeedbackToast({
        type: 'error',
        message: err?.message || 'Lỗi kết nối máy chủ.',
      })
    } finally {
      setIsSubmitting(false)
      setTimeout(() => setFeedbackToast(null), 5000)
    }
  }

  // Resolve an incident
  const handleConfirmResolve = async () => {
    if (!resolvingIncident) return

    setIsResolving(true)
    haptic.play('tap')

    try {
      const res = await trackingService.resolveIncident(
        resolvingIncident.id,
        resolutionNote || 'Đoạn đường đã thông thoáng, tiếp tục đón khách bình thường',
      )

      if (res.success) {
        haptic.play('success')
        setResolvingIncident(null)
        setTripRecoveryBanner(
          '✅ Chuyến xe đã khôi phục trạng thái hoạt động bình thường! Lộ trình đã được đồng bộ tới toàn bộ hành khách.',
        )
        await loadTripIncidents()
        setTimeout(() => setTripRecoveryBanner(null), 8000)
      } else {
        haptic.play('warning')
        setFeedbackToast({
          type: 'error',
          message: res.message || 'Không thể giải tỏa sự cố.',
        })
        setTimeout(() => setFeedbackToast(null), 4000)
      }
    } catch (err: any) {
      haptic.play('warning')
      setFeedbackToast({
        type: 'error',
        message: err?.message || 'Lỗi khi gửi yêu cầu giải tỏa.',
      })
      setTimeout(() => setFeedbackToast(null), 4000)
    } finally {
      setIsResolving(false)
    }
  }

  const pendingIncidents = incidents.filter(
    (i) => i.resolutionStatus === 'pending' || (!i.resolvedAt && i.resolutionStatus !== 'resolved'),
  )

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-5 pb-12">
      {/* 1. Header Bar: Ergonomic Back & Title */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-card p-4 sm:p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 shrink-0 cursor-pointer touch-press"
              title="Quay lại bảng điều khiển"
            >
              <ArrowLeft size={20} strokeWidth={2} />
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                <ShieldAlert size={12} />
                Driver Alert
              </span>
              <span className="text-[11px] font-mono text-slate-500 font-bold truncate">
                Xe 20B-009.77
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
              Báo Cáo Sự Cố Chuyến Xe
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Chạm 1 lần để báo cáo và đồng bộ thời gian thực tới hành khách
            </p>
          </div>
        </div>

        {/* Quick Link to Live Tracking */}
        <a
          href={`/tracking/${currentTripId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-[#005A36] text-xs font-bold hover:bg-emerald-100 transition-colors shrink-0"
        >
          <ExternalLink size={13} />
          <span>Xem Live View</span>
        </a>
      </div>

      {/* Trip Selector / Custom Trip ID Pill */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/70 dark:bg-card p-3 text-xs flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <Bus size={16} className="text-[#005A36] shrink-0" />
          <span className="font-bold text-slate-700 dark:text-slate-200">Chuyến hiện tại:</span>
          <span className="font-mono text-slate-500 truncate max-w-[180px] sm:max-w-xs">
            {currentTripId}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowTripIdInput(!showTripIdInput)}
          className="text-emerald-700 font-bold hover:underline shrink-0 text-[11px] cursor-pointer"
        >
          {showTripIdInput ? 'Ẩn' : 'Đổi mã chuyến'}
        </button>
      </div>

      {showTripIdInput && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2 animate-in fade-in">
          <label className="text-xs font-bold text-emerald-950 block">
            Nhập ID Chuyến Xe (UUID để test đồng bộ nhiều màn hình):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={currentTripId}
              onChange={(e) => setCurrentTripId(e.target.value.trim())}
              placeholder="5f8d76d7-717b-4904-ac52-dd64b0a515c0"
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => {
                setShowTripIdInput(false)
                loadTripIncidents()
                haptic.play('tap')
              }}
              className="px-3 py-2 bg-[#005A36] text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {feedbackToast && (
        <div
          className={`rounded-2xl p-4 text-xs font-bold shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2 ${
            feedbackToast.type === 'success'
              ? 'bg-[#005A36] text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackToast.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
            <span>{feedbackToast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackToast(null)}
            className="text-white/80 hover:text-white cursor-pointer px-1 touch-press"
          >
            ✕
          </button>
        </div>
      )}

      {/* Banner Khôi Phục Chuyến Xe Thành Công */}
      {tripRecoveryBanner && (
        <div className="rounded-2xl sm:rounded-3xl border-2 border-emerald-500 bg-emerald-500/15 p-4 sm:p-5 text-emerald-950 shadow-md animate-in fade-in slide-in-from-top-2 flex items-start gap-3.5">
          <div className="size-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <CheckCircle2 size={24} className="stroke-[2.5]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-base font-extrabold text-emerald-950">
              Chuyến xe đã khôi phục trạng thái bình thường!
            </h3>
            <p className="text-xs text-emerald-900 mt-0.5 leading-relaxed">
              {tripRecoveryBanner}
            </p>
          </div>
        </div>
      )}

      {/* 2. QUẢN LÝ SỰ CỐ ĐANG DIỄN RA (ACTIVE PENDING INCIDENTS) */}
      {pendingIncidents.length > 0 && (
        <div className="rounded-3xl border-2 border-amber-500/80 bg-amber-50/50 dark:bg-amber-950/20 p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-rose-600 animate-ping" />
              <h2 className="text-sm sm:text-base font-black text-amber-950 dark:text-amber-200">
                Sự Cố Đang Diễn Ra ({pendingIncidents.length})
              </h2>
            </div>
            <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200">
              Trạng thái: DELAYED
            </span>
          </div>

          <div className="space-y-3">
            {pendingIncidents.map((incident) => {
              const sev = incident.severity || 'medium'
              const colorInfo = INCIDENT_SEVERITY_COLOR[sev] || INCIDENT_SEVERITY_COLOR['medium']

              return (
                <div
                  key={incident.id}
                  className="rounded-2xl border border-amber-300/80 bg-white dark:bg-card p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {INCIDENT_TYPE_LABEL[incident.incidentType || incident.type] || incident.type}
                        </span>
                        {incident.delayMinutesEstimate != null && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                            ⏱️ Trễ ~{incident.delayMinutesEstimate} phút
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Báo cáo lúc: {formatTime(incident.reportedAt)}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${colorInfo.bg} ${colorInfo.text} ${colorInfo.border}`}
                    >
                      Mức: {INCIDENT_SEVERITY_LABEL[sev] || sev}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/60 font-medium">
                    {incident.description || 'Không có mô tả chi tiết'}
                  </p>

                  {/* Nút 1 chạm: ĐÃ GIẢI TỎA / KHÔI PHỤC CHUYẾN XE */}
                  <button
                    type="button"
                    onClick={() => {
                      setResolvingIncident(incident)
                      setResolutionNote(RESOLUTION_PRESETS[0])
                      haptic.play('tap')
                    }}
                    className="w-full min-h-12 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-[#005A36] text-white font-extrabold text-xs sm:text-sm shadow-md hover:from-emerald-500 hover:to-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer touch-press"
                  >
                    <CheckCircle2 size={18} />
                    <span>✅ ĐÃ GIẢI TỎA / KHÔI PHỤC CHUYẾN XE</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. LỰA CHỌN LOẠI SỰ CỐ: LƯỚI 6 THẺ PRESET */}
      <section className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
            1. Chọn loại sự cố (Chạm 1 lần để chọn)
          </p>
          <span className="text-[10px] text-slate-400 font-semibold">6 lựa chọn</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {PRESET_TYPES.map((preset) => {
            const Icon = preset.icon
            const isSelected = selectedType === preset.id

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectType(preset)}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer touch-press active:scale-[0.98] flex items-center gap-3 ${
                  isSelected
                    ? `${preset.activeRing} ring-2 bg-gradient-to-r ${preset.bgColor} shadow-sm font-bold`
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`size-12 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-[#005A36] text-white shadow-xs' : `${preset.bgColor} ${preset.color}`
                  }`}
                >
                  <Icon size={22} className="stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                    {preset.label}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {preset.sublabel}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* 4. CHỌN SỐ PHÚT TRỄ ƯỚC TÍNH (QUICK PILLS + CUSTOM) */}
      <section className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
            2. Số phút trễ dự kiến (Ước lượng)
          </p>
          <span className="font-mono text-xs font-black text-[#005A36]">
            ~{customMinutes || delayMinutes} phút
          </span>
        </div>

        {/* Hàng Quick Pills */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {QUICK_MINUTES.map((mins) => {
            const isSelected = delayMinutes === mins && customMinutes === String(mins)
            return (
              <button
                key={mins}
                type="button"
                onClick={() => handleQuickMinute(mins)}
                className={`py-3 px-2 rounded-2xl text-xs font-extrabold border transition-all cursor-pointer touch-press text-center active:scale-95 ${
                  isSelected
                    ? 'bg-[#005A36] text-white border-[#005A36] shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border-slate-200 hover:bg-slate-100'
                }`}
              >
                +{mins} phút
              </button>
            )
          })}
        </div>

        {/* Nhập số phút tùy chỉnh */}
        <div className="pt-1 flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
            Hoặc nhập tùy chỉnh:
          </span>
          <div className="relative flex-1 max-w-[140px]">
            <input
              type="number"
              min={1}
              max={240}
              value={customMinutes}
              onChange={(e) => {
                const val = e.target.value
                setCustomMinutes(val)
                const num = parseInt(val, 10)
                if (!isNaN(num)) setDelayMinutes(num)
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono font-bold text-center focus:border-[#005A36] focus:outline-none"
              placeholder="15"
            />
            <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">
              phút
            </span>
          </div>
        </div>
      </section>

      {/* 5. CHỌN MỨC ĐỘ NGHIÊM TRỌNG */}
      <section className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
          3. Mức độ nghiêm trọng
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'minor' as SeverityOption, label: 'Thấp (Nhẹ)', color: 'text-blue-700 bg-blue-50 border-blue-200' },
            { id: 'moderate' as SeverityOption, label: 'Trung bình', color: 'text-amber-700 bg-amber-50 border-amber-200' },
            { id: 'severe' as SeverityOption, label: 'Nghiêm trọng', color: 'text-orange-700 bg-orange-50 border-orange-200' },
            { id: 'critical' as SeverityOption, label: 'Khẩn cấp', color: 'text-rose-700 bg-rose-50 border-rose-200' },
          ].map((sev) => {
            const isSelected = selectedSeverity === sev.id
            return (
              <button
                key={sev.id}
                type="button"
                onClick={() => {
                  setSelectedSeverity(sev.id)
                  haptic.play('select')
                }}
                className={`py-3 px-2 rounded-2xl text-xs font-extrabold border transition-all cursor-pointer touch-press text-center active:scale-95 ${
                  isSelected
                    ? 'ring-2 ring-slate-900 dark:ring-white shadow-sm font-black ' + sev.color
                    : 'border-slate-200 bg-white dark:bg-slate-900/40 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {sev.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* 6. MÔ TẢ HIỆN TRƯỜNG & CTA PHÁT CẢNH BÁO */}
      <form onSubmit={handleSubmitReport} className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-3.5">
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-2">
            4. Mô tả thêm hiện trường / Điểm kẹt (Tùy chọn)
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ví dụ: Đang ùn tắc dài tại ngã tư Ga Thái Nguyên, xin phép đi tuyến đường tránh gom..."
            className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/60 p-3.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          />
        </div>

        {/* Quick Location Chips */}
        <div>
          <span className="text-[11px] font-bold text-slate-500 block mb-1.5">
            Gợi ý địa điểm nhanh:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_LOCATION_SNIPPETS.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => handleAddLocationSnippet(loc)}
                className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer touch-press"
              >
                + {loc}
              </button>
            ))}
          </div>
        </div>

        {/* NÚT PHÁT CẢNH BÁO SỰ CỐ KHẨN CẤP */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full min-h-14 sm:min-h-16 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-red-800 text-white font-black text-sm sm:text-base tracking-wide shadow-xl shadow-red-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer touch-press active:scale-[0.98] disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={22} className="animate-spin" />
              <span>ĐANG PHÁT CẢNH BÁO...</span>
            </>
          ) : (
            <>
              <Send size={20} className="stroke-[2.5]" />
              <span>🚨 PHÁT CẢNH BÁO SỰ CỐ KHẨN CẤP</span>
            </>
          )}
        </button>
      </form>

      {/* 7. LỊCH SỬ SỰ CỐ GẦN ĐÂY CỦA CHUYẾN */}
      <section className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Nhật ký sự cố chuyến này ({incidents.length})
          </h4>
          <button
            type="button"
            onClick={loadTripIncidents}
            disabled={isLoadingIncidents}
            className="text-xs font-bold text-[#005A36] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={12} className={isLoadingIncidents ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>

        {incidents.length === 0 ? (
          <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
            <span>Chuyến xe hiện chưa ghi nhận sự cố nào. Lộ trình vận hành thông suốt.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {incidents.map((item) => {
              const isPending =
                item.resolutionStatus === 'pending' ||
                (!item.resolvedAt && item.resolutionStatus !== 'resolved')

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {INCIDENT_TYPE_LABEL[item.incidentType || item.type] || item.type}
                      </span>
                      {item.delayMinutesEstimate && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                          +{item.delayMinutesEstimate}p
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {item.description}
                    </p>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
                      isPending
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    {isPending ? 'Đang mở' : 'Đã giải tỏa'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 8. MODAL GIẢI TỎA / ĐÓNG SỰ CỐ NHANH */}
      {resolvingIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white dark:bg-card p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={22} className="text-emerald-600" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Giải Tỏa Sự Cố Chuyến Xe
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResolvingIncident(null)}
                className="size-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Xác nhận giải tỏa sự cố{' '}
              <strong>
                {INCIDENT_TYPE_LABEL[resolvingIncident.incidentType || resolvingIncident.type]}
              </strong>
              . Trạng thái chuyến xe sẽ được tự động khôi phục về{' '}
              <span className="text-emerald-600 font-bold">in_progress</span> (Bình thường).
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Chọn ghi chú khắc phục nhanh:
              </label>
              <div className="space-y-1.5">
                {RESOLUTION_PRESETS.map((note) => (
                  <button
                    key={note}
                    type="button"
                    onClick={() => setResolutionNote(note)}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                      resolutionNote === note
                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    • {note}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={2}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-emerald-600 focus:outline-none"
              placeholder="Ghi chú chi tiết khác nếu có..."
            />

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResolvingIncident(null)}
                className="flex-1 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmResolve}
                disabled={isResolving}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isResolving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                <span>XÁC NHẬN GIẢI TỎA</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
