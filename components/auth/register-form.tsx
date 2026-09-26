'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { App } from 'antd'
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  IdCard,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Upload,
  User,
} from 'lucide-react'
import type { RegisterPayload, RegisterResponse, UserType } from '@/lib/types/sprint1'
import { cn } from '@/lib/utils'

export function RegisterForm() {
  const router = useRouter()
  const { message } = App.useApp()

  const [userType, setUserType] = useState<UserType>('student')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [studentId, setStudentId] = useState('')
  const [faculty, setFaculty] = useState('Công nghệ Thông tin')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [studentCardPreview, setStudentCardPreview] = useState<string | null>(null)
  const [agreeTerms, setAgreeTerms] = useState(true)
  const [loading, setLoading] = useState(false)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        message.error('Dung lượng ảnh tối đa 5MB')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setStudentCardPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!fullName.trim() || !email.trim() || !phoneNumber.trim() || !password) {
      message.error('Vui lòng điền đầy đủ các thông tin bắt buộc')
      return
    }

    if (userType === 'student' && !studentId.trim()) {
      message.error('Vui lòng nhập Mã sinh viên ICTU để nhận trợ giá 50%')
      return
    }

    if (password.length < 6) {
      message.error('Mật khẩu phải có tối thiểu 6 ký tự')
      return
    }

    if (password !== confirmPassword) {
      message.error('Mật khẩu xác nhận không khớp!')
      return
    }

    if (!agreeTerms) {
      message.error('Vui lòng đồng ý với điều khoản sử dụng dịch vụ ICTU Smart Transit')
      return
    }

    setLoading(true)
    try {
      const payload: RegisterPayload = {
        userType,
        fullName,
        email,
        phoneNumber,
        password,
        studentId: userType === 'student' ? studentId : undefined,
        faculty: userType === 'student' ? faculty : undefined,
        studentCardImageUrl: studentCardPreview || undefined,
      }

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data: RegisterResponse = await res.json()

      if (res.ok && data.success) {
        message.success(data.message)
        setTimeout(() => {
          router.push('/login')
        }, 1200)
      } else {
        message.error(data.message || 'Đăng ký không thành công')
      }
    } catch {
      message.error('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-lg rounded-3xl border border-slate-200/80 dark:border-emerald-500/20 bg-white/95 dark:bg-card/90 p-6 sm:p-8 shadow-2xl shadow-emerald-950/10 backdrop-blur-xl">
      {/* Header */}
      <div className="text-center pb-5 border-b border-slate-100 dark:border-border/60">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 text-xs font-bold text-[#005A36] dark:text-emerald-400 mb-2">
          <ShieldCheck size={14} strokeWidth={2.2} />
          Hệ Thống Vé Thông Minh ICTU
        </span>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white">
          Đăng Ký Tài Khoản
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
          Hoàn thành thông tin để tra cứu tuyến, đặt vé trực tuyến & nhận trợ giá 50%
        </p>
      </div>

      {/* Account Type Selector (Sinh viên ICTU vs Hành khách) */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 rounded-2xl bg-slate-100/90 dark:bg-muted/60 p-1.5">
        <button
          type="button"
          onClick={() => setUserType('student')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-black transition-all cursor-pointer',
            userType === 'student'
              ? 'bg-[#005A36] text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
          )}
        >
          <GraduationCap size={16} strokeWidth={2.2} />
          <span>Sinh Viên ICTU (-50%)</span>
        </button>

        <button
          type="button"
          onClick={() => setUserType('passenger')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-black transition-all cursor-pointer',
            userType === 'passenger'
              ? 'bg-[#005A36] text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
          )}
        >
          <User size={16} strokeWidth={2.2} />
          <span>Hành Khách</span>
        </button>
      </div>

      {/* Form Fields */}
      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        {/* Họ và tên */}
        <div>
          <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
            Họ và tên *
          </label>
          <div className="relative flex items-center">
            <div className="pointer-events-none absolute left-3.5 text-slate-400">
              <User size={18} strokeWidth={2} />
            </div>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              required
              className="w-full rounded-2xl border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/40 py-2.5 pl-11 pr-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#005A36] focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-[#005A36]/15"
            />
          </div>
        </div>

        {/* Sinh viên fields: Mã SV & Khoa */}
        {userType === 'student' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 animate-in fade-in duration-200">
            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                Mã sinh viên *
              </label>
              <div className="relative flex items-center">
                <div className="pointer-events-none absolute left-3.5 text-slate-400">
                  <IdCard size={18} strokeWidth={2} />
                </div>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                  placeholder="DTC215..."
                  required={userType === 'student'}
                  className="w-full rounded-2xl border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/40 py-2.5 pl-11 pr-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#005A36] focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-[#005A36]/15"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                Khoa / Viện
              </label>
              <select
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/40 py-2.5 px-3.5 text-sm font-semibold text-slate-900 dark:text-white outline-none transition-all focus:border-[#005A36] focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-[#005A36]/15"
              >
                <option value="Công nghệ Thông tin">Công nghệ Thông tin</option>
                <option value="Điện tử Viễn thông">Điện tử Viễn thông</option>
                <option value="Công nghệ Tự động hóa">Công nghệ Tự động hóa</option>
                <option value="Kinh tế & Quản trị số">Kinh tế & Quản trị số</option>
                <option value="Truyền thông Đa phương tiện">Truyền thông Đa phương tiện</option>
              </select>
            </div>
          </div>
        )}

        {/* Email & Số điện thoại */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
              Email *
            </label>
            <div className="relative flex items-center">
              <div className="pointer-events-none absolute left-3.5 text-slate-400">
                <Mail size={18} strokeWidth={2} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={userType === 'student' ? 'sv@ictu.edu.vn' : 'ban@gmail.com'}
                required
                className="w-full rounded-2xl border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/40 py-2.5 pl-11 pr-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#005A36] focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-[#005A36]/15"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
              Số điện thoại *
            </label>
            <div className="relative flex items-center">
              <div className="pointer-events-none absolute left-3.5 text-slate-400">
                <Phone size={18} strokeWidth={2} />
              </div>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0981 234 567"
                required
                className="w-full rounded-2xl border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/40 py-2.5 pl-11 pr-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#005A36] focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-[#005A36]/15"
              />
            </div>
          </div>
        </div>

        {/* Mật khẩu & Xác nhận */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
              Mật khẩu *
            </label>
            <div className="relative flex items-center">
              <div className="pointer-events-none absolute left-3.5 text-slate-400">
                <Lock size={18} strokeWidth={2} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                required
                className="w-full rounded-2xl border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/40 py-2.5 pl-11 pr-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#005A36] focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-[#005A36]/15"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
              Nhập lại mật khẩu *
            </label>
            <div className="relative flex items-center">
              <div className="pointer-events-none absolute left-3.5 text-slate-400">
                <Lock size={18} strokeWidth={2} />
              </div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Khớp với mật khẩu"
                required
                className="w-full rounded-2xl border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/40 py-2.5 pl-11 pr-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#005A36] focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-[#005A36]/15"
              />
            </div>
          </div>
        </div>

        {/* Tùy chọn ảnh thẻ sinh viên */}
        {userType === 'student' && (
          <div className="rounded-2xl border border-dashed border-emerald-300/80 dark:border-emerald-600/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Ảnh thẻ sinh viên / CCCD (Tùy chọn)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Dùng để xác thực tự động trợ giá vé tháng 50%
                </p>
              </div>
              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-white dark:bg-card px-3 py-1.5 text-xs font-bold text-[#005A36] dark:text-emerald-400 shadow-xs border border-emerald-200 hover:bg-emerald-50">
                <Upload size={14} />
                <span>Chọn ảnh</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
            {studentCardPreview && (
              <div className="mt-2.5 relative w-32 h-20 rounded-xl overflow-hidden border border-emerald-300">
                <img
                  src={studentCardPreview}
                  alt="Ảnh thẻ SV"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        )}

        {/* Điều khoản */}
        <label className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            className="size-4 rounded-md border-slate-300 text-[#005A36] focus:ring-[#005A36]"
          />
          <span>
            Tôi đồng ý với{' '}
            <span className="font-bold text-[#005A36] dark:text-emerald-400 hover:underline">
              Điều khoản vận chuyển & Quy định bảo mật
            </span>{' '}
            ICTU Transit
          </span>
        </label>

        {/* Nút Submit */}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#005A36] py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-950/25 transition-all hover:bg-[#004529] hover:shadow-xl active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <span>Đang khởi tạo tài khoản...</span>
          ) : (
            <>
              <span>Hoàn Tất Đăng Ký</span>
              <ArrowRight size={18} strokeWidth={2.5} />
            </>
          )}
        </button>
      </form>

      {/* Footer Switcher */}
      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-border/60 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>
          Đã có tài khoản ICTU Transit?{' '}
          <Link
            href="/login"
            className="font-black text-[#005A36] dark:text-emerald-400 hover:underline"
          >
            Đăng nhập ngay →
          </Link>
        </p>
      </div>
    </div>
  )
}
