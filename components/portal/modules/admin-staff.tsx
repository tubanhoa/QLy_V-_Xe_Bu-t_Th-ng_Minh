'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  Mail,
  Phone,
  Plus,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react'

interface StaffAccount {
  id: string
  name: string
  email: string
  staffCode: string
  phone: string
  role: 'admin' | 'dispatcher' | 'driver'
  status: 'active' | 'suspended'
  lastLogin: string
}

const INITIAL_STAFF: StaffAccount[] = [
  {
    id: 'STF-01',
    name: 'Trần Minh Quân',
    email: 'admin@ictu.edu.vn',
    staffCode: 'ICTU-AD-001',
    phone: '0988.112.233',
    role: 'admin',
    status: 'active',
    lastLogin: 'Hôm nay, 08:12',
  },
  {
    id: 'STF-02',
    name: 'Nguyễn Văn A',
    email: 'dieuhanh@ictu.edu.vn',
    staffCode: 'ICTU-OP-089',
    phone: '0912.445.566',
    role: 'dispatcher',
    status: 'active',
    lastLogin: 'Hôm nay, 07:30',
  },
  {
    id: 'STF-03',
    name: 'Lê Hoàng Nam',
    email: 'taixe01@ictu.edu.vn',
    staffCode: 'ICTU-DR-214',
    phone: '0975.889.900',
    role: 'driver',
    status: 'active',
    lastLogin: 'Hôm nay, 06:45',
  },
  {
    id: 'STF-04',
    name: 'Nguyễn Văn Hùng',
    email: 'taixe02@ictu.edu.vn',
    staffCode: 'ICTU-DR-215',
    phone: '0936.123.456',
    role: 'driver',
    status: 'active',
    lastLogin: 'Hôm qua, 18:20',
  },
]

export function AdminStaff() {
  const [staffList, setStaffList] = useState<StaffAccount[]>(INITIAL_STAFF)
  const [search, setSearch] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleToggleRole = (id: string, newRole: 'admin' | 'dispatcher' | 'driver') => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, role: newRole } : s))
    )
    setFeedback('Đã cập nhật phân quyền tài khoản thành công!')
    setTimeout(() => setFeedback(null), 3000)
  }

  const filtered = staffList.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.staffCode.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Nhân Sự & Phân Quyền Hệ Thống (RBAC)
          </h1>
          <p className="text-sm text-muted-foreground">
            Quản lý tài khoản cán bộ quản trị, điều hành viên và tài xế/phụ xe
          </p>
        </div>

        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm theo tên, email, mã cán bộ..."
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

      {/* Staff Table */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="p-4 pl-6">Mã NV</th>
                <th className="p-4">Họ và tên</th>
                <th className="p-4">Email / SĐT</th>
                <th className="p-4">Vai trò (Role)</th>
                <th className="p-4">Đăng nhập gần nhất</th>
                <th className="p-4 pr-6 text-right">Phân quyền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 pl-6 font-mono text-xs font-bold text-foreground">
                    {item.staffCode}
                  </td>
                  <td className="p-4">
                    <p className="font-bold text-foreground">{item.name}</p>
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1">
                      <Mail size={12} /> {item.email}
                    </p>
                    <p className="flex items-center gap-1 mt-0.5">
                      <Phone size={12} /> {item.phone}
                    </p>
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        item.role === 'admin'
                          ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                          : item.role === 'dispatcher'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      }`}
                    >
                      {item.role === 'admin'
                        ? 'Super Admin'
                        : item.role === 'dispatcher'
                        ? 'Điều hành viên'
                        : 'Tài xế'}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">{item.lastLogin}</td>
                  <td className="p-4 pr-6 text-right">
                    <select
                      value={item.role}
                      onChange={(e) =>
                        handleToggleRole(item.id, e.target.value as 'admin' | 'dispatcher' | 'driver')
                      }
                      className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="admin">Super Admin</option>
                      <option value="dispatcher">Điều hành</option>
                      <option value="driver">Tài xế</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
