'use client'

/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * Phân hệ Quản Lý Đánh Giá & Phản Ánh / Khiếu Nại Dịch Vụ (Admin & Manager)
 * Hỗ trợ lọc đa tiêu chí (số sao 1-5, trạng thái, phân loại), xem ảnh minh chứng phóng to và gửi phản hồi
 */

import { useState, useEffect, useCallback } from 'react'
import {
  MessageSquare,
  Star,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  User,
  Clock,
  Bus,
  Check,
  X,
  MessageCircle,
  Sparkles,
  ShieldAlert,
  Image as ImageIcon,
  Ticket,
  Maximize2,
  Layers,
  ThumbsUp,
  FileText,
  Loader2,
} from 'lucide-react'
import {
  feedbackService,
  type FeedbackItem,
  type FeedbackStats,
} from '@/lib/services/feedback.service'

const QUICK_TEMPLATES = [
  'Smart Bus ICTU chân thành cảm ơn ý kiến đánh giá quý báu của bạn! Nhà trường và đội ngũ vận hành luôn nỗ lực hoàn thiện dịch vụ.',
  'Ban Điều Hành đã tiếp nhận phản ánh, trích xuất camera hành trình và nghiêm khắc nhắc nhở tài xế tuyến về thái độ phục vụ.',
  'Đã liên hệ tài xế và nhân viên soát vé hỗ trợ tìm kiếm hành lý thất lạc của bạn tại văn phòng điều hành trung tâm.',
  'Hệ thống đã kiểm tra dữ liệu giao dịch vé, xác nhận lỗi kết nối và đã kích hoạt hoàn tiền tự động vào ví của bạn.',
]

export function AdminFeedback() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([])
  const [stats, setStats] = useState<FeedbackStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Bộ lọc
  const [statusFilter, setStatusFilter] = useState('all')
  const [starFilter, setStarFilter] = useState<number | undefined>(undefined)
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Phân trang
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Modal phản hồi
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null)
  const [responseText, setResponseText] = useState('')
  const [responseStatus, setResponseStatus] = useState<'in_review' | 'resolved'>('resolved')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  // Lightbox xem ảnh minh chứng phóng to
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const fetchFeedback = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await feedbackService.getAdminFeedbacks({
        page,
        limit: 20,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        ratingScore: starFilter,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        search: search.trim() || undefined,
      })

      setFeedbacks(res.items || [])
      setTotal(res.meta?.total || 0)
      setTotalPages(res.meta?.totalPages || 1)
      if (res.stats) {
        setStats(res.stats)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối máy chủ phản ánh')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, starFilter, typeFilter, search])

  useEffect(() => {
    fetchFeedback()
  }, [fetchFeedback])

  const handleOpenResponse = (fb: FeedbackItem) => {
    setSelectedFeedback(fb)
    setResponseText(fb.adminResponse || '')
    setResponseStatus(fb.status === 'in_review' ? 'in_review' : 'resolved')
  }

  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFeedback) return
    if (!responseText.trim()) {
      alert('Vui lòng nhập nội dung phản hồi cho hành khách!')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await feedbackService.respondFeedback(selectedFeedback.id, {
        adminResponse: responseText.trim(),
        status: responseStatus,
      })

      if (res.success) {
        setSuccessToast(
          'Đã gửi câu trả lời và tự động gửi email thông báo tới hành khách thành công!',
        )
        setSelectedFeedback(null)
        setResponseText('')
        await fetchFeedback()
        setTimeout(() => setSuccessToast(null), 4000)
      } else {
        alert(res.message || 'Không thể gửi phản hồi này')
      }
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Thống kê nhanh
  const avgRating = stats?.avgRating || 5.0
  const newComplaints = stats?.newComplaintsCount || 0
  const totalCount = stats?.totalFeedbacks || total

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquare className="size-6 text-[#005A36] dark:text-emerald-400" />
            Hòm Thư Phản Ánh, Khiếu Nại & Đánh Giá Dịch Vụ
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tiếp nhận đánh giá sao, khiếu nại chất lượng xe buýt điện, xem ảnh minh chứng và gửi phản hồi cho hành khách
          </p>
        </div>

        <button
          type="button"
          onClick={fetchFeedback}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {successToast && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs sm:text-sm font-semibold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
          <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="size-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <Layers className="size-4 text-emerald-500" /> Tổng phản hồi
          </span>
          <p className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-foreground">
            {totalCount} <span className="text-xs text-muted-foreground font-normal">lượt</span>
          </p>
          <span className="mt-1.5 inline-block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            Toàn hệ thống Smart Bus
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <Star className="size-4 text-amber-500 fill-amber-500" /> Đánh giá trung bình
          </span>
          <p className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-foreground flex items-baseline gap-1">
            {avgRating} <span className="text-xs text-muted-foreground font-normal">/ 5.0 ⭐</span>
          </p>
          <span className="mt-1.5 inline-block text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            Chỉ số hài lòng khách hàng
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <ShieldAlert className="size-4 text-rose-500" /> Khiếu nại chờ xử lý
          </span>
          <p className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-foreground flex items-baseline gap-1">
            {newComplaints} <span className="text-xs text-muted-foreground font-normal">thư</span>
          </p>
          <span className="mt-1.5 inline-block text-[11px] font-semibold text-rose-600 dark:text-rose-400">
            Cần xác minh & giải quyết
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="size-4 text-blue-500" /> Đã giải quyết
          </span>
          <p className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-foreground">
            {stats?.resolvedCount || 0}
          </p>
          <span className="mt-1.5 inline-block text-[11px] font-semibold text-blue-600 dark:text-blue-400">
            Đã gửi thông báo cho khách
          </span>
        </div>
      </div>

      {/* Toolbar & Multi-criteria Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Tìm theo nội dung, tên hành khách, email, mã vé..."
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs text-foreground focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Lọc theo phân loại */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Loại:</span>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value)
                setPage(1)
              }}
              className="h-9 rounded-xl border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">Tất cả loại</option>
              <option value="rating">⭐ Đánh giá sao</option>
              <option value="complaint">🚨 Khiếu nại & Sự cố</option>
            </select>
          </div>

          {/* Lọc theo số sao */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Điểm sao:</span>
            <select
              value={starFilter ?? ''}
              onChange={(e) => {
                setStarFilter(e.target.value ? Number(e.target.value) : undefined)
                setPage(1)
              }}
              className="h-9 rounded-xl border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="">Tất cả sao</option>
              <option value="5">⭐⭐⭐⭐⭐ 5 sao</option>
              <option value="4">⭐⭐⭐⭐ 4 sao</option>
              <option value="3">⭐⭐⭐ 3 sao</option>
              <option value="2">⭐⭐ 2 sao</option>
              <option value="1">⭐ 1 sao (Kém)</option>
            </select>
          </div>
        </div>

        {/* Lọc theo trạng thái xử lý */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Trạng thái xử lý:</span>
            <div className="flex flex-wrap rounded-xl border border-border bg-muted/40 p-1">
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'new', label: 'Mới (Chưa xử lý)' },
                { key: 'in_review', label: 'Đang xử lý' },
                { key: 'resolved', label: 'Đã giải quyết' },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st.key)
                    setPage(1)
                  }}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === st.key
                      ? 'bg-[#005A36] text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <span className="text-xs text-muted-foreground font-mono">
            Hiển thị {feedbacks.length} / {total} bản ghi
          </span>
        </div>
      </div>

      {/* Feedback Feed / Cards List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="size-7 animate-spin text-[#005A36]" />
            <span className="text-xs font-semibold">Đang nạp danh sách phản ánh & khiếu nại...</span>
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Không tìm thấy phản ánh hoặc đánh giá nào phù hợp với bộ lọc.
          </div>
        ) : (
          feedbacks.map((fb) => (
            <div
              key={fb.id}
              className={`rounded-3xl border bg-card p-5 shadow-sm space-y-3 transition-colors ${
                fb.type === 'complaint'
                  ? 'border-rose-500/30 hover:border-rose-500'
                  : 'border-border hover:border-emerald-500/40'
              }`}
            >
              {/* Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`size-10 rounded-2xl flex items-center justify-center font-bold text-xs ${
                      fb.type === 'complaint'
                        ? 'bg-rose-500/10 text-rose-600'
                        : 'bg-emerald-500/10 text-emerald-600'
                    }`}
                  >
                    {fb.user?.fullName?.slice(0, 2).toUpperCase() || 'KH'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-foreground">
                        {fb.user?.fullName || 'Hành khách'}
                      </h4>
                      {/* Badge phân loại */}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          fb.type === 'complaint'
                            ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        }`}
                      >
                        {fb.type === 'complaint' ? '🚨 Khiếu nại' : '⭐ Đánh giá'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {fb.user?.email || 'N/A'} • {fb.user?.phoneNumber || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Rating Stars */}
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`size-4 ${
                          star <= (fb.ratingScore || 5)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-300 dark:text-slate-700'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Trạng thái */}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      fb.status === 'resolved'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : fb.status === 'in_review'
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {fb.status === 'resolved'
                      ? 'Đã giải quyết'
                      : fb.status === 'in_review'
                      ? 'Đang xử lý'
                      : 'Mới tiếp nhận'}
                  </span>
                </div>
              </div>

              {/* Title & Content */}
              <div>
                {fb.title && (
                  <h5 className="font-bold text-sm text-foreground mb-1 flex items-center gap-1.5">
                    {fb.type === 'complaint' && <ShieldAlert size={14} className="text-rose-500" />}
                    <span>{fb.title}</span>
                  </h5>
                )}
                <p className="text-xs sm:text-sm text-foreground leading-relaxed pl-0.5">
                  "{fb.content}"
                </p>
              </div>

              {/* Ảnh minh chứng (Attachments Gallery) */}
              {fb.attachments && fb.attachments.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                    <ImageIcon size={13} />
                    Ảnh minh chứng kèm theo ({fb.attachments.length}):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {fb.attachments.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setLightboxImage(url)}
                        className="relative group size-16 sm:size-20 rounded-xl overflow-hidden border border-border bg-muted/40 hover:opacity-90 transition-opacity cursor-pointer"
                        title="Click để phóng to ảnh"
                      >
                        <img
                          src={url.startsWith('http') ? url : `http://localhost:3001${url}`}
                          alt={`Minh chứng ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget
                            if (target.src.includes('localhost:3001/uploads/')) {
                              target.src = target.src.replace('http://localhost:3001', '')
                              return
                            }
                            target.onerror = null
                            target.src = 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80'
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                          <Maximize2 size={16} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Phản hồi từ Quản trị viên (nếu có) */}
              {fb.adminResponse && (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      Phản hồi từ Ban Quản Trị ({fb.respondedByUser?.fullName || 'Cán bộ điều hành'}):
                    </span>
                    {fb.respondedAt && (
                      <span className="font-mono text-[11px] text-emerald-700/80 dark:text-emerald-400">
                        {new Date(fb.respondedAt).toLocaleString('vi-VN')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-emerald-950 dark:text-emerald-100 leading-relaxed pl-5">
                    {fb.adminResponse}
                  </p>
                </div>
              )}

              {/* Trip, Category & Action Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  {fb.trip?.route && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">
                      <Bus className="size-3 text-[#005A36]" />
                      [{fb.trip.route.routeCode}] {fb.trip.route.name}
                    </span>
                  )}
                  {fb.ticketCode && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">
                      <Ticket className="size-3 text-blue-500" />
                      Vé: {fb.ticketCode}
                    </span>
                  )}
                  {fb.category && (
                    <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-foreground">
                      Chủ đề: {fb.category}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px]">
                    <Clock className="size-3" />
                    {new Date(fb.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenResponse(fb)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-[#005A36] hover:text-white transition-colors cursor-pointer"
                >
                  <Send size={13} />
                  <span>{fb.adminResponse ? 'Sửa câu trả lời' : 'Gửi câu trả lời'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
          <span>
            Trang {page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-border px-3 py-1.5 font-semibold text-foreground hover:bg-accent disabled:opacity-40 transition-colors cursor-pointer"
            >
              Trang trước
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-border px-3 py-1.5 font-semibold text-foreground hover:bg-accent disabled:opacity-40 transition-colors cursor-pointer"
            >
              Trang sau
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL GỬI CÂU TRẢ LỜI / PHẢN HỒI CHO HÀNH KHÁCH
      ========================================================================= */}
      {selectedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Send className="size-4 text-[#005A36]" />
                  Phản Hồi Ý Kiến Hành Khách
                </h3>
                <p className="text-xs text-muted-foreground">
                  Gửi câu trả lời chính thức và kích hoạt thông báo tự động tới tài khoản hành khách
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFeedback(null)}
                className="rounded-xl p-1.5 text-muted-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Thông tin phản ánh gốc */}
            <div className="rounded-2xl bg-muted/40 p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between font-semibold text-foreground">
                <span>Khách hàng: {selectedFeedback.user?.fullName || 'N/A'}</span>
                <span className="font-mono text-muted-foreground">
                  {new Date(selectedFeedback.createdAt).toLocaleString('vi-VN')}
                </span>
              </div>
              {selectedFeedback.title && (
                <p className="font-bold text-foreground">{selectedFeedback.title}</p>
              )}
              <p className="text-muted-foreground italic">"{selectedFeedback.content}"</p>
            </div>

            {/* Form trả lời */}
            <form onSubmit={handleSendResponse} className="space-y-4 text-xs">
              {/* Chọn trạng thái cập nhật */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">Cập nhật trạng thái xử lý:</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setResponseStatus('resolved')}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      responseStatus === 'resolved'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'border-border bg-muted/30 text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    ✔ Đã giải quyết hoàn tất
                  </button>

                  <button
                    type="button"
                    onClick={() => setResponseStatus('in_review')}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      responseStatus === 'in_review'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'border-border bg-muted/30 text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    ⏳ Đang xử lý / Đang xác minh
                  </button>
                </div>
              </div>

              {/* Mẫu câu trả lời nhanh */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground flex items-center gap-1">
                  <Sparkles size={13} className="text-amber-500" />
                  Mẫu câu trả lời nhanh:
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {QUICK_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setResponseText(tmpl)}
                      className="text-[11px] text-left rounded-lg border border-border bg-background px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer truncate max-w-full"
                    >
                      {tmpl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea nhập câu trả lời */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">Nội dung phản hồi chính thức *</label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={4}
                  placeholder="Nhập nội dung phản hồi lịch sự, nêu rõ biện pháp xử lý hoặc hướng giải quyết của nhà xe..."
                  className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-[11px] text-muted-foreground">
                  Hệ thống sẽ tự động gửi email và thông báo in-app tới khách hàng.
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFeedback(null)}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !responseText.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#005A36] px-5 py-2 text-xs font-bold text-white shadow hover:bg-[#00472b] disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    <span>{isSubmitting ? 'Đang gửi...' : 'Gửi phản hồi'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          LIGHTBOX MODAL XEM ẢNH MINH CHỨNG PHÓNG TO
      ========================================================================= */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl bg-black shadow-2xl">
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-3 right-3 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/90 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            <img
              src={lightboxImage.startsWith('http') ? lightboxImage : `http://localhost:3001${lightboxImage}`}
              alt="Ảnh minh chứng phóng to"
              className="max-h-[80vh] w-auto object-contain mx-auto"
              onError={(e) => {
                const target = e.currentTarget
                if (target.src.includes('localhost:3001/uploads/')) {
                  target.src = target.src.replace('http://localhost:3001', '')
                  return
                }
                target.onerror = null
                target.src = 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=1200&auto=format&fit=crop&q=80'
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
