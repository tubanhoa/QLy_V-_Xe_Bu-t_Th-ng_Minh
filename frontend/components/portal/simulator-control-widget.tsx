'use client'

/**
 * Widget Điều Khiển GPS Simulator (Dành Cho Demo & Báo Cáo Đồ Án)
 * - Cho phép giảng viên, hội đồng nghiệm thu & người dùng kích hoạt xe chạy mô phỏng
 * - Tuỳ chọn tốc độ: 1x (thực tế), 2x (nhanh), 5x (siêu tốc)
 * - Hiển thị tiến trình tọa độ GPS mô phỏng thời gian thực
 * 
 * Domain: Tracking / Simulation
 * Branch: feature/SBTS-frontend-realtime-tracking-and-eta
 */

import { useState } from 'react'
import {
  Play,
  Square,
  FastForward,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Cpu,
  RefreshCw,
} from 'lucide-react'
import type { SimulatorStatus } from '@/lib/types/tracking'

interface SimulatorControlWidgetProps {
  isSimulating: boolean
  simulatorStatus: SimulatorStatus | null
  onStart: (multiplier: number) => Promise<boolean>
  onStop: () => Promise<boolean>
}

export function SimulatorControlWidget({
  isSimulating,
  simulatorStatus,
  onStart,
  onStop,
}: SimulatorControlWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1)
  const [actionLoading, setActionLoading] = useState(false)

  const handleToggleSim = async () => {
    setActionLoading(true)
    try {
      if (isSimulating) {
        await onStop()
      } else {
        await onStart(speedMultiplier)
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleSpeedChange = async (speed: number) => {
    setSpeedMultiplier(speed)
    if (isSimulating) {
      setActionLoading(true)
      try {
        await onStart(speed)
      } finally {
        setActionLoading(false)
      }
    }
  }

  return (
    <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-900 via-slate-900 to-emerald-950 text-white shadow-lg overflow-hidden transition-all">
      {/* Widget Header Bar */}
      <div className="flex flex-col xs:flex-row xs:items-center justify-between p-3 sm:p-4 gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 sm:size-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-sm shrink-0">
            <Cpu size={17} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="font-extrabold text-xs sm:text-sm tracking-wide text-white truncate">
                Mô Phỏng GPS Xe Chạy
              </h4>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${
                  isSimulating
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                    : 'bg-slate-700/60 text-slate-300 border border-slate-600/40'
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    isSimulating ? 'bg-emerald-400 animate-ping' : 'bg-slate-400'
                  }`}
                />
                {isSimulating ? 'Đang chạy' : 'Sẵn sàng'}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
              Demo thuyết trình đồ án không cần xe vật lý
            </p>
          </div>
        </div>

        {/* Quick Action Button & Collapse Trigger */}
        <div className="flex items-center justify-end gap-1.5 shrink-0 self-end xs:self-center">
          <button
            type="button"
            onClick={handleToggleSim}
            disabled={actionLoading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer touch-press ${
              isSimulating
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {actionLoading ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : isSimulating ? (
              <>
                <Square size={11} className="fill-white" />
                <span>Dừng xe</span>
              </>
            ) : (
              <>
                <Play size={11} className="fill-white" />
                <span>Bật xe chạy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer touch-press"
            title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Collapsible Details Area */}
      {isExpanded && (
        <div className="border-t border-white/10 p-3.5 sm:p-4 bg-slate-950/40 space-y-3 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Speed Multiplier Options */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 font-medium flex items-center gap-1">
                <FastForward size={14} className="text-amber-400" />
                Tốc độ mô phỏng:
              </span>
              <div className="flex items-center bg-slate-800/80 rounded-xl p-1 border border-white/10">
                {[1, 2, 5].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => handleSpeedChange(speed)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      speedMultiplier === speed
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {speed}x {speed === 1 ? '(Thực)' : speed === 5 ? '(Siêu tốc)' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Step Counter Info */}
            {simulatorStatus && (
              <div className="flex items-center gap-3 text-xs text-slate-300">
                {simulatorStatus.currentStep !== undefined && (
                  <span>
                    Tiến độ:{' '}
                    <strong className="font-mono text-emerald-400">
                      Bước {simulatorStatus.currentStep} / {simulatorStatus.totalSteps || 30}
                    </strong>
                  </span>
                )}
                {simulatorStatus.speedKmh !== undefined && (
                  <span>
                    Vận tốc:{' '}
                    <strong className="font-mono text-amber-300">
                      {Math.round(simulatorStatus.speedKmh)} km/h
                    </strong>
                  </span>
                )}
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 italic">
            💡 Ghi chú kiểm thử: Dữ liệu tọa độ GPS từ simulator được đẩy trực tiếp vào Redis Cache và đồng bộ ngay lập tức tới WebSocket Gateway & Server-Sent Events, kích hoạt tính toán ETA tự động tới tất cả các trạm dừng trên tuyến.
          </p>
        </div>
      )}
    </div>
  )
}
