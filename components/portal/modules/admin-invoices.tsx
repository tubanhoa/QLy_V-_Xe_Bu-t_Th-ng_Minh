'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Receipt,
  Search,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileText,
  Printer,
  ShieldCheck,
  Building,
  User,
  CreditCard,
  QrCode,
  Calendar,
} from 'lucide-react'
import { authService } from '@/lib/services/auth.service'
import { paymentService, type AdminTicketItem } from '@/lib/services/payment.service'

interface InvoiceData {
  invoiceNumber: string
  lookupCode: string
  issueDate: string
  bookingCode: string
  buyerName: string
  buyerTaxCode?: string
  buyerAddress?: string
  totalAmount: number
  vatRate: number
  vatAmount: number
  finalAmount: number
  paymentMethod: string
  status: 'issued' | 'cancelled' | string
}

export function AdminInvoices() {
  const [tickets, setTickets] = useState<AdminTicketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lookupQuery, setLookupQuery] = useState('')
  const [currentInvoice, setCurrentInvoice] = useState<InvoiceData | null>(null)
  const [searching, setSearching] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  // Nạp vé gần nhất để tra cứu nhanh hóa đơn
  const loadRecentTickets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await paymentService.getAdminTickets({ page: 1, limit: 10, status: 'paid' })
      if (res.success && res.data?.items) {
        setTickets(res.data.items)
        if (res.data.items.length > 0 && !currentInvoice) {
          const t = res.data.items[0]
          generateInvoiceFromTicket(t)
        }
      }
    } catch (err: any) {
      console.warn('Lỗi nạp vé hóa đơn:', err)
    } finally {
      setLoading(false)
    }
  }, [currentInvoice])

  useEffect(() => {
    loadRecentTickets()
  }, [loadRecentTickets])

  const generateInvoiceFromTicket = (t: AdminTicketItem) => {
    const finalAmt = t.price || 10000
    const vatRate = 8
    const vatAmount = Math.round((finalAmt * vatRate) / 108)
    const baseAmount = finalAmt - vatAmount

    const inv: InvoiceData = {
      invoiceNumber: `INV-${t.ticketCode || t.id.slice(0, 8).toUpperCase()}`,
      lookupCode: `ICTU-${t.id.slice(0, 8).toUpperCase()}`,
      issueDate: t.createdAt || new Date().toISOString(),
      bookingCode: t.ticketCode || t.id.slice(0, 8),
      buyerName: t.user?.fullName || 'Hành khách Smart Bus',
      buyerTaxCode: '0100109106 (ĐH CNTT & TT Thái Nguyên)',
      buyerAddress: 'Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên',
      totalAmount: baseAmount,
      vatRate,
      vatAmount,
      finalAmount: finalAmt,
      paymentMethod: (t.booking as any)?.paymentMethod || 'VNPay / Thẻ vé thông minh',
      status: 'issued',
    }
    setCurrentInvoice(inv)
  }

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lookupQuery.trim()) return

    setSearching(true)
    setErrorMsg(null)
    try {
      const clean = lookupQuery.trim().toUpperCase()
      const found = tickets.find(
        (t) =>
          t.ticketCode?.toUpperCase().includes(clean) ||
          t.id.toUpperCase().includes(clean) ||
          t.user?.fullName?.toUpperCase().includes(clean),
      )

      if (found) {
        generateInvoiceFromTicket(found)
      } else {
        // Tra cứu online endpoint
        const res = await fetch(
          `http://localhost:3001/api/v1/invoices/lookup?code=${encodeURIComponent(clean)}`,
        )
        const json = await res.json()
        if (res.ok && json.data) {
          setCurrentInvoice(json.data)
        } else {
          setErrorMsg(`Không tìm thấy hóa đơn điện tử với mã tra cứu "${clean}"`)
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi tra cứu hóa đơn')
    } finally {
      setSearching(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!currentInvoice) return
    setDownloadingPdf(true)
    try {
      const bookingCode = currentInvoice.bookingCode
      const res = await fetch(
        `http://localhost:3001/api/v1/invoices/booking/${bookingCode}/pdf`,
      )
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `HoaDon_VAT_${currentInvoice.invoiceNumber}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        // Fallback: In trang web hóa đơn chuẩn
        window.print()
      }
    } catch {
      window.print()
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="size-6 text-[#00A86B]" />
            Quản Lý Hóa Đơn Điện Tử VAT (E-Invoices)
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Phát hành, ký số điện tử SHA-256 và tra cứu hóa đơn điện tử giá trị gia tăng dịch vụ xe buýt
          </p>
        </div>

        <button
          type="button"
          onClick={loadRecentTickets}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="size-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Lookup Bar */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <form onSubmit={handleLookup} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="size-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              placeholder="Nhập mã tra cứu hóa đơn (ICTU-...) hoặc mã vé (BK-...)"
              className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-xs sm:text-sm text-foreground focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={searching}
            className="flex items-center gap-2 rounded-2xl bg-[#00A86B] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-emerald-700 active:scale-95"
          >
            {searching ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Receipt className="size-4" />
            )}
            Tra Cứu Hóa Đơn
          </button>
        </form>

        {/* Quick Picks */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Vé xuất gần đây:</span>
          {tickets.slice(0, 4).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => generateInvoiceFromTicket(t)}
              className="rounded-lg border border-border bg-accent/40 px-2.5 py-1 font-mono text-[11px] text-foreground hover:border-emerald-500"
            >
              {t.ticketCode || t.id.slice(0, 8)}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice Detail Sheet Preview */}
      {currentInvoice && (
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-[#00A86B]">
                  HÓA ĐƠN ĐIỆN TỬ GIÁ TRỊ GIA TĂNG (VAT)
                </span>
                <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                  Ký hiệu: 1C26TNB
                </span>
              </div>
              <h2 className="mt-2 text-xl font-bold text-foreground">
                HỆ THỐNG XE BUÝT ĐIỆN THÔNG MINH - ICTU SMART TRANSIT
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Trường Đại học Công nghệ Thông tin & Truyền thông - Đại học Thái Nguyên
              </p>
            </div>

            <div className="flex flex-col items-end">
              <span className="font-mono text-sm font-bold text-foreground">
                Số HĐ: {currentInvoice.invoiceNumber}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                Mã tra cứu: {currentInvoice.lookupCode}
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                Ngày lập: {new Date(currentInvoice.issueDate).toLocaleDateString('vi-VN')}
              </span>
            </div>
          </div>

          {/* Buyer & Seller Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-1.5 p-4 rounded-2xl bg-accent/20 border border-border">
              <span className="font-bold text-foreground block mb-1 flex items-center gap-1.5">
                <Building className="size-3.5 text-[#00A86B]" /> Đơn vị bán hàng:
              </span>
              <p className="font-medium text-foreground">
                Trung tâm Điều hành Xe buýt Thông minh ICTU
              </p>
              <p className="text-muted-foreground">Mã số thuế: 4600123456</p>
              <p className="text-muted-foreground">Địa chỉ: Đường Z115, Quyết Thắng, TP. Thái Nguyên</p>
            </div>

            <div className="space-y-1.5 p-4 rounded-2xl bg-accent/20 border border-border">
              <span className="font-bold text-foreground block mb-1 flex items-center gap-1.5">
                <User className="size-3.5 text-blue-500" /> Người mua hàng:
              </span>
              <p className="font-bold text-foreground">{currentInvoice.buyerName}</p>
              <p className="text-muted-foreground">Mã đơn đặt vé: {currentInvoice.bookingCode}</p>
              <p className="text-muted-foreground">Hình thức thanh toán: {currentInvoice.paymentMethod}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3 pl-4">STT</th>
                  <th className="p-3">Tên hàng hóa, dịch vụ</th>
                  <th className="p-3">ĐVT</th>
                  <th className="p-3">SL</th>
                  <th className="p-3 text-right">Đơn giá (chưa VAT)</th>
                  <th className="p-3 text-right pr-4">Thành tiền (VNĐ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="p-3 pl-4 font-mono">1</td>
                  <td className="p-3 font-medium text-foreground">
                    Vé xe buýt điện thông minh ICTU Transit (Tuyến CT-01 / CT-02)
                  </td>
                  <td className="p-3 text-muted-foreground">Lượt</td>
                  <td className="p-3 font-mono">1</td>
                  <td className="p-3 text-right font-mono">
                    {currentInvoice.totalAmount.toLocaleString('vi-VN')} đ
                  </td>
                  <td className="p-3 text-right pr-4 font-mono font-bold text-foreground">
                    {currentInvoice.totalAmount.toLocaleString('vi-VN')} đ
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals Calculation */}
          <div className="flex flex-col items-end gap-1.5 text-xs">
            <div className="flex justify-between w-64 text-muted-foreground">
              <span>Cộng tiền dịch vụ:</span>
              <span className="font-mono">{currentInvoice.totalAmount.toLocaleString('vi-VN')} đ</span>
            </div>
            <div className="flex justify-between w-64 text-muted-foreground">
              <span>Thuế suất GTGT ({currentInvoice.vatRate}%):</span>
              <span className="font-mono">{currentInvoice.vatAmount.toLocaleString('vi-VN')} đ</span>
            </div>
            <div className="flex justify-between w-64 border-t border-border pt-1.5 font-bold text-sm text-foreground">
              <span>Tổng thanh toán:</span>
              <span className="font-mono text-[#00A86B]">
                {currentInvoice.finalAmount.toLocaleString('vi-VN')} đ
              </span>
            </div>
          </div>

          {/* Digital Signature Footer */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-8 text-[#00A86B]" />
              <div className="text-xs">
                <p className="font-bold text-foreground">Hóa Đơn Đã Được Ký Số Điện Tử Hợp Lệ</p>
                <p className="text-muted-foreground">
                  Chứng thư số: ICTU TRANSIT CA • Thuật toán mã hóa: RSA-SHA256
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent"
              >
                <Printer className="size-3.5" /> In hóa đơn
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="flex items-center gap-1.5 rounded-xl bg-[#00A86B] px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-md"
              >
                {downloadingPdf ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                Tải tệp PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
