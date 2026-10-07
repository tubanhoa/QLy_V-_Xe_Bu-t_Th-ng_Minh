'use client'

import React from 'react'
import { Progress } from 'antd'
import { AlertTriangle, CreditCard, CheckCircle2, User, Bus } from 'lucide-react'
import type { IncidentReportItem } from '@/lib/services/analytics.service'
import { cn } from '@/lib/utils'

const SEVERITY = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-slate-400',
} as const

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  traffic_jam: 'Ùn tắc giao thông',
  breakdown: 'Hỏng hóc phương tiện',
  accident: 'Tai nạn / Va quẹt',
  weather: 'Thời tiết xấu',
  other: 'Sự cố hành trình',
}

export interface ChannelItem {
  channel: string
  amount: string
  share: number
}

export function RevenueChannelsCard({ channels }: { channels?: ChannelItem[] }) {
  const displayChannels = channels && channels.length > 0 ? channels : []

  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="revenue-heading">
      <div className="flex items-center gap-2">
        <CreditCard size={18} strokeWidth={1.75} className="text-brand" aria-hidden="true" />
        <h2 id="revenue-heading" className="text-base font-semibold text-foreground">
          Doanh thu theo kênh
        </h2>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">Cổng thanh toán thực tế từ Supabase</p>

      {displayChannels.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center py-6 text-center text-xs text-muted-foreground">
          <p>Chưa ghi nhận kênh thanh toán trong kỳ</p>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-4">
          {displayChannels.map((channel) => (
            <li key={channel.channel}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{channel.channel}</span>
                <span className="text-muted-foreground">
                  {channel.amount} · <span className="font-semibold text-foreground">{channel.share}%</span>
                </span>
              </div>
              <Progress
                percent={channel.share}
                showInfo={false}
                size="small"
                strokeColor={{ from: '#00A86B', to: '#00B4A0' }}
                className="!m-0"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function IncidentsCard({ incidents = [] }: { incidents?: IncidentReportItem[] }) {
  const pendingIncidents = incidents.filter((i) => i.resolutionStatus === 'pending')
  const displayList = incidents.slice(0, 4)

  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="incidents-heading">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} strokeWidth={1.75} className="text-amber-500" aria-hidden="true" />
          <h2 id="incidents-heading" className="text-base font-semibold text-foreground">
            Cảnh báo từ Tài xế & Tuyến xe
          </h2>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold',
            pendingIncidents.length > 0
              ? 'bg-red-500/10 text-red-600 dark:text-red-400'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          )}
        >
          {pendingIncidents.length > 0 ? `${pendingIncidents.length} chưa xử lý` : 'Bình thường'}
        </span>
      </div>

      <p className="mt-0.5 text-xs text-muted-foreground">
        Dữ liệu thực tế từ Buồng lái tài xế (bảng trip_incidents)
      </p>

      {displayList.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center py-6 text-center text-xs text-muted-foreground">
          <CheckCircle2 size={24} className="mb-2 text-emerald-500" />
          <p className="font-medium text-foreground">Không có sự cố nào</p>
          <p className="mt-0.5">Toàn bộ các tuyến xe buýt đang vận hành an toàn</p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {displayList.map((incident) => {
            const typeLabel =
              INCIDENT_TYPE_LABELS[incident.incidentType] || incident.incidentType || 'Sự cố chuyến'
            const isResolved = incident.resolutionStatus === 'resolved'
            const routeCode = incident.trip?.route?.routeCode
            const vehiclePlate = incident.trip?.vehicle?.licensePlate
            const driverName = incident.reportedByUser?.fullName || incident.trip?.driver?.fullName

            return (
              <li
                key={incident.id}
                className={cn(
                  'flex flex-col gap-1.5 rounded-xl border p-3 transition-colors',
                  isResolved
                    ? 'border-border/60 bg-muted/20 opacity-80'
                    : 'border-amber-500/30 bg-amber-500/[0.03] hover:border-amber-500/50',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        isResolved ? 'bg-emerald-500' : SEVERITY[incident.severity] || 'bg-amber-500',
                      )}
                    />
                    <p className="text-sm font-semibold text-foreground">{typeLabel}</p>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded-md',
                      isResolved
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                    )}
                  >
                    {isResolved ? 'Đã xử lý' : 'Đang xử lý'}
                  </span>
                </div>

                <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
                  {incident.description}
                </p>

                <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {routeCode && (
                      <span className="flex items-center gap-1 font-mono font-medium text-foreground">
                        <Bus size={12} className="text-brand" /> {routeCode}
                        {vehiclePlate && ` (${vehiclePlate})`}
                      </span>
                    )}
                    {driverName && (
                      <span className="flex items-center gap-1">
                        <User size={12} /> {driverName}
                      </span>
                    )}
                  </div>
                  <span>{new Date(incident.reportedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
