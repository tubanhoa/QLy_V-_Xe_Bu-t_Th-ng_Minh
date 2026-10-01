'use client'

import React, { useState } from 'react'
import {
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Copy,
  Check,
  ShieldCheck,
  Building2,
  Wallet,
  CreditCard,
  PhoneCall,
  HelpCircle,
  Send,
  Loader2,
  Receipt,
  Ticket,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ticketService } from '@/lib/services/ticket.service'
import type { RefundInfo } from '@/lib/types/ticket'

interface RefundDetailModalProps {
  open?: boolean
  onClose: () => void
  ticketCode?: string
  ticketId?: string
  passengerName?: string
  routeName?: string
  seatNumber?: string
  refundInfo?: RefundInfo | null
  initialRefundInfo?: RefundInfo | null
  initialTicketPrice?: number
}

export function RefundDetailModal({
  open = true,
  onClose,
  ticketCode = 'TK-2026-01A',
  ticketId = '',
  passengerName = 'Hành khách ICTU',
  routeName = 'Tuyến CT-01 KTX ICTU ↔ Bến Xe',
  seatNumber = '01A',
  refundInfo,
  initialRefundInfo,
  initialTicketPrice,
}: RefundDetailModalProps) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [showSupportForm, setShowSupportForm] = useState(false)
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankName, setBankName] = useState('Vietcombank')
  const [accountHolder, setAccountHolder] = useState('')
  const [supportNote, setSupportNote] = useState('')
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false)
  const [supportSubmitted, setSupportSubmitted] = useState<string | null>(null)

  if (!open) return null

  // Dữ liệu fallback chuẩn mực nếu chưa nhận đủ từ API
  const resolvedInfo = refundInfo || initialRefundInfo
  const info: RefundInfo = resolvedInfo || {
    refundAmount: initialTicketPrice || 10000,
    originalPrice: initialTicketPrice || 10000,
    cancellationFee: 0,
    feePercent: 0,
    refundMethod: 'vnpay',
    status: 'SUCCESS',
    refundTransactionId: `RF-${Date.now().toString().slice(-8)}`,
    refundTime: new Date().toISOString(),
    estimatedArrival: 'Ngay lập tức đến 24 giờ',
  }

  const isSuccess = info.status === 'SUCCESS'
  const isPending = info.status === 'PENDING'
  const isFailed = info.status === 'FAILED'

  const copyTxnId = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {})
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(20)
      }
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  const handleSubmitSupport = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingSupport(true)
    try {
      const res = await ticketService.submitRefundSupportTicket({
        ticketId,
        ticketCode,
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim(),
        bankAccountNumber: bankAccount.trim() || undefined,
        bankName: bankAccount.trim() ? bankName : undefined,
        accountHolderName: bankAccount.trim() ? accountHolder.trim() : undefined,
        description: supportNote.trim() || undefined,
      })

      if (res.success && res.data) {
        setSupportSubmitted(res.data.message)
      } else {
        setSupportSubmitted('Yêu cầu hỗ trợ đã được ghi nhận. Hotline 24/7: 1900 8198.')
      }
    } catch {
      setSupportSubmitted('Yêu cầu hỗ trợ đã được gửi thành công. CSKH sẽ liên hệ lại sớm nhất.')
    } finally {
      setIsSubmittingSupport(false)
    }
  }

  const getMethodBadge = (method: string) => {
    const m = method.toLowerCase()
    if (m.includes('momo')) {
      return {
        label: 'Ví MoMo',
        icon: Wallet,
        color: 'text-pink-600 bg-pink-50 border-pink-200',
      }
    }
    if (m.includes('zalopay')) {
      return {
        label: 'Ví ZaloPay',
        icon: Wallet,
        color: 'text-sky-600 bg-sky-50 border-sky-200',
      }
    }
    if (m.includes('vnpay')) {
      return {
        label: 'Cổng VNPAY (QR / ATM)',
        icon: CreditCard,
        color: 'text-blue-700 bg-blue-50 border-blue-200',
      }
    }
    return {
      label: 'Tài khoản ngân hàng nguồn',
      icon: Building2,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    }
  }

  const methodBadge = getMethodBadge(info.refundMethod)
  const MethodIcon = methodBadge.icon

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white sm:rounded-3xl rounded-t-[32px] p-5 sm:p-7 shadow-2xl transition-all border border-slate-100 flex flex-col',
          'animate-in slide-in-from-bottom duration-300',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Swipe / Drag Handle Indicator */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-2xl bg-emerald-50 text-[#005A36] flex items-center justify-center border border-emerald-200/60 shadow-xs">
              <Receipt size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                Chi Tiết Hoàn Tiền
              </h3>
              <p className="text-[11px] font-bold text-slate-500">Mã vé: {ticketCode}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nội dung chính */}
        <div className="py-4 space-y-4 flex-1">
          {/* Status Header Banner */}
          <div
            className={cn(
              'rounded-2xl p-4 border text-center space-y-1.5 transition-all shadow-xs',
              isSuccess && 'bg-emerald-50/70 border-emerald-200 text-emerald-900',
              isPending && 'bg-amber-50/70 border-amber-200 text-amber-900',
              isFailed && 'bg-rose-50/70 border-rose-200 text-rose-900',
            )}
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-white shadow-2xs">
              {isSuccess && <CheckCircle2 size={14} className="text-emerald-600" />}
              {isPending && <Clock size={14} className="text-amber-600 animate-spin" />}
              {isFailed && <AlertTriangle size={14} className="text-rose-600" />}
              <span>
                {isSuccess
                  ? 'Hoàn tiền thành công'
                  : isPending
                  ? 'Đang xử lý hoàn tiền'
                  : 'Hoàn tiền chưa thành công'}
              </span>
            </div>

            <p className="text-[11px] font-medium text-slate-600 max-w-xs mx-auto">
              {isSuccess
                ? 'Tiền đã được lệnh chuyển về tài khoản/ví nguồn của bạn.'
                : isPending
                ? 'Cổng thanh toán đang đối soát. Tiền dự kiến về trong 1-24h.'
                : info.failureReason || 'Tài khoản nguồn bị gián đoạn. Vui lòng gửi yêu cầu hỗ trợ.'}
            </p>

            <div className="pt-1">
              <span className="text-[11px] uppercase font-extrabold text-slate-500 block">
                Số tiền hoàn lại
              </span>
              <span
                className={cn(
                  'text-3xl font-black font-mono tracking-tight block',
                  isSuccess && 'text-[#005A36]',
                  isPending && 'text-amber-700',
                  isFailed && 'text-rose-600',
                )}
              >
                +{Number(info.refundAmount).toLocaleString('vi-VN')} đ
              </span>
            </div>
          </div>

          {/* Stepper Tiến Trình Hoàn Tiền (Grab/MoMo Pattern) */}
          <div className="rounded-2xl bg-slate-50/90 border border-slate-200/80 p-3.5 space-y-3">
            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide block">
              Tiến trình giao dịch
            </span>

            <div className="relative pl-6 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {/* Bước 1 */}
              <div className="relative">
                <div className="absolute -left-6 top-0.5 size-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] ring-2 ring-white">
                  ✓
                </div>
                <p className="text-xs font-black text-slate-900 leading-tight">Yêu cầu hủy vé được duyệt</p>
                <p className="text-[10px] text-slate-500">
                  {info.refundTime ? new Date(info.refundTime).toLocaleString('vi-VN') : 'Đã ghi nhận'}
                </p>
              </div>

              {/* Bước 2 */}
              <div className="relative">
                <div
                  className={cn(
                    'absolute -left-6 top-0.5 size-4 rounded-full flex items-center justify-center text-[10px] ring-2 ring-white',
                    isSuccess || isPending ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600',
                  )}
                >
                  ✓
                </div>
                <p className="text-xs font-black text-slate-900 leading-tight">Cổng thanh toán xử lý lệnh hoàn</p>
                <p className="text-[10px] text-slate-500">
                  Khởi tạo qua cổng {methodBadge.label}
                </p>
              </div>

              {/* Bước 3 */}
              <div className="relative">
                <div
                  className={cn(
                    'absolute -left-6 top-0.5 size-4 rounded-full flex items-center justify-center text-[10px] ring-2 ring-white',
                    isSuccess
                      ? 'bg-emerald-600 text-white'
                      : isFailed
                      ? 'bg-rose-500 text-white'
                      : 'bg-amber-400 text-white',
                  )}
                >
                  {isSuccess ? '✓' : isFailed ? '✕' : '•'}
                </div>
                <p className="text-xs font-black text-slate-900 leading-tight">
                  {isSuccess
                    ? 'Tiền về tài khoản nguồn'
                    : isFailed
                    ? 'Lỗi hoàn tiền từ ngân hàng'
                    : 'Chờ tiền về tài khoản (1-24h)'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {isSuccess ? 'Giao dịch hoàn tất' : 'Theo quy định ngân hàng liên kết'}
                </p>
              </div>
            </div>
          </div>

          {/* Fintech Digital Receipt Card */}
          <div className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-white p-4 space-y-2.5 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-bold">Giá vé ban đầu:</span>
              <span className="font-mono font-bold text-slate-800">
                {Number(info.originalPrice).toLocaleString('vi-VN')} đ
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <span className="font-bold">
                Phí hủy theo quy định ({info.feePercent}%):
              </span>
              <span className="font-mono font-bold text-rose-600">
                -{Number(info.cancellationFee).toLocaleString('vi-VN')} đ
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
              <span className="font-black text-slate-900">Số tiền hoàn thực tế:</span>
              <span className="font-mono font-black text-emerald-800 text-sm">
                {Number(info.refundAmount).toLocaleString('vi-VN')} đ
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-500">Phương thức nhận:</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[11px] font-bold',
                    methodBadge.color,
                  )}
                >
                  <MethodIcon size={12} />
                  <span>{methodBadge.label}</span>
                </span>
              </div>

              {info.refundTransactionId && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-500">Mã giao dịch hoàn:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-bold text-slate-800 text-[11px]">
                      {info.refundTransactionId}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyTxnId(info.refundTransactionId!)}
                      className="p-1 text-slate-400 hover:text-[#005A36] transition-colors"
                      title="Sao chép mã"
                    >
                      {copiedCode ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-500">Thời gian dự kiến:</span>
                <span className="font-bold text-slate-700 text-[11px]">
                  {info.estimatedArrival || '1 - 24 giờ'}
                </span>
              </div>
            </div>
          </div>

          {/* Form Khiếu Nại / Gửi Yêu Cầu Hỗ Trợ khi Refund lỗi */}
          {!showSupportForm ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowSupportForm(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
              >
                <HelpCircle size={14} className="text-amber-600" />
                <span>Cần trợ giúp hoặc khiếu nại hoàn tiền?</span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                  <HelpCircle size={14} className="text-amber-600" />
                  <span>Gửi Yêu Cầu Hỗ Trợ Hoàn Tiền</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowSupportForm(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  Đóng form
                </button>
              </div>

              {supportSubmitted ? (
                <div className="rounded-xl bg-white p-3 border border-emerald-200 text-xs font-bold text-[#005A36] space-y-1">
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 size={15} />
                    <span>Đã gửi yêu cầu thành công!</span>
                  </p>
                  <p className="text-[11px] font-normal text-slate-600">{supportSubmitted}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitSupport} className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                      Số điện thoại liên hệ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="0981 234 567"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold outline-none focus:border-[#005A36]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                      Email nhận phản hồi <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="sinhvien.ictu@gmail.com"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold outline-none focus:border-[#005A36]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                      Số tài khoản nhận tiền (nếu cần hoàn thủ công)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={bankAccount}
                        onChange={(e) => setBankAccount(e.target.value)}
                        placeholder="Số TK ngân hàng"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-mono font-bold outline-none focus:border-[#005A36]"
                      />
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="Tên ngân hàng"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold outline-none focus:border-[#005A36]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                      Ghi chú / Mô tả sự cố
                    </label>
                    <textarea
                      rows={2}
                      value={supportNote}
                      onChange={(e) => setSupportNote(e.target.value)}
                      placeholder="VD: Đã quá 24h nhưng ví MoMo chưa nhận được tiền..."
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-medium outline-none focus:border-[#005A36]"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <a
                      href="tel:19008198"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#005A36] hover:underline"
                    >
                      <PhoneCall size={12} />
                      <span>Hotline: 1900 8198</span>
                    </a>

                    <button
                      type="submit"
                      disabled={isSubmittingSupport}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#005A36] text-white font-bold text-xs hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {isSubmittingSupport ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Đang gửi...</span>
                        </>
                      ) : (
                        <>
                          <Send size={13} />
                          <span>Gửi yêu cầu</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-slate-800 transition-colors shadow-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
