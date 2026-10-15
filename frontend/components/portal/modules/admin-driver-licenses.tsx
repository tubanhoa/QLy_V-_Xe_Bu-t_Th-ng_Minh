'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  IdCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ZoomIn,
  RotateCw,
  X,
  FileCheck2,
  FileX2,
  Edit3,
  Calendar,
  Phone,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Upload,
  Loader2,
  AlertTriangle,
  User,
} from 'lucide-react'
import {
  driverProfileService,
} from '@/lib/services/driver-profile.service'
import { authService } from '@/lib/services/auth.service'
import {
  DriverWithProfileItem,
  DriverProfileKPIs,
} from '@/lib/types/driver-profile'
import { formatProofUrl } from '@/lib/utils'

export function AdminDriverLicenses() {
  const [items, setItems] = useState<DriverWithProfileItem[]>([])
  const [kpis, setKpis] = useState<DriverProfileKPIs>({
    totalDrivers: 0,
    approvedCount: 0,
    pendingCount: 0,
    rejectedCount: 0,
    unsubmittedCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Review Modal State
  const [reviewingDriver, setReviewingDriver] = useState<DriverWithProfileItem | null>(null)
  const [isRejectOpen, setIsRejectOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)

  // Manual Edit / Create Modal State
  const [editingDriver, setEditingDriver] = useState<DriverWithProfileItem | null>(null)
  const [editLicenseNumber, setEditLicenseNumber] = useState('')
  const [editLicenseClass, setEditLicenseClass] = useState('D')
  const [editIssueDate, setEditIssueDate] = useState('')
  const [editExpiryDate, setEditExpiryDate] = useState('')
  const [editFrontUrl, setEditFrontUrl] = useState('')
  const [editBackUrl, setEditBackUrl] = useState('')
  const [editStatus, setEditStatus] = useState<'pending' | 'approved' | 'rejected'>('approved')
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  const [isUploadingFront, setIsUploadingFront] = useState(false)
  const [isUploadingBack, setIsUploadingBack] = useState(false)

  // Lightbox State
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null)
  const [lightboxRotation, setLightboxRotation] = useState(0)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4500)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await driverProfileService.getDriverProfiles({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search.trim() || undefined,
      })
      if (res.success && res.data) {
        setItems(res.data.items || [])
        setKpis(res.data.kpis)
      } else {
        showToast(res.message || 'Không thể tải danh sách hồ sơ tài xế', 'error')
      }
    } catch {
      showToast('Lỗi kết nối khi tải danh sách hồ sơ', 'error')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Xử lý mở Modal Thẩm Định
  const handleOpenReview = (item: DriverWithProfileItem) => {
    setReviewingDriver(item)
    setIsRejectOpen(false)
    setRejectionReason('')
  }

  // Phê duyệt nhanh
  const handleApprove = async () => {
    if (!reviewingDriver) return
    setIsSubmittingReview(true)
    try {
      const res = await driverProfileService.reviewDriverProfile(reviewingDriver.driver.id, {
        status: 'approved',
      })
      if (res.success) {
        showToast(`Đã phê duyệt GPLX cho tài xế ${reviewingDriver.driver.fullName} thành công!`)
        setReviewingDriver(null)
        await loadData()
      } else {
        showToast(res.message || 'Không thể phê duyệt hồ sơ', 'error')
      }
    } catch {
      showToast('Lỗi khi gửi yêu cầu phê duyệt', 'error')
    } finally {
      setIsSubmittingReview(false)
    }
  }

  // Xác nhận từ chối kèm lý do
  const handleConfirmReject = async () => {
    if (!reviewingDriver) return
    if (!rejectionReason.trim()) {
      showToast('Vui lòng nhập lý do từ chối hồ sơ cụ thể!', 'error')
      return
    }
    setIsSubmittingReview(true)
    try {
      const res = await driverProfileService.reviewDriverProfile(reviewingDriver.driver.id, {
        status: 'rejected',
        rejectionReason: rejectionReason.trim(),
      })
      if (res.success) {
        showToast(`Đã từ chối hồ sơ GPLX của tài xế ${reviewingDriver.driver.fullName}!`)
        setReviewingDriver(null)
        setIsRejectOpen(false)
        await loadData()
      } else {
        showToast(res.message || 'Không thể từ chối hồ sơ', 'error')
      }
    } catch {
      showToast('Lỗi khi gửi yêu cầu từ chối hồ sơ', 'error')
    } finally {
      setIsSubmittingReview(false)
    }
  }

  // Mở modal sửa / cập nhật thủ công
  const handleOpenEdit = (item: DriverWithProfileItem) => {
    setEditingDriver(item)
    setEditLicenseNumber(item.profile?.licenseNumber || '')
    setEditLicenseClass(item.profile?.licenseClass || 'D')
    setEditIssueDate(item.profile?.issueDate ? item.profile.issueDate.substring(0, 10) : '')
    setEditExpiryDate(item.profile?.expiryDate ? item.profile.expiryDate.substring(0, 10) : '')
    setEditFrontUrl(item.profile?.frontImageUrl || '')
    setEditBackUrl(item.profile?.backImageUrl || '')
    setEditStatus(item.profile?.status || 'approved')
  }

  // Lưu chỉnh sửa thủ công
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDriver) return
    if (!editLicenseNumber.trim()) {
      showToast('Vui lòng nhập Số Giấy phép lái xe!', 'error')
      return
    }
    if (!editFrontUrl.trim()) {
      showToast('Vui lòng cung cấp ảnh mặt trước của GPLX!', 'error')
      return
    }

    setIsSubmittingEdit(true)
    try {
      const res = await driverProfileService.upsertDriverProfile(editingDriver.driver.id, {
        licenseNumber: editLicenseNumber.trim(),
        licenseClass: editLicenseClass,
        issueDate: editIssueDate || undefined,
        expiryDate: editExpiryDate || undefined,
        frontImageUrl: editFrontUrl.trim(),
        backImageUrl: editBackUrl.trim() || undefined,
        status: editStatus,
      })

      if (res.success) {
        showToast(`Đã cập nhật hồ sơ bằng lái cho tài xế ${editingDriver.driver.fullName} thành công!`)
        setEditingDriver(null)
        await loadData()
      } else {
        showToast(res.message || 'Không thể cập nhật hồ sơ bằng lái', 'error')
      }
    } catch {
      showToast('Lỗi khi gửi thông tin cập nhật', 'error')
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  // Upload file minh chứng
  const handleUploadImage = async (file: File, isFront: boolean) => {
    if (isFront) setIsUploadingFront(true)
    else setIsUploadingBack(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = authService.getToken()

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001/api/v1'}/monthly-passes/upload-proof`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      const data = await res.json()
      if (res.ok && data?.data?.fileUrl) {
        if (isFront) setEditFrontUrl(data.data.fileUrl)
        else setEditBackUrl(data.data.fileUrl)
        showToast(`Tải lên ảnh ${isFront ? 'mặt trước' : 'mặt sau'} thành công!`)
      } else {
        showToast(data?.message || 'Không thể tải ảnh lên', 'error')
      }
    } catch {
      showToast('Lỗi kết nối khi tải ảnh', 'error')
    } finally {
      if (isFront) setIsUploadingFront(false)
      else setIsUploadingBack(false)
    }
  }

  const QUICK_REJECTION_REASONS = [
    'Ảnh chụp bị lóa sáng, mất góc hoặc không rõ số GPLX',
    'Bằng lái xe không thuộc Hạng D hoặc Hạng E theo quy chuẩn xe buýt chở khách',
    'Giấy phép lái xe đã hết hạn sử dụng theo niên hạn',
    'Họ tên và ngày sinh trên bằng lái không khớp với hồ sơ nhân sự',
    'Thiếu ảnh chụp mặt sau có dấu cơ quan cấp bằng',
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* TOAST FEEDBACK */}
      {feedback && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-xs font-bold text-white shadow-2xl transition-all animate-in slide-in-from-bottom-5 ${
            feedback.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <IdCard size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Hồ Sơ & Thẩm Định Bằng Lái Tài Xế
              </h1>
              <p className="text-xs text-muted-foreground">
                Kiểm soát chứng chỉ hành nghề, thẩm định GPLX Hạng D/E để đủ điều kiện phân công chuyến xe an toàn
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-2xs hover:bg-muted disabled:opacity-50 cursor-pointer transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 4 THẺ KPI TRỰC QUAN */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Tổng Số Tài Xế</span>
            <User size={16} className="text-blue-500" />
          </div>
          <p className="mt-3 text-2xl font-black text-foreground">{kpis.totalDrivers}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Tài khoản tài xế trong hệ thống</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-semibold">Đã Duyệt GPLX (Hợp Lệ)</span>
            <ShieldCheck size={16} />
          </div>
          <p className="mt-3 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {kpis.approvedCount}
          </p>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-1">Đủ điều kiện phân công cầm lái</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-xs font-semibold">Đang Chờ Duyệt</span>
            <Clock size={16} />
          </div>
          <p className="mt-3 text-2xl font-black text-amber-600 dark:text-amber-400">
            {kpis.pendingCount}
          </p>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-1">Cần Admin thẩm định hồ sơ</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-red-600 dark:text-red-400">
            <span className="text-xs font-semibold">Từ Chối / Chưa Nộp</span>
            <ShieldAlert size={16} />
          </div>
          <p className="mt-3 text-2xl font-black text-red-600 dark:text-red-400">
            {kpis.rejectedCount + kpis.unsubmittedCount}
          </p>
          <p className="text-[11px] text-red-700/80 dark:text-red-300/80 mt-1">Bị chặn phân công chuyến xe</p>
        </div>
      </div>

      {/* THANH CÔNG CỤ TÌM KIẾM & BỘ LỌC */}
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        {/* TABS TRẠNG THÁI */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'pending', label: `Chờ duyệt (${kpis.pendingCount})` },
            { id: 'approved', label: `Đã duyệt (${kpis.approvedCount})` },
            { id: 'rejected', label: `Bị từ chối (${kpis.rejectedCount})` },
            { id: 'unsubmitted', label: `Chưa có GPLX (${kpis.unsubmittedCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Ô TÌM KIẾM */}
        <div className="relative min-w-[260px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, SĐT, số GPLX..."
            className="w-full rounded-2xl border border-border bg-background py-2 pl-9 pr-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* BẢNG DANH SÁCH TÀI XẾ & HỒ SƠ GPLX */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                <th className="p-4 font-bold">Tài xế & Liên hệ</th>
                <th className="p-4 font-bold">Số GPLX & Hạng bằng</th>
                <th className="p-4 font-bold">Thời hạn bằng lái</th>
                <th className="p-4 font-bold">Trạng thái thẩm định</th>
                <th className="p-4 font-bold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    <Loader2 size={24} className="animate-spin mx-auto text-emerald-600 mb-2" />
                    <span>Đang tải danh sách hồ sơ bằng lái...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Không tìm thấy hồ sơ tài xế nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const p = item.profile
                  return (
                    <tr key={item.driver.id} className="hover:bg-muted/30 transition-colors">
                      {/* Cột 1: Thông tin tài xế */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 font-bold text-sm">
                            {item.driver.fullName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <span>{item.driver.fullName}</span>
                              {item.status === 'approved' && (
                                <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                  Hợp lệ
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1">
                                <Phone size={11} /> {item.driver.phoneNumber || 'Chưa có SĐT'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Mail size={11} /> {item.driver.email}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Số GPLX & Hạng */}
                      <td className="p-4">
                        {p ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-foreground">
                                {p.licenseNumber}
                              </span>
                              <span className="rounded-lg bg-blue-500/10 px-2 py-0.5 font-bold text-blue-600 dark:text-blue-400 text-[11px]">
                                Hạng {p.licenseClass}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {p.licenseClass === 'D'
                                ? 'Xe buýt chở khách 29-45 chỗ'
                                : p.licenseClass === 'E'
                                  ? 'Xe khách trên 45 chỗ / Liên tỉnh'
                                  : 'Giấy phép hành nghề'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">
                            Chưa cập nhật số hiệu GPLX
                          </span>
                        )}
                      </td>

                      {/* Cột 3: Thời hạn bằng lái */}
                      <td className="p-4">
                        {p && (p.issueDate || p.expiryDate) ? (
                          <div className="space-y-0.5 text-[11px]">
                            {p.issueDate && (
                              <div className="text-muted-foreground">
                                Cấp ngày: <span className="font-medium text-foreground">{p.issueDate}</span>
                              </div>
                            )}
                            {p.expiryDate && (
                              <div className="text-muted-foreground">
                                Hết hạn: <span className="font-bold text-foreground">{p.expiryDate}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Không xác định</span>
                        )}
                      </td>

                      {/* Cột 4: Trạng thái thẩm định */}
                      <td className="p-4">
                        {item.status === 'approved' && (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={13} />
                            Đã Phê Duyệt
                          </span>
                        )}
                        {item.status === 'pending' && (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <Clock size={13} />
                              Chờ Thẩm Định
                            </span>
                            <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80 italic">Chưa đủ điều kiện xếp ca</p>
                          </div>
                        )}
                        {item.status === 'rejected' && (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-600 dark:text-red-400 border border-red-500/20">
                              <AlertCircle size={13} />
                              Bị Từ Chối
                            </span>
                            {p?.rejectionReason && (
                              <p className="text-[10px] text-red-600 dark:text-red-400 line-clamp-1" title={p.rejectionReason}>
                                Lý do: {p.rejectionReason}
                              </p>
                            )}
                          </div>
                        )}
                        {item.status === 'unsubmitted' && (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                            Chưa Nộp GPLX
                          </span>
                        )}
                      </td>

                      {/* Cột 5: Thao tác */}
                      <td className="p-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {p ? (
                            <button
                              onClick={() => handleOpenReview(item)}
                              className="rounded-xl border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer transition flex items-center gap-1"
                              title="Xem chi tiết & thẩm định bằng lái"
                            >
                              <FileCheck2 size={13} />
                              <span>Thẩm Định</span>
                            </button>
                          ) : null}

                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer transition flex items-center gap-1"
                            title="Chỉnh sửa hoặc cấp GPLX trực tiếp"
                          >
                            <Edit3 size={13} />
                            <span>{p ? 'Sửa' : 'Cấp Bằng'}</span>
                          </button>
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

      {/* ========================================================================= */}
      {/* MODAL 1: THẨM ĐỊNH HỒ SƠ GPLX (REVIEW & SOI ẢNH LIGHTBOX)                  */}
      {/* ========================================================================= */}
      {reviewingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <IdCard size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Thẩm Định Giấy Phép Lái Xe
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Tài xế: <strong className="text-foreground">{reviewingDriver.driver.fullName}</strong> ({reviewingDriver.driver.phoneNumber || reviewingDriver.driver.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReviewingDriver(null)}
                className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Thông tin bằng lái khai báo */}
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/40 p-3.5 border border-border text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Số Giấy phép lái xe:</span>
                <span className="font-mono font-bold text-sm text-foreground">
                  {reviewingDriver.profile?.licenseNumber || 'Chưa cập nhật'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Hạng bằng đào tạo:</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={13} />
                  Hạng {reviewingDriver.profile?.licenseClass || 'D'} (Đủ điều kiện xe buýt)
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Thời hạn hiệu lực:</span>
                <span className="font-medium text-foreground">
                  {reviewingDriver.profile?.issueDate || 'N/A'} $\rightarrow$ {reviewingDriver.profile?.expiryDate || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Trạng thái hiện tại:</span>
                <span className="font-bold text-foreground">
                  {reviewingDriver.status === 'approved'
                    ? 'Đã duyệt hợp lệ'
                    : reviewingDriver.status === 'pending'
                      ? 'Đang chờ Admin duyệt'
                      : 'Đã bị từ chối'}
                </span>
              </div>
            </div>

            {/* Vùng xem ảnh minh chứng 2 mặt */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-foreground">Ảnh Chụp Minh Chứng GPLX:</span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ZoomIn size={12} /> Chạm vào ảnh để soi chi tiết (Lightbox)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Mặt trước */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground">Mặt trước GPLX:</span>
                  <div
                    onClick={() =>
                      setLightboxImage({
                        url: formatProofUrl(reviewingDriver.profile?.frontImageUrl),
                        title: `GPLX Mặt Trước - ${reviewingDriver.driver.fullName}`,
                      })
                    }
                    className="relative h-44 w-full rounded-2xl overflow-hidden border border-border bg-black/5 dark:bg-white/5 flex items-center justify-center cursor-zoom-in group"
                  >
                    <img
                      src={formatProofUrl(reviewingDriver.profile?.frontImageUrl)}
                      alt="GPLX Mặt Trước"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="px-3 py-1 rounded-xl bg-black/75 text-white text-[11px] font-bold flex items-center gap-1">
                        <ZoomIn size={12} /> Phóng to ảnh
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mặt sau */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground">Mặt sau GPLX:</span>
                  <div
                    onClick={() =>
                      setLightboxImage({
                        url: formatProofUrl(reviewingDriver.profile?.backImageUrl || reviewingDriver.profile?.frontImageUrl),
                        title: `GPLX Mặt Sau - ${reviewingDriver.driver.fullName}`,
                      })
                    }
                    className="relative h-44 w-full rounded-2xl overflow-hidden border border-border bg-black/5 dark:bg-white/5 flex items-center justify-center cursor-zoom-in group"
                  >
                    <img
                      src={formatProofUrl(reviewingDriver.profile?.backImageUrl || reviewingDriver.profile?.frontImageUrl)}
                      alt="GPLX Mặt Sau"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="px-3 py-1 rounded-xl bg-black/75 text-white text-[11px] font-bold flex items-center gap-1">
                        <ZoomIn size={12} /> Phóng to ảnh
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* FORM TỪ CHỐI (KHI BẤM NÚT TỪ CHỐI) */}
            {isRejectOpen ? (
              <div className="rounded-2xl border border-red-200 bg-red-50/70 dark:border-red-950/40 dark:bg-red-950/20 p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                    <AlertTriangle size={15} />
                    Nhập Lý Do Từ Chối Hồ Sơ GPLX:
                  </h4>
                  <button
                    onClick={() => setIsRejectOpen(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Đóng
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Nhập lý do cụ thể gửi tới tài xế..."
                  className="w-full rounded-xl border border-red-300 dark:border-red-900 bg-background p-2.5 text-xs text-foreground focus:outline-none"
                />

                {/* Quick Rejection Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REJECTION_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRejectionReason(r)}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-card border border-red-200 dark:border-red-900 text-[10px] text-red-700 dark:text-red-300 hover:bg-red-100 cursor-pointer text-left"
                    >
                      + {r}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setIsRejectOpen(false)}
                    className="px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    disabled={isSubmittingReview || !rejectionReason.trim()}
                    onClick={handleConfirmReject}
                    className="px-4 py-1.5 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {isSubmittingReview ? 'Đang xử lý...' : 'Xác Nhận Từ Chối'}
                  </button>
                </div>
              </div>
            ) : null}

            {/* ACTION BUTTONS */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setReviewingDriver(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Đóng
              </button>

              <div className="flex items-center gap-2">
                {!isRejectOpen && (
                  <button
                    type="button"
                    onClick={() => setIsRejectOpen(true)}
                    className="rounded-xl border border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40 px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 cursor-pointer"
                  >
                    Từ Chối Hồ Sơ
                  </button>
                )}

                <button
                  type="button"
                  disabled={isSubmittingReview}
                  onClick={handleApprove}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  <span>{isSubmittingReview ? 'Đang duyệt...' : 'Phê Duyệt GPLX Hợp Lệ'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: TẠO MỚI / CHỈNH SỬA THỦ CÔNG (MANUAL EDIT / ADD GPLX)             */}
      {/* ========================================================================= */}
      {editingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Edit3 size={18} className="text-emerald-600" />
                  Cập Nhật Giấy Phép Lái Xe
                </h3>
                <p className="text-xs text-muted-foreground">
                  Tài xế: <strong className="text-foreground">{editingDriver.driver.fullName}</strong>
                </p>
              </div>
              <button
                onClick={() => setEditingDriver(null)}
                className="rounded-xl p-1 text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    Số GPLX <span className="text-red-500">*</span>:
                  </label>
                  <input
                    type="text"
                    value={editLicenseNumber}
                    onChange={(e) => setEditLicenseNumber(e.target.value)}
                    placeholder="VD: GPLX-20-D-199887"
                    className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:border-emerald-500 focus:outline-none font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    Hạng Bằng Lái <span className="text-red-500">*</span>:
                  </label>
                  <select
                    value={editLicenseClass}
                    onChange={(e) => setEditLicenseClass(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:border-emerald-500 focus:outline-none cursor-pointer font-bold"
                  >
                    <option value="D">Hạng D (Xe buýt 29-45 chỗ)</option>
                    <option value="E">Hạng E (Xe khách trên 45 chỗ)</option>
                    <option value="FD">Hạng FD (Xe đầu kéo/buýt lớn)</option>
                    <option value="FE">Hạng FE (Xe nối toa)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Ngày Cấp:</label>
                  <input
                    type="date"
                    value={editIssueDate}
                    onChange={(e) => setEditIssueDate(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background p-2 text-xs text-foreground focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Ngày Hết Hạn:</label>
                  <input
                    type="date"
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background p-2 text-xs text-foreground focus:outline-none"
                  />
                </div>
              </div>

              {/* Upload ảnh mặt trước */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Ảnh Mặt Trước GPLX <span className="text-red-500">*</span>:</span>
                  <label className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer flex items-center gap-1">
                    <Upload size={12} />
                    {isUploadingFront ? 'Đang tải...' : 'Tải tệp từ máy'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUploadImage(file, true)
                      }}
                    />
                  </label>
                </label>
                <input
                  type="text"
                  value={editFrontUrl}
                  onChange={(e) => setEditFrontUrl(e.target.value)}
                  placeholder="URL ảnh mặt trước hoặc tải tệp"
                  className="w-full rounded-xl border border-border bg-background p-2 text-xs text-foreground focus:outline-none text-[11px]"
                  required
                />
              </div>

              {/* Upload ảnh mặt sau */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>Ảnh Mặt Sau GPLX:</span>
                  <label className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer flex items-center gap-1">
                    <Upload size={12} />
                    {isUploadingBack ? 'Đang tải...' : 'Tải tệp từ máy'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUploadImage(file, false)
                      }}
                    />
                  </label>
                </label>
                <input
                  type="text"
                  value={editBackUrl}
                  onChange={(e) => setEditBackUrl(e.target.value)}
                  placeholder="URL ảnh mặt sau (tùy chọn)"
                  className="w-full rounded-xl border border-border bg-background p-2 text-xs text-foreground focus:outline-none text-[11px]"
                />
              </div>

              {/* Chọn trạng thái thẩm định */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Trạng thái phê duyệt:</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-border bg-background p-2 text-xs text-foreground font-bold cursor-pointer"
                >
                  <option value="approved">Đã Phê Duyệt (Cho phép phân công ngay)</option>
                  <option value="pending">Chờ Thẩm Định (Tạm giữ xét duyệt sau)</option>
                  <option value="rejected">Bị Từ Chối (Chặn phân công)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingDriver(null)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingEdit ? 'Đang lưu...' : 'Lưu Hồ Sơ GPLX'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LIGHTBOX SOI ẢNH CHI TIẾT (ZOOM IN, XOAY ẢNH, MỞ ẢNH GỐC)                  */}
      {/* ========================================================================= */}
      {lightboxImage && (
        <div
          onClick={() => {
            setLightboxImage(null)
            setLightboxRotation(0)
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-col items-center max-w-4xl max-h-[90vh] w-full"
          >
            {/* Header Lightbox */}
            <div className="w-full flex items-center justify-between pb-3 text-white">
              <span className="text-sm font-bold truncate">{lightboxImage.title}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLightboxRotation((prev) => (prev + 90) % 360)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition flex items-center gap-1 text-xs"
                  title="Xoay 90 độ"
                >
                  <RotateCw size={14} /> Xoay ảnh
                </button>
                <a
                  href={lightboxImage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition flex items-center gap-1 text-xs"
                >
                  <ExternalLink size={14} /> Mở tab mới
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setLightboxImage(null)
                    setLightboxRotation(0)
                  }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Khung ảnh */}
            <div className="relative flex items-center justify-center overflow-hidden rounded-2xl bg-black/40 border border-white/10 max-h-[75vh] w-full">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                style={{ transform: `rotate(${lightboxRotation}deg)` }}
                className="max-h-[72vh] max-w-full object-contain transition-transform duration-200 shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
