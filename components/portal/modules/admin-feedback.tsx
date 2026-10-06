'use client'

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
} from 'lucide-react'
import { authService } from '@/lib/services/auth.service'

interface FeedbackItem {
  id: string
  userId: string
  ratingScore: number
  content: string
  category?: string
  status: 'new' | 'in_review' | 'resolved' | string
  adminResponse?: string | null
  respondedAt?: string | null
  createdAt: string
  user?: {
    id: string
    fullName: string
    email: string
    phoneNumber?: string
  }
  trip?: {
    id: string
    departureTime: string
    route?: {
      routeCode: string
      name: string
    }
  }
}

export function AdminFeedback() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Modal phản hồi
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null)
  const [responseText, setResponseText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  const fetchFeedback = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const token = authService.getToken()
      const params = new URLSearchParams()
      params.append('limit', '50')
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const res = await fetch(`http://localhost:3001/api/v1/admin/feedback?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setFeedbacks(json.data?.items || [])
      } else {
        setErrorMsg(json.message || 'Không thể tải hòm thư phản ánh')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối máy chủ phản ánh')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchFeedback()
  }, [fetchFeedback])

  const handleOpenResponse = (fb: FeedbackItem) => {
    setSelectedFeedback(fb)
    setResponseText(fb.adminResponse || '')
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
      const token = authService.getToken()
      const res = await fetch(
        `http://localhost:3001/api/v1/admin/feedback/${selectedFeedback.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            adminResponse: responseText.trim(),
            status: 'resolved',
          }),
        },
      )
      const json = await res.json()
      if (res.ok && (json.success || json.data)) {
        setSuccessToast('Đã gửi phản hồi chính thức tới hành khách thành công!')
        setSelectedFeedback(null)
        setResponseText('')
        await fetchFeedback()
        setTimeout(() => setSuccessToast(null), 4000)
      } else {
        alert(json.message || 'Không thể gửi phản hồi này')
      }
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredFeedbacks = feedbacks.filter((fb) => {
    const matchSearch =
      search === '' ||
      fb.content.toLowerCase().includes(search.toLowerCase()) ||
      fb.user?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      fb.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
      fb.trip?.route?.routeCode?.toLowerCase().includes(search.toLowerCase())
    return matchSearch
  })

  // Thống kê nhanh
  const avgRating =
    feedbacks.length > 0
      ? (feedbacks.reduce((acc, f) => acc + (f.ratingScore || 5), 0) / feedbacks.length).toFixed(1)
      : '5.0'
  const newCount = feedbacks.filter((f) => f.status === 'new').length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquare className="size-6 text-[#00A86B]" />
            Hòm Thư Phản Ánh & Đánh Giá Chất Lượng Dịch Vụ
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tiếp nhận đánh giá sao, khiếu nại thái độ tài xế, chất lượng xe buýt điện và phản hồi trực tuyến
          </p>
        </div>

        <button
          type="button"
          onClick={fetchFeedback}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {successToast && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs sm:text-sm font-semibold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
          <CheckCircle2 className="size-5 text-emerald-500" />
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <Star className="size-4 text-amber-500 fill-amber-500" /> Điểm đánh giá trung bình
          </span>
          <p className="mt-2 text-3xl font-bold font-mono text-foreground flex items-baseline gap-1">
            {avgRating} <span className="text-sm text-muted-foreground font-normal">/ 5.0 ⭐</span>
          </p>
          <span className="mt-2 inline-block text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Dựa trên {feedbacks.length} lượt đánh giá thực
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <MessageCircle className="size-4 text-blue-500" /> Phản ánh chờ xử lý
          </span>
          <p className="mt-2 text-3xl font-bold font-mono text-foreground">
            {newCount} thư
          </p>
          <span className="mt-2 inline-block text-xs font-semibold text-blue-600 dark:text-blue-400">
            Cam kết phản hồi trong 24 giờ
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="size-4 text-emerald-500" /> Tỷ lệ hài lòng
          </span>
          <p className="mt-2 text-3xl font-bold font-mono text-foreground">96.8%</p>
          <span className="mt-2 inline-block text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Dịch vụ xe buýt điện thông minh ICTU
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="relative">
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo nội dung, tên hành khách, email..."
            className="h-10 w-72 rounded-xl border border-border bg-background pl-9 pr-3 text-xs text-foreground focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Lọc theo:</span>
          <div className="flex rounded-xl border border-border bg-muted/40 p-1">
            {['all', 'new', 'resolved'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  statusFilter === st
                    ? 'bg-[#00A86B] text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {st === 'all' ? 'Tất cả' : st === 'new' ? 'Chưa phản hồi' : 'Đã xử lý'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feedback Feed / Cards List */}
      <div className="space-y-4">
        {filteredFeedbacks.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Không có phản ánh nào phù hợp.
          </div>
        ) : (
          filteredFeedbacks.map((fb) => (
            <div
              key={fb.id}
              className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-3 hover:border-emerald-500/30 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    {fb.user?.fullName?.slice(0, 2).toUpperCase() || 'KH'}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">
                      {fb.user?.fullName || 'Hành khách'}
                    </h4>
                    <span className="text-xs text-muted-foreground font-mono">
                      {fb.user?.email || 'N/A'} • {fb.user?.phoneNumber || ''}
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

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      fb.status === 'resolved'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {fb.status === 'resolved' ? 'Đã phản hồi' : 'Chưa xử lý'}
                  </span>
                </div>
              </div>

              {/* Comment Content */}
              <p className="text-sm text-foreground leading-relaxed pl-1">
                "{fb.content}"
              </p>

              {/* Trip & Category Tags */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  {fb.trip?.route && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">
                      <Bus className="size-3 text-[#00A86B]" />
                      {fb.trip.route.routeCode}
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
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-[#00A86B] hover:text-white transition-colors"
                >
                  <Send className="size-3" />
                  {fb.adminResponse ? 'Sửa phản hồi' : 'Gửi phản hồi'}
                </button>
              </div>

              {/* Admin Response Box if resolved */}
              {fb.adminResponse && (
                <div className="mt-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 text-xs space-y-1">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" /> Phản hồi từ Ban Điều Hành:
                  </span>
                  <p className="text-emerald-950 dark:text-emerald-100 leading-relaxed">
                    {fb.adminResponse}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Trả lời Phản ánh */}
      {selectedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Phản Hồi Ý Kiến Hành Khách
                </h3>
                <span className="text-xs text-muted-foreground">
                  Gửi tới: {selectedFeedback.user?.fullName} ({selectedFeedback.user?.email})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFeedback(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-muted/40 p-3.5 text-xs text-foreground italic border border-border">
              "{selectedFeedback.content}"
            </div>

            <form onSubmit={handleSendResponse} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Nội dung phản hồi chính thức từ Quản trị / Điều hành *
                </label>
                <textarea
                  required
                  rows={4}
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Cảm ơn bạn đã phản hồi! Đội xe ICTU đã ghi nhận và..."
                  className="w-full rounded-2xl border border-border bg-background p-3 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSelectedFeedback(null)}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-[#00A86B] px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-md"
                >
                  {isSubmitting && <RefreshCw className="size-3.5 animate-spin" />}
                  <Send className="size-3.5" /> Gửi phản hồi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
