'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  Mail,
  Phone,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  RefreshCw,
  AlertCircle,
  GraduationCap,
  Bus,
  SlidersHorizontal,
} from 'lucide-react'
import { userService, type BackendUser } from '@/lib/services/user.service'

export function AdminStaff() {
  const [users, setUsers] = useState<BackendUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await userService.getUsers({
        search: search.trim() || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        limit: 100,
      })
      if (res.success && res.data) {
        setUsers(res.data.items || [])
      }
    } catch (err) {
      console.error('[AdminStaff] Lỗi nạp danh sách người dùng:', err)
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId)
    try {
      const res = await userService.changeRole(userId, newRole)
      if (res.success) {
        setFeedback(`Đã cập nhật vai trò tài khoản thành [${newRole.toUpperCase()}] thành công!`)
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  role: {
                    id: u.role?.id || '',
                    name: newRole,
                    description: u.role?.description,
                  },
                }
              : u,
          ),
        )
      } else {
        setFeedback(res.message || 'Không thể cập nhật phân quyền.')
      }
    } catch {
      setFeedback('Lỗi kết nối khi cập nhật vai trò người dùng.')
    } finally {
      setUpdatingId(null)
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  // Lọc danh sách theo từ khóa tìm kiếm (phía client nếu có gõ)
  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase()
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phoneNumber && u.phoneNumber.includes(q)) ||
      (u.studentId && u.studentId.toLowerCase().includes(q))
    )
  })

  // Đếm số lượng theo nhóm
  const adminCount = users.filter((u) => u.role?.name === 'admin').length
  const managerCount = users.filter((u) => u.role?.name === 'manager').length
  const driverCount = users.filter((u) => u.role?.name === 'driver').length
  const passengerCount = users.filter((u) => u.role?.name === 'passenger').length

  return (
    <div className="flex flex-col gap-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              DATABASE SUPABASE CLOUD
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Tổng số: {users.length} tài khoản
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Nhân Sự & Phân Quyền Hệ Thống (RBAC)
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Dữ liệu tài khoản thực tế từ PostgreSQL: Quản trị viên, Điều hành viên, Tài xế và Sinh viên ICTU.
          </p>
        </div>

        {/* Nút Làm Mới */}
        <button
          type="button"
          onClick={() => fetchUsers()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-600' : ''} />
          <span>Đồng bộ từ Database</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Role Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs">
          {[
            { key: 'all', label: `Tất cả (${users.length})` },
            { key: 'admin', label: `Super Admin (${adminCount})` },
            { key: 'manager', label: `Điều hành (${managerCount})` },
            { key: 'driver', label: `Tài xế (${driverCount})` },
            { key: 'passenger', label: `Hành khách / HSSV (${passengerCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setRoleFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                roleFilter === tab.key
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, email, SĐT, mã SV..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-3 text-xs sm:text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none shadow-xs"
          />
        </div>
      </div>

      {feedback && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Staff Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-4 pl-6">Mã định danh</th>
                <th className="p-4">Họ và tên</th>
                <th className="p-4">Email / SĐT</th>
                <th className="p-4">Vai trò (Role)</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4">Ngày tạo</th>
                <th className="p-4 pr-6 text-right">Phân quyền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-slate-400">
                    <RefreshCw size={20} className="animate-spin text-emerald-600 mx-auto mb-2" />
                    Đang tải danh sách tài khoản từ Supabase Cloud...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-slate-400">
                    Không tìm thấy tài khoản phù hợp với điều kiện tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const roleName = u.role?.name || 'passenger'
                  const isUpdating = updatingId === u.id
                  const userCode = u.studentId
                    ? `SV-${u.studentId}`
                    : `USR-${u.id.slice(0, 6).toUpperCase()}`

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 pl-6 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                        {userCode}
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {roleName === 'admin' && <ShieldAlert size={14} className="text-purple-600" />}
                          {roleName === 'manager' && <UserCheck size={14} className="text-blue-600" />}
                          {roleName === 'driver' && <Bus size={14} className="text-emerald-600" />}
                          {roleName === 'passenger' && <GraduationCap size={14} className="text-slate-400" />}
                          <span>{u.fullName}</span>
                        </p>
                        {u.faculty && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Khoa: {u.faculty}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-xs text-slate-500">
                        <p className="flex items-center gap-1">
                          <Mail size={12} /> {u.email}
                        </p>
                        {u.phoneNumber && (
                          <p className="flex items-center gap-1 mt-0.5 font-mono">
                            <Phone size={12} /> {u.phoneNumber}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            roleName === 'admin'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40'
                              : roleName === 'manager'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40'
                              : roleName === 'driver'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {roleName === 'admin'
                            ? 'Super Admin'
                            : roleName === 'manager'
                            ? 'Điều hành viên'
                            : roleName === 'driver'
                            ? 'Tài xế'
                            : 'Hành khách / HSSV'}
                        </span>
                      </td>
                      <td className="p-4 text-xs">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-[11px]">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Hoạt động
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-400 font-mono">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '---'}
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <select
                          disabled={isUpdating}
                          value={roleName}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          <option value="admin">Super Admin</option>
                          <option value="manager">Điều hành</option>
                          <option value="driver">Tài xế</option>
                          <option value="passenger">Hành khách / HSSV</option>
                        </select>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
