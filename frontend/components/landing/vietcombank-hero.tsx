'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Building2,
  Bus,
  Compass,
  Gift,
  GraduationCap,
  MapPin,
  Moon,
  QrCode,
  Radio,
  RotateCw,
  Route,
  Search,
  Sparkles,
  Sun,
  Ticket,
  Wifi,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/utils/haptics'

interface VietcombankHeroProps {
  onOpenSeatPicker: () => void
  onSearchRoute?: (query: string) => void
  onOpenModal?: (modal: 'routes' | 'news' | 'student-pass' | 'lookup') => void
  onOpenTicketModal?: () => void
  onOpenVoucherVault?: () => void
}

const POPULAR_STATIONS = [
  {
    name: 'ĐH CNTT & TT Thái Nguyên',
    desc: 'Trạm cổng chính ICTU · Điểm đón xe buýt điện số 1',
    Icon: GraduationCap,
    iconBoxClass: 'bg-emerald-100 text-[#005A36]',
  },
  {
    name: 'Bến Xe Trung Tâm Thái Nguyên',
    desc: 'Trạm trung chuyển liên tỉnh & nội đô TP Thái Nguyên',
    Icon: Building2,
    iconBoxClass: 'bg-blue-100 text-blue-700',
  },
  {
    name: 'Ký Túc Xá ICTU',
    desc: 'Trạm nội khu giảng đường & khu nhà ở sinh viên',
    Icon: MapPin,
    iconBoxClass: 'bg-amber-100 text-amber-700',
  },
  {
    name: 'Khu Công Nghiệp Sông Công',
    desc: 'Trạm ga phía Nam tuyến CT-02',
    Icon: Route,
    iconBoxClass: 'bg-teal-100 text-teal-700',
  },
]

const POPULAR_ROUTES = [
  {
    code: 'CT-01',
    name: 'ICTU ↔ Bến Xe',
    freq: '15p/chuyến · Buýt điện',
    Icon: Bus,
    iconBoxClass: 'bg-emerald-100 text-[#005A36]',
    badgeClass: 'bg-[#005A36] text-white',
    hoverBorderClass: 'hover:border-emerald-300 hover:bg-emerald-50/80',
    hoverTextClass: 'group-hover/route:text-[#005A36]',
  },
  {
    code: 'CT-02',
    name: 'Campus Loop',
    freq: '20p/chuyến · SV ICTU',
    Icon: RotateCw,
    iconBoxClass: 'bg-teal-100 text-teal-800',
    badgeClass: 'bg-teal-800 text-white',
    hoverBorderClass: 'hover:border-teal-300 hover:bg-teal-50/80',
    hoverTextClass: 'group-hover/route:text-teal-800',
  },
]

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

function getInitialGreeting() {
  if (typeof window === 'undefined') {
    return { title: 'Chào buổi chiều', icon: 'sun' }
  }
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) {
    return { title: 'Chào buổi sáng', icon: 'sun' }
  }
  if (hour >= 12 && hour < 18) {
    return { title: 'Chào buổi chiều', icon: 'sun' }
  }
  return { title: 'Chào buổi tối', icon: 'moon' }
}

export function VietcombankHero({
  onOpenSeatPicker,
  onSearchRoute,
  onOpenModal,
  onOpenTicketModal,
  onOpenVoucherVault,
}: VietcombankHeroProps) {
  const [greeting] = useState(getInitialGreeting)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const [activeCard, setActiveCard] = useState(0)
  const [isStackHovered, setIsStackHovered] = useState(false)
  const [isRightHovered, setIsRightHovered] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Mouse Wheel Scroll listener to cycle 3D cards only when hovering the stack
  useEffect(() => {
    if (!isStackHovered) return

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
        haptic.play('tap')
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
  }, [isStackHovered])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    haptic.play('tap')
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
      {/* ===================================================================
          DESKTOP HERO (>= lg): 100.00% EXACT BASELINE CODE & GEOMETRY
          =================================================================== */}
      <div className="hidden lg:block w-full">
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
                  {/* Dòng dẫn phía trên H1: 26px (24-28px), weight 600 (lg:font-semibold) on desktop */}
                  <p className="text-2xl sm:text-3xl lg:text-[26px] font-black sm:font-black lg:font-semibold tracking-tight text-slate-950 lg:text-slate-800 leading-tight">
                    {greeting.title}
                  </p>
                  {/* Câu phụ đề: hạ xuống p, cỡ 18-20px, weight 500, màu xanh đậm */}
                  <p className="text-sm sm:text-base lg:text-[19px] font-bold sm:font-bold lg:font-medium text-slate-700 lg:text-[#005A36] mt-0.5 lg:mt-1 lg:leading-snug">
                    Bạn đang tìm kiếm chuyến xe nào hôm nay?
                  </p>
                </div>
              </div>

              {/* Search-First Pill Input with Glassmorphism and Instant Popover */}
              <div ref={searchContainerRef} className="relative w-full max-w-[460px] z-30">
                <form
                  onSubmit={handleSearchSubmit}
                  className="animate-hero-1 group relative flex w-full items-center hero-glass-search p-1.5 sm:p-2 pl-3 transition-all focus-within:ring-4 focus-within:ring-[#005A36]/15"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#005A36]">
                    <Search size={22} strokeWidth={2.8} />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onFocus={() => setIsSearchFocused(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setIsSearchFocused(true)
                    }}
                    placeholder="Tìm tuyến xe buýt, trạm dừng..."
                    className="w-full bg-transparent px-3 text-sm sm:text-base font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-medium outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#005A36] px-5 py-2.5 text-sm font-black text-white shadow-md transition-all duration-150 hover:bg-[#004529] hover:scale-[1.03] active:scale-95 cursor-pointer touch-press touch-manipulation"
                  >
                    <span>Tìm xe</span>
                    <ArrowRight size={16} strokeWidth={2.8} />
                  </button>
                </form>

                {/* Instant Search Dropdown Popover */}
                {isSearchFocused && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-40 rounded-2xl bg-white/95 border border-slate-200/90 p-3 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150 text-left max-h-[65vh] sm:max-h-[75vh] overflow-y-auto scroll-touch">
                    {/* Quick Stations */}
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 px-1 flex items-center justify-between sticky top-0 bg-white/95 py-0.5 backdrop-blur-xs z-10">
                      <span>Trạm dừng đón trả phổ biến</span>
                      <button
                        type="button"
                        onClick={() => setIsSearchFocused(false)}
                        className="text-slate-400 hover:text-slate-600 sm:hidden text-xs font-bold px-1"
                      >
                        Đóng
                      </button>
                    </div>
                    <div className="space-y-1">
                      {POPULAR_STATIONS.filter(
                        (st) =>
                          !searchQuery.trim() ||
                          st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          st.desc.toLowerCase().includes(searchQuery.toLowerCase()),
                      ).map((st) => (
                        <button
                          key={st.name}
                          type="button"
                          onClick={() => {
                            haptic.play('select')
                            setSearchQuery(st.name)
                            setIsSearchFocused(false)
                            onSearchRoute?.(st.name)
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-emerald-50 text-left transition-colors group/item touch-press active:bg-emerald-100/70 cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="size-8 rounded-lg bg-emerald-100 text-[#005A36] flex items-center justify-center shrink-0 shadow-xs">
                              <MapPin size={15} strokeWidth={2.5} />
                            </div>
                            <div className="truncate min-w-0">
                              <span className="text-sm font-bold text-slate-800 group-hover/item:text-[#005A36] block truncate">
                                {st.name}
                              </span>
                              <span className="text-xs text-slate-400 block truncate">
                                {st.desc}
                              </span>
                            </div>
                          </div>
                          <ArrowRight
                            size={14}
                            className="text-slate-300 group-hover/item:text-[#005A36] transition-transform group-hover/item:translate-x-1 shrink-0 ml-2"
                          />
                        </button>
                      ))}
                    </div>

                    {/* Quick Routes */}
                    <div className="pt-2 mt-2 border-t border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 px-1 flex items-center justify-between">
                      <span>Tuyến buýt đang vận hành</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {POPULAR_ROUTES.map((route) => (
                        <button
                          key={route.code}
                          type="button"
                          onClick={() => {
                            haptic.play('select')
                            setSearchQuery(route.code)
                            setIsSearchFocused(false)
                            onSearchRoute?.(route.code)
                          }}
                          className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 transition-all text-left touch-press active:scale-95 cursor-pointer"
                        >
                          <span className="px-1.5 py-0.5 rounded-md bg-[#005A36] text-[10px] font-black text-white shrink-0">
                            {route.code}
                          </span>
                          <div className="truncate min-w-0">
                            <span className="text-xs font-bold text-slate-800 block truncate">
                              {route.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {route.freq}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                <div className="relative overflow-hidden inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#005A36] bg-white/95 px-3.5 py-1 rounded-full border border-emerald-300/80 shadow-xs">
                  <Sparkles size={13} className="text-[#005A36] animate-pulse" />
                  <span>THẺ VÉ THÁNG HSSV TRỢ GIÁ 50%</span>
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-200/50 to-transparent animate-shimmer-sweep pointer-events-none" />
                </div>
                <h1 className="mt-2 text-2xl sm:text-3xl lg:text-[30px] font-black tracking-tight leading-tight select-none drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                  <span className="text-slate-950">
                    ICTU Transit
                  </span>{' '}
                  <span className="font-black text-[#005A36]">
                    Bộ Sưu Tập Thẻ HSSV
                  </span>
                </h1>
                <p className="mt-1.5 text-sm sm:text-base font-extrabold text-slate-900 leading-snug drop-shadow-[0_1px_2px_rgba(255,255,255,0.85)]">
                  Đồng hành cùng sinh viên · Quét thẻ một chạm lên xe
                </p>
              </div>

              {/* Interactive Visual Stage: QR Code + Hand-Drawn Curved Arrow + Dynamic Scrollable 3D Cards */}
              <div className="animate-hero-3 relative w-full max-w-xl h-[240px] sm:h-[280px] lg:h-[300px]">
                {/* QR Code Card with Hand-drawn Curved Arrow (Desktop Only) */}
                <div className="hidden sm:flex absolute left-0 sm:left-2 top-1 z-20 flex-col items-center">
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

                    <span className="inline-flex items-center text-xs font-black text-[#005A36] tracking-tight whitespace-nowrap [text-shadow:0_1px_2px_#ffffff,0_0_4px_#ffffff] lg:[text-shadow:none] lg:font-bold lg:px-2.5 lg:py-1 lg:rounded-full lg:bg-white/70 lg:border lg:border-white/80 lg:shadow-xs">
                      Quét để tải ứng dụng
                    </span>
                  </div>
                </div>

                {/* Annotation and Hand-Drawn SVG Arrow 2: Independent arrow pointing to card stack (Desktop Only) */}
                <div className="hidden sm:flex absolute top-[180px] sm:top-[185px] left-[15px] sm:left-[28px] lg:left-[40px] z-30 items-center">
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

                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-slate-950 whitespace-nowrap [text-shadow:0_1px_3px_#ffffff,0_0_6px_#ffffff,0_0_2px_#ffffff] lg:[text-shadow:none] lg:font-bold lg:px-2.5 lg:py-1 lg:rounded-full lg:bg-white/70 lg:border lg:border-white/80 lg:shadow-xs">
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

                {/* 3D Layered Transit Cards Fan */}
                <div
                  onMouseEnter={() => setIsStackHovered(true)}
                  onMouseLeave={() => setIsStackHovered(false)}
                  className={cn(
                    'card-stack-wrapper group/cards absolute right-0 sm:right-0 max-sm:left-1/2 max-sm:-translate-x-1/2 top-1 z-10 w-[280px] sm:w-[325px] lg:w-[365px] h-[155px] sm:h-[185px] lg:h-[210px] select-none perspective-[1200px] cursor-pointer transition-all duration-500 ease-out',
                    !isRightHovered && !isStackHovered && 'animate-card-levitate',
                    isStackHovered
                      ? 'scale-[1.03] -translate-y-1 drop-shadow-[0_24px_45px_rgba(0,0,0,0.28)]'
                      : 'drop-shadow-[0_15px_30px_rgba(0,0,0,0.16)]',
                  )}
                >
                  {CARDS.map((card, idx) => {
                    const position = (idx - activeCard + CARDS.length) % CARDS.length
                    const isFront = position === 0

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
                          haptic.play('pop')
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
      </div>

      {/* ===================================================================
          MOBILE HERO (< lg): REFINED ACCORDING TO REQUIREMENTS B, C, D
          Order: 1. Header -> 2. Kicker -> 3. Search -> 4. Quick Actions
                 -> 5. Campaign Badge -> 6. H1 -> 7. Stack thẻ 3D
          =================================================================== */}
      <div className="lg:hidden w-full">
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-2 flex flex-col gap-3">
          {/* 2. Kicker "Chào buổi chiều" */}
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-[#005A36] shadow-sm border border-white/90">
              {greeting.icon === 'sun' ? (
                <Sun size={20} strokeWidth={2.2} className="text-[#005A36]" />
              ) : (
                <Moon size={20} strokeWidth={2.2} className="text-[#005A36]" />
              )}
            </div>
            <div>
              <p className="text-[19px] font-semibold tracking-tight text-slate-900 leading-tight">
                {greeting.title}
              </p>
            </div>
          </div>

          {/* 3. Ô tìm kiếm */}
          <div className="relative w-full z-30">
            <form
              onSubmit={handleSearchSubmit}
              className="group relative flex w-full items-center hero-glass-search p-1.5 pl-3 transition-all focus-within:ring-4 focus-within:ring-[#005A36]/15"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#005A36]">
                <Search size={20} strokeWidth={2.6} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setIsSearchFocused(true)
                }}
                placeholder="Tìm tuyến xe buýt, trạm dừng..."
                className="w-full bg-transparent px-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-medium outline-none"
              />
              <button
                type="submit"
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#005A36] px-4 py-2 text-xs font-black text-white shadow-md active:scale-95 cursor-pointer touch-press"
              >
                <span>Tìm xe</span>
                <ArrowRight size={14} strokeWidth={2.6} />
              </button>
            </form>

            {/* Instant Search Dropdown Popover */}
            {isSearchFocused && (
              <div className="absolute top-full left-0 right-0 mt-2 z-40 rounded-2xl bg-white/95 border border-slate-200/90 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150 text-left max-h-[60vh] overflow-y-auto scroll-touch">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 px-1 flex items-center justify-between sticky top-0 bg-white/95 py-0.5 z-10">
                  <span>Trạm dừng đón trả phổ biến</span>
                  <button
                    type="button"
                    onClick={() => setIsSearchFocused(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
                  >
                    Đóng
                  </button>
                </div>
                <div className="space-y-0.5">
                  {POPULAR_STATIONS.filter(
                    (st) =>
                      !searchQuery.trim() ||
                      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      st.desc.toLowerCase().includes(searchQuery.toLowerCase()),
                  ).slice(0, 3).map((st) => (
                    <button
                      key={st.name}
                      type="button"
                      onClick={() => {
                        haptic.play('select')
                        setSearchQuery(st.name)
                        setIsSearchFocused(false)
                        onSearchRoute?.(st.name)
                      }}
                      className="w-full flex items-center justify-between p-1.5 rounded-xl hover:bg-emerald-50 text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="size-6 rounded-md bg-emerald-100 text-[#005A36] flex items-center justify-center shrink-0">
                          <MapPin size={12} strokeWidth={2.4} />
                        </div>
                        <div className="truncate min-w-0">
                          <span className="text-xs font-bold text-slate-800 block truncate">
                            {st.name}
                          </span>
                        </div>
                      </div>
                      <ArrowRight size={12} className="text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. Thẻ kính Quick Actions */}
          <div className="w-full rounded-2xl bg-white/80 border border-white/90 p-1.5 shadow-xs backdrop-blur-md">
            <div className="grid grid-cols-5 gap-1 items-stretch">
              <button
                type="button"
                onClick={() => {
                  haptic.play('tap')
                  onOpenModal?.('routes')
                }}
                className="min-h-[44px] flex flex-col items-center justify-center p-1 rounded-xl active:scale-[0.96] active:bg-white/70 transition-all touch-press cursor-pointer"
              >
                <div className="relative size-8 rounded-xl bg-emerald-50 text-[#005A36] border border-emerald-100 flex items-center justify-center shadow-2xs">
                  <Compass size={18} strokeWidth={2.2} />
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                </div>
                <span className="text-[11px] font-bold text-slate-800 truncate mt-1">Gợi ý xe</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  haptic.play('tap')
                  if (onOpenVoucherVault) onOpenVoucherVault()
                  else onOpenModal?.('news')
                }}
                className="min-h-[44px] flex flex-col items-center justify-center p-1 rounded-xl active:scale-[0.96] active:bg-white/70 transition-all touch-press cursor-pointer"
              >
                <div className="relative size-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shadow-2xs">
                  <Gift size={18} strokeWidth={2.2} />
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-rose-500 ring-2 ring-white" />
                </div>
                <span className="text-[11px] font-bold text-slate-800 truncate mt-1">Voucher</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  haptic.play('tap')
                  onOpenModal?.('student-pass')
                }}
                className="min-h-[44px] flex flex-col items-center justify-center p-1 rounded-xl active:scale-[0.96] active:bg-white/70 transition-all touch-press cursor-pointer"
              >
                <div className="relative size-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center shadow-2xs">
                  <GraduationCap size={18} strokeWidth={2.2} />
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-500 ring-2 ring-white" />
                </div>
                <span className="text-[11px] font-bold text-slate-800 truncate mt-1">Vé tháng</span>
              </button>

              <button
                type="button"
                id="mobile-quick-action-buy-ticket"
                onClick={() => {
                  haptic.play('tap')
                  onOpenSeatPicker()
                }}
                className="min-h-[44px] flex flex-col items-center justify-center p-1 rounded-xl active:scale-[0.96] active:bg-white/70 transition-all touch-press cursor-pointer"
              >
                <div className="relative size-8 rounded-xl bg-teal-50 text-[#005A36] border border-teal-100 flex items-center justify-center shadow-2xs">
                  <Ticket size={18} strokeWidth={2.2} />
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[#005A36] ring-2 ring-white" />
                </div>
                <span className="text-[11px] font-bold text-slate-800 truncate mt-1">Mua vé</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  haptic.play('tap')
                  if (onOpenTicketModal) onOpenTicketModal()
                  else onOpenModal?.('lookup')
                }}
                className="min-h-[44px] flex flex-col items-center justify-center p-1 rounded-xl active:scale-[0.96] active:bg-white/70 transition-all touch-press cursor-pointer"
              >
                <div className="relative size-8 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shadow-2xs">
                  <QrCode size={18} strokeWidth={2.2} />
                </div>
                <span className="text-[11px] font-bold text-slate-800 truncate mt-1">Tra cứu</span>
              </button>
            </div>
          </div>

          {/* 5. Campaign Badge & 6. H1 */}
          <div className="w-fit mx-auto text-center mt-1">
            <div className="relative overflow-hidden inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#005A36] bg-white/95 px-3 py-0.5 rounded-full border border-emerald-300/80 shadow-xs">
              <Sparkles size={12} className="text-[#005A36] animate-pulse" />
              <span>THẺ VÉ THÁNG HSSV TRỢ GIÁ 50%</span>
            </div>
            <h1 className="mt-1 text-[clamp(26px,7vw,32px)] font-black tracking-tight leading-tight select-none [text-wrap:balance]">
              <span className="text-slate-950 inline">ICTU Transit</span>{' '}
              <span className="font-black text-[#005A36] inline-block">
                Bộ Sưu Tập Thẻ HSSV
              </span>
            </h1>
            <p className="mt-0.5 text-xs font-bold text-slate-700 leading-snug">
              Đồng hành cùng sinh viên · Quét thẻ một chạm lên xe
            </p>
          </div>

          {/* 7. Stack thẻ 3D - thu nhỏ vừa chiều ngang, swipe đổi thẻ */}
          <div className="relative w-full h-[155px] flex items-center justify-center overflow-x-clip">
            <div
              onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (touchStartX === null) return
                const diff = e.changedTouches[0].clientX - touchStartX
                if (Math.abs(diff) > 30) {
                  if (diff < 0) {
                    setActiveCard((prev) => (prev + 1) % CARDS.length)
                  } else {
                    setActiveCard((prev) => (prev - 1 + CARDS.length) % CARDS.length)
                  }
                  haptic.play('tap')
                }
                setTouchStartX(null)
              }}
              className="relative w-[240px] xs:w-[260px] h-[145px] select-none perspective-[1200px] cursor-pointer"
            >
              {CARDS.map((card, idx) => {
                const position = (idx - activeCard + CARDS.length) % CARDS.length
                const isFront = position === 0

                const rotations = [-4, 3, 8, 14, 20]
                const xOffsets = [0, 12, 24, 36, 48]
                const yOffsets = [0, 5, 10, 15, 20]
                const scales = [1, 0.97, 0.94, 0.91, 0.88]
                const zIndexes = [30, 25, 20, 15, 10]

                const rot = rotations[position] || 0
                const tx = xOffsets[position] || 0
                const ty = yOffsets[position] || 0
                const sc = scales[position] || 0.88
                const zIdx = zIndexes[position] || 10

                return (
                  <div
                    key={card.id}
                    onClick={() => {
                      haptic.play('pop')
                      if (isFront) {
                        onOpenSeatPicker()
                      } else {
                        setActiveCard(idx)
                      }
                    }}
                    className={cn(
                      'absolute left-0 top-0 w-[185px] xs:w-[200px] h-full rounded-2xl overflow-hidden shadow-lg border-2 transition-all duration-300 ease-out cursor-pointer',
                      `bg-gradient-to-br ${card.gradient}`,
                      isFront
                        ? 'border-white/95 ring-2 ring-black/10'
                        : 'border-white/60 opacity-90',
                    )}
                    style={{
                      transform: `rotate(${rot}deg) translate(${tx}px, ${ty}px) scale(${sc})`,
                      zIndex: zIdx,
                    }}
                  >
                    <div className="absolute inset-0 opacity-20 pointer-events-none [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
                    <div className="relative z-10 flex h-full flex-col justify-between p-3">
                      <div className="flex items-center justify-between">
                        <span className={cn('font-black text-[11px] tracking-tight drop-shadow', card.textColor)}>
                          {card.subBadge}
                        </span>
                        <Wifi size={14} className={cn('rotate-90', card.textColor)} />
                      </div>

                      <div className="my-auto text-center">
                        <div className="inline-block rounded-md bg-black/20 px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wider text-white/90">
                          {card.tag}
                        </div>
                        <div className={cn('text-sm font-black tracking-wider drop-shadow-md mt-0.5', card.textColor)}>
                          {card.title}
                        </div>
                        <div className={cn('text-[9px] font-serif italic mt-0.5 opacity-90', card.textColor)}>
                          {card.subtitle}
                        </div>
                      </div>

                      <div className="flex items-end justify-between">
                        <div className="flex items-center gap-1">
                          <div className="size-4 rounded-md bg-white/20 border border-white/30 backdrop-blur-sm shadow-xs flex items-center justify-center">
                            <Radio size={10} className={card.textColor} />
                          </div>
                          <span className={cn('text-[9px] font-mono font-black tracking-widest drop-shadow', card.textColor)}>
                            {card.number}
                          </span>
                        </div>
                        <span className={cn('block text-[7px] font-bold opacity-90', card.textColor)}>
                          {card.cardType}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
