'use client'

import React, { Suspense, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Search,
  ReceiptText,
  Download,
  Printer,
  Mail,
  CheckCircle2,
  ShieldCheck,
  FileText,
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Calendar,
  User,
  Phone,
  MapPin,
  CreditCard,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Send,
  Building2,
  Clock,
  Ticket,
} from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { invoiceService } from '@/lib/services/invoice.service'
import type { InvoiceData } from '@/lib/types/invoice'
import { cn } from '@/lib/utils'

function InvoiceLookupContent() {
  const searchParams = useSearchParams()
  const initialCode = searchParams.get('code') || searchParams.get('lookupCode') || searchParams.get('booking') || ''

  const [lookupQuery, setLookupQuery] = useState(initialCode)
  const [invoiceNumberQuery, setInvoiceNumberQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)

  // Resend Email modal & status
  const [showResendModal, setShowResendModal] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [isResending, setIsResending] = useState(false)
  const [resendSuccessMsg, setResendSuccessMsg] = useState<string | null>(null)

  // Copy status
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

  const printAreaRef = useRef<HTMLDivElement>(null)

  const handleCopy = (text: string, fieldId: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {})
      setCopiedField(fieldId)
      setTimeout(() => setCopiedField(null), 2200)
    }
  }

  const performLookup = async (codeToSearch: string, invNum?: string) => {
    const trimmed = codeToSearch.trim()
    if (!trimmed) {
      setErrorMsg('Vui lòng nhập Mã tra cứu hoặc Mã đơn đặt vé')
      return
    }

    setIsLoading(true)
    setErrorMsg(null)
    setResendSuccessMsg(null)

    try {
      const res = await invoiceService.lookupInvoice(trimmed, invNum?.trim() || undefined)
      if (res.success && res.data) {
        setInvoice(res.data)
        setResendEmail(res.data.buyer?.email || '')
      } else {
        // Fallback: nếu tra cứu trực tiếp bằng mã đơn đặt vé
        const fallbackRes = await invoiceService.getInvoiceByBookingCode(trimmed)
        if (fallbackRes.success && fallbackRes.data) {
          setInvoice(fallbackRes.data)
          setResendEmail(fallbackRes.data.buyer?.email || '')
        } else {
          setInvoice(null)
          setErrorMsg(res.message || 'Không tìm thấy hóa đơn điện tử tương ứng với thông tin đã nhập.')
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi kết nối máy chủ khi tra cứu hóa đơn.')
      setInvoice(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (initialCode) {
      performLookup(initialCode)
    }
  }, [initialCode])

  const handleDownloadPdf = async () => {
    if (!invoice) return
    setIsDownloadingPdf(true)
    try {
      const success = await invoiceService.downloadPdfByBookingCode(invoice.bookingCode)
      if (!success) {
        // Fallback mở trực tiếp PDF URL
        window.open(invoiceService.getInvoicePdfUrl(invoice.bookingCode), '_blank')
      }
    } catch {
      window.open(invoiceService.getInvoicePdfUrl(invoice.bookingCode), '_blank')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  const handleResendEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoice || !resendEmail.trim()) return

    setIsResending(true)
    setResendSuccessMsg(null)
    try {
      const res = await invoiceService.resendInvoiceEmail(invoice.bookingCode, resendEmail.trim())
      if (res.success) {
        setResendSuccessMsg(`Hóa đơn đã được gửi thành công đến: ${resendEmail.trim()}`)
        setShowResendModal(false)
      } else {
        alert(res.message || 'Gửi email thất bại, vui lòng kiểm tra lại địa chỉ email.')
      }
    } catch (err: any) {
      alert(err?.message || 'Có lỗi xảy ra khi gửi lại email.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-slate-50 to-white text-slate-800 pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-emerald-900/10 bg-white/90 backdrop-blur-md shadow-2xs print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-[#005A36] hover:bg-slate-50 transition-all shadow-2xs group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Trang chủ</span>
            </Link>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-[#005A36] text-white flex items-center justify-center shadow-xs">
                <ReceiptText size={18} />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                  Cổng Tra Cứu Hóa Đơn Điện Tử
                </h1>
                <p className="text-[10px] text-slate-500 font-bold hidden sm:block">
                  Hệ thống vé xe buýt thông minh ICTU Transit
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/my-tickets"
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-black text-[#005A36] hover:bg-emerald-100 transition-colors"
            >
              <Ticket size={14} />
              <span className="hidden sm:inline">Vé Của Tôi</span>
            </Link>
            <BrandMark />
          </div>
        </div>
      </header>

      {/* Hero Search Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 print:hidden">
        {/* Banner tiêu chuẩn Nghị định 123 */}
        <div className="rounded-2xl bg-gradient-to-r from-[#005A36] via-emerald-800 to-emerald-900 text-white p-5 sm:p-6 shadow-xl shadow-emerald-950/15 mb-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 rounded-full bg-white/5 blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold tracking-wide backdrop-blur-sm mb-2 text-emerald-100">
                <ShieldCheck size={13} className="text-emerald-300" />
                <span>Tuân thủ Nghị định 123/2020/NĐ-CP & Thông tư 78/2021/TT-BTC</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Tra Cứu & Xác Thực Hóa Đơn VAT 8%
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-emerald-100/90 font-medium max-w-xl">
                Kiểm tra tính pháp lý, tải tệp PDF có gắn chữ ký số của Trường ĐH Công nghệ Thông tin & Truyền thông và Tổng cục Thuế.
              </p>
            </div>

            <div className="flex sm:flex-col gap-2 shrink-0">
              <div className="rounded-xl bg-white/10 p-2.5 backdrop-blur-xs border border-white/10 text-center">
                <span className="block text-[10px] uppercase font-extrabold text-emerald-200">Ký hiệu mẫu số</span>
                <span className="block text-xs font-black text-white">1C26TCT</span>
              </div>
              <div className="rounded-xl bg-white/10 p-2.5 backdrop-blur-xs border border-white/10 text-center">
                <span className="block text-[10px] uppercase font-extrabold text-emerald-200">Ký hiệu hóa đơn</span>
                <span className="block text-xs font-black text-white">C26TCT</span>
              </div>
            </div>
          </div>
        </div>

        {/* Form Tra Cứu */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-lg shadow-slate-900/5 mb-8">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              performLookup(lookupQuery, invoiceNumberQuery)
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              <div className="md:col-span-8">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Mã tra cứu bí mật hoặc Mã đơn đặt vé <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    placeholder="VD: ICTU-A9F34D12 hoặc ICTU-2026-PASS"
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#005A36] focus:bg-white transition-all pl-11 uppercase"
                  />
                  <Search className="absolute left-3.5 top-3.5 size-5 text-slate-400" />
                </div>
                <p className="mt-1 text-[11px] text-slate-500 font-medium">
                  Mã tra cứu được gửi kèm trong email xác nhận mua vé và biên lai điện tử.
                </p>
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Số hóa đơn (không bắt buộc)
                </label>
                <input
                  type="text"
                  value={invoiceNumberQuery}
                  onChange={(e) => setInvoiceNumberQuery(e.target.value)}
                  placeholder="VD: INV-20261001-1234"
                  className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#005A36] focus:bg-white transition-all uppercase"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <span>Gợi ý tra mẫu:</span>
                <button
                  type="button"
                  onClick={() => {
                    setLookupQuery('ICTU-DEMO-PASS')
                    performLookup('ICTU-DEMO-PASS')
                  }}
                  className="rounded-lg bg-slate-100 hover:bg-slate-200 px-2 py-1 text-[11px] text-[#005A36] font-mono font-bold transition-colors cursor-pointer"
                >
                  ICTU-DEMO-PASS
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#005A36] hover:bg-emerald-800 text-white px-6 py-3 text-sm font-black shadow-md shadow-emerald-900/20 active:scale-98 transition-all disabled:opacity-50 cursor-pointer min-w-[150px]"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    <span>Đang tìm kiếm...</span>
                  </>
                ) : (
                  <>
                    <Search className="size-4" />
                    <span>Tra Cứu Hóa Đơn</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Thông báo lỗi nếu có */}
          {errorMsg && (
            <div className="mt-4 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-700 flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-black">Không tìm thấy thông tin hóa đơn</p>
                <p className="mt-0.5 text-rose-600 font-medium">{errorMsg}</p>
                <p className="mt-1 text-[11px] text-rose-500">
                  Mẹo: Kiểm tra lại mã tra cứu trong hộp thư đến email của bạn, hoặc sử dụng mã đơn vé (ví dụ: ICTU-2026-XXXX).
                </p>
              </div>
            </div>
          )}

          {/* Thông báo gửi lại email thành công */}
          {resendSuccessMsg && (
            <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-[#005A36] flex items-center gap-2.5">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{resendSuccessMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* Kết Quả Hóa Đơn (Legal Form Format) */}
      {invoice && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
            <div className="inline-flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 text-[#005A36] px-3 py-1 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 size={13} />
                <span>Hóa đơn hợp lệ · Đã ký số</span>
              </span>
              <span className="text-xs font-bold text-slate-500 hidden sm:inline">
                Số HĐ: <strong className="text-slate-800">{invoice.invoiceNumber}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                title="In hóa đơn ra máy in"
              >
                <Printer size={14} />
                <span>In hóa đơn</span>
              </button>

              <button
                type="button"
                onClick={() => setShowResendModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                title="Gửi lại hóa đơn qua email"
              >
                <Mail size={14} />
                <span>Gửi lại Email</span>
              </button>

              <a
                href={invoiceService.getInvoiceHtmlUrl(invoice.id || invoice.bookingCode)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
              >
                <ExternalLink size={14} />
                <span>Xem bản HTML</span>
              </a>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#005A36] text-white px-4 py-2 text-xs font-black shadow-sm hover:bg-emerald-800 transition-colors disabled:opacity-50"
              >
                {isDownloadingPdf ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                <span>Tải PDF Hóa Đơn</span>
              </button>
            </div>
          </div>

          {/* Tờ Hóa Đơn Tiêu Chuẩn Bộ Tài Chính */}
          <div
            ref={printAreaRef}
            className="rounded-3xl border-2 border-slate-300/80 bg-white p-6 sm:p-10 shadow-xl print:border-none print:shadow-none print:p-0"
          >
            {/* Header Quốc Hiệu */}
            <div className="text-center pb-6 border-b-2 border-emerald-900/20">
              <p className="text-xs sm:text-sm font-black tracking-widest text-slate-800 uppercase">
                CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
              </p>
              <p className="text-[11px] sm:text-xs font-bold text-slate-600">
                Độc lập - Tự do - Hạnh phúc
              </p>
              <div className="w-24 h-0.5 bg-slate-400 mx-auto my-2" />

              <h3 className="text-xl sm:text-2xl font-black text-[#005A36] uppercase tracking-wide mt-3">
                HÓA ĐƠN GIÁ TRỊ GIA TĂNG
              </h3>
              <p className="text-xs font-bold text-slate-500 uppercase mt-0.5">
                (Dịch vụ vận tải hành khách công cộng bằng xe buýt)
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-slate-600 mt-3">
                <span>Ký hiệu mẫu số (Form): <strong className="text-slate-900">1C26TCT</strong></span>
                <span>•</span>
                <span>Ký hiệu (Serial): <strong className="text-slate-900">C26TCT</strong></span>
                <span>•</span>
                <span>Số (No.): <strong className="text-rose-600 text-sm">{invoice.invoiceNumber}</strong></span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Ngày lập: <strong>{new Date(invoice.issuedAt).toLocaleDateString('vi-VN')}</strong>
              </p>
            </div>

            {/* Thông tin Bên Bán & Bên Mua */}
            <div className="py-6 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Bên bán */}
              <div className="space-y-1.5 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                <span className="text-[11px] font-black text-[#005A36] uppercase tracking-wide block mb-2">
                  Đơn vị bán hàng (Seller)
                </span>
                <p className="font-extrabold text-slate-900 text-sm">
                  {invoice.seller.name}
                </p>
                <p className="text-slate-600">
                  <span className="font-bold text-slate-700">Mã số thuế:</span>{' '}
                  <strong className="font-mono text-slate-900 text-xs">{invoice.seller.taxCode}</strong>
                </p>
                <p className="text-slate-600">
                  <span className="font-bold text-slate-700">Địa chỉ:</span> {invoice.seller.address}
                </p>
                <p className="text-slate-600">
                  <span className="font-bold text-slate-700">Hotline:</span> {invoice.seller.phone} ·{' '}
                  <span className="font-bold text-slate-700">Website:</span> {invoice.seller.website}
                </p>
              </div>

              {/* Bên mua */}
              <div className="space-y-1.5 bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100">
                <span className="text-[11px] font-black text-[#005A36] uppercase tracking-wide block mb-2">
                  Người mua hàng (Buyer)
                </span>
                <p className="font-extrabold text-slate-900 text-sm">
                  {invoice.buyer.fullName || 'Hành khách mua vé trực tuyến'}
                </p>
                {invoice.buyer.studentId && (
                  <p className="text-slate-600">
                    <span className="font-bold text-slate-700">Mã sinh viên:</span>{' '}
                    <strong className="text-[#005A36]">{invoice.buyer.studentId}</strong>
                  </p>
                )}
                {invoice.buyer.phone && (
                  <p className="text-slate-600">
                    <span className="font-bold text-slate-700">Số điện thoại:</span> {invoice.buyer.phone}
                  </p>
                )}
                <p className="text-slate-600">
                  <span className="font-bold text-slate-700">Email nhận hóa đơn:</span>{' '}
                  <strong className="text-slate-800">{invoice.buyer.email || 'Chưa cung cấp'}</strong>
                </p>
                <p className="text-slate-600">
                  <span className="font-bold text-slate-700">Hình thức thanh toán:</span>{' '}
                  <span className="font-black text-[#005A36] uppercase">{invoice.paymentMethod}</span>
                </p>
              </div>
            </div>

            {/* Chi tiết lộ trình & tuyến xe */}
            <div className="py-4 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50/50 p-3.5 rounded-2xl my-4">
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Mã đơn đặt vé</span>
                <span className="font-black text-slate-800 text-xs">{invoice.bookingCode}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Tuyến xe</span>
                <span className="font-black text-[#005A36] text-xs">{invoice.routeName}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Lộ trình</span>
                <span className="font-bold text-slate-700 text-xs">
                  {invoice.origin || 'KTX ICTU'} ➔ {invoice.destination || 'Bến xe'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Biển số xe</span>
                <span className="font-black text-slate-800 text-xs">{invoice.vehiclePlate || '20B-999.88'}</span>
              </div>
            </div>

            {/* Bảng Dịch Vụ */}
            <div className="overflow-x-auto py-2">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-100/80 text-slate-700">
                    <th className="py-2.5 px-3 font-black text-center w-12">STT</th>
                    <th className="py-2.5 px-3 font-black">Tên hàng hóa, dịch vụ</th>
                    <th className="py-2.5 px-3 font-black text-center">Vị trí ghế</th>
                    <th className="py-2.5 px-3 font-black text-center">ĐVT</th>
                    <th className="py-2.5 px-3 font-black text-center">Số lượng</th>
                    <th className="py-2.5 px-3 font-black text-right">Đơn giá (VNĐ)</th>
                    <th className="py-2.5 px-3 font-black text-right">Thành tiền (VNĐ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {invoice.items && invoice.items.length > 0 ? (
                    invoice.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 text-center text-slate-500">{item.itemNumber || idx + 1}</td>
                        <td className="py-3 px-3">
                          <p className="text-slate-900 font-black">{item.description}</p>
                          <p className="text-[10px] text-slate-400 font-normal">Mã vé: {item.ticketCode}</p>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-black text-[#005A36]">
                            {item.seatNumber}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center text-slate-600">{item.unit || 'Lượt'}</td>
                        <td className="py-3 px-3 text-center text-slate-900 font-black">{item.quantity || 1}</td>
                        <td className="py-3 px-3 text-right text-slate-700 font-mono">
                          {Number(item.unitPrice).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-900 font-mono font-black">
                          {Number(item.totalAmount).toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-400 italic">
                        Chi tiết vé xe lượt thông minh ICTU Transit
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bảng Tính Thuế & Tổng Tiền */}
            <div className="border-t-2 border-slate-200 pt-4 mt-2 space-y-2 text-xs">
              <div className="flex justify-between font-bold text-slate-600">
                <span>Cộng tiền hàng (Subtotal):</span>
                <span className="font-mono text-slate-900">
                  {Number(invoice.subtotalAmount || invoice.totalAmount).toLocaleString('vi-VN')} VNĐ
                </span>
              </div>

              {invoice.discountAmount > 0 && (
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Ưu đãi sinh viên / Mã giảm giá:</span>
                  <span className="font-mono">
                    -{Number(invoice.discountAmount).toLocaleString('vi-VN')} VNĐ
                  </span>
                </div>
              )}

              <div className="flex justify-between font-bold text-slate-600">
                <span>Thuế suất GTGT (VAT Rate): <strong>{invoice.vatRate || 8}%</strong></span>
                <span className="font-mono text-slate-900">
                  {Number(invoice.vatAmount || 0).toLocaleString('vi-VN')} VNĐ
                </span>
              </div>

              <div className="flex justify-between text-base font-black text-[#005A36] pt-2 border-t border-slate-200">
                <span>TỔNG CỘNG TIỀN THANH TOÁN:</span>
                <span className="font-mono text-lg font-black text-rose-600">
                  {Number(invoice.totalAmount).toLocaleString('vi-VN')} VNĐ
                </span>
              </div>

              <div className="text-right text-xs italic font-bold text-slate-600 pt-1">
                Số tiền viết bằng chữ: <strong className="text-slate-800 font-medium">« {invoice.amountInWords} »</strong>
              </div>
            </div>

            {/* Footer Ký Số & Mã Tra Cứu */}
            <div className="border-t-2 border-dashed border-slate-200 mt-8 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              {/* Cột Trái: Mã Tra Cứu & QR Code */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-emerald-50 text-[#005A36] flex items-center justify-center border border-emerald-200">
                    <QrCode size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-black uppercase block">Mã tra cứu hóa đơn</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-slate-900 text-sm">{invoice.lookupCode}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(invoice.lookupCode, 'lookupCode')}
                        className="text-slate-400 hover:text-[#005A36] transition-colors p-1"
                        title="Sao chép mã tra cứu"
                      >
                        {copiedField === 'lookupCode' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                  <p className="font-bold text-slate-700">Tra cứu trực tuyến tại website:</p>
                  <p className="font-mono text-[#005A36] font-bold break-all">
                    {invoice.seller.website}/tra-cuu-hoa-don
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Hóa đơn điện tử có giá trị pháp lý tương đương bản gốc giấy theo quy định hiện hành.
                  </p>
                </div>
              </div>

              {/* Cột Phải: Chữ Ký Số Hợp Lệ */}
              <div className="flex flex-col items-center sm:items-end justify-center">
                <div className="w-full sm:max-w-xs rounded-2xl border-2 border-emerald-500/70 bg-emerald-50/40 p-4 text-center sm:text-right space-y-1 shadow-2xs">
                  <div className="flex items-center justify-center sm:justify-end gap-1.5 text-xs font-black text-[#005A36]">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    <span>CHỮ KÝ SỐ HỢP LỆ</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-800">
                    Ký bởi: TRƯỜNG ĐH CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG
                  </p>
                  <p className="text-[10px] text-slate-600">
                    Chứng thư số: Viettel-CA / Ban Cơ yếu Chính phủ
                  </p>
                  <p className="text-[10px] text-emerald-800 font-bold font-mono">
                    Ngày ký: {new Date(invoice.issuedAt).toLocaleString('vi-VN')}
                  </p>
                  <span className="inline-block mt-1 text-[10px] bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-full">
                    ĐÃ KIỂM TRA CHỮ KÝ ĐIỆN TỬ
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gửi Lại Email */}
      {showResendModal && invoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-xl bg-emerald-100 text-[#005A36] flex items-center justify-center">
                  <Mail size={16} />
                </div>
                <h3 className="text-sm font-black text-slate-900">Gửi Hóa Đơn Qua Email</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResendModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Hệ thống sẽ gửi lại thông tin hóa đơn <strong>{invoice.invoiceNumber}</strong> kèm bản PDF hợp lệ đến địa chỉ email bên dưới:
            </p>

            <form onSubmit={handleResendEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Địa chỉ email người nhận
                </label>
                <input
                  type="email"
                  required
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="sinhvien.ictu@gmail.com"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#005A36]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResendModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isResending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#005A36] text-white px-5 py-2 text-xs font-black hover:bg-emerald-800 disabled:opacity-50"
                >
                  {isResending ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Đang gửi...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Gửi ngay</span>
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

export default function InvoiceLookupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="flex items-center gap-3 text-sm font-bold text-[#005A36]">
            <RefreshCw className="size-5 animate-spin" />
            <span>Đang tải cổng tra cứu hóa đơn điện tử...</span>
          </div>
        </div>
      }
    >
      <InvoiceLookupContent />
    </Suspense>
  )
}
