'use client'

/**
 * Modal đánh giá chuyến xe — 5 sao + nhận xét
 * Tự động kích hoạt sau khi hoàn thành chuyến
 * File mới — không chạm file cũ
 * Branch: feature/SBTS-feedback-fe
 */

import { useState, useCallback } from 'react'
import { X, Star, Send, CheckCircle2, Loader2, MessageSquare } from 'lucide-react'

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
    if (!rating) { setError('Vui lòng chọn số sao đánh giá'); return }
    if (!content.trim()) { setError('Vui lòng nhập nội dung đánh giá'); return }

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
        setTimeout(() => onClose(), 2500)
      } else {
        setError(resJson?.message || 'Không thể gửi đánh giá. Vui lòng thử lại.')
      }
    } catch (e: any) {
      setSubmitting(false)
      setError(e?.message || 'Lỗi kết nối máy chủ')
    }
  }, [rating, content, tripId, category, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Đánh giá chuyến xe"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" />

      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[#0d1117] border border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10">
              <MessageSquare className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Đánh giá chuyến xe</h2>
              {tripName && (
                <p className="text-xs text-white/40 truncate max-w-[180px]">{tripName}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/8 text-white/40 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Success state */}
          {success && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-emerald-400/30 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-white">Cảm ơn bạn!</p>
                <p className="text-sm text-white/50 mt-1">
                  Đánh giá của bạn giúp chúng tôi cải thiện dịch vụ.
                </p>
              </div>
            </div>
          )}

          {/* Rating form */}
          {!success && (
            <>
              {/* Star rating */}
              <div className="flex flex-col items-center gap-3">
                <div className="text-4xl transition-all duration-200">
                  {displayRating ? EMOJI_MAP[displayRating] : '⭐'}
                </div>

                <div
                  className="flex gap-2"
                  onMouseLeave={() => setHoverRating(0)}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onMouseEnter={() => setHoverRating(star)}
                      onClick={() => { setRating(star); setError('') }}
                      className="transition-transform hover:scale-110 active:scale-95"
                      id={`star-rating-${star}`}
                    >
                      <Star
                        className={`w-9 h-9 transition-colors duration-150 ${
                          star <= displayRating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-white/20'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                {displayRating > 0 && (
                  <p className="text-sm font-medium text-amber-300 animate-in fade-in duration-150">
                    {RATING_LABEL[displayRating]}
                  </p>
                )}
              </div>

              {/* Category chips */}
              <div className="space-y-2">
                <p className="text-xs text-white/50">Chủ đề đánh giá (tùy chọn)</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.key}
                      onClick={() => setCategory(category === cat.key ? '' : cat.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        category === cat.key
                          ? 'bg-[#00d4aa]/20 border border-[#00d4aa]/40 text-[#00d4aa]'
                          : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/8 hover:text-white/70'
                      }`}
                      id={`category-${cat.key}`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content textarea */}
              <div className="space-y-2">
                <p className="text-xs text-white/50">Nhận xét của bạn *</p>
                <div className="relative">
                  <textarea
                    id="feedback-content"
                    value={content}
                    onChange={(e) => {
                      if (e.target.value.length <= MAX_CHARS) setContent(e.target.value)
                    }}
                    placeholder="Chia sẻ trải nghiệm của bạn về chuyến đi…"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#00d4aa]/50 focus:bg-white/8 transition-all resize-none"
                  />
                  <span className={`absolute bottom-2.5 right-3 text-xs ${content.length >= MAX_CHARS ? 'text-red-400' : 'text-white/30'}`}>
                    {content.length}/{MAX_CHARS}
                  </span>
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting || !rating || !content.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#00d4aa] hover:bg-[#00bfa0] disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-[#060a0f] transition-all"
                id="submit-feedback-btn"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {submitting ? 'Đang gửi…' : 'Gửi đánh giá'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
