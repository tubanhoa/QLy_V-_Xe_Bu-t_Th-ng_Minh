'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Armchair,
  BatteryCharging,
  Bus,
  CheckCircle2,
  Filter,
  Plus,
  Search,
  Wrench,
  Zap,
  RefreshCw,
  AlertTriangle,
  Trash2,
  Eye,
  X,
  Fuel,
  Calendar,
  Layers,
} from 'lucide-react'
import {
  vehicleService,
  type Vehicle,
  type Seat,
  type CreateVehiclePayload,
} from '@/lib/services/vehicle.service'

export function AdminFleet() {
  const [fleet, setFleet] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'maintenance' | 'retired'>('all')

  // Modal Thêm xe
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newVehicle, setNewVehicle] = useState<CreateVehiclePayload>({
    licensePlate: '',
    model: 'VinFast eBus 2024 (EV)',
    vehicleType: 'electric',
    seatCapacity: 28,
    manufactureYear: new Date().getFullYear(),
    batteryCapacityKwh: 281.9,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  // Modal Xem Sơ đồ ghế
  const [viewingSeatsVehicle, setViewingSeatsVehicle] = useState<Vehicle | null>(null)
  const [seats, setSeats] = useState<Seat[]>([])
  const [loadingSeats, setLoadingSeats] = useState(false)

  // Tải danh sách xe từ Backend API
  const loadFleet = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await vehicleService.getVehicles()
      if (res.success && Array.isArray(res.data)) {
        setFleet(res.data)
      } else {
        setError(res.message || 'Không thể tải danh sách phương tiện từ máy chủ')
      }
    } catch (err: any) {
      setError(err.message || 'Đã có lỗi xảy ra khi kết nối máy chủ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFleet()
  }, [loadFleet])

  // Lọc danh sách
  const filtered = fleet.filter((v) => {
    const matchSearch =
      v.licensePlate.toLowerCase().includes(search.toLowerCase()) ||
      (v.model && v.model.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = statusFilter === 'all' || v.status === statusFilter
    return matchSearch && matchStatus
  })

  // Thống kê nhanh
  const totalBuses = fleet.length
  const activeBuses = fleet.filter((v) => v.status === 'active').length
  const maintenanceBuses = fleet.filter((v) => v.status === 'maintenance').length
  const electricBuses = fleet.filter((v) => v.vehicleType === 'electric').length

  // Xử lý tạo xe mới
  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newVehicle.licensePlate.trim()) {
      setModalError('Vui lòng nhập biển số xe')
      return
    }
    setIsSubmitting(true)
    setModalError(null)

    try {
      const res = await vehicleService.createVehicle({
        ...newVehicle,
        licensePlate: newVehicle.licensePlate.trim().toUpperCase(),
      })
      if (res.success) {
        setIsAddModalOpen(false)
        setNewVehicle({
          licensePlate: '',
          model: 'VinFast eBus 2024 (EV)',
          vehicleType: 'electric',
          seatCapacity: 28,
          manufactureYear: new Date().getFullYear(),
          batteryCapacityKwh: 281.9,
        })
        await loadFleet()
      } else {
        setModalError(res.message || 'Không thể tạo phương tiện mới')
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi khi gửi dữ liệu')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Đổi trạng thái xe
  const handleUpdateStatus = async (id: string, status: 'active' | 'maintenance' | 'retired') => {
    try {
      const res = await vehicleService.updateStatus(id, status)
      if (res.success) {
        setFleet((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status } : item))
        )
      } else {
        alert(res.message || 'Không thể cập nhật trạng thái xe')
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi cập nhật trạng thái')
    }
  }

  // Xóa xe
  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa xe ${vehicle.licensePlate}? Thao tác này sẽ xóa toàn bộ sơ đồ 28 ghế của xe.`
      )
    ) {
      return
    }
    try {
      const res = await vehicleService.deleteVehicle(vehicle.id)
      if (res.success) {
        setFleet((prev) => prev.filter((v) => v.id !== vehicle.id))
      } else {
        alert(res.message || 'Không thể xóa xe này')
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa xe')
    }
  }

  // Xem sơ đồ ghế
  const handleViewSeats = async (vehicle: Vehicle) => {
    setViewingSeatsVehicle(vehicle)
    setLoadingSeats(true)
    try {
      const res = await vehicleService.getVehicleSeats(vehicle.id)
      if (res.success && Array.isArray(res.data)) {
        setSeats(res.data)
      } else {
        setSeats([])
      }
    } catch (err) {
      setSeats([])
    } finally {
      setLoadingSeats(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tiêu đề & Nút Hành động */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Quản Lý Đội Xe Buýt & Sơ Đồ Ghế
          </h1>
          <p className="text-sm text-muted-foreground">
            Theo dõi tình trạng kỹ thuật, cấu hình 28 ghế tiêu chuẩn và năng lượng xe điện từ Supabase DB
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadFleet}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/70 transition-colors disabled:opacity-50"
            title="Làm mới danh sách"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Đồng bộ</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
          >
            <Plus size={15} />
            <span>Thêm Xe Mới</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Thống kê thực tế */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Tổng số xe</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <Bus size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{totalBuses}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Xe đã đăng kiểm</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Đang lăn bánh</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">{activeBuses}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Sẵn sàng vận hành</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Bảo dưỡng định kỳ</span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
              <Wrench size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">{maintenanceBuses}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Trong xưởng kỹ thuật</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Xe buýt điện xanh</span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
              <Zap size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600">{electricBuses}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {totalBuses > 0 ? Math.round((electricBuses / totalBuses) * 100) : 0}% thân thiện môi trường
          </p>
        </div>
      </div>

      {/* Bộ lọc & Tìm kiếm */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-foreground text-background shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Tất cả ({fleet.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Đang hoạt động ({activeBuses})
          </button>
          <button
            onClick={() => setStatusFilter('maintenance')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'maintenance'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Bảo dưỡng ({maintenanceBuses})
          </button>
          <button
            onClick={() => setStatusFilter('retired')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'retired'
                ? 'bg-gray-600 text-white shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Ngừng chạy ({fleet.filter((v) => v.status === 'retired').length})
          </button>
        </div>

        <div className="relative w-full max-w-xs">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm biển số xe, dòng xe..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button
            onClick={loadFleet}
            className="font-semibold underline hover:no-underline"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Grid Danh sách Phương tiện */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 rounded-3xl border border-border bg-card p-6 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Bus size={36} className="mx-auto text-muted-foreground opacity-50 mb-3" />
          <h3 className="text-base font-semibold text-foreground">Không tìm thấy phương tiện nào</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {search ? 'Không có xe nào khớp với từ khóa tìm kiếm.' : 'Chưa có dữ liệu xe trong cơ sở dữ liệu.'}
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
          >
            <Plus size={14} /> Thêm xe đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const isElectric = item.vehicleType === 'electric'
            return (
              <div
                key={item.id}
                className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between hover:border-emerald-500/50 transition-all group"
              >
                <div>
                  {/* Header card: Biển số & Badge trạng thái */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-lg font-bold text-foreground flex items-center gap-2">
                      <Bus size={20} className="text-emerald-600 dark:text-emerald-400" />
                      {item.licensePlate}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        item.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : item.status === 'maintenance'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {item.status === 'active'
                        ? 'Đang hoạt động'
                        : item.status === 'maintenance'
                        ? 'Bảo dưỡng định kỳ'
                        : 'Ngừng vận hành'}
                    </span>
                  </div>

                  <p className="mt-2 text-xs font-medium text-muted-foreground">{item.model || 'Xe khách tuyến ICTU'}</p>

                  {/* Thông số kỹ thuật */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs border-t border-border pt-4">
                    <div>
                      <span className="text-muted-foreground">Sức chứa:</span>
                      <p className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                        <Armchair size={13} className="text-emerald-600" /> {item.seatCapacity} chỗ ngồi
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Động cơ:</span>
                      <p className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                        {isElectric ? (
                          <>
                            <Zap size={13} className="text-blue-500" /> Điện EV ({item.batteryCapacityKwh || 281.9} kWh)
                          </>
                        ) : (
                          <>
                            <Fuel size={13} className="text-amber-500" /> Diesel Euro 5
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Năm sản xuất:</span>
                      <p className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                        <Calendar size={13} className="text-muted-foreground" /> {item.manufactureYear || 2024}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Trạng thái ghế:</span>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-0.5">
                        <Layers size={13} /> Sẵn sàng gán
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer card: Thao tác thực tế */}
                <div className="mt-5 border-t border-border pt-4 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleViewSeats(item)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <Eye size={13} /> Sơ đồ 28 ghế
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* Nút chuyển trạng thái nhanh */}
                    {item.status === 'active' ? (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'maintenance')}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition-colors dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
                        title="Chuyển vào xưởng bảo dưỡng"
                      >
                        Bảo dưỡng
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'active')}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 transition-colors dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                        title="Kích hoạt xe trở lại hoạt động"
                      >
                        Lăn bánh
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteVehicle(item)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      title="Xóa phương tiện"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL THÊM XE MỚI */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Bus size={18} className="text-emerald-600" />
                Thêm Xe Buýt Vào Đội
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-xl p-1 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateVehicle} className="mt-4 flex flex-col gap-3.5">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Biển số xe <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 20B-088.99"
                  value={newVehicle.licensePlate}
                  onChange={(e) => setNewVehicle({ ...newVehicle, licensePlate: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-3 text-xs font-mono uppercase text-foreground focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Dòng xe / Nhãn hiệu</label>
                <input
                  type="text"
                  placeholder="Ví dụ: VinFast eBus 2024 (EV)"
                  value={newVehicle.model}
                  onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Loại động cơ</label>
                  <select
                    value={newVehicle.vehicleType}
                    onChange={(e) =>
                      setNewVehicle({
                        ...newVehicle,
                        vehicleType: e.target.value as 'electric' | 'diesel',
                      })
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-2.5 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="electric">Điện xanh EV</option>
                    <option value="diesel">Diesel Euro 5</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Năm sản xuất</label>
                  <input
                    type="number"
                    value={newVehicle.manufactureYear}
                    onChange={(e) =>
                      setNewVehicle({ ...newVehicle, manufactureYear: parseInt(e.target.value) || 2024 })
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {newVehicle.vehicleType === 'electric' && (
                <div>
                  <label className="text-xs font-semibold text-foreground">Dung lượng pin (kWh)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="281.9"
                    value={newVehicle.batteryCapacityKwh}
                    onChange={(e) =>
                      setNewVehicle({
                        ...newVehicle,
                        batteryCapacityKwh: parseFloat(e.target.value) || 281.9,
                      })
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <p className="font-semibold">⚡ Cấu hình sơ đồ 28 ghế tự động:</p>
                <p className="mt-0.5 text-[11px] opacity-90">
                  Hệ thống sẽ tự động khởi tạo 7 hàng ghế x 4 cột (01A - 07D), với hàng đầu tiên là ghế ưu tiên cho người già, phụ nữ mang thai và người khuyết tật.
                </p>
              </div>

              <div className="mt-2 flex items-center justify-end gap-2 pt-3 border-t border-border">
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
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Tạo & Khởi tạo 28 Ghế'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XEM SƠ ĐỒ 28 GHẾ */}
      {viewingSeatsVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Armchair size={18} className="text-emerald-600" />
                  Sơ đồ 28 Ghế: {viewingSeatsVehicle.licensePlate}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {viewingSeatsVehicle.model} ({viewingSeatsVehicle.seatCapacity} chỗ ngồi)
                </p>
              </div>
              <button
                onClick={() => setViewingSeatsVehicle(null)}
                className="rounded-xl p-1 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-4 flex items-center justify-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md bg-amber-500" /> Ghế ưu tiên (Hàng 1)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md bg-emerald-600" /> Ghế tiêu chuẩn
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md border border-dashed border-gray-400" /> Lối đi
              </span>
            </div>

            {/* Khung xe buýt */}
            <div className="flex-1 overflow-y-auto p-4 bg-muted/30 rounded-2xl border border-border">
              <div className="mx-auto max-w-[280px] rounded-2xl border-2 border-border bg-card p-4 shadow-inner">
                <div className="text-center font-bold text-xs uppercase tracking-wider text-muted-foreground pb-2 border-b border-border mb-3">
                  Đầu xe (Khu vực Tài xế)
                </div>

                {loadingSeats ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-emerald-600" />
                    Đang tải sơ đồ ghế...
                  </div>
                ) : seats.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Chưa có cấu hình ghế cho xe này.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* Render 7 hàng ghế */}
                    {Array.from({ length: 7 }, (_, rIdx) => {
                      const rowNum = rIdx + 1
                      const rowSeats = seats.filter((s) => s.rowNumber === rowNum)
                      const seatA = rowSeats.find((s) => s.columnLabel === 'A')
                      const seatB = rowSeats.find((s) => s.columnLabel === 'B')
                      const seatC = rowSeats.find((s) => s.columnLabel === 'C')
                      const seatD = rowSeats.find((s) => s.columnLabel === 'D')

                      return (
                        <div key={rowNum} className="flex items-center justify-between gap-1">
                          {/* Dãy trái: A, B */}
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-mono font-bold text-white shadow-sm ${
                                seatA?.seatType === 'priority' ? 'bg-amber-500' : 'bg-emerald-600'
                              }`}
                              title={`Ghế ${seatA?.seatNumber} (${seatA?.seatType})`}
                            >
                              {seatA?.seatNumber || `${rowNum}A`}
                            </div>
                            <div
                              className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-mono font-bold text-white shadow-sm ${
                                seatB?.seatType === 'priority' ? 'bg-amber-500' : 'bg-emerald-600'
                              }`}
                              title={`Ghế ${seatB?.seatNumber} (${seatB?.seatType})`}
                            >
                              {seatB?.seatNumber || `${rowNum}B`}
                            </div>
                          </div>

                          {/* Lối đi ở giữa */}
                          <div className="text-[10px] text-muted-foreground font-mono px-1">
                            {rowNum}
                          </div>

                          {/* Dãy phải: C, D */}
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-mono font-bold text-white shadow-sm ${
                                seatC?.seatType === 'priority' ? 'bg-amber-500' : 'bg-emerald-600'
                              }`}
                              title={`Ghế ${seatC?.seatNumber} (${seatC?.seatType})`}
                            >
                              {seatC?.seatNumber || `${rowNum}C`}
                            </div>
                            <div
                              className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-mono font-bold text-white shadow-sm ${
                                seatD?.seatType === 'priority' ? 'bg-amber-500' : 'bg-emerald-600'
                              }`}
                              title={`Ghế ${seatD?.seatNumber} (${seatD?.seatType})`}
                            >
                              {seatD?.seatNumber || `${rowNum}D`}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="text-center font-bold text-xs uppercase tracking-wider text-muted-foreground pt-3 border-t border-border mt-3">
                  Đuôi xe
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end border-t border-border pt-3">
              <button
                onClick={() => setViewingSeatsVehicle(null)}
                className="rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
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
