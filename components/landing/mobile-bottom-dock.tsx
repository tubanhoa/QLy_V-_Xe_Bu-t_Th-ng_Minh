'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Compass,
  GraduationCap,
  Home,
  Navigation,
  QrCode,
  Search,
  Ticket,
} from 'lucide-react'
import { haptic } from '@/lib/utils/haptics'
import { cn } from '@/lib/utils'

interface MobileBottomDockProps {
  onOpenTripSearch: () => void
  onOpenMyTickets: () => void
  onOpenMonthlyPass: () => void
  activeTicketsCount?: number
}

type DockTab = 'home' | 'search' | 'tickets' | 'monthly' | 'tracking'

export function MobileBottomDock({
  onOpenTripSearch,
  onOpenMyTickets,
  onOpenMonthlyPass,
  activeTicketsCount = 1,
}: MobileBottomDockProps) {
  const [activeTab, setActiveTab] = useState<DockTab>('home')

  const handleTabClick = (tab: DockTab, action?: () => void) => {
    setActiveTab(tab)
    haptic.play('tap')
    if (action) {
      action()
    }
  }

  return (
    <nav
      aria-label="Thanh điều hướng nhanh ứng dụng di động"
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden pb-[max(env(safe-area-inset-bottom,0px),8px)] pt-1.5 px-3 bg-white/95 backdrop-blur-2xl border-t border-slate-200/90 shadow-[0_-8px_30px_rgba(0,90,54,0.10)] transition-all select-none"
    >
      <div className="flex items-center justify-around gap-1 max-w-md mx-auto">
        {/* 1. Trang chủ */}
        <button
          type="button"
          onClick={() => {
            handleTabClick('home', () => {
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }
            })
          }}
          className={cn(
            'group relative flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all duration-200 min-w-[56px] cursor-pointer touch-press touch-manipulation',
            activeTab === 'home'
              ? 'text-[#005A36]'
              : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {activeTab === 'home' && (
            <span className="absolute -top-1.5 size-1 rounded-full bg-[#005A36]" />
          )}
          <div
            className={cn(
              'flex size-8 items-center justify-center rounded-xl transition-all duration-200',
              activeTab === 'home'
                ? 'bg-[#005A36]/15 scale-110 shadow-xs'
                : 'group-hover:bg-slate-100',
            )}
          >
            <Home size={19} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-extrabold tracking-tight mt-0.5">
            Trang chủ
          </span>
        </button>

        {/* 2. Tìm chuyến */}
        <button
          type="button"
          onClick={() => handleTabClick('search', onOpenTripSearch)}
          className={cn(
            'group relative flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all duration-200 min-w-[56px] cursor-pointer touch-press touch-manipulation',
            activeTab === 'search'
              ? 'text-[#005A36]'
              : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {activeTab === 'search' && (
            <span className="absolute -top-1.5 size-1 rounded-full bg-[#005A36]" />
          )}
          <div
            className={cn(
              'flex size-8 items-center justify-center rounded-xl transition-all duration-200',
              activeTab === 'search'
                ? 'bg-[#005A36]/15 scale-110 shadow-xs'
                : 'group-hover:bg-slate-100',
            )}
          >
            <Search size={19} strokeWidth={activeTab === 'search' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-extrabold tracking-tight mt-0.5">
            Tìm chuyến
          </span>
        </button>

        {/* 3. Vé của tôi (Vé điện tử & QR) */}
        <button
          type="button"
          onClick={() => handleTabClick('tickets', onOpenMyTickets)}
          className={cn(
            'group relative flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all duration-200 min-w-[56px] cursor-pointer touch-press touch-manipulation',
            activeTab === 'tickets'
              ? 'text-[#005A36]'
              : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {/* Active Ticket Notification Badge */}
          {activeTicketsCount > 0 && (
            <span className="absolute -top-1 right-2 flex size-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-black text-white shadow-xs ring-2 ring-white animate-pulse">
              {activeTicketsCount}
            </span>
          )}
          {activeTab === 'tickets' && (
            <span className="absolute -top-1.5 size-1 rounded-full bg-[#005A36]" />
          )}
          <div
            className={cn(
              'flex size-8 items-center justify-center rounded-xl transition-all duration-200',
              activeTab === 'tickets'
                ? 'bg-[#005A36]/15 scale-110 shadow-xs'
                : 'group-hover:bg-slate-100',
            )}
          >
            <Ticket size={19} strokeWidth={activeTab === 'tickets' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-extrabold tracking-tight mt-0.5">
            Vé của tôi
          </span>
        </button>

        {/* 4. Vé tháng SV */}
        <button
          type="button"
          onClick={() => handleTabClick('monthly', onOpenMonthlyPass)}
          className={cn(
            'group relative flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all duration-200 min-w-[56px] cursor-pointer touch-press touch-manipulation',
            activeTab === 'monthly'
              ? 'text-[#005A36]'
              : 'text-slate-500 hover:text-slate-800',
          )}
        >
          <span className="absolute -top-1.5 right-1 rounded-full bg-amber-500 px-1 py-0.2 text-[8px] font-black text-white shadow-2xs">
            -50%
          </span>
          {activeTab === 'monthly' && (
            <span className="absolute -top-1.5 size-1 rounded-full bg-[#005A36]" />
          )}
          <div
            className={cn(
              'flex size-8 items-center justify-center rounded-xl transition-all duration-200',
              activeTab === 'monthly'
                ? 'bg-[#005A36]/15 scale-110 shadow-xs'
                : 'group-hover:bg-slate-100',
            )}
          >
            <GraduationCap size={19} strokeWidth={activeTab === 'monthly' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-extrabold tracking-tight mt-0.5">
            Vé tháng
          </span>
        </button>

        {/* 5. Định vị GPS Tuyến */}
        <Link
          href="/tracking/trip-ct01-default"
          onClick={() => {
            setActiveTab('tracking')
            haptic.play('tap')
          }}
          className={cn(
            'group relative flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all duration-200 min-w-[56px] cursor-pointer touch-press touch-manipulation',
            activeTab === 'tracking'
              ? 'text-[#005A36]'
              : 'text-slate-500 hover:text-slate-800',
          )}
        >
          <span className="absolute -top-0.5 right-2 flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <div
            className={cn(
              'flex size-8 items-center justify-center rounded-xl transition-all duration-200',
              activeTab === 'tracking'
                ? 'bg-[#005A36]/15 scale-110 shadow-xs'
                : 'group-hover:bg-slate-100',
            )}
          >
            <Navigation size={18} strokeWidth={activeTab === 'tracking' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-extrabold tracking-tight mt-0.5">
            Định vị xe
          </span>
        </Link>
      </div>
    </nav>
  )
}
