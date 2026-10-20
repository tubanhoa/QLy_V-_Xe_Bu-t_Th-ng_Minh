'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  Bell,
  ChevronDown,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PhoneCall,
  ShieldCheck,
  Ticket,
  X,
} from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { haptic } from '@/lib/utils/haptics'

interface MainHeaderProps {
  onOpenSeatPicker?: () => void
  onOpenModal?: (modal: 'routes' | 'news' | 'student-pass' | 'lookup') => void
  onOpenTicketModal?: () => void
  onOpenMonthlyPassModal?: () => void
  onOpenPriorityVerificationModal?: () => void
  onOpenNotificationCenter?: () => void
  unreadCount?: number
}

export function MainHeader({
  onOpenSeatPicker,
  onOpenModal,
  onOpenTicketModal,
  onOpenMonthlyPassModal,
  onOpenPriorityVerificationModal,
  onOpenNotificationCenter,
  unreadCount = 0,
}: MainHeaderProps) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { user, isAuthenticated, logout, role } = useAuth()

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
      {/* ===================================================================
          DESKTOP HEADER (>= lg): 100.00% EXACT BASELINE GEOMETRY & STYLING
          =================================================================== */}
      <div className="hidden lg:flex mx-auto h-[72px] max-w-7xl items-center justify-between gap-4 px-6 lg:px-8 safe-top">
        {/* Brand Logo - Forest Green */}
        <Link href="/" className="flex items-center gap-3.5 group touch-press" aria-label="ICTU Transit - Trang chủ">
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
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-extrabold text-slate-900 whitespace-nowrap transition-colors hover:text-[#005A36] hover:bg-white/40"
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
                  <Link href="/thong-tin-dich-vu#routes" className="block rounded-xl p-2.5 hover:bg-slate-50 text-xs font-bold text-slate-700">
                    Tuyến CT-01 Nội Thành (KTX ICTU ➔ Bến xe)
                  </Link>
                  <Link href="/thong-tin-dich-vu#routes" className="block rounded-xl p-2.5 hover:bg-slate-50 text-xs font-bold text-slate-700">
                    Tuyến CT-02 Campus Loop (Liên trường ĐH)
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Menu 2: Vé & Tiện ích */}
          <div className="group relative">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-extrabold text-slate-900 whitespace-nowrap transition-colors hover:text-[#005A36] hover:bg-white/40"
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
                    if (onOpenPriorityVerificationModal) {
                      onOpenPriorityVerificationModal()
                    } else {
                      window.location.href = '/?openVerification=true'
                    }
                  }}
                  className="w-full text-left rounded-xl p-3 hover:bg-emerald-50 transition-colors block cursor-pointer"
                  id="desktop-nav-priority-verification"
                >
                  <div className="flex items-center justify-between">
                    <span className="block text-sm font-black text-slate-900">Xác thực ưu đãi HSSV / Cao tuổi</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-[#005A36]">Giảm 50-60%</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-600">Nộp thẻ SV / CCCD để kích hoạt trợ giá vé xe buýt</p>
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
                </button>
                <Link
                  href="/tra-cuu-hoa-don"
                  className="w-full text-left rounded-xl p-3 hover:bg-emerald-50 transition-colors block cursor-pointer"
                  id="desktop-nav-invoice-lookup"
                >
                  <div className="flex items-center justify-between">
                    <span className="block text-sm font-black text-slate-900">Tra cứu hóa đơn điện tử</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-[#005A36]">VAT 8%</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-600">Tra cứu, xác thực chữ ký số & tải PDF hóa đơn theo NĐ 123</p>
                </Link>
              </div>
            </div>
          </div>

          {/* Menu 3: Liên hệ & Hỗ trợ */}
          <div className="group relative">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-extrabold text-slate-900 whitespace-nowrap transition-colors hover:text-[#005A36] hover:bg-white/40"
            >
              Liên hệ & Hỗ trợ
              <ChevronDown size={15} strokeWidth={2.5} className="text-slate-500 transition-transform group-hover:rotate-180" />
            </button>
            <div className="invisible absolute left-0 top-full pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
              <div className="w-80 rounded-2xl border border-white/80 bg-white/95 p-2.5 shadow-2xl shadow-slate-900/15 backdrop-blur-md">
                <Link href="/thong-tin-dich-vu#contact" className="block rounded-xl p-3 hover:bg-emerald-50 transition-colors">
                  <span className="block text-sm font-black text-slate-900">Hotline hỗ trợ 24/7</span>
                  <p className="mt-1 text-xs font-medium text-slate-600">Giải đáp thắc mắc lộ trình, sự cố bỏ quên đồ</p>
                </Link>
                <Link href="/thong-tin-dich-vu#geofencing" className="block rounded-xl p-3 hover:bg-emerald-50 transition-colors">
                  <span className="block text-sm font-black text-slate-900">Hệ thống trạm dừng</span>
                  <p className="mt-1 text-xs font-medium text-slate-600">Bản đồ điểm đón trả khách xung quanh trường</p>
                </Link>
              </div>
            </div>
          </div>

          {/* Non-dropdown: Giao dịch an toàn */}
          <Link
            href="/thong-tin-dich-vu#safety"
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-extrabold text-slate-900 visited:text-slate-900 whitespace-nowrap transition-colors hover:text-[#005A36] hover:bg-white/40"
          >
            Giao dịch an toàn
          </Link>

          {/* Insurance / Certification - Transparent outline badge linking to policy */}
          <Link
            href="/thong-tin-dich-vu#insurance"
            className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-[#005A36]/40 bg-transparent px-3 py-1 text-xs font-bold text-[#005A36] whitespace-nowrap transition-colors hover:bg-[#005A36]/10"
          >
            <ShieldCheck size={14} strokeWidth={2.2} className="text-[#005A36]" />
            Bảo hiểm hành khách
          </Link>
        </nav>

        {/* Right CTA - Dynamic auth state */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Smart Notification Bell */}
          <button
            type="button"
            onClick={() => {
              haptic.play('tap')
              onOpenNotificationCenter?.()
            }}
            aria-label="Xem thông báo chuyến xe"
            className="relative inline-flex size-9 sm:size-10 items-center justify-center rounded-xl border border-slate-200/90 bg-white/90 text-slate-700 hover:text-[#005A36] hover:border-emerald-400 hover:bg-emerald-50 transition-all cursor-pointer shadow-xs group touch-press"
            id="btn-header-notification-bell"
          >
            <Bell size={18} strokeWidth={2.2} className="group-hover:rotate-12 transition-transform text-slate-700 group-hover:text-[#005A36]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-2 ring-white animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

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
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-900 truncate max-w-[130px]">
                        {user.fullName || user.name}
                      </span>
                      {user.verificationStatus === 'verified' && (
                        <span
                          title={user.priorityCategory === 'elderly' ? 'Ưu đãi người cao tuổi (-60%)' : 'Ưu đãi sinh viên (-50%)'}
                          className="inline-flex items-center text-[#005A36]"
                        >
                          <ShieldCheck size={13} className="text-[#005A36] shrink-0" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {user.verificationStatus === 'verified' ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded-md">
                          {user.priorityCategory === 'elderly' ? 'Ưu đãi -60%' : 'Ưu đãi HSSV -50%'}
                        </span>
                      ) : user.verificationStatus === 'pending' ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.2 rounded-md">
                          Chờ duyệt ưu đãi
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700">
                          {user.studentId ? `SV: ${user.studentId}` : user.roleTitle || 'Hành khách'}
                        </span>
                      )}
                    </div>
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

          {/* Mobile Menu Button - Baseline had xl:hidden */}
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

      {/* ===================================================================
          MOBILE HEADER (< lg): REFINED ACCORDING TO REQUIREMENT A
          Height ~56px, 1 tier, only logo + bell + avatar button (0% overflow)
          =================================================================== */}
      <div className="flex lg:hidden mx-auto h-14 max-w-7xl items-center justify-between gap-3 px-3.5 safe-top">
        {/* Brand Logo - Compact, no tagline */}
        <Link href="/" className="flex items-center gap-2.5 group touch-press" aria-label="ICTU Transit - Trang chủ">
          <BrandMark size="sm" />
          <span className="text-[17px] font-black tracking-tight text-[#005A36] group-hover:text-emerald-800 transition-colors drop-shadow-sm">
            ICTU <span className="text-[#005A36]">TRANSIT</span>
          </span>
        </Link>

        {/* Right CTA: Bell + Avatar / Login */}
        <div className="flex items-center gap-2">
          {/* Bell button */}
          <button
            type="button"
            onClick={() => {
              haptic.play('tap')
              onOpenNotificationCenter?.()
            }}
            aria-label="Xem thông báo chuyến xe"
            className="relative inline-flex size-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white/90 text-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Bell size={18} strokeWidth={2.2} className="text-slate-700" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-2 ring-white animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Avatar button opening mobile drawer */}
          {isAuthenticated && user ? (
            <button
              type="button"
              id="mobile-drawer-trigger"
              onClick={() => setOpen(true)}
              aria-label="Mở menu tài khoản"
              className="flex size-9 items-center justify-center rounded-xl bg-[#005A36] text-white font-black text-xs shadow-xs border border-emerald-400/80 active:scale-95 transition-transform cursor-pointer"
            >
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </button>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex items-center gap-1 rounded-xl bg-[#005A36] text-white font-bold px-2.5 py-1.5 text-xs shadow-xs active:scale-95"
              >
                <LogIn size={14} strokeWidth={2.5} />
                <span>Đăng nhập</span>
              </Link>
              <button
                type="button"
                id="mobile-drawer-trigger"
                onClick={() => setOpen(true)}
                aria-label="Mở menu"
                className="inline-flex size-9 items-center justify-center rounded-xl text-slate-800 transition-colors hover:bg-white/60 cursor-pointer"
              >
                <Menu size={22} strokeWidth={2.2} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile Drawer (Accessible from mobile avatar or menu) */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <div
          className={cn(
            'fixed inset-y-0 right-0 w-full max-w-[320px] sm:max-w-sm bg-white shadow-2xl transition-transform duration-300 ease-out flex flex-col overflow-hidden z-50',
            open ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          {/* Drawer Header (Fixed at top) */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 shrink-0 bg-white">
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
              <BrandMark size="sm" />
              <span className="font-black text-[#005A36] text-base tracking-tight">ICTU TRANSIT</span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex size-9 items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Drawer Scrollable Content */}
          <div className="flex-1 overflow-y-auto scroll-touch p-4 space-y-4">
            {/* User Profile Card or Login CTA */}
            {isAuthenticated && user ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-[#005A36] text-white font-black text-sm shadow-xs">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-sm text-slate-900 truncate">{user.fullName || user.name}</p>
                    <p className="text-[11px] font-bold text-emerald-800 truncate">
                      {user.studentId ? `Mã SV: ${user.studentId}` : user.roleTitle || 'Hành khách'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-emerald-200/60">
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
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#005A36] py-2 text-xs font-bold text-white shadow-xs cursor-pointer active:scale-95 transition-transform"
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
                    className="rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 active:scale-95 transition-all cursor-pointer"
                  >
                    Đăng xuất
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl btn-vcb-solid py-3 text-sm font-black text-white shadow-md active:scale-95 transition-transform"
                style={{ backgroundColor: '#005a36', color: '#ffffff' }}
              >
                <LogIn size={18} strokeWidth={2.5} />
                <span>Đăng nhập tài khoản</span>
              </Link>
            )}

            {/* Quick Purchase Button */}
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onOpenSeatPicker?.()
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#005A36] bg-emerald-50/50 py-2.5 text-sm font-black text-[#005A36] shadow-xs transition-all hover:bg-[#005A36]/10 active:scale-95 cursor-pointer"
            >
              <Ticket size={16} />
              <span>Mua vé xe lượt 28 chỗ</span>
            </button>

            {/* Navigation List */}
            <div className="flex flex-col divide-y divide-slate-100 text-sm font-bold text-slate-800 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onOpenNotificationCenter?.()
                }}
                className="py-3 text-left w-full hover:text-[#005A36] transition-colors cursor-pointer flex items-center justify-between"
                id="mobile-nav-notifications"
              >
                <div className="flex items-center gap-2.5">
                  <Bell size={16} className="text-[#005A36]" />
                  <span>Thông báo & Cảnh báo xe</span>
                </div>
                {unreadCount > 0 && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <Link href="/thong-tin-dich-vu#routes" onClick={() => setOpen(false)} className="py-3 hover:text-[#005A36] transition-colors block">
                Tuyến xe & Lịch trình
              </Link>
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
                className="py-3 text-left w-full hover:text-[#005A36] transition-colors cursor-pointer block"
                id="mobile-nav-monthly-pass"
              >
                Đăng ký vé tháng HSSV
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  if (onOpenPriorityVerificationModal) {
                    onOpenPriorityVerificationModal()
                  } else {
                    window.location.href = '/?openVerification=true'
                  }
                }}
                className="py-3 text-left w-full hover:text-[#005A36] transition-colors cursor-pointer block"
                id="mobile-nav-priority-verification"
              >
                Xác thực ưu đãi HSSV / Cao tuổi
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  if (onOpenTicketModal) {
                    onOpenTicketModal()
                  } else {
                    onOpenModal?.('lookup')
                  }
                }}
                className="py-3 text-left w-full hover:text-[#005A36] transition-colors cursor-pointer block"
                id="mobile-nav-my-tickets"
              >
                Vé của tôi & Mã QR
              </button>
              <Link href="/tra-cuu-hoa-don" onClick={() => setOpen(false)} className="py-3 hover:text-[#005A36] transition-colors block">
                Tra cứu hóa đơn điện tử
              </Link>
              <Link href="/thong-tin-dich-vu#safety" onClick={() => setOpen(false)} className="py-3 hover:text-[#005A36] transition-colors block">
                Giao dịch an toàn
              </Link>
              <Link href="/thong-tin-dich-vu#insurance" onClick={() => setOpen(false)} className="py-3 hover:text-[#005A36] transition-colors block">
                Bảo hiểm hành khách
              </Link>
              <Link href="/thong-tin-dich-vu#contact" onClick={() => setOpen(false)} className="py-3 hover:text-[#005A36] transition-colors block">
                Liên hệ hỗ trợ 24/7
              </Link>
            </div>
          </div>

          {/* Drawer Fixed Footer */}
          <div className="p-3.5 px-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-bold shrink-0 bg-slate-50/90 pb-[calc(14px+env(safe-area-inset-bottom,0px))]">
            <a href="tel:19008899" className="inline-flex items-center gap-1.5 text-[#005A36] font-extrabold hover:underline">
              <PhoneCall size={14} />
              <span>1900 8899</span>
            </a>
            <span>VI · ICTU Transit</span>
          </div>
        </div>
      </div>
    </header>
  )
}
