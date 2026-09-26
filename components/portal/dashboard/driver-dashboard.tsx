'use client'

import { useEffect, useState } from 'react'
import { Armchair, Bus, MapPin, QrCode, Timer } from 'lucide-react'
import { DRIVER_ROUTE_STOPS } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

interface DriverDashboardProps {
  onNavigate: (key: string) => void
}

function useCountdown(offsetMs: number) {
  const [target] = useState(() => Date.now() + offsetMs)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const remaining = Math.max(0, Math.floor((target - now) / 1000))
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0')
  const seconds = String(remaining % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function DriverDashboard({ onNavigate }: DriverDashboardProps) {
  const countdown = useCountdown(12 * 60 * 1000 + 30 * 1000)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div>
        <p className="text-sm text-muted-foreground">Chào buổi sáng,</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Chuyến xe hôm nay của tôi</h1>
      </div>

      <article className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0A131C] via-[#0B2226] to-[#04332B] p-5 text-white shadow-xl shadow-emerald-900/20 sm:p-6">
        <div aria-hidden="true" className="absolute -right-16 -top-16 size-56 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            <Bus size={14} strokeWidth={1.75} aria-hidden="true" />
            20B-009.77
          </span>
          <span className="font-mono text-xs text-white/50">CT-01-0745</span>
        </div>

        <h2 className="relative mt-4 text-balance text-xl font-bold leading-snug sm:text-2xl">
          Tuyến 01: ICTU → Bến xe Trung tâm
        </h2>

        <div className="relative mt-5 flex items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs text-white/55">
              <Timer size={14} strokeWidth={1.75} aria-hidden="true" />
              Xuất bến sau
            </p>
            <p className="mt-1 font-mono text-5xl font-bold tabular-nums tracking-tight text-emerald-300" aria-live="off">
              {countdown}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/55">Giờ xuất bến</p>
            <p className="text-2xl font-bold">07:45</p>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('scanner')}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl py-3 text-sm sm:flex-row sm:gap-2 sm:text-base bg-emerald-500 px-4 font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-400 active:scale-[0.97]"
          >
            <QrCode size={20} strokeWidth={1.75} aria-hidden="true" />
            Mở Camera Quét Vé
          </button>
          <button
            type="button"
            onClick={() => onNavigate('manifest')}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl py-3 text-sm sm:flex-row sm:gap-2 sm:text-base border border-white/15 bg-white/[0.06] px-4 font-semibold text-white transition-all hover:bg-white/10 active:scale-[0.97]"
          >
            <Armchair size={20} strokeWidth={1.75} aria-hidden="true" />
            Xem 28 Khách
          </button>
        </div>
      </article>

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="stops-heading">
        <h2 id="stops-heading" className="flex items-center gap-2 text-base font-semibold text-foreground">
          <MapPin size={18} strokeWidth={1.75} className="text-brand" aria-hidden="true" />
          Lộ trình trạm đón
        </h2>
        <ol className="mt-4">
          {DRIVER_ROUTE_STOPS.map((stop, index) => {
            const isLast = index === DRIVER_ROUTE_STOPS.length - 1
            const current = stop.state === 'current'
            return (
              <li key={stop.name} className="relative flex gap-4 pb-5 last:pb-0">
                {!isLast && <span aria-hidden="true" className="absolute left-[7px] top-4 h-full w-0.5 bg-border" />}
                <span
                  className={cn(
                    'relative mt-1 size-4 shrink-0 rounded-full border-2',
                    current ? 'border-brand bg-brand' : 'border-border bg-card',
                  )}
                >
                  {current && <span className="absolute inset-0 animate-ping rounded-full bg-brand/40" />}
                </span>
                <div className="flex flex-1 items-baseline justify-between gap-3">
                  <p className={cn('text-sm', current ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                    {stop.name}
                    {current && (
                      <span className="mt-1 block w-fit rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                        Đang đón khách
                      </span>
                    )}
                  </p>
                  <span className="font-mono text-xs text-muted-foreground">{stop.time}</span>
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
