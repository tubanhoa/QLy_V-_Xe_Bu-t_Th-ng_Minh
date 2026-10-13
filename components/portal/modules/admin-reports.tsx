'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
    } else if (preset === '30d') {
      const past = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
      setStartDate(past)
      setEndDate(todayStr)
      setGroupBy('day')
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      setStartDate(firstDay)
      setEndDate(todayStr)
      setGroupBy('day')
    } else if (preset === 'quarter') {
      const past = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10)
      setStartDate(past)
      setEndDate(todayStr)
      setGroupBy('month')
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

  // Cực đại doanh thu trong chuỗi thời gian
  const maxTimelineRevenue = useMemo(() => {
    if (timelineData.length === 0) return 100000
    const maxVal = Math.max(...timelineData.map((t) => t.revenue))
    return maxVal > 0 ? maxVal : 100000
  }, [timelineData])

  // Tuyến có doanh thu cao nhất
  const topRoute = useMemo(() => {
    if (!revenueData?.revenueByRoute || revenueData.revenueByRoute.length === 0) return null
    return [...revenueData.revenueByRoute].sort((a, b) => b.revenue - a.revenue)[0]
  }, [revenueData])

  // Xuất file CSV / Excel chuẩn UTF-8 BOM
  const handleExportCSV = () => {
    try {
      const bom = '\uFEFF'
      let csv = `${bom}BÁO CÁO DOANH THU & HIỆU QUẢ TÀI CHÍNH - SMART BUS ICTU\n`
      csv += `Thời gian xuất báo cáo:,"${new Date().toLocaleString('vi-VN')}"\n`
      csv += `Khoảng thời gian:,"${startDate} đến ${endDate} (${groupBy === 'day' ? 'Theo ngày' : groupBy === 'month' ? 'Theo tháng' : 'Theo năm'})"\n`
      if (selectedRouteId) {
        const found = routesList.find((r) => r.id === selectedRouteId)
        csv += `Lọc theo tuyến:,"[${found?.routeCode || ''}] ${found?.name || selectedRouteId}"\n`
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
      csv += `Thời kỳ (Kỳ),Doanh thu (VNĐ),Số vé bán ra,Số lượt đặt vé\n`
      timelineData.forEach((t) => {
        csv += `"${t.period}",${t.revenue},${t.ticketCount},${t.bookingCount}\n`
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

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* =========================================================================
          1. HEADER & BỘ LỌC TỔNG THỂ
      ========================================================================= */}
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
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
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors disabled:opacity-60"
              title="Làm mới dữ liệu từ CSDL"
            >
              <RefreshCw className={`size-3.5 text-emerald-600 dark:text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Đang tải...' : 'Làm mới'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
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

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700 active:scale-95 transition-all"
            >
              <Download className="size-4" />
              <span>Xuất Báo Cáo Excel / CSV</span>
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
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
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
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  groupBy === 'day' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Theo Ngày
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('month')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  groupBy === 'month' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Theo Tháng
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('year')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
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
                    className="flex shrink-0 items-center gap-1 rounded-xl border border-border bg-muted/60 px-2.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
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
                  Biểu đồ trực quan hóa doanh thu và biến động sản lượng vé qua thời gian
                </p>
              </div>

              {/* Chuyển đổi Cột vs Đường */}
              <div className="flex rounded-xl border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setChartMode('bar')}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
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
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    chartMode === 'line' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Biểu đồ Đường mềm"
                >
                  <LineChart className="size-3.5" />
                  <span>Đường</span>
                </button>
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
                      <div className="text-xs font-mono text-muted-foreground">
                        Kỳ: <span className="font-bold text-foreground">{timelineData[hoveredTimelineIndex].period}</span>
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
                                fill={isHovered ? '#059669' : 'url(#revenueGradientBar)'}
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
                              stroke="#10B981"
                              strokeWidth={isHovered ? 3 : 2}
                              className="transition-all duration-150"
                            />

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

          {/* Footer thông tin thống kê tóm tắt */}
          <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>
                Tổng số kỳ hiển thị: <strong className="text-foreground">{timelineData.length}</strong>
              </span>
              <span>
                Doanh thu đỉnh (Peak): <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formatVnd(maxTimelineRevenue)}</strong>
              </span>
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
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
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
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {timelineData.map((item) => {
                      const share = kpiStats.totalRev > 0 ? Math.round((item.revenue / kpiStats.totalRev) * 100) : 0
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
              className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1"
            >
              <Download className="size-3" /> Xuất bảng kê đầy đủ
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          5. NHẬT KÝ KIỂM TOÁN HỆ THỐNG (AUDIT TRAIL)
      ========================================================================= */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
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
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
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
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition-colors"
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
                className="rounded-xl bg-muted px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
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
