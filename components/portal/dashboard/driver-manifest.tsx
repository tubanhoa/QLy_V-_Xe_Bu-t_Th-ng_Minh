'use client'

import { useState } from 'react'
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
} from 'lucide-react'

interface Passenger {
  seat: string
  name: string
  phone: string
  pickup: string
  isStudent: boolean
  checkedIn: boolean
  ticketCode: string
}

const INITIAL_PASSENGERS: Passenger[] = [
  { seat: '01A', name: 'Trần Văn Mạnh', phone: '0981.234.567', pickup: 'KTX ICTU', isStudent: true, checkedIn: true, ticketCode: 'TK-01A' },
  { seat: '01B', name: 'Nguyễn Thị Hoa', phone: '0978.112.334', pickup: 'KTX ICTU', isStudent: true, checkedIn: true, ticketCode: 'TK-01B' },
  { seat: '02A', name: 'Lê Hoàng Long', phone: '0912.556.789', pickup: 'Cổng chính ICTU', isStudent: false, checkedIn: true, ticketCode: 'TK-02A' },
  { seat: '02B', name: 'Phạm Minh Tuấn', phone: '0983.445.667', pickup: 'Cổng chính ICTU', isStudent: true, checkedIn: false, ticketCode: 'TK-02B' },
  { seat: '03A', name: 'Đỗ Thu Trang', phone: '0964.778.899', pickup: 'Cổng chính ICTU', isStudent: true, checkedIn: true, ticketCode: 'TK-03A' },
  { seat: '03B', name: 'Vũ Quốc Bảo', phone: '0905.123.456', pickup: 'Ngã ba Điềm Thụy', isStudent: false, checkedIn: false, ticketCode: 'TK-03B' },
  { seat: '04A', name: 'Hoàng Kim Chi', phone: '0987.654.321', pickup: 'Ngã ba Điềm Thụy', isStudent: true, checkedIn: true, ticketCode: 'TK-04A' },
  { seat: '04B', name: 'Bùi Đức Anh', phone: '0936.987.123', pickup: 'Ngã ba Điềm Thụy', isStudent: false, checkedIn: true, ticketCode: 'TK-04B' },
  { seat: '05A', name: 'Ngô Thanh Hằng', phone: '0918.456.789', pickup: 'Đại học Sư Phạm', isStudent: true, checkedIn: true, ticketCode: 'TK-05A' },
  { seat: '05B', name: 'Đặng Quang Huy', phone: '0975.332.114', pickup: 'Đại học Sư Phạm', isStudent: true, checkedIn: false, ticketCode: 'TK-05B' },
  { seat: '06A', name: 'Dương Thùy Linh', phone: '0942.556.889', pickup: 'Bệnh viện Đa Khoa', isStudent: false, checkedIn: true, ticketCode: 'TK-06A' },
  { seat: '06B', name: 'Trịnh Hữu Đạt', phone: '0988.223.344', pickup: 'Bệnh viện Đa Khoa', isStudent: true, checkedIn: true, ticketCode: 'TK-06B' },
  { seat: '07A', name: 'Lý Lan Hương', phone: '0913.778.990', pickup: 'Quảng trường Võ Nguyên Giáp', isStudent: false, checkedIn: true, ticketCode: 'TK-07A' },
  { seat: '07B', name: 'Mai Văn Tùng', phone: '0962.114.556', pickup: 'Quảng trường Võ Nguyên Giáp', isStudent: true, checkedIn: false, ticketCode: 'TK-07B' },
]

export function DriverManifest({ onBack }: { onBack?: () => void }) {
  const [passengers, setPassengers] = useState<Passenger[]>(INITIAL_PASSENGERS)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'checked' | 'pending'>('all')

  const toggleCheckIn = (seat: string) => {
    setPassengers((prev) =>
      prev.map((p) => (p.seat === seat ? { ...p, checkedIn: !p.checkedIn } : p))
    )
  }

  const filtered = passengers.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.seat.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search)
    if (!matchSearch) return false
    if (tab === 'checked') return p.checkedIn
    if (tab === 'pending') return !p.checkedIn
    return true
  })

  const checkedCount = passengers.filter((p) => p.checkedIn).length
  const totalCount = passengers.length

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <ArrowLeft size={18} strokeWidth={1.75} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Danh sách hành khách (Manifest)
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Tuyến 01 • Chuyến 07:45 • Xe 20B-009.77
            </p>
          </div>
        </div>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground">Tổng số chỗ</p>
          <p className="mt-1 text-2xl font-bold text-foreground">28</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center text-emerald-600 dark:text-emerald-400">
          <p className="text-xs font-medium">Đã lên xe</p>
          <p className="mt-1 text-2xl font-bold">{checkedCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-center text-amber-600 dark:text-amber-400">
          <p className="text-xs font-medium">Chờ đón</p>
          <p className="mt-1 text-2xl font-bold">{totalCount - checkedCount}</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm theo tên, ghế, SĐT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex rounded-xl border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'all' ? 'bg-[#00A86B] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tất cả ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setTab('checked')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'checked' ? 'bg-[#00A86B] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Đã lên ({checkedCount})
          </button>
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'pending' ? 'bg-[#00A86B] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Chờ ({totalCount - checkedCount})
          </button>
        </div>
      </div>

      {/* Passenger List */}
      <div className="flex flex-col gap-2.5">
        {filtered.map((p) => (
          <div
            key={p.seat}
            className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition-all ${
              p.checkedIn
                ? 'border-emerald-500/20 bg-card'
                : 'border-amber-500/30 bg-amber-500/[0.04]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex size-11 items-center justify-center rounded-xl font-mono text-sm font-bold shadow-sm ${
                  p.checkedIn
                    ? 'bg-emerald-500 text-white'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                }`}
              >
                {p.seat}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm sm:text-base text-foreground">{p.name}</h3>
                  {p.isStudent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                      <GraduationCap size={12} /> HSSV
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone size={12} /> {p.phone}
                  </span>
                  <span>•</span>
                  <span>Đón tại: {p.pickup}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => toggleCheckIn(p.seat)}
              className={`flex min-h-10 items-center justify-center rounded-xl px-3.5 text-xs font-semibold transition-all active:scale-95 ${
                p.checkedIn
                  ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                  : 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600'
              }`}
            >
              {p.checkedIn ? 'Hủy check-in' : 'Lên xe'}
            </button>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            Không tìm thấy hành khách phù hợp với từ khóa
          </div>
        )}
      </div>
    </div>
  )
}
