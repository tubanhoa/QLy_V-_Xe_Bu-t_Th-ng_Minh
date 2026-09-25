'use client'

import { useState } from 'react'
import Image from 'next/image'
import { AmbientTransitFx } from './ambient-transit-fx'
import { FloatingSupportBot } from './floating-support-bot'
import { MainHeader } from './main-header'
import { QuickAccessBar } from './quick-access-bar'
import { QuickAccessModals } from './quick-access-modals'
import { SeatPickerModal } from './seat-picker-modal'
import { TopUtilityBar } from './top-utility-bar'
import { VietcombankHero } from './vietcombank-hero'

export function LandingPage() {
  const [isSeatPickerOpen, setIsSeatPickerOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<'routes' | 'news' | 'student-pass' | 'lookup' | null>(null)

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
        <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/40 to-transparent lg:w-[48%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-white/20" />

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
        <AmbientTransitFx />
      </div>

      {/* 2-Tier Header with Transparent Background */}
      <div className="relative shrink-0 z-30">
        <TopUtilityBar />
        <MainHeader onOpenSeatPicker={() => setIsSeatPickerOpen(true)} />
      </div>

      {/* Middle Hero Viewport Stage */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
        <VietcombankHero
          onOpenSeatPicker={() => setIsSeatPickerOpen(true)}
          onSearchRoute={() => setIsSeatPickerOpen(true)}
        />

        {/* Floating Quick Access Bar with strong mobile app glassmorphism */}
        <QuickAccessBar
          onOpenSeatPicker={() => setIsSeatPickerOpen(true)}
          onOpenModal={(modal) => setActiveModal(modal)}
        />
      </main>

      {/* Fixed 24/7 Support Bot Mascot in Bottom Right */}
      <FloatingSupportBot />

      {/* Interactive 28-Seat Bus Booking & QR Ticket Modal */}
      <SeatPickerModal
        open={isSeatPickerOpen}
        onClose={() => setIsSeatPickerOpen(false)}
        initialOrigin="KTX ICTU"
        initialDestination="Bến xe Thái Nguyên"
      />

      {/* Interactive Quick Access Modals (Routes, News, Student Pass, Lookup) */}
      <QuickAccessModals
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        onBookSeat={() => setIsSeatPickerOpen(true)}
      />
    </div>
  )
}
