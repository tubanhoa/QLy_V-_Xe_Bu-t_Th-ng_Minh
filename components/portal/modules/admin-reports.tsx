'use client'

import { useState } from 'react'
import {
  Download,
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  History,
  TrendingUp,
  Users,
} from 'lucide-react'

interface AuditLog {
  id: string
  action: string
  operator: string
  resource: string
  ip: string
  timestamp: string
}

const AUDIT_LOGS: AuditLog[] = [
  {
    id: 'LOG-8812',
    action: 'Duyệt hồ sơ vé tháng HSSV',
    operator: 'Nguyễn Văn A (Điều hành)',
    resource: 'Hồ sơ: DTC215480201',
    ip: '10.20.14.55',
    timestamp: '08:42:15 - Hôm nay',
  },
  {
    id: 'LOG-8811',
    action: 'Điều phối xe 20B-009.77 vào chuyến 07:45',
    operator: 'Nguyễn Văn A (Điều hành)',
    resource: 'Chuyến: CT-01-0745',
    ip: '10.20.14.55',
    timestamp: '07:15:30 - Hôm nay',
  },
  {
    id: 'LOG-8810',
    action: 'Cập nhật giá vé Tuyến 01 lên 10.000đ',
    operator: 'Trần Minh Quân (Super Admin)',
    resource: 'Tuyến: R01',
    ip: '10.20.10.12',
    timestamp: '16:20:00 - Hôm qua',
  },
  {
    id: 'LOG-8809',
    action: 'Hoàn tiền vé BK-0700-06A',
    operator: 'Trần Minh Quân (Super Admin)',
    resource: 'Giao dịch: TXN-99809',
    ip: '10.20.10.12',
    timestamp: '15:25:10 - Hôm qua',
  },
]

export function AdminReports() {
  const [downloadSuccess, setDownloadSuccess] = useState(false)

  const handleExport = () => {
    setDownloadSuccess(true)
    setTimeout(() => setDownloadSuccess(false), 3000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Báo Cáo & Nhật Ký Kiểm Toán (Audit Logs)
          </h1>
          <p className="text-sm text-muted-foreground">
            Thống kê phụ tải hành khách, sản lượng doanh thu và truy vết toàn diện
          </p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-2 rounded-xl bg-[#00A86B] px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95"
        >
          <Download size={16} /> Xuất Báo Cáo Excel / PDF
        </button>
      </div>

      {downloadSuccess && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs sm:text-sm font-semibold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-emerald-500" />
          Đã xuất tệp dữ liệu `ICTU_Transit_Report_2026.xlsx` thành công!
        </div>
      )}

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <TrendingUp size={16} className="text-emerald-500" /> Doanh thu tháng này
          </span>
          <p className="mt-2 text-3xl font-bold font-mono text-foreground">148.650.000 đ</p>
          <span className="mt-2 inline-block text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            ↑ +18.4% so với tháng trước
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Users size={16} className="text-blue-500" /> Tổng lượt khách phục vụ
          </span>
          <p className="mt-2 text-3xl font-bold font-mono text-foreground">34.820</p>
          <span className="mt-2 inline-block text-xs font-semibold text-blue-600 dark:text-blue-400">
            ~1.160 lượt khách/ngày
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <FileBarChart2 size={16} className="text-purple-500" /> Tỷ lệ lấp đầy bình quân
          </span>
          <p className="mt-2 text-3xl font-bold font-mono text-foreground">84.2%</p>
          <span className="mt-2 inline-block text-xs font-semibold text-purple-600 dark:text-purple-400">
            Cao điểm đạt 98.6%
          </span>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="border-b border-border bg-muted/40 p-4 pl-6">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <History size={16} /> Nhật ký lưu vết thao tác hệ thống (Audit Trail)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="p-4 pl-6">Mã log</th>
                <th className="p-4">Hành động thao tác</th>
                <th className="p-4">Người thực hiện</th>
                <th className="p-4">Tài nguyên ảnh hưởng</th>
                <th className="p-4">Địa chỉ IP</th>
                <th className="p-4 pr-6">Thời điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {AUDIT_LOGS.map((log) => (
                <tr key={log.id} className="hover:bg-muted/20 transition-colors text-xs">
                  <td className="p-4 pl-6 font-mono font-bold text-muted-foreground">{log.id}</td>
                  <td className="p-4 font-semibold text-foreground">{log.action}</td>
                  <td className="p-4 text-muted-foreground">{log.operator}</td>
                  <td className="p-4 font-mono text-muted-foreground">{log.resource}</td>
                  <td className="p-4 font-mono text-muted-foreground">{log.ip}</td>
                  <td className="p-4 pr-6 text-muted-foreground">{log.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
