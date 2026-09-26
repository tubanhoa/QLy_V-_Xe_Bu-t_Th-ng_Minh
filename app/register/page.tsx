import type { Metadata } from 'next'
import { BrandMark } from '@/components/brand-mark'
import { RegisterForm } from '@/components/auth/register-form'
import { LoginShowcase } from '@/components/login/login-showcase'

export const metadata: Metadata = {
  title: 'Đăng ký tài khoản | ICTU Smart Transit Portal',
  description: 'Đăng ký tài khoản hành khách hoặc sinh viên ICTU để nhận trợ giá 50% vé tháng xe buýt thông minh.',
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row bg-[#F4F7F6] dark:bg-[#0A131C]">
      {/* Visual Brand Showcase */}
      <LoginShowcase />

      {/* Mobile Top Header */}
      <header className="relative flex items-center gap-3 overflow-hidden bg-gradient-to-r from-[#0A131C] to-[#042828] px-5 py-4 text-white lg:hidden">
        <BrandMark size="sm" pulse />
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-bold tracking-wide">ICTU SMART TRANSIT</p>
          <p className="truncate text-xs text-white/55">Hệ thống điều hành xe buýt công nghệ số</p>
        </div>
      </header>

      {/* Main Register Form Container */}
      <main className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:w-[45%]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,168,107,0.10),transparent_60%)]"
        />
        <RegisterForm />
      </main>
    </div>
  )
}
