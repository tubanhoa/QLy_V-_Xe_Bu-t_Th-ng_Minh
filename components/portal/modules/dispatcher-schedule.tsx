'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bus,
  Calendar,
  CheckCircle2,
  Clock,
  Edit2,
  Plus,
  Search,
  User,
  Users,
  RefreshCw,
  AlertTriangle,
  X,
  Play,
  Check,
  Ban,
  Filter,
} from 'lucide-react'
import { tripService, type TripItem } from '@/lib/services/trip.service'
import { vehicleService, type Vehicle } from '@/lib/services/vehicle.service'
import { userService, type BackendUser } from '@/lib/services/user.service'

export function DispatcherSchedule() {
  const [trips, setTrips] = useState<TripItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Data cho modal điều xe
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<BackendUser[]>([])
  const [dispatchingTrip, setDispatchingTrip] = useState<TripItem | null>(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('')
  const [selectedDriverId, setSelectedDriverId] = useState<string>('')
  const [isSubmittingDispatch, setIsSubmittingDispatch] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Tải danh sách chuyến xe
  const loadTrips = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await tripService.getTrips({
        page: 1,
        limit: 50,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
      if (res.success && res.data) {
        setTrips(res.data.items || [])
      } else {
        setError(res.message || 'Không thể tải lịch trình chuyến xe')
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  // Tải xe và tài xế cho modal điều phối
  const loadDispatchResources = useCallback(async () => {
    try {
      const [vRes, dRes] = await Promise.all([
        vehicleService.getVehicles(),
        userService.getUsers({ role: 'driver', limit: 50 }),
      ])
      if (vRes.success && Array.isArray(vRes.data)) {
        setVehicles(vRes.data.filter((v) => v.status === 'active'))
      }
      if (dRes?.success && dRes.data?.items && Array.isArray(dRes.data.items)) {
        setDrivers(dRes.data.items)
      }
    } catch (err) {
      console.error('Error loading dispatch resources:', err)
    }
  }, [])

  useEffect(() => {
    loadTrips()
    loadDispatchResources()
  }, [loadTrips, loadDispatchResources])

  // Mở modal điều phối
  const handleOpenDispatch = (trip: TripItem) => {
    setDispatchingTrip(trip)
    setSelectedVehicleId(trip.vehicleId || trip.vehicle?.id || '')
    setSelectedDriverId(trip.driverId || trip.driver?.id || '')
  }

  // Lưu điều phối xe & tài xế
  const handleSaveDispatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dispatchingTrip) return

    if (!selectedVehicleId) {
      alert('Vui lòng chọn xe buýt phục vụ chuyến này!')
      return
    }
    if (!selectedDriverId) {
      alert('Vui lòng phân công tài xế cầm lái!')
      return
    }

    setIsSubmittingDispatch(true)
    try {
      const res = await tripService.dispatchTrip({
        tripId: dispatchingTrip.id,
        vehicleId: selectedVehicleId,
        driverId: selectedDriverId,
      })
      if (res.success) {
        setFeedback(`Đã điều phối thành công xe và tài xế cho chuyến xe!`)
        setDispatchingTrip(null)
        await loadTrips()
      } else {
        alert(res.message || 'Không thể điều phối chuyến này')
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi gửi thông tin điều phối')
    } finally {
      setIsSubmittingDispatch(false)
      setTimeout(() => setFeedback(null), 3500)
    }
  }

  // Đổi trạng thái chuyến (in_progress, completed, cancelled)
  const handleUpdateStatus = async (tripId: string, status: string) => {
    try {
      const res = await tripService.updateStatus(tripId, status)
      if (res.success) {
        setTrips((prev) =>
          prev.map((t) => (t.id === tripId ? { ...t, status: status as any } : t))
        )
      } else {
        alert(res.message || 'Không thể cập nhật trạng thái')
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi cập nhật trạng thái chuyến')
    }
  }

  // Lọc tìm kiếm
  const filtered = trips.filter((s) => {
    const sId = s.id.toLowerCase()
    const rName = (s.route?.name || '').toLowerCase()
    const vPlate = (s.vehicle?.licensePlate || '').toLowerCase()
    const dName = (s.driver?.fullName || '').toLowerCase()
    const q = search.toLowerCase()
    return sId.includes(q) || rName.includes(q) || vPlate.includes(q) || dName.includes(q)
  })

  // Thống kê nhanh
  const scheduledCount = trips.filter((t) => t.status === 'scheduled').length
  const runningCount = trips.filter((t) => t.status === 'in_progress' || t.status === 'boarding' || t.status === 'departed').length
  const completedCount = trips.filter((t) => t.status === 'completed').length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Lịch Trình Chạy Xe & Điều Phối Tuyến
          </h1>
          <p className="text-sm text-muted-foreground">
            Phân công phương tiện, gán tài xế có bằng lái và giám sát trạng thái lăn bánh trực tiếp từ Supabase DB
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadTrips}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/70 transition-colors disabled:opacity-50"
            title="Đồng bộ lịch trình"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Đồng bộ DB</span>
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
            <span className="text-xs font-medium text-muted-foreground">Tổng số chuyến</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <Bus size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{trips.length}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Lộ trình hôm nay</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Chờ xuất bến</span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600">{scheduledCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Đã lên lịch trình</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Đang lăn bánh</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <Play size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">{runningCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Trên tuyến đường</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Đã về bến</span>
            <div className="rounded-lg bg-gray-500/10 p-2 text-muted-foreground">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{completedCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Hoàn thành lộ trình</p>
        </div>
      </div>

      {/* Filter & Search */}
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
            Tất cả ({trips.length})
          </button>
          <button
            onClick={() => setStatusFilter('scheduled')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'scheduled'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Chờ chạy ({scheduledCount})
          </button>
          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'in_progress'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Đang chạy ({runningCount})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'completed'
                ? 'bg-gray-700 text-white shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Hoàn thành ({completedCount})
          </button>
        </div>

        <div className="relative w-full max-w-xs">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm mã chuyến, tuyến, biển số, tài xế..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={loadTrips} className="font-semibold underline">
            Thử lại
          </button>
        </div>
      )}

      {/* Grid danh sách chuyến */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-3xl border border-border bg-card p-6 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center text-xs text-muted-foreground">
          Không tìm thấy chuyến xe nào phù hợp.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const depDate = new Date(item.departureTime)
            const isRunning = item.status === 'in_progress' || item.status === 'boarding'
            return (
              <div
                key={item.id}
                className="rounded-3xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between hover:border-emerald-500/40 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Bus size={16} className="text-emerald-600" />
                      {item.route?.routeCode || 'CT-ICTU'}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isRunning
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : item.status === 'completed'
                          ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          : item.status === 'cancelled'
                          ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                          : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      }`}
                    >
                      {isRunning
                        ? 'Đang lăn bánh'
                        : item.status === 'completed'
                        ? 'Hoàn thành'
                        : item.status === 'cancelled'
                        ? 'Đã hủy'
                        : 'Chờ chạy'}
                    </span>
                  </div>

                  <h3 className="mt-2 text-sm font-bold text-foreground" title={item.route?.name}>
                    {item.route?.name || 'Tuyến xe buýt ICTU'}
                  </h3>

                  {/* Thời gian xuất bến */}
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/40 p-2.5 text-xs">
                    <Clock size={15} className="text-muted-foreground shrink-0" />
                    <div>
                      <span className="font-bold text-foreground">
                        {depDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-2">
                        Ngày {depDate.toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </div>

                  {/* Tài nguyên đã gán */}
                  <div className="mt-3 space-y-1.5 text-xs border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Xe buýt:</span>
                      <span className="font-mono font-bold text-foreground">
                        {item.vehicle?.licensePlate || <span className="text-amber-600 font-normal">Chưa gán xe</span>}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tài xế:</span>
                      <span className="font-medium text-foreground">
                        {item.driver?.fullName || <span className="text-amber-600 font-normal">Chưa phân công</span>}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Ghế khả dụng:</span>
                      <span className="font-mono font-semibold text-emerald-600">
                        {item.availableSeats !== undefined ? `${item.availableSeats} / 28` : '28 / 28 chỗ'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer action */}
                <div className="mt-5 border-t border-border pt-4 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenDispatch(item)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    <Edit2 size={13} /> Điều xe & Phân tài xế
                  </button>

                  <div className="flex items-center gap-1">
                    {item.status === 'scheduled' && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                        className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                        title="Bắt đầu chạy chuyến"
                      >
                        Khởi hành
                      </button>
                    )}
                    {isRunning && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'completed')}
                        className="rounded-lg bg-gray-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-gray-800 transition-colors cursor-pointer"
                        title="Kết thúc chuyến về bến"
                      >
                        Về bến
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL ĐIỀU XE & PHÂN CÔNG TÀI XẾ */}
      {dispatchingTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Bus size={18} className="text-emerald-600" />
                  Điều Phối Chuyến Xe
                </h2>
                <p className="text-xs text-muted-foreground">
                  {dispatchingTrip.route?.name}
                </p>
              </div>
              <button
                onClick={() => setDispatchingTrip(null)}
                className="rounded-xl p-1 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDispatch} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Chọn Xe Buýt (Đang hoạt động) <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-emerald-500 focus:outline-none"
                  required
                >
                  <option value="">-- Chọn phương tiện --</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.licensePlate} ({v.model} - {v.seatCapacity} chỗ - {v.vehicleType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Phân công Tài xế (Đã đăng kiểm bằng lái) <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-emerald-500 focus:outline-none"
                  required
                >
                  <option value="">-- Chọn tài xế điều khiển --</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} (SĐT: {d.phoneNumber || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Giờ xuất phát:</span>
                  <span className="font-bold text-foreground">
                    {new Date(dispatchingTrip.departureTime).toLocaleTimeString('vi-VN')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ngày chạy:</span>
                  <span>{new Date(dispatchingTrip.departureTime).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setDispatchingTrip(null)}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispatch}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSubmittingDispatch ? 'Đang lưu...' : 'Xác Nhận Điều Xe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
