'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Route as RouteIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  DollarSign,
  Loader2,
  Calendar,
} from 'lucide-react'
import { transitService } from '@/lib/services/transit.service'
import type {
  TransitRoute,
  CreateRoutePayload,
  UpdateRoutePayload,
} from '@/lib/types/transit'

interface RouteFormModalProps {
  isOpen: boolean
  onClose: () => void
  route?: TransitRoute | null
  onSuccess: (savedRoute: TransitRoute) => void
}

export function RouteFormModal({
  isOpen,
  onClose,
  route,
  onSuccess,
}: RouteFormModalProps) {
  const isEdit = !!route

  const [routeCode, setRouteCode] = useState('')
  const [name, setName] = useState('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [distanceKm, setDistanceKm] = useState<number>(12)
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState<number>(30)
  const [basePrice, setBasePrice] = useState<number>(10000)
  const [studentPrice, setStudentPrice] = useState<number>(5000)
  const [operatingStart, setOperatingStart] = useState('05:30:00')
  const [operatingEnd, setOperatingEnd] = useState('21:00:00')
  const [frequencyMinutes, setFrequencyMinutes] = useState<number>(15)
  const [status, setStatus] = useState<string>('active')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (route) {
      setRouteCode(route.routeCode || '')
      setName(route.name || '')
      setOrigin(route.origin || '')
      setDestination(route.destination || '')
      setDistanceKm(Number(route.distanceKm) || 12)
      setEstimatedDurationMinutes(Number(route.estimatedDurationMinutes) || 30)
      setBasePrice(Number(route.basePrice) || 10000)
      setStudentPrice(Number(route.studentPrice) || Math.round(Number(route.basePrice) * 0.5) || 5000)
      setOperatingStart(route.operatingStart || '05:30:00')
      setOperatingEnd(route.operatingEnd || '21:00:00')
      setFrequencyMinutes(Number(route.frequencyMinutes) || 15)
      setStatus(route.status || 'active')
    } else {
      setRouteCode('')
      setName('')
      setOrigin('')
      setDestination('')
      setDistanceKm(12)
      setEstimatedDurationMinutes(30)
      setBasePrice(10000)
      setStudentPrice(5000)
      setOperatingStart('05:30:00')
      setOperatingEnd('21:00:00')
      setFrequencyMinutes(15)
      setStatus('active')
    }
    setErrorMessage(null)
  }, [route, isOpen])

  if (!isOpen) return null

  // Tự động gợi ý tên tuyến khi nhập origin & destination
  const handleOriginBlur = () => {
    if (!name && origin && destination) {
      setName(`${origin} ↔ ${destination}`)
    }
  }

  const handleBasePriceChange = (val: number) => {
    setBasePrice(val)
    if (!route) {
      // Tự động tính giá vé HSSV = 50%
      setStudentPrice(Math.round(val * 0.5))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!routeCode.trim() || !name.trim() || !origin.trim() || !destination.trim()) {
      setErrorMessage('Vui lòng điền đầy đủ Mã tuyến, Tên tuyến, Điểm xuất phát và Điểm đến!')
      return
    }

    if (basePrice <= 0) {
      setErrorMessage('Giá vé cơ bản phải lớn hơn 0 VND!')
      return
    }

    setIsSubmitting(true)

    try {
      if (isEdit && route) {
        const payload: UpdateRoutePayload = {
          name: name.trim(),
          origin: origin.trim(),
          destination: destination.trim(),
          distanceKm: Number(distanceKm),
          estimatedDurationMinutes: Number(estimatedDurationMinutes),
          basePrice: Number(basePrice),
          studentPrice: Number(studentPrice),
          operatingStart,
          operatingEnd,
          frequencyMinutes: Number(frequencyMinutes),
          status,
        }
        const res = await transitService.updateRoute(route.id, payload)
        if (res.success && res.data) {
          onSuccess(res.data)
          onClose()
        } else {
          setErrorMessage(res.message || 'Lỗi khi cập nhật tuyến xe!')
        }
      } else {
        const payload: CreateRoutePayload = {
          routeCode: routeCode.trim().toUpperCase(),
          name: name.trim(),
          origin: origin.trim(),
          destination: destination.trim(),
          distanceKm: Number(distanceKm),
          estimatedDurationMinutes: Number(estimatedDurationMinutes),
          basePrice: Number(basePrice),
          studentPrice: Number(studentPrice),
          operatingStart,
          operatingEnd,
          frequencyMinutes: Number(frequencyMinutes),
          pricingType: 'fixed',
        }
        const res = await transitService.createRoute(payload)
        if (res.success && res.data) {
          onSuccess(res.data)
          onClose()
        } else {
          setErrorMessage(res.message || 'Lỗi khi tạo tuyến xe mới!')
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Có lỗi phát sinh khi lưu tuyến xe!')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <RouteIcon size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {isEdit ? `Chỉnh Sửa Tuyến: ${route?.routeCode}` : 'Tạo Tuyến Xe Buýt Mới'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEdit
                  ? 'Cập nhật cự ly, thời gian biểu và thông tin vận hành'
                  : 'Khai báo thông số tuyến hành lang đón sinh viên ICTU'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Hàng 1: Mã tuyến & Trạng thái */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                Mã tuyến <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: CT-01"
                disabled={isEdit}
                value={routeCode}
                onChange={(e) => setRouteCode(e.target.value.toUpperCase())}
                className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-black text-slate-900 dark:text-white uppercase focus:border-emerald-500 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-500"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                Tên đầy đủ tuyến xe <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: ĐH CNTT & TT (ICTU) ↔ Bến Xe TT Thái Nguyên"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Hàng 2: Điểm đầu & Điểm cuối */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <MapPin size={13} className="text-emerald-600" />
                <span>Điểm khởi hành (Origin)</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: ĐH CNTT & TT Thái Nguyên"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                onBlur={handleOriginBlur}
                className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-medium text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <MapPin size={13} className="text-rose-600" />
                <span>Điểm đến (Destination)</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Bến xe Trung tâm Thái Nguyên"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onBlur={handleOriginBlur}
                className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-medium text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Hàng 3: Cự ly & Thời gian dự kiến & Tần suất */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                Cự ly tuyến (km)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="200"
                value={distanceKm}
                onChange={(e) => setDistanceKm(parseFloat(e.target.value) || 0)}
                className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                Thời gian chạy dự kiến (phút)
              </label>
              <input
                type="number"
                min="5"
                max="300"
                value={estimatedDurationMinutes}
                onChange={(e) => setEstimatedDurationMinutes(parseInt(e.target.value, 10) || 0)}
                className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                Tần suất giãn cách (phút/chuyến)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={frequencyMinutes}
                onChange={(e) => setFrequencyMinutes(parseInt(e.target.value, 10) || 0)}
                className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Hàng 4: Giá vé cơ bản & Vé trợ giá HSSV */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
            <div>
              <label className="block text-xs font-black text-emerald-950 dark:text-emerald-300 mb-1.5 flex items-center gap-1.5">
                <DollarSign size={13} className="text-emerald-700" />
                <span>Giá vé cơ bản (Người lớn / Phổ thông)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1000"
                  min="1000"
                  value={basePrice}
                  onChange={(e) => handleBasePriceChange(parseInt(e.target.value, 10) || 0)}
                  className="h-11 w-full rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800 pl-3.5 pr-12 text-xs font-black text-emerald-700 dark:text-emerald-400 focus:outline-none"
                  required
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  VND
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-emerald-950 dark:text-emerald-300 mb-1.5 flex items-center gap-1.5">
                <DollarSign size={13} className="text-emerald-700" />
                <span>Giá vé trợ giá Sinh viên ICTU (-50%)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1000"
                  min="0"
                  value={studentPrice}
                  onChange={(e) => setStudentPrice(parseInt(e.target.value, 10) || 0)}
                  className="h-11 w-full rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800 pl-3.5 pr-12 text-xs font-black text-emerald-700 dark:text-emerald-400 focus:outline-none"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  VND
                </span>
              </div>
            </div>
          </div>

          {/* Hàng 5: Khung giờ hoạt động & Trạng thái */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock size={13} className="text-slate-400" />
                <span>Giờ mở tuyến</span>
              </label>
              <input
                type="text"
                placeholder="05:30:00"
                value={operatingStart}
                onChange={(e) => setOperatingStart(e.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-medium text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock size={13} className="text-slate-400" />
                <span>Giờ đóng tuyến</span>
              </label>
              <input
                type="text"
                placeholder="21:00:00"
                value={operatingEnd}
                onChange={(e) => setOperatingEnd(e.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-medium text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                Trạng thái vận hành
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="active">Đang hoạt động (Active)</option>
                <option value="inactive">Tạm ngưng (Inactive)</option>
              </select>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs shadow-md shadow-emerald-900/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>{isEdit ? 'Lưu Cập Nhật' : 'Tạo Tuyến Mới'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
