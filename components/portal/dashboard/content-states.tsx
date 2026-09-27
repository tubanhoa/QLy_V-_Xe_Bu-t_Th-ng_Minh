import { Sparkles } from 'lucide-react'
import type { NavItem } from '@/lib/rbac'

export function ContentSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Đang tải dữ liệu">
      <div className="flex flex-col gap-2">
        <div className="shimmer h-7 w-64 rounded-lg" />
        <div className="shimmer h-4 w-96 max-w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <div className="shimmer size-10 rounded-xl" />
            <div className="shimmer mt-4 h-4 w-24 rounded" />
            <div className="shimmer mt-2 h-7 w-32 rounded" />
            <div className="shimmer mt-4 h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="shimmer h-5 w-48 rounded" />
        <div className="mt-5 flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="shimmer h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ModulePreview({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{item.label}</h1>
          <p className="text-sm text-muted-foreground">{item.description}</p>
        </div>
      </div>

      <section className="flex flex-col items-center rounded-3xl border border-dashed border-emerald-500/30 bg-card px-6 py-14 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00A86B] to-[#00B4A0] text-white shadow-lg shadow-emerald-500/25">
          <Sparkles size={24} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-lg font-semibold text-foreground">Module đã sẵn sàng khung phân quyền</h2>
        <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          Màn hình chi tiết của module này sẽ được hoàn thiện trong các prompt tiếp theo của lộ trình
          thiết kế. Quyền truy cập đã được kiểm soát theo vai trò hiện tại.
        </p>
      </section>
    </div>
  )
}
