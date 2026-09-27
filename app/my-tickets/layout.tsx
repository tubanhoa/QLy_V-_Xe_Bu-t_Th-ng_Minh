import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, Ticket } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'

export default function MyTicketsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-slate-50 text-slate-800">
      {/* Light Theme Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-[#005A36] hover:bg-slate-50 transition-all shadow-2xs group"
              id="back-to-home-link"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Trang chủ</span>
            </Link>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-900">Vé Của Tôi</span>
              <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-black">QR ĐIỆN TỬ</span>
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
