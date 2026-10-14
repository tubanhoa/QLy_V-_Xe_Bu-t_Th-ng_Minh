'use client'

import {
  CalendarCheck,
  Compass,
  Gift,
  GraduationCap,
  Megaphone,
  QrCode,
  Search,
  Sparkles,
  Ticket,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/utils/haptics'

interface QuickAccessBarProps {
  onOpenSeatPicker: () => void
  onOpenModal: (modal: 'routes' | 'news' | 'student-pass' | 'lookup') => void
  onOpenTicketModal?: () => void
  onOpenVoucherVault?: () => void
}

export function QuickAccessBar({
  onOpenSeatPicker,
  onOpenModal,
  onOpenTicketModal,
  onOpenVoucherVault,
}: QuickAccessBarProps) {
  const items = [
    {
      id: 'suggest',
      icon: Compass,
      label: 'Gợi ý tuyến xe',
      sublabel: 'Lộ trình tối ưu',
      badge: 'Đề xuất',
      badgeColor: 'bg-emerald-600 text-white',
      onClick: () => onOpenModal('routes'),
    },
    {
      id: 'vouchers',
      icon: Gift,
      label: 'Kho Voucher',
      sublabel: 'Ưu đãi & Khuyến mãi',
      badge: 'HOT',
      badgeColor: 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-rose-500/20',
      onClick: () => {
        if (onOpenVoucherVault) {
          onOpenVoucherVault()
        } else {
          onOpenModal('news')
        }
      },
    },
    {
      id: 'student-pass',
      icon: GraduationCap,
      label: 'Đăng ký vé tháng',
      sublabel: 'Trợ giá sinh viên',
      badge: '-50% HSSV',
      badgeColor: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/20',
      onClick: () => onOpenModal('student-pass'),
    },
    {
      id: 'buy-ticket',
      icon: Ticket,
      label: 'Mua vé lượt 28 chỗ',
      sublabel: 'Sơ đồ trực quan',
      badge: 'Trực quan',
      badgeColor: 'bg-[#005A36] text-white',
      onClick: onOpenSeatPicker,
    },
    {
      id: 'tracking',
      icon: QrCode,
      label: 'Tra cứu & Vé đã mua',
      sublabel: 'Quản lý vé & QR Code',
      badge: null,
      badgeColor: '',
      onClick: () => {
        if (onOpenTicketModal) {
          onOpenTicketModal()
        } else {
          onOpenModal('lookup')
        }
      },
    },
  ]

  return (
    <section
      aria-label="Thanh truy cập nhanh"
      className="hidden md:block relative z-20 shrink-0 px-4 sm:px-6 lg:px-8 pb-3 sm:pb-4 select-none"
    >
      <div className="mx-auto max-w-5xl">
        {/* Apple VisionOS & macOS Liquid Glassmorphism Dock */}
        <div className="animate-hero-4 dock-glass-liquid p-2.5 sm:p-3 shadow-2xl">
          <div className="grid grid-cols-5 gap-2.5 lg:gap-3.5 items-stretch">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    haptic.play('tap')
                    item.onClick()
                  }}
                  className="group relative flex flex-col items-center justify-between rounded-2xl py-2.5 px-2 text-center dock-tile-glass cursor-pointer touch-press touch-manipulation min-h-[96px]"
                >
                  {/* Floating Pill Badge with Micro Glow */}
                  {item.badge && (
                    <span
                      className={cn(
                        'absolute -top-2.5 z-10 rounded-full px-2.5 py-0.5 text-[9px] font-black tracking-tight shadow-md ring-1 ring-white/95 transition-transform duration-200 group-hover:scale-105',
                        item.badgeColor,
                      )}
                    >
                      {item.badge}
                    </span>
                  )}

                  {/* Icon Staging Container: Subtle Gradient Frosted Pill */}
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-b from-white/90 to-emerald-50/70 text-[#005A36] border border-emerald-200/50 shadow-xs transition-all duration-300 group-hover:bg-[#005A36] group-hover:text-white group-hover:scale-110 group-hover:shadow-md group-hover:shadow-[#005A36]/25 mt-0.5">
                    <Icon size={20} strokeWidth={2.3} className="transition-transform duration-300 group-hover:scale-105" />
                  </div>

                  {/* Clean Typography Hierarchy: No blurry text shadows */}
                  <div className="w-full mt-1.5 flex flex-col items-center">
                    <span className="text-[12.5px] font-black text-slate-800 group-hover:text-[#005A36] transition-colors line-clamp-1 leading-tight tracking-tight">
                      {item.label}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-700 mt-0.5 line-clamp-1 group-hover:text-slate-900 transition-colors">
                      {item.sublabel}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

