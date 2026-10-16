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
  UserPlus,
  Activity,
  X,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  IdCard,
  Building,
  Save,
  KeyRound,
  Shield,
  Edit3,
  Check,
  Clock,
  Radio,
} from 'lucide-react'
import {
  userService,
  type BackendUser,
  type DriverActivityResponse,
} from '@/lib/services/user.service'

const ROLE_PRIORITY: Record<string, number> = {
  admin: 5,
  manager: 4,
  driver: 3,
  conductor: 2,
  passenger: 1,
}

const ROLE_DETAILS = {
  admin: {
    label: 'Super Admin',
    desc: 'Toàn quyền quản trị hệ thống, tài chính, báo cáo, đội xe và phân quyền.',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800/40',
    icon: ShieldAlert,
  },
  manager: {
    label: 'Điều hành viên / Quản lý',
    desc: 'Điều hành lịch trình chạy xe, định vị GPS, phê duyệt thẻ sinh viên và xử lý sự cố.',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800/40',
    icon: UserCheck,
  },
  driver: {
    label: 'Tài xế xe buýt',
    desc: 'Xem ca chạy hôm nay, buồng lái số HUD, quét vé QR và danh sách hành khách.',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40',
    icon: Bus,
  },
  conductor: {
    label: 'Phụ xe / Soát vé',
    desc: 'Kiểm soát vé hành khách trên xe, hỗ trợ sinh viên ICTU và hành khách ưu tiên.',
    badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800/40',
    icon: Users,
  },
  passenger: {
    label: 'Hành khách / HSSV',
    desc: 'Tra cứu tuyến, mua vé điện tử, đăng ký vé tháng ưu đãi và gửi đánh giá phản ánh.',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    icon: GraduationCap,
  },
}

type SortField = 'role' | 'fullName' | 'createdAt'
type SortOrder = 'asc' | 'desc'

export interface AdminStaffProps {
  onNavigate?: (key: string) => void
}

export function AdminStaff({ onNavigate }: AdminStaffProps = {}) {
  const [users, setUsers] = useState<BackendUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked'>('all')
  const [classificationFilter, setClassificationFilter] = useState<'all' | 'official' | 'test'>('all')
  const [sortField, setSortField] = useState<SortField>('role')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [isCleaning, setIsCleaning] = useState(false)
  const [confirmCleanOpen, setConfirmCleanOpen] = useState(false)
  const [deletingUser, setDeletingUser] = useState<BackendUser | null>(null)

  // 1. Modal Thêm mới tài khoản (Tất cả 5 Roles)
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false)
  const [createRole, setCreateRole] = useState<'admin' | 'manager' | 'driver' | 'conductor' | 'passenger'>('driver')
  const [newFullName, setNewFullName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('Password@123')
  const [showPassword, setShowPassword] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [newIdCard, setNewIdCard] = useState('')
  const [newStudentId, setNewStudentId] = useState('')
  const [newFaculty, setNewFaculty] = useState('')
  const [newDriverLicense, setNewDriverLicense] = useState('Hạng D (Xe buýt 29-45 chỗ)')
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false)

  // 2. Modal Chỉnh sửa thông tin tài khoản
  const [editingUser, setEditingUser] = useState<BackendUser | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editIdCard, setEditIdCard] = useState('')
  const [editStudentId, setEditStudentId] = useState('')
  const [editFaculty, setEditFaculty] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // 3. Modal Phân quyền / Đổi vai trò
  const [roleAssignUser, setRoleAssignUser] = useState<BackendUser | null>(null)
  const [selectedRoleForAssign, setSelectedRoleForAssign] = useState<string>('passenger')
  const [isAssigningRole, setIsAssigningRole] = useState(false)

  // 4. Theo dõi hồ sơ & hoạt động tài xế
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

  // Tải danh sách người dùng từ Database
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

  // Cập nhật email gợi ý theo tên và role
  const handleCreateNameChange = (name: string, role = createRole) => {
    setNewFullName(name)
    if (!name.trim()) return
    const parts = name.trim().toLowerCase().split(/\s+/)
    const lastName = parts[parts.length - 1]
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '')
    if (lastName) {
      const prefix =
        role === 'admin'
          ? 'admin'
          : role === 'manager'
          ? 'manager'
          : role === 'driver'
          ? 'driver'
          : role === 'conductor'
          ? 'conductor'
          : 'student'
      setNewEmail(`${prefix}.${lastName}@smartbus.ictu.vn`)
    }
  }

  const handleRoleTypeChange = (r: 'admin' | 'manager' | 'driver' | 'conductor' | 'passenger') => {
    setCreateRole(r)
    setNewPassword(
      r === 'admin' ? 'Admin@123' : r === 'driver' ? 'Driver@123' : r === 'conductor' ? 'Staff@123' : 'Password@123'
    )
    if (newFullName.trim()) {
      handleCreateNameChange(newFullName, r)
    }
  }

  // Submit tạo tài khoản mới
  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFullName.trim() || !newEmail.trim()) {
      setErrorFeedback('Vui lòng nhập họ tên và email cho tài khoản mới.')
      return
    }

    setIsSubmittingCreate(true)
    try {
      const payload: any = {
        fullName: newFullName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword.trim() || 'Password@123',
        role: createRole,
        phoneNumber: newPhone.trim() || undefined,
        idCardNumber: newIdCard.trim() || undefined,
      }

      if (createRole === 'passenger') {
        payload.studentId = newStudentId.trim() ? newStudentId.trim().toUpperCase() : undefined
        payload.faculty = newFaculty.trim() || undefined
      } else if (createRole === 'driver') {
        payload.faculty = newDriverLicense.trim()
      } else if (createRole === 'conductor') {
        payload.faculty = newFaculty.trim() || 'Soát vé & Hỗ trợ hành khách'
      }

      const res = await userService.createUser(payload)

      if (res.success) {
        setFeedback(
          `Cấp tài khoản [${newEmail}] thành công với vai trò ${ROLE_DETAILS[createRole].label}! Mật khẩu: ${newPassword}`
        )
        setIsCreateAccountOpen(false)
        setNewFullName('')
        setNewEmail('')
        setNewPhone('')
        setNewIdCard('')
        setNewStudentId('')
        setNewFaculty('')
        await fetchUsers()
      } else {
        setErrorFeedback(res.message || 'Không thể tạo tài khoản người dùng.')
      }
    } catch (err: any) {
      setErrorFeedback(err?.message || 'Lỗi hệ thống khi tạo tài khoản.')
    } finally {
      setIsSubmittingCreate(false)
      setTimeout(() => {
        setFeedback(null)
        setErrorFeedback(null)
      }, 5000)
    }
  }

  // Mở modal sửa thông tin
  const handleOpenEdit = (user: BackendUser) => {
    setEditingUser(user)
    setEditFullName(user.fullName || '')
    setEditPhone(user.phoneNumber || '')
    setEditIdCard(user.idCardNumber || '')
    setEditStudentId(user.studentId || '')
    setEditFaculty(user.faculty || '')
  }

  // Submit cập nhật thông tin
  const handleSaveEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setIsSavingEdit(true)
    try {
      const res = await userService.updateUser(editingUser.id, {
        fullName: editFullName.trim(),
        phoneNumber: editPhone.trim() || undefined,
        idCardNumber: editIdCard.trim() || undefined,
        studentId: editStudentId.trim() ? editStudentId.trim().toUpperCase() : undefined,
        faculty: editFaculty.trim() || undefined,
      })

      if (res.success) {
        setFeedback(`Đã cập nhật thông tin tài khoản [${editingUser.email}] thành công!`)
        setEditingUser(null)
        await fetchUsers()
      } else {
        setErrorFeedback(res.message || 'Không thể cập nhật thông tin tài khoản.')
      }
    } catch (err: any) {
      setErrorFeedback(err?.message || 'Lỗi hệ thống khi cập nhật thông tin.')
    } finally {
      setIsSavingEdit(false)
      setTimeout(() => {
        setFeedback(null)
        setErrorFeedback(null)
      }, 4000)
    }
  }

  // Mở modal phân quyền
  const handleOpenRoleAssign = (user: BackendUser) => {
    setRoleAssignUser(user)
    setSelectedRoleForAssign((user.role?.name || 'passenger').toLowerCase())
  }

  // Submit phân quyền
  const handleRoleAssignSubmit = async () => {
    if (!roleAssignUser) return

    setIsAssigningRole(true)
    try {
      const res = await userService.changeRole(roleAssignUser.id, selectedRoleForAssign)
      if (res.success) {
        setFeedback(
          `Đã phân quyền tài khoản [${roleAssignUser.email}] thành vai trò [${selectedRoleForAssign.toUpperCase()}] thành công!`
        )
        setRoleAssignUser(null)
        await fetchUsers()
      } else {
        setErrorFeedback(res.message || 'Không thể thay đổi vai trò người dùng.')
      }
    } catch {
      setErrorFeedback('Lỗi kết nối khi thay đổi vai trò người dùng.')
    } finally {
      setIsAssigningRole(false)
      setTimeout(() => {
        setFeedback(null)
        setErrorFeedback(null)
      }, 4000)
    }
  }

  // Đổi trạng thái Khóa / Mở khóa tài khoản
  const handleToggleStatus = async (user: BackendUser) => {
    const isLocked = user.status === 'locked' || user.status === 'inactive'
    const nextStatus = isLocked ? 'active' : 'locked'
    setUpdatingId(user.id)

    try {
      const res = await userService.changeStatus(user.id, nextStatus as any)
      if (res.success) {
        setFeedback(
          nextStatus === 'active'
            ? `Đã MỞ KHÓA tài khoản [${user.email}] thành công!`
            : `Đã KHÓA tài khoản [${user.email}] thành công!`
        )
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
        )
      } else {
        setErrorFeedback(res.message || 'Không thể thay đổi trạng thái tài khoản.')
      }
    } catch {
      setErrorFeedback('Lỗi hệ thống khi thay đổi trạng thái tài khoản.')
    } finally {
      setUpdatingId(null)
      setTimeout(() => {
        setFeedback(null)
        setErrorFeedback(null)
      }, 4000)
    }
  }

  // Xóa tài khoản
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

  // Dọn dẹp dữ liệu kiểm thử 1-click
  const handleCleanupTestData = async () => {
    setIsCleaning(true)
    setConfirmCleanOpen(false)
    try {
      const res = await userService.cleanupTestData()
      if (res.success) {
        setFeedback(
          res.deletedCount && res.deletedCount > 0
            ? `Thành công! Đã dọn dẹp sạch ${res.deletedCount} tài khoản kiểm thử và dữ liệu rác.`
            : 'Cơ sở dữ liệu hoàn toàn sạch sẽ, không có tài khoản kiểm thử nào.'
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

  // Xem hoạt động tài xế
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

  // Toggle Sắp xếp
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
        // 1. Tìm kiếm
        const matchSearch =
          !q ||
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phoneNumber && u.phoneNumber.includes(q)) ||
          (u.studentId && u.studentId.toLowerCase().includes(q)) ||
          (u.faculty && u.faculty.toLowerCase().includes(q))

        // 2. Phân loại (Chính thức / Test)
        const isTest = isTestAccount(u)
        let matchClassification = true
        if (classificationFilter === 'official') matchClassification = !isTest
        if (classificationFilter === 'test') matchClassification = isTest

        // 3. Trạng thái (active vs locked)
        const isUserLocked = u.status === 'locked' || u.status === 'inactive'
        let matchStatus = true
        if (statusFilter === 'active') matchStatus = !isUserLocked
        if (statusFilter === 'locked') matchStatus = isUserLocked

        // 4. Vai trò
        const userRole = (u.role?.name || 'passenger').toLowerCase()
        const matchRole = roleFilter === 'all' || userRole === roleFilter.toLowerCase()

        return matchSearch && matchClassification && matchStatus && matchRole
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
  }, [users, search, roleFilter, statusFilter, classificationFilter, sortField, sortOrder, isTestAccount])

  // Thống kê số lượng
  const testCount = useMemo(() => users.filter(isTestAccount).length, [users, isTestAccount])
  const officialCount = useMemo(() => users.length - testCount, [users, testCount])
  const lockedCount = useMemo(
    () => users.filter((u) => u.status === 'locked' || u.status === 'inactive').length,
    [users]
  )
  const activeCount = useMemo(() => users.length - lockedCount, [users, lockedCount])

  const adminCount = useMemo(
    () => users.filter((u) => (u.role?.name || '').toLowerCase() === 'admin').length,
    [users]
  )
  const managerCount = useMemo(
    () => users.filter((u) => (u.role?.name || '').toLowerCase() === 'manager').length,
    [users]
  )
  const driverCount = useMemo(
    () => users.filter((u) => (u.role?.name || '').toLowerCase() === 'driver').length,
    [users]
  )
  const conductorCount = useMemo(
    () => users.filter((u) => (u.role?.name || '').toLowerCase() === 'conductor').length,
    [users]
  )
  const passengerCount = useMemo(
    () =>
      users.filter((u) => {
        const r = (u.role?.name || 'passenger').toLowerCase()
        return r === 'passenger' || !['admin', 'manager', 'driver', 'conductor'].includes(r)
      }).length,
    [users]
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
              {officialCount} Chính thức
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
              <CheckCircle2 size={11} />
              {activeCount} Đang hoạt động
            </span>
            {lockedCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/40">
                <Lock size={11} />
                {lockedCount} Đang bị khóa
              </span>
            )}
            {testCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                <AlertTriangle size={11} />
                {testCount} Tài khoản Test
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-normal text-slate-900 dark:text-white">
            Quản Lý Tài Khoản & Phân Quyền RBAC
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Quản lý tài khoản, gán quyền truy cập (Admin, Quản lý, Tài xế, Phụ xe, Hành khách) và khóa/mở tài khoản an toàn.
          </p>
        </div>

        {/* Nút tác vụ */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Nút Thẩm định GPLX Tài xế */}
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('driver-licenses')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all cursor-pointer"
              title="Khám & Thẩm định hồ sơ bằng lái cho 3 tài xế"
            >
              <IdCard size={14} />
              <span>Thẩm Định GPLX</span>
              <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px] font-mono">
                1 chờ duyệt
              </span>
            </button>
          )}

          {/* Nút Thêm mới tài khoản */}
          <button
            type="button"
            onClick={() => setIsCreateAccountOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all cursor-pointer hover:shadow-emerald-600/20 hover:shadow-md active:scale-95"
          >
            <UserPlus size={14} />
            <span>+ Thêm Tài Khoản Mới</span>
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
            <span>Đồng bộ</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3">
        {/* Hàng 1: Bộ lọc Phân loại & Trạng thái */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
          {/* Phân loại chính thức vs test */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 px-2 text-slate-400 font-bold text-[11px] uppercase tracking-wider">
              <Filter size={13} />
              <span>Phân loại:</span>
            </div>
            {[
              { key: 'all', label: `Tất cả (${users.length})` },
              { key: 'official', label: `Chính thức (${officialCount})`, dot: 'bg-emerald-500' },
              { key: 'test', label: `Dữ liệu Test (${testCount})`, dot: 'bg-amber-500' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setClassificationFilter(tab.key as any)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  classificationFilter === tab.key
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800/60'
                }`}
              >
                {tab.dot && <span className={`h-2 w-2 rounded-full ${tab.dot}`} />}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Lọc theo trạng thái Khóa / Mở */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 px-2 text-slate-400 font-bold text-[11px] uppercase tracking-wider">
              <Shield size={13} />
              <span>Trạng thái:</span>
            </div>
            {[
              { key: 'all', label: `Tất cả (${users.length})` },
              { key: 'active', label: `Hoạt động (${activeCount})`, color: 'text-emerald-600' },
              { key: 'locked', label: `Bị khóa (${lockedCount})`, color: 'text-red-500' },
            ].map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => setStatusFilter(st.key as any)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  statusFilter === st.key
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800/60'
                }`}
              >
                <span>{st.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Hàng 2: Role Filter Tabs + Sắp xếp & Tìm kiếm */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Lọc vai trò */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs">
            {[
              { key: 'all', label: `Tất cả (${users.length})` },
              { key: 'admin', label: `Admin (${adminCount})` },
              { key: 'manager', label: `Quản lý (${managerCount})` },
              { key: 'driver', label: `Tài xế (${driverCount})` },
              { key: 'conductor', label: `Phụ xe (${conductorCount})` },
              { key: 'passenger', label: `Hành khách (${passengerCount})` },
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

          {/* Sắp xếp & Tìm kiếm */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-') as [SortField, SortOrder]
                setSortField(field)
                setSortOrder(order)
              }}
              className="h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-slate-700 dark:text-slate-300 focus:border-emerald-500 focus:outline-none cursor-pointer shadow-xs"
            >
              <option value="role-desc">Sắp xếp: Vai trò (Cao đến Thấp)</option>
              <option value="role-asc">Sắp xếp: Vai trò (Thấp đến Cao)</option>
              <option value="fullName-asc">Sắp xếp: Họ tên (A - Z)</option>
              <option value="fullName-desc">Sắp xếp: Họ tên (Z - A)</option>
              <option value="createdAt-desc">Sắp xếp: Ngày tạo (Mới nhất)</option>
              <option value="createdAt-asc">Sắp xếp: Ngày tạo (Cũ nhất)</option>
            </select>

            <div className="relative flex-1 sm:w-72">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tên, email, SĐT, mã SV..."
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

      {/* Banner nhắc việc thẩm định khi lọc vai trò Tài Xế */}
      {roleFilter === 'driver' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4.5 rounded-2xl bg-linear-to-r from-amber-500/10 via-amber-500/5 to-emerald-500/10 border border-amber-300 dark:border-amber-700/60 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <IdCard size={20} />
            </div>
            <div>
              <p className="font-black text-slate-900 dark:text-white text-sm">
                Đang Xem Danh Sách {driverCount} Tài Khoản Tài Xế
              </p>
              <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-0.5">
                Kiểm tra hình ảnh 2 mặt GPLX Hạng D/E, phóng to, xoay ảnh và duyệt chứng chỉ hành nghề trực tiếp tại module Thẩm định GPLX.
              </p>
            </div>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('driver-licenses')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition cursor-pointer shrink-0 shadow-xs"
            >
              <IdCard size={14} />
              <span>Khám & Phê Duyệt GPLX →</span>
            </button>
          )}
        </div>
      )}

      {/* Staff Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left text-sm">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
              <tr>
                <th className="p-4 pl-6 w-32 whitespace-nowrap">Mã định danh</th>
                <th
                  onClick={() => handleSort('fullName')}
                  className="p-4 min-w-[220px] whitespace-nowrap cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
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
                <th className="p-4 min-w-[240px] whitespace-nowrap">Email / SĐT</th>
                <th
                  onClick={() => handleSort('role')}
                  className="p-4 w-44 whitespace-nowrap cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Vai trò / Quyền hạn</span>
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
                <th className="p-4 w-36 whitespace-nowrap">Trạng thái</th>
                <th
                  onClick={() => handleSort('createdAt')}
                  className="p-4 w-28 whitespace-nowrap cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
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
                <th className="p-4 pr-6 min-w-[280px] text-right whitespace-nowrap">Thao tác</th>
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
              ) : filteredAndSortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-slate-400">
                    Không tìm thấy tài khoản phù hợp với điều kiện tìm kiếm và bộ lọc đã chọn.
                  </td>
                </tr>
              ) : (
                filteredAndSortedUsers.map((u) => {
                  const roleName = (u.role?.name || 'passenger').toLowerCase()
                  const isUpdating = updatingId === u.id
                  const isTest = isTestAccount(u)
                  const isUserLocked = u.status === 'locked' || u.status === 'inactive'
                  const isProtectedSuperAdmin =
                    u.email === 'admin@smartbus.ictu.vn' || u.email === 'narukun2812@gmail.com'

                  const userCode = u.studentId
                    ? `SV-${u.studentId}`
                    : `USR-${u.id.slice(0, 6).toUpperCase()}`

                  const roleInfo = ROLE_DETAILS[roleName as keyof typeof ROLE_DETAILS] || ROLE_DETAILS.passenger
                  const RoleIcon = roleInfo.icon

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${
                        isTest ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
                      } ${isUserLocked ? 'opacity-70 bg-red-50/20 dark:bg-red-950/10' : ''}`}
                    >
                      <td className="p-4 pl-6 font-mono text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {userCode}
                      </td>
                      <td className="p-4 min-w-[220px] whitespace-nowrap">
                        <p className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <RoleIcon size={15} className="shrink-0 text-slate-600 dark:text-slate-300" />
                          <span className="truncate max-w-[260px]">{u.fullName}</span>
                        </p>
                        {u.faculty && (
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {u.faculty}
                          </span>
                        )}
                      </td>
                      <td className="p-4 min-w-[240px] text-xs text-slate-500 whitespace-nowrap">
                        <p className="flex items-center gap-1.5 font-medium">
                          <Mail size={13} className="text-slate-400 shrink-0" />
                          <span>{u.email}</span>
                        </p>
                        {u.phoneNumber && (
                          <p className="flex items-center gap-1.5 mt-1 font-mono text-slate-600 dark:text-slate-400">
                            <Phone size={13} className="text-slate-400 shrink-0" />
                            <span>{u.phoneNumber}</span>
                          </p>
                        )}
                      </td>
                      <td className="p-4 w-44 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenRoleAssign(u)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all hover:scale-105 cursor-pointer border ${roleInfo.badgeClass}`}
                          title="Bấm để mở popup phân quyền vai trò"
                        >
                          <RoleIcon size={13} className="shrink-0" />
                          <span>{roleInfo.label}</span>
                        </button>
                      </td>
                      <td className="p-4 w-36 whitespace-nowrap">
                        {isUserLocked ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-bold text-[11px] border border-red-200/50 dark:border-red-800/40">
                            <Lock size={12} className="shrink-0 text-red-500" />
                            <span>Đã khóa</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] border border-emerald-200/50 dark:border-emerald-800/40">
                            <span className="size-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                            <span>Hoạt động</span>
                          </span>
                        )}
                      </td>
                      <td className="p-4 w-28 text-xs text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '---'}
                      </td>
                      <td className="p-4 pr-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {/* Nút Xem hoạt động tài xế & Thẩm định GPLX */}
                          {roleName === 'driver' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenDriverActivity(u)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition-all cursor-pointer shadow-xs"
                                title="Xem ca chạy & lịch sử soát vé của tài xế"
                              >
                                <Activity size={13} />
                                <span className="hidden sm:inline">Ca chạy</span>
                              </button>

                              {onNavigate && (
                                <button
                                  type="button"
                                  onClick={() => onNavigate('driver-licenses')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-300 text-xs font-bold transition-all cursor-pointer shadow-xs"
                                  title="Khám & Thẩm định hồ sơ bằng lái GPLX tài xế"
                                >
                                  <IdCard size={13} />
                                  <span className="hidden sm:inline">Duyệt GPLX</span>
                                </button>
                              )}
                            </>
                          )}

                          {/* Nút Phân quyền */}
                          <button
                            type="button"
                            onClick={() => handleOpenRoleAssign(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all cursor-pointer shadow-xs"
                            title="Gán vai trò / Phân quyền RBAC"
                          >
                            <Shield size={13} />
                            <span>Gán quyền</span>
                          </button>

                          {/* Nút Sửa thông tin */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 text-xs font-bold transition-all cursor-pointer shadow-xs"
                            title="Sửa thông tin tài khoản"
                          >
                            <Edit3 size={13} />
                            <span>Sửa</span>
                          </button>

                          {/* Nút Khóa / Mở khóa tài khoản */}
                          {!isProtectedSuperAdmin && (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleToggleStatus(u)}
                              className={`p-1.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
                                isUserLocked
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-600 hover:bg-emerald-100'
                                  : 'bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100'
                              }`}
                              title={isUserLocked ? 'Mở khóa tài khoản này' : 'Tạm khóa tài khoản này'}
                            >
                              {isUserLocked ? <Unlock size={15} /> : <Lock size={15} />}
                            </button>
                          )}

                          {/* Nút Xóa tài khoản */}
                          {!isProtectedSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeletingUser(u)}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
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

      {/* 1. Modal Thêm mới tài khoản (Tất cả 5 Roles) */}
      {isCreateAccountOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center font-bold">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Tạo Tài Khoản & Phân Quyền Mới
                  </h3>
                  <p className="text-xs text-slate-500">
                    Hỗ trợ tạo tài khoản cho 5 nhóm vai trò trong hệ thống Smart Bus ICTU
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateAccountOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAccountSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-sidebar-scroll">
              {/* Chọn vai trò */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Vai trò / Phân quyền ban đầu <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['admin', 'manager', 'driver', 'conductor', 'passenger'] as const).map((r) => {
                    const info = ROLE_DETAILS[r]
                    const Icon = info.icon
                    const isSelected = createRole === r
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleRoleTypeChange(r)}
                        className={`flex items-center gap-2 p-2.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 shadow-xs scale-[1.02]'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <Icon size={16} />
                        <span className="truncate">{info.label}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {ROLE_DETAILS[createRole].desc}
                </p>
              </div>

              {/* Họ tên */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={newFullName}
                  onChange={(e) => handleCreateNameChange(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-800 dark:text-white focus:border-emerald-500 focus:outline-none shadow-xs"
                />
              </div>

              {/* Email & Mật khẩu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email tài khoản <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@smartbus.ictu.vn"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-mono text-slate-800 dark:text-white focus:border-emerald-500 focus:outline-none shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mật khẩu khởi tạo <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-3 pr-10 text-xs font-mono text-slate-800 dark:text-white focus:border-emerald-500 focus:outline-none shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* SĐT & CCCD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    placeholder="0912345678"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-mono text-slate-800 dark:text-white focus:border-emerald-500 focus:outline-none shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số CMND / CCCD
                  </label>
                  <input
                    type="text"
                    placeholder="012345678901"
                    value={newIdCard}
                    onChange={(e) => setNewIdCard(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-mono text-slate-800 dark:text-white focus:border-emerald-500 focus:outline-none shadow-xs"
                  />
                </div>
              </div>

              {/* Thông tin mở rộng tùy vai trò */}
              {createRole === 'passenger' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Mã SV ICTU (nếu là sinh viên)
                    </label>
                    <input
                      type="text"
                      placeholder="DTC2151800001"
                      value={newStudentId}
                      onChange={(e) => setNewStudentId(e.target.value.toUpperCase())}
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-mono font-bold text-slate-800 dark:text-white focus:border-emerald-500 focus:outline-none shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Khoa / Viện đào tạo
                    </label>
                    <input
                      type="text"
                      placeholder="Khoa Công nghệ thông tin"
                      value={newFaculty}
                      onChange={(e) => setNewFaculty(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-white focus:border-emerald-500 focus:outline-none shadow-xs"
                    />
                  </div>
                </div>
              )}

              {createRole === 'driver' && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Hạng giấy phép lái xe (GPLX)
                  </label>
                  <select
                    value={newDriverLicense}
                    onChange={(e) => setNewDriverLicense(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none cursor-pointer shadow-xs"
                  >
                    <option value="Hạng D (Xe buýt 29-45 chỗ)">Hạng D (Xe buýt 29-45 chỗ)</option>
                    <option value="Hạng E (Xe buýt lớn trên 45 chỗ / Liên tỉnh)">Hạng E (Xe buýt lớn trên 45 chỗ / Liên tỉnh)</option>
                    <option value="Hạng FC / FD (Xe khách chất lượng cao)">Hạng FC / FD (Xe khách chất lượng cao)</option>
                  </select>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateAccountOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check size={15} />
                  <span>{isSubmittingCreate ? 'Đang tạo tài khoản...' : 'Tạo Tài Khoản'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal Chỉnh sửa thông tin tài khoản */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Sửa Thông Tin Tài Khoản
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {editingUser.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-sidebar-scroll">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-800 dark:text-white focus:border-emerald-500 focus:outline-none shadow-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-mono text-slate-800 dark:text-white focus:border-emerald-500 focus:outline-none shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số CCCD / CMND
                  </label>
                  <input
                    type="text"
                    value={editIdCard}
                    onChange={(e) => setEditIdCard(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-mono text-slate-800 dark:text-white focus:border-emerald-500 focus:outline-none shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mã SV (nếu có)
                  </label>
                  <input
                    type="text"
                    value={editStudentId}
                    onChange={(e) => setEditStudentId(e.target.value.toUpperCase())}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-mono font-bold text-slate-800 dark:text-white focus:border-emerald-500 focus:outline-none shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Khoa / GPLX / Chức danh
                  </label>
                  <input
                    type="text"
                    value={editFaculty}
                    onChange={(e) => setEditFaculty(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-white focus:border-emerald-500 focus:outline-none shadow-xs"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save size={15} />
                  <span>{isSavingEdit ? 'Đang lưu...' : 'Lưu Cập Nhật'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal Phân quyền / Đổi vai trò (Role Assignment Modal) */}
      {roleAssignUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-purple-600/10 text-purple-600 flex items-center justify-center font-bold">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Gán Quyền & Vai Trò Hệ Thống (RBAC)
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {roleAssignUser.fullName} ({roleAssignUser.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRoleAssignUser(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Chọn vai trò mới cho tài khoản này. Quyền truy cập API và giao diện Portal sẽ được cập nhật tức thì theo chuẩn RBAC:
              </p>

              <div className="space-y-2">
                {(['admin', 'manager', 'driver', 'conductor', 'passenger'] as const).map((r) => {
                  const info = ROLE_DETAILS[r]
                  const Icon = info.icon
                  const isSelected = selectedRoleForAssign === r

                  return (
                    <label
                      key={r}
                      onClick={() => setSelectedRoleForAssign(r)}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="assign_role"
                        checked={isSelected}
                        onChange={() => setSelectedRoleForAssign(r)}
                        className="mt-1 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Icon size={16} className={isSelected ? 'text-emerald-600' : 'text-slate-500'} />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {info.label}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                          {info.desc}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>

              {selectedRoleForAssign === 'admin' && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                  <span>
                    Cảnh báo: Vai trò Super Admin có toàn quyền can thiệp vào cơ sở dữ liệu và cấu hình hệ thống.
                  </span>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setRoleAssignUser(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleRoleAssignSubmit}
                  disabled={isAssigningRole}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck size={15} />
                  <span>{isAssigningRole ? 'Đang cập nhật quyền...' : 'Xác Nhận Phân Quyền'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              Hệ thống sẽ quét và xóa vĩnh viễn toàn bộ các tài khoản kiểm thử tự động (tiền tố integration-test, alias-test, trips-test, test.cloud...). Dữ liệu chính thức sẽ được bảo toàn tuyệt đối.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmCleanOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleCleanupTestData}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Dọn Dẹp Ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal - Xóa tài khoản */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="size-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center mb-4">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Xác nhận xóa tài khoản?
            </h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Bạn có chắc chắn muốn xóa tài khoản <strong>{deletingUser.fullName}</strong> ({deletingUser.email})? Thao tác này sẽ loại bỏ toàn bộ dữ liệu phụ trợ liên quan và không thể hoàn tác.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(deletingUser)}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer / Modal Chi tiết Hoạt động Tài xế */}
      {viewingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-3xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center font-bold">
                  <Bus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Hồ Sơ Hoạt Động Tài Xế: {viewingDriver.fullName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {viewingDriver.email} · {viewingDriver.phoneNumber || 'Chưa cập nhật SĐT'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewingDriver(null)
                      onNavigate('driver-licenses')
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                    title="Mở module Thẩm định GPLX"
                  >
                    <IdCard size={14} />
                    <span>Thẩm Định GPLX</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingDriver(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-sidebar-scroll">
              {isLoadingActivity ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <RefreshCw size={24} className="animate-spin text-emerald-600 mx-auto mb-2" />
                  Đang tải nhật ký ca chạy và soát vé...
                </div>
              ) : driverActivity ? (
                <>
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Tổng ca chạy</span>
                      <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                        {driverActivity.stats.totalTrips}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                      <span className="text-[11px] font-bold text-emerald-600 uppercase">Đã hoàn thành</span>
                      <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                        {driverActivity.stats.completedTrips}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                      <span className="text-[11px] font-bold text-blue-600 uppercase">Đang chạy</span>
                      <p className="text-xl font-black text-blue-700 dark:text-blue-400 mt-1">
                        {driverActivity.stats.inProgressTrips}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
                      <span className="text-[11px] font-bold text-purple-600 uppercase">Vé đã soát</span>
                      <p className="text-xl font-black text-purple-700 dark:text-purple-400 mt-1">
                        {driverActivity.stats.totalTicketsCheckedIn}
                      </p>
                    </div>
                  </div>

                  {/* Tabs: Trips vs Check-ins */}
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <button
                      type="button"
                      onClick={() => setActivityTab('trips')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activityTab === 'trips'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Lịch sử ca chạy gần nhất ({driverActivity.trips.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivityTab('checkins')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activityTab === 'checkins'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Lịch sử soát vé QR ({driverActivity.recentCheckIns.length})
                    </button>
                  </div>

                  {/* Tab 1: Trips Table */}
                  {activityTab === 'trips' && (
                    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-400 uppercase text-[10px]">
                          <tr>
                            <th className="p-3 pl-4">Giờ chạy</th>
                            <th className="p-3">Tuyến</th>
                            <th className="p-3">Biển số xe</th>
                            <th className="p-3 pr-4 text-right">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {driverActivity.trips.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-slate-400">
                                Chưa có ca chạy nào được phân công
                              </td>
                            </tr>
                          ) : (
                            driverActivity.trips.map((t) => (
                              <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                <td className="p-3 pl-4 font-mono">
                                  {new Date(t.departureTime).toLocaleDateString('vi-VN')}{' '}
                                  {new Date(t.departureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="p-3 font-semibold text-slate-900 dark:text-white">
                                  {t.routeName}
                                </td>
                                <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                                  {t.vehiclePlate}
                                </td>
                                <td className="p-3 pr-4 text-right">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    {t.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Tab 2: Check-ins Table */}
                  {activityTab === 'checkins' && (
                    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-400 uppercase text-[10px]">
                          <tr>
                            <th className="p-3 pl-4">Thời gian</th>
                            <th className="p-3">Mã vé</th>
                            <th className="p-3">Hành khách</th>
                            <th className="p-3 pr-4 text-right">Ghế / Tuyến</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {driverActivity.recentCheckIns.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-slate-400">
                                Chưa có lượt quét vé nào được ghi nhận
                              </td>
                            </tr>
                          ) : (
                            driverActivity.recentCheckIns.map((c, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                <td className="p-3 pl-4 font-mono text-slate-500">
                                  {new Date(c.checkedInAt).toLocaleTimeString('vi-VN')}
                                </td>
                                <td className="p-3 font-mono font-bold text-emerald-600">
                                  {c.ticketCode}
                                </td>
                                <td className="p-3 font-semibold text-slate-900 dark:text-white">
                                  {c.passengerName}
                                </td>
                                <td className="p-3 pr-4 text-right">
                                  Ghế {c.seatNumber} · {c.routeName}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  Không tìm thấy dữ liệu hoạt động của tài xế này
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
