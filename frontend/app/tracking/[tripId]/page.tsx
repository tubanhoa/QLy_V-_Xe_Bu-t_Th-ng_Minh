import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Radio, Ticket, Sparkles } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { LiveTrackingPanel } from '@/components/portal/live-tracking-panel'

interface Props {
  params: Promise<{ tripId: string }>
  searchParams?: Promise<{ pickup?: string; origin?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tripId } = await params
  return {
    title: `Theo Dõi Vị Trí Xe Buýt Realtime | ICTU Smart Transit`,
    description: `Xem vị trí GPS xe buýt trực tiếp, tốc độ vận hành và cảnh báo sự cố trên chuyến ${tripId}.`,
  }
}

export default async function TrackingPage({ params, searchParams }: Props) {
  const { tripId } = await params
  const sParams = searchParams ? await searchParams : {}
  const pickupStation = sParams.pickup || sParams.origin

  return (
    <div className="min-h-screen bg-slate-900 sm:bg-gradient-to-b sm:from-emerald-50/40 sm:via-white sm:to-slate-50 text-slate-800 flex flex-col antialiased">
      {/* Mobile-First Navigation Header with safe-top */}
      <header className="sticky top-0 z-40 border-b border-slate-100/80 bg-white/95 backdrop-blur-md shadow-2xs safe-top">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-13 sm:h-16 flex items-center justify-between gap-2">
          {/* Left: Ergonomic Back Pill with tactile touch */}
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/?openTickets=true"
              className="size-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:text-[#005A36] hover:bg-slate-50 active:scale-95 transition-all shadow-2xs shrink-0 cursor-pointer touch-press"
              id="back-to-tickets-tracking"
              title="Quay lại danh sách vé của tôi"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="min-w-0 flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                  Theo Dõi Xe Buýt
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-[#005A36] px-2 py-0.2 text-[10px] font-black uppercase tracking-wider shrink-0 border border-emerald-300">
                  <span className="size-1.5 rounded-full bg-[#005A36] animate-ping" />
                  Live GPS
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium truncate hidden xs:inline">
                Tuyến 01 · ĐH CNTT&TT Thái Nguyên ⇄ Bến xe TT
              </span>
            </div>
          </div>

          {/* Right: Quick Ticket button & Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/?openTickets=true"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 hover:text-[#005A36] transition-colors shadow-2xs cursor-pointer"
            >
              <Ticket className="w-3.5 h-3.5 text-[#005A36]" />
              <span>Vé của tôi</span>
            </Link>

            <Link href="/" className="hover:opacity-90 transition-opacity shrink-0">
              <BrandMark />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container: Seamless Edge-to-Edge on Mobile, Card on Desktop */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-0 sm:px-4 py-0 sm:py-6 safe-bottom">
        <div className="bg-white sm:rounded-3xl sm:border sm:border-slate-200/80 p-2 sm:p-6 sm:shadow-lg">
          <LiveTrackingPanel tripId={tripId} pickupStation={pickupStation} />
        </div>
      </main>
    </div>
  )
}

