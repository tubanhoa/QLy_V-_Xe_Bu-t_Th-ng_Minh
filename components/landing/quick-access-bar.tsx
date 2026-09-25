'use client'

import {
  CalendarCheck,
  GraduationCap,
  Megaphone,
  QrCode,
  Route,
  Search,
  Sparkles,
  Star,
  Ticket,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickAccessBarProps {
  onOpenSeatPicker: () => void
  onOpenModal: (modal: 'routes' | 'news' | 'student-pass' | 'lookup') => void
}

export function QuickAccessBar({ onOpenSeatPicker, onOpenModal }: QuickAccessBarProps) {
  const items = [
    {
      id: 'suggest',
      icon: Star,
      label: 'Gợi ý tuyến xe',
      badge: 'Gợi ý',
      onClick: () => onOpenModal('routes'),
    },
    {
      id: 'news',
      icon: Megaphone,
      label: 'Tin tức & Lịch xe',
      badge: null,
      onClick: () => onOpenModal('news'),
    },
    {
      id: 'student-pass',
      icon: GraduationCap,
      label: 'Đăng ký vé tháng',
      badge: 'Giảm 50%',
      onClick: () => onOpenModal('student-pass'),
    },
    {
      id: 'buy-ticket',
      icon: Ticket,
      label: 'Mua vé lượt 28 chỗ',
      badge: 'Trực quan',
      onClick: onOpenSeatPicker,
    },
    {
      id: 'tracking',
      icon: Search,
      label: 'Tra cứu & Vé đã mua',
      badge: null,
      onClick: () => onOpenModal('lookup'),
    },
  ]

  return (
    <section aria-label="Thanh truy cập nhanh" className="relative z-20 shrink-0 px-4 sm:px-6 lg:px-8 pb-3 sm:pb-4 select-none">
      <div className="mx-auto max-w-5xl">
        {/* User's Exact Glassmorphism Specification Container */}
        <div className="animate-hero-4 glass-card !w-auto !h-auto !rounded-[24px] sm:!rounded-[30px] p-2 sm:p-2.5">
          <div className="grid grid-cols-5 gap-1.5 sm:gap-3 items-center">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className="group relative flex flex-col items-center justify-center rounded-2xl sm:rounded-3xl py-2 px-1 text-center transition-all duration-200 hover:bg-white/30 hover:-translate-y-1 active:scale-95"
                >
                  {/* Standardized Floating Pill Badge with Micro-pulse */}
                  {item.badge && (
                    <span className="absolute -top-2 rounded-full bg-[#005A36] px-2.5 py-0.5 text-[9px] font-black text-white shadow-xs ring-1 ring-white/90">
                      {item.badge}
                    </span>
                  )}

                  {/* Standardized Icon Circle: 10% primary background + primary icon */}
                  <div className="flex size-11 sm:size-12 items-center justify-center rounded-2xl bg-[#005A36]/10 text-[#005A36] border border-[#005A36]/15 backdrop-blur-sm transition-all duration-300 group-hover:bg-[#005A36] group-hover:text-white group-hover:scale-110 group-hover:shadow-md shadow-xs">
                    <Icon size={20} strokeWidth={2.2} />
                  </div>

                  {/* High Contrast Crystal Clear Label */}
                  <span className="mt-1.5 text-xs sm:text-[13px] font-extrabold text-slate-900 group-hover:text-[#005A36] transition-colors truncate max-w-full drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)] group-hover:-translate-y-0.5">
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
