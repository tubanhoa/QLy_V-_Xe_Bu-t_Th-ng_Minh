'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Ticket,
  Plus,
  Search,
  Calendar,
  Percent,
  Copy,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Tag,
  ShieldCheck,
  TrendingDown,
  Gift,
} from 'lucide-react'
import { authService } from '@/lib/services/auth.service'

interface VoucherItem {
  id: string
  code: string
  discountType: 'percentage' | 'fixed_amount' | string
  discountValue: string | number
  minOrderValue?: string | number
  maxDiscountAmount?: string | number
  startDate: string
  endDate: string
  usageLimit: number
  usedCount: number
  status: 'active' | 'inactive' | 'expired' | string
  createdAt: string
}

export function AdminVouchers() {
  const [vouchers, setVouchers] = useState<VoucherItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modal tạo voucher
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null)

  // Form state
  const [code, setCode] = useState('')
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed_amount'>('percentage')
  const [discountValue, setDiscountValue] = useState<number>(20)
  const [minOrderValue, setMinOrderValue] = useState<number>(10000)
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number>(20000)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  )
  const [usageLimit, setUsageLimit] = useState<number>(500)

  const fetchVouchers = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const token = authService.getToken()
      const res = await fetch('http://localhost:3001/api/v1/admin/vouchers?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setVouchers(json.data?.items || [])
      } else {
        setErrorMsg(json.message || 'Không thể tải danh sách voucher')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối máy chủ voucher')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVouchers()
  }, [fetchVouchers])

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) {
      alert('Vui lòng nhập mã voucher!')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      const token = authService.getToken()
      const payload = {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: Number(discountValue),
        minOrderValue: Number(minOrderValue),
        maxDiscountAmount: discountType === 'percentage' ? Number(maxDiscountAmount) : undefined,
        startDate,
        endDate,
        usageLimit: Number(usageLimit),
      }

      const res = await fetch('http://localhost:3001/api/v1/vouchers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (res.ok && (json.success || json.data)) {
        setFeedbackSuccess(`Đã tạo thành công mã voucher ${code.toUpperCase()}!`)
        setIsModalOpen(false)
        // Reset form
        setCode('')
        setDiscountValue(20)
        await fetchVouchers()
        setTimeout(() => setFeedbackSuccess(null), 4000)
      } else {
        alert(json.message || 'Không thể tạo mã voucher này')
      }
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyCode = (voucherCode: string) => {
    navigator.clipboard.writeText(voucherCode)
    setCopiedCode(voucherCode)
    setTimeout(() => setCopiedCode(null), 2500)
  }

  const filteredVouchers = vouchers.filter((v) => {
    const matchSearch =
      search === '' || v.code.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || v.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Ticket className="size-6 text-[#00A86B]" />
            Quản Lý Mã Giảm Giá & Voucher Khuyến Mại
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Phát hành voucher khuyến mại dành cho sinh viên ICTU và khách hàng di chuyển thông minh
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchVouchers}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#00A86B] px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <Plus className="size-4" /> Tạo Mã Voucher Mới
          </button>
        </div>
      </div>

      {feedbackSuccess && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs sm:text-sm font-semibold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
          <CheckCircle2 className="size-5 text-emerald-500" />
          <span>{feedbackSuccess}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="size-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <Gift className="size-4 text-emerald-500" /> Tổng số Voucher
          </span>
          <p className="mt-2 text-3xl font-bold font-mono text-foreground">
            {vouchers.length} chiến dịch
          </p>
          <span className="mt-2 inline-block text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {vouchers.filter((v) => v.status === 'active').length} đang hoạt động
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <TrendingDown className="size-4 text-purple-500" /> Lượt áp dụng thành công
          </span>
          <p className="mt-2 text-3xl font-bold font-mono text-foreground">
            {vouchers.reduce((acc, v) => acc + (v.usedCount || 0), 0)} lượt
          </p>
          <span className="mt-2 inline-block text-xs font-semibold text-purple-600 dark:text-purple-400">
            Tiết kiệm chi phí đi lại cho HSSV
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <ShieldCheck className="size-4 text-cyan-500" /> Cơ chế chống lạm dụng
          </span>
          <p className="mt-2 text-2xl font-bold text-foreground">Rate Limit 10/phút</p>
          <span className="mt-2 inline-block text-xs font-semibold text-cyan-600 dark:text-cyan-400">
            Giới hạn tối đa 1 vé/sinh viên
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="relative">
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã voucher (ICTU...)"
            className="h-10 w-64 rounded-xl border border-border bg-background pl-9 pr-3 text-xs text-foreground focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Trạng thái:</span>
          <div className="flex rounded-xl border border-border bg-muted/40 p-1">
            {['all', 'active', 'inactive'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  statusFilter === st
                    ? 'bg-[#00A86B] text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {st === 'all' ? 'Tất cả' : st === 'active' ? 'Đang chạy' : 'Đã dừng'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="p-4 pl-6">Mã Voucher</th>
                <th className="p-4">Hình thức giảm</th>
                <th className="p-4">Giá trị giảm</th>
                <th className="p-4">Đơn tối thiểu</th>
                <th className="p-4">Hạn sử dụng</th>
                <th className="p-4">Lượt dùng</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 pr-6 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">
                    Không tìm thấy mã voucher nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/20 transition-colors text-xs">
                    <td className="p-4 pl-6 font-mono font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <Tag className="size-3.5 text-[#00A86B]" />
                        <span className="text-sm text-emerald-600 dark:text-emerald-400">
                          {v.code}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      {v.discountType === 'percentage' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                          <Percent className="size-3" /> Phần trăm
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                          Số tiền cố định
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-bold font-mono text-foreground">
                      {v.discountType === 'percentage'
                        ? `${v.discountValue}% (tối đa ${(Number(v.maxDiscountAmount) || 0).toLocaleString('vi-VN')} đ)`
                        : `${Number(v.discountValue).toLocaleString('vi-VN')} đ`}
                    </td>
                    <td className="p-4 font-mono text-muted-foreground">
                      {Number(v.minOrderValue || 0).toLocaleString('vi-VN')} đ
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(v.startDate).toLocaleDateString('vi-VN')} →{' '}
                      {new Date(v.endDate).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="p-4 font-mono">
                      <span className="font-bold text-foreground">{v.usedCount}</span> /{' '}
                      <span className="text-muted-foreground">{v.usageLimit}</span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          v.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {v.status === 'active' ? 'Đang kích hoạt' : 'Hết hiệu lực'}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button
                        type="button"
                        onClick={() => handleCopyCode(v.code)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
                      >
                        {copiedCode === v.code ? (
                          <>
                            <CheckCircle2 className="size-3.5 text-emerald-500" /> Đã chép
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5" /> Sao chép
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tạo Voucher Mới */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-lg text-foreground">Tạo Mã Voucher Khuyến Mại</h3>
                <p className="text-xs text-muted-foreground">
                  Phát hành mã giảm giá vé xe buýt điện thông minh
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Mã Voucher (Ví dụ: CHAOTAN2026, ICTU50) *
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="CHAOTAN2026"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm uppercase text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Loại giảm giá
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  >
                    <option value="percentage">Phần trăm (%)</option>
                    <option value="fixed_amount">Số tiền cố định (VNĐ)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Mức giảm {discountType === 'percentage' ? '(%)' : '(VNĐ)'} *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Đơn tối thiểu (VNĐ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minOrderValue}
                    onChange={(e) => setMinOrderValue(Number(e.target.value))}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Giảm tối đa (VNĐ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={discountType !== 'percentage'}
                    value={maxDiscountAmount}
                    onChange={(e) => setMaxDiscountAmount(Number(e.target.value))}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs text-foreground focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Ngày bắt đầu
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Ngày kết thúc
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Giới hạn số lượt sử dụng toàn hệ thống
                </label>
                <input
                  type="number"
                  min={1}
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-[#00A86B] px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-md"
                >
                  {isSubmitting && <RefreshCw className="size-3.5 animate-spin" />}
                  Lưu & Phát Hành Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
