'use client'

import { memo } from 'react'

// Realistic Thái Nguyên Tea Leaf SVG Shapes
function LeafShapeA({ className }: { className?: string }) {
  // Classic single fresh tea leaf with delicate veins
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <defs>
        <linearGradient id="tea-leaf-grad-a" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="50%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#005A36" />
        </linearGradient>
      </defs>
      {/* Leaf blade */}
      <path
        d="M16 2 C22 5 28 12 28 20 C28 26 23 29 16 30 C9 29 4 26 4 20 C4 12 10 5 16 2 Z"
        fill="url(#tea-leaf-grad-a)"
        fillOpacity="0.88"
      />
      {/* Leaf midrib vein */}
      <path
        d="M16 4 Q16.5 16 16 28"
        stroke="#A7F3D0"
        strokeWidth="1"
        strokeLinecap="round"
        strokeOpacity="0.7"
      />
      {/* Side veins */}
      <path
        d="M16 10 Q20 12 23 15 M16 15 Q21 18 24 21 M16 11 Q12 13 9 16 M16 16 Q11 19 8 22"
        stroke="#6EE7B7"
        strokeWidth="0.7"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
    </svg>
  )
}

function LeafShapeB({ className }: { className?: string }) {
  // "Một tôm một lá" - Special Tân Cương tea bud shoot
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <defs>
        <linearGradient id="tea-leaf-grad-b" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A3E635" />
          <stop offset="55%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#004529" />
        </linearGradient>
      </defs>
      {/* Main leaf */}
      <path
        d="M14 3 C19 6 25 13 25 21 C25 27 20 29 14 30 C9 29 5 26 5 20 C5 11 9 5 14 3 Z"
        fill="url(#tea-leaf-grad-b)"
        fillOpacity="0.85"
      />
      {/* Emerging young tea shoot bud */}
      <path
        d="M14 1 C18 4 21 8 20 14 C18 10 16 6 14 1 Z"
        fill="#BEF264"
        fillOpacity="0.9"
      />
      {/* Midrib */}
      <path
        d="M14 4 Q14.5 16 14 28"
        stroke="#DCFCE7"
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeOpacity="0.65"
      />
    </svg>
  )
}

function LeafShapeC({ className }: { className?: string }) {
  // Curved drifting young tender leaf
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <defs>
        <linearGradient id="tea-leaf-grad-c" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#6EE7B7" />
          <stop offset="60%" stopColor="#059669" />
          <stop offset="100%" stopColor="#00361F" />
        </linearGradient>
      </defs>
      <path
        d="M18 2 C24 7 27 15 25 22 C23 27 18 30 12 30 C7 29 4 25 5 20 C6 13 11 5 18 2 Z"
        fill="url(#tea-leaf-grad-c)"
        fillOpacity="0.82"
      />
      <path
        d="M18 4 Q16 16 12 28"
        stroke="#BBF7D0"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />
    </svg>
  )
}

// 14 carefully orchestrated leaves across the canvas
const LEAF_ITEMS = [
  { id: 1, left: '6%', anim: 'tea-leaf-fall-1', dur: 12, delay: -2, size: 22, blur: 0, opacity: 0.85, type: 'a' },
  { id: 2, left: '15%', anim: 'tea-leaf-fall-2', dur: 15, delay: -7, size: 16, blur: 0.5, opacity: 0.65, type: 'b' },
  { id: 3, left: '24%', anim: 'tea-leaf-fall-3', dur: 11, delay: -4, size: 25, blur: 0, opacity: 0.9, type: 'c' },
  { id: 4, left: '33%', anim: 'tea-leaf-fall-1', dur: 14, delay: -11, size: 14, blur: 0.7, opacity: 0.6, type: 'a' },
  { id: 5, left: '42%', anim: 'tea-leaf-fall-2', dur: 13, delay: -1, size: 20, blur: 0, opacity: 0.8, type: 'b' },
  { id: 6, left: '50%', anim: 'tea-leaf-fall-3', dur: 16, delay: -9, size: 18, blur: 0.4, opacity: 0.7, type: 'c' },
  { id: 7, left: '59%', anim: 'tea-leaf-fall-1', dur: 10, delay: -5, size: 24, blur: 0, opacity: 0.88, type: 'a' },
  { id: 8, left: '68%', anim: 'tea-leaf-fall-2', dur: 17, delay: -13, size: 15, blur: 0.6, opacity: 0.62, type: 'b' },
  { id: 9, left: '77%', anim: 'tea-leaf-fall-3', dur: 12, delay: -3, size: 23, blur: 0, opacity: 0.85, type: 'c' },
  { id: 10, left: '85%', anim: 'tea-leaf-fall-1', dur: 14, delay: -8, size: 19, blur: 0.3, opacity: 0.75, type: 'a' },
  { id: 11, left: '92%', anim: 'tea-leaf-fall-2', dur: 15, delay: -6, size: 21, blur: 0, opacity: 0.8, type: 'b' },
  { id: 12, left: '18%', anim: 'tea-leaf-fall-3', dur: 18, delay: -15, size: 13, blur: 0.8, opacity: 0.55, type: 'c' },
  { id: 13, left: '46%', anim: 'tea-leaf-fall-1', dur: 13, delay: -10, size: 26, blur: 0, opacity: 0.9, type: 'a' },
  { id: 14, left: '72%', anim: 'tea-leaf-fall-2', dur: 11, delay: -4.5, size: 17, blur: 0.4, opacity: 0.7, type: 'b' },
]

export const AmbientTransitFx = memo(function AmbientTransitFx() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
    >
      {/* ===================================================================
          ORGANIC FALLING TEA LEAVES (Mưa lá chè Tân Cương Thái Nguyên bay trong gió)
          GPU-accelerated organic 3D drift and wobble across the viewport
          =================================================================== */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {LEAF_ITEMS.map((item) => (
          <div
            key={item.id}
            className="absolute -top-16 will-change-transform pointer-events-none"
            style={{
              left: item.left,
              animationName: item.anim,
              animationDuration: `${item.dur}s`,
              animationTimingFunction: 'cubic-bezier(0.35, 0.1, 0.25, 1)',
              animationDelay: `${item.delay}s`,
              animationIterationCount: 'infinite',
              animationPlayState: 'running',
              width: `${item.size}px`,
              height: `${item.size}px`,
              opacity: item.opacity,
            }}
          >
            {item.type === 'a' && <LeafShapeA className="w-full h-full" />}
            {item.type === 'b' && <LeafShapeB className="w-full h-full" />}
            {item.type === 'c' && <LeafShapeC className="w-full h-full" />}
          </div>
        ))}
      </div>
    </div>
  )
})
