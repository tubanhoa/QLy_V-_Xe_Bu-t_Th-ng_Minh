'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Ticket,
  Gift,
  Tag,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  RefreshCw,
  Ban,
  Search,
} from 'lucide-react'
import { promotionService } from '@/lib/services/promotion.service'
import type { VoucherItem } from '@/lib/types/promotion'

type FilterTab = 'all' | 'single_ticket' | 'monthly_pass' | 'expired'

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<VoucherItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await promotionService.getAvailableVouchers({ limit: 100 })
        if (res.success && Array.isArray(res.data)) {
          setVouchers(res.data)
        } else {
          setVouchers([])
        }
      } catch {
        setVouchers([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const todayStr = new Date().toISOString().slice(0, 10)
  const isVoucherExpired = (v: VoucherItem) => {
    if (v.isExpired === true) return true
    if (v.dynamicStatus === 'expired') return true
    if (v.status === 'expired') return true
    if (v.endDate && v.endDate.slice(0, 10) < todayStr) return true
    return false
  }

  const formatExpiry = (dateStr?: string) => {
    if (!dateStr) return 'Không thời hạn'
    const parts = dateStr.slice(0, 10).split('-')
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
    return dateStr
  }

  const filteredVouchers = vouchers.filter((v) => {
    const keyword = search.trim().toLowerCase()
    const matchSearch =
      keyword === '' ||
      v.code.toLowerCase().includes(keyword) ||
      (v.description && v.description.toLowerCase().includes(keyword))

    const isExpired = isVoucherExpired(v)

    if (filterTab === 'expired') {
      return matchSearch && isExpired
    }
    if (filterTab === 'single_ticket') {
      return matchSearch && !isExpired && (v.applicableType === 'single_ticket' || v.applicableType === 'all')
    }
    if (filterTab === 'monthly_pass') {
      return matchSearch && !isExpired && (v.applicableType === 'monthly_pass' || v.applicableType === 'all')
    }
    return matchSearch
  })

  const expiredCount = vouchers.filter(isVoucherExpired).length

  return (
    <div className="min-h-screen bg-[#F0F7F4] text-slate-900 flex flex-col justify-between">
      {/* Top Banner */}
      <header className="bg-gradient-to-r from-[#005A36] via-[#007044] to-emerald-800 text-white py-8 px-4 sm:px-8 relative overflow-hidden shadow-lg">
        <div className="max-w-5xl mx-auto relative z-10 space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-200 hover:text-white transition-colors bg-white/10 px-3 py-1 rounded-full backdrop-blur-md"
          >
            <ChevronLeft size={14} />
            <span>Về trang chủ đặt vé</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-0.5 text-xs font-black backdrop-blur-md">
                <Sparkles size={13} className="text-amber-300" />
                <span>ICTU Transit Rewards</span>
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                Kho Voucher & Khuyến Mại Đi Xe Buýt
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100 max-w-xl">
                Dữ liệu trực tiếp từ hệ thống xe buýt thông minh. Áp dụng mã để nhận ưu đãi tức thì khi đặt vé trực tuyến.
              </p>
            </div>

            <Link
              href="/?openTickets=true"
              className="inline-flex items-center gap-2 rounded-xl bg-white text-[#005A36] px-4 py-2.5 text-xs font-black shadow-md hover:bg-emerald-50 active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
            >
              <Ticket size={15} />
              <span>Ví vé của tôi</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 flex-1 space-y-6">
        {/* Filter Tabs & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap rounded-2xl bg-white p-1.5 shadow-xs border border-emerald-900/10 text-xs font-bold gap-1">
            {[
              { id: 'all' as FilterTab, label: 'Tất cả mã' },
              { id: 'single_ticket' as FilterTab, label: 'Vé Lượt' },
              { id: 'monthly_pass' as FilterTab, label: 'Vé Tháng' },
              {
                id: 'expired' as FilterTab,
                label: `Vé đã hết hạn${expiredCount > 0 ? ` (${expiredCount})` : ''}`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={`rounded-xl px-3 py-1.5 transition-all cursor-pointer ${
                  filterTab === tab.id
                    ? tab.id === 'expired'
                      ? 'bg-rose-950 text-rose-200 border border-rose-800 shadow-xs'
                      : 'bg-[#005A36] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm mã voucher..."
              className="rounded-2xl bg-white pl-8 pr-3 py-2 text-xs border border-emerald-900/10 outline-none focus:border-[#005A36] shadow-xs w-full sm:w-56"
            />
          </div>
        </div>

        {/* Voucher Cards Grid */}
        {loading ? (
          <div className="py-20 text-center space-y-3 text-slate-400">
            <RefreshCw className="size-8 animate-spin mx-auto text-[#005A36]" />
            <p className="text-sm font-semibold">Đang nạp dữ liệu voucher từ hệ thống...</p>
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="py-20 text-center space-y-2 bg-white rounded-3xl border border-dashed border-slate-300 p-8">
            <Gift className="size-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Không tìm thấy voucher phù hợp</p>
            <p className="text-xs text-slate-400">Hãy chọn tab danh mục khác hoặc xóa bộ lọc tìm kiếm</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVouchers.map((v) => {
              const isExpired = isVoucherExpired(v)
              const isPercent = v.discountType === 'percentage'
              const discountText = isPercent
                ? `GIẢM ${v.discountValue}%`
                : `GIẢM ${(Number(v.discountValue) || 0).toLocaleString('vi-VN')}đ`

              if (isExpired) {
                return (
                  <div
                    key={v.id || v.code}
                    className="rounded-3xl border border-slate-300 bg-slate-100/90 p-5 shadow-none flex flex-col justify-between gap-4 relative overflow-hidden opacity-75"
                  >
                    <span className="absolute top-4 right-4 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-2xs bg-slate-700 text-slate-300 border border-slate-600">
                      ĐÃ HẾT HẠN
                    </span>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2.5 rounded-2xl bg-slate-600 text-slate-300 shadow-2xs">
                          <Tag size={18} />
                        </div>
                        <div>
                          <span className="font-mono font-black text-lg text-slate-500 line-through block tracking-tight">
                            {v.code}
                          </span>
                          <span className="text-xs font-black text-slate-400 block line-through">
                            {discountText}
                          </span>
                        </div>
                      </div>

                      <h3 className="font-bold text-sm text-slate-600 leading-tight pt-1">
                        {v.description || 'Chương trình ưu đãi xe buýt thông minh'}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-400 border-t border-slate-200">
                        <span>Đơn tối thiểu: {Number(v.minOrderValue || 0).toLocaleString('vi-VN')}đ</span>
                        <span className="flex items-center gap-1 text-rose-600 font-bold">
                          <Ban size={11} /> Đã hết hạn: {formatExpiry(v.endDate)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="w-full py-2.5 rounded-xl bg-slate-300 text-slate-500 text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed opacity-60 text-center"
                    >
                      <span>Mã không khả dụng (Hết hạn)</span>
                    </button>
                  </div>
                )
              }

              return (
                <div
                  key={v.id || v.code}
                  className="rounded-3xl border border-emerald-900/10 bg-white p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 relative overflow-hidden group"
                >
                  <span className="absolute top-4 right-4 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-2xs bg-emerald-600 text-white">
                    {v.applicableType === 'monthly_pass'
                      ? 'VÉ THÁNG'
                      : v.applicableType === 'single_ticket'
                        ? 'VÉ LƯỢT'
                        : 'TOÀN MẠNG LƯỚI'}
                  </span>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-600 to-[#005A36] text-white shadow-2xs">
                        <Tag size={18} />
                      </div>
                      <div>
                        <span className="font-mono font-black text-lg text-[#005A36] block tracking-tight">
                          {v.code}
                        </span>
                        <span className="text-xs font-black text-amber-600 block">
                          {discountText}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 leading-tight pt-1">
                      {v.description || 'Ưu đãi đặc quyền cho hành khách xe buýt thông minh'}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-500 border-t border-slate-100">
                      <span>Đơn tối thiểu: <strong>{Number(v.minOrderValue || 0).toLocaleString('vi-VN')}đ</strong></span>
                      {isPercent && v.maxDiscountAmount && (
                        <span>Giảm tối đa: <strong>{Number(v.maxDiscountAmount).toLocaleString('vi-VN')}đ</strong></span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> HSD: {formatExpiry(v.endDate)}
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Link
                    href={`/?openVouchers=true`}
                    className="w-full py-2.5 rounded-xl bg-[#005A36] hover:bg-emerald-800 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 text-center cursor-pointer"
                  >
                    <span>Thu thập & Sử dụng ngay</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              )
            })}
          </div>
        )}

        {/* Thông tin chính sách */}
        <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50/60 p-5 space-y-2 text-xs text-emerald-950">
          <div className="flex items-center gap-2 font-black text-sm text-[#005A36]">
            <ShieldCheck size={18} />
            <span>Quy định sử dụng Voucher & Mã giảm giá thông minh</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1 text-xs">
            <li>Mỗi đơn đặt chỗ chỉ được áp dụng 01 mã giảm giá hợp lệ có trong hệ thống.</li>
            <li>Hệ thống tự động kiểm tra điều kiện đơn hàng tối thiểu và giới hạn số lượt sử dụng trong thời gian thực.</li>
            <li>Sau khi áp dụng mã thành công, số tiền cần thanh toán sẽ được khấu trừ tức thì trước khi tạo mã QR hoặc chuyển hướng thanh toán.</li>
          </ul>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        Hệ Thống Quản Lý Vé Xe Buýt Điện Thông Minh ICTU Transit · Bản Quyền 2026
      </footer>
    </div>
  )
}
