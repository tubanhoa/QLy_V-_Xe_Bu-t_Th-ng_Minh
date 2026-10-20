'use client'

/**
 * Modal Kho Voucher & Ưu Đãi Của Tôi (Customer Voucher Vault)
 * Đồng bộ 100% dữ liệu thực từ hệ thống CSDL (không hardcode).
 * Khi admin tạo mới, voucher lập tức xuất hiện.
 * Khi voucher hết hạn, UI hiển thị tone xám tối và các nút bấm bị vô hiệu hóa (disabled).
 * Hỗ trợ 4 tab: "Tất cả mã", "Vé Lượt", "Vé Tháng", "Vé đã hết hạn".
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
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Ban,
} from 'lucide-react'
import { promotionService } from '@/lib/services/promotion.service'
import type { VoucherItem } from '@/lib/types/promotion'

interface VoucherVaultModalProps {
  open: boolean
  onClose: () => void
  onUseVoucher?: (code: string) => void
}

type FilterTab = 'all' | 'single_ticket' | 'monthly_pass' | 'expired'

export function VoucherVaultModal({ open, onClose, onUseVoucher }: VoucherVaultModalProps) {
  const [vouchers, setVouchers] = useState<VoucherItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')

  // Tải danh sách voucher thực tế từ hệ thống (API /api/v1/vouchers)
  useEffect(() => {
    if (!open) return

    async function loadVouchers() {
      setLoading(true)
      setErrorMsg(null)
      try {
        const res = await promotionService.getAvailableVouchers({ limit: 100 })
        if (res.success && Array.isArray(res.data)) {
          setVouchers(res.data)
        } else {
          setVouchers([])
          if (!res.success) {
            setErrorMsg(res.message || 'Không thể tải kho voucher')
          }
        }
      } catch (err: any) {
        console.error('[VoucherVaultModal] Load vouchers error:', err)
        setErrorMsg('Lỗi kết nối máy chủ dữ liệu voucher')
        setVouchers([])
      } finally {
        setLoading(false)
      }
    }

    loadVouchers()
  }, [open])

  if (!open) return null

  const handleCopy = (code: string, isExpired: boolean) => {
    if (isExpired) return
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2500)
  }

  const handleUseNow = (code: string, isExpired: boolean) => {
    if (isExpired) return
    if (onUseVoucher) {
      onUseVoucher(code)
    }
    onClose()
  }

  // Định dạng ngày hết hạn YYYY-MM-DD -> DD/MM/YYYY
  const formatExpiry = (dateStr?: string) => {
    if (!dateStr) return 'Không thời hạn'
    const clean = dateStr.slice(0, 10).split('-')
    if (clean.length === 3) {
      return `${clean[2]}/${clean[1]}/${clean[0]}`
    }
    return dateStr
  }

  // Kiểm tra voucher đã hết hạn hay chưa
  const todayStr = new Date().toISOString().slice(0, 10)
  const checkIsExpired = (v: VoucherItem) => {
    if (v.isExpired === true) return true
    if (v.dynamicStatus === 'expired') return true
    if (v.status === 'expired') return true
    if (v.endDate && v.endDate.slice(0, 10) < todayStr) return true
    return false
  }

  const filteredVouchers = vouchers.filter((v) => {
    const keyword = search.trim().toLowerCase()
    const matchSearch =
      keyword === '' ||
      v.code.toLowerCase().includes(keyword) ||
      (v.description && v.description.toLowerCase().includes(keyword))

    const isExpired = checkIsExpired(v)

    if (filterTab === 'expired') {
      return matchSearch && isExpired
    }

    if (filterTab === 'single_ticket') {
      return matchSearch && !isExpired && (v.applicableType === 'single_ticket' || v.applicableType === 'all')
    }

    if (filterTab === 'monthly_pass') {
      return matchSearch && !isExpired && (v.applicableType === 'monthly_pass' || v.applicableType === 'all')
    }

    // filterTab === 'all'
    return matchSearch
  })

  // Đếm số lượng voucher hết hạn để gắn badge đếm trên tab
  const expiredCount = vouchers.filter(checkIsExpired).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header với Gradient thương hiệu ICTU Transit */}
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
                Dữ liệu thực tế từ hệ thống xe buýt thông minh. Áp dụng mã để nhận ưu đãi tức thì.
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

          {/* Thanh tìm kiếm & 4 Tabs Lọc */}
          <div className="mt-4 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            {/* 4 Tabs: Tất cả mã | Vé Lượt | Vé Tháng | Vé đã hết hạn */}
            <div className="flex flex-wrap sm:flex-nowrap rounded-xl bg-black/25 p-1 backdrop-blur-md text-xs font-bold gap-1">
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
                  className={`rounded-lg px-2.5 sm:px-3 py-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    filterTab === tab.id
                      ? tab.id === 'expired'
                        ? 'bg-rose-950/80 text-rose-200 border border-rose-500/40 shadow-xs'
                        : 'bg-white text-[#005A36] shadow-xs'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Ô tìm kiếm */}
            <div className="relative shrink-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm voucher..."
                className="w-full sm:w-44 rounded-xl bg-black/20 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/60 border border-white/10 outline-none focus:border-white/40 backdrop-blur-md"
              />
            </div>
          </div>
        </div>

        {/* Thân danh sách Vouchers */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 bg-slate-50 dark:bg-slate-950">
          {loading ? (
            <div className="py-16 text-center space-y-3 text-slate-400">
              <RefreshCw className="size-8 animate-spin mx-auto text-[#005A36]" />
              <p className="text-sm font-semibold">Đang tải kho voucher từ máy chủ...</p>
            </div>
          ) : errorMsg ? (
            <div className="py-16 text-center space-y-2">
              <AlertCircle className="size-10 text-rose-500 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{errorMsg}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true)
                  promotionService.getAvailableVouchers({ limit: 100 }).then((res) => {
                    if (res.success && res.data) setVouchers(res.data)
                    setLoading(false)
                  })
                }}
                className="text-xs text-[#005A36] dark:text-emerald-400 font-bold hover:underline cursor-pointer"
              >
                Thử tải lại
              </button>
            </div>
          ) : filteredVouchers.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              {filterTab === 'expired' ? (
                <>
                  <Clock className="size-10 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    Không có voucher nào đã hết hạn
                  </p>
                  <p className="text-xs text-slate-400">
                    Tất cả các voucher hiện tại đều đang trong thời hạn áp dụng
                  </p>
                </>
              ) : (
                <>
                  <Gift className="size-10 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    Không tìm thấy voucher phù hợp
                  </p>
                  <p className="text-xs text-slate-400">
                    Hãy thử tìm kiếm với từ khóa khác hoặc chuyển sang danh mục khác
                  </p>
                </>
              )}
            </div>
          ) : (
            filteredVouchers.map((v) => {
              const used = Number(v.usedCount) || 0
              const limit = Number(v.usageLimit) || 0
              const isPercent = v.discountType === 'percentage'
              const discountText = isPercent
                ? `${v.discountValue}%`
                : `${(Number(v.discountValue) || 0).toLocaleString('vi-VN')}đ`
              const isExpired = checkIsExpired(v)

              // Khi hết hạn: màu xám tối (dark gray theme), disabled button
              if (isExpired) {
                return (
                  <div
                    key={v.id || v.code}
                    className="group relative rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/90 shadow-none transition-all overflow-hidden flex flex-col sm:flex-row items-stretch opacity-75"
                  >
                    {/* Cột trái: Tag xám tối biểu thị đã hết hạn */}
                    <div className="sm:w-36 bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 text-slate-300 p-4 flex flex-row sm:flex-col items-center justify-between sm:justify-center text-center shrink-0 border-b sm:border-b-0 sm:border-r border-dashed border-slate-500/40 relative">
                      <div className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-50 dark:bg-slate-950" />

                      <div className="flex sm:flex-col items-center gap-1.5 sm:gap-0">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-500/40">
                          HẾT HẠN
                        </span>
                        <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-400 line-through">
                          {discountText}
                        </span>
                      </div>

                      <span className="text-[10px] font-semibold text-slate-400 bg-black/40 px-2 py-0.5 rounded-full mt-0 sm:mt-1">
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
                          <span className="inline-flex items-center gap-1.5 font-mono font-bold text-sm text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 line-through">
                            <Tag size={12} />
                            {v.code}
                          </span>

                          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900">
                            <Ban size={12} />
                            <span>Đã hết hạn: {formatExpiry(v.endDate)}</span>
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed pt-1">
                          {v.description || 'Chương trình khuyến mại đã kết thúc thời gian áp dụng'}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 dark:text-slate-500">
                          <span>Đơn tối thiểu: {Number(v.minOrderValue || 0).toLocaleString('vi-VN')}đ</span>
                          {isPercent && v.maxDiscountAmount && (
                            <span>Giảm tối đa: {Number(v.maxDiscountAmount).toLocaleString('vi-VN')}đ</span>
                          )}
                          {limit > 0 && (
                            <span>Đã dùng: {used}/{limit} lượt</span>
                          )}
                        </div>
                      </div>

                      {/* Hàng nút bấm thao tác (Bị vô hiệu hóa - Disabled) */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        {/* Sao chép mã (Disabled) */}
                        <button
                          type="button"
                          disabled
                          aria-disabled="true"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-200/50 dark:bg-slate-800/40 cursor-not-allowed opacity-60"
                        >
                          <Copy size={13} />
                          <span>Sao chép</span>
                        </button>

                        {/* Dùng ngay (Disabled hoàn toàn, không thể click) */}
                        <button
                          type="button"
                          disabled
                          aria-disabled="true"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-3.5 py-1.5 text-xs font-bold cursor-not-allowed opacity-60 shadow-none"
                        >
                          <span>Không khả dụng</span>
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }

              // Voucher hợp lệ (Active)
              return (
                <div
                  key={v.id || v.code}
                  className="group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col sm:flex-row items-stretch"
                >
                  {/* Cột trái: Tag giá trị giảm giá (Badge dạng vé Coupon) */}
                  <div className="sm:w-36 bg-gradient-to-br from-emerald-600 to-[#005A36] text-white p-4 flex flex-row sm:flex-col items-center justify-between sm:justify-center text-center shrink-0 border-b sm:border-b-0 sm:border-r border-dashed border-emerald-400/40 relative">
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
                          <span>HSD: {formatExpiry(v.endDate)}</span>
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold leading-relaxed pt-1">
                        {v.description || 'Ưu đãi đặc quyền cho hành khách di chuyển bằng xe buýt thông minh ICTU'}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>
                          Đơn tối thiểu: <strong>{Number(v.minOrderValue || 0).toLocaleString('vi-VN')}đ</strong>
                        </span>
                        {isPercent && v.maxDiscountAmount && (
                          <span>
                            Giảm tối đa: <strong>{Number(v.maxDiscountAmount).toLocaleString('vi-VN')}đ</strong>
                          </span>
                        )}
                        {limit > 0 && (
                          <span>
                            Đã dùng: <strong>{used}/{limit} lượt</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hàng nút bấm thao tác (Khả dụng) */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {/* Sao chép mã */}
                      <button
                        type="button"
                        onClick={() => handleCopy(v.code, false)}
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
                        onClick={() => handleUseNow(v.code, false)}
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
