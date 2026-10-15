'use client'

import React, { useState } from 'react'
import {
  Armchair,
  Check,
  Clock,
  Compass,
  Heart,
  Lock,
  Moon,
  Sparkles,
  Sun,
  Wifi,
  Zap,
} from 'lucide-react'
import { SeatItem, SeatStatus } from '@/lib/types/booking'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/utils/haptics'

interface BusSeatGridProps {
  seats: SeatItem[]
  selectedSeatIds: string[]
  onToggleSeat: (seat: SeatItem) => void
  conflictedSeatId?: string | null
  isLoading?: boolean
  disabled?: boolean
}

function BusSeatGridComponent({
  seats,
  selectedSeatIds,
  onToggleSeat,
  conflictedSeatId,
  isLoading = false,
  disabled = false,
}: BusSeatGridProps) {
  // Chế độ không gian ánh sáng cabin: Ban ngày ☀️ / Đèn LED ban đêm 🌌
  const [cabinMode, setCabinMode] = useState<'day' | 'night'>('day')

  // Nhóm 28 ghế theo 7 hàng (rowNumber 1..7)
  const rows = React.useMemo(() => {
    const map = new Map<number, { A?: SeatItem; B?: SeatItem; C?: SeatItem; D?: SeatItem }>()
    for (let r = 1; r <= 7; r++) {
      map.set(r, {})
    }

    seats.forEach((seat) => {
      const row = seat.rowNumber || 1
      const current = map.get(row) || {}
      if (seat.columnLabel === 'A') current.A = seat
      if (seat.columnLabel === 'B') current.B = seat
      if (seat.columnLabel === 'C') current.C = seat
      if (seat.columnLabel === 'D') current.D = seat
      map.set(row, current)
    })

    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [seats])

  const renderSeatButton = (seat?: SeatItem) => {
    if (!seat) {
      return <div className="size-11 sm:size-12 rounded-xl border border-dashed border-slate-200 opacity-20" />
    }

    const isSelectedByMe = selectedSeatIds.includes(seat.seatId) || seat.isHeldByMe
    const isConflicted = conflictedSeatId === seat.seatId || conflictedSeatId === seat.seatNumber
    const isBooked = seat.isBooked || seat.bookingStatus === 'booked'
    const isHoldingByOther = seat.bookingStatus === 'holding' && !seat.isHeldByMe
    const isPriority = seat.rowNumber === 1

    const handleSeatClick = (seat: SeatItem) => {
      haptic.play('tap')
      onToggleSeat(seat)
    }

    return (
      <button
        key={seat.seatId}
        type="button"
        disabled={disabled || isBooked || isHoldingByOther || isLoading}
        onClick={() => handleSeatClick(seat)}
        title={
          isBooked
            ? `Ghế ${seat.seatNumber}: Đã bán`
            : isHoldingByOther
            ? `Ghế ${seat.seatNumber}: Đang được giữ bởi khách khác`
            : isSelectedByMe
            ? `Ghế ${seat.seatNumber}: Bạn đang giữ`
            : `Ghế ${seat.seatNumber}: Ghế trống - Bấm để chọn`
        }
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl sm:rounded-2xl transition-all duration-150 select-none will-change-transform touch-manipulation touch-press',
          'size-10.5 sm:size-12 md:size-13 text-xs font-black shadow-xs',
          // Shake animation when race condition conflict happens
          isConflicted && 'animate-bounce ring-4 ring-amber-500 bg-amber-100 text-amber-900',
          // State 1: Booked (Đã bán)
          isBooked &&
            (cabinMode === 'night'
              ? 'bg-slate-900/60 text-slate-600 border border-slate-800 cursor-not-allowed opacity-60 shadow-none'
              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-85 shadow-none'),
          // State 2: Holding by other (Người khác đang giữ)
          !isBooked &&
            isHoldingByOther &&
            'bg-amber-100/90 text-amber-900 border border-amber-300/80 cursor-not-allowed opacity-90',
          // State 3: Selected by me (Bạn đang giữ)
          !isBooked &&
            !isHoldingByOther &&
            isSelectedByMe &&
            'bg-[#005A36] text-white border-2 border-emerald-400 shadow-md shadow-emerald-950/20 scale-105 ring-4 ring-emerald-500/20 cursor-pointer',
          // State 4: Available (Trống)
          !isBooked &&
            !isHoldingByOther &&
            !isSelectedByMe &&
            (cabinMode === 'night'
              ? 'bg-slate-850 text-slate-100 border-2 border-slate-700 hover:border-emerald-400 hover:bg-slate-800 hover:scale-105 active:scale-95 cursor-pointer shadow-xs'
              : 'bg-white text-slate-800 border-2 border-slate-200 hover:border-[#005A36] hover:bg-emerald-50/70 hover:scale-105 active:scale-95 cursor-pointer shadow-xs'),
        )}
      >
        {/* Seat Number & Icon */}
        <div className="flex flex-col items-center leading-none">
          <span className="font-mono text-xs sm:text-[13px] font-black tracking-tight">
            {seat.seatNumber}
          </span>
          <div className="mt-0.5">
            {isBooked ? (
              <Lock size={11} className="text-slate-400" />
            ) : isHoldingByOther ? (
              <Clock size={11} className="text-amber-700 animate-pulse" />
            ) : isSelectedByMe ? (
              <Check size={12} strokeWidth={3} className="text-emerald-300" />
            ) : isPriority ? (
              <Heart size={10} className="text-rose-500 fill-rose-500" />
            ) : (
              <Armchair size={11} className="text-slate-300 group-hover:text-[#005A36]" />
            )}
          </div>
        </div>

        {/* Priority Badge */}
        {isPriority && !isBooked && !isSelectedByMe && !isHoldingByOther && (
          <span className="absolute -top-1 -right-1 size-2 rounded-full bg-rose-500 ring-2 ring-white" />
        )}

        {/* Selected badge */}
        {isSelectedByMe && (
          <span className="absolute -bottom-1 rounded-full bg-emerald-400 px-1 py-0.2 text-[8px] font-black text-emerald-950 tracking-tighter">
            BẠN
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col items-center w-full">
      {/* Live Cabin Telemetry IoT Bar */}
      <div
        className={cn(
          'mb-2.5 w-full max-w-sm flex items-center justify-between px-3 py-1.5 rounded-2xl border transition-colors text-[10.5px] font-bold shadow-2xs backdrop-blur-sm',
          cabinMode === 'night'
            ? 'bg-slate-900/90 border-slate-700/80 text-slate-200'
            : 'bg-white/90 border-slate-200/80 text-slate-700',
        )}
      >
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>23°C Ion</span>
        </div>
        <div className="flex items-center gap-1 text-amber-600">
          <Zap size={11} className="fill-amber-500 text-amber-500" />
          <span>Pin 92%</span>
        </div>
        <div className="flex items-center gap-1 text-cyan-600">
          <Wifi size={11} />
          <span>Wifi 5G</span>
        </div>
        {/* Toggle Chế Độ Ánh Sáng Cabin */}
        <button
          type="button"
          onClick={() => {
            haptic.play('select')
            setCabinMode((m) => (m === 'day' ? 'night' : 'day'))
          }}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-lg transition-all cursor-pointer touch-press touch-manipulation',
            cabinMode === 'night'
              ? 'bg-indigo-950/70 border border-indigo-500/40 text-indigo-300'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700',
          )}
          title="Chuyển chế độ đèn cabin: Ban ngày ☀️ / LED đêm 🌌"
        >
          {cabinMode === 'day' ? (
            <Sun size={11} className="text-amber-500" />
          ) : (
            <Moon size={11} className="text-indigo-400" />
          )}
          <span className="text-[9.5px] font-extrabold">
            {cabinMode === 'day' ? 'Đèn Ngày' : 'LED Đêm'}
          </span>
        </button>
      </div>

      {/* Visual Bus Chassis Frame with Dynamic Day/Night Interior Ambiance */}
      <div
        className={cn(
          'relative w-full max-w-sm rounded-3xl p-3.5 sm:p-4.5 border-2 transition-all duration-300 shadow-xl',
          cabinMode === 'night'
            ? 'bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-slate-700/80 shadow-[0_0_35px_rgba(0,90,54,0.3)]'
            : 'bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 border-slate-200/90 shadow-slate-900/5',
        )}
      >
        {/* Front Bus Cockpit Header */}
        <div className="relative mb-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-2.5 sm:p-3 text-white shadow-md overflow-hidden">
          <div className="flex items-center justify-between">
            {/* Front Door with Sensor */}
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-2 py-1 text-[10px] font-black text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>CỬA TRƯỚC</span>
            </div>

            {/* Electric Smart Bus Badge */}
            <div className="flex items-center gap-1 text-[11px] font-black text-emerald-400">
              <Zap size={13} className="text-emerald-400 fill-emerald-400" />
              <span>BUÝT ĐIỆN 28 CHỖ</span>
            </div>

            {/* Driver Cockpit */}
            <div className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-slate-300">
              <Compass size={12} className="text-slate-400" />
              <span>TÀI XẾ</span>
            </div>
          </div>

          {/* Windshield Curve Effect */}
          <div className="mt-2 h-1 w-full rounded-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        </div>

        {/* Column Labels Indicator */}
        <div
          className={cn(
            'grid grid-cols-5 gap-1.5 sm:gap-2 text-center text-[10px] font-black uppercase tracking-widest mb-1.5 px-1',
            cabinMode === 'night' ? 'text-slate-400' : 'text-slate-400',
          )}
        >
          <span>Dãy A</span>
          <span>Dãy B</span>
          <span className={cabinMode === 'night' ? 'text-cyan-400/70' : 'text-slate-300'}>
            Lối đi
          </span>
          <span>Dãy C</span>
          <span>Dãy D</span>
        </div>

        {/* 7 Rows Grid Layout */}
        <div className="space-y-2 sm:space-y-2.5">
          {rows.map(([rowNum, rowSeats]) => (
            <div key={rowNum} className="grid grid-cols-5 gap-1.5 sm:gap-2 items-center">
              {/* Cột A */}
              <div className="flex justify-center">{renderSeatButton(rowSeats.A)}</div>

              {/* Cột B */}
              <div className="flex justify-center">{renderSeatButton(rowSeats.B)}</div>

              {/* Lối đi giữa (Aisle) */}
              <div
                className={cn(
                  'flex flex-col items-center justify-center text-[10px] font-mono font-bold transition-colors',
                  cabinMode === 'night'
                    ? 'text-cyan-400/80 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]'
                    : 'text-slate-300',
                )}
              >
                <span className="select-none">H{rowNum}</span>
              </div>

              {/* Cột C */}
              <div className="flex justify-center">{renderSeatButton(rowSeats.C)}</div>

              {/* Cột D */}
              <div className="flex justify-center">{renderSeatButton(rowSeats.D)}</div>
            </div>
          ))}
        </div>

        {/* Back of Bus Footnote */}
        <div
          className={cn(
            'mt-3.5 pt-2 border-t text-center',
            cabinMode === 'night' ? 'border-slate-800' : 'border-slate-200/80',
          )}
        >
          <span
            className={cn(
              'text-[10px] font-bold uppercase tracking-wider',
              cabinMode === 'night' ? 'text-slate-500' : 'text-slate-400',
            )}
          >
            Đuôi Xe · Động cơ điện thông minh
          </span>
        </div>
      </div>

      {/* Modern 4-State Visual Legend */}
      <div
        className={cn(
          'mt-3.5 w-full max-w-sm grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-bold p-2.5 rounded-2xl border shadow-2xs transition-colors',
          cabinMode === 'night'
            ? 'bg-slate-900/90 border-slate-700/80 text-slate-200'
            : 'bg-white/90 border-slate-200/80 text-slate-600',
        )}
      >
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              'size-4 rounded-md border-2 shadow-2xs shrink-0',
              cabinMode === 'night' ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300',
            )}
          />
          <span>Trống</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-4 rounded-md bg-[#005A36] border border-emerald-400 shadow-2xs flex items-center justify-center text-white shrink-0">
            <Check size={10} strokeWidth={3} />
          </div>
          <span className={cabinMode === 'night' ? 'text-emerald-400' : 'text-[#005A36]'}>
            Bạn chọn
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-4 rounded-md bg-amber-100 border border-amber-300 shadow-2xs flex items-center justify-center text-amber-800 shrink-0">
            <Clock size={10} />
          </div>
          <span className="text-amber-800">Đang giữ</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              'size-4 rounded-md border shadow-2xs flex items-center justify-center shrink-0',
              cabinMode === 'night'
                ? 'bg-slate-800 border-slate-700 text-slate-500'
                : 'bg-slate-100 border-slate-200 text-slate-400',
            )}
          >
            <Lock size={10} />
          </div>
          <span className={cabinMode === 'night' ? 'text-slate-500' : 'text-slate-400'}>
            Đã bán
          </span>
        </div>
      </div>
    </div>
  )
}

export const BusSeatGrid = React.memo(BusSeatGridComponent)
