'use client'

import { ROLE_META, ROLES, type Role } from '@/lib/rbac'
import { cn } from '@/lib/utils'

interface RoleSwitcherProps {
  value: Role
  onChange: (role: Role) => void
}

export function RoleSwitcher({ value, onChange }: RoleSwitcherProps) {
  const activeIndex = ROLES.indexOf(value)

  return (
    <div
      role="radiogroup"
      aria-label="Chọn vai trò xem trước"
      className="relative grid grid-cols-3 rounded-2xl border border-border bg-muted p-1"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 rounded-xl bg-card shadow-sm ring-1 ring-brand/25 transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
        style={{
          width: 'calc((100% - 0.5rem) / 3)',
          transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
        }}
      />
      {ROLES.map((role) => {
        const { icon: Icon, shortLabel, label } = ROLE_META[role]
        const active = role === value
        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => onChange(role)}
            className={cn(
              'press relative z-10 flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-colors sm:text-[13px]',
              active ? 'text-brand-active dark:text-emerald-300' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
            <span className="truncate">{shortLabel}</span>
          </button>
        )
      })}
    </div>
  )
}
