'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  CreditCard,
  Download,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  Wallet,
  XCircle,
  FileSpreadsheet,
  History,
  TrendingUp,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react'
import { paymentService } from '@/lib/services/payment.service'

interface AdminTicketItem {
  id: string
  ticketCode: string
  bookingCode: string
  customerName: string
  phone: string
  email: string
  route: string
  seatNumber: string
  amount: number
  paymentMethod: string
  status: string
  createdAt: string
  departureTime?: string
}

export function AdminPayments() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'reconciliation' | 'logs'>('transactions')

  // Giao dịch (Transactions) State
  const [tickets, setTickets] = useState<AdminTicketItem[]>([])
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [ticketsError, setTicketsError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit] = useState(15)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedGateway, setSelectedGateway] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')

  // Đối soát (Reconciliation) State
  const [reconciliation, setReconciliation] = useState<any>(null)
  const [loadingRecon, setLoadingRecon] = useState(false)

  // Nhật ký (Logs) State
  const [refundLogs, setRefundLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Feedback banner
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isRefunding, setIsRefunding] = useState<string | null>(null)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  // Load Admin Tickets
  const loadTickets = useCallback(async () => {
    setLoadingTickets(true)
    setTicketsError(null)
    try {
      const res = await paymentService.getAdminTickets({
        page,
        limit,
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        paymentMethod: selectedGateway === 'all' ? undefined : selectedGateway,
        search: searchDebounced.trim() || undefined,
      })

      if (res.success && res.data) {
        setTickets(res.data.items || [])
        setTotal(res.data.meta?.total || 0)
        setTotalPages(res.data.meta?.totalPages || 1)
      } else {
        setTicketsError(res.message || 'Không thể tải danh sách giao dịch vé')
      }
    } catch (err: any) {
      setTicketsError(err.message || 'Lỗi kết nối máy chủ')
    } finally {
      setLoadingTickets(false)
    }
  }, [page, limit, selectedStatus, selectedGateway, searchDebounced])

  // Load Reconciliation
  const loadReconciliation = useCallback(async () => {
    setLoadingRecon(true)
    try {
      const res = await paymentService.getReconciliationReport()
      if (res.success && res.data) {
        setReconciliation(res.data)
      }
    } catch (err) {
      console.error('Error loading reconciliation:', err)
    } finally {
      setLoadingRecon(false)
    }
  }, [])

  // Load Logs
  const loadLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const res = await paymentService.getRefundLogs({ page: 1, limit: 30 })
      if (res.success && res.data) {
        setRefundLogs(Array.isArray(res.data) ? res.data : res.data.items || [])
      }
    } catch (err) {
      console.error('Error loading refund logs:', err)
    } finally {
      setLoadingLogs(false)
    }
  }, [])

  // Auto-sync real-time biến động IPN (10 giây)
  const [autoSync, setAutoSync] = useState(true)

  useEffect(() => {
    if (activeTab === 'transactions') {
      loadTickets()
    } else if (activeTab === 'reconciliation') {
      loadReconciliation()
    } else if (activeTab === 'logs') {
      loadLogs()
    }
  }, [activeTab, loadTickets, loadReconciliation, loadLogs])

  // Lắng nghe và cập nhật định kỳ mỗi 10 giây
  useEffect(() => {
    if (!autoSync) return
    const interval = setInterval(() => {
      if (activeTab === 'transactions') {
        loadTickets()
      } else if (activeTab === 'reconciliation') {
        loadReconciliation()
      } else if (activeTab === 'logs') {
        loadLogs()
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [autoSync, activeTab, loadTickets, loadReconciliation, loadLogs])

  // Thực hiện hoàn vé thật
  const handleRefund = async (ticket: AdminTicketItem) => {
    if (
      !confirm(
        `Xác nhận hoàn tiền 100% cho vé ${ticket.ticketCode} (${ticket.customerName})?\nSố tiền: ${ticket.amount.toLocaleString(
          'vi-VN'
        )} đ`
      )
    ) {
      return
    }

    setIsRefunding(ticket.id)
    try {
      const res = await paymentService.refundTicket(
        ticket.id,
        'Quản trị viên duyệt hoàn vé trên Bảng điều khiển Quản trị',
        100
      )
      if (res.success) {
        setFeedback(
          `Đã hoàn tiền thành công cho vé ${ticket.ticketCode}! Ghế đã được giải phóng và lưu vào nhật ký đối soát.`
        )
        // Refresh danh sách
        await loadTickets()
      } else {
        alert(res.message || 'Không thể thực hiện hoàn tiền cho vé này')
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi kích hoạt hoàn tiền')
    } finally {
      setIsRefunding(null)
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  // Xuất file CSV thật cho kế toán
  const handleExportCSV = () => {
    if (tickets.length === 0) {
      alert('Không có dữ liệu giao dịch để xuất!')
      return
    }

    const headers = [
      'Mã vé',
      'Mã đơn đặt',
      'Họ và tên khách',
      'Số điện thoại',
      'Email',
      'Tuyến xe',
      'Số ghế',
      'Số tiền (VNĐ)',
      'Phương thức',
      'Trạng thái',
      'Thời gian đặt',
    ]

    const rows = tickets.map((t) => [
      `"${t.ticketCode}"`,
      `"${t.bookingCode}"`,
      `"${t.customerName}"`,
      `"${t.phone}"`,
      `"${t.email}"`,
      `"${t.route}"`,
      `"${t.seatNumber}"`,
      t.amount,
      `"${t.paymentMethod}"`,
      `"${t.status}"`,
      `"${new Date(t.createdAt).toLocaleString('vi-VN')}"`,
    ])

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `GiaoDich_ICTU_SmartBus_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setFeedback('Đã xuất file báo cáo giao dịch CSV thành công!')
    setTimeout(() => setFeedback(null), 3500)
  }

  // Tính toán nhanh số liệu hiển thị
  const totalAmountInView = tickets.reduce((sum, t) => sum + (t.status === 'paid' ? t.amount : 0), 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Quản Lý Cổng Thanh Toán & Đối Soát
          </h1>
          <p className="text-sm text-muted-foreground">
            Đối soát trực tiếp dữ liệu giao dịch vé thời gian thực từ Supabase Cloud qua các cổng VNPay, MoMo, ZaloPay, VietQR và Tiền mặt
          </p>
        </div>

        {/* Tab Switchers & IPN Realtime Sync Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoSync(!autoSync)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              autoSync
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-muted text-muted-foreground border-border hover:text-foreground'
            }`}
            title="Tự động đồng bộ biến động doanh thu & giao dịch từ VNPay IPN mỗi 10 giây"
          >
            <span className={`relative flex size-2`}>
              {autoSync && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full size-2 ${autoSync ? 'bg-emerald-600' : 'bg-slate-400'}`}></span>
            </span>
            <span>{autoSync ? 'IPN Live Sync: Bật' : 'IPN Live Sync: Tắt'}</span>
          </button>

          <div className="flex items-center gap-1.5 rounded-2xl bg-muted/60 p-1 border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('transactions')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'transactions'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Giao Dịch Vé ({total})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reconciliation')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'reconciliation'
                  ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TrendingUp size={13} />
              Báo Cáo Đối Soát
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'logs'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <History size={13} />
              Nhật Ký Hoàn Tiền
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Tổng số vé trong hệ thống</p>
          <p className="mt-1 text-2xl font-black text-foreground">{total}</p>
          <span className="text-[11px] text-muted-foreground mt-1 block">Dữ liệu vé thực tế Supabase DB</span>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Doanh thu vé đã thu (Trang này)</p>
          <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {totalAmountInView.toLocaleString('vi-VN')} đ
          </p>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Trạng thái: Đã thanh toán</span>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Cổng trực tuyến hỗ trợ</p>
          <p className="mt-1 text-xl font-bold text-foreground">5 Cổng tích hợp</p>
          <span className="text-[11px] text-blue-600 font-semibold mt-1 block">VNPay · MoMo · ZaloPay · VietQR · Tiền mặt</span>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Bảo vệ giao dịch</p>
          <p className="mt-1 text-xl font-bold text-foreground">HMAC-SHA256</p>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Chữ ký số & Anti-Tamper QR</span>
        </div>
      </div>

      {/* ===================================================================
          TAB 1: DANH SÁCH GIAO DỊCH VÉ THỰC TẾ
          =================================================================== */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Filter size={13} /> Cổng:
                </span>
                <select
                  value={selectedGateway}
                  onChange={(e) => {
                    setSelectedGateway(e.target.value)
                    setPage(1)
                  }}
                  className="h-9 rounded-xl border border-border bg-card px-2.5 text-xs font-semibold text-foreground focus:border-emerald-500 focus:outline-none"
                >
                  <option value="all">Tất cả phương thức</option>
                  <option value="vnpay">VNPay QR</option>
                  <option value="momo">MoMo</option>
                  <option value="zalopay">ZaloPay</option>
                  <option value="vietqr">VietQR</option>
                  <option value="cash">Tiền mặt</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Trạng thái:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value)
                    setPage(1)
                  }}
                  className="h-9 rounded-xl border border-border bg-card px-2.5 text-xs font-semibold text-foreground focus:border-emerald-500 focus:outline-none"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="paid">Đã thanh toán (paid)</option>
                  <option value="reserved">Đang giữ chỗ (reserved)</option>
                  <option value="cancelled">Đã hủy (cancelled)</option>
                  <option value="refunded">Đã hoàn tiền (refunded)</option>
                </select>
              </div>

              <button
                onClick={loadTickets}
                disabled={loadingTickets}
                className="h-9 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-muted/70 disabled:opacity-50"
                title="Tải lại dữ liệu"
              >
                <RefreshCw size={13} className={loadingTickets ? 'animate-spin' : ''} />
                <span>Đồng bộ</span>
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Mã vé, tên khách, SĐT..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-xl border border-border bg-card pl-8 pr-3 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-all shrink-0 cursor-pointer"
                title="Tải file Excel/CSV về máy tính"
              >
                <FileSpreadsheet size={14} />
                <span className="hidden sm:inline">Xuất CSV</span>
              </button>
            </div>
          </div>

          {ticketsError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>{ticketsError}</span>
              </div>
              <button onClick={loadTickets} className="font-semibold underline">
                Thử lại
              </button>
            </div>
          )}

          {/* Table Bảng Giao Dịch */}
          <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-4 pl-6">Mã Vé / Đơn Đặt</th>
                    <th className="p-4">Hành Khách</th>
                    <th className="p-4">Tuyến & Ghế</th>
                    <th className="p-4">Số Tiền</th>
                    <th className="p-4">Phương Thức</th>
                    <th className="p-4">Trạng Thái</th>
                    <th className="p-4 pr-6 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingTickets ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                        <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-emerald-600" />
                        Đang đồng bộ dữ liệu giao dịch từ Supabase Cloud...
                      </td>
                    </tr>
                  ) : tickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                        Không tìm thấy giao dịch nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    tickets.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-4 pl-6 font-mono text-xs font-semibold text-foreground">
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold">{item.ticketCode}</span>
                          <span className="block text-[11px] text-muted-foreground">{item.bookingCode}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString('vi-VN')} {new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="p-4 text-xs">
                          <p className="font-semibold text-foreground flex items-center gap-1">
                            <User size={12} className="text-muted-foreground" />
                            {item.customerName}
                          </p>
                          <p className="text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone size={11} /> {item.phone}
                          </p>
                          {item.email !== 'N/A' && (
                            <p className="text-muted-foreground text-[11px] truncate max-w-[150px]">
                              {item.email}
                            </p>
                          )}
                        </td>
                        <td className="p-4 text-xs">
                          <p className="font-medium text-foreground">{item.route}</p>
                          <span className="inline-block mt-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-mono font-semibold">
                            Ghế: {item.seatNumber}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-xs font-bold text-foreground">
                          {item.amount.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="p-4 text-xs">
                          <span className="rounded-lg bg-accent px-2 py-0.5 font-medium text-foreground uppercase text-[11px]">
                            {item.paymentMethod}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              item.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : item.status === 'refunded'
                                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                : item.status === 'reserved'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                            }`}
                          >
                            {item.status === 'paid'
                              ? 'Đã thanh toán'
                              : item.status === 'refunded'
                              ? 'Đã hoàn tiền'
                              : item.status === 'reserved'
                              ? 'Đang giữ chỗ'
                              : 'Đã hủy'}
                          </span>
                        </td>
                        <td className="p-4 pr-6 text-right">
                          {item.status === 'paid' || item.status === 'reserved' ? (
                            <button
                              type="button"
                              disabled={isRefunding === item.id}
                              onClick={() => handleRefund(item)}
                              className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 cursor-pointer disabled:opacity-50"
                            >
                              {isRefunding === item.id ? 'Đang hoàn...' : 'Hoàn vé'}
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between p-4 border-t border-border bg-card text-xs">
              <span className="text-muted-foreground">
                Hiển thị trang <strong>{page}</strong> trên <strong>{totalPages}</strong> (Tổng cộng {total} vé)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loadingTickets}
                  className="rounded-xl border border-border p-1.5 hover:bg-muted disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loadingTickets}
                  className="rounded-xl border border-border p-1.5 hover:bg-muted disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 2: BÁO CÁO ĐỐI SOÁT DOANH THU ĐA CỔNG
          =================================================================== */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">Bảng Tổng Hợp Đối Soát Doanh Thu Đa Kênh</h3>
              <p className="text-xs text-muted-foreground">Kỳ đối soát: Toàn thời gian · Tự động tổng hợp dữ liệu giao dịch</p>
            </div>
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-all cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              <span>Xuất Báo Cáo Đối Soát</span>
            </button>
          </div>

          <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="p-4 pl-6">Cổng thanh toán</th>
                  <th className="p-4">Tổng lượt GD</th>
                  <th className="p-4">Thành công</th>
                  <th className="p-4">Hủy / Giữ chỗ</th>
                  <th className="p-4">Hoàn tiền</th>
                  <th className="p-4 pr-6 text-right">Doanh thu đối soát</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { gateway: 'vnpay', name: 'Cổng VNPAY-QR (Sandbox)', code: 'vnpay' },
                  { gateway: 'momo', name: 'Ví MoMo Payment Gateway', code: 'momo' },
                  { gateway: 'zalopay', name: 'Ví điện tử ZaloPay', code: 'zalopay' },
                  { gateway: 'vietqr', name: 'VietQR Chuyển khoản Napas 24/7', code: 'vietqr' },
                  { gateway: 'cash', name: 'Tiền mặt tại quầy / Tài xế', code: 'cash' },
                ].map((g) => {
                  const gwSummary = reconciliation?.summaryByGateway?.find(
                    (item: any) => item.gateway === g.code,
                  )
                  const filteredGate = tickets.filter(
                    (t) => t.paymentMethod?.toLowerCase() === g.code,
                  )
                  const totalTxn = gwSummary ? gwSummary.total : filteredGate.length
                  const successCount = gwSummary
                    ? gwSummary.successCount
                    : filteredGate.filter((t) => t.status === 'paid').length
                  const failedCount = gwSummary
                    ? gwSummary.failedCount
                    : filteredGate.filter((t) => t.status === 'cancelled' || t.status === 'reserved').length
                  const refundCount = gwSummary
                    ? gwSummary.refundCount
                    : filteredGate.filter((t) => t.status === 'refunded').length
                  const revenue = gwSummary
                    ? gwSummary.revenue
                    : filteredGate
                        .filter((t) => t.status === 'paid')
                        .reduce((sum, t) => sum + t.amount, 0)

                  return (
                    <tr key={g.gateway} className="hover:bg-muted/20 transition-colors">
                      <td className="p-4 pl-6 font-bold text-xs text-foreground flex items-center gap-2">
                        <Wallet size={15} className="text-emerald-600" />
                        <span>{g.name}</span>
                      </td>
                      <td className="p-4 text-xs font-mono font-bold text-foreground">
                        {totalTxn}
                      </td>
                      <td className="p-4 text-xs font-mono text-emerald-700 font-bold">{successCount}</td>
                      <td className="p-4 text-xs font-mono text-amber-700">{failedCount}</td>
                      <td className="p-4 text-xs font-mono text-rose-700">{refundCount}</td>
                      <td className="p-4 pr-6 text-right font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                        {revenue.toLocaleString('vi-VN')} đ
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 3: NHẬT KÝ HOÀN TIỀN & ĐỐI SOÁT
          =================================================================== */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Nhật Ký Hoàn Tiền & Kiểm Toán (Refund Audit Trail)</h3>
            <p className="text-xs text-muted-foreground">
              Ghi nhận chi tiết biên bản hoàn tiền, cổng thanh toán đối chiếu và thời điểm giải phóng ghế
            </p>
          </div>

          {loadingLogs ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-emerald-600" />
              Đang nạp nhật ký kiểm toán...
            </div>
          ) : refundLogs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center text-xs text-muted-foreground">
              Chưa có biên bản hoàn tiền nào được kích hoạt. Hãy thử bấm &quot;Hoàn vé&quot; ở Tab Giao dịch để tạo bản ghi đối soát thực tế.
            </div>
          ) : (
            <div className="space-y-3">
              {refundLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-2 hover:border-emerald-500/40 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-mono font-bold">
                      <span className="rounded-lg bg-muted px-2 py-0.5 text-foreground">{log.id}</span>
                      <span className="text-emerald-700">{log.refundTransactionId || 'RF-PENDING'}</span>
                      {log.ticketCode && <span className="text-muted-foreground">({log.ticketCode})</span>}
                    </div>
                    <span className="text-muted-foreground text-[11px]">
                      {new Date(log.createdAt).toLocaleString('vi-VN')}
                    </span>
                  </div>

                  <p className="text-xs text-foreground font-medium">{log.reason || 'Hoàn vé theo yêu cầu hành khách'}</p>

                  <div className="flex items-center gap-2 pt-1">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        log.status === 'SUCCESS'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {log.status || 'SUCCESS'}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Cổng:{' '}
                      <strong className="text-foreground uppercase">{log.gateway || 'VNPAY'}</strong> · Số tiền:{' '}
                      <strong className="text-foreground">
                        {Number(log.refundAmount || 0).toLocaleString('vi-VN')}đ
                      </strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
