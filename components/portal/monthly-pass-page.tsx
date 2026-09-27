'use client'

/**
 * Trang Vé tháng — Đăng ký & xem danh sách vé tháng của người dùng
 * File mới — không chạm file cũ
 * Branch: feature/SBTS-voucher-monthly-pass-fe
 */

import { useState, useEffect, useCallback } from 'react'
import {
  CreditCard,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  Bus,
  Calendar,
  ChevronRight,
  Loader2,
  InboxIcon,
  RefreshCw,
  GraduationCap,
  Heart,
  Briefcase,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import { promotionService } from '@/lib/services/promotion.service'
import type {
  MonthlyPass,
  MonthlyPassCategory,
  RegisterMonthlyPassPayload,
} from '@/lib/types/promotion'
import {
  APPROVAL_STATUS_COLOR,
  APPROVAL_STATUS_LABEL,
  MONTHLY_PASS_CATEGORY_LABEL,
  MONTHLY_PASS_CATEGORY_PRICE,
} from '@/lib/types/promotion'

// ─── Category icons ───────────────────────────────────────────────────────────
const CATEGORY_ICON: Record<MonthlyPassCategory, React.ReactNode> = {
  student: <GraduationCap className="w-5 h-5" />,
  elderly: <Heart className="w-5 h-5" />,
  worker: <Briefcase className="w-5 h-5" />,
}

const CATEGORY_BG: Record<MonthlyPassCategory, string> = {
  student: 'from-blue-600/20 to-violet-600/10 border-blue-500/20',
  elderly: 'from-rose-600/20 to-pink-600/10 border-rose-500/20',
  worker: 'from-amber-600/20 to-orange-600/10 border-amber-500/20',
}

const CATEGORY_ACCENT: Record<MonthlyPassCategory, string> = {
  student: 'text-blue-400',
  elderly: 'text-rose-400',
  worker: 'text-amber-400',
}

// ─── Pass card ────────────────────────────────────────────────────────────────
function PassCard({ pass }: { pass: MonthlyPass }) {
  const statusColor = APPROVAL_STATUS_COLOR[pass.approvalStatus]
  const catBg = CATEGORY_BG[pass.category] ?? ''
  const catAccent = CATEGORY_ACCENT[pass.category] ?? 'text-white/60'

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)

  const isActive =
    pass.approvalStatus === 'approved' &&
    new Date(pass.endDate).getTime() >= Date.now()

  return (
    <div
      className={`relative rounded-2xl border bg-gradient-to-br ${catBg} overflow-hidden transition-all hover:shadow-lg hover:shadow-black/40 hover:scale-[1.01]`}
    >
      {/* Active glow */}
      {isActive && (
        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-emerald-400/20" />
      )}

      {/* Background bus icon */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-5">
        <Bus className="w-24 h-24" />
      </div>

      <div className="relative p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-white/8 ${catAccent}`}>
              {CATEGORY_ICON[pass.category]}
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-snug">
                {MONTHLY_PASS_CATEGORY_LABEL[pass.category]}
              </p>
              <p className="text-xs text-white/40 font-mono">{pass.passCode}</p>
            </div>
          </div>

          <span
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
          >
            {pass.approvalStatus === 'approved' ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : pass.approvalStatus === 'pending' ? (
              <Clock className="w-3 h-3" />
            ) : (
              <XCircle className="w-3 h-3" />
            )}
            {APPROVAL_STATUS_LABEL[pass.approvalStatus]}
          </span>
        </div>

        {/* Route info */}
        {pass.route && (
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Bus className="w-3.5 h-3.5 text-[#00d4aa]" />
            <span>{pass.route.name}</span>
          </div>
        )}

        {/* Date range + price */}
        <div className="flex items-center justify-between border-t border-white/8 pt-3">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {formatDate(pass.startDate)} → {formatDate(pass.endDate)}
            </span>
          </div>
          <span className="text-sm font-bold text-[#00d4aa]">
            {formatPrice(pass.price)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Register form (multi-step) ───────────────────────────────────────────────
interface RegisterFormProps {
  onSuccess: (pass: MonthlyPass) => void
  onCancel: () => void
}

function RegisterForm({ onSuccess, onCancel }: RegisterFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [category, setCategory] = useState<MonthlyPassCategory | null>(null)
  const [routeId, setRouteId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)

  // Auto-set endDate = 30 days after startDate
  useEffect(() => {
    if (startDate) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + 29)
      setEndDate(d.toISOString().split('T')[0])
    }
  }, [startDate])

  // Min date = today
  const today = new Date().toISOString().split('T')[0]

  const handleSubmit = async () => {
    if (!category || !routeId || !startDate || !endDate) {
      setError('Vui lòng điền đầy đủ thông tin')
      return
    }
    setSubmitting(true)
    setError('')

    const payload: RegisterMonthlyPassPayload = { routeId, category, startDate, endDate }
    const result = await promotionService.registerMonthlyPass(payload)
    setSubmitting(false)

    if (result.success && result.data) {
      onSuccess(result.data)
    } else {
      setError(result.message || 'Không thể đăng ký vé tháng')
    }
  }

  const categories: MonthlyPassCategory[] = ['student', 'elderly', 'worker']

  return (
    <div className="rounded-2xl bg-white/4 border border-white/10 overflow-hidden">
      {/* Step indicator */}
      <div className="flex items-center border-b border-white/8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex-1 h-1 transition-all duration-500 ${
              s <= step ? 'bg-[#00d4aa]' : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      <div className="p-5 space-y-4">
        {/* Step labels */}
        <div className="flex items-center justify-between text-xs text-white/40">
          <span className={step >= 1 ? 'text-[#00d4aa]' : ''}>Loại vé</span>
          <ChevronRight className="w-3 h-3" />
          <span className={step >= 2 ? 'text-[#00d4aa]' : ''}>Tuyến & Ngày</span>
          <ChevronRight className="w-3 h-3" />
          <span className={step >= 3 ? 'text-[#00d4aa]' : ''}>Xác nhận</span>
        </div>

        {/* ── Step 1: Choose category ── */}
        {step === 1 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Chọn loại hành khách</h3>
            <div className="space-y-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                    category === cat
                      ? 'bg-[#00d4aa]/15 border-[#00d4aa]/40 text-white'
                      : 'bg-white/3 border-white/8 text-white/70 hover:bg-white/6 hover:border-white/15'
                  }`}
                  id={`select-category-${cat}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={category === cat ? 'text-[#00d4aa]' : 'text-white/40'}>
                      {CATEGORY_ICON[cat]}
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-medium">{MONTHLY_PASS_CATEGORY_LABEL[cat]}</p>
                      <p className="text-xs text-white/40">
                        {formatPrice(MONTHLY_PASS_CATEGORY_PRICE[cat])}/tháng
                      </p>
                    </div>
                  </div>
                  {category === cat && (
                    <CheckCircle2 className="w-4 h-4 text-[#00d4aa]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Route & Date ── */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">Tuyến xe & Thời gian</h3>

            <div className="space-y-2">
              <label className="text-xs text-white/50">ID Tuyến xe</label>
              <input
                id="route-id-input"
                type="text"
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
                placeholder="Nhập ID tuyến xe (VD: route-1a2b…)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#00d4aa]/60 focus:bg-white/8 transition-all font-mono"
              />
              <p className="text-xs text-white/30">
                Lấy ID tuyến từ danh sách tuyến xe trên trang chủ
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs text-white/50">Ngày bắt đầu</label>
                <input
                  id="start-date-input"
                  type="date"
                  value={startDate}
                  min={today}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white outline-none focus:border-[#00d4aa]/60 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/50">Ngày kết thúc</label>
                <input
                  id="end-date-input"
                  type="date"
                  value={endDate}
                  min={startDate || today}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white outline-none focus:border-[#00d4aa]/60 transition-all"
                />
              </div>
            </div>

            <p className="text-xs text-white/30">* Mặc định 30 ngày khi chọn ngày bắt đầu</p>
          </div>
        )}

        {/* ── Step 3: Confirm ── */}
        {step === 3 && category && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">Xác nhận đăng ký</h3>

            <div className="rounded-xl bg-white/4 border border-white/8 divide-y divide-white/6">
              {[
                ['Loại vé', MONTHLY_PASS_CATEGORY_LABEL[category]],
                ['ID Tuyến', routeId || '—'],
                ['Ngày bắt đầu', startDate || '—'],
                ['Ngày kết thúc', endDate || '—'],
                ['Giá vé', formatPrice(MONTHLY_PASS_CATEGORY_PRICE[category])],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-white/50">{label}</span>
                  <span className="text-sm font-medium text-white">{value}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
              <p className="text-xs text-amber-300">
                ⏳ Hồ sơ sẽ được xét duyệt trong 1–2 ngày làm việc. Bạn sẽ nhận thông báo qua email.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-2 pt-1">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/6 hover:bg-white/10 text-sm text-white/60 hover:text-white transition-all"
              id="prev-step-btn"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Quay lại
            </button>
          ) : (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/6 hover:bg-white/10 text-sm text-white/60 hover:text-white transition-all"
              id="cancel-register-btn"
            >
              Hủy
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as 2 | 3)}
              disabled={step === 1 && !category}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00d4aa] hover:bg-[#00bfa0] disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-[#060a0f] transition-all"
              id="next-step-btn"
            >
              Tiếp theo
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00d4aa] hover:bg-[#00bfa0] disabled:opacity-60 text-sm font-semibold text-[#060a0f] transition-all"
              id="submit-monthly-pass-btn"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {submitting ? 'Đang gửi…' : 'Gửi đăng ký'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page component ──────────────────────────────────────────────────────
export function MonthlyPassPage() {
  const [passes, setPasses] = useState<MonthlyPass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const loadPasses = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await promotionService.getMyPasses()
    setLoading(false)

    if (result.success && result.data) {
      setPasses(result.data)
    } else {
      setError(result.message || 'Không thể tải vé tháng')
    }
  }, [])

  useEffect(() => {
    loadPasses()
  }, [loadPasses])

  const handleSuccess = (pass: MonthlyPass) => {
    setPasses((prev) => [pass, ...prev])
    setShowForm(false)
    setSuccessMsg('Đăng ký thành công! Hồ sơ đang chờ xét duyệt.')
    setTimeout(() => setSuccessMsg(''), 5000)
  }

  return (
    <div className="min-h-screen bg-[#060a0f] text-white">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <CreditCard className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Vé tháng</h1>
                <p className="text-xs text-white/40">Đăng ký & quản lý vé tháng xe buýt</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => loadPasses()}
                disabled={loading}
                className="p-2 rounded-xl hover:bg-white/8 text-white/40 hover:text-white disabled:opacity-40 transition-all"
                id="refresh-passes-btn"
              >
                <RefreshCw className={`w-4.5 h-4.5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00d4aa] hover:bg-[#00bfa0] text-sm font-semibold text-[#060a0f] transition-all"
                id="register-monthly-pass-btn"
              >
                <Plus className="w-4 h-4" />
                Đăng ký mới
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 pb-8">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Success toast */}
          {successMsg && (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-emerald-300">{successMsg}</p>
            </div>
          )}

          {/* Register form */}
          {showForm && (
            <div className="animate-in slide-in-from-top-3 duration-300">
              <RegisterForm
                onSuccess={handleSuccess}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-4 py-16">
              <Loader2 className="w-8 h-8 text-[#00d4aa] animate-spin" />
              <p className="text-sm text-white/40">Đang tải vé tháng…</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-5 text-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && passes.length === 0 && !showForm && (
            <div className="flex flex-col items-center gap-4 py-16">
              <div className="p-5 rounded-3xl bg-white/4 border border-white/8">
                <InboxIcon className="w-10 h-10 text-white/20" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/60">Chưa có vé tháng nào</p>
                <p className="text-xs text-white/30 mt-1">
                  Sinh viên được giảm 50% khi đăng ký vé tháng
                </p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00d4aa] hover:bg-[#00bfa0] text-sm font-semibold text-[#060a0f] transition-all"
                id="register-first-pass-btn"
              >
                <Plus className="w-4 h-4" />
                Đăng ký vé tháng đầu tiên
              </button>
            </div>
          )}

          {/* Pass list */}
          {!loading && passes.map((pass) => (
            <PassCard key={pass.id} pass={pass} />
          ))}
        </div>
      </div>
    </div>
  )
}
