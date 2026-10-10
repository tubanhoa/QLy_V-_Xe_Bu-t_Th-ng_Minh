'use client'

/**
 * Cửa sổ nổi (Floating Modal Window): Đăng Ký & Quản Lý Vé Tháng Xe Buýt Điện ICTU
 * Thiết kế giao diện chuẩn phong cách Floating Modal đồng bộ với TicketManagementModal & TripSearchModal
 * Chuẩn nhận diện thương hiệu ICTU Transit:
 * 1. Trợ giá 50% HSSV, 60% Người cao tuổi
 * 2. Upload ảnh thẻ SV/CCCD minh chứng trực tiếp lên Backend với Magic Bytes validation
 * 3. Thẻ xe buýt điện tử thông minh (Smart Transit Pass Card) tích hợp mã QR & chip NFC & ảnh cá nhân
 * 4. Tích hợp thanh toán trực tuyến (VNPay Sandbox / VietQR) & Gia hạn nhanh
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
  ExternalLink,
  Zap,
  User,
  AlertTriangle,
  IdCard,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { promotionService } from '@/lib/services/promotion.service'
import {
  priorityVerificationService,
  type MyVerificationsResponse,
} from '@/lib/services/priority-verification.service'
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

interface MonthlyPassModalProps {
  open: boolean
  onClose: () => void
  initialTab?: 'register' | 'my-passes' | 'verify-profile'
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
    badge: 'DUYỆT TỰ ĐỘNG',
    icon: Briefcase,
  },
]

export function MonthlyPassModal({
  open,
  onClose,
  initialTab = 'register',
}: MonthlyPassModalProps) {
  const { isAuthenticated, user } = useAuth()
  const [activeTab, setActiveTab] = useState<'register' | 'my-passes' | 'verify-profile'>(initialTab)

  // Danh sách thẻ tháng
  const [myPasses, setMyPasses] = useState<MonthlyPass[]>([])
  const [loadingPasses, setLoadingPasses] = useState(false)
  const [passesError, setPassesError] = useState<string | null>(null)

  // State cho Xác thực Đối tượng Ưu đãi (HSSV / Người cao tuổi)
  const [verificationData, setVerificationData] = useState<MyVerificationsResponse | null>(null)
  const [loadingVerification, setLoadingVerification] = useState(false)
  const [showReapplyForm, setShowReapplyForm] = useState(false)
  const [verifCategory, setVerifCategory] = useState<'student' | 'elderly'>('student')
  const [verifStudentId, setVerifStudentId] = useState(user?.studentId || 'DTC215180001')
  const [verifSchoolName, setVerifSchoolName] = useState('Trường ĐH Công Nghệ Thông Tin & Truyền Thông (ICTU)')
  const [verifIdCard, setVerifIdCard] = useState('')
  const [verifFrontUrl, setVerifFrontUrl] = useState<string | null>(null)
  const [verifFrontPreview, setVerifFrontPreview] = useState<string | null>(null)
  const [verifBackUrl, setVerifBackUrl] = useState<string | null>(null)
  const [verifBackPreview, setVerifBackPreview] = useState<string | null>(null)
  const [verifPortraitUrl, setVerifPortraitUrl] = useState<string | null>(null)
  const [verifPortraitPreview, setVerifPortraitPreview] = useState<string | null>(null)
  const [uploadingSlot, setUploadingSlot] = useState<'front' | 'back' | 'portrait' | null>(null)
  const [submittingVerif, setSubmittingVerif] = useState(false)
  const [verifError, setVerifError] = useState<string | null>(null)
  const [verifSuccessMsg, setVerifSuccessMsg] = useState<string | null>(null)

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

  // Modal Cập nhật lại ảnh minh chứng (khi hồ sơ bị từ chối)
  const [resubmitModalOpen, setResubmitModalOpen] = useState(false)
  const [targetResubmitPass, setTargetResubmitPass] = useState<MonthlyPass | null>(null)
  const [resubmitProofType, setResubmitProofType] = useState<'student_card' | 'id_card'>('student_card')
  const [resubmitProofPreview, setResubmitProofPreview] = useState<string | null>(null)
  const [resubmitProofUrl, setResubmitProofUrl] = useState<string | null>(null)
  const [isUploadingResubmit, setIsUploadingResubmit] = useState(false)
  const [submittingResubmit, setSubmittingResubmit] = useState(false)
  const [resubmitError, setResubmitError] = useState<string | null>(null)
  const resubmitFileInputRef = useRef<HTMLInputElement>(null)

  // Modal Thanh Toán
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentData, setPaymentData] = useState<MonthlyPassPaymentData | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [confirmingPayment, setConfirmingPayment] = useState(false)
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null)

  // Modal Gia Hạn Nhanh
  const [renewTargetPass, setRenewTargetPass] = useState<MonthlyPass | null>(null)
  const [renewMonths, setRenewMonths] = useState<number>(1)
  const [renewing, setRenewing] = useState(false)
  const [renewError, setRenewError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const verifFrontRef = useRef<HTMLInputElement>(null)
  const verifBackRef = useRef<HTMLInputElement>(null)
  const verifPortraitRef = useRef<HTMLInputElement>(null)

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

  // Tải thông tin xác thực ưu đãi tài khoản của user
  const loadMyVerification = useCallback(async () => {
    if (!isAuthenticated) return
    setLoadingVerification(true)
    try {
      const res = await priorityVerificationService.getMyVerifications()
      if (res.success && res.data) {
        setVerificationData(res.data)
      }
    } catch {
      // ignore
    } finally {
      setLoadingVerification(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (open) {
      loadMyPasses()
      loadMyVerification()
      if (initialTab) setActiveTab(initialTab)
    }
  }, [open, initialTab, loadMyPasses, loadMyVerification])

  // Xử lý nạp ảnh minh chứng thẻ SV / CCCD có kiểm tra bảo mật (Magic bytes & 3MB)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setRegisterError(null)

    // 1. Kiểm tra định dạng tệp phía FE (Chặn SVG, HTML, file thực thi)
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
    const localPreview = URL.createObjectURL(file)
    setProofPreview(localPreview)

    // 3. Tải lên máy chủ để kiểm tra Magic Bytes và lưu tệp an toàn
    setIsUploadingProof(true)
    const uploadRes = await promotionService.uploadProofImage(file)
    setIsUploadingProof(false)

    if (uploadRes.success && uploadRes.data?.url) {
      setUploadedProofUrl(uploadRes.data.url)
    } else {
      setRegisterError(uploadRes.message || 'Lỗi tải ảnh lên máy chủ. Vui lòng thử lại.')
      setUploadedProofUrl(null)
    }
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

    if (category !== 'worker' && !uploadedProofUrl && !proofPreview) {
      setRegisterError('Vui lòng tải lên ảnh minh chứng (Thẻ sinh viên hoặc CCCD)')
      return
    }

    if (isUploadingProof) {
      setRegisterError('Hệ thống đang tải ảnh lên máy chủ, vui lòng đợi trong giây lát...')
      return
    }

    setSubmitting(true)

    // Ngày bắt đầu: hôm nay
    const start = new Date()
    const startDate = start.toISOString().split('T')[0]

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

  // Mở modal gửi lại ảnh minh chứng cho thẻ bị từ chối
  const handleOpenResubmitModal = (pass: MonthlyPass) => {
    setTargetResubmitPass(pass)
    setResubmitProofType(pass.proofType === 'id_card' ? 'id_card' : 'student_card')
    setResubmitProofPreview(null)
    setResubmitProofUrl(null)
    setResubmitError(null)
    setResubmitModalOpen(true)
  }

  const handleUploadResubmitFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setResubmitError(null)
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowed.includes(file.type) || file.type.includes('svg')) {
      setResubmitError('Chỉ hỗ trợ tải tệp ảnh định dạng JPG, PNG hoặc WebP.')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      setResubmitError('Dung lượng tệp vượt quá 3MB.')
      return
    }
    const preview = URL.createObjectURL(file)
    setResubmitProofPreview(preview)
    setIsUploadingResubmit(true)
    const res = await promotionService.uploadProofImage(file)
    setIsUploadingResubmit(false)
    if (res.success && res.data?.url) {
      setResubmitProofUrl(res.data.url)
    } else {
      setResubmitError(res.message || 'Lỗi khi tải ảnh lên máy chủ. Vui lòng thử lại.')
    }
  }

  const handleExecuteResubmitProof = async () => {
    if (!targetResubmitPass) return
    if (!resubmitProofUrl) {
      setResubmitError('Vui lòng chọn ảnh minh chứng mới trước khi gửi.')
      return
    }
    setSubmittingResubmit(true)
    setResubmitError(null)
    const res = await promotionService.resubmitMonthlyPassProof(
      targetResubmitPass.id,
      resubmitProofUrl,
      resubmitProofType,
    )
    setSubmittingResubmit(false)
    if (res.success) {
      setResubmitModalOpen(false)
      setTargetResubmitPass(null)
      loadMyPasses()
      alert('Đã gửi lại ảnh minh chứng thành công! Hồ sơ đã được chuyển lại về trạng thái Chờ duyệt.')
    } else {
      setResubmitError(res.message || 'Không thể cập nhật ảnh minh chứng.')
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

  // Xác nhận thanh toán nhanh (Demo / VietQR)
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

  // Mở modal Gia Hạn Nhanh
  const handleOpenRenew = (pass: MonthlyPass) => {
    setRenewTargetPass(pass)
    setRenewMonths(1)
    setRenewError(null)
  }

  // Thực hiện Gia Hạn Nhanh
  const handleExecuteRenew = async () => {
    if (!renewTargetPass) return
    setRenewing(true)
    setRenewError(null)

    // Gia hạn và tự động mở thanh toán
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
      setRenewError(res.message || 'Không thể gia hạn vé tháng. Vui lòng thử lại.')
    }
  }

  // Xử lý upload ảnh minh chứng đối tượng ưu đãi
  const handleUploadVerifFile = async (
    file: File,
    slot: 'front' | 'back' | 'portrait'
  ) => {
    setVerifError(null)
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowed.includes(file.type) || file.type.includes('svg')) {
      setVerifError('Định dạng ảnh không hợp lệ. Vui lòng chỉ chọn ảnh JPG, PNG hoặc WebP.')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      setVerifError('Dung lượng tệp vượt quá giới hạn 3MB.')
      return
    }

    setUploadingSlot(slot)
    const preview = URL.createObjectURL(file)
    if (slot === 'front') setVerifFrontPreview(preview)
    if (slot === 'back') setVerifBackPreview(preview)
    if (slot === 'portrait') setVerifPortraitPreview(preview)

    const res = await priorityVerificationService.uploadProofImage(file)
    setUploadingSlot(null)

    if (res.success && res.data?.url) {
      if (slot === 'front') setVerifFrontUrl(res.data.url)
      if (slot === 'back') setVerifBackUrl(res.data.url)
      if (slot === 'portrait') setVerifPortraitUrl(res.data.url)
    } else {
      setVerifError(res.message || 'Lỗi khi tải ảnh lên máy chủ. Vui lòng thử lại.')
    }
  }

  // Xử lý gửi hồ sơ thẩm định đối tượng ưu đãi tài khoản
  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifError(null)
    setVerifSuccessMsg(null)

    if (verifCategory === 'student') {
      if (!verifStudentId.trim()) {
        setVerifError('Vui lòng nhập Mã sinh viên')
        return
      }
      if (!verifSchoolName.trim()) {
        setVerifError('Vui lòng nhập Tên trường đào tạo')
        return
      }
    } else {
      if (!verifIdCard.trim()) {
        setVerifError('Vui lòng nhập Số CCCD / CMND')
        return
      }
    }

    if (!verifFrontUrl) {
      setVerifError('Vui lòng tải lên ảnh mặt trước Thẻ SV hoặc CCCD')
      return
    }

    setSubmittingVerif(true)
    try {
      const res = await priorityVerificationService.submitVerification({
        category: verifCategory,
        studentId: verifCategory === 'student' ? verifStudentId.trim() : undefined,
        schoolName: verifCategory === 'student' ? verifSchoolName.trim() : undefined,
        idCardNumber: verifCategory === 'elderly' ? verifIdCard.trim() : undefined,
        frontImageUrl: verifFrontUrl,
        backImageUrl: verifBackUrl || undefined,
        portraitImageUrl: verifPortraitUrl || undefined,
      })

      if (res.success) {
        setVerifSuccessMsg('Gửi hồ sơ xác thực đối tượng thành công! Hồ sơ đang được Ban Quản Lý / HR thẩm định.')
        setShowReapplyForm(false)
        await loadMyVerification()
      } else {
        setVerifError(res.message || 'Không thể gửi hồ sơ xác thực')
      }
    } catch (err: any) {
      setVerifError(err.message || 'Lỗi kết nối máy chủ')
    } finally {
      setSubmittingVerif(false)
    }
  }

  if (!open) return null

  const selectedCategoryMeta = CATEGORIES.find((c) => c.key === category)!
  // Tính giá có chiết khấu: 1 tháng = 0%, 3 tháng = 5%, 6 tháng = 10%
  const discountRate = durationMonths === 3 ? 0.05 : durationMonths === 6 ? 0.1 : 0
  const rawTotal = selectedCategoryMeta.price * durationMonths
  const totalAmount = rawTotal * (1 - discountRate)

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
                Áp dụng toàn bộ tuyến xe buýt thông minh Thái Nguyên · Duyệt hồ sơ nhanh chóng
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
              <button
                type="button"
                onClick={() => setActiveTab('verify-profile')}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5',
                  activeTab === 'verify-profile'
                    ? 'bg-white text-[#005A36] shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                <ShieldCheck
                  size={14}
                  className={verificationData?.verificationStatus === 'verified' ? 'text-emerald-600' : ''}
                />
                <span>Xác thực ưu đãi</span>
                {verificationData?.verificationStatus === 'verified' ? (
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                ) : verificationData?.verificationStatus === 'pending' ? (
                  <span className="size-2 rounded-full bg-amber-400" />
                ) : null}
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
        <div className="flex sm:hidden border-b border-slate-100 bg-slate-50/80 p-2 gap-1.5 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={cn(
              'flex-1 min-w-[90px] py-2 rounded-xl text-xs font-bold transition-all text-center',
              activeTab === 'register'
                ? 'bg-[#005A36] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200',
            )}
          >
            Đăng ký mới
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my-passes')}
            className={cn(
              'flex-1 min-w-[90px] py-2 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1',
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
          <button
            type="button"
            onClick={() => setActiveTab('verify-profile')}
            className={cn(
              'flex-1 min-w-[110px] py-2 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1',
              activeTab === 'verify-profile'
                ? 'bg-[#005A36] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200',
            )}
          >
            <ShieldCheck size={13} />
            <span>Xác thực ưu đãi</span>
          </button>
        </div>

        {/* 2. MODAL BODY */}
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
                      Hồ sơ vé tháng của bạn đã được tiếp nhận. Ban Quản Lý ICTU Transit sẽ đối soát thông tin và phê duyệt nhanh chóng. Bạn có thể kiểm tra trạng thái thẻ tại mục <strong>&quot;Thẻ của tôi&quot;</strong>.
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
                        setProofPreview(null)
                        setUploadedProofUrl(null)
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
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
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
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
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
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
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
                            { m: 1, label: '1 tháng', desc: 'Giá chuẩn' },
                            { m: 3, label: '3 tháng', desc: 'Giảm 5%' },
                            { m: 6, label: '6 tháng', desc: 'Giảm 10%' },
                          ].map((item) => (
                            <button
                              key={item.m}
                              type="button"
                              onClick={() => setDurationMonths(item.m)}
                              className={cn(
                                'py-2 px-1 rounded-xl border text-xs font-extrabold transition-all cursor-pointer text-center flex flex-col items-center justify-center',
                                durationMonths === item.m
                                  ? 'border-[#005A36] bg-[#005A36] text-white shadow-xs'
                                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700',
                              )}
                            >
                              <span>{item.label}</span>
                              <span
                                className={cn(
                                  'text-[10px] font-normal mt-0.5',
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
                  </div>

                  {/* Lựa chọn loại giấy tờ minh chứng & Upload */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                        4. Giấy tờ minh chứng ({category === 'worker' ? 'Thẻ Nhân Viên / CCCD' : 'Thẻ Sinh Viên / CCCD'})
                        {category === 'worker' && (
                          <span className="font-normal text-slate-400 ml-1.5 lowercase">
                            (không bắt buộc đối với vé phổ thông)
                          </span>
                        )}
                      </label>
                    </div>

                    {/* Selector chọn loại giấy tờ: Thẻ sinh viên HOẶC Căn cước công dân */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setProofType('student_card')}
                        className={cn(
                          'p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer',
                          proofType === 'student_card'
                            ? 'border-[#005A36] bg-emerald-50/80 text-[#005A36] font-bold shadow-xs ring-1 ring-[#005A36]'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                        )}
                      >
                        <div
                          className={cn(
                            'p-2 rounded-lg shrink-0',
                            proofType === 'student_card'
                              ? 'bg-[#005A36] text-white'
                              : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          <GraduationCap size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black leading-tight truncate">Thẻ Sinh Viên</div>
                          <div className="text-[10px] text-slate-500 leading-tight truncate mt-0.5">
                            Rõ họ tên, mã SV & trường
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setProofType('id_card')}
                        className={cn(
                          'p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer',
                          proofType === 'id_card'
                            ? 'border-[#005A36] bg-emerald-50/80 text-[#005A36] font-bold shadow-xs ring-1 ring-[#005A36]'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                        )}
                      >
                        <div
                          className={cn(
                            'p-2 rounded-lg shrink-0',
                            proofType === 'id_card'
                              ? 'bg-[#005A36] text-white'
                              : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          <IdCard size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black leading-tight truncate">Căn Cước Công Dân</div>
                          <div className="text-[10px] text-slate-500 leading-tight truncate mt-0.5">
                            Mặt trước CCCD gắn chip
                          </div>
                        </div>
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
                      <div className="relative rounded-2xl border border-emerald-300 bg-emerald-50/50 p-3 sm:p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative size-14 rounded-xl overflow-hidden border border-emerald-200 shrink-0 bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={proofPreview}
                              alt="Ảnh minh chứng"
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {proofFileName || (proofType === 'student_card' ? 'anh-the-sinh-vien.jpg' : 'anh-the-cccd.jpg')}
                            </p>
                            {isUploadingProof ? (
                              <p className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                                <Loader2 size={12} className="animate-spin" />
                                <span>Đang kiểm tra bảo mật & tải lên server...</span>
                              </p>
                            ) : uploadedProofUrl ? (
                              <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                <span>Đã tải lên và xác thực tệp thành công ({proofType === 'student_card' ? 'Thẻ SV' : 'CCCD'})</span>
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
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
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
                          Chạm để tải ảnh {proofType === 'student_card' ? 'Thẻ Sinh Viên' : 'Căn cước công dân (CCCD)'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Hỗ trợ JPG, PNG, WebP dưới 3MB · Hồ sơ sẽ được chuyển đến BQL xét duyệt thủ công
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Thông báo quy trình phê duyệt thủ công của Admin */}
                  <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-3 sm:p-3.5 flex items-start gap-3 text-xs">
                    <div className="size-8 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <ShieldCheck size={16} />
                    </div>
                    <div>
                      <span className="font-extrabold text-teal-950 block text-xs">
                        Quy trình phê duyệt vé tháng HSSV
                      </span>
                      <span className="text-[11px] text-teal-800/90 leading-relaxed block mt-0.5">
                        Hồ sơ đăng ký sẽ được Quản trị viên (Admin) thẩm định ảnh thẻ trong Dashboard. Sau khi được duyệt, cổng thanh toán sẽ tự động mở để bạn thanh toán và kích hoạt mã QR lên xe.
                      </span>
                    </div>
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
                        {discountRate > 0 && (
                          <span className="text-xs line-through text-slate-400">
                            {formatPrice(rawTotal)}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500 font-medium">
                          ({durationMonths} tháng · Miễn phí làm thẻ)
                        </span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || isUploadingProof}
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
                    const statusLabel = APPROVAL_STATUS_LABEL[pass.approvalStatus] || 'Đang xét duyệt'
                    const isApproved = pass.approvalStatus === 'approved'
                    const isPaid = pass.paymentStatus === 'paid'
                    const isUnpaid = pass.paymentStatus === 'unpaid'
                    const isPending = pass.approvalStatus === 'pending'

                    // Kiểm tra còn hạn hay không
                    const todayStr = new Date().toISOString().slice(0, 10)
                    const isExpired = pass.endDate < todayStr

                    return (
                      <div
                        key={pass.id}
                        className="relative overflow-hidden rounded-3xl border border-emerald-300/80 bg-gradient-to-br from-emerald-800 via-[#005A36] to-emerald-950 p-5 text-white shadow-xl shadow-emerald-950/20 flex flex-col justify-between"
                      >
                        {/* 1. Header Card: Chip NFC & Status badges */}
                        <div>
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
                              {/* Badge Trạng thái duyệt */}
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-xs',
                                  isApproved
                                    ? 'bg-emerald-400 text-emerald-950 border-emerald-300'
                                    : pass.approvalStatus === 'rejected'
                                    ? 'bg-rose-400 text-rose-950 border-rose-300'
                                    : 'bg-amber-300 text-amber-950 border-amber-200',
                                )}
                              >
                                {statusLabel}
                              </span>

                              {/* Badge Trạng thái thanh toán */}
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

                          {/* 2. Body Card: Avatar + Profile info */}
                          <div className="flex items-start gap-3.5 mb-3.5 bg-black/15 p-3 rounded-2xl border border-white/10">
                            {/* Ảnh chân dung / Ảnh thẻ SV */}
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

                            {/* Thông tin chủ thẻ */}
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

                        {/* 3. Bottom Validity & QR / Actions */}
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

                          {/* 4. Action Buttons (Thanh toán ngay / Gia hạn nhanh) */}
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
                              <div className="w-full flex items-center gap-2 py-1.5 px-3 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-100">
                                <Clock size={13} className="shrink-0 text-amber-300 animate-spin" />
                                <span className="text-[11px] font-semibold truncate">
                                  Hồ sơ đang chờ Ban Quản Trị thẩm định & phê duyệt
                                </span>
                              </div>
                            )}

                            {pass.approvalStatus === 'rejected' && (
                              <div className="w-full space-y-2 pt-1">
                                <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs">
                                  <div className="flex items-center gap-1.5 font-bold text-rose-300">
                                    <AlertCircle size={14} className="shrink-0" />
                                    <span>Hồ sơ bị từ chối phê duyệt</span>
                                  </div>
                                  <p className="text-[11px] mt-1 text-rose-100/90 leading-tight">
                                    Lý do: <span className="font-semibold">{pass.rejectionReason || 'Ảnh minh chứng chưa đáp ứng yêu cầu của Ban Quản Trị.'}</span>
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpenResubmitModal(pass)}
                                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Upload size={14} />
                                  <span>Cập nhật lại ảnh minh chứng</span>
                                </button>
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

          {/* TAB 3: XÁC THỰC ĐỐI TƯỢNG ƯU ĐÃI (HSSV / NGƯỜI CAO TUỔI) */}
          {activeTab === 'verify-profile' && (
            <div className="space-y-4">
              {!isAuthenticated ? (
                <div className="py-10 text-center space-y-3">
                  <div className="size-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-xs">
                    <ShieldCheck size={28} />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Vui lòng đăng nhập</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Đăng nhập tài khoản để nộp hồ sơ xác thực đối tượng ưu đãi (Sinh viên ICTU, Người cao tuổi) và nhận trợ giá tự động.
                  </p>
                </div>
              ) : loadingVerification ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Loader2 size={28} className="animate-spin text-[#005A36] mx-auto" />
                  <p className="text-xs font-bold">Đang tải hồ sơ xác thực của bạn...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Trường hợp 1: Đã xác thực thành công (Verified) */}
                  {verificationData?.verificationStatus === 'verified' && !showReapplyForm && (
                    <div className="rounded-3xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 sm:p-8 space-y-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="size-12 rounded-2xl bg-[#005A36] text-white flex items-center justify-center shadow-md shadow-emerald-950/20">
                          <CheckCircle2 size={28} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base sm:text-lg font-black text-slate-900">
                              Tài Khoản Đã Được Xác Thực Ưu Đãi
                            </h4>
                            <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-black text-[#005A36]">
                              CHÍNH THỨC
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 font-medium mt-0.5">
                            Hệ thống tự động kích hoạt mức cước trợ giá cho tài khoản này trên toàn bộ hệ thống
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="rounded-2xl border border-emerald-200/80 bg-white/80 p-3.5 space-y-1">
                          <span className="text-[11px] font-bold text-slate-500 block uppercase">
                            Họ và tên chủ tài khoản
                          </span>
                          <span className="font-extrabold text-slate-900 text-sm">
                            {user?.fullName || user?.name}
                          </span>
                        </div>

                        <div className="rounded-2xl border border-emerald-200/80 bg-white/80 p-3.5 space-y-1">
                          <span className="text-[11px] font-bold text-slate-500 block uppercase">
                            Đối tượng áp dụng
                          </span>
                          <span className="font-extrabold text-emerald-800 text-sm flex items-center gap-1.5">
                            {verificationData.priorityCategory === 'student' ? (
                              <>
                                <GraduationCap size={16} />
                                <span>Sinh viên ICTU (Trợ giá 50%)</span>
                              </>
                            ) : (
                              <>
                                <Heart size={16} />
                                <span>Người cao tuổi (Trợ giá 60%)</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 text-xs text-emerald-900 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles size={16} className="text-[#005A36] shrink-0" />
                          <span>
                            Từ giờ bạn có thể đăng ký vé tháng hoặc mua vé lượt với mức giá trợ giá mà không cần nộp lại thẻ.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowReapplyForm(true)}
                          className="text-[11px] font-bold text-[#005A36] underline hover:text-[#00472b] whitespace-nowrap ml-2 cursor-pointer"
                        >
                          Cập nhật thẻ mới
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Trường hợp 2: Đang chờ HR thẩm định (Pending) */}
                  {verificationData?.verificationStatus === 'pending' && !showReapplyForm && (
                    <div className="rounded-3xl border border-amber-300 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 sm:p-8 space-y-4 shadow-sm text-center">
                      <div className="size-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center mx-auto shadow-md shadow-amber-950/20 animate-pulse">
                        <Clock size={28} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-base font-black text-slate-900">
                          Hồ Sơ Của Bạn Đang Được Thẩm Định
                        </h4>
                        <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                          Bộ phận HR và Ban Quản Lý ICTU Transit đang đối soát minh chứng thẻ HSSV/CCCD của bạn. Thời gian phản hồi dự kiến từ <strong>2 đến 24 giờ</strong>. Kết quả xét duyệt sẽ được thông báo trực tiếp qua <strong>Email</strong> và <strong>Thông báo</strong> trên ứng dụng.
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-bold text-amber-800">
                        <Clock size={13} />
                        <span>Trạng thái: Đang chờ xét duyệt hồ sơ</span>
                      </div>
                    </div>
                  )}

                  {/* Trường hợp 3: Bị từ chối (Rejected) */}
                  {verificationData?.verificationStatus === 'rejected' && !showReapplyForm && (
                    <div className="rounded-3xl border border-rose-300 bg-rose-50/80 p-6 space-y-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="size-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                          <AlertTriangle size={24} />
                        </div>
                        <div className="space-y-1 flex-1">
                          <h4 className="text-sm sm:text-base font-black text-rose-900">
                            Hồ Sơ Xác Thực Trước Đó Đã Bị Từ Chối
                          </h4>
                          <p className="text-xs text-rose-700">
                            {verificationData.history?.[0]?.rejectionReason ? (
                              <span>
                                <strong>Lý do từ chối:</strong> {verificationData.history[0].rejectionReason}
                              </span>
                            ) : (
                              <span>Minh chứng của bạn chưa đạt yêu cầu rõ nét hoặc thông tin không trùng khớp.</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setShowReapplyForm(true)}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Upload size={14} />
                          <span>Bổ sung & Nộp lại minh chứng mới</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Trường hợp 4: Chưa nộp hồ sơ (Unverified) HOẶC Người dùng bấm Nộp lại */}
                  {(verificationData?.verificationStatus === 'unverified' ||
                    !verificationData?.verificationStatus ||
                    showReapplyForm) && (
                    <form onSubmit={handleSubmitVerification} className="space-y-5">
                      {/* Tiêu đề giới thiệu */}
                      <div className="rounded-2xl bg-emerald-50 border border-emerald-200/80 p-4 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={18} className="text-[#005A36]" />
                          <h4 className="text-xs sm:text-sm font-black text-emerald-950">
                            Đăng Ký Xác Thực Đối Tượng Ưu Đãi (1 Lần Duy Nhất)
                          </h4>
                        </div>
                        <p className="text-[11px] sm:text-xs text-emerald-800 leading-relaxed">
                          Tải ảnh thẻ sinh viên hoặc CCCD để được HR ICTU Transit phê duyệt tài khoản. Sau khi được duyệt, bạn sẽ được tự động hưởng chính sách trợ giá <strong>50% - 60%</strong> cho mọi vé tháng và vé xe.
                        </p>
                      </div>

                      {/* Chọn đối tượng */}
                      <div className="space-y-2">
                        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                          1. Chọn đối tượng áp dụng *
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setVerifCategory('student')}
                            className={cn(
                              'p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between',
                              verifCategory === 'student'
                                ? 'border-[#005A36] bg-emerald-50/50 shadow-sm ring-2 ring-[#005A36]/20'
                                : 'border-slate-200 hover:border-slate-300 bg-white',
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={cn(
                                  'size-9 rounded-xl flex items-center justify-center',
                                  verifCategory === 'student'
                                    ? 'bg-[#005A36] text-white'
                                    : 'bg-slate-100 text-slate-600',
                                )}
                              >
                                <GraduationCap size={18} />
                              </div>
                              <div>
                                <span className="block text-xs font-black text-slate-900">
                                  Học sinh / Sinh viên
                                </span>
                                <span className="text-[11px] font-bold text-emerald-700">
                                  Trợ giá 50% vé tháng
                                </span>
                              </div>
                            </div>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-[#005A36]">
                              -50%
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setVerifCategory('elderly')}
                            className={cn(
                              'p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between',
                              verifCategory === 'elderly'
                                ? 'border-[#005A36] bg-emerald-50/50 shadow-sm ring-2 ring-[#005A36]/20'
                                : 'border-slate-200 hover:border-slate-300 bg-white',
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={cn(
                                  'size-9 rounded-xl flex items-center justify-center',
                                  verifCategory === 'elderly'
                                    ? 'bg-[#005A36] text-white'
                                    : 'bg-slate-100 text-slate-600',
                                )}
                              >
                                <Heart size={18} />
                              </div>
                              <div>
                                <span className="block text-xs font-black text-slate-900">
                                  Người cao tuổi (≥ 60 tuổi)
                                </span>
                                <span className="text-[11px] font-bold text-sky-700">
                                  Trợ giá 60% vé tháng
                                </span>
                              </div>
                            </div>
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black text-sky-800">
                              -60%
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Thông tin định danh */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {verifCategory === 'student' ? (
                          <>
                            <div className="space-y-1.5">
                              <label className="block text-xs font-bold text-slate-700">
                                Mã số sinh viên (MSSV) *
                              </label>
                              <input
                                type="text"
                                value={verifStudentId}
                                onChange={(e) => setVerifStudentId(e.target.value)}
                                placeholder="Ví dụ: DTC215180001"
                                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-bold focus:border-[#005A36] focus:outline-none"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-xs font-bold text-slate-700">
                                Trường đào tạo *
                              </label>
                              <input
                                type="text"
                                value={verifSchoolName}
                                onChange={(e) => setVerifSchoolName(e.target.value)}
                                placeholder="Trường ĐH Công Nghệ Thông Tin & Truyền Thông (ICTU)"
                                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:border-[#005A36] focus:outline-none"
                              />
                            </div>
                          </>
                        ) : (
                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700">
                              Số CCCD / CMND gắn chip *
                            </label>
                            <input
                              type="text"
                              value={verifIdCard}
                              onChange={(e) => setVerifIdCard(e.target.value)}
                              placeholder="Nhập 12 số CCCD"
                              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 font-mono font-bold focus:border-[#005A36] focus:outline-none"
                            />
                          </div>
                        )}
                      </div>

                      {/* Tải 3 ảnh minh chứng */}
                      <div className="space-y-2">
                        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                          2. Tải ảnh minh chứng đối chiếu *
                        </label>
                        <p className="text-[11px] text-slate-400">
                          Chấp nhận ảnh JPG, PNG, WebP (Dưới 3MB) · Hệ thống bảo mật Magic Bytes chống mã độc
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Slot 1: Mặt trước (Bắt buộc) */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                              <span>Mặt trước Thẻ SV / CCCD *</span>
                              {uploadingSlot === 'front' && <Loader2 size={12} className="animate-spin text-[#005A36]" />}
                            </span>
                            <input
                              ref={verifFrontRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) handleUploadVerifFile(f, 'front')
                              }}
                            />
                            {verifFrontPreview ? (
                              <div className="relative h-32 rounded-2xl overflow-hidden border border-emerald-300 group">
                                <img src={verifFrontPreview} alt="Mặt trước" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVerifFrontPreview(null)
                                    setVerifFrontUrl(null)
                                  }}
                                  className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/60 text-white hover:bg-black"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => verifFrontRef.current?.click()}
                                className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#005A36] bg-slate-50 flex flex-col items-center justify-center p-3 text-center transition-colors cursor-pointer group"
                              >
                                <Upload size={20} className="text-slate-400 group-hover:text-[#005A36] mb-1" />
                                <span className="text-[11px] font-bold text-slate-700">Mặt trước</span>
                                <span className="text-[10px] text-slate-400">Chạm để chọn</span>
                              </button>
                            )}
                          </div>

                          {/* Slot 2: Mặt sau (Tùy chọn) */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                              <span>Mặt sau Thẻ / CCCD</span>
                              {uploadingSlot === 'back' && <Loader2 size={12} className="animate-spin text-[#005A36]" />}
                            </span>
                            <input
                              ref={verifBackRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) handleUploadVerifFile(f, 'back')
                              }}
                            />
                            {verifBackPreview ? (
                              <div className="relative h-32 rounded-2xl overflow-hidden border border-emerald-300 group">
                                <img src={verifBackPreview} alt="Mặt sau" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVerifBackPreview(null)
                                    setVerifBackUrl(null)
                                  }}
                                  className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/60 text-white hover:bg-black"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => verifBackRef.current?.click()}
                                className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#005A36] bg-slate-50 flex flex-col items-center justify-center p-3 text-center transition-colors cursor-pointer group"
                              >
                                <Upload size={20} className="text-slate-400 group-hover:text-[#005A36] mb-1" />
                                <span className="text-[11px] font-bold text-slate-700">Mặt sau</span>
                                <span className="text-[10px] text-slate-400">Tùy chọn</span>
                              </button>
                            )}
                          </div>

                          {/* Slot 3: Ảnh chân dung đối chiếu */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                              <span>Ảnh chân dung đối chiếu</span>
                              {uploadingSlot === 'portrait' && <Loader2 size={12} className="animate-spin text-[#005A36]" />}
                            </span>
                            <input
                              ref={verifPortraitRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) handleUploadVerifFile(f, 'portrait')
                              }}
                            />
                            {verifPortraitPreview ? (
                              <div className="relative h-32 rounded-2xl overflow-hidden border border-emerald-300 group">
                                <img src={verifPortraitPreview} alt="Chân dung" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVerifPortraitPreview(null)
                                    setVerifPortraitUrl(null)
                                  }}
                                  className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/60 text-white hover:bg-black"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => verifPortraitRef.current?.click()}
                                className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#005A36] bg-slate-50 flex flex-col items-center justify-center p-3 text-center transition-colors cursor-pointer group"
                              >
                                <User size={20} className="text-slate-400 group-hover:text-[#005A36] mb-1" />
                                <span className="text-[11px] font-bold text-slate-700">Ảnh chân dung</span>
                                <span className="text-[10px] text-slate-400">Tùy chọn</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {verifError && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
                          <AlertCircle size={16} className="shrink-0" />
                          <span>{verifError}</span>
                        </div>
                      )}

                      {verifSuccessMsg && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          <span>{verifSuccessMsg}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                        {showReapplyForm && (
                          <button
                            type="button"
                            onClick={() => setShowReapplyForm(false)}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            Quay lại
                          </button>
                        )}

                        <button
                          type="submit"
                          disabled={submittingVerif || !!uploadingSlot}
                          className="py-3 px-6 rounded-xl bg-[#005A36] hover:bg-[#004529] disabled:opacity-50 text-white text-xs font-black shadow-md shadow-emerald-950/15 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {submittingVerif ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              <span>Đang gửi hồ sơ...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck size={16} />
                              <span>Gửi Hồ Sơ Xác Thực Đối Tượng Ưu Đãi</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL 3: THANH TOÁN VÉ THÁNG (VNPay / VietQR) */}
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
                {/* Chi phí */}
                <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200/80 p-3.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Số tiền cần thanh toán:</span>
                  <span className="font-mono text-lg font-black text-[#005A36]">
                    {formatPrice(paymentData.amount)}
                  </span>
                </div>

                {/* Mã VietQR */}
                <div className="space-y-2 text-center">
                  <p className="text-xs font-bold text-slate-700">Quét mã VietQR (Tự động điền nội dung):</p>
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

                {/* Các nút lựa chọn */}
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

      {/* MODAL 4: GIA HẠN NHANH */}
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

              {/* Thông tin hạn mới */}
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

      {/* MODAL 5: CẬP NHẬT LẠI ẢNH MINH CHỨNG (KHI HỒ SƠ BỊ TỪ CHỐI) */}
      {resubmitModalOpen && targetResubmitPass && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 p-5 space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Upload size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">Cập Nhật Minh Chứng Mới</h4>
                  <p className="text-[11px] text-slate-500 font-mono">Mã vé: {targetResubmitPass.passCode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResubmitModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Hiển thị lý do từ chối trước đó */}
            {targetResubmitPass.rejectionReason && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-900">
                  <AlertCircle size={14} />
                  <span>Lý do Admin đã từ chối:</span>
                </div>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  {targetResubmitPass.rejectionReason}
                </p>
              </div>
            )}

            {/* Chọn loại giấy tờ */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Chọn loại giấy tờ bổ sung:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResubmitProofType('student_card')}
                  className={cn(
                    'p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer',
                    resubmitProofType === 'student_card'
                      ? 'border-[#005A36] bg-emerald-50/80 text-[#005A36] font-bold ring-1 ring-[#005A36]'
                      : 'border-slate-200 bg-white text-slate-600',
                  )}
                >
                  <GraduationCap size={16} />
                  <span className="text-xs font-bold">Thẻ Sinh Viên</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResubmitProofType('id_card')}
                  className={cn(
                    'p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer',
                    resubmitProofType === 'id_card'
                      ? 'border-[#005A36] bg-emerald-50/80 text-[#005A36] font-bold ring-1 ring-[#005A36]'
                      : 'border-slate-200 bg-white text-slate-600',
                  )}
                >
                  <IdCard size={16} />
                  <span className="text-xs font-bold">Căn Cước (CCCD)</span>
                </button>
              </div>
            </div>

            {/* Vùng chọn ảnh */}
            <input
              ref={resubmitFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUploadResubmitFile}
              className="hidden"
            />

            {resubmitProofPreview ? (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50/50 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-12 rounded-xl overflow-hidden border border-emerald-200 shrink-0 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resubmitProofPreview}
                      alt="Ảnh mới"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      Ảnh minh chứng mới
                    </p>
                    {isUploadingResubmit ? (
                      <p className="text-[10px] text-amber-700 flex items-center gap-1 font-semibold">
                        <Loader2 size={10} className="animate-spin" />
                        <span>Đang tải lên...</span>
                      </p>
                    ) : resubmitProofUrl ? (
                      <p className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        <span>Đã tải ảnh lên thành công</span>
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => resubmitFileInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Đổi ảnh
                </button>
              </div>
            ) : (
              <div
                onClick={() => resubmitFileInputRef.current?.click()}
                className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#005A36] bg-slate-50/60 hover:bg-emerald-50/30 p-5 text-center transition-all cursor-pointer group space-y-1"
              >
                <div className="size-9 rounded-xl bg-white border border-slate-200 text-slate-400 group-hover:text-[#005A36] flex items-center justify-center mx-auto shadow-2xs">
                  <Upload size={16} />
                </div>
                <p className="text-xs font-bold text-slate-700 group-hover:text-[#005A36]">
                  Chạm để tải ảnh mới rõ nét
                </p>
                <p className="text-[10px] text-slate-400">
                  Ảnh chụp góc thẳng, đủ ánh sáng, không bị lóa hoặc mất góc
                </p>
              </div>
            )}

            {resubmitError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" />
                <span>{resubmitError}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResubmitModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={submittingResubmit || isUploadingResubmit || !resubmitProofUrl}
                onClick={handleExecuteResubmitProof}
                className="flex-1 py-2.5 rounded-xl bg-[#005A36] hover:bg-[#004529] disabled:opacity-50 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {submittingResubmit ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Đang gửi lại...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} />
                    <span>Gửi Lại Duyệt</span>
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
