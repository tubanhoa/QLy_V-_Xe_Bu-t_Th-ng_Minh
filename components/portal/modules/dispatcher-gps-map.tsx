'use client'

import { useState } from 'react'
import {
  BatteryCharging,
  Bus,
  ChevronRight,
  Filter,
  Layers,
  MapPin,
  Navigation,
  Phone,
  Radio,
  Search,
  Users,
  Zap,
} from 'lucide-react'

interface BusNode {
  plate: string
  route: string
  driver: string
  phone: string
  speed: number
  battery: number
  passengers: number
  maxSeats: number
  nextStation: string
  status: 'ontime' | 'delayed' | 'stopped'
  delayMinutes?: number
  coords: { x: number; y: number } // Percentage position for visual radar map
}

const LIVE_BUS_NODES: BusNode[] = [
  {
    plate: '20B-009.77',
    route: 'Tuyến 01',
    driver: 'Lê Hoàng Nam',
    phone: '0912.889.900',
    speed: 32,
    battery: 86,
    passengers: 22,
    maxSeats: 28,
    nextStation: 'Trạm Cổng chính ĐH CNTT & TT',
    status: 'ontime',
    coords: { x: 28, y: 35 },
  },
  {
    plate: '20B-014.22',
    route: 'Tuyến 01',
    driver: 'Nguyễn Văn Hùng',
    phone: '0983.112.233',
    speed: 18,
    battery: 64,
    passengers: 28,
    maxSeats: 28,
    nextStation: 'Bến xe Đồng Quang',
    status: 'delayed',
    delayMinutes: 7,
    coords: { x: 65, y: 48 },
  },
  {
    plate: '20B-021.05',
    route: 'Tuyến 02',
    driver: 'Trần Đình Trọng',
    phone: '0904.556.677',
    speed: 38,
    battery: 92,
    passengers: 14,
    maxSeats: 28,
    nextStation: 'Đại học Nông Lâm',
    status: 'ontime',
    coords: { x: 42, y: 72 },
  },
  {
    plate: '20B-033.89',
    route: 'Tuyến Campus',
    driver: 'Phạm Quốc Cường',
    phone: '0978.445.566',
    speed: 0,
    battery: 98,
    passengers: 4,
    maxSeats: 28,
    nextStation: 'Bến đỗ Ký túc xá C4',
    status: 'stopped',
    coords: { x: 18, y: 22 },
  },
]

export function DispatcherGpsMap() {
  const [selectedPlate, setSelectedPlate] = useState<string>('20B-009.77')
  const [routeFilter, setRouteFilter] = useState<string>('all')

  const filteredBuses = LIVE_BUS_NODES.filter((b) =>
    routeFilter === 'all' ? true : b.route.includes(routeFilter)
  )

  const selectedBus = LIVE_BUS_NODES.find((b) => b.plate === selectedPlate) ?? LIVE_BUS_NODES[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Bản đồ Giám sát GPS Đội xe Thời Gian Thực
          </h1>
          <p className="text-sm text-muted-foreground">
            Theo dõi vị trí, tốc độ và phụ tải 12 xe buýt thông minh đang vận hành
          </p>
        </div>

        {/* Route Filter Chips */}
        <div className="flex rounded-xl border border-border bg-card p-1">
          {['all', 'Tuyến 01', 'Tuyến 02', 'Campus'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRouteFilter(r)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                routeFilter === r
                  ? 'bg-[#00A86B] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r === 'all' ? 'Tất cả các tuyến' : r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Radar Map Canvas (Left 8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl border border-border bg-slate-950 p-6 shadow-2xl">
            {/* Map Grid Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40" />

            {/* Simulated Road Vectors */}
            <svg className="absolute inset-0 size-full pointer-events-none stroke-emerald-500/20 fill-none" strokeWidth="2.5">
              <path d="M 50 100 Q 180 80, 280 200 T 550 240 T 800 350" strokeDasharray="6 6" />
              <path d="M 120 400 Q 300 320, 420 220 T 750 180" strokeDasharray="4 4" className="stroke-cyan-500/20" />
            </svg>

            {/* Stations Pins */}
            <div className="absolute left-[20%] top-[30%] flex items-center gap-1.5 text-[11px] text-white/60">
              <span className="size-2 rounded-full bg-cyan-400" />
              <span>KTX ICTU</span>
            </div>
            <div className="absolute left-[60%] top-[45%] flex items-center gap-1.5 text-[11px] text-white/60">
              <span className="size-2 rounded-full bg-cyan-400" />
              <span>Bến xe Đồng Quang</span>
            </div>
            <div className="absolute left-[80%] top-[35%] flex items-center gap-1.5 text-[11px] text-white/60">
              <span className="size-2 rounded-full bg-cyan-400" />
              <span>Đại học Sư Phạm</span>
            </div>

            {/* Moving Bus Nodes */}
            {filteredBuses.map((bus) => {
              const isSelected = bus.plate === selectedPlate
              return (
                <button
                  key={bus.plate}
                  type="button"
                  onClick={() => setSelectedPlate(bus.plate)}
                  style={{ left: `${bus.coords.x}%`, top: `${bus.coords.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none"
                >
                  <div className="relative flex flex-col items-center">
                    {/* Radar Pulse Ping */}
                    <span
                      className={`absolute -inset-2 rounded-full animate-ping opacity-40 ${
                        bus.status === 'delayed' ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                    />
                    <div
                      className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-xl transition-transform ${
                        isSelected
                          ? 'ring-2 ring-white scale-110 bg-[#00A86B] text-white'
                          : bus.status === 'delayed'
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-900/90 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      <Bus size={14} />
                      <span className="font-mono text-xs font-bold">{bus.plate}</span>
                    </div>
                    <span className="mt-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white/80">
                      {bus.speed} km/h
                    </span>
                  </div>
                </button>
              )
            })}

            {/* Map Telemetry Header Info */}
            <div className="absolute left-6 top-6 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3.5 py-1.5 text-xs text-white backdrop-blur-md">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Máy chủ GPS: 24ms • 12/12 Thiết bị viễn thông trực tuyến</span>
            </div>
          </div>
        </div>

        {/* Selected Vehicle Telemetry Details (Right 4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <Bus size={13} />
                  {selectedBus.plate}
                </span>
                <h3 className="mt-2 text-lg font-bold text-foreground">{selectedBus.route}</h3>
              </div>
              <span
                className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${
                  selectedBus.status === 'ontime'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : selectedBus.status === 'delayed'
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {selectedBus.status === 'ontime'
                  ? 'Đúng giờ'
                  : selectedBus.status === 'delayed'
                  ? `Trễ ${selectedBus.delayMinutes} phút`
                  : 'Đang đỗ'}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl border border-border p-3">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Zap size={14} className="text-amber-500" /> Tốc độ tức thời
                </span>
                <p className="mt-1 text-xl font-bold font-mono text-foreground">
                  {selectedBus.speed} <span className="text-xs font-normal">km/h</span>
                </p>
              </div>

              <div className="rounded-2xl border border-border p-3">
                <span className="text-muted-foreground flex items-center gap-1">
                  <BatteryCharging size={14} className="text-emerald-500" /> Dung lượng Pin
                </span>
                <p className="mt-1 text-xl font-bold font-mono text-foreground">
                  {selectedBus.battery}%
                </p>
              </div>

              <div className="rounded-2xl border border-border p-3 col-span-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users size={14} className="text-blue-500" /> Khách trên xe
                </span>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-base font-bold text-foreground">
                    {selectedBus.passengers} / {selectedBus.maxSeats} chỗ (
                    {Math.round((selectedBus.passengers / selectedBus.maxSeats) * 100)}%)
                  </p>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-[#00A86B] rounded-full"
                    style={{ width: `${(selectedBus.passengers / selectedBus.maxSeats) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-accent/40 p-3.5 text-xs">
              <span className="text-muted-foreground">Trạm đón kế tiếp:</span>
              <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1">
                <MapPin size={14} className="text-[#00A86B]" /> {selectedBus.nextStation}
              </p>
            </div>

            <div className="mt-4 border-t border-border pt-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Tài xế phụ trách:</p>
                <p className="text-sm font-semibold text-foreground">{selectedBus.driver}</p>
              </div>
              <a
                href={`tel:${selectedBus.phone}`}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600 shadow-sm"
              >
                <Phone size={14} /> Gọi tài xế
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
