'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ROLE_META, type Role, type StaffUser } from '@/lib/rbac'

export type ThemeMode = 'light' | 'dark'

interface AuthContextValue {
  user: StaffUser | null
  role: Role
  setRole: (role: Role) => void
  isAuthenticated: boolean
  login: (email: string, role: Role, remember?: boolean) => Promise<void>
  logout: () => void
  themeMode: ThemeMode
  toggleTheme: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = 'ictu_transit_auth_state'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>('admin')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>('light')
  const [isLoaded, setIsLoaded] = useState(false)

  // Khôi phục trạng thái từ sessionStorage hoặc localStorage khi tải trang
  useEffect(() => {
    try {
      // Ưu tiên session hiện tại, sau đó mới đến persistent remember nếu có
      const sessionSaved = sessionStorage.getItem(STORAGE_KEY)
      const localSaved = localStorage.getItem(STORAGE_KEY)
      const saved = sessionSaved || localSaved

      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.role && ROLE_META[parsed.role as Role]) {
          setRoleState(parsed.role as Role)
        }
        if (typeof parsed.isAuthenticated === 'boolean') {
          setIsAuthenticated(parsed.isAuthenticated)
        }
        if (parsed.themeMode === 'light' || parsed.themeMode === 'dark') {
          setThemeMode(parsed.themeMode)
        }
      }
    } catch {
      // bỏ qua lỗi đọc storage
    } finally {
      setIsLoaded(true)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', themeMode === 'dark')
    root.style.colorScheme = themeMode
  }, [themeMode])

  const setRole = useCallback((newRole: Role) => {
    setRoleState(newRole)
  }, [])

  // Đăng nhập: chỉ lưu lâu dài vào localStorage nếu người dùng chủ động chọn remember = true
  const login = useCallback(async (_email: string, nextRole: Role, remember: boolean = false) => {
    await new Promise((resolve) => setTimeout(resolve, 400))
    setRoleState(nextRole)
    setIsAuthenticated(true)

    const payload = JSON.stringify({ role: nextRole, isAuthenticated: true, themeMode })
    try {
      if (remember) {
        localStorage.setItem(STORAGE_KEY, payload)
        sessionStorage.removeItem(STORAGE_KEY)
      } else {
        sessionStorage.setItem(STORAGE_KEY, payload)
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // bỏ qua lỗi storage
    }
  }, [themeMode])

  const logout = useCallback(() => {
    setIsAuthenticated(false)
    try {
      localStorage.removeItem(STORAGE_KEY)
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // bỏ qua lỗi storage
    }
  }, [])

  const toggleTheme = useCallback(
    () => setThemeMode((mode: ThemeMode) => (mode === 'light' ? 'dark' : 'light')),
    [],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user: isAuthenticated ? (ROLE_META[role]?.staff ?? null) : null,
      role,
      setRole,
      isAuthenticated,
      login,
      logout,
      themeMode,
      toggleTheme,
    }),
    [isAuthenticated, role, setRole, login, logout, themeMode, toggleTheme],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
