const ROUTES = [
  { id: 'route-a', d: 'M -40 460 C 120 420, 170 280, 320 290 S 520 170, 680 130', duration: '13s' },
  { id: 'route-b', d: 'M -40 190 C 110 210, 210 330, 340 340 S 540 430, 680 490', duration: '17s' },
  { id: 'route-c', d: 'M 90 680 C 130 520, 240 450, 280 320 S 380 90, 450 -40', duration: '15s' },
]

const STOPS = [
  { cx: 320, cy: 290 },
  { cx: 340, cy: 340 },
  { cx: 170, cy: 350 },
  { cx: 520, cy: 190 },
  { cx: 280, cy: 320 },
  { cx: 540, cy: 430 },
]

export function TransitRoutesBackdrop() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 640 640"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 size-full opacity-75"
    >
      <defs>
        <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
        </pattern>
        <linearGradient id="route-glow" x1="0" x2="1">
          <stop offset="0%" stopColor="#00B4A0" stopOpacity="0" />
          <stop offset="50%" stopColor="#00E8C6" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#00A86B" stopOpacity="0" />
        </linearGradient>
        <filter id="beacon-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .animate-route-flow {
            animation: none !important;
          }
          animate, animateMotion {
            display: none !important;
          }
        }
      `}</style>

      <rect width="640" height="640" fill="url(#grid)" />

      {ROUTES.map((route) => (
        <g key={route.id}>
          {/* Static track */}
          <path id={route.id} d={route.d} fill="none" stroke="rgba(0,180,160,0.18)" strokeWidth="2" />
          
          {/* Moving data stream highlight along track */}
          <path
            d={route.d}
            fill="none"
            stroke="url(#route-glow)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="50 190"
            className="animate-route-flow"
          />

          {/* Real-time moving GPS vehicle beacon */}
          <circle r="4" fill="#00E8C6" filter="url(#beacon-glow)">
            <animateMotion dur={route.duration} repeatCount="indefinite" rotate="auto">
              <mpath href={`#${route.id}`} />
            </animateMotion>
          </circle>
          <circle r="2" fill="#FFFFFF">
            <animateMotion dur={route.duration} repeatCount="indefinite" rotate="auto">
              <mpath href={`#${route.id}`} />
            </animateMotion>
          </circle>
        </g>
      ))}

      {/* Network stops with staggered pulsing radar rings */}
      {STOPS.map((stop, index) => (
        <g key={`${stop.cx}-${stop.cy}`}>
          <circle cx={stop.cx} cy={stop.cy} r="4" fill="none" stroke="#00E8C6" strokeWidth="1.5">
            <animate
              attributeName="r"
              values="4;15;4"
              dur="2.8s"
              begin={`${(index * 0.45).toFixed(2)}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.85;0;0.85"
              dur="2.8s"
              begin={`${(index * 0.45).toFixed(2)}s`}
              repeatCount="indefinite"
            />
          </circle>
          <circle cx={stop.cx} cy={stop.cy} r="3.5" fill="#0A131C" stroke="#34D399" strokeWidth="2" />
          <circle cx={stop.cx} cy={stop.cy} r="1.5" fill="#00E8C6" />
        </g>
      ))}
    </svg>
  )
}
