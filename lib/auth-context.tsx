'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authService, AuthUser, LoginResponseData } from '@/lib/services/auth.service'
import { ROLE_META, type Role } from '@/lib/rbac'

export type ThemeMode = 'light' | 'dark'

export interface UserProfile extends AuthUser {
  name: string
  roleTitle: string
  staffId: string
  initials: string
}

interface AuthContextValue {
  user: UserProfile | null
  role: string
  accessToken: string | null
  isAuthenticated: boolean
  isLoaded: boolean
  login: (email: string, password: string, remember?: boolean) => Promise<{ success: boolean; message?: string; user?: AuthUser }>
  setUserSession: (data: LoginResponseData, remember?: boolean) => void
  logout: () => void
  themeMode: ThemeMode
  toggleTheme: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>('light')
  const [isLoaded, setIsLoaded] = useState(false)

  // Hàm helper chuẩn hóa và định dạng user profile đồng nhất
  const formatUserProfile = (rawUser: AuthUser): UserProfile => {
    const rawRole = (rawUser as any)?.role
    const roleName = (
      typeof rawRole === 'string'
        ? rawRole
        : rawRole?.name || (rawUser.studentId ? 'passenger' : 'passenger')
    ).toLowerCase()

    let roleTitle = 'Hành khách'
    if (roleName === 'admin') roleTitle = 'Quản trị viên'
    else if (roleName === 'manager' || roleName === 'dispatcher') roleTitle = 'Điều hành viên'
    else if (roleName === 'driver') roleTitle = 'Tài xế xe buýt'
    else if (rawUser.studentId) roleTitle = `Sinh viên ICTU (${rawUser.studentId})`

    const name = rawUser.fullName || rawUser.email
    const initials =
      name
        .split(' ')
        .filter(Boolean)
        .slice(-2)
        .map((w) => w[0].toUpperCase())
        .join('') || 'U'
    const staffId = rawUser.studentId || `ICTU-${roleName.toUpperCase()}-01`

    return {
      ...rawUser,
      role: roleName,
      name,
      roleTitle,
      staffId,
      initials,
    }
  }

  // Khôi phục phiên đăng nhập khi tải trang
  useEffect(() => {
    try {
      const storedToken = authService.getToken()
      const storedUser = authService.getUser()

      if (storedToken && storedUser) {
        setAccessToken(storedToken)
        setUser(formatUserProfile(storedUser))
        setIsAuthenticated(true)
      }
    } catch (err) {
      console.error('[AuthProvider] Lỗi nạp phiên đăng nhập:', err)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', themeMode === 'dark')
    root.style.colorScheme = themeMode
  }, [themeMode])

  const setUserSession = useCallback((data: LoginResponseData, remember: boolean = false) => {
    authService.saveSession(data, remember)
    setAccessToken(data.accessToken)
    setUser(formatUserProfile(data.user))
    setIsAuthenticated(true)
  }, [])

  /**
   * Đăng nhập thật kết nối Backend API
   */
  const login = useCallback(
    async (email: string, password: string, remember: boolean = false) => {
      const res = await authService.login({ email, password })
      if (res.success && res.data) {
        setUserSession(res.data, remember)
        return { success: true, message: res.message, user: res.data.user }
      }
      return { success: false, message: res.message || 'Đăng nhập không thành công' }
    },
    [setUserSession],
  )

  /**
   * Đăng xuất xóa sạch session
   */
  const logout = useCallback(() => {
    authService.clearSession()
    setAccessToken(null)
    setUser(null)
    setIsAuthenticated(false)
  }, [])

  const toggleTheme = useCallback(
    () => setThemeMode((mode: ThemeMode) => (mode === 'light' ? 'dark' : 'light')),
    [],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role || 'passenger',
      accessToken,
      isAuthenticated,
      isLoaded,
      login,
      setUserSession,
      logout,
      themeMode,
      toggleTheme,
    }),
    [user, accessToken, isAuthenticated, isLoaded, login, setUserSession, logout, themeMode, toggleTheme],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
