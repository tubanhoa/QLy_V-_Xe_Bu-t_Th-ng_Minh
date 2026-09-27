const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: 'passenger' | 'admin' | 'manager' | 'driver' | string
  avatarUrl?: string | null
  studentId?: string | null
  faculty?: string | null
  phoneNumber?: string | null
}

export interface LoginResponseData {
  user: AuthUser
  accessToken: string
  refreshToken?: string
  tokenType?: string
  expiresIn?: number
}

export interface RegisterPayload {
  email: string
  password: string
  fullName: string
  phoneNumber?: string
  studentId?: string
  faculty?: string
  idCardNumber?: string
}

const TOKEN_KEY = 'ictu_bus_access_token'
const REFRESH_TOKEN_KEY = 'ictu_bus_refresh_token'
const USER_KEY = 'ictu_bus_user_profile'

class AuthService {
  private baseUrl: string

  constructor() {
    this.baseUrl = API_BASE_URL.replace(/\/+$/, '')
  }

  /**
   * Đăng nhập tài khoản với email và mật khẩu thật qua Backend NestJS
   * Endpoint: POST /api/v1/auth/login
   */
  async login(payload: { email: string; password: string }): Promise<{
    success: boolean
    data?: LoginResponseData
    message?: string
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: payload.email.trim().toLowerCase(),
          password: payload.password,
        }),
      })

      const resJson = await response.json().catch(() => null)

      if (!response.ok) {
        let errorMsg = 'Email hoặc mật khẩu không chính xác'
        if (resJson?.message) {
          errorMsg = Array.isArray(resJson.message) ? resJson.message.join(', ') : resJson.message
        }
        return {
          success: false,
          message: errorMsg,
        }
      }

      const responseData: LoginResponseData = resJson.data || resJson
      return {
        success: true,
        data: responseData,
        message: resJson.message || 'Đăng nhập thành công',
      }
    } catch (error: any) {
      console.error('[AuthService.login] Lỗi kết nối Backend:', error)
      return {
        success: false,
        message: 'Không thể kết nối đến máy chủ xác thực Backend. Vui lòng kiểm tra server port 3001.',
      }
    }
  }

  /**
   * Đăng ký tài khoản hành khách / sinh viên vào cơ sở dữ liệu Backend
   * Endpoint: POST /api/v1/auth/register
   */
  async register(payload: RegisterPayload): Promise<{
    success: boolean
    data?: LoginResponseData
    message?: string
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: payload.email.trim().toLowerCase(),
          password: payload.password,
          fullName: payload.fullName.trim(),
          phoneNumber: payload.phoneNumber?.trim() || undefined,
          studentId: payload.studentId?.trim() || undefined,
          faculty: payload.faculty?.trim() || undefined,
          idCardNumber: payload.idCardNumber?.trim() || undefined,
        }),
      })

      const resJson = await response.json().catch(() => null)

      if (!response.ok) {
        let errorMsg = 'Đăng ký không thành công'
        if (resJson?.message) {
          errorMsg = Array.isArray(resJson.message) ? resJson.message.join(', ') : resJson.message
        }
        return {
          success: false,
          message: errorMsg,
        }
      }

      const responseData: LoginResponseData = resJson.data || resJson
      return {
        success: true,
        data: responseData,
        message: resJson.message || 'Đăng ký tài khoản thành công',
      }
    } catch (error: any) {
      console.error('[AuthService.register] Lỗi đăng ký:', error)
      return {
        success: false,
        message: 'Không thể kết nối đến máy chủ đăng ký. Vui lòng thử lại sau.',
      }
    }
  }

  /**
   * Lưu thông tin token và profile vào Storage
   */
  saveSession(data: LoginResponseData, remember: boolean = false) {
    if (typeof window === 'undefined') return
    const storage = remember ? localStorage : sessionStorage
    const otherStorage = remember ? sessionStorage : localStorage

    otherStorage.removeItem(TOKEN_KEY)
    otherStorage.removeItem(REFRESH_TOKEN_KEY)
    otherStorage.removeItem(USER_KEY)

    storage.setItem(TOKEN_KEY, data.accessToken)
    if (data.refreshToken) storage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)
    storage.setItem(USER_KEY, JSON.stringify(data.user))
  }

  /**
   * Xóa thông tin đăng nhập khi logout
   */
  clearSession() {
    if (typeof window === 'undefined') return
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
  }

  /**
   * Lấy Access Token hiện tại
   */
  getToken(): string | null {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY)
  }

  /**
   * Lấy User profile hiện tại
   */
  getUser(): AuthUser | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }
}

export const authService = new AuthService()
