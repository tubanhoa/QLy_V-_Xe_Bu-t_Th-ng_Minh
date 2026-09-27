'use client'

/**
 * Trang / Modal Vé tháng — Đăng ký & xem danh sách vé tháng của người dùng
 * Thiết kế giao diện Light Theme chuẩn nhận diện thương hiệu ICTU Transit (#005A36)
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
  Upload,
  ShieldCheck,
  Sparkles,
  LogIn,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { promotionService } from '@/lib/services/promotion.service'
import { useAuth } from '@/lib/auth-context'
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

const CATEGORIES: {
  key: MonthlyPassCategory
  label: string
  sublabel: string
  price: number
  icon: React.ComponentType<{ className?: string }>
}[] = [
  {
    key: 'student',
    label: 'Sinh viên ICTU',
    sublabel: 'Trợ giá 50% dành cho HSSV',
    price: 100_000,
    icon: GraduationCap,
  },
  {
    key: 'elderly',
    label: 'Người cao tuổi',
    sublabel: 'Trợ giá 60% từ 60 tuổi trở lên',
    price: 80_000,
    icon: Heart,
  },
  {
    key: 'worker',
    label: 'Cán bộ / Người đi làm',
    sublabel: 'Vé tháng phổ thông không giới hạn',
    price: 200_000,
    icon: Briefcase,
  },
]

export function MonthlyPassPage() {
  const { isAuthenticated, user } = useAuth()
  const [activeTab, setActiveTab] = useState<'register' | 'my-passes'>('register')
  const [myPasses, setMyPasses] = useState<MonthlyPass[]>([])
  const [loadingPasses, setLoadingPasses] = useState(false)
  const [passesError, setPassesError] = useState<string | null>(null)

  // Form State
  const [category, setCategory] = useState<MonthlyPassCategory>('student')
  const [routeId, setRouteId] = useState('all-routes')
  const [studentId, setStudentId] = useState(user?.studentId || 'DTC215180001')
  const [fullName, setFullName] = useState(user?.fullName || user?.name || 'Nguyễn Thu An')
  const [durationMonths, setDurationMonths] = useState(1)
  const [proofImage, setProofImage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

  const loadMyPasses = useCallback(async () => {
    if (!isAuthenticated) return
    setLoadingPasses(true)
    setPassesError(null)

    const res = await promotionService.getMyPasses()
    setLoadingPasses(false)

    if (res.success && res.data) {
      setMyPasses(res.data)
    } else {
      setPassesError(res.message || 'Chưa có thông tin thẻ tháng')
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (activeTab === 'my-passes') {
      loadMyPasses()
    }
  }, [activeTab, loadMyPasses])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setRegisterError(null)

    const startDate = new Date().toISOString().split('T')[0]
    const endDate = new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const payload: RegisterMonthlyPassPayload = {
      routeId,
      category,
      startDate,
      endDate,
      proofImageUrl: proofImage || undefined,
    }

    const res = await promotionService.registerMonthlyPass(payload)
    setSubmitting(false)

    if (res.success) {
      setRegisterSuccess(true)
    } else {
      setRegisterError(res.message || 'Không thể gửi hồ sơ đăng ký vé tháng. Vui lòng thử lại.')
    }
  }

  const selectedCategoryMeta = CATEGORIES.find((c) => c.key === category)!
  const totalAmount = selectedCategoryMeta.price * durationMonths

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-[#005A36] text-white shadow-sm shrink-0">
            <CreditCard size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Vé Tháng Xe Buýt Điện ICTU
              </h2>
              <span className="rounded-full bg-emerald-100 text-[#005A36] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                TRỢ GIÁ 50%
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Không giới hạn lượt đi trên toàn mạng lưới xe buýt thông minh Thái Nguyên
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'register'
                ? 'bg-white text-[#005A36] shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đăng ký thẻ mới
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my-passes')}
            className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'my-passes'
                ? 'bg-white text-[#005A36] shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Thẻ của tôi {myPasses.length > 0 && `(${myPasses.length})`}
          </button>
        </div>
      </div>

      {/* Tab 1: Đăng ký vé tháng */}
      {activeTab === 'register' && (
        <div>
          {registerSuccess ? (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-6 sm:p-8 text-center space-y-4">
              <div className="size-16 rounded-full bg-emerald-100 text-[#005A36] flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 size={36} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-extrabold text-slate-900">
                  Nộp Hồ Sơ Đăng Ký Thành Công!
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Hồ sơ vé tháng của bạn đã được tiếp nhận. Ban Quản Lý Xe Buýt ICTU sẽ duyệt trong vòng <strong>2–4 giờ làm việc</strong>. Mã thẻ NFC và QR điện tử sẽ hiển thị tại mục <strong>&quot;Thẻ của tôi&quot;</strong>.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={() => {
                    setRegisterSuccess(false)
                    setActiveTab('my-passes')
                  }}
                  className="rounded-xl bg-[#005A36] hover:bg-[#004529] px-5 py-2.5 text-xs font-black text-white shadow-md transition-all cursor-pointer"
                >
                  Xem danh sách thẻ của tôi
                </button>
                <button
                  type="button"
                  onClick={() => setRegisterSuccess(false)}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700"
                >
                  Đăng ký thêm
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Category Picker */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  1. Chọn đối tượng hành khách *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon
                    const isSelected = category === cat.key
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setCategory(cat.key)}
                        className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#005A36] bg-emerald-50/70 ring-2 ring-[#005A36]/15 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className={`p-1.5 rounded-xl ${isSelected ? 'bg-[#005A36] text-white' : 'bg-slate-100 text-slate-600'}`}>
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="font-mono font-black text-xs text-[#005A36]">
                            {formatPrice(cat.price)}/tháng
                          </span>
                        </div>
                        <span className="text-xs font-extrabold text-slate-900 block mt-1">
                          {cat.label}
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          {cat.sublabel}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Passenger Info & Route */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Họ và tên người đăng ký *
                  </label>
                  <input
                    required
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="VD: Nguyễn Thu An"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#005A36] focus:bg-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã sinh viên / CCCD *
                  </label>
                  <input
                    required
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="VD: DTC215180001 hoặc 01920..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#005A36] focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Route & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phạm vi tuyến xe buýt *
                  </label>
                  <select
                    value={routeId}
                    onChange={(e) => setRouteId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#005A36]"
                  >
                    <option value="all-routes">Liên tuyến toàn mạng lưới ICTU Transit</option>
                    <option value="CT-01">Tuyến CT-01: KTX ICTU ↔ Bến Xe TP Thái Nguyên</option>
                    <option value="CT-02">Tuyến CT-02: Tuyến Liên Trường ĐH Thái Nguyên</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Thời hạn đăng ký
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[1, 3, 6].map((months) => (
                      <button
                        key={months}
                        type="button"
                        onClick={() => setDurationMonths(months)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          durationMonths === months
                            ? 'bg-[#005A36] text-white border-[#005A36]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {months} tháng
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Proof Image Upload */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Ảnh minh chứng (Thẻ SV / Giấy báo nhập học / Thẻ CCCD)
                </label>
                <div
                  onClick={() => setProofImage('https://images.unsplash.com/photo-1544717305-2782549b5136?w=200')}
                  className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 text-center cursor-pointer hover:border-[#005A36] hover:bg-emerald-50/30 transition-all"
                >
                  <Upload size={22} className="mx-auto text-slate-400 mb-1" />
                  <span className="block text-xs font-bold text-slate-700">
                    {proofImage ? '✅ Đã tải ảnh minh chứng lên thành công' : 'Chạm để tải ảnh thẻ sinh viên hoặc CCCD'}
                  </span>
                  <span className="block text-[11px] text-slate-400">
                    Hỗ trợ định dạng JPG, PNG dưới 5MB
                  </span>
                </div>
              </div>

              {/* Summary & Submit */}
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-slate-500 font-bold block">Tổng chi phí dự kiến:</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-black text-[#005A36] font-mono">
                      {formatPrice(totalAmount)}
                    </span>
                    <span className="text-xs text-emerald-700 font-bold">
                      ({durationMonths} tháng · Miễn phí làm thẻ)
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#005A36] hover:bg-[#004529] px-6 py-3 text-xs font-black text-white shadow-md active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={16} />
                  )}
                  <span>{submitting ? 'Đang gửi hồ sơ...' : 'Nộp Hồ Sơ Đăng Ký Vé Tháng'}</span>
                </button>
              </div>

              {registerError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-rose-600" />
                  <span>{registerError}</span>
                </div>
              )}
            </form>
          )}
        </div>
      )}

      {/* Tab 2: Thẻ của tôi */}
      {activeTab === 'my-passes' && (
        <div className="space-y-3">
          {!isAuthenticated ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-3 shadow-xs">
              <div className="size-12 rounded-2xl bg-emerald-100 text-[#005A36] flex items-center justify-center mx-auto">
                <LogIn size={24} />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                Đăng Nhập Để Xem Thẻ Tháng Của Bạn
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Đăng nhập bằng tài khoản sinh viên hoặc số điện thoại để tra cứu hạn sử dụng, mã NFC và trạng thái duyệt thẻ.
              </p>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#005A36] hover:bg-[#004529] px-5 py-2.5 text-xs font-black text-white shadow-md transition-all"
                >
                  <LogIn size={15} />
                  <span>Đăng nhập ngay</span>
                </Link>
              </div>
            </div>
          ) : loadingPasses ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 size={28} className="text-[#005A36] animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Đang kiểm tra thẻ tháng của bạn...</p>
            </div>
          ) : myPasses.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-3 shadow-xs">
              <div className="size-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <CreditCard size={24} />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                Bạn Chưa Có Thẻ Tháng Nào
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Hãy gửi hồ sơ đăng ký vé tháng sinh viên ICTU để được trợ giá 50% và đi xe buýt không giới hạn.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#005A36] hover:bg-[#004529] px-5 py-2.5 text-xs font-black text-white shadow-md"
                >
                  <Plus size={15} />
                  <span>Đăng ký thẻ tháng ngay</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {myPasses.map((pass) => {
                const statusColor = APPROVAL_STATUS_COLOR[pass.approvalStatus]
                return (
                  <div
                    key={pass.id}
                    className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        <span className="font-extrabold text-xs text-slate-900">
                          {MONTHLY_PASS_CATEGORY_LABEL[pass.category] || 'Thẻ Tháng'}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}>
                        {APPROVAL_STATUS_LABEL[pass.approvalStatus]}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Mã thẻ NFC:</span>
                        <span className="font-mono font-black text-[#005A36]">{pass.passCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Thời hạn:</span>
                        <span className="font-medium text-slate-800">
                          {pass.startDate} ➔ {pass.endDate}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white border border-emerald-100 p-2 text-[11px] text-slate-600 flex items-center justify-between">
                      <span>Giá thẻ: <strong>{formatPrice(pass.price)}</strong></span>
                      <span className="text-emerald-700 font-bold">Chạm để qua cổng</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
