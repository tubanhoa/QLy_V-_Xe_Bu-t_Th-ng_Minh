import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, Ticket, CreditCard } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'

export default function MonthlyPassLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-slate-50 text-slate-800">
      {/* Light Theme Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-[#005A36] hover:bg-slate-50 transition-all shadow-2xs group"
              id="back-to-home-monthly-pass"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Trang chủ</span>
            </Link>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70 text-xs font-bold">
              <Link
                href="/my-tickets"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>Vé Của Tôi</span>
              </Link>
              <Link
                href="/monthly-pass"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white text-[#005A36] shadow-xs font-extrabold"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Vé Tháng HSSV</span>
              </Link>
            </div>
          </div>

          <Link href="/" className="hover:opacity-90 transition-opacity">
            <BrandMark />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>
    </div>
  )
}
