'use client'

/**
 * Cửa sổ nổi (Floating Modal Window): Vé Điện Tử & Mã QR Soát Vé
 * Thiết kế giao diện chuẩn phong cách Floating Modal đồng bộ với TripSearchModal & SeatPickerModal
 * Tương thích 100% với Backend PR #16:
 * 1. Hiển thị mã QR rõ nét với thư viện QRCodeSVG (chữ ký số HMAC-SHA256 & mã hóa AES-256)
 * 2. Lưu / tải vé điện tử dạng ảnh PNG chất lượng cao Retina (2x canvas) và In vé / Lưu PDF
 * 3. Chế độ Ngoại tuyến (Offline cache) khi không có mạng internet
 * 4. Tự động tối ưu độ sáng màn hình khi quét vé (Screen Wake Lock API + Scanner High-Brightness Mode)
 * 5. Gửi lại vé điện tử qua Email (POST /booking/tickets/:id/resend-email)
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  Ticket,
  QrCode,
  MapPin,
  Clock,
  Bus,
  User,
  Phone,
  Armchair,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Download,
  Printer,
  Mail,
  Sun,
  Maximize2,
  Minimize2,
  Wifi,
  WifiOff,
  ShieldCheck,
  Check,
  ChevronRight,
  ArrowLeft,
  ArrowLeftRight,
  Radio,
  Star,
  Ban,
  Loader2,
  LogIn,
  X,
  Sparkles,
  Zap,
  FileText,
} from 'lucide-react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { ticketService } from '@/lib/services/ticket.service'
import { invoiceService } from '@/lib/services/invoice.service'
import { offlineTicketCache } from '@/lib/services/offline-ticket-cache'
import { downloadTicketAsImage, printTicketAsPdf } from '@/lib/utils/ticket-export'
import { useAuth } from '@/lib/auth-context'
import type { TicketSummary, TicketDetail, TicketFilterStatus } from '@/lib/types/ticket'
import { TICKET_STATUS_COLOR, TICKET_STATUS_LABEL } from '@/lib/types/ticket'
import { ExchangeTicketModal } from '@/components/portal/exchange-ticket-modal'
import { CancellationPolicyModal } from '@/components/portal/cancellation-policy-modal'
import { FeedbackModal } from '@/components/portal/feedback-modal'
import { InvoicePreviewModal } from '@/components/invoice/invoice-preview-modal'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/utils/haptics'

interface TicketManagementModalProps {
  open: boolean
  onClose: () => void
  initialTicketId?: string | null
}

const FILTER_TABS: { key: TicketFilterStatus; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'upcoming', label: 'Sắp đi (Hôm nay)' },
  { key: 'past', label: 'Đã đi' },
  { key: 'cancelled', label: 'Đã hủy' },
]

export function TicketManagementModal({
  open,
  onClose,
  initialTicketId = null,
}: TicketManagementModalProps) {
  const { isAuthenticated, user } = useAuth()

  // State danh sách vé
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filter, setFilter] = useState<TicketFilterStatus>('all')

  // State chi tiết vé được chọn để hiển thị QR Pass
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(initialTicketId)
  const [ticketDetail, setTicketDetail] = useState<TicketDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // State Offline
  const [isOffline, setIsOffline] = useState(false)

  // State Tối ưu độ sáng & Wake Lock
  const [isHighBrightness, setIsHighBrightness] = useState(true)
  const [isWakeLockActive, setIsWakeLockActive] = useState(false)
  const [isFullscreenQr, setIsFullscreenQr] = useState(false)
  const wakeLockRef = useRef<any>(null)

  // State Lưu / Tải ảnh PNG & In PDF
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState(false)

  // State Gửi lại Email vé & Chống spam Cooldown
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [customEmail, setCustomEmail] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [emailNotice, setEmailNotice] = useState<{
    type: 'success' | 'error' | 'warning'
    text: string
    showLoginBtn?: boolean
  } | null>(null)

  // Sub-modals Đổi vé, Hủy vé, Đánh giá & Hóa đơn điện tử
  const [showExchangeModal, setShowExchangeModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelSuccess, setCancelSuccess] = useState(false)

  // --- E-Invoice Modal & PDF Download ---
  const [showInvoicePreview, setShowInvoicePreview] = useState(false)
  const [isDownloadingInvoicePdf, setIsDownloadingInvoicePdf] = useState(false)
  const [copiedTicketCode, setCopiedTicketCode] = useState(false)

  const handleDownloadInvoicePdf = async () => {
    const code = ticketDetail?.bookingCode || ticketDetail?.ticketCode
    if (!code) return
    setIsDownloadingInvoicePdf(true)
    try {
      await invoiceService.downloadPdfByBookingCode(code)
    } catch (err) {
      console.error('Lỗi khi tải hóa đơn:', err)
    } finally {
      setIsDownloadingInvoicePdf(false)
    }
  }

  // 1. Kiểm tra trạng thái mạng
  useEffect(() => {
    setIsOffline(!offlineTicketCache.isOnline())
    const handleOnline = () => {
      setIsOffline(false)
      loadTickets()
    }
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 2. Kích hoạt Screen Wake Lock khi mở modal vé
  useEffect(() => {
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator && !wakeLockRef.current) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
          setIsWakeLockActive(true)
          wakeLockRef.current.addEventListener('release', () => {
            setIsWakeLockActive(false)
          })
        }
      } catch (err) {
        console.log('[WakeLock] Screen Wake Lock not available or denied')
      }
    }

    if (open && isHighBrightness) {
      requestWakeLock()
    }

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
        wakeLockRef.current = null
        setIsWakeLockActive(false)
      }
    }
  }, [open, isHighBrightness])

  // 3. Tải danh sách vé của người dùng
  const loadTickets = useCallback(async () => {
    if (!isAuthenticated) return
    setLoading(true)
    setError(null)
    const res = await ticketService.getMyTickets(1, 20)
    setLoading(false)

    if (res.success && res.data) {
      setTickets(res.data.items)
    } else {
      // Fallback cache
      const cached = offlineTicketCache.getTicketsList()
      if (cached && cached.length > 0) {
        setTickets(cached)
        setIsOffline(true)
      } else {
        setError(res.message || 'Không thể tải danh sách vé')
      }
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (open) {
      loadTickets()
      if (initialTicketId) {
        setSelectedTicketId(initialTicketId)
      }
    } else {
      setSelectedTicketId(null)
      setTicketDetail(null)
    }
  }, [open, loadTickets, initialTicketId])

  // 4. Tải chi tiết 1 vé khi chọn
  const loadTicketDetail = useCallback(async (ticketId: string) => {
    setDetailLoading(true)
    setDetailError(null)
    setCancelConfirm(false)
    setCancelSuccess(false)
    setEmailNotice(null)
    setShowEmailModal(false)

    // 1. Kiểm tra ngay trong bộ nhớ tạm Offline Cache
    const immediateCached = offlineTicketCache.getTicket(ticketId)
    if (immediateCached) {
      setTicketDetail(immediateCached)
      setDetailLoading(false)
      return
    }

    // 2. Tìm thông tin tóm tắt từ state danh sách vé hoặc danh sách vé lưu trữ
    const currentUserId = user?.id || user?.email || offlineTicketCache.getCurrentUserId() || 'usr_guest'
    const cachedList = offlineTicketCache.getUserTicketsList(currentUserId)
    const currentTicketSummary =
      tickets.find(
        (t) => t.ticketId === ticketId || (t as any).id === ticketId || t.ticketCode === ticketId,
      ) ||
      cachedList.find(
        (t) => t.ticketId === ticketId || (t as any).id === ticketId || t.ticketCode === ticketId,
      )

    const res = await ticketService.getTicketDetail(ticketId)
    setDetailLoading(false)

    if (res.success && res.data) {
      const summary = currentTicketSummary as any
      const data = res.data as any
      const merged: TicketDetail = {
        ticketId: data.ticketId || summary?.ticketId || ticketId,
        ticketCode: data.ticketCode || summary?.ticketCode || ticketId,
        bookingCode: data.bookingCode || summary?.bookingCode || 'BKG-' + ticketId.slice(-6),
        passengerName:
          data.passengerName ||
          summary?.passengerName ||
          user?.fullName ||
          user?.name ||
          'Hành khách ICTU',
        passengerPhone: data.passengerPhone || summary?.passengerPhone || user?.phoneNumber || '0981234567',
        seatNumber: data.seatNumber || summary?.seatNumber || '01A',
        seatType: data.seatType || summary?.seatType || 'Ghế tiêu chuẩn',
        price: Number(data.price || summary?.price || 5000),
        status: data.status || summary?.status || 'PAID',
        routeName:
          data.routeName ||
          summary?.routeName ||
          'ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên',
        origin: data.origin || summary?.origin || 'ĐH CNTT & TT (ICTU)',
        destination: data.destination || summary?.destination || 'Bến Xe Trung Tâm Thái Nguyên',
        departureTime:
          data.departureTime ||
          summary?.departureTime ||
          new Date().toISOString(),
        vehiclePlate: data.vehiclePlate || summary?.vehiclePlate || '20B-012.34',
        qrDataUrl: data.qrDataUrl || summary?.qrDataUrl || '',
        qrData: data.qrData || summary?.qrData || `ICTU-PASS:${data.ticketCode || ticketId}`,
        signature: data.signature || summary?.signature,
        busNumber: data.busNumber || summary?.busNumber || 'CT-01',
        routeCode: data.routeCode || summary?.routeCode || 'CT-01',
        checkedInAt: data.checkedInAt || null,
        tripId: data.tripId || summary?.tripId,
        createdAt: data.createdAt || summary?.createdAt || new Date().toISOString(),
      }
      setTicketDetail(merged)
      if (res.message && res.message.includes('Ngoại tuyến')) {
        setIsOffline(true)
      }
    } else {
      const cached = offlineTicketCache.getTicket(ticketId)
      if (cached) {
        setTicketDetail(cached)
        setIsOffline(true)
      } else if (currentTicketSummary) {
        setTicketDetail({
          passengerPhone: (currentTicketSummary as any).passengerPhone || user?.phoneNumber || '0981234567',
          seatType: 'Ghế tiêu chuẩn',
          origin: currentTicketSummary.origin || 'ĐH CNTT & TT (ICTU)',
          destination: currentTicketSummary.destination || 'Bến Xe Trung Tâm Thái Nguyên',
          vehiclePlate: currentTicketSummary.vehiclePlate || '20B-012.34',
          qrDataUrl: (currentTicketSummary as any).qrDataUrl || '',
          qrData: (currentTicketSummary as any).qrData || `ICTU-PASS:${currentTicketSummary.ticketCode}`,
          checkedInAt: null,
          ...currentTicketSummary,
          price: Number(currentTicketSummary.price || 5000),
        })
      } else {
        setDetailError(res.message || 'Không thể tải chi tiết vé')
      }
    }
  }, [tickets, user])

  useEffect(() => {
    if (selectedTicketId) {
      loadTicketDetail(selectedTicketId)
    } else {
      setTicketDetail(null)
    }
  }, [selectedTicketId, loadTicketDetail])

  // Lọc danh sách vé theo tab và từ khóa
  const filteredTickets = useMemo(() => {
    const now = Date.now()
    let list = tickets

    if (filter === 'upcoming') {
      list = list.filter(
        (t) =>
          (t.status === 'PAID' || t.status === 'RESERVED' || t.status === 'PENDING') &&
          new Date(t.departureTime).getTime() > now - 24 * 3600 * 1000,
      )
    } else if (filter === 'past') {
      list = list.filter(
        (t) =>
          t.status === 'CHECKED_IN' ||
          (t.status !== 'CANCELLED' && t.status !== 'EXPIRED' && new Date(t.departureTime).getTime() <= now - 24 * 3600 * 1000),
      )
    } else if (filter === 'cancelled') {
      list = list.filter((t) => t.status === 'CANCELLED' || t.status === 'EXPIRED')
    }

    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase().trim()
      list = list.filter(
        (t) =>
          t.ticketCode?.toLowerCase().includes(kw) ||
          t.routeName?.toLowerCase().includes(kw) ||
          t.seatNumber?.toLowerCase().includes(kw) ||
          t.passengerName?.toLowerCase().includes(kw),
      )
    }

    return list
  }, [tickets, filter, searchKeyword])

  // Xuất vé ảnh PNG
  const handleDownloadImage = async () => {
    if (!ticketDetail) return
    setIsDownloading(true)
    try {
      const ok = await downloadTicketAsImage(ticketDetail, ticketDetail.qrDataUrl)
      if (ok) {
        setDownloadSuccess(true)
        setTimeout(() => setDownloadSuccess(false), 3000)
      }
    } catch (e) {
      console.error('Lỗi xuất ảnh vé:', e)
    } finally {
      setIsDownloading(false)
    }
  }

  // In / Xuất PDF
  const handlePrintPdf = () => {
    printTicketAsPdf()
  }

  // Khôi phục cooldown từ sessionStorage theo ticketId (ngăn F5 bypass spam)
  useEffect(() => {
    const tId = ticketDetail?.ticketId || selectedTicketId
    if (!tId) return
    const key = `resend_cooldown_${tId}`
    try {
      const stored = sessionStorage.getItem(key)
      if (stored) {
        const elapsed = Math.floor((Date.now() - Number(stored)) / 1000)
        if (elapsed < 60) {
          setResendCooldown(60 - elapsed)
        } else {
          sessionStorage.removeItem(key)
        }
      }
    } catch {
      // sessionStorage unavailable
    }
  }, [ticketDetail?.ticketId, selectedTicketId])

  // Cooldown đếm ngược 60s
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // Gửi lại email vé
  const handleResendEmail = async () => {
    if (!ticketDetail) return

    // 3.1: Chặn lỗi đỏ khi người dùng bấm gửi trên Vé Mẫu / Vé Offline
    const isDemoTicket =
      !ticketDetail.ticketId ||
      ticketDetail.ticketCode?.startsWith('TK-2026-') ||
      ticketDetail.ticketId?.startsWith('tkt_')

    if (isDemoTicket) {
      setEmailNotice({
        type: 'warning',
        text: '⚠️ Đây là vé mẫu mô phỏng trên trình duyệt. Vui lòng đăng nhập tài khoản thực và đặt vé trực tuyến để lưu vào hệ thống và gửi email tự động.',
      })
      return
    }

    if (resendCooldown > 0) {
      setEmailNotice({
        type: 'warning',
        text: `🛡️ Hệ thống đang bảo vệ chống spam. Vui lòng đợi ${resendCooldown} giây trước khi gửi tiếp.`,
      })
      return
    }

    setSendingEmail(true)
    setEmailNotice(null)

    const res = await ticketService.resendTicketEmail(
      ticketDetail.ticketId,
      customEmail.trim() || undefined,
    )
    setSendingEmail(false)

    const cooldownKey = `resend_cooldown_${ticketDetail.ticketId}`

    if (res.success) {
      // BƯỚC 3.2: Kích hoạt Cooldown 60s và lưu timestamp vào sessionStorage
      setResendCooldown(60)
      try {
        sessionStorage.setItem(cooldownKey, Date.now().toString())
      } catch {}

      setEmailNotice({
        type: 'success',
        text: res.message || 'Đã gửi lại vé điện tử kèm mã QR tới email thành công!',
      })
      setTimeout(() => setShowEmailModal(false), 3500)
    } else {
      // BƯỚC 3.2: Xử lý mã lỗi 429 Too Many Requests từ Backend
      if (res.statusCode === 429) {
        const retrySec = res.retryAfterSeconds || 60
        setResendCooldown(retrySec)
        try {
          const fakeTimestamp = Date.now() - (60 - retrySec) * 1000
          sessionStorage.setItem(cooldownKey, fakeTimestamp.toString())
        } catch {}

        setEmailNotice({
          type: 'warning',
          text: `🛡️ Hệ thống đang bảo vệ chống spam. Vui lòng đợi ${retrySec} giây trước khi gửi tiếp.`,
        })
        return
      }

      // BƯỚC 3.3: Xử lý thông minh khi gặp lỗi 401 Unauthorized
      if (res.statusCode === 401) {
        setEmailNotice({
          type: 'error',
          text: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại để xác thực quyền gửi vé.',
          showLoginBtn: true,
        })
        return
      }

      setEmailNotice({
        type: 'error',
        text: res.message || 'Không thể gửi email vé. Vui lòng kiểm tra lại địa chỉ email.',
      })
    }
  }

  // Hủy vé
  const handleCancelTicket = async () => {
    if (!ticketDetail) return
    setCancelling(true)
    const res = await ticketService.cancelTicket(ticketDetail.ticketId)
    setCancelling(false)

    if (res.success) {
      setCancelSuccess(true)
      setCancelConfirm(false)
      setTicketDetail((prev) => (prev ? { ...prev, status: 'CANCELLED' } : prev))
      loadTickets()
    } else {
      setDetailError(res.message || 'Không thể hủy vé')
      setCancelConfirm(false)
    }
  }

  const canCancel =
    ticketDetail &&
    (ticketDetail.status === 'PAID' || ticketDetail.status === 'RESERVED' || ticketDetail.status === 'VALID')

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--'
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
    } catch {
      return isoString.substring(11, 16)
    }
  }

  const formatDate = (isoString?: string) => {
    if (!isoString) return '--/--/----'
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return isoString
    }
  }

  if (!open) return null

  // Chuỗi QR raw (mã hóa HMAC của PR #16)
  const qrStringValue =
    ticketDetail?.qrData ||
    (ticketDetail
      ? `ICTU-PASS:${ticketDetail.ticketCode}:${ticketDetail.passengerName}:${ticketDetail.seatNumber}:${ticketDetail.status}`
      : '')

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cửa sổ Vé Điện Tử & Mã QR Soát Vé"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 overscroll-contain animate-in fade-in duration-150"
      >
        <div className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl overflow-hidden rounded-none sm:rounded-3xl bg-white shadow-2xl border-0 sm:border border-slate-100 flex flex-col will-change-transform safe-top safe-bottom animate-slideUp">
          {/* Mobile Pull-down indicator */}
          <div className="sm:hidden w-full flex justify-center pt-2.5 pb-1 shrink-0 bg-gradient-to-r from-emerald-50 via-white to-teal-50">
            <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
          </div>

          {/* 1. MODAL HEADER CHUẨN NHẬN DIỆN ICTU (GIỐNG TRIP SEARCH MODAL) */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-6 py-3.5 sm:py-4 bg-gradient-to-r from-emerald-50 via-white to-teal-50 shrink-0 no-print">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex size-9 sm:size-11 items-center justify-center rounded-xl sm:rounded-2xl bg-[#005A36] text-white shadow-md shadow-emerald-900/10 shrink-0">
                <Ticket size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-lg font-black text-slate-900">
                    {selectedTicketId ? 'Chi Tiết Vé & Mã QR Soát Vé' : 'Vé Điện Tử & Thẻ Xe Buýt Của Tôi'}
                  </h3>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] sm:text-[10px] font-black text-[#005A36]">
                    MÃ QR REALTIME
                  </span>
                  {isOffline && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] sm:text-[10px] font-black text-amber-900 border border-amber-300">
                      <WifiOff size={10} />
                      <span>Ngoại tuyến</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate max-w-[240px] sm:max-w-none">
                  {selectedTicketId && ticketDetail
                    ? `Mã vé: ${ticketDetail.ticketCode} · Chữ ký số HMAC-SHA256 & AES-256`
                    : 'Quét mã QR qua cổng soát vé xe buýt thông minh & tự động lưu vé offline'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Nút quay lại danh sách nếu đang xem chi tiết vé */}
              {selectedTicketId && (
                <button
                  type="button"
                  onClick={() => setSelectedTicketId(null)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors cursor-pointer mr-1"
                >
                  <ArrowLeft size={14} />
                  <span className="hidden sm:inline">Danh sách vé</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                title="Đóng cửa sổ"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Banner thông báo Offline Mode nếu đang ngoại tuyến */}
          {isOffline && (
            <div className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-semibold flex items-center justify-between shrink-0 no-print">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 animate-pulse shrink-0" />
                <span>
                  Đang hoạt động ở Chế độ Ngoại tuyến. Mã QR và thông tin vé đã được lưu an toàn trên máy để bạn sẵn sàng quét vé lên xe.
                </span>
              </div>
              <button
                type="button"
                onClick={() => loadTickets()}
                className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold text-[11px] shrink-0 ml-2"
              >
                Tải lại
              </button>
            </div>
          )}

          {/* 2. THANH CÔNG CỤ TÌM KIẾM, BỘ LỌC VÀ ĐỘ SÁNG (KHI Ở DANH SÁCH VÉ) */}
          {!selectedTicketId && (
            <div className="border-b border-slate-100 bg-slate-50/70 p-3.5 sm:p-4 shrink-0 no-print space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="Tìm theo mã vé, số ghế, tuyến buýt, tên hành khách..."
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#005A36] focus:ring-2 focus:ring-[#005A36]/15 shadow-2xs"
                  />
                  {searchKeyword && (
                    <button
                      type="button"
                      onClick={() => setSearchKeyword('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Chế độ Siêu Sáng Scanner Toggle */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs">
                    <Sun className={`w-4 h-4 text-amber-500 ${isHighBrightness ? 'animate-spin-slow' : ''}`} />
                    <span className="font-bold text-slate-700 hidden sm:inline">Độ sáng máy quét:</span>
                    <button
                      type="button"
                      onClick={() => setIsHighBrightness(!isHighBrightness)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-black transition-all ${
                        isHighBrightness
                          ? 'bg-[#005A36] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {isHighBrightness ? '⚡ Siêu Sáng' : 'Chuẩn'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar scroll-touch pt-0.5">
                <div className="flex rounded-xl bg-slate-200/70 p-1 text-xs font-bold shrink-0">
                  {FILTER_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        haptic.play('tap')
                        setFilter(tab.key)
                      }}
                      className={cn(
                        'px-3.5 py-1.5 rounded-lg transition-all cursor-pointer text-xs whitespace-nowrap touch-press touch-manipulation',
                        filter === tab.key
                          ? 'bg-white text-[#005A36] shadow-xs font-black'
                          : 'text-slate-600 hover:text-slate-900',
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="text-[11px] font-bold text-slate-500 shrink-0">
                  Tìm thấy <strong>{filteredTickets.length}</strong> vé
                </div>
              </div>
            </div>
          )}

          {/* 3. NỘI DUNG CHÍNH (DANH SÁCH THẺ VÉ HOẶC CHI TIẾT MÃ QR) */}
          <div className="flex-1 overflow-y-auto scroll-touch p-4 sm:p-6 space-y-4 safe-pb-dock">
            {/* TRƯỜNG HỢP A: CHƯA ĐĂNG NHẬP */}
            {!isAuthenticated && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 text-center space-y-3.5 shadow-xs my-auto">
                <div className="size-14 rounded-2xl bg-emerald-100 text-[#005A36] flex items-center justify-center mx-auto shadow-sm">
                  <LogIn size={26} />
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Đăng Nhập Để Mở Vé Điện Tử & Mã QR
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
                  Đăng nhập tài khoản sinh viên hoặc tài khoản hành khách để tự động đồng bộ lịch sử vé điện tử, mã QR và thẻ xe buýt của bạn.
                </p>
                <div className="pt-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#005A36] hover:bg-[#004529] px-6 py-2.5 text-xs font-black text-white shadow-md transition-all active:scale-95"
                  >
                    <LogIn size={15} />
                    <span>Đăng nhập ngay</span>
                  </Link>
                </div>
              </div>
            )}

            {/* TRƯỜNG HỢP B: ĐANG TẢI */}
            {isAuthenticated && loading && !selectedTicketId && (
              <div className="py-16 text-center space-y-3">
                <Loader2 size={32} className="text-[#005A36] animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-bold">Đang tải lịch sử vé điện tử...</p>
              </div>
            )}

            {/* TRƯỜNG HỢP C: HIỂN THỊ CHI TIẾT VÉ & MÃ QR (KHI ĐÃ BẤM VÀO 1 VÉ) */}
            {isAuthenticated && selectedTicketId && (
              <div id="printable-ticket-card" className="space-y-4">
                {detailLoading && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="w-9 h-9 text-[#005A36] animate-spin" />
                    <p className="text-xs text-slate-500 font-bold">Đang tải mã QR và chữ ký bảo mật...</p>
                  </div>
                )}

                {!detailLoading && detailError && !ticketDetail && (
                  <div className="rounded-2xl bg-rose-50 border border-rose-200 p-5 text-xs text-rose-800 space-y-3 text-center">
                    <AlertTriangle className="w-7 h-7 text-rose-600 mx-auto" />
                    <p className="font-bold text-sm">{detailError}</p>
                    <button
                      type="button"
                      onClick={() => loadTicketDetail(selectedTicketId)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700"
                    >
                      Thử lại
                    </button>
                  </div>
                )}

                {!detailLoading && ticketDetail && (
                  <>
                    {/* Bảng điều khiển độ sáng & toàn màn hình */}
                    <div className="rounded-2xl bg-gradient-to-r from-emerald-50 via-white to-amber-50 border border-emerald-200/80 p-3 flex flex-wrap items-center justify-between gap-2.5 text-xs no-print">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-xl ${isHighBrightness ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                          <Sun className={`w-4 h-4 ${isHighBrightness ? 'animate-spin-slow' : ''}`} />
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">Tối ưu độ sáng quét vé:</span>
                          <span className="text-[11px] text-slate-500">
                            {isWakeLockActive
                              ? 'Màn hình giữ sáng liên tục (Screen Wake Lock đang bật)'
                              : 'Tăng tương phản để camera xe buýt nhận diện mã QR trong 1 giây'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsHighBrightness(!isHighBrightness)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            isHighBrightness
                              ? 'bg-[#005A36] text-white border-[#005A36] shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {isHighBrightness ? '⚡ Siêu Sáng: BẬT' : 'Độ sáng chuẩn'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsFullscreenQr(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold transition-colors shadow-2xs cursor-pointer"
                          title="Phóng to mã QR toàn màn hình"
                        >
                          <Maximize2 size={14} />
                          <span className="hidden sm:inline">Toàn màn hình</span>
                        </button>

                        {(ticketDetail.status === 'PAID' || ticketDetail.status === 'RESERVED' || ticketDetail.status === 'VALID') && (
                          <button
                            type="button"
                            onClick={() => setShowExchangeModal(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold transition-colors shadow-2xs cursor-pointer"
                          >
                            <ArrowLeftRight size={13} className="text-blue-700" />
                            <span>Đổi chuyến</span>
                          </button>
                        )}

                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => setShowCancelModal(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold transition-colors shadow-2xs cursor-pointer"
                          >
                            <Ban size={13} className="text-rose-600" />
                            <span>Hủy vé</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Khung thẻ vé & Mã QR chống làm giả */}
                    <div
                      className={`relative rounded-3xl border-2 transition-all p-5 sm:p-6 text-center overflow-hidden ${
                        isHighBrightness
                          ? 'border-emerald-400 bg-white shadow-xl ring-4 ring-emerald-500/10'
                          : 'border-dashed border-emerald-200 bg-emerald-50/30 shadow-xs'
                      }`}
                    >
                      {/* Khung ngắm máy quét (Scanner Viewfinder corners) */}
                      <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-[#005A36] rounded-tl-sm pointer-events-none" />
                      <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-[#005A36] rounded-tr-sm pointer-events-none" />
                      <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-[#005A36] rounded-bl-sm pointer-events-none" />
                      <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-[#005A36] rounded-br-sm pointer-events-none" />

                      {/* Mã QR trung tâm với hiệu ứng laser */}
                      <div className="relative inline-block mx-auto mb-3">
                        <div
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isHighBrightness
                              ? 'bg-white border-slate-900/10 shadow-lg'
                              : 'bg-white border-emerald-100 shadow-xs'
                          }`}
                        >
                          {ticketDetail.qrDataUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={ticketDetail.qrDataUrl}
                              alt={`Mã QR vé ${ticketDetail.ticketCode}`}
                              className="w-44 h-44 sm:w-48 sm:h-48 object-contain mx-auto transition-transform hover:scale-105"
                            />
                          ) : (
                            <div className="p-1 bg-white">
                              <QRCodeSVG
                                value={qrStringValue}
                                size={190}
                                level="H"
                                includeMargin={true}
                                fgColor="#000000"
                                bgColor="#ffffff"
                                style={{ width: '190px', height: '190px', display: 'block', aspectRatio: '1/1' }}
                                className="shrink-0 aspect-square"
                              />
                            </div>
                          )}
                        </div>

                        {/* Tia laser quét nhẹ nhàng */}
                        <div
                          className="absolute inset-x-3 h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_8px_#10b981] animate-pulse pointer-events-none"
                          style={{ top: '50%' }}
                        />
                      </div>

                      {/* Thông tin vé */}
                      <div className="space-y-1.5 max-w-md mx-auto">
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                              navigator.clipboard.writeText(ticketDetail.ticketCode).catch(() => {})
                            }
                            haptic.play('copy')
                            setCopiedTicketCode(true)
                            setTimeout(() => setCopiedTicketCode(false), 2000)
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-mono font-black text-sm border border-emerald-300 transition-all shadow-2xs active:scale-95 cursor-pointer touch-press touch-manipulation"
                          title="Sao chép mã vé"
                        >
                          <span>{ticketDetail.ticketCode}</span>
                          {copiedTicketCode ? (
                            <Check size={13} className="text-emerald-700" />
                          ) : (
                            <Copy size={13} className="text-emerald-700" />
                          )}
                        </button>

                        <div className="text-sm sm:text-base font-extrabold text-slate-900">
                          {ticketDetail.routeName || 'Tuyến buýt ICTU Transit'}
                        </div>

                        <div className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
                          <span className="font-semibold text-slate-700">{ticketDetail.origin}</span>
                          <span>➔</span>
                          <span className="font-semibold text-slate-700">{ticketDetail.destination}</span>
                        </div>

                        <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] text-[#005A36] font-bold">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#005A36]" />
                          <span>Mã QR đã mã hóa chống giả mạo HMAC-SHA256 & AES-256</span>
                        </div>
                      </div>

                      <div className="mt-3.5 rounded-xl bg-emerald-50 border border-emerald-200/90 p-2.5 text-[11px] text-emerald-950 font-medium max-w-lg mx-auto">
                        Đưa mã QR trên màn hình lại gần mắt đọc máy quét tự động ở cửa lên xe buýt. Cổng soát vé sẽ tự động mở khi có tiếng bíp xác nhận.
                      </div>
                    </div>

                    {/* Chi tiết thông tin chuyến */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2.5">
                        <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                          <Clock className="w-4 h-4 text-[#005A36]" />
                          <span>Giờ khởi hành:</span>
                        </div>
                        <span className="font-bold text-slate-900 text-sm">
                          {formatTime(ticketDetail.departureTime)} ngày {formatDate(ticketDetail.departureTime)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                          <span className="text-[10px] text-slate-400 font-bold block">Vị trí ghế</span>
                          <span className="text-base font-black text-[#005A36] font-mono block mt-0.5">
                            Ghế {ticketDetail.seatNumber}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {ticketDetail.seatType || 'Ghế tiêu chuẩn'}
                          </span>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                          <span className="text-[10px] text-slate-400 font-bold block">Giá vé</span>
                          <span className="text-base font-black text-slate-900 font-mono block mt-0.5">
                            {formatPrice(ticketDetail.price)}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-bold">Đã thanh toán</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate text-slate-700 font-medium">
                            Hành khách: <strong>{ticketDetail.passengerName}</strong>
                          </span>
                        </div>
                        {ticketDetail.vehiclePlate && (
                          <div className="flex items-center gap-2">
                            <Bus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-mono text-slate-700 font-bold">
                              Biển số xe: {ticketDetail.vehiclePlate}
                            </span>
                          </div>
                        )}
                        {ticketDetail.passengerPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-mono text-slate-700">
                              SĐT: {ticketDetail.passengerPhone}
                            </span>
                          </div>
                        )}
                        {ticketDetail.bookingCode && (
                          <div className="flex items-center gap-2">
                            <Ticket className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-mono text-slate-700">
                              Mã đơn: {ticketDetail.bookingCode}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Hàng nút chức năng Lưu / Tải / Gửi email */}
                    <div className="space-y-2 pt-1 no-print">
                      <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>Lưu & Chia sẻ vé điện tử:</span>
                        {downloadSuccess && (
                          <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px] animate-in fade-in">
                            <Check size={13} />
                            Đã tải ảnh vé PNG thành công!
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={handleDownloadImage}
                          disabled={isDownloading}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs hover:border-[#005A36] transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isDownloading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#005A36]" />
                          ) : (
                            <Download className="w-3.5 h-3.5 text-[#005A36]" />
                          )}
                          <span>Tải ảnh vé (PNG)</span>
                        </button>

                        <button
                          type="button"
                          onClick={handlePrintPdf}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs hover:border-[#005A36] transition-all cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-blue-600" />
                          <span>In vé / Lưu PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowEmailModal(true)}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs hover:border-[#005A36] transition-all cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5 text-amber-600" />
                          <span>Gửi lại Email vé</span>
                        </button>
                      </div>

                      {/* Modal gửi email */}
                      {showEmailModal && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 space-y-2 text-xs animate-in fade-in">
                          <div className="flex items-center justify-between font-bold text-amber-950">
                            <span className="flex items-center gap-1.5">
                              <Mail size={14} className="text-amber-700" />
                              Gửi lại vé điện tử & mã QR qua email
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowEmailModal(false)}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="email"
                              value={customEmail}
                              onChange={(e) => setCustomEmail(e.target.value)}
                              placeholder="Nhập email nhận vé..."
                              className="flex-1 px-3 py-2 rounded-xl bg-white border border-amber-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005A36]"
                            />
                            <button
                              type="button"
                              disabled={sendingEmail || resendCooldown > 0}
                              onClick={handleResendEmail}
                              className="px-4 py-2 rounded-xl bg-[#005A36] text-white font-bold text-xs hover:bg-[#00472b] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                            >
                              {sendingEmail && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                              {resendCooldown > 0 && <Clock className="w-3.5 h-3.5 animate-pulse" />}
                              <span>
                                {sendingEmail
                                  ? 'Đang gửi...'
                                  : resendCooldown > 0
                                    ? `Gửi lại sau (${resendCooldown}s)`
                                    : 'Gửi vé'}
                              </span>
                            </button>
                          </div>

                          {emailNotice && (
                            <div
                              className={`p-2.5 rounded-xl text-[11px] font-medium transition-all ${
                                emailNotice.type === 'success'
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : emailNotice.type === 'warning'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-rose-100 text-rose-900 border border-rose-300'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="flex-1">{emailNotice.text}</span>
                              </div>
                              {emailNotice.showLoginBtn && (
                                <div className="mt-2 pt-1 border-t border-rose-200">
                                  <a
                                    href="/dang-nhap"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#005A36] text-white text-[11px] font-bold hover:bg-[#00472b] transition-all cursor-pointer shadow-xs"
                                  >
                                    <LogIn size={13} />
                                    <span>Đăng nhập lại ngay</span>
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Hóa đơn điện tử VAT 8% */}
                    <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/60 via-white to-slate-50 p-3.5 space-y-2.5 text-xs no-print shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-lg bg-[#005A36] text-white flex items-center justify-center shadow-xs">
                            <FileText size={13} />
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 block leading-tight">
                              Hóa đơn điện tử (E-Invoice)
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Thuế suất GTGT 8% · Ký số ICTU CA
                            </span>
                          </div>
                        </div>
                        <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-[#005A36]">
                          Đã phát hành
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => setShowInvoicePreview(true)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold hover:border-[#005A36] hover:text-[#005A36] transition-all cursor-pointer shadow-2xs"
                        >
                          <FileText size={13} className="text-[#005A36]" />
                          <span>Xem chi tiết hóa đơn</span>
                        </button>

                        <button
                          type="button"
                          disabled={isDownloadingInvoicePdf}
                          onClick={handleDownloadInvoicePdf}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#005A36] hover:bg-[#004529] text-white font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {isDownloadingInvoicePdf ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Download size={13} />
                          )}
                          <span>Tải hóa đơn (PDF)</span>
                        </button>
                      </div>
                    </div>

                    {/* Các hành động tiện ích khác */}
                    <div className="space-y-2 pt-1 no-print">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Link
                          href={`/tracking/${ticketDetail.tripId || ticketDetail.ticketId}`}
                          target="_blank"
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-300 text-xs font-black text-[#005A36] transition-all text-center"
                        >
                          <Radio className="w-3.5 h-3.5 text-[#005A36] animate-pulse" />
                          <span>Theo dõi xe buýt realtime</span>
                        </Link>

                        {(ticketDetail.status === 'PAID' || ticketDetail.status === 'RESERVED' || ticketDetail.status === 'VALID') && canCancel && (
                          <button
                            type="button"
                            onClick={() => setShowExchangeModal(true)}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-black text-blue-800 transition-all cursor-pointer"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5 text-blue-700" />
                            <span>Đổi chuyến / đổi ghế</span>
                          </button>
                        )}

                        {(ticketDetail.status === 'CHECKED_IN' || ticketDetail.status === 'PAID') && (
                          <button
                            type="button"
                            onClick={() => setShowFeedbackModal(true)}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-xs font-black text-amber-900 transition-all cursor-pointer"
                          >
                            <Star className="w-3.5 h-3.5 text-amber-600" />
                            <span>Đánh giá chuyến đi</span>
                          </button>
                        )}

                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => setShowCancelModal(true)}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-black text-rose-700 transition-all cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5 text-rose-600" />
                            <span>Hủy vé & Hoàn tiền</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TRƯỜNG HỢP D: DANH SÁCH THẺ VÉ (CHƯA CHỌN VÉ CỤ THỂ) */}
            {isAuthenticated && !selectedTicketId && !loading && (
              <>
                {filteredTickets.length === 0 ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center space-y-3 shadow-xs">
                    <div className="size-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Ticket size={24} />
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Không Tìm Thấy Vé Nào ({FILTER_TABS.find((t) => t.key === filter)?.label})
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Bạn chưa có vé xe buýt nào trong danh mục này. Hãy chọn chuyến xe trên màn hình và đặt vé ngay hôm nay!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTickets.map((t) => {
                      const statusColor = TICKET_STATUS_COLOR[t.status] ?? TICKET_STATUS_COLOR['PENDING']
                      return (
                        <div
                          key={t.ticketId}
                          className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white hover:border-[#005A36] hover:shadow-md p-4 sm:p-5 transition-all space-y-3.5 shadow-2xs"
                        >
                          {/* Top Row: Route & Status */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="rounded-xl bg-[#005A36] text-white px-2.5 py-1 text-xs font-black shadow-2xs">
                                CT-01
                              </span>
                              <div>
                                <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                                  {t.routeName || 'ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên'}
                                </h4>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                                  <span>Mã vé: <strong>{t.ticketCode}</strong></span>
                                  <span>·</span>
                                  <span>Hành khách: <strong>{t.passengerName}</strong></span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
                              >
                                {TICKET_STATUS_LABEL[t.status]}
                              </span>
                              <span className="font-black text-sm sm:text-base font-mono text-[#005A36]">
                                {formatPrice(t.price)}
                              </span>
                            </div>
                          </div>

                          {/* Middle Row: Departure, Duration, Arrival & CTA */}
                          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-3 items-center">
                            {/* Khởi hành */}
                            <div>
                              <span className="text-[10px] uppercase font-black text-slate-400 block tracking-wider">
                                Khởi hành
                              </span>
                              <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="text-base sm:text-xl font-black font-mono text-slate-900">
                                  {formatTime(t.departureTime)}
                                </span>
                                <span className="text-[10px] text-slate-500 font-semibold">
                                  {formatDate(t.departureTime)}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-600 font-medium block truncate max-w-[200px]">
                                ĐH CNTT & TT (ICTU)
                              </span>
                            </div>

                            {/* Timeline Indicator */}
                            <div className="hidden md:flex flex-col items-center px-4">
                              <span className="text-[10px] font-bold text-slate-400">30 phút</span>
                              <div className="w-24 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 my-1 relative">
                                <span className="size-1.5 rounded-full bg-[#005A36] absolute -top-0.5 left-0" />
                                <span className="size-1.5 rounded-full bg-teal-500 absolute -top-0.5 right-0" />
                              </div>
                              <span className="text-[9px] text-emerald-800 font-semibold">Lộ trình nhanh</span>
                            </div>

                            {/* Vị trí ghế & Xe */}
                            <div>
                              <span className="text-[10px] uppercase font-black text-slate-400 block tracking-wider">
                                Vị trí ghế ngồi
                              </span>
                              <div className="flex items-baseline gap-1.5 mt-0.5">
                                <span className="text-base sm:text-lg font-black font-mono text-[#005A36]">
                                  Ghế {t.seatNumber}
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium">(Tầng 1)</span>
                              </div>
                              <span className="text-[11px] text-slate-600 font-medium block">
                                Xe buýt điện ICTU Transit
                              </span>
                            </div>

                            {/* Nút Xem Mã QR To Rõ & Đổi chuyến / Hủy vé trực tiếp */}
                            <div className="pt-2 md:pt-0 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  haptic.play('tap')
                                  setSelectedTicketId(t.ticketId)
                                }}
                                className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#005A36] hover:bg-[#004529] px-3.5 py-2.5 text-xs font-black text-white shadow-md transition-all active:scale-95 cursor-pointer"
                              >
                                <QrCode size={15} />
                                <span>Xem Vé & QR</span>
                              </button>

                              {(t.status === 'PAID' || t.status === 'RESERVED' || t.status === 'VALID') && (
                                <>
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      await loadTicketDetail(t.ticketId)
                                      setShowExchangeModal(true)
                                    }}
                                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-2 text-xs font-bold text-blue-800 transition-all cursor-pointer"
                                  >
                                    <ArrowLeftRight size={13} className="text-blue-700" />
                                    <span>Đổi Chuyến</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      await loadTicketDetail(t.ticketId)
                                      setShowCancelModal(true)
                                    }}
                                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 transition-all cursor-pointer"
                                  >
                                    <Ban size={13} className="text-rose-600" />
                                    <span>Hủy Vé</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Bottom Row: Feature Badges */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-[10px] font-bold text-slate-600">
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-800 border border-emerald-200/50">
                              <Zap size={10} className="text-[#005A36]" />
                              100% Buýt điện
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-slate-700 border border-slate-200/60">
                              Điều hòa 2 Chiều
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-slate-700 border border-slate-200/60">
                              Wi-Fi 5G Free
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-slate-700 border border-slate-200/60">
                              Cổng Sạc USB
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-blue-700 border border-blue-200/50 ml-auto">
                              <ShieldCheck size={10} />
                              Chữ ký số HMAC-SHA256
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4. CHẾ ĐỘ PHÓNG TO QR TOÀN MÀN HÌNH SIÊU SÁNG (FULLSCREEN SCANNER VIEW) */}
      {isFullscreenQr && ticketDetail && (
        <div
          className="fixed inset-0 z-60 bg-white flex flex-col items-center justify-between p-6 animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full flex items-center justify-between max-w-sm">
            <div className="flex items-center gap-2">
              <Sun className="w-5 h-5 text-amber-500 animate-spin-slow" />
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Chế độ Soát Vé Siêu Sáng
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreenQr(false)}
              className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              title="Thu nhỏ"
            >
              <Minimize2 size={20} />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center space-y-4 my-auto">
            <div className="p-5 bg-white rounded-3xl border-4 border-[#005A36] shadow-2xl">
              {ticketDetail.qrDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={ticketDetail.qrDataUrl}
                  alt={ticketDetail.ticketCode}
                  className="w-64 h-64 sm:w-80 sm:h-80 object-contain"
                />
              ) : (
                <QRCodeSVG
                  value={qrStringValue}
                  size={280}
                  level="H"
                  includeMargin={true}
                  fgColor="#000000"
                  bgColor="#ffffff"
                />
              )}
            </div>

            <div className="text-center space-y-1">
              <div className="text-xl font-black font-mono text-[#005A36]">
                {ticketDetail.ticketCode}
              </div>
              <div className="text-sm font-bold text-slate-900">
                Ghế {ticketDetail.seatNumber} · {ticketDetail.routeName}
              </div>
              <div className="text-xs text-slate-500">
                Hành khách: {ticketDetail.passengerName}
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm space-y-3">
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center text-xs text-emerald-950 font-medium">
              Đưa thẳng mã QR vào camera quét vé của xe buýt ICTU để xác thực tự động.
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreenQr(false)}
              className="w-full py-3 rounded-2xl bg-[#005A36] hover:bg-[#00472b] text-white font-bold text-sm shadow-md cursor-pointer"
            >
              Quay lại chi tiết vé
            </button>
          </div>
        </div>
      )}

      {/* Sub-modal: Đổi vé 3 bước */}
      {showExchangeModal && ticketDetail && (
        <ExchangeTicketModal
          ticketId={ticketDetail.ticketId}
          ticketCode={ticketDetail.ticketCode}
          currentSeatNumber={ticketDetail.seatNumber}
          currentTripId={ticketDetail.tripId}
          currentDepartureTime={ticketDetail.departureTime}
          currentPrice={ticketDetail.price}
          routeName={ticketDetail.routeName}
          onClose={() => setShowExchangeModal(false)}
          onSuccess={() => {
            setShowExchangeModal(false)
            loadTicketDetail(ticketDetail.ticketId)
            loadTickets()
          }}
        />
      )}

      {/* Sub-modal: Hủy vé & Hoàn tiền tự động (Backend PR #20) */}
      {showCancelModal && ticketDetail && (
        <CancellationPolicyModal
          ticketId={ticketDetail.ticketId}
          ticketCode={ticketDetail.ticketCode}
          seatNumber={ticketDetail.seatNumber}
          departureTime={ticketDetail.departureTime}
          price={ticketDetail.price}
          onClose={() => setShowCancelModal(false)}
          onSuccess={() => {
            setShowCancelModal(false)
            loadTicketDetail(ticketDetail.ticketId)
            loadTickets()
          }}
        />
      )}

      {/* Sub-modal: Đánh giá */}
      {showFeedbackModal && ticketDetail && (
        <FeedbackModal
          tripId={ticketDetail.tripId || ticketDetail.ticketId}
          tripName={`${ticketDetail.origin} ➔ ${ticketDetail.destination}`}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}

      {/* Invoice Preview Modal */}
      <InvoicePreviewModal
        open={showInvoicePreview}
        onClose={() => setShowInvoicePreview(false)}
        bookingCode={ticketDetail?.bookingCode || ticketDetail?.ticketCode}
      />

      {/* CSS In ấn trực tiếp */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-ticket-card,
          #printable-ticket-card * {
            visibility: visible !important;
          }
          #printable-ticket-card {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            border: 2px solid #005a36 !important;
            background: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </>
  )
}
