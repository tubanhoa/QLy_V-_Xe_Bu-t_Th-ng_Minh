'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  GraduationCap,
  Search,
  UserCheck,
  XCircle,
  FileText,
} from 'lucide-react'

interface StudentPassApp {
  id: string
  studentName: string
  studentId: string
  university: string
  faculty: string
  route: string
  passType: string
  appliedDate: string
  status: 'pending' | 'approved' | 'rejected'
  idCardPhotoUrl: string
}

const INITIAL_APPS: StudentPassApp[] = [
  {
    id: 'APP-2026-081',
    studentName: 'Vũ Minh Anh',
    studentId: 'DTC215480201',
    university: 'ĐH CNTT & Truyền Thông (ICTU)',
    faculty: 'Khoa Công nghệ Thông tin',
    route: 'Tuyến 01: KTX ICTU → Bến xe TP',
    passType: 'Vé tháng HSSV (Trợ giá 50%)',
    appliedDate: 'Hôm nay, 08:30',
    status: 'pending',
    idCardPhotoUrl: '/placeholder-user.jpg',
  },
  {
    id: 'APP-2026-082',
    studentName: 'Nguyễn Tiến Đạt',
    studentId: 'DTC225100344',
    university: 'ĐH CNTT & Truyền Thông (ICTU)',
    faculty: 'Khoa Hệ thống Thông tin Kinh tế',
    route: 'Tuyến 02: Campus ICTU → Quảng trường',
    passType: 'Vé tháng HSSV (Trợ giá 50%)',
    appliedDate: 'Hôm nay, 09:15',
    status: 'pending',
    idCardPhotoUrl: '/placeholder-user.jpg',
  },
  {
    id: 'APP-2026-083',
    studentName: 'Hoàng Thùy Dung',
    studentId: 'DTC235220112',
    university: 'ĐH CNTT & Truyền Thông (ICTU)',
    faculty: 'Khoa Truyền thông Đa phương tiện',
    route: 'Tuyến 01: KTX ICTU → Bến xe TP',
    passType: 'Vé tháng HSSV (Trợ giá 50%)',
    appliedDate: 'Hôm qua, 16:45',
    status: 'pending',
    idCardPhotoUrl: '/placeholder-user.jpg',
  },
  {
    id: 'APP-2026-084',
    studentName: 'Lê Tuấn Kiệt',
    studentId: 'DTC205110889',
    university: 'ĐH CNTT & Truyền Thông (ICTU)',
    faculty: 'Khoa Kỹ thuật Máy tính',
    route: 'Tuyến Campus Nội bộ',
    passType: 'Vé tháng HSSV (Trợ giá 50%)',
    appliedDate: 'Hôm qua, 14:20',
    status: 'pending',
    idCardPhotoUrl: '/placeholder-user.jpg',
  },
]

export function DispatcherStudentApproval() {
  const [apps, setApps] = useState<StudentPassApp[]>(INITIAL_APPS)
  const [search, setSearch] = useState('')
  const [previewApp, setPreviewApp] = useState<StudentPassApp | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleApprove = (id: string, name: string) => {
    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'approved' } : a))
    )
    setPreviewApp(null)
    setFeedback(`Đã phê duyệt vé tháng HSSV thành công cho sinh viên: ${name}`)
    setTimeout(() => setFeedback(null), 3500)
  }

  const handleReject = (id: string, name: string) => {
    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'rejected' } : a))
    )
    setPreviewApp(null)
    setFeedback(`Đã từ chối hồ sơ của sinh viên: ${name} (Ảnh thẻ không hợp lệ)`)
    setTimeout(() => setFeedback(null), 3500)
  }

  const filtered = apps.filter(
    (a) =>
      a.studentName.toLowerCase().includes(search.toLowerCase()) ||
      a.studentId.toLowerCase().includes(search.toLowerCase()) ||
      a.route.toLowerCase().includes(search.toLowerCase())
  )

  const pendingCount = apps.filter((a) => a.status === 'pending').length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Xét Duyệt Hồ Sơ Vé Tháng Học Sinh - Sinh Viên
            <span className="rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {pendingCount} hồ sơ chờ duyệt
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Xác minh thẻ sinh viên ICTU và thông tin đăng ký trợ giá 50%
          </p>
        </div>

        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm theo MSSV, Họ tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-xs sm:text-sm text-foreground focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {feedback && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-500" />
          {feedback}
        </div>
      )}

      {/* Applications Table / Cards */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="p-4 pl-6">Mã hồ sơ</th>
                <th className="p-4">Sinh viên & MSSV</th>
                <th className="p-4">Khoa / Đơn vị</th>
                <th className="p-4">Tuyến đăng ký</th>
                <th className="p-4">Thời gian nộp</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 pr-6 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 pl-6 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {item.id}
                  </td>
                  <td className="p-4">
                    <p className="font-bold text-foreground">{item.studentName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{item.studentId}</p>
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">{item.faculty}</td>
                  <td className="p-4 text-xs font-medium text-foreground">{item.route}</td>
                  <td className="p-4 text-xs text-muted-foreground">{item.appliedDate}</td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        item.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : item.status === 'rejected'
                          ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}
                    >
                      {item.status === 'approved'
                        ? 'Đã duyệt'
                        : item.status === 'rejected'
                        ? 'Từ chối'
                        : 'Chờ duyệt'}
                    </span>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    {item.status === 'pending' ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewApp(item)}
                          className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent"
                        >
                          <Eye size={13} /> Xem ảnh thẻ
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprove(item.id, item.studentName)}
                          className="rounded-lg bg-[#00A86B] px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm"
                        >
                          Duyệt
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Đã xử lý</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ID Card Verification Modal */}
      {previewApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground">
              Đối soát thẻ sinh viên: {previewApp.studentName}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              MSSV: {previewApp.studentId} • {previewApp.university}
            </p>

            <div className="mt-4 rounded-2xl border border-dashed border-border bg-slate-900 p-4 text-center">
              <div className="aspect-[16/10] w-full rounded-xl bg-slate-800 flex flex-col items-center justify-center text-white/50 text-xs">
                <FileText size={40} className="text-emerald-400 mb-2" />
                <p className="font-semibold text-white">Ảnh thẻ sinh viên đính kèm</p>
                <p className="text-[11px] opacity-75">Tên: {previewApp.studentName}</p>
                <p className="text-[11px] opacity-75">MSSV: {previewApp.studentId}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-accent/40 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Tuyến xe đăng ký:</p>
              <p>{previewApp.route}</p>
              <p className="mt-1 font-semibold text-foreground">Chính sách:</p>
              <p>Trợ giá 50% dành cho sinh viên ICTU (100.000đ/tháng không giới hạn số lượt đi)</p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPreviewApp(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => handleReject(previewApp.id, previewApp.studentName)}
                className="rounded-xl border border-red-500/30 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
              >
                Từ chối
              </button>
              <button
                type="button"
                onClick={() => handleApprove(previewApp.id, previewApp.studentName)}
                className="rounded-xl bg-[#00A86B] px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20"
              >
                Duyệt cấp vé tháng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
