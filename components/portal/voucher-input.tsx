'use client'

/**
 * Component nhập mã giảm giá với validation realtime
 * Thiết kế giao diện Light Theme chuẩn nhận diện thương hiệu ICTU Transit (#005A36)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Tag, Check, X, Loader2, Sparkles } from 'lucide-react'
import { promotionService } from '@/lib/services/promotion.service'
import type { VoucherValidationResult } from '@/lib/types/promotion'

interface VoucherInputProps {
  orderAmount: number
  onApplied: (result: VoucherValidationResult | null) => void
  disabled?: boolean
}

export function VoucherInput({ orderAmount, onApplied, disabled }: VoucherInputProps) {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [result, setResult] = useState<VoucherValidationResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

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
      })

      if (res.success && res.data) {
        setStatus('valid')
        setResult(res.data)
        onApplied(res.data)
      } else {
        setStatus('invalid')
        setErrorMsg(res.message || 'Mã giảm giá không hợp lệ hoặc đã hết hạn')
        setResult(null)
        onApplied(null)
      }
    },
    [orderAmount, onApplied],
  )

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!code) {
      setStatus('idle')
      setResult(null)
      onApplied(null)
      return
    }
    debounceRef.current = setTimeout(() => validate(code), 500)
    return () => clearTimeout(debounceRef.current)
  }, [code, validate, onApplied])

  const handleClear = () => {
    setCode('')
    setStatus('idle')
    setResult(null)
    setErrorMsg('')
    onApplied(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="voucher-code-input" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-[#005A36]" />
          <span>Mã giảm giá / Voucher</span>
        </label>
        <span className="text-[11px] text-slate-400">Tự động áp dụng khi nhập</span>
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
              ? 'border-emerald-500 bg-emerald-50/40 text-emerald-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20'
              : status === 'invalid'
              ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20'
              : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]/20 focus:bg-white'
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
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-emerald-700" />
            </div>
          )}
          {status === 'invalid' && (
            <div className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center">
              <X className="w-3.5 h-3.5 text-rose-700" />
            </div>
          )}
          {(status === 'idle' || status === 'valid') && code && (
            <button
              type="button"
              onClick={handleClear}
              className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors"
              id="clear-voucher-btn"
            >
              <X className="w-3 h-3 text-slate-600" />
            </button>
          )}
        </div>
      </div>

      {/* Valid result pill */}
      {status === 'valid' && result && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-emerald-800">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Áp dụng thành công mã {result.code}</span>
            </span>
            <span className="font-mono font-extrabold text-[#005A36]">
              -{formatPrice(result.discountAmount)}
            </span>
          </div>
        </div>
      )}

      {/* Invalid error message */}
      {status === 'invalid' && errorMsg && (
        <p className="text-[11px] text-rose-600 font-medium pl-1 flex items-center gap-1">
          <span>⚠️ {errorMsg}</span>
        </p>
      )}
    </div>
  )
}
