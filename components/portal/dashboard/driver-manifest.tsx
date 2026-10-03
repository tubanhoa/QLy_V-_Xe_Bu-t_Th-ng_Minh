'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Armchair,
  ArrowLeft,
  CheckCircle2,
  Clock,
  GraduationCap,
  Phone,
  Search,
  User,
  Users,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { driverService, DriverTripItem, ManifestPassenger } from '@/lib/services/driver.service'

interface DriverManifestProps {
  onBack?: () => void
  tripId?: string
}

export function DriverManifest({ onBack, tripId }: DriverManifestProps) {
  const [activeTrip, setActiveTrip] = useState<DriverTripItem | null>(null)
  const [passengers, setPassengers] = useState<ManifestPassenger[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'checked' | 'pending'>('all')

  const loadData = useCallback(async () => {
    setIsLoading(true)

    // 1. Lấy thông tin ca chạy hôm nay nếu chưa truyền tripId
    let targetTripId = tripId
    if (!targetTripId) {
      const tripsRes = await driverService.getTodayTrips()
      if (tripsRes.success && tripsRes.data && tripsRes.data.length > 0) {
        const found =
          tripsRes.data.find((t) => t.status === 'in_progress' || t.status === 'delayed') ||
          tripsRes.data.find((t) => t.status === 'scheduled') ||
          tripsRes.data[0]
        setActiveTrip(found)
        targetTripId = found.id
      }
    }

    // 2. Lấy Manifest hành khách thực tế từ API Backend
    if (targetTripId) {
      const mRes = await driverService.getTripManifest(targetTripId)
      if (mRes.success && mRes.data && mRes.data.manifest) {
        setPassengers(mRes.data.manifest)
      } else {
        setPassengers([])
      }
    }

    setIsLoading(false)
  }, [tripId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleCheckIn = async (passenger: ManifestPassenger) => {
    const isCurrentlyChecked = passenger.status === 'checked_in' || !!passenger.checkedInAt
    const newStatus = isCurrentlyChecked ? 'booked' : 'checked_in'
    const newCheckedInAt = isCurrentlyChecked ? null : new Date().toISOString()

    // Cập nhật UI lạc quan (Optimistic update)
    setPassengers((prev) =>
      prev.map((p) =>
        p.ticketId === passenger.ticketId
          ? { ...p, status: newStatus, checkedInAt: newCheckedInAt }
          : p
      )
    )

    // Gọi API quét vé để đồng bộ nếu đánh dấu lên xe
    if (!isCurrentlyChecked && activeTrip?.id) {
      await driverService.verifyQrTicket(passenger.ticketCode, activeTrip.id)
    }
  }

  const isCheckedIn = (p: ManifestPassenger) => p.status === 'checked_in' || !!p.checkedInAt

  const filtered = passengers.filter((p) => {
    const nameMatch = (p.passengerName || 'Khách vãng lai').toLowerCase().includes(search.toLowerCase())
    const seatMatch = (p.seatNumber || '').toLowerCase().includes(search.toLowerCase())
    const phoneMatch = (p.passengerPhone || '').includes(search)
    const codeMatch = (p.ticketCode || '').toLowerCase().includes(search.toLowerCase())

    const matchesSearch = nameMatch || seatMatch || phoneMatch || codeMatch
    if (!matchesSearch) return false

    if (tab === 'checked') return isCheckedIn(p)
    if (tab === 'pending') return !isCheckedIn(p)
    return true
  })

  const checkedCount = passengers.filter(isCheckedIn).length
  const totalCount = passengers.length
  const busCapacity = activeTrip?.vehicle?.capacity || 28

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
            >
              <ArrowLeft size={18} strokeWidth={1.75} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Danh Sách Hành Khách (Manifest)
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {activeTrip?.route?.name || 'Tuyến 01: ICTU ↔ Bến xe Trung tâm'} • Xe {activeTrip?.vehicle?.plateNumber || '20B-009.77'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadData}
          title="Làm mới danh sách từ Backend"
          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground">Sức chứa xe</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{busCapacity}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center text-emerald-600 dark:text-emerald-400">
          <p className="text-xs font-medium">Đã lên xe</p>
          <p className="mt-1 text-2xl font-bold">{checkedCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-center text-amber-600 dark:text-amber-400">
          <p className="text-xs font-medium">Chờ đón</p>
          <p className="mt-1 text-2xl font-bold">{Math.max(0, totalCount - checkedCount)}</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm theo tên sinh viên, ghế, SĐT, mã vé..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex rounded-xl border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'all' ? 'bg-[#00A86B] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tất cả ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setTab('checked')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'checked' ? 'bg-[#00A86B] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Đã lên ({checkedCount})
          </button>
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'pending' ? 'bg-[#00A86B] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Chờ ({Math.max(0, totalCount - checkedCount)})
          </button>
        </div>
      </div>

      {/* Passenger List */}
      <div className="flex flex-col gap-2.5">
        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
            <RefreshCw size={24} className="animate-spin text-emerald-500" />
            <p>Đang tải danh sách vé từ cơ sở dữ liệu chuyến...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            {totalCount === 0
              ? 'Chưa có hành khách nào đặt vé trên chuyến này.'
              : 'Không tìm thấy hành khách phù hợp với từ khóa tìm kiếm.'}
          </div>
        ) : (
          filtered.map((p) => {
            const checked = isCheckedIn(p)
            return (
              <div
                key={p.ticketId || p.ticketCode}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition-all ${
                  checked
                    ? 'border-emerald-500/20 bg-card'
                    : 'border-amber-500/30 bg-amber-500/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex size-11 items-center justify-center rounded-xl font-mono text-sm font-bold shadow-sm ${
                      checked
                        ? 'bg-emerald-500 text-white'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                    }`}
                  >
                    {p.seatNumber || 'Vé tự do'}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm sm:text-base text-foreground">
                        {p.passengerName || 'Hành khách sinh viên'}
                      </h3>
                      <span className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        {p.ticketCode}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {p.passengerPhone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} /> {p.passengerPhone}
                        </span>
                      )}
                      {p.checkedInAt && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          ✓ Lên xe lúc {new Date(p.checkedInAt).toLocaleTimeString('vi-VN')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleCheckIn(p)}
                  className={`flex min-h-10 items-center justify-center rounded-xl px-4 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                    checked
                      ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                      : 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600'
                  }`}
                >
                  {checked ? 'Hủy check-in' : 'Xác nhận lên xe'}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
