'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PhoneCall, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CONTACT } from '@/lib/landing-data'

const AUDIENCES = [
  { id: 'personal', label: 'Cá nhân (HSSV & Cán bộ)' },
  { id: 'business', label: 'Tổ chức & Doanh nghiệp' },
  { id: 'priority', label: 'Khách hàng Ưu tiên' },
]

export function TopUtilityBar() {
  const [audience, setAudience] = useState(AUDIENCES[0].id)
  const [lang, setLang] = useState<'VI' | 'EN'>('VI')

  return (
    <div className="hidden border-b border-black/5 bg-transparent text-[13px] text-slate-800 lg:block">
      <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Tab Switcher with floating white pill active state */}
        <nav aria-label="Phân loại hành khách" className="flex items-center gap-1 py-1">
          {AUDIENCES.map((a) => {
            const active = a.id === audience
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAudience(a.id)}
                aria-pressed={active}
                className={cn(
                  'rounded-full px-4 py-1 text-xs transition-all duration-200',
                  active
                    ? 'bg-white/90 backdrop-blur-md font-extrabold text-[#005A36] shadow-sm ring-1 ring-black/10'
                    : 'font-bold text-slate-700 hover:text-[#005A36]',
                )}
              >
                {a.label}
              </button>
            )
          })}
        </nav>

        {/* Right: Quick Links with Animated Underline Effect on Hover */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
            <a href="#about" className="group relative py-1 text-slate-700 visited:text-slate-700 transition-colors hover:text-[#005A36]">
              Về ICTU Transit
              <span className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full bg-[#005A36] transition-all duration-300 ease-out group-hover:w-full" />
            </a>
            <a href="#news" className="group relative py-1 text-slate-700 visited:text-slate-700 transition-colors hover:text-[#005A36]">
              Tin tức
              <span className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full bg-[#005A36] transition-all duration-300 ease-out group-hover:w-full" />
            </a>
            <a href="#routes" className="group relative py-1 text-slate-700 visited:text-slate-700 transition-colors hover:text-[#005A36]">
              Mạng lưới tuyến
              <span className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full bg-[#005A36] transition-all duration-300 ease-out group-hover:w-full" />
            </a>
            <a href="#careers" className="group relative py-1 text-slate-700 visited:text-slate-700 transition-colors hover:text-[#005A36]">
              Tuyển dụng
              <span className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full bg-[#005A36] transition-all duration-300 ease-out group-hover:w-full" />
            </a>
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
