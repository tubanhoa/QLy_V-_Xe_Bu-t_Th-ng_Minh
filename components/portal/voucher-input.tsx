'use client'

/**
 * Component nhập mã giảm giá với validation realtime
 * Tái sử dụng trong booking flow
 * File mới — không chạm file cũ
 * Branch: feature/SBTS-voucher-monthly-pass-fe
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
        setErrorMsg(res.message || 'Mã không hợp lệ hoặc đã hết hạn')
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
    <div className="space-y-3">
      {/* Input */}
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
          <Tag className="w-4 h-4 text-white/30" />
        </div>

        <input
          id="voucher-code-input"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Nhập mã giảm giá…"
          maxLength={20}
          disabled={disabled}
          className={`w-full pl-10 pr-10 py-2.5 rounded-xl border bg-white/5 text-sm font-mono text-white placeholder:text-white/30 outline-none transition-all focus:bg-white/8 ${
            status === 'valid'
              ? 'border-emerald-500/60 focus:border-emerald-400'
              : status === 'invalid'
              ? 'border-red-500/50 focus:border-red-400'
              : 'border-white/10 focus:border-[#00d4aa]/60'
          } disabled:opacity-50`}
          autoComplete="off"
          spellCheck={false}
        />

        {/* Right icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {status === 'checking' && (
            <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
          )}
          {status === 'valid' && (
            <Check className="w-4 h-4 text-emerald-400" />
          )}
          {status === 'invalid' && (
            <X className="w-4 h-4 text-red-400" />
          )}
          {(status === 'idle' || status === 'valid') && code && (
            <button
              onClick={handleClear}
              className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              id="clear-voucher-btn"
            >
              <X className="w-3 h-3 text-white/60" />
            </button>
          )}
        </div>
      </div>

      {/* Valid result */}
      {status === 'valid' && result && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-emerald-300">
              Áp dụng thành công!
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Giảm</span>
            <span className="font-bold text-emerald-300">
              -{formatPrice(result.discountAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Còn lại</span>
            <span className="font-bold text-white">{formatPrice(result.finalAmount)}</span>
          </div>
        </div>
      )}

      {/* Invalid error */}
      {status === 'invalid' && errorMsg && (
        <p className="text-xs text-red-400 pl-1">{errorMsg}</p>
      )}
    </div>
  )
}
