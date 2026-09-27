'use client'

import { useState } from 'react'
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
} from 'lucide-react'

interface TripScheduleItem {
  id: string
  route: string
  vehiclePlate: string
  driverName: string
  conductorName: string
  departureTime: string
  arrivalTime: string
  status: 'scheduled' | 'running' | 'completed'
  seatCapacity: number
  bookedSeats: number
}

const INITIAL_SCHEDULE: TripScheduleItem[] = [
  {
    id: 'CT-01-0745',
    route: 'Tuyến 01: KTX ICTU → Bến xe TP',
    vehiclePlate: '20B-009.77',
    driverName: 'Lê Hoàng Nam',
    conductorName: 'Nguyễn Văn Đạt',
    departureTime: '07:45',
    arrivalTime: '08:35',
    status: 'scheduled',
    seatCapacity: 28,
    bookedSeats: 22,
  },
  {
    id: 'CT-01-0815',
    route: 'Tuyến 01: KTX ICTU → Bến xe TP',
    vehiclePlate: '20B-014.22',
    driverName: 'Nguyễn Văn Hùng',
    conductorName: 'Trần Văn Bình',
    departureTime: '08:15',
    arrivalTime: '09:05',
    status: 'scheduled',
    seatCapacity: 28,
    bookedSeats: 16,
  },
  {
    id: 'CT-02-0800',
    route: 'Tuyến 02: Campus ICTU → Quảng trường',
    vehiclePlate: '20B-021.05',
    driverName: 'Trần Đình Trọng',
    conductorName: 'Lê Văn Cường',
    departureTime: '08:00',
    arrivalTime: '08:40',
    status: 'running',
    seatCapacity: 28,
    bookedSeats: 28,
  },
  {
    id: 'CT-01-0700',
    route: 'Tuyến 01: KTX ICTU → Bến xe TP',
    vehiclePlate: '20B-008.12',
    driverName: 'Hoàng Văn Thái',
    conductorName: 'Phạm Đức Toàn',
    departureTime: '07:00',
    arrivalTime: '07:50',
    status: 'completed',
    seatCapacity: 28,
    bookedSeats: 26,
  },
]

export function DispatcherSchedule() {
  const [schedules, setSchedules] = useState<TripScheduleItem[]>(INITIAL_SCHEDULE)
  const [search, setSearch] = useState('')
  const [editingTrip, setEditingTrip] = useState<TripScheduleItem | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleSaveDispatch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTrip) return
    setSchedules((prev) =>
      prev.map((s) => (s.id === editingTrip.id ? editingTrip : s))
    )
    setFeedback(`Đã cập nhật điều phối chuyến xe ${editingTrip.id} thành công!`)
    setEditingTrip(null)
    setTimeout(() => setFeedback(null), 3500)
  }

  const filtered = schedules.filter(
    (s) =>
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      s.vehiclePlate.toLowerCase().includes(search.toLowerCase()) ||
      s.driverName.toLowerCase().includes(search.toLowerCase()) ||
      s.route.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Phân Lịch Chạy & Điều Độ Tài Xế
          </h1>
          <p className="text-sm text-muted-foreground">
            Sắp xếp ca xe buýt, phân công phương tiện và tài xế/phụ xe theo ngày
          </p>
        </div>

        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm theo biển số, tài xế, mã chuyến..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-xs sm:text-sm text-foreground focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {feedback && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-500" />
          {feedback}
        </div>
      )}

      {/* Schedule Table */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="p-4 pl-6">Mã chuyến</th>
                <th className="p-4">Tuyến xe</th>
                <th className="p-4">Phương tiện</th>
                <th className="p-4">Tài xế / Phụ xe</th>
                <th className="p-4">Giờ xuất bến</th>
                <th className="p-4">Khách đặt</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 pr-6 text-right">Điều phối</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 pl-6 font-mono text-xs font-bold text-foreground">
                    {item.id}
                  </td>
                  <td className="p-4 text-xs font-medium text-foreground">{item.route}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <Bus size={12} />
                      {item.vehiclePlate}
                    </span>
                  </td>
                  <td className="p-4 text-xs">
                    <p className="font-semibold text-foreground flex items-center gap-1">
                      <User size={12} className="text-muted-foreground" /> {item.driverName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Phụ xe: {item.conductorName}</p>
                  </td>
                  <td className="p-4 font-mono text-xs">
                    <span className="font-bold text-foreground">{item.departureTime}</span>
                    <span className="text-muted-foreground"> → {item.arrivalTime}</span>
                  </td>
                  <td className="p-4 text-xs">
                    <span className="font-semibold text-foreground">{item.bookedSeats}</span>
                    <span className="text-muted-foreground">/{item.seatCapacity}</span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        item.status === 'running'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : item.status === 'completed'
                          ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      }`}
                    >
                      {item.status === 'running'
                        ? 'Đang chạy'
                        : item.status === 'completed'
                        ? 'Đã hoàn thành'
                        : 'Sắp chạy'}
                    </span>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingTrip(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent"
                    >
                      <Edit2 size={12} /> Gán xe/tài xế
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatch Modal */}
      {editingTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleSaveDispatch}
            className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4"
          >
            <h3 className="text-lg font-bold text-foreground">
              Điều phối chuyến xe: {editingTrip.id}
            </h3>
            <p className="text-xs text-muted-foreground">{editingTrip.route}</p>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">Phương tiện xe buýt</label>
                <select
                  value={editingTrip.vehiclePlate}
                  onChange={(e) =>
                    setEditingTrip({ ...editingTrip, vehiclePlate: e.target.value })
                  }
                  className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
                >
                  <option value="20B-009.77">20B-009.77 (Xe điện 28 chỗ)</option>
                  <option value="20B-014.22">20B-014.22 (Xe điện 28 chỗ)</option>
                  <option value="20B-021.05">20B-021.05 (Xe điện 28 chỗ)</option>
                  <option value="20B-033.89">20B-033.89 (Xe điện Campus)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Tài xế phân công</label>
                <input
                  type="text"
                  value={editingTrip.driverName}
                  onChange={(e) =>
                    setEditingTrip({ ...editingTrip, driverName: e.target.value })
                  }
                  className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Giờ xuất bến</label>
                <input
                  type="time"
                  value={editingTrip.departureTime}
                  onChange={(e) =>
                    setEditingTrip({ ...editingTrip, departureTime: e.target.value })
                  }
                  className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingTrip(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#00A86B] px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20"
              >
                Lưu phân công
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
