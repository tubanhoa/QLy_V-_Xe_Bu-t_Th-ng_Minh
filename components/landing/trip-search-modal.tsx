'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  Bus,
  Calendar,
  Clock,
  Filter,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { searchService } from '@/lib/services/search.service'
import { Station, TripSearchResult } from '@/lib/types/sprint1'
import { cn } from '@/lib/utils'

interface TripSearchModalProps {
  open: boolean
  onClose: () => void
  onSelectTrip?: (trip: TripSearchResult) => void
  initialOrigin?: string
  initialDestination?: string
  initialDate?: string
}

export function TripSearchModal({
  open,
  onClose,
  onSelectTrip,
  initialOrigin = '',
  initialDestination = '',
  initialDate = '',
}: TripSearchModalProps) {
  // Lấy ngày hôm nay theo format YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0]

  const [origin, setOrigin] = useState(initialOrigin)
  const [destination, setDestination] = useState(initialDestination)
  const [date, setDate] = useState(initialDate || todayStr)

  const [trips, setTrips] = useState<TripSearchResult[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  // Khởi tạo và nạp danh sách trạm gợi ý
  useEffect(() => {
    if (open) {
      loadStations()
      if (initialOrigin || initialDestination) {
        setOrigin(initialOrigin)
        setDestination(initialDestination)
        handleSearch(initialOrigin, initialDestination, date || todayStr)
      } else {
        // Tự động tìm kiếm mặc định toàn bộ chuyến hôm nay
        handleSearch('', '', date || todayStr)
      }
    }
  }, [open, initialOrigin, initialDestination])

  const loadStations = async () => {
    try {
      const stationList = await searchService.getUniqueStations()
      setStations(stationList)
    } catch (err) {
      console.error('Không thể nạp danh sách trạm:', err)
    }
  }

  const handleSearch = async (searchOrigin = origin, searchDest = destination, searchDate = date) => {
    setLoading(true)
    setError(null)
    setHasSearched(true)

    try {
      const res = await searchService.searchTrips({
        origin: searchOrigin.trim() || undefined,
        destination: searchDest.trim() || undefined,
        date: searchDate.trim() || undefined,
      })

      if (res.success && res.data) {
        setTrips(res.data)
      } else {
        setError(res.message || 'Không thể tìm thấy chuyến xe phù hợp')
        setTrips([])
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi kết nối máy chủ')
      setTrips([])
    } finally {
      setLoading(false)
    }
  }

  const handleSwapStations = () => {
    const temp = origin
    setOrigin(destination)
    setDestination(temp)
    handleSearch(destination, temp, date)
  }

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--'
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
    } catch {
      return isoString.substring(11, 16)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-gradient-to-r from-emerald-50 via-white to-teal-50">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#005A36] text-white shadow-md shadow-emerald-900/10">
              <Bus size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">Tìm Kiếm & Đặt Chuyến Xe Buýt</h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-[#005A36]">
                  LIVE DATA
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Dữ liệu chuyến chạy thời gian thực từ máy chủ ICTU Transit
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Filter Form */}
        <div className="border-b border-slate-100 bg-slate-50/60 p-4 sm:p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSearch()
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_170px] gap-2.5 items-center">
              {/* Điểm xuất phát (Origin) */}
              <div className="relative">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Trạm đón / Điểm đi
                </label>
                <div className="relative flex items-center">
                  <MapPin size={16} className="absolute left-3 text-[#005A36]" />
                  <input
                    type="text"
                    list="station-origin-options"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="VD: ĐH CNTT & TT Thái Nguyên"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:border-[#005A36] focus:ring-2 focus:ring-[#005A36]/15 shadow-xs"
                  />
                  <datalist id="station-origin-options">
                    {stations.map((st) => (
                      <option key={st.id || st.name} value={st.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Nút Swap Trạm */}
              <div className="flex justify-center md:pt-5">
                <button
                  type="button"
                  onClick={handleSwapStations}
                  title="Đổi chiều điểm đi / điểm đến"
                  className="size-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-[#005A36] hover:border-[#005A36] hover:bg-emerald-50/50 shadow-xs flex items-center justify-center transition-all active:scale-90"
                >
                  <ArrowUpDown size={16} className="md:rotate-90" />
                </button>
              </div>

              {/* Điểm kết thúc (Destination) */}
              <div className="relative">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Trạm trả / Điểm đến
                </label>
                <div className="relative flex items-center">
                  <MapPin size={16} className="absolute left-3 text-emerald-700" />
                  <input
                    type="text"
                    list="station-dest-options"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="VD: Bến Xe Trung Tâm Thái Nguyên"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:border-[#005A36] focus:ring-2 focus:ring-[#005A36]/15 shadow-xs"
                  />
                  <datalist id="station-dest-options">
                    {stations.map((st) => (
                      <option key={st.id || st.name} value={st.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Ngày đi (Date) */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Ngày khởi hành
                </label>
                <div className="relative flex items-center">
                  <Calendar size={16} className="absolute left-3 text-slate-400" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-2.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:border-[#005A36] focus:ring-2 focus:ring-[#005A36]/15 shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons & Quick Filter Tags */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-medium">Gợi ý tuyến:</span>
                <button
                  type="button"
                  onClick={() => {
                    setOrigin('ĐH CNTT & TT Thái Nguyên')
                    setDestination('Bến Xe Trung Tâm Thái Nguyên')
                    handleSearch('ĐH CNTT & TT Thái Nguyên', 'Bến Xe Trung Tâm Thái Nguyên', date)
                  }}
                  className="rounded-lg bg-emerald-50 px-2 py-1 font-bold text-[#005A36] border border-emerald-200/60 hover:bg-emerald-100 transition-colors text-[11px]"
                >
                  CT-01 (ICTU ↔ Bến Xe TP)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrigin('Bến Xe Nam Thái Nguyên')
                    setDestination('Khu Công Nghiệp Sông Công')
                    handleSearch('Bến Xe Nam Thái Nguyên', 'Khu Công Nghiệp Sông Công', date)
                  }}
                  className="rounded-lg bg-teal-50 px-2 py-1 font-bold text-teal-800 border border-teal-200/60 hover:bg-teal-100 transition-colors text-[11px]"
                >
                  CT-02 (BX Nam ↔ KCN Sông Công)
                </button>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {(origin || destination) && (
                  <button
                    type="button"
                    onClick={() => {
                      setOrigin('')
                      setDestination('')
                      handleSearch('', '', date)
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-1"
                  >
                    Xóa lọc
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#005A36] px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md hover:bg-[#004529] active:scale-95 disabled:opacity-70 transition-all"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} strokeWidth={2.5} />}
                  <span>Tìm Chuyến</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Results List Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
          {/* Loading Skeletons */}
          {loading && (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="h-6 w-36 rounded-md bg-slate-200" />
                    <div className="h-6 w-24 rounded-md bg-slate-200" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="h-4 rounded bg-slate-200" />
                    <div className="h-4 rounded bg-slate-200" />
                    <div className="h-4 rounded bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error Message */}
          {!loading && error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 sm:p-5 text-rose-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertCircle size={18} className="text-rose-600 shrink-0" />
                <span>Không tìm thấy chuyến hoặc lộ trình không hợp lệ</span>
              </div>
              <p className="text-xs text-rose-700 pl-6 leading-relaxed">
                {error}. Lưu ý: Trạm xuất phát phải nằm trước trạm kết thúc theo đúng chiều chạy của tuyến buýt.
              </p>
              <div className="pl-6 pt-1">
                <button
                  type="button"
                  onClick={() => handleSearch()}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-800 underline hover:text-rose-950"
                >
                  <RefreshCw size={13} />
                  <span>Thử lại</span>
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && hasSearched && trips.length === 0 && (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <Bus size={42} className="mx-auto text-slate-300 stroke-[1.5]" />
              <h4 className="text-sm font-bold text-slate-700">Không tìm thấy chuyến xe nào trong ngày này</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Hiện tại không có chuyến buýt nào khớp với lộ trình hoặc ngày khởi hành đã chọn. Vui lòng chọn một ngày khác hoặc kiểm tra lại chiều đi của trạm.
              </p>
            </div>
          )}

          {/* Real Trips List */}
          {!loading &&
            !error &&
            trips.length > 0 &&
            trips.map((trip) => {
              const depTime = formatTime(trip.departureTime)
              const arrTime = formatTime(trip.arrivalTime)
              const isAlmostFull = trip.availableSeats <= 5
              const isSoldOut = trip.availableSeats === 0

              return (
                <div
                  key={trip.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:border-[#005A36] hover:shadow-md transition-all group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="rounded-lg bg-[#005A36] px-2.5 py-1 text-xs font-black text-white shadow-xs">
                        {trip.routeCode}
                      </span>
                      <div>
                        <h4 className="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-[#005A36] transition-colors">
                          {trip.routeName}
                        </h4>
                        <span className="text-[11px] font-medium text-slate-500">
                          Biển số: <strong>{trip.vehiclePlate || '20B-EV'}</strong> · {trip.vehicleType === 'electric' ? 'Xe buýt điện thông minh' : 'Xe buýt'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-baseline sm:flex-col sm:items-end gap-2 sm:gap-0 shrink-0">
                      <div className="text-base sm:text-lg font-black text-[#005A36]">
                        {Number(trip.basePrice).toLocaleString('vi-VN')}đ
                      </div>
                      <div className="text-[11px] font-bold text-emerald-700">
                        HSSV: {Number(trip.studentPrice).toLocaleString('vi-VN')}đ (-50%)
                      </div>
                    </div>
                  </div>

                  {/* Timeline & Seat Availability */}
                  <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center">
                    <div className="flex items-center gap-3 text-xs">
                      {/* Timeline */}
                      <div className="flex items-center gap-2">
                        <div className="text-center">
                          <span className="block text-base font-black text-slate-900 leading-none">{depTime}</span>
                          <span className="text-[10px] text-slate-400 font-medium">Xuất bến</span>
                        </div>
                        <div className="flex flex-col items-center px-1">
                          <span className="text-[10px] font-bold text-slate-400">45p</span>
                          <div className="w-12 sm:w-16 h-0.5 bg-emerald-300 relative flex items-center justify-center">
                            <Bus size={10} className="text-[#005A36] absolute" />
                          </div>
                        </div>
                        <div className="text-center">
                          <span className="block text-base font-black text-slate-900 leading-none">{arrTime}</span>
                          <span className="text-[10px] text-slate-400 font-medium">Dự kiến đến</span>
                        </div>
                      </div>

                      {/* Seat Badge */}
                      <div className="ml-auto sm:ml-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
                            isSoldOut
                              ? 'bg-rose-100 text-rose-800'
                              : isAlmostFull
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-50 text-[#005A36] border border-emerald-200',
                          )}
                        >
                          <Users size={13} />
                          <span>
                            {isSoldOut
                              ? 'Hết chỗ'
                              : `Còn ${trip.availableSeats}/${trip.totalSeats || 28} chỗ`}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Book Action */}
                    <div className="flex justify-end pt-1 sm:pt-0">
                      <button
                        type="button"
                        disabled={isSoldOut}
                        onClick={() => {
                          onClose()
                          onSelectTrip?.(trip)
                        }}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black shadow-xs transition-all active:scale-95',
                          isSoldOut
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-[#005A36] text-white hover:bg-[#004529] hover:shadow-md',
                        )}
                      >
                        <Ticket size={15} />
                        <span>{isSoldOut ? 'Hết vé' : 'Chọn Ghế & Đặt Vé'}</span>
                        {!isSoldOut && <ArrowRight size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
