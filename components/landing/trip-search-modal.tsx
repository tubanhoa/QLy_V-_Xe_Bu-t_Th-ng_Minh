'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  BatteryCharging,
  Bus,
  Calendar,
  Check,
  Clock,
  Filter,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  Users,
  Wifi,
  Wind,
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

  type SortCriteria = 'departure' | 'price' | 'seats'
  type SortDirection = 'asc' | 'desc'

  const [filterType, setFilterType] = useState<'all' | 'soon' | 'available' | 'ct01' | 'ct02'>('all')
  const [sortBy, setSortBy] = useState<SortCriteria>('departure')
  const [sortOrder, setSortOrder] = useState<SortDirection>('asc')

  const handleToggleSort = (criteria: SortCriteria) => {
    if (sortBy === criteria) {
      // Đảo chiều sắp xếp khi người dùng bấm lại vào cùng tiêu chí
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      // Đổi sang tiêu chí mới với chiều mặc định tối ưu nhất
      setSortBy(criteria)
      // Mặc định: Giờ chạy -> asc (sớm nhất), Giá vé -> asc (thấp nhất), Ghế trống -> desc (nhiều nhất)
      setSortOrder(criteria === 'seats' ? 'desc' : 'asc')
    }
  }

  const filteredTrips = useMemo(() => {
    let result = [...trips]

    if (filterType === 'soon') {
      const now = new Date()
      result = result.filter((t) => {
        const dep = new Date(t.departureTime)
        const diffMinutes = (dep.getTime() - now.getTime()) / (1000 * 60)
        return diffMinutes > 0 && diffMinutes <= 90
      })
    } else if (filterType === 'available') {
      result = result.filter((t) => Number(t.availableSeats || 0) >= 10)
    } else if (filterType === 'ct01') {
      result = result.filter((t) => t.routeCode.includes('01'))
    } else if (filterType === 'ct02') {
      result = result.filter((t) => t.routeCode.includes('02'))
    }

    // Logic sắp xếp chính xác cho Giờ chạy, Giá vé và Ghế trống
    result.sort((a, b) => {
      if (sortBy === 'departure') {
        const timeA = new Date(a.departureTime).getTime() || 0
        const timeB = new Date(b.departureTime).getTime() || 0
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA
      }

      if (sortBy === 'price') {
        const priceA = Number(a.basePrice) || 0
        const priceB = Number(b.basePrice) || 0
        return sortOrder === 'asc' ? priceA - priceB : priceB - priceA
      }

      if (sortBy === 'seats') {
        const seatsA = Number(a.availableSeats) || 0
        const seatsB = Number(b.availableSeats) || 0
        return sortOrder === 'asc' ? seatsA - seatsB : seatsB - seatsA
      }

      return 0
    })

    return result
  }, [trips, filterType, sortBy, sortOrder])

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 overscroll-contain animate-in fade-in duration-150"
    >
      <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl overflow-hidden rounded-none sm:rounded-3xl bg-white shadow-2xl border-0 sm:border border-slate-100 flex flex-col will-change-transform">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-emerald-50 via-white to-teal-50 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex size-9 sm:size-11 items-center justify-center rounded-xl sm:rounded-2xl bg-[#005A36] text-white shadow-md shadow-emerald-900/10 shrink-0">
              <Bus size={20} className="sm:hidden" />
              <Bus size={22} className="hidden sm:block" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-lg font-black text-slate-900">Tìm Kiếm & Đặt Chuyến Xe</h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] sm:text-[10px] font-black text-[#005A36]">
                  LIVE DATA
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate max-w-[230px] sm:max-w-none">
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
        <div className="border-b border-slate-100 bg-slate-50/70 p-3.5 sm:p-5 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSearch()
            }}
            className="space-y-2.5 sm:space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_160px] gap-2 md:gap-2.5 items-stretch md:items-center">
              {/* Điểm xuất phát (Origin) */}
              <div className="relative">
                <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Trạm đón / Điểm đi
                </label>
                <div className="relative flex items-center">
                  <MapPin size={16} className="absolute left-3 text-[#005A36] shrink-0 pointer-events-none" />
                  <input
                    type="text"
                    list="station-origin-options"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="VD: ĐH CNTT & TT Thái Nguyên"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:border-[#005A36] focus:ring-2 focus:ring-[#005A36]/15 shadow-xs"
                  />
                  <datalist id="station-origin-options">
                    {stations.map((st) => (
                      <option key={st.id || st.name} value={st.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Nút Swap Trạm */}
              <div className="flex justify-center -my-1 md:my-0 md:pt-5 z-10">
                <button
                  type="button"
                  onClick={handleSwapStations}
                  title="Đổi chiều điểm đi / điểm đến"
                  className="size-7 md:size-9 rounded-full md:rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-[#005A36] hover:border-[#005A36] hover:bg-emerald-50/50 shadow-xs flex items-center justify-center transition-all active:scale-90"
                >
                  <ArrowUpDown size={14} className="md:rotate-90" />
                </button>
              </div>

              {/* Điểm kết thúc (Destination) */}
              <div className="relative">
                <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Trạm trả / Điểm đến
                </label>
                <div className="relative flex items-center">
                  <MapPin size={16} className="absolute left-3 text-emerald-700 shrink-0 pointer-events-none" />
                  <input
                    type="text"
                    list="station-dest-options"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="VD: Bến Xe Trung Tâm Thái Nguyên"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:border-[#005A36] focus:ring-2 focus:ring-[#005A36]/15 shadow-xs"
                  />
                  <datalist id="station-dest-options">
                    {stations.map((st) => (
                      <option key={st.id || st.name} value={st.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Ngày đi (Date) & Mobile Search Button */}
              <div className="grid grid-cols-2 md:grid-cols-1 gap-2 items-end">
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Ngày khởi hành
                  </label>
                  <div className="relative flex items-center">
                    <Calendar size={15} className="absolute left-2.5 text-slate-400 shrink-0 pointer-events-none" />
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-2 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:border-[#005A36] focus:ring-2 focus:ring-[#005A36]/15 shadow-xs"
                    />
                  </div>
                </div>

                {/* Mobile Search button */}
                <div className="md:hidden">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#005A36] px-3 py-2 text-xs font-black text-white shadow-md hover:bg-[#004529] active:scale-95 disabled:opacity-70 transition-all"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} strokeWidth={2.5} />}
                    <span>Tìm Chuyến</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons & Quick Filter Tags */}
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-1.5 text-xs overflow-x-auto no-scrollbar scroll-smooth py-0.5 shrink-0 max-w-full">
                <span className="text-slate-400 font-bold text-[11px] shrink-0">Gợi ý:</span>
                <button
                  type="button"
                  onClick={() => {
                    setOrigin('ĐH CNTT & TT Thái Nguyên')
                    setDestination('Bến Xe Trung Tâm Thái Nguyên')
                    handleSearch('ĐH CNTT & TT Thái Nguyên', 'Bến Xe Trung Tâm Thái Nguyên', date)
                  }}
                  className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1 font-bold text-[#005A36] border border-emerald-200/60 hover:bg-emerald-100 transition-colors text-[11px]"
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
                  className="shrink-0 rounded-lg bg-teal-50 px-2.5 py-1 font-bold text-teal-800 border border-teal-200/60 hover:bg-teal-100 transition-colors text-[11px]"
                >
                  CT-02 (BX Nam ↔ KCN Sông Công)
                </button>
              </div>

              <div className="flex items-center gap-2 ml-auto shrink-0">
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
                {/* Desktop Search Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="hidden md:inline-flex items-center gap-2 rounded-xl bg-[#005A36] px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md hover:bg-[#004529] active:scale-95 disabled:opacity-70 transition-all shrink-0"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} strokeWidth={2.5} />}
                  <span>Tìm Chuyến</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Quick Filter Tabs & Sorter Bar */}
        {trips.length > 0 && !loading && (
          <div className="border-b border-slate-100 bg-slate-50/80 px-3.5 sm:px-6 py-2 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shrink-0">
            {/* Filter Pills - Horizontally swipeable on mobile */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5 shrink-0 max-w-full">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mr-1 hidden sm:inline shrink-0">
                Lọc nhanh:
              </span>
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 font-bold text-xs transition-all flex items-center gap-1.5',
                  filterType === 'all'
                    ? 'bg-[#005A36] text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/60',
                )}
              >
                <span>Tất cả</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.2 text-[10px] font-black',
                    filterType === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {trips.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterType('soon')}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 font-bold text-xs transition-all flex items-center gap-1',
                  filterType === 'soon'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/60',
                )}
              >
                <Zap size={12} className={filterType === 'soon' ? 'text-amber-200' : 'text-amber-500'} />
                <span>Sắp xuất bến (&lt; 90p)</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterType('available')}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 font-bold text-xs transition-all flex items-center gap-1',
                  filterType === 'available'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/60',
                )}
              >
                <Users size={12} className={filterType === 'available' ? 'text-emerald-200' : 'text-emerald-600'} />
                <span>Còn nhiều chỗ (≥ 10)</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterType('ct01')}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 font-bold text-xs transition-all',
                  filterType === 'ct01'
                    ? 'bg-[#005A36] text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/60',
                )}
              >
                Tuyến CT-01
              </button>

              <button
                type="button"
                onClick={() => setFilterType('ct02')}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 font-bold text-xs transition-all',
                  filterType === 'ct02'
                    ? 'bg-[#005A36] text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/60',
                )}
              >
                Tuyến CT-02
              </button>
            </div>

            {/* Sorter Selector: Equal 3-column grid on mobile, inline on desktop */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto sm:ml-auto">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] hidden md:inline shrink-0">
                Sắp xếp:
              </span>
              <div className="grid grid-cols-3 sm:flex items-center rounded-xl bg-slate-200/60 p-0.5 border border-slate-200/80 w-full sm:w-auto">
                {/* Giờ chạy */}
                <button
                  type="button"
                  title="Nhấn để đổi chiều: Sớm nhất <-> Muộn nhất"
                  onClick={() => handleToggleSort('departure')}
                  className={cn(
                    'rounded-lg px-2 py-1.5 sm:px-2.5 sm:py-1 text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer select-none',
                    sortBy === 'departure'
                      ? 'bg-white text-[#005A36] shadow-xs ring-1 ring-emerald-300/80 font-black'
                      : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  <Clock size={12} className={sortBy === 'departure' ? 'text-[#005A36]' : 'text-slate-400'} />
                  <span>Giờ</span>
                  {sortBy === 'departure' ? (
                    <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-100/90 px-1 py-0.2 rounded flex items-center">
                      {sortOrder === 'asc' ? <ArrowUp size={10} strokeWidth={3} /> : <ArrowDown size={10} strokeWidth={3} />}
                      {sortOrder === 'asc' ? 'Sớm' : 'Muộn'}
                    </span>
                  ) : (
                    <span className="hidden sm:inline">chạy</span>
                  )}
                </button>

                {/* Giá vé */}
                <button
                  type="button"
                  title="Nhấn để đổi chiều: Thấp nhất <-> Cao nhất"
                  onClick={() => handleToggleSort('price')}
                  className={cn(
                    'rounded-lg px-2 py-1.5 sm:px-2.5 sm:py-1 text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer select-none',
                    sortBy === 'price'
                      ? 'bg-white text-[#005A36] shadow-xs ring-1 ring-emerald-300/80 font-black'
                      : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  <Ticket size={12} className={sortBy === 'price' ? 'text-[#005A36]' : 'text-slate-400'} />
                  <span>Giá</span>
                  {sortBy === 'price' ? (
                    <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-100/90 px-1 py-0.2 rounded flex items-center">
                      {sortOrder === 'asc' ? <ArrowUp size={10} strokeWidth={3} /> : <ArrowDown size={10} strokeWidth={3} />}
                      {sortOrder === 'asc' ? 'Thấp' : 'Cao'}
                    </span>
                  ) : (
                    <span className="hidden sm:inline">vé</span>
                  )}
                </button>

                {/* Ghế trống */}
                <button
                  type="button"
                  title="Nhấn để đổi chiều: Nhiều nhất <-> Ít nhất"
                  onClick={() => handleToggleSort('seats')}
                  className={cn(
                    'rounded-lg px-2 py-1.5 sm:px-2.5 sm:py-1 text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer select-none',
                    sortBy === 'seats'
                      ? 'bg-white text-[#005A36] shadow-xs ring-1 ring-emerald-300/80 font-black'
                      : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  <Users size={12} className={sortBy === 'seats' ? 'text-[#005A36]' : 'text-slate-400'} />
                  <span>Ghế</span>
                  {sortBy === 'seats' ? (
                    <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-100/90 px-1 py-0.2 rounded flex items-center">
                      {sortOrder === 'desc' ? <ArrowDown size={10} strokeWidth={3} /> : <ArrowUp size={10} strokeWidth={3} />}
                      {sortOrder === 'desc' ? 'Nhiều' : 'Ít'}
                    </span>
                  ) : (
                    <span className="hidden sm:inline">trống</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results List Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Active Sort Banner Indicator */}
          {!loading && !error && filteredTrips.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500 font-medium">
              <span>
                Tìm thấy <strong className="text-slate-900 font-bold">{filteredTrips.length}</strong> chuyến xe phù hợp
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-[#005A36] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60 font-bold">
                <SlidersHorizontal size={11} />
                <span>
                  Đang xếp:{' '}
                  <strong>
                    {sortBy === 'departure' &&
                      (sortOrder === 'asc'
                        ? 'Giờ xuất bến (Sớm nhất ➔ Muộn nhất)'
                        : 'Giờ xuất bến (Muộn nhất ➔ Sớm nhất)')}
                    {sortBy === 'price' &&
                      (sortOrder === 'asc'
                        ? 'Giá vé (Thấp nhất ➔ Cao nhất)'
                        : 'Giá vé (Cao nhất ➔ Thấp nhất)')}
                    {sortBy === 'seats' &&
                      (sortOrder === 'desc'
                        ? 'Ghế trống (Nhiều nhất ➔ Ít nhất)'
                        : 'Ghế trống (Ít nhất ➔ Nhiều nhất)')}
                  </strong>
                </span>
              </div>
            </div>
          )}
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

          {/* Empty Filtered State */}
          {!loading && !error && trips.length > 0 && filteredTrips.length === 0 && (
            <div className="py-10 text-center text-slate-500 space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-6">
              <Filter size={32} className="mx-auto text-slate-400 stroke-[1.5]" />
              <h4 className="text-sm font-bold text-slate-700">Không có chuyến nào khớp với bộ lọc đã chọn</h4>
              <p className="text-xs text-slate-500">
                Hãy chuyển về chế độ &quot;Tất cả&quot; để theo dõi toàn bộ danh sách {trips.length} chuyến xe buýt đang vận hành.
              </p>
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#005A36] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#004529]"
              >
                <span>Xem tất cả {trips.length} chuyến</span>
              </button>
            </div>
          )}

          {/* Real Filtered Trips List */}
          {!loading &&
            !error &&
            filteredTrips.length > 0 &&
            filteredTrips.map((trip) => {
              const depTime = formatTime(trip.departureTime)
              const arrTime = formatTime(trip.arrivalTime)
              const totalSeats = trip.totalSeats || 28
              const availableSeats = trip.availableSeats
              const occupiedSeats = Math.max(0, totalSeats - availableSeats)
              const occupancyRate = Math.min(100, Math.round((occupiedSeats / totalSeats) * 100))
              const isAlmostFull = availableSeats > 0 && availableSeats <= 5
              const isSoldOut = availableSeats === 0

              return (
                <div
                  key={trip.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:border-[#005A36] hover:shadow-md transition-all group relative overflow-hidden"
                >
                  {/* Top Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="rounded-xl bg-[#005A36] px-3 py-1.5 text-xs font-black text-white shadow-xs tracking-wider">
                        {trip.routeCode}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-[#005A36] transition-colors">
                            {trip.routeName}
                          </h4>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-[#005A36] border border-emerald-200/60">
                            <Zap size={10} className="fill-[#005A36]" /> Xe Buýt Điện
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-slate-500">
                          Biển số: <strong className="text-slate-700">{trip.vehiclePlate || '20B-EV'}</strong> · Sức chứa chuẩn: {totalSeats} chỗ ngồi
                        </span>
                      </div>
                    </div>

                    <div className="flex items-baseline sm:flex-col sm:items-end gap-2 sm:gap-0.5 shrink-0">
                      <div className="text-lg sm:text-xl font-black text-[#005A36]">
                        {Number(trip.basePrice).toLocaleString('vi-VN')}đ
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-800 border border-emerald-200">
                        <Sparkles size={11} className="text-emerald-600" />
                        <span>SV ICTU: {Number(trip.studentPrice).toLocaleString('vi-VN')}đ (-50%)</span>
                      </div>
                    </div>
                  </div>

                  {/* Route Timeline & Book Button */}
                  <div className="my-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
                    <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 text-xs flex-1">
                      {/* Departure */}
                      <div className="text-left shrink-0">
                        <span className="block text-base sm:text-lg font-black text-slate-900 leading-none">{depTime}</span>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Khởi hành</span>
                      </div>

                      {/* Travel Line */}
                      <div className="flex-1 flex flex-col items-center px-1.5 sm:px-2 max-w-[190px] sm:max-w-none">
                        <div className="flex items-center gap-1 text-[10px] font-extrabold text-slate-500 mb-1">
                          <Clock size={11} className="text-slate-400" />
                          <span>45 phút dự kiến</span>
                        </div>
                        <div className="w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-[#005A36] rounded-full relative flex items-center justify-center shadow-xs">
                          <div className="size-5 rounded-full bg-white border-2 border-[#005A36] text-[#005A36] flex items-center justify-center shadow-xs">
                            <Bus size={10} strokeWidth={2.5} />
                          </div>
                        </div>
                        <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium mt-1 truncate max-w-[160px] sm:max-w-[200px]">
                          Lộ trình cao tốc & đường nội đô
                        </span>
                      </div>

                      {/* Arrival */}
                      <div className="text-right shrink-0">
                        <span className="block text-base sm:text-lg font-black text-slate-900 leading-none">{arrTime}</span>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Dự kiến đến</span>
                      </div>
                    </div>

                    {/* Book Action Button */}
                    <div className="flex justify-end pt-1 sm:pt-0 shrink-0 w-full sm:w-auto">
                      <button
                        type="button"
                        disabled={isSoldOut}
                        onClick={() => {
                          onClose()
                          onSelectTrip?.(trip)
                        }}
                        className={cn(
                          'w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-black shadow-md transition-all active:scale-95',
                          isSoldOut
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                            : 'bg-[#005A36] text-white hover:bg-[#004529] hover:shadow-emerald-900/20',
                        )}
                      >
                        <Ticket size={15} />
                        <span>{isSoldOut ? 'Hết Chỗ' : 'Chọn Ghế & Đặt Vé'}</span>
                        {!isSoldOut && <ArrowRight size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Seat Capacity Meter & Amenities Row */}
                  <div className="pt-3 border-t border-slate-100/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    {/* Capacity Progress Bar */}
                    <div className="flex items-center gap-3 flex-1 max-w-sm">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                          <span className="text-slate-600 flex items-center gap-1">
                            <Users size={12} className="text-slate-400" />
                            {isSoldOut ? (
                              <span className="text-rose-600 font-extrabold">Hết ghế trống</span>
                            ) : isAlmostFull ? (
                              <span className="text-amber-600 font-extrabold">Sắp hết ({availableSeats} chỗ)</span>
                            ) : (
                              <span className="text-[#005A36]">Còn {availableSeats}/{totalSeats} ghế trống</span>
                            )}
                          </span>
                          <span className="text-slate-400 text-[10px] font-mono">{occupancyRate}% đã đặt</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                          <div
                            style={{ width: `${occupancyRate}%` }}
                            className={cn(
                              'h-full transition-all duration-500 rounded-full',
                              isSoldOut ? 'bg-rose-500' : isAlmostFull ? 'bg-amber-500' : 'bg-[#005A36]',
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Amenities Micro-Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-600">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50/80 px-2 py-0.5 text-emerald-800 border border-emerald-200/50">
                        <Zap size={10} className="text-emerald-600" /> 100% Buýt Điện
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50/80 px-2 py-0.5 text-sky-800 border border-sky-200/50">
                        <Wind size={10} className="text-sky-600" /> Điều Hòa 2 Chiều
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50/80 px-2 py-0.5 text-blue-800 border border-blue-200/50">
                        <Wifi size={10} className="text-blue-600" /> Wi-Fi 5G Free
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50/80 px-2 py-0.5 text-amber-800 border border-amber-200/50">
                        <BatteryCharging size={10} className="text-amber-600" /> Cổng Sạc USB
                      </span>
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
