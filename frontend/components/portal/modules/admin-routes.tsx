'use client'

/**
 * PHÂN HỆ QUẢN TRỊ MẠNG LƯỚI TUYẾN ĐƯỜNG, TRẠM DỪNG & BIỂU PHÍ
 * - Kết nối trực tiếp Backend REST API & Database Supabase Cloud
 * - Quản lý Tuyến xe: Thêm, Sửa, Xóa, Bật/Tắt trạng thái hoạt động
 * - Quản lý Trạm dừng: Lộ trình trạm kéo thả (Drag-and-Drop), Ghim tọa độ bản đồ
 * - Cấu hình Biểu phí: Vé cố định toàn tuyến vs Theo cự ly khoảng cách km
 * - Ràng buộc Toàn vẹn Dữ liệu (Data Integrity): Xử lý chặn xóa tuyến/trạm vi phạm 409
 *
 * Domain: transit
 * Synchronized with Backend PR #42
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Route as RouteIcon,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  MapPin,
  DollarSign,
  Clock,
  Navigation,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Loader2,
  Sliders,
  Filter,
  ArrowRight,
  Sparkles,
  Layers,
  PowerOff,
  Check,
} from 'lucide-react'
import { transitService } from '@/lib/services/transit.service'
import type { TransitRoute, TransitStation } from '@/lib/types/transit'

import { RouteFormModal } from '../transit/route-form-modal'
import { RouteStationsDrawer } from '../transit/route-stations-drawer'
import { StationMapPickerModal } from '../transit/station-map-picker-modal'
import { FareConfigModal } from '../transit/fare-config-modal'
import { DataIntegrityModal } from '../transit/data-integrity-modal'

export function AdminRoutes() {
  const [routes, setRoutes] = useState<TransitRoute[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Modals & Drawers State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState<TransitRoute | null>(null)

  const [isStationsDrawerOpen, setIsStationsDrawerOpen] = useState(false)
  const [managingStationsRoute, setManagingStationsRoute] = useState<TransitRoute | null>(null)

  const [isFareModalOpen, setIsFareModalOpen] = useState(false)
  const [configuringFareRoute, setConfiguringFareRoute] = useState<TransitRoute | null>(null)

  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false)

  // Data Integrity Conflict State (HTTP 409)
  const [integrityConflict, setIntegrityConflict] = useState<{
    isOpen: boolean
    route: TransitRoute | null
    message: string
  }>({
    isOpen: false,
    route: null,
    message: '',
  })
  const [isDeactivating, setIsDeactivating] = useState(false)

  // Toast Notification
  const [toast, setToast] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  // Tải danh sách tuyến từ Backend
  const loadRoutes = useCallback(async () => {
    setIsLoading(true)
    const res = await transitService.getRoutes()
    if (res.success && res.data) {
      setRoutes(res.data)
    } else {
      showToast('error', res.message || 'Không thể tải danh sách tuyến xe buýt')
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadRoutes()
  }, [loadRoutes])

  // Lọc tuyến theo từ khóa & trạng thái
  const filteredRoutes = useMemo(() => {
    return routes.filter((r) => {
      const matchKeyword =
        !searchQuery ||
        r.routeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.destination.toLowerCase().includes(searchQuery.toLowerCase())

      const matchStatus =
        statusFilter === 'all' ? true : r.status === statusFilter

      return matchKeyword && matchStatus
    })
  }, [routes, searchQuery, statusFilter])

  // =========================================================================
  // XÓA TUYẾN & XỬ LÝ RÀNG BUỘC TOÀN VẸN (HTTP 409)
  // =========================================================================
  const handleDeleteRoute = async (route: TransitRoute) => {
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa tuyến "${route.routeCode} - ${route.name}"?`,
    )
    if (!confirmed) return

    const res = await transitService.deleteRoute(route.id)

    if (res.success) {
      showToast('success', res.message || `Đã xóa tuyến ${route.routeCode} thành công!`)
      loadRoutes()
    } else if (res.isIntegrityConflict || res.statusCode === 409) {
      // BẮT LỖI RÀNG BUỘC TOÀN VẸN DỮ LIỆU: Mở DataIntegrityModal
      setIntegrityConflict({
        isOpen: true,
        route,
        message:
          res.message ||
          'Không thể xóa tuyến xe này do đang có chuyến xe hoạt động hoặc đã phát sinh giao dịch vé của hành khách.',
      })
    } else {
      showToast('error', res.message || 'Lỗi khi xóa tuyến xe!')
    }
  }

  // Chuyển sang Inactive khi bị chặn xóa
  const handleDeactivateConflictedRoute = async () => {
    if (!integrityConflict.route) return
    setIsDeactivating(true)

    const res = await transitService.deactivateRoute(integrityConflict.route.id)
    if (res.success) {
      showToast(
        'success',
        `Đã chuyển tuyến ${integrityConflict.route.routeCode} sang trạng thái Tạm ngưng hoạt động!`,
      )
      setIntegrityConflict({ isOpen: false, route: null, message: '' })
      loadRoutes()
    } else {
      showToast('error', res.message || 'Không thể chuyển trạng thái tuyến xe!')
    }
    setIsDeactivating(false)
  }

  // =========================================================================
  // HANDLERS CẬP NHẬT MODAL
  // =========================================================================
  const handleOpenCreateModal = () => {
    setEditingRoute(null)
    setIsFormModalOpen(true)
  }

  const handleOpenEditModal = (route: TransitRoute) => {
    setEditingRoute(route)
    setIsFormModalOpen(true)
  }

  const handleOpenStationsDrawer = (route: TransitRoute) => {
    setManagingStationsRoute(route)
    setIsStationsDrawerOpen(true)
  }

  const handleOpenFareModal = (route: TransitRoute) => {
    setConfiguringFareRoute(route)
    setIsFareModalOpen(true)
  }

  const handleRouteSaved = (saved: TransitRoute) => {
    showToast('success', `Lưu tuyến ${saved.routeCode} thành công!`)
    loadRoutes()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* HEADER SECTION */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="size-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-900/10">
              <RouteIcon size={20} />
            </div>
            <span>Mạng Lưới Tuyến Xe & Trạm Dừng</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản trị hành lang vận chuyển sinh viên ICTU, trạm đón trả và cơ chế định giá vé theo chặng
          </p>
        </div>

        {/* Action Buttons Top Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={loadRoutes}
            disabled={isLoading}
            className="h-10 px-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMapPickerOpen(true)}
            className="h-10 px-4 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center gap-2 hover:bg-indigo-100 transition-all cursor-pointer shadow-xs"
          >
            <MapPin size={15} />
            <span>Thêm Trạm Dừng Mới</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="h-10 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-900/20"
          >
            <Plus size={16} />
            <span>Tạo Tuyến Xe Mới</span>
          </button>
        </div>
      </div>

      {/* TOAST THÔNG BÁO KẾT QUẢ THAO TÁC */}
      {toast && (
        <div
          className={`animate-in fade-in slide-in-from-top-2 p-4 rounded-2xl border text-xs font-bold flex items-center gap-2.5 shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-950 dark:text-emerald-100'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 text-rose-950 dark:text-rose-100'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Tìm theo mã tuyến (CT-01), tên tuyến, điểm đi / đến..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-10 pr-4 text-xs font-bold text-slate-800 dark:text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Trạng thái filter */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'active', label: 'Đang hoạt động' },
            { id: 'inactive', label: 'Tạm ngưng' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ROUTE CARDS GRID */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 size={32} className="animate-spin text-emerald-600" />
          <p className="text-xs font-bold">Đang tải danh mục tuyến từ Supabase Cloud...</p>
        </div>
      ) : filteredRoutes.length === 0 ? (
        <div className="py-20 text-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-8 space-y-3">
          <RouteIcon size={40} className="mx-auto text-slate-300 dark:text-slate-600" />
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-300">
            Không tìm thấy tuyến xe buýt nào
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Không có kết quả phù hợp với từ khóa hoặc bộ lọc. Bạn có thể bấm tạo tuyến mới.
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="mt-2 px-5 py-2.5 rounded-2xl bg-emerald-600 text-white font-black text-xs hover:bg-emerald-500 cursor-pointer"
          >
            Tạo Tuyến Mới Ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRoutes.map((route) => {
            const stopsCount = route.routeStations?.length || 0
            const isDistancePricing = route.pricingType === 'distance'
            const isStagePricing = route.pricingType === 'stage'

            return (
              <div
                key={route.id}
                className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-emerald-500/40 hover:shadow-md transition-all group"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-xl bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 font-mono text-xs font-black text-emerald-700 dark:text-emerald-400">
                      {route.routeCode}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`size-2 rounded-full ${
                          route.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {route.status === 'active' ? 'Đang chạy' : 'Tạm ngưng'}
                      </span>
                    </div>
                  </div>

                  {/* Tên tuyến */}
                  <h3 className="mt-3.5 font-black text-base text-slate-900 dark:text-white leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                    {route.name}
                  </h3>

                  {/* Hành lang di chuyển */}
                  <div className="mt-3.5 flex flex-col gap-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="size-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                      <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                        {route.origin}
                      </span>
                    </div>
                    <div className="border-l-2 border-dashed border-slate-200 dark:border-slate-700 ml-1 h-2" />
                    <div className="flex items-start gap-2">
                      <span className="size-2 rounded-full bg-rose-500 mt-1 shrink-0" />
                      <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                        {route.destination}
                      </span>
                    </div>
                  </div>

                  {/* Thông số Cự ly / Thời gian / Tần suất */}
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                      <p className="text-[10px] text-slate-400 font-bold">Cự ly</p>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">
                        {route.distanceKm} km
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                      <p className="text-[10px] text-slate-400 font-bold">Thời gian</p>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">
                        ~{route.estimatedDurationMinutes || 35}p
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                      <p className="text-[10px] text-slate-400 font-bold">Giãn cách</p>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">
                        {route.frequencyMinutes || 15}p/chuyến
                      </p>
                    </div>
                  </div>

                  {/* Biểu phí & Số trạm dừng */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">Cơ chế định giá</p>
                      <p className="font-black text-slate-900 dark:text-white">
                        {isDistancePricing
                          ? 'Theo cự ly (km)'
                          : isStagePricing
                            ? 'Theo số chặng'
                            : `${Number(route.basePrice).toLocaleString('vi-VN')} đ (Đồng giá)`}
                      </p>
                      {Number(route.studentPrice) > 0 && (
                        <p className="text-[10px] font-bold text-emerald-600">
                          HSSV: {Number(route.studentPrice).toLocaleString('vi-VN')} đ
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400">Điểm đón trả</p>
                      <span className="inline-flex items-center gap-1 font-black text-indigo-600 dark:text-indigo-400">
                        <MapPin size={12} />
                        <span>{stopsCount} trạm dừng</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* BOTTOM ACTION BUTTONS */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-4 gap-1.5">
                  {/* Nút xem & sắp xếp trạm dừng */}
                  <button
                    type="button"
                    onClick={() => handleOpenStationsDrawer(route)}
                    title="Lộ trình & Thứ tự trạm dừng (Kéo thả)"
                    className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <MapPin size={13} />
                    <span>Trạm</span>
                  </button>

                  {/* Nút cấu hình biểu phí */}
                  <button
                    type="button"
                    onClick={() => handleOpenFareModal(route)}
                    title="Cấu hình cơ chế giá vé & Biểu phí chặng"
                    className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:border-amber-300 text-amber-700 dark:text-amber-300 text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <DollarSign size={13} />
                    <span>Giá vé</span>
                  </button>

                  {/* Nút sửa thông tin tuyến */}
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(route)}
                    title="Chỉnh sửa thông tin tuyến"
                    className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Edit2 size={13} />
                    <span>Sửa</span>
                  </button>

                  {/* Nút xóa tuyến */}
                  <button
                    type="button"
                    onClick={() => handleDeleteRoute(route)}
                    title="Xóa tuyến (Kiểm tra ràng buộc chuyến & vé)"
                    className="h-9 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Xóa</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CÁC MODAL & DRAWER TƯƠNG TÁC */}
      {/* ========================================================================= */}

      {/* 1. Modal Thêm / Sửa Tuyến */}
      <RouteFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        route={editingRoute}
        onSuccess={handleRouteSaved}
      />

      {/* 2. Ngăn trượt Sắp xếp Trạm dừng (Drag-and-Drop) */}
      <RouteStationsDrawer
        isOpen={isStationsDrawerOpen}
        onClose={() => {
          setIsStationsDrawerOpen(false)
          setManagingStationsRoute(null)
        }}
        route={managingStationsRoute}
        onRouteUpdated={loadRoutes}
      />

      {/* 3. Modal Cấu hình Biểu phí (Fixed vs Distance vs Stage) */}
      <FareConfigModal
        isOpen={isFareModalOpen}
        onClose={() => {
          setIsFareModalOpen(false)
          setConfiguringFareRoute(null)
        }}
        route={configuringFareRoute}
        onSuccess={loadRoutes}
      />

      {/* 4. Modal Ghim Tọa độ Bản đồ & Tạo Trạm Mới */}
      <StationMapPickerModal
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        onStationCreated={(newSt) => {
          showToast('success', `Đã tạo trạm "${newSt.name}" thành công!`)
        }}
      />

      {/* 5. Modal Xử lý Ràng buộc Toàn vẹn Dữ liệu (HTTP 409 Conflict) */}
      <DataIntegrityModal
        isOpen={integrityConflict.isOpen}
        onClose={() =>
          setIntegrityConflict({ isOpen: false, route: null, message: '' })
        }
        entityType="route"
        title="Không Thể Xóa Tuyến Do Ràng Buộc Dữ Liệu"
        conflictMessage={integrityConflict.message}
        onDeactivateRoute={handleDeactivateConflictedRoute}
        isDeactivating={isDeactivating}
      />
    </div>
  )
}
