'use client'

import { Progress, Table, type TableProps } from 'antd'
import { Bus, Clock } from 'lucide-react'
import { UPCOMING_TRIPS, type Trip } from '@/lib/mock-data'
import { TripStatusBadge } from './trip-status-badge'

const columns: TableProps<Trip>['columns'] = [
  {
    title: 'Chuyến',
    dataIndex: 'code',
    render: (_, trip) => (
      <div className="min-w-0">
        <p className="font-mono text-xs font-semibold text-foreground">{trip.code}</p>
        <p className="max-w-64 truncate text-xs text-muted-foreground">{trip.route}</p>
      </div>
    ),
  },
  {
    title: 'Xe / Tài xế',
    dataIndex: 'plate',
    render: (_, trip) => (
      <div>
        <p className="text-sm font-medium text-foreground">{trip.plate}</p>
        <p className="text-xs text-muted-foreground">{trip.driver}</p>
      </div>
    ),
  },
  { title: 'Xuất bến', dataIndex: 'departure', render: (value: string) => <span className="font-semibold">{value}</span> },
  {
    title: 'Lấp đầy',
    dataIndex: 'occupancy',
    width: 150,
    render: (_, trip) => (
      <div>
        <p className="text-xs text-muted-foreground">
          {trip.occupancy}/{trip.capacity} ghế
        </p>
        <Progress
          percent={Math.round((trip.occupancy / trip.capacity) * 100)}
          showInfo={false}
          size="small"
          strokeColor="#00A86B"
          className="!m-0"
        />
      </div>
    ),
  },
  { title: 'Trạng thái', dataIndex: 'status', render: (_, trip) => <TripStatusBadge trip={trip} /> },
]

export function TripsPanel() {
  return (
    <section className="rounded-2xl border border-border bg-card" aria-labelledby="trips-heading">
      <div className="flex items-center justify-between gap-3 p-5 pb-3">
        <div>
          <h2 id="trips-heading" className="text-base font-semibold text-foreground">
            Chuyến sắp xuất bến
          </h2>
          <p className="text-xs text-muted-foreground">Cập nhật thời gian thực từ GPS đội xe</p>
        </div>
        <button type="button" className="press rounded-lg px-3 py-1.5 text-sm font-semibold text-brand hover:bg-accent">
          Xem tất cả
        </button>
      </div>

      <div className="hidden md:block">
        <Table<Trip> rowKey="id" columns={columns} dataSource={UPCOMING_TRIPS} pagination={false} size="middle" />
      </div>

      <ul className="flex flex-col gap-3 px-4 pb-4 md:hidden">
        {UPCOMING_TRIPS.map((trip) => (
          <li key={trip.id}>
            <button
              type="button"
              className="press w-full rounded-2xl border border-border bg-background p-4 text-left transition-colors hover:border-emerald-500/30"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-mono text-xs font-semibold text-foreground">{trip.code}</p>
                <TripStatusBadge trip={trip} />
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">{trip.route}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
                  {trip.departure}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Bus size={14} strokeWidth={1.75} aria-hidden="true" />
                  {trip.plate}
                </span>
                <span className="ml-auto font-semibold text-foreground">
                  {trip.occupancy}/{trip.capacity}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
