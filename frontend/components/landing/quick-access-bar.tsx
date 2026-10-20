'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Compass,
  Gift,
  GraduationCap,
  QrCode,
  Ticket,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/utils/haptics'

interface QuickAccessBarProps {
  onOpenSeatPicker: () => void
  onOpenModal: (modal: 'routes' | 'news' | 'student-pass' | 'lookup') => void
  onOpenTicketModal?: () => void
  onOpenVoucherVault?: () => void
}

export function QuickAccessBar({
  onOpenSeatPicker,
  onOpenModal,
  onOpenTicketModal,
  onOpenVoucherVault,
}: QuickAccessBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const activeIndexRef = useRef<number | null>(null)
  const rafId = useRef<number | null>(null)
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Lens feature detection (Desktop Chromium only)
  const [isChromiumLens, setIsChromiumLens] = useState(false)

  // Sliding pill indicator coordinates
  const [indicator, setIndicator] = useState<{
    x: number
    y: number
    width: number
    height: number
    opacity: number
  }>({ x: 0, y: 0, width: 0, height: 0, opacity: 0 })

  const items = [
    {
      id: 'suggest',
      icon: Compass,
      label: 'Gợi ý tuyến xe',
      sublabel: 'Lộ trình tối ưu',
      badge: 'Đề xuất',
      badgeColor: 'bg-emerald-600 text-white',
      onClick: () => onOpenModal('routes'),
    },
    {
      id: 'vouchers',
      icon: Gift,
      label: 'Kho Voucher',
      sublabel: 'Ưu đãi & Khuyến mãi',
      badge: 'HOT',
      badgeColor: 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-rose-500/20',
      onClick: () => {
        if (onOpenVoucherVault) {
          onOpenVoucherVault()
        } else {
          onOpenModal('news')
        }
      },
    },
    {
      id: 'student-pass',
      icon: GraduationCap,
      label: 'Đăng ký vé tháng',
      sublabel: 'Trợ giá sinh viên',
      badge: '-50% HSSV',
      badgeColor: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/20',
      onClick: () => onOpenModal('student-pass'),
    },
    {
      id: 'buy-ticket',
      icon: Ticket,
      label: 'Mua vé lượt 28 chỗ',
      sublabel: 'Sơ đồ trực quan',
      badge: 'Trực quan',
      badgeColor: 'bg-[#005A36] text-white',
      onClick: onOpenSeatPicker,
    },
    {
      id: 'tracking',
      icon: QrCode,
      label: 'Tra cứu & Vé đã mua',
      sublabel: 'Quản lý vé & QR Code',
      badge: null,
      badgeColor: '',
      onClick: () => {
        if (onOpenTicketModal) {
          onOpenTicketModal()
        } else {
          onOpenModal('lookup')
        }
      },
    },
  ]

  // Detect Chromium Desktop environment for SVG lens progressive enhancement
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isDesktop = window.matchMedia('(min-width: 768px)').matches
    const isChromium =
      Boolean((window as any).chrome) &&
      !navigator.userAgent.includes('Firefox') &&
      !navigator.userAgent.includes('FxiOS')

    if (isDesktop && isChromium) {
      setIsChromiumLens(true)
    }
  }, [])

  // Move the glass sliding indicator to active/hovered/focused card
  // Uses offsetLeft, offsetTop, offsetWidth, offsetHeight + uniform 4px padding
  const updateIndicator = useCallback((index: number) => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(max-width: 767px)').matches) {
      setIndicator((prev) => (prev.opacity === 0 ? prev : { ...prev, opacity: 0 }))
      return
    }

    const scrollContainer = scrollRef.current
    const item = itemRefs.current[index]
    if (!scrollContainer || !item) return

    // Position relative to scrollRef (offsetParent), unaffected by CSS transforms
    const padding = 4
    const x = item.offsetLeft - padding
    const y = item.offsetTop - padding
    const width = item.offsetWidth + padding * 2
    const height = item.offsetHeight + padding * 2

    setIndicator({
      x,
      y,
      width,
      height,
      opacity: 1,
    })
  }, [])

  // Listen to container resize using ResizeObserver
  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl || typeof ResizeObserver === 'undefined') return

    const ro = new ResizeObserver(() => {
      if (activeIndexRef.current !== null) {
        updateIndicator(activeIndexRef.current)
      }
    })
    ro.observe(scrollEl)
    return () => ro.disconnect()
  }, [updateIndicator])

  // Recalculate on scroll in horizontal scrolling zone
  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const handleScroll = () => {
      if (activeIndexRef.current !== null) {
        updateIndicator(activeIndexRef.current)
      }
    }
    scrollEl.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollEl.removeEventListener('scroll', handleScroll)
  }, [updateIndicator])

  // Recalculate when web fonts finish rendering to prevent layout shift
  useEffect(() => {
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => {
        if (activeIndexRef.current !== null) {
          updateIndicator(activeIndexRef.current)
        }
      })
    }
  }, [updateIndicator])

  // Window resize listener
  useEffect(() => {
    const handleResize = () => {
      if (activeIndexRef.current !== null) {
        updateIndicator(activeIndexRef.current)
      } else {
        setIndicator((prev) => ({ ...prev, opacity: 0 }))
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [updateIndicator])

  // Pointer spotlight tracking with requestAnimationFrame throttling
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(max-width: 767px), (prefers-reduced-motion: reduce)').matches) {
      return
    }
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (rafId.current !== null) cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => {
      container.style.setProperty('--x', `${x}px`)
      container.style.setProperty('--y', `${y}px`)
      container.style.setProperty('--mouse-opacity', '1')
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.style.setProperty('--mouse-opacity', '0')
      const activeEl = document.activeElement
      if (!containerRef.current.contains(activeEl)) {
        activeIndexRef.current = null
        setIndicator((prev) => ({ ...prev, opacity: 0 }))
      }
    }
  }, [])

  // Comprehensive cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
      }
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
        blurTimeoutRef.current = null
      }
    }
  }, [])

  return (
    <section
      aria-label="Thanh truy cập nhanh"
      className="relative z-20 shrink-0 px-3 sm:px-6 lg:px-8 pb-5 sm:pb-7 lg:pb-8 mb-1 select-none w-full"
    >
      {/* Progressive Enhancement: SVG Lens Displacement Refraction Filter (scale: 10 for subtle refraction) */}
      <svg
        className="sr-only pointer-events-none absolute -top-[9999px] -left-[9999px]"
        width="0"
        height="0"
        aria-hidden="true"
      >
        <defs>
          <filter id="lens" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          </filter>
        </defs>
      </svg>

      <div className="mx-auto max-w-5xl">
        {/* iOS 26/27 Ultra-Clean Liquid Glassmorphism Dock */}
        <div
          ref={containerRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={handleMouseLeave}
          className={cn(
            'animate-hero-4 dock-glass-liquid p-2 sm:p-2.5 shadow-2xl relative',
            isChromiumLens && 'is-chromium-lens',
          )}
        >
          {/* Mouse Spotlight Glow */}
          <div className="dock-glass-spotlight" />

          {/* Relative Wrapper for Cards & Sliding Pill */}
          <div
            ref={scrollRef}
            className="relative flex md:grid md:grid-cols-5 gap-2 lg:gap-3 items-stretch overflow-x-auto md:overflow-visible no-scrollbar p-1"
          >
            {/* Sliding Pill Indicator: perfectly covers card from top of badge to bottom of subtitle + 4px padding */}
            <div
              className="dock-glass-slider"
              style={{
                transform: `translate(${indicator.x}px, ${indicator.y}px)`,
                width: `${indicator.width}px`,
                height: `${indicator.height}px`,
                opacity: indicator.opacity,
              }}
              aria-hidden="true"
            />

            {items.map((item, idx) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  data-dock-card={item.id}
                  ref={(el) => {
                    itemRefs.current[idx] = el
                  }}
                  type="button"
                  onPointerEnter={() => {
                    activeIndexRef.current = idx
                    updateIndicator(idx)
                  }}
                  onMouseEnter={() => {
                    activeIndexRef.current = idx
                    updateIndicator(idx)
                  }}
                  onMouseMove={() => {
                    if (activeIndexRef.current !== idx || indicator.opacity === 0) {
                      activeIndexRef.current = idx
                      updateIndicator(idx)
                    }
                  }}
                  onFocus={() => {
                    activeIndexRef.current = idx
                    updateIndicator(idx)
                  }}
                  onBlur={() => {
                    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
                    blurTimeoutRef.current = setTimeout(() => {
                      if (
                        containerRef.current &&
                        !containerRef.current.contains(document.activeElement)
                      ) {
                        activeIndexRef.current = null
                        setIndicator((prev) => ({ ...prev, opacity: 0 }))
                      }
                    }, 60)
                  }}
                  onClick={() => {
                    haptic.play('tap')
                    item.onClick()
                  }}
                  className="group relative flex flex-col items-center justify-between rounded-2xl pt-2 pb-2 px-2 text-center dock-tile-glass cursor-pointer min-h-[110px] min-w-[136px] md:min-w-0 shrink-0 snap-center"
                >
                  {/* Badge Row (Uniform 22px height: badge is completely inside the card and pill) */}
                  <div className="w-full h-[22px] flex items-center justify-center pointer-events-none">
                    {item.badge ? (
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-[9.5px] font-black tracking-tight shadow-xs ring-1 ring-white/95 whitespace-nowrap',
                          item.badgeColor,
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : (
                      <div className="h-[18px]" />
                    )}
                  </div>

                  {/* Dedicated Icon Container: Crisp White Pill in normal state, Deep Forest Green on Hover */}
                  <div className="dock-icon-box">
                    <Icon size={20} strokeWidth={2.3} />
                  </div>

                  {/* Clean Typography Hierarchy: No text-shadow, antialiased and optimizeLegibility */}
                  <div className="w-full mt-1.5 flex flex-col items-center pointer-events-none">
                    <span className="dock-card-title line-clamp-1">
                      {item.label}
                    </span>
                    <span className="dock-card-subtitle line-clamp-1">
                      {item.sublabel}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
