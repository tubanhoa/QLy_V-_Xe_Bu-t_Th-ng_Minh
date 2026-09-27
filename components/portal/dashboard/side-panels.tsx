import { Progress } from 'antd'
import { AlertTriangle, CreditCard } from 'lucide-react'
import { OPEN_INCIDENTS, REVENUE_CHANNELS } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

const SEVERITY = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-slate-400',
} as const

export function RevenueChannelsCard() {
  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="revenue-heading">
      <div className="flex items-center gap-2">
        <CreditCard size={18} strokeWidth={1.75} className="text-brand" aria-hidden="true" />
        <h2 id="revenue-heading" className="text-base font-semibold text-foreground">
          Doanh thu theo kênh
        </h2>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">Cổng thanh toán hôm nay</p>
      <ul className="mt-5 flex flex-col gap-4">
        {REVENUE_CHANNELS.map((channel) => (
          <li key={channel.channel}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{channel.channel}</span>
              <span className="text-muted-foreground">
                {channel.amount} · <span className="font-semibold text-foreground">{channel.share}%</span>
              </span>
            </div>
            <Progress
              percent={channel.share}
              showInfo={false}
              size="small"
              strokeColor={{ from: '#00A86B', to: '#00B4A0' }}
              className="!m-0"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

export function IncidentsCard() {
  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="incidents-heading">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} strokeWidth={1.75} className="text-amber-500" aria-hidden="true" />
          <h2 id="incidents-heading" className="text-base font-semibold text-foreground">
            Cảnh báo đang mở
          </h2>
        </div>
        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
          {OPEN_INCIDENTS.length} mới
        </span>
      </div>
      <ul className="mt-4 flex flex-col gap-2.5">
        {OPEN_INCIDENTS.map((incident) => (
          <li
            key={incident.id}
            className="press flex cursor-pointer gap-3 rounded-xl border border-border p-3 transition-colors hover:border-emerald-500/30"
          >
            <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', SEVERITY[incident.severity])} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{incident.title}</p>
              <p className="truncate text-xs text-muted-foreground">{incident.location}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{incident.time}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
