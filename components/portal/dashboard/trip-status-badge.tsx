import type { Trip } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

const STYLES = {
  running: { label: 'Đang chạy', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', pulse: true },
  arriving: { label: 'Đến trạm', className: 'bg-teal-500/10 text-teal-600 dark:text-teal-300', dot: 'bg-teal-500', pulse: false },
  delayed: { label: 'Trễ', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', pulse: true },
  scheduled: { label: 'Chờ xuất bến', className: 'bg-muted text-muted-foreground', dot: 'bg-slate-400', pulse: false },
} as const

export function TripStatusBadge({ trip }: { trip: Trip }) {
  const style = STYLES[trip.status]
  const label = trip.status === 'delayed' ? `Trễ ${trip.delayMinutes} phút` : style.label

  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', style.className)}>
      <span className="relative flex size-1.5">
        {style.pulse && <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-70', style.dot)} />}
        <span className={cn('relative inline-flex size-1.5 rounded-full', style.dot)} />
      </span>
      {label}
    </span>
  )
}
