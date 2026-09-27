import { Bus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean
  className?: string
}

const SIZES = {
  sm: { box: 'size-9 rounded-xl', icon: 18 },
  md: { box: 'size-11 rounded-2xl', icon: 22 },
  lg: { box: 'size-14 rounded-2xl', icon: 28 },
}

export function BrandMark({ size = 'md', pulse = false, className }: BrandMarkProps) {
  const s = SIZES[size]
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {pulse && (
        <span
          aria-hidden="true"
          className={cn('absolute inset-0 animate-ping bg-brand/30', s.box)}
        />
      )}
      <span
        className={cn(
          'relative inline-flex items-center justify-center bg-gradient-to-br from-[#007044] to-[#005A36] text-white shadow-lg shadow-emerald-950/20 ring-1 ring-white/20',
          s.box,
        )}
      >
        <Bus size={s.icon} strokeWidth={1.75} aria-hidden="true" />
      </span>
    </span>
  )
}
