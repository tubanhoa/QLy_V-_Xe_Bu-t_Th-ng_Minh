'use client'

import { useState } from 'react'
import {
  Bell,
  CheckCircle2,
  Database,
  Globe,
  Radio,
  Save,
  Shield,
  SlidersHorizontal,
} from 'lucide-react'

export function AdminSettings() {
  const [delayThreshold, setDelayThreshold] = useState(5)
  const [holdingTtl, setHoldingTtl] = useState(10)
  const [gpsInterval, setGpsInterval] = useState(3)
  const [autoSms, setAutoSms] = useState(true)
  const [saved, setSaved] = useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          Cài Đặt Tham Số Vận Hành Hệ Thống
        </h1>
        <p className="text-sm text-muted-foreground">
          Cấu hình quy chuẩn giữ chỗ vé, thời gian viễn thông GPS và cổng gửi cảnh báo
        </p>
      </div>

      {saved && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-500" />
          Đã lưu cấu hình hệ thống thành công!
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {/* Transit Realtime & Dispatch Settings */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col gap-4">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2 border-b border-border pb-3">
            <Radio size={18} className="text-[#00A86B]" /> Thông số Viễn thông GPS & Điều độ
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div>
              <label className="font-semibold text-foreground block mb-1">
                Ngưỡng cảnh báo trễ giờ (Phút)
              </label>
              <input
                type="number"
                value={delayThreshold}
                onChange={(e) => setDelayThreshold(Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Nếu xe chậm quá ngưỡng này, hệ thống tự động gắn tag "Trễ giờ"
              </span>
            </div>

            <div>
              <label className="font-semibold text-foreground block mb-1">
                Tần suất phát tọa độ GPS (Giây)
              </label>
              <input
                type="number"
                value={gpsInterval}
                onChange={(e) => setGpsInterval(Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Khoảng thời gian thiết bị IoT trên xe gửi tọa độ về máy chủ
              </span>
            </div>
          </div>
        </div>

        {/* Booking & Ticketing Rules */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col gap-4">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2 border-b border-border pb-3">
            <SlidersHorizontal size={18} className="text-cyan-500" /> Quy định Đặt vé & Giữ chỗ
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div>
              <label className="font-semibold text-foreground block mb-1">
                Thời gian khóa giữ chỗ tạm thời (Phút)
              </label>
              <input
                type="number"
                value={holdingTtl}
                onChange={(e) => setHoldingTtl(Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Sau thời gian này, nếu chưa thanh toán ghế sẽ tự động giải phóng
              </span>
            </div>

            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 font-semibold text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSms}
                  onChange={(e) => setAutoSms(e.target.checked)}
                  className="size-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
                />
                Tự động gửi thông báo xe sắp đến trạm qua SMS/App
              </label>
              <span className="text-[11px] text-muted-foreground mt-1 block pl-6">
                Bắn thông báo trước 5 phút khi xe cách trạm đón 500 mét
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl bg-[#00A86B] px-6 py-3 font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 text-sm"
          >
            <Save size={16} /> Lưu Cấu Hình Hệ Thống
          </button>
        </div>
      </form>
    </div>
  )
}
