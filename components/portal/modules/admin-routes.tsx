'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  Edit2,
  MapPin,
  Milestone,
  Navigation,
  Plus,
  Route,
  Search,
  Trash2,
} from 'lucide-react'

interface RouteItem {
  id: string
  code: string
  name: string
  origin: string
  destination: string
  distanceKm: number
  basePrice: number
  totalStations: number
  operatingHours: string
  frequencyMinutes: number
  status: 'active' | 'maintenance'
}

const INITIAL_ROUTES: RouteItem[] = [
  {
    id: 'R01',
    code: 'Tuyến 01',
    name: 'KTX ICTU ⇄ Bến xe Trung tâm Đồng Quang',
    origin: 'Trạm KTX ICTU (Quyết Thắng)',
    destination: 'Bến xe Đồng Quang (TP. Thái Nguyên)',
    distanceKm: 14.5,
    basePrice: 10000,
    totalStations: 12,
    operatingHours: '05:30 - 21:00',
    frequencyMinutes: 15,
    status: 'active',
  },
  {
    id: 'R02',
    code: 'Tuyến 02',
    name: 'Campus ICTU ⇄ Quảng trường Võ Nguyên Giáp',
    origin: 'Cổng chính ĐH CNTT & TT',
    destination: 'Quảng trường Võ Nguyên Giáp',
    distanceKm: 11.2,
    basePrice: 8000,
    totalStations: 9,
    operatingHours: '06:00 - 20:30',
    frequencyMinutes: 20,
    status: 'active',
  },
  {
    id: 'R03',
    code: 'Tuyến Campus',
    name: 'Tuyến Vành Đai Nội Bộ Campus ICTU',
    origin: 'Khu Hiệu Bộ ICTU',
    destination: 'Khu phức hợp Thể thao & KTX',
    distanceKm: 4.8,
    basePrice: 5000,
    totalStations: 6,
    operatingHours: '06:30 - 18:30',
    frequencyMinutes: 10,
    status: 'active',
  },
]

export function AdminRoutes() {
  const [routes, setRoutes] = useState<RouteItem[]>(INITIAL_ROUTES)
  const [search, setSearch] = useState('')
  const [editingRoute, setEditingRoute] = useState<RouteItem | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const filtered = routes.filter(
    (r) =>
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSaveRoute = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRoute) return
    setRoutes((prev) =>
      prev.map((r) => (r.id === editingRoute.id ? editingRoute : r))
    )
    setFeedback(`Đã cập nhật tuyến ${editingRoute.code} thành công!`)
    setEditingRoute(null)
    setTimeout(() => setFeedback(null), 3000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Mạng Lưới Tuyến & Trạm Dừng
          </h1>
          <p className="text-sm text-muted-foreground">
            Cấu hình danh mục tuyến xe buýt, khoảng cách địa lý và biểu phí cơ bản
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm tên tuyến, mã tuyến..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-xs sm:text-sm text-foreground focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {feedback && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-500" />
          {feedback}
        </div>
      )}

      {/* Routes Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((route) => (
          <div
            key={route.id}
            className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between hover:border-emerald-500/30 transition-all"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-xl bg-[#00A86B]/15 px-3 py-1 font-mono text-xs font-bold text-[#00A86B]">
                  {route.code}
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {route.operatingHours}
                </span>
              </div>

              <h3 className="mt-3 font-bold text-base text-foreground leading-snug">
                {route.name}
              </h3>

              <div className="mt-4 flex flex-col gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-emerald-500 shrink-0" />
                  <span>Đi: {route.origin}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Navigation size={14} className="text-cyan-500 shrink-0" />
                  <span>Đến: {route.destination}</span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
                <div>
                  <p className="text-[11px] text-muted-foreground">Cự ly</p>
                  <p className="font-mono text-sm font-bold text-foreground">{route.distanceKm} km</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Trạm dừng</p>
                  <p className="font-mono text-sm font-bold text-foreground">{route.totalStations}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Giá vé lượt</p>
                  <p className="font-mono text-sm font-bold text-[#00A86B]">
                    {route.basePrice.toLocaleString('vi-VN')} đ
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-border pt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Tần suất: <strong>{route.frequencyMinutes} phút/chuyến</strong>
              </span>
              <button
                type="button"
                onClick={() => setEditingRoute(route)}
                className="flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
              >
                <Edit2 size={13} /> Sửa tuyến
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Route Modal */}
      {editingRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleSaveRoute}
            className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4"
          >
            <h3 className="text-lg font-bold text-foreground">
              Chỉnh sửa thông số tuyến: {editingRoute.code}
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="font-semibold text-foreground block mb-1">Tên hiển thị tuyến</label>
                <input
                  type="text"
                  value={editingRoute.name}
                  onChange={(e) => setEditingRoute({ ...editingRoute, name: e.target.value })}
                  className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Giá vé lượt (VNĐ)</label>
                <input
                  type="number"
                  value={editingRoute.basePrice}
                  onChange={(e) =>
                    setEditingRoute({ ...editingRoute, basePrice: Number(e.target.value) })
                  }
                  className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Tần suất (Phút)</label>
                <input
                  type="number"
                  value={editingRoute.frequencyMinutes}
                  onChange={(e) =>
                    setEditingRoute({ ...editingRoute, frequencyMinutes: Number(e.target.value) })
                  }
                  className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingRoute(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#00A86B] px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20"
              >
                Lưu thay đổi
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
