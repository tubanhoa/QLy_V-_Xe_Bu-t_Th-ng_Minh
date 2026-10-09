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
  Power,
  Trash2,
  Bus,
  Layers,
  Sparkles,
  Info,
  Filter,
} from 'lucide-react'
import { promotionService } from '@/lib/services/promotion.service'
import type {
  VoucherItem,
  VoucherDiscountType,
  VoucherApplicableType,
  CreateVoucherPayload,
} from '@/lib/types/promotion'

interface RouteOption {
  id: string
  routeCode: string
  name: string
}

export function AdminVouchers() {
  const [vouchers, setVouchers] = useState<VoucherItem[]>([])
  const [routes, setRoutes] = useState<RouteOption[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  // Modal tạo voucher
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Form state
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<VoucherDiscountType>('percentage')
  const [discountValue, setDiscountValue] = useState<number>(20)
  const [minOrderValue, setMinOrderValue] = useState<number>(20000)
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number>(30000)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  )
  const [usageLimit, setUsageLimit] = useState<number>(100)
  const [applicableType, setApplicableType] = useState<VoucherApplicableType>('all')
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([])

  // Tải danh sách vouchers
  const fetchVouchers = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await promotionService.getAdminVouchers({ limit: 100 })
      if (res.success && res.data) {
        setVouchers(res.data.items || [])
      } else {
        setErrorMsg(res.message || 'Không thể tải danh sách voucher')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối máy chủ voucher')
    } finally {
      setLoading(false)
    }
  }, [])

  // Tải danh sách tuyến đường để chọn phạm vi áp dụng
  const fetchRoutes = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/v1/routes?limit=50', {
        cache: 'no-store',
      })
      const json = await res.json()
      const data = json.data?.items || json.data || json
      if (Array.isArray(data)) {
        setRoutes(
          data.map((r: any) => ({
            id: r.id,
            routeCode: r.routeCode || r.code || 'ROUTE',
            name: r.name || 'Tuyến xe',
          })),
        )
      }
    } catch {
      // Non-blocking
    }
  }, [])

  useEffect(() => {
    fetchVouchers()
    fetchRoutes()
  }, [fetchVouchers, fetchRoutes])

  // Gợi ý sinh mã tự động
  const handleGenerateCode = () => {
    const prefix = discountType === 'percentage' ? 'ICTU' : 'KM'
    const val = discountType === 'percentage' ? discountValue : Math.round(discountValue / 1000) + 'K'
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
    setCode(`${prefix}${val}_${randomSuffix}`)
  }

  // Xử lý tạo voucher mới
  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) {
      alert('Vui lòng nhập mã voucher!')
      return
    }

    if (new Date(endDate) < new Date(startDate)) {
      alert('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!')
      return
    }

    if (discountType === 'percentage' && (discountValue <= 0 || discountValue > 100)) {
      alert('Mức giảm theo phần trăm phải nằm trong khoảng từ 1% đến 100%!')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      const payload: CreateVoucherPayload = {
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        discountType,
        discountValue: Number(discountValue),
        minOrderValue: Number(minOrderValue) || 0,
        maxDiscountAmount: discountType === 'percentage' ? Number(maxDiscountAmount) || undefined : undefined,
        startDate,
        endDate,
        usageLimit: Number(usageLimit) || 0,
        applicableType,
        applicableRouteIds: selectedRouteIds.length > 0 ? selectedRouteIds : undefined,
        status: 'active',
      }

      const res = await promotionService.createVoucher(payload)

      if (res.success && res.data) {
        setFeedbackSuccess(`Đã tạo thành công chiến dịch voucher [${res.data.code}]!`)
        setIsModalOpen(false)
        // Reset form
        setCode('')
        setDescription('')
        setDiscountValue(20)
        setMinOrderValue(20000)
        setMaxDiscountAmount(30000)
        setUsageLimit(100)
        setApplicableType('all')
        setSelectedRouteIds([])
        await fetchVouchers()
        setTimeout(() => setFeedbackSuccess(null), 4000)
      } else {
        alert(res.message || 'Không thể tạo mã voucher này')
      }
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Bật/tắt kích hoạt voucher nhanh
  const handleToggleStatus = async (voucher: VoucherItem) => {
    setActionLoadingId(voucher.id)
    try {
      const res = await promotionService.toggleVoucherStatus(voucher.id)
      if (res.success && res.data) {
        const newStatus = res.data.status
        setFeedbackSuccess(
          `Đã ${newStatus === 'active' ? 'KÍCH HOẠT LẠI' : 'TẠM DỪNG'} mã ${voucher.code}!`,
        )
        setVouchers((prev) =>
          prev.map((v) => (v.id === voucher.id ? { ...v, status: newStatus } : v)),
        )
        setTimeout(() => setFeedbackSuccess(null), 3000)
      } else {
        alert(res.message || 'Không thể đổi trạng thái voucher')
      }
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`)
    } finally {
      setActionLoadingId(null)
    }
  }

  // Xóa voucher an toàn
  const handleDeleteVoucher = async (voucher: VoucherItem) => {
    if (voucher.usedCount > 0) {
      alert(
        `Không thể xóa mã [${voucher.code}] vì đã có ${voucher.usedCount} lượt sử dụng trong các hóa đơn vé xe!\n\nĐể ngừng áp dụng, vui lòng bấm nút "Tạm dừng" (Inactive).`,
      )
      return
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn mã voucher [${voucher.code}] không?`)) {
      return
    }

    setActionLoadingId(voucher.id)
    try {
      const res = await promotionService.deleteVoucher(voucher.id)
      if (res.success) {
        setFeedbackSuccess(`Đã xóa vĩnh viễn voucher [${voucher.code}]!`)
        setVouchers((prev) => prev.filter((v) => v.id !== voucher.id))
        setTimeout(() => setFeedbackSuccess(null), 3000)
      } else {
        alert(res.message || 'Không thể xóa voucher')
      }
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`)
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleCopyCode = (voucherCode: string) => {
    navigator.clipboard.writeText(voucherCode)
    setCopiedCode(voucherCode)
    setTimeout(() => setCopiedCode(null), 2500)
  }

  // Bộ lọc danh sách
  const filteredVouchers = vouchers.filter((v) => {
    const matchSearch =
      search === '' ||
      v.code.toLowerCase().includes(search.toLowerCase()) ||
      (v.description && v.description.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = statusFilter === 'all' || v.status === statusFilter
    const matchType = typeFilter === 'all' || v.discountType === typeFilter
    return matchSearch && matchStatus && matchType
  })

  // Thống kê KPIs
  const totalCount = vouchers.length
  const activeCount = vouchers.filter((v) => v.status === 'active').length
  const totalUsed = vouchers.reduce((acc, v) => acc + (Number(v.usedCount) || 0), 0)
  const totalLimit = vouchers.reduce((acc, v) => acc + (Number(v.usageLimit) || 0), 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Ticket className="size-6 text-[#00A86B]" />
            Quản Lý Mã Giảm Giá & Voucher Marketing
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cấu hình chiến dịch kích cầu, ưu đãi sinh viên ICTU và phân bổ mã giảm giá theo tuyến xe
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
            onClick={() => {
              setIsModalOpen(true)
              if (!code) handleGenerateCode()
            }}
            className="flex items-center gap-2 rounded-xl bg-[#00A86B] px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <Plus className="size-4" /> Tạo Mã Voucher Mới
          </button>
        </div>
      </div>

      {feedbackSuccess && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs sm:text-sm font-semibold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
          <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
          <span>{feedbackSuccess}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="size-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-xs">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <Gift className="size-4 text-emerald-500" /> Tổng số Voucher
          </span>
          <p className="mt-2 text-3xl font-bold font-mono text-foreground">{totalCount}</p>
          <span className="mt-1.5 inline-block text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {activeCount} chiến dịch đang kích hoạt
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-xs">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <TrendingDown className="size-4 text-purple-500" /> Lượt áp dụng thành công
          </span>
          <p className="mt-2 text-3xl font-bold font-mono text-foreground">
            {totalUsed.toLocaleString('vi-VN')} <span className="text-sm font-normal text-muted-foreground">lượt</span>
          </p>
          <span className="mt-1.5 inline-block text-xs font-semibold text-purple-600 dark:text-purple-400">
            Hạn mức toàn hệ thống: {totalLimit.toLocaleString('vi-VN')} lượt
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-xs">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <ShieldCheck className="size-4 text-cyan-500" /> Tỷ lệ kích cầu
          </span>
          <p className="mt-2 text-3xl font-bold font-mono text-foreground">
            {totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0}%
          </p>
          <span className="mt-1.5 inline-block text-xs font-semibold text-cyan-600 dark:text-cyan-400">
            Tiết kiệm chi phí đi lại cho sinh viên
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-xs">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <Sparkles className="size-4 text-amber-500" /> Bảo mật & Chống gian lận
          </span>
          <p className="mt-2 text-xl font-bold text-foreground">Atomic Lock DB</p>
          <span className="mt-1.5 inline-block text-xs font-semibold text-amber-600 dark:text-amber-400">
            Chặn xóa voucher có hóa đơn
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo mã hoặc tên chiến dịch..."
              className="h-10 w-72 rounded-xl border border-border bg-background pl-9 pr-3 text-xs text-foreground focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="size-3.5 text-muted-foreground" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Tất cả hình thức</option>
              <option value="percentage">Giảm theo %</option>
              <option value="fixed_amount">Giảm số tiền cố định</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Trạng thái:</span>
          <div className="flex rounded-xl border border-border bg-muted/40 p-1">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'active', label: 'Đang chạy' },
              { id: 'inactive', label: 'Tạm dừng' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  statusFilter === st.id
                    ? 'bg-[#00A86B] text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="p-4 pl-6">Mã & Chiến dịch</th>
                <th className="p-4">Hình thức giảm</th>
                <th className="p-4">Mức giảm giá</th>
                <th className="p-4">Đơn tối thiểu</th>
                <th className="p-4">Áp dụng cho</th>
                <th className="p-4">Hạn sử dụng</th>
                <th className="p-4">Tiến độ sử dụng</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 pr-6 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">
                    Không tìm thấy mã voucher nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v) => {
                  const used = Number(v.usedCount) || 0
                  const limit = Number(v.usageLimit) || 0
                  const percentUsed = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
                  const isExpired = new Date(v.endDate) < new Date()
                  const isDepleted = limit > 0 && used >= limit

                  return (
                    <tr key={v.id} className="hover:bg-muted/20 transition-colors text-xs">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-2">
                          <Tag className="size-4 text-[#00A86B] shrink-0" />
                          <div>
                            <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 block">
                              {v.code}
                            </span>
                            {v.description && (
                              <span className="text-[11px] text-muted-foreground block line-clamp-1 max-w-xs">
                                {v.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        {v.discountType === 'percentage' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                            <Percent className="size-3" /> Phần trăm
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                            Tiền cố định
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

                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-500/10 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          {v.applicableType === 'monthly_pass'
                            ? 'Vé tháng'
                            : v.applicableType === 'single_ticket'
                              ? 'Vé lượt'
                              : 'Tất cả vé'}
                        </span>
                        {v.applicableRouteIds && v.applicableRouteIds.length > 0 && (
                          <span className="block text-[10px] text-muted-foreground mt-0.5">
                            {v.applicableRouteIds.length} tuyến chọn lọc
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-muted-foreground">
                        <div>
                          <span>{new Date(v.startDate).toLocaleDateString('vi-VN')}</span>
                          <span className="mx-1">→</span>
                          <span className={isExpired ? 'text-red-500 font-bold' : ''}>
                            {new Date(v.endDate).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      </td>

                      <td className="p-4 w-36">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="font-bold text-foreground">{used}</span>
                            <span className="text-muted-foreground">/ {limit > 0 ? limit : '∞'}</span>
                          </div>
                          {limit > 0 && (
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  percentUsed >= 100
                                    ? 'bg-red-500'
                                    : percentUsed >= 80
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                }`}
                                style={{ width: `${percentUsed}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            v.status === 'active' && !isExpired && !isDepleted
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : isDepleted
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : isExpired
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                  : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {v.status === 'active' && !isExpired && !isDepleted
                            ? 'Đang chạy'
                            : isDepleted
                              ? 'Hết lượt'
                              : isExpired
                                ? 'Hết hạn'
                                : 'Đã dừng'}
                        </span>
                      </td>

                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Copy code */}
                          <button
                            type="button"
                            title="Sao chép mã"
                            onClick={() => handleCopyCode(v.code)}
                            className="p-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors"
                          >
                            {copiedCode === v.code ? (
                              <CheckCircle2 className="size-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="size-3.5 text-muted-foreground" />
                            )}
                          </button>

                          {/* Toggle Active/Inactive */}
                          <button
                            type="button"
                            title={v.status === 'active' ? 'Tạm dừng mã' : 'Kích hoạt lại'}
                            disabled={actionLoadingId === v.id}
                            onClick={() => handleToggleStatus(v)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              v.status === 'active'
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                            }`}
                          >
                            <Power className="size-3.5" />
                          </button>

                          {/* Xóa voucher (nếu chưa dùng) */}
                          <button
                            type="button"
                            title={
                              v.usedCount > 0
                                ? 'Không thể xóa voucher đã phát sinh giao dịch'
                                : 'Xóa vĩnh viễn'
                            }
                            disabled={actionLoadingId === v.id}
                            onClick={() => handleDeleteVoucher(v)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              v.usedCount > 0
                                ? 'border-border bg-muted/40 text-muted-foreground cursor-not-allowed opacity-50'
                                : 'border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20'
                            }`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tạo Voucher Mới */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <Ticket className="size-5 text-[#00A86B]" />
                  Tạo Mã Voucher Khuyến Mại Mới
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Thiết lập điều kiện giảm giá, đối tượng áp dụng và hạn mức cho chiến dịch
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
              {/* Mã voucher & nút sinh mã */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-foreground">
                    Mã Voucher (Code) *
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="size-3" /> Sinh mã gợi ý
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="VD: ICTU20_TET2026, BANMOI50"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm uppercase font-bold text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Mô tả chiến dịch */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Mô tả chiến dịch khuyến mại
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="VD: Chào mừng tân sinh viên K22 ICTU - Giảm 20% tối đa 30.000đ"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Loại giảm & Mức giảm */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Hình thức giảm giá *
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => {
                      const nextType = e.target.value as VoucherDiscountType
                      setDiscountType(nextType)
                      if (nextType === 'percentage' && discountValue > 100) setDiscountValue(20)
                      if (nextType === 'fixed_amount' && discountValue < 1000) setDiscountValue(10000)
                    }}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  >
                    <option value="percentage">Giảm theo Phần trăm (%)</option>
                    <option value="fixed_amount">Giảm theo Số tiền cố định (VNĐ)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Mức giảm {discountType === 'percentage' ? '(%) *' : '(VNĐ) *'}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={discountType === 'percentage' ? 100 : 10000000}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm font-bold text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Đơn tối thiểu & Trần giảm giá */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Đơn hàng tối thiểu (VNĐ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={minOrderValue}
                    onChange={(e) => setMinOrderValue(Number(e.target.value))}
                    placeholder="20000"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Đơn từ {minOrderValue.toLocaleString('vi-VN')} đ mới được áp mã
                  </span>
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Trần giảm tối đa (VNĐ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    disabled={discountType === 'fixed_amount'}
                    value={maxDiscountAmount}
                    onChange={(e) => setMaxDiscountAmount(Number(e.target.value))}
                    placeholder="30000"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs text-foreground focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    {discountType === 'percentage'
                      ? `Tối đa ${maxDiscountAmount.toLocaleString('vi-VN')} đ`
                      : 'Không áp dụng cho số tiền cố định'}
                  </span>
                </div>
              </div>

              {/* Thời hạn sử dụng */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Ngày bắt đầu có hiệu lực *
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
                    Ngày kết thúc (Hết hạn) *
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

              {/* Giới hạn số lượt dùng */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Số lượng mã tối đa (Lượt dùng) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(Number(e.target.value))}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Hết {usageLimit} lượt mã sẽ tự động khóa
                  </span>
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Loại vé áp dụng *
                  </label>
                  <select
                    value={applicableType}
                    onChange={(e) => setApplicableType(e.target.value as VoucherApplicableType)}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">Tất cả (Vé lượt & Vé tháng)</option>
                    <option value="single_ticket">Chỉ áp dụng Vé Lượt</option>
                    <option value="monthly_pass">Chỉ áp dụng Vé Tháng</option>
                  </select>
                </div>
              </div>

              {/* Tuyến áp dụng cụ thể (Tùy chọn) */}
              {routes.length > 0 && (
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Tuyến đường áp dụng (Tùy chọn - mặc định toàn mạng lưới)
                  </label>
                  <div className="max-h-28 overflow-y-auto rounded-xl border border-border p-2 space-y-1.5 bg-background">
                    {routes.map((r) => {
                      const isChecked = selectedRouteIds.includes(r.id)
                      return (
                        <label
                          key={r.id}
                          className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 p-1 rounded-lg"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRouteIds((prev) => [...prev, r.id])
                              } else {
                                setSelectedRouteIds((prev) => prev.filter((id) => id !== r.id))
                              }
                            }}
                            className="rounded border-border text-[#00A86B] focus:ring-emerald-500"
                          />
                          <span className="font-bold font-mono text-[11px] text-foreground">
                            {r.routeCode}
                          </span>
                          <span className="text-muted-foreground text-[11px] line-clamp-1">
                            {r.name}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  {selectedRouteIds.length > 0 && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 block">
                      Đã chọn {selectedRouteIds.length} tuyến xe áp dụng
                    </span>
                  )}
                </div>
              )}

              {/* Nút hành động */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent"
                >
                  Hủy bỏ
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#00A86B] px-5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>Đang tạo...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      <span>Phát Hành Voucher</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
