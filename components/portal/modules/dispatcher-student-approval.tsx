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
} from 'lucide-react'
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
  const [apps, setApps] = useState<StudentPassApp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [search, setSearch] = useState('')
  const [previewApp, setPreviewApp] = useState<StudentPassApp | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Tải danh sách hồ sơ từ Backend API
  const loadApps = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await promotionService.getAdminMonthlyPasses({
        page: 1,
        limit: 50,
        status: statusFilter === 'all' ? undefined : statusFilter,
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
        setApps(mapped)
      } else {
        setError(res.message || 'Không thể tải danh sách hồ sơ vé tháng')
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadApps()
  }, [loadApps])

  // Lọc theo tìm kiếm
  const filtered = apps.filter(
    (a) =>
      a.studentName.toLowerCase().includes(search.toLowerCase()) ||
      a.studentId.toLowerCase().includes(search.toLowerCase()) ||
      a.passCode.toLowerCase().includes(search.toLowerCase()) ||
      a.route.toLowerCase().includes(search.toLowerCase())
  )

  // Xử lý phê duyệt hồ sơ
  const handleApprove = async (id: string, name: string) => {
    setIsProcessing(true)
    try {
      const res = await promotionService.reviewMonthlyPass(id, 'approved')
      if (res.success) {
        setApps((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: 'approved' } : a))
        )
        setPreviewApp(null)
        setFeedback(`Đã phê duyệt vé tháng HSSV thành công cho sinh viên: ${name}`)
      } else {
        alert(res.message || 'Không thể duyệt hồ sơ này')
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi gửi yêu cầu duyệt')
    } finally {
      setIsProcessing(false)
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  // Xử lý từ chối hồ sơ
  const handleReject = async (id: string, name: string) => {
    const reason = prompt('Nhập lý do từ chối hồ sơ (ví dụ: Ảnh thẻ không rõ nét, sai mã sinh viên):', 'Ảnh thẻ sinh viên không hợp lệ hoặc đã hết hạn')
    if (reason === null) return

    setIsProcessing(true)
    try {
      const res = await promotionService.reviewMonthlyPass(id, 'rejected', reason)
      if (res.success) {
        setApps((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: 'rejected', rejectionReason: reason } : a))
        )
        setPreviewApp(null)
        setFeedback(`Đã từ chối hồ sơ của sinh viên: ${name} (${reason})`)
      } else {
        alert(res.message || 'Không thể từ chối hồ sơ này')
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi gửi yêu cầu từ chối')
    } finally {
      setIsProcessing(false)
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  // Thống kê nhanh
  const pendingCount = apps.filter((a) => a.status === 'pending').length
  const approvedCount = apps.filter((a) => a.status === 'approved').length
  const rejectedCount = apps.filter((a) => a.status === 'rejected').length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Phê Duyệt Hồ Sơ Vé Tháng HSSV & Ưu Đãi
          </h1>
          <p className="text-sm text-muted-foreground">
            Xét duyệt thẻ sinh viên ICTU, chứng minh đối tượng ưu tiên để kích hoạt vé tháng trợ giá 50%
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadApps}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/70 transition-colors disabled:opacity-50"
            title="Đồng bộ hồ sơ"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Đồng bộ DB</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Tổng hồ sơ</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <FileText size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{apps.length}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Sinh viên đăng ký</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Chờ xét duyệt</span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">{pendingCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Cần xử lý ngay</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Đã phê duyệt</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">{approvedCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Đã cấp vé tháng</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Bị từ chối</span>
            <div className="rounded-lg bg-red-500/10 p-2 text-red-600">
              <XCircle size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-red-600">{rejectedCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Hồ sơ không hợp lệ</p>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-foreground text-background shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Tất cả ({apps.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'pending'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Chờ duyệt ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'approved'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Đã duyệt ({approvedCount})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'rejected'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Từ chối ({rejectedCount})
          </button>
        </div>

        <div className="relative w-full max-w-xs">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tên sinh viên, mã SV, tuyến..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={loadApps} className="font-semibold underline">
            Thử lại
          </button>
        </div>
      )}

      {/* Grid Danh sách hồ sơ */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-3xl border border-border bg-card p-6 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center text-xs text-muted-foreground">
          Không có hồ sơ đăng ký vé tháng nào phù hợp.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
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
                    <span>{new Date(item.startDate).toLocaleDateString('vi-VN')} - {new Date(item.endDate).toLocaleDateString('vi-VN')}</span>
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
                  onClick={() => setPreviewApp(item)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-emerald-600 transition-colors"
                >
                  <Eye size={13} /> Xem ảnh thẻ SV
                </button>

                {item.status === 'pending' ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleReject(item.id, item.studentName)}
                      className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                    >
                      Từ chối
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleApprove(item.id, item.studentName)}
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

      {/* MODAL XEM CHI TIẾT & ẢNH THẺ SINH VIÊN */}
      {previewApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <UserCheck size={18} className="text-emerald-600" />
                  Hồ Sơ: {previewApp.studentName}
                </h2>
                <p className="text-xs text-muted-foreground font-mono">
                  {previewApp.passCode} · Mã SV: {previewApp.studentId}
                </p>
              </div>
              <button
                onClick={() => setPreviewApp(null)}
                className="rounded-xl p-1 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* Thẻ ảnh chụp minh chứng */}
              <div>
                <span className="text-xs font-semibold text-foreground block mb-2">
                  Ảnh Thẻ Sinh Viên / CCCD Đối Chiếu:
                </span>
                <div className="relative h-56 w-full rounded-2xl overflow-hidden border border-border bg-muted/40 flex items-center justify-center">
                  <img
                    src={previewApp.idCardPhotoUrl}
                    alt={`Thẻ sinh viên ${previewApp.studentName}`}
                    className="h-full w-full object-cover"
                  />
                  <a
                    href={previewApp.idCardPhotoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute bottom-2 right-2 rounded-xl bg-black/70 backdrop-blur-sm px-2.5 py-1 text-[11px] font-semibold text-white flex items-center gap-1 hover:bg-black"
                  >
                    <ExternalLink size={12} /> Xem ảnh gốc
                  </a>
                </div>
              </div>

              {/* Thông tin xác minh */}
              <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Trường:</span>
                  <span className="font-semibold text-foreground text-right">{previewApp.university}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Khoa / Lớp:</span>
                  <span className="font-semibold text-foreground">{previewApp.faculty}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tuyến xe áp dụng:</span>
                  <span className="font-semibold text-foreground">{previewApp.route}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Mức trợ giá:</span>
                  <span className="font-bold text-emerald-600">50% Cước thông thường</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ngày nộp hồ sơ:</span>
                  <span>{new Date(previewApp.appliedDate).toLocaleString('vi-VN')}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewApp(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Đóng
              </button>

              {previewApp.status === 'pending' && (
                <>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleReject(previewApp.id, previewApp.studentName)}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Từ chối
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleApprove(previewApp.id, previewApp.studentName)}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Phê duyệt hồ sơ
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
