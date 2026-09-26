'use client'

import { useEffect, useRef } from 'react'
import { Avatar, Badge, Breadcrumb, Dropdown, Popover, type MenuProps } from 'antd'
import {
  Bell,
  ChevronRight,
  LogOut,
  Menu as MenuIcon,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { OPEN_INCIDENTS } from '@/lib/mock-data'
import { ROLE_META, ROLES, type NavItem, type Role } from '@/lib/rbac'
import { cn } from '@/lib/utils'

interface TopHeaderProps {
  collapsed: boolean
  onToggleCollapse: () => void
  onOpenMobileNav: () => void
  activeItem: NavItem
  onLogout: () => void
}

const iconButton =
  'press inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-brand/30 hover:text-foreground'

export function TopHeader({ collapsed, onToggleCollapse, onOpenMobileNav, activeItem, onLogout }: TopHeaderProps) {
  const { user, role, setRole, themeMode, toggleTheme } = useAuth()
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!user) return null

  const profileItems: MenuProps['items'] = [
    {
      key: 'profile',
      disabled: true,
      label: (
        <div className="py-1">
          <p className="text-sm font-semibold text-foreground">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      ),
    },
    { type: 'divider' },
    {
      type: 'group',
      label: 'Chuyển vai trò (Demo)',
      children: ROLES.map((r) => {
        const Icon = ROLE_META[r].icon
        return {
          key: `role:${r}`,
          icon: <Icon size={16} strokeWidth={1.75} aria-hidden="true" />,
          label: ROLE_META[r].label,
          disabled: r === role,
        }
      }),
    },
    { type: 'divider' },
    {
      key: 'logout',
      danger: true,
      icon: <LogOut size={16} strokeWidth={1.75} className="text-red-500" aria-hidden="true" />,
      label: 'Đăng xuất',
    },
  ]

  const handleProfileClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') onLogout()
    else if (key.startsWith('role:')) setRole(key.slice(5) as Role)
  }

  const notifications = (
    <div className="w-72">
      <p className="mb-2 text-sm font-semibold">Cảnh báo mới</p>
      <ul className="flex flex-col gap-2">
        {OPEN_INCIDENTS.map((incident) => (
          <li key={incident.id} className="rounded-xl border border-border p-2.5">
            <p className="text-sm font-medium">{incident.title}</p>
            <p className="text-xs text-muted-foreground">
              {incident.location} · {incident.time}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
          className={cn(iconButton, 'hidden md:inline-flex')}
        >
          {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.75} /> : <PanelLeftClose size={18} strokeWidth={1.75} />}
        </button>
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Mở menu điều hướng"
          className={cn(iconButton, 'md:hidden')}
        >
          <MenuIcon size={18} strokeWidth={1.75} />
        </button>

        <div className="min-w-0 flex-1 lg:flex-none">
          <p className="truncate text-sm font-semibold text-foreground sm:hidden">{activeItem.label}</p>
          <Breadcrumb
            separator={<ChevronRight size={14} className="mt-1 text-muted-foreground" aria-hidden="true" />}
            items={[
              { title: ROLE_META[role].label },
              { title: <span className="font-semibold text-foreground">{activeItem.label}</span> },
            ]}
            className="hidden truncate sm:block"
          />
        </div>

        <label className="relative mx-auto hidden w-full max-w-md lg:block">
          <span className="sr-only">Tìm kiếm biển số, mã chuyến, vé hành khách</span>
          <Search
            size={16}
            strokeWidth={1.75}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={searchRef}
            type="search"
            placeholder="Tìm biển số, mã chuyến, vé..."
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-16 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-brand/40 focus:ring-4 focus:ring-brand/10"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted-foreground">
            Ctrl + K
          </kbd>
        </label>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 xl:flex">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="whitespace-nowrap text-xs font-medium text-emerald-700 dark:text-emerald-300">
              GPS Server: 18ms · All Nodes Active
            </span>
          </div>

          <Popover content={notifications} trigger="click" placement="bottomRight" arrow={false}>
            <button type="button" aria-label="Thông báo, 3 cảnh báo mới" className={iconButton}>
              <Badge count={3} size="small" offset={[4, -4]}>
                <Bell size={18} strokeWidth={1.75} className="text-muted-foreground" />
              </Badge>
            </button>
          </Popover>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={themeMode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            className={iconButton}
          >
            <span className={cn('transition-transform duration-500', themeMode === 'dark' && 'rotate-180')}>
              {themeMode === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
            </span>
          </button>

          <Dropdown
            menu={{ items: profileItems, onClick: handleProfileClick }}
            trigger={['click']}
            placement="bottomRight"
          >
            <button
              type="button"
              aria-label="Menu tài khoản"
              className="press flex items-center gap-2.5 rounded-xl border border-transparent p-1 pr-1 transition-colors hover:border-border hover:bg-card sm:pr-3"
            >
              <Avatar size={32} style={{ background: 'linear-gradient(135deg,#00A86B,#00B4A0)', fontWeight: 700 }}>
                {user.initials}
              </Avatar>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block max-w-40 truncate text-sm font-semibold text-foreground">
                  {user.name}
                </span>
                <span className="block text-[11px] text-muted-foreground">{user.roleTitle}</span>
              </span>
            </button>
          </Dropdown>
        </div>
      </div>
    </header>
  )
}
