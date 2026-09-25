'use client'

import { Armchair, Compass, QrCode, Siren, User, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DriverBottomNavProps {
  activeKey: string
  onNavigate: (key: string) => void
  onOpenProfile: () => void
}

interface TabItem {
  key: string
  label: string
  icon: LucideIcon
}

const LEFT: TabItem = { key: 'driver-trip', label: 'Lịch trình', icon: Compass }
const RIGHT: TabItem[] = [{ key: 'incident-report', label: 'Sự cố', icon: Siren }]

export function DriverBottomNav({ activeKey, onNavigate, onOpenProfile }: DriverBottomNavProps) {
  const renderTab = ({ key, label, icon: Icon }: TabItem) => {
    const active = activeKey === key
    return (
      <button
        key={key}
        type="button"
        onClick={() => onNavigate(key)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'press flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold transition-colors',
          active ? 'text-brand' : 'text-muted-foreground',
        )}
      >
        <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
        {label}
      </button>
    )
  }

  const scannerActive = activeKey === 'scanner'

  return (
    <nav
      aria-label="Điều hướng tài xế"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex max-w-md items-end px-2">
        {renderTab(LEFT)}
        {renderTab({ key: 'manifest', label: 'Hành khách', icon: Armchair })}
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={() => onNavigate('scanner')}
            aria-label="Mở máy quét vé QR"
            aria-current={scannerActive ? 'page' : undefined}
            className="relative -translate-y-4 rounded-full bg-emerald-600 p-3.5 text-white shadow-lg shadow-emerald-500/40 ring-4 ring-card transition-all active:scale-90"
          >
            <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-20" />
            <QrCode size={26} strokeWidth={1.75} className="relative" aria-hidden="true" />
          </button>
        </div>
        {RIGHT.map(renderTab)}
        <button
          type="button"
          onClick={onOpenProfile}
          className="press flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold text-muted-foreground"
        >
          <User size={20} strokeWidth={1.75} aria-hidden="true" />
          Cá nhân
        </button>
      </div>
    </nav>
  )
}
