'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ChevronDown,
  LayoutDashboard,
  LogIn,
  Menu,
  PhoneCall,
  Route,
  ShieldCheck,
  Sparkles,
  Ticket,
  X,
  Zap,
} from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { useAuth } from '@/lib/auth-context'
import { ROLE_META } from '@/lib/rbac'
import { cn } from '@/lib/utils'

interface MainHeaderProps {
  onOpenSeatPicker?: () => void
}

export function MainHeader({ onOpenSeatPicker }: MainHeaderProps) {
  const { isAuthenticated, user, role } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-200',
        scrolled
          ? 'bg-white/70 backdrop-blur-md border-b border-white/40 shadow-sm'
          : 'bg-transparent border-b border-black/5',
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand Logo - Forest Green */}
        <Link href="/" className="flex items-center gap-3.5 group" aria-label="ICTU Transit - Trang chủ">
          <BrandMark size="md" />
          <div className="flex flex-col leading-none">
            <span className="text-[20px] font-black tracking-tight text-[#005A36] group-hover:text-emerald-800 transition-colors drop-shadow-sm">
              ICTU <span className="text-[#005A36]">TRANSIT</span>
            </span>
            <span className="mt-1 text-[11px] font-bold text-slate-700">Hệ Thống Xe Buýt Thông Minh</span>
          </div>
        </Link>

        {/* Center Menus with Chevrons */}
        <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 xl:flex">
          {/* Menu 1: Tuyến xe & Lịch trình */}
          <div className="group relative">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-extrabold text-slate-900 transition-colors hover:text-[#005A36] hover:bg-white/40"
            >
              Tuyến xe & Lịch trình
              <ChevronDown size={15} strokeWidth={2.5} className="text-slate-500 transition-transform group-hover:rotate-180" />
            </button>
            <div className="invisible absolute left-0 top-full pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
              <div className="w-80 rounded-2xl border border-white/80 bg-white/95 p-2.5 shadow-2xl shadow-slate-900/15 backdrop-blur-md">
                <a href="#routes" className="block rounded-xl p-3 hover:bg-emerald-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-900">Tuyến CT-01 Nội Thành</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-[#005A36]">Phổ biến</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-600">KTX ICTU - Bến xe Đồng Quang - Quảng trường</p>
                </a>
                <a href="#routes" className="block rounded-xl p-3 hover:bg-emerald-50 transition-colors">
                  <span className="block text-sm font-black text-slate-900">Tuyến CT-02 Campus Loop</span>
                  <p className="mt-1 text-xs font-medium text-slate-600">Kết nối các giảng đường & Ký túc xá liên trường</p>
                </a>
                <a href="#routes" className="block rounded-xl p-3 hover:bg-emerald-50 transition-colors">
                  <span className="block text-sm font-black text-slate-900">Tuyến CT-03 Xe Buýt Điện</span>
                  <p className="mt-1 text-xs font-medium text-slate-600">Tuyến xanh không phát thải kết nối các viện nghiên cứu</p>
                </a>
              </div>
            </div>
          </div>

          {/* Menu 2: Vé & Tiện ích */}
          <div className="group relative">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-extrabold text-slate-900 transition-colors hover:text-[#005A36] hover:bg-white/40"
            >
              Vé & Tiện ích
              <ChevronDown size={15} strokeWidth={2.5} className="text-slate-500 transition-transform group-hover:rotate-180" />
            </button>
            <div className="invisible absolute left-0 top-full pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
              <div className="w-80 rounded-2xl border border-white/80 bg-white/95 p-2.5 shadow-2xl shadow-slate-900/15 backdrop-blur-md">
                <button
                  type="button"
                  onClick={onOpenSeatPicker}
                  className="w-full text-left rounded-xl p-3 hover:bg-emerald-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-900">Mua vé lượt 28 chỗ</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-[#005A36]">Trực tuyến</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-600">Chọn vị trí ghế trên sơ đồ xe & thanh toán quét QR</p>
                </button>
                <a href="#booking" className="block rounded-xl p-3 hover:bg-emerald-50 transition-colors">
                  <span className="block text-sm font-black text-slate-900">Đăng ký vé tháng HSSV</span>
                  <p className="mt-1 text-xs font-medium text-slate-600">Hưởng mức trợ giá 50% dành cho sinh viên ICTU</p>
                </a>
                <a href="#services" className="block rounded-xl p-3 hover:bg-emerald-50 transition-colors">
                  <span className="block text-sm font-black text-slate-900">Thẻ NFC Sinh Viên</span>
                  <p className="mt-1 text-xs font-medium text-slate-600">Tích hợp thẻ thư viện & vé xe buýt chạm 1 giây</p>
                </a>
              </div>
            </div>
          </div>

          {/* Menu 3: Liên hệ & Hỗ trợ */}
          <div className="group relative">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-extrabold text-slate-900 transition-colors hover:text-[#005A36] hover:bg-white/40"
            >
              Liên hệ & Hỗ trợ
              <ChevronDown size={15} strokeWidth={2.5} className="text-slate-500 transition-transform group-hover:rotate-180" />
            </button>
            <div className="invisible absolute left-0 top-full pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
              <div className="w-80 rounded-2xl border border-white/80 bg-white/95 p-2.5 shadow-2xl shadow-slate-900/15 backdrop-blur-md">
                <a href="#footer" className="block rounded-xl p-3 hover:bg-emerald-50 transition-colors">
                  <span className="block text-sm font-black text-slate-900">Hotline hỗ trợ 24/7</span>
                  <p className="mt-1 text-xs font-medium text-slate-600">Giải đáp thắc mắc lộ trình, sự cố bỏ quên đồ</p>
                </a>
                <a href="#solutions" className="block rounded-xl p-3 hover:bg-emerald-50 transition-colors">
                  <span className="block text-sm font-black text-slate-900">Hệ thống trạm dừng</span>
                  <p className="mt-1 text-xs font-medium text-slate-600">Bản đồ điểm đón trả khách xung quanh trường</p>
                </a>
              </div>
            </div>
          </div>

          {/* Non-dropdown: Giao dịch an toàn */}
          <a
            href="#safety"
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-extrabold text-slate-900 visited:text-slate-900 transition-colors hover:text-[#005A36] hover:bg-white/40"
          >
            Giao dịch an toàn
          </a>

          {/* Insurance / Certification - Transparent outline badge */}
          <span className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-[#005A36]/40 bg-transparent px-3 py-1 text-xs font-bold text-[#005A36] transition-colors hover:bg-[#005A36]/10">
            <ShieldCheck size={14} strokeWidth={2.2} className="text-[#005A36]" />
            Bảo hiểm hành khách
          </span>
        </nav>

        {/* Right CTA - Dynamic auth state */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl btn-vcb-solid text-white font-black px-4 py-2.5 text-xs sm:text-sm shadow-md shadow-emerald-950/20 transition-all duration-150 hover:scale-[1.02] active:scale-95"
              style={{ backgroundColor: '#005a36', color: '#ffffff' }}
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              <LayoutDashboard size={17} strokeWidth={2.2} className="text-white" aria-hidden="true" />
              <span className="text-white font-black">Bảng Điều Hành ({ROLE_META[role]?.shortLabel})</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl btn-vcb-solid text-white font-black px-5 py-2.5 text-sm shadow-md shadow-emerald-950/20 transition-all duration-150 hover:scale-[1.03] hover:shadow-lg active:scale-95"
              style={{ backgroundColor: '#005a36', color: '#ffffff' }}
            >
              <LogIn size={18} strokeWidth={2.5} className="text-white" aria-hidden="true" />
              <span className="text-white font-black">Đăng nhập</span>
            </Link>
          )}

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Mở menu"
            className="inline-flex size-10 items-center justify-center rounded-xl text-slate-800 transition-colors hover:bg-white/60 xl:hidden"
          >
            <Menu size={24} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 xl:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <div
          className={cn(
            'fixed inset-y-0 right-0 w-full max-w-sm bg-white p-6 shadow-2xl transition-transform duration-300 ease-out',
            open ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
              <BrandMark size="sm" />
              <span className="font-black text-[#005A36]">ICTU TRANSIT</span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex size-9 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            {isAuthenticated && user ? (
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl btn-vcb-solid py-3 text-sm font-black text-white shadow-md"
                style={{ backgroundColor: '#005a36', color: '#ffffff' }}
              >
                <LayoutDashboard size={18} strokeWidth={2.2} />
                Vào Bảng Điều Hành ({ROLE_META[role]?.shortLabel})
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl btn-vcb-solid py-3 text-sm font-black text-white shadow-md"
                  style={{ backgroundColor: '#005a36', color: '#ffffff' }}
                >
                  <LogIn size={18} strokeWidth={2.5} />
                  Đăng nhập tài khoản HSSV
                </Link>

                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#005A36]/40 bg-emerald-50/50 py-2.5 text-xs font-black text-[#005A36] shadow-xs"
                >
                  <ShieldCheck size={16} strokeWidth={2.2} />
                  Cổng Điều Hành (Nội bộ)
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onOpenSeatPicker?.()
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#005A36] bg-transparent py-3 text-sm font-black text-[#005A36] shadow-xs transition-all hover:bg-[#005A36]/10 active:scale-95"
            >
              <Ticket size={18} />
              Mua vé xe lượt 28 chỗ
            </button>

            <div className="mt-4 flex flex-col divide-y divide-slate-100 text-sm font-bold text-slate-800">
              <a href="#routes" onClick={() => setOpen(false)} className="py-3">
                Tuyến xe & Lịch trình
              </a>
              <a href="#booking" onClick={() => setOpen(false)} className="py-3">
                Đăng ký vé tháng HSSV
              </a>
              <a href="#solutions" onClick={() => setOpen(false)} className="py-3">
                Mạng lưới trạm dừng & GPS
              </a>
              <a href="#news" onClick={() => setOpen(false)} className="py-3">
                Tin tức & Ưu đãi
              </a>
              <a href="#footer" onClick={() => setOpen(false)} className="py-3">
                Liên hệ hỗ trợ 24/7
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
