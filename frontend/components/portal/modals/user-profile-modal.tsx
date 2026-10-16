'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  User,
  Lock,
  Mail,
  Phone,
  IdCard,
  GraduationCap,
  Building,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  Save,
  KeyRound,
  ShieldCheck,
  Award,
  Bus,
  Calendar,
  Camera,
  Check,
  AlertTriangle,
  BadgeCheck,
  Sparkles,
  Shield,
  FileCheck,
  ExternalLink,
  Clock,
  Upload,
  UploadCloud,
  Trash2,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { authService, type AuthUser } from '@/lib/services/auth.service'
import { driverProfileService } from '@/lib/services/driver-profile.service'
import type { DriverWithProfileItem } from '@/lib/types/driver-profile'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'profile' | 'license' | 'student' | 'authority' | 'password'
}

export function UserProfileModal({ isOpen, onClose, initialTab = 'profile' }: UserProfileModalProps) {
  const { user: authUser, refreshProfile } = useAuth()
  
  // Xác định role người dùng hiện tại
  const currentUser = authService.getUser()
  const rawRole = currentUser?.role || authUser?.role || 'passenger'
  const roleName = (typeof rawRole === 'string' ? rawRole : (rawRole as any)?.name || 'passenger').toLowerCase()
  const isDriverOrConductor = roleName === 'driver' || roleName === 'conductor'
  const isAdminOrDispatcher = roleName === 'admin' || roleName === 'manager' || roleName === 'dispatcher'
  const isStudentOrPassenger = !isDriverOrConductor && !isAdminOrDispatcher

  // Active Tab State
  const [activeTab, setActiveTab] = useState<'profile' | 'specialized' | 'password'>('profile')

  // Profile Form States
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [studentId, setStudentId] = useState('')
  const [faculty, setFaculty] = useState('')
  const [idCardNumber, setIdCardNumber] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Driver License States (cho Tài xế)
  const [licenseData, setLicenseData] = useState<DriverWithProfileItem | null>(null)
  const [licenseNumber, setLicenseNumber] = useState('')
  const [licenseClass, setLicenseClass] = useState('D')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [frontImageUrl, setFrontImageUrl] = useState('')
  const [backImageUrl, setBackImageUrl] = useState('')
  const [isLoadingLicense, setIsLoadingLicense] = useState(false)
  const [isSavingLicense, setIsSavingLicense] = useState(false)
  const [licenseFeedback, setLicenseFeedback] = useState<string | null>(null)
  const [licenseError, setLicenseError] = useState<string | null>(null)

  // Uploading States
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isUploadingFront, setIsUploadingFront] = useState(false)
  const [isUploadingBack, setIsUploadingBack] = useState(false)

  // Upload tệp ảnh lên máy chủ kèm Base64 fallback
  const uploadImageFile = async (file: File): Promise<string> => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Vui lòng chọn tệp định dạng hình ảnh (JPG, PNG, WEBP)')
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Dung lượng tệp ảnh không được vượt quá 5MB')
    }

    try {
      const formData = new FormData()
      formData.append('file', file)

      const token = authService.getToken()
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001/api/v1'
      const res = await fetch(`${baseUrl}/upload/student-card`, {
        method: 'POST',
        headers,
        body: formData,
      })

      const resJson = await res.json().catch(() => null)
      if (res.ok && resJson?.url) {
        const url: string = resJson.url
        return url.startsWith('http')
          ? url
          : `${baseUrl.replace(/\/api\/v1$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
      }
    } catch (err) {
      console.warn('Lỗi kết nối upload máy chủ, chuyển sang Base64:', err)
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh từ thiết bị'))
      reader.readAsDataURL(file)
    })
  }

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingAvatar(true)
    setProfileError(null)
    try {
      const url = await uploadImageFile(file)
      setAvatarUrl(url)
    } catch (err: any) {
      setProfileError(err?.message || 'Không thể tải ảnh đại diện lên')
    } finally {
      setIsUploadingAvatar(false)
      e.target.value = ''
    }
  }

  const handleFrontImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingFront(true)
    setLicenseError(null)
    try {
      const url = await uploadImageFile(file)
      setFrontImageUrl(url)
    } catch (err: any) {
      setLicenseError(err?.message || 'Không thể tải ảnh mặt trước GPLX')
    } finally {
      setIsUploadingFront(false)
      e.target.value = ''
    }
  }

  const handleBackImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingBack(true)
    setLicenseError(null)
    try {
      const url = await uploadImageFile(file)
      setBackImageUrl(url)
    } catch (err: any) {
      setLicenseError(err?.message || 'Không thể tải ảnh mặt sau GPLX')
    } finally {
      setIsUploadingBack(false)
      e.target.value = ''
    }
  }

  // Password Form States
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Tính toán độ mạnh mật khẩu mới
  const passwordStrength = useMemo(() => {
    if (!newPassword) return 0
    let score = 0
    if (newPassword.length >= 6) score += 1
    if (newPassword.length >= 8) score += 1
    if (/[A-Z]/.test(newPassword)) score += 1
    if (/[0-9]/.test(newPassword)) score += 1
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1
    return score
  }, [newPassword])

  // Lấy chữ cái đại diện tên người dùng
  const userInitials = useMemo(() => {
    const name = fullName || currentUser?.fullName || (currentUser as any)?.name || 'U'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }, [fullName, currentUser])

  // Tải dữ liệu khi mở Modal
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab === 'password' ? 'password' : 'profile')
      setProfileFeedback(null)
      setProfileError(null)
      setPasswordFeedback(null)
      setPasswordError(null)
      setLicenseFeedback(null)
      setLicenseError(null)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')

      const u = authService.getUser() || authUser
      if (u) {
        setFullName(u.fullName || (u as any).name || '')
        setPhoneNumber(u.phoneNumber || '')
        setAvatarUrl(u.avatarUrl || '')
        setStudentId(u.studentId || '')
        setFaculty(u.faculty || '')
        setIdCardNumber(u.idCardNumber || '')
      }

      // Nếu là tài xế, gọi API lấy hồ sơ bằng lái thực tế
      if (isDriverOrConductor) {
        loadDriverLicenseProfile()
      }
    }
  }, [isOpen, initialTab, isDriverOrConductor])

  const loadDriverLicenseProfile = async () => {
    setIsLoadingLicense(true)
    try {
      const res = await driverProfileService.getMyDriverProfile()
      if (res.success && res.data) {
        setLicenseData(res.data)
        const p = res.data.profile
        if (p) {
          setLicenseNumber(p.licenseNumber || '')
          setLicenseClass(p.licenseClass || 'D')
          setIssueDate(p.issueDate ? p.issueDate.split('T')[0] : '')
          setExpiryDate(p.expiryDate ? p.expiryDate.split('T')[0] : '')
          setFrontImageUrl(p.frontImageUrl || '')
          setBackImageUrl(p.backImageUrl || '')
        }
      }
    } catch (err) {
      console.warn('Không thể tải trước hồ sơ bằng lái:', err)
    } finally {
      setIsLoadingLicense(false)
    }
  }

  if (!isOpen) return null

  // Cấu hình nhãn & màu sắc phân quyền
  const getRoleBadgeConfig = () => {
    switch (roleName) {
      case 'admin':
        return {
          title: 'Super Admin - Ban Quản Trị',
          sub: 'Toàn quyền kiểm soát hệ thống điều hành',
          badgeBg: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40',
          indicatorBg: 'bg-indigo-500',
          icon: <Shield className="size-3.5" />,
        }
      case 'manager':
      case 'dispatcher':
        return {
          title: 'Điều Hành Viên Tuyến Buýt',
          sub: 'Trung tâm điều độ & giám sát vận tải',
          badgeBg: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
          indicatorBg: 'bg-amber-500',
          icon: <Bus className="size-3.5" />,
        }
      case 'driver':
        return {
          title: 'Tài Xế Vận Hành Tuyến Buýt',
          sub: 'Đội xe buýt ICTU Smart Transit',
          badgeBg: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
          indicatorBg: 'bg-emerald-400',
          icon: <Award className="size-3.5" />,
        }
      case 'conductor':
        return {
          title: 'Kiểm Soát Viên / Phụ Xe',
          sub: 'Đội hỗ trợ & kiểm soát vé buýt',
          badgeBg: 'bg-teal-500/20 text-teal-200 border-teal-400/40',
          indicatorBg: 'bg-teal-400',
          icon: <BadgeCheck className="size-3.5" />,
        }
      default:
        return {
          title: 'Hành Khách Sinh Viên ICTU',
          sub: 'Tài khoản dịch vụ vận tải công cộng',
          badgeBg: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40',
          indicatorBg: 'bg-cyan-400',
          icon: <GraduationCap className="size-3.5" />,
        }
    }
  }

  const roleConfig = getRoleBadgeConfig()

  // Cập nhật thông tin cá nhân cơ bản
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileFeedback(null)
    setProfileError(null)

    if (!fullName.trim()) {
      setProfileError('Vui lòng nhập họ và tên của bạn')
      return
    }

    setIsSavingProfile(true)
    try {
      const res = await authService.updateProfile({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        studentId: isStudentOrPassenger ? (studentId.trim() || undefined) : undefined,
        faculty: isStudentOrPassenger ? (faculty.trim() || undefined) : undefined,
        idCardNumber: idCardNumber.trim() || undefined,
      })

      if (res.success) {
        setProfileFeedback(res.message || 'Cập nhật thông tin hồ sơ định danh thành công!')
        if (typeof refreshProfile === 'function') {
          await refreshProfile()
        }
      } else {
        setProfileError(res.message || 'Không thể cập nhật hồ sơ, vui lòng thử lại')
      }
    } catch (err: any) {
      setProfileError(err?.message || 'Lỗi hệ thống khi cập nhật hồ sơ')
    } finally {
      setIsSavingProfile(false)
    }
  }

  // Tài xế tự nộp/cập nhật hồ sơ bằng lái xe
  const handleUpdateLicense = async (e: React.FormEvent) => {
    e.preventDefault()
    setLicenseFeedback(null)
    setLicenseError(null)

    if (!licenseNumber.trim()) {
      setLicenseError('Vui lòng nhập số Giấy phép lái xe (GPLX)')
      return
    }

    setIsSavingLicense(true)
    try {
      const res = await driverProfileService.updateMyDriverProfile({
        licenseNumber: licenseNumber.trim(),
        licenseClass: licenseClass.trim(),
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || undefined,
        frontImageUrl: frontImageUrl.trim() || undefined,
        backImageUrl: backImageUrl.trim() || undefined,
      })

      if (res.success) {
        setLicenseFeedback('Hồ sơ Giấy phép lái xe đã được cập nhật và gửi về Trung tâm điều hành thẩm định thành công!')
        await loadDriverLicenseProfile()
      } else {
        setLicenseError(res.message || 'Không thể cập nhật hồ sơ bằng lái, vui lòng thử lại')
      }
    } catch (err: any) {
      setLicenseError(err?.message || 'Lỗi hệ thống khi cập nhật hồ sơ bằng lái')
    } finally {
      setIsSavingLicense(false)
    }
  }

  // Đổi mật khẩu tài khoản
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordFeedback(null)
    setPasswordError(null)

    if (!oldPassword) {
      setPasswordError('Vui lòng nhập mật khẩu hiện tại')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có tối thiểu 6 ký tự')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không trùng khớp với mật khẩu mới')
      return
    }
    if (oldPassword === newPassword) {
      setPasswordError('Mật khẩu mới không được trùng với mật khẩu cũ')
      return
    }

    setIsChangingPassword(true)
    try {
      const res = await authService.changePassword({
        oldPassword,
        newPassword,
      })

      if (res.success) {
        setPasswordFeedback('Đổi mật khẩu tài khoản thành công! Mật khẩu mới đã được lưu trữ an toàn.')
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setPasswordError(res.message || 'Không thể đổi mật khẩu, vui lòng kiểm tra lại')
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'Lỗi hệ thống khi đổi mật khẩu')
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-all">
        
        {/* ================= HERO PROFILE HEADER ================= */}
        <div className="relative bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-950 p-6 pb-5 text-white overflow-hidden shrink-0">
          {/* Background Decorative Mesh & Bus Icon */}
          <div className="absolute right-[-20px] bottom-[-20px] opacity-10 pointer-events-none select-none text-white">
            <Bus size={180} />
          </div>
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Row: System Title & Close Button */}
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/10 backdrop-blur-md border border-white/20 text-emerald-200">
                <Sparkles size={13} className="text-emerald-300" />
                Hệ Thống Vé Xe Buýt Thông Minh ICTU
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-all cursor-pointer backdrop-blur-md border border-white/10"
              title="Đóng cửa sổ"
            >
              <X size={18} />
            </button>
          </div>

          {/* User Hero Identity Card */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 relative z-10">
            {/* Avatar with Glow and Online Indicator */}
            <div className="relative group shrink-0">
              <div className="size-20 sm:size-22 rounded-2xl ring-4 ring-white/20 dark:ring-emerald-500/30 shadow-2xl overflow-hidden bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-2xl font-black">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName}
                    className="size-full object-cover"
                    onError={(e) => {
                      // Fallback nếu ảnh lỗi
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <span>{userInitials}</span>
                )}
              </div>
              {/* Online Pulse Indicator */}
              <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-md flex items-center justify-center">
                <div className="size-2 rounded-full bg-white animate-ping opacity-75" />
              </div>
            </div>

            {/* Profile Info Details */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white truncate">
                  {fullName || currentUser?.fullName || 'Người Dùng Hệ Thống'}
                </h1>
                <BadgeCheck size={20} className="text-emerald-400 shrink-0" />
              </div>

              {/* Role Badge */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold border shadow-xs ${roleConfig.badgeBg}`}
                >
                  {roleConfig.icon}
                  {roleConfig.title}
                </span>

                {isDriverOrConductor && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-emerald-200 border border-white/20">
                    <Award size={12} />
                    GPLX: Hạng {licenseClass || 'D'}
                  </span>
                )}
              </div>

              {/* Email & ID Details */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4 text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Mail size={13} className="text-emerald-400 shrink-0" />
                  <span className="font-mono text-slate-200 truncate max-w-[200px] sm:max-w-[280px]">
                    {currentUser?.email || authUser?.email || 'N/A'}
                  </span>
                </span>
                <span className="hidden sm:inline text-slate-500">•</span>
                <span className="flex items-center gap-1.5">
                  <Clock size={13} className="text-emerald-400 shrink-0" />
                  <span>Tài khoản hoạt động chính thức</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= TAB NAVIGATION ================= */}
        <div className="px-6 pt-3 pb-1 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-800/80 max-w-md">
            {/* Tab 1: Định danh cá nhân */}
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User size={14} />
              <span>Định danh</span>
            </button>

            {/* Tab 2: Chuyên môn theo Role */}
            <button
              type="button"
              onClick={() => setActiveTab('specialized')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'specialized'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isDriverOrConductor ? (
                <>
                  <Award size={14} />
                  <span>Bằng lái & Nghiệp vụ</span>
                </>
              ) : isStudentOrPassenger ? (
                <>
                  <GraduationCap size={14} />
                  <span>Thẻ sinh viên</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  <span>Thẩm quyền</span>
                </>
              )}
            </button>

            {/* Tab 3: Bảo mật & Mật khẩu */}
            <button
              type="button"
              onClick={() => setActiveTab('password')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'password'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <KeyRound size={14} />
              <span>Bảo mật</span>
            </button>
          </div>
        </div>

        {/* ================= MODAL BODY ================= */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-sidebar-scroll bg-white dark:bg-slate-900">
          
          {/* ==================== TAB 1: THÔNG TIN ĐỊNH DANH CÁ NHÂN ==================== */}
          {activeTab === 'profile' && (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {profileFeedback && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-3 animate-in fade-in">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  <span>{profileFeedback}</span>
                </div>
              )}

              {profileError && (
                <div className="rounded-2xl border border-red-500/30 bg-red-50 dark:bg-red-950/40 p-4 text-xs font-semibold text-red-900 dark:text-red-200 flex items-center gap-3 animate-in fade-in">
                  <AlertCircle size={18} className="text-red-500 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              {/* Thông báo định danh điện tử */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-start gap-3">
                <ShieldCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    Định danh tài khoản xác thực
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Hồ sơ được liên kết với số Căn cước công dân và Số điện thoại nhằm đảm bảo an toàn vận hành và tính xác thực trên toàn hệ thống Smart Transit.
                  </p>
                </div>
              </div>

              {/* Họ và tên & Số điện thoại */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Họ và tên đầy đủ <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nguyễn Văn Hùng"
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-3 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Số điện thoại liên lạc
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="0912345678"
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-3 text-xs font-mono font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Số CCCD / CMND & Ảnh đại diện */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Số Căn cước công dân (CCCD 12 số)
                  </label>
                  <div className="relative">
                    <IdCard size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      maxLength={12}
                      value={idCardNumber}
                      onChange={(e) => setIdCardNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="019200001234"
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-3 text-xs font-mono font-bold tracking-wider text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Ảnh đại diện tài khoản
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative group shrink-0">
                      <div className="size-16 rounded-2xl ring-2 ring-emerald-500/40 shadow-sm overflow-hidden bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-lg font-black">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={fullName}
                            className="size-full object-cover"
                          />
                        ) : (
                          <span>{userInitials}</span>
                        )}
                      </div>
                      {isUploadingAvatar && (
                        <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center text-white">
                          <Loader2 size={20} className="animate-spin text-emerald-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-1.5 text-center sm:text-left">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer transition-all active:scale-95">
                          <Upload size={13} />
                          <span>{isUploadingAvatar ? 'Đang tải...' : 'Tải ảnh từ thiết bị'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isUploadingAvatar}
                            onChange={handleAvatarFileChange}
                            className="hidden"
                          />
                        </label>

                        {avatarUrl && (
                          <button
                            type="button"
                            onClick={() => setAvatarUrl('')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold cursor-pointer transition-all"
                          >
                            <Trash2 size={13} />
                            <span>Gỡ ảnh</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Hỗ trợ PNG, JPG, WEBP tối đa 5MB.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* NẾU LÀ SINH VIÊN / HÀNH KHÁCH -> HIỂN THỊ MÃ SV VÀ KHOA */}
              {isStudentOrPassenger && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                  <div>
                    <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-300 mb-1.5">
                      Mã sinh viên ICTU
                    </label>
                    <div className="relative">
                      <GraduationCap size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600" />
                      <input
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                        placeholder="DTC2151800001"
                        className="h-11 w-full rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 pl-10 pr-3 text-xs font-mono font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-300 mb-1.5">
                      Khoa / Viện / Chuyên ngành
                    </label>
                    <div className="relative">
                      <Building size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600" />
                      <input
                        type="text"
                        value={faculty}
                        onChange={(e) => setFaculty(e.target.value)}
                        placeholder="Khoa Công nghệ thông tin"
                        className="h-11 w-full rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 pl-10 pr-3 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Nút lưu hồ sơ */}
              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save size={15} />
                  <span>{isSavingProfile ? 'Đang lưu hồ sơ...' : 'Lưu Thay Đổi'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ==================== TAB 2: CHUYÊN MÔN THEO ROLE ==================== */}
          {activeTab === 'specialized' && (
            <div className="space-y-5">
              
              {/* TRƯỜNG HỢP 1: TÀI XẾ / PHỤ XE (GPLX & NGHIỆP VỤ LÁI XE) */}
              {isDriverOrConductor && (
                <div className="space-y-5">
                  {licenseFeedback && (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-3 animate-in fade-in">
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                      <span>{licenseFeedback}</span>
                    </div>
                  )}

                  {licenseError && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-50 dark:bg-red-950/40 p-4 text-xs font-semibold text-red-900 dark:text-red-200 flex items-center gap-3 animate-in fade-in">
                      <AlertCircle size={18} className="text-red-500 shrink-0" />
                      <span>{licenseError}</span>
                    </div>
                  )}

                  {/* THẺ MÔ PHỎNG GIẤY PHÉP LÁI XE PET (DIGITAL SMART CARD) */}
                  <div className="relative rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-amber-500/10 via-emerald-600/15 to-slate-900/10 dark:from-amber-950/30 dark:via-emerald-950/30 dark:to-slate-950 border-2 border-emerald-500/30 shadow-lg overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mt-0.5">
                          <Award className="text-amber-500 size-4" />
                          Giấy Phép Lái Xe Điện Tử / Driver's License
                        </h3>
                      </div>

                      {/* Trạng thái Thẩm định */}
                      <div>
                        {licenseData?.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-xs">
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            ĐÃ THẨM ĐỊNH & ĐỦ ĐIỀU KIỆN LÁI
                          </span>
                        ) : licenseData?.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-700 shadow-xs">
                            <AlertTriangle size={14} className="text-red-600" />
                            HỒ SƠ BỊ TỪ CHỐI / CẦN SỬA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-xs">
                            <Clock size={14} className="text-amber-600" />
                            CHỜ BAN ĐIỀU HÀNH THẨM ĐỊNH
                          </span>
                        )}
                      </div>
                    </div>

                    {/* License Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                          Số GPLX Quốc gia
                        </span>
                        <span className="font-mono font-black text-slate-900 dark:text-white text-sm mt-0.5 block">
                          {licenseNumber || 'Chưa cập nhật'}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                          Hạng Giấy Phép
                        </span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm mt-0.5 block">
                          HẠNG {licenseClass || 'D'} (Buýt &gt;30 chỗ)
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                          Ngày Cấp Bằng
                        </span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                          {issueDate || 'Chưa ghi nhận'}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                          Thời Hạn Sử Dụng
                        </span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                          {expiryDate || 'Không thời hạn'}
                        </span>
                      </div>
                    </div>

                    {/* Rejection Note nếu có */}
                    {licenseData?.profile?.rejectionReason && (
                      <div className="mt-4 p-3.5 rounded-2xl bg-red-100/80 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-200">
                        <span className="font-black">Lý do từ chối từ Ban Quản lý Tuyến: </span>
                        <span>{licenseData.profile.rejectionReason}</span>
                      </div>
                    )}
                  </div>

                  {/* FORM CẬP NHẬT HỒ SƠ BẰNG LÁI TÀI XẾ */}
                  <form onSubmit={handleUpdateLicense} className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <FileCheck size={16} className="text-emerald-600" />
                        Cập nhật / Nộp bổ sung hồ sơ bằng lái xe
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        Áp dụng cho xe buýt chở khách công cộng
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Số Giấy phép lái xe (GPLX) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={licenseNumber}
                          onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
                          placeholder="VD: 200189998823"
                          className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 text-xs font-mono font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Hạng giấy phép lái xe <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={licenseClass}
                          onChange={(e) => setLicenseClass(e.target.value)}
                          className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs cursor-pointer"
                        >
                          <option value="D">Hạng D (Ô tô chở người từ 10 đến 30 chỗ)</option>
                          <option value="E">Hạng E (Ô tô chở người trên 30 chỗ ngồi)</option>
                          <option value="FD">Hạng FD (Đầu kéo / Rơ moóc chở khách)</option>
                          <option value="FE">Hạng FE (Xe khách kéo rơ moóc)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Ngày cấp giấy phép
                        </label>
                        <div className="relative">
                          <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="date"
                            value={issueDate}
                            onChange={(e) => setIssueDate(e.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-3 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Hạn sử dụng giấy phép
                        </label>
                        <div className="relative">
                          <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="date"
                            value={expiryDate}
                            onChange={(e) => setExpiryDate(e.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-3 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* KHUNG TẢI ẢNH 2 MẶT GPLX TỪ THIẾT BỊ */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Hình ảnh chụp 2 mặt Giấy phép lái xe (GPLX)
                      </label>
                      <p className="text-[11px] text-slate-400">
                        Chụp rõ nét 2 mặt phôi thẻ PET, không bị mất góc hoặc lóa sáng để Hội đồng thẩm định phê duyệt ca chạy.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        {/* MẶT TRƯỚC GPLX */}
                        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 bg-slate-50/50 dark:bg-slate-800/20 p-3.5 transition-all flex flex-col items-center justify-center text-center relative overflow-hidden group min-h-[170px]">
                          {frontImageUrl ? (
                            <div className="relative w-full h-36 rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700 group">
                              <img
                                src={frontImageUrl}
                                alt="Mặt trước GPLX"
                                className="size-full object-cover"
                              />
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-xs text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                Mặt trước GPLX
                              </div>
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-bold cursor-pointer hover:bg-slate-100 shadow-md">
                                  <Upload size={12} />
                                  <span>Đổi ảnh</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    disabled={isUploadingFront}
                                    onChange={handleFrontImageFileChange}
                                    className="hidden"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setFrontImageUrl('')}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 shadow-md cursor-pointer"
                                >
                                  <Trash2 size={12} />
                                  <span>Xóa</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-3 space-y-2">
                              <div className="size-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <UploadCloud size={20} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                  Ảnh mặt trước GPLX
                                </p>
                              </div>
                              <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer transition-all active:scale-95">
                                <Upload size={13} />
                                <span>{isUploadingFront ? 'Đang tải...' : 'Tải ảnh từ máy'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={isUploadingFront}
                                  onChange={handleFrontImageFileChange}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          )}

                          {isUploadingFront && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white z-10">
                              <Loader2 size={22} className="animate-spin text-emerald-400" />
                            </div>
                          )}
                        </div>

                        {/* MẶT SAU GPLX */}
                        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 bg-slate-50/50 dark:bg-slate-800/20 p-3.5 transition-all flex flex-col items-center justify-center text-center relative overflow-hidden group min-h-[170px]">
                          {backImageUrl ? (
                            <div className="relative w-full h-36 rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700 group">
                              <img
                                src={backImageUrl}
                                alt="Mặt sau GPLX"
                                className="size-full object-cover"
                              />
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-xs text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                Mặt sau GPLX
                              </div>
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-bold cursor-pointer hover:bg-slate-100 shadow-md">
                                  <Upload size={12} />
                                  <span>Đổi ảnh</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    disabled={isUploadingBack}
                                    onChange={handleBackImageFileChange}
                                    className="hidden"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setBackImageUrl('')}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 shadow-md cursor-pointer"
                                >
                                  <Trash2 size={12} />
                                  <span>Xóa</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-3 space-y-2">
                              <div className="size-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <UploadCloud size={20} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                  Ảnh mặt sau GPLX
                                </p>
                              </div>
                              <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer transition-all active:scale-95">
                                <Upload size={13} />
                                <span>{isUploadingBack ? 'Đang tải...' : 'Tải ảnh từ máy'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={isUploadingBack}
                                  onChange={handleBackImageFileChange}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          )}

                          {isUploadingBack && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white z-10">
                              <Loader2 size={22} className="animate-spin text-emerald-400" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSavingLicense}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Save size={15} />
                        <span>{isSavingLicense ? 'Đang gửi thẩm định...' : 'Gửi Thẩm Định GPLX'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TRƯỜNG HỢP 2: HÀNH KHÁCH / SINH VIÊN ICTU */}
              {isStudentOrPassenger && (
                <div className="space-y-4">
                  <div className="p-6 rounded-3xl bg-gradient-to-br from-cyan-500/10 via-emerald-500/10 to-teal-500/10 border border-emerald-500/30">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="size-10 rounded-2xl bg-emerald-600/20 text-emerald-600 flex items-center justify-center font-bold">
                        <GraduationCap size={22} />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white">
                          Thẻ Ưu Đãi Sinh Viên ICTU Bus Transit
                        </h3>
                        <p className="text-xs text-slate-500">
                          Áp dụng chính sách trợ giá 50% toàn bộ các tuyến xe buýt liên kết nhà trường
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
                      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-500 block">Mã số sinh viên</span>
                        <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                          {studentId || 'Chưa liên kết mã SV'}
                        </span>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-500 block">Khoa / Đơn vị trực thuộc</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white mt-1 block">
                          {faculty || 'Khoa Công nghệ thông tin'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span>Tài khoản của bạn đã được kích hoạt mức giá sinh viên khi quét QR mua vé.</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TRƯỜNG HỢP 3: BAN QUẢN TRỊ / ĐIỀU ĐỘ VIÊN */}
              {isAdminOrDispatcher && (
                <div className="space-y-4">
                  <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-slate-900/10 border border-indigo-500/30">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="size-10 rounded-2xl bg-indigo-600/20 text-indigo-600 flex items-center justify-center font-bold">
                        <ShieldCheck size={22} />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white">
                          Trung Tâm Điều Hành & Ban Quản Trị Hệ Thống
                        </h3>
                        <p className="text-xs text-slate-500">
                          Thẩm quyền điều phối vận tải, giám sát phương tiện và thẩm định hồ sơ tài xế
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
                      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-500 block">Cấp bậc ủy quyền</span>
                        <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                          {roleName.toUpperCase()} - TOÀN QUYỀN VẬN HÀNH
                        </span>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-500 block">Trạng thái bảo mật</span>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 block flex items-center gap-1.5">
                          <CheckCircle2 size={15} />
                          Đã kích hoạt Token Phiên JWT Kép
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB 3: ĐỔI MẬT KHẨU ==================== */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordFeedback && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-3 animate-in fade-in">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  <span>{passwordFeedback}</span>
                </div>
              )}

              {passwordError && (
                <div className="rounded-2xl border border-red-500/30 bg-red-50 dark:bg-red-950/40 p-4 text-xs font-semibold text-red-900 dark:text-red-200 flex items-center gap-3 animate-in fade-in">
                  <AlertCircle size={18} className="text-red-500 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {/* Mật khẩu cũ */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mật khẩu hiện tại <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Nhập mật khẩu đang dùng"
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-10 text-xs font-mono text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Mật khẩu mới */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mật khẩu mới (Tối thiểu 6 ký tự) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới an toàn"
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-10 text-xs font-mono text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {newPassword && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <div
                          key={lvl}
                          className={`h-1.5 flex-1 rounded-full transition-all ${
                            passwordStrength >= lvl
                              ? passwordStrength <= 2
                                ? 'bg-red-500'
                                : passwordStrength <= 3
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                              : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Độ an toàn: {passwordStrength <= 2 ? 'Yếu' : passwordStrength <= 3 ? 'Trung bình' : 'Rất mạnh'}
                    </span>
                  </div>
                )}
              </div>

              {/* Xác nhận mật khẩu mới */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Xác nhận lại mật khẩu mới <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-10 text-xs font-mono text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300">
                <span className="font-bold">Lưu ý bảo mật: </span>
                Mật khẩu mới sẽ có hiệu lực ngay lập tức cho các phiên đăng nhập tại buồng lái xe buýt, ứng dụng quét vé di động và cổng điều phối.
              </div>

              {/* Nút đổi mật khẩu */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <KeyRound size={15} />
                  <span>{isChangingPassword ? 'Đang cập nhật mật khẩu...' : 'Cập Nhật Mật Khẩu'}</span>
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
