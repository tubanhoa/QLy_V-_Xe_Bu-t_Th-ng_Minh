'use client'

import React, { useState } from 'react'
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  X,
  CreditCard,
  Wallet,
  Building2,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  Receipt,
  PhoneCall,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { RefundDetailModal } from './refund-detail-modal'

interface AutoRefundAlertModalProps {
  open: boolean
  onClose: () => void
  onBookAnotherTrip?: () => void
  bookingCode?: string
  ticketCode?: string
  refundAmount?: number
  refundMethod?: string
  refundTransactionId?: string
  reason?: string
}

export function AutoRefundAlertModal({
  open,
  onClose,
  onBookAnotherTrip,
  bookingCode = '',
  ticketCode = '',
  refundAmount = 0,
  refundMethod = 'N/A',
  refundTransactionId = '',
  reason = 'Đơn vé đã quá thời gian giữ chỗ hoặc chuyến xe gặp sự cố kỹ thuật.',
}: AutoRefundAlertModalProps) {
  const [copied, setCopied] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  if (!open) return null

  const copyCode = (code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {})
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(20)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full sm:max-w-md bg-white sm:rounded-3xl rounded-t-[32px] p-5 sm:p-7 shadow-2xl transition-all border border-slate-100 flex flex-col',
          'animate-in slide-in-from-bottom duration-300',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Swipe Bar */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

        {/* Header Icon */}
        <div className="text-center space-y-2 pb-2">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-[#005A36] border border-emerald-200/80 shadow-xs">
            <RotateCcw size={28} className="animate-pulse" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-emerald-100/80 text-[#005A36]">
            <ShieldCheck size={13} />
            <span>Tự Động Bảo Vệ Quyền Lợi Hành Khách</span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Hệ Thống Đã Tự Động Hoàn Tiền 100%
          </h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            {reason}
          </p>
        </div>

        {/* Digital Refund Card */}
        <div className="my-3 rounded-2xl border-2 border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50/70 via-white to-slate-50 p-4 space-y-2.5 text-xs">
          <div className="flex justify-between items-center text-slate-600">
            <span className="font-bold">Mã đơn đặt vé:</span>
            <span className="font-mono font-black text-slate-900">{bookingCode}</span>
          </div>

          <div className="flex justify-between items-center text-slate-600">
            <span className="font-bold">Phí hủy / khấu trừ:</span>
            <span className="font-mono font-bold text-emerald-700">0 đ (Miễn phí 100%)</span>
          </div>

          <div className="pt-2 border-t border-emerald-200/80 flex justify-between items-center">
            <span className="font-black text-slate-900">Số tiền tự động hoàn:</span>
            <span className="font-mono text-xl font-black text-[#005A36]">
              {formatPrice(refundAmount)}
            </span>
          </div>

          <div className="pt-2 border-t border-emerald-200/80 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-bold">Cổng nhận lại tiền:</span>
              <span className="font-black text-slate-800 uppercase">{refundMethod}</span>
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <span className="font-bold">Mã tham chiếu ngân hàng:</span>
              <div className="flex items-center gap-1 font-mono font-bold text-slate-800">
                <span>{refundTransactionId}</span>
                <button
                  type="button"
                  onClick={() => copyCode(refundTransactionId)}
                  className="p-1 text-slate-400 hover:text-[#005A36]"
                  title="Sao chép"
                >
                  {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center text-slate-500 pt-0.5">
              <span>Thời gian tiền về ví/tài khoản:</span>
              <span className="font-bold text-slate-700">1 - 24 giờ làm việc</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => setShowDetail(true)}
              className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-2xs inline-flex items-center justify-center gap-1.5"
            >
              <Receipt size={14} className="text-[#005A36]" />
              <span>Xem tiến trình hoàn tiền</span>
            </button>

            {onBookAnotherTrip && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onBookAnotherTrip()
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#005A36] hover:bg-emerald-800 text-white font-black text-xs shadow-sm inline-flex items-center justify-center gap-1.5"
              >
                <span>Đặt chuyến khác</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 px-1">
            <span>Cần trợ giúp khẩn cấp?</span>
            <a
              href="tel:19008198"
              className="font-bold text-[#005A36] hover:underline inline-flex items-center gap-1"
            >
              <PhoneCall size={12} />
              <span>Hotline 1900 8198</span>
            </a>
          </div>
        </div>
      </div>

      {/* Popup Chi Tiết Hoàn Tiền */}
      {showDetail && (
        <RefundDetailModal
          open={showDetail}
          onClose={() => setShowDetail(false)}
          ticketCode={ticketCode}
          refundInfo={{
            refundAmount,
            originalPrice: refundAmount,
            cancellationFee: 0,
            feePercent: 0,
            refundMethod,
            status: 'SUCCESS',
            refundTransactionId,
            refundTime: new Date().toISOString(),
            estimatedArrival: '1 - 24 giờ làm việc',
            autoRefundReason: reason,
          }}
        />
      )}
    </div>
  )
}
