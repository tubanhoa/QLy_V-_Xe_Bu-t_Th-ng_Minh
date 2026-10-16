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
      setIdCardNumber(u.idCardNumber || '')
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

  // Cấu hình nhãn & màu sắc phân quyền
  const getRoleBadgeConfig = () => {
    switch (roleName) {
      case 'admin':
        return {
          title: 'Super Admin - Ban Quản Trị',
          sub: 'Toàn quyền kiểm soát hệ thống điều hành',
          badgeBg: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
          icon: <Shield className="size-4" />,
        }
      case 'manager':
      case 'dispatcher':
        return {
          title: 'Điều Hành Viên Tuyến Buýt',
          sub: 'Trung tâm điều độ & giám sát vận tải',
          badgeBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800',
          icon: <Bus className="size-4" />,
        }
      case 'driver':
        return {
          title: 'Tài Xế Vận Hành Tuyến Buýt',
          sub: 'Đội xe buýt ICTU Smart Transit',
          badgeBg: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          icon: <Award className="size-4" />,
        }
      case 'conductor':
        return {
          title: 'Kiểm Soát Viên / Phụ Xe',
          sub: 'Đội hỗ trợ & kiểm soát vé buýt',
          badgeBg: 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800',
          icon: <BadgeCheck className="size-4" />,
        }
      default:
        return {
          title: 'Hành Khách Sinh Viên ICTU',
          sub: 'Tài khoản dịch vụ vận tải công cộng',
          badgeBg: 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800',
          icon: <GraduationCap className="size-4" />,
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
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1">
            <span>ICTU Transit</span>
            <ChevronRight size={14} />
            <span>Cổng Điều Hành</span>
            <ChevronRight size={14} />
            <span className="text-foreground font-bold">
              {isDriverOrConductor ? 'Hồ sơ & Bằng lái Tài xế' : 'Hồ sơ cá nhân & Tài khoản'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            {isDriverOrConductor ? (
              <>
                <Award className="size-7 text-emerald-600 dark:text-emerald-400" />
                Hồ Sơ Tài Xế & Bằng Lái Vận Tải
              </>
            ) : (
              <>
                <User className="size-7 text-emerald-600 dark:text-emerald-400" />
                Hồ Sơ Cán Bộ & Cài Đặt Tài Khoản
              </>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            {isDriverOrConductor
              ? 'Quản lý thông tin định danh Căn cước công dân, số điện thoại công vụ và thẩm định Giấy phép lái xe GPLX Hạng D/E phục vụ nhận ca chạy trên tuyến.'
              : 'Quản lý thông tin tài khoản cán bộ điều hành, phân quyền an ninh và bảo mật hệ thống vé xe buýt thông minh ICTU.'}
          </p>
        </div>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted/80 text-xs font-bold text-foreground transition-all cursor-pointer shadow-xs shrink-0 self-start sm:self-auto"
          >
            <ArrowLeft size={15} />
            <span>Quay lại Bảng điều khiển</span>
          </button>
        )}
      </div>

      {/* ================= MAIN 2-COLUMN GRID ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ================= LEFT COLUMN: HERO IDENTITY CARD & NAVIGATION ================= */}
        <div className="lg:col-span-4 space-y-5">
          {/* Hero Profile Card */}
          <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
            {/* Top Gradient Banner */}
            <div className="relative bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 p-6 text-white overflow-hidden">
              <div className="absolute right-[-15px] bottom-[-15px] opacity-10 pointer-events-none select-none text-white">
                <Bus size={120} />
              </div>
              <div className="relative z-10 flex flex-col items-center text-center">
                {/* Avatar with Glow and Pulse */}
                <div className="relative mb-3">
                  <div className="size-22 rounded-2xl ring-4 ring-white/30 dark:ring-emerald-500/30 shadow-xl overflow-hidden bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-2xl font-black">
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
                <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  {fullName || currentUser?.fullName || 'Người Dùng Hệ Thống'}
                  <BadgeCheck size={18} className="text-emerald-400 shrink-0" />
                </h2>
                <p className="text-xs text-slate-300 font-mono mt-0.5">
                  {currentUser?.email || authUser?.email || 'N/A'}
                </p>

                {/* Role Pill */}
                <div className="mt-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-xs ${roleConfig.badgeBg}`}
                  >
                    {roleConfig.icon}
                    <span>{roleConfig.title}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Status Attributes */}
            <div className="p-4 space-y-2.5 bg-muted/30 border-t border-border text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-emerald-600" />
                  Trạng thái tài khoản:
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Đang hoạt động
                </span>
              </div>

              {isDriverOrConductor && (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Award size={14} className="text-amber-500" />
                    Hạng giấy phép:
                  </span>
                  <span className="font-bold text-foreground font-mono">
                    HẠNG {licenseClass || 'D'}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Building size={14} className="text-slate-400" />
                  Đơn vị trực thuộc:
                </span>
                <span className="font-semibold text-foreground truncate max-w-[170px]">
                  {isDriverOrConductor ? 'Đội xe buýt ICTU Transit' : faculty || 'Ban Điều Hành ICTU'}
                </span>
              </div>
            </div>
          </div>

          {/* Vertical Navigation Tabs */}
          <div className="rounded-3xl border border-border bg-card p-2 shadow-xs space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <User size={16} />
              <div className="text-left flex-1">
                <div>Thông tin định danh & CCCD</div>
                <div className={`text-[10px] font-normal ${activeTab === 'profile' ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                  Họ tên, số điện thoại, số thẻ căn cước
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('specialized')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'specialized'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {isDriverOrConductor ? (
                <>
                  <Award size={16} />
                  <div className="text-left flex-1">
                    <div>Giấy phép lái xe & Nghiệp vụ</div>
                    <div className={`text-[10px] font-normal ${activeTab === 'specialized' ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                      GPLX Hạng D/E, ngày cấp, duyệt hồ sơ
                    </div>
                  </div>
                </>
              ) : isStudentOrPassenger ? (
                <>
                  <GraduationCap size={16} />
                  <div className="text-left flex-1">
                    <div>Thẻ Sinh Viên & Ưu Đãi</div>
                    <div className={`text-[10px] font-normal ${activeTab === 'specialized' ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                      Mã SV, Khoa, chính sách giảm 50% vé
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <div className="text-left flex-1">
                    <div>Thẩm quyền Điều độ & Quản trị</div>
                    <div className={`text-[10px] font-normal ${activeTab === 'specialized' ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                      Cấp bậc vận hành và giám sát an ninh
                    </div>
                  </div>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('password')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'password'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <KeyRound size={16} />
              <div className="text-left flex-1">
                <div>Bảo mật & Đổi mật khẩu</div>
                <div className={`text-[10px] font-normal ${activeTab === 'password' ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                  Cập nhật mật khẩu truy cập hệ thống
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: DETAILED CONTENT CARD ================= */}
        <div className="lg:col-span-8">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm">

            {/* ==================== TAB 1: THÔNG TIN ĐỊNH DANH ==================== */}
            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div>
                  <h3 className="text-base font-black text-foreground flex items-center gap-2">
                    <User className="size-5 text-emerald-600" />
                    Hồ Sơ Định Danh Cá Nhân
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Thông tin định danh bắt buộc dùng để xác thực quyền hạn trên hệ thống Smart Transit.
                  </p>
                </div>

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

                {/* Email Read-only Card */}
                <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                      <Mail size={14} className="text-slate-400" />
                      Email tài khoản công vụ (Bảo mật - Không thể đổi):
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {currentUser?.email || authUser?.email || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Input Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">
                      Họ và tên đầy đủ <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Nguyễn Văn Hùng"
                        className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3.5 text-xs font-semibold text-foreground focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">
                      Số điện thoại liên lạc công vụ
                    </label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="0912345678"
                        className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3.5 text-xs font-mono font-semibold text-foreground focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">
                      Số Căn cước công dân (CCCD 12 số)
                    </label>
                    <div className="relative">
                      <IdCard size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        maxLength={12}
                        value={idCardNumber}
                        onChange={(e) => setIdCardNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="019200001234"
                        className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3.5 text-xs font-mono font-black tracking-wider text-foreground focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2 p-4 rounded-2xl border border-border bg-muted/20">
                    <label className="block text-xs font-bold text-foreground mb-2">
                      Ảnh đại diện tài khoản
                    </label>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Avatar Preview */}
                      <div className="relative group shrink-0">
                        <div className="size-20 rounded-2xl ring-2 ring-emerald-500/40 shadow-md overflow-hidden bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-xl font-black">
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
                      <div className="flex-1 space-y-2 text-center sm:text-left">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer transition-all active:scale-95">
                            <Upload size={14} />
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
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold cursor-pointer transition-all"
                            >
                              <Trash2 size={13} />
                              <span>Gỡ ảnh</span>
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Hỗ trợ định dạng PNG, JPG, WEBP từ máy tính hoặc điện thoại (Tối đa 5MB).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* NẾU LÀ HÀNH KHÁCH / SINH VIÊN MỚI HIỂN THỊ MÃ SV VÀ KHOA */}
                {isStudentOrPassenger && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
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
                          className="h-11 w-full rounded-xl border border-emerald-200 dark:border-emerald-800 bg-background pl-10 pr-3 text-xs font-mono font-bold text-foreground focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-300 mb-1.5">
                        Khoa / Viện / Đơn vị
                      </label>
                      <div className="relative">
                        <Building size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600" />
                        <input
                          type="text"
                          value={faculty}
                          onChange={(e) => setFaculty(e.target.value)}
                          placeholder="Khoa Công nghệ thông tin"
                          className="h-11 w-full rounded-xl border border-emerald-200 dark:border-emerald-800 bg-background pl-10 pr-3 text-xs text-foreground focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
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
              <div className="space-y-6">
                
                {/* DÀNH CHO TÀI XẾ / PHỤ XE: THẺ BẰNG LÁI XE PET & NGHIỆP VỤ */}
                {isDriverOrConductor && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-base font-black text-foreground flex items-center gap-2">
                        <Award className="size-5 text-amber-500" />
                        Hồ Sơ Giấy Phép Lái Xe & Thẩm Định Vận Tải
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Hồ sơ bằng lái xe buýt chở khách trên 30 chỗ được Ban Quản Lý thẩm định để cấp quyền nhận ca chạy.
                      </p>
                    </div>

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

                    {/* THẺ BẰNG LÁI PET CARD MÔ PHỎNG */}
                    <div className="relative rounded-3xl p-6 bg-gradient-to-br from-amber-500/10 via-emerald-600/15 to-slate-900/10 dark:from-amber-950/30 dark:via-emerald-950/30 dark:to-slate-950 border-2 border-emerald-500/30 shadow-md overflow-hidden">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/80 pb-4 mb-4">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                          </span>
                          <h4 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2 mt-0.5">
                            <Award className="text-amber-500 size-4" />
                            Giấy Phép Lái Xe Điện Tử / Driver's License
                          </h4>
                        </div>

                        <div>
                          {licenseData?.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-xs">
                              <CheckCircle2 size={14} className="text-emerald-600" />
                              ĐÃ THẨM ĐỊNH & ĐỦ ĐIỀU KIỆN LÁI XE
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

                      {/* Thông số bằng lái */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                        <div className="p-3.5 rounded-2xl bg-card border border-border">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            Số GPLX Quốc gia
                          </span>
                          <span className="font-mono font-black text-foreground text-sm mt-0.5 block">
                            {licenseNumber || 'Chưa cập nhật'}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-card border border-border">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            Hạng Giấy Phép
                          </span>
                          <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm mt-0.5 block">
                            HẠNG {licenseClass || 'D'} (&gt;30 chỗ)
                          </span>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-card border border-border">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            Ngày Cấp Bằng
                          </span>
                          <span className="font-mono font-bold text-foreground mt-0.5 block">
                            {issueDate || 'Chưa ghi nhận'}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-card border border-border">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            Thời Hạn Sử Dụng
                          </span>
                          <span className="font-mono font-bold text-foreground mt-0.5 block">
                            {expiryDate || 'Không thời hạn'}
                          </span>
                        </div>
                      </div>

                      {licenseData?.profile?.rejectionReason && (
                        <div className="mt-4 p-3.5 rounded-2xl bg-red-100/80 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-200">
                          <span className="font-black">Lý do từ chối từ Ban Quản lý Tuyến: </span>
                          <span>{licenseData.profile.rejectionReason}</span>
                        </div>
                      )}
                    </div>

                    {/* FORM CẬP NHẬT GPLX */}
                    <form onSubmit={handleUpdateLicense} className="space-y-5 pt-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                          <FileCheck size={16} className="text-emerald-600" />
                          Cập nhật / Nộp bổ sung hồ sơ bằng lái xe
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-foreground mb-1.5">
                            Số Giấy phép lái xe (GPLX) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={licenseNumber}
                            onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
                            placeholder="VD: 200189998823"
                            className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-xs font-mono font-bold text-foreground focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-foreground mb-1.5">
                            Hạng giấy phép lái xe <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={licenseClass}
                            onChange={(e) => setLicenseClass(e.target.value)}
                            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs cursor-pointer"
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
                          <label className="block text-xs font-bold text-foreground mb-1.5">
                            Ngày cấp giấy phép
                          </label>
                          <div className="relative">
                            <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                              type="date"
                              value={issueDate}
                              onChange={(e) => setIssueDate(e.target.value)}
                              className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-xs text-foreground focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-foreground mb-1.5">
                            Hạn sử dụng giấy phép
                          </label>
                          <div className="relative">
                            <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                              type="date"
                              value={expiryDate}
                              onChange={(e) => setExpiryDate(e.target.value)}
                              className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-xs text-foreground focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* KHUNG TẢI ẢNH 2 MẶT GPLX TỪ THIẾT BỊ */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-foreground">
                          Hình ảnh chụp 2 mặt Giấy phép lái xe (GPLX)
                        </label>
                        <p className="text-[11px] text-muted-foreground">
                          Chụp rõ nét 2 mặt phôi thẻ PET, không bị mất góc hoặc lóa sáng để Hội đồng thẩm định phê duyệt ca chạy.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                          {/* MẶT TRƯỚC GPLX */}
                          <div className="rounded-2xl border-2 border-dashed border-border hover:border-emerald-500/50 bg-muted/20 p-4 transition-all flex flex-col items-center justify-center text-center relative overflow-hidden group min-h-[200px]">
                            {frontImageUrl ? (
                              <div className="relative w-full h-44 rounded-xl overflow-hidden shadow-xs border border-border group">
                                <img
                                  src={frontImageUrl}
                                  alt="Mặt trước GPLX"
                                  className="size-full object-cover"
                                />
                                <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-xs text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                                  <CheckCircle2 size={12} />
                                  Mặt trước GPLX
                                </div>
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-bold cursor-pointer hover:bg-slate-100 shadow-md">
                                    <Upload size={13} />
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
                                    <Trash2 size={13} />
                                    <span>Xóa</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-4 space-y-2.5">
                                <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                  <UploadCloud size={24} />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-foreground">
                                    Ảnh mặt trước GPLX
                                  </p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Mặt có ảnh chân dung và hạng bằng
                                  </p>
                                </div>
                                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer transition-all active:scale-95">
                                  <Upload size={14} />
                                  <span>{isUploadingFront ? 'Đang tải ảnh...' : 'Tải ảnh từ thiết bị'}</span>
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
                                <div className="flex flex-col items-center gap-2">
                                  <Loader2 size={24} className="animate-spin text-emerald-400" />
                                  <span className="text-xs font-semibold">Đang xử lý tệp ảnh...</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* MẶT SAU GPLX */}
                          <div className="rounded-2xl border-2 border-dashed border-border hover:border-emerald-500/50 bg-muted/20 p-4 transition-all flex flex-col items-center justify-center text-center relative overflow-hidden group min-h-[200px]">
                            {backImageUrl ? (
                              <div className="relative w-full h-44 rounded-xl overflow-hidden shadow-xs border border-border group">
                                <img
                                  src={backImageUrl}
                                  alt="Mặt sau GPLX"
                                  className="size-full object-cover"
                                />
                                <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-xs text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                                  <CheckCircle2 size={12} />
                                  Mặt sau GPLX
                                </div>
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-bold cursor-pointer hover:bg-slate-100 shadow-md">
                                    <Upload size={13} />
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
                                    <Trash2 size={13} />
                                    <span>Xóa</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-4 space-y-2.5">
                                <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                  <UploadCloud size={24} />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-foreground">
                                    Ảnh mặt sau GPLX
                                  </p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Mặt có các hạng xe được phép điều khiển
                                  </p>
                                </div>
                                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer transition-all active:scale-95">
                                  <Upload size={14} />
                                  <span>{isUploadingBack ? 'Đang tải ảnh...' : 'Tải ảnh từ thiết bị'}</span>
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
                                <div className="flex flex-col items-center gap-2">
                                  <Loader2 size={24} className="animate-spin text-emerald-400" />
                                  <span className="text-xs font-semibold">Đang xử lý tệp ảnh...</span>
                                </div>
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

                {/* DÀNH CHO SINH VIÊN */}
                {isStudentOrPassenger && (
                  <div className="space-y-4">
                    <div className="p-6 rounded-3xl bg-gradient-to-br from-cyan-500/10 via-emerald-500/10 to-teal-500/10 border border-emerald-500/30">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="size-11 rounded-2xl bg-emerald-600/20 text-emerald-600 flex items-center justify-center font-bold">
                          <GraduationCap size={24} />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-foreground">
                            Thẻ Ưu Đãi Sinh Viên ICTU Bus Transit
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Áp dụng mức trợ giá 50% vé xe buýt toàn bộ mạng lưới tuyến học đường
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
                        <div className="p-4 rounded-2xl bg-card border border-border">
                          <span className="text-muted-foreground block font-medium">Mã số sinh viên</span>
                          <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                            {studentId || 'Chưa liên kết mã SV'}
                          </span>
                        </div>
                        <div className="p-4 rounded-2xl bg-card border border-border">
                          <span className="text-muted-foreground block font-medium">Khoa / Đơn vị trực thuộc</span>
                          <span className="text-sm font-bold text-foreground mt-1 block">
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
                    <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-slate-900/10 border border-indigo-500/30">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="size-11 rounded-2xl bg-indigo-600/20 text-indigo-600 flex items-center justify-center font-bold">
                          <ShieldCheck size={24} />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-foreground">
                            Trung Tâm Điều Hành & Ban Quản Trị Hệ Thống
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Thẩm quyền điều phối vận tải, giám sát phương tiện và thẩm định hồ sơ bằng lái tài xế
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
                        <div className="p-4 rounded-2xl bg-card border border-border">
                          <span className="text-muted-foreground block font-medium">Cấp bậc ủy quyền</span>
                          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                            {roleName.toUpperCase()} - TOÀN QUYỀN VẬN HÀNH
                          </span>
                        </div>
                        <div className="p-4 rounded-2xl bg-card border border-border">
                          <span className="text-muted-foreground block font-medium">Trạng thái bảo mật</span>
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
              <form onSubmit={handleChangePassword} className="space-y-5">
                <div>
                  <h3 className="text-base font-black text-foreground flex items-center gap-2">
                    <KeyRound className="size-5 text-emerald-600" />
                    Đổi Mật Khẩu Tài Khoản
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mật khẩu mới phải có tối thiểu 6 ký tự để bảo vệ tài khoản khi vận hành hệ thống.
                  </p>
                </div>

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
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Mật khẩu hiện tại <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showOldPassword ? 'text' : 'password'}
                      required
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Nhập mật khẩu đang dùng"
                      className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-10 text-xs font-mono text-foreground focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Mật khẩu mới */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Mật khẩu mới (Tối thiểu 6 ký tự) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nhập mật khẩu mới an toàn"
                      className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-10 text-xs font-mono text-foreground focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

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
                                : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        Độ an toàn: {passwordStrength <= 2 ? 'Yếu' : passwordStrength <= 3 ? 'Trung bình' : 'Rất mạnh'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Xác nhận mật khẩu mới */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Xác nhận lại mật khẩu mới <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-10 text-xs font-mono text-foreground focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-bold">Lưu ý: </span>
                  Sau khi đổi mật khẩu thành công, bạn sẽ sử dụng mật khẩu mới này cho tất cả các lần đăng nhập tiếp theo trên buồng lái xe buýt và cổng điều hành.
                </div>

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
    </div>
  )
}
