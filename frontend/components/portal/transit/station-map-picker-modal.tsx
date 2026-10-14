'use client'

import React, { useState } from 'react'
import {
  X,
  MapPin,
  Check,
  Compass,
  Navigation,
  Sparkles,
  Building,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
} from 'lucide-react'
import { transitService } from '@/lib/services/transit.service'
import type { TransitStation, CreateStationPayload } from '@/lib/types/transit'

interface StationMapPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onStationCreated: (station: TransitStation) => void
}

// Danh sách các điểm mốc trung tâm sinh viên & giao thông TP. Thái Nguyên
const THAI_NGUYEN_HUBS = [
  {
    name: 'Trạm ĐH CNTT & TT Thái Nguyên (ICTU)',
    address: 'Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên',
    latitude: 21.585284,
    longitude: 105.806297,
    isHub: true,
  },
  {
    name: 'Trạm KTX Sinh viên ICTU',
    address: 'Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên',
    latitude: 21.587123,
    longitude: 105.808234,
    isHub: false,
  },
  {
    name: 'Trạm Đại học Sư Phạm Thái Nguyên',
    address: 'Số 20 Đường Lương Ngọc Quyến, TP. Thái Nguyên',
    latitude: 21.591234,
    longitude: 105.818901,
    isHub: true,
  },
  {
    name: 'Trạm Bến xe Đồng Quang (Mỏ Bạch)',
    address: 'Đường Quang Trung, TP. Thái Nguyên',
    latitude: 21.593456,
    longitude: 105.821234,
    isHub: true,
  },
  {
    name: 'Trạm Quảng trường Võ Nguyên Giáp',
    address: 'Đường Đội Cấn, Phường Trưng Vương, TP. Thái Nguyên',
    latitude: 21.59325,
    longitude: 105.8451,
    isHub: false,
  },
  {
    name: 'Trạm BV Đa Khoa Trung Ương Thái Nguyên',
    address: 'Số 479 Đường Lương Ngọc Quyến, TP. Thái Nguyên',
    latitude: 21.598765,
    longitude: 105.832109,
    isHub: true,
  },
  {
    name: 'Trạm Bến xe Trung tâm Thái Nguyên',
    address: 'Đường Lương Ngọc Quyến, TP. Thái Nguyên',
    latitude: 21.604321,
    longitude: 105.845678,
    isHub: true,
  },
  {
    name: 'Trạm Bến xe Nam Thái Nguyên',
    address: 'Phường Tích Lương, TP. Thái Nguyên',
    latitude: 21.54321,
    longitude: 105.854321,
    isHub: true,
  },
]

export function StationMapPickerModal({
  isOpen,
  onClose,
  onStationCreated,
}: StationMapPickerModalProps) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState<number>(21.585284)
  const [longitude, setLongitude] = useState<number>(105.806297)
  const [isHub, setIsHub] = useState<boolean>(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [filterQuery, setFilterQuery] = useState('')

  if (!isOpen) return null

  // Khi bấm chọn một trạm Hub mẫu
  const handleSelectPreset = (preset: (typeof THAI_NGUYEN_HUBS)[0]) => {
    setName(preset.name)
    setAddress(preset.address)
    setLatitude(preset.latitude)
    setLongitude(preset.longitude)
    setIsHub(preset.isHub)
  }

  // Click giả lập trên bản đồ khu vực để lấy tọa độ
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const xRatio = (e.clientX - rect.left) / rect.width
    const yRatio = (e.clientY - rect.top) / rect.height

    // Tọa độ bounding box TP. Thái Nguyên (xấp xỉ lat 21.50 -> 21.62, lng 105.78 -> 105.89)
    const lat = +(21.62 - yRatio * 0.12).toFixed(6)
    const lng = +(105.78 + xRatio * 0.11).toFixed(6)

    setLatitude(lat)
    setLongitude(lng)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!name.trim()) {
      setErrorMessage('Vui lòng nhập tên trạm dừng!')
      return
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setErrorMessage('Tọa độ GPS không hợp lệ!')
      return
    }

    setIsSubmitting(true)

    try {
      const payload: CreateStationPayload = {
        name: name.trim(),
        address: address.trim() || undefined,
        latitude: Number(latitude),
        longitude: Number(longitude),
        isHub,
      }
      const res = await transitService.createStation(payload)
      if (res.success && res.data) {
        onStationCreated(res.data)
        onClose()
      } else {
        setErrorMessage(res.message || 'Lỗi khi tạo trạm dừng!')
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Có lỗi phát sinh khi lưu trạm!')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredPresets = THAI_NGUYEN_HUBS.filter(
    (h) =>
      h.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      h.address.toLowerCase().includes(filterQuery.toLowerCase()),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <MapPin size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Chọn Vị Trí & Tạo Trạm Dừng Mới
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ghim tọa độ GPS chuẩn trên bản đồ Thành phố Thái Nguyên
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

        {/* Content Body Grid: Cột trái Bản đồ & Cột phải Form */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* CỘT TRÁI: BẢN ĐỒ CHỌN TỌA ĐỘ VÀ HUB GỢI Ý */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Vùng bản đồ tương tác ghim điểm */}
            <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-inner">
              <div
                onClick={handleMapClick}
                className="w-full h-64 sm:h-72 relative cursor-crosshair select-none bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#334155_1px,transparent_1px)]"
              >
                {/* Lưới trục sông Cầu và các trục lộ giao thông Thái Nguyên */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
                  <path
                    d="M 20 180 Q 200 120 400 160 T 800 140"
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  <line x1="50" y1="20" x2="750" y2="280" stroke="#94a3b8" strokeWidth="4" />
                  <line x1="120" y1="280" x2="680" y2="30" stroke="#94a3b8" strokeWidth="4" />
                  <circle cx="220" cy="180" r="14" fill="#10b981" opacity="0.3" />
                  <circle cx="520" cy="140" r="14" fill="#3b82f6" opacity="0.3" />
                </svg>

                {/* Vị trí ghim điểm đang chọn */}
                <div
                  className="absolute pointer-events-none -translate-x-1/2 -translate-y-full transition-all duration-150"
                  style={{
                    left: `${Math.min(95, Math.max(5, ((longitude - 105.78) / 0.11) * 100))}%`,
                    top: `${Math.min(95, Math.max(10, ((21.62 - latitude) / 0.12) * 100))}%`,
                  }}
                >
                  <div className="relative flex flex-col items-center">
                    <div className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-black shadow-lg whitespace-nowrap mb-1 flex items-center gap-1">
                      <MapPin size={10} className="text-emerald-400" />
                      <span>{name || 'Vị trí đã chọn'}</span>
                    </div>
                    <div className="size-8 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg animate-bounce">
                      <MapPin size={18} />
                    </div>
                    <div className="size-2 rounded-full bg-rose-900/40 animate-ping mt-0.5" />
                  </div>
                </div>

                {/* Hint overlay */}
                <div className="absolute top-3 left-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 shadow-xs pointer-events-none">
                  🎯 Click lên bản đồ để lấy tọa độ GPS
                </div>

                <div className="absolute bottom-3 right-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] font-mono text-slate-500">
                  Lat: {latitude} | Lng: {longitude}
                </div>
              </div>
            </div>

            {/* Danh sách Hub điểm đón mẫu gợi ý 1 chạm */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-500" />
                  <span>Điểm đón gợi ý TP. Thái Nguyên:</span>
                </span>
                <span className="text-[11px] text-slate-400">Chọn để điền nhanh</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {THAI_NGUYEN_HUBS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-lg bg-slate-100 dark:bg-slate-700 group-hover:bg-emerald-100 text-slate-600 group-hover:text-emerald-700 flex items-center justify-center shrink-0">
                        <Building size={12} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-emerald-700">
                          {preset.name}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {preset.address}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: FORM NHẬP THÔNG TIN TRẠM DỪNG */}
          <form onSubmit={handleSubmit} className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  Tên trạm dừng xe buýt <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: Trạm ĐH Sư Phạm Thái Nguyên"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  Địa chỉ trạm dừng
                </label>
                <input
                  type="text"
                  placeholder="VD: Số 20 Lương Ngọc Quyến, TP. Thái Nguyên"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-medium text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Tọa độ GPS */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                    Vĩ độ (Latitude)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={latitude}
                    onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                    className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                    Kinh độ (Longitude)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={longitude}
                    onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                    className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Checkbox Trạm Đầu mối (Hub) */}
              <label className="flex items-center gap-2.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer hover:border-emerald-500 transition-all">
                <input
                  type="checkbox"
                  checked={isHub}
                  onChange={(e) => setIsHub(e.target.checked)}
                  className="size-4 text-emerald-600 rounded-md focus:ring-emerald-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Trạm trung chuyển chính (Transit Hub)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Trạm kết nối nhiều tuyến xe hoặc bến xe liên tỉnh
                  </span>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs shadow-md shadow-indigo-900/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Lưu & Tạo Trạm Dừng</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
