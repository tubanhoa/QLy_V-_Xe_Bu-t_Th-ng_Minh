'use client'

/**
 * Cửa sổ nổi (Floating Modal Window): Đăng Ký & Quản Lý Vé Tháng Xe Buýt Điện ICTU
 * Thiết kế giao diện chuẩn phong cách Floating Modal đồng bộ với TicketManagementModal & TripSearchModal
 * Chuẩn nhận diện thương hiệu ICTU Transit:
 * 1. Trợ giá 50% HSSV, 60% Người cao tuổi
 * 2. Upload ảnh thẻ SV/CCCD minh chứng và xem trước (preview)
 * 3. Thẻ xe buýt điện tử thông minh (Smart Transit Pass Card) tích hợp mã QR & chip NFC
 * 4. Tự động kết nối Backend API qua promotionService (GET my-passes & POST register)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  CreditCard,
  GraduationCap,
  Heart,
  Briefcase,
  X,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Bus,
  ShieldCheck,
  Sparkles,
  QrCode,
  Download,
  RefreshCw,
  Loader2,
  InboxIcon,
  Check,
  ChevronRight,
  ArrowRight,
  Image as ImageIcon,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
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
import { cn } from '@/lib/utils'

interface MonthlyPassModalProps {
  open: boolean
  onClose: () => void
  initialTab?: 'register' | 'my-passes'
}

const CATEGORIES: {
  key: MonthlyPassCategory
  label: string
  sublabel: string
  price: number
  badge: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  {
    key: 'student',
    label: 'Sinh viên ICTU',
    sublabel: 'Trợ giá 50% dành cho HSSV các trường ĐH',
    price: 100_000,
    badge: 'TRỢ GIÁ 50%',
    icon: GraduationCap,
  },
  {
    key: 'elderly',
    label: 'Người cao tuổi',
    sublabel: 'Trợ giá 60% công dân từ 60 tuổi trở lên',
    price: 80_000,
    badge: 'TRỢ GIÁ 60%',
    icon: Heart,
  },
  {
    key: 'worker',
    label: 'Cán bộ / Người đi làm',
    sublabel: 'Vé tháng phổ thông toàn mạng lưới',
    price: 200_000,
    badge: 'KHÔNG GIỚI HẠN',
    icon: Briefcase,
  },
]

export function MonthlyPassModal({
  open,
  onClose,
  initialTab = 'register',
}: MonthlyPassModalProps) {
  const { isAuthenticated, user } = useAuth()
  const [activeTab, setActiveTab] = useState<'register' | 'my-passes'>(initialTab)

  // Danh sách thẻ tháng
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
  const [proofFileName, setProofFileName] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

  // Tải danh sách thẻ tháng của user
  const loadMyPasses = useCallback(async () => {
    if (!isAuthenticated) return
    setLoadingPasses(true)
    setPassesError(null)

    const res = await promotionService.getMyPasses()
    setLoadingPasses(false)

    if (res.success && res.data) {
      setMyPasses(res.data)
    } else {
      setPassesError(res.message || 'Chưa thể tải dữ liệu thẻ tháng')
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (open) {
      loadMyPasses()
      if (initialTab) setActiveTab(initialTab)
    }
  }, [open, initialTab, loadMyPasses])

  // Xử lý nạp ảnh minh chứng thẻ SV / CCCD có kiểm tra bảo mật (SEC-02 FE)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setRegisterError(null)

    // 1. Kiểm tra định dạng tệp (Chặn SVG, HTML, file thực thi)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || ''
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp']

    if (!allowedTypes.includes(file.type) || !allowedExts.includes(fileExtension) || file.type.includes('svg')) {
      setRegisterError('Định dạng tệp không an toàn. Vui lòng chỉ tải ảnh định dạng JPG, PNG hoặc WebP.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // 2. Kiểm tra kích thước tệp tối đa 3MB
    const MAX_FILE_SIZE = 3 * 1024 * 1024 // 3MB
    if (file.size > MAX_FILE_SIZE) {
      setRegisterError(`Dung lượng ảnh (${(file.size / (1024 * 1024)).toFixed(1)}MB) vượt quá mức cho phép 3MB. Vui lòng chọn ảnh dung lượng nhỏ hơn.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setProofFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      setProofImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Xử lý nộp hồ sơ
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegisterError(null)

    if (!fullName.trim()) {
      setRegisterError('Vui lòng nhập họ và tên người đăng ký')
      return
    }

    if (!studentId.trim()) {
      setRegisterError('Vui lòng nhập Mã sinh viên hoặc Số CCCD')
      return
    }

    setSubmitting(true)

    // Tính ngày bắt đầu và ngày kết thúc
    const start = new Date()
    const end = new Date()
    end.setMonth(end.getMonth() + durationMonths)

    const payload: RegisterMonthlyPassPayload = {
      routeId,
      category,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      proofImageUrl: proofImage || undefined,
    }

    const res = await promotionService.registerMonthlyPass(payload)
    setSubmitting(false)

    if (res.success) {
      setRegisterSuccess(true)
      loadMyPasses()
    } else {
      setRegisterError(res.message || 'Không thể gửi hồ sơ đăng ký vé tháng. Vui lòng thử lại.')
    }
  }

  if (!open) return null

  const selectedCategoryMeta = CATEGORIES.find((c) => c.key === category)!
  const totalAmount = selectedCategoryMeta.price * durationMonths

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cửa sổ Đăng Ký & Quản Lý Vé Tháng Xe Buýt Điện ICTU"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-xs overscroll-contain animate-in fade-in duration-150"
    >
      <div className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl overflow-hidden rounded-none sm:rounded-3xl bg-white shadow-2xl border-0 sm:border border-slate-100 flex flex-col will-change-transform">
        {/* 1. MODAL HEADER CHUẨN NHẬN DIỆN ICTU TRANSIT */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-6 py-3.5 sm:py-4 bg-gradient-to-r from-emerald-50 via-white to-teal-50 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex size-9 sm:size-11 items-center justify-center rounded-xl sm:rounded-2xl bg-[#005A36] text-white shadow-md shadow-emerald-900/10 shrink-0">
              <CreditCard size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-lg font-black text-slate-900">
                  Vé Tháng Xe Buýt Điện ICTU
                </h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] sm:text-[10px] font-black text-[#005A36]">
                  TRỢ GIÁ 50% HSSV
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-teal-800">
                  <Sparkles size={10} />
                  <span>Đi xe không giới hạn</span>
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate max-w-[240px] sm:max-w-none">
                Áp dụng toàn bộ tuyến xe buýt thông minh Thái Nguyên · Duyệt hồ sơ tự động
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switchers on Header for quick toggle */}
            <div className="hidden sm:flex rounded-xl bg-slate-100/90 p-1 text-xs font-bold border border-slate-200/60">
              <button
                type="button"
                onClick={() => setActiveTab('register')}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg transition-all cursor-pointer',
                  activeTab === 'register'
                    ? 'bg-white text-[#005A36] shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                Đăng ký mới
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('my-passes')}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1',
                  activeTab === 'my-passes'
                    ? 'bg-white text-[#005A36] shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                <span>Thẻ của tôi</span>
                {myPasses.length > 0 && (
                  <span className="size-4 rounded-full bg-[#005A36] text-[10px] text-white flex items-center justify-center font-bold">
                    {myPasses.length}
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="flex sm:hidden border-b border-slate-100 bg-slate-50/80 p-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={cn(
              'flex-1 py-2 rounded-xl text-xs font-bold transition-all text-center',
              activeTab === 'register'
                ? 'bg-[#005A36] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200',
            )}
          >
            Đăng ký thẻ mới
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my-passes')}
            className={cn(
              'flex-1 py-2 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1',
              activeTab === 'my-passes'
                ? 'bg-[#005A36] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200',
            )}
          >
            <span>Thẻ của tôi</span>
            {myPasses.length > 0 && (
              <span className="size-4 rounded-full bg-emerald-200 text-[#005A36] text-[10px] flex items-center justify-center font-bold">
                {myPasses.length}
              </span>
            )}
          </button>
        </div>

        {/* 2. MODAL BODY (Cuộn linh hoạt) */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 text-slate-700 flex-1">
          {/* TAB 1: FORM ĐĂNG KÝ VÉ THÁNG */}
          {activeTab === 'register' && (
            <div>
              {registerSuccess ? (
                <div className="rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-white p-6 sm:p-8 text-center space-y-4">
                  <div className="size-16 rounded-2xl bg-[#005A36] text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/15">
                    <CheckCircle2 size={36} />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-black text-slate-900">
                      Nộp Hồ Sơ Đăng Ký Thành Công!
                    </h3>
                    <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                      Hồ sơ vé tháng của bạn đã được tiếp nhận. Ban Quản Lý ICTU Transit sẽ đối soát thẻ sinh viên trong vòng <strong>2–4 giờ làm việc</strong>. Sau khi duyệt, mã thẻ NFC và QR điện tử sẽ hiển thị tại mục <strong>&quot;Thẻ của tôi&quot;</strong>.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center max-w-xs mx-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setRegisterSuccess(false)
                        setActiveTab('my-passes')
                      }}
                      className="rounded-xl bg-[#005A36] hover:bg-[#004529] px-5 py-2.5 text-xs font-black text-white shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CreditCard size={15} />
                      <span>Xem thẻ tháng của tôi</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRegisterSuccess(false)
                        setProofImage(null)
                        setProofFileName(null)
                      }}
                      className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                    >
                      Đăng ký thêm
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-5">
                  {/* Lựa chọn đối tượng hành khách */}
                  <div className="space-y-2">
                    <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider text-slate-600">
                      1. Chọn đối tượng hành khách *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                      {CATEGORIES.map((cat) => {
                        const Icon = cat.icon
                        const isSelected = category === cat.key
                        return (
                          <button
                            key={cat.key}
                            type="button"
                            onClick={() => setCategory(cat.key)}
                            className={cn(
                              'relative flex flex-col text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer',
                              isSelected
                                ? 'border-[#005A36] bg-emerald-50/70 ring-2 ring-[#005A36]/20 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80',
                            )}
                          >
                            <div className="flex items-center justify-between w-full mb-1.5">
                              <span
                                className={cn(
                                  'p-2 rounded-xl transition-colors',
                                  isSelected ? 'bg-[#005A36] text-white shadow-xs' : 'bg-slate-100 text-slate-600',
                                )}
                              >
                                <Icon className="w-4 h-4" />
                              </span>
                              <span className="font-mono font-black text-xs text-[#005A36]">
                                {formatPrice(cat.price)}/tháng
                              </span>
                            </div>
                            <span className="text-xs font-extrabold text-slate-900 block">
                              {cat.label}
                            </span>
                            <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                              {cat.sublabel}
                            </span>
                            {isSelected && (
                              <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-[#005A36]" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Thông tin người đăng ký */}
                  <div className="space-y-2">
                    <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider text-slate-600">
                      2. Thông tin người đăng ký *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Họ và tên người đăng ký
                        </label>
                        <input
                          required
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="VD: Nguyễn Thu An"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-[#005A36] focus:bg-white focus:ring-1 focus:ring-[#005A36]/20 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Mã sinh viên / Số CCCD
                        </label>
                        <input
                          required
                          type="text"
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          placeholder="VD: DTC215180001 hoặc 01920..."
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-[#005A36] focus:bg-white focus:ring-1 focus:ring-[#005A36]/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tuyến xe & Thời hạn */}
                  <div className="space-y-2">
                    <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider text-slate-600">
                      3. Phạm vi áp dụng & Thời hạn *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Phạm vi tuyến xe buýt
                        </label>
                        <select
                          value={routeId}
                          onChange={(e) => setRouteId(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]/20"
                        >
                          <option value="all-routes">Liên tuyến toàn mạng lưới ICTU Transit (Khuyên dùng)</option>
                          <option value="ct-01">Tuyến CT-01: KTX ICTU ➔ Bến xe Trung tâm</option>
                          <option value="ct-02">Tuyến CT-02: Campus Loop Liên trường Đại học</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Thời hạn đăng ký
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { m: 1, label: '1 tháng' },
                            { m: 3, label: '3 tháng' },
                            { m: 6, label: '6 tháng' },
                          ].map((item) => (
                            <button
                              key={item.m}
                              type="button"
                              onClick={() => setDurationMonths(item.m)}
                              className={cn(
                                'py-2.5 rounded-xl border text-xs font-extrabold transition-all cursor-pointer text-center',
                                durationMonths === item.m
                                  ? 'border-[#005A36] bg-[#005A36] text-white shadow-xs'
                                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700',
                              )}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ảnh minh chứng (Thẻ sinh viên / Giấy báo / CCCD) */}
                  <div className="space-y-2">
                    <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider text-slate-600">
                      4. Ảnh minh chứng (Thẻ SV / Giấy báo nhập học / Thẻ CCCD)
                    </label>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {proofImage ? (
                      <div className="relative rounded-2xl border border-emerald-300 bg-emerald-50/50 p-3 sm:p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative size-14 rounded-xl overflow-hidden border border-emerald-200 shrink-0 bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={proofImage}
                              alt="Ảnh minh chứng"
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {proofFileName || 'anh-the-sinh-vien.jpg'}
                            </p>
                            <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              <span>Đã tải ảnh lên thành công</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            Đổi ảnh
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProofImage(null)
                              setProofFileName(null)
                            }}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Xóa ảnh"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#005A36] bg-slate-50/60 hover:bg-emerald-50/30 p-5 sm:p-6 text-center transition-all cursor-pointer group space-y-1.5"
                      >
                        <div className="size-10 rounded-xl bg-white border border-slate-200 text-slate-400 group-hover:text-[#005A36] group-hover:border-emerald-300 flex items-center justify-center mx-auto shadow-2xs transition-colors">
                          <Upload size={18} />
                        </div>
                        <p className="text-xs font-bold text-slate-700 group-hover:text-[#005A36]">
                          Chạm để tải ảnh sinh viên hoặc CCCD
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Hỗ trợ định dạng JPG, PNG dưới 5MB · Chụp rõ họ tên và mã số thẻ
                        </p>
                      </div>
                    )}
                  </div>

                  {registerError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{registerError}</span>
                    </div>
                  )}

                  {/* Footer Tóm tắt chi phí & Nút gửi */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block uppercase">
                        Tổng chi phí dự kiến:
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-xl font-black text-[#005A36]">
                          {formatPrice(totalAmount)}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          ({durationMonths} tháng · Miễn phí làm thẻ)
                        </span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="py-3 px-6 rounded-xl bg-[#005A36] hover:bg-[#004529] disabled:opacity-50 text-white text-xs font-black shadow-md shadow-emerald-950/15 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Đang gửi hồ sơ...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={16} />
                          <span>Nộp Hồ Sơ Đăng Ký Vé Tháng</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: DANH SÁCH THẺ THÁNG CỦA TÔI */}
          {activeTab === 'my-passes' && (
            <div className="space-y-4">
              {!isAuthenticated ? (
                <div className="py-10 text-center space-y-3">
                  <div className="size-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-xs">
                    <GraduationCap size={28} />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Vui lòng đăng nhập</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Đăng nhập tài khoản sinh viên ICTU để xem thẻ tháng điện tử và mã QR soát vé.
                  </p>
                </div>
              ) : loadingPasses ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Loader2 size={28} className="animate-spin text-[#005A36] mx-auto" />
                  <p className="text-xs font-bold">Đang tải thẻ tháng của bạn...</p>
                </div>
              ) : myPasses.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <div className="size-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <InboxIcon size={28} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Bạn chưa có thẻ xe buýt tháng nào</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Đăng ký ngay thẻ tháng để nhận ưu đãi 50% dành cho sinh viên ICTU và không giới hạn lượt đi.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('register')}
                    className="rounded-xl bg-[#005A36] hover:bg-[#004529] px-4 py-2 text-xs font-bold text-white shadow-xs transition-all cursor-pointer"
                  >
                    Đăng ký thẻ mới ngay
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myPasses.map((pass) => {
                    const statusMeta =
                      APPROVAL_STATUS_COLOR[pass.approvalStatus] || APPROVAL_STATUS_COLOR.pending
                    const statusLabel =
                      APPROVAL_STATUS_LABEL[pass.approvalStatus] || 'Đang xét duyệt'

                    return (
                      <div
                        key={pass.id}
                        className="relative overflow-hidden rounded-3xl border border-emerald-300/80 bg-gradient-to-br from-emerald-800 via-[#005A36] to-emerald-950 p-5 text-white shadow-xl shadow-emerald-950/20"
                      >
                        {/* Decorative watermark / chip */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-lg bg-amber-400/90 text-amber-950 flex items-center justify-center font-bold text-[10px] shadow-xs">
                              NFC
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-200">
                              ICTU Transit Pass
                            </span>
                          </div>

                          <span
                            className={cn(
                              'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-xs',
                              pass.approvalStatus === 'approved'
                                ? 'bg-emerald-400 text-emerald-950 border-emerald-300'
                                : pass.approvalStatus === 'rejected'
                                ? 'bg-rose-400 text-rose-950 border-rose-300'
                                : 'bg-amber-300 text-amber-950 border-amber-200',
                            )}
                          >
                            {statusLabel}
                          </span>
                        </div>

                        {/* Middle info */}
                        <div className="space-y-1 mb-4">
                          <p className="font-mono text-base font-black tracking-widest text-emerald-100">
                            {pass.passCode || 'ICTU-PASS-2026'}
                          </p>
                          <p className="text-xs font-bold text-white truncate">
                            {user?.fullName || user?.name || 'Nguyễn Thu An'}
                          </p>
                          <p className="text-[11px] text-emerald-200/90 font-medium">
                            {pass.route?.name || 'Liên tuyến toàn mạng lưới'} · {MONTHLY_PASS_CATEGORY_LABEL[pass.category]}
                          </p>
                        </div>

                        {/* Bottom validity & QR */}
                        <div className="flex items-end justify-between border-t border-emerald-700/60 pt-3">
                          <div className="text-[10px] text-emerald-200 space-y-0.5">
                            <span className="block opacity-75">Hiệu lực đến:</span>
                            <span className="font-bold text-xs text-white">
                              {pass.endDate ? new Date(pass.endDate).toLocaleDateString('vi-VN') : '30 ngày'}
                            </span>
                          </div>

                          {pass.approvalStatus === 'approved' ? (
                            <div className="bg-white p-1 rounded-xl shadow-xs">
                              <QRCodeSVG
                                value={`ICTU-MONTHLY:${pass.passCode}:${pass.category}`}
                                size={44}
                                level="M"
                              />
                            </div>
                          ) : (
                            <span className="text-[10px] text-amber-200 italic font-medium">
                              Chờ duyệt thẻ...
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
