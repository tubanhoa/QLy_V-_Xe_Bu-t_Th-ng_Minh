'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ChevronDown,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PhoneCall,
  Route,
  ShieldCheck,
  Sparkles,
  Ticket,
  User,
  X,
  Zap,
} from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { useAuth } from '@/lib/auth-context'
import { ROLE_META } from '@/lib/rbac'
import { cn } from '@/lib/utils'

interface MainHeaderProps {
  onOpenSeatPicker?: () => void
  onOpenModal?: (modal: 'routes' | 'news' | 'student-pass' | 'lookup') => void
  onOpenTicketModal?: () => void
  onOpenMonthlyPassModal?: () => void
}

export function MainHeader({
  onOpenSeatPicker,
  onOpenModal,
  onOpenTicketModal,
  onOpenMonthlyPassModal,
}: MainHeaderProps) {
  const { isAuthenticated, user, role, logout } = useAuth()
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
      <div className="mx-auto flex h-16 sm:h-[72px] max-w-7xl items-center justify-between gap-3 sm:gap-4 px-3.5 sm:px-6 lg:px-8 safe-top">
        {/* Brand Logo - Forest Green */}
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3.5 group touch-press" aria-label="ICTU Transit - Trang chủ">
          <BrandMark size="md" />
          <div className="flex flex-col leading-none">
            <span className="text-[17px] sm:text-[20px] font-black tracking-tight text-[#005A36] group-hover:text-emerald-800 transition-colors drop-shadow-sm">
              ICTU <span className="text-[#005A36]">TRANSIT</span>
            </span>
            <span className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] font-bold text-slate-700">Hệ Thống Xe Buýt Thông Minh</span>
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
                <button
                  type="button"
                  onClick={() => onOpenModal?.('routes')}
                  className="w-full text-left rounded-xl p-3 hover:bg-emerald-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-900">Xem tất cả tuyến buýt ICTU</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-[#005A36]">Trực tiếp</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-600">Lộ trình CT-01, CT-02 & các trạm đón theo thời gian thực</p>
                </button>
                <div className="border-t border-slate-100 my-1 pt-1">
                  <a href="#routes" className="block rounded-xl p-2.5 hover:bg-slate-50 text-xs font-bold text-slate-700">
                    Tuyến CT-01 Nội Thành (KTX ICTU ➔ Bến xe)
                  </a>
                  <a href="#routes" className="block rounded-xl p-2.5 hover:bg-slate-50 text-xs font-bold text-slate-700">
                    Tuyến CT-02 Campus Loop (Liên trường ĐH)
                  </a>
                </div>
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
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenMonthlyPassModal) {
                      onOpenMonthlyPassModal()
                    } else if (onOpenModal) {
                      onOpenModal('student-pass')
                    } else {
                      window.location.href = '/?openMonthlyPass=true'
                    }
                  }}
                  className="w-full text-left rounded-xl p-3 hover:bg-emerald-50 transition-colors block cursor-pointer"
                  id="desktop-nav-monthly-pass"
                >
                  <div className="flex items-center justify-between">
                    <span className="block text-sm font-black text-slate-900">Đăng ký vé tháng HSSV</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-[#005A36]">Cửa sổ nổi</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-600">Đăng ký trực tuyến thẻ tháng sinh viên ICTU</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenTicketModal) {
                      onOpenTicketModal()
                    } else {
                      window.location.href = '/my-tickets'
                    }
                  }}
                  className="w-full text-left rounded-xl p-3 hover:bg-emerald-50 transition-colors block cursor-pointer"
                  id="desktop-nav-my-tickets"
                >
                  <div className="flex items-center justify-between">
                    <span className="block text-sm font-black text-slate-900">Vé của tôi & Mã QR</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-[#005A36]">Cửa sổ nổi</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-600">Xem vé đã mua, quét mã QR, đổi vé & theo dõi xe realtime</p>
                </button>
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
        <div className="flex items-center gap-2.5">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              {role === 'admin' || role === 'dispatcher' || role === 'driver' || role === 'manager' ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-xl btn-vcb-solid text-white font-black px-3.5 py-2 text-xs sm:text-sm shadow-md shadow-emerald-950/20 transition-all duration-150 hover:scale-[1.02] active:scale-95"
                  style={{ backgroundColor: '#005a36', color: '#ffffff' }}
                >
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                  </span>
                  <LayoutDashboard size={16} strokeWidth={2.2} className="text-white" aria-hidden="true" />
                  <span className="text-white font-black">Bảng Điều Hành</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenTicketModal) {
                      onOpenTicketModal()
                    } else {
                      onOpenModal?.('lookup')
                    }
                  }}
                  title="Mở ví vé của tôi & thẻ sinh viên"
                  className="flex items-center gap-2 rounded-xl bg-white/90 border border-emerald-300/80 px-3 py-1.5 shadow-xs backdrop-blur-md hover:bg-emerald-50/80 hover:border-emerald-400 transition-all cursor-pointer text-left group"
                >
                  <div className="flex size-7 items-center justify-center rounded-lg bg-[#005A36] text-white text-xs font-black group-hover:scale-105 transition-transform">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="flex flex-col text-left leading-tight pr-1">
                    <span className="text-xs font-black text-slate-900 truncate max-w-[130px]">
                      {user.fullName || user.name}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700">
                      {user.studentId ? `SV: ${user.studentId}` : user.roleTitle || 'Hành khách'}
                    </span>
                  </div>
                </button>
              )}

              {/* Logout button */}
              <button
                type="button"
                onClick={logout}
                title="Đăng xuất khỏi tài khoản"
                className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-slate-600 hover:text-rose-600 hover:border-rose-200 transition-colors shadow-xs"
              >
                <LogOut size={16} />
              </button>
            </div>
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
            'fixed inset-y-0 right-0 w-full max-w-[320px] sm:max-w-sm bg-white p-5 sm:p-6 shadow-2xl transition-transform duration-300 ease-out flex flex-col justify-between overflow-y-auto scroll-touch safe-top safe-bottom',
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
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-[#005A36] text-white font-bold text-sm">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <p className="font-black text-sm text-slate-900">{user.fullName || user.name}</p>
                    <p className="text-[11px] font-bold text-emerald-800">
                      {user.studentId ? `Mã SV: ${user.studentId}` : user.roleTitle || 'Hành khách'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1 border-t border-emerald-200/60">
                  {role === 'admin' || role === 'dispatcher' || role === 'driver' || role === 'manager' ? (
                    <Link
                      href="/dashboard"
                      onClick={() => setOpen(false)}
                      className="flex-1 text-center rounded-xl bg-[#005A36] py-2 text-xs font-bold text-white shadow-xs"
                    >
                      Bảng điều hành
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        if (onOpenTicketModal) {
                          onOpenTicketModal()
                        } else {
                          window.location.href = '/my-tickets'
                        }
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#005A36] py-2 text-xs font-bold text-white shadow-xs cursor-pointer"
                      id="mobile-my-tickets-link"
                    >
                      <Ticket size={14} />
                      <span>Vé của tôi</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      logout()
                      setOpen(false)
                    }}
                    className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                  >
                    Đăng xuất
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl btn-vcb-solid py-3 text-sm font-black text-white shadow-md"
                  style={{ backgroundColor: '#005a36', color: '#ffffff' }}
                >
                  <LogIn size={18} strokeWidth={2.5} />
                  Đăng nhập tài khoản
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
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onOpenModal?.('routes')
                }}
                className="py-3 text-left w-full hover:text-[#005A36] transition-colors cursor-pointer"
              >
                Mạng lưới tuyến xe buýt ICTU
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  if (onOpenMonthlyPassModal) {
                    onOpenMonthlyPassModal()
                  } else if (onOpenModal) {
                    onOpenModal('student-pass')
                  } else {
                    window.location.href = '/?openMonthlyPass=true'
                  }
                }}
                className="py-3 text-left w-full hover:text-[#005A36] transition-colors cursor-pointer flex items-center justify-between"
                id="mobile-nav-monthly-pass"
              >
                <span>Đăng ký vé tháng HSSV (-50%)</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-[#005A36]">Cửa sổ nổi</span>
              </button>
              <Link
                href="/my-tickets"
                onClick={() => setOpen(false)}
                className="py-3 text-left w-full hover:text-[#005A36] transition-colors block"
                id="mobile-nav-my-tickets"
              >
                Vé của tôi & Mã QR
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onOpenModal?.('news')
                }}
                className="py-3 text-left w-full hover:text-[#005A36] transition-colors cursor-pointer"
              >
                Tin tức & Lịch chạy hôm nay
              </button>
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
