'use client'

import { Moon, Sun } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { useAuth } from '@/lib/auth-context'
import { LoginForm } from './login-form'
import { LoginShowcase } from './login-showcase'

export function LoginPage() {
  const { themeMode, toggleTheme } = useAuth()

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <LoginShowcase />

      <header className="relative flex items-center gap-3 overflow-hidden bg-gradient-to-r from-[#0A131C] to-[#042828] px-5 py-4 text-white lg:hidden">
        <BrandMark size="sm" pulse />
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-bold tracking-wide">ICTU SMART TRANSIT</p>
          <p className="truncate text-xs text-white/55">Hệ thống điều hành xe buýt công nghệ số</p>
        </div>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
          12 xe
        </span>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:w-[45%]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,168,107,0.10),transparent_60%)]"
        />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={themeMode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          className="press absolute right-4 top-4 hidden size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground lg:flex"
        >
          {themeMode === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
        </button>
        <div className="relative w-full max-w-md">
          <LoginForm />
        </div>
      </main>
    </div>
  )
}
