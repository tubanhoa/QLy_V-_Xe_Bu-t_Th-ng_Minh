'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { App } from 'antd'
import { ArrowLeft, ArrowRight, CheckCircle2, GraduationCap, Home, Lock, ShieldCheck, User } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { ROLE_META, type Role } from '@/lib/rbac'
import { RoleSwitcher } from './role-switcher'
import { cn } from '@/lib/utils'

export function LoginForm() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Đang tải biểu mẫu...</div>}>
      <LoginFormContent />
    </Suspense>
  )
}

function LoginFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectParam = searchParams.get('redirect')

  const { message } = App.useApp()
  const { login, logout, isAuthenticated, user } = useAuth()

  // Mode: 'student' (default, matching the requested HSSV format) or 'staff' (Cổng điều hành nội bộ)
  const [portalMode, setPortalMode] = useState<'student' | 'staff'>('student')
  const [activeTab, setActiveTab] = useState<'credentials' | 'sso'>('credentials')

  // Form states - strictly blank initial values for production
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState<Role>('admin')

  // Chống Chrome / Edge tự động điền tài khoản localhost đã lưu (ví dụ admin@jobportal.vn)
  useEffect(() => {
    const purgeAutofill = () => {
      setIdentifier((prev) => (prev.includes('jobportal') || prev === 'admin@jobportal.vn' ? '' : prev))
      setPassword((prev) => (prev && identifier.includes('jobportal') ? '' : prev))
    }
    purgeAutofill()
    const t1 = setTimeout(purgeAutofill, 50)
    const t2 = setTimeout(purgeAutofill, 200)
    const t3 = setTimeout(purgeAutofill, 600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [identifier])

  // Demo role switcher is hidden by default in production unless explicitly enabled
  const showRoleDemo = process.env.NEXT_PUBLIC_SHOW_ROLE_DEMO === 'true'

  const handleRoleChange = (next: Role) => {
    setRole(next)
    if (next === 'admin') {
      setIdentifier('admin@smartbus.ictu.vn')
    } else if (next === 'dispatcher') {
      setIdentifier('manager@smartbus.ictu.vn')
    } else if (next === 'driver') {
      setIdentifier('driver.nam@smartbus.ictu.vn')
    } else {
      setIdentifier('student.an@ictu.edu.vn')
    }
    setPassword('Password@123')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim()) {
      message.error('Vui lòng nhập Mã sinh viên hoặc Email')
      return
    }
    if (!password) {
      message.error('Vui lòng nhập mật khẩu')
      return
    }

    setLoading(true)
    try {
      let emailToLogin = identifier.trim()
      if (portalMode === 'student' && !emailToLogin.includes('@')) {
        emailToLogin = `${emailToLogin.toLowerCase()}@ictu.edu.vn`
      }

      const res = await login(emailToLogin, password, remember)
      if (res.success) {
        message.success(
          portalMode === 'student'
            ? `Đăng nhập HSSV thành công! Chào mừng ${user?.fullName || identifier}`
            : `Đăng nhập Cổng Điều Hành thành công!`,
        )
        if (redirectParam) {
          router.push(redirectParam)
        } else if (portalMode === 'staff') {
          router.push('/dashboard')
        } else {
          router.push('/?openTickets=true')
        }
      } else {
        message.error(res.message || 'Email hoặc mật khẩu không chính xác')
      }
    } catch {
      message.error('Đăng nhập không thành công, vui lòng kiểm tra lại thông tin')
    } finally {
      setLoading(false)
    }
  }

  const handleSsoLogin = async () => {
    setLoading(true)
    try {
      const res = await login('student.an@ictu.edu.vn', 'Password@123', false)
      if (res.success) {
        message.success('Đăng nhập thành công với tài khoản Microsoft Office 365 ICTU!')
        router.push(redirectParam || '/?openTickets=true')
      } else {
        message.error(res.message || 'Không thể kết nối dịch vụ Office 365')
      }
    } catch {
      message.error('Không thể kết nối dịch vụ Office 365')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200/80 dark:border-emerald-500/20 bg-white/95 dark:bg-card/90 p-6 sm:p-8 shadow-2xl shadow-emerald-950/10 backdrop-blur-xl">
      {/* Quick Navigation Back to Home (Chỉ hiển thị trên Mobile, Desktop đã có nút riêng bên trái) */}
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 dark:border-border/60 pb-3 lg:hidden">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-[#005A36] dark:text-slate-400 dark:hover:text-emerald-400 transition-colors"
        >
          <span className="flex size-6 items-center justify-center rounded-lg bg-slate-100 dark:bg-muted text-slate-600 dark:text-slate-300 group-hover:bg-[#005A36] group-hover:text-white transition-all">
            <ArrowLeft size={13} strokeWidth={2.4} />
          </span>
          <span className="font-extrabold">Về Trang chủ</span>
        </Link>
        <span className="text-[11px] font-semibold text-slate-400">ICTU Smart Transit</span>
      </div>

      {/* Active Session Notification (if previously logged in, gives user choice instead of force-redirecting) */}
      {isAuthenticated && user && (
        <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/30 p-3.5 text-xs text-foreground">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-[#005A36] dark:text-emerald-300 truncate">
                Đang đăng nhập: {user.name}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">{user.roleTitle}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {user.role === 'admin' || user.role === 'dispatcher' || user.role === 'driver' || user.role === 'manager' ? (
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-[#005A36] hover:bg-[#004529] px-3 py-1.5 text-xs font-bold text-white shadow-xs"
                >
                  Vào Bảng Điều Hành
                </Link>
              ) : (
                <Link
                  href="/?openTickets=true"
                  className="rounded-xl bg-[#005A36] hover:bg-[#004529] px-3 py-1.5 text-xs font-bold text-white shadow-xs"
                >
                  Vào Ví Vé & Tiện Ích
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  logout()
                  message.info('Đã đăng xuất tài khoản')
                }}
                className="rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-muted cursor-pointer"
              >
                Đổi tài khoản
              </button>
            </div>
          </div>
        </div>
      )}

      {portalMode === 'student' ? (
        <>
          {/* Header matching user's requested layout */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-border/60">
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                Đăng nhập tài khoản HSSV
              </h2>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                Dành cho Sinh viên, Học viên & Cán bộ ICTU
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-[#005A36] dark:bg-emerald-500/20 dark:text-emerald-400">
              <GraduationCap size={24} strokeWidth={2.2} />
            </div>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('credentials')}
              className={cn(
                'rounded-xl py-2.5 transition-all duration-200',
                activeTab === 'credentials'
                  ? 'bg-white dark:bg-card text-[#005A36] dark:text-emerald-400 font-black shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
              )}
            >
              Mã SV / Mật khẩu
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sso')}
              className={cn(
                'rounded-xl py-2.5 transition-all duration-200',
                activeTab === 'sso'
                  ? 'bg-white dark:bg-card text-[#005A36] dark:text-emerald-400 font-black shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
              )}
            >
              Office 365 ICTU
            </button>
          </div>

          {activeTab === 'credentials' ? (
            <form onSubmit={handleSubmit} autoComplete="off" className="mt-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  Mã sinh viên hoặc Email trường
                </label>
                <div className="relative flex items-center">
                  <div className="pointer-events-none absolute left-3.5 text-slate-400">
                    <User size={18} strokeWidth={2} />
                  </div>
                  <input
                    type="text"
                    name="ictu_login_identifier"
                    id="ictu_login_identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Ví dụ: DTC... hoặc email@ictu.edu.vn"
                    required
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    className="w-full rounded-2xl border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/40 py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-normal outline-none transition-all focus:border-[#005A36] focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-[#005A36]/15"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative flex items-center">
                  <div className="pointer-events-none absolute left-3.5 text-slate-400">
                    <Lock size={18} strokeWidth={2} />
                  </div>
                  <input
                    type="password"
                    name="ictu_login_secret"
                    id="ictu_login_secret"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu của bạn"
                    required
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    className="w-full rounded-2xl border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/40 py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-normal outline-none transition-all focus:border-[#005A36] focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-[#005A36]/15"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="size-4 rounded-md border-slate-300 text-[#005A36] focus:ring-[#005A36]"
                  />
                  <span>Duy trì đăng nhập</span>
                </label>
                <a href="#" className="font-bold text-slate-800 dark:text-slate-200 hover:text-[#005A36] hover:underline">
                  Quên mật khẩu?
                </a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl btn-vcb-solid py-3.5 text-sm font-black text-white shadow-md shadow-emerald-950/20 transition-all duration-200 hover:scale-[1.01] active:scale-95 disabled:opacity-70 cursor-pointer"
                style={{ backgroundColor: '#005a36', color: '#ffffff' }}
              >
                <span>{loading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}</span>
                <ArrowRight size={18} strokeWidth={2.4} />
              </button>
            </form>
          ) : (
            <div className="mt-5 flex flex-col gap-4">
              <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/70 dark:bg-blue-950/20 p-4 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white dark:bg-card shadow-xs mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M1 1h10v10H1V1z" fill="#F25022" />
                    <path d="M13 1h10v10H13V1z" fill="#7FBA00" />
                    <path d="M1 13h10v10H1V13z" fill="#00A4EF" />
                    <path d="M13 13h10v10H13V13z" fill="#FFB900" />
                  </svg>
                </div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">Microsoft Office 365 ICTU</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Sử dụng tài khoản email sinh viên do nhà trường cấp (<code className="font-semibold text-blue-700 dark:text-blue-400">@ictu.edu.vn</code>) để đăng nhập một chạm nhanh chóng.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSsoLogin}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2.5 rounded-2xl border-2 border-slate-200 dark:border-border bg-white dark:bg-card py-3.5 text-sm font-black text-slate-800 dark:text-slate-100 shadow-xs transition-all hover:bg-slate-50 dark:hover:bg-muted active:scale-95"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M1 1h10v10H1V1z" fill="#F25022" />
                  <path d="M13 1h10v10H13V1z" fill="#7FBA00" />
                  <path d="M1 13h10v10H1V13z" fill="#00A4EF" />
                  <path d="M13 13h10v10H13V13z" fill="#FFB900" />
                </svg>
                <span>{loading ? 'Đang kết nối...' : 'Đăng nhập với tài khoản trường'}</span>
              </button>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-border/60 flex flex-col gap-2 text-center text-xs text-slate-500 dark:text-slate-400">
            <p>
              Chưa có tài khoản?{' '}
              <Link href="/register" className="font-black text-[#005A36] dark:text-emerald-400 hover:underline">
                Đăng ký tài khoản ngay (Trợ giá HSSV -50%) →
              </Link>
            </p>
            <div className="flex items-center justify-center gap-1.5 pt-0.5 text-[11px]">
              <span>Bạn là Cán bộ Điều hành / Tài xế?</span>
              <button
                type="button"
                onClick={() => setPortalMode('staff')}
                className="font-black text-slate-800 dark:text-slate-200 hover:text-[#005A36] dark:hover:text-emerald-400 underline cursor-pointer"
              >
                Cổng Điều Hành nội bộ →
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Internal Staff Mode */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-border/60">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-[#005A36] dark:text-emerald-400 mb-1">
                <ShieldCheck size={13} strokeWidth={2} />
                Bảo mật nội bộ ICTU
              </p>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                Cổng Điều Hành
              </h2>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                Dành cho Ban Quản trị, Điều phối & Đội ngũ Tài xế
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-[#005A36] dark:bg-emerald-500/20 dark:text-emerald-400">
              <ShieldCheck size={24} strokeWidth={2.2} />
            </div>
          </div>

          {/* Role Switcher Demo - Only shown when NEXT_PUBLIC_SHOW_ROLE_DEMO === 'true' */}
          {showRoleDemo && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Xem trước vai trò (Demo)
              </p>
              <RoleSwitcher value={role} onChange={handleRoleChange} />
            </div>
          )}

          <form onSubmit={handleSubmit} autoComplete="off" className="mt-5 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                Email công vụ / Mã nhân viên
              </label>
              <div className="relative flex items-center">
                <div className="pointer-events-none absolute left-3.5 text-slate-400">
                  <User size={18} strokeWidth={2} />
                </div>
                <input
                  type="text"
                  name="ictu_staff_identifier"
                  id="ictu_staff_identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Email công vụ hoặc Mã số CB/GV"
                  required
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  className="w-full rounded-2xl border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/40 py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#005A36] focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-[#005A36]/15"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                Mật khẩu nội bộ
              </label>
              <div className="relative flex items-center">
                <div className="pointer-events-none absolute left-3.5 text-slate-400">
                  <Lock size={18} strokeWidth={2} />
                </div>
                <input
                  type="password"
                  name="ictu_staff_secret"
                  id="ictu_staff_secret"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu nội bộ của bạn"
                  required
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  className="w-full rounded-2xl border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/40 py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#005A36] focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-[#005A36]/15"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="size-4 rounded-md border-slate-300 text-[#005A36] focus:ring-[#005A36]"
                />
                <span>Duy trì đăng nhập</span>
              </label>
              <a href="#" className="font-bold text-[#005A36] dark:text-emerald-400 hover:underline">
                Quên mật khẩu?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl btn-vcb-solid py-3.5 text-sm font-black text-white shadow-md shadow-emerald-950/20 transition-all duration-200 hover:scale-[1.01] active:scale-95 disabled:opacity-70 cursor-pointer"
              style={{ backgroundColor: '#005a36', color: '#ffffff' }}
            >
              <span>{loading ? 'Đang xác thực...' : 'Đăng nhập cổng điều hành'}</span>
              <ArrowRight size={18} strokeWidth={2.4} />
            </button>
          </form>

          {/* Switch back to Student login */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-border/60 text-center text-xs text-slate-500 dark:text-slate-400">
            <button
              type="button"
              onClick={() => setPortalMode('student')}
              className="font-bold text-[#005A36] dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              ← Quay lại Đăng nhập tài khoản HSSV
            </button>
          </div>
        </>
      )}
    </div>
  )
}
