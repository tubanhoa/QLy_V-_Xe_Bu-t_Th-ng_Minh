'use client'

/**
 * Trang Vé tháng — Đăng ký & xem danh sách vé tháng của người dùng
 * Thiết kế giao diện Light Theme chuẩn nhận diện thương hiệu ICTU Transit (#005A36)
 * Tích hợp:
 * 1. Upload ảnh thẻ SV/CCCD minh chứng kiểm định Magic Bytes qua API backend
 * 2. Thẻ vé tháng điện tử thông minh với QR Code, chip NFC & ảnh cá nhân
 * 3. Thanh toán trực tuyến (VNPay Sandbox / VietQR) & Gia hạn nhanh cộng dồn
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
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
  X,
  ExternalLink,
  Zap,
  User,
  AlertTriangle,
  IdCard,
} from 'lucide-react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { promotionService } from '@/lib/services/promotion.service'
import { useAuth } from '@/lib/auth-context'
import type {
  MonthlyPass,
  MonthlyPassCategory,
  MonthlyPassPaymentData,
  RegisterMonthlyPassPayload,
} from '@/lib/types/promotion'
import {
  APPROVAL_STATUS_COLOR,
  APPROVAL_STATUS_LABEL,
  MONTHLY_PASS_CATEGORY_LABEL,
  MONTHLY_PASS_CATEGORY_PRICE,
} from '@/lib/types/promotion'
import { cn, formatProofUrl } from '@/lib/utils'

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
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [uploadedProofUrl, setUploadedProofUrl] = useState<string | null>(null)
  const [proofFileName, setProofFileName] = useState<string | null>(null)
  const [isUploadingProof, setIsUploadingProof] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [proofType, setProofType] = useState<'student_card' | 'id_card'>('student_card')

  // Payment State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentData, setPaymentData] = useState<MonthlyPassPaymentData | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [confirmingPayment, setConfirmingPayment] = useState(false)
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null)

  // Renew State
  const [renewTargetPass, setRenewTargetPass] = useState<MonthlyPass | null>(null)
  const [renewMonths, setRenewMonths] = useState<number>(1)
  const [renewing, setRenewing] = useState(false)
  const [renewError, setRenewError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Xử lý nạp ảnh minh chứng
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setRegisterError(null)

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || ''
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp']

    if (!allowedTypes.includes(file.type) || !allowedExts.includes(fileExtension) || file.type.includes('svg')) {
      setRegisterError('Định dạng tệp không an toàn. Vui lòng chỉ tải ảnh định dạng JPG, PNG hoặc WebP.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const MAX_FILE_SIZE = 3 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      setRegisterError(`Dung lượng ảnh (${(file.size / (1024 * 1024)).toFixed(1)}MB) vượt quá mức 3MB.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setProofFileName(file.name)
    setProofPreview(URL.createObjectURL(file))

    setIsUploadingProof(true)
    const uploadRes = await promotionService.uploadProofImage(file)
    setIsUploadingProof(false)

    if (uploadRes.success && uploadRes.data?.url) {
      setUploadedProofUrl(uploadRes.data.url)
    } else {
      setRegisterError(uploadRes.message || 'Lỗi tải ảnh lên máy chủ.')
      setUploadedProofUrl(null)
    }
  }

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

    if (category !== 'worker' && !uploadedProofUrl && !proofPreview) {
      setRegisterError('Vui lòng tải ảnh thẻ sinh viên hoặc CCCD')
      return
    }

    if (isUploadingProof) {
      setRegisterError('Ảnh đang được tải lên máy chủ, vui lòng đợi trong giây lát...')
      return
    }

    setSubmitting(true)

    const startDate = new Date().toISOString().split('T')[0]

    const payload: RegisterMonthlyPassPayload = {
      routeId,
      category,
      startDate,
      durationMonths,
      proofImageUrl: uploadedProofUrl || undefined,
      proofType,
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

  // Khởi tạo luồng thanh toán cho vé tháng đã duyệt
  const handleOpenPayment = async (pass: MonthlyPass) => {
    setPaymentLoading(true)
    setPaymentSuccessMsg(null)
    const res = await promotionService.createMonthlyPassPayment(pass.id, 'vnpay')
    setPaymentLoading(false)

    if (res.success && res.data) {
      setPaymentData(res.data)
      setPaymentModalOpen(true)
    } else {
      alert(res.message || 'Không thể tạo phiên thanh toán cho vé tháng này')
    }
  }

  // Xác nhận thanh toán
  const handleConfirmPayment = async () => {
    if (!paymentData) return
    setConfirmingPayment(true)
    const res = await promotionService.confirmMonthlyPassPayment(paymentData.passId, {
      paymentMethod: 'vietqr',
    })
    setConfirmingPayment(false)

    if (res.success) {
      setPaymentSuccessMsg('Kích hoạt vé tháng thành công! Thẻ của bạn đã sẵn sàng sử dụng.')
      loadMyPasses()
      setTimeout(() => {
        setPaymentModalOpen(false)
        setPaymentData(null)
        setPaymentSuccessMsg(null)
      }, 1800)
    } else {
      alert(res.message || 'Xác nhận thanh toán thất bại')
    }
  }

  // Mở modal Gia Hạn
  const handleOpenRenew = (pass: MonthlyPass) => {
    setRenewTargetPass(pass)
    setRenewMonths(1)
    setRenewError(null)
  }

  // Thực hiện Gia Hạn
  const handleExecuteRenew = async () => {
    if (!renewTargetPass) return
    setRenewing(true)
    setRenewError(null)

    const res = await promotionService.renewMonthlyPass(renewTargetPass.id, renewMonths, false)
    setRenewing(false)

    if (res.success && res.data) {
      const pInfo = res.data.paymentInfo
      setRenewTargetPass(null)
      loadMyPasses()

      if (pInfo) {
        setPaymentData({
          passId: res.data.passId,
          passCode: res.data.passCode,
          amount: pInfo.amount,
          paymentMethod: 'vnpay',
          description: pInfo.description,
          paymentUrl: pInfo.paymentUrl,
          vietQrUrl: pInfo.vietQrUrl,
          quickPayAvailable: true,
        })
        setPaymentModalOpen(true)
      } else {
        alert('Gia hạn thẻ thành công!')
      }
    } else {
      setRenewError(res.message || 'Không thể gia hạn vé tháng.')
    }
  }

  const selectedCategoryMeta = CATEGORIES.find((c) => c.key === category)!
  const discountRate = durationMonths === 3 ? 0.05 : durationMonths === 6 ? 0.1 : 0
  const rawTotal = selectedCategoryMeta.price * durationMonths
  const totalAmount = rawTotal * (1 - discountRate)

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
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-[#005A36]">
                TRỢ GIÁ 50%
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Đăng ký và quản lý thẻ xe buýt tháng thông minh tích hợp NFC và mã QR
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold self-start sm:self-auto border border-slate-200/60">
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'register'
                ? 'bg-white text-[#005A36] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đăng ký mới
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my-passes')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'my-passes'
                ? 'bg-white text-[#005A36] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Thẻ của tôi</span>
            {myPasses.length > 0 && (
              <span className="size-4 rounded-full bg-[#005A36] text-[10px] text-white flex items-center justify-center">
                {myPasses.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab 1: Form Đăng ký */}
      {activeTab === 'register' && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs">
          {registerSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="size-14 rounded-2xl bg-emerald-100 text-[#005A36] flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                Gửi Hồ Sơ Đăng Ký Thành Công!
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Hồ sơ của bạn đã được chuyển tới Ban Quản Lý ICTU Transit. Sau khi phê duyệt, thẻ điện tử sẽ xuất hiện tại mục <strong>&quot;Thẻ của tôi&quot;</strong>.
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRegisterSuccess(false)
                    setActiveTab('my-passes')
                  }}
                  className="rounded-xl bg-[#005A36] hover:bg-[#004529] px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors"
                >
                  Xem thẻ của tôi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegisterSuccess(false)
                    setProofPreview(null)
                    setUploadedProofUrl(null)
                    setProofFileName(null)
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Đăng ký thêm
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Category picker */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  1. Đối tượng hành khách *
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
                        className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all ${
                          isSelected
                            ? 'border-[#005A36] bg-emerald-50/60 ring-2 ring-[#005A36]/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span
                            className={`p-1.5 rounded-xl ${
                              isSelected ? 'bg-[#005A36] text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="font-mono font-bold text-xs text-[#005A36]">
                            {formatPrice(cat.price)}/tháng
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-900">{cat.label}</span>
                        <span className="text-[11px] text-slate-500">{cat.sublabel}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Passenger Info */}
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
                    Mã sinh viên / Số CCCD *
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
                    {[
                      { m: 1, label: '1 tháng', desc: 'Chuẩn' },
                      { m: 3, label: '3 tháng', desc: 'Giảm 5%' },
                      { m: 6, label: '6 tháng', desc: 'Giảm 10%' },
                    ].map((item) => (
                      <button
                        key={item.m}
                        type="button"
                        onClick={() => setDurationMonths(item.m)}
                        className={cn(
                          'py-2 px-1 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center',
                          durationMonths === item.m
                            ? 'bg-[#005A36] text-white border-[#005A36]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
                        )}
                      >
                        <span>{item.label}</span>
                        <span
                          className={cn(
                            'text-[10px] font-normal',
                            durationMonths === item.m ? 'text-emerald-100' : 'text-slate-400',
                          )}
                        >
                          {item.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Proof Image Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Giấy tờ minh chứng ({category === 'worker' ? 'Thẻ Nhân Viên / CCCD' : 'Thẻ SV / CCCD'})
                  {category === 'worker' && (
                    <span className="font-normal text-slate-400 ml-1.5">
                      (Không bắt buộc đối với cán bộ/người đi làm)
                    </span>
                  )}
                </label>

                {/* Chọn loại giấy tờ */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProofType('student_card')}
                    className={cn(
                      'p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer',
                      proofType === 'student_card'
                        ? 'border-[#005A36] bg-emerald-50/80 text-[#005A36] font-bold ring-1 ring-[#005A36]'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                    )}
                  >
                    <GraduationCap size={16} />
                    <span className="text-xs font-bold">Thẻ Sinh Viên</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProofType('id_card')}
                    className={cn(
                      'p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer',
                      proofType === 'id_card'
                        ? 'border-[#005A36] bg-emerald-50/80 text-[#005A36] font-bold ring-1 ring-[#005A36]'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                    )}
                  >
                    <IdCard size={16} />
                    <span className="text-xs font-bold">Căn Cước (CCCD)</span>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {proofPreview ? (
                  <div className="relative rounded-2xl border border-emerald-300 bg-emerald-50/50 p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-12 rounded-xl overflow-hidden border border-emerald-200 shrink-0 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={proofPreview}
                          alt="Ảnh minh chứng"
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {proofFileName || 'anh-the-sinh-vien.jpg'}
                        </p>
                        {isUploadingProof ? (
                          <p className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                            <Loader2 size={12} className="animate-spin" />
                            <span>Đang kiểm tra bảo mật & tải lên...</span>
                          </p>
                        ) : uploadedProofUrl ? (
                          <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            <span>Đã tải lên và xác thực tệp thành công</span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                            <AlertTriangle size={12} />
                            <span>Tải lên thất bại. Vui lòng chọn lại.</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Đổi ảnh
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProofPreview(null)
                          setUploadedProofUrl(null)
                          setProofFileName(null)
                        }}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 text-center cursor-pointer hover:border-[#005A36] hover:bg-emerald-50/30 transition-all space-y-1"
                  >
                    <Upload size={22} className="mx-auto text-slate-400 mb-1" />
                    <span className="block text-xs font-bold text-slate-700">
                      Chạm để tải ảnh thẻ sinh viên hoặc CCCD
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      Hỗ trợ JPG, PNG, WebP dưới 3MB · Chụp rõ thông tin
                    </span>
                  </div>
                )}
              </div>

              {/* Summary & Submit */}
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-slate-500 font-bold block">Tổng chi phí dự kiến:</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-black text-[#005A36] font-mono">
                      {formatPrice(totalAmount)}
                    </span>
                    {discountRate > 0 && (
                      <span className="text-xs line-through text-slate-400">
                        {formatPrice(rawTotal)}
                      </span>
                    )}
                    <span className="text-xs text-emerald-700 font-bold">
                      ({durationMonths} tháng · Miễn phí làm thẻ)
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || isUploadingProof}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myPasses.map((pass) => {
                const isApproved = pass.approvalStatus === 'approved'
                const isPaid = pass.paymentStatus === 'paid'
                const isUnpaid = pass.paymentStatus === 'unpaid'
                const isPending = pass.approvalStatus === 'pending'
                const statusLabel = APPROVAL_STATUS_LABEL[pass.approvalStatus] || 'Đang xét duyệt'

                const todayStr = new Date().toISOString().slice(0, 10)
                const isExpired = pass.endDate < todayStr

                return (
                  <div
                    key={pass.id}
                    className="relative overflow-hidden rounded-3xl border border-emerald-300/80 bg-gradient-to-br from-emerald-800 via-[#005A36] to-emerald-950 p-5 text-white shadow-xl shadow-emerald-950/20 flex flex-col justify-between"
                  >
                    <div>
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="flex items-center gap-2">
                          <div className="size-7 rounded-lg bg-amber-400/90 text-amber-950 flex items-center justify-center font-bold text-[10px] shadow-xs">
                            NFC
                          </div>
                          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-200">
                            ICTU Transit Pass
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-xs',
                              isApproved
                                ? 'bg-emerald-400 text-emerald-950 border-emerald-300'
                                : pass.approvalStatus === 'rejected'
                                ? 'bg-rose-400 text-rose-950 border-rose-300'
                                : 'bg-amber-300 text-amber-950 border-amber-200',
                            )}
                          >
                            {statusLabel}
                          </span>

                          {isApproved && (
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-xs',
                                isPaid
                                  ? 'bg-emerald-500/80 text-white border-emerald-400'
                                  : 'bg-amber-400 text-slate-900 border-amber-300 animate-pulse',
                              )}
                            >
                              {isPaid ? 'Đã Thanh Toán' : 'Chưa Thanh Toán'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Profile info */}
                      <div className="flex items-start gap-3.5 mb-3.5 bg-black/15 p-3 rounded-2xl border border-white/10">
                        <div className="size-14 rounded-xl overflow-hidden border border-emerald-300/40 bg-emerald-900/60 shrink-0 flex items-center justify-center shadow-xs">
                          {pass.proofImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={formatProofUrl(pass.proofImageUrl)}
                              alt="Ảnh thẻ"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="size-7 text-emerald-200/80" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="font-mono text-sm font-black tracking-widest text-emerald-200">
                            {pass.passCode}
                          </p>
                          <p className="text-xs font-black text-white truncate">
                            {pass.user?.fullName || pass.user?.name || user?.fullName || user?.name || 'HÀNH KHÁCH ICTU'}
                          </p>
                          <p className="text-[11px] text-emerald-200/90 font-semibold truncate">
                            {MONTHLY_PASS_CATEGORY_LABEL[pass.category]}
                          </p>
                          <p className="text-[10px] text-white/70 truncate">
                            {pass.route?.name || 'Liên tuyến toàn mạng lưới'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div>
                      <div className="flex items-end justify-between border-t border-emerald-700/60 pt-3">
                        <div className="text-[10px] text-emerald-200 space-y-0.5">
                          <span className="block opacity-75">Hạn sử dụng:</span>
                          <span className={cn('font-bold text-xs block', isExpired ? 'text-rose-300' : 'text-white')}>
                            {pass.endDate ? new Date(pass.endDate).toLocaleDateString('vi-VN') : '30 ngày'}
                            {isExpired && ' (Hết hạn)'}
                          </span>
                        </div>

                        {isApproved && isPaid ? (
                          <div className="bg-white p-1 rounded-xl shadow-xs">
                            <QRCodeSVG
                              value={pass.qrPayload || `ICTU-MONTHLY:${pass.passCode}:${pass.endDate}`}
                              size={44}
                              level="M"
                            />
                          </div>
                        ) : isApproved && isUnpaid ? (
                          <span className="text-[10px] text-amber-200 font-bold bg-amber-900/50 px-2 py-1 rounded-lg border border-amber-400/40">
                            Cần thanh toán để kích hoạt QR
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-200 italic font-medium">
                            Đang chờ BQL thẩm định...
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="mt-3.5 pt-2.5 border-t border-emerald-700/40 flex items-center gap-2">
                        {isApproved && isUnpaid && (
                          <button
                            type="button"
                            onClick={() => handleOpenPayment(pass)}
                            className="flex-1 py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <CreditCard size={14} />
                            <span>Thanh toán ngay</span>
                          </button>
                        )}

                        {isApproved && isPaid && (
                          <button
                            type="button"
                            onClick={() => handleOpenRenew(pass)}
                            className="flex-1 py-2 px-3 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs border border-white/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer backdrop-blur-xs"
                          >
                            <RefreshCw size={13} />
                            <span>Gia hạn nhanh</span>
                          </button>
                        )}

                        {isPending && (
                          <div className="w-full text-center text-[10px] text-amber-200 font-semibold py-1">
                            Ban Quản Lý đang thẩm định hồ sơ của bạn...
                          </div>
                        )}

                        {pass.approvalStatus === 'rejected' && (
                          <div className="w-full text-center text-[10px] text-rose-300 font-semibold py-1">
                            Hồ sơ bị từ chối: {pass.rejectionReason || 'Chưa đạt yêu cầu của BQL'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Thanh toán */}
      {paymentModalOpen && paymentData && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 p-5 space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-xl bg-emerald-100 text-[#005A36] flex items-center justify-center">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">Thanh Toán Vé Tháng</h4>
                  <p className="text-[11px] text-slate-500 font-mono">Mã thẻ: {paymentData.passCode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {paymentSuccessMsg ? (
              <div className="py-8 text-center space-y-3">
                <div className="size-14 rounded-2xl bg-emerald-100 text-[#005A36] flex items-center justify-center mx-auto animate-bounce">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-base font-black text-slate-900">{paymentSuccessMsg}</h4>
                <p className="text-xs text-slate-500">Đang cập nhật danh sách thẻ...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200/80 p-3.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Số tiền cần thanh toán:</span>
                  <span className="font-mono text-lg font-black text-[#005A36]">
                    {formatPrice(paymentData.amount)}
                  </span>
                </div>

                <div className="space-y-2 text-center">
                  <p className="text-xs font-bold text-slate-700">Quét mã VietQR chuyển khoản nhanh:</p>
                  <div className="size-48 mx-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xs flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={paymentData.vietQrUrl}
                      alt="Mã VietQR"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Nội dung CK: <strong className="font-mono text-slate-800">{paymentData.description}</strong>
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {paymentData.paymentUrl && (
                    <a
                      href={paymentData.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <ExternalLink size={14} />
                      <span>Thanh toán qua Cổng VNPay Sandbox</span>
                    </a>
                  )}

                  {paymentData.quickPayAvailable && (
                    <button
                      type="button"
                      disabled={confirmingPayment}
                      onClick={handleConfirmPayment}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#005A36] hover:bg-[#004529] text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/15 cursor-pointer disabled:opacity-50"
                    >
                      {confirmingPayment ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Đang xác thực thanh toán...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={14} />
                          <span>Tôi Đã Thanh Toán (Xác Nhận Kích Hoạt)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Gia Hạn Nhanh */}
      {renewTargetPass && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 p-5 space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-xl bg-emerald-100 text-[#005A36] flex items-center justify-center">
                  <RefreshCw size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">Gia Hạn Thẻ Vé Tháng</h4>
                  <p className="text-[11px] text-slate-500 font-mono">{renewTargetPass.passCode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRenewTargetPass(null)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Chọn thời gian gia hạn thêm:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { m: 1, label: '1 tháng', desc: 'Chuẩn' },
                    { m: 3, label: '3 tháng', desc: 'Giảm 5%' },
                    { m: 6, label: '6 tháng', desc: 'Giảm 10%' },
                  ].map((item) => (
                    <button
                      key={item.m}
                      type="button"
                      onClick={() => setRenewMonths(item.m)}
                      className={cn(
                        'py-2 px-1 rounded-xl border text-xs font-extrabold transition-all cursor-pointer text-center flex flex-col items-center justify-center',
                        renewMonths === item.m
                          ? 'border-[#005A36] bg-[#005A36] text-white shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700',
                      )}
                    >
                      <span>{item.label}</span>
                      <span
                        className={cn(
                          'text-[10px] font-normal mt-0.5',
                          renewMonths === item.m ? 'text-emerald-100' : 'text-slate-400',
                        )}
                      >
                        {item.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Hạn hiện tại:</span>
                  <span className="font-bold">{renewTargetPass.endDate}</span>
                </div>
                <div className="flex justify-between text-slate-800">
                  <span>Cộng dồn thêm:</span>
                  <span className="font-black text-[#005A36]">+{renewMonths} tháng</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 text-slate-900 font-extrabold">
                  <span>Tổng tiền thanh toán:</span>
                  <span className="font-mono text-[#005A36]">
                    {formatPrice(
                      (MONTHLY_PASS_CATEGORY_PRICE[renewTargetPass.category] || 100000) *
                        renewMonths *
                        (renewMonths === 3 ? 0.95 : renewMonths === 6 ? 0.9 : 1),
                    )}
                  </span>
                </div>
              </div>

              {renewError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{renewError}</span>
                </div>
              )}

              <button
                type="button"
                disabled={renewing}
                onClick={handleExecuteRenew}
                className="w-full py-3 rounded-xl bg-[#005A36] hover:bg-[#004529] text-white font-black text-xs shadow-md shadow-emerald-950/15 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {renewing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang xử lý gia hạn...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={15} />
                    <span>Xác Nhận Gia Hạn & Thanh Toán</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
