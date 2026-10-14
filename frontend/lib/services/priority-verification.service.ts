/**
 * Service quản lý Hồ sơ Xác thực Đối tượng Ưu đãi (HSSV / Người cao tuổi)
 * Dành cho Khách hàng & HR/Quản trị viên
 */

import { authService } from './auth.service'

export interface SubmitPriorityVerificationPayload {
  category: 'student' | 'elderly'
  studentId?: string
  schoolName?: string
  idCardNumber?: string
  frontImageUrl: string
  backImageUrl?: string
  portraitImageUrl?: string
}

export interface PriorityVerificationItem {
  id: string
  userId: string
  category: 'student' | 'elderly'
  studentId?: string | null
  schoolName?: string | null
  idCardNumber?: string | null
  frontImageUrl: string
  backImageUrl?: string | null
  portraitImageUrl?: string | null
  status: 'pending' | 'verified' | 'rejected'
  rejectionReason?: string | null
  reviewedBy?: string | null
  reviewedAt?: string | null
  createdAt: string
  updatedAt: string
  user?: {
    id: string
    fullName: string
    email: string
    phoneNumber?: string
    avatarUrl?: string
  }
  reviewedByUser?: {
    id: string
    fullName: string
  }
}

export interface MyVerificationsResponse {
  priorityCategory: 'regular' | 'student' | 'elderly'
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected'
  verifiedAt?: string | null
  history: PriorityVerificationItem[]
}

export interface UnifiedApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  statusCode?: number
}

class PriorityVerificationService {
  private readonly baseUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

  private getAuthHeaders(): HeadersInit {
    const token = authService.getToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  /**
   * Khách hàng tải ảnh minh chứng (Thẻ SV, CCCD)
   */
  async uploadProofImage(file: File): Promise<UnifiedApiResponse<{ url: string; filename: string }>> {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const token = authService.getToken()
      const headers: Record<string, string> = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${this.baseUrl}/priority-verifications/upload-proof`, {
        method: 'POST',
        headers,
        body: formData,
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tải ảnh minh chứng lên máy chủ',
        }
      }

      return { success: true, data: resJson }
    } catch (error: any) {
      console.error('[PriorityVerificationService.uploadProofImage]', error)
      return { success: false, message: error?.message || 'Lỗi kết nối khi tải ảnh' }
    }
  }

  /**
   * Khách hàng nộp hồ sơ xác thực đối tượng ưu đãi
   */
  async submitVerification(
    payload: SubmitPriorityVerificationPayload,
  ): Promise<UnifiedApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/users/priority-verification`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể nộp hồ sơ xác thực ưu đãi',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[PriorityVerificationService.submitVerification]', error)
      return { success: false, message: error?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /**
   * Khách hàng tra cứu trạng thái xác thực và lịch sử của chính mình
   */
  async getMyVerifications(): Promise<UnifiedApiResponse<MyVerificationsResponse>> {
    try {
      const response = await fetch(`${this.baseUrl}/users/priority-verification/my`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tải thông tin hồ sơ của bạn',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[PriorityVerificationService.getMyVerifications]', error)
      return { success: false, message: error?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /**
   * HR / Admin lấy danh sách hồ sơ cần thẩm định
   */
  async getAdminVerifications(query?: {
    page?: number
    limit?: number
    status?: string
    category?: string
    search?: string
  }): Promise<UnifiedApiResponse<{ items: PriorityVerificationItem[]; meta: any }>> {
    try {
      const params = new URLSearchParams()
      if (query?.page) params.append('page', String(query.page))
      if (query?.limit) params.append('limit', String(query.limit))
      if (query?.status) params.append('status', query.status)
      if (query?.category) params.append('category', query.category)
      if (query?.search) params.append('search', query.search)

      const url = `${this.baseUrl}/admin/priority-verifications${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể tải danh sách hồ sơ',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[PriorityVerificationService.getAdminVerifications]', error)
      return { success: false, message: error?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /**
   * HR / Admin xem chi tiết một hồ sơ
   */
  async getAdminVerificationDetail(id: string): Promise<UnifiedApiResponse<PriorityVerificationItem>> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/priority-verifications/${id}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể xem chi tiết hồ sơ',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[PriorityVerificationService.getAdminVerificationDetail]', error)
      return { success: false, message: error?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /**
   * HR / Admin phê duyệt hoặc từ chối hồ sơ kèm lý do
   */
  async reviewVerification(
    id: string,
    status: 'approved' | 'rejected',
    rejectionReason?: string,
  ): Promise<UnifiedApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/priority-verifications/${id}/review`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ status, rejectionReason }),
      })

      const resJson = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: resJson?.message || 'Không thể xử lý thẩm định hồ sơ này',
        }
      }

      return { success: true, data: resJson?.data || resJson }
    } catch (error: any) {
      console.error('[PriorityVerificationService.reviewVerification]', error)
      return { success: false, message: error?.message || 'Lỗi kết nối máy chủ' }
    }
  }
}

export const priorityVerificationService = new PriorityVerificationService()
