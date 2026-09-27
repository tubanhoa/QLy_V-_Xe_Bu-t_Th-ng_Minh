'use client'

import { Layout } from 'antd'
import { BrandMark } from '@/components/brand-mark'
import type { NavItem, Role, StaffUser } from '@/lib/rbac'
import { NavMenu } from './nav-menu'
import { OperatorCard } from './operator-card'

interface DesktopSiderProps {
  collapsed: boolean
  user: StaffUser
  role: Role
  items: NavItem[]
  activeKey: string
  onNavigate: (key: string) => void
}

export function DesktopSider({ collapsed, user, role, items, activeKey, onNavigate }: DesktopSiderProps) {
  return (
    <Layout.Sider
      width={272}
      collapsedWidth={80}
      collapsed={collapsed}
      trigger={null}
      style={{ height: '100%', borderInlineEnd: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="flex h-full flex-col">
        <div className={collapsed ? 'flex h-16 items-center justify-center' : 'flex h-16 items-center gap-3 px-5'}>
          <BrandMark size="sm" pulse={collapsed} />
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-sm font-extrabold tracking-wide text-white">ICTU TRANSIT</p>
              <p className="text-[11px] text-white/45">Smart Operations Portal</p>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="px-4 pb-3">
            <OperatorCard user={user} role={role} />
          </div>
        )}

        {!collapsed && (
          <p className="px-6 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Điều hướng
          </p>
        )}

        <nav aria-label="Điều hướng chính" className="flex-1 overflow-y-auto overflow-x-hidden pb-4">
          <NavMenu items={items} activeKey={activeKey} onNavigate={onNavigate} theme="dark" />
        </nav>

        {!collapsed && (
          <div className="m-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              Hệ thống ổn định
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/45">
              Phiên bản 1.0.0 · Đồng bộ lần cuối 12 giây trước
            </p>
          </div>
        )}
      </div>
    </Layout.Sider>
  )
}
