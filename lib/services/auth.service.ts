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

export interface StoredAccount {
  id: string
  email: string
  password: string
  fullName: string
  phoneNumber?: string | null
  studentId?: string | null
  faculty?: string | null
  idCardNumber?: string | null
  role: string
  createdAt: string
}

const TOKEN_KEY = 'ictu_bus_access_token'
const REFRESH_TOKEN_KEY = 'ictu_bus_refresh_token'
const USER_KEY = 'ictu_bus_user_profile'
const REGISTERED_USERS_KEY = 'ictu_registered_users_list'

class AuthService {
  private baseUrl: string

  constructor() {
    const raw = (API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/+$/, '')
    this.baseUrl = raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`
  }

  /**
   * Lấy danh sách tài khoản đã đăng ký được lưu trữ trên trình duyệt (Persistence Storage)
   */
  getRegisteredUsers(): StoredAccount[] {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(REGISTERED_USERS_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  /**
   * Lưu tài khoản mới vào kho lưu trữ tài khoản (LocalStorage)
   */
  saveRegisteredUser(account: StoredAccount): void {
    if (typeof window === 'undefined') return
    try {
      const users = this.getRegisteredUsers()
      const existingIdx = users.findIndex(
        (u) => u.email.toLowerCase() === account.email.toLowerCase(),
      )
      if (existingIdx >= 0) {
        users[existingIdx] = account
      } else {
        users.push(account)
      }
      localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users))
    } catch (e) {
      console.warn('[AuthService.saveRegisteredUser] Không thể lưu tài khoản:', e)
    }
  }

  /**
   * Tìm kiếm tài khoản đã đăng ký theo Email, Mã SV hoặc Số điện thoại
   */
  findLocalUser(identifier: string): StoredAccount | null {
    const raw = identifier.trim().toLowerCase()
    const users = this.getRegisteredUsers()
    return (
      users.find((u) => {
        const emailMatch = u.email.toLowerCase() === raw
        const phoneMatch = Boolean(u.phoneNumber && u.phoneNumber.trim() === raw)
        const rawWithoutDomain = raw.replace(/@ictu\.edu\.vn$/, '')
        const studentIdMatch = Boolean(
          u.studentId &&
            (u.studentId.toLowerCase() === raw ||
              `${u.studentId.toLowerCase()}@ictu.edu.vn` === raw ||
              u.studentId.toLowerCase() === rawWithoutDomain),
        )
        return emailMatch || phoneMatch || studentIdMatch
      }) || null
    )
  }

  /**
   * Tạo đối tượng LoginResponseData từ StoredAccount
   */
  buildLoginResponse(account: StoredAccount): LoginResponseData {
    return {
      user: {
        id: account.id,
        email: account.email,
        fullName: account.fullName,
        role: account.role || (account.studentId ? 'passenger' : 'passenger'),
        studentId: account.studentId || null,
        faculty: account.faculty || null,
        phoneNumber: account.phoneNumber || null,
      },
      accessToken: `mock_jwt_${account.id}_${Date.now()}`,
    }
  }

  /**
   * Đăng nhập tài khoản với email/mã SV và mật khẩu
   * Kiểm tra cả Backend NestJS lẫn tài khoản đã đăng ký cục bộ
   * Endpoint: POST /api/v1/auth/login
   */
  async login(payload: { email: string; password: string }): Promise<{
    success: boolean
    data?: LoginResponseData
    message?: string
  }> {
    const inputIdentifier = payload.email.trim().toLowerCase()
    const inputPwd = payload.password

    // 1. Thử đăng nhập qua Backend NestJS (nếu server online)
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inputIdentifier,
          password: inputPwd,
        }),
      })

      const resJson = await response.json().catch(() => null)

      if (response.ok) {
        const responseData: LoginResponseData = resJson.data || resJson
        return {
          success: true,
          data: responseData,
          message: resJson.message || 'Đăng nhập thành công',
        }
      }

      // Nếu Backend trả về 401 hoặc lỗi, kiểm tra xem tài khoản có được lưu cục bộ không
      const localMatch = this.findLocalUser(inputIdentifier)
      if (localMatch) {
        if (localMatch.password === inputPwd) {
          return {
            success: true,
            data: this.buildLoginResponse(localMatch),
            message: `Đăng nhập thành công! Chào mừng ${localMatch.fullName}`,
          }
        } else {
          return {
            success: false,
            message: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại.',
          }
        }
      }

      let errorMsg = 'Email hoặc mật khẩu không chính xác'
      if (resJson?.message) {
        errorMsg = Array.isArray(resJson.message) ? resJson.message.join(', ') : resJson.message
      }
      return {
        success: false,
        message: errorMsg,
      }
    } catch (error: any) {
      console.warn('[AuthService.login] Backend offline, kiểm tra tài khoản đã đăng ký trong máy:', error)
    }

    // 2. Backend offline: Kiểm tra trong danh sách các tài khoản người dùng đã đăng ký trước đó
    const localMatch = this.findLocalUser(inputIdentifier)
    if (localMatch) {
      if (localMatch.password === inputPwd) {
        return {
          success: true,
          data: this.buildLoginResponse(localMatch),
          message: `Đăng nhập thành công! Chào mừng ${localMatch.fullName}`,
        }
      } else {
        return {
          success: false,
          message: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại.',
        }
      }
    }

    // 3. Kiểm tra các tài khoản mẫu định danh (Demo Sample Accounts)
    if (inputPwd === 'Password@123' || inputPwd === 'admin' || inputPwd === '123456') {
      if (inputIdentifier === 'admin@smartbus.ictu.vn' || inputIdentifier === 'admin@ictu.edu.vn' || inputIdentifier === 'admin') {
        return {
          success: true,
          data: {
            user: {
              id: 'usr_admin_001',
              email: 'admin@smartbus.ictu.vn',
              fullName: 'Quản Trị Viên Hệ Thống',
              role: 'admin',
              phoneNumber: '0901234567',
            },
            accessToken: 'mock_jwt_token_admin_ictu_smart_bus',
          },
          message: 'Đăng nhập Quản trị viên thành công!',
        }
      }
      if (inputIdentifier === 'manager@smartbus.ictu.vn' || inputIdentifier === 'dieuhanh@ictu.edu.vn' || inputIdentifier === 'dispatcher') {
        return {
          success: true,
          data: {
            user: {
              id: 'usr_manager_001',
              email: 'manager@smartbus.ictu.vn',
              fullName: 'Nguyễn Quản Lý',
              role: 'dispatcher',
              phoneNumber: '0902345678',
            },
            accessToken: 'mock_jwt_token_dispatcher_ictu_smart_bus',
          },
          message: 'Đăng nhập Điều hành viên thành công!',
        }
      }
      if (inputIdentifier === 'driver.nam@smartbus.ictu.vn' || inputIdentifier === 'taixe01@ictu.edu.vn' || inputIdentifier === 'driver') {
        return {
          success: true,
          data: {
            user: {
              id: 'usr_driver_001',
              email: 'driver.nam@smartbus.ictu.vn',
              fullName: 'Trần Văn Nam (Tài Xế)',
              role: 'driver',
              phoneNumber: '0903456789',
            },
            accessToken: 'mock_jwt_token_driver_ictu_smart_bus',
          },
          message: 'Đăng nhập Tài xế thành công!',
        }
      }
      if (inputIdentifier === 'student.an@ictu.edu.vn' || inputIdentifier.includes('student') || inputIdentifier.startsWith('dtc')) {
        return {
          success: true,
          data: {
            user: {
              id: 'usr_student_001',
              email: inputIdentifier,
              fullName: 'Nguyễn Thu An (Sinh Viên ICTU)',
              role: 'passenger',
              studentId: 'DTC215180001',
              faculty: 'Công Nghệ Thông Tin',
              phoneNumber: '0904567890',
            },
            accessToken: 'mock_jwt_token_student_ictu_smart_bus',
          },
          message: 'Đăng nhập Sinh viên ICTU thành công!',
        }
      }
    }

    return {
      success: false,
      message: 'Tài khoản chưa được đăng ký hoặc thông tin không chính xác. Bạn có thể nhấn "Đăng ký ngay" để tạo tài khoản mới.',
    }
  }

  /**
   * Đăng ký tài khoản hành khách / sinh viên vào cơ sở dữ liệu
   * Tự động lưu trữ vào LocalStorage để đảm bảo lần sau luôn đăng nhập lại được
   * Endpoint: POST /api/v1/auth/register
   */
  async register(payload: RegisterPayload): Promise<{
    success: boolean
    data?: LoginResponseData
    message?: string
  }> {
    const email = payload.email.trim().toLowerCase()
    const password = payload.password
    const fullName = payload.fullName.trim()
    const phoneNumber = payload.phoneNumber?.trim() || null
    const studentId = payload.studentId?.trim().toUpperCase() || null
    const faculty = payload.faculty?.trim() || null
    const idCardNumber = payload.idCardNumber?.trim() || null

    // 1. Kiểm tra xem email đã được đăng ký trước đó trong danh sách tài khoản chưa
    const registeredUsers = this.getRegisteredUsers()
    const existingUser = registeredUsers.find((u) => u.email.toLowerCase() === email)
    if (existingUser) {
      return {
        success: false,
        message: `Email "${email}" đã được đăng ký tài khoản trước đó. Vui lòng chuyển sang trang Đăng nhập.`,
      }
    }

    if (studentId) {
      const existingStudent = registeredUsers.find(
        (u) => u.studentId && u.studentId.toUpperCase() === studentId,
      )
      if (existingStudent) {
        return {
          success: false,
          message: `Mã sinh viên "${studentId}" đã được liên kết với một tài khoản khác.`,
        }
      }
    }

    // 2. Thử đăng ký qua Backend NestJS (nếu Backend đang hoạt động)
    let backendSuccess = false
    let backendData: LoginResponseData | null = null

    try {
      const response = await fetch(`${this.baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName,
          phoneNumber: phoneNumber || undefined,
          studentId: studentId || undefined,
          faculty: faculty || undefined,
          idCardNumber: idCardNumber || undefined,
        }),
      })

      const resJson = await response.json().catch(() => null)

      if (response.ok) {
        backendSuccess = true
        backendData = resJson.data || resJson
      } else if (response.status === 400 || response.status === 409) {
        let errorMsg = 'Đăng ký không thành công'
        if (resJson?.message) {
          errorMsg = Array.isArray(resJson.message) ? resJson.message.join(', ') : resJson.message
        }
        return {
          success: false,
          message: errorMsg,
        }
      }
    } catch (error: any) {
      console.warn('[AuthService.register] Backend offline, kích hoạt cơ chế lưu tài khoản trên trình duyệt:', error)
    }

    // 3. Tạo tài khoản và LƯU VÀO KHO LƯU TRỮ (Local Storage Persistence)
    // Đảm bảo lần sau mở máy hoặc đăng xuất ra thì vẫn đăng nhập lại được 100%
    const newUserId =
      backendData?.user?.id || `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

    const newAccount: StoredAccount = {
      id: newUserId,
      email,
      password,
      fullName,
      phoneNumber,
      studentId,
      faculty,
      idCardNumber,
      role: studentId ? 'passenger' : 'passenger',
      createdAt: new Date().toISOString(),
    }

    this.saveRegisteredUser(newAccount)

    const loginData: LoginResponseData = backendData || {
      user: {
        id: newAccount.id,
        email: newAccount.email,
        fullName: newAccount.fullName,
        role: newAccount.role,
        studentId: newAccount.studentId,
        faculty: newAccount.faculty,
        phoneNumber: newAccount.phoneNumber,
      },
      accessToken: `mock_jwt_${newAccount.id}_${Date.now()}`,
    }

    return {
      success: true,
      data: loginData,
      message: studentId
        ? 'Đăng ký tài khoản Sinh viên ICTU thành công! Bạn được kích hoạt mức giá ưu đãi HSSV giảm 50%.'
        : 'Đăng ký tài khoản hành khách thành công!',
    }
  }

  /**
   * Lưu thông tin token và profile vào Storage
   */
  saveSession(data: LoginResponseData, remember: boolean = true) {
    if (typeof window === 'undefined') return
    // Luôn lưu vào localStorage để phiên đăng nhập được duy trì khi người dùng tắt/mở lại tab
    localStorage.setItem(TOKEN_KEY, data.accessToken)
    if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))

    sessionStorage.setItem(TOKEN_KEY, data.accessToken)
    sessionStorage.setItem(USER_KEY, JSON.stringify(data.user))
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
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
  }

  /**
   * Lấy User profile hiện tại
   */
  getUser(): AuthUser | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }
}

export const authService = new AuthService()
