'use client'

import Link from 'next/link'
import { ArrowLeft, Home, Moon, Sun } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { useAuth } from '@/lib/auth-context'
import { LoginForm } from './login-form'
import { LoginShowcase } from './login-showcase'

export function LoginPage() {
  const { themeMode, toggleTheme } = useAuth()

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <LoginShowcase />

      {/* Mobile Header with Quick Return to Home Button */}
      <header className="relative flex items-center justify-between overflow-hidden bg-gradient-to-r from-[#0A131C] to-[#042828] px-4 py-3 text-white lg:hidden">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-black text-white hover:bg-white/20 active:scale-95 transition-all"
          title="Về Trang chủ ICTU Transit"
        >
          <ArrowLeft size={16} strokeWidth={2.4} />
          <span>Trang chủ</span>
        </Link>

        <div className="flex items-center gap-2">
          <BrandMark size="sm" pulse />
          <div className="min-w-0 leading-tight">
            <p className="text-xs font-bold tracking-wide">ICTU TRANSIT</p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={themeMode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          className="flex size-8 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95"
        >
          {themeMode === 'dark' ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
        </button>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:w-[45%]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,168,107,0.10),transparent_60%)]"
        />

        {/* Desktop Top Utilities: Home Link & Theme Switcher */}
        <div className="absolute left-6 right-6 top-6 hidden items-center justify-between lg:flex">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 dark:border-border/80 bg-white/90 dark:bg-card/90 px-4 py-2 text-xs font-black text-slate-700 dark:text-slate-200 shadow-xs backdrop-blur-md transition-all hover:bg-slate-100 hover:text-[#005A36] dark:hover:bg-muted dark:hover:text-emerald-400 active:scale-95"
            title="Quay về Trang chủ ICTU Transit"
          >
            <ArrowLeft size={15} strokeWidth={2.4} />
            <Home size={14} strokeWidth={2.2} />
            <span>Về Trang chủ</span>
          </Link>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={themeMode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            className="press flex size-10 items-center justify-center rounded-2xl border border-slate-200/90 dark:border-border/80 bg-white/90 dark:bg-card/90 text-muted-foreground hover:text-foreground shadow-xs transition-all active:scale-95"
          >
            {themeMode === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
          </button>
        </div>

        <div className="relative w-full max-w-md pt-6 lg:pt-0">
          <LoginForm />
        </div>
      </main>
    </div>
  )
}

