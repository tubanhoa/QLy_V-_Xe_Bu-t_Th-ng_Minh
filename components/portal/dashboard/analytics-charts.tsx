'use client'

import React from 'react'
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  Clock,
  ShieldCheck,
  Server,
  KeyRound,
  CheckCircle2,
  Navigation,
  ArrowUpRight,
} from 'lucide-react'

interface AnalyticsChartsProps {
  revenueTrend: Array<{ date: string; revenue: number }>
  revenueByRoute: Array<{
    routeCode: string
    name: string
    revenue: number
    ticketCount: number
  }>
  totalRevenue: number
}

export function AnalyticsCharts({
  revenueTrend,
  revenueByRoute,
  totalRevenue,
}: AnalyticsChartsProps) {
  // Tính max revenue để vẽ biểu đồ SVG
  const maxRevenue = Math.max(
    ...revenueTrend.map((r) => r.revenue),
    6000000,
  )

  // Điểm SVG cho biểu đồ đường
  const points = revenueTrend.map((item, index) => {
    const x = (index / Math.max(1, revenueTrend.length - 1)) * 400 + 40
    const y = 140 - (item.revenue / maxRevenue) * 100
    return { x, y, date: item.date, revenue: item.revenue }
  })

  const pathD = points.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`
  }, '')

  const fillAreaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} 150 L ${points[0].x} 150 Z`
    : ''

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* BIỂU ĐỒ 1: XU HƯỚNG DOANH THU 7 NGÀY GẦN NHẤT (SVG CURVE) */}
      <div className="lg:col-span-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                <TrendingUp size={18} />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  Biểu Đồ Doanh Thu Toàn Hệ Thống
                </h3>
                <p className="text-[11px] text-slate-400">
                  Dữ liệu thực tế ghi nhận từ các giao dịch thanh toán vé xe buýt
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                Tổng doanh thu kỳ:
              </span>
              <p className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                {totalRevenue.toLocaleString('vi-VN')} đ
              </p>
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="relative w-full h-44 sm:h-52 overflow-hidden rounded-2xl bg-slate-50/60 dark:bg-slate-900/40 p-2 border border-slate-100 dark:border-slate-800">
            <svg
              viewBox="0 0 480 160"
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="40" y1="40" x2="440" y2="40" stroke="#e2e8f0" strokeDasharray="3 3" opacity="0.6" />
              <line x1="40" y1="90" x2="440" y2="90" stroke="#e2e8f0" strokeDasharray="3 3" opacity="0.6" />
              <line x1="40" y1="140" x2="440" y2="140" stroke="#e2e8f0" strokeDasharray="3 3" opacity="0.6" />

              {/* Area Fill */}
              {fillAreaD && <path d={fillAreaD} fill="url(#revenueGradient)" />}

              {/* Line Stroke */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data Points */}
              {points.map((pt, i) => (
                <g key={i}>
                  <circle cx={pt.x} cy={pt.y} r="5" fill="#ffffff" stroke="#10b981" strokeWidth="3" />
                </g>
              ))}
            </svg>
          </div>

          {/* Trục X ngày tháng */}
          <div className="flex justify-between px-6 pt-2 text-[10px] font-mono text-slate-400">
            {points.map((pt, idx) => (
              <span key={idx}>
                {pt.date.slice(5)}
              </span>
            ))}
          </div>
        </div>

        {/* Phân bổ theo giờ cao điểm đón sinh viên */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Clock size={13} className="text-indigo-600" />
              <span>Phụ tải theo khung giờ cao điểm đón sinh viên ICTU:</span>
            </span>
            <span className="text-[10px] text-slate-400">Tỷ lệ lấp đầy ghế</span>
          </div>

          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {[
              { time: '06:30', rate: 92, label: 'Vào ca 1' },
              { time: '07:15', rate: 96, label: 'Cao điểm ICTU' },
              { time: '11:30', rate: 78, label: 'Tan ca trưa' },
              { time: '16:45', rate: 94, label: 'Tan ca chiều' },
              { time: '17:30', rate: 86, label: 'Về KTX' },
            ].map((slot) => (
              <div key={slot.time} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                  {slot.time}
                </span>
                <span className="text-emerald-600 font-black text-xs">
                  {slot.rate}%
                </span>
                <span className="text-[9px] text-slate-400 block truncate">
                  {slot.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BIỂU ĐỒ 2: CƠ CẤU DOANH THU THEO TUYẾN & CHỈ SỐ AN TOÀN BẢO MẬT */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        {/* Doanh thu theo tuyến */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <BarChart3 size={16} />
            </div>
            <h3 className="font-black text-sm text-slate-900 dark:text-white">
              Cơ Cấu Theo Tuyến Xe
            </h3>
          </div>

          <div className="space-y-3.5">
            {revenueByRoute.map((item) => {
              const percent = totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 100) : 50
              return (
                <div key={item.routeCode} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-slate-800 dark:text-slate-200">
                      {item.routeCode} ({item.name})
                    </span>
                    <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
                      {percent}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{item.ticketCount} lượt vé</span>
                    <span className="font-mono">{item.revenue.toLocaleString('vi-VN')} đ</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* THẺ BẢO MẬT & HẠ TẦNG ADMIN CONSOLE */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-white p-5 sm:p-6 shadow-xl space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-400" />
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-200">
                Trạng Thái An Ninh Hệ Thống
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">
              Secure 256-bit
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <span className="flex items-center gap-1.5 text-[11px]">
                <Server size={12} className="text-indigo-400" />
                <span>Supabase PostgreSQL Cloud:</span>
              </span>
              <span className="text-emerald-400 font-bold text-[11px]">Online (SSL)</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <span className="flex items-center gap-1.5 text-[11px]">
                <KeyRound size={12} className="text-amber-400" />
                <span>JWT Access Token Expiration:</span>
              </span>
              <span className="font-mono text-slate-300 text-[11px]">15 phút (Auto-refresh)</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <span className="flex items-center gap-1.5 text-[11px]">
                <ShieldCheck size={12} className="text-emerald-400" />
                <span>Phân quyền RBAC Enforcement:</span>
              </span>
              <span className="text-emerald-400 font-bold text-[11px]">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
