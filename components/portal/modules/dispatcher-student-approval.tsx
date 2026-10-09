'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  GraduationCap,
  Search,
  UserCheck,
  XCircle,
  FileText,
  RefreshCw,
  AlertTriangle,
  X,
  User,
  Calendar,
  CreditCard,
  MapPin,
  Heart,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Phone,
  Mail,
  School,
  IdCard,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
} from 'lucide-react'
import {
  priorityVerificationService,
  type PriorityVerificationItem,
} from '@/lib/services/priority-verification.service'
import { promotionService } from '@/lib/services/promotion.service'

interface StudentPassApp {
  id: string
  passCode: string
  studentName: string
  studentId: string
  university: string
  faculty: string
  route: string
  passType: string
  price: number
  startDate: string
  endDate: string
  appliedDate: string
  status: 'pending' | 'approved' | 'rejected'
  idCardPhotoUrl: string
  rejectionReason?: string
  approvedBy?: string
}

export function DispatcherStudentApproval() {
  // Chế độ xem: Thẩm định hồ sơ đối tượng ưu đãi (Tài khoản) HOẶC Duyệt vé tháng (Chặng)
  const [activeTab, setActiveTab] = useState<'account-verifications' | 'monthly-passes'>(
    'account-verifications'
  )

  // ==================== STATE CHO HỒ SƠ ƯU ĐÃI TÀI KHOẢN ====================
  const [verifications, setVerifications] = useState<PriorityVerificationItem[]>([])
  const [loadingVerifications, setLoadingVerifications] = useState(true)
  const [verificationsError, setVerificationsError] = useState<string | null>(null)
  const [verifStatusFilter, setVerifStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all')
  const [verifCategoryFilter, setVerifCategoryFilter] = useState<'all' | 'student' | 'elderly'>('all')
  const [verifSearch, setVerifSearch] = useState('')
  const [previewVerif, setPreviewVerif] = useState<PriorityVerificationItem | null>(null)

  // State từ chối hồ sơ kèm lý do
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectingItem, setRejectingItem] = useState<{ id: string; name: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState<string | null>(null)

  // State Lightbox phóng to ảnh minh chứng
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null)
  const [lightboxZoom, setLightboxZoom] = useState<number>(1)
  const [lightboxRotation, setLightboxRotation] = useState<number>(0)

  // ==================== STATE CHO DUYỆT VÉ THÁNG ====================
  const [passes, setPasses] = useState<StudentPassApp[]>([])
  const [loadingPasses, setLoadingPasses] = useState(false)
  const [passesError, setPassesError] = useState<string | null>(null)
  const [passStatusFilter, setPassStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [passSearch, setPassSearch] = useState('')
  const [previewPass, setPreviewPass] = useState<StudentPassApp | null>(null)

  // Chung
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // ==================== LOAD HỒ SƠ XÁC THỰC TÀI KHOẢN ====================
  const loadVerifications = useCallback(async () => {
    setLoadingVerifications(true)
    setVerificationsError(null)
    try {
      const res = await priorityVerificationService.getAdminVerifications({
        page: 1,
        limit: 100,
        status: verifStatusFilter === 'all' ? undefined : verifStatusFilter,
        category: verifCategoryFilter === 'all' ? undefined : verifCategoryFilter,
      })

      if (res.success && res.data) {
        const items = Array.isArray(res.data.items) ? res.data.items : []
        setVerifications(items)
      } else {
        setVerificationsError(res.message || 'Không thể tải danh sách hồ sơ xác thực đối tượng ưu đãi')
      }
    } catch (err: any) {
      setVerificationsError(err.message || 'Lỗi kết nối máy chủ')
    } finally {
      setLoadingVerifications(false)
    }
  }, [verifStatusFilter, verifCategoryFilter])

  // ==================== LOAD HỒ SƠ VÉ THÁNG ====================
  const loadPasses = useCallback(async () => {
    setLoadingPasses(true)
    setPassesError(null)
    try {
      const res = await promotionService.getAdminMonthlyPasses({
        page: 1,
        limit: 50,
        status: passStatusFilter === 'all' ? undefined : passStatusFilter,
      })

      if (res.success && res.data) {
        const rawItems = Array.isArray(res.data) ? res.data : res.data.items || []
        const mapped: StudentPassApp[] = rawItems.map((item: any) => ({
          id: item.id,
          passCode: item.passCode,
          studentName: item.user?.fullName || 'Sinh viên ICTU',
          studentId: item.user?.studentId || 'N/A',
          university: 'Trường ĐH Công Nghệ Thông Tin & Truyền Thông (ICTU)',
          faculty: item.user?.faculty || 'Khoa Công nghệ Thông tin',
          route: item.route?.name || 'Tuyến xe buýt ICTU',
          passType:
            item.category === 'student'
              ? 'Vé tháng Sinh viên (Giảm 50%)'
              : item.category === 'elderly'
              ? 'Vé tháng Người cao tuổi'
              : 'Vé tháng Tiêu chuẩn',
          price: Number(item.price || 100000),
          startDate: item.startDate,
          endDate: item.endDate,
          appliedDate: item.createdAt,
          status: (item.approvalStatus?.toLowerCase() as any) || 'pending',
          idCardPhotoUrl:
            item.proofImageUrl ||
            'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80',
          rejectionReason: item.rejectionReason,
          approvedBy: item.approvedByUser?.fullName,
        }))
        setPasses(mapped)
      } else {
        setPassesError(res.message || 'Không thể tải danh sách hồ sơ vé tháng')
      }
    } catch (err: any) {
      setPassesError(err.message || 'Lỗi kết nối máy chủ')
    } finally {
      setLoadingPasses(false)
    }
  }, [passStatusFilter])

  useEffect(() => {
    if (activeTab === 'account-verifications') {
      loadVerifications()
    } else {
      loadPasses()
    }
  }, [activeTab, loadVerifications, loadPasses])

  // ==================== HÀNH ĐỘNG DUYỆT HỒ SƠ TÀI KHOẢN ====================
  const handleApproveVerification = async (id: string, name: string) => {
    setIsProcessing(true)
    try {
      const res = await priorityVerificationService.reviewVerification(id, 'approved')
      if (res.success) {
        setVerifications((prev) =>
          prev.map((v) => (v.id === id ? { ...v, status: 'verified', rejectionReason: null } : v))
        )
        if (previewVerif?.id === id) {
          setPreviewVerif((prev) => (prev ? { ...prev, status: 'verified', rejectionReason: null } : null))
        }
        setFeedback(`Đã phê duyệt đối tượng ưu đãi thành công cho tài khoản: ${name}. Hệ thống đã gửi Email và Thông báo in-app!`)
      } else {
        alert(res.message || 'Không thể duyệt hồ sơ này')
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi gửi yêu cầu duyệt hồ sơ')
    } finally {
      setIsProcessing(false)
      setTimeout(() => setFeedback(null), 5000)
    }
  }

  const handleOpenRejectModal = (id: string, name: string) => {
    setRejectingItem({ id, name })
    setRejectReason('')
    setRejectError(null)
    setRejectModalOpen(true)
  }

  const handleConfirmRejectVerification = async () => {
    if (!rejectingItem) return
    if (!rejectReason.trim()) {
      setRejectError('Vui lòng nhập lý do từ chối cụ thể để hướng dẫn người dùng.')
      return
    }

    setIsProcessing(true)
    setRejectError(null)
    try {
      const res = await priorityVerificationService.reviewVerification(
        rejectingItem.id,
        'rejected',
        rejectReason.trim()
      )
      if (res.success) {
        setVerifications((prev) =>
          prev.map((v) =>
            v.id === rejectingItem.id
              ? { ...v, status: 'rejected', rejectionReason: rejectReason.trim() }
              : v
          )
        )
        if (previewVerif?.id === rejectingItem.id) {
          setPreviewVerif((prev) =>
            prev
              ? { ...prev, status: 'rejected', rejectionReason: rejectReason.trim() }
              : null
          )
        }
        setRejectModalOpen(false)
        setRejectingItem(null)
        setFeedback(`Đã từ chối hồ sơ của: ${rejectingItem.name}. Đã gửi lý do chi tiết qua Email và Thông báo.`)
      } else {
        setRejectError(res.message || 'Không thể từ chối hồ sơ này')
      }
    } catch (err: any) {
      setRejectError(err.message || 'Lỗi khi gửi yêu cầu từ chối')
    } finally {
      setIsProcessing(false)
      setTimeout(() => setFeedback(null), 5000)
    }
  }

  // ==================== HÀNH ĐỘNG DUYỆT VÉ THÁNG ====================
  const handleApprovePass = async (id: string, name: string) => {
    setIsProcessing(true)
    try {
      const res = await promotionService.reviewMonthlyPass(id, 'approved')
      if (res.success) {
        setPasses((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'approved' } : a)))
        setPreviewPass(null)
        setFeedback(`Đã phê duyệt vé tháng HSSV thành công cho: ${name}`)
      } else {
        alert(res.message || 'Không thể duyệt vé tháng này')
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi gửi yêu cầu duyệt')
    } finally {
      setIsProcessing(false)
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  const handleRejectPass = async (id: string, name: string) => {
    const reason = prompt('Nhập lý do từ chối vé tháng:', 'Ảnh thẻ sinh viên không hợp lệ hoặc đã hết hạn')
    if (reason === null) return

    setIsProcessing(true)
    try {
      const res = await promotionService.reviewMonthlyPass(id, 'rejected', reason)
      if (res.success) {
        setPasses((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: 'rejected', rejectionReason: reason } : a))
        )
        setPreviewPass(null)
        setFeedback(`Đã từ chối vé tháng của: ${name} (${reason})`)
      } else {
        alert(res.message || 'Không thể từ chối vé tháng này')
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi gửi yêu cầu từ chối')
    } finally {
      setIsProcessing(false)
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  // Lọc tìm kiếm hồ sơ tài khoản
  const filteredVerifications = verifications.filter((v) => {
    const name = v.user?.fullName?.toLowerCase() || ''
    const email = v.user?.email?.toLowerCase() || ''
    const studentId = v.studentId?.toLowerCase() || ''
    const idCard = v.idCardNumber?.toLowerCase() || ''
    const school = v.schoolName?.toLowerCase() || ''
    const s = verifSearch.toLowerCase()
    return name.includes(s) || email.includes(s) || studentId.includes(s) || idCard.includes(s) || school.includes(s)
  })

  // Lọc tìm kiếm vé tháng
  const filteredPasses = passes.filter(
    (a) =>
      a.studentName.toLowerCase().includes(passSearch.toLowerCase()) ||
      a.studentId.toLowerCase().includes(passSearch.toLowerCase()) ||
      a.passCode.toLowerCase().includes(passSearch.toLowerCase()) ||
      a.route.toLowerCase().includes(passSearch.toLowerCase())
  )

  // Thống kê hồ sơ tài khoản
  const verifPendingCount = verifications.filter((v) => v.status === 'pending').length
  const verifVerifiedCount = verifications.filter((v) => v.status === 'verified').length
  const verifRejectedCount = verifications.filter((v) => v.status === 'rejected').length

  // Thống kê vé tháng
  const passPendingCount = passes.filter((a) => a.status === 'pending').length
  const passApprovedCount = passes.filter((a) => a.status === 'approved').length
  const passRejectedCount = passes.filter((a) => a.status === 'rejected').length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="size-7 text-[#005A36]" />
            Thẩm Định Đối Tượng Ưu Đãi & Vé Tháng HSSV
          </h1>
          <p className="text-sm text-muted-foreground">
            Phê duyệt minh chứng Thẻ Sinh Viên, CCCD Người cao tuổi và kích hoạt quyền mua vé trợ giá 50% - 60%
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => (activeTab === 'account-verifications' ? loadVerifications() : loadPasses())}
            disabled={loadingVerifications || loadingPasses}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/70 transition-colors disabled:opacity-50"
            title="Đồng bộ cơ sở dữ liệu"
          >
            <RefreshCw size={14} className={loadingVerifications || loadingPasses ? 'animate-spin' : ''} />
            <span>Làm mới DB</span>
          </button>
        </div>
      </div>

      {/* TABS CHUYỂN ĐỔI CHẾ ĐỘ QUẢN LÝ */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('account-verifications')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'account-verifications'
              ? 'bg-[#005A36] text-white shadow-md shadow-emerald-950/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <UserCheck size={16} />
          <span>Hồ Sơ Xác Thực Tài Khoản (HSSV / Cao Tuổi)</span>
          {verifPendingCount > 0 && (
            <span className="rounded-full bg-amber-400 text-amber-950 px-2 py-0.5 text-[10px] font-black">
              {verifPendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('monthly-passes')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'monthly-passes'
              ? 'bg-[#005A36] text-white shadow-md shadow-emerald-950/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <GraduationCap size={16} />
          <span>Đơn Mua Vé Tháng Trợ Giá Theo Tuyến</span>
          {passPendingCount > 0 && (
            <span className="rounded-full bg-amber-400 text-amber-950 px-2 py-0.5 text-[10px] font-black">
              {passPendingCount}
            </span>
          )}
        </button>
      </div>

      {feedback && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: THẨM ĐỊNH HỒ SƠ TÀI KHOẢN ƯU ĐÃI (STUDENT / ELDERLY)             */}
      {/* ========================================================================= */}
      {activeTab === 'account-verifications' && (
        <>
          {/* KPI Cards cho Tab Xác thực Tài khoản */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Tổng hồ sơ gửi lên</span>
                <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
                  <FileText size={18} />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">{verifications.length}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Tài khoản yêu cầu xét duyệt</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Chờ HR thẩm định</span>
                <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
                  <Clock size={18} />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-600">{verifPendingCount}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Cần phê duyệt ngay</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Đã xác thực hợp lệ</span>
                <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-600">{verifVerifiedCount}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Hưởng giá ưu đãi vĩnh viễn</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Bị từ chối</span>
                <div className="rounded-lg bg-red-500/10 p-2 text-red-600">
                  <XCircle size={18} />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold text-red-600">{verifRejectedCount}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Minh chứng không hợp lệ</p>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Lọc trạng thái */}
              <button
                onClick={() => setVerifStatusFilter('all')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  verifStatusFilter === 'all'
                    ? 'bg-foreground text-background shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Tất cả ({verifications.length})
              </button>
              <button
                onClick={() => setVerifStatusFilter('pending')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  verifStatusFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Chờ duyệt ({verifPendingCount})
              </button>
              <button
                onClick={() => setVerifStatusFilter('verified')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  verifStatusFilter === 'verified'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Đã duyệt ({verifVerifiedCount})
              </button>
              <button
                onClick={() => setVerifStatusFilter('rejected')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  verifStatusFilter === 'rejected'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Từ chối ({verifRejectedCount})
              </button>

              <div className="h-5 w-px bg-border mx-1" />

              {/* Lọc đối tượng */}
              <button
                onClick={() => setVerifCategoryFilter('all')}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  verifCategoryFilter === 'all'
                    ? 'bg-muted text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Mọi đối tượng
              </button>
              <button
                onClick={() => setVerifCategoryFilter('student')}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${
                  verifCategoryFilter === 'student'
                    ? 'bg-emerald-100 text-emerald-800 font-bold dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <GraduationCap size={13} />
                <span>Sinh viên</span>
              </button>
              <button
                onClick={() => setVerifCategoryFilter('elderly')}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${
                  verifCategoryFilter === 'elderly'
                    ? 'bg-sky-100 text-sky-800 font-bold dark:bg-sky-950/60 dark:text-sky-300'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Heart size={13} />
                <span>Người cao tuổi</span>
              </button>
            </div>

            <div className="relative w-full max-w-xs">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm tên, email, MSSV, CCCD..."
                value={verifSearch}
                onChange={(e) => setVerifSearch(e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {verificationsError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>{verificationsError}</span>
              </div>
              <button onClick={loadVerifications} className="font-semibold underline">
                Thử lại
              </button>
            </div>
          )}

          {/* Grid Hồ sơ tài khoản */}
          {loadingVerifications ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 rounded-3xl border border-border bg-card p-6 animate-pulse" />
              ))}
            </div>
          ) : filteredVerifications.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center text-xs text-muted-foreground">
              Không có hồ sơ xác thực đối tượng ưu đãi nào phù hợp.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredVerifications.map((item) => {
                const isStudent = item.category === 'student'
                return (
                  <div
                    key={item.id}
                    className="rounded-3xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between hover:border-emerald-500/40 transition-all group"
                  >
                    <div>
                      {/* Badge loại đối tượng & Trạng thái */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            isStudent
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                              : 'bg-sky-500/10 text-sky-700 dark:text-sky-400'
                          }`}
                        >
                          {isStudent ? <GraduationCap size={14} /> : <Heart size={14} />}
                          <span>{isStudent ? 'Sinh viên ICTU' : 'Người cao tuổi'}</span>
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            item.status === 'verified'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : item.status === 'rejected'
                              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}
                        >
                          {item.status === 'verified'
                            ? 'Đã xác thực'
                            : item.status === 'rejected'
                            ? 'Bị từ chối'
                            : 'Chờ xét duyệt'}
                        </span>
                      </div>

                      {/* Thông tin cá nhân */}
                      <div className="mt-3">
                        <h3 className="text-base font-bold text-foreground">
                          {item.user?.fullName || 'Hành khách'}
                        </h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Mail size={12} />
                          <span>{item.user?.email || 'N/A'}</span>
                        </p>
                      </div>

                      {/* Chi tiết minh chứng */}
                      <div className="mt-4 border-t border-border pt-3 space-y-1.5 text-xs">
                        {isStudent ? (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Mã sinh viên:</span>
                              <span className="font-mono font-bold text-foreground">{item.studentId || 'Chưa cung cấp'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Trường đào tạo:</span>
                              <span className="font-medium text-foreground truncate max-w-[170px]" title={item.schoolName || ''}>
                                {item.schoolName || 'ĐH CNTT & TT (ICTU)'}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Số CCCD / CMND:</span>
                            <span className="font-mono font-bold text-foreground">{item.idCardNumber || 'Chưa cung cấp'}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Mức trợ giá:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {isStudent ? 'Giảm 50% toàn mạng lưới' : 'Giảm 60% toàn mạng lưới'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                          <span>Ngày gửi yêu cầu:</span>
                          <span>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                      </div>

                      {/* Lý do từ chối nếu có */}
                      {item.rejectionReason && (
                        <div className="mt-3 rounded-xl bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                          <strong>Lý do từ chối:</strong> {item.rejectionReason}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="mt-5 border-t border-border pt-4 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewVerif(item)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#005A36] hover:underline transition-colors cursor-pointer"
                      >
                        <Eye size={14} />
                        <span>Xem chi tiết hồ sơ</span>
                      </button>

                      {item.status === 'pending' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleOpenRejectModal(item.id, item.user?.fullName || 'Khách hàng')}
                            className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 cursor-pointer"
                          >
                            Từ chối
                          </button>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleApproveVerification(item.id, item.user?.fullName || 'Khách hàng')}
                            className="rounded-xl bg-[#005A36] px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-[#00472b] transition-colors cursor-pointer"
                          >
                            Phê duyệt
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          {item.reviewedByUser?.fullName ? `Xử lý bởi: ${item.reviewedByUser.fullName}` : 'Đã duyệt'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DUYỆT ĐƠN ĐĂNG KÝ VÉ THÁNG (PASSES)                                */}
      {/* ========================================================================= */}
      {activeTab === 'monthly-passes' && (
        <>
          {/* KPI Cards cho Vé Tháng */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Tổng đơn vé tháng</span>
                <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
                  <FileText size={18} />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">{passes.length}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Sinh viên đăng ký tuyến</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Chờ xét duyệt</span>
                <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
                  <Clock size={18} />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-600">{passPendingCount}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Cần kích hoạt vé</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Đã phê duyệt</span>
                <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-600">{passApprovedCount}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Đã cấp vé tháng điện tử</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Bị từ chối</span>
                <div className="rounded-lg bg-red-500/10 p-2 text-red-600">
                  <XCircle size={18} />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold text-red-600">{passRejectedCount}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Hồ sơ không hợp lệ</p>
            </div>
          </div>

          {/* Filter & Search Bar Vé Tháng */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPassStatusFilter('all')}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                  passStatusFilter === 'all'
                    ? 'bg-foreground text-background shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Tất cả ({passes.length})
              </button>
              <button
                onClick={() => setPassStatusFilter('pending')}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                  passStatusFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Chờ duyệt ({passPendingCount})
              </button>
              <button
                onClick={() => setPassStatusFilter('approved')}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                  passStatusFilter === 'approved'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Đã duyệt ({passApprovedCount})
              </button>
              <button
                onClick={() => setPassStatusFilter('rejected')}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                  passStatusFilter === 'rejected'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Từ chối ({passRejectedCount})
              </button>
            </div>

            <div className="relative w-full max-w-xs">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tên sinh viên, mã SV, tuyến..."
                value={passSearch}
                onChange={(e) => setPassSearch(e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {passesError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>{passesError}</span>
              </div>
              <button onClick={loadPasses} className="font-semibold underline">
                Thử lại
              </button>
            </div>
          )}

          {/* Grid Vé Tháng */}
          {loadingPasses ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 rounded-3xl border border-border bg-card p-6 animate-pulse" />
              ))}
            </div>
          ) : filteredPasses.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center text-xs text-muted-foreground">
              Không có hồ sơ đăng ký vé tháng nào phù hợp.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPasses.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between hover:border-emerald-500/40 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-foreground flex items-center gap-1.5">
                        <GraduationCap size={16} className="text-emerald-600" />
                        {item.passCode}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          item.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : item.status === 'rejected'
                            ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                        }`}
                      >
                        {item.status === 'approved'
                          ? 'Đã phê duyệt'
                          : item.status === 'rejected'
                          ? 'Từ chối'
                          : 'Chờ xét duyệt'}
                      </span>
                    </div>

                    <div className="mt-3">
                      <h3 className="text-base font-bold text-foreground">{item.studentName}</h3>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        Mã SV: <strong className="text-foreground">{item.studentId}</strong> · {item.faculty}
                      </p>
                    </div>

                    <div className="mt-4 border-t border-border pt-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tuyến đăng ký:</span>
                        <span className="font-medium text-foreground truncate max-w-[170px]" title={item.route}>
                          {item.route}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Loại vé:</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {item.passType}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Cước phí:</span>
                        <span className="font-mono font-bold text-foreground">
                          {item.price.toLocaleString('vi-VN')} đ/tháng
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                        <span>Thời hạn:</span>
                        <span>
                          {new Date(item.startDate).toLocaleDateString('vi-VN')} -{' '}
                          {new Date(item.endDate).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </div>

                    {item.rejectionReason && (
                      <div className="mt-3 rounded-xl bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                        <strong>Lý do từ chối:</strong> {item.rejectionReason}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-5 border-t border-border pt-4 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewPass(item)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-emerald-600 transition-colors"
                    >
                      <Eye size={13} /> Xem ảnh thẻ SV
                    </button>

                    {item.status === 'pending' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleRejectPass(item.id, item.studentName)}
                          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                        >
                          Từ chối
                        </button>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleApprovePass(item.id, item.studentName)}
                          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                        >
                          Phê duyệt
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        {item.approvedBy ? `Duyệt bởi: ${item.approvedBy}` : 'Đã xử lý'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL XEM CHI TIẾT & THẨM ĐỊNH HỒ SƠ TÀI KHOẢN (FULL MINH CHỨNG 3 ẢNH)   */}
      {/* ========================================================================= */}
      {previewVerif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck size={20} className="text-[#005A36]" />
                  Hồ Sơ Xác Thực: {previewVerif.user?.fullName || 'Người dùng'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Email: <strong>{previewVerif.user?.email}</strong> · Loại đối tượng:{' '}
                  <strong className="text-emerald-600">
                    {previewVerif.category === 'student' ? 'Sinh viên ICTU' : 'Người cao tuổi'}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setPreviewVerif(null)}
                className="rounded-xl p-1 text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* Thẻ hiển thị các ảnh minh chứng (Mặt trước, mặt sau, chân dung) */}
              <div>
                <span className="text-xs font-bold text-foreground block mb-2">
                  Hình Ảnh Minh Chứng Đối Chiếu:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Ảnh mặt trước */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Mặt trước Thẻ SV / CCCD:
                    </span>
                    <div className="relative h-44 w-full rounded-2xl overflow-hidden border border-border bg-muted/40 flex items-center justify-center group">
                      <img
                        src={previewVerif.frontImageUrl}
                        alt="Mặt trước"
                        className="h-full w-full object-cover cursor-zoom-in"
                        onClick={() => {
                          setLightboxImage({ url: previewVerif.frontImageUrl, title: `Mặt trước Thẻ SV/CCCD: ${previewVerif.user?.fullName || 'Khách hàng'}` })
                          setLightboxZoom(1)
                          setLightboxRotation(0)
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setLightboxImage({ url: previewVerif.frontImageUrl, title: `Mặt trước Thẻ SV/CCCD: ${previewVerif.user?.fullName || 'Khách hàng'}` })
                          setLightboxZoom(1)
                          setLightboxRotation(0)
                        }}
                        className="absolute bottom-2 right-2 rounded-xl bg-black/70 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-white flex items-center gap-1 hover:bg-black cursor-pointer"
                      >
                        <ZoomIn size={11} /> Phóng to
                      </button>
                    </div>
                  </div>

                  {/* Ảnh mặt sau (nếu có) */}
                  {previewVerif.backImageUrl && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        Mặt sau Thẻ SV / CCCD:
                      </span>
                      <div className="relative h-44 w-full rounded-2xl overflow-hidden border border-border bg-muted/40 flex items-center justify-center group">
                        <img
                          src={previewVerif.backImageUrl}
                          alt="Mặt sau"
                          className="h-full w-full object-cover cursor-zoom-in"
                          onClick={() => {
                            setLightboxImage({ url: previewVerif.backImageUrl!, title: `Mặt sau Thẻ SV/CCCD: ${previewVerif.user?.fullName || 'Khách hàng'}` })
                            setLightboxZoom(1)
                            setLightboxRotation(0)
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setLightboxImage({ url: previewVerif.backImageUrl!, title: `Mặt sau Thẻ SV/CCCD: ${previewVerif.user?.fullName || 'Khách hàng'}` })
                            setLightboxZoom(1)
                            setLightboxRotation(0)
                          }}
                          className="absolute bottom-2 right-2 rounded-xl bg-black/70 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-white flex items-center gap-1 hover:bg-black cursor-pointer"
                        >
                          <ZoomIn size={11} /> Phóng to
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Ảnh chân dung (nếu có) */}
                  {previewVerif.portraitImageUrl && (
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        Ảnh chân dung đối chiếu:
                      </span>
                      <div className="relative h-36 w-full rounded-2xl overflow-hidden border border-border bg-muted/40 flex items-center justify-center group">
                        <img
                          src={previewVerif.portraitImageUrl}
                          alt="Chân dung"
                          className="h-full w-full object-contain cursor-zoom-in"
                          onClick={() => {
                            setLightboxImage({ url: previewVerif.portraitImageUrl!, title: `Ảnh chân dung: ${previewVerif.user?.fullName || 'Khách hàng'}` })
                            setLightboxZoom(1)
                            setLightboxRotation(0)
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setLightboxImage({ url: previewVerif.portraitImageUrl!, title: `Ảnh chân dung: ${previewVerif.user?.fullName || 'Khách hàng'}` })
                            setLightboxZoom(1)
                            setLightboxRotation(0)
                          }}
                          className="absolute bottom-2 right-2 rounded-xl bg-black/70 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-white flex items-center gap-1 hover:bg-black cursor-pointer"
                        >
                          <ZoomIn size={11} /> Phóng to
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bảng thông tin xác minh */}
              <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2 text-xs">
                {previewVerif.category === 'student' ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Mã sinh viên:</span>
                      <span className="font-mono font-bold text-foreground">
                        {previewVerif.studentId || 'Chưa cung cấp'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Trường đào tạo:</span>
                      <span className="font-semibold text-foreground">
                        {previewVerif.schoolName || 'Trường ĐH Công Nghệ Thông Tin & Truyền Thông (ICTU)'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Số CCCD / CMND:</span>
                    <span className="font-mono font-bold text-foreground">
                      {previewVerif.idCardNumber || 'Chưa cung cấp'}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Chính sách ưu đãi:</span>
                  <span className="font-bold text-[#005A36]">
                    {previewVerif.category === 'student' ? 'Trợ giá 50% toàn mạng lưới' : 'Trợ giá 60% toàn mạng lưới'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Thời điểm nộp hồ sơ:</span>
                  <span>{new Date(previewVerif.createdAt).toLocaleString('vi-VN')}</span>
                </div>
                {previewVerif.status === 'rejected' && previewVerif.rejectionReason && (
                  <div className="rounded-xl bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                    <strong>Lý do từ chối:</strong> {previewVerif.rejectionReason}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border pt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewVerif(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Đóng
              </button>

              {previewVerif.status === 'pending' && (
                <>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      setPreviewVerif(null)
                      handleOpenRejectModal(previewVerif.id, previewVerif.user?.fullName || 'Khách hàng')
                    }}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 cursor-pointer"
                  >
                    Từ chối hồ sơ
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleApproveVerification(previewVerif.id, previewVerif.user?.fullName || 'Khách hàng')}
                    className="rounded-xl bg-[#005A36] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#00472b] disabled:opacity-50 cursor-pointer"
                  >
                    Phê duyệt hồ sơ ưu đãi
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL TỪ CHỐI HỒ SƠ ƯU ĐÃI KÈM LÝ DO CỤ THỂ                              */}
      {/* ========================================================================= */}
      {rejectModalOpen && rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-base font-bold text-red-600 flex items-center gap-2">
                <AlertCircle size={18} />
                Từ Chối Hồ Sơ Ưu Đãi
              </h3>
              <button
                onClick={() => setRejectModalOpen(false)}
                className="rounded-xl p-1 text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Vui lòng nhập lý do từ chối hồ sơ của{' '}
              <strong className="text-foreground">{rejectingItem.name}</strong>. Lý do này sẽ được gửi trực tiếp qua{' '}
              <strong>Email</strong> và <strong>Thông báo in-app</strong> để người dùng bổ sung lại giấy tờ.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Lý do từ chối (Bắt buộc):</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ví dụ: Ảnh thẻ sinh viên bị mờ không nhìn rõ niên khóa, hoặc thẻ đã hết hạn..."
                className="w-full rounded-2xl border border-border bg-card p-3 text-xs text-foreground focus:border-red-500 focus:outline-none"
              />
              {/* Quick Rejection Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'Ảnh chụp mờ / lóa sáng, không đọc rõ thông tin',
                  'Thẻ học sinh / sinh viên đã quá hạn sử dụng',
                  'Họ tên hoặc số CCCD không trùng khớp',
                  'Thiếu ảnh mặt sau hoặc không có dấu xác nhận',
                  'Ảnh chụp bị cắt xén hoặc không nguyên vẹn',
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectReason(reason)}
                    className="px-2 py-1 rounded-lg bg-muted text-[10px] font-medium text-muted-foreground hover:bg-red-50 hover:text-red-700 transition-colors text-left cursor-pointer"
                  >
                    + {reason}
                  </button>
                ))}
              </div>
              {rejectError && <p className="text-[11px] text-red-600">{rejectError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="rounded-xl border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmRejectVerification}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL XEM CHI TIẾT VÉ THÁNG (PASS PREVIEW)                                */}
      {/* ========================================================================= */}
      {previewPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <UserCheck size={18} className="text-emerald-600" />
                  Hồ Sơ Vé Tháng: {previewPass.studentName}
                </h2>
                <p className="text-xs text-muted-foreground font-mono">
                  {previewPass.passCode} · Mã SV: {previewPass.studentId}
                </p>
              </div>
              <button
                onClick={() => setPreviewPass(null)}
                className="rounded-xl p-1 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              <div>
                <span className="text-xs font-semibold text-foreground block mb-2">
                  Ảnh Thẻ Sinh Viên / CCCD Đối Chiếu:
                </span>
                <div className="relative h-56 w-full rounded-2xl overflow-hidden border border-border bg-muted/40 flex items-center justify-center">
                  <img
                    src={previewPass.idCardPhotoUrl}
                    alt={`Thẻ sinh viên ${previewPass.studentName}`}
                    className="h-full w-full object-cover"
                  />
                  <a
                    href={previewPass.idCardPhotoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute bottom-2 right-2 rounded-xl bg-black/70 backdrop-blur-sm px-2.5 py-1 text-[11px] font-semibold text-white flex items-center gap-1 hover:bg-black"
                  >
                    <ExternalLink size={12} /> Xem ảnh gốc
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Trường:</span>
                  <span className="font-semibold text-foreground text-right">{previewPass.university}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Khoa / Lớp:</span>
                  <span className="font-semibold text-foreground">{previewPass.faculty}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tuyến xe áp dụng:</span>
                  <span className="font-semibold text-foreground">{previewPass.route}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Mức trợ giá:</span>
                  <span className="font-bold text-emerald-600">50% Cước thông thường</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ngày nộp hồ sơ:</span>
                  <span>{new Date(previewPass.appliedDate).toLocaleString('vi-VN')}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewPass(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Đóng
              </button>

              {previewPass.status === 'pending' && (
                <>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleRejectPass(previewPass.id, previewPass.studentName)}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Từ chối
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleApprovePass(previewPass.id, previewPass.studentName)}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Phê duyệt vé tháng
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LIGHTBOX MODAL PHÓNG TO ẢNH MINH CHỨNG (ZOOM 1X-3X & ROTATE)              */}
      {/* ========================================================================= */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl flex items-center justify-between text-white pb-3 border-b border-white/20">
            <span className="text-sm font-bold truncate">{lightboxImage.title}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.max(0.5, z - 0.5))}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                title="Thu nhỏ"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-xs font-mono font-bold px-1.5">{Math.round(lightboxZoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.min(3, z + 0.5))}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                title="Phóng to"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxRotation((r) => (r + 90) % 360)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                title="Xoay ảnh 90°"
              >
                <RotateCw size={16} />
              </button>
              <a
                href={lightboxImage.url}
                target="_blank"
                rel="noreferrer"
                download
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                title="Mở ảnh gốc trong tab mới"
              >
                <ExternalLink size={16} />
              </a>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white ml-2 cursor-pointer"
                title="Đóng (ESC)"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 w-full flex items-center justify-center overflow-auto p-4">
            <img
              src={lightboxImage.url}
              alt={lightboxImage.title}
              style={{
                transform: `scale(${lightboxZoom}) rotate(${lightboxRotation}deg)`,
                transition: 'transform 0.2s ease',
              }}
              className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}
