import { Progress } from 'antd'
import { Armchair, CircleCheck, Gauge, TrendingUp, Wallet, type LucideIcon } from 'lucide-react'
import type { Kpi } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  revenue: Wallet,
  trips: CircleCheck,
  occupancy: Armchair,
  speed: Gauge,
}

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const Icon = ICONS[kpi.key] ?? TrendingUp
  const negative = kpi.delta.startsWith('-')

  return (
    <article className="group rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-transform duration-300 group-hover:scale-105">
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold',
            negative
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          )}
        >
          {kpi.delta}
        </span>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{kpi.label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{kpi.value}</p>
      <Progress
        percent={kpi.progress}
        showInfo={false}
        size="small"
        strokeColor={{ from: '#00A86B', to: '#00B4A0' }}
        className="!mb-0 !mt-3"
      />
      <p className="text-xs text-muted-foreground">{kpi.hint}</p>
    </article>
  )
}
