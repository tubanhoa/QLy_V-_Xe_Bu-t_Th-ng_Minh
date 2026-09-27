'use client'

/**
 * Modal đánh giá chuyến xe — 5 sao + nhận xét
 * Thiết kế giao diện Light Theme chuẩn nhận diện thương hiệu ICTU Transit (#005A36)
 */

import { useState, useCallback } from 'react'
import { X, Star, Send, CheckCircle2, Loader2, MessageSquare, AlertTriangle } from 'lucide-react'

interface FeedbackPayload {
  tripId?: string
  ratingScore: number
  content: string
  category?: string
}

interface FeedbackModalProps {
  tripId?: string
  tripName?: string
  onClose: () => void
}

const EMOJI_MAP: Record<number, string> = {
  1: '😞',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😍',
}

const RATING_LABEL: Record<number, string> = {
  1: 'Rất tệ',
  2: 'Chưa tốt',
  3: 'Bình thường',
  4: 'Tốt',
  5: 'Xuất sắc!',
}

const CATEGORIES = [
  { key: 'service', label: '🤝 Phục vụ' },
  { key: 'cleanliness', label: '✨ Vệ sinh' },
  { key: 'punctuality', label: '⏱️ Đúng giờ' },
  { key: 'safety', label: '🛡️ An toàn' },
  { key: 'other', label: '💬 Khác' },
]

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

export function FeedbackModal({ tripId, tripName, onClose }: FeedbackModalProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const MAX_CHARS = 300
  const displayRating = hoverRating || rating

  const handleSubmit = useCallback(async () => {
    if (!rating) {
      setError('Vui lòng chọn số sao đánh giá chuyến đi')
      return
    }
    if (!content.trim()) {
      setError('Vui lòng nhập nội dung đánh giá')
      return
    }

    setSubmitting(true)
    setError('')

    const payload: FeedbackPayload = {
      ratingScore: rating,
      content: content.trim(),
      ...(tripId && { tripId }),
      ...(category && { category }),
    }

    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('sbts_access_token') ||
            sessionStorage.getItem('sbts_access_token')
          : null

      const res = await fetch(`${API_BASE_URL}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      const resJson = await res.json().catch(() => null)
      setSubmitting(false)

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => onClose(), 2000)
      } else {
        setError(resJson?.message || 'Không thể gửi đánh giá. Vui lòng thử lại.')
      }
    } catch (err: any) {
      setSubmitting(false)
      setError(err?.message || 'Lỗi kết nối máy chủ')
    }
  }, [rating, content, tripId, category, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 overscroll-contain animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Đánh giá chuyến xe"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col will-change-transform">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-gradient-to-r from-emerald-50/80 via-white to-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[#005A36] text-white shadow-sm shrink-0">
              <Star size={20} className="fill-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Đánh Giá Chuyến Đi</h2>
              <p className="text-xs text-slate-500 font-medium">
                {tripName || 'Hệ thống khảo sát chất lượng ICTU Transit'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 text-slate-700 text-xs">
          {success ? (
            <div className="py-6 text-center space-y-3">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-[#005A36]">
                <CheckCircle2 size={32} />
              </div>
              <h4 className="text-base font-bold text-slate-900">Cảm Ơn Đóng Góp Của Bạn!</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Ý kiến của bạn giúp nâng cao chất lượng dịch vụ xe buýt thông minh ICTU Transit.
              </p>
            </div>
          ) : (
            <>
              {/* Star Rating & Emotion */}
              <div className="flex flex-col items-center gap-2 py-2 text-center bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4">
                <span className="text-3xl transition-transform transform hover:scale-110">
                  {displayRating > 0 ? EMOJI_MAP[displayRating] : '⭐'}
                </span>
                <span className="text-xs font-bold text-[#005A36]">
                  {displayRating > 0 ? RATING_LABEL[displayRating] : 'Chạm vào sao để đánh giá'}
                </span>

                <div className="flex gap-2 pt-1" role="radiogroup">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 transition-transform hover:scale-125 focus:outline-none"
                      id={`star-${star}`}
                    >
                      <Star
                        size={28}
                        className={`transition-colors ${
                          star <= displayRating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Chips */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Chủ đề đánh giá nổi bật
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setCategory(category === cat.key ? '' : cat.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        category === cat.key
                          ? 'bg-[#005A36] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-[#005A36] border border-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-800">Ý kiến đóng góp chi tiết *</label>
                  <span className={`text-[11px] ${content.length > MAX_CHARS ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                    {content.length}/{MAX_CHARS}
                  </span>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
                  rows={3}
                  placeholder="Hãy chia sẻ trải nghiệm của bạn về tài xế, độ đúng giờ hoặc tình trạng xe buýt..."
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 outline-none focus:border-[#005A36] focus:bg-white focus:ring-1 focus:ring-[#005A36]/20 transition-all resize-none"
                />
              </div>

              {/* Error inline */}
              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 flex items-center gap-2 text-rose-700 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="button"
                disabled={submitting || !rating || !content.trim()}
                onClick={handleSubmit}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#005A36] hover:bg-[#004529] py-3 text-xs font-black text-white shadow-md disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send size={15} />
                )}
                <span>{submitting ? 'Đang gửi phản hồi...' : 'Gửi Đánh Giá Ngay'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
