'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
  Trash2,
  Sparkles,
  Filter,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  SlidersHorizontal,
  UserPlus,
  Activity,
  X,
  Eye,
  EyeOff,
  Lock,
  IdCard,
  CreditCard,
  Calendar,
  Clock,
  Check,
} from 'lucide-react'
import {
  userService,
  type BackendUser,
  type DriverActivityResponse,
} from '@/lib/services/user.service'

const ROLE_PRIORITY: Record<string, number> = {
  admin: 4,
  manager: 3,
  driver: 2,
  passenger: 1,
}

type SortField = 'role' | 'fullName' | 'createdAt'
type SortOrder = 'asc' | 'desc'

export function AdminStaff() {
  const [users, setUsers] = useState<BackendUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [classificationFilter, setClassificationFilter] = useState<'all' | 'official' | 'test'>('all')
  const [sortField, setSortField] = useState<SortField>('role')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [isCleaning, setIsCleaning] = useState(false)
  const [confirmCleanOpen, setConfirmCleanOpen] = useState(false)
  const [deletingUser, setDeletingUser] = useState<BackendUser | null>(null)

  // 1. Cấp tài khoản tài xế mới
  const [isCreateDriverOpen, setIsCreateDriverOpen] = useState(false)
  const [newDriverName, setNewDriverName] = useState('')
  const [newDriverPhone, setNewDriverPhone] = useState('')
  const [newDriverIdCard, setNewDriverIdCard] = useState('')
  const [newDriverLicense, setNewDriverLicense] = useState('Hạng D (Xe buýt 29-45 chỗ)')
  const [newDriverEmail, setNewDriverEmail] = useState('')
  const [newDriverPassword, setNewDriverPassword] = useState('Driver@123')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmittingDriver, setIsSubmittingDriver] = useState(false)

  // 2. Theo dõi hồ sơ & hoạt động tài xế
  const [viewingDriver, setViewingDriver] = useState<BackendUser | null>(null)
  const [driverActivity, setDriverActivity] = useState<DriverActivityResponse | null>(null)
  const [isLoadingActivity, setIsLoadingActivity] = useState(false)
  const [activityTab, setActivityTab] = useState<'trips' | 'checkins'>('trips')

  const isTestAccount = useCallback((u: BackendUser): boolean => {
    if (typeof u.isTestAccount === 'boolean') return u.isTestAccount
    const lower = (u.email || '').toLowerCase()
    return (
      lower.startsWith('integration-test-') ||
      lower.startsWith('alias-test-') ||
      lower.startsWith('trips-test-') ||
      lower.startsWith('test.cloud@') ||
      lower.includes('test-passenger-') ||
      lower.includes('test-user-')
    )
  }, [])

  // Tải danh sách người dùng đầy đủ từ Supabase Cloud
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await userService.getUsers({
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
  }, [])

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
        setErrorFeedback(res.message || 'Không thể cập nhật phân quyền.')
      }
    } catch {
      setErrorFeedback('Lỗi kết nối khi cập nhật vai trò người dùng.')
    } finally {
      setUpdatingId(null)
      setTimeout(() => {
        setFeedback(null)
        setErrorFeedback(null)
      }, 4000)
    }
  }

  const handleDeleteUser = async (user: BackendUser) => {
    try {
      const res = await userService.deleteUser(user.id)
      if (res.success) {
        setFeedback(`Đã xóa tài khoản [${user.email}] thành công khỏi hệ thống!`)
        setUsers((prev) => prev.filter((u) => u.id !== user.id))
      } else {
        setErrorFeedback(res.message || 'Không thể xóa người dùng.')
      }
    } catch {
      setErrorFeedback('Lỗi hệ thống khi xóa người dùng.')
    } finally {
      setDeletingUser(null)
      setTimeout(() => {
        setFeedback(null)
        setErrorFeedback(null)
      }, 4000)
    }
  }

  const handleCleanupTestData = async () => {
    setIsCleaning(true)
    setConfirmCleanOpen(false)
    try {
      const res = await userService.cleanupTestData()
      if (res.success) {
        setFeedback(
          res.deletedCount && res.deletedCount > 0
            ? `Thành công! Đã dọn dẹp sạch ${res.deletedCount} tài khoản kiểm thử và dữ liệu rác.`
            : 'Cơ sở dữ liệu hoàn toàn sạch sẽ, không có tài khoản kiểm thử nào.',
        )
        await fetchUsers()
      } else {
        setErrorFeedback(res.message || 'Lỗi khi dọn dẹp dữ liệu kiểm thử.')
      }
    } catch {
      setErrorFeedback('Lỗi kết nối máy chủ khi dọn dẹp dữ liệu.')
    } finally {
      setIsCleaning(false)
      setTimeout(() => {
        setFeedback(null)
        setErrorFeedback(null)
      }, 4000)
    }
  }

  const handleDriverNameChange = (name: string) => {
    setNewDriverName(name)
    if (!name.trim()) return
    const parts = name.trim().toLowerCase().split(/\s+/)
    const lastName = parts[parts.length - 1]
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '')
    if (lastName) {
      setNewDriverEmail(`driver.${lastName}@smartbus.ictu.vn`)
    }
  }

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDriverName.trim() || !newDriverEmail.trim()) {
      setErrorFeedback('Vui lòng nhập họ tên và email nội bộ cho tài xế.')
      return
    }

    setIsSubmittingDriver(true)
    try {
      const res = await userService.createUser({
        fullName: newDriverName.trim(),
        email: newDriverEmail.trim().toLowerCase(),
        password: newDriverPassword.trim() || 'Driver@123',
        role: 'driver',
        phoneNumber: newDriverPhone.trim() || undefined,
        idCardNumber: newDriverIdCard.trim() || undefined,
        faculty: newDriverLicense,
      })

      if (res.success) {
        setFeedback(
          `Cấp tài khoản tài xế [${newDriverEmail}] thành công! Mật khẩu khởi tạo: ${newDriverPassword}`,
        )
        setIsCreateDriverOpen(false)
        setNewDriverName('')
        setNewDriverEmail('')
        setNewDriverPhone('')
        setNewDriverIdCard('')
        setNewDriverPassword('Driver@123')
        await fetchUsers()
      } else {
        setErrorFeedback(res.message || 'Không thể cấp tài khoản tài xế.')
      }
    } catch (err: any) {
      setErrorFeedback(err?.message || 'Lỗi hệ thống khi tạo tài khoản tài xế.')
    } finally {
      setIsSubmittingDriver(false)
      setTimeout(() => {
        setFeedback(null)
        setErrorFeedback(null)
      }, 5000)
    }
  }

  const handleOpenDriverActivity = async (driver: BackendUser) => {
    setViewingDriver(driver)
    setIsLoadingActivity(true)
    setDriverActivity(null)
    setActivityTab('trips')
    try {
      const res = await userService.getDriverActivity(driver.id)
      if (res.success && res.data) {
        setDriverActivity(res.data)
      } else {
        setErrorFeedback(res.message || 'Không thể tải nhật ký hoạt động tài xế.')
      }
    } catch {
      setErrorFeedback('Lỗi kết nối khi tải hoạt động tài xế.')
    } finally {
      setIsLoadingActivity(false)
    }
  }

  // Toggle Sắp xếp theo cột
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder(field === 'role' ? 'desc' : 'asc')
    }
  }

  // Lọc và sắp xếp người dùng
  const filteredAndSortedUsers = useMemo(() => {
    const q = search.trim().toLowerCase()

    return users
      .filter((u) => {
        // 1. Lọc theo từ khóa tìm kiếm
        const matchSearch =
          !q ||
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phoneNumber && u.phoneNumber.includes(q)) ||
          (u.studentId && u.studentId.toLowerCase().includes(q)) ||
          (u.faculty && u.faculty.toLowerCase().includes(q))

        // 2. Lọc theo phân loại (Chính thức / Test)
        const isTest = isTestAccount(u)
        let matchClassification = true
        if (classificationFilter === 'official') matchClassification = !isTest
        if (classificationFilter === 'test') matchClassification = isTest

        // 3. Lọc theo vai trò được chọn trên button
        const userRole = (u.role?.name || 'passenger').toLowerCase()
        const matchRole = roleFilter === 'all' || userRole === roleFilter.toLowerCase()

        return matchSearch && matchClassification && matchRole
      })
      .sort((a, b) => {
        if (sortField === 'role') {
          const priorityA = ROLE_PRIORITY[(a.role?.name || 'passenger').toLowerCase()] || 0
          const priorityB = ROLE_PRIORITY[(b.role?.name || 'passenger').toLowerCase()] || 0
          return sortOrder === 'desc' ? priorityB - priorityA : priorityA - priorityB
        }

        if (sortField === 'fullName') {
          const nameA = a.fullName || ''
          const nameB = b.fullName || ''
          return sortOrder === 'asc'
            ? nameA.localeCompare(nameB, 'vi')
            : nameB.localeCompare(nameA, 'vi')
        }

        if (sortField === 'createdAt') {
          const timeA = new Date(a.createdAt || 0).getTime()
          const timeB = new Date(b.createdAt || 0).getTime()
          return sortOrder === 'desc' ? timeB - timeA : timeA - timeB
        }

        return 0
      })
  }, [users, search, roleFilter, classificationFilter, sortField, sortOrder, isTestAccount])

  // Thống kê phân loại dựa trên tổng số tài khoản thực tế trong DB
  const testCount = useMemo(() => users.filter(isTestAccount).length, [users, isTestAccount])
  const officialCount = useMemo(() => users.length - testCount, [users, testCount])
  const adminCount = useMemo(
    () => users.filter((u) => (u.role?.name || '').toLowerCase() === 'admin').length,
    [users],
  )
  const managerCount = useMemo(
    () => users.filter((u) => (u.role?.name || '').toLowerCase() === 'manager').length,
    [users],
  )
  const driverCount = useMemo(
    () => users.filter((u) => (u.role?.name || '').toLowerCase() === 'driver').length,
    [users],
  )
  const passengerCount = useMemo(
    () => users.filter((u) => (u.role?.name || 'passenger').toLowerCase() === 'passenger').length,
    [users],
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              DATABASE SUPABASE CLOUD
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
              <ShieldCheck size={11} />
              {officialCount} Tài khoản chính thức
            </span>
            {testCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                <AlertTriangle size={11} />
                {testCount} Tài khoản Test / Rác
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                <Sparkles size={11} className="text-emerald-500" />
                Cơ sở dữ liệu sạch (0 test)
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-normal text-slate-900 dark:text-white">
            Nhân Sự & Phân Quyền Hệ Thống (RBAC)
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Dữ liệu tài khoản thực tế từ PostgreSQL: Quản trị viên, Điều hành viên, Tài xế và Sinh viên ICTU.
          </p>
        </div>

        {/* Nút tác vụ */}
        <div className="flex items-center gap-2">
          {/* Nút Cấp tài khoản Tài xế */}
          <button
            type="button"
            onClick={() => setIsCreateDriverOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all cursor-pointer hover:shadow-emerald-600/20 hover:shadow-md active:scale-95"
          >
            <UserPlus size={14} />
            <span>+ Cấp tài khoản Tài xế</span>
          </button>

          {/* Nút Dọn dẹp dữ liệu kiểm thử */}
          <button
            type="button"
            onClick={() => setConfirmCleanOpen(true)}
            disabled={isCleaning}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              testCount > 0
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
            title="Tự động tìm kiếm và loại bỏ các tài khoản kiểm thử test tự động"
          >
            <Trash2 size={14} className={isCleaning ? 'animate-spin' : ''} />
            <span>
              {isCleaning
                ? 'Đang dọn dẹp...'
                : testCount > 0
                ? `Dọn dẹp data test (${testCount})`
                : 'Dọn dẹp data test'}
            </span>
          </button>

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
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3">
        {/* Hàng 1: Phân loại tài khoản (Chính thức vs Test) */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
          <div className="flex items-center gap-1 px-2.5 py-1 text-slate-400 font-bold text-[11px] uppercase tracking-wider">
            <Filter size={13} />
            <span>Phân loại:</span>
          </div>
          {[
            { key: 'all', label: `Tất cả (${users.length})` },
            { key: 'official', label: `🟢 Tài khoản chính thức (${officialCount})` },
            { key: 'test', label: `🟡 Dữ liệu kiểm thử / Test (${testCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setClassificationFilter(tab.key as any)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                classificationFilter === tab.key
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Hàng 2: Button Sắp xếp & Lọc Vai Trò + Ô Tìm kiếm */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Role Filter Tabs (Nút lọc vai trò) */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs">
            {[
              { key: 'all', label: `Tất cả vai trò (${users.length})` },
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

          {/* Quick Sắp xếp vai trò & Tìm kiếm */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Sắp xếp: Dropdown & Toggle */}
            <div className="flex items-center gap-1.5">
              <select
                value={`${sortField}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-') as [SortField, SortOrder]
                  setSortField(field)
                  setSortOrder(order)
                }}
                className="h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-slate-700 dark:text-slate-300 focus:border-emerald-500 focus:outline-none cursor-pointer shadow-xs"
              >
                <option value="role-desc">Sắp xếp: Vai trò (Cao ➔ Thấp)</option>
                <option value="role-asc">Sắp xếp: Vai trò (Thấp ➔ Cao)</option>
                <option value="fullName-asc">Sắp xếp: Họ tên (A ➔ Z)</option>
                <option value="fullName-desc">Sắp xếp: Họ tên (Z ➔ A)</option>
                <option value="createdAt-desc">Sắp xếp: Ngày tạo (Mới nhất)</option>
                <option value="createdAt-asc">Sắp xếp: Ngày tạo (Cũ nhất)</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  if (sortField !== 'role') {
                    setSortField('role')
                    setSortOrder('desc')
                  } else {
                    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
                  }
                }}
                className={`h-10 inline-flex items-center gap-1.5 px-3 text-xs font-bold rounded-2xl border transition-all cursor-pointer ${
                  sortField === 'role'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
                title="Bấm để đảo chiều sắp xếp theo cấp bậc vai trò"
              >
                {sortField === 'role' && sortOrder === 'desc' ? (
                  <ArrowDownWideNarrow size={14} className="text-emerald-600" />
                ) : sortField === 'role' && sortOrder === 'asc' ? (
                  <ArrowUpNarrowWide size={14} className="text-emerald-600" />
                ) : (
                  <ArrowUpDown size={14} className="text-slate-400" />
                )}
                <span className="hidden sm:inline">
                  {sortField === 'role'
                    ? sortOrder === 'desc'
                      ? 'Cao ➔ Thấp'
                      : 'Thấp ➔ Cao'
                    : 'Đảo chiều'}
                </span>
              </button>
            </div>

            {/* Ô tìm kiếm */}
            <div className="relative flex-1 sm:w-72">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tên, email, SĐT, mã SV, khoa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-3 text-xs sm:text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none shadow-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {errorFeedback && (
        <div className="animate-in fade-in rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-semibold text-red-950 dark:text-red-100 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <span>{errorFeedback}</span>
        </div>
      )}

      {/* Staff Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
              <tr>
                <th className="p-4 pl-6">Mã định danh</th>

                {/* Sắp xếp theo Tên */}
                <th
                  onClick={() => handleSort('fullName')}
                  className="p-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Họ và tên</span>
                    {sortField === 'fullName' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={13} className="text-emerald-600 font-bold" />
                      ) : (
                        <ArrowDown size={13} className="text-emerald-600 font-bold" />
                      )
                    ) : (
                      <ArrowUpDown size={13} className="text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                </th>

                <th className="p-4">Email / SĐT</th>
                <th className="p-4">Phân loại</th>

                {/* Sắp xếp theo Vai trò (Role) */}
                <th
                  onClick={() => handleSort('role')}
                  className="p-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Vai trò (Role)</span>
                    {sortField === 'role' ? (
                      sortOrder === 'desc' ? (
                        <ArrowDownWideNarrow size={14} className="text-emerald-600 font-bold" />
                      ) : (
                        <ArrowUpNarrowWide size={14} className="text-emerald-600 font-bold" />
                      )
                    ) : (
                      <ArrowUpDown size={13} className="text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                </th>

                <th className="p-4">Trạng thái</th>

                {/* Sắp xếp theo Ngày tạo */}
                <th
                  onClick={() => handleSort('createdAt')}
                  className="p-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Ngày tạo</span>
                    {sortField === 'createdAt' ? (
                      sortOrder === 'desc' ? (
                        <ArrowDown size={13} className="text-emerald-600 font-bold" />
                      ) : (
                        <ArrowUp size={13} className="text-emerald-600 font-bold" />
                      )
                    ) : (
                      <ArrowUpDown size={13} className="text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                </th>

                <th className="p-4 pr-6 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-slate-400">
                    <RefreshCw size={20} className="animate-spin text-emerald-600 mx-auto mb-2" />
                    Đang tải danh sách tài khoản từ Supabase Cloud...
                  </td>
                </tr>
              ) : filteredAndSortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-slate-400">
                    Không tìm thấy tài khoản phù hợp với điều kiện tìm kiếm và vai trò đã chọn.
                  </td>
                </tr>
              ) : (
                filteredAndSortedUsers.map((u) => {
                  const roleName = (u.role?.name || 'passenger').toLowerCase()
                  const isUpdating = updatingId === u.id
                  const isTest = isTestAccount(u)
                  const isProtectedSuperAdmin =
                    u.email === 'admin@smartbus.ictu.vn' || u.email === 'narukun2812@gmail.com'

                  const userCode = u.studentId
                    ? `SV-${u.studentId}`
                    : `USR-${u.id.slice(0, 6).toUpperCase()}`

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${
                        isTest ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
                      }`}
                    >
                      <td className="p-4 pl-6 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                        {userCode}
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {roleName === 'admin' && <ShieldAlert size={14} className="text-purple-600 shrink-0" />}
                          {roleName === 'manager' && <UserCheck size={14} className="text-blue-600 shrink-0" />}
                          {roleName === 'driver' && <Bus size={14} className="text-emerald-600 shrink-0" />}
                          {roleName === 'passenger' && <GraduationCap size={14} className="text-slate-400 shrink-0" />}
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
                        {isTest ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/40">
                            <AlertTriangle size={11} />
                            Dữ liệu Test
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40">
                            <ShieldCheck size={11} className="text-emerald-600" />
                            Chính thức
                          </span>
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
                        <div className="inline-flex items-center gap-2">
                          <select
                            disabled={isUpdating}
                            value={roleName}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            <option value="admin">Super Admin</option>
                            <option value="manager">Điều hành</option>
                            <option value="driver">Tài xế</option>
                            <option value="passenger">Hành khách / HSSV</option>
                          </select>

                          {/* Nút Xem hoạt động tài xế */}
                          {roleName === 'driver' && (
                            <button
                              type="button"
                              onClick={() => handleOpenDriverActivity(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                              title="Xem ca chạy & lịch sử soát vé của tài xế"
                            >
                              <Activity size={13} />
                              <span>Ca chạy & Soát vé</span>
                            </button>
                          )}

                          {/* Nút Xóa tài khoản */}
                          {!isProtectedSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeletingUser(u)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                              title="Xóa tài khoản này"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal - Dọn dẹp dữ liệu kiểm thử */}
      {confirmCleanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="size-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mb-4">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Xác nhận dọn dẹp data kiểm thử?
            </h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Hệ thống sẽ quét và loại bỏ toàn bộ các tài khoản kiểm thử tự động (tiền tố test, integration-test, trips-test, alias-test, v.v.) cùng các dữ liệu rác liên quan trong Supabase. Các tài khoản chính thức (Admin, Điều hành, Tài xế, Sinh viên ICTU thực tế) sẽ được giữ nguyên 100%.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmCleanOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleCleanupTestData}
                disabled={isCleaning}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Tiến hành dọn dẹp ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal - Xóa 1 tài khoản đơn lẻ */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="size-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Xác nhận xóa tài khoản?
            </h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Bạn có chắc chắn muốn xóa tài khoản{' '}
              <strong className="text-slate-900 dark:text-white font-mono">
                {deletingUser.email}
              </strong>{' '}
              ({deletingUser.fullName})? Hành động này sẽ loại bỏ vĩnh viễn tài khoản khỏi Supabase Database.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(deletingUser)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CẤP TÀI KHOẢN TÀI XẾ NỘI BỘ */}
      {isCreateDriverOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl my-8">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                  <Bus size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Cấp Tài Khoản Tài Xế Nội Bộ
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Khởi tạo tài khoản lái xe buýt ICTU Transit và lưu trữ CSDL Supabase
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateDriverOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDriver} className="space-y-4">
              {/* Họ và tên */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Họ và tên tài xế <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn Tuấn"
                  value={newDriverName}
                  onChange={(e) => handleDriverNameChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* SĐT & CCCD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    placeholder="0912 345 678"
                    value={newDriverPhone}
                    onChange={(e) => setNewDriverPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Số CCCD / CMND
                  </label>
                  <input
                    type="text"
                    placeholder="019203001234"
                    value={newDriverIdCard}
                    onChange={(e) => setNewDriverIdCard(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Hạng giấy phép lái xe */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Hạng giấy phép lái xe
                </label>
                <select
                  value={newDriverLicense}
                  onChange={(e) => setNewDriverLicense(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="Hạng D (Xe buýt 29-45 chỗ)">Hạng D (Xe buýt 29-45 chỗ)</option>
                  <option value="Hạng E (Xe buýt trên 45 chỗ / nối toa)">Hạng E (Xe buýt trên 45 chỗ / nối toa)</option>
                  <option value="Hạng C (Xe tải / trung chuyển)">Hạng C (Xe tải / trung chuyển)</option>
                  <option value="Hạng B2 (Xe điều hành nội bộ)">Hạng B2 (Xe điều hành nội bộ)</option>
                </select>
              </div>

              {/* Email nội bộ */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Email nội bộ đăng nhập <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-emerald-600 font-semibold">Tự động gợi ý</span>
                </div>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="driver.tuan@smartbus.ictu.vn"
                    value={newDriverEmail}
                    onChange={(e) => setNewDriverEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-3.5 pr-10 py-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                  />
                  <Mail size={14} className="absolute right-3.5 top-3 text-slate-400" />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Tài xế sẽ dùng email này đăng nhập vào Dashboard Buồng lái & Máy quét vé.
                </p>
              </div>

              {/* Mật khẩu khởi tạo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mật khẩu khởi tạo ban đầu
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newDriverPassword}
                    onChange={(e) => setNewDriverPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-3.5 pr-10 py-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Mặc định: <code className="font-bold text-emerald-600">Driver@123</code> (Có thể đổi sau khi đăng nhập).
                </p>
              </div>

              {/* Nút tác vụ */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateDriverOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDriver}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingDriver ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Đang tạo tài khoản...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Xác nhận cấp tài khoản</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: HỒ SƠ & GIÁM SÁT HOẠT ĐỘNG TÀI XẾ */}
      {viewingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl my-6 overflow-hidden">
            {/* Header thông tin tài xế */}
            <div className="p-5 sm:p-6 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="size-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-emerald-600/20 shrink-0">
                  {viewingDriver.fullName ? viewingDriver.fullName.slice(0, 1).toUpperCase() : 'T'}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      {viewingDriver.fullName}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40">
                      <Bus size={11} />
                      TÀI XẾ NỘI BỘ
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300/40">
                      {driverActivity?.driver.licenseClass || viewingDriver.faculty || 'Hạng D (Xe 29-45 chỗ)'}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Mail size={12} /> {viewingDriver.email}
                    </span>
                    {viewingDriver.phoneNumber && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone size={12} /> {viewingDriver.phoneNumber}
                      </span>
                    )}
                    {viewingDriver.idCardNumber && (
                      <span className="flex items-center gap-1 font-mono">
                        <IdCard size={12} /> CCCD: {viewingDriver.idCardNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewingDriver(null)
                  setDriverActivity(null)
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* 4 Thẻ KPI Hoạt động */}
            <div className="p-5 sm:p-6 pb-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-xs">
                  <p className="text-[11px] font-bold text-slate-500">Tổng chuyến phụ trách</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                    {driverActivity?.stats.totalTrips ?? '...'}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 shadow-xs">
                  <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">Chuyến hoàn thành</p>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {driverActivity?.stats.completedTrips ?? '...'}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 shadow-xs">
                  <p className="text-[11px] font-bold text-blue-800 dark:text-blue-300">Đang / Sắp chạy</p>
                  <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">
                    {driverActivity?.stats.inProgressTrips ?? '...'}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 shadow-xs">
                  <p className="text-[11px] font-bold text-purple-800 dark:text-purple-300">Vé đã soát lên xe</p>
                  <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1">
                    {driverActivity?.stats.totalTicketsCheckedIn ?? '...'}
                  </p>
                </div>
              </div>

              {/* Tabs Switcher */}
              <div className="mt-5 flex border-b border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActivityTab('trips')}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activityTab === 'trips'
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Danh sách chuyến phụ trách ({driverActivity?.trips.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActivityTab('checkins')}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activityTab === 'checkins'
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Nhật ký soát vé gần nhất ({driverActivity?.recentCheckIns.length || 0})
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 pb-6">
              {isLoadingActivity ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <RefreshCw size={24} className="animate-spin text-emerald-600 mb-2" />
                  <span>Đang tải dữ liệu hoạt động tài xế...</span>
                </div>
              ) : activityTab === 'trips' ? (
                <div>
                  {!driverActivity?.trips || driverActivity.trips.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      Chưa có chuyến xe nào được phân công cho tài xế này.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3 pl-4">Tuyến xe buýt</th>
                            <th className="p-3">Xe phụ trách</th>
                            <th className="p-3">Giờ khởi hành</th>
                            <th className="p-3 pr-4 text-right">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {driverActivity.trips.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="p-3 pl-4 font-bold text-slate-900 dark:text-white">
                                {t.routeName}
                                {t.routeCode && (
                                  <span className="block text-[10px] text-slate-400 font-normal">
                                    Mã: {t.routeCode}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-mono text-slate-700 dark:text-slate-300 font-semibold">
                                {t.vehiclePlate}
                              </td>
                              <td className="p-3 text-slate-500 font-mono">
                                {new Date(t.departureTime).toLocaleString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: '2-digit',
                                })}
                              </td>
                              <td className="p-3 pr-4 text-right">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    t.status === 'completed'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      : t.status === 'in_progress' || t.status === 'departed'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  }`}
                                >
                                  {t.status === 'completed'
                                    ? 'Đã hoàn thành'
                                    : t.status === 'in_progress' || t.status === 'departed'
                                    ? 'Đang chạy'
                                    : 'Sắp chạy'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {!driverActivity?.recentCheckIns || driverActivity.recentCheckIns.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      Chưa ghi nhận lượt soát vé nào từ tài xế này.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3 pl-4">Mã vé</th>
                            <th className="p-3">Hành khách / Sinh viên</th>
                            <th className="p-3">Ghế ngồi</th>
                            <th className="p-3 pr-4 text-right">Thời gian soát</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {driverActivity.recentCheckIns.map((ci, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="p-3 pl-4 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {ci.ticketCode}
                              </td>
                              <td className="p-3 font-semibold text-slate-900 dark:text-white">
                                {ci.passengerName}
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                                {ci.seatNumber}
                              </td>
                              <td className="p-3 pr-4 text-right text-slate-500 font-mono">
                                {new Date(ci.checkedInAt).toLocaleString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  day: '2-digit',
                                  month: '2-digit',
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setViewingDriver(null)
                  setDriverActivity(null)
                }}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
