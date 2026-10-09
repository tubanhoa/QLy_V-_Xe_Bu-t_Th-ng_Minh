'use client'

/**
 * Cửa sổ nổi (Floating Modal Window): Xác Thực Hồ Sơ Đối Tượng Ưu Đãi (HSSV / Người Cao Tuổi)
 * Phục vụ hành khách đăng ký hưởng chính sách trợ giá 50% - 60% trên hệ thống Xe buýt Thông minh ICTU
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  ShieldCheck,
  GraduationCap,
  Heart,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  X,
  FileText,
  AlertCircle,
  RefreshCw,
  Loader2,
  ArrowRight,
  Sparkles,
  School,
  IdCard,
  User,
  Info,
  Check,
  Trash2,
  Eye,
  ExternalLink,
} from 'lucide-react'
import {
  priorityVerificationService,
  type PriorityVerificationItem,
  type MyVerificationsResponse,
} from '@/lib/services/priority-verification.service'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'

interface PriorityVerificationModalProps {
  open: boolean
  onClose: () => void
  onOpenMonthlyPass?: () => void
  initialCategory?: 'student' | 'elderly'
}

type TabType = 'status' | 'form'

export function PriorityVerificationModal({
  open,
  onClose,
  onOpenMonthlyPass,
  initialCategory = 'student',
}: PriorityVerificationModalProps) {
  const { user, isAuthenticated, refreshProfile } = useAuth()

  const [activeTab, setActiveTab] = useState<TabType>('status')
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [myVerifData, setMyVerifData] = useState<MyVerificationsResponse | null>(null)
  const [latestItem, setLatestItem] = useState<PriorityVerificationItem | null>(null)

  // Form State
  const [category, setCategory] = useState<'student' | 'elderly'>(initialCategory)
  const [studentId, setStudentId] = useState(user?.studentId || '')
  const [schoolName, setSchoolName] = useState('Trường ĐH Công Nghệ Thông Tin & Truyền Thông (ICTU)')
  const [idCardNumber, setIdCardNumber] = useState(user?.idCardNumber || '')

  // File Upload State
  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState<string | null>(null)
  const [frontUrl, setFrontUrl] = useState<string | null>(null)
  const [uploadingFront, setUploadingFront] = useState(false)

  const [backFile, setBackFile] = useState<File | null>(null)
  const [backPreview, setBackPreview] = useState<string | null>(null)
  const [backUrl, setBackUrl] = useState<string | null>(null)
  const [uploadingBack, setUploadingBack] = useState(false)

  const [portraitFile, setPortraitFile] = useState<File | null>(null)
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null)
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null)
  const [uploadingPortrait, setUploadingPortrait] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Refs for hidden file inputs
  const frontInputRef = useRef<HTMLInputElement>(null)
  const backInputRef = useRef<HTMLInputElement>(null)
  const portraitInputRef = useRef<HTMLInputElement>(null)

  // Nạp trạng thái hồ sơ của tài khoản
  const loadMyVerifications = useCallback(async () => {
    if (!isAuthenticated) return
    setLoadingStatus(true)
    setErrorMessage(null)
    try {
      const res = await priorityVerificationService.getMyVerifications()
      if (res.success && res.data) {
        setMyVerifData(res.data)
        const history = res.data.history || []
        if (history.length > 0) {
          setLatestItem(history[0])
        } else {
          setLatestItem(null)
        }

        // Tự động chuyển tab: Nếu chưa có hồ sơ thì mở Form, ngược lại mở Status
        if (history.length === 0 && res.data.verificationStatus === 'unverified') {
          setActiveTab('form')
        } else {
          setActiveTab('status')
        }
      }
    } catch (err: any) {
      console.error('[loadMyVerifications]', err)
    } finally {
      setLoadingStatus(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (open && isAuthenticated) {
      loadMyVerifications()
    }
  }, [open, isAuthenticated, loadMyVerifications])

  // Cập nhật giá trị mặc định khi user thay đổi
  useEffect(() => {
    if (user?.studentId) setStudentId(user.studentId)
    if (user?.idCardNumber) setIdCardNumber(user.idCardNumber)
  }, [user])

  // Xử lý upload ảnh minh chứng
  const handleSelectFile = async (
    file: File | null,
    type: 'front' | 'back' | 'portrait',
  ) => {
    if (!file) return

    // Validation kích thước & định dạng
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Định dạng ảnh không hỗ trợ! Vui lòng tải ảnh JPG, PNG hoặc WebP.')
      return
    }

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      setErrorMessage(`Dung lượng ảnh vượt quá 5MB (${(file.size / (1024 * 1024)).toFixed(1)}MB). Vui lòng chọn ảnh nhỏ hơn.`)
      return
    }

    setErrorMessage(null)
    const previewUrl = URL.createObjectURL(file)

    if (type === 'front') {
      setFrontFile(file)
      setFrontPreview(previewUrl)
      setUploadingFront(true)
      const res = await priorityVerificationService.uploadProofImage(file)
      setUploadingFront(false)
      if (res.success && res.data?.url) {
        setFrontUrl(res.data.url)
      } else {
        setErrorMessage(res.message || 'Không thể tải ảnh mặt trước lên máy chủ')
      }
    } else if (type === 'back') {
      setBackFile(file)
      setBackPreview(previewUrl)
      setUploadingBack(true)
      const res = await priorityVerificationService.uploadProofImage(file)
      setUploadingBack(false)
      if (res.success && res.data?.url) {
        setBackUrl(res.data.url)
      } else {
        setErrorMessage(res.message || 'Không thể tải ảnh mặt sau lên máy chủ')
      }
    } else if (type === 'portrait') {
      setPortraitFile(file)
      setPortraitPreview(previewUrl)
      setUploadingPortrait(true)
      const res = await priorityVerificationService.uploadProofImage(file)
      setUploadingPortrait(false)
      if (res.success && res.data?.url) {
        setPortraitUrl(res.data.url)
      } else {
        setErrorMessage(res.message || 'Không thể tải ảnh chân dung lên máy chủ')
      }
    }
  }

  // Gửi hồ sơ xác thực
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!frontUrl) {
      setErrorMessage('Vui lòng tải lên ảnh mặt trước Thẻ HSSV hoặc CCCD.')
      return
    }

    if (!backUrl) {
      setErrorMessage('Vui lòng tải lên ảnh mặt sau Thẻ HSSV hoặc CCCD.')
      return
    }

    if (category === 'student' && !studentId.trim()) {
      setErrorMessage('Vui lòng nhập Mã số sinh viên của bạn.')
      return
    }

    if (category === 'elderly' && !idCardNumber.trim()) {
      setErrorMessage('Vui lòng nhập Số Căn cước công dân (CCCD).')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await priorityVerificationService.submitVerification({
        category,
        studentId: category === 'student' ? studentId.trim() : undefined,
        schoolName: category === 'student' ? schoolName.trim() : undefined,
        idCardNumber: category === 'elderly' ? idCardNumber.trim() : undefined,
        frontImageUrl: frontUrl,
        backImageUrl: backUrl || undefined,
        portraitImageUrl: portraitUrl || undefined,
      })

      if (res.success) {
        setSuccessMessage('Gửi hồ sơ thẩm định thành công! Ban quản lý ICTU sẽ xét duyệt trong 24h làm việc.')
        // Cập nhật lại thông tin cá nhân
        await refreshProfile()
        // Nạp lại trạng thái
        await loadMyVerifications()
        setActiveTab('status')
      } else {
        setErrorMessage(res.message || 'Không thể gửi hồ sơ xác thực ưu đãi')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi hệ thống khi gửi hồ sơ')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  const isVerified = myVerifData?.verificationStatus === 'verified' || user?.verificationStatus === 'verified'
  const isPending = myVerifData?.verificationStatus === 'pending' || user?.verificationStatus === 'pending'
  const isRejected = myVerifData?.verificationStatus === 'rejected' || user?.verificationStatus === 'rejected'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/10 p-2.5 text-[#005A36] border border-emerald-500/20">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-foreground">
                  Xác Thực Đối Tượng Ưu Đãi
                </h2>
                {isVerified && (
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 border border-emerald-500/30 flex items-center gap-1">
                    <Check size={11} /> Đã Duyệt
                  </span>
                )}
                {isPending && (
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 border border-amber-500/30 flex items-center gap-1">
                    <Clock size={11} /> Chờ Duyệt
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Chính sách trợ giá 50% HSSV & 60% Người cao tuổi trên hệ thống ICTU Transit
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-2xl p-2 text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex items-center border-b border-border px-6 pt-2 gap-4 bg-muted/10">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={cn(
              'pb-3 text-xs font-bold transition-all relative cursor-pointer flex items-center gap-1.5',
              activeTab === 'status'
                ? 'text-[#005A36] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#005A36]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <FileText size={14} />
            <span>Hồ Sơ Của Tôi</span>
            {isPending && (
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={cn(
              'pb-3 text-xs font-bold transition-all relative cursor-pointer flex items-center gap-1.5',
              activeTab === 'form'
                ? 'text-[#005A36] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#005A36]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Upload size={14} />
            <span>{isRejected ? 'Nộp Lại Hồ Sơ' : 'Gửi Hồ Sơ Xác Thực'}</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Thông báo lỗi / thành công */}
          {errorMessage && (
            <div className="rounded-2xl border border-red-200 bg-red-50/90 dark:border-red-900/40 dark:bg-red-950/40 p-4 text-xs font-semibold text-red-700 dark:text-red-300 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 dark:border-emerald-900/40 dark:bg-emerald-950/40 p-4 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: TRẠNG THÁI HỒ SƠ */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              {loadingStatus ? (
                <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <Loader2 className="size-6 animate-spin text-[#005A36]" />
                  <span>Đang tải thông tin hồ sơ xác thực...</span>
                </div>
              ) : isVerified ? (
                /* THÀNH CÔNG: ĐÃ XÁC THỰC */
                <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-6 space-y-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-emerald-600 p-3 text-white shadow-md shadow-emerald-950/20">
                        <ShieldCheck className="size-8" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-600 block">
                          ICTU TRANSIT VERIFIED PASS
                        </span>
                        <h3 className="text-lg font-bold text-foreground">
                          {user?.priorityCategory === 'elderly'
                            ? 'Ưu Đãi Người Cao Tuổi (Trợ giá 60%)'
                            : 'Ưu Đãi Học Sinh - Sinh Viên (Trợ giá 50%)'}
                        </h3>
                      </div>
                    </div>

                    <span className="rounded-full bg-emerald-600 text-white px-3 py-1 text-xs font-bold shadow-sm">
                      ✓ Đã Kích Hoạt
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-emerald-500/20">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Họ và tên:</span>
                      <strong className="text-foreground text-sm">{user?.name || user?.fullName}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Email đăng ký:</span>
                      <strong className="text-foreground text-sm truncate block">{user?.email}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">
                        {user?.priorityCategory === 'elderly' ? 'Số CCCD:' : 'Mã sinh viên:'}
                      </span>
                      <strong className="text-foreground text-sm font-mono">
                        {user?.priorityCategory === 'elderly'
                          ? user?.idCardNumber || 'Đã kiểm tra'
                          : user?.studentId || 'Đã kiểm tra'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Đơn vị xét duyệt:</span>
                      <strong className="text-emerald-700 dark:text-emerald-300 text-sm">
                        Ban Thanh Tra ICTU Transit
                      </strong>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-card border border-emerald-500/20 p-4 text-xs space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
                      <Sparkles size={15} />
                      <span>Quyền lợi tài khoản của bạn:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px] pl-1">
                      <li>Mua Vé tháng tuyến sinh viên chỉ với 100.000 đ/tháng (giảm 50%).</li>
                      <li>Vé tháng người cao tuổi chỉ với 80.000 đ/tháng (giảm 60%).</li>
                      <li>Tự động áp dụng giá ưu đãi khi thanh toán mà không cần xuất trình giấy tờ giấy.</li>
                    </ul>
                  </div>

                  {onOpenMonthlyPass && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onOpenMonthlyPass()
                      }}
                      className="w-full py-3 rounded-2xl bg-[#005A36] text-white text-xs font-bold hover:bg-[#00472b] transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-950/20 cursor-pointer"
                    >
                      <span>Mua Vé Tháng Trợ Giá Ngay</span>
                      <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              ) : isPending ? (
                /* ĐANG CHỜ PHÊ DUYỆT */
                <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-amber-500 p-3 text-white shadow-md shadow-amber-950/20">
                      <Clock className="size-8 animate-spin" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold tracking-wider uppercase text-amber-600 block">
                        Đang Trong Quá Trình Thẩm Định
                      </span>
                      <h3 className="text-lg font-bold text-foreground">
                        Hồ Sơ Đang Chờ HR / Quản Lý Phê Duyệt
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Hệ thống đã nhận đầy đủ ảnh chụp minh chứng của bạn.
                      </p>
                    </div>
                  </div>

                  {latestItem && (
                    <div className="rounded-2xl border border-border bg-card p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Đối tượng đăng ký:</span>
                        <strong className="text-foreground">
                          {latestItem.category === 'student' ? 'Học sinh / Sinh viên' : 'Người cao tuổi'}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Thời điểm nộp:</span>
                        <span className="font-mono text-muted-foreground">
                          {new Date(latestItem.createdAt).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Trạng thái:</span>
                        <span className="font-bold text-amber-600">Đang chờ thẩm định</span>
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <Info size={16} className="shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      Thời gian xét duyệt thông thường từ <strong>2 đến 24 giờ làm việc</strong>. Khi hoàn tất, bạn sẽ nhận được thông báo in-app và Email xác nhận.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={loadMyVerifications}
                    className="w-full py-2.5 rounded-2xl border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted/70 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={14} className={loadingStatus ? 'animate-spin' : ''} />
                    <span>Kiểm tra lại trạng thái xét duyệt</span>
                  </button>
                </div>
              ) : isRejected ? (
                /* BỊ TỪ CHỐI */
                <div className="rounded-3xl border border-red-500/30 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-red-600 p-3 text-white shadow-md shadow-red-950/20">
                      <XCircle className="size-8" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold tracking-wider uppercase text-red-600 block">
                        Hồ Sơ Bị Từ Chối
                      </span>
                      <h3 className="text-lg font-bold text-foreground">
                        Minh Chứng Chưa Đạt Yêu Cầu
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Vui lòng xem lý do bên dưới và bổ sung/chụp lại ảnh minh chứng mới.
                      </p>
                    </div>
                  </div>

                  {latestItem?.rejectionReason && (
                    <div className="rounded-2xl border border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40 p-4 space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 block">
                        Lý Do Từ Chối Của Quản Trị Viên:
                      </span>
                      <p className="text-xs font-semibold text-red-900 dark:text-red-200">
                        {latestItem.rejectionReason}
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveTab('form')}
                    className="w-full py-3 rounded-2xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-md shadow-red-950/20 cursor-pointer"
                  >
                    <Upload size={15} />
                    <span>Tải Lên Lại Ảnh Minh Chứng Mới</span>
                  </button>
                </div>
              ) : (
                /* CHƯA NỘP HỒ SƠ */
                <div className="rounded-3xl border border-dashed border-border bg-muted/10 p-8 text-center space-y-4">
                  <div className="mx-auto rounded-3xl bg-muted/60 p-4 text-muted-foreground w-fit">
                    <ShieldCheck className="size-10 text-[#005A36]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Bạn Chưa Có Hồ Sơ Ưu Đãi</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                      Đăng ký ngay minh chứng thẻ Sinh viên hoặc CCCD để được giảm 50% - 60% khi sử dụng mạng lưới xe buýt điện thông minh ICTU.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('form')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#005A36] text-white text-xs font-bold hover:bg-[#00472b] transition-all shadow-md shadow-emerald-950/20 cursor-pointer"
                  >
                    <span>Bắt Đầu Điền Hồ Sơ</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FORM NỘP HỒ SƠ */}
          {activeTab === 'form' && (
            <form onSubmit={handleSubmitForm} className="space-y-5">
              {/* BƯỚC 1: CHỌN ĐỐI TƯỢNG */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground block">
                  1. Chọn đối tượng ưu đãi của bạn:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCategory('student')}
                    className={cn(
                      'p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3',
                      category === 'student'
                        ? 'border-[#005A36] bg-emerald-500/10 text-foreground ring-2 ring-[#005A36]/30'
                        : 'border-border bg-card text-muted-foreground hover:border-emerald-500/40',
                    )}
                  >
                    <div className="rounded-xl bg-emerald-500/20 p-2 text-[#005A36] shrink-0">
                      <GraduationCap size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground text-xs sm:text-sm">Học Sinh - Sinh Viên</span>
                        <span className="rounded-full bg-emerald-600 text-white px-1.5 py-0.2 text-[10px] font-bold">
                          -50%
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Thẻ sinh viên ICTU & các trường CĐ/ĐH
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCategory('elderly')}
                    className={cn(
                      'p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3',
                      category === 'elderly'
                        ? 'border-[#005A36] bg-emerald-500/10 text-foreground ring-2 ring-[#005A36]/30'
                        : 'border-border bg-card text-muted-foreground hover:border-emerald-500/40',
                    )}
                  >
                    <div className="rounded-xl bg-rose-500/20 p-2 text-rose-600 shrink-0">
                      <Heart size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground text-xs sm:text-sm">Người Cao Tuổi</span>
                        <span className="rounded-full bg-rose-600 text-white px-1.5 py-0.2 text-[10px] font-bold">
                          -60%
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Công dân từ 60 tuổi trở lên (xác thực CCCD)
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* BƯỚC 2: THÔNG TIN CHI TIẾT */}
              <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
                <span className="text-xs font-bold text-foreground block">
                  2. Khai báo thông tin định danh:
                </span>

                {category === 'student' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Mã Số Sinh Viên (MSSV) <span className="text-red-500">*</span>:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="VD: DTC215480201..."
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-mono text-foreground focus:border-[#005A36] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Trường Đang Học:
                      </label>
                      <input
                        type="text"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs text-foreground focus:border-[#005A36] focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Số Căn Cước Công Dân (CCCD / CMND) <span className="text-red-500">*</span>:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: 019203001234"
                      value={idCardNumber}
                      onChange={(e) => setIdCardNumber(e.target.value)}
                      className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-mono text-foreground focus:border-[#005A36] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* BƯỚC 3: UPLOAD ẢNH MINH CHỨNG */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">
                    3. Tải ảnh minh chứng rõ nét (JPG, PNG, WebP &lt; 5MB):
                  </label>
                  <span className="text-[11px] text-muted-foreground">Chụp thẳng góc, không lóa sáng</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Ô 1: MẶT TRƯỚC */}
                  <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <IdCard size={14} className="text-[#005A36]" />
                        Mặt trước Thẻ SV / CCCD <span className="text-red-500">*</span>
                      </span>
                      {frontUrl && (
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                          <Check size={11} /> Đã tải lên
                        </span>
                      )}
                    </div>

                    <input
                      type="file"
                      ref={frontInputRef}
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => handleSelectFile(e.target.files?.[0] || null, 'front')}
                    />

                    {frontPreview ? (
                      <div className="relative h-32 w-full rounded-xl overflow-hidden border border-border group">
                        <img
                          src={frontPreview}
                          alt="Mặt trước"
                          className="h-full w-full object-cover"
                        />
                        {uploadingFront && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs gap-1.5">
                            <Loader2 size={16} className="animate-spin" />
                            <span>Đang tải lên...</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => frontInputRef.current?.click()}
                            className="p-1.5 rounded-lg bg-white/90 text-black hover:bg-white text-xs font-medium cursor-pointer"
                          >
                            Đổi ảnh
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFrontFile(null)
                              setFrontPreview(null)
                              setFrontUrl(null)
                            }}
                            className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 text-xs cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => frontInputRef.current?.click()}
                        className="w-full h-32 rounded-xl border border-dashed border-border hover:border-[#005A36] bg-muted/30 hover:bg-emerald-500/5 transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        <Upload size={20} className="text-[#005A36]" />
                        <span className="text-xs font-medium">Bấm để tải ảnh mặt trước</span>
                        <span className="text-[10px] text-muted-foreground">Tối đa 5MB</span>
                      </button>
                    )}
                  </div>

                  {/* Ô 2: MẶT SAU */}
                  <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <IdCard size={14} className="text-[#005A36]" />
                        Mặt sau Thẻ SV / CCCD <span className="text-red-500">*</span>
                      </span>
                      {backUrl && (
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                          <Check size={11} /> Đã tải lên
                        </span>
                      )}
                    </div>

                    <input
                      type="file"
                      ref={backInputRef}
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => handleSelectFile(e.target.files?.[0] || null, 'back')}
                    />

                    {backPreview ? (
                      <div className="relative h-32 w-full rounded-xl overflow-hidden border border-border group">
                        <img
                          src={backPreview}
                          alt="Mặt sau"
                          className="h-full w-full object-cover"
                        />
                        {uploadingBack && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs gap-1.5">
                            <Loader2 size={16} className="animate-spin" />
                            <span>Đang tải lên...</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => backInputRef.current?.click()}
                            className="p-1.5 rounded-lg bg-white/90 text-black hover:bg-white text-xs font-medium cursor-pointer"
                          >
                            Đổi ảnh
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setBackFile(null)
                              setBackPreview(null)
                              setBackUrl(null)
                            }}
                            className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 text-xs cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => backInputRef.current?.click()}
                        className="w-full h-32 rounded-xl border border-dashed border-border hover:border-[#005A36] bg-muted/30 hover:bg-emerald-500/5 transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        <Upload size={20} className="text-[#005A36]" />
                        <span className="text-xs font-medium">Bấm để tải ảnh mặt sau</span>
                        <span className="text-[10px] text-muted-foreground">Tối đa 5MB</span>
                      </button>
                    )}
                  </div>

                  {/* Ô 3: ẢNH CHÂN DUNG (TÙY CHỌN) */}
                  <div className="rounded-2xl border border-border bg-card p-3 space-y-2 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <User size={14} className="text-[#005A36]" />
                        Ảnh chân dung đối chiếu 3x4 (Tùy chọn)
                      </span>
                      {portraitUrl && (
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                          <Check size={11} /> Đã tải lên
                        </span>
                      )}
                    </div>

                    <input
                      type="file"
                      ref={portraitInputRef}
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => handleSelectFile(e.target.files?.[0] || null, 'portrait')}
                    />

                    {portraitPreview ? (
                      <div className="relative h-28 w-full rounded-xl overflow-hidden border border-border group flex items-center justify-center bg-muted/20">
                        <img
                          src={portraitPreview}
                          alt="Chân dung"
                          className="h-full w-auto object-contain"
                        />
                        {uploadingPortrait && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs gap-1.5">
                            <Loader2 size={16} className="animate-spin" />
                            <span>Đang tải lên...</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => portraitInputRef.current?.click()}
                            className="p-1.5 rounded-lg bg-white/90 text-black hover:bg-white text-xs font-medium cursor-pointer"
                          >
                            Đổi ảnh
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPortraitFile(null)
                              setPortraitPreview(null)
                              setPortraitUrl(null)
                            }}
                            className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 text-xs cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => portraitInputRef.current?.click()}
                        className="w-full h-20 rounded-xl border border-dashed border-border hover:border-[#005A36] bg-muted/20 hover:bg-emerald-500/5 transition-all flex items-center justify-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        <User size={16} className="text-[#005A36]" />
                        <span className="text-xs">Tải ảnh chân dung rõ mặt để in vé điện tử đẹp hơn</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* NÚT SUBMIT */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('status')}
                  className="px-4 py-2.5 rounded-2xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || uploadingFront || uploadingBack || uploadingPortrait}
                  className="px-6 py-2.5 rounded-2xl bg-[#005A36] text-white text-xs font-bold hover:bg-[#00472b] transition-all shadow-md shadow-emerald-950/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Đang gửi hồ sơ...</span>
                    </>
                  ) : (
                    <>
                      <span>Gửi Hồ Sơ Thẩm Định</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
