'use client'

/**
 * Component nhập mã giảm giá với validation realtime và chọn voucher trực quan từ Kho Ưu Đãi
 * Thiết kế giao diện Light & Dark Theme chuẩn nhận diện thương hiệu ICTU Transit (#005A36)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Tag,
  Check,
  X,
  Loader2,
  Sparkles,
  Ticket,
  ChevronRight,
  Gift,
  AlertCircle,
  Percent,
} from 'lucide-react'
import { promotionService } from '@/lib/services/promotion.service'
import type { VoucherValidationResult, VoucherItem } from '@/lib/types/promotion'

interface VoucherInputProps {
  orderAmount: number
  onApplied: (result: VoucherValidationResult | null) => void
  disabled?: boolean
  initialCode?: string
  routeId?: string
  serviceType?: 'single_ticket' | 'monthly_pass' | 'all'
}

// Danh sách voucher fallback giới thiệu nếu API chưa trả về
const DEFAULT_FEATURED_VOUCHERS: Partial<VoucherItem>[] = [
  {
    code: 'ICTU2026',
    description: 'Ưu đãi chào tân sinh viên K22 ICTU - Giảm 20% tối đa 30.000đ',
    discountType: 'percentage',
    discountValue: 20,
    minOrderValue: 20000,
    maxDiscountAmount: 30000,
    applicableType: 'all',
  },
  {
    code: 'ICTU_BUS10K',
    description: 'Trợ giá kích cầu tuyến xe buýt Thái Nguyên - Giảm ngay 10.000đ',
    discountType: 'fixed_amount',
    discountValue: 10000,
    minOrderValue: 10000,
    applicableType: 'single_ticket',
  },
  {
    code: 'VETHANG_50K',
    description: 'Giảm 50.000đ khi đăng ký hoặc gia hạn vé tháng',
    discountType: 'fixed_amount',
    discountValue: 50000,
    minOrderValue: 100000,
    applicableType: 'monthly_pass',
  },
]

export function VoucherInput({
  orderAmount,
  onApplied,
  disabled,
  initialCode,
  routeId,
  serviceType = 'single_ticket',
}: VoucherInputProps) {
  const [code, setCode] = useState(initialCode || '')
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [result, setResult] = useState<VoucherValidationResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [availableVouchers, setAvailableVouchers] = useState<VoucherItem[]>([])
  const [loadingVouchers, setLoadingVouchers] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

  // Validate mã voucher với backend
  const validate = useCallback(
    async (voucherCode: string) => {
      if (!voucherCode.trim() || voucherCode.length < 3) {
        setStatus('idle')
        setResult(null)
        onApplied(null)
        return
      }

      setStatus('checking')
      setErrorMsg('')

      const res = await promotionService.validateVoucher({
        code: voucherCode.toUpperCase(),
        orderAmount,
        routeId,
        serviceType,
      })

      if (res.success && res.data && res.data.valid) {
        setStatus('valid')
        setResult(res.data)
        onApplied(res.data)
      } else {
        setStatus('invalid')
        setErrorMsg(res.message || res.data?.message || 'Mã giảm giá không hợp lệ hoặc đã hết hạn')
        setResult(null)
        onApplied(null)
      }
    },
    [orderAmount, routeId, serviceType, onApplied],
  )

  useEffect(() => {
    if (initialCode && initialCode !== code) {
      setCode(initialCode)
    }
  }, [initialCode])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!code) {
      setStatus('idle')
      setResult(null)
      onApplied(null)
      return
    }
    debounceRef.current = setTimeout(() => validate(code), 450)
    return () => clearTimeout(debounceRef.current)
  }, [code, validate, onApplied])

  const handleClear = () => {
    setCode('')
    setStatus('idle')
    setResult(null)
    setErrorMsg('')
    onApplied(null)
  }

  // Mở modal chọn voucher từ kho
  const handleOpenPicker = async () => {
    setIsPickerOpen(true)
    setLoadingVouchers(true)
    try {
      const res = await promotionService.getAvailableVouchers()
      if (res.success && res.data && res.data.length > 0) {
        setAvailableVouchers(res.data)
      } else {
        setAvailableVouchers(DEFAULT_FEATURED_VOUCHERS as VoucherItem[])
      }
    } catch {
      setAvailableVouchers(DEFAULT_FEATURED_VOUCHERS as VoucherItem[])
    } finally {
      setLoadingVouchers(false)
    }
  }

  // Chọn 1 voucher từ modal
  const handleSelectVoucher = (selectedVoucher: Partial<VoucherItem>) => {
    if (!selectedVoucher.code) return
    setCode(selectedVoucher.code.toUpperCase())
    setIsPickerOpen(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="voucher-code-input"
          className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
        >
          <Tag className="w-3.5 h-3.5 text-[#005A36] shrink-0" />
          <span>Mã giảm giá / Voucher</span>
        </label>

        {/* Nút Chọn voucher từ kho */}
        <button
          type="button"
          onClick={handleOpenPicker}
          disabled={disabled}
          className="text-[11px] font-bold text-[#005A36] dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
        >
          <Gift className="w-3.5 h-3.5 text-amber-500" />
          <span>Chọn từ Kho Ưu Đãi</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Input */}
      <div className="relative">
        <input
          id="voucher-code-input"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Nhập mã (VD: ICTU2026, BANMOI)..."
          maxLength={20}
          disabled={disabled}
          className={`w-full pl-3.5 pr-10 py-2 rounded-xl border text-xs font-mono font-bold uppercase outline-none transition-all placeholder:text-slate-400 placeholder:normal-case placeholder:font-normal ${
            status === 'valid'
              ? 'border-emerald-500 bg-emerald-50/40 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20'
              : status === 'invalid'
                ? 'border-rose-400 bg-rose-50/40 text-rose-900 dark:bg-rose-950/30 dark:text-rose-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20'
                : 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]/20 focus:bg-white dark:focus:bg-slate-900'
          } disabled:opacity-50`}
          autoComplete="off"
          spellCheck={false}
        />

        {/* Right action/state icon */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {status === 'checking' && (
            <Loader2 className="w-4 h-4 text-[#005A36] animate-spin" />
          )}
          {status === 'valid' && (
            <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
            </div>
          )}
          {status === 'invalid' && (
            <div className="w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
              <X className="w-3.5 h-3.5 text-rose-700 dark:text-rose-300" />
            </div>
          )}
          {(status === 'idle' || status === 'valid') && code && (
            <button
              type="button"
              onClick={handleClear}
              className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              id="clear-voucher-btn"
              title="Xóa mã"
            >
              <X className="w-3 h-3 text-slate-600 dark:text-slate-300" />
            </button>
          )}
        </div>
      </div>

      {/* Valid result pill */}
      {status === 'valid' && result && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2.5 space-y-1 text-xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Áp dụng thành công mã {result.code}</span>
            </span>
            <span className="font-mono font-black text-[#005A36] dark:text-emerald-400">
              -{formatPrice(result.discountAmount)}
            </span>
          </div>
          {result.description && (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 line-clamp-1">
              {result.description}
            </p>
          )}
        </div>
      )}

      {/* Invalid error message */}
      {status === 'invalid' && errorMsg && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 p-2 text-[11px] text-rose-700 dark:text-rose-300 font-medium flex items-center gap-1.5 animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Modal / Popup Danh sách Kho Voucher khả dụng */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-[#005A36] dark:text-emerald-400">
                  <Gift className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    Kho Voucher & Ưu Đãi
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chọn mã giảm giá khả dụng để áp dụng ngay
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Danh sách thẻ Voucher */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {loadingVouchers ? (
                <div className="py-10 text-center space-y-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#005A36]" />
                  <p className="text-xs">Đang tải kho ưu đãi...</p>
                </div>
              ) : availableVouchers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Hiện chưa có mã giảm giá nào đang mở.
                </div>
              ) : (
                availableVouchers.map((v, i) => {
                  const isEligible = orderAmount >= Number(v.minOrderValue || 0)
                  const isSelected = code === v.code

                  return (
                    <div
                      key={v.id || v.code || i}
                      className={`relative rounded-2xl border p-3.5 transition-all flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/30'
                          : isEligible
                            ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-400'
                            : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 opacity-70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-[#005A36] text-white shadow-xs">
                            {v.discountType === 'percentage' ? (
                              <Percent className="w-4 h-4" />
                            ) : (
                              <Tag className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <span className="font-mono font-black text-sm text-[#005A36] dark:text-emerald-400 block tracking-tight">
                              {v.code}
                            </span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                              {v.discountType === 'percentage'
                                ? `Giảm ${v.discountValue}%`
                                : `Giảm ${(Number(v.discountValue) || 0).toLocaleString('vi-VN')} đ`}
                              {v.maxDiscountAmount && v.discountType === 'percentage'
                                ? ` (tối đa ${(Number(v.maxDiscountAmount) || 0).toLocaleString('vi-VN')}đ)`
                                : ''}
                            </span>
                          </div>
                        </div>

                        {/* Nút Áp dụng */}
                        <button
                          type="button"
                          onClick={() => handleSelectVoucher(v)}
                          disabled={!isEligible}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : isEligible
                                ? 'bg-[#005A36] text-white hover:bg-emerald-800 shadow-xs'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {isSelected ? 'Đang dùng' : 'Áp dụng'}
                        </button>
                      </div>

                      {v.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                          {v.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                        <span>Đơn tối thiểu: {Number(v.minOrderValue || 0).toLocaleString('vi-VN')}đ</span>
                        {!isEligible && (
                          <span className="text-rose-500 font-bold">
                            Chưa đủ điều kiện đơn hàng
                          </span>
                        )}
                        {v.endDate && isEligible && (
                          <span>HSD: {new Date(v.endDate).toLocaleDateString('vi-VN')}</span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
