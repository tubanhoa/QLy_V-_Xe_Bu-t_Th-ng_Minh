import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Radio } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { LiveTrackingPanel } from '@/components/portal/live-tracking-panel'

interface Props {
  params: Promise<{ tripId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tripId } = await params
  return {
    title: `Theo Dõi Vị Trí Xe Buýt Realtime | ICTU Smart Transit`,
    description: `Xem vị trí GPS xe buýt trực tiếp, tốc độ vận hành và cảnh báo sự cố trên chuyến ${tripId}.`,
  }
}

export default async function TrackingPage({ params }: Props) {
  const { tripId } = await params

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-slate-50 text-slate-800 flex flex-col">
      {/* Light Theme Navigation Header with safe-top */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-2xs safe-top">
        <div className="max-w-5xl mx-auto px-3.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-[#005A36] hover:bg-slate-50 transition-all shadow-2xs group touch-press touch-manipulation"
              id="back-to-home-tracking"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Trang chủ</span>
            </Link>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-900 truncate">Định Vị Realtime</span>
              <span className="rounded-full bg-emerald-100 text-[#005A36] px-2 py-0.5 text-[10px] font-black flex items-center gap-1 shrink-0">
                <span className="size-1.5 rounded-full bg-[#005A36] animate-ping" />
                LIVE GPS
              </span>
            </div>
          </div>

          <Link href="/" className="hover:opacity-90 transition-opacity shrink-0">
            <BrandMark />
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-8 safe-bottom">
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-3.5 sm:p-8 shadow-xl">
          <LiveTrackingPanel tripId={tripId} />
        </div>
      </main>
    </div>
  )
}
