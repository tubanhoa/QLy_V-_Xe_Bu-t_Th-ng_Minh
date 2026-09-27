'use client'

import { useState } from 'react'
import {
  Armchair,
  BatteryCharging,
  Bus,
  CheckCircle2,
  Filter,
  Plus,
  Search,
  Wrench,
  Zap,
} from 'lucide-react'

interface VehicleItem {
  id: string
  licensePlate: string
  model: string
  type: 'Electric' | 'Euro 5 Diesel'
  seatCapacity: number
  batteryPct?: number
  currentStatus: 'active' | 'charging' | 'maintenance'
  driverAssigned?: string
  lastMaintenance: string
}

const INITIAL_FLEET: VehicleItem[] = [
  {
    id: 'BUS-01',
    licensePlate: '20B-009.77',
    model: 'VinFast GreenBus E28',
    type: 'Electric',
    seatCapacity: 28,
    batteryPct: 86,
    currentStatus: 'active',
    driverAssigned: 'Lê Hoàng Nam',
    lastMaintenance: '15/09/2026',
  },
  {
    id: 'BUS-02',
    licensePlate: '20B-014.22',
    model: 'VinFast GreenBus E28',
    type: 'Electric',
    seatCapacity: 28,
    batteryPct: 64,
    currentStatus: 'active',
    driverAssigned: 'Nguyễn Văn Hùng',
    lastMaintenance: '10/09/2026',
  },
  {
    id: 'BUS-03',
    licensePlate: '20B-021.05',
    model: 'VinFast GreenBus E28',
    type: 'Electric',
    seatCapacity: 28,
    batteryPct: 94,
    currentStatus: 'active',
    driverAssigned: 'Trần Đình Trọng',
    lastMaintenance: '20/09/2026',
  },
  {
    id: 'BUS-04',
    licensePlate: '20B-033.89',
    model: 'Thaco CityBus C24',
    type: 'Euro 5 Diesel',
    seatCapacity: 24,
    currentStatus: 'charging',
    driverAssigned: 'Phạm Quốc Cường',
    lastMaintenance: '02/09/2026',
  },
  {
    id: 'BUS-05',
    licensePlate: '20B-008.12',
    model: 'VinFast GreenBus E28',
    type: 'Electric',
    seatCapacity: 28,
    batteryPct: 42,
    currentStatus: 'maintenance',
    lastMaintenance: 'Đang bảo dưỡng định kỳ',
  },
]

export function AdminFleet() {
  const [fleet] = useState<VehicleItem[]>(INITIAL_FLEET)
  const [search, setSearch] = useState('')

  const filtered = fleet.filter(
    (v) =>
      v.licensePlate.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Quản Lý Đội Xe Buýt & Sơ Đồ Ghế
          </h1>
          <p className="text-sm text-muted-foreground">
            Theo dõi trạng thái kỹ thuật, hạn đăng kiểm và năng lượng xe điện
          </p>
        </div>

        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm biển số xe, dòng xe..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-xs sm:text-sm text-foreground focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Fleet Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-base font-bold text-foreground flex items-center gap-1.5">
                  <Bus size={18} className="text-[#00A86B]" /> {item.licensePlate}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    item.currentStatus === 'active'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : item.currentStatus === 'charging'
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                  }`}
                >
                  {item.currentStatus === 'active'
                    ? 'Đang lăn bánh'
                    : item.currentStatus === 'charging'
                    ? 'Đang sạc điện'
                    : 'Bảo dưỡng'}
                </span>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">{item.model}</p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs border-t border-border pt-4">
                <div>
                  <span className="text-muted-foreground">Sức chứa:</span>
                  <p className="font-semibold text-foreground flex items-center gap-1">
                    <Armchair size={13} /> {item.seatCapacity} ghế
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Năng lượng:</span>
                  <p className="font-semibold text-foreground flex items-center gap-1">
                    {item.batteryPct !== undefined ? (
                      <>
                        <BatteryCharging size={13} className="text-emerald-500" /> {item.batteryPct}%
                      </>
                    ) : (
                      item.type
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-border pt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>Tài xế: {item.driverAssigned ?? 'Chưa gán'}</span>
              <span>KT: {item.lastMaintenance}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
