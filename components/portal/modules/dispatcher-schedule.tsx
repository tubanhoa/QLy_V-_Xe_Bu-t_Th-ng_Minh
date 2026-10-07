'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
  Sparkles,
  Zap,
  Flame,
  Layers,
  Info,
  SlidersHorizontal,
  LayoutGrid,
  Send,
  Table,
  CheckCheck,
  Bell,
  ShieldAlert,
} from 'lucide-react'
import { tripService, type TripItem } from '@/lib/services/trip.service'
import { vehicleService, type Vehicle } from '@/lib/services/vehicle.service'
import { userService, type BackendUser } from '@/lib/services/user.service'
import { transitService } from '@/lib/services/transit.service'
import type { TransitRoute } from '@/lib/types/transit'
import { GanttTimelineChart } from './dispatcher-gantt-chart'
import { RosterGroupedView } from './dispatcher-roster-view'

export function DispatcherSchedule() {
  const [trips, setTrips] = useState<TripItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Chế độ xem: Lưới Thẻ (Grid) / Lịch Gantt (Timeline) / Bảng Phân Công (Roster)
  const [viewMode, setViewMode] = useState<'grid' | 'gantt' | 'roster'>('grid')

  // Bộ lọc
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [tripTypeFilter, setTripTypeFilter] = useState<'all' | 'regular' | 'adhoc'>('all')
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'unassigned' | 'assigned'>('all')
  const [routeFilter, setRouteFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('')

  // Dữ liệu tài nguyên xe, tài xế, phụ xe & tuyến đường
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<BackendUser[]>([])
  const [conductors, setConductors] = useState<BackendUser[]>([])
  const [routes, setRoutes] = useState<TransitRoute[]>([])

  // Modal Điều Phối Xe, Tài Xế & Phụ Xe
  const [dispatchingTrip, setDispatchingTrip] = useState<TripItem | null>(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('')
  const [selectedDriverId, setSelectedDriverId] = useState<string>('')
  const [selectedConductorId, setSelectedConductorId] = useState<string>('')
  const [isSubmittingDispatch, setIsSubmittingDispatch] = useState(false)
  const [isNotifyingCrew, setIsNotifyingCrew] = useState<string | null>(null)

  // Hệ thống Toast Notification thay thế triệt để alert
  const [toasts, setToasts] = useState<
    Array<{ id: string; type: 'success' | 'error' | 'warning' | 'info'; message: string }>
  >([])

  // Hộp thoại xác nhận thay thế window.confirm
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: 'primary' | 'danger' | 'warning'
    onConfirm: () => void
  } | null>(null)

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
      const id = Math.random().toString(36).slice(2, 9)
      setToasts((prev) => [...prev, { id, type, message }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    },
    []
  )

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Modal Tạo Chuyến Tăng Cường (Ad-hoc)
  const [isAdhocModalOpen, setIsAdhocModalOpen] = useState(false)
  const [adhocRouteId, setAdhocRouteId] = useState('')
  const [adhocDepTime, setAdhocDepTime] = useState('')
  const [adhocVehicleId, setAdhocVehicleId] = useState('')
  const [adhocDriverId, setAdhocDriverId] = useState('')
  const [adhocNote, setAdhocNote] = useState('')
  const [isSubmittingAdhoc, setIsSubmittingAdhoc] = useState(false)

  // Modal Lập Lịch Khung Giờ (Rolling Window Scheduler)
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [genRouteId, setGenRouteId] = useState('')
  const [genDate, setGenDate] = useState('')
  const [genStartTime, setGenStartTime] = useState('05:30')
  const [genEndTime, setGenEndTime] = useState('21:00')
  const [genInterval, setGenInterval] = useState(30)
  const [isSubmittingGenerate, setIsSubmittingGenerate] = useState(false)

  // Thông báo phản hồi
  const [feedback, setFeedback] = useState<string | null>(null)

  // Tải danh sách chuyến xe từ Supabase API
  const loadTrips = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await tripService.getTrips({
        page: 1,
        limit: 100,
        status: statusFilter === 'all' ? undefined : statusFilter,
        tripType: tripTypeFilter === 'all' ? undefined : tripTypeFilter,
        assignmentStatus: assignmentFilter === 'all' ? undefined : assignmentFilter,
      })
      if (res.success && res.data) {
        setTrips(res.data.items || [])
      } else {
        setError(res.message || 'Không thể tải lịch trình chuyến xe')
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ chuyến xe')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, tripTypeFilter, assignmentFilter])

  // Tải tài nguyên phục vụ điều phối (Xe, Tài xế, Phụ xe, Tuyến)
  const loadDispatchResources = useCallback(async () => {
    try {
      const [vRes, dRes, rRes, cRes] = await Promise.all([
        vehicleService.getVehicles(),
        userService.getUsers({ role: 'driver', limit: 100 }),
        transitService.getRoutes(),
        userService.getUsers({ limit: 100 }),
      ])
      if (vRes.success && Array.isArray(vRes.data)) {
        setVehicles(vRes.data.filter((v) => v.status === 'active'))
      }
      if (dRes?.success && dRes.data?.items && Array.isArray(dRes.data.items)) {
        setDrivers(dRes.data.items)
      }
      if (rRes?.success && Array.isArray(rRes.data)) {
        setRoutes(rRes.data.filter((r) => r.status === 'active'))
      }
      if (cRes?.success && cRes.data?.items && Array.isArray(cRes.data.items)) {
        setConductors(cRes.data.items.filter((u) => u.status === 'active'))
      }
    } catch (err) {
      console.error('Error loading dispatch resources:', err)
    }
  }, [])

  useEffect(() => {
    loadTrips()
  }, [loadTrips])

  useEffect(() => {
    loadDispatchResources()
  }, [loadDispatchResources])

  // Thiết lập ngày mặc định cho modal generate
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setGenDate(today)

    // Thiết lập giờ khởi hành mặc định cho modal adhoc (1 giờ nữa)
    const nowPlus1h = new Date(Date.now() + 60 * 60 * 1000)
    nowPlus1h.setMinutes(Math.ceil(nowPlus1h.getMinutes() / 15) * 15, 0, 0)
    const offset = nowPlus1h.getTimezoneOffset() * 60000
    const localISOTime = new Date(nowPlus1h.getTime() - offset).toISOString().slice(0, 16)
    setAdhocDepTime(localISOTime)
  }, [])

  // Mở modal điều phối
  const handleOpenDispatch = (trip: TripItem) => {
    setDispatchingTrip(trip)
    setSelectedVehicleId(trip.vehicleId || trip.vehicle?.id || '')
    setSelectedDriverId(trip.driverId || trip.driver?.id || '')
    setSelectedConductorId(trip.conductorId || trip.conductor?.id || '')
  }

  // Lưu điều phối xe, tài xế & phụ xe
  const handleSaveDispatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dispatchingTrip) return

    if (!selectedVehicleId) {
      showToast('Vui lòng chọn xe buýt phục vụ chuyến này!', 'warning')
      return
    }
    if (!selectedDriverId) {
      showToast('Vui lòng phân công tài xế cầm lái!', 'warning')
      return
    }

    setIsSubmittingDispatch(true)
    try {
      const res = await tripService.dispatchTrip({
        tripId: dispatchingTrip.id,
        vehicleId: selectedVehicleId,
        driverId: selectedDriverId,
        conductorId: selectedConductorId || undefined,
      })
      if (res.success) {
        showToast('Đã điều phối thành công xe, tài xế và gửi lịch cho tổ xe!', 'success')
        setDispatchingTrip(null)
        await loadTrips()
      } else {
        showToast(res.message || 'Không thể điều phối chuyến này', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi gửi thông tin điều phối', 'error')
    } finally {
      setIsSubmittingDispatch(false)
    }
  }

  // Gửi thông báo lịch trình đến tổ xe của 1 chuyến cụ thể
  const handleNotifyCrew = async (tripId: string) => {
    setIsNotifyingCrew(tripId)
    try {
      const res = await tripService.notifyCrew(tripId)
      if (res.success) {
        showToast('Đã gửi thông báo & cập nhật lịch trình thành công đến Tổ xe!', 'success')
      } else {
        showToast(res.message || 'Không thể gửi thông báo cho tổ xe', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi gửi thông báo tổ xe', 'error')
    } finally {
      setIsNotifyingCrew(null)
    }
  }

  // Gửi thông báo lịch trình toàn bộ ca làm việc (1-Click Notify All với Hộp thoại xác nhận)
  const handleNotifyAllCrew = async () => {
    const assignedTripIds = trips
      .filter((t) => t.vehicleId || t.driverId || t.vehicle || t.driver)
      .map((t) => t.id)
    if (assignedTripIds.length === 0) {
      showToast('Không có chuyến xe nào đã được phân công để gửi thông báo!', 'info')
      return
    }

    setConfirmDialog({
      title: 'Gửi Thông Báo Lịch Trình Toàn Ca',
      message: `Hệ thống sẽ gửi thông báo đẩy qua ứng dụng và cập nhật lịch trình làm việc đến toàn bộ tổ xe của ${assignedTripIds.length} chuyến đã được phân công. Bạn có chắc chắn muốn gửi ngay?`,
      confirmText: 'Gửi Toàn Bộ Ngay',
      variant: 'primary',
      onConfirm: async () => {
        setIsNotifyingCrew('all')
        try {
          const res = await tripService.notifyAllCrewForTrips(assignedTripIds)
          if (res.successCount > 0) {
            showToast(
              `Đã gửi thông báo thành công cho ${res.successCount}/${assignedTripIds.length} tổ xe ca trực!`,
              'success'
            )
          } else {
            showToast(
              `Không thể gửi thông báo: ${res.errors.join(', ') || 'Vui lòng kiểm tra lại cấu hình thông báo'}`,
              'error'
            )
          }
        } catch (err: any) {
          showToast(err.message || 'Lỗi kết nối khi gửi thông báo toàn ca', 'error')
        } finally {
          setIsNotifyingCrew(null)
        }
      },
    })
  }

  // Tính toán xung đột lịch trình tức thời (Real-time conflict pre-check)
  const dispatchConflict = useMemo(() => {
    if (!dispatchingTrip) return null

    const depStart = new Date(dispatchingTrip.departureTime).getTime()
    const depEnd = dispatchingTrip.arrivalTime
      ? new Date(dispatchingTrip.arrivalTime).getTime()
      : depStart + 45 * 60 * 1000

    let vehicleConflictTrip: TripItem | null = null
    let driverConflictTrip: TripItem | null = null
    let conductorConflictTrip: TripItem | null = null

    for (const t of trips) {
      if (t.id === dispatchingTrip.id || t.status === 'cancelled') continue

      const tStart = new Date(t.departureTime).getTime()
      const tEnd = t.arrivalTime ? new Date(t.arrivalTime).getTime() : tStart + 45 * 60 * 1000

      const isOverlap = depStart < tEnd && depEnd > tStart
      if (!isOverlap) continue

      if (
        selectedVehicleId &&
        (t.vehicleId === selectedVehicleId || t.vehicle?.id === selectedVehicleId)
      ) {
        vehicleConflictTrip = t
      }
      if (
        selectedDriverId &&
        (t.driverId === selectedDriverId || t.driver?.id === selectedDriverId)
      ) {
        driverConflictTrip = t
      }
      if (
        selectedConductorId &&
        (t.conductorId === selectedConductorId || t.conductor?.id === selectedConductorId)
      ) {
        conductorConflictTrip = t
      }
    }

    return {
      hasConflict: Boolean(vehicleConflictTrip || driverConflictTrip || conductorConflictTrip),
      vehicleConflictTrip,
      driverConflictTrip,
      conductorConflictTrip,
    }
  }, [dispatchingTrip, selectedVehicleId, selectedDriverId, selectedConductorId, trips])

  // Xử lý tạo Chuyến Tăng Cường (Ad-hoc)
  const handleCreateAdhocTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adhocRouteId) {
      showToast('Vui lòng chọn tuyến xe cần tăng cường!', 'warning')
      return
    }
    if (!adhocDepTime) {
      showToast('Vui lòng chọn thời gian khởi hành!', 'warning')
      return
    }

    setIsSubmittingAdhoc(true)
    try {
      const departureDate = new Date(adhocDepTime)
      const res = await tripService.createAdhocTrip({
        routeId: adhocRouteId,
        departureTime: departureDate.toISOString(),
        vehicleId: adhocVehicleId || undefined,
        driverId: adhocDriverId || undefined,
        tripType: 'adhoc',
        note: adhocNote.trim() || 'Chuyến tăng cường giải tỏa cao điểm',
      })

      if (res.success) {
        showToast('Đã tạo thành công chuyến xe tăng cường thực tế!', 'success')
        setIsAdhocModalOpen(false)
        setAdhocNote('')
        setAdhocVehicleId('')
        setAdhocDriverId('')
        await loadTrips()
      } else {
        showToast(res.message || 'Không thể tạo chuyến tăng cường', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi kết nối khi tạo chuyến tăng cường', 'error')
    } finally {
      setIsSubmittingAdhoc(false)
    }
  }

  // Xử lý kích hoạt Sinh Khung Giờ (Rolling Window Scheduler)
  const handleGenerateSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!genRouteId) {
      showToast('Vui lòng chọn tuyến xe cần sinh lịch!', 'warning')
      return
    }
    if (!genDate) {
      showToast('Vui lòng chọn ngày áp dụng!', 'warning')
      return
    }

    // Validation thời gian: Giờ bắt đầu < Giờ kết thúc & Khoảng cách phút hợp lệ
    if (genStartTime && genEndTime) {
      const [startH, startM] = genStartTime.split(':').map(Number)
      const [endH, endM] = genEndTime.split(':').map(Number)
      const startMinutes = startH * 60 + startM
      const endMinutes = endH * 60 + endM

      if (startMinutes >= endMinutes) {
        showToast(
          `Giờ bắt đầu ca chạy (${genStartTime}) phải sớm hơn Giờ kết thúc (${genEndTime})!`,
          'error'
        )
        return
      }

      const totalSpan = endMinutes - startMinutes
      const intervalNum = Number(genInterval) || 30
      if (intervalNum <= 0) {
        showToast('Tần suất chạy xe phải lớn hơn 0 phút!', 'warning')
        return
      }
      if (totalSpan < intervalNum) {
        showToast(
          `Khoảng thời gian vận hành (${totalSpan} phút) không đủ để bố trí tần suất ${intervalNum} phút/chuyến!`,
          'warning'
        )
        return
      }
    }

    setIsSubmittingGenerate(true)
    try {
      const res = await tripService.generateSchedule({
        routeId: genRouteId,
        date: genDate,
        startTime: genStartTime ? `${genStartTime}:00` : '05:30:00',
        endTime: genEndTime ? `${genEndTime}:00` : '21:00:00',
        intervalMinutes: Number(genInterval) || 30,
      })

      if (res.success) {
        showToast(
          `Đã sinh tự động ${res.data?.length || 0} chuyến định kỳ (chờ điều xe)!`,
          'success'
        )
        setIsGenerateModalOpen(false)
        await loadTrips()
      } else {
        showToast(res.message || 'Không thể sinh lịch trình tự động', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi kích hoạt sinh lịch trình', 'error')
    } finally {
      setIsSubmittingGenerate(false)
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
        showToast('Đã cập nhật trạng thái chuyến xe!', 'success')
      } else {
        showToast(res.message || 'Không thể cập nhật trạng thái', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi cập nhật trạng thái chuyến', 'error')
    }
  }

  // Lọc tìm kiếm phía Client (Tuyến xe, Ngày áp dụng, Trạng thái, Tìm kiếm)
  const filtered = trips.filter((s) => {
    // 1. Lọc theo tuyến đường
    if (routeFilter !== 'all') {
      const matchRoute =
        s.routeId === routeFilter ||
        s.route?.id === routeFilter ||
        s.route?.routeCode === routeFilter
      if (!matchRoute) return false
    }

    // 2. Lọc theo ngày áp dụng
    if (dateFilter) {
      if (!s.departureTime) return false
      try {
        const tripDateStr = new Date(s.departureTime).toISOString().split('T')[0]
        if (tripDateStr !== dateFilter) return false
      } catch {
        return false
      }
    }

    // 3. Tìm kiếm từ khóa text
    const sId = (s.id || '').toLowerCase()
    const rName = (s.route?.name || '').toLowerCase()
    const rCode = (s.route?.routeCode || '').toLowerCase()
    const vPlate = (s.vehicle?.licensePlate || '').toLowerCase()
    const dName = (s.driver?.fullName || '').toLowerCase()
    const note = (s.note || '').toLowerCase()
    const q = search.toLowerCase()
    return (
      sId.includes(q) ||
      rName.includes(q) ||
      rCode.includes(q) ||
      vPlate.includes(q) ||
      dName.includes(q) ||
      note.includes(q)
    )
  })

  // Thống kê nhanh
  const totalCount = trips.length
  const regularCount = trips.filter((t) => t.tripType === 'regular' || !t.tripType).length
  const adhocCount = trips.filter((t) => t.tripType === 'adhoc' || t.tripType === 'special').length
  const unassignedCount = trips.filter((t) => !t.vehicleId && !t.vehicle && !t.driverId && !t.driver).length

  const scheduledCount = trips.filter((t) => t.status === 'scheduled').length
  const runningCount = trips.filter(
    (t) => t.status === 'in_progress' || t.status === 'boarding' || t.status === 'departed'
  ).length
  const completedCount = trips.filter((t) => t.status === 'completed').length

  return (
    <div className="flex flex-col gap-6">
      {/* HEADER CHÍNH */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Lịch Trình Chạy Xe & Điều Phối Tuyến
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Zap size={12} className="fill-emerald-500 text-emerald-500" />
                Rolling Window Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Phân loại biểu đồ vận hành giữa các chuyến thực tế, theo dõi lịch Gantt trực quan và kiểm soát phân công tổ xe
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Nút Gửi Lịch Toàn Ca (1-Click Notify All) */}
            <button
              onClick={handleNotifyAllCrew}
              disabled={isNotifyingCrew !== null || loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              title="Gửi thông báo & cập nhật lịch trình làm việc đến toàn bộ tài xế và phụ xe đã phân công"
            >
              <Send size={14} className={isNotifyingCrew === 'all' ? 'animate-pulse' : ''} />
              <span>{isNotifyingCrew === 'all' ? 'Đang gửi thông báo...' : 'Gửi Lịch Toàn Ca (1-Click)'}</span>
            </button>

            {/* Nút Tạo Chuyến Tăng Cường (Adhoc) */}
            <button
              onClick={() => setIsAdhocModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              title="Thêm chuyến phát sinh thực tế / giờ cao điểm"
            >
              <Flame size={14} className="shrink-0" />
              <span>+ Chuyến Tăng Cường</span>
            </button>

            {/* Nút Sinh Lịch Trình Tự Động (Generate Schedule) */}
            <button
              onClick={() => setIsGenerateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              title="Kích hoạt tự động sinh khung giờ cố định"
            >
              <Sparkles size={14} className="shrink-0" />
              <span>⚙️ Lập Lịch Khung Giờ</span>
            </button>

            {/* Nút Refresh */}
            <button
              onClick={loadTrips}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/70 transition-colors disabled:opacity-50 cursor-pointer"
              title="Đồng bộ dữ liệu từ Supabase Cloud DB"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Đồng bộ DB</span>
            </button>
          </div>
        </div>

        {/* THANH CHUYỂN ĐỔI CHẾ ĐỘ XEM (VIEW MODE SWITCHER) */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 rounded-2xl bg-muted/40 border border-border">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <LayoutGrid size={14} className={viewMode === 'grid' ? 'text-emerald-600' : ''} />
              <span>Lưới Thẻ Chuyến</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('gantt')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'gantt'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <Calendar size={14} />
              <span>Lịch Gantt (Timeline)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${viewMode === 'gantt' ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-600'}`}>
                Trực quan
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('roster')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'roster'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <Users size={14} />
              <span>Bảng Phân Công (Roster)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${viewMode === 'roster' ? 'bg-white/20 text-white' : 'bg-indigo-500/10 text-indigo-600'}`}>
                Theo Xe / Tài xế
              </span>
            </button>
          </div>

          <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-2 pr-2">
            <span>Hiển thị: <strong>{filtered.length}</strong> / {totalCount} chuyến</span>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 shadow-sm">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* BANNER ĐIỀU HÀNH & KIỂM SOÁT CƠ CHẾ LẬP LỊCH TỰ ĐỘNG (ROLLING WINDOW SCHEDULER) */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Sparkles size={14} />
              </span>
              <h2 className="text-sm font-bold text-foreground tracking-tight">
                Cơ Chế Rolling Window Scheduler & Phân Loại Vận Hành Thực Tế
              </h2>
            </div>
            <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
              Hệ thống tự động duy trì lịch trình trượt động <strong>3 ngày tới (T+3)</strong> với trạng thái{' '}
              <span className="text-amber-600 dark:text-amber-400 font-semibold">Chờ gán xe (Unassigned)</span>{' '}
              giúp điều độ viên linh hoạt điều phối xe & tài xế theo thực tế. Các chuyến tăng cường (Ad-hoc) phục vụ
              giải tỏa ùn ứ hoặc sự kiện phát sinh được tách biệt rõ ràng để quản trị và đối soát minh bạch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="rounded-2xl border border-border bg-background/80 px-3 py-2 text-center shadow-xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Cửa Sổ Lập Lịch</span>
              <span className="font-mono text-xs font-extrabold text-foreground">3 Ngày Trượt (T+3)</span>
            </div>
            <div className="rounded-2xl border border-border bg-background/80 px-3 py-2 text-center shadow-xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Định Kỳ Tự Động</span>
              <span className="font-mono text-xs font-extrabold text-blue-600 dark:text-blue-400">
                {regularCount} chuyến
              </span>
            </div>
            <div className="rounded-2xl border border-border bg-background/80 px-3 py-2 text-center shadow-xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Tăng Cường Thực Tế</span>
              <span className="font-mono text-xs font-extrabold text-amber-600 dark:text-amber-400">
                {adhocCount} chuyến
              </span>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center shadow-xs">
              <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 block">
                Cần Điều Phối
              </span>
              <span className="font-mono text-xs font-extrabold text-amber-600 dark:text-amber-400">
                {unassignedCount} chuyến
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI CARDS VẬN HÀNH */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Tổng số chuyến</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <Bus size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{totalCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Biểu đồ đang hiển thị</p>
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

      {/* THANH BỘ LỌC PHÂN LOẠI & TÌM KIẾM */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        {/* Hàng 1: Trạng thái chuyến & Nguồn chuyến */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Lọc Trạng thái vận hành */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Filter size={13} /> Trạng thái:
            </span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-foreground text-background shadow-xs'
                  : 'bg-muted/50 border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              Tất cả ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter('scheduled')}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'scheduled'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-muted/50 border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              Chờ chạy ({scheduledCount})
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'in_progress'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-muted/50 border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              Đang chạy ({runningCount})
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-gray-700 text-white shadow-xs'
                  : 'bg-muted/50 border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              Hoàn thành ({completedCount})
            </button>
          </div>

          {/* Ô Tìm Kiếm */}
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm mã chuyến, tuyến, biển số, tài xế..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Hàng 2: Phân loại Nguồn Chuyến (Regular vs Ad-hoc) & Phân công tài nguyên */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          {/* Lọc Loại chuyến */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Layers size={13} /> Nguồn chuyến:
            </span>
            <button
              onClick={() => setTripTypeFilter('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                tripTypeFilter === 'all'
                  ? 'bg-foreground text-background shadow-xs'
                  : 'bg-muted/50 border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              Tất cả nguồn
            </button>
            <button
              onClick={() => setTripTypeFilter('regular')}
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                tripTypeFilter === 'regular'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20'
              }`}
            >
              <Zap size={12} />
              ⚡ Định kỳ tự động ({regularCount})
            </button>
            <button
              onClick={() => setTripTypeFilter('adhoc')}
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                tripTypeFilter === 'adhoc'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              <Flame size={12} />
              🔥 Tăng cường thực tế ({adhocCount})
            </button>
          </div>

          {/* Lọc Trạng thái phân công */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <SlidersHorizontal size={13} /> Phân công:
            </span>
            <button
              onClick={() => setAssignmentFilter('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                assignmentFilter === 'all'
                  ? 'bg-foreground text-background shadow-xs'
                  : 'bg-muted/50 border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setAssignmentFilter('unassigned')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                assignmentFilter === 'unassigned'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              ⚠️ Chưa gán Xe/Tài xế ({unassignedCount})
            </button>
            <button
              onClick={() => setAssignmentFilter('assigned')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                assignmentFilter === 'assigned'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
              }`}
            >
              ✅ Đã gán đầy đủ ({totalCount - unassignedCount})
            </button>
          </div>
        </div>

        {/* Hàng 3: Lọc chi tiết theo Tuyến xe buýt & Ngày áp dụng */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Bus size={13} /> Lọc theo tuyến:
            </span>
            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="h-8.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-emerald-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả các tuyến ({routes.length})</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  [{r.routeCode}] {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Calendar size={13} /> Lọc theo ngày:
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-8.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-emerald-500 focus:outline-none cursor-pointer"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  title="Xóa lọc theo ngày"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            {(routeFilter !== 'all' || dateFilter) && (
              <button
                type="button"
                onClick={() => {
                  setRouteFilter('all')
                  setDateFilter('')
                }}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline px-1 cursor-pointer"
              >
                Đặt lại bộ lọc
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={loadTrips} className="font-semibold underline cursor-pointer">
            Thử lại
          </button>
        </div>
      )}

      {/* NỘI DUNG HIỂN THỊ CHÍNH (GANTT / ROSTER / GRID) */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 rounded-3xl border border-border bg-card p-6 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center text-xs text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">Không tìm thấy chuyến xe nào phù hợp bộ lọc.</p>
          <p>Thử đổi bộ lọc loại chuyến, trạng thái hoặc bấm &quot;+ Chuyến Tăng Cường&quot; để bổ sung chuyến mới.</p>
        </div>
      ) : viewMode === 'gantt' ? (
        <GanttTimelineChart
          trips={filtered}
          vehicles={vehicles}
          drivers={drivers}
          onOpenDispatch={handleOpenDispatch}
          onNotifyCrew={handleNotifyCrew}
          selectedDate={dateFilter}
        />
      ) : viewMode === 'roster' ? (
        <RosterGroupedView
          trips={filtered}
          vehicles={vehicles}
          drivers={drivers}
          onOpenDispatch={handleOpenDispatch}
          onNotifyCrew={handleNotifyCrew}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const depDate = new Date(item.departureTime)
            const arrDate = item.arrivalTime ? new Date(item.arrivalTime) : null
            const isRunning = item.status === 'in_progress' || item.status === 'boarding'
            const isAdhoc = item.tripType === 'adhoc' || item.tripType === 'special'
            const isAssigned = Boolean((item.vehicleId || item.vehicle) && (item.driverId || item.driver))

            return (
              <div
                key={item.id}
                className={`rounded-3xl border bg-card p-5 shadow-sm flex flex-col justify-between transition-all ${
                  isAdhoc
                    ? 'border-amber-500/40 hover:border-amber-500/70 hover:shadow-md'
                    : 'border-border hover:border-emerald-500/40'
                }`}
              >
                <div>
                  {/* HÀNG HEADER THẺ: MÃ TUYẾN + BADGE NGUỒN CHUYẾN + TRẠNG THÁI */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Bus size={16} className={isAdhoc ? 'text-amber-500' : 'text-emerald-600'} />
                      {item.route?.routeCode || 'CT-ICTU'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {/* Badge Nguồn Chuyến: Định kỳ vs Tăng cường */}
                      {isAdhoc ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                          <Flame size={11} className="fill-amber-500 text-amber-500" />
                          Tăng Cường Thực Tế
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                          <Zap size={11} className="fill-blue-500 text-blue-500" />
                          Định Kỳ Tự Động
                        </span>
                      )}

                      {/* Badge Trạng thái chạy */}
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
                  </div>

                  {/* TÊN TUYẾN XE */}
                  <h3 className="mt-2.5 text-sm font-bold text-foreground line-clamp-1" title={item.route?.name}>
                    {item.route?.name || 'Tuyến xe buýt ICTU'}
                  </h3>

                  {/* GHI CHÚ NẾU CÓ */}
                  {item.note && (
                    <div className="mt-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                      📝 {item.note}
                    </div>
                  )}

                  {/* THỜI GIAN XUẤT BẾN & ĐẾN NƠI */}
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/40 p-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Clock size={15} className="text-muted-foreground shrink-0" />
                      <div>
                        <span className="font-bold text-foreground">
                          {depDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {arrDate && (
                          <span className="text-muted-foreground">
                            {' '}
                            → {arrDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground ml-2">
                          Ngày {depDate.toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* TÀI NGUYÊN ĐÃ GÁN (XE & TÀI XẾ & PHỤ XE) */}
                  <div className="mt-3 space-y-1.5 text-xs border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Xe buýt:</span>
                      <span className="font-mono font-bold text-foreground">
                        {item.vehicle?.licensePlate || (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            Chưa gán xe
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tài xế:</span>
                      <span className="font-medium text-foreground">
                        {item.driver?.fullName || (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            Chưa phân công
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Phụ xe:</span>
                      <span className="font-medium text-foreground">
                        {item.conductor?.fullName || (
                          <span className="text-[11px] text-muted-foreground">Tự động soát vé</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Ghế khả dụng:</span>
                      <span className="font-mono font-semibold text-emerald-600">
                        {item.availableSeats !== undefined
                          ? `${item.availableSeats} / ${item.totalSeats || item.vehicle?.seatCapacity || 28}`
                          : '28 / 28 chỗ'}
                      </span>
                    </div>

                    {!isAssigned && (
                      <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                        <AlertTriangle size={12} className="shrink-0" />
                        <span>Cần gán xe & tài xế trước giờ xuất bến</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* FOOTER ACTIONS */}
                <div className="mt-5 border-t border-border pt-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenDispatch(item)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      <Edit2 size={13} /> Điều xe & Phân tài xế
                    </button>

                    {(item.driverId || item.driver || item.conductorId || item.conductor) && (
                      <button
                        type="button"
                        onClick={() => handleNotifyCrew(item.id)}
                        disabled={isNotifyingCrew === item.id}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer disabled:opacity-50 ml-1"
                        title="Gửi thông báo & cập nhật lịch trình cho tổ xe"
                      >
                        <Send size={11} className={isNotifyingCrew === item.id ? 'animate-pulse' : ''} />
                        <span>{isNotifyingCrew === item.id ? 'Đang gửi...' : 'Gửi Lịch'}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {item.status === 'scheduled' && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                        title="Bắt đầu chạy chuyến"
                      >
                        Khởi hành
                      </button>
                    )}
                    {isRunning && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'completed')}
                        className="rounded-lg bg-gray-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-gray-800 transition-colors cursor-pointer"
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

      {/* ========================================================================= */}
      {/* MODAL 1: ĐIỀU XE & PHÂN CÔNG TÀI XẾ                                       */}
      {/* ========================================================================= */}
      {dispatchingTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Bus size={18} className="text-emerald-600" />
                  Điều Phối & Phân Công Chuyến Xe
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  [{dispatchingTrip.route?.routeCode || 'CT'}] {dispatchingTrip.route?.name}
                </p>
              </div>
              <button
                onClick={() => setDispatchingTrip(null)}
                className="rounded-xl p-1 text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* CẢNH BÁO XUNG ĐỘT TRỰC QUAN (REAL-TIME PRE-CHECK ALERT) */}
            {dispatchConflict?.hasConflict && (
              <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-700 dark:text-red-300 space-y-1.5 animate-in fade-in">
                <div className="flex items-center gap-1.5 font-bold text-red-600 dark:text-red-400">
                  <ShieldAlert size={16} className="shrink-0" />
                  <span>CẢNH BÁO XUNG ĐỘT LỊCH TRÌNH VẬN HÀNH:</span>
                </div>
                {dispatchConflict.vehicleConflictTrip && (
                  <p className="text-[11px] leading-relaxed">
                    • <strong>Trùng lịch xe:</strong> Xe buýt đã được xếp cho chuyến [
                    {dispatchConflict.vehicleConflictTrip.route?.routeCode || 'CT'}]{' '}
                    {dispatchConflict.vehicleConflictTrip.route?.name} lúc{' '}
                    {new Date(dispatchConflict.vehicleConflictTrip.departureTime).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    ! Vui lòng chọn xe buýt khác để tránh bị trùng lịch.
                  </p>
                )}
                {dispatchConflict.driverConflictTrip && (
                  <p className="text-[11px] leading-relaxed">
                    • <strong>Trùng lịch tài xế:</strong> Tài xế đã có ca chạy trên chuyến [
                    {dispatchConflict.driverConflictTrip.route?.routeCode || 'CT'}]{' '}
                    {dispatchConflict.driverConflictTrip.route?.name} lúc{' '}
                    {new Date(dispatchConflict.driverConflictTrip.departureTime).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    !
                  </p>
                )}
                {dispatchConflict.conductorConflictTrip && (
                  <p className="text-[11px] leading-relaxed">
                    • <strong>Trùng lịch phụ xe:</strong> Phụ xe đã có ca trực trên chuyến [
                    {dispatchConflict.conductorConflictTrip.route?.routeCode || 'CT'}]{' '}
                    {dispatchConflict.conductorConflictTrip.route?.name} lúc{' '}
                    {new Date(dispatchConflict.conductorConflictTrip.departureTime).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    !
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleSaveDispatch} className="mt-4 flex flex-col gap-4">
              {/* 1. CHỌN XE BUÝT */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Chọn Xe Buýt Phục Vụ <span className="text-red-500">*</span>
                  </label>
                  {selectedVehicleId && (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Sức chứa:{' '}
                      {vehicles.find((v) => v.id === selectedVehicleId)?.seatCapacity || 28} chỗ
                    </span>
                  )}
                </div>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className={`mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs font-semibold text-foreground focus:outline-none cursor-pointer ${
                    dispatchConflict?.vehicleConflictTrip
                      ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/30'
                      : 'border-border focus:border-emerald-500'
                  }`}
                  required
                >
                  <option value="">-- Chọn phương tiện xe buýt --</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.licensePlate} ({v.model} - {v.seatCapacity} chỗ - {v.vehicleType})
                    </option>
                  ))}
                </select>
                {dispatchConflict?.vehicleConflictTrip && (
                  <span className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1 block">
                    ⚠️ Xe đang trùng lịch chạy ở chuyến khác!
                  </span>
                )}
              </div>

              {/* 2. CHỌN TÀI XẾ */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Phân công Tài xế Cầm Lái <span className="text-red-500">*</span>
                  </label>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    <CheckCircle2 size={12} /> Bằng lái Hạng D/E
                  </span>
                </div>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className={`mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs font-semibold text-foreground focus:outline-none cursor-pointer ${
                    dispatchConflict?.driverConflictTrip
                      ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/30'
                      : 'border-border focus:border-emerald-500'
                  }`}
                  required
                >
                  <option value="">-- Chọn tài xế đủ điều kiện --</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} (SĐT: {d.phoneNumber || 'Chưa cập nhật'})
                    </option>
                  ))}
                </select>
                {dispatchConflict?.driverConflictTrip ? (
                  <span className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1 block">
                    ⚠️ Tài xế đang có ca chạy trùng khung giờ này!
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground mt-1 block">
                    Đã kiểm tra chứng chỉ hành nghề và thời hạn GPLX hợp lệ
                  </span>
                )}
              </div>

              {/* 3. CHỌN PHỤ XE / SOÁT VÉ */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Phụ xe / Soát vé viên <span className="text-muted-foreground font-normal">(Tùy chọn)</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground">Soát vé QR di động</span>
                </div>
                <select
                  value={selectedConductorId}
                  onChange={(e) => setSelectedConductorId(e.target.value)}
                  className={`mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs font-semibold text-foreground focus:outline-none cursor-pointer ${
                    dispatchConflict?.conductorConflictTrip
                      ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/30'
                      : 'border-border focus:border-emerald-500'
                  }`}
                >
                  <option value="">-- Tự động soát vé / Không phân công phụ xe --</option>
                  {conductors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} (SĐT: {c.phoneNumber || 'N/A'})
                    </option>
                  ))}
                </select>
                {dispatchConflict?.conductorConflictTrip && (
                  <span className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1 block">
                    ⚠️ Phụ xe đang trùng ca trực ở chuyến khác!
                  </span>
                )}
              </div>

              {/* TÓM TẮT THỜI GIAN VẬN HÀNH */}
              <div className="rounded-2xl bg-muted/40 border border-border p-3.5 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Loại chuyến:</span>
                  <span className="font-bold text-foreground">
                    {dispatchingTrip.tripType === 'adhoc' ? '🔥 Tăng cường thực tế' : '⚡ Định kỳ tự động'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Giờ xuất bến:</span>
                  <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {new Date(dispatchingTrip.departureTime).toLocaleTimeString('vi-VN')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ngày áp dụng:</span>
                  <span className="font-medium text-foreground">
                    {new Date(dispatchingTrip.departureTime).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border/50 pt-1.5">
                  <span className="text-muted-foreground">Tự động thông báo:</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 text-[11px]">
                    <Send size={11} /> Gửi push app ngay khi xác nhận
                  </span>
                </div>
              </div>

              {/* NÚT THAO TÁC */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setDispatchingTrip(null)}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispatch}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingDispatch ? (
                    'Đang xử lý...'
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Xác Nhận & Gửi Lịch Tổ Xe</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: TẠO CHUYẾN TĂNG CƯỜNG THỰC TẾ (ADHOC TRIP)                       */}
      {/* ========================================================================= */}
      {isAdhocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Flame size={18} className="text-amber-500 fill-amber-500" />
                  Tạo Chuyến Xe Tăng Cường (Thực Tế)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Phục vụ nhu cầu giải tỏa hành khách giờ cao điểm, sự kiện hoặc xe thay thế đột xuất
                </p>
              </div>
              <button
                onClick={() => setIsAdhocModalOpen(false)}
                className="rounded-xl p-1 text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAdhocTrip} className="mt-4 flex flex-col gap-4">
              {/* Tuyến Xe */}
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Tuyến Xe Buýt <span className="text-red-500">*</span>
                </label>
                <select
                  value={adhocRouteId}
                  onChange={(e) => setAdhocRouteId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-amber-500 focus:outline-none"
                  required
                >
                  <option value="">-- Chọn tuyến xe buýt --</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      [{r.routeCode}] {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Thời Điểm Khởi Hành */}
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Thời Gian Khởi Hành (Thực tế) <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={adhocDepTime}
                  onChange={(e) => setAdhocDepTime(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              {/* Gán Xe Buýt (Tùy chọn) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Phương Tiện (Tùy chọn)
                  </label>
                  <select
                    value={adhocVehicleId}
                    onChange={(e) => setAdhocVehicleId(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">-- Gán sau --</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.licensePlate} ({v.seatCapacity} chỗ)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Tài Xế (Tùy chọn)
                  </label>
                  <select
                    value={adhocDriverId}
                    onChange={(e) => setAdhocDriverId(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">-- Phân công sau --</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ghi chú lý do */}
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Lý Do / Ghi Chú Tăng Cường
                </label>
                <input
                  type="text"
                  placeholder="VD: Tăng cường giải tỏa khách tại trạm ICTU giờ tan học ca chiều"
                  value={adhocNote}
                  onChange={(e) => setAdhocNote(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                <span className="font-bold">Lưu ý nghiệp vụ:</span> Chuyến xe tăng cường sẽ được gắn nhãn{' '}
                <strong>[🔥 Tăng cường thực tế]</strong> để đối soát doanh thu vé bán phát sinh ngoài kế hoạch định kỳ.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAdhocModalOpen(false)}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdhoc}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingAdhoc ? 'Đang tạo chuyến...' : 'Xác Nhận Thêm Chuyến'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: KÍCH HOẠT / SINH LỊCH TRÌNH KHUNG GIỜ (ROLLING WINDOW SCHEDULER)   */}
      {/* ========================================================================= */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Sparkles size={18} className="text-emerald-600" />
                  Lập Lịch Khung Giờ Định Kỳ
                </h2>
                <p className="text-xs text-muted-foreground">
                  Kích hoạt cơ chế Rolling Window tự động tạo chuỗi chuyến chạy cố định
                </p>
              </div>
              <button
                onClick={() => setIsGenerateModalOpen(false)}
                className="rounded-xl p-1 text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGenerateSchedule} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Tuyến Xe Buýt Cần Sinh Lịch <span className="text-red-500">*</span>
                </label>
                <select
                  value={genRouteId}
                  onChange={(e) => setGenRouteId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-emerald-500 focus:outline-none"
                  required
                >
                  <option value="">-- Chọn tuyến xe buýt --</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      [{r.routeCode}] {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Ngày Áp Dụng (YYYY-MM-DD) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={genDate}
                  onChange={(e) => setGenDate(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Giờ bắt đầu</label>
                  <input
                    type="time"
                    value={genStartTime}
                    onChange={(e) => setGenStartTime(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Giờ kết thúc</label>
                  <input
                    type="time"
                    value={genEndTime}
                    onChange={(e) => setGenEndTime(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Validation cảnh báo thời gian trực quan */}
              {(() => {
                if (!genStartTime || !genEndTime) return null
                const [sH, sM] = genStartTime.split(':').map(Number)
                const [eH, eM] = genEndTime.split(':').map(Number)
                const isInvalid = sH * 60 + sM >= eH * 60 + eM
                if (!isInvalid) return null
                return (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5 animate-in fade-in">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>Lỗi: Giờ bắt đầu ca chạy ({genStartTime}) phải sớm hơn Giờ kết thúc ({genEndTime})!</span>
                  </div>
                )
              })()}

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Tần suất chạy xe (Phút / Chuyến)
                </label>
                <input
                  type="number"
                  min="10"
                  max="120"
                  step="5"
                  value={genInterval}
                  onChange={(e) => setGenInterval(Number(e.target.value))}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Ví dụ: 30 phút sẽ sinh 1 chuyến từ {genStartTime} đến {genEndTime}
                </span>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                <span className="font-bold">Đặc điểm cơ chế Rolling Window:</span> Các chuyến xe tạo ra sẽ mang nhãn{' '}
                <strong>[⚡ Định kỳ tự động]</strong> ở trạng thái <em>Chưa gán xe/tài xế (Unassigned)</em> để điều độ
                viên bố trí nguồn lực theo ca làm việc thực tế của đội xe.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(false)}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmittingGenerate ||
                    (() => {
                      if (!genStartTime || !genEndTime) return false
                      const [sH, sM] = genStartTime.split(':').map(Number)
                      const [eH, eM] = genEndTime.split(':').map(Number)
                      return sH * 60 + sM >= eH * 60 + eM
                    })()
                  }
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingGenerate ? 'Đang tạo biểu đồ...' : 'Xác Nhận Sinh Khung Giờ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATIONS */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 pointer-events-none max-w-md w-full px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start justify-between gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300 ${
              t.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-100 border-emerald-500/40 shadow-emerald-950/50'
                : t.type === 'error'
                ? 'bg-rose-950/90 text-rose-100 border-rose-500/40 shadow-rose-950/50'
                : t.type === 'warning'
                ? 'bg-amber-950/90 text-amber-100 border-amber-500/40 shadow-amber-950/50'
                : 'bg-slate-900/90 text-slate-100 border-slate-700/60 shadow-slate-950/50'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {t.type === 'success' && <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />}
              {t.type === 'error' && <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />}
              {t.type === 'warning' && <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />}
              {t.type === 'info' && <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />}
              <p className="text-xs font-semibold leading-relaxed">{t.message}</p>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 shrink-0 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* CONFIRMATION DIALOG MODAL */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl ${
                  confirmDialog.variant === 'danger'
                    ? 'bg-red-500/15 text-red-500'
                    : confirmDialog.variant === 'warning'
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-blue-500/15 text-blue-500'
                }`}
              >
                {confirmDialog.variant === 'danger' ? <AlertTriangle size={24} /> : <Send size={24} />}
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">{confirmDialog.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Xác nhận thao tác điều phối hệ thống</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                {confirmDialog.cancelText || 'Hủy bỏ'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirmDialog.onConfirm
                  setConfirmDialog(null)
                  action()
                }}
                className={`rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm cursor-pointer ${
                  confirmDialog.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmDialog.confirmText || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
