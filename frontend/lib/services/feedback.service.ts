/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * Feedback, Ratings & Complaints Service
 * Dịch vụ gửi đánh giá sao, khiếu nại dịch vụ và quản trị phản ánh
 */

import { authService } from './auth.service'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

export interface FeedbackItem {
  id: string
  userId: string
  tripId?: string | null
  type: 'rating' | 'complaint' | 'suggestion' | string
  title?: string | null
  ratingScore: number
  content: string
  category?: string | null
  ticketCode?: string | null
  attachments?: string[] | null
  status: 'new' | 'in_review' | 'resolved' | string
  adminResponse?: string | null
  respondedBy?: string | null
  respondedAt?: string | null
  createdAt: string
  user?: {
    id: string
    fullName: string
    email: string
    phoneNumber?: string
    avatarUrl?: string
  } | null
  trip?: {
    id: string
    departureTime: string
    route?: {
      routeCode: string
      name: string
    } | null
  } | null
  respondedByUser?: {
    id: string
    fullName: string
    email: string
  } | null
}

export interface FeedbackStats {
  totalFeedbacks: number
  avgRating: number
  newComplaintsCount: number
  resolvedCount: number
  ratingDistribution: Record<number, number>
}

export interface GetFeedbackResponse {
  items: FeedbackItem[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  stats?: FeedbackStats
}

export interface CreateFeedbackPayload {
  tripId?: string
  ratingScore?: number
  content: string
  category?: string
  type?: 'rating' | 'complaint' | 'suggestion'
  title?: string
  ticketCode?: string
  attachments?: string[]
}

export interface CreateComplaintPayload {
  title: string
  content: string
  category: string
  tripId?: string
  ticketCode?: string
  ratingScore?: number
  attachments?: string[]
}

export interface QueryFeedbackParams {
  page?: number
  limit?: number
  status?: string
  ratingScore?: number
  type?: string
  category?: string
  search?: string
  tripId?: string
  userId?: string
}

export interface RespondFeedbackPayload {
  adminResponse: string
  status?: 'in_review' | 'resolved'
}

class FeedbackService {
  private getHeaders(): HeadersInit {
    const token = authService.getToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  /**
   * 1. Gửi Đánh giá chuyến xe (Hành khách)
   */
  async createFeedback(payload: CreateFeedbackPayload): Promise<{ success: boolean; data?: FeedbackItem; message?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/feedback`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể gửi đánh giá' }
      }
      return { success: true, data: json?.data || json }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /**
   * 2. Gửi Khiếu nại / Phản ánh kèm ảnh minh chứng (Hành khách)
   */
  async createComplaint(payload: CreateComplaintPayload): Promise<{ success: boolean; data?: FeedbackItem; message?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/feedback/complaint`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể gửi phản ánh / khiếu nại' }
      }
      return { success: true, data: json?.data || json }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /**
   * 3. Tải ảnh minh chứng khiếu nại (Upload Proof Image)
   */
  async uploadProofImage(file: File): Promise<{ success: boolean; url?: string; message?: string }> {
    try {
      const token = authService.getToken()
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${API_BASE_URL}/upload/feedback-proof`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể tải ảnh minh chứng lên máy chủ' }
      }
      return { success: true, url: json?.url }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Lỗi tải ảnh' }
    }
  }

  /**
   * 4. Xem lịch sử phản ánh & đánh giá của chính người dùng đăng nhập
   */
  async getMyFeedbacks(params: QueryFeedbackParams = {}): Promise<GetFeedbackResponse> {
    const q = new URLSearchParams()
    if (params.page) q.append('page', String(params.page))
    if (params.limit) q.append('limit', String(params.limit))
    if (params.status && params.status !== 'all') q.append('status', params.status)
    if (params.type && params.type !== 'all') q.append('type', params.type)

    const res = await fetch(`${API_BASE_URL}/feedback/my?${q.toString()}`, {
      headers: this.getHeaders(),
      cache: 'no-store',
    })

    const json = await res.json().catch(() => ({}))
    return json?.data || json || { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } }
  }

  /**
   * 5. Lấy danh sách phản ánh & đánh giá (Manager, Admin) với bộ lọc đa tiêu chí
   */
  async getAdminFeedbacks(params: QueryFeedbackParams = {}): Promise<GetFeedbackResponse> {
    const q = new URLSearchParams()
    if (params.page) q.append('page', String(params.page))
    if (params.limit) q.append('limit', String(params.limit))
    if (params.status && params.status !== 'all') q.append('status', params.status)
    if (params.ratingScore) q.append('ratingScore', String(params.ratingScore))
    if (params.type && params.type !== 'all') q.append('type', params.type)
    if (params.category && params.category !== 'all') q.append('category', params.category)
    if (params.search && params.search.trim()) q.append('search', params.search.trim())

    const res = await fetch(`${API_BASE_URL}/admin/feedback?${q.toString()}`, {
      headers: this.getHeaders(),
      cache: 'no-store',
    })

    const json = await res.json().catch(() => ({}))
    return json?.data || json || { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } }
  }

  /**
   * 6. Xem chi tiết phản ánh theo ID (Manager, Admin)
   */
  async getAdminFeedbackById(id: string): Promise<FeedbackItem | null> {
    const res = await fetch(`${API_BASE_URL}/admin/feedback/${id}`, {
      headers: this.getHeaders(),
      cache: 'no-store',
    })
    const json = await res.json().catch(() => null)
    return json?.data || json || null
  }

  /**
   * 7. Gửi câu trả lời và cập nhật trạng thái xử lý cho hành khách (Manager, Admin)
   */
  async respondFeedback(
    id: string,
    payload: RespondFeedbackPayload,
  ): Promise<{ success: boolean; data?: FeedbackItem; message?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể gửi phản hồi' }
      }
      return { success: true, data: json?.data || json }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Lỗi kết nối máy chủ' }
    }
  }
}

export const feedbackService = new FeedbackService()
