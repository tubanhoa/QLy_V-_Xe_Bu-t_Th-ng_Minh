'use client'

import React, { useState, useMemo } from 'react'
import {
  CalendarDays,
  X,
  Download,
  Search,
  TrendingUp,
  DollarSign,
  Ticket,
  Bus,
  CreditCard,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'
import type { DailyBreakdownItem } from '@/lib/services/analytics.service'

interface DailyRevenueModalProps {
  isOpen: boolean
  onClose: () => void
  data: DailyBreakdownItem[]
  onSelectDate?: (date: string) => void
}

export function DailyRevenueModal({
  isOpen,
  onClose,
  data,
  onSelectDate,
}: DailyRevenueModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  // Lọc và sắp xếp dữ liệu
  const filteredData = useMemo(() => {
    let result = [...data]

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase()
      result = result.filter((item) => item.date.toLowerCase().includes(q))
    }

    result.sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
    })

    return result
  }, [data, searchTerm, sortOrder])

  // Tổng hợp thống kê nhanh cho Header Cards
  const stats = useMemo(() => {
    const totalRev = data.reduce((acc, item) => acc + item.revenue, 0)
    const totalTickets = data.reduce((acc, item) => acc + item.ticketCount, 0)
    const totalCT01 = data.reduce((acc, item) => acc + item.routeCT01, 0)
    const totalCT02 = data.reduce((acc, item) => acc + item.routeCT02, 0)
    const totalVnpay = data.reduce((acc, item) => acc + item.vnpay, 0)
    const totalCash = data.reduce((acc, item) => acc + item.cash, 0)

    return {
      totalRev,
      totalTickets,
      totalCT01,
      totalCT02,
      totalVnpay,
      totalCash,
    }
  }, [data])

  // Xuất file CSV đối soát kế toán
  const exportToCSV = () => {
    if (data.length === 0) return

    const headers = [
      'Ngày',
      'Số Vé Bán',
      'Tuyến CT-01 (VNĐ)',
      'Tuyến CT-02 (VNĐ)',
      'VNPAY (VNĐ)',
      'MoMo (VNĐ)',
      'VietQR (VNĐ)',
      'Tiền Mặt (VNĐ)',
      'Tổng Doanh Thu (VNĐ)',
    ]

    const rows = data.map((item) => [
      item.date,
      item.ticketCount,
      item.routeCT01,
      item.routeCT02,
      item.vnpay,
      item.momo,
      item.vietqr,
      item.cash,
      item.revenue,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `bang-ke-doanh-thu-smartbus-${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CalendarDays size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Bảng Kê Đối Soát Doanh Thu Chi Tiết Từng Ngày
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40">
                  <ShieldCheck size={11} /> 100% SUPABASE REAL DATA
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Bảng kê dòng tiền giao dịch thực tế đã ghi nhận trên hệ thống vé điện tử ICTU
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportToCSV}
              disabled={data.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-50"
              title="Xuất file CSV báo cáo cho phòng kế toán"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Xuất CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="size-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* SUMMARY STATS TILES */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 sm:px-6 bg-slate-50/40 dark:bg-slate-950/30 border-b border-slate-200 dark:border-slate-800">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <DollarSign size={13} className="text-emerald-500" /> Tổng Doanh Thu
            </span>
            <div className="mt-1 text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {stats.totalRev.toLocaleString('vi-VN')} đ
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Ticket size={13} className="text-blue-500" /> Tổng Vé Phát Hành
            </span>
            <div className="mt-1 text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">
              {stats.totalTickets.toLocaleString('vi-VN')} vé
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Bus size={13} className="text-indigo-500" /> Tuyến CT-01 / CT-02
            </span>
            <div className="mt-1 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
              {stats.totalCT01.toLocaleString('vi-VN')} đ / {stats.totalCT02.toLocaleString('vi-VN')} đ
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <CreditCard size={13} className="text-amber-500" /> Kênh Trực Tuyến
            </span>
            <div className="mt-1 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
              VNPAY: {stats.totalVnpay.toLocaleString('vi-VN')} đ
            </div>
          </div>
        </div>

        {/* SEARCH & CONTROLS */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="relative w-full max-w-xs">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Tìm kiếm theo ngày (YYYY-MM-DD)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            Sắp xếp: {sortOrder === 'desc' ? 'Mới nhất trước' : 'Cũ nhất trước'}
          </button>
        </div>

        {/* DATA TABLE (SCROLLABLE) */}
        <div className="overflow-x-auto overflow-y-auto max-h-[50vh] p-5 sm:px-6">
          {filteredData.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Không có dữ liệu đối soát phù hợp trong kỳ đã chọn.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="py-3 px-3">Ngày Giao Dịch</th>
                  <th className="py-3 px-3 text-center">Số Vé</th>
                  <th className="py-3 px-3 text-right">Tuyến CT-01</th>
                  <th className="py-3 px-3 text-right">Tuyến CT-02</th>
                  <th className="py-3 px-3 text-right">VNPAY</th>
                  <th className="py-3 px-3 text-right">Tiền Mặt</th>
                  <th className="py-3 px-3 text-right font-black">Tổng Doanh Thu</th>
                  {onSelectDate && <th className="py-3 px-3 text-center">Chi Tiết</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-mono">
                {filteredData.map((item) => (
                  <tr
                    key={item.date}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-3 font-sans font-bold text-slate-900 dark:text-white">
                      {item.date}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold">
                        {item.ticketCount} vé
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300">
                      {item.routeCT01.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300">
                      {item.routeCT02.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300">
                      {item.vnpay.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300">
                      {item.cash.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-3 px-3 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      {item.revenue.toLocaleString('vi-VN')} đ
                    </td>
                    {onSelectDate && (
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectDate(item.date)
                            onClose()
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-sans font-semibold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition cursor-pointer"
                        >
                          Lọc ngày này
                          <ChevronRight size={12} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 sm:px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Tổng số ngày ghi nhận: {data.length} ngày
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer"
          >
            Đóng bảng kê
          </button>
        </div>
      </div>
    </div>
  )
}
