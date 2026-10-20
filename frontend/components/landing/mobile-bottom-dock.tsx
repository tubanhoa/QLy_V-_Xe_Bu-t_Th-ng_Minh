'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Compass,
  GraduationCap,
  Home,
  Navigation,
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
      className="fixed z-40 lg:hidden left-3 right-3 max-w-md mx-auto bottom-[calc(12px+env(safe-area-inset-bottom,0px))] rounded-[28px] bg-white/85 backdrop-blur-xl saturate-150 border border-white/80 shadow-[0_12px_36px_rgba(0,0,0,0.12),inset_0_1px_1px_rgba(255,255,255,0.95)] px-2 py-1.5 select-none transition-all"
    >
      <div className="grid grid-cols-5 gap-1 items-center">
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
            'group relative flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 px-1 rounded-2xl transition-all duration-200 cursor-pointer touch-press touch-manipulation',
            activeTab === 'home'
              ? 'bg-[#005A36]/10 text-[#005A36] border border-[#005A36]/15 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 border border-transparent',
          )}
        >
          {activeTab === 'home' && (
            <span className="absolute -top-1 size-1 rounded-full bg-[#005A36]" />
          )}
          <div className="flex size-7 items-center justify-center rounded-xl transition-all duration-200">
            <Home size={22} strokeWidth={activeTab === 'home' ? 2.4 : 2} />
          </div>
          <span className="text-[11px] font-bold tracking-tight mt-0.5 leading-none">
            Trang chủ
          </span>
        </button>

        {/* 2. Tìm chuyến */}
        <button
          type="button"
          onClick={() => handleTabClick('search', onOpenTripSearch)}
          className={cn(
            'group relative flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 px-1 rounded-2xl transition-all duration-200 cursor-pointer touch-press touch-manipulation',
            activeTab === 'search'
              ? 'bg-[#005A36]/10 text-[#005A36] border border-[#005A36]/15 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 border border-transparent',
          )}
        >
          {activeTab === 'search' && (
            <span className="absolute -top-1 size-1 rounded-full bg-[#005A36]" />
          )}
          <div className="flex size-7 items-center justify-center rounded-xl transition-all duration-200">
            <Search size={22} strokeWidth={activeTab === 'search' ? 2.4 : 2} />
          </div>
          <span className="text-[11px] font-bold tracking-tight mt-0.5 leading-none">
            Tìm chuyến
          </span>
        </button>

        {/* 3. Vé của tôi (Vé điện tử & QR) */}
        <button
          type="button"
          onClick={() => handleTabClick('tickets', onOpenMyTickets)}
          className={cn(
            'group relative flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 px-1 rounded-2xl transition-all duration-200 cursor-pointer touch-press touch-manipulation',
            activeTab === 'tickets'
              ? 'bg-[#005A36]/10 text-[#005A36] border border-[#005A36]/15 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 border border-transparent',
          )}
        >
          {/* Active Ticket Notification Badge */}
          {activeTicketsCount > 0 && (
            <span className="absolute -top-1 right-1.5 flex size-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-black text-white shadow-xs ring-2 ring-white animate-pulse">
              {activeTicketsCount}
            </span>
          )}
          {activeTab === 'tickets' && (
            <span className="absolute -top-1 size-1 rounded-full bg-[#005A36]" />
          )}
          <div className="flex size-7 items-center justify-center rounded-xl transition-all duration-200">
            <Ticket size={22} strokeWidth={activeTab === 'tickets' ? 2.4 : 2} />
          </div>
          <span className="text-[11px] font-bold tracking-tight mt-0.5 leading-none">
            Vé của tôi
          </span>
        </button>

        {/* 4. Vé tháng SV */}
        <button
          type="button"
          onClick={() => handleTabClick('monthly', onOpenMonthlyPass)}
          className={cn(
            'group relative flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 px-1 rounded-2xl transition-all duration-200 cursor-pointer touch-press touch-manipulation',
            activeTab === 'monthly'
              ? 'bg-[#005A36]/10 text-[#005A36] border border-[#005A36]/15 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 border border-transparent',
          )}
        >
          <span className="absolute -top-1.5 right-1 rounded-full bg-amber-500 px-1 py-0.2 text-[8px] font-black text-white shadow-2xs">
            -50%
          </span>
          {activeTab === 'monthly' && (
            <span className="absolute -top-1 size-1 rounded-full bg-[#005A36]" />
          )}
          <div className="flex size-7 items-center justify-center rounded-xl transition-all duration-200">
            <GraduationCap size={22} strokeWidth={activeTab === 'monthly' ? 2.4 : 2} />
          </div>
          <span className="text-[11px] font-bold tracking-tight mt-0.5 leading-none">
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
            'group relative flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 px-1 rounded-2xl transition-all duration-200 cursor-pointer touch-press touch-manipulation',
            activeTab === 'tracking'
              ? 'bg-[#005A36]/10 text-[#005A36] border border-[#005A36]/15 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 border border-transparent',
          )}
        >
          <span className="absolute -top-0.5 right-2 flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <div className="flex size-7 items-center justify-center rounded-xl transition-all duration-200">
            <Navigation size={21} strokeWidth={activeTab === 'tracking' ? 2.4 : 2} />
          </div>
          <span className="text-[11px] font-bold tracking-tight mt-0.5 leading-none">
            Định vị xe
          </span>
        </Link>
      </div>
    </nav>
  )
}
