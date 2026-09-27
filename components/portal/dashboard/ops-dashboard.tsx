import { ADMIN_KPIS } from '@/lib/mock-data'
import type { Role } from '@/lib/rbac'
import { KpiCard } from './kpi-card'
import { IncidentsCard, RevenueChannelsCard } from './side-panels'
import { TripsPanel } from './trips-panel'

const COPY = {
  admin: {
    title: 'Dashboard Điều hành',
    subtitle: 'Tổng quan doanh thu, hiệu suất đội xe và phụ tải toàn mạng lưới.',
  },
  dispatcher: {
    title: 'Bàn làm việc Điều hành',
    subtitle: 'Giám sát chuyến xe, phân tài và xử lý cảnh báo theo thời gian thực.',
  },
}

export function OpsDashboard({ role }: { role: Exclude<Role, 'driver'> }) {
  const copy = COPY[role]
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ADMIN_KPIS.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TripsPanel />
        </div>
        {role === 'admin' ? <RevenueChannelsCard /> : <IncidentsCard />}
      </div>
    </div>
  )
}
