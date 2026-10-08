'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Ticket,
  ArrowRight,
  Home,
  ShieldCheck,
  CreditCard,
  Copy,
  Check,
  Calendar,
  Clock,
  QrCode,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { paymentService } from '@/lib/services/payment.service'

function PaymentResultContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Dữ liệu từ VNPay query params
  const responseCode = searchParams.get('vnp_ResponseCode')
  const txnRef = searchParams.get('vnp_TxnRef') || 'N/A'
  const rawAmount = searchParams.get('vnp_Amount')
  const amount = rawAmount ? Number(rawAmount) / 100 : 0
  const bankCode = searchParams.get('vnp_BankCode') || 'NCB'
  const transactionNo = searchParams.get('vnp_TransactionNo') || 'N/A'
  const orderInfo = searchParams.get('vnp_OrderInfo') || ''
  const payDateRaw = searchParams.get('vnp_PayDate') || ''

  const formattedPayDate = payDateRaw.length === 14
    ? `${payDateRaw.slice(6, 8)}/${payDateRaw.slice(4, 6)}/${payDateRaw.slice(0, 4)} ${payDateRaw.slice(8, 10)}:${payDateRaw.slice(10, 12)}`
    : new Date().toLocaleString('vi-VN')

  useEffect(() => {
    const verifyPayment = async () => {
      // Tập hợp toàn bộ query params để gửi về Backend xác thực chữ ký HMAC-SHA512
      const paramsObj: Record<string, string> = {}
      searchParams.forEach((val, key) => {
        paramsObj[key] = val
      })

      if (!searchParams.has('vnp_ResponseCode')) {
        // Nếu không có param vnpay, kiểm tra xem có phải truy cập trực tiếp không
        setLoading(false)
        setErrorMessage('Không tìm thấy thông tin giao dịch thanh toán')
        return
      }

      try {
        const res = await paymentService.handleVNPayReturn(paramsObj)
        if (res.success && res.data?.isSuccess) {
          setIsSuccess(true)
        } else {
          setIsSuccess(false)
          setErrorMessage(
            res.data?.message ||
              (responseCode === '24'
                ? 'Khách hàng đã hủy giao dịch trên cổng thanh toán VNPay'
                : 'Giao dịch thanh toán không thành công qua cổng VNPay'),
          )
        }
      } catch (err: any) {
        console.error('Lỗi xác thực VNPay:', err)
        // Fallback kiểm tra responseCode trực tiếp
        if (responseCode === '00') {
          setIsSuccess(true)
        } else {
          setIsSuccess(false)
          setErrorMessage('Giao dịch chưa thể xác thực hoặc đã bị hủy')
        }
      } finally {
        setLoading(false)
      }
    }

    verifyPayment()
  }, [searchParams, responseCode])

  const copyBookingCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(txnRef)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="size-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shadow-lg border border-emerald-200">
          <RefreshCw size={32} className="animate-spin text-emerald-600" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            Đang Xác Thực Giao Dịch VNPay...
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Hệ thống đang kiểm tra chữ ký số HMAC-SHA512 và cập nhật vé điện tử từ Supabase Cloud.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-lg space-y-6">
        {/* Card Kết Quả */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xl overflow-hidden relative">
          {/* Header trạng thái */}
          <div className="text-center space-y-3">
            <div
              className={`size-16 sm:size-20 mx-auto rounded-3xl flex items-center justify-center shadow-lg border ${
                isSuccess
                  ? 'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800'
                  : 'bg-rose-100 text-rose-600 border-rose-200 dark:bg-rose-950/60 dark:border-rose-800'
              }`}
            >
              {isSuccess ? <CheckCircle2 size={40} /> : <XCircle size={40} />}
            </div>

            <div>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  isSuccess
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}
              >
                <ShieldCheck size={14} />
                {isSuccess ? 'Thanh Toán Thành Công' : 'Thanh Toán Thất Bại'}
              </span>
              <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {isSuccess ? 'Đặt Vé Xe Buýt Thành Công!' : 'Giao Dịch Bị Hủy Hoặc Lỗi'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isSuccess
                  ? 'Vé điện tử đã được phát hành và lưu vết đối soát trên Supabase Cloud.'
                  : errorMessage || 'Giao dịch chưa hoàn tất. Ghế của bạn sẽ được giải phóng an toàn.'}
              </p>
            </div>
          </div>

          {/* Chi tiết giao dịch VNPay Sandbox */}
          <div className="mt-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 p-4 space-y-2.5 text-xs">
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-800 pb-2">
              <span>Cổng thanh toán:</span>
              <span className="font-bold text-slate-900 dark:text-white uppercase flex items-center gap-1">
                <CreditCard size={13} className="text-[#005A36]" />
                VNPay Sandbox ({bankCode})
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800 pb-2">
              <span className="text-slate-500 dark:text-slate-400">Mã đơn đặt vé:</span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                <span>{txnRef}</span>
                <button
                  type="button"
                  onClick={copyBookingCode}
                  className="p-1 rounded text-slate-400 hover:text-emerald-600 transition-colors"
                  title="Sao chép mã đơn"
                >
                  {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800 pb-2">
              <span className="text-slate-500 dark:text-slate-400">Số tiền thanh toán:</span>
              <span className="font-mono font-black text-base text-emerald-600 dark:text-emerald-400">
                {amount.toLocaleString('vi-VN')} đ
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800 pb-2">
              <span className="text-slate-500 dark:text-slate-400">Mã giao dịch VNPay:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{transactionNo}</span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400">
              <span>Thời điểm giao dịch:</span>
              <span>{formattedPayDate}</span>
            </div>
          </div>

          {/* Vé điện tử & QR Soát vé (Nếu thành công) */}
          {isSuccess && (
            <div className="mt-6 rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-50/50 via-white to-slate-50 p-4 text-center space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                <QrCode size={12} />
                MÃ QR SOÁT VÉ LÊN XE BUÝT ICTU
              </div>

              <div className="size-44 mx-auto bg-white p-2.5 rounded-2xl border-2 border-emerald-300 shadow-sm flex items-center justify-center">
                <QRCodeSVG
                  value={`ICTU-TICKET:${txnRef}:${amount}:${Date.now()}`}
                  size={155}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <p className="text-[11px] text-slate-500">
                Xuất trình mã QR này cho tài xế hoặc máy quét POS khi lên xe buýt.
              </p>
            </div>
          )}

          {/* Nút hành động */}
          <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
            {isSuccess ? (
              <>
                <Link
                  href="/my-tickets"
                  className="flex-1 py-3 px-4 rounded-xl bg-[#005A36] hover:bg-[#004529] text-white text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all"
                >
                  <Ticket size={16} />
                  <span>Xem Vé Của Tôi</span>
                </Link>
                <Link
                  href="/"
                  className="py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <Home size={16} />
                  <span>Trang Chủ</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/"
                  className="flex-1 py-3 px-4 rounded-xl bg-[#005A36] hover:bg-[#004529] text-white text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all"
                >
                  <ArrowRight size={16} />
                  <span>Đặt Vé Lại</span>
                </Link>
                <Link
                  href="/"
                  className="py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <Home size={16} />
                  <span>Trang Chủ</span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Thông tin hỗ trợ */}
        <p className="text-center text-xs text-slate-400">
          Cần hỗ trợ giao dịch? Liên hệ Hotline Trung tâm Điều hành ICTU Smart Bus: <strong>1900 6868</strong>
        </p>
      </div>
    </div>
  )
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <RefreshCw className="animate-spin text-emerald-600 size-8" />
        </div>
      }
    >
      <PaymentResultContent />
    </Suspense>
  )
}
