'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Download,
  FileBarChart2,
  FileSpreadsheet,
  TrendingUp,
  Users,
  CreditCard,
  Route,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Eye,
  X,
  Bus,
  Coins,
  SlidersHorizontal,
  BarChart3,
  LineChart,
  PieChart,
  Percent,
  CheckCircle2,
  RotateCcw,
  Layers,
  Printer,
  Target,
  FileText,
  CheckCheck,
  Flag,
} from 'lucide-react'
import {
  analyticsService,
  type RevenueStatsResponse,
  type RevenueReportQueryParams,
  type RevenueTimelineItem,
  type RevenueRouteItem,
  type RevenueChannelItem,
  type RevenueTripItem,
  type OccupancyTripItem,
  type ActivityLogItem,
} from '@/lib/services/analytics.service'
import { transitService } from '@/lib/services/transit.service'
import type { TransitRoute } from '@/lib/types/transit'

// Định dạng tiền tệ VNĐ chuẩn xác
function formatVnd(num?: number | null): string {
  if (num === undefined || num === null || isNaN(num)) return '0 đ'
  return num.toLocaleString('vi-VN') + ' đ'
}

// Bảng màu phân bổ tuyến xe sang trọng cho biểu đồ
const ROUTE_PALETTE = [
  { stroke: '#10B981', fill: '#10B981', bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500/20' }, // Emerald
  { stroke: '#3B82F6', fill: '#3B82F6', bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500/20' }, // Blue
  { stroke: '#8B5CF6', fill: '#8B5CF6', bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500/20' }, // Purple
  { stroke: '#F59E0B', fill: '#F59E0B', bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500/20' }, // Amber
  { stroke: '#06B6D4', fill: '#06B6D4', bg: 'bg-cyan-500', text: 'text-cyan-500', border: 'border-cyan-500/20' }, // Cyan
  { stroke: '#EC4899', fill: '#EC4899', bg: 'bg-pink-500', text: 'text-pink-500', border: 'border-pink-500/20' }, // Pink
  { stroke: '#6366F1', fill: '#6366F1', bg: 'bg-indigo-500', text: 'text-indigo-500', border: 'border-indigo-500/20' }, // Indigo
  { stroke: '#14B8A6', fill: '#14B8A6', bg: 'bg-teal-500', text: 'text-teal-500', border: 'border-teal-500/20' }, // Teal
]

export function AdminReports() {
  // Dữ liệu API
  const [revenueData, setRevenueData] = useState<RevenueStatsResponse | null>(null)
  const [occupancyData, setOccupancyData] = useState<{
    trips: OccupancyTripItem[]
    overallRate: number
  }>({ trips: [], overallRate: 0 })
  const [auditLogs, setAuditLogs] = useState<ActivityLogItem[]>([])
  const [routesList, setRoutesList] = useState<TransitRoute[]>([])

  // Trạng thái tải & thông báo
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null)

  // Bộ lọc tương tác đa chiều
  const [datePreset, setDatePreset] = useState<'7d' | '30d' | 'month' | 'quarter' | 'custom'>('30d')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [groupBy, setGroupBy] = useState<'day' | 'month' | 'year'>('day')
  const [selectedRouteId, setSelectedRouteId] = useState<string>('')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false)

  // Kiểu biểu đồ xu hướng (Cột vs Đường)
  const [chartMode, setChartMode] = useState<'bar' | 'line'>('bar')

  // ĐỀ XUẤT 1: ĐƯỜNG MỤC TIÊU KPI DOANH THU (BENCHMARK THRESHOLD LINE)
  const [showTargetLine, setShowTargetLine] = useState<boolean>(true)
  const [targetRevenue, setTargetRevenue] = useState<number>(30000)
  const [showTargetConfig, setShowTargetConfig] = useState<boolean>(false)

  // ĐỀ XUẤT 2: MODAL XEM TRƯỚC IN ẤN / XUẤT PDF KHỔ A4 (PRINT PREVIEW)
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false)

  // Trạng thái hover trên biểu đồ xu hướng & biểu đồ tròn
  const [hoveredTimelineIndex, setHoveredTimelineIndex] = useState<number | null>(null)
  const [hoveredRouteIndex, setHoveredRouteIndex] = useState<number | null>(null)

  // Tab bảng kê chi tiết (Timeline hay Trips)
  const [detailTab, setDetailTab] = useState<'timeline' | 'trips'>('timeline')

  // Bộ lọc Audit Log
  const [searchLog, setSearchLog] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [inspectingLog, setInspectingLog] = useState<ActivityLogItem | null>(null)

  // Khởi tạo ngày mặc định theo Preset
  const applyPreset = useCallback((preset: '7d' | '30d' | 'month' | 'quarter' | 'custom') => {
    setDatePreset(preset)
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    if (preset === '7d') {
      const past = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
      setStartDate(past)
      setEndDate(todayStr)
      setGroupBy('day')
      setTargetRevenue(30000)
    } else if (preset === '30d') {
      const past = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
      setStartDate(past)
      setEndDate(todayStr)
      setGroupBy('day')
      setTargetRevenue(30000)
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      setStartDate(firstDay)
      setEndDate(todayStr)
      setGroupBy('day')
      setTargetRevenue(30000)
    } else if (preset === 'quarter') {
      const past = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10)
      setStartDate(past)
      setEndDate(todayStr)
      setGroupBy('month')
      setTargetRevenue(100000)
    }
  }, [])

  // Nạp danh sách Tuyến đường một lần
  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const res = await transitService.getRoutes()
        if (res.success && res.data) {
          setRoutesList(res.data)
        }
      } catch (err) {
        console.error('Không thể nạp danh sách tuyến cho bộ lọc:', err)
      }
    }
    fetchRoutes()
    applyPreset('30d')
  }, [applyPreset])

  // Nạp dữ liệu báo cáo từ Backend qua SQL Aggregation
  const loadReportsData = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const queryParams: RevenueReportQueryParams = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        groupBy: groupBy,
        routeId: selectedRouteId || undefined,
        paymentMethod: selectedPaymentMethod || undefined,
      }

      const [revRes, occRes, auditRes] = await Promise.all([
        analyticsService.getRevenueStats(queryParams),
        analyticsService.getOccupancyStats(),
        analyticsService.getAuditLogs(),
      ])

      if (revRes.success && revRes.data) {
        setRevenueData(revRes.data)
      } else {
        setErrorMsg(revRes.message || 'Không thể tải báo cáo doanh thu tài chính')
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
      setErrorMsg(err.message || 'Lỗi kết nối máy chủ phân tích tài chính & báo cáo')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, groupBy, selectedRouteId, selectedPaymentMethod])

  useEffect(() => {
    if (startDate && endDate) {
      loadReportsData()
    }
  }, [startDate, endDate, groupBy, selectedRouteId, selectedPaymentMethod, loadReportsData])

  // Đặt lại bộ lọc về mặc định
  const handleResetFilters = () => {
    setSelectedRouteId('')
    setSelectedPaymentMethod('')
    applyPreset('30d')
  }

  // Lọc Audit Logs
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

  // Danh sách actions cho bộ lọc audit
  const uniqueActions = useMemo(() => {
    const set = new Set<string>()
    auditLogs.forEach((l) => {
      if (l.action) set.add(l.action)
    })
    return Array.from(set)
  }, [auditLogs])

  // Tính toán KPIs tổng quan
  const kpiStats = useMemo(() => {
    const summary = revenueData?.summary
    const totalRev = summary?.totalRevenue ?? revenueData?.totalRevenue ?? 0
    const totalDis = summary?.totalDiscount ?? revenueData?.totalDiscount ?? 0
    const netRev = Math.max(0, totalRev - totalDis)
    const paidBookings = summary?.totalPaidBookings ?? revenueData?.totalPaidBookings ?? 0
    const ticketsSold = summary?.totalTicketsSold ?? paidBookings ?? 0
    const aov = summary?.averageOrderValue ?? (paidBookings > 0 ? Math.round(totalRev / paidBookings) : 0)

    // Doanh thu trung bình trên mỗi chuyến xe chạy
    const trips = revenueData?.trips || []
    const totalTripCount = trips.length > 0 ? trips.length : (occupancyData.trips?.length || 1)
    const avgRevenuePerTrip = trips.length > 0
      ? Math.round(totalRev / trips.length)
      : Math.round(totalRev / Math.max(1, occupancyData.trips?.length || 1))

    return {
      totalRev,
      totalDis,
      netRev,
      paidBookings,
      ticketsSold,
      aov,
      avgRevenuePerTrip,
      totalTrips: totalTripCount,
      occupancyRate: occupancyData.overallRate || 0,
    }
  }, [revenueData, occupancyData])

  // Dữ liệu chuỗi thời gian cho Biểu đồ Xu hướng
  const timelineData: RevenueTimelineItem[] = useMemo(() => {
    if (revenueData?.timeline && revenueData.timeline.length > 0) {
      return revenueData.timeline
    }
    // Fallback nếu dùng signature cũ
    if (revenueData?.revenueByDate && revenueData.revenueByDate.length > 0) {
      return revenueData.revenueByDate.map((item) => ({
        period: item.date,
        revenue: item.revenue,
        bookingCount: 1,
        ticketCount: 1,
      }))
    }
    return []
  }, [revenueData])

  // Cực đại doanh thu trong chuỗi thời gian (có tính cả mức mục tiêu)
  const maxTimelineRevenue = useMemo(() => {
    const maxVal = timelineData.length > 0 ? Math.max(...timelineData.map((t) => t.revenue)) : 100000
    const ceiling = showTargetLine ? Math.max(maxVal, targetRevenue) : maxVal
    return ceiling > 0 ? ceiling * 1.15 : 100000
  }, [timelineData, showTargetLine, targetRevenue])

  // Thống kê số kỳ đạt mục tiêu KPI
  const targetStats = useMemo(() => {
    if (timelineData.length === 0) return { achievedCount: 0, total: 0, percentage: 0 }
    const achieved = timelineData.filter((t) => t.revenue >= targetRevenue).length
    const pct = Math.round((achieved / timelineData.length) * 100)
    return {
      achievedCount: achieved,
      total: timelineData.length,
      percentage: pct,
    }
  }, [timelineData, targetRevenue])

  // Tuyến có doanh thu cao nhất
  const topRoute = useMemo(() => {
    if (!revenueData?.revenueByRoute || revenueData.revenueByRoute.length === 0) return null
    return [...revenueData.revenueByRoute].sort((a, b) => b.revenue - a.revenue)[0]
  }, [revenueData])

  // Tên tuyến đang chọn trong dropdown
  const currentSelectedRouteName = useMemo(() => {
    if (!selectedRouteId) return 'Tất cả các tuyến'
    const found = routesList.find((r) => r.id === selectedRouteId)
    return found ? `[${found.routeCode}] ${found.name}` : selectedRouteId
  }, [selectedRouteId, routesList])

  // Xuất file CSV / Excel chuẩn UTF-8 BOM
  const handleExportCSV = () => {
    try {
      const bom = '\uFEFF'
      let csv = `${bom}BÁO CÁO DOANH THU & HIỆU QUẢ TÀI CHÍNH - SMART BUS ICTU\n`
      csv += `Thời gian xuất báo cáo:,"${new Date().toLocaleString('vi-VN')}"\n`
      csv += `Khoảng thời gian:,"${startDate} đến ${endDate} (${groupBy === 'day' ? 'Theo ngày' : groupBy === 'month' ? 'Theo tháng' : 'Theo năm'})"\n`
      if (selectedRouteId) {
        csv += `Lọc theo tuyến:,"${currentSelectedRouteName}"\n`
      }
      if (selectedPaymentMethod) {
        csv += `Lọc theo kênh thanh toán:,"${selectedPaymentMethod.toUpperCase()}"\n`
      }
      csv += `\n`

      // 1. TỔNG QUAN TÀI CHÍNH
      csv += `--- I. TỔNG QUAN TÀI CHÍNH & VẬN HÀNH ---\n`
      csv += `Chỉ số,Giá trị,Ghi chú\n`
      csv += `Tổng doanh thu thực nhận,${kpiStats.totalRev} đ,Đã thanh toán thành công\n`
      csv += `Tổng trợ giá & Voucher HSSV,${kpiStats.totalDis} đ,Hỗ trợ giá vé cho hành khách\n`
      csv += `Doanh thu thuần (Net),${kpiStats.netRev} đ,Doanh thu thực thu sau trừ trợ giá\n`
      csv += `Tổng số vé xuất,${kpiStats.ticketsSold} vé,Lượt khách được phục vụ\n`
      csv += `Số lượt đặt vé (Bookings),${kpiStats.paidBookings} lượt,Giao dịch thanh toán thành công\n`
      csv += `Giá trị đơn hàng trung bình (AOV),${kpiStats.aov} đ/đơn,Mức chi tiêu trung bình/khách\n`
      csv += `Doanh thu trung bình/chuyến,${kpiStats.avgRevenuePerTrip} đ/chuyến,Hiệu suất khai thác theo chuyến\n`
      csv += `Tỷ lệ lấp đầy bình quân,${kpiStats.occupancyRate}%,Hệ số khách/ghế toàn mạng lưới\n\n`

      // 2. DOANH THU THEO THỜI GIAN
      csv += `--- II. DIỄN BIẾN DOANH THU THEO THỜI GIAN ---\n`
      csv += `Thời kỳ (Kỳ),Doanh thu (VNĐ),Số vé bán ra,Số lượt đặt vé,Đạt mục tiêu (${formatVnd(targetRevenue)})\n`
      timelineData.forEach((t) => {
        csv += `"${t.period}",${t.revenue},${t.ticketCount},${t.bookingCount},"${t.revenue >= targetRevenue ? 'ĐẠT' : 'CHƯA ĐẠT'}"\n`
      })
      csv += `\n`

      // 3. THEO TUYẾN
      csv += `--- III. DOANH THU THEO TUYẾN ĐƯỜNG ---\n`
      csv += `Mã tuyến,Tên tuyến xe buýt,Doanh thu (VNĐ),Số vé bán ra,Tỷ trọng (%)\n`
      revenueData?.revenueByRoute?.forEach((r) => {
        csv += `"${r.routeCode}","${r.name}",${r.revenue},${r.ticketCount},${r.share ?? 0}%\n`
      })
      csv += `\n`

      // 4. THEO KÊNH THANH TOÁN
      csv += `--- IV. CƠ CẤU CỔNG THANH TOÁN ---\n`
      csv += `Cổng thanh toán,Số tiền (VNĐ),Số giao dịch,Tỷ trọng (%)\n`
      revenueData?.revenueByChannel?.forEach((c) => {
        csv += `"${c.channel}",${c.rawAmount || c.amount},${c.bookingCount || 0},${c.share}%\n`
      })
      csv += `\n`

      // 5. THEO CHUYẾN XE
      if (revenueData?.trips && revenueData.trips.length > 0) {
        csv += `--- V. BẢNG KÊ CHI TIẾT TỪNG CHUYẾN XE ---\n`
        csv += `Mã chuyến,Giờ khởi hành,Tuyến,Biển số xe,Số vé bán,Doanh thu (VNĐ),Tỷ lệ lấp đầy (%)\n`
        revenueData.trips.forEach((tr) => {
          csv += `"${tr.tripId}","${new Date(tr.departureTime).toLocaleString('vi-VN')}","${tr.routeCode || ''}","${tr.vehiclePlate}",${tr.ticketCount},${tr.revenue},${tr.occupancyRate ?? 0}%\n`
        })
        csv += `\n`
      }

      // 6. AUDIT TRAIL
      csv += `--- VI. NHẬT KÝ KIỂM TOÁN HỆ THỐNG (AUDIT TRAIL) ---\n`
      csv += `Mã Log,Hành động,Người thực hiện,Email,Tài nguyên,Địa chỉ IP,Thời điểm\n`
      auditLogs.forEach((l) => {
        csv += `"${l.id}","${l.action}","${l.user?.fullName || 'Hệ thống'}","${l.user?.email || 'N/A'}","${l.resourceName} (${l.resourceId || ''})","${l.ipAddress || '127.0.0.1'}","${new Date(l.timestamp).toLocaleString('vi-VN')}"\n`
      })

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `BaoCaoDoanhThu_ICTU_${startDate}_den_${endDate}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setDownloadSuccess('Đã xuất thành công tệp báo cáo tài chính Excel / CSV (UTF-8 BOM)!')
      setTimeout(() => setDownloadSuccess(null), 4000)
    } catch (err: any) {
      alert(`Lỗi xuất tệp: ${err.message}`)
    }
  }

  // Kích hoạt In ấn trang chuẩn
  const handleTriggerPrint = () => {
    window.print()
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* =========================================================================
          1. HEADER & BỘ LỌC TỔNG THỂ
      ========================================================================= */}
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <FileBarChart2 className="size-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  Báo Cáo Doanh Thu & Hiệu Quả Tài Chính
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    SQL Aggregation v2
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Phân tích dòng tiền bán vé, hiệu suất khai thác tuyến và theo dõi tài chính thời gian thực
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadReportsData}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors disabled:opacity-60 cursor-pointer"
              title="Làm mới dữ liệu từ CSDL"
            >
              <RefreshCw className={`size-3.5 text-emerald-600 dark:text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Đang tải...' : 'Làm mới'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                showAdvancedFilters || selectedRouteId || selectedPaymentMethod
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-border bg-card text-foreground hover:bg-accent'
              }`}
            >
              <SlidersHorizontal className="size-3.5" />
              <span>Bộ lọc nâng cao</span>
              {(selectedRouteId || selectedPaymentMethod) && (
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>

            {/* NÚT IN BÁO CÁO / XEM TRƯỚC KHỔ A4 */}
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm font-semibold text-foreground hover:bg-accent active:scale-95 transition-all cursor-pointer shadow-sm"
              title="Xem trước mẫu in A4 & Xuất PDF"
            >
              <Printer className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>In Báo Cáo (A4 / PDF)</span>
            </button>

            {/* NÚT XUẤT CSV / EXCEL */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700 active:scale-95 transition-all cursor-pointer"
            >
              <Download className="size-4" />
              <span>Xuất Excel / CSV</span>
            </button>
          </div>
        </div>

        {/* Thanh điều khiển thời gian & Quick Presets */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground mr-1 flex items-center gap-1">
              <Calendar className="size-3.5" /> Khoảng thời gian:
            </span>
            <div className="flex rounded-xl border border-border bg-muted/40 p-1">
              {(
                [
                  { id: '7d', label: '7 ngày qua' },
                  { id: '30d', label: '30 ngày qua' },
                  { id: 'month', label: 'Tháng này' },
                  { id: 'quarter', label: 'Quý này (3 tháng)' },
                  { id: 'custom', label: 'Tùy chọn' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    datePreset === preset.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Gom nhóm chuỗi thời gian (groupBy) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Layers className="size-3.5" /> Nhóm theo:
            </span>
            <div className="flex rounded-xl border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setGroupBy('day')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  groupBy === 'day' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Theo Ngày
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('month')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  groupBy === 'month' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Theo Tháng
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('year')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  groupBy === 'year' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Theo Năm
              </button>
            </div>
          </div>
        </div>

        {/* Thanh bộ lọc nâng cao (Expandable Filter Strip) */}
        {(showAdvancedFilters || datePreset === 'custom') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-dashed border-border animate-in slide-in-from-top-2 duration-200">
            {/* Từ ngày */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Từ ngày (Bắt đầu):</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setDatePreset('custom')
                }}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Đến ngày */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Đến ngày (Kết thúc):</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setDatePreset('custom')
                }}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Lọc theo Tuyến đường */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tuyến xe khai thác:</label>
              <select
                value={selectedRouteId}
                onChange={(e) => setSelectedRouteId(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="">Tất cả các tuyến xe ({routesList.length} tuyến)</option>
                {routesList.map((r) => (
                  <option key={r.id} value={r.id}>
                    [{r.routeCode}] {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Lọc theo Phương thức thanh toán */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Cổng thanh toán:</label>
              <div className="flex gap-2">
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="">Tất cả cổng thanh toán</option>
                  <option value="vnpay">Ví điện tử VNPAY</option>
                  <option value="momo">Ví điện tử MoMo</option>
                  <option value="vietqr">Mã VietQR Pro</option>
                  <option value="cash">Tiền mặt tại trạm xe</option>
                </select>

                {(selectedRouteId || selectedPaymentMethod || datePreset !== '30d') && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="flex shrink-0 items-center gap-1 rounded-xl border border-border bg-muted/60 px-2.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Đặt lại bộ lọc mặc định"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Thông báo thông tin & lỗi */}
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

      {/* =========================================================================
          2. CARDS KPI TỔNG QUAN (4 CARDS CAO CẤP)
      ========================================================================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Tổng doanh thu */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-emerald-500/5 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <TrendingUp className="size-4 text-emerald-500" /> Tổng doanh thu bán vé
            </span>
            <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              Net: {formatVnd(kpiStats.netRev)}
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-extrabold font-mono text-foreground tracking-tight">
            {formatVnd(kpiStats.totalRev)}
          </p>
          <div className="mt-2.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Trợ giá / Voucher:</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">
              -{formatVnd(kpiStats.totalDis)}
            </span>
          </div>
        </div>

        {/* Card 2: Lượt vé bán ra */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-blue-500/5 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <Users className="size-4 text-blue-500" /> Sản lượng vé bán ra
            </span>
            <span className="rounded-lg bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 font-mono">
              {kpiStats.paidBookings} đơn
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-extrabold font-mono text-foreground tracking-tight">
            {kpiStats.ticketsSold} <span className="text-base font-medium text-muted-foreground">vé</span>
          </p>
          <div className="mt-2.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Tỷ lệ hủy / hoàn:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
              0.0% (Ổn định)
            </span>
          </div>
        </div>

        {/* Card 3: Doanh thu trung bình/chuyến & Đơn hàng (AOV) */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-purple-500/5 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <Coins className="size-4 text-purple-500" /> Doanh thu TB / Chuyến xe
            </span>
            <span className="rounded-lg bg-purple-500/10 px-2 py-0.5 text-[11px] font-bold text-purple-600 dark:text-purple-400 font-mono">
              AOV: {formatVnd(kpiStats.aov)}
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-extrabold font-mono text-foreground tracking-tight">
            {formatVnd(kpiStats.avgRevenuePerTrip)}
          </p>
          <div className="mt-2.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Số chuyến khai thác:</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400 font-mono">
              {kpiStats.totalTrips} chuyến
            </span>
          </div>
        </div>

        {/* Card 4: Tỷ lệ lấp đầy ghế bình quân */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-amber-500/5 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <Percent className="size-4 text-amber-500" /> Hệ số lấp đầy bình quân
            </span>
            <span className="rounded-lg bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 font-mono">
              Phụ tải
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-extrabold font-mono text-foreground tracking-tight">
            {kpiStats.occupancyRate}%
          </p>
          <div className="mt-2.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Tuyến dẫn đầu:</span>
            <span className="font-semibold text-foreground truncate max-w-[140px]" title={topRoute?.name}>
              {topRoute?.routeCode || 'Đang cập nhật'}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. HỆ THỐNG BIỂU ĐỒ TƯƠNG TÁC (CHARTS GRID)
      ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* =====================================================================
            BIỂU ĐỒ 1: THEO DÕI DOANH THU THEO NGÀY / THÁNG (LEFT 8 COLS)
            (TÍCH HỢP ĐƯỜNG MỤC TIÊU KPI / THRESHOLD LINE)
        ===================================================================== */}
        <div className="lg:col-span-8 rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <BarChart3 className="size-4 text-emerald-500" />
                  Diễn Biến Doanh Thu Theo {groupBy === 'day' ? 'Ngày' : groupBy === 'month' ? 'Tháng' : 'Năm'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Biểu đồ trực quan hóa doanh thu, so sánh mục tiêu KPI và biến động sản lượng vé
                </p>
              </div>

              {/* Điều khiển: Bật/Tắt Đường mục tiêu & Chuyển đổi Cột vs Đường */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Nút bật/tắt & Cấu hình Đường mục tiêu KPI */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTargetConfig(!showTargetConfig)}
                    className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      showTargetLine
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground'
                    }`}
                    title="Bật/Tắt & Điều chỉnh mức mục tiêu KPI"
                  >
                    <Target className="size-3.5" />
                    <span>Mục tiêu: {formatVnd(targetRevenue)}</span>
                  </button>

                  {/* Popover điều chỉnh mức mục tiêu */}
                  {showTargetConfig && (
                    <div className="absolute right-0 top-9 z-30 w-64 rounded-2xl border border-border bg-card p-3 shadow-xl animate-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between pb-2 border-b border-border">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1">
                          <Target className="size-3.5 text-amber-500" /> Cấu hình Mục tiêu KPI
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowTargetConfig(false)}
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      <div className="mt-2.5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Hiển thị đường mốc:</span>
                          <input
                            type="checkbox"
                            checked={showTargetLine}
                            onChange={(e) => setShowTargetLine(e.target.checked)}
                            className="rounded cursor-pointer accent-amber-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-muted-foreground">Mức doanh thu mục tiêu (VNĐ):</label>
                          <input
                            type="number"
                            step="5000"
                            min="0"
                            value={targetRevenue}
                            onChange={(e) => setTargetRevenue(Number(e.target.value) || 0)}
                            className="w-full rounded-xl border border-border bg-background p-1.5 font-mono text-xs text-foreground focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex gap-1 pt-1">
                          {[20000, 30000, 50000, 100000].map((quick) => (
                            <button
                              key={quick}
                              type="button"
                              onClick={() => {
                                setTargetRevenue(quick)
                                setShowTargetLine(true)
                              }}
                              className="rounded-lg bg-muted px-1.5 py-0.5 text-[10px] font-mono font-medium hover:bg-accent text-foreground cursor-pointer"
                            >
                              {quick / 1000}k
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chuyển đổi Cột vs Đường */}
                <div className="flex rounded-xl border border-border bg-muted/40 p-1">
                  <button
                    type="button"
                    onClick={() => setChartMode('bar')}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      chartMode === 'bar' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Biểu đồ Cột"
                  >
                    <BarChart3 className="size-3.5" />
                    <span>Cột</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode('line')}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      chartMode === 'line' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Biểu đồ Đường mềm"
                  >
                    <LineChart className="size-3.5" />
                    <span>Đường</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Khung vẽ Biểu đồ SVG Tương Tác */}
            <div className="mt-6 relative">
              {timelineData.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center p-6">
                  <Coins className="size-10 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-semibold text-foreground">Chưa có giao dịch doanh thu</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Trong khoảng thời gian hoặc điều kiện lọc này chưa có vé xe nào được thanh toán. Hãy thử mở rộng khoảng ngày hoặc chọn tất cả tuyến.
                  </p>
                </div>
              ) : (
                <div className="w-full">
                  {/* Floating Tooltip khi hover */}
                  {hoveredTimelineIndex !== null && timelineData[hoveredTimelineIndex] && (
                    <div className="absolute top-0 right-4 z-20 rounded-2xl border border-emerald-500/30 bg-card/95 backdrop-blur-md p-3 shadow-xl pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between gap-3 text-xs font-mono text-muted-foreground">
                        <span>Kỳ: <strong className="text-foreground">{timelineData[hoveredTimelineIndex].period}</strong></span>
                        {showTargetLine && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            timelineData[hoveredTimelineIndex].revenue >= targetRevenue
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}>
                            {timelineData[hoveredTimelineIndex].revenue >= targetRevenue ? '✔ Đạt KPI' : 'Chưa đạt'}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-base font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                        {formatVnd(timelineData[hoveredTimelineIndex].revenue)}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Số vé: <strong className="text-foreground">{timelineData[hoveredTimelineIndex].ticketCount}</strong></span>
                        <span>Lượt đặt: <strong className="text-foreground">{timelineData[hoveredTimelineIndex].bookingCount}</strong></span>
                      </div>
                    </div>
                  )}

                  {/* SVG Chart Container */}
                  <div className="h-64 sm:h-72 w-full pt-4">
                    <svg viewBox={`0 0 ${Math.max(600, timelineData.length * 60)} 260`} className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="revenueGradientBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity="0.95" />
                          <stop offset="100%" stopColor="#059669" stopOpacity="0.6" />
                        </linearGradient>
                        <linearGradient id="revenueGradientArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity="0.45" />
                          <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                        </linearGradient>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10B981" floodOpacity="0.3" />
                        </filter>
                      </defs>

                      {/* Lưới ngang (Grid lines) */}
                      {[0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                        const y = 220 - ratio * 190
                        const val = Math.round(maxTimelineRevenue * ratio)
                        return (
                          <g key={idx}>
                            <line
                              x1="0"
                              y1={y}
                              x2={Math.max(600, timelineData.length * 60)}
                              y2={y}
                              stroke="currentColor"
                              strokeDasharray="4 4"
                              className="text-border/60"
                              strokeWidth="1"
                            />
                            <text
                              x="8"
                              y={y - 4}
                              className="fill-muted-foreground text-[10px] font-mono select-none"
                            >
                              {val >= 1000 ? `${Math.round(val / 1000)}k` : val}
                            </text>
                          </g>
                        )
                      })}

                      {/* ĐƯỜNG MỤC TIÊU KPI DOANH THU (BENCHMARK THRESHOLD LINE) */}
                      {showTargetLine && targetRevenue > 0 && (
                        (() => {
                          const yTarget = 220 - (targetRevenue / maxTimelineRevenue) * 190
                          const totalW = Math.max(600, timelineData.length * 60)
                          return (
                            <g className="transition-all duration-300">
                              <line
                                x1="0"
                                y1={yTarget}
                                x2={totalW}
                                y2={yTarget}
                                stroke="#F59E0B"
                                strokeDasharray="6 4"
                                strokeWidth="2"
                                className="opacity-80"
                              />
                              <text
                                x={totalW - 8}
                                y={yTarget - 6}
                                textAnchor="end"
                                className="fill-amber-600 dark:fill-amber-400 text-[10px] font-mono font-bold select-none"
                              >
                                🎯 Mục tiêu: {formatVnd(targetRevenue)}
                              </text>
                            </g>
                          )
                        })()
                      )}

                      {/* Đường đáy (Baseline) */}
                      <line
                        x1="0"
                        y1="220"
                        x2={Math.max(600, timelineData.length * 60)}
                        y2="220"
                        stroke="currentColor"
                        className="text-border"
                        strokeWidth="1.5"
                      />

                      {/* VẼ THEO CHẾ ĐỘ ĐƯỜNG (LINE / AREA) */}
                      {chartMode === 'line' && (
                        <>
                          {/* Area Fill */}
                          {(() => {
                            const totalW = Math.max(600, timelineData.length * 60)
                            const step = totalW / Math.max(1, timelineData.length)
                            const points = timelineData.map((d, i) => {
                              const x = i * step + step / 2
                              const h = (d.revenue / maxTimelineRevenue) * 190
                              const y = 220 - h
                              return `${x},${y}`
                            })
                            const firstX = step / 2
                            const lastX = (timelineData.length - 1) * step + step / 2
                            const dPath = `M ${firstX},220 L ${points.join(' L ')} L ${lastX},220 Z`
                            return <path d={dPath} fill="url(#revenueGradientArea)" />
                          })()}

                          {/* Line Stroke */}
                          {(() => {
                            const totalW = Math.max(600, timelineData.length * 60)
                            const step = totalW / Math.max(1, timelineData.length)
                            const points = timelineData.map((d, i) => {
                              const x = i * step + step / 2
                              const h = (d.revenue / maxTimelineRevenue) * 190
                              const y = 220 - h
                              return `${x},${y}`
                            })
                            return (
                              <path
                                d={`M ${points.join(' L ')}`}
                                fill="none"
                                stroke="#10B981"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                filter="url(#glow)"
                              />
                            )
                          })()}
                        </>
                      )}

                      {/* VẼ TỪNG CỘT / DATA POINT */}
                      {timelineData.map((item, idx) => {
                        const totalW = Math.max(600, timelineData.length * 60)
                        const step = totalW / Math.max(1, timelineData.length)
                        const cx = idx * step + step / 2
                        const height = Math.max(4, (item.revenue / maxTimelineRevenue) * 190)
                        const y = 220 - height
                        const barWidth = Math.min(36, Math.max(16, step * 0.55))
                        const isHovered = hoveredTimelineIndex === idx
                        const isAchieved = showTargetLine && item.revenue >= targetRevenue

                        return (
                          <g
                            key={item.period}
                            className="cursor-pointer transition-all duration-150"
                            onMouseEnter={() => setHoveredTimelineIndex(idx)}
                            onMouseLeave={() => setHoveredTimelineIndex(null)}
                          >
                            {/* Chế độ Cột */}
                            {chartMode === 'bar' && (
                              <rect
                                x={cx - barWidth / 2}
                                y={y}
                                width={barWidth}
                                height={height}
                                rx="6"
                                fill={
                                  isHovered
                                    ? '#059669'
                                    : isAchieved
                                    ? 'url(#revenueGradientBar)'
                                    : 'url(#revenueGradientBar)'
                                }
                                className={`transition-all duration-200 ${
                                  isHovered ? 'filter drop-shadow(0 4px 8px rgba(16, 185, 129, 0.4))' : ''
                                }`}
                              />
                            )}

                            {/* Data Point tròn (chế độ Đường hoặc Highlight Cột) */}
                            <circle
                              cx={cx}
                              cy={y}
                              r={isHovered ? 6 : chartMode === 'line' ? 4 : 0}
                              fill="#FFFFFF"
                              stroke={isAchieved ? '#10B981' : '#10B981'}
                              strokeWidth={isHovered ? 3 : 2}
                              className="transition-all duration-150"
                            />

                            {/* Dấu chấm chỉ báo Đạt mục tiêu (Target Indicator) */}
                            {showTargetLine && (
                              <circle
                                cx={cx}
                                cy={chartMode === 'bar' ? y - 6 : y - 10}
                                r={isAchieved ? 3 : 2}
                                fill={isAchieved ? '#10B981' : '#F59E0B'}
                                className="opacity-80"
                              />
                            )}

                            {/* Nhãn trục X (Kỳ/Ngày) */}
                            <text
                              x={cx}
                              y="242"
                              textAnchor="middle"
                              className={`text-[10px] font-mono transition-colors select-none ${
                                isHovered ? 'fill-emerald-600 dark:fill-emerald-400 font-bold' : 'fill-muted-foreground'
                              }`}
                            >
                              {item.period.length > 5 ? item.period.slice(5) : item.period}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer thông tin thống kê tóm tắt & Tỷ lệ đạt KPI */}
          <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                Tổng số kỳ: <strong className="text-foreground">{timelineData.length}</strong>
              </span>
              <span>
                Đỉnh doanh thu (Peak): <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formatVnd(Math.max(0, ...timelineData.map(t => t.revenue)))}</strong>
              </span>
              {showTargetLine && (
                <span className="flex items-center gap-1 font-mono">
                  <Flag className="size-3 text-amber-500" />
                  Đạt mục tiêu: <strong className="text-emerald-600 dark:text-emerald-400">{targetStats.achievedCount}/{targetStats.total} ({targetStats.percentage}%)</strong>
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              ✓ Dữ liệu tổng hợp thời gian thực theo {groupBy === 'day' ? 'ngày' : groupBy === 'month' ? 'tháng' : 'năm'}
            </span>
          </div>
        </div>

        {/* =====================================================================
            BIỂU ĐỒ 2: PHÂN BỔ DOANH THU THEO TUYẾN XE (DONUT CHART - RIGHT 4 COLS)
        ===================================================================== */}
        <div className="lg:col-span-4 rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <PieChart className="size-4 text-emerald-500" />
                  Cơ Cấu Tuyến Đường
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tỷ trọng đóng góp doanh thu theo tuyến
                </p>
              </div>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                {revenueData?.revenueByRoute?.length || 0} tuyến
              </span>
            </div>

            {/* Donut Chart SVG Container */}
            <div className="mt-5 flex flex-col items-center">
              {(!revenueData?.revenueByRoute || revenueData.revenueByRoute.length === 0) ? (
                <div className="flex h-44 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center p-4">
                  <Route className="size-8 text-muted-foreground/40 mb-1" />
                  <p className="text-xs font-semibold text-foreground">Chưa có số liệu tuyến</p>
                </div>
              ) : (
                <div className="relative size-48 sm:size-52">
                  <svg viewBox="0 0 100 100" className="size-full -rotate-90">
                    {(() => {
                      const routes = revenueData.revenueByRoute
                      const total = routes.reduce((sum, r) => sum + r.revenue, 0) || 1
                      let accumulatedAngle = 0

                      return routes.map((r, i) => {
                        const pct = (r.revenue / total) * 100
                        const strokeDash = `${pct} ${100 - pct}`
                        const strokeDashOffset = -accumulatedAngle
                        accumulatedAngle += pct

                        const palette = ROUTE_PALETTE[i % ROUTE_PALETTE.length]
                        const isHovered = hoveredRouteIndex === i

                        return (
                          <circle
                            key={r.routeCode}
                            cx="50"
                            cy="50"
                            r="38"
                            fill="transparent"
                            stroke={palette.stroke}
                            strokeWidth={isHovered ? "16" : "13"}
                            strokeDasharray={strokeDash}
                            strokeDashoffset={strokeDashOffset}
                            pathLength="100"
                            className="cursor-pointer transition-all duration-300 hover:opacity-90"
                            onMouseEnter={() => setHoveredRouteIndex(i)}
                            onMouseLeave={() => setHoveredRouteIndex(null)}
                          />
                        )
                      })
                    })()}
                  </svg>

                  {/* Tâm vòng Donut hiển thị Doanh thu hoặc Tuyến đang hover */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
                    {hoveredRouteIndex !== null && revenueData.revenueByRoute[hoveredRouteIndex] ? (
                      <>
                        <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          {revenueData.revenueByRoute[hoveredRouteIndex].routeCode}
                        </span>
                        <span className="text-sm font-extrabold font-mono text-foreground mt-0.5">
                          {revenueData.revenueByRoute[hoveredRouteIndex].share ?? 0}%
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatVnd(revenueData.revenueByRoute[hoveredRouteIndex].revenue)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                          Tổng Doanh Thu
                        </span>
                        <span className="text-sm sm:text-base font-extrabold font-mono text-foreground mt-0.5">
                          {formatVnd(kpiStats.totalRev)}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          100% Sản lượng
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Danh sách Legend theo tuyến */}
              <div className="mt-5 w-full space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {revenueData?.revenueByRoute?.map((r, i) => {
                  const palette = ROUTE_PALETTE[i % ROUTE_PALETTE.length]
                  const isHovered = hoveredRouteIndex === i

                  return (
                    <div
                      key={r.routeCode}
                      className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                        isHovered ? 'bg-accent shadow-sm' : 'hover:bg-accent/50'
                      }`}
                      onMouseEnter={() => setHoveredRouteIndex(i)}
                      onMouseLeave={() => setHoveredRouteIndex(null)}
                      onClick={() => {
                        // Click để lọc nhanh theo tuyến này
                        if (r.routeId) {
                          setSelectedRouteId(selectedRouteId === r.routeId ? '' : r.routeId)
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`size-2.5 rounded-full ${palette.bg}`} />
                        <span className="font-mono text-xs font-bold px-1 rounded bg-muted text-foreground">
                          {r.routeCode}
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[130px]" title={r.name}>
                          {r.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                        <span className="font-semibold text-foreground">{formatVnd(r.revenue)}</span>
                        <span className="text-muted-foreground font-bold">({r.share ?? 0}%)</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Nhấp vào tuyến để lọc</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Chi tiết theo trạm</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. PHÂN TÍCH CỔNG THANH TOÁN & BẢNG KÊ CHI TIẾT (DRILL-DOWN)
      ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Cơ cấu cổng thanh toán (Left 4 cols) */}
        <div className="lg:col-span-4 rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <CreditCard className="size-4 text-cyan-500" />
                  Kênh Thanh Toán Điện Tử
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dòng tiền đối soát theo cổng thanh toán
                </p>
              </div>
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 font-mono">
                {revenueData?.revenueByChannel?.length || 0} cổng
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {revenueData?.revenueByChannel?.map((ch) => {
                return (
                  <div key={ch.channel} className="space-y-1.5 p-3 rounded-2xl border border-border bg-accent/20">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{ch.channel}</span>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="font-bold text-foreground">{ch.amount}</span>
                        <span className="text-muted-foreground">({ch.share}%)</span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full transition-all duration-700"
                        style={{ width: `${ch.share}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Đã khớp nối đối soát</span>
                      <span className="font-mono">{ch.bookingCount || 0} giao dịch</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Cashless summary card */}
          {(() => {
            const channels = revenueData?.revenueByChannel || []
            const cashlessShare = channels
              .filter((c) => !c.channel.toLowerCase().includes('tiền mặt'))
              .reduce((sum, c) => sum + (c.share || 0), 0)
            return (
              <div className="mt-6 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 p-3.5 text-xs text-cyan-900 dark:text-cyan-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">Thanh toán không tiền mặt:</span>
                  <span className="font-extrabold font-mono text-sm">{cashlessShare}%</span>
                </div>
                <p className="text-[11px] opacity-90">
                  Tỷ lệ số hóa vé xe buýt cao giúp giảm thất thoát vé, tối ưu đón trả khách tại trạm dừng ICTU.
                </p>
              </div>
            )
          })()}
        </div>

        {/* Bảng Kê Chi Tiết Chuỗi Thời Gian Hoặc Chuyến Xe (Right 8 cols) */}
        <div className="lg:col-span-8 rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Bus className="size-4 text-emerald-500" />
                  Bảng Kê Chi Tiết Khai Thác & Doanh Thu
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tra cứu chi tiết từng chu kỳ hoặc hiệu suất tài chính từng chuyến xe
                </p>
              </div>

              {/* Tabs chuyển đổi Timeline vs Chuyến xe */}
              <div className="flex rounded-xl border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setDetailTab('timeline')}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    detailTab === 'timeline'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Theo Chu Kỳ ({timelineData.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('trips')}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    detailTab === 'trips'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Theo Chuyến Xe ({revenueData?.trips?.length || 0})
                </button>
              </div>
            </div>

            {/* TAB 1: BẢNG KÊ CHUỖI THỜI GIAN */}
            {detailTab === 'timeline' && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2.5 font-semibold">Kỳ (Thời gian)</th>
                      <th className="py-2.5 font-semibold text-right">Doanh thu</th>
                      <th className="py-2.5 font-semibold text-right">Số vé bán</th>
                      <th className="py-2.5 font-semibold text-right">Số lượt đặt</th>
                      <th className="py-2.5 font-semibold text-right">Tỷ trọng</th>
                      <th className="py-2.5 font-semibold text-center">Mục tiêu KPI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {timelineData.map((item) => {
                      const share = kpiStats.totalRev > 0 ? Math.round((item.revenue / kpiStats.totalRev) * 100) : 0
                      const isAchieved = item.revenue >= targetRevenue
                      return (
                        <tr key={item.period} className="hover:bg-accent/40 transition-colors">
                          <td className="py-2.5 font-mono font-medium text-foreground">
                            {item.period}
                          </td>
                          <td className="py-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right">
                            {formatVnd(item.revenue)}
                          </td>
                          <td className="py-2.5 font-mono text-foreground text-right">
                            {item.ticketCount} vé
                          </td>
                          <td className="py-2.5 font-mono text-muted-foreground text-right">
                            {item.bookingCount} đơn
                          </td>
                          <td className="py-2.5 font-mono text-right font-semibold text-foreground">
                            {share}%
                          </td>
                          <td className="py-2.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isAchieved
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            }`}>
                              {isAchieved ? <CheckCheck className="size-3" /> : <Target className="size-3" />}
                              {isAchieved ? 'Vượt chỉ tiêu' : 'Chưa đạt'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 2: BẢNG KÊ TỪNG CHUYẾN XE */}
            {detailTab === 'trips' && (
              <div className="mt-4 overflow-x-auto">
                {(!revenueData?.trips || revenueData.trips.length === 0) ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    Không có chuyến xe nào được ghi nhận trong điều kiện lọc hiện tại.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-2.5 font-semibold">Tuyến & Giờ chạy</th>
                        <th className="py-2.5 font-semibold">Phương tiện</th>
                        <th className="py-2.5 font-semibold text-right">Vé bán</th>
                        <th className="py-2.5 font-semibold text-right">Doanh thu chuyến</th>
                        <th className="py-2.5 font-semibold text-right">Hệ số lấp đầy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {revenueData.trips.map((tr) => (
                        <tr key={tr.tripId} className="hover:bg-accent/40 transition-colors">
                          <td className="py-2.5">
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              {tr.routeCode && (
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                  {tr.routeCode}
                                </span>
                              )}
                              <span>{new Date(tr.departureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {new Date(tr.departureTime).toLocaleDateString('vi-VN')}
                            </div>
                          </td>
                          <td className="py-2.5 font-mono font-medium text-foreground">
                            {tr.vehiclePlate}
                          </td>
                          <td className="py-2.5 font-mono text-right text-foreground">
                            {tr.ticketCount} vé
                          </td>
                          <td className="py-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right">
                            {formatVnd(tr.revenue)}
                          </td>
                          <td className="py-2.5 font-mono text-right font-semibold text-foreground">
                            {tr.occupancyRate ?? 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Dữ liệu kế toán minh bạch</span>
            <button
              type="button"
              onClick={handleExportCSV}
              className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Download className="size-3" /> Xuất bảng kê đầy đủ
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          5. NHẬT KÝ KIỂM TOÁN HỆ THỐNG (AUDIT TRAIL)
      ========================================================================= */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm print:hidden">
        <div className="border-b border-border bg-muted/40 p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-500" />
              Nhật ký Lưu vết Thao tác & Kiểm toán Hệ thống (Audit Trail)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Toàn bộ thao tác phê duyệt, phân lịch điều hành xe, hoàn tiền vé và lưu vết tài chính
            </p>
          </div>

          {/* Bộ lọc cho bảng Audit Table */}
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
              className="h-9 rounded-xl border border-border bg-card px-3 text-xs text-foreground focus:outline-none focus:border-emerald-500 cursor-pointer"
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

        {/* Bảng Audit Log */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/30 text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3.5 font-semibold">Thời điểm</th>
                <th className="p-3.5 font-semibold">Hành động</th>
                <th className="p-3.5 font-semibold">Người thực hiện</th>
                <th className="p-3.5 font-semibold">Tài nguyên tác động</th>
                <th className="p-3.5 font-semibold">Địa chỉ IP</th>
                <th className="p-3.5 font-semibold text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Không tìm thấy nhật ký kiểm toán phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredLogs.slice(0, 15).map((log) => (
                  <tr key={log.id} className="hover:bg-accent/40 transition-colors">
                    <td className="p-3.5 font-mono text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('vi-VN')}
                    </td>
                    <td className="p-3.5 font-semibold text-foreground whitespace-nowrap">
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-foreground">{log.user?.fullName || 'Hệ thống'}</div>
                      <div className="text-[11px] text-muted-foreground">{log.user?.email || 'System daemon'}</div>
                    </td>
                    <td className="p-3.5 text-foreground max-w-[200px] truncate" title={log.resourceName}>
                      {log.resourceName}
                    </td>
                    <td className="p-3.5 font-mono text-muted-foreground">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => setInspectingLog(log)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                        title="Xem chi tiết payload"
                      >
                        <Eye className="size-4 text-emerald-600 dark:text-emerald-400" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          6. MODAL XEM TRƯỚC VÀ IN BÁO CÁO KHỔ A4 (PRINT PREVIEW MODAL)
      ========================================================================= */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-border p-4 bg-muted/40 print:hidden">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <FileText className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Xem Trước Báo Cáo Tài Chính (Khổ Giấy A4)</h3>
                  <p className="text-[11px] text-muted-foreground">Định dạng tiêu chuẩn kế toán và lưu vết hành chính</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTriggerPrint}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  <Printer className="size-3.5" />
                  <span>In / Lưu PDF Ngay</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="rounded-xl p-1.5 text-muted-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Nội dung khổ giấy A4 (Cuộn được trong modal) */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white text-slate-900 font-sans print:p-0 print:m-0" id="printable-a4-sheet">
              {/* Tiêu đề Quốc hiệu & Đơn vị chủ quản */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">ĐẠI HỌC THÁI NGUYÊN</p>
                  <p className="text-xs font-extrabold uppercase text-slate-900">TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN & TRUYỀN THÔNG</p>
                  <p className="text-[10px] italic text-slate-500">Trung tâm Quản trị Vận tải & Điều hành Xe Buýt Thông minh (Smart Bus ICTU)</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-slate-700">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                  <p className="text-[10px] font-semibold italic text-slate-600">Độc lập - Tự do - Hạnh phúc</p>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">Số: {new Date().getFullYear()}/BC-TC-ICTU</p>
                </div>
              </div>

              {/* Tên báo cáo */}
              <div className="text-center my-6">
                <h2 className="text-xl font-extrabold uppercase tracking-wide text-slate-900">
                  BÁO CÁO TỔNG HỢP DOANH THU & HIỆU QUẢ TÀI CHÍNH
                </h2>
                <p className="text-xs italic text-slate-600 mt-1">
                  Kỳ báo cáo: Từ ngày <strong>{startDate}</strong> đến ngày <strong>{endDate}</strong> ({groupBy === 'day' ? 'Tổng hợp theo ngày' : groupBy === 'month' ? 'Tổng hợp theo tháng' : 'Tổng hợp theo năm'})
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Phạm vi: {currentSelectedRouteName} | Cổng thanh toán: {selectedPaymentMethod ? selectedPaymentMethod.toUpperCase() : 'Tất cả'}
                </p>
              </div>

              {/* Bảng 1: Chỉ tiêu tài chính chủ yếu */}
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase text-slate-900 mb-2 border-l-4 border-emerald-600 pl-2">
                  I. BẢNG TỔNG HỢP CHỈ TIÊU TÀI CHÍNH CỐT LÕI
                </h4>
                <table className="w-full text-xs border border-slate-300">
                  <thead className="bg-slate-100 text-slate-800">
                    <tr>
                      <th className="border border-slate-300 p-2 text-left">Chỉ tiêu tài chính / Vận hành</th>
                      <th className="border border-slate-300 p-2 text-right">Giá trị thực hiện</th>
                      <th className="border border-slate-300 p-2 text-left">Ghi chú kế toán</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-300 p-2 font-medium">1. Tổng doanh thu bán vé thực nhận</td>
                      <td className="border border-slate-300 p-2 text-right font-bold font-mono text-emerald-800">{formatVnd(kpiStats.totalRev)}</td>
                      <td className="border border-slate-300 p-2 text-slate-600">Đã thanh toán qua VNPAY/Tiền mặt</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 p-2 font-medium">2. Tổng tiền trợ giá / Voucher HSSV</td>
                      <td className="border border-slate-300 p-2 text-right font-mono text-amber-700">{formatVnd(kpiStats.totalDis)}</td>
                      <td className="border border-slate-300 p-2 text-slate-600">Chính sách ưu đãi sinh viên ICTU</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 p-2 font-medium">3. Doanh thu thuần sau giảm trừ (Net)</td>
                      <td className="border border-slate-300 p-2 text-right font-bold font-mono text-emerald-900">{formatVnd(kpiStats.netRev)}</td>
                      <td className="border border-slate-300 p-2 text-slate-600">Thực thu ngân sách vận tải</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 p-2 font-medium">4. Tổng sản lượng vé xuất ra</td>
                      <td className="border border-slate-300 p-2 text-right font-mono font-bold">{kpiStats.ticketsSold} vé</td>
                      <td className="border border-slate-300 p-2 text-slate-600">{kpiStats.paidBookings} giao dịch hợp lệ</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 p-2 font-medium">5. Giá trị trung bình mỗi đơn (AOV)</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">{formatVnd(kpiStats.aov)}</td>
                      <td className="border border-slate-300 p-2 text-slate-600">Mức chi tiêu bình quân/hành khách</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 p-2 font-medium">6. Doanh thu bình quân / Chuyến xe</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">{formatVnd(kpiStats.avgRevenuePerTrip)}</td>
                      <td className="border border-slate-300 p-2 text-slate-600">{kpiStats.totalTrips} chuyến xe khai thác</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 p-2 font-medium">7. Hệ số lấp đầy ghế bình quân</td>
                      <td className="border border-slate-300 p-2 text-right font-mono font-bold">{kpiStats.occupancyRate}%</td>
                      <td className="border border-slate-300 p-2 text-slate-600">Hệ số phụ tải khách/ghế toàn mạng</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bảng 2: Doanh thu theo tuyến */}
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase text-slate-900 mb-2 border-l-4 border-emerald-600 pl-2">
                  II. PHÂN BỔ DOANH THU THEO TUYẾN ĐƯỜNG
                </h4>
                <table className="w-full text-xs border border-slate-300">
                  <thead className="bg-slate-100 text-slate-800">
                    <tr>
                      <th className="border border-slate-300 p-2 text-center w-12">STT</th>
                      <th className="border border-slate-300 p-2 text-left">Mã & Tên Tuyến Xe Buýt</th>
                      <th className="border border-slate-300 p-2 text-right">Số vé bán</th>
                      <th className="border border-slate-300 p-2 text-right">Doanh thu (VNĐ)</th>
                      <th className="border border-slate-300 p-2 text-right">Tỷ trọng (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueData?.revenueByRoute?.map((r, idx) => (
                      <tr key={r.routeCode}>
                        <td className="border border-slate-300 p-2 text-center font-mono">{idx + 1}</td>
                        <td className="border border-slate-300 p-2 font-medium">
                          <strong>[{r.routeCode}]</strong> {r.name}
                        </td>
                        <td className="border border-slate-300 p-2 text-right font-mono">{r.ticketCount} vé</td>
                        <td className="border border-slate-300 p-2 text-right font-bold font-mono">{formatVnd(r.revenue)}</td>
                        <td className="border border-slate-300 p-2 text-right font-mono">{r.share ?? 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bảng 3: Diễn biến chuỗi thời gian */}
              <div className="mb-8">
                <h4 className="text-xs font-bold uppercase text-slate-900 mb-2 border-l-4 border-emerald-600 pl-2">
                  III. CHI TIẾT DOANH THU THEO CHU KỲ ({timelineData.length} KỲ)
                </h4>
                <table className="w-full text-xs border border-slate-300">
                  <thead className="bg-slate-100 text-slate-800">
                    <tr>
                      <th className="border border-slate-300 p-2 text-left">Kỳ thời gian</th>
                      <th className="border border-slate-300 p-2 text-right">Doanh thu thực hiện</th>
                      <th className="border border-slate-300 p-2 text-right">Số vé bán</th>
                      <th className="border border-slate-300 p-2 text-right">Số đơn đặt</th>
                      <th className="border border-slate-300 p-2 text-center">Đánh giá KPI ({formatVnd(targetRevenue)})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timelineData.map((item) => (
                      <tr key={item.period}>
                        <td className="border border-slate-300 p-2 font-mono">{item.period}</td>
                        <td className="border border-slate-300 p-2 text-right font-bold font-mono">{formatVnd(item.revenue)}</td>
                        <td className="border border-slate-300 p-2 text-right font-mono">{item.ticketCount} vé</td>
                        <td className="border border-slate-300 p-2 text-right font-mono">{item.bookingCount} đơn</td>
                        <td className="border border-slate-300 p-2 text-center font-semibold">
                          {item.revenue >= targetRevenue ? '✔ Đạt chỉ tiêu' : 'Chưa đạt'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phần chữ ký xác nhận 3 bên */}
              <div className="grid grid-cols-3 gap-6 text-center text-xs mt-10 pt-4">
                <div>
                  <p className="font-bold uppercase text-slate-900">NGƯỜI LẬP BÁO CÁO</p>
                  <p className="text-[10px] italic text-slate-500 mb-16">(Ký, ghi rõ họ tên)</p>
                  <p className="font-semibold text-slate-800">Quản Trị Viên Hệ Thống</p>
                </div>

                <div>
                  <p className="font-bold uppercase text-slate-900">KẾ TOÁN TRƯỞNG</p>
                  <p className="text-[10px] italic text-slate-500 mb-16">(Ký, ghi rõ họ tên)</p>
                  <p className="font-semibold text-slate-800">Ban Tài Chính - Kế Toán</p>
                </div>

                <div>
                  <p className="font-bold uppercase text-slate-900">TRƯỞNG BAN ĐIỀU HÀNH</p>
                  <p className="text-[10px] italic text-slate-500 mb-16">(Ký, đóng dấu)</p>
                  <p className="font-semibold text-slate-800">Giám Đốc Trung Tâm Smart Bus</p>
                </div>
              </div>

              <div className="mt-12 text-[10px] text-slate-400 text-center italic border-t border-slate-200 pt-3">
                Báo cáo được trích xuất tự động từ Hệ thống Quản trị Bán vé & Điều hành Xe Buýt Thông minh Smart Bus ICTU lúc {new Date().toLocaleString('vi-VN')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xem Chi Tiết Audit Log */}
      {inspectingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h4 className="font-bold text-base text-foreground flex items-center gap-2">
                <ShieldCheck className="size-5 text-emerald-500" />
                Chi Tiết Bản Ghi Kiểm Toán
              </h4>
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Mã Log:</span>
                <span className="font-mono font-bold text-foreground">{inspectingLog.id}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Hành động:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{inspectingLog.action}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Người thực hiện:</span>
                <span className="font-semibold text-foreground">
                  {inspectingLog.user?.fullName || 'Hệ thống'} ({inspectingLog.user?.email || 'N/A'})
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Tài nguyên:</span>
                <span className="font-medium text-foreground">{inspectingLog.resourceName}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Thời điểm:</span>
                <span className="font-mono text-foreground">{new Date(inspectingLog.timestamp).toLocaleString('vi-VN')}</span>
              </div>

              {inspectingLog.changes && (
                <div className="mt-3">
                  <span className="text-muted-foreground font-semibold block mb-1">Dữ liệu thay đổi (Changes Payload):</span>
                  <pre className="rounded-xl bg-muted/60 p-3 font-mono text-[11px] text-foreground max-h-48 overflow-y-auto">
                    {JSON.stringify(inspectingLog.changes, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="rounded-xl bg-muted px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer"
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
