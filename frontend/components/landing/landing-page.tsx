'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { AmbientTransitFx } from './ambient-transit-fx'
import { FloatingSupportBot } from './floating-support-bot'
import { MainHeader } from './main-header'
import { QuickAccessBar } from './quick-access-bar'
import { TopUtilityBar } from './top-utility-bar'
import { VietcombankHero } from './vietcombank-hero'
import { MobileBottomDock } from './mobile-bottom-dock'
import { useAuth } from '@/lib/auth-context'
import { BusRoute, TripSearchResult } from '@/lib/types/sprint1'
import { useNotifications } from '@/hooks/use-notifications'
import { FloatingGeofenceAlert } from '@/components/notification/floating-geofence-alert'

// Tối ưu hóa hiệu năng Landing Page: Lazy load các Modal theo nhu cầu (Code Splitting)
const TripSearchModal = dynamic(
  () => import('./trip-search-modal').then((mod) => mod.TripSearchModal),
  { ssr: false }
)
const SeatPickerModal = dynamic(
  () => import('./seat-picker-modal').then((mod) => mod.SeatPickerModal),
  { ssr: false }
)
const TicketManagementModal = dynamic(
  () => import('./ticket-management-modal').then((mod) => mod.TicketManagementModal),
  { ssr: false }
)
const MonthlyPassModal = dynamic(
  () => import('./monthly-pass-modal').then((mod) => mod.MonthlyPassModal),
  { ssr: false }
)
const PriorityVerificationModal = dynamic(
  () => import('./priority-verification-modal').then((mod) => mod.PriorityVerificationModal),
  { ssr: false }
)
const QuickAccessModals = dynamic(
  () => import('./quick-access-modals').then((mod) => mod.QuickAccessModals),
  { ssr: false }
)
const AuthPromptModal = dynamic(
  () => import('@/components/auth/auth-prompt-modal').then((mod) => mod.AuthPromptModal),
  { ssr: false }
)
const NotificationCenter = dynamic(
  () => import('@/components/notification/notification-center').then((mod) => mod.NotificationCenter),
  { ssr: false }
)
const PushPermissionModal = dynamic(
  () => import('@/components/notification/push-permission-modal').then((mod) => mod.PushPermissionModal),
  { ssr: false }
)
const VoucherVaultModal = dynamic(
  () => import('./voucher-vault-modal').then((mod) => mod.VoucherVaultModal),
  { ssr: false }
)

export function LandingPage() {
  const { isAuthenticated } = useAuth()
  const notifController = useNotifications()
  const [isSeatPickerOpen, setIsSeatPickerOpen] = useState(false)
  const [isTripSearchOpen, setIsTripSearchOpen] = useState(false)
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false)
  const [isMonthlyPassModalOpen, setIsMonthlyPassModalOpen] = useState(false)
  const [isPriorityVerificationModalOpen, setIsPriorityVerificationModalOpen] = useState(false)
  const [isVoucherVaultOpen, setIsVoucherVaultOpen] = useState(false)
  const [prefilledVoucherCode, setPrefilledVoucherCode] = useState<string | null>(null)
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false)
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<'routes' | 'news' | 'student-pass' | 'lookup' | 'staff' | 'partner' | null>(null)
  const [selectedTrip, setSelectedTrip] = useState<TripSearchResult | null>(null)
  const [pendingTrip, setPendingTrip] = useState<TripSearchResult | null>(null)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [searchOrigin, setSearchOrigin] = useState('')
  const [searchDestination, setSearchDestination] = useState('')

  // Task PERF-01: Tạm dừng hoạt họa nền khi đang mở Cửa Sổ Nổi để giải phóng GPU/RAM
  const isAnyModalOpen =
    isSeatPickerOpen ||
    isTripSearchOpen ||
    isTicketModalOpen ||
    isMonthlyPassModalOpen ||
    isPriorityVerificationModalOpen ||
    isVoucherVaultOpen ||
    isAuthPromptOpen ||
    isNotificationCenterOpen ||
    activeModal !== null

  // Tự động mở Cửa Sổ Nổi Vé Điện Tử, Vé Tháng hoặc Kho Voucher khi có query param
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('openTickets') === 'true') {
        setIsTicketModalOpen(true)
      }
      if (params.get('openMonthlyPass') === 'true') {
        setIsMonthlyPassModalOpen(true)
      }
      if (params.get('openVerification') === 'true') {
        setIsPriorityVerificationModalOpen(true)
      }
      if (params.get('openVouchers') === 'true') {
        setIsVoucherVaultOpen(true)
      }
    }
  }, [])

  return (
    <div className="relative h-screen max-h-screen w-full overflow-hidden bg-[#EBF5FB] flex flex-col justify-between select-none font-sans text-slate-900">
      {/* Fullscreen Landscape Background Canvas */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center">
        {/* Stage strictly locked to the 1376:768 aspect ratio of tea hills background */}
        <div className="relative w-[max(100vw,calc(100vh*1376/768))] h-[max(100vh,calc(100vw*768/1376))] shrink-0">
          <Image
            src="/images/tea-hills-clean.jpg"
            alt="Hệ thống xe buýt thông minh ICTU Transit"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center select-none"
          />

          {/* ===================================================================
              REALISTIC GREEN ICTU ELECTRIC BUS ARRIVAL ANIMATION
              Seamlessly navigates down the tea hill road and docks at the station
              =================================================================== */}
          <div
            className="absolute pointer-events-none animate-smart-bus will-change-transform"
            style={{
              left: '52.326%',
              top: '54.036%',
              width: '27.253%',
              aspectRatio: '375 / 220',
              transformOrigin: '50% 100%',
              animationPlayState: isAnyModalOpen ? 'paused' : 'running',
            }}
          >
            {/* Realistic Ground Contact & Underbody Ambient Shadow (anchors tires to road) */}
            <img
              src="/images/smart_bus_shadow.png"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none mix-blend-multiply opacity-95"
              draggable={false}
            />

            {/* ICTU Smart Electric Bus Cutout */}
            <img
              src="/images/smart_bus_animated.png"
              alt="ICTU Smart Electric Bus"
              className="relative w-full h-full object-contain select-none"
              draggable={false}
            />

            {/* Realistic Electric Headlight Beam on Road */}
            <div className="absolute -left-12 bottom-1 w-32 h-14 bg-gradient-to-l from-white/35 via-emerald-200/20 to-transparent blur-md -rotate-6 pointer-events-none animate-headlight-glow" />
          </div>

          {/* Smart Bus Stop IoT Radar Beacon Signal (Over the Shelter Sign) */}
          <div
            className="absolute pointer-events-none"
            style={{ left: '79.6%', top: '56.5%' }}
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute size-7 rounded-full border border-emerald-400/60 bg-emerald-400/10 animate-station-beacon" />
              <span
                className="absolute size-7 rounded-full border border-cyan-400/50 bg-cyan-400/10 animate-station-beacon"
                style={{ animationDelay: '1.2s' }}
              />
              <span className="relative size-2 rounded-full bg-emerald-400 shadow-xs shadow-emerald-300 ring-2 ring-white/80" />
            </div>
          </div>
        </div>

        {/* Left Quiet Zone: Soft pastel gradient fade creating high-focus tranquil area for greeting & search */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/65 via-white/35 to-transparent lg:w-[48%] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent pointer-events-none" />

        {/* Ambient Drifting Clouds in Sky - GPU Accelerated & Lightweight */}
        <div className="absolute top-2 left-0 w-[140%] h-36 opacity-20 blur-sm animate-cloud-1 pointer-events-none will-change-transform">
          <svg viewBox="0 0 1000 120" fill="none" className="w-full h-full text-white/70">
            <path
              d="M 120,60 Q 150,20 200,40 Q 240,10 290,35 Q 340,15 380,45 Q 430,25 470,55 Q 500,40 540,60 L 540,100 L 120,100 Z"
              fill="currentColor"
            />
            <path
              d="M 620,50 Q 660,15 720,35 Q 770,10 820,40 Q 870,20 920,55 L 920,95 L 620,95 Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <div className="absolute top-8 left-[-15%] w-[130%] h-28 opacity-15 blur-xs animate-cloud-2 pointer-events-none will-change-transform">
          <svg viewBox="0 0 1000 100" fill="none" className="w-full h-full text-white/60">
            <path
              d="M 220,50 Q 270,18 330,35 Q 380,10 440,38 Q 500,20 560,50 L 560,90 L 220,90 Z"
              fill="currentColor"
            />
          </svg>
        </div>

        {/* Organic Falling Tea Leaves Experience */}
        <AmbientTransitFx isPaused={isAnyModalOpen} />
      </div>

      {/* 2-Tier Header with Transparent Background */}
      <div className="relative shrink-0 z-30">
        <TopUtilityBar
          onOpenModal={(modal) => {
            if (modal === 'lookup') {
              setIsTicketModalOpen(true)
            } else if (modal === 'student-pass') {
              setIsMonthlyPassModalOpen(true)
            } else {
              setActiveModal(modal)
            }
          }}
        />
        <MainHeader
          onOpenSeatPicker={() => setIsTripSearchOpen(true)}
          onOpenModal={(modal) => {
            if (modal === 'lookup') {
              setIsTicketModalOpen(true)
            } else if (modal === 'student-pass') {
              setIsMonthlyPassModalOpen(true)
            } else {
              setActiveModal(modal)
            }
          }}
          onOpenTicketModal={() => setIsTicketModalOpen(true)}
          onOpenMonthlyPassModal={() => setIsMonthlyPassModalOpen(true)}
          onOpenPriorityVerificationModal={() => setIsPriorityVerificationModalOpen(true)}
          onOpenNotificationCenter={() => setIsNotificationCenterOpen(true)}
          unreadCount={notifController.unreadCount}
        />
      </div>

      {/* Middle Hero Viewport Stage */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
        <VietcombankHero
          onOpenSeatPicker={() => {
            setSelectedTrip(null)
            setIsTripSearchOpen(true)
          }}
          onSearchRoute={(query) => {
            if (query.toUpperCase().includes('CT-01') || query.toUpperCase().includes('01')) {
              setSearchOrigin('ĐH CNTT & TT Thái Nguyên')
              setSearchDestination('Bến Xe Trung Tâm Thái Nguyên')
            } else if (query.toUpperCase().includes('CT-02') || query.toUpperCase().includes('02')) {
              setSearchOrigin('Bến Xe Nam Thái Nguyên')
              setSearchDestination('Khu Công Nghiệp Sông Công')
            } else {
              setSearchOrigin(query)
              setSearchDestination('')
            }
            setIsTripSearchOpen(true)
          }}
        />

        {/* Floating Quick Access Bar with strong mobile app glassmorphism */}
        <QuickAccessBar
          onOpenSeatPicker={() => {
            setSelectedTrip(null)
            setIsTripSearchOpen(true)
          }}
          onOpenModal={(modal) => {
            if (modal === 'lookup') {
              setIsTicketModalOpen(true)
            } else if (modal === 'student-pass') {
              setIsMonthlyPassModalOpen(true)
            } else {
              setActiveModal(modal)
            }
          }}
          onOpenTicketModal={() => setIsTicketModalOpen(true)}
          onOpenVoucherVault={() => setIsVoucherVaultOpen(true)}
        />
      </main>

      {/* Fixed 24/7 Support Bot Mascot in Bottom Right */}
      <FloatingSupportBot />

      {/* Interactive Trip Search & Realtime Schedules Modal */}
      {isTripSearchOpen && (
        <TripSearchModal
          open={isTripSearchOpen}
          onClose={() => setIsTripSearchOpen(false)}
          initialOrigin={searchOrigin}
          initialDestination={searchDestination}
          onSelectTrip={(trip) => {
            setSelectedTrip(trip)
            setSearchOrigin(trip.origin)
            setSearchDestination(trip.destination)
            setIsTripSearchOpen(false)

            if (!isAuthenticated) {
              setPendingTrip(trip)
              setIsAuthPromptOpen(true)
            } else {
              setIsSeatPickerOpen(true)
            }
          }}
        />
      )}

      {/* Auth Prompt Modal (Required for Guests attempting to book) */}
      {isAuthPromptOpen && (
        <AuthPromptModal
          open={isAuthPromptOpen}
          onClose={() => {
            setIsAuthPromptOpen(false)
            setPendingTrip(null)
          }}
          trip={pendingTrip}
        />
      )}

      {/* Interactive 28-Seat Bus Booking & QR Ticket Modal */}
      {isSeatPickerOpen && (
        <SeatPickerModal
          open={isSeatPickerOpen}
          onClose={() => {
            setIsSeatPickerOpen(false)
            setSelectedTrip(null)
            setPrefilledVoucherCode(null)
          }}
          initialOrigin={searchOrigin || 'ĐH CNTT & TT Thái Nguyên'}
          initialDestination={searchDestination || 'Bến Xe Trung Tâm Thái Nguyên'}
          selectedTrip={selectedTrip}
          initialVoucherCode={prefilledVoucherCode || undefined}
          onViewMyTickets={(tId) => {
            setSelectedTicketId(tId || null)
            setIsTicketModalOpen(true)
          }}
        />
      )}

      {/* Cửa sổ nổi: Kho Voucher & Ưu Đãi Của Tôi */}
      {isVoucherVaultOpen && (
        <VoucherVaultModal
          open={isVoucherVaultOpen}
          onClose={() => setIsVoucherVaultOpen(false)}
          onUseVoucher={(code) => {
            setPrefilledVoucherCode(code)
            setIsVoucherVaultOpen(false)
            setIsSeatPickerOpen(true)
          }}
        />
      )}

      {/* Cửa sổ nổi (Floating Modal Window): Vé Điện Tử & Mã QR Soát Vé */}
      {isTicketModalOpen && (
        <TicketManagementModal
          open={isTicketModalOpen}
          onClose={() => {
            setIsTicketModalOpen(false)
            setSelectedTicketId(null)
          }}
          initialTicketId={selectedTicketId}
          onOpenPriorityVerificationModal={() => setIsPriorityVerificationModalOpen(true)}
        />
      )}

      {/* Cửa sổ nổi (Floating Modal Window): Đăng Ký & Quản Lý Vé Tháng HSSV */}
      {isMonthlyPassModalOpen && (
        <MonthlyPassModal
          open={isMonthlyPassModalOpen}
          onClose={() => setIsMonthlyPassModalOpen(false)}
        />
      )}

      {/* Cửa sổ nổi: Xác Thực Hồ Sơ Đối Tượng Ưu Đãi (HSSV / Cao Tuổi) */}
      {isPriorityVerificationModalOpen && (
        <PriorityVerificationModal
          open={isPriorityVerificationModalOpen}
          onClose={() => setIsPriorityVerificationModalOpen(false)}
          onOpenMonthlyPass={() => setIsMonthlyPassModalOpen(true)}
        />
      )}

      {/* Interactive Quick Access Modals (Routes, News, Student Pass) */}
      {activeModal && activeModal !== 'lookup' && activeModal !== 'student-pass' && (
        <QuickAccessModals
          activeModal={activeModal}
          onClose={() => setActiveModal(null)}
          onBookSeat={(route?: BusRoute) => {
            if (route) {
              setSearchOrigin(route.origin)
              setSearchDestination(route.destination)
            }
            setIsTripSearchOpen(true)
          }}
        />
      )}

      {/* Cảnh Báo Nổi In-App Geofence Alert (Xe buýt vào bán kính <= 500m) */}
      <FloatingGeofenceAlert
        alert={notifController.activeGeofenceAlert}
        onDismiss={notifController.dismissGeofenceAlert}
      />

      {/* Trung Tâm Thông Báo (Notification Center Popover/Drawer) */}
      {isNotificationCenterOpen && (
        <NotificationCenter
          isOpen={isNotificationCenterOpen}
          onClose={() => setIsNotificationCenterOpen(false)}
          notificationController={notifController}
          isAuthenticated={isAuthenticated}
          onOpenAuth={() => {
            setIsNotificationCenterOpen(false)
            setIsAuthPromptOpen(true)
          }}
        />
      )}

      {/* Hộp Thoại Xin Quyền Web Push Notification */}
      <PushPermissionModal />

      {/* Thanh Dock Điều Hướng Siêu Cấp Dành Cho Mobile Web */}
      <MobileBottomDock
        onOpenTripSearch={() => setIsTripSearchOpen(true)}
        onOpenMyTickets={() => setIsTicketModalOpen(true)}
        onOpenMonthlyPass={() => setIsMonthlyPassModalOpen(true)}
        activeTicketsCount={1}
      />
    </div>
  )
}

