'use client'

import { Menu, type MenuProps } from 'antd'
import type { NavItem } from '@/lib/rbac'

interface NavMenuProps {
  items: NavItem[]
  activeKey: string
  onNavigate: (key: string) => void
  theme: 'light' | 'dark'
}

export function NavMenu({ items, activeKey, onNavigate, theme }: NavMenuProps) {
  const menuItems: MenuProps['items'] = items.map(({ key, label, icon: Icon, badge }) => ({
    key,
    title: label,
    icon: <Icon size={18} strokeWidth={1.75} aria-hidden="true" />,
    label: (
      <span className="flex items-center justify-between gap-2">
        <span className="truncate">{label}</span>
        {badge ? (
          <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-4 text-white">
            {badge}
          </span>
        ) : null}
      </span>
    ),
  }))

  return (
    <Menu
      mode="inline"
      theme={theme}
      selectedKeys={[activeKey]}
      items={menuItems}
      onClick={({ key }) => onNavigate(key)}
      style={{ borderInlineEnd: 'none', background: 'transparent' }}
    />
  )
}
