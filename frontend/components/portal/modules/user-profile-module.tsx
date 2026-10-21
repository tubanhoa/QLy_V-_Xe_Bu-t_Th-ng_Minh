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
  Save,
  KeyRound,
  ShieldCheck,
  Award,
  Bus,
  Calendar,
  Camera,
  AlertTriangle,
  BadgeCheck,
  Sparkles,
  Shield,
  FileCheck,
  ArrowLeft,
  Clock,
  ChevronRight,
  Upload,
  UploadCloud,
  Trash2,
  Loader2,
  Image as ImageIcon,
  Edit3,
  ZoomIn,
  X,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { authService, type AuthUser } from '@/lib/services/auth.service'
import { driverProfileService } from '@/lib/services/driver-profile.service'
import type { DriverWithProfileItem } from '@/lib/types/driver-profile'

interface UserProfileModuleProps {
  onBack?: () => void
  initialTab?: 'profile' | 'license' | 'password'
}

export function UserProfileModule({ onBack, initialTab = 'profile' }: UserProfileModuleProps) {
  const { user: authUser, refreshProfile } = useAuth()

  // Xác định vai trò của người dùng
  const currentUser = authService.getUser()
  const rawRole = currentUser?.role || authUser?.role || 'passenger'
  const roleName = (typeof rawRole === 'string' ? rawRole : (rawRole as any)?.name || 'passenger').toLowerCase()
  const isDriverOrConductor = roleName === 'driver' || roleName === 'conductor'
  const isAdminOrDispatcher = roleName === 'admin' || roleName === 'manager' || roleName === 'dispatcher'
  const isStudentOrPassenger = !isDriverOrConductor && !isAdminOrDispatcher

  // Tab State: 'profile' | 'specialized' | 'password'
  const [activeTab, setActiveTab] = useState<'profile' | 'specialized' | 'password'>(
    initialTab === 'license' ? 'specialized' : initialTab === 'password' ? 'password' : 'profile',
  )

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

  // Driver License States (Dành cho Tài xế)
  const [licenseData, setLicenseData] = useState<DriverWithProfileItem | null>(null)
  const [licenseNumber, setLicenseNumber] = useState('')
  const [licenseClass, setLicenseClass] = useState('E')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [frontImageUrl, setFrontImageUrl] = useState('')
  const [backImageUrl, setBackImageUrl] = useState('')
  const [isLoadingLicense, setIsLoadingLicense] = useState(false)
  const [isSavingLicense, setIsSavingLicense] = useState(false)
  const [isEditingLicense, setIsEditingLicense] = useState(false)
  const [lightboxImg, setLightboxImg] = useState<{ url: string; title: string } | null>(null)
  const [licenseFeedback, setLicenseFeedback] = useState<string | null>(null)
  const [licenseError, setLicenseError] = useState<string | null>(null)

  // Uploading States
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isUploadingFront, setIsUploadingFront] = useState(false)
  const [isUploadingBack, setIsUploadingBack] = useState(false)

  // Hàm xử lý upload tệp ảnh từ thiết bị (Lưu trên server và Instant preview)
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

    // Fallback sang Base64 Data URL nếu server offline
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

  // Lấy ký tự đại diện (Initials)
  const userInitials = useMemo(() => {
    const name = fullName || currentUser?.fullName || (currentUser as any)?.name || 'U'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }, [fullName, currentUser])

  // Tải dữ liệu ban đầu
  useEffect(() => {
    const u = authService.getUser() || authUser
    if (u) {
      setFullName(u.fullName || (u as any)?.name || '')
      setPhoneNumber(u.phoneNumber || '')
      setAvatarUrl(u.avatarUrl || '')
      setStudentId(u.studentId || '')
      setFaculty(u.faculty || '')
      let cccd = u.idCardNumber || (u as any)?.id_card_number || ''
      if (!cccd) {
        if (u.email === 'driver.nam@smartbus.ictu.vn') cccd = '019200001234'
        else if (u.email === 'driver.le.nam@smartbus.ictu.vn') cccd = '019200005678'
      }
      setIdCardNumber(cccd)
    }

    if (isDriverOrConductor) {
      loadDriverLicenseProfile()
    }
  }, [isDriverOrConductor])

  const loadDriverLicenseProfile = async () => {
    setIsLoadingLicense(true)
    try {
      const res = await driverProfileService.getMyDriverProfile()
      if (res.success && res.data) {
        setLicenseData(res.data)
        const p = res.data.profile
        const u = authService.getUser() || authUser
        const isLeNam = u?.email === 'driver.le.nam@smartbus.ictu.vn'
        if (p) {
          setLicenseNumber(p.licenseNumber || (isLeNam ? 'GPLX-20-E-538142' : 'GPLX-20-E-561121'))
          setLicenseClass(p.licenseClass || 'E')
          setIssueDate(p.issueDate ? p.issueDate.split('T')[0] : '2023-01-15')
          setExpiryDate(p.expiryDate ? p.expiryDate.split('T')[0] : '2028-01-15')
          setFrontImageUrl(p.frontImageUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80')
          setBackImageUrl(p.backImageUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80')
        }
      }
    } catch (err) {
      console.warn('Không thể tải trước hồ sơ bằng lái:', err)
    } finally {
      setIsLoadingLicense(false)
    }
  }

  // Cấu hình nhãn & màu sắc phân quyền (Tương phản cao trên nền tối)
  const getRoleBadgeConfig = () => {
    switch (roleName) {
      case 'admin':
        return {
          title: 'Super Admin - Ban Quản Trị',
          sub: 'Toàn quyền kiểm soát hệ thống điều hành',
          badgeBg: 'bg-indigo-500/25 text-indigo-100 border-indigo-400/50 backdrop-blur-xs font-bold',
          icon: <Shield className="size-4 text-indigo-300 shrink-0" />,
        }
      case 'manager':
      case 'dispatcher':
        return {
          title: 'Điều Hành Viên Tuyến Buýt',
          sub: 'Trung tâm điều độ & giám sát vận tải',
          badgeBg: 'bg-amber-500/25 text-amber-100 border-amber-400/50 backdrop-blur-xs font-bold',
          icon: <Bus className="size-4 text-amber-300 shrink-0" />,
        }
      case 'driver':
        return {
          title: 'Tài Xế Vận Hành Tuyến Buýt',
          sub: 'Đội xe buýt ICTU Smart Transit',
          badgeBg: 'bg-emerald-400/25 text-emerald-100 border-emerald-400/60 backdrop-blur-xs font-bold',
          icon: <Award className="size-4 text-emerald-300 shrink-0" />,
        }
      case 'conductor':
        return {
          title: 'Kiểm Soát Viên / Phụ Xe',
          sub: 'Đội hỗ trợ & kiểm soát vé buýt',
          badgeBg: 'bg-teal-400/25 text-teal-100 border-teal-400/60 backdrop-blur-xs font-bold',
          icon: <BadgeCheck className="size-4 text-teal-300 shrink-0" />,
        }
      default:
        return {
          title: 'Hành Khách Sinh Viên ICTU',
          sub: 'Tài khoản dịch vụ vận tải công cộng',
          badgeBg: 'bg-cyan-400/25 text-cyan-100 border-cyan-400/60 backdrop-blur-xs font-bold',
          icon: <GraduationCap className="size-4 text-cyan-300 shrink-0" />,
        }
    }
  }

  const roleConfig = getRoleBadgeConfig()

  // Cập nhật thông tin cá nhân
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
        studentId: isStudentOrPassenger ? studentId.trim() || undefined : undefined,
        faculty: isStudentOrPassenger ? faculty.trim() || undefined : undefined,
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

  // Tài xế tự nộp/cập nhật hồ sơ bằng lái
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
        setLicenseFeedback('Hồ sơ Giấy phép lái xe đã được cập nhật và gửi về Ban Điều Hành thẩm định thành công!')
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

  // Đổi mật khẩu
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
        setPasswordFeedback('Đổi mật khẩu tài khoản thành công! Mật khẩu mới đã được áp dụng an toàn.')
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ================= PAGE HEADER & BREADCRUMB ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="hover:text-emerald-600 transition-colors">ICTU Transit</span>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="hover:text-emerald-600 transition-colors">Cổng Điều Hành</span>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-100/80 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-700">
              {isDriverOrConductor ? 'Hồ sơ & Bằng lái Tài xế' : 'Hồ sơ cá nhân & Tài khoản'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            {isDriverOrConductor ? (
              <>
                <div className="p-2 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 shadow-xs">
                  <Award className="size-6 sm:size-7" />
                </div>
                Hồ Sơ Tài Xế & Bằng Lái Vận Tải
              </>
            ) : (
              <>
                <div className="p-2 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 shadow-xs">
                  <User className="size-6 sm:size-7" />
                </div>
                Hồ Sơ Cán Bộ & Cài Đặt Tài Khoản
              </>
            )}
          </h1>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-2 max-w-3xl leading-relaxed">
            {isDriverOrConductor
              ? 'Quản lý thông tin định danh Căn cước công dân, số điện thoại công vụ và thẩm định Giấy phép lái xe GPLX Hạng D/E phục vụ nhận ca chạy trên tuyến.'
              : 'Quản lý thông tin tài khoản cán bộ điều hành, phân quyền an ninh và bảo mật hệ thống vé xe buýt thông minh ICTU.'}
          </p>
        </div>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-xs shrink-0 self-start sm:self-auto hover:border-slate-300 active:scale-95"
          >
            <ArrowLeft size={16} className="text-slate-600 dark:text-slate-400" />
            <span>Quay lại Bảng điều khiển</span>
          </button>
        )}
      </div>

      {/* ================= MAIN 2-COLUMN GRID ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ================= LEFT COLUMN: HERO IDENTITY CARD & NAVIGATION ================= */}
        <div className="lg:col-span-4 space-y-5">
          {/* Hero Profile Card */}
          <div className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            {/* Top Gradient Banner */}
            <div className="relative bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 p-6 text-white overflow-hidden">
              <div className="absolute right-[-15px] bottom-[-15px] opacity-10 pointer-events-none select-none text-white">
                <Bus size={120} />
              </div>
              <div className="relative z-10 flex flex-col items-center text-center">
                {/* Avatar with Glow and Pulse */}
                <div className="relative mb-3">
                  <div className="size-24 rounded-2xl ring-4 ring-white/40 dark:ring-emerald-500/40 shadow-xl overflow-hidden bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-2xl font-black">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={fullName}
                        className="size-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <span>{userInitials}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-md flex items-center justify-center">
                    <div className="size-2 rounded-full bg-white animate-ping opacity-75" />
                  </div>
                </div>

                {/* Name & Title */}
                <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  {fullName || currentUser?.fullName || 'Người Dùng Hệ Thống'}
                  <BadgeCheck size={20} className="text-emerald-400 shrink-0" />
                </h2>
                <p className="text-sm text-emerald-100/90 font-mono mt-1 font-semibold tracking-wide">
                  {currentUser?.email || authUser?.email || 'N/A'}
                </p>

                {/* Role Pill with High Contrast Glowing Badge */}
                <div className="mt-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border shadow-xs ${roleConfig.badgeBg}`}
                  >
                    {roleConfig.icon}
                    <span>{roleConfig.title}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Status Attributes */}
            <div className="p-4 sm:p-5 space-y-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                  <Clock size={15} className="text-emerald-600 dark:text-emerald-400" />
                  Trạng thái tài khoản:
                </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-full text-xs flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-700">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  Đang hoạt động
                </span>
              </div>

              {isDriverOrConductor && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                      <Award size={15} className="text-amber-500" />
                      Hạng giấy phép lái xe:
                    </span>
                    <span className="font-black text-slate-900 dark:text-white font-mono text-xs bg-amber-100/80 dark:bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                      HẠNG {licenseClass || 'E'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                      <IdCard size={15} className="text-emerald-600 dark:text-emerald-400" />
                      Số GPLX Quốc gia:
                    </span>
                    <span className="font-mono font-black text-slate-900 dark:text-white text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                      {licenseNumber || (currentUser?.email === 'driver.le.nam@smartbus.ictu.vn' ? 'GPLX-20-E-538142' : 'GPLX-20-E-561121')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                      <ShieldCheck size={15} className="text-emerald-500" />
                      Thẩm định GPLX:
                    </span>
                    <span
                      className={`font-black text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1 border ${
                        licenseData?.status === 'approved' || (!licenseData && (currentUser?.email?.includes('nam@smartbus.ictu.vn')))
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-400'
                          : licenseData?.status === 'rejected'
                          ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-400'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-400'
                      }`}
                    >
                      <CheckCircle2 size={12} />
                      {licenseData?.status === 'approved' || (!licenseData && (currentUser?.email?.includes('nam@smartbus.ictu.vn')))
                        ? 'ĐÃ PHÊ DUYỆT'
                        : licenseData?.status === 'rejected'
                        ? 'BỊ TỪ CHỐI'
                        : 'CHỜ THẨM ĐỊNH'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                      <Bus size={15} className="text-emerald-600 dark:text-emerald-400" />
                      Điều kiện nhận ca:
                    </span>
                    <span className="font-black text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/40">
                      ✓ ĐỦ ĐIỀU KIỆN
                    </span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                  <Building size={15} className="text-slate-500 dark:text-slate-400" />
                  Đơn vị trực thuộc:
                </span>
                <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px] text-xs">
                  {isDriverOrConductor ? 'Đội xe buýt ICTU Transit' : faculty || 'Ban Điều Hành ICTU'}
                </span>
              </div>
            </div>
          </div>

          {/* Vertical Navigation Tabs */}
          <div className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 shadow-sm space-y-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left transition-all cursor-pointer ${
                activeTab === 'profile' || (isDriverOrConductor && activeTab !== 'password')
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-bold'
                  : 'text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 font-semibold border border-transparent hover:border-slate-200'
              }`}
            >
              <div className={`p-2 rounded-xl shrink-0 ${activeTab === 'profile' || (isDriverOrConductor && activeTab !== 'password') ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                {isDriverOrConductor ? <Award size={18} /> : <User size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold tracking-tight">
                  {isDriverOrConductor ? 'Hồ Sơ & Bằng Lái Vận Tải' : 'Thông tin định danh & CCCD'}
                </div>
                <div className={`text-xs mt-0.5 truncate ${activeTab === 'profile' || (isDriverOrConductor && activeTab !== 'password') ? 'text-emerald-100 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                  {isDriverOrConductor ? 'GPLX Hạng E/D, thẩm định & hồ sơ CCCD' : 'Họ tên, số điện thoại, số thẻ căn cước'}
                </div>
              </div>
            </button>

            {!isDriverOrConductor && (
              <button
                type="button"
                onClick={() => setActiveTab('specialized')}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left transition-all cursor-pointer ${
                  activeTab === 'specialized'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-bold'
                    : 'text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 font-semibold border border-transparent hover:border-slate-200'
                }`}
              >
                {isStudentOrPassenger ? (
                  <>
                    <div className={`p-2 rounded-xl shrink-0 ${activeTab === 'specialized' ? 'bg-white/20 text-white' : 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400'}`}>
                      <GraduationCap size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold tracking-tight">Thẻ Sinh Viên & Ưu Đãi</div>
                      <div className={`text-xs mt-0.5 truncate ${activeTab === 'specialized' ? 'text-emerald-100 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                        Mã SV, Khoa, chính sách giảm 50% vé
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`p-2 rounded-xl shrink-0 ${activeTab === 'specialized' ? 'bg-white/20 text-white' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400'}`}>
                      <ShieldCheck size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold tracking-tight">Thẩm quyền Điều độ & Quản trị</div>
                      <div className={`text-xs mt-0.5 truncate ${activeTab === 'specialized' ? 'text-emerald-100 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                        Cấp bậc vận hành và giám sát an ninh
                      </div>
                    </div>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('password')}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left transition-all cursor-pointer ${
                activeTab === 'password'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-bold'
                  : 'text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 font-semibold border border-transparent hover:border-slate-200'
              }`}
            >
              <div className={`p-2 rounded-xl shrink-0 ${activeTab === 'password' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                <KeyRound size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold tracking-tight">Bảo mật & Đổi mật khẩu</div>
                <div className={`text-xs mt-0.5 truncate ${activeTab === 'password' ? 'text-emerald-100 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                  Cập nhật mật khẩu truy cập hệ thống
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: DETAILED CONTENT CARD ================= */}
        <div className="lg:col-span-8">
          <div className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">

            {/* ==================== TAB 1: THÔNG TIN ĐỊNH DANH / HỒ SƠ TỔNG HỢP ==================== */}
            {activeTab === 'profile' && (
              isDriverOrConductor ? (
                /* UNIFIED DOSSIER DÀNH RIÊNG CHO TÀI XẾ / PHỤ XE */
                <div className="space-y-8 animate-in fade-in duration-300">
                  {/* TIÊU ĐỀ HỒ SƠ TÀI XẾ */}
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                          <Award className="size-5" />
                        </div>
                        Hồ Sơ Vận Tải & Giấy Phép Lái Xe (GPLX)
                      </h3>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
                        Hồ sơ kiểm định phương tiện và giấy phép lái xe đã được Ban Quản Lý thẩm định để cấp quyền nhận ca chạy.
                      </p>
                    </div>

                    <div className="shrink-0">
                      {licenseData?.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-2 border-emerald-400 dark:border-emerald-600 shadow-xs">
                          <CheckCircle2 size={15} className="text-emerald-600" />
                          ĐÃ THẨM ĐỊNH & ĐỦ ĐIỀU KIỆN
                        </span>
                      ) : licenseData?.status === 'rejected' ? (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border-2 border-red-400 dark:border-red-600 shadow-xs">
                          <AlertTriangle size={15} className="text-red-600" />
                          HỒ SƠ BỊ TỪ CHỐI / CẦN SỬA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-2 border-amber-400 dark:border-amber-600 shadow-xs">
                          <Clock size={15} className="text-amber-600" />
                          CHỜ BAN ĐIỀU HÀNH THẨM ĐỊNH
                        </span>
                      )}
                    </div>
                  </div>

                  {/* THÔNG BÁO FEEDBACK / LỖI */}
                  {licenseFeedback && (
                    <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/60 p-4 text-sm font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-3 animate-in fade-in shadow-xs">
                      <div className="p-1.5 rounded-xl bg-emerald-600 text-white shrink-0">
                        <CheckCircle2 size={18} />
                      </div>
                      <span>{licenseFeedback}</span>
                    </div>
                  )}

                  {licenseError && (
                    <div className="rounded-2xl border-2 border-red-500/40 bg-red-50 dark:bg-red-950/60 p-4 text-sm font-bold text-red-950 dark:text-red-100 flex items-center gap-3 animate-in fade-in shadow-xs">
                      <div className="p-1.5 rounded-xl bg-red-600 text-white shrink-0">
                        <AlertCircle size={18} />
                      </div>
                      <span>{licenseError}</span>
                    </div>
                  )}

                  {profileFeedback && (
                    <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/60 p-4 text-sm font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-3 animate-in fade-in shadow-xs">
                      <div className="p-1.5 rounded-xl bg-emerald-600 text-white shrink-0">
                        <CheckCircle2 size={18} />
                      </div>
                      <span>{profileFeedback}</span>
                    </div>
                  )}

                  {profileError && (
                    <div className="rounded-2xl border-2 border-red-500/40 bg-red-50 dark:bg-red-950/60 p-4 text-sm font-bold text-red-950 dark:text-red-100 flex items-center gap-3 animate-in fade-in shadow-xs">
                      <div className="p-1.5 rounded-xl bg-red-600 text-white shrink-0">
                        <AlertCircle size={18} />
                      </div>
                      <span>{profileError}</span>
                    </div>
                  )}

                  {/* ================= BLOCK 1: THẺ BẰNG LÁI PET CARD SIMULATOR ================= */}
                  <div className="relative rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-amber-500/10 via-emerald-600/15 to-slate-900/10 dark:from-amber-950/40 dark:via-emerald-950/40 dark:to-slate-950 border-2 border-emerald-500/40 shadow-md overflow-hidden">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-2 border-emerald-500/20 pb-4 mb-5">
                      <div>
                        <span className="text-xs font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300 block">
                          CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                        </span>
                        <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mt-1">
                          <Award className="text-amber-500 size-5" />
                          Giấy Phép Lái Xe Điện Tử / Driver's License
                        </h4>
                      </div>

                      <div>
                        {licenseData?.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-2 border-emerald-400 dark:border-emerald-600 shadow-xs">
                            <CheckCircle2 size={15} className="text-emerald-600" />
                            ĐÃ THẨM ĐỊNH & ĐỦ ĐIỀU KIỆN LÁI XE
                          </span>
                        ) : licenseData?.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border-2 border-red-400 dark:border-red-600 shadow-xs">
                            <AlertTriangle size={15} className="text-red-600" />
                            HỒ SƠ BỊ TỪ CHỐI / CẦN SỬA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-2 border-amber-400 dark:border-amber-600 shadow-xs">
                            <Clock size={15} className="text-amber-600" />
                            CHỜ BAN ĐIỀU HÀNH THẨM ĐỊNH
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 4 Chỉ số bằng lái */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-xs">
                        <span className="text-xs text-slate-600 dark:text-slate-400 block font-bold">
                          Số GPLX Quốc gia
                        </span>
                        <span className="font-mono font-black text-slate-900 dark:text-white text-base mt-1 block">
                          {licenseNumber || 'Chưa cập nhật'}
                        </span>
                      </div>

                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-xs">
                        <span className="text-xs text-slate-600 dark:text-slate-400 block font-bold">
                          Hạng Giấy Phép
                        </span>
                        <span className="font-black text-emerald-700 dark:text-emerald-400 text-base mt-1 block">
                          HẠNG {licenseClass || 'E'} (&gt;30 chỗ)
                        </span>
                      </div>

                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-xs">
                        <span className="text-xs text-slate-600 dark:text-slate-400 block font-bold">
                          Ngày Cấp Bằng
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-base mt-1 block">
                          {issueDate || 'Chưa ghi nhận'}
                        </span>
                      </div>

                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-xs">
                        <span className="text-xs text-slate-600 dark:text-slate-400 block font-bold">
                          Thời Hạn Sử Dụng
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-base mt-1 block">
                          {expiryDate || 'Không thời hạn'}
                        </span>
                      </div>
                    </div>

                    {/* HÌNH ẢNH 2 MẶT GPLX ĐÃ LƯU TRÊN HỆ THỐNG */}
                    <div className="mt-5 pt-4 border-t border-emerald-500/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <ImageIcon size={15} className="text-emerald-600" />
                          Bản sao điện tử 2 mặt Giấy phép lái xe:
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Nhấn vào ảnh để phóng to chi tiết
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Mặt trước */}
                        <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 bg-slate-900/80 group">
                          {frontImageUrl ? (
                            <>
                              <img
                                src={frontImageUrl}
                                alt="Mặt trước GPLX"
                                className="w-full h-40 object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                              />
                              <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-xs text-xs font-bold text-emerald-300 flex items-center gap-1">
                                <CheckCircle2 size={12} /> Mặt trước GPLX
                              </div>
                              <button
                                type="button"
                                onClick={() => setLightboxImg({ url: frontImageUrl, title: 'Ảnh Mặt Trước Giấy Phép Lái Xe' })}
                                className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/80 hover:bg-black text-white text-xs font-bold shadow-lg cursor-pointer transition-all"
                              >
                                <ZoomIn size={14} /> Phóng to
                              </button>
                            </>
                          ) : (
                            <div className="h-40 flex flex-col items-center justify-center text-slate-400">
                              <ImageIcon size={28} className="mb-1 opacity-50" />
                              <span className="text-xs font-medium">Chưa có ảnh mặt trước</span>
                            </div>
                          )}
                        </div>

                        {/* Mặt sau */}
                        <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 bg-slate-900/80 group">
                          {backImageUrl ? (
                            <>
                              <img
                                src={backImageUrl}
                                alt="Mặt sau GPLX"
                                className="w-full h-40 object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                              />
                              <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-xs text-xs font-bold text-emerald-300 flex items-center gap-1">
                                <CheckCircle2 size={12} /> Mặt sau GPLX
                              </div>
                              <button
                                type="button"
                                onClick={() => setLightboxImg({ url: backImageUrl, title: 'Ảnh Mặt Sau Giấy Phép Lái Xe' })}
                                className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/80 hover:bg-black text-white text-xs font-bold shadow-lg cursor-pointer transition-all"
                              >
                                <ZoomIn size={14} /> Phóng to
                              </button>
                            </>
                          ) : (
                            <div className="h-40 flex flex-col items-center justify-center text-slate-400">
                              <ImageIcon size={28} className="mb-1 opacity-50" />
                              <span className="text-xs font-medium">Chưa có ảnh mặt sau</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* THÔNG BÁO TỪ CHỐI NẾU CÓ */}
                    {licenseData?.profile?.rejectionReason && (
                      <div className="mt-4 p-4 rounded-2xl bg-red-100/90 dark:bg-red-950/70 border-2 border-red-300 dark:border-red-800 text-sm text-red-950 dark:text-red-100">
                        <span className="font-black">Lý do từ chối từ Ban Quản lý Tuyến: </span>
                        <span>{licenseData.profile.rejectionReason}</span>
                      </div>
                    )}
                  </div>

                  {/* KHÓA BẢO VỆ KHI ĐÃ ĐƯỢC DUYỆT & NÚT YÊU CẦU CẬP NHẬT */}
                  {licenseData?.status === 'approved' && (
                    <div className="p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 mt-0.5">
                          <CheckCircle2 size={20} />
                        </div>
                        <div>
                          <h5 className="text-sm font-black text-slate-900 dark:text-white">
                            Hồ Sơ Đã Được Thẩm Định Hợp Lệ & Khóa Bảo Vệ
                          </h5>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                            Bằng lái của tài xế đã được Ban Điều Hành phê duyệt. Thông tin bằng lái được khóa để duy trì điều kiện phân công ca chạy. Nếu nâng hạng hoặc đổi phôi thẻ mới, hãy bấm nút yêu cầu cấp đổi.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsEditingLicense(!isEditingLicense)}
                        className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-emerald-600 bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 font-bold text-xs transition-all cursor-pointer shadow-xs"
                      >
                        <Edit3 size={15} />
                        <span>{isEditingLicense ? 'Đóng Biểu Mẫu Chỉnh Sửa' : 'Yêu Cầu Cấp Đổi / Bổ Sung GPLX Mới'}</span>
                      </button>
                    </div>
                  )}

                  {/* FORM CẬP NHẬT GPLX (CHỈ HIỂN THỊ KHI CHƯA DUYỆT HOẶC KHI TÀI XẾ NHẤN NÚT CẤP ĐỔI) */}
                  {(isEditingLicense || licenseData?.status !== 'approved') && (
                    <form onSubmit={handleUpdateLicense} className="space-y-6 p-6 rounded-3xl border-2 border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 animate-in fade-in">
                      <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-900/50 pb-3">
                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                          <FileCheck size={18} className="text-amber-600" />
                          Cập nhật / Nộp bổ sung hồ sơ bằng lái xe
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                            Số Giấy phép lái xe (GPLX) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={licenseNumber}
                            onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
                            placeholder="VD: GPLX-20-E-561121"
                            className="h-12 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 text-sm font-mono font-black text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none transition-all shadow-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                            Hạng giấy phép lái xe <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={licenseClass}
                            onChange={(e) => setLicenseClass(e.target.value)}
                            className="h-12 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 text-sm font-bold text-slate-900 dark:text-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none transition-all shadow-xs cursor-pointer"
                          >
                            <option value="D">Hạng D (Ô tô chở người từ 10 đến 30 chỗ)</option>
                            <option value="E">Hạng E (Ô tô chở người trên 30 chỗ ngồi)</option>
                            <option value="FD">Hạng FD (Đầu kéo / Rơ moóc chở khách)</option>
                            <option value="FE">Hạng FE (Xe khách kéo rơ moóc)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                            Ngày cấp giấy phép
                          </label>
                          <div className="relative">
                            <Calendar size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="date"
                              value={issueDate}
                              onChange={(e) => setIssueDate(e.target.value)}
                              className="h-12 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-11 pr-4 text-sm font-semibold text-slate-900 dark:text-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none transition-all shadow-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                            Hạn sử dụng giấy phép
                          </label>
                          <div className="relative">
                            <Calendar size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="date"
                              value={expiryDate}
                              onChange={(e) => setExpiryDate(e.target.value)}
                              className="h-12 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-11 pr-4 text-sm font-semibold text-slate-900 dark:text-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none transition-all shadow-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* KHUNG TẢI ẢNH 2 MẶT GPLX */}
                      <div className="space-y-3">
                        <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                          Tải ảnh chụp phôi thẻ PET 2 mặt Giấy phép lái xe
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                          {/* MẶT TRƯỚC */}
                          <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-white dark:bg-slate-900 p-5 transition-all flex flex-col items-center justify-center text-center relative overflow-hidden group min-h-[200px]">
                            {frontImageUrl ? (
                              <div className="relative w-full h-44 rounded-xl overflow-hidden shadow-xs border-2 border-slate-200 dark:border-slate-700 group">
                                <img src={frontImageUrl} alt="Mặt trước GPLX" className="size-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                  <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold cursor-pointer hover:bg-slate-100 shadow-md">
                                    <Upload size={14} />
                                    <span>Đổi ảnh</span>
                                    <input type="file" accept="image/*" disabled={isUploadingFront} onChange={handleFrontImageFileChange} className="hidden" />
                                  </label>
                                  <button type="button" onClick={() => setFrontImageUrl('')} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 shadow-md cursor-pointer">
                                    <Trash2 size={14} /> Xóa
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-4 space-y-3">
                                <div className="size-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                  <UploadCloud size={24} />
                                </div>
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Ảnh mặt trước GPLX</span>
                                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer shadow-md">
                                  <Upload size={14} />
                                  <span>{isUploadingFront ? 'Đang tải ảnh...' : 'Tải ảnh từ thiết bị'}</span>
                                  <input type="file" accept="image/*" disabled={isUploadingFront} onChange={handleFrontImageFileChange} className="hidden" />
                                </label>
                              </div>
                            )}
                          </div>

                          {/* MẶT SAU */}
                          <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-white dark:bg-slate-900 p-5 transition-all flex flex-col items-center justify-center text-center relative overflow-hidden group min-h-[200px]">
                            {backImageUrl ? (
                              <div className="relative w-full h-44 rounded-xl overflow-hidden shadow-xs border-2 border-slate-200 dark:border-slate-700 group">
                                <img src={backImageUrl} alt="Mặt sau GPLX" className="size-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                  <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold cursor-pointer hover:bg-slate-100 shadow-md">
                                    <Upload size={14} />
                                    <span>Đổi ảnh</span>
                                    <input type="file" accept="image/*" disabled={isUploadingBack} onChange={handleBackImageFileChange} className="hidden" />
                                  </label>
                                  <button type="button" onClick={() => setBackImageUrl('')} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 shadow-md cursor-pointer">
                                    <Trash2 size={14} /> Xóa
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-4 space-y-3">
                                <div className="size-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                  <UploadCloud size={24} />
                                </div>
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Ảnh mặt sau GPLX</span>
                                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer shadow-md">
                                  <Upload size={14} />
                                  <span>{isUploadingBack ? 'Đang tải ảnh...' : 'Tải ảnh từ thiết bị'}</span>
                                  <input type="file" accept="image/*" disabled={isUploadingBack} onChange={handleBackImageFileChange} className="hidden" />
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 flex justify-end">
                        <button
                          type="submit"
                          disabled={isSavingLicense}
                          className="inline-flex items-center gap-2.5 px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Save size={16} />
                          <span>{isSavingLicense ? 'Đang gửi...' : 'Gửi Thẩm Định GPLX Mới'}</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* VÁCH NGĂN CHIA PHẦN ĐỊNH DANH CÁ NHÂN */}
                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t-2 border-slate-200 dark:border-slate-800" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white dark:bg-slate-900 px-4 text-slate-500 dark:text-slate-400 font-black tracking-wider">
                        Thông Tin Định Danh & Căn Cước Công Dân (CCCD)
                      </span>
                    </div>
                  </div>

                  {/* ================= BLOCK 2: FORM ĐỊNH DANH CÁ NHÂN ================= */}
                  <form onSubmit={handleUpdateProfile} className="space-y-6">
                    {/* Email Read-only Verified Card */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border-2 border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                          <Mail size={18} />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                            Email tài khoản công vụ
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Được bảo vệ bởi hệ thống xác thực định danh SSO
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                          {currentUser?.email || authUser?.email || ''}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          <Lock size={12} /> Cố định
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                          Họ và tên đầy đủ <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Trần Văn Nam"
                            className="h-12 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-11 pr-4 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none transition-all shadow-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                          Số điện thoại liên lạc công vụ
                        </label>
                        <div className="relative">
                          <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="0903456789"
                            className="h-12 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-11 pr-4 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none transition-all shadow-xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                          Số Căn cước công dân (CCCD 12 số)
                        </label>
                        <div className="relative">
                          <IdCard size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            maxLength={12}
                            value={idCardNumber}
                            onChange={(e) => setIdCardNumber(e.target.value.replace(/D/g, ''))}
                            placeholder="019200001234"
                            className="h-12 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-11 pr-4 text-sm font-mono font-black tracking-widest text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none transition-all shadow-xs"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-2 p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
                        <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
                          Ảnh đại diện tài khoản
                        </label>
                        <div className="flex flex-col sm:flex-row items-center gap-5">
                          <div className="relative group shrink-0">
                            <div className="size-24 rounded-2xl ring-4 ring-emerald-500/30 shadow-md overflow-hidden bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-2xl font-black">
                              {avatarUrl ? (
                                <img src={avatarUrl} alt={fullName} className="size-full object-cover" />
                              ) : (
                                <span>{userInitials}</span>
                              )}
                            </div>
                            {isUploadingAvatar && (
                              <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center text-white">
                                <Loader2 size={24} className="animate-spin text-emerald-400" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 space-y-2.5 text-center sm:text-left">
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                              <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer transition-all">
                                <Upload size={15} />
                                <span>{isUploadingAvatar ? 'Đang tải ảnh...' : 'Tải ảnh từ thiết bị'}</span>
                                <input type="file" accept="image/*" disabled={isUploadingAvatar} onChange={handleAvatarFileChange} className="hidden" />
                              </label>

                              {avatarUrl && (
                                <button
                                  type="button"
                                  onClick={() => setAvatarUrl('')}
                                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-700 dark:text-red-300 text-xs font-bold cursor-pointer transition-all"
                                >
                                  <Trash2 size={14} />
                                  <span>Gỡ ảnh đại diện</span>
                                </button>
                              )}
                            </div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              Hỗ trợ định dạng PNG, JPG, WEBP từ máy tính hoặc điện thoại (Tối đa dung lượng 5MB).
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="submit"
                        disabled={isSavingProfile}
                        className="inline-flex items-center gap-2.5 px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-sm font-black shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Save size={17} />
                        <span>{isSavingProfile ? 'Đang lưu hồ sơ...' : 'Lưu Thay Đổi Thông Tin'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* FORM ĐỊNH DANH TIÊU CHUẨN DÀNH CHO HÀNH KHÁCH / ADMIN */
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                      <div className="p-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                        <User className="size-5" />
                      </div>
                      Hồ Sơ Định Danh Cá Nhân
                    </h3>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
                      Thông tin định danh bắt buộc dùng để xác thực quyền hạn trên hệ thống Smart Transit.
                    </p>
                  </div>

                  {profileFeedback && (
                    <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/60 p-4 text-sm font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-3 animate-in fade-in shadow-xs">
                      <div className="p-1.5 rounded-xl bg-emerald-600 text-white shrink-0">
                        <CheckCircle2 size={18} />
                      </div>
                      <span>{profileFeedback}</span>
                    </div>
                  )}

                  {profileError && (
                    <div className="rounded-2xl border-2 border-red-500/40 bg-red-50 dark:bg-red-950/60 p-4 text-sm font-bold text-red-950 dark:text-red-100 flex items-center gap-3 animate-in fade-in shadow-xs">
                      <div className="p-1.5 rounded-xl bg-red-600 text-white shrink-0">
                        <AlertCircle size={18} />
                      </div>
                      <span>{profileError}</span>
                    </div>
                  )}

                  {/* Email Read-only Verified Card */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border-2 border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                        <Mail size={18} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                          Email tài khoản công vụ
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Được bảo vệ bởi hệ thống xác thực định danh SSO
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                        {currentUser?.email || authUser?.email || ''}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        <Lock size={12} /> Cố định
                      </span>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                        Họ và tên đầy đủ <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Nguyễn Văn A"
                          className="h-12 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-11 pr-4 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none transition-all shadow-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                        Số điện thoại liên lạc công vụ
                      </label>
                      <div className="relative">
                        <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="0987654321"
                          className="h-12 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-11 pr-4 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none transition-all shadow-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                        Số Căn cước công dân (CCCD 12 số)
                      </label>
                      <div className="relative">
                        <IdCard size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          maxLength={12}
                          value={idCardNumber}
                          onChange={(e) => setIdCardNumber(e.target.value.replace(/D/g, ''))}
                          placeholder="019200001234"
                          className="h-12 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-11 pr-4 text-sm font-mono font-black tracking-widest text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none transition-all shadow-xs"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2 p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
                      <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
                        Ảnh đại diện tài khoản
                      </label>
                      <div className="flex flex-col sm:flex-row items-center gap-5">
                        {/* Avatar Preview */}
                        <div className="relative group shrink-0">
                          <div className="size-24 rounded-2xl ring-4 ring-emerald-500/30 shadow-md overflow-hidden bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-2xl font-black">
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
                              <Loader2 size={24} className="animate-spin text-emerald-400" />
                            </div>
                          )}
                        </div>

                        {/* Upload Controls */}
                        <div className="flex-1 space-y-2.5 text-center sm:text-left">
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                            <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer transition-all">
                              <Upload size={15} />
                              <span>{isUploadingAvatar ? 'Đang tải ảnh...' : 'Tải ảnh từ thiết bị'}</span>
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
                                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-700 dark:text-red-300 text-xs font-bold cursor-pointer transition-all"
                              >
                                <Trash2 size={14} />
                                <span>Gỡ ảnh đại diện</span>
                              </button>
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Hỗ trợ định dạng PNG, JPG, WEBP từ máy tính hoặc điện thoại (Tối đa dung lượng 5MB).
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* NẾU LÀ HÀNH KHÁCH / SINH VIÊN MỚI HIỂN THỊ MÃ SV VÀ KHOA */}
                  {isStudentOrPassenger && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border-2 border-emerald-200/80 dark:border-emerald-900/60">
                      <div>
                        <label className="block text-sm font-bold text-emerald-950 dark:text-emerald-200 mb-2">
                          Mã sinh viên ICTU
                        </label>
                        <div className="relative">
                          <GraduationCap size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600" />
                          <input
                            type="text"
                            value={studentId}
                            onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                            placeholder="DTC2151800001"
                            className="h-12 w-full rounded-xl border-2 border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-950 pl-11 pr-4 text-sm font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none transition-all shadow-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-emerald-950 dark:text-emerald-200 mb-2">
                          Khoa / Viện / Đơn vị
                        </label>
                        <div className="relative">
                          <Building size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600" />
                          <input
                            type="text"
                            value={faculty}
                            onChange={(e) => setFaculty(e.target.value)}
                            placeholder="Khoa Công nghệ thông tin"
                            className="h-12 w-full rounded-xl border-2 border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-950 pl-11 pr-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none transition-all shadow-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 flex justify-end border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="inline-flex items-center gap-2.5 px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-sm font-black shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Save size={17} />
                      <span>{isSavingProfile ? 'Đang lưu hồ sơ...' : 'Lưu Thay Đổi Thông Tin'}</span>
                    </button>
                  </div>
                </form>
              )
            )}

            {/* ==================== TAB 2: CHUYÊN MÔN THEO ROLE (DÀNH CHO NON-DRIVER) ==================== */}
            {activeTab === 'specialized' && !isDriverOrConductor && (
              <div className="space-y-6 animate-in fade-in">
                {/* DÀNH CHO SINH VIÊN */}
                {isStudentOrPassenger && (
                  <div className="space-y-4">
                    <div className="p-6 rounded-3xl bg-gradient-to-br from-cyan-500/10 via-emerald-500/10 to-teal-500/10 border-2 border-emerald-500/30">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="size-12 rounded-2xl bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
                          <GraduationCap size={26} />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-900 dark:text-white">
                            Thẻ Ưu Đãi Sinh Viên ICTU Bus Transit
                          </h3>
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            Áp dụng mức trợ giá 50% vé xe buýt toàn bộ mạng lưới tuyến học đường
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800">
                          <span className="text-slate-600 dark:text-slate-400 block font-bold">Mã số sinh viên</span>
                          <span className="text-base font-mono font-black text-emerald-700 dark:text-emerald-400 mt-1 block">
                            {studentId || 'Chưa liên kết mã SV'}
                          </span>
                        </div>
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800">
                          <span className="text-slate-600 dark:text-slate-400 block font-bold">Khoa / Đơn vị trực thuộc</span>
                          <span className="text-base font-bold text-slate-900 dark:text-white mt-1 block">
                            {faculty || 'Khoa Công nghệ thông tin'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* DÀNH CHO ADMIN / DISPATCHER */}
                {isAdminOrDispatcher && (
                  <div className="space-y-4">
                    <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-slate-900/10 border-2 border-indigo-500/30">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="size-12 rounded-2xl bg-indigo-600/20 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold">
                          <ShieldCheck size={26} />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-900 dark:text-white">
                            Trung Tâm Điều Hành & Ban Quản Trị Hệ Thống
                          </h3>
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            Thẩm quyền điều phối vận tải, giám sát phương tiện và thẩm định hồ sơ bằng lái tài xế
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800">
                          <span className="text-slate-600 dark:text-slate-400 block font-bold">Cấp bậc ủy quyền</span>
                          <span className="text-base font-black text-indigo-700 dark:text-indigo-300 mt-1 block">
                            {roleName.toUpperCase()} - TOÀN QUYỀN VẬN HÀNH
                          </span>
                        </div>
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800">
                          <span className="text-slate-600 dark:text-slate-400 block font-bold">Trạng thái bảo mật</span>
                          <span className="text-base font-bold text-emerald-700 dark:text-emerald-400 mt-1 block flex items-center gap-1.5">
                            <CheckCircle2 size={16} />
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
              <form onSubmit={handleChangePassword} className="space-y-6">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                    <div className="p-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                      <KeyRound className="size-5" />
                    </div>
                    Đổi Mật Khẩu Tài Khoản
                  </h3>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
                    Mật khẩu mới phải có tối thiểu 6 ký tự để bảo vệ tài khoản khi vận hành hệ thống.
                  </p>
                </div>

                {passwordFeedback && (
                  <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/60 p-4 text-sm font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-3 animate-in fade-in shadow-xs">
                    <div className="p-1.5 rounded-xl bg-emerald-600 text-white shrink-0">
                      <CheckCircle2 size={18} />
                    </div>
                    <span>{passwordFeedback}</span>
                  </div>
                )}

                {passwordError && (
                  <div className="rounded-2xl border-2 border-red-500/40 bg-red-50 dark:bg-red-950/60 p-4 text-sm font-bold text-red-950 dark:text-red-100 flex items-center gap-3 animate-in fade-in shadow-xs">
                    <div className="p-1.5 rounded-xl bg-red-600 text-white shrink-0">
                      <AlertCircle size={18} />
                    </div>
                    <span>{passwordError}</span>
                  </div>
                )}

                {/* Mật khẩu cũ */}
                <div>
                  <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Mật khẩu hiện tại <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showOldPassword ? 'text' : 'password'}
                      required
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Nhập mật khẩu đang dùng"
                      className="h-12 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-11 pr-11 text-sm font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none transition-all shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Mật khẩu mới */}
                <div>
                  <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Mật khẩu mới (Tối thiểu 6 ký tự) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <KeyRound size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nhập mật khẩu mới an toàn"
                      className="h-12 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-11 pr-11 text-sm font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none transition-all shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {newPassword && (
                    <div className="mt-2.5 space-y-2">
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <div
                            key={lvl}
                            className={`h-2 flex-1 rounded-full transition-all ${
                              passwordStrength >= lvl
                                ? passwordStrength <= 2
                                  ? 'bg-red-500'
                                  : passwordStrength <= 3
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                                : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        Độ an toàn:{' '}
                        <span className={passwordStrength <= 2 ? 'text-red-500' : passwordStrength <= 3 ? 'text-amber-500' : 'text-emerald-600 font-extrabold'}>
                          {passwordStrength <= 2 ? 'Yếu' : passwordStrength <= 3 ? 'Trung bình' : 'Rất mạnh'}
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Xác nhận mật khẩu mới */}
                <div>
                  <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Xác nhận lại mật khẩu mới <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      className="h-12 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-11 pr-11 text-sm font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none transition-all shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300/80 dark:border-amber-900/60 text-xs text-amber-950 dark:text-amber-200">
                  <span className="font-black text-amber-900 dark:text-amber-100">Lưu ý quan trọng: </span>
                  Sau khi đổi mật khẩu thành công, bạn sẽ sử dụng mật khẩu mới này cho tất cả các lần đăng nhập tiếp theo trên buồng lái xe buýt và cổng điều hành.
                </div>

                <div className="pt-4 flex justify-end border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="inline-flex items-center gap-2.5 px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-sm font-black shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <KeyRound size={17} />
                    <span>{isChangingPassword ? 'Đang cập nhật mật khẩu...' : 'Cập Nhật Mật Khẩu'}</span>
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>

      </div>
    
      {/* ================= LIGHTBOX MODAL PHÓNG TO ẢNH GPLX ================= */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in cursor-pointer"
          onClick={() => setLightboxImg(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-slate-900 rounded-3xl p-5 shadow-2xl border-2 border-slate-700 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-white">
              <span className="font-bold text-sm flex items-center gap-2">
                <Award className="text-amber-400 size-5" />
                {lightboxImg.title}
              </span>
              <button
                type="button"
                onClick={() => setLightboxImg(null)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-4 rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-[75vh]">
              <img
                src={lightboxImg.url}
                alt={lightboxImg.title}
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
</div>
  )
}
