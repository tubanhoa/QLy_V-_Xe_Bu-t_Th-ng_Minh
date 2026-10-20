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
  const updateIndicator = useCallback((index: number) => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(max-width: 767px)').matches) {
      setIndicator((prev) => (prev.opacity === 0 ? prev : { ...prev, opacity: 0 }))
      return
    }

    const container = containerRef.current
    const item = itemRefs.current[index]
    if (!container || !item) return

    const containerRect = container.getBoundingClientRect()
    const itemRect = item.getBoundingClientRect()

    // Position relative to container, inherently accounting for any horizontal scroll offset
    const x = itemRect.left - containerRect.left
    const y = itemRect.top - containerRect.top

    setIndicator({
      x,
      y,
      width: itemRect.width,
      height: itemRect.height,
      opacity: 1,
    })
  }, [])

  // Listen to container resize using ResizeObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return

    const ro = new ResizeObserver(() => {
      if (activeIndexRef.current !== null) {
        updateIndicator(activeIndexRef.current)
      }
    })
    ro.observe(container)
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
      className="relative z-20 shrink-0 px-3 sm:px-6 lg:px-8 pb-3 sm:pb-4 select-none w-full"
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

          {/* Sliding Pill Indicator for iOS Fluid Spring Animation (transform animated) */}
          <div
            className="dock-glass-slider"
            style={{
              transform: `translate3d(${indicator.x}px, ${indicator.y}px, 0)`,
              width: `${indicator.width}px`,
              height: `${indicator.height}px`,
              opacity: indicator.opacity,
            }}
            aria-hidden="true"
          />

          {/* 5 Cards Container: Horizontal Scroll on Mobile with Top Headroom (pt-4) to prevent badge clipping */}
          <div
            ref={scrollRef}
            className="flex md:grid md:grid-cols-5 gap-2 lg:gap-3 items-stretch overflow-x-auto md:overflow-visible no-scrollbar pt-4 pb-1 px-1"
          >
            {items.map((item, idx) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[idx] = el
                  }}
                  type="button"
                  onPointerEnter={() => {
                    activeIndexRef.current = idx
                    updateIndicator(idx)
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
                  className="group relative flex flex-col items-center justify-between rounded-2xl pt-3 pb-2.5 px-2 text-center dock-tile-glass cursor-pointer touch-press touch-manipulation min-h-[98px] min-w-[136px] md:min-w-0 shrink-0 snap-center"
                >
                  {/* Floating Pill Badge with Micro Glow (fully contained within pt-4 headroom) */}
                  {item.badge && (
                    <span
                      className={cn(
                        'absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 rounded-full px-2.5 py-0.5 text-[9.5px] font-black tracking-tight shadow-md ring-1 ring-white/95 transition-transform duration-200 group-hover:scale-105 pointer-events-none whitespace-nowrap',
                        item.badgeColor,
                      )}
                    >
                      {item.badge}
                    </span>
                  )}

                  {/* Icon Staging Container: Subtle Gradient Frosted Pill */}
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-b from-white/95 to-emerald-50/80 text-[#005a36] border border-emerald-200/50 shadow-xs transition-all duration-300 group-hover:bg-[#005a36] group-hover:text-white group-hover:scale-110 group-hover:shadow-md group-hover:shadow-[#005a36]/25 mt-0.5 pointer-events-none">
                    <Icon size={20} strokeWidth={2.3} className="transition-transform duration-300 group-hover:scale-105" />
                  </div>

                  {/* Clean Typography Hierarchy: Dark Forest Green Title & High Contrast Subtitle */}
                  <div className="w-full mt-1.5 flex flex-col items-center pointer-events-none">
                    <span className="text-[13px] font-bold text-[#0b2e1c] group-hover:text-[#005a36] transition-colors line-clamp-1 leading-tight tracking-tight">
                      {item.label}
                    </span>
                    <span className="text-[12px] font-semibold text-[rgba(8,38,22,0.85)] mt-0.5 line-clamp-1 group-hover:text-[#0b2e1c] transition-colors">
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
