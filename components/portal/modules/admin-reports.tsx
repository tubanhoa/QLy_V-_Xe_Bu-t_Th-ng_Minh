'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Download,
  FileBarChart2,
  FileSpreadsheet,
  History,
  TrendingUp,
  Users,
  CreditCard,
  Route,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Eye,
  X,
} from 'lucide-react'
import {
  analyticsService,
  type RevenueStatsResponse,
  type OccupancyTripItem,
  type ActivityLogItem,
} from '@/lib/services/analytics.service'

export function AdminReports() {
  const [revenueData, setRevenueData] = useState<RevenueStatsResponse | null>(null)
  const [occupancyData, setOccupancyData] = useState<{
    trips: OccupancyTripItem[]
    overallRate: number
  }>({ trips: [], overallRate: 0 })
  const [auditLogs, setAuditLogs] = useState<ActivityLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null)

  // Bộ lọc
  const [dateRange, setDateRange] = useState<'7d' | '14d' | '30d'>('30d')
  const [searchLog, setSearchLog] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [inspectingLog, setInspectingLog] = useState<ActivityLogItem | null>(null)

  // Nạp dữ liệu thực tế từ Supabase qua backend
  const loadReportsData = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const now = new Date()
      const days = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : 30
      const startDate = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10)
      const endDate = now.toISOString().slice(0, 10)

      const [revRes, occRes, auditRes] = await Promise.all([
        analyticsService.getRevenueStats(startDate, endDate),
        analyticsService.getOccupancyStats(),
        analyticsService.getAuditLogs(),
      ])

      if (revRes.success && revRes.data) {
        setRevenueData(revRes.data)
      } else {
        setErrorMsg(revRes.message || 'Không thể tải báo cáo doanh thu')
      }

      if (occRes.success && occRes.data) {
        setOccupancyData({
          trips: occRes.data,
          overallRate: occRes.overallRate || 0,
        })
      }

      if (auditRes.success && auditRes.data) {
        setAuditLogs(auditRes.data)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối máy chủ báo cáo & kiểm toán')
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    loadReportsData()
  }, [loadReportsData])

  // Lọc danh sách audit logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchSearch =
        searchLog === '' ||
        log.action?.toLowerCase().includes(searchLog.toLowerCase()) ||
        log.resourceName?.toLowerCase().includes(searchLog.toLowerCase()) ||
        log.user?.fullName?.toLowerCase().includes(searchLog.toLowerCase()) ||
        log.ipAddress?.includes(searchLog)
      const matchAction = actionFilter === 'all' || log.action === actionFilter
      return matchSearch && matchAction
    })
  }, [auditLogs, searchLog, actionFilter])

  // Danh sách các action duy nhất cho bộ lọc
  const uniqueActions = useMemo(() => {
    const set = new Set<string>()
    auditLogs.forEach((l) => {
      if (l.action) set.add(l.action)
    })
    return Array.from(set)
  }, [auditLogs])

  // Xuất file CSV / Excel thực tế chuẩn UTF-8 BOM
  const handleExportCSV = () => {
    try {
      const bom = '\uFEFF'
      let csv = `${bom}BÁO CÁO DOANH THU & NHẬT KÝ KIỂM TOÁN - ICTU SMART BUS TRANSIT\n`
      csv += `Thời gian xuất:,"${new Date().toLocaleString('vi-VN')}"\n`
      csv += `Khoảng thời gian:,"${dateRange === '7d' ? '7 ngày qua' : dateRange === '14d' ? '14 ngày qua' : '30 ngày qua'}"\n\n`

      // 1. Tổng quan KPI
      csv += `--- I. TỔNG QUAN TÀI CHÍNH & VẬN HÀNH ---\n`
      csv += `Chỉ số,Giá trị\n`
      csv += `Tổng doanh thu vé thực nhận,${revenueData?.totalRevenue || 0} đ\n`
      csv += `Tổng tiền trợ giá / khuyến mại HSSV,${revenueData?.totalDiscount || 0} đ\n`
      csv += `Tổng số vé / booking đã thanh toán,${revenueData?.totalPaidBookings || 0}\n`
      csv += `Tỷ lệ lấp đầy bình quân,${occupancyData.overallRate || 0}%\n\n`

      // 2. Theo tuyến
      csv += `--- II. DOANH THU THEO TUYẾN XE ---\n`
      csv += `Mã tuyến,Tên tuyến,Doanh thu (VNĐ),Số vé bán ra\n`
      revenueData?.revenueByRoute?.forEach((r) => {
        csv += `"${r.routeCode}","${r.name}",${r.revenue},${r.ticketCount}\n`
      })
      csv += `\n`

      // 3. Theo kênh thanh toán
      csv += `--- III. CƠ CẤU THEO KÊNH THANH TOÁN ---\n`
      csv += `Cổng / Kênh thanh toán,Số tiền (VNĐ),Tỷ trọng (%)\n`
      revenueData?.revenueByChannel?.forEach((c) => {
        csv += `"${c.channel}","${c.amount}",${c.share}%\n`
      })
      csv += `\n`

      // 4. Nhật ký kiểm toán
      csv += `--- IV. NHẬT KÝ KIỂM TOÁN HỆ THỐNG (AUDIT TRAIL) ---\n`
      csv += `Mã Log,Hành động,Người thực hiện,Email,Tài nguyên,Địa chỉ IP,Thời điểm\n`
      auditLogs.forEach((l) => {
        csv += `"${l.id}","${l.action}","${l.user?.fullName || 'Hệ thống'}","${l.user?.email || 'N/A'}","${l.resourceName} (${l.resourceId || ''})","${l.ipAddress || '127.0.0.1'}","${new Date(l.timestamp).toLocaleString('vi-VN')}"\n`
      })

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ICTU_Transit_BaoCao_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setDownloadSuccess('Đã xuất thành công tệp báo cáo Excel / CSV!')
      setTimeout(() => setDownloadSuccess(null), 4000)
    } catch (err: any) {
      alert(`Lỗi xuất tệp: ${err.message}`)
    }
  }

  const formatVnd = (num?: number) => {
    return (num || 0).toLocaleString('vi-VN') + ' đ'
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Date Range Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileBarChart2 className="size-6 text-[#00A86B]" />
            Báo Cáo Thống Kê & Nhật Ký Kiểm Toán (Audit Trail)
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Dữ liệu tài chính hợp nhất thời gian thực từ Supabase Cloud, tỷ lệ phụ tải tuyến và lưu vết hệ thống
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Chips */}
          <div className="flex rounded-xl border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setDateRange('7d')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                dateRange === '7d'
                  ? 'bg-[#00A86B] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              7 ngày qua
            </button>
            <button
              type="button"
              onClick={() => setDateRange('14d')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                dateRange === '14d'
                  ? 'bg-[#00A86B] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              14 ngày qua
            </button>
            <button
              type="button"
              onClick={() => setDateRange('30d')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                dateRange === '30d'
                  ? 'bg-[#00A86B] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              30 ngày qua
            </button>
          </div>

          <button
            type="button"
            onClick={loadReportsData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 rounded-xl bg-[#00A86B] px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <Download className="size-4" /> Xuất Báo Cáo Excel / CSV
          </button>
        </div>
      </div>

      {downloadSuccess && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs sm:text-sm font-semibold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
          <FileSpreadsheet className="size-5 text-emerald-500" />
          <span>{downloadSuccess}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="size-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Analytics KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <TrendingUp className="size-4 text-emerald-500" /> Doanh thu thực nhận
          </span>
          <p className="mt-2 text-3xl font-bold font-mono text-foreground">
            {formatVnd(revenueData?.totalRevenue)}
          </p>
          <span className="mt-2 inline-block text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            ↑ Đã đối soát {revenueData?.totalPaidBookings || 0} vé
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <Users className="size-4 text-blue-500" /> Lượt khách phục vụ
          </span>
          <p className="mt-2 text-3xl font-bold font-mono text-foreground">
            {revenueData?.totalPaidBookings || 0} lượt
          </p>
          <span className="mt-2 inline-block text-xs font-semibold text-blue-600 dark:text-blue-400">
            100% giao dịch mã QR
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <CreditCard className="size-4 text-amber-500" /> Trợ giá sinh viên ICTU
          </span>
          <p className="mt-2 text-3xl font-bold font-mono text-foreground">
            {formatVnd(revenueData?.totalDiscount)}
          </p>
          <span className="mt-2 inline-block text-xs font-semibold text-amber-600 dark:text-amber-400">
            Hỗ trợ 50% giá vé HSSV
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <FileBarChart2 className="size-4 text-purple-500" /> Tỷ lệ lấp đầy bình quân
          </span>
          <p className="mt-2 text-3xl font-bold font-mono text-foreground">
            {occupancyData.overallRate ?? 0}%
          </p>
          <span className="mt-2 inline-block text-xs font-semibold text-purple-600 dark:text-purple-400">
            {occupancyData.trips?.length > 0 ? `${occupancyData.trips.length} chuyến khai thác` : 'Chưa có chuyến ghi nhận'}
          </span>
        </div>
      </div>

      {/* Visual Analytics Grid: Revenue by Route & Channel Share */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Doanh thu theo tuyến xe (Left 7 cols) */}
        <div className="lg:col-span-7 rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Route className="size-4 text-[#00A86B]" />
                Phân tích Doanh thu theo Tuyến đường
              </h3>
              <span className="text-xs font-semibold text-muted-foreground">
                {revenueData?.revenueByRoute?.length || 0} tuyến khai thác
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {revenueData?.revenueByRoute?.map((r) => {
                const total = revenueData.totalRevenue || 1
                const pct = Math.round((r.revenue / total) * 100)
                return (
                  <div
                    key={r.routeCode}
                    className="p-4 rounded-2xl border border-border bg-accent/20 hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          {r.routeCode}
                        </span>
                        <h4 className="font-semibold text-sm text-foreground line-clamp-1">
                          {r.name}
                        </h4>
                      </div>
                      <span className="font-mono text-sm font-bold text-foreground">
                        {formatVnd(r.revenue)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{r.ticketCount} lượt vé bán</span>
                      <span className="font-semibold text-foreground">{pct}% tổng sản lượng</span>
                    </div>

                    <div className="mt-2 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-[#00A86B] rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Cập nhật trực tiếp từ bảng dữ liệu bán vé</span>
            <span className="font-semibold text-[#00A86B]">{revenueData?.revenueByRoute?.length ? 'Dữ liệu vận hành theo tuyến' : 'Chưa có giao dịch theo tuyến'}</span>
          </div>
        </div>

        {/* Cơ cấu Cổng thanh toán (Right 5 cols) */}
        <div className="lg:col-span-5 rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <CreditCard className="size-4 text-cyan-500" />
                Cơ cấu Cổng Thanh toán Điện tử
              </h3>
              <span className="text-xs text-muted-foreground">Tỷ trọng</span>
            </div>

            <div className="mt-5 space-y-3.5">
              {revenueData?.revenueByChannel?.map((ch) => (
                <div key={ch.channel} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{ch.channel}</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-muted-foreground">{ch.amount}</span>
                      <span className="font-bold text-foreground">({ch.share}%)</span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full transition-all duration-700"
                      style={{ width: `${ch.share}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {(() => {
            const channels = revenueData?.revenueByChannel || []
            const cashlessShare = channels
              .filter((c) => !c.channel.toLowerCase().includes('tiền mặt'))
              .reduce((sum, c) => sum + (c.share || 0), 0)
            return (
              <div className="mt-6 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 p-3.5 text-xs text-cyan-900 dark:text-cyan-200">
                <span className="font-bold block mb-0.5">
                  Thanh toán không tiền mặt: {channels.length > 0 ? `${cashlessShare}%` : 'Chưa có giao dịch'}
                </span>
                <span>Tối ưu hóa thời gian đón trả khách, giảm độ trễ tại trạm qua cổng thanh toán số.</span>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Audit Trail Section */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="border-b border-border bg-muted/40 p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-500" />
              Nhật ký Lưu vết Thao tác & Kiểm toán Hệ thống (Audit Trail)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Toàn bộ thay đổi cấu hình, phân lịch điều xe, duyệt vé tháng và hoàn tiền được ghi vết bất biến
            </p>
          </div>

          {/* Filters for Audit Table */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchLog}
                onChange={(e) => setSearchLog(e.target.value)}
                placeholder="Tìm mã log, thao tác, IP..."
                className="h-9 w-48 sm:w-60 rounded-xl border border-border bg-card pl-8 pr-3 text-xs text-foreground focus:outline-none focus:border-emerald-500"
              />
            </div>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-9 rounded-xl border border-border bg-card px-3 text-xs text-foreground focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Tất cả hành động ({auditLogs.length})</option>
              {uniqueActions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/20 text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="p-4 pl-6">Mã Log</th>
                <th className="p-4">Hành động</th>
                <th className="p-4">Người thực hiện</th>
                <th className="p-4">Tài nguyên</th>
                <th className="p-4">Địa chỉ IP</th>
                <th className="p-4">Thời điểm</th>
                <th className="p-4 pr-6 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                    Không tìm thấy nhật ký kiểm toán phù hợp.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-muted/30 transition-colors text-xs cursor-pointer"
                    onClick={() => setInspectingLog(log)}
                  >
                    <td className="p-4 pl-6 font-mono font-bold text-muted-foreground">
                      {log.id.slice(0, 8)}...
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center rounded-lg bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-foreground">
                        {log.user?.fullName || 'Hệ thống tự động'}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {log.user?.email || 'system@smartbus.ictu.vn'}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-muted-foreground">
                      <span className="font-semibold text-foreground">{log.resourceName}</span>
                      {log.resourceId && (
                        <span className="text-[10px] ml-1 text-muted-foreground">
                          ({log.resourceId.slice(0, 10)})
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-muted-foreground">{log.ipAddress || '127.0.0.1'}</td>
                    <td className="p-4 text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('vi-VN')}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setInspectingLog(log)
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-accent"
                      >
                        <Eye className="size-3" /> Xem
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal chi tiết Audit Log */}
      {inspectingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Chi tiết Nhật ký Thao tác
                </h3>
                <span className="font-mono text-xs text-muted-foreground">
                  ID: {inspectingLog.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-muted/40 border border-border">
                <div>
                  <span className="text-muted-foreground">Hành động:</span>
                  <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {inspectingLog.action}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tài nguyên:</span>
                  <p className="font-mono font-bold text-foreground mt-0.5">
                    {inspectingLog.resourceName}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Người thực hiện:</span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {inspectingLog.user?.fullName || 'Hệ thống'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Địa chỉ IP:</span>
                  <p className="font-mono text-foreground mt-0.5">
                    {inspectingLog.ipAddress || '127.0.0.1'}
                  </p>
                </div>
              </div>

              <div>
                <span className="font-semibold text-foreground block mb-1">
                  Dữ liệu thay đổi (Changes Payload):
                </span>
                <pre className="max-h-48 overflow-y-auto rounded-xl border border-border bg-slate-950 p-3 text-[11px] font-mono text-emerald-400">
                  {JSON.stringify(inspectingLog.changes, null, 2) || '{}'}
                </pre>
              </div>

              <div>
                <span className="text-muted-foreground">User Agent:</span>
                <p className="text-[11px] font-mono text-muted-foreground break-all mt-0.5">
                  {inspectingLog.userAgent || 'Chrome/129.0.0.0'}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="rounded-xl bg-[#00A86B] px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
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
