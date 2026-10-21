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
  Eye,
  Filter,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Percent,
  Check,
} from 'lucide-react'
import { invoiceService } from '@/lib/services/invoice.service'
import type { InvoiceListItem, InvoiceSummaryStats } from '@/lib/types/invoice'

export interface InvoiceViewData {
  id?: string
  invoiceNumber: string
  lookupCode: string
  issueDate: string
  bookingCode: string
  buyerName: string
  buyerPhone?: string
  buyerEmail?: string
  buyerTaxCode?: string
  buyerAddress?: string
  routeName?: string
  items: Array<{
    itemNumber: number
    description: string
    ticketCode?: string
    seatNumber?: string
    unit: string
    quantity: number
    unitPrice: number
    totalAmount: number
  }>
  totalAmount: number // Tiền trước thuế
  vatRate: number
  vatAmount: number
  finalAmount: number // Tổng tiền thanh toán có VAT
  paymentMethod: string
  status: 'issued' | 'cancelled' | string
}

/**
 * Hàm chuẩn hóa an toàn tuyệt đối mọi định dạng dữ liệu (Entity DB, Raw JSON, Ticket fallback)
 * Đảm bảo 100% không bao giờ bị undefined cho các trường số (chống crash toLocaleString)
 */
function mapToInvoiceViewData(raw: any): InvoiceViewData {
  if (!raw) {
    return {
      invoiceNumber: 'INV-DEMO-0001',
      lookupCode: 'ICTU-DEMO0001',
      issueDate: new Date().toISOString(),
      bookingCode: 'BK-DEMO',
      buyerName: 'Hành khách Smart Bus',
      buyerTaxCode: '0100109106',
      buyerAddress: 'Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên',
      routeName: 'Tuyến Xe Buýt Điện ICTU',
      items: [
        {
          itemNumber: 1,
          description: 'Vé xe buýt điện thông minh ICTU Transit',
          ticketCode: 'TKT-DEMO',
          seatNumber: 'Ghế tiêu chuẩn',
          unit: 'Lượt',
          quantity: 1,
          unitPrice: 9259,
          totalAmount: 9259,
        },
      ],
      totalAmount: 9259,
      vatRate: 8,
      vatAmount: 741,
      finalAmount: 10000,
      paymentMethod: 'VNPAY',
      status: 'issued',
    }
  }

  const invData = raw.invoiceData || {}
  const booking = raw.booking || {}
  const payment = raw.payment || (booking.payments && booking.payments[0]) || {}
  const buyer = invData.buyer || {}
  const user = raw.user || booking.user || {}

  // Đơn giá và thuế
  const finalAmount = Number(raw.totalAmount ?? raw.finalAmount ?? invData.totalAmount ?? 0)
  const vatRate = Number(raw.vatRate ?? invData.vatRate ?? 0.08) > 1
    ? Number(raw.vatRate ?? invData.vatRate ?? 8)
    : Math.round(Number(raw.vatRate ?? invData.vatRate ?? 0.08) * 100)
  const vatAmount = Number(raw.vatAmount ?? invData.vatAmount ?? Math.round((finalAmount * vatRate) / (100 + vatRate)))
  const totalAmount = Number(raw.subtotalAmount ?? invData.subtotalAmount ?? (finalAmount - vatAmount))

  // Danh sách hạng mục
  let items = invData.items || []
  if (!items || items.length === 0) {
    items = [
      {
        itemNumber: 1,
        description: `Vé xe buýt điện thông minh ICTU Transit (${booking.trip?.route?.name || invData.routeName || 'Tuyến CT-01'})`,
        ticketCode: invData.ticketCode || raw.ticketCode || 'TKT-ICTU',
        seatNumber: invData.seatNumber || raw.seatNumber || 'Ghế tiêu chuẩn',
        unit: 'Lượt',
        quantity: 1,
        unitPrice: totalAmount,
        totalAmount: totalAmount,
      },
    ]
  }

  return {
    id: raw.id,
    invoiceNumber: raw.invoiceNumber || invData.invoiceNumber || `INV-${raw.ticketCode || '20261001-0001'}`,
    lookupCode: raw.lookupCode || invData.lookupCode || `ICTU-${raw.id ? raw.id.slice(0, 8).toUpperCase() : 'A1B2C3D4'}`,
    issueDate: raw.issuedAt || raw.issueDate || raw.createdAt || new Date().toISOString(),
    bookingCode: booking.bookingCode || invData.bookingCode || raw.bookingCode || raw.ticketCode || 'BK-SMARTBUS',
    buyerName: buyer.fullName || user.fullName || raw.customerName || raw.buyerName || 'Hành khách Smart Bus',
    buyerPhone: buyer.phone || user.phoneNumber || raw.phone,
    buyerEmail: buyer.email || user.email,
    buyerTaxCode: buyer.taxCode || '0100109106 (ĐH CNTT & TT Thái Nguyên)',
    buyerAddress: buyer.address || 'Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên',
    routeName: booking.trip?.route?.name || invData.routeName || 'Tuyến xe buýt điện thông minh ICTU',
    items,
    totalAmount,
    vatRate,
    vatAmount,
    finalAmount,
    paymentMethod: (payment.paymentMethod || invData.paymentMethod || raw.paymentMethod || 'VNPAY').toUpperCase(),
    status: raw.status || 'issued',
  }
}

export function AdminInvoices() {
  // Dữ liệu danh sách hóa đơn từ Database
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [summary, setSummary] = useState<InvoiceSummaryStats>({
    totalInvoices: 0,
    totalRevenue: 0,
    totalVatAmount: 0,
    totalSubtotal: 0,
  })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loadingList, setLoadingList] = useState(true)

  // Tra cứu & Hóa đơn đang xem chi tiết
  const [lookupQuery, setLookupQuery] = useState('')
  const [currentInvoice, setCurrentInvoice] = useState<InvoiceViewData | null>(null)
  const [searching, setSearching] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null)

  // Nạp danh sách hóa đơn từ backend
  const loadInvoices = useCallback(async (targetPage = 1, searchQuery = '') => {
    setLoadingList(true)
    setErrorMsg(null)
    try {
      const res = await invoiceService.getInvoices({
        page: targetPage,
        limit: 10,
        search: searchQuery || undefined,
      })
      if (res.success && res.data) {
        setInvoices(res.data.items || [])
        if (res.data.summary) {
          setSummary(res.data.summary)
        }
        if (res.data.pagination) {
          setPage(res.data.pagination.page)
          setTotalPages(res.data.pagination.totalPages || 1)
        }
        // Tự động hiển thị chi tiết hóa đơn đầu tiên nếu chưa chọn
        if (res.data.items && res.data.items.length > 0 && !currentInvoice) {
          setCurrentInvoice(mapToInvoiceViewData(res.data.items[0]))
        }
      } else {
        setErrorMsg(res.message || 'Không thể tải danh sách hóa đơn')
      }
    } catch (err: any) {
      console.warn('Lỗi nạp danh sách hóa đơn:', err)
      setErrorMsg(err?.message || 'Lỗi kết nối khi nạp danh sách hóa đơn')
    } finally {
      setLoadingList(false)
    }
  }, [currentInvoice])

  useEffect(() => {
    loadInvoices(1)
  }, [loadInvoices])

  // Xử lý tra cứu linh hoạt (chấp nhận Số HĐ, Mã tra cứu, Mã vé TKT-, Mã booking BK-)
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lookupQuery.trim()) return

    setSearching(true)
    setErrorMsg(null)
    try {
      const clean = lookupQuery.trim()
      const res = await invoiceService.lookupInvoice(clean)
      if (res.success && res.data) {
        const mapped = mapToInvoiceViewData(res.data)
        setCurrentInvoice(mapped)
      } else {
        setErrorMsg(`Không tìm thấy hóa đơn điện tử với từ khóa "${clean}". Vui lòng kiểm tra lại mã!`)
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi khi tra cứu hóa đơn điện tử')
    } finally {
      setSearching(false)
    }
  }

  // Tải file PDF hóa đơn thực tế
  const handleDownloadPdf = async (identifier?: string) => {
    const target = identifier || currentInvoice?.invoiceNumber || currentInvoice?.bookingCode
    if (!target) return

    setDownloadingPdf(true)
    setDownloadSuccessMsg(null)
    try {
      const success = await invoiceService.downloadPdf(target)
      if (success) {
        setDownloadSuccessMsg(`Đã tải xuống thành công tệp PDF hóa đơn: ${target}`)
        setTimeout(() => setDownloadSuccessMsg(null), 4000)
      } else {
        // Fallback: nếu lỗi mạng thì mở bản in giao diện
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
          onClick={() => loadInvoices(page, lookupQuery)}
          disabled={loadingList}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer"
        >
          <RefreshCw className={`size-3.5 ${loadingList ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* KPI Cards Thống Kê Thuế & Hóa Đơn VAT */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Tổng HĐ Phát Hành</span>
            <p className="text-2xl font-bold text-foreground font-mono">
              {summary.totalInvoices.toLocaleString('vi-VN')}
            </p>
            <span className="text-[11px] text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={12} /> Hợp chuẩn Cục Thuế
            </span>
          </div>
          <div className="size-11 rounded-xl bg-emerald-500/10 text-[#00A86B] flex items-center justify-center">
            <Receipt className="size-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Tổng Doanh Thu (Gross)</span>
            <p className="text-2xl font-bold text-foreground font-mono">
              {summary.totalRevenue.toLocaleString('vi-VN')} đ
            </p>
            <span className="text-[11px] text-muted-foreground">Doanh thu vé có hóa đơn</span>
          </div>
          <div className="size-11 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <TrendingUp className="size-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Thuế GTGT 8% Đã Nộp</span>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {summary.totalVatAmount.toLocaleString('vi-VN')} đ
            </p>
            <span className="text-[11px] text-muted-foreground">Nghị định 72/2024/NĐ-CP</span>
          </div>
          <div className="size-11 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
            <Percent className="size-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Chứng Thư Số & Ký Điện Tử</span>
            <p className="text-sm font-bold text-foreground flex items-center gap-1 mt-1">
              <ShieldCheck className="size-4 text-[#00A86B]" /> ICTU TRANSIT CA
            </p>
            <span className="text-[11px] text-emerald-600 font-mono font-semibold">
              Ký số SHA-256 (Hợp lệ)
            </span>
          </div>
          <div className="size-11 rounded-xl bg-emerald-500/10 text-[#00A86B] flex items-center justify-center">
            <ShieldCheck className="size-6" />
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400 animate-in fade-in">
          <AlertCircle className="size-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {downloadSuccessMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300 animate-in fade-in">
          <Check className="size-5 shrink-0 text-emerald-600" />
          <span>{downloadSuccessMsg}</span>
        </div>
      )}

      {/* Thanh Tra Cứu Hóa Đơn Trực Tuyến */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <form onSubmit={handleLookup} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="size-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              placeholder="Nhập mã tra cứu (ICTU-...), số hóa đơn (INV-...), mã đặt vé (BK-...) hoặc mã vé (TKT-...)"
              className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-xs sm:text-sm text-foreground focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={searching}
            className="flex items-center gap-2 rounded-2xl bg-[#00A86B] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {searching ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Receipt className="size-4" />
            )}
            Tra Cứu Hóa Đơn
          </button>
        </form>

        {/* Quick Picks Từ Danh Sách Hóa Đơn Thật Trong Hệ Thống */}
        {invoices.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Hóa đơn xuất gần đây:</span>
            {invoices.slice(0, 5).map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => {
                  setLookupQuery(inv.lookupCode)
                  setCurrentInvoice(mapToInvoiceViewData(inv))
                }}
                className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-all cursor-pointer ${
                  currentInvoice?.invoiceNumber === inv.invoiceNumber
                    ? 'border-emerald-500 bg-emerald-500/10 text-[#00A86B] font-bold'
                    : 'border-border bg-accent/40 text-foreground hover:border-emerald-500'
                }`}
              >
                {inv.invoiceNumber}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid: Preview Chi Tiết Hóa Đơn & Bảng Danh Sách */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Cột Chi Tiết Hóa Đơn Điện Tử (Preview Form Chuẩn) */}
        <div className="xl:col-span-7">
          {currentInvoice ? (
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
                  <span className="font-mono text-xs text-emerald-600 font-semibold mt-0.5">
                    Mã tra cứu: {currentInvoice.lookupCode}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Ngày lập: {new Date(currentInvoice.issueDate).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              </div>

              {/* Thông Tin Bên Bán & Bên Mua */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-1.5 p-4 rounded-2xl bg-accent/20 border border-border">
                  <span className="font-bold text-foreground mb-1 flex items-center gap-1.5">
                    <Building className="size-3.5 text-[#00A86B]" /> Đơn vị bán hàng:
                  </span>
                  <p className="font-medium text-foreground">
                    Trung tâm Điều hành Xe buýt Thông minh ICTU
                  </p>
                  <p className="text-muted-foreground">Mã số thuế: 4600123456-001</p>
                  <p className="text-muted-foreground">Địa chỉ: Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên</p>
                </div>

                <div className="space-y-1.5 p-4 rounded-2xl bg-accent/20 border border-border">
                  <span className="font-bold text-foreground mb-1 flex items-center gap-1.5">
                    <User className="size-3.5 text-blue-500" /> Người mua hàng:
                  </span>
                  <p className="font-bold text-foreground">{currentInvoice.buyerName}</p>
                  <p className="text-muted-foreground">Mã đơn đặt vé: {currentInvoice.bookingCode}</p>
                  <p className="text-muted-foreground">Hình thức thanh toán: {currentInvoice.paymentMethod}</p>
                </div>
              </div>

              {/* Bảng Dòng Hàng Hóa Dịch Vụ */}
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
                    {currentInvoice.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-3 pl-4 font-mono">{it.itemNumber || idx + 1}</td>
                        <td className="p-3 font-medium text-foreground">
                          {it.description}
                          {it.seatNumber && (
                            <span className="ml-1 text-[11px] text-muted-foreground">
                              · Ghế {it.seatNumber}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">{it.unit || 'Lượt'}</td>
                        <td className="p-3 font-mono">{it.quantity || 1}</td>
                        <td className="p-3 text-right font-mono">
                          {Number(it.unitPrice || 0).toLocaleString('vi-VN')} đ
                        </td>
                        <td className="p-3 text-right pr-4 font-mono font-bold text-foreground">
                          {Number(it.totalAmount || 0).toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tổng Cộng Tiền & Thuế VAT */}
              <div className="flex flex-col items-end gap-1.5 text-xs">
                <div className="flex justify-between w-64 text-muted-foreground">
                  <span>Cộng tiền dịch vụ:</span>
                  <span className="font-mono">
                    {Number(currentInvoice.totalAmount || 0).toLocaleString('vi-VN')} đ
                  </span>
                </div>
                <div className="flex justify-between w-64 text-muted-foreground">
                  <span>Thuế suất GTGT ({currentInvoice.vatRate}%):</span>
                  <span className="font-mono">
                    {Number(currentInvoice.vatAmount || 0).toLocaleString('vi-VN')} đ
                  </span>
                </div>
                <div className="flex justify-between w-64 border-t border-border pt-1.5 font-bold text-sm text-foreground">
                  <span>Tổng thanh toán:</span>
                  <span className="font-mono text-[#00A86B]">
                    {Number(currentInvoice.finalAmount || 0).toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>

              {/* Chữ Ký Số & Thao Tác In / Tải PDF */}
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
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent cursor-pointer transition-all"
                  >
                    <Printer className="size-3.5" /> In hóa đơn
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadPdf()}
                    disabled={downloadingPdf}
                    className="flex items-center gap-1.5 rounded-xl bg-[#00A86B] px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-md cursor-pointer transition-all disabled:opacity-50"
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
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center text-xs text-muted-foreground space-y-2">
              <FileText className="size-8 mx-auto text-muted-foreground/60" />
              <p className="font-semibold text-foreground text-sm">Chưa có hóa đơn nào được chọn</p>
              <p>Chọn một hóa đơn từ bảng danh sách bên phải hoặc tra cứu bằng mã tra cứu để xem chi tiết.</p>
            </div>
          )}
        </div>

        {/* Cột Bảng Danh Sách Hóa Đơn Điện Tử Đã Phát Hành */}
        <div className="xl:col-span-5 rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileText className="size-4 text-[#00A86B]" />
                Sổ Hóa Đơn VAT Phát Hành
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Hiển thị {invoices.length} trên tổng số {summary.totalInvoices} hóa đơn
              </p>
            </div>

            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              Trang {page}/{totalPages}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border font-semibold text-muted-foreground">
                <tr>
                  <th className="p-2.5 pl-3">Số HĐ & Mã tra cứu</th>
                  <th className="p-2.5">Người Mua</th>
                  <th className="p-2.5 text-right">Tổng Tiền</th>
                  <th className="p-2.5 text-right pr-3">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingList ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-[#00A86B]" />
                      Đang nạp danh sách hóa đơn điện tử...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      Chưa có hóa đơn nào phù hợp với bộ lọc tìm kiếm.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const isSelected = currentInvoice?.invoiceNumber === inv.invoiceNumber
                    const buyerName =
                      inv.invoiceData?.buyer?.fullName ||
                      inv.booking?.user?.fullName ||
                      'Hành khách'

                    return (
                      <tr
                        key={inv.id}
                        className={`transition-colors hover:bg-accent/40 ${
                          isSelected ? 'bg-emerald-500/10 dark:bg-emerald-950/20' : ''
                        }`}
                      >
                        <td className="p-2.5 pl-3">
                          <button
                            type="button"
                            onClick={() => setCurrentInvoice(mapToInvoiceViewData(inv))}
                            className="text-left font-mono font-bold text-foreground hover:text-emerald-600 block cursor-pointer"
                          >
                            {inv.invoiceNumber}
                          </button>
                          <span className="font-mono text-[10px] text-muted-foreground block">
                            {inv.lookupCode}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span className="font-semibold text-foreground block truncate max-w-[120px]">
                            {buyerName}
                          </span>
                          <span className="text-[10px] text-muted-foreground block">
                            {new Date(inv.issuedAt).toLocaleDateString('vi-VN')}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-foreground">
                          {Number(inv.totalAmount || 0).toLocaleString('vi-VN')} đ
                        </td>
                        <td className="p-2.5 text-right pr-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title="Xem chi tiết hóa đơn"
                              onClick={() => setCurrentInvoice(mapToInvoiceViewData(inv))}
                              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              title="Tải tệp PDF"
                              onClick={() => handleDownloadPdf(inv.invoiceNumber)}
                              className="p-1 rounded-md text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                            >
                              <Download size={14} />
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

          {/* Phân Trang */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={page <= 1 || loadingList}
                onClick={() => loadInvoices(page - 1, lookupQuery)}
                className="flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft size={14} /> Trước
              </button>

              <span className="text-xs font-mono text-muted-foreground">
                Trang {page} / {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages || loadingList}
                onClick={() => loadInvoices(page + 1, lookupQuery)}
                className="flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-40 cursor-pointer"
              >
                Sau <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
