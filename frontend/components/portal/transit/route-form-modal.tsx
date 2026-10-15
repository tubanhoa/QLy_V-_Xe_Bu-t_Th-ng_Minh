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
  UserCheck,
  Bus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  ShieldCheck,
  Sparkles,
  Navigation,
  Compass,
  Search,
  Zap,
  ChevronDown,
} from 'lucide-react'
import {
  searchAvailablePlaces,
  calculateRouteMetrics,
  PlaceItem,
} from '@/lib/services/maps.service'
import { transitService } from '@/lib/services/transit.service'
import { vehicleService, Vehicle } from '@/lib/services/vehicle.service'
import { userService } from '@/lib/services/user.service'
import type {
  TransitRoute,
  TransitStation,
  CreateRoutePayload,
  UpdateRoutePayload,
} from '@/lib/types/transit'

interface RouteFormModalProps {
  isOpen: boolean
  onClose: () => void
  route?: TransitRoute | null
  onSuccess: (savedRoute: TransitRoute) => void
}

interface SelectedStop {
  stationId: string
  name: string
  address?: string
  stopOrder: number
  distanceFromOriginKm: number
  estimatedMinutes: number
}

interface DriverOption {
  id: string
  fullName: string
  email: string
  phoneNumber?: string | null
}

const DEFAULT_DRIVERS: DriverOption[] = [
  {
    id: '6f8ca420-b860-4dbf-a1b7-4b3c74faa444',
    fullName: 'Trần Văn Nam (Tài Xế)',
    email: 'driver.nam@smartbus.ictu.vn',
    phoneNumber: '0903456789',
  },
  {
    id: '0e4170aa-68fb-4e6c-95c1-5988f3037ab1',
    fullName: 'Nguyễn Văn Hùng (Tài Xế)',
    email: 'driver.hung@smartbus.ictu.vn',
    phoneNumber: '0912345678',
  },
  {
    id: '4e88227d-28d3-48a2-8864-c5f0080818a1',
    fullName: 'Lê Hoàng Nam (Tài Xế)',
    email: 'driver.le.nam@smartbus.ictu.vn',
    phoneNumber: '0987654321',
  },
]

const DEFAULT_VEHICLES: Vehicle[] = [
  {
    id: 'e5b7e4d5-406d-4478-9c4a-c6ad67973754',
    licensePlate: '20B-012.34',
    model: 'VinFast eBus 2024 (EV)',
    vehicleType: 'electric',
    seatCapacity: 28,
    status: 'active',
  },
  {
    id: '096cec15-d66b-4514-8df7-4ad9c0415731',
    licensePlate: '20B-056.78',
    model: 'VinFast eBus 2024 (EV)',
    vehicleType: 'electric',
    seatCapacity: 28,
    status: 'active',
  },
  {
    id: 'bf54033b-dc67-4350-9fb9-1d0831a7c383',
    licensePlate: '20B-099.99',
    model: 'Hyundai County 2023',
    vehicleType: 'diesel',
    seatCapacity: 28,
    status: 'active',
  },
]

export function RouteFormModal({
  isOpen,
  onClose,
  route,
  onSuccess,
}: RouteFormModalProps) {
  const isEdit = !!route

  // Form Fields - Route Info
  const [routeCode, setRouteCode] = useState('CT-03')
  const [name, setName] = useState('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [distanceKm, setDistanceKm] = useState<number>(15)
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState<number>(35)
  const [basePrice, setBasePrice] = useState<number>(10000)
  const [studentPrice, setStudentPrice] = useState<number>(5000)
  const [operatingStart, setOperatingStart] = useState('06:00:00')
  const [operatingEnd, setOperatingEnd] = useState('21:00:00')
  const [frequencyMinutes, setFrequencyMinutes] = useState<number>(20)
  const [status, setStatus] = useState<string>('active')

  // Real Database Resources
  const [availableStations, setAvailableStations] = useState<TransitStation[]>([])
  const [selectedStops, setSelectedStops] = useState<SelectedStop[]>([])
  const [stopToAdd, setStopToAdd] = useState<string>('')

  const [availableDrivers, setAvailableDrivers] = useState<DriverOption[]>(DEFAULT_DRIVERS)
  const [assignedDriverId, setAssignedDriverId] = useState<string>('6f8ca420-b860-4dbf-a1b7-4b3c74faa444') // Trần Văn Nam default

  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>(DEFAULT_VEHICLES)
  const [assignedVehicleId, setAssignedVehicleId] = useState<string>('e5b7e4d5-406d-4478-9c4a-c6ad67973754') // 20B-012.34 default

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingResources, setIsLoadingResources] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Load initial resources from Supabase backend
  useEffect(() => {
    if (!isOpen) return

    const fetchResources = async () => {
      setIsLoadingResources(true)
      try {
        // 1. Fetch real stations
        const stRes = await transitService.getStations()
        if (stRes.success && stRes.data && stRes.data.length > 0) {
          setAvailableStations(stRes.data)
          if (!stopToAdd && stRes.data[0]) {
            setStopToAdd(stRes.data[0].id)
          }
        }

        // 2. Fetch real drivers
        const drRes = await userService.getUsers({ role: 'driver' })
        if (drRes.success && drRes.data && drRes.data.items && drRes.data.items.length > 0) {
          const drivers: DriverOption[] = drRes.data.items.map((u) => ({
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            phoneNumber: u.phoneNumber,
          }))
          setAvailableDrivers(drivers)
          if (drivers[0] && !isEdit) {
            setAssignedDriverId(drivers[0].id)
          }
        }

        // 3. Fetch real vehicles
        const vehRes = await vehicleService.getVehicles()
        if (vehRes.success && vehRes.data && vehRes.data.length > 0) {
          setAvailableVehicles(vehRes.data)
          if (vehRes.data[0] && !isEdit) {
            setAssignedVehicleId(vehRes.data[0].id)
          }
        }
      } catch (err) {
        console.warn('[RouteFormModal] Lỗi nạp tài nguyên từ Supabase:', err)
      } finally {
        setIsLoadingResources(false)
      }
    }

    fetchResources()
  }, [isOpen, isEdit])

  // Populate form if editing
  useEffect(() => {
    if (route) {
      setRouteCode(route.routeCode || '')
      setName(route.name || '')
      setOrigin(route.origin || '')
      setDestination(route.destination || '')
      setDistanceKm(Number(route.distanceKm) || 15)
      setEstimatedDurationMinutes(Number(route.estimatedDurationMinutes) || 35)
      setBasePrice(Number(route.basePrice) || 10000)
      setStudentPrice(Number(route.studentPrice) || Math.round(Number(route.basePrice) * 0.5) || 5000)
      setOperatingStart(route.operatingStart || '06:00:00')
      setOperatingEnd(route.operatingEnd || '21:00:00')
      setFrequencyMinutes(Number(route.frequencyMinutes) || 20)
      setStatus(route.status || 'active')

      if (route.routeStations && route.routeStations.length > 0) {
        const stops: SelectedStop[] = route.routeStations.map((rs) => ({
          stationId: rs.stationId,
          name: rs.station?.name || 'Trạm dừng',
          address: rs.station?.address,
          stopOrder: rs.stopOrder,
          distanceFromOriginKm: Number(rs.distanceFromOriginKm) || 0,
          estimatedMinutes: Number(rs.estimatedMinutes) || 0,
        }))
        setSelectedStops(stops.sort((a, b) => a.stopOrder - b.stopOrder))
      }
    } else {
      setRouteCode('CT-03')
      setName('Ký Túc Xá ICTU ↔ Bến Xe Thái Nguyên')
      setOrigin('Trạm ĐH CNTT & TT Thái Nguyên (ICTU)')
      setDestination('Trạm Bến Xe Trung Tâm Thái Nguyên')
      setDistanceKm(15)
      setEstimatedDurationMinutes(35)
      setBasePrice(10000)
      setStudentPrice(5000)
      setOperatingStart('06:00:00')
      setOperatingEnd('21:00:00')
      setFrequencyMinutes(20)
      setStatus('active')
      setSelectedStops([])
    }
    setErrorMessage(null)
  }, [route, isOpen])

  // Danh sách gợi ý địa điểm / trạm dừng thông minh & Tự động tính toán
  const [originPlace, setOriginPlace] = useState<PlaceItem | null>(null)
  const [destPlace, setDestPlace] = useState<PlaceItem | null>(null)
  const [isOriginOpen, setIsOriginOpen] = useState(false)
  const [isDestOpen, setIsDestOpen] = useState(false)
  const [originSearch, setOriginSearch] = useState('')
  const [destSearch, setDestSearch] = useState('')

  const originSuggestions = React.useMemo(() => {
    return searchAvailablePlaces(originSearch, availableStations)
  }, [originSearch, availableStations])

  const destSuggestions = React.useMemo(() => {
    return searchAvailablePlaces(destSearch, availableStations)
  }, [destSearch, availableStations])

  const applyRouteMetrics = (from: PlaceItem, to: PlaceItem) => {
    const metrics = calculateRouteMetrics(from, to, Math.max(0, selectedStops.length - 2))
    setDistanceKm(metrics.distanceKm)
    setEstimatedDurationMinutes(metrics.estimatedDurationMinutes)
    setBasePrice(metrics.suggestedBasePrice)
    setStudentPrice(metrics.suggestedStudentPrice)
    setName(`${from.name.replace(/^Trạm\s+/i, '')} ↔ ${to.name.replace(/^Trạm\s+/i, '')}`)

    // Tự động đồng bộ điểm xuất phát và điểm đến vào Lộ trình đón/trả khách (Stop 1 & Stop cuối)
    const originStation = availableStations.find(
      (s) => s.id === from.id || s.name.toLowerCase() === from.name.toLowerCase(),
    )
    const destStation = availableStations.find(
      (s) => s.id === to.id || s.name.toLowerCase() === to.name.toLowerCase(),
    )

    if (originStation && destStation && originStation.id !== destStation.id) {
      const intermediates = selectedStops.filter(
        (s) => s.stationId !== originStation.id && s.stationId !== destStation.id,
      )
      const newStops: SelectedStop[] = [
        {
          stationId: originStation.id,
          name: originStation.name,
          address: originStation.address,
          stopOrder: 1,
          distanceFromOriginKm: 0,
          estimatedMinutes: 0,
        },
        ...intermediates.map((item, idx) => ({
          ...item,
          stopOrder: idx + 2,
        })),
        {
          stationId: destStation.id,
          name: destStation.name,
          address: destStation.address,
          stopOrder: intermediates.length + 2,
          distanceFromOriginKm: metrics.distanceKm,
          estimatedMinutes: metrics.estimatedDurationMinutes,
        },
      ]
      setSelectedStops(newStops)
    }
  }

  const handleSelectOrigin = (p: PlaceItem) => {
    setOrigin(p.name)
    setOriginPlace(p)
    setIsOriginOpen(false)
    setOriginSearch('')

    if (destPlace) {
      applyRouteMetrics(p, destPlace)
    } else if (destination) {
      const matchDest = availableStations.find((s) => s.name === destination)
      if (matchDest) {
        const destP: PlaceItem = {
          id: matchDest.id,
          name: matchDest.name,
          address: matchDest.address || '',
          latitude: Number(matchDest.latitude) || 21.58,
          longitude: Number(matchDest.longitude) || 105.83,
          source: 'station',
        }
        setDestPlace(destP)
        applyRouteMetrics(p, destP)
      }
    }
  }

  const handleSelectDest = (p: PlaceItem) => {
    setDestination(p.name)
    setDestPlace(p)
    setIsDestOpen(false)
    setDestSearch('')

    if (originPlace) {
      applyRouteMetrics(originPlace, p)
    } else if (origin) {
      const matchOrigin = availableStations.find((s) => s.name === origin)
      if (matchOrigin) {
        const origP: PlaceItem = {
          id: matchOrigin.id,
          name: matchOrigin.name,
          address: matchOrigin.address || '',
          latitude: Number(matchOrigin.latitude) || 21.58,
          longitude: Number(matchOrigin.longitude) || 105.83,
          source: 'station',
        }
        setOriginPlace(origP)
        applyRouteMetrics(origP, p)
      }
    }
  }

  // Khi chọn trạm để thêm vào lộ trình
  const handleAddStop = () => {
    if (!stopToAdd) return
    const targetStation = availableStations.find((s) => s.id === stopToAdd)
    if (!targetStation) return

    if (selectedStops.some((s) => s.stationId === stopToAdd)) {
      setErrorMessage(`Trạm "${targetStation.name}" đã có trong lộ trình!`)
      return
    }

    const newOrder = selectedStops.length + 1
    const distStep = 4.5
    const minStep = 8

    const newStop: SelectedStop = {
      stationId: targetStation.id,
      name: targetStation.name,
      address: targetStation.address,
      stopOrder: newOrder,
      distanceFromOriginKm: Math.round((newOrder - 1) * distStep * 10) / 10,
      estimatedMinutes: (newOrder - 1) * minStep,
    }

    const updated = [...selectedStops, newStop]
    setSelectedStops(updated)
    setErrorMessage(null)

    // Tự động cập nhật Origin và Destination nếu là trạm đầu/cuối
    if (updated.length === 1) {
      setOrigin(targetStation.name)
    }
    if (updated.length >= 2) {
      setDestination(targetStation.name)
      setName(`${updated[0].name.replace('Trạm ', '')} ↔ ${targetStation.name.replace('Trạm ', '')}`)
    }
  }

  const handleMoveStop = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === selectedStops.length - 1) return

    const targetIdx = direction === 'up' ? index - 1 : index + 1
    const copy = [...selectedStops]
    const temp = copy[index]
    copy[index] = copy[targetIdx]
    copy[targetIdx] = temp

    // Re-index stopOrder
    const reindexed = copy.map((item, idx) => ({
      ...item,
      stopOrder: idx + 1,
    }))
    setSelectedStops(reindexed)

    if (reindexed.length >= 2) {
      setOrigin(reindexed[0].name)
      setDestination(reindexed[reindexed.length - 1].name)
      setName(
        `${reindexed[0].name.replace('Trạm ', '')} ↔ ${reindexed[reindexed.length - 1].name.replace('Trạm ', '')}`,
      )
    }
  }

  const handleRemoveStop = (index: number) => {
    const filtered = selectedStops.filter((_, idx) => idx !== index)
    const reindexed = filtered.map((item, idx) => ({
      ...item,
      stopOrder: idx + 1,
    }))
    setSelectedStops(reindexed)

    if (reindexed.length >= 2) {
      setOrigin(reindexed[0].name)
      setDestination(reindexed[reindexed.length - 1].name)
      setName(
        `${reindexed[0].name.replace('Trạm ', '')} ↔ ${reindexed[reindexed.length - 1].name.replace('Trạm ', '')}`,
      )
    } else if (reindexed.length === 1) {
      setOrigin(reindexed[0].name)
    }
  }

  const handleBasePriceChange = (val: number) => {
    setBasePrice(val)
    if (!route) {
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

    if (selectedStops.length < 2 && !isEdit) {
      setErrorMessage('Vui lòng chọn ít nhất 2 trạm dừng (Điểm đón & Điểm trả) để tạo lộ trình tuyến xe!')
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
          stops: selectedStops.map((s) => ({
            stationId: s.stationId,
            stopOrder: s.stopOrder,
            distanceFromOriginKm: s.distanceFromOriginKm,
            estimatedMinutes: s.estimatedMinutes,
          })),
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
          stops: selectedStops.map((s) => ({
            stationId: s.stationId,
            stopOrder: s.stopOrder,
            distanceFromOriginKm: s.distanceFromOriginKm,
            estimatedMinutes: s.estimatedMinutes,
          })),
          assignedDriverId: assignedDriverId || undefined,
          assignedVehicleId: assignedVehicleId || undefined,
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-5xl xl:max-w-6xl max-h-[94vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-emerald-50/50 via-white to-slate-50/50 dark:from-slate-800/60 dark:via-slate-900 dark:to-slate-850">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-900/20">
              <RouteIcon size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  {isEdit ? `Chỉnh Sửa Tuyến: ${route?.routeCode}` : 'Tạo Tuyến Mới & Phân Quyền Vận Hành'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Supabase Live DB
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEdit
                  ? 'Cập nhật cự ly, thời gian biểu và điểm đón/trả khách'
                  : 'Khai báo tuyến xe buýt chuyên điểm đón, phân công tài xế & xe buýt tự động sinh chuyến'}
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

        {/* Form Body - 2 Columns */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* CỘT TRÁI (5 Cột): THÔNG TIN PHÁP LÝ & BIỂU GIÁ */}
            <div className="lg:col-span-6 space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
                <Sparkles size={14} className="text-emerald-600" />
                <span>1. Thông Tin Tuyến & Biểu Giá</span>
              </div>

              {/* Mã tuyến & Trạng thái */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    Mã tuyến <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: CT-03"
                    disabled={isEdit}
                    value={routeCode}
                    onChange={(e) => setRouteCode(e.target.value.toUpperCase())}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold font-mono text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="active">Đang hoạt động</option>
                    <option value="inactive">Tạm ngưng</option>
                  </select>
                </div>
              </div>

              {/* Tên tuyến */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                  Tên hiển thị toàn tuyến <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ký Túc Xá ICTU ↔ Bến Xe Thái Nguyên"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-medium text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Điểm xuất phát & Điểm đến thông minh với gợi ý POI / Trạm Thái Nguyên & Auto Calculation */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Navigation size={13} className="text-emerald-600" />
                    <span>2 Đầu Bến Toàn Tuyến (Điểm Đón / Trả Chính)</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <Zap size={11} className="fill-emerald-600 text-emerald-600" />
                    Tự động tính cự ly & thời gian
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Ô Điểm Xuất Phát */}
                  <div className="relative">
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                      Điểm xuất phát (Đầu bến 1) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <MapPin size={15} className="absolute left-3 text-emerald-600 z-10 shrink-0" />
                      <input
                        type="text"
                        placeholder="Chọn trạm hoặc tìm địa điểm..."
                        value={origin}
                        readOnly={false}
                        onChange={(e) => {
                          setOrigin(e.target.value)
                          setOriginSearch(e.target.value)
                          setIsOriginOpen(true)
                          setIsDestOpen(false)
                        }}
                        onFocus={() => {
                          setIsOriginOpen(true)
                          setIsDestOpen(false)
                        }}
                        className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-16 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none transition-all"
                      />
                      <div className="absolute right-2 flex items-center gap-1">
                        {origin && (
                          <button
                            type="button"
                            onClick={() => {
                              setOrigin('')
                              setOriginSearch('')
                              setIsOriginOpen(true)
                            }}
                            title="Xóa để chọn trạm khác"
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setIsOriginOpen(!isOriginOpen)
                            setIsDestOpen(false)
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <ChevronDown size={14} className={`transition-transform duration-200 ${isOriginOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Dropdown Gợi ý Trạm / POI Điểm xuất phát */}
                    {isOriginOpen && (
                      <div className="absolute z-30 left-0 right-0 mt-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-150">
                        {/* Thanh tìm kiếm nhanh bên trong Dropdown */}
                        <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80">
                          <div className="relative flex items-center">
                            <Search size={13} className="absolute left-2.5 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Tìm nhanh tên trạm, trường ĐH, bến xe..."
                              value={originSearch}
                              onChange={(e) => setOriginSearch(e.target.value)}
                              className="w-full h-8 pl-8 pr-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                              autoFocus
                            />
                            {originSearch && (
                              <button
                                type="button"
                                onClick={() => setOriginSearch('')}
                                className="absolute right-2 text-slate-400 hover:text-slate-600"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-slate-400">
                            <span>Có {originSuggestions.length} địa điểm sẵn có</span>
                            <button
                              type="button"
                              onClick={() => setIsOriginOpen(false)}
                              className="text-emerald-600 font-bold hover:underline cursor-pointer"
                            >
                              Đóng
                            </button>
                          </div>
                        </div>

                        {/* Danh sách cuộn trạm dừng */}
                        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                          {originSuggestions.length === 0 ? (
                            <div className="p-4 text-slate-400 text-center">Không tìm thấy trạm phù hợp từ khóa &quot;{originSearch}&quot;</div>
                          ) : (
                            originSuggestions.map((place) => {
                              const isSelected = origin === place.name
                              return (
                                <button
                                  key={place.id}
                                  type="button"
                                  onClick={() => handleSelectOrigin(place)}
                                  className={`w-full text-left px-3.5 py-2.5 hover:bg-emerald-50 dark:hover:bg-slate-800/80 flex items-start gap-2.5 transition-colors cursor-pointer ${
                                    isSelected ? 'bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100' : ''
                                  }`}
                                >
                                  <MapPin size={15} className={`shrink-0 mt-0.5 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-slate-900 dark:text-white">{place.name}</span>
                                      {place.isHub && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                                          ★ Hub
                                        </span>
                                      )}
                                      {isSelected && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-600 text-white">
                                          Đang chọn
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{place.address}</p>
                                  </div>
                                </button>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ô Điểm Đến */}
                  <div className="relative">
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                      Điểm đến (Đầu bến 2) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <MapPin size={15} className="absolute left-3 text-rose-500 z-10 shrink-0" />
                      <input
                        type="text"
                        placeholder="Chọn trạm hoặc tìm địa điểm..."
                        value={destination}
                        readOnly={false}
                        onChange={(e) => {
                          setDestination(e.target.value)
                          setDestSearch(e.target.value)
                          setIsDestOpen(true)
                          setIsOriginOpen(false)
                        }}
                        onFocus={() => {
                          setIsDestOpen(true)
                          setIsOriginOpen(false)
                        }}
                        className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-16 text-xs font-bold text-slate-900 dark:text-white focus:border-rose-500 focus:outline-none transition-all"
                      />
                      <div className="absolute right-2 flex items-center gap-1">
                        {destination && (
                          <button
                            type="button"
                            onClick={() => {
                              setDestination('')
                              setDestSearch('')
                              setIsDestOpen(true)
                            }}
                            title="Xóa để chọn trạm khác"
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setIsDestOpen(!isDestOpen)
                            setIsOriginOpen(false)
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <ChevronDown size={14} className={`transition-transform duration-200 ${isDestOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Dropdown Gợi ý Trạm / POI Điểm đến */}
                    {isDestOpen && (
                      <div className="absolute z-30 left-0 right-0 mt-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-150">
                        {/* Thanh tìm kiếm nhanh bên trong Dropdown */}
                        <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80">
                          <div className="relative flex items-center">
                            <Search size={13} className="absolute left-2.5 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Tìm nhanh tên trạm, trường ĐH, bến xe..."
                              value={destSearch}
                              onChange={(e) => setDestSearch(e.target.value)}
                              className="w-full h-8 pl-8 pr-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                              autoFocus
                            />
                            {destSearch && (
                              <button
                                type="button"
                                onClick={() => setDestSearch('')}
                                className="absolute right-2 text-slate-400 hover:text-slate-600"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-slate-400">
                            <span>Có {destSuggestions.length} địa điểm sẵn có</span>
                            <button
                              type="button"
                              onClick={() => setIsDestOpen(false)}
                              className="text-rose-600 font-bold hover:underline cursor-pointer"
                            >
                              Đóng
                            </button>
                          </div>
                        </div>

                        {/* Danh sách cuộn trạm dừng */}
                        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                          {destSuggestions.length === 0 ? (
                            <div className="p-4 text-slate-400 text-center">Không tìm thấy trạm phù hợp từ khóa &quot;{destSearch}&quot;</div>
                          ) : (
                            destSuggestions.map((place) => {
                              const isSelected = destination === place.name
                              return (
                                <button
                                  key={place.id}
                                  type="button"
                                  onClick={() => handleSelectDest(place)}
                                  className={`w-full text-left px-3.5 py-2.5 hover:bg-rose-50 dark:hover:bg-slate-800/80 flex items-start gap-2.5 transition-colors cursor-pointer ${
                                    isSelected ? 'bg-rose-50/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100' : ''
                                  }`}
                                >
                                  <MapPin size={15} className={`shrink-0 mt-0.5 ${isSelected ? 'text-rose-500' : 'text-slate-400'}`} />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-slate-900 dark:text-white">{place.name}</span>
                                      {place.isHub && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                                          ★ Hub
                                        </span>
                                      )}
                                      {isSelected && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-600 text-white">
                                          Đang chọn
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{place.address}</p>
                                  </div>
                                </button>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Badge thông tin cự ly & thời gian tự động tính */}
                {distanceKm > 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-300">
                    <Compass size={13} className="text-emerald-600 shrink-0" />
                    <span>
                      Khoảng cách đo đạc: <strong className="text-emerald-700 dark:text-emerald-400 font-black">{distanceKm} km</strong> · Thời gian chạy ước tính: <strong className="text-slate-900 dark:text-white font-black">{estimatedDurationMinutes} phút</strong> (tốc độ xe buýt 26 km/h)
                    </span>
                  </div>
                )}
              </div>

              {/* Cự ly & Thời gian dự kiến */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    Cự ly (km)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(Number(e.target.value))}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    Thời gian chạy (phút)
                  </label>
                  <input
                    type="number"
                    min="5"
                    value={estimatedDurationMinutes}
                    onChange={(e) => setEstimatedDurationMinutes(Number(e.target.value))}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Biểu giá vé chuẩn & Giá sinh viên */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                <div>
                  <label className="block text-xs font-black text-emerald-950 dark:text-emerald-300 mb-1">
                    Giá vé chuẩn (VNĐ) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="1000"
                    min="1000"
                    value={basePrice}
                    onChange={(e) => handleBasePriceChange(Number(e.target.value))}
                    className="h-10 w-full rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 px-3 text-xs font-extrabold text-emerald-700 dark:text-emerald-400 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-emerald-950 dark:text-emerald-300 mb-1">
                    Vé Sinh Viên (-50%)
                  </label>
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    value={studentPrice}
                    onChange={(e) => setStudentPrice(Number(e.target.value))}
                    className="h-10 w-full rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 px-3 text-xs font-extrabold text-emerald-700 dark:text-emerald-400 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Giờ xuất bến, giờ đóng tuyến & tần suất */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Mở tuyến
                  </label>
                  <input
                    type="text"
                    value={operatingStart}
                    onChange={(e) => setOperatingStart(e.target.value)}
                    className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Đóng tuyến
                  </label>
                  <input
                    type="text"
                    value={operatingEnd}
                    onChange={(e) => setOperatingEnd(e.target.value)}
                    className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Tần suất
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="5"
                      value={frequencyMinutes}
                      onChange={(e) => setFrequencyMinutes(Number(e.target.value))}
                      className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400">ph</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI (6 Cột): LỘ TRÌNH ĐÓN/TRẢ & PHÂN CÔNG TÀI XẾ */}
            <div className="lg:col-span-6 space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-400">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-emerald-600" />
                  <span>2. Điểm Đón/Trả & Phân Công Ca Chạy</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-600 lowercase">
                  {selectedStops.length} trạm lộ trình
                </span>
              </div>

              {/* Bộ chọn thêm Trạm Dừng vào Lộ trình */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
                  Thêm Điểm Đón / Trả Khách Vào Lộ Trình
                </label>
                <div className="flex gap-2">
                  <select
                    value={stopToAdd}
                    onChange={(e) => setStopToAdd(e.target.value)}
                    className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  >
                    {availableStations.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} {st.isHub ? '★ Hub' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddStop}
                    className="px-3.5 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Plus size={15} />
                    <span>Thêm</span>
                  </button>
                </div>
              </div>

              {/* Danh sách các trạm đã thêm theo thứ tự lộ trình */}
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {selectedStops.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-400">
                    Chưa có trạm nào trong lộ trình. Hãy chọn trạm ở trên và bấm "Thêm".
                  </div>
                ) : (
                  selectedStops.map((stop, idx) => (
                    <div
                      key={stop.stationId}
                      className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[11px] font-black flex items-center justify-center shrink-0">
                          {stop.stopOrder}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {stop.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            +{stop.distanceFromOriginKm} km · +{stop.estimatedMinutes} phút
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveStop(idx, 'up')}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === selectedStops.length - 1}
                          onClick={() => handleMoveStop(idx, 'down')}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStop(idx)}
                          className="p-1 rounded-md text-rose-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* PHÂN QUYỀN TÀI XẾ & GÁN XE BUÝT VẬN HÀNH */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                  <UserCheck size={15} className="text-emerald-600" />
                  <span>Phân Quyền Tài Xế & Gán Phương Tiện</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Chọn Tài xế */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Tài xế phụ trách tuyến
                    </label>
                    <select
                      value={assignedDriverId}
                      onChange={(e) => setAssignedDriverId(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                    >
                      {availableDrivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Chọn Phương tiện */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Xe buýt vận hành (EV)
                    </label>
                    <select
                      value={assignedVehicleId}
                      onChange={(e) => setAssignedVehicleId(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                    >
                      {availableVehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.licensePlate} ({v.model || 'VinFast EV'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                  ✓ Khi bấm lưu, hệ thống tự động sinh 6 chuyến xe hôm nay trong database cho tài xế và phương tiện này!
                </p>
              </div>
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
                  <span>Đang lưu vào Supabase...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>{isEdit ? 'Lưu Cập Nhật Tuyến' : 'Lưu Tuyến & Phân Công Ca Chạy'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
