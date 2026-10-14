import { Avatar } from 'antd'
import { ROLE_META, type Role, type StaffUser } from '@/lib/rbac'
import { cn } from '@/lib/utils'

interface OperatorCardProps {
  user: StaffUser
  role: Role
  variant?: 'sider' | 'sheet'
}

export function OperatorCard({ user, role, variant = 'sider' }: OperatorCardProps) {
  const isSider = variant === 'sider'
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl p-3',
        isSider ? 'border border-white/[0.06] bg-white/[0.03]' : 'border border-border bg-muted/60',
      )}
    >
      <span className="relative shrink-0">
        <Avatar size={40} style={{ background: 'linear-gradient(135deg,#00A86B,#00B4A0)', fontWeight: 700 }}>
          {user.initials}
        </Avatar>
        <span
          className={cn(
            'absolute bottom-0 right-0 size-3 rounded-full bg-emerald-400 ring-2',
            isSider ? 'ring-sidebar' : 'ring-card',
          )}
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-semibold', isSider ? 'text-white' : 'text-foreground')}>
          {user.name}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className={cn('font-mono text-[11px]', isSider ? 'text-white/45' : 'text-muted-foreground')}>
            {user.staffId}
          </span>
          <span className="rounded-full bg-emerald-400/15 px-1.5 py-px text-[10px] font-semibold text-emerald-500 dark:text-emerald-300">
            {ROLE_META[role].shortLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
