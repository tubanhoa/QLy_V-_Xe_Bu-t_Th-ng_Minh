'use client'

/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * Modal Đánh giá chuyến xe (1-5 sao) & Gửi phản ánh/khiếu nại kèm tải ảnh minh chứng
 * Thiết kế giao diện chuẩn nhận diện thương hiệu ICTU Transit (#005A36)
 */

import { useState, useCallback, useRef } from 'react'
import {
  X,
  Star,
  Send,
  CheckCircle2,
  Loader2,
  MessageSquare,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  Trash2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { feedbackService } from '@/lib/services/feedback.service'

interface FeedbackModalProps {
  tripId?: string
  tripName?: string
  ticketCode?: string
  initialTab?: 'rating' | 'complaint'
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

const RATING_CATEGORIES = [
  { key: 'service', label: '🤝 Phục vụ' },
  { key: 'cleanliness', label: '✨ Vệ sinh' },
  { key: 'punctuality', label: '⏱️ Đúng giờ' },
  { key: 'safety', label: '🛡️ An toàn' },
  { key: 'other', label: '💬 Khác' },
]

const COMPLAINT_CATEGORIES = [
  { key: 'driver_attitude', label: 'Tài xế / Phụ xe' },
  { key: 'punctuality', label: 'Trễ giờ / Bỏ trạm' },
  { key: 'cleanliness', label: 'Vệ sinh & Mùi xe' },
  { key: 'lost_item', label: 'Thất lạc hành lý' },
  { key: 'ticket_payment', label: 'Sự cố vé & thanh toán' },
  { key: 'other', label: 'Vấn đề khác' },
]

export function FeedbackModal({
  tripId,
  tripName,
  ticketCode,
  initialTab = 'rating',
  onClose,
}: FeedbackModalProps) {
  const [activeTab, setActiveTab] = useState<'rating' | 'complaint'>(initialTab)

  // State đánh giá sao
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [ratingContent, setRatingContent] = useState('')
  const [ratingCategory, setRatingCategory] = useState('service')

  // State khiếu nại / phản ánh
  const [complaintTitle, setComplaintTitle] = useState('')
  const [complaintContent, setComplaintContent] = useState('')
  const [complaintCategory, setComplaintCategory] = useState('driver_attitude')
  const [attachments, setAttachments] = useState<string[]>([])
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Trạng thái chung
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')

  const MAX_CHARS = 500
  const displayRating = hoverRating || rating

  // Xử lý upload ảnh minh chứng
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    if (file.size > 5 * 1024 * 1024) {
      setError('Kích thước ảnh không được vượt quá 5MB')
      return
    }

    setIsUploadingImage(true)
    setError('')
    try {
      const res = await feedbackService.uploadProofImage(file)
      if (res.success && res.url) {
        setAttachments((prev) => [...prev, res.url!])
      } else {
        setError(res.message || 'Không thể tải ảnh minh chứng')
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi tải ảnh lên máy chủ')
    } finally {
      setIsUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Xóa ảnh đã đính kèm
  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  // Gửi Đánh giá 1-5 sao
  const handleRatingSubmit = async () => {
    if (!rating) {
      setError('Vui lòng chọn số sao đánh giá chuyến đi')
      return
    }
    if (!ratingContent.trim()) {
      setError('Vui lòng nhập lời nhận xét hoặc góp ý')
      return
    }

    setSubmitting(true)
    setError('')

    const res = await feedbackService.createFeedback({
      tripId,
      ratingScore: rating,
      content: ratingContent.trim(),
      category: ratingCategory,
      type: 'rating',
      ticketCode,
    })

    setSubmitting(false)
    if (res.success) {
      setSuccess(true)
      setSuccessMessage('Cảm ơn bạn đã đánh giá chất lượng chuyến xe!')
      setTimeout(() => onClose(), 2200)
    } else {
      setError(res.message || 'Không thể gửi đánh giá')
    }
  }

  // Gửi Khiếu nại / Phản ánh kèm ảnh minh chứng
  const handleComplaintSubmit = async () => {
    if (!complaintTitle.trim()) {
      setError('Vui lòng nhập tiêu đề phản ánh')
      return
    }
    if (!complaintContent.trim()) {
      setError('Vui lòng nhập nội dung chi tiết phản ánh / khiếu nại')
      return
    }

    setSubmitting(true)
    setError('')

    const res = await feedbackService.createComplaint({
      title: complaintTitle.trim(),
      content: complaintContent.trim(),
      category: complaintCategory,
      tripId,
      ticketCode,
      ratingScore: 1,
      attachments,
    })

    setSubmitting(false)
    if (res.success) {
      setSuccess(true)
      setSuccessMessage('Đã tiếp nhận khiếu nại! Ban Quản Trị sẽ xử lý và gửi phản hồi qua email.')
      setTimeout(() => onClose(), 2500)
    } else {
      setError(res.message || 'Không thể gửi phản ánh')
    }
  }

  const handleSelectRating = (star: number) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12)
      } catch {
        // ignore
      }
    }
    setRating(star)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 overscroll-contain animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Đánh giá & Khiếu nại chuyến xe"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col will-change-transform animate-slideUp max-h-[92vh]">
        {/* Mobile Pull-down indicator */}
        <div className="sm:hidden w-full flex justify-center pt-2.5 pb-1 shrink-0 bg-gradient-to-r from-emerald-50/80 via-white to-slate-50">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-gradient-to-r from-emerald-50/80 via-white to-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-10 items-center justify-center rounded-2xl text-white shadow-sm shrink-0 ${
                activeTab === 'rating' ? 'bg-[#005A36]' : 'bg-rose-600'
              }`}
            >
              {activeTab === 'rating' ? (
                <Star size={20} className="fill-white" />
              ) : (
                <ShieldAlert size={20} />
              )}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {activeTab === 'rating' ? 'Đánh Giá Chuyến Đi' : 'Phản Ánh & Khiếu Nại'}
              </h2>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[260px] sm:max-w-xs">
                {tripName || 'Hệ thống vận hành xe buýt thông minh Smart Bus ICTU'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs (Đánh giá vs Khiếu nại) */}
        {!success && (
          <div className="flex border-b border-slate-100 px-5 pt-3 bg-slate-50/60 shrink-0 gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('rating')
                setError('')
              }}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'rating'
                  ? 'border-[#005A36] text-[#005A36]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Star size={14} className={activeTab === 'rating' ? 'fill-[#005A36]' : ''} />
              <span>Chấm điểm chuyến xe</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('complaint')
                setError('')
              }}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'complaint'
                  ? 'border-rose-600 text-rose-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldAlert size={14} />
              <span>Khiếu nại & Sự cố</span>
            </button>
          </div>
        )}

        {/* Content body */}
        <div className="p-5 sm:p-6 space-y-4 text-slate-700 text-xs overflow-y-auto">
          {success ? (
            <div className="py-8 text-center space-y-3">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-[#005A36] animate-bounce">
                <CheckCircle2 size={32} />
              </div>
              <h4 className="text-base font-bold text-slate-900">{successMessage}</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Cảm ơn bạn đã đồng hành cùng Smart Bus ICTU nâng cao chất lượng phục vụ sinh viên và cán bộ giảng viên.
              </p>
            </div>
          ) : activeTab === 'rating' ? (
            /* =========================================================================
               TAB 1: ĐÁNH GIÁ CHUYẾN XE (RATING 1-5 SAO)
            ========================================================================= */
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
                      onClick={() => handleSelectRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-2 transition-transform hover:scale-125 active:scale-110 focus:outline-none touch-press touch-manipulation cursor-pointer"
                      id={`star-${star}`}
                    >
                      <Star
                        size={30}
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
                  {RATING_CATEGORIES.map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setRatingCategory(cat.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        ratingCategory === cat.key
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
                  <span
                    className={`text-[11px] ${
                      ratingContent.length > MAX_CHARS ? 'text-rose-500 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {ratingContent.length}/{MAX_CHARS}
                  </span>
                </div>
                <textarea
                  value={ratingContent}
                  onChange={(e) => setRatingContent(e.target.value.slice(0, MAX_CHARS))}
                  rows={3}
                  placeholder="Chia sẻ trải nghiệm về thái độ tài xế, độ êm ái của xe buýt điện hoặc tình trạng trạm đón..."
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
              <div className="pt-2">
                <button
                  type="button"
                  disabled={submitting || !rating || !ratingContent.trim()}
                  onClick={handleRatingSubmit}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#005A36] hover:bg-[#004529] py-3 text-xs font-black text-white shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  <span>{submitting ? 'Đang gửi đánh giá...' : 'Gửi Đánh Giá Ngay'}</span>
                </button>
              </div>
            </>
          ) : (
            /* =========================================================================
               TAB 2: PHẢN ÁNH & KHIẾU NẠI (COMPLAINT WITH IMAGE PROOF)
            ========================================================================= */
            <>
              {/* Tiêu đề khiếu nại */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">Tiêu đề phản ánh / khiếu nại *</label>
                <input
                  type="text"
                  value={complaintTitle}
                  onChange={(e) => setComplaintTitle(e.target.value)}
                  placeholder="Ví dụ: Tài xế bỏ trạm đón, Thất lạc ô dù trên xe..."
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 outline-none focus:border-rose-500 focus:bg-white transition-all"
                />
              </div>

              {/* Phân loại khiếu nại */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Phân loại vấn đề gặp phải *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {COMPLAINT_CATEGORIES.map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setComplaintCategory(cat.key)}
                      className={`px-2.5 py-2 rounded-xl text-[11px] font-bold text-left transition-all border cursor-pointer ${
                        complaintCategory === cat.key
                          ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nội dung chi tiết */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-800">Mô tả sự việc chi tiết *</label>
                  <span
                    className={`text-[11px] ${
                      complaintContent.length > MAX_CHARS ? 'text-rose-500 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {complaintContent.length}/{MAX_CHARS}
                  </span>
                </div>
                <textarea
                  value={complaintContent}
                  onChange={(e) => setComplaintContent(e.target.value.slice(0, MAX_CHARS))}
                  rows={3}
                  placeholder="Vui lòng nêu rõ thời gian, địa điểm trạm, biển số xe hoặc mô tả sự việc để Ban Điều Hành xác minh qua camera..."
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 outline-none focus:border-rose-500 focus:bg-white transition-all resize-none"
                />
              </div>

              {/* Tải ảnh minh chứng (Upload Proof Image) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-slate-500" />
                    <span>Ảnh minh chứng (nếu có)</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Tối đa 3 ảnh (≤ 5MB)</span>
                </div>

                {/* Danh sách ảnh đã upload */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {attachments.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative group size-16 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 shadow-xs"
                      >
                        <img
                          src={url.startsWith('http') ? url : `http://localhost:3001${url}`}
                          alt={`Minh chứng ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(idx)}
                          className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Xóa ảnh này"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Nút bấm chọn ảnh */}
                {attachments.length < 3 && (
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      id="complaint-image-input"
                    />
                    <label
                      htmlFor="complaint-image-input"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-all cursor-pointer"
                    >
                      {isUploadingImage ? (
                        <>
                          <Loader2 size={14} className="animate-spin text-rose-600" />
                          <span>Đang kiểm định & tải ảnh...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={14} className="text-slate-500" />
                          <span>Thêm ảnh vé / hiện trường</span>
                        </>
                      )}
                    </label>
                  </div>
                )}
              </div>

              {/* Error inline */}
              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 flex items-center gap-2 text-rose-700 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Complaint Button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={submitting || !complaintTitle.trim() || !complaintContent.trim() || isUploadingImage}
                  onClick={handleComplaintSubmit}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 py-3 text-xs font-black text-white shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  <span>{submitting ? 'Đang tiếp nhận...' : 'Gửi Khiếu Nại Tới Ban Điều Hành'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
