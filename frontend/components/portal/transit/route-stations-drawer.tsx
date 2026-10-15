'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  GripVertical,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  MapPin,
  Clock,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Route,
} from 'lucide-react'
import { transitService } from '@/lib/services/transit.service'
import type {
  TransitRoute,
  TransitStation,
  RouteStationItem,
} from '@/lib/types/transit'
import { StationMapPickerModal } from './station-map-picker-modal'

interface RouteStationsDrawerProps {
  isOpen: boolean
  onClose: () => void
  route: TransitRoute | null
  onRouteUpdated: (updatedRoute: TransitRoute) => void
}

export function RouteStationsDrawer({
  isOpen,
  onClose,
  route,
  onRouteUpdated,
}: RouteStationsDrawerProps) {
  const [stops, setStops] = useState<RouteStationItem[]>([])
  const [allStations, setAllStations] = useState<TransitStation[]>([])
  const [selectedStationToAdd, setSelectedStationToAdd] = useState<string>('')
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Tải danh sách trạm của tuyến và toàn bộ trạm dừng trong hệ thống
  useEffect(() => {
    if (!isOpen || !route) return

    const loadData = async () => {
      setIsLoading(true)
      setFeedback(null)

      // 1. Tải chi tiết tuyến để có routeStations mới nhất
      const routeRes = await transitService.getRouteById(route.id)
      if (routeRes.success && routeRes.data?.routeStations) {
        const sorted = [...routeRes.data.routeStations].sort(
          (a, b) => a.stopOrder - b.stopOrder,
        )
        setStops(sorted)
      } else if (route.routeStations) {
        setStops([...route.routeStations].sort((a, b) => a.stopOrder - b.stopOrder))
      }

      // 2. Tải toàn bộ trạm để thêm vào tuyến
      const stationsRes = await transitService.getStations()
      if (stationsRes.success && stationsRes.data) {
        setAllStations(stationsRes.data)
      }

      setIsLoading(false)
    }

    loadData()
  }, [isOpen, route])

  if (!isOpen || !route) return null

  // =========================================================================
  // XỬ LÝ KÉO THẢ (HTML5 DRAG AND DROP CHUẨN REACT 19)
  // =========================================================================

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === targetIndex) return

    const newStops = [...stops]
    const item = newStops.splice(draggedIndex, 1)[0]
    newStops.splice(targetIndex, 0, item)

    // Đánh số lại stopOrder liên tục từ 1..N
    const reordered = newStops.map((stop, idx) => ({
      ...stop,
      stopOrder: idx + 1,
    }))

    setStops(reordered)
    setDraggedIndex(targetIndex)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  // Di chuyển lên 1 bậc
  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newStops = [...stops]
    const temp = newStops[index]
    newStops[index] = newStops[index - 1]
    newStops[index - 1] = temp

    setStops(
      newStops.map((s, idx) => ({
        ...s,
        stopOrder: idx + 1,
      })),
    )
  }

  // Di chuyển xuống 1 bậc
  const handleMoveDown = (index: number) => {
    if (index === stops.length - 1) return
    const newStops = [...stops]
    const temp = newStops[index]
    newStops[index] = newStops[index + 1]
    newStops[index + 1] = temp

    setStops(
      newStops.map((s, idx) => ({
        ...s,
        stopOrder: idx + 1,
      })),
    )
  }

  // =========================================================================
  // THÊM & GỠ TRẠM KHỎI TUYẾN
  // =========================================================================

  const handleAddExistingStation = () => {
    if (!selectedStationToAdd) return
    const station = allStations.find((s) => s.id === selectedStationToAdd)
    if (!station) return

    // Kiểm tra xem trạm đã có trên tuyến chưa
    if (stops.some((s) => s.stationId === station.id)) {
      setFeedback({
        type: 'error',
        message: `Trạm "${station.name}" đã có trong lộ trình tuyến xe!`,
      })
      setTimeout(() => setFeedback(null), 3000)
      return
    }

    const nextOrder = stops.length + 1
    const lastStop = stops[stops.length - 1]
    const nextDistance = +(Number(lastStop?.distanceFromOriginKm || 0) + 2.5).toFixed(1)
    const nextMinutes = Number(lastStop?.estimatedMinutes || 0) + 6

    const newStopItem: RouteStationItem = {
      routeId: route.id,
      stationId: station.id,
      stopOrder: nextOrder,
      distanceFromOriginKm: nextDistance,
      estimatedMinutes: nextMinutes,
      station,
    }

    setStops([...stops, newStopItem])
    setSelectedStationToAdd('')
    setFeedback({
      type: 'success',
      message: `Đã thêm trạm "${station.name}" vào cuối tuyến. Hãy bấm Lưu để ghi nhận!`,
    })
    setTimeout(() => setFeedback(null), 3000)
  }

  const handleRemoveStop = (stationId: string) => {
    const remaining = stops
      .filter((s) => s.stationId !== stationId)
      .map((s, idx) => ({
        ...s,
        stopOrder: idx + 1,
      }))
    setStops(remaining)
    setFeedback({
      type: 'success',
      message: 'Đã gỡ trạm khỏi lộ trình. Bấm Lưu để cập nhật cơ sở dữ liệu!',
    })
    setTimeout(() => setFeedback(null), 3000)
  }

  // Khi tạo trạm mới thành công từ Map Picker
  const handleStationCreatedFromMap = (newStation: TransitStation) => {
    setAllStations((prev) => [newStation, ...prev])
    setSelectedStationToAdd(newStation.id)

    // Tự động thêm luôn vào tuyến
    const nextOrder = stops.length + 1
    const lastStop = stops[stops.length - 1]
    const nextDistance = +(Number(lastStop?.distanceFromOriginKm || 0) + 2.5).toFixed(1)
    const nextMinutes = Number(lastStop?.estimatedMinutes || 0) + 6

    const newStopItem: RouteStationItem = {
      routeId: route.id,
      stationId: newStation.id,
      stopOrder: nextOrder,
      distanceFromOriginKm: nextDistance,
      estimatedMinutes: nextMinutes,
      station: newStation,
    }

    setStops((prev) => [...prev, newStopItem])
    setFeedback({
      type: 'success',
      message: `Đã tạo trạm "${newStation.name}" và thêm vào lộ trình!`,
    })
    setTimeout(() => setFeedback(null), 3500)
  }

  // =========================================================================
  // LƯU TOÀN BỘ LỘ TRÌNH VỀ DATABASE (BULK UPDATE)
  // =========================================================================

  const handleSaveAllStops = async () => {
    setIsSaving(true)
    setFeedback(null)

    try {
      const payloadStops = stops.map((s, idx) => ({
        stationId: s.stationId,
        stopOrder: idx + 1,
        distanceFromOriginKm: Number(s.distanceFromOriginKm) || 0,
        estimatedMinutes: Number(s.estimatedMinutes) || 0,
      }))

      const res = await transitService.bulkUpdateStations(route.id, payloadStops)
      if (res.success && res.data) {
        onRouteUpdated(res.data)
        setFeedback({
          type: 'success',
          message: 'Đã lưu toàn bộ thứ tự lộ trình trạm dừng lên Database Supabase!',
        })
        setTimeout(() => setFeedback(null), 3000)
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Lỗi khi lưu lộ trình trạm dừng!',
        })
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Có lỗi phát sinh khi lưu!',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
        <aside
          className="w-full max-w-xl h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-250"
          role="dialog"
          aria-modal="true"
        >
          {/* Header Drawer */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-mono font-black text-sm">
                {route.routeCode}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                  Lộ Trình & Thứ Tự Trạm Dừng
                </h3>
                <p className="text-xs text-slate-500 truncate max-w-[280px]">
                  {route.name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Feedback Notice */}
          {feedback && (
            <div
              className={`p-3.5 mx-5 mt-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-900 dark:text-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Thanh công cụ Thêm Trạm */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
              Thêm trạm đón vào tuyến xe:
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedStationToAdd}
                onChange={(e) => setSelectedStationToAdd(e.target.value)}
                className="h-10 flex-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="">-- Chọn trạm dừng sẵn có --</option>
                {allStations.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} {st.isHub ? '★ (Hub)' : ''}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAddExistingStation}
                disabled={!selectedStationToAdd}
                className="h-10 px-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
              >
                <Plus size={15} />
                <span>Thêm</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMapPickerOpen(true)}
                title="Ghim tọa độ bản đồ tạo trạm mới"
                className="h-10 px-3 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <MapPin size={15} />
                <span className="hidden sm:inline">Bản đồ</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              💡 Mẹo: Bạn có thể <strong>kéo thả</strong> các thẻ trạm bên dưới để hoán đổi thứ tự dừng 1..N.
            </p>
          </div>

          {/* Danh sách trạm kéo thả (Scrollable Container) */}
          <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 size={24} className="animate-spin text-emerald-600" />
                <p className="text-xs">Đang tải danh sách lộ trình trạm...</p>
              </div>
            ) : stops.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-6">
                <MapPin size={32} className="mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Tuyến chưa có trạm dừng nào
                </p>
                <p className="text-[11px] text-slate-400">
                  Chọn trạm từ ô phía trên để bắt đầu lập lộ trình đón trả sinh viên
                </p>
              </div>
            ) : (
              stops.map((stop, index) => {
                const isFirst = index === 0
                const isLast = index === stops.length - 1
                const isDragging = draggedIndex === index

                return (
                  <div
                    key={stop.stationId}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`rounded-2xl border p-3.5 transition-all select-none flex items-center gap-3 ${
                      isDragging
                        ? 'opacity-40 border-dashed border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-inner'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    {/* Drag Handle */}
                    <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                      <GripVertical size={18} />
                    </div>

                    {/* Số thứ tự trạm */}
                    <div
                      className={`size-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        isFirst
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isLast
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {stop.stopOrder}
                    </div>

                    {/* Thông tin trạm */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {stop.station?.name || 'Trạm dừng'}
                        </p>
                        {stop.station?.isHub && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[9px] font-bold shrink-0">
                            Hub
                          </span>
                        )}
                      </div>

                      {/* Thông số cự ly & thời gian */}
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 font-mono">
                          <Navigation size={10} className="text-emerald-600" />
                          <span>+{stop.distanceFromOriginKm || 0} km</span>
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock size={10} className="text-slate-400" />
                          <span>~{stop.estimatedMinutes || 0} phút</span>
                        </span>
                      </div>
                    </div>

                    {/* Nút bấm di chuyển lên/xuống & Xóa */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(index)}
                        disabled={isFirst}
                        title="Di chuyển lên"
                        className="size-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowUp size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMoveDown(index)}
                        disabled={isLast}
                        title="Di chuyển xuống"
                        className="size-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowDown size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveStop(stop.stationId)}
                        title="Gỡ trạm khỏi tuyến"
                        className="size-7 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 flex items-center justify-center text-rose-600 hover:bg-rose-100 cursor-pointer ml-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Tổng số trạm: <strong>{stops.length}</strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-100"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleSaveAllStops}
                disabled={isSaving || stops.length === 0}
                className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs shadow-md shadow-emerald-900/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>Lưu Lộ Trình</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Modal Ghim bản đồ tạo trạm mới */}
      <StationMapPickerModal
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        onStationCreated={handleStationCreatedFromMap}
      />
    </>
  )
}
