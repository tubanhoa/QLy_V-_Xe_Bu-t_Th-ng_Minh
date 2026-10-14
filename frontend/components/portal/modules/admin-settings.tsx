'use client'

import { useState, useEffect } from 'react'
import {
  Bell,
  CheckCircle2,
  Database,
  Globe,
  Radio,
  Save,
  Shield,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  Receipt,
  Clock,
} from 'lucide-react'

interface SystemSettings {
  delayThreshold: number
  holdingTtl: number
  gpsInterval: number
  autoSms: boolean
  vatRate: number
  maxTicketsPerBooking: number
  backupSchedule: string
}

const DEFAULT_SETTINGS: SystemSettings = {
  delayThreshold: 5,
  holdingTtl: 10,
  gpsInterval: 3,
  autoSms: true,
  vatRate: 8,
  maxTicketsPerBooking: 5,
  backupSchedule: '02:00',
}

const SETTINGS_KEY = 'smartbus_system_settings'

export function AdminSettings() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Khôi phục cài đặt từ localStorage khi tải trang
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) })
      }
    } catch {
      // ignore
    }
  }, [])

  const handleChange = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
      window.dispatchEvent(new CustomEvent('system_settings_updated', { detail: settings }))
      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
    } catch (err: any) {
      alert(`Lỗi lưu cài đặt: ${err.message}`)
    }
  }

  const handleReset = () => {
    if (confirm('Bạn có chắc muốn khôi phục tất cả cấu hình về giá trị mặc định chuẩn?')) {
      setIsResetting(true)
      setSettings(DEFAULT_SETTINGS)
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS))
      } catch {
        // ignore
      }
      setTimeout(() => setIsResetting(false), 500)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <SlidersHorizontal className="size-6 text-[#00A86B]" />
            Cài Đặt Tham Số Vận Hành Hệ Thống
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cấu hình thời gian giữ chỗ vé, viễn thông GPS IoT, thuế VAT điện tử và tần suất sao lưu
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          disabled={isResetting}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
        >
          <RotateCcw className={`size-3.5 ${isResetting ? 'animate-spin' : ''}`} />
          Khôi phục mặc định
        </button>
      </div>

      {saved && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
          <CheckCircle2 className="size-5 text-emerald-500" />
          <span>Đã lưu thành công cấu hình vận hành vào bộ nhớ hệ thống!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {/* Transit Realtime & Dispatch Settings */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col gap-4">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2 border-b border-border pb-3">
            <Radio className="size-4 text-[#00A86B]" /> Thông số Viễn thông GPS & Điều độ xe
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div>
              <label className="font-semibold text-foreground block mb-1">
                Ngưỡng cảnh báo trễ giờ (Phút)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={settings.delayThreshold}
                onChange={(e) => handleChange('delayThreshold', Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Nếu xe chậm quá ngưỡng này so với lịch trình, hệ thống tự động cảnh báo & đổi badge "Trễ giờ"
              </span>
            </div>

            <div>
              <label className="font-semibold text-foreground block mb-1">
                Tần suất phát tọa độ GPS IoT (Giây)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={settings.gpsInterval}
                onChange={(e) => handleChange('gpsInterval', Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Chu kỳ gửi vị trí vệ tinh từ thiết bị trên xe buýt về Redis GPS Cache
              </span>
            </div>
          </div>
        </div>

        {/* Booking & Ticketing Rules */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col gap-4">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2 border-b border-border pb-3">
            <Clock className="size-4 text-cyan-500" /> Quy định Đặt vé & Giữ chỗ (Hold TTL)
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div>
              <label className="font-semibold text-foreground block mb-1">
                Thời gian khóa giữ chỗ tạm thời (Phút)
              </label>
              <input
                type="number"
                min={3}
                max={30}
                value={settings.holdingTtl}
                onChange={(e) => handleChange('holdingTtl', Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Sau thời gian này, nếu hành khách chưa thanh toán ghế sẽ tự động giải phóng trên sơ đồ
              </span>
            </div>

            <div>
              <label className="font-semibold text-foreground block mb-1">
                Số vé tối đa mỗi lượt đặt
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={settings.maxTicketsPerBooking}
                onChange={(e) => handleChange('maxTicketsPerBooking', Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Giới hạn chống đầu cơ vé vào các đợt cao điểm khai giảng hoặc lễ hội
              </span>
            </div>

            <div className="sm:col-span-2 rounded-2xl bg-accent/30 p-3.5">
              <label className="flex items-center gap-2.5 font-semibold text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoSms}
                  onChange={(e) => handleChange('autoSms', e.target.checked)}
                  className="size-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
                />
                Tự động gửi thông báo xe sắp đến trạm đón (Push Notification / SMS)
              </label>
              <span className="text-[11px] text-muted-foreground mt-1 block pl-6">
                Hệ thống tự động kích hoạt tính năng Geofencing khi xe buýt cách trạm 500 mét hoặc 5 phút ETA
              </span>
            </div>
          </div>
        </div>

        {/* Financial & VAT Tax Policy */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col gap-4">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2 border-b border-border pb-3">
            <Receipt className="size-4 text-purple-500" /> Thuế Suất & Hóa Đơn Điện Tử
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div>
              <label className="font-semibold text-foreground block mb-1">
                Thuế suất VAT vận tải hành khách công cộng (%)
              </label>
              <input
                type="number"
                min={0}
                max={15}
                value={settings.vatRate}
                onChange={(e) => handleChange('vatRate', Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Áp dụng cho việc tự động xuất hóa đơn điện tử VAT vé xe buýt điện thông minh
              </span>
            </div>

            <div>
              <label className="font-semibold text-foreground block mb-1">
                Lịch sao lưu cơ sở dữ liệu định kỳ
              </label>
              <input
                type="time"
                value={settings.backupSchedule}
                onChange={(e) => handleChange('backupSchedule', e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Thời điểm chạy tác vụ sao lưu tự động Supabase Cloud hàng ngày
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl bg-[#00A86B] px-6 py-3 font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 text-sm transition-all"
          >
            <Save className="size-4" /> Lưu Cấu Hình Hệ Thống
          </button>
        </div>
      </form>
    </div>
  )
}
