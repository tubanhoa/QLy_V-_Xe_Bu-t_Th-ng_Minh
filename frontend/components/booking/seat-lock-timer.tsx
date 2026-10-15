'use client'

import React, { useEffect, useState } from 'react'
import { AlertCircle, Clock, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SeatLockTimerProps {
  expiresAt?: number | null
  remainingSeconds?: number
  className?: string
  onExpired?: () => void
}

function SeatLockTimerComponent({
  expiresAt,
  remainingSeconds: initialSeconds,
  className,
  onExpired,
}: SeatLockTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (expiresAt) {
      return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
    }
    return initialSeconds ?? 0
  })

  useEffect(() => {
    if (expiresAt) {
      const calc = () => Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      setSecondsLeft(calc())

      const timer = setInterval(() => {
        const left = calc()
        setSecondsLeft(left)
        if (left <= 0) {
          clearInterval(timer)
          onExpired?.()
        }
      }, 1000)

      return () => clearInterval(timer)
    } else if (initialSeconds !== undefined) {
      setSecondsLeft(initialSeconds)
    }
  }, [expiresAt, initialSeconds, onExpired])

  if (secondsLeft <= 0) return null

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const isUrgent = secondsLeft < 60
  const isWarning = secondsLeft >= 60 && secondsLeft < 180

  return (
    <div
      role="timer"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-mono font-black shadow-xs transition-all duration-300',
        isUrgent
          ? 'bg-rose-500 text-white border border-rose-600 animate-bounce'
          : isWarning
          ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
          : 'bg-emerald-50 text-[#005A36] border border-emerald-300/80',
        className,
      )}
      title="Thời gian giữ chỗ ghế của bạn trên hệ thống"
    >
      {isUrgent ? (
        <Flame size={15} className="text-white fill-white shrink-0" />
      ) : isWarning ? (
        <AlertCircle size={15} className="text-amber-700 shrink-0" />
      ) : (
        <Clock size={15} className="text-[#005A36] shrink-0" />
      )}
      <span className="font-sans font-extrabold text-xs sm:text-sm tracking-tight">Giữ ghế:</span>
      <span className="text-xs sm:text-sm font-black tracking-wider">{formattedTime}</span>
    </div>
  )
}

export const SeatLockTimer = React.memo(SeatLockTimerComponent)
