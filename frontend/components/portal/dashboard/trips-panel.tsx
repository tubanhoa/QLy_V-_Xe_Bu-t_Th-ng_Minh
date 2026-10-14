'use client'

import { useMemo } from 'react'
import { Progress, Table, type TableProps } from 'antd'
import {
  Bus,
  Clock,
  UserCheck,
  SlidersHorizontal,
  AlertTriangle,
  User,
  ArrowRight,
  CalendarDays,
} from 'lucide-react'
import type { Trip } from '@/lib/mock-data'
import { TripStatusBadge } from './trip-status-badge'

interface TripsPanelProps {
  trips?: Trip[]
  onOpenDispatch?: (trip: Trip) => void
  onNavigateToSchedule?: () => void
}

export function TripsPanel({ trips, onOpenDispatch, onNavigateToSchedule }: TripsPanelProps) {
  const displayTrips = trips && trips.length > 0 ? trips : []

  const unassignedCount = useMemo(() => {
    return displayTrips.filter((t) => !t.isAssigned).length
  }, [displayTrips])

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
      render: (_, trip) => {
        if (!trip.isAssigned) {
          return (
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold text-xs">
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 text-[11px]">
                <AlertTriangle size={12} className="shrink-0 text-amber-600 dark:text-amber-400" />
                Chưa gán xe/tài xế
              </span>
            </div>
          )
        }
        return (
          <div>
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Bus size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{trip.plate}</span>
            </p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <User size={12} className="shrink-0" />
              <span>{trip.driver || 'Chưa phân tài xế'}</span>
            </p>
          </div>
        )
      },
    },
    {
      title: 'Xuất bến',
      dataIndex: 'departure',
      render: (value: string) => <span className="font-semibold text-xs">{value}</span>,
    },
    {
      title: 'Lấp đầy',
      dataIndex: 'occupancy',
      width: 140,
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
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (_, trip) => <TripStatusBadge trip={trip} />,
    },
    {
      title: 'Điều phối',
      key: 'dispatch',
      width: 130,
      render: (_, trip) => (
        <div className="flex items-center gap-1.5">
          {!trip.isAssigned ? (
            <button
              type="button"
              onClick={() => onOpenDispatch?.(trip)}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Phân công xe buýt, tài xế và phụ xe ngay"
            >
              <UserCheck size={12} className="shrink-0" />
              <span>Phân công</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenDispatch?.(trip)}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/60 hover:bg-muted text-foreground px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer"
              title="Đổi phương tiện hoặc tài xế ca này"
            >
              <SlidersHorizontal size={12} className="shrink-0 text-muted-foreground" />
              <span>Điều chuyển</span>
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <section className="rounded-2xl border border-border bg-card shadow-xs" aria-labelledby="trips-heading">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 pb-3 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="trips-heading" className="text-base font-bold text-foreground">
              Chuyến sắp xuất bến
            </h2>
            {unassignedCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                <AlertTriangle size={11} className="shrink-0" />
                {unassignedCount} chuyến chờ phân công
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                Đã gán đủ tổ xe
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cập nhật thời gian thực từ hệ thống điều phối & định vị GPS đội xe
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToSchedule && (
            <button
              type="button"
              onClick={onNavigateToSchedule}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              title="Mở Bàn Điều Phối & Lịch Gantt chi tiết"
            >
              <CalendarDays size={14} className="shrink-0" />
              <span>Bàn Điều Phối & Lịch Gantt</span>
              <ArrowRight size={13} className="shrink-0 ml-0.5" />
            </button>
          )}
        </div>
      </div>

      <div className="hidden md:block">
        <Table<Trip>
          rowKey="id"
          columns={columns}
          dataSource={displayTrips}
          pagination={false}
          size="middle"
          locale={{ emptyText: 'Chưa có chuyến xe nào xuất bến trong khung giờ này' }}
        />
      </div>

      <ul className="flex flex-col gap-3 p-4 md:hidden">
        {displayTrips.map((trip: Trip) => (
          <li key={trip.id} className="rounded-2xl border border-border bg-background p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-bold text-foreground">{trip.code}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{trip.route}</p>
              </div>
              <TripStatusBadge trip={trip} />
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-border/60">
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock size={13} strokeWidth={1.75} />
                  {trip.departure}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Bus size={13} strokeWidth={1.75} />
                  {trip.plate || 'Chưa gán xe'}
                </span>
              </div>
              <span className="font-semibold text-foreground">
                {trip.occupancy}/{trip.capacity} ghế
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              {!trip.isAssigned ? (
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                  <AlertTriangle size={12} /> Chưa gán tài xế
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <User size={12} /> {trip.driver}
                </span>
              )}

              <button
                type="button"
                onClick={() => onOpenDispatch?.(trip)}
                className={`inline-flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-semibold shadow-xs cursor-pointer ${
                  !trip.isAssigned
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'border border-border bg-muted/60 text-foreground hover:bg-muted'
                }`}
              >
                {!trip.isAssigned ? <UserCheck size={12} /> : <SlidersHorizontal size={12} />}
                <span>{!trip.isAssigned ? 'Phân công' : 'Đổi ca'}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
