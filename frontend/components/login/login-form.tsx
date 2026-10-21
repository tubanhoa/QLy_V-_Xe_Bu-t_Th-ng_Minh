'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { App } from 'antd'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Home,
  Lock,
  ShieldCheck,
  User,
  KeyRound,
  Mail,
  Eye,
  EyeOff,
  RefreshCw,
  Check,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { authService } from '@/lib/services/auth.service'
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

  // View mode: 'login' | 'forgot-password' (View Slider tab)
  const [viewMode, setViewMode] = useState<'login' | 'forgot-password'>('login')
  const [resetStep, setResetStep] = useState<1 | 2>(1)
  const [resetIdentifier, setResetIdentifier] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // Form states - strictly blank initial values for production
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState<Role>('admin')

  // Đồng hồ đếm ngược gửi lại OTP
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  // Gửi mã OTP xác thực
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanId = resetIdentifier.trim()
    if (!cleanId) {
      message.error('Vui lòng nhập Mã sinh viên (DTC...) hoặc Email sinh viên (@ictu.edu.vn)')
      return
    }

    setIsSendingOtp(true)
    try {
      const res = await authService.forgotPassword(cleanId)
      if (res.success) {
        message.success(res.message || 'Đã gửi mã xác thực OTP về email sinh viên!')
        setMaskedEmail(res.maskedEmail || res.email || cleanId)
        setResetStep(2)
        setCountdown(60)
        setOtpValues(['', '', '', '', '', ''])
      } else {
        message.error(res.message || 'Không thể gửi mã OTP. Vui lòng kiểm tra lại thông tin.')
      }
    } catch {
      message.error('Lỗi kết nối máy chủ. Vui lòng thử lại sau.')
    } finally {
      setIsSendingOtp(false)
    }
  }

  // Nhập từng ô OTP 6 số
  const handleOtpChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '')
    if (!cleaned) {
      const newOtp = [...otpValues]
      newOtp[index] = ''
      setOtpValues(newOtp)
      return
    }

    if (cleaned.length > 1) {
      const pasteDigits = cleaned.slice(0, 6).split('')
      const newOtp = [...otpValues]
      pasteDigits.forEach((digit, i) => {
        if (i < 6) newOtp[i] = digit
      })
      setOtpValues(newOtp)
      const nextIdx = Math.min(pasteDigits.length, 5)
      const nextInput = document.getElementById(`otp-input-${nextIdx}`)
      nextInput?.focus()
      return
    }

    const newOtp = [...otpValues]
    newOtp[index] = cleaned[0]
    setOtpValues(newOtp)

    if (index < 5 && cleaned) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`)
      nextInput?.focus()
    }
  }

  // Xử lý phím Backspace trên từng ô OTP
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`)
      prevInput?.focus()
    }
  }

  // Xác thực OTP và đặt lại mật khẩu mới
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const otpCode = otpValues.join('')
    if (otpCode.length !== 6) {
      message.error('Vui lòng nhập đầy đủ 6 chữ số mã OTP xác thực')
      return
    }

    if (!newPassword) {
      message.error('Vui lòng nhập mật khẩu mới')
      return
    }

    const pwRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/
    if (newPassword.length < 6 || !pwRegex.test(newPassword)) {
      message.error('Mật khẩu mới phải có ít nhất 6 ký tự, gồm ít nhất 1 chữ hoa, 1 chữ số và 1 ký tự đặc biệt (!@#$%^&*)')
      return
    }

    if (newPassword !== confirmNewPassword) {
      message.error('Xác nhận mật khẩu mới không khớp!')
      return
    }

    setIsResetting(true)
    try {
      const verifyRes = await authService.verifyResetOtp(resetIdentifier, otpCode)
      if (!verifyRes.success || !verifyRes.resetToken) {
        message.error(verifyRes.message || 'Mã xác thực OTP không đúng hoặc đã hết hạn!')
        setIsResetting(false)
        return
      }

      const resetRes = await authService.resetPassword({
        identifier: resetIdentifier,
        resetToken: verifyRes.resetToken,
        newPassword,
      })

      if (resetRes.success) {
        message.success('Đặt lại mật khẩu thành công! Vui lòng nhập mật khẩu mới để đăng nhập.')
        setIdentifier(resetIdentifier)
        setPassword('')
        setViewMode('login')
        setResetStep(1)
        setOtpValues(['', '', '', '', '', ''])
        setNewPassword('')
        setConfirmNewPassword('')
        setTimeout(() => {
          document.getElementById('ictu_login_secret')?.focus()
        }, 300)
      } else {
        message.error(resetRes.message || 'Không thể đặt lại mật khẩu')
      }
    } catch {
      message.error('Lỗi kết nối máy chủ. Vui lòng thử lại sau.')
    } finally {
      setIsResetting(false)
    }
  }

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
      setIdentifier('driver.le.nam@smartbus.ictu.vn')
    } else {
      setIdentifier('student.an@ictu.edu.vn')
    }
    setPassword('Password@123')
  }

  // Tự động điều hướng nếu đã có phiên đăng nhập hợp lệ (tránh kẹt ở màn hình login)
  useEffect(() => {
    if (isAuthenticated && user) {
      const isSwitching = searchParams.get('switch') === 'true'
      if (!isSwitching) {
        const isStaff =
          user.role === 'admin' ||
          user.role === 'dispatcher' ||
          user.role === 'driver' ||
          user.role === 'manager'
        const defaultTarget = isStaff ? '/dashboard' : '/'
        const safeRedirect =
          redirectParam && !redirectParam.startsWith('/login') && !redirectParam.startsWith('/dang-nhap')
            ? redirectParam
            : null
        const targetUrl = safeRedirect === '/admin' ? '/dashboard' : safeRedirect || defaultTarget

        const timer = setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.href = targetUrl
          }
        }, 500)
        return () => clearTimeout(timer)
      }
    }
  }, [isAuthenticated, user, redirectParam, searchParams])

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
        const rawRole = (res.user as any)?.role
        const roleStr = (typeof rawRole === 'string' ? rawRole : rawRole?.name || '').toLowerCase()
        const isStaff = ['admin', 'dispatcher', 'manager', 'driver'].includes(roleStr)

        message.success(
          isStaff
            ? `Đăng nhập Cổng Điều Hành thành công! Đang chuyển hướng...`
            : `Đăng nhập HSSV thành công! Đang chuyển hướng về Trang chủ...`,
        )
        const defaultTarget = isStaff ? '/dashboard' : '/'
        const safeRedirect =
          redirectParam && !redirectParam.startsWith('/login') && !redirectParam.startsWith('/dang-nhap')
            ? redirectParam
            : null
        const targetUrl = safeRedirect === '/admin' ? '/dashboard' : safeRedirect || defaultTarget

        // Dùng window.location.href để đảm bảo trình duyệt điều hướng tức thì 100% trên localhost
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.href = targetUrl
          } else {
            router.push(targetUrl)
          }
        }, 300)
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
        message.success('Đăng nhập thành công với tài khoản Microsoft Office 365 ICTU! Đang chuyển hướng...')
        const targetUrl = redirectParam || '/'
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.href = targetUrl
          } else {
            router.push(targetUrl)
          }
        }, 300)
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
      {/* Active Session Notification */}
      {isAuthenticated && user && (
        <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-50/90 dark:bg-emerald-950/40 p-3.5 text-xs text-foreground shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-bold text-[#005A36] dark:text-emerald-300 truncate">
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Đang đăng nhập: {user.name}</span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate pl-5">
                {user.roleTitle} &bull; Tự động chuyển hướng trong giây lát...
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const isStaff =
                    user.role === 'admin' ||
                    user.role === 'dispatcher' ||
                    user.role === 'driver' ||
                    user.role === 'manager'
                  const defaultTarget = isStaff ? '/dashboard' : '/'
                  const safeRedirect =
                    redirectParam && !redirectParam.startsWith('/login') && !redirectParam.startsWith('/dang-nhap')
                      ? redirectParam
                      : null
                  const target = safeRedirect === '/admin' ? '/dashboard' : safeRedirect || defaultTarget
                  window.location.href = target
                }}
                className="rounded-xl bg-[#005A36] hover:bg-[#004529] px-3 py-1.5 text-xs font-bold text-white shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                Vào ngay
              </button>
              <button
                type="button"
                onClick={() => {
                  logout()
                  message.info('Đã đăng xuất tài khoản')
                }}
                className="rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-muted cursor-pointer active:scale-95 transition-all"
              >
                Đổi tài khoản
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'forgot-password' ? (
        <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-border/60">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setViewMode('login')}
                className="flex size-9 items-center justify-center rounded-xl border border-slate-200 dark:border-border text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-muted cursor-pointer active:scale-95 transition-all"
                title="Quay lại Đăng nhập"
              >
                <ArrowLeft size={16} strokeWidth={2.5} />
              </button>
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                  Quên mật khẩu sinh viên
                </h2>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Xác thực danh tính qua hòm thư sinh viên ICTU
                </p>
              </div>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-[#005A36] dark:bg-emerald-500/20 dark:text-emerald-400">
              <KeyRound size={22} strokeWidth={2.2} />
            </div>
          </div>

          {/* Stepper Indicator */}
          <div className="mt-4 flex items-center justify-between gap-2 px-1">
            <div
              className={cn(
                'flex-1 flex items-center gap-2 pb-2 border-b-2 text-xs font-black transition-all',
                resetStep === 1
                  ? 'border-[#005A36] text-[#005A36] dark:text-emerald-400'
                  : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-500',
              )}
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-[#005A36] text-[10px] text-white">
                1
              </span>
              <span>Mã SV / Email</span>
            </div>
            <div
              className={cn(
                'flex-1 flex items-center gap-2 pb-2 border-b-2 text-xs font-black transition-all',
                resetStep === 2
                  ? 'border-[#005A36] text-[#005A36] dark:text-emerald-400'
                  : 'border-slate-200 dark:border-border text-slate-400',
              )}
            >
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full text-[10px]',
                  resetStep === 2
                    ? 'bg-[#005A36] text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
                )}
              >
                2
              </span>
              <span>Nhập OTP & Mật khẩu</span>
            </div>
          </div>

          {resetStep === 1 ? (
            /* BƯỚC 1: NHẬP MÃ SINH VIÊN HOẶC EMAIL */
            <form onSubmit={handleSendOtp} className="mt-4 flex flex-col gap-4">
              <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-3.5 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed flex items-start gap-2.5">
                <ShieldCheck size={18} className="text-[#005A36] dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Bảo mật học đường ICTU:</strong> Hệ thống sẽ xác thực tài khoản sinh viên và tự động gửi mã OTP 6 số (hiệu lực 10 phút) về hòm thư sinh viên chính thức của bạn.
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  Mã sinh viên hoặc Email ICTU *
                </label>
                <div className="relative flex items-center">
                  <div className="pointer-events-none absolute left-3.5 text-slate-400">
                    <GraduationCap size={18} strokeWidth={2} />
                  </div>
                  <input
                    type="text"
                    value={resetIdentifier}
                    onChange={(e) => setResetIdentifier(e.target.value)}
                    placeholder="Ví dụ: DTC215180001 hoặc student.an@ictu.edu.vn"
                    required
                    autoFocus
                    className="w-full rounded-2xl border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/40 py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-normal outline-none transition-all focus:border-[#005A36] focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-[#005A36]/15"
                  />
                </div>

                {/* Quick Helper Pills */}
                <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[11px]">
                  <span className="text-slate-500 font-medium">Gợi ý điền nhanh:</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!resetIdentifier.startsWith('DTC')) {
                        setResetIdentifier('DTC' + resetIdentifier.replace(/^dtc/i, ''))
                      }
                    }}
                    className="rounded-lg border border-slate-200 dark:border-border bg-slate-100/80 dark:bg-muted px-2 py-0.5 font-bold text-slate-700 dark:text-slate-300 hover:border-[#005A36] cursor-pointer"
                  >
                    + DTC
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!resetIdentifier.includes('@ictu.edu.vn')) {
                        setResetIdentifier(resetIdentifier.split('@')[0] + '@ictu.edu.vn')
                      }
                    }}
                    className="rounded-lg border border-slate-200 dark:border-border bg-slate-100/80 dark:bg-muted px-2 py-0.5 font-bold text-[#005A36] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                  >
                    + @ictu.edu.vn
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSendingOtp || !resetIdentifier.trim()}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl btn-vcb-solid py-3.5 text-sm font-black text-white shadow-md shadow-emerald-950/20 transition-all duration-200 hover:scale-[1.01] active:scale-95 disabled:opacity-60 cursor-pointer"
                style={{ backgroundColor: '#005a36', color: '#ffffff' }}
              >
                <span>{isSendingOtp ? 'Đang kiểm tra & gửi mã...' : 'Gửi mã xác thực về Email ICTU'}</span>
                <ArrowRight size={18} strokeWidth={2.4} />
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setViewMode('login')}
                  className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-[#005A36] dark:hover:text-emerald-400 hover:underline cursor-pointer"
                >
                  ← Nhớ mật khẩu? Quay lại đăng nhập
                </button>
              </div>
            </form>
          ) : (
            /* BƯỚC 2: NHẬP MÃ OTP & MẬT KHẨU MỚI */
            <form onSubmit={handleResetPasswordSubmit} className="mt-4 flex flex-col gap-4">
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-600 dark:text-slate-400 text-[11px]">Mã OTP 6 số đã gửi tới:</p>
                  <p className="font-black text-[#005A36] dark:text-emerald-400 font-mono text-sm mt-0.5">{maskedEmail}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setResetStep(1)}
                  className="rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-card px-2.5 py-1 text-[11px] font-bold text-[#005A36] dark:text-emerald-400 hover:bg-emerald-50 cursor-pointer active:scale-95 transition-all"
                >
                  Đổi tài khoản
                </button>
              </div>

              {/* 6 Ô NHẬP OTP */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    Nhập mã xác thực OTP (6 chữ số) *
                  </label>
                  {countdown > 0 ? (
                    <span className="text-[11px] font-bold text-slate-500">
                      Gửi lại sau {countdown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendOtp()}
                      disabled={isSendingOtp}
                      className="text-[11px] font-bold text-[#005A36] dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw size={11} className={isSendingOtp ? 'animate-spin' : ''} />
                      Gửi lại mã OTP
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-6 gap-1.5 sm:gap-2 my-1">
                  {otpValues.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`otp-input-${idx}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      autoFocus={idx === 0}
                      className="size-11 sm:size-12 text-center text-xl font-black rounded-xl border border-slate-200 dark:border-border bg-slate-50/70 dark:bg-muted/40 text-[#005A36] dark:text-emerald-400 focus:border-[#005A36] focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-[#005A36]/15 outline-none transition-all shadow-xs"
                    />
                  ))}
                </div>
              </div>

              {/* MẬT KHẨU MỚI */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  Mật khẩu mới *
                </label>
                <div className="relative flex items-center">
                  <div className="pointer-events-none absolute left-3.5 text-slate-400">
                    <Lock size={18} strokeWidth={2} />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới"
                    required
                    className="w-full rounded-2xl border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/40 py-2.5 pl-11 pr-11 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#005A36] focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-[#005A36]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* XÁC NHẬN MẬT KHẨU MỚI */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  Xác nhận mật khẩu mới *
                </label>
                <div className="relative flex items-center">
                  <div className="pointer-events-none absolute left-3.5 text-slate-400">
                    <Lock size={18} strokeWidth={2} />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    required
                    className="w-full rounded-2xl border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/40 py-2.5 pl-11 pr-11 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#005A36] focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-[#005A36]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* BẢNG KIỂM TRA ĐỘ MẠNH MẬT KHẨU (EDUCATION STANDARD) */}
              <div className="rounded-xl bg-slate-50 dark:bg-muted/30 border border-slate-100 dark:border-border/60 p-3 text-[11px] space-y-1">
                <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">Yêu cầu bảo mật mật khẩu ICTU:</p>
                <div
                  className={cn(
                    'flex items-center gap-1.5 transition-colors',
                    newPassword.length >= 6 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500',
                  )}
                >
                  <Check size={12} className={newPassword.length >= 6 ? 'opacity-100' : 'opacity-30'} />
                  <span>Tối thiểu 6 ký tự</span>
                </div>
                <div
                  className={cn(
                    'flex items-center gap-1.5 transition-colors',
                    /[A-Z]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500',
                  )}
                >
                  <Check size={12} className={/[A-Z]/.test(newPassword) ? 'opacity-100' : 'opacity-30'} />
                  <span>Ít nhất 1 chữ in hoa (A-Z)</span>
                </div>
                <div
                  className={cn(
                    'flex items-center gap-1.5 transition-colors',
                    /[0-9]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500',
                  )}
                >
                  <Check size={12} className={/[0-9]/.test(newPassword) ? 'opacity-100' : 'opacity-30'} />
                  <span>Ít nhất 1 chữ số (0-9)</span>
                </div>
                <div
                  className={cn(
                    'flex items-center gap-1.5 transition-colors',
                    /[!@#$%^&*]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500',
                  )}
                >
                  <Check size={12} className={/[!@#$%^&*]/.test(newPassword) ? 'opacity-100' : 'opacity-30'} />
                  <span>Ít nhất 1 ký tự đặc biệt (!@#$%^&*)</span>
                </div>
                {confirmNewPassword && (
                  <div
                    className={cn(
                      'flex items-center gap-1.5 pt-1 border-t border-slate-200/60 dark:border-border/40 font-bold',
                      newPassword === confirmNewPassword
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-500',
                    )}
                  >
                    <Check size={12} className={newPassword === confirmNewPassword ? 'opacity-100' : 'opacity-30'} />
                    <span>{newPassword === confirmNewPassword ? 'Mật khẩu xác nhận khớp' : 'Mật khẩu xác nhận chưa khớp'}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isResetting || otpValues.join('').length !== 6 || !newPassword || newPassword !== confirmNewPassword}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl btn-vcb-solid py-3.5 text-sm font-black text-white shadow-md shadow-emerald-950/20 transition-all duration-200 hover:scale-[1.01] active:scale-95 disabled:opacity-60 cursor-pointer"
                style={{ backgroundColor: '#005a36', color: '#ffffff' }}
              >
                <span>{isResetting ? 'Đang xác thực & đổi mật khẩu...' : 'Xác nhận & Đổi mật khẩu'}</span>
                <CheckCircle2 size={18} strokeWidth={2.4} />
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setViewMode('login')}
                  className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-[#005A36] dark:hover:text-emerald-400 hover:underline cursor-pointer"
                >
                  Hủy bỏ, quay lại đăng nhập
                </button>
              </div>
            </form>
          )}
        </div>
      ) : portalMode === 'student' ? (
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
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('forgot-password')
                    setResetStep(1)
                    if (identifier && (identifier.toLowerCase().startsWith('dtc') || identifier.includes('@ictu.edu.vn'))) {
                      setResetIdentifier(identifier)
                    }
                  }}
                  className="font-bold text-slate-800 dark:text-slate-200 hover:text-[#005A36] hover:underline cursor-pointer"
                >
                  Quên mật khẩu?
                </button>
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
              <button
                type="button"
                onClick={() => {
                  setViewMode('forgot-password')
                  setResetStep(1)
                  if (identifier && (identifier.toLowerCase().startsWith('dtc') || identifier.includes('@ictu.edu.vn'))) {
                    setResetIdentifier(identifier)
                  }
                }}
                className="font-bold text-[#005A36] dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Quên mật khẩu?
              </button>
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
