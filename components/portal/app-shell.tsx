'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Layout } from 'antd'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { ROLE_NAV } from '@/lib/rbac'
import { BottomSheet } from './bottom-sheet'
import { DriverScanner } from './dashboard/driver-scanner'
import { DriverManifest } from './dashboard/driver-manifest'
import { DriverIncident } from './dashboard/driver-incident'
import { DispatcherGpsMap } from './modules/dispatcher-gps-map'
import { DispatcherStudentApproval } from './modules/dispatcher-student-approval'
import { DispatcherSchedule } from './modules/dispatcher-schedule'
import { DispatcherIncidents } from './modules/dispatcher-incidents'
import { AdminRoutes } from './modules/admin-routes'
import { AdminFleet } from './modules/admin-fleet'
import { AdminPayments } from './modules/admin-payments'
import { AdminStaff } from './modules/admin-staff'
import { AdminReports } from './modules/admin-reports'
import { AdminSettings } from './modules/admin-settings'
import { ContentSkeleton, ModulePreview } from './dashboard/content-states'
import { DriverDashboard } from './dashboard/driver-dashboard'
import { OpsDashboard } from './dashboard/ops-dashboard'
import { DesktopSider } from './desktop-sider'
import { DriverBottomNav } from './driver-bottom-nav'
import { NavMenu } from './nav-menu'
import { OperatorCard } from './operator-card'
import { TopHeader } from './top-header'

const SKELETON_MS = 550

export function AppShell() {
  const router = useRouter()
  const { user, role, isAuthenticated, logout, themeMode } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const loadingTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login')
  }, [isAuthenticated, router])

  useEffect(() => () => clearTimeout(loadingTimer.current), [])

  const navItems = ROLE_NAV[role]
  const activeItem = navItems.find((item) => item.key === selectedKey) ?? navItems[0]

  const handleNavigate = useCallback((key: string) => {
    setSelectedKey(key)
    setSheetOpen(false)
    setLoading(true)
    clearTimeout(loadingTimer.current)
    loadingTimer.current = setTimeout(() => setLoading(false), SKELETON_MS)
  }, [])

  const closeSheet = useCallback(() => setSheetOpen(false), [])

  const handleLogout = () => {
    logout()
    router.replace('/login')
  }

  if (!user) return null

  const renderContent = () => {
    if (loading) return <ContentSkeleton />

    // Phân hệ Driver (Tài xế / Phụ xe)
    if (role === 'driver') {
      if (activeItem.key === 'driver-trip') return <DriverDashboard onNavigate={handleNavigate} />
      if (activeItem.key === 'scanner') return <DriverScanner onBack={() => handleNavigate('driver-trip')} />
      if (activeItem.key === 'manifest') return <DriverManifest onBack={() => handleNavigate('driver-trip')} />
      if (activeItem.key === 'incident-report') return <DriverIncident onBack={() => handleNavigate('driver-trip')} />
    }

    // Phân hệ Dispatcher (Điều hành viên)
    if (role === 'dispatcher') {
      if (activeItem.key === 'dashboard') return <OpsDashboard role={role} />
      if (activeItem.key === 'gps') return <DispatcherGpsMap />
      if (activeItem.key === 'student-pass') return <DispatcherStudentApproval />
      if (activeItem.key === 'schedule') return <DispatcherSchedule />
      if (activeItem.key === 'incidents') return <DispatcherIncidents />
    }

    // Phân hệ Super Admin (Quản trị viên)
    if (role === 'admin') {
      if (activeItem.key === 'dashboard') return <OpsDashboard role={role} />
      if (activeItem.key === 'routes') return <AdminRoutes />
      if (activeItem.key === 'fleet') return <AdminFleet />
      if (activeItem.key === 'payments') return <AdminPayments />
      if (activeItem.key === 'passes') return <DispatcherStudentApproval />
      if (activeItem.key === 'staff') return <AdminStaff />
      if (activeItem.key === 'reports') return <AdminReports />
      if (activeItem.key === 'settings') return <AdminSettings />
    }

    return <ModulePreview item={activeItem} />
  }

  return (
    <Layout hasSider className="min-h-dvh">
      <div className="sticky top-0 hidden h-dvh md:block">
        <DesktopSider
          collapsed={collapsed}
          user={user}
          role={role}
          items={navItems}
          activeKey={activeItem.key}
          onNavigate={handleNavigate}
        />
      </div>

      <Layout>
        <TopHeader
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          onOpenMobileNav={() => setSheetOpen(true)}
          activeItem={activeItem}
          onLogout={handleLogout}
        />
        <Layout.Content>
          <div
            key={`${role}-${activeItem.key}-${loading}`}
            className={
              role === 'driver'
                ? 'animate-in fade-in slide-in-from-bottom-2 p-4 pb-32 duration-300 md:p-6'
                : 'animate-in fade-in slide-in-from-bottom-2 p-4 pb-10 duration-300 md:p-6'
            }
          >
            {renderContent()}
          </div>
        </Layout.Content>
      </Layout>

      {role === 'driver' && (
        <DriverBottomNav
          activeKey={activeItem.key}
          onNavigate={handleNavigate}
          onOpenProfile={() => setSheetOpen(true)}
        />
      )}

      <BottomSheet open={sheetOpen} onClose={closeSheet} title="Menu điều hướng">
        <div className="px-1 pb-3">
          <OperatorCard user={user} role={role} variant="sheet" />
        </div>
        <nav aria-label="Điều hướng chính">
          <NavMenu items={navItems} activeKey={activeItem.key} onNavigate={handleNavigate} theme={themeMode} />
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          className="press mx-1 mt-3 flex min-h-12 w-[calc(100%-0.5rem)] items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/[0.06] font-semibold text-red-600 dark:text-red-400"
        >
          <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
          Đăng xuất
        </button>
      </BottomSheet>
    </Layout>
  )
}
