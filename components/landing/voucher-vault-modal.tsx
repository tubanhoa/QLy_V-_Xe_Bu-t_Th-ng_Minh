'use client'

/**
 * Modal Kho Voucher & Ưu Đãi Của Tôi (Customer Voucher Vault)
 * Thiết kế giao diện Premium Ticket Card với viền răng cưa, ánh kim thương hiệu ICTU Transit (#005A36)
 */

import { useState, useEffect } from 'react'
import {
  Gift,
  Ticket,
  Percent,
  Tag,
  Copy,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  X,
  Search,
  Filter,
  ShieldCheck,
  RefreshCw,
  Bus,
} from 'lucide-react'
import { promotionService } from '@/lib/services/promotion.service'
import type { VoucherItem } from '@/lib/types/promotion'

interface VoucherVaultModalProps {
  open: boolean
  onClose: () => void
  onUseVoucher?: (code: string) => void
}

// Danh sách voucher mặc định hấp dẫn dành cho sinh viên ICTU
const FEATURED_STUDENT_VOUCHERS: Partial<VoucherItem>[] = [
  {
    id: 'f-1',
    code: 'ICTU2026',
    description: 'Ưu đãi chào tân sinh viên K22 ICTU - Giảm ngay 20% tối đa 30.000đ cho mọi chuyến buýt',
    discountType: 'percentage',
    discountValue: 20,
    minOrderValue: 20000,
    maxDiscountAmount: 30000,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    usageLimit: 500,
    usedCount: 142,
    applicableType: 'all',
    status: 'active',
  },
  {
    id: 'f-2',
    code: 'ICTU_BUS10K',
    description: 'Trợ giá kích cầu tuyến xe buýt Thái Nguyên - Trừ thẳng 10.000đ trực tiếp vào giá vé lượt',
    discountType: 'fixed_amount',
    discountValue: 10000,
    minOrderValue: 10000,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    usageLimit: 300,
    usedCount: 88,
    applicableType: 'single_ticket',
    status: 'active',
  },
  {
    id: 'f-3',
    code: 'VETHANG_50K',
    description: 'Giảm 50.000đ khi đăng ký mới hoặc gia hạn vé tháng liên tuyến ĐH Thái Nguyên',
    discountType: 'fixed_amount',
    discountValue: 50000,
    minOrderValue: 100000,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    usageLimit: 200,
    usedCount: 65,
    applicableType: 'monthly_pass',
    status: 'active',
  },
  {
    id: 'f-4',
    code: 'CUOITUAN_VUI',
    description: 'Kích cầu di chuyển cuối tuần - Giảm 15% tối đa 20.000đ cho các chuyến xe thứ 7 & chủ nhật',
    discountType: 'percentage',
    discountValue: 15,
    minOrderValue: 20000,
    maxDiscountAmount: 20000,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    usageLimit: 400,
    usedCount: 110,
    applicableType: 'single_ticket',
    status: 'active',
  },
]

export function VoucherVaultModal({ open, onClose, onUseVoucher }: VoucherVaultModalProps) {
  const [vouchers, setVouchers] = useState<VoucherItem[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [filterTab, setFilterTab] = useState<'all' | 'single_ticket' | 'monthly_pass'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return

    async function loadVouchers() {
      setLoading(true)
      try {
        const res = await promotionService.getAvailableVouchers()
        if (res.success && res.data && res.data.length > 0) {
          // Gộp các voucher thực tế từ DB với các voucher khuyến mãi nổi bật
          const existingCodes = new Set(res.data.map((v) => v.code))
          const merged = [
            ...res.data,
            ...FEATURED_STUDENT_VOUCHERS.filter((f) => !existingCodes.has(f.code!)),
          ]
          setVouchers(merged as VoucherItem[])
        } else {
          setVouchers(FEATURED_STUDENT_VOUCHERS as VoucherItem[])
        }
      } catch {
        setVouchers(FEATURED_STUDENT_VOUCHERS as VoucherItem[])
      } finally {
        setLoading(false)
      }
    }

    loadVouchers()
  }, [open])

  if (!open) return null

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2500)
  }

  const handleUseNow = (code: string) => {
    if (onUseVoucher) {
      onUseVoucher(code)
    }
    onClose()
  }

  const filteredVouchers = vouchers.filter((v) => {
    const matchSearch =
      search === '' ||
      v.code.toLowerCase().includes(search.toLowerCase()) ||
      (v.description && v.description.toLowerCase().includes(search.toLowerCase()))

    const matchTab =
      filterTab === 'all' ||
      v.applicableType === 'all' ||
      v.applicableType === filterTab

    return matchSearch && matchTab
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header với Gradient thương hiệu */}
        <div className="relative bg-gradient-to-r from-[#005A36] via-[#007044] to-emerald-800 p-5 sm:p-6 text-white shrink-0 overflow-hidden">
          {/* Họa tiết trang trí */}
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-6 opacity-10 pointer-events-none">
            <Ticket size={180} />
          </div>

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-black backdrop-blur-md">
                <Sparkles size={14} className="text-amber-300" />
                <span>ICTU Transit Rewards</span>
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Kho Voucher & Ưu Đãi Của Tôi
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100 max-w-md">
                Áp dụng mã giảm giá để tiết kiệm chi phí vé buýt điện thông minh mỗi ngày
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-black/20 p-2 text-white/80 hover:bg-black/40 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Thanh tìm kiếm & Tabs */}
          <div className="mt-4 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            {/* Tabs */}
            <div className="flex rounded-xl bg-black/20 p-1 backdrop-blur-md text-xs font-bold">
              {[
                { id: 'all', label: 'Tất cả mã' },
                { id: 'single_ticket', label: 'Vé Lượt' },
                { id: 'monthly_pass', label: 'Vé Tháng' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id as any)}
                  className={`rounded-lg px-3 py-1.5 transition-all ${
                    filterTab === tab.id
                      ? 'bg-white text-[#005A36] shadow-xs'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Ô tìm kiếm */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm voucher..."
                className="w-full sm:w-48 rounded-xl bg-black/20 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/60 border border-white/10 outline-none focus:border-white/40 backdrop-blur-md"
              />
            </div>
          </div>
        </div>

        {/* Thân danh sách Vouchers */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 bg-slate-50 dark:bg-slate-950">
          {loading ? (
            <div className="py-16 text-center space-y-3 text-slate-400">
              <RefreshCw className="size-8 animate-spin mx-auto text-[#005A36]" />
              <p className="text-sm font-semibold">Đang nạp kho voucher ưu đãi...</p>
            </div>
          ) : filteredVouchers.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Gift className="size-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Không tìm thấy voucher phù hợp
              </p>
              <p className="text-xs text-slate-400">
                Hãy thử tìm kiếm với từ khóa khác hoặc chuyển tab danh mục
              </p>
            </div>
          ) : (
            filteredVouchers.map((v) => {
              const used = Number(v.usedCount) || 0
              const limit = Number(v.usageLimit) || 0
              const isPercent = v.discountType === 'percentage'
              const discountText = isPercent
                ? `${v.discountValue}%`
                : `${(Number(v.discountValue) || 0).toLocaleString('vi-VN')}đ`

              return (
                <div
                  key={v.id || v.code}
                  className="group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col sm:flex-row items-stretch"
                >
                  {/* Cột trái: Tag giá trị giảm giá (Badge dạng vé Coupon) */}
                  <div className="sm:w-36 bg-gradient-to-br from-emerald-600 to-[#005A36] text-white p-4 flex flex-row sm:flex-col items-center justify-between sm:justify-center text-center shrink-0 border-b sm:border-b-0 sm:border-r border-dashed border-emerald-400/40 relative">
                    {/* Họa tiết răng cưa giả lập vé */}
                    <div className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-50 dark:bg-slate-950" />

                    <div className="flex sm:flex-col items-center gap-1.5 sm:gap-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                        GIẢM NGAY
                      </span>
                      <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-amber-300">
                        {discountText}
                      </span>
                    </div>

                    <span className="text-[10px] font-semibold text-emerald-100 bg-black/20 px-2 py-0.5 rounded-full mt-0 sm:mt-1">
                      {v.applicableType === 'monthly_pass'
                        ? 'Vé Tháng'
                        : v.applicableType === 'single_ticket'
                          ? 'Vé Lượt'
                          : 'Tất cả vé'}
                    </span>
                  </div>

                  {/* Cột giữa: Chi tiết điều kiện & mô tả */}
                  <div className="flex-1 p-4 flex flex-col justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-mono font-black text-sm text-[#005A36] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          <Tag size={12} />
                          {v.code}
                        </span>

                        <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                          <Clock size={12} />
                          <span>HSD: {v.endDate ? new Date(v.endDate).toLocaleDateString('vi-VN') : 'Không thời hạn'}</span>
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold leading-relaxed pt-1">
                        {v.description || 'Ưu đãi đặc quyền cho hành khách di chuyển bằng xe buýt thông minh'}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Đơn tối thiểu: <strong>{Number(v.minOrderValue || 0).toLocaleString('vi-VN')}đ</strong></span>
                        {isPercent && v.maxDiscountAmount && (
                          <span>Giảm tối đa: <strong>{Number(v.maxDiscountAmount).toLocaleString('vi-VN')}đ</strong></span>
                        )}
                        {limit > 0 && (
                          <span>Đã dùng: <strong>{used}/{limit} lượt</strong></span>
                        )}
                      </div>
                    </div>

                    {/* Hàng nút bấm thao tác */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {/* Sao chép mã */}
                      <button
                        type="button"
                        onClick={() => handleCopy(v.code)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        {copiedCode === v.code ? (
                          <>
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            <span className="text-emerald-600">Đã sao chép</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Sao chép mã</span>
                          </>
                        )}
                      </button>

                      {/* Dùng ngay */}
                      <button
                        type="button"
                        onClick={() => handleUseNow(v.code)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#005A36] hover:bg-emerald-800 text-white px-3.5 py-1.5 text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer"
                      >
                        <span>Dùng ngay</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer thông báo */}
        <div className="p-3.5 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 px-6">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-[#005A36]" />
            <span>Chính sách áp dụng 1 voucher trên mỗi đơn đặt chỗ</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="font-bold text-[#005A36] dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Đóng kho ưu đãi
          </button>
        </div>
      </div>
    </div>
  )
}
