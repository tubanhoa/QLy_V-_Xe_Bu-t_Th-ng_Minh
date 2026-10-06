'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  Clock,
  MapPin,
  Radio,
  Siren,
  Wrench,
  RefreshCw,
  Plus,
  X,
  Search,
  Check,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react'
import { trackingService } from '@/lib/services/tracking.service'
import { tripService, type TripItem } from '@/lib/services/trip.service'

interface IncidentItem {
  id: string
  tripId: string
  vehiclePlate: string
  route: string
  driver: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  delayMinutes?: number
  reportedAt: string
  status: 'pending' | 'acknowledged' | 'resolved'
  reportedBy?: string
}

export function DispatcherIncidents() {
  const [incidents, setIncidents] = useState<IncidentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState<string | null>(null)

  // Modal Báo Cáo Sự Cố Mới
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [activeTrips, setActiveTrips] = useState<TripItem[]>([])
  const [newIncident, setNewIncident] = useState({
    tripId: '',
    incidentType: 'traffic_jam',
    severity: 'medium',
    description: '',
    delayMinutesEstimate: 10,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Tải danh sách sự cố từ backend
  const loadIncidents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await trackingService.getAllIncidents(
        statusFilter === 'all' ? undefined : statusFilter,
        severityFilter === 'all' ? undefined : severityFilter
      )

      if (res.success && Array.isArray(res.data)) {
        const mapped: IncidentItem[] = res.data.map((item: any) => ({
          id: item.id,
          tripId: item.tripId,
          vehiclePlate: item.trip?.vehicle?.licensePlate || 'Xe buýt ICTU',
          route: item.trip?.route?.name || 'Tuyến xe buýt ICTU',
          driver: item.trip?.driver?.fullName || item.reportedByUser?.fullName || 'Tài xế trên tuyến',
          type:
            item.incidentType === 'traffic_jam'
              ? 'Ùn tắc giao thông'
              : item.incidentType === 'breakdown'
              ? 'Hỏng hóc kỹ thuật'
              : item.incidentType === 'accident'
              ? 'Va chạm / Tai nạn'
              : item.incidentType === 'weather'
              ? 'Thời tiết cực đoan'
              : item.incidentType === 'delay'
              ? 'Trễ giờ xuất bến'
              : 'Sự cố vận hành',
          severity: item.severity || 'medium',
          description: item.description || 'Không có mô tả chi tiết',
          delayMinutes: item.delayMinutesEstimate,
          reportedAt: item.reportedAt,
          status: item.resolutionStatus || 'pending',
          reportedBy: item.reportedByUser?.fullName,
        }))
        setIncidents(mapped)
      } else {
        setError(res.message || 'Không thể tải danh sách sự cố')
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, severityFilter])

  // Tải các chuyến xe đang chạy để lập báo cáo sự cố nếu cần
  const loadTrips = useCallback(async () => {
    try {
      const res = await tripService.getTrips({ limit: 30 })
      if (res.success && res.data) {
        setActiveTrips(res.data.items || [])
      }
    } catch (err) {
      console.error('Error loading trips:', err)
    }
  }, [])

  useEffect(() => {
    loadIncidents()
    loadTrips()
  }, [loadIncidents, loadTrips])

  // Xử lý đóng/giải tỏa sự cố
  const handleResolve = async (incident: IncidentItem) => {
    const notes = prompt(
      `Xác nhận giải tỏa sự cố ${incident.type} cho xe ${incident.vehiclePlate}?\nNhập ghi chú khắc phục:`,
      'Tuyến đường đã thông thoáng, xe tiếp tục lộ trình bình thường'
    )
    if (notes === null) return

    setIsResolving(incident.id)
    try {
      const res = await trackingService.resolveIncident(incident.id, notes)
      if (res.success) {
        setFeedback(
          `Đã giải tỏa sự cố ${incident.id} thành công! Trạng thái chuyến xe được tự động khôi phục.`
        )
        await loadIncidents()
      } else {
        alert(res.message || 'Không thể giải tỏa sự cố này')
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi gửi yêu cầu giải tỏa')
    } finally {
      setIsResolving(null)
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  // Báo cáo sự cố mới
  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newIncident.tripId) {
      alert('Vui lòng chọn chuyến xe gặp sự cố')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await trackingService.reportIncident(newIncident as any)
      if (res.success) {
        setFeedback('Đã phát cảnh báo sự cố khẩn cấp và gửi thông báo tới hành khách!')
        setIsAddModalOpen(false)
        setNewIncident({
          tripId: '',
          incidentType: 'traffic_jam',
          severity: 'medium',
          description: '',
          delayMinutesEstimate: 10,
        })
        await loadIncidents()
      } else {
        alert(res.message || 'Không thể tạo báo cáo sự cố')
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi gửi báo cáo')
    } finally {
      setIsSubmitting(false)
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  const openCount = incidents.filter((i) => i.status !== 'resolved').length
  const criticalCount = incidents.filter((i) => (i.severity === 'high' || i.severity === 'critical') && i.status !== 'resolved').length
  const resolvedCount = incidents.filter((i) => i.status === 'resolved').length

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Trung Tâm Cảnh Báo & Xử Lý Sự Cố
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                openCount > 0
                  ? 'bg-red-500/15 text-red-600 dark:text-red-400 animate-pulse'
                  : 'bg-emerald-500/15 text-emerald-600'
              }`}
            >
              {openCount} sự cố đang mở
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Tiếp nhận cảnh báo khẩn cấp thời gian thực từ tài xế, tự động cập nhật ETA và thông báo cho hành khách
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadIncidents}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/70 transition-colors disabled:opacity-50"
            title="Đồng bộ sự cố"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Đồng bộ DB</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
          >
            <Plus size={15} />
            <span>Báo Cáo Sự Cố Khẩn Cấp</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Tổng sự cố</span>
            <div className="rounded-lg bg-gray-500/10 p-2 text-foreground">
              <Siren size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{incidents.length}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Bản ghi trong hệ thống</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Đang xử lý</span>
            <div className="rounded-lg bg-red-500/10 p-2 text-red-600">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-red-600">{openCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Chưa giải tỏa</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Mức độ nghiêm trọng</span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
              <ShieldAlert size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">{criticalCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Cần hỗ trợ ưu tiên</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Đã khắc phục</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">{resolvedCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Hành trình bình thường</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-foreground text-background shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Tất cả ({incidents.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'pending'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Chưa giải quyết ({openCount})
          </button>
          <button
            onClick={() => setStatusFilter('resolved')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'resolved'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Đã khắc phục ({resolvedCount})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Mức độ:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="h-9 rounded-xl border border-border bg-card px-2.5 text-xs font-semibold text-foreground focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">Tất cả mức độ</option>
            <option value="critical">Nguy cấp (Critical)</option>
            <option value="high">Cao (High)</option>
            <option value="medium">Trung bình (Medium)</option>
            <option value="low">Thấp (Low)</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={loadIncidents} className="font-semibold underline">
            Thử lại
          </button>
        </div>
      )}

      {/* Grid Danh sách sự cố */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-60 rounded-3xl border border-border bg-card p-6 animate-pulse" />
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center text-xs text-muted-foreground">
          Hiện tại không có sự cố giao thông nào được ghi nhận. Toàn bộ chuyến xe đang vận hành an toàn.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {incidents.map((inc) => {
            const isResolved = inc.status === 'resolved'
            return (
              <div
                key={inc.id}
                className={`rounded-3xl border p-5 shadow-sm flex flex-col justify-between transition-all ${
                  isResolved
                    ? 'border-border bg-card opacity-80'
                    : inc.severity === 'critical' || inc.severity === 'high'
                    ? 'border-red-500/50 bg-red-50/20 dark:bg-red-950/10'
                    : 'border-amber-500/50 bg-amber-50/20 dark:bg-amber-950/10'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Bus size={15} className="text-emerald-600" />
                      {inc.vehiclePlate}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isResolved
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : inc.severity === 'critical' || inc.severity === 'high'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}
                    >
                      {isResolved
                        ? 'Đã khắc phục'
                        : inc.severity === 'critical'
                        ? 'Khẩn cấp'
                        : inc.severity === 'high'
                        ? 'Nghiêm trọng'
                        : 'Mức trung bình'}
                    </span>
                  </div>

                  <h3 className="mt-2 text-base font-bold text-foreground flex items-center gap-1.5">
                    <AlertCircle
                      size={16}
                      className={
                        isResolved
                          ? 'text-emerald-600'
                          : inc.severity === 'critical' || inc.severity === 'high'
                          ? 'text-red-600'
                          : 'text-amber-600'
                      }
                    />
                    {inc.type}
                  </h3>

                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {inc.description}
                  </p>

                  <div className="mt-3 space-y-1 text-xs border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tuyến:</span>
                      <span className="font-semibold text-foreground truncate max-w-[170px]" title={inc.route}>
                        {inc.route}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tài xế báo cáo:</span>
                      <span className="font-medium text-foreground">{inc.driver}</span>
                    </div>
                    {inc.delayMinutes && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Dự kiến chậm:</span>
                        <span className="font-bold text-amber-600">{inc.delayMinutes} phút</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span>Thời điểm báo:</span>
                      <span>{new Date(inc.reportedAt).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-border pt-3 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    ID: {inc.id.slice(0, 8)}...
                  </span>

                  {!isResolved ? (
                    <button
                      type="button"
                      disabled={isResolving === inc.id}
                      onClick={() => handleResolve(inc)}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isResolving === inc.id ? 'Đang giải tỏa...' : 'Xác nhận xử lý xong'}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <Check size={14} /> Bình thường
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL BÁO CÁO SỰ CỐ KHẨN CẤP */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Siren size={20} className="text-red-600 animate-pulse" />
                Báo Cáo Sự Cố Vận Hành
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-xl p-1 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="mt-4 flex flex-col gap-3.5">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Chọn Chuyến Xe Gặp Sự Cố <span className="text-red-500">*</span>
                </label>
                <select
                  value={newIncident.tripId}
                  onChange={(e) => setNewIncident({ ...newIncident, tripId: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-red-500 focus:outline-none"
                  required
                >
                  <option value="">-- Chọn chuyến xe --</option>
                  {activeTrips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.route?.name} (Xe: {t.vehicle?.licensePlate || 'N/A'} - {new Date(t.departureTime).toLocaleTimeString('vi-VN')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Loại sự cố</label>
                  <select
                    value={newIncident.incidentType}
                    onChange={(e) => setNewIncident({ ...newIncident, incidentType: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-2.5 text-xs text-foreground focus:border-red-500 focus:outline-none"
                  >
                    <option value="traffic_jam">Ùn tắc giao thông</option>
                    <option value="breakdown">Hỏng hóc xe</option>
                    <option value="accident">Tai nạn va chạm</option>
                    <option value="weather">Thời tiết xấu</option>
                    <option value="delay">Xin trễ chuyến</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Mức độ nghiêm trọng</label>
                  <select
                    value={newIncident.severity}
                    onChange={(e) => setNewIncident({ ...newIncident, severity: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-2.5 text-xs text-foreground focus:border-red-500 focus:outline-none"
                  >
                    <option value="low">Thấp (Chậm &lt; 5p)</option>
                    <option value="medium">Trung bình (5-15p)</option>
                    <option value="high">Cao (15-30p)</option>
                    <option value="critical">Nguy cấp (&gt; 30p)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Ước tính thời gian chậm (Phút)</label>
                <input
                  type="number"
                  min="0"
                  value={newIncident.delayMinutesEstimate}
                  onChange={(e) =>
                    setNewIncident({
                      ...newIncident,
                      delayMinutesEstimate: parseInt(e.target.value) || 0,
                    })
                  }
                  className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Mô tả chi tiết sự cố <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Ví dụ: Tắc đường kéo dài tại ngã tư Ga Thái Nguyên, xe phải di chuyển chậm..."
                  value={newIncident.description}
                  onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground focus:border-red-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang gửi...' : 'Phát Cảnh Báo Khẩn Cấp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
