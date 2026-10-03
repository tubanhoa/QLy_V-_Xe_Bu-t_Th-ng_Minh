'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Clock, PhoneCall, ShieldCheck, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CONTACT } from '@/lib/landing-data'
import { haptic } from '@/lib/utils/haptics'

interface TopUtilityBarProps {
  onOpenModal?: (modal: 'routes' | 'news' | 'student-pass' | 'lookup') => void
}

export function TopUtilityBar({ onOpenModal }: TopUtilityBarProps) {
  const [lang, setLang] = useState<'VI' | 'EN'>('VI')

  return (
    <div className="hidden border-b border-black/5 bg-transparent text-[13px] text-slate-800 lg:block">
      <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Live Transit Operations Status Ticker */}
        <div className="flex items-center gap-2.5 py-1">
          {/* Signal 1: Live Electric Bus Fleet Status */}
          <div className="flex items-center gap-2 rounded-full bg-white/85 backdrop-blur-md border border-emerald-300/70 px-3 py-0.5 text-xs shadow-2xs">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
            </span>
            <span className="text-slate-600 font-medium text-[11.5px]">Trực tuyến:</span>
            <strong className="text-[#005A36] font-black text-[11.5px]">12/12 xe buýt điện sẵn sàng</strong>
          </div>

          {/* Signal 2: Peak Frequency Schedule */}
          <div className="hidden xl:flex items-center gap-1.5 rounded-full bg-white/60 backdrop-blur-xs px-2.5 py-0.5 text-xs border border-slate-200/60 shadow-2xs">
            <Clock size={12} className="text-[#005A36]" />
            <span className="text-slate-600 font-medium text-[11.5px]">Tần suất:</span>
            <strong className="text-slate-900 font-extrabold text-[11.5px]">10 - 15p/chuyến</strong>
          </div>

          {/* Signal 3: Interactive Student Pass Campaign Ticker */}
          <button
            type="button"
            onClick={() => {
              haptic.play('tap')
              onOpenModal?.('student-pass')
            }}
            className="group flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-200/80 px-2.5 py-0.5 text-xs font-bold text-amber-900 transition-all cursor-pointer active:scale-95 shadow-2xs"
            title="Bấm để đăng ký vé tháng HSSV"
          >
            <Sparkles size={11} className="text-amber-600 animate-pulse" />
            <span className="text-[11.5px]">Vé tháng SV:</span>
            <strong className="text-amber-700 font-black text-[11.5px] group-hover:underline">Trợ giá 50%</strong>
          </button>
        </div>

        {/* Right: Quick Links with Animated Underline Effect on Hover */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
            <Link href="/thong-tin-dich-vu#about" className="group relative py-1 text-slate-700 visited:text-slate-700 transition-colors hover:text-[#005A36]">
              Về ICTU Transit
              <span className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full bg-[#005A36] transition-all duration-300 ease-out group-hover:w-full" />
            </Link>
            <button
              type="button"
              onClick={() => onOpenModal?.('news')}
              className="group relative py-1 text-slate-700 transition-colors hover:text-[#005A36] cursor-pointer"
            >
              Tin tức
              <span className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full bg-[#005A36] transition-all duration-300 ease-out group-hover:w-full" />
            </button>
            <button
              type="button"
              onClick={() => onOpenModal?.('routes')}
              className="group relative py-1 text-slate-700 transition-colors hover:text-[#005A36] cursor-pointer"
            >
              Mạng lưới tuyến
              <span className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full bg-[#005A36] transition-all duration-300 ease-out group-hover:w-full" />
            </button>
            <Link href="/thong-tin-dich-vu#faq" className="group relative py-1 text-slate-700 visited:text-slate-700 transition-colors hover:text-[#005A36]">
              Hỏi đáp & Hướng dẫn
              <span className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full bg-[#005A36] transition-all duration-300 ease-out group-hover:w-full" />
            </Link>
          </div>

          <span className="h-3 w-px bg-slate-300/80" aria-hidden="true" />

          {/* Hotline with Animated Underline */}
          <a
            href={`tel:${CONTACT.hotline.replace(/\s/g, '')}`}
            className="group relative inline-flex items-center gap-1.5 py-1 text-xs transition-colors hover:text-[#005A36]"
          >
            <PhoneCall size={13} strokeWidth={2.2} className="text-[#005A36]" aria-hidden="true" />
            <span className="font-extrabold text-slate-900">{CONTACT.hotline}</span>
            <span className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full bg-[#005A36] transition-all duration-300 ease-out group-hover:w-full" />
          </a>

          <span className="h-3 w-px bg-slate-300/80" aria-hidden="true" />

          {/* Language Switcher with Flag */}
          <div className="flex items-center gap-1.5 text-xs font-extrabold" role="group" aria-label="Ngôn ngữ">
            <span className="inline-flex size-4 items-center justify-center overflow-hidden rounded-full ring-1 ring-slate-300">
              <svg viewBox="0 0 3 2" className="size-full">
                <rect width="3" height="2" fill="#DA251D" />
                <polygon
                  points="1.5,0.4 1.62,0.76 2,0.76 1.69,0.98 1.81,1.34 1.5,1.12 1.19,1.34 1.31,0.98 1,0.76 1.38,0.76"
                  fill="#FFFF00"
                />
              </svg>
            </span>
            {(['VI', 'EN'] as const).map((l, i) => (
              <span key={l} className="flex items-center gap-1">
                {i > 0 && <span className="text-slate-400">/</span>}
                <button
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={cn(
                    'transition-colors',
                    lang === l ? 'font-black text-[#005A36]' : 'font-bold text-slate-600 hover:text-slate-900',
                  )}
                >
                  {l}
                </button>
              </span>
            ))}
          </div>

          {/* Admin Portal Shortcut with transparent outline */}
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#005A36]/40 bg-transparent px-3.5 py-1 text-xs font-extrabold text-[#005A36] shadow-xs transition-all hover:bg-[#005A36]/10 hover:border-[#005A36] active:scale-95"
          >
            <ShieldCheck size={13} strokeWidth={2.2} className="text-[#005A36]" aria-hidden="true" />
            Cổng Điều Hành
          </Link>
        </div>
      </div>
    </div>
  )
}
