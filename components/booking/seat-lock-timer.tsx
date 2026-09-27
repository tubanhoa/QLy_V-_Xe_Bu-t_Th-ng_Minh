'use client'

import React from 'react'
import { AlertCircle, Clock, Flame, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SeatLockTimerProps {
  remainingSeconds: number
  className?: string
}

export function SeatLockTimer({ remainingSeconds, className }: SeatLockTimerProps) {
  if (remainingSeconds <= 0) return null

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const isUrgent = remainingSeconds < 60
  const isWarning = remainingSeconds >= 60 && remainingSeconds < 180

  return (
    <div
      role="timer"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono font-black shadow-xs transition-all duration-300',
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
        <Flame size={13} className="text-white fill-white" />
      ) : isWarning ? (
        <AlertCircle size={13} className="text-amber-700" />
      ) : (
        <Clock size={13} className="text-[#005A36]" />
      )}
      <span className="font-sans font-extrabold text-[11px] tracking-tight">Giữ ghế:</span>
      <span className="text-xs font-black tracking-wider">{formattedTime}</span>
    </div>
  )
}
