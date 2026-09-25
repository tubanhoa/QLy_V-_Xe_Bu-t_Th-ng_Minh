'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  Clock,
  MapPin,
  Radio,
  Siren,
  Wrench,
} from 'lucide-react'

interface IncidentItem {
  id: string
  vehiclePlate: string
  route: string
  driver: string
  type: string
  severity: 'high' | 'medium' | 'low'
  description: string
  reportedAt: string
  status: 'pending' | 'resolving' | 'resolved'
}

const INITIAL_INCIDENTS: IncidentItem[] = [
  {
    id: 'INC-2026-012',
    vehiclePlate: '20B-014.22',
    route: 'Tuyến 01',
    driver: 'Nguyễn Văn Hùng',
    type: 'Tắc đường nghiêm trọng',
    severity: 'medium',
    description: 'Ùn tắc kéo dài 1km tại ngã tư Ga Thái Nguyên, dự kiến chậm 15 phút.',
    reportedAt: '10 phút trước',
    status: 'resolving',
  },
  {
    id: 'INC-2026-011',
    vehiclePlate: '20B-033.89',
    route: 'Tuyến Campus',
    driver: 'Phạm Quốc Cường',
    type: 'Sự cố lốp xe',
    severity: 'high',
    description: 'Cần hỗ trợ kỹ thuật tại bãi đỗ KTX C4, đã chuyển hành khách sang xe 20B-008.',
    reportedAt: '45 phút trước',
    status: 'pending',
  },
  {
    id: 'INC-2026-010',
    vehiclePlate: '20B-009.77',
    route: 'Tuyến 01',
    driver: 'Lê Hoàng Nam',
    type: 'Xin lùi giờ xuất bến',
    severity: 'low',
    description: 'Lượng sinh viên tan học đông tại trạm Cổng chính, xin lùi 5 phút.',
    reportedAt: '06:20 Sáng',
    status: 'resolved',
  },
]

export function DispatcherIncidents() {
  const [incidents, setIncidents] = useState<IncidentItem[]>(INITIAL_INCIDENTS)
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleUpdateStatus = (id: string, newStatus: 'resolving' | 'resolved') => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, status: newStatus } : inc))
    )
    setFeedback(`Đã cập nhật trạng thái sự cố ${id} thành công!`)
    setTimeout(() => setFeedback(null), 3000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          Trung Tâm Cảnh Báo & Xử Lý Sự Cố
          <span className="rounded-full bg-red-500/15 px-3 py-0.5 text-xs font-bold text-red-600 dark:text-red-400">
            {incidents.filter((i) => i.status !== 'resolved').length} sự cố đang mở
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Tiếp nhận cảnh báo khẩn cấp thời gian thực từ tài xế và camera hành trình
        </p>
      </div>

      {feedback && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-500" />
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {incidents.map((inc) => (
          <div
            key={inc.id}
            className={`rounded-3xl border p-5 shadow-sm flex flex-col justify-between transition-all ${
              inc.status === 'resolved'
                ? 'border-border bg-card opacity-70'
                : inc.severity === 'high'
                ? 'border-red-500/30 bg-red-500/[0.04]'
                : 'border-amber-500/30 bg-amber-500/[0.04]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-muted-foreground">{inc.id}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    inc.severity === 'high'
                      ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                      : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {inc.type}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <Bus size={12} />
                  {inc.vehiclePlate}
                </span>
                <span className="text-xs text-muted-foreground">• {inc.route}</span>
              </div>

              <p className="mt-3 text-sm text-foreground leading-relaxed">{inc.description}</p>
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span>Tài xế: {inc.driver}</span>
                <span>{inc.reportedAt}</span>
              </div>

              {inc.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(inc.id, 'resolving')}
                  className="w-full rounded-xl bg-amber-500 py-2 text-xs font-bold text-white hover:bg-amber-600 shadow-sm"
                >
                  Tiếp nhận xử lý
                </button>
              )}
              {inc.status === 'resolving' && (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(inc.id, 'resolved')}
                  className="w-full rounded-xl bg-[#00A86B] py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                >
                  Đánh dấu Đã xử lý xong
                </button>
              )}
              {inc.status === 'resolved' && (
                <div className="text-center py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                  <CheckCircle2 size={14} /> Sự cố đã được xử lý
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
