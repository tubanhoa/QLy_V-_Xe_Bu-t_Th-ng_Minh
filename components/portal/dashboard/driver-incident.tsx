'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Radio,
  Send,
  Siren,
  Wrench,
} from 'lucide-react'

const INCIDENT_PRESETS = [
  { id: 'traffic', label: 'Tắc đường nghiêm trọng', icon: Clock, delay: '15-20 phút', color: 'amber' },
  { id: 'breakdown', label: 'Sự cố xe / Hỏng kỹ thuật', icon: Wrench, delay: 'Cần cứu hộ', color: 'red' },
  { id: 'accident', label: 'Va chạm / Sự cố giao thông', icon: Siren, delay: 'Cần điều phối', color: 'red' },
  { id: 'delay_request', label: 'Xin lùi giờ xuất bến 10 phút', icon: Radio, delay: 'Chờ khách đông', color: 'blue' },
]

export function DriverIncident({ onBack }: { onBack?: () => void }) {
  const [selectedPreset, setSelectedPreset] = useState<string>('traffic')
  const [note, setNote] = useState('')
  const [sentSuccess, setSentSuccess] = useState(false)

  const handleSendReport = (e: React.FormEvent) => {
    e.preventDefault()
    setSentSuccess(true)
    setTimeout(() => {
      setSentSuccess(false)
      setNote('')
    }, 4000)
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <ArrowLeft size={18} strokeWidth={1.75} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Báo cáo sự cố khẩn cấp
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Gửi tín hiệu trực tiếp về Bàn điều phối ICTU Transit
            </p>
          </div>
        </div>
      </div>

      {sentSuccess && (
        <div className="animate-in fade-in slide-in-from-top-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-950 dark:text-emerald-100 flex items-center gap-3">
          <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
          <div>
            <p className="font-bold text-sm">Đã phát cảnh báo thành công!</p>
            <p className="text-xs opacity-80">
              Trung tâm điều hành đã nhận được tọa độ GPS và thông báo của xe 20B-009.77.
            </p>
          </div>
        </div>
      )}

      {/* 4 Big touch cards */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Chọn loại sự cố (Chạm 1 lần để chọn)
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {INCIDENT_PRESETS.map((p) => {
            const Icon = p.icon
            const isSelected = selectedPreset === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPreset(p.id)}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all active:scale-[0.98] ${
                  isSelected
                    ? 'border-red-500/40 bg-red-500/10 ring-2 ring-red-500/30 shadow-md'
                    : 'border-border bg-card hover:bg-accent/40'
                }`}
              >
                <div
                  className={`flex size-12 items-center justify-center rounded-xl shrink-0 ${
                    isSelected
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Icon size={22} strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">{p.label}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Dự kiến: {p.delay}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Note input & CTA */}
      <form onSubmit={handleSendReport} className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
            Mô tả thêm / Vị trí hiện tại (Tùy chọn)
          </label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: Đang tắc dài tại ngã tư Ga Thái Nguyên, xin phép đi đường tránh..."
            className="w-full rounded-2xl border border-border bg-card p-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>

        <button
          type="submit"
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 font-bold text-white shadow-xl shadow-red-600/30 hover:bg-red-700 active:scale-95 transition-all text-base"
        >
          <Send size={18} />
          PHÁT CẢNH BÁO KHẨN CẤP
        </button>
      </form>

      {/* Today's Incident History */}
      <div className="rounded-2xl border border-border bg-card p-4 mt-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Nhật ký sự cố ca hôm nay
        </h4>
        <div className="flex items-center justify-between text-xs text-muted-foreground py-2 border-b border-border/60 last:border-0">
          <span className="flex items-center gap-1.5">
            <Clock size={13} /> 06:20 Sáng
          </span>
          <span className="font-medium text-foreground">Tắc cầu Gia Bảy (+8 phút)</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Đã duyệt</span>
        </div>
      </div>
    </div>
  )
}
