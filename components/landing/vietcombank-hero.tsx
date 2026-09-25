'use client'

import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Bus,
  Clock,
  Compass,
  CreditCard,
  MapPin,
  Moon,
  Radio,
  Search,
  Sparkles,
  Sun,
  Ticket,
  Wifi,
  Zap,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { cn } from '@/lib/utils'

interface VietcombankHeroProps {
  onOpenSeatPicker: () => void
  onSearchRoute?: (query: string) => void
}

const CARDS = [
  {
    id: 'hssv-pass',
    title: 'THẺ THÁNG HSSV',
    subtitle: 'Trợ giá 50% trọn vẹn học kỳ',
    tag: 'Vé Tháng HSSV',
    gradient: 'from-[#1e6b45] via-[#005a36] to-[#003820]',
    textColor: 'text-white',
    number: '•••• 2026',
    cardType: 'Vé Tháng HSSV',
    subBadge: 'ICTU TRANSIT',
  },
  {
    id: 'route-pass',
    title: 'THẺ THÁNG TUYẾN CT-01',
    subtitle: 'KTX ICTU ➔ Bến xe Đồng Quang',
    tag: 'Vé Tháng Tuyến',
    gradient: 'from-[#007044] via-[#005a36] to-[#04331d]',
    textColor: 'text-white',
    number: '•••• 8899',
    cardType: 'Vé Tháng Tuyến',
    subBadge: 'ICTU TRANSIT',
  },
  {
    id: 'all-routes-pass',
    title: 'THẺ THÁNG TOÀN MẠNG',
    subtitle: 'Vé Tháng Sinh Viên Không Giới Hạn',
    tag: 'Vé Tháng Toàn Mạng',
    gradient: 'from-[#2a8052] via-[#00633b] to-[#004024]',
    textColor: 'text-white',
    number: '•••• 4567',
    cardType: 'Vé Tháng HSSV',
    subBadge: 'ICTU TRANSIT',
  },
  {
    id: 'ev-pass',
    title: 'THẺ THÁNG BUÝT ĐIỆN',
    subtitle: 'Vé Tháng Xe Buýt Điện Thông Minh',
    tag: 'Vé Tháng EV',
    gradient: 'from-[#135d3b] via-[#004f2f] to-[#002e1b]',
    textColor: 'text-white',
    number: '•••• 3321',
    cardType: 'NFC Transit',
    subBadge: 'ICTU TRANSIT',
  },
  {
    id: 'campus-pass',
    title: 'THẺ THÁNG LIÊN TRƯỜNG',
    subtitle: 'Vé Tháng Liên Viện Thái Nguyên',
    tag: 'Vé Tháng Liên Tuyến',
    gradient: 'from-[#35925e] via-[#005a36] to-[#03361f]',
    textColor: 'text-white',
    number: '•••• 9988',
    cardType: 'Vé Tháng HSSV',
    subBadge: 'ICTU TRANSIT',
  },
]

export function VietcombankHero({ onOpenSeatPicker, onSearchRoute }: VietcombankHeroProps) {
  const [greeting, setGreeting] = useState({
    title: 'Chào buổi tối',
    icon: 'moon',
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCard, setActiveCard] = useState(0)
  const [isStackHovered, setIsStackHovered] = useState(false)
  const [isRightHovered, setIsRightHovered] = useState(false)

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) {
      setGreeting({ title: 'Chào buổi sáng', icon: 'sun' })
    } else if (hour >= 12 && hour < 18) {
      setGreeting({ title: 'Chào buổi chiều', icon: 'sun' })
    } else {
      setGreeting({ title: 'Chào buổi tối', icon: 'moon' })
    }
  }, [])

  // Mouse Wheel Scroll listener to cycle 3D cards
  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    let accumulatedDelta = 0

    const handleWheel = (e: WheelEvent) => {
      accumulatedDelta += e.deltaY
      if (Math.abs(accumulatedDelta) > 40) {
        if (accumulatedDelta > 0) {
          setActiveCard((prev) => (prev + 1) % CARDS.length)
        } else {
          setActiveCard((prev) => (prev - 1 + CARDS.length) % CARDS.length)
        }
        accumulatedDelta = 0
      }
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        accumulatedDelta = 0
      }, 150)
    }

    window.addEventListener('wheel', handleWheel, { passive: true })
    return () => {
      window.removeEventListener('wheel', handleWheel)
      clearTimeout(timeoutId)
    }
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      onSearchRoute?.(searchQuery.trim())
    } else {
      onOpenSeatPicker()
    }
  }

  return (
    <section
      aria-label="Hero ICTU Transit"
      className="relative flex-1 min-h-0 w-full flex flex-col justify-center select-none"
    >
      {/* Hero Content Stage */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-1 sm:py-3">
        <div className="grid grid-cols-1 gap-8 lg:gap-10 xl:gap-14 lg:grid-cols-[1fr_1.25fr] lg:items-center">
          {/* Left Column: Search-First & Personalized Greeting */}
          <div
            className={cn(
              'flex flex-col gap-4 sm:gap-5 transition-all duration-500 ease-out origin-left',
              isRightHovered && 'lg:opacity-90',
            )}
          >
            {/* Time-based Personalized Greeting floating directly without Glass Box */}
            <div className="animate-hero-1 flex w-fit items-center gap-3.5 transition-all">
              <div className="animate-sun-ambient flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-[#005A36] shadow-sm border border-white/90 backdrop-blur-xs">
                {greeting.icon === 'sun' ? (
                  <Sun size={24} strokeWidth={2.2} className="text-[#005A36]" />
                ) : (
                  <Moon size={24} strokeWidth={2.2} className="text-[#005A36]" />
                )}
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-black tracking-tight text-slate-950 leading-tight drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                  {greeting.title}
                </h1>
                <p className="text-sm sm:text-base font-bold text-slate-700 mt-0.5 drop-shadow-[0_1px_2px_rgba(255,255,255,0.85)]">
                  Bạn đang tìm kiếm chuyến xe nào hôm nay?
                </p>
              </div>
            </div>

            {/* Search-First Pill Input with Glassmorphism */}
            <form
              onSubmit={handleSearchSubmit}
              className="animate-hero-1 group relative flex w-full max-w-[460px] items-center hero-glass-search p-1.5 sm:p-2 pl-3 transition-all focus-within:ring-4 focus-within:ring-[#005A36]/15"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#005A36]">
                <Search size={22} strokeWidth={2.8} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tuyến xe buýt, trạm dừng..."
                className="w-full bg-transparent px-3 text-sm sm:text-base font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-medium outline-none"
              />
              <button
                type="submit"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#005A36] px-5 py-2.5 text-sm font-black text-white shadow-md transition-all duration-150 hover:bg-[#004529] hover:scale-[1.03] active:scale-95"
              >
                <span>Tìm xe</span>
                <ArrowRight size={16} strokeWidth={2.8} />
              </button>
            </form>

            {/* Sub-actions: Transparent Outline seat picker + Live fleet text indicator */}
            <div className="animate-hero-2 flex flex-col gap-2.5 pt-0.5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenSeatPicker}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#005A36] bg-transparent px-4 py-2 text-xs sm:text-sm font-bold text-[#005A36] shadow-xs transition-all hover:bg-[#005A36]/10 hover:border-[#005A36] hover:scale-[1.02] active:scale-95"
                >
                  <Ticket size={16} strokeWidth={2.2} />
                  <span>Đặt vé 28 chỗ trực quan</span>
                </button>
              </div>

              <div className="flex w-fit items-center gap-2 rounded-full hero-glass-card px-3.5 py-1.5 text-xs font-bold text-slate-800 shadow-xs">
                <span className="relative flex size-2.5 items-center justify-center">
                  <span className="absolute inline-flex h-4 w-4 rounded-full bg-emerald-500/35 animate-ping" />
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#005A36] opacity-75 animate-live-indicator" />
                  <span className="relative inline-flex size-2 rounded-full bg-[#005A36]" />
                </span>
                <span>12 xe buýt điện đang vận hành thời gian thực trên các tuyến</span>
              </div>
            </div>
          </div>

          {/* Right Column: CAMPAIGN, QR CODE & 3D LAYERED TRANSIT CARDS */}
          <div
            onMouseEnter={() => setIsRightHovered(true)}
            onMouseLeave={() => setIsRightHovered(false)}
            className={cn(
              'group/right-stage relative flex flex-col items-center lg:items-end justify-center w-full select-none cursor-pointer',
              'origin-center lg:origin-right transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) transform-gpu will-change-transform',
              'hover:scale-[1.04] sm:hover:scale-[1.055] lg:hover:scale-[1.07] hover:-translate-y-2.5',
              'hover:drop-shadow-[0_24px_48px_rgba(0,0,0,0.18)]',
              isRightHovered ? 'z-30' : 'z-10',
            )}
          >
            {/* Campaign Headline floating directly without Glass Box */}
            <div className="animate-hero-3 w-fit lg:ml-auto text-center lg:text-right mb-3 transition-all">
              <div className="relative overflow-hidden inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#005A36] bg-white/95 px-3.5 py-1 rounded-full border border-emerald-300/80 shadow-xs backdrop-blur-xs">
                <Sparkles size={13} className="text-[#005A36] animate-pulse" />
                <span>THẺ VÉ THÁNG HSSV TRỢ GIÁ 50%</span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-200/50 to-transparent animate-shimmer-sweep pointer-events-none" />
              </div>
              <h2 className="mt-2 text-2xl sm:text-3xl lg:text-[30px] font-black tracking-tight leading-tight select-none drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                <span className="text-slate-950">
                  ICTU Transit
                </span>{' '}
                <span className="font-black text-[#005A36]">
                  Bộ Sưu Tập Thẻ HSSV
                </span>
              </h2>
              <p className="mt-1.5 text-sm sm:text-base font-extrabold text-slate-900 leading-snug drop-shadow-[0_1px_2px_rgba(255,255,255,0.85)]">
                Đồng hành cùng sinh viên · Quét thẻ một chạm lên xe
              </p>
            </div>

            {/* Interactive Visual Stage: QR Code + Hand-Drawn Curved Arrow + Dynamic Scrollable 3D Cards */}
            <div className="animate-hero-3 relative w-full max-w-xl h-[240px] sm:h-[280px] lg:h-[300px]">
              {/* QR Code Card with Hand-drawn Curved Arrow */}
              <div className="absolute left-0 sm:left-2 top-1 z-20 flex flex-col items-center">
                <div className="relative overflow-hidden rounded-2xl border-2 border-white/95 bg-white/95 p-2.5 sm:p-3 shadow-2xl shadow-slate-900/15 backdrop-blur-xl transition-transform hover:scale-105">
                  {/* Active Laser Scanning Beam */}
                  <div className="pointer-events-none absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_10px_#10b981] animate-qr-scan z-10" />
                  <QRCodeSVG
                    value="https://ictu.transit.edu.vn"
                    size={82}
                    level="H"
                    includeMargin={false}
                    fgColor="#005A36"
                  />
                  <span className="mt-1 block text-center text-[10px] font-black text-[#005A36] tracking-wider">
                    APP ICTU BUS
                  </span>
                </div>

                {/* Annotation and Hand-Drawn SVG Arrow 1: Pointing directly UP into the QR Code frame */}
                <div className="relative mt-4 flex flex-col items-center">
                  {/* Sketched Hand-Drawn SVG Arrow 1 pointing straight into QR code bottom */}
                  <div className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2">
                    <svg
                      width="36"
                      height="22"
                      viewBox="0 0 36 22"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-[#005A36] drop-shadow-xs"
                    >
                      <path
                        d="M 18 20 C 22 13, 14 8, 18 2"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeDasharray="4 3"
                        className="animate-dash-flow"
                      />
                      <path
                        d="M 12 7 L 18 2 L 24 7"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <span className="inline-flex items-center text-xs font-black text-[#005A36] tracking-tight whitespace-nowrap [text-shadow:0_1px_2px_#ffffff,0_0_4px_#ffffff]">
                    Quét để tải ứng dụng
                  </span>
                </div>
              </div>

              {/* Annotation and Hand-Drawn SVG Arrow 2: Independent arrow pointing to card stack */}
              <div className="absolute top-[180px] sm:top-[185px] left-[15px] sm:left-[28px] lg:left-[40px] z-30 flex items-center">
                <div className="relative">
                  {/* Sketched Hand-Drawn SVG Arrow 2 curving UP-RIGHT directly touching edge of the card stack */}
                  <div className="pointer-events-none absolute -top-5 left-32 sm:left-36">
                    <svg
                      width="65"
                      height="36"
                      viewBox="0 0 65 36"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-[#005A36] drop-shadow-[0_1px_2px_#ffffff]"
                    >
                      <path
                        d="M 6 32 C 18 20, 36 12, 58 6"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray="4 3"
                        className="animate-dash-flow"
                      />
                      <path
                        d="M 46 3 L 60 6 L 50 15"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-slate-950 whitespace-nowrap [text-shadow:0_1px_3px_#ffffff,0_0_6px_#ffffff,0_0_2px_#ffffff]">
                    <span>Cuộn chuột đổi thẻ</span>
                    {/* Subtle mouse wheel icon */}
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="text-[#005A36] drop-shadow-[0_1px_1px_#ffffff]"
                    >
                      <rect x="5" y="2" width="14" height="20" rx="7" />
                      <path d="M12 6v4" strokeLinecap="round" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* 3D Layered Transit Cards Fan - Synchronous hover zoom on parent container */}
              <div
                onMouseEnter={() => setIsStackHovered(true)}
                onMouseLeave={() => setIsStackHovered(false)}
                className={cn(
                  'card-stack-wrapper group/cards absolute right-0 top-1 z-10 w-[280px] sm:w-[325px] lg:w-[365px] h-[155px] sm:h-[185px] lg:h-[210px] select-none perspective-[1200px] cursor-pointer transition-all duration-500 ease-out',
                  !isRightHovered && !isStackHovered && 'animate-card-levitate',
                  isStackHovered
                    ? 'scale-[1.03] -translate-y-1 drop-shadow-[0_24px_45px_rgba(0,0,0,0.28)]'
                    : 'drop-shadow-[0_15px_30px_rgba(0,0,0,0.16)]',
                )}
              >
                {CARDS.map((card, idx) => {
                  // Position relative to active card
                  const position = (idx - activeCard + CARDS.length) % CARDS.length
                  const isFront = position === 0

                  // Calculate 3D transformation for each fan position
                  const rotations = [-4, 4, 10, 16, 22]
                  const xOffsets = [0, 18, 36, 54, 70]
                  const yOffsets = [0, 6, 12, 18, 24]
                  const scales = [1, 0.97, 0.94, 0.91, 0.88]
                  const zIndexes = [30, 25, 20, 15, 10]

                  const rot = rotations[position] || 0
                  const tx = xOffsets[position] || 0
                  const ty = yOffsets[position] || 0
                  const sc = scales[position] || 0.8
                  const zIdx = zIndexes[position] || 10

                  return (
                    <div
                      key={card.id}
                      onClick={() => {
                        if (isFront) {
                          onOpenSeatPicker()
                        } else {
                          setActiveCard(idx)
                        }
                      }}
                      className={cn(
                        'absolute left-0 top-0 w-[210px] sm:w-[255px] lg:w-[285px] h-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border-2 transition-all duration-500 ease-out cursor-pointer',
                        `bg-gradient-to-br ${card.gradient}`,
                        isFront
                          ? 'border-white/95 ring-2 ring-black/10'
                          : 'border-white/60 opacity-90',
                      )}
                      style={{
                        transform: `rotate(${rot}deg) translate(${tx}px, ${ty}px) scale(${sc})`,
                        zIndex: zIdx,
                        transition: 'all 450ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}
                    >
                      {/* Card Texture Pattern */}
                      <div className="absolute inset-0 opacity-20 pointer-events-none [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />

                      <div className="relative z-10 flex h-full flex-col justify-between p-3 sm:p-4">
                        <div className="flex items-center justify-between">
                          <span className={cn('font-black text-[11px] sm:text-xs tracking-tight drop-shadow', card.textColor)}>
                            {card.subBadge}
                          </span>
                          <Wifi size={16} className={cn('rotate-90', card.textColor)} />
                        </div>

                        <div className="my-auto text-center">
                          <div className="inline-block rounded-md bg-black/20 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white/90">
                            {card.tag}
                          </div>
                          <div className={cn('text-base sm:text-lg lg:text-xl font-black tracking-wider drop-shadow-md mt-0.5', card.textColor)}>
                            {card.title}
                          </div>
                          <div className={cn('text-[9px] sm:text-[10px] font-serif italic mt-0.5 opacity-90', card.textColor)}>
                            {card.subtitle}
                          </div>
                        </div>

                        <div className="flex items-end justify-between">
                          <div className="flex items-center gap-1.5">
                            {/* Contactless RFID/NFC Bus Symbol */}
                            <div className="size-5 sm:size-6 rounded-md bg-white/20 border border-white/30 backdrop-blur-sm shadow-xs flex items-center justify-center">
                              <Radio size={12} className={card.textColor} />
                            </div>
                            <span className={cn('text-[10px] sm:text-[11px] font-mono font-black tracking-widest drop-shadow', card.textColor)}>
                              {card.number}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className={cn('block text-[11px] sm:text-xs font-black tracking-wider drop-shadow', card.textColor)}>
                              ICTU TRANSIT
                            </span>
                            <span className={cn('block text-[7px] sm:text-[8px] font-bold opacity-90', card.textColor)}>
                              {card.cardType}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
