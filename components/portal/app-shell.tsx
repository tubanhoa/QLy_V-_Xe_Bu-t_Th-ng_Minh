'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Layout } from 'antd'
import { LogOut, ShieldAlert, Sparkles, Ticket } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { ROLE_NAV, type Role } from '@/lib/rbac'
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
import { AdminVouchers } from './modules/admin-vouchers'
import { AdminFeedback } from './modules/admin-feedback'
import { AdminInvoices } from './modules/admin-invoices'
import { ContentSkeleton, ModulePreview } from './dashboard/content-states'
import { DriverDashboard } from './dashboard/driver-dashboard'
import { DriverCockpit } from './dashboard/driver-cockpit'
import { OpsDashboard } from './dashboard/ops-dashboard'
import { DesktopSider } from './desktop-sider'
import { DriverBottomNav } from './driver-bottom-nav'
import { NavMenu } from './nav-menu'
import { OperatorCard } from './operator-card'
import { TopHeader } from './top-header'

const SKELETON_MS = 550

export function AppShell() {
  const router = useRouter()
  const { user, role, isAuthenticated, isLoaded, logout, themeMode } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [isCockpitMode, setIsCockpitMode] = useState(true)
  const loadingTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (isLoaded && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isLoaded, isAuthenticated, router])

  useEffect(() => () => clearTimeout(loadingTimer.current), [])

  const isStaff =
    role === 'admin' ||
    role === 'dispatcher' ||
    role === 'manager' ||
    role === 'driver'

  const portalRole: Role =
    role === 'driver' ? 'driver' : role === 'dispatcher' || role === 'manager' ? 'dispatcher' : 'admin'
  const navItems = ROLE_NAV[portalRole] || ROLE_NAV.admin
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

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-white">
          <div className="size-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-xs font-bold text-slate-400">Đang khởi tạo phiên làm việc...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  // Chặn sinh viên / hành khách truy cập Bảng Điều Hành nội bộ của Cán bộ
  if (!isStaff) {
    return (
      <div className="min-h-screen bg-slate-100/80 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl bg-white border border-slate-200/90 p-6 sm:p-8 shadow-2xl text-center space-y-4">
          <div className="size-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-xs">
            <ShieldAlert size={32} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-slate-900">
              Khu Vực Dành Cho Cán Bộ Điều Hành
            </h2>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Bạn đang đăng nhập với tài khoản <strong>{user.fullName || user.name}</strong> ({user.roleTitle || 'Học sinh / Sinh viên ICTU'}). Cổng này chỉ dành riêng cho Cán bộ điều hành và Tài xế ICTU Transit.
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-left space-y-1.5 text-xs text-emerald-950">
            <div className="font-extrabold flex items-center gap-1.5 text-[#005A36]">
              <Sparkles size={15} />
              <span>Cổng Tiện Ích Dành Cho Sinh Viên:</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-normal">
              Bạn có thể xem vé điện tử, quét mã QR lên xe, đổi chuyến, hủy vé & hoàn tiền, đăng ký vé tháng HSSV trực tiếp trên trang chủ.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <Link
              href="/?openTickets=true"
              className="w-full py-3 rounded-xl bg-[#005A36] hover:bg-[#00472b] text-white text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Ticket size={16} />
              <span>Vào Trang Chủ & Mở Cửa Sổ Ví Vé Của Bạn</span>
            </Link>
            <Link
              href="/"
              className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Quay về Trang Chủ</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2 rounded-xl text-slate-500 hover:text-slate-800 text-[11px] font-medium transition-all cursor-pointer"
            >
              Đổi tài khoản cán bộ điều hành
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Đối với Tài xế / Phụ xe: Mặc định bật ngay Buồng Lái Kỹ Thuật Số (Cockpit HUD) không thanh cuộn
  if (portalRole === 'driver' && isCockpitMode) {
    return <DriverCockpit onSwitchToOfficeView={() => setIsCockpitMode(false)} />
  }

  const renderContent = () => {
    if (loading) return <ContentSkeleton />

    // Phân hệ Driver (Tài xế / Phụ xe)
    if (portalRole === 'driver') {
      if (activeItem.key === 'driver-trip') {
        return (
          <DriverDashboard
            onNavigate={handleNavigate}
            onOpenCockpit={() => setIsCockpitMode(true)}
          />
        )
      }
      if (activeItem.key === 'scanner') return <DriverScanner onBack={() => handleNavigate('driver-trip')} />
      if (activeItem.key === 'manifest') return <DriverManifest onBack={() => handleNavigate('driver-trip')} />
      if (activeItem.key === 'incident-report') return <DriverIncident onBack={() => handleNavigate('driver-trip')} />
    }

    // Phân hệ Dispatcher (Điều hành viên)
    if (portalRole === 'dispatcher') {
      if (activeItem.key === 'dashboard') return <OpsDashboard role={portalRole} />
      if (activeItem.key === 'gps') return <DispatcherGpsMap />
      if (activeItem.key === 'student-pass') return <DispatcherStudentApproval />
      if (activeItem.key === 'schedule') return <DispatcherSchedule />
      if (activeItem.key === 'incidents') return <DispatcherIncidents />
      if (activeItem.key === 'feedback') return <AdminFeedback />
    }

    // Phân hệ Super Admin (Quản trị viên)
    if (portalRole === 'admin') {
      if (activeItem.key === 'dashboard') return <OpsDashboard role={portalRole} />
      if (activeItem.key === 'schedule') return <DispatcherSchedule />
      if (activeItem.key === 'gps') return <DispatcherGpsMap />
      if (activeItem.key === 'incidents') return <DispatcherIncidents />
      if (activeItem.key === 'routes') return <AdminRoutes />
      if (activeItem.key === 'fleet') return <AdminFleet />
      if (activeItem.key === 'payments') return <AdminPayments />
      if (activeItem.key === 'passes') return <DispatcherStudentApproval />
      if (activeItem.key === 'vouchers') return <AdminVouchers />
      if (activeItem.key === 'invoices') return <AdminInvoices />
      if (activeItem.key === 'feedback') return <AdminFeedback />
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
          role={portalRole}
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
            key={`${portalRole}-${activeItem.key}-${loading}`}
            className={
              portalRole === 'driver'
                ? 'animate-in fade-in slide-in-from-bottom-2 p-4 pb-32 duration-300 md:p-6'
                : 'animate-in fade-in slide-in-from-bottom-2 p-4 pb-10 duration-300 md:p-6'
            }
          >
            {portalRole === 'driver' && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 px-4 text-emerald-950 dark:text-emerald-200 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <p className="text-xs font-bold">
                    Đang xem ở Chế độ Hành chính / Văn phòng
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCockpitMode(true)}
                  className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 active:scale-95 transition-all cursor-pointer"
                >
                  🚀 Bật Buồng Lái Táp-lô (HUD Cockpit)
                </button>
              </div>
            )}
            {renderContent()}
          </div>
        </Layout.Content>
      </Layout>

      {portalRole === 'driver' && (
        <DriverBottomNav
          activeKey={activeItem.key}
          onNavigate={handleNavigate}
          onOpenProfile={() => setSheetOpen(true)}
        />
      )}

      <BottomSheet open={sheetOpen} onClose={closeSheet} title="Menu điều hướng">
        <div className="px-1 pb-3">
          <OperatorCard user={user} role={portalRole} variant="sheet" />
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
