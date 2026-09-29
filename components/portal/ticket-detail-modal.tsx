'use client'

/**
 * Modal Chi tiết vé — hiển thị QR code, thông tin vé và các hành động tiện ích
 * Hỗ trợ:
 * 1. Hiển thị mã QR rõ ràng với thư viện QRCodeSVG (chống làm giả HMAC-SHA256 & AES-256)
 * 2. Lưu / tải vé điện tử dạng ảnh PNG chất lượng cao Retina hoặc In / xuất PDF
 * 3. Chế độ Ngoại tuyến (Offline cache) khi không có kết nối internet
 * 4. Tự động tối ưu độ sáng màn hình (Screen Wake Lock API + Scanner High-Brightness Mode)
 * Thiết kế giao diện Light Theme chuẩn nhận diện thương hiệu ICTU Transit (#005A36)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  X,
  QrCode,
  MapPin,
  Clock,
  Bus,
  User,
  Phone,
  Armchair,
  Ban,
  Loader2,
  CheckCircle2,
  Download,
  Share2,
  ArrowLeftRight,
  Radio,
  Star,
  AlertTriangle,
  Ticket,
  Printer,
  Mail,
  Sun,
  Maximize2,
  Minimize2,
  Wifi,
  WifiOff,
  ShieldCheck,
  Check,
  Smartphone,
} from 'lucide-react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { ticketService } from '@/lib/services/ticket.service'
import { offlineTicketCache } from '@/lib/services/offline-ticket-cache'
import { downloadTicketAsImage, printTicketAsPdf } from '@/lib/utils/ticket-export'
import type { TicketDetail } from '@/lib/types/ticket'
import {
  TICKET_STATUS_COLOR,
  TICKET_STATUS_LABEL,
} from '@/lib/types/ticket'
import { ExchangeTicketModal } from './exchange-ticket-modal'
import { CancellationPolicyModal } from './cancellation-policy-modal'
import { FeedbackModal } from './feedback-modal'

interface TicketDetailModalProps {
  ticketId: string | null
  onClose: () => void
  onCancelled?: (ticketId: string) => void
}

export function TicketDetailModal({
  ticketId,
  onClose,
  onCancelled,
}: TicketDetailModalProps) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelSuccess, setCancelSuccess] = useState(false)
  const [showExchangeModal, setShowExchangeModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)

  // --- Offline State ---
  const [isOffline, setIsOffline] = useState(false)

  // --- Brightness & Wake Lock ---
  const [isHighBrightness, setIsHighBrightness] = useState(true)
  const [isWakeLockActive, setIsWakeLockActive] = useState(false)
  const [isFullscreenQr, setIsFullscreenQr] = useState(false)

  // --- Export & Download ---
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState(false)

  // --- Email Resend ---
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [customEmail, setCustomEmail] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailNotice, setEmailNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Ref lưu WakeLockSentinel
  const wakeLockRef = useRef<any>(null)

  // 1. Kiểm tra trạng thái mạng Online / Offline
  useEffect(() => {
    setIsOffline(!offlineTicketCache.isOnline())
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 2. Kích hoạt Screen Wake Lock API để ngăn màn hình tắt / giảm sáng khi quét vé
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
        // Trình duyệt không cấp quyền hoặc không hỗ trợ
        console.log('[WakeLock] Notification: Screen Wake Lock not granted or unavailable')
      }
    }

    if (ticket && isHighBrightness) {
      requestWakeLock()
    }

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
        wakeLockRef.current = null
        setIsWakeLockActive(false)
      }
    }
  }, [ticket, isHighBrightness])

  // 3. Tải chi tiết vé (tự động fallback sang offline cache khi không có mạng)
  const loadTicket = useCallback(async () => {
    if (!ticketId) return
    setLoading(true)
    setError(null)
    setTicket(null)

    const result = await ticketService.getTicketDetail(ticketId)
    setLoading(false)

    if (result.success && result.data) {
      setTicket(result.data)
      if (result.message && result.message.includes('Ngoại tuyến')) {
        setIsOffline(true)
      }
    } else {
      // Cố gắng tìm thêm trong cache
      const cached = offlineTicketCache.getTicket(ticketId)
      if (cached) {
        setTicket(cached)
        setIsOffline(true)
      } else {
        setError(result.message || 'Không thể tải chi tiết vé')
      }
    }
  }, [ticketId])

  useEffect(() => {
    if (ticketId) {
      setTicket(null)
      setError(null)
      setCancelConfirm(false)
      setCancelSuccess(false)
      setEmailNotice(null)
      setShowEmailModal(false)
      loadTicket()
    }
  }, [ticketId, loadTicket])

  // 4. Xử lý xuất vé dạng ảnh PNG (Retina 2x)
  const handleDownloadImage = async () => {
    if (!ticket) return
    setIsDownloading(true)
    try {
      const ok = await downloadTicketAsImage(ticket, ticket.qrDataUrl)
      if (ok) {
        setDownloadSuccess(true)
        setTimeout(() => setDownloadSuccess(false), 3000)
      }
    } catch (e) {
      console.error('Lỗi tải ảnh vé:', e)
    } finally {
      setIsDownloading(false)
    }
  }

  // 5. Xử lý in vé hoặc lưu PDF
  const handlePrintPdf = () => {
    printTicketAsPdf()
  }

  // 6. Xử lý gửi lại Email vé điện tử
  const handleResendEmail = async () => {
    if (!ticket) return
    setSendingEmail(true)
    setEmailNotice(null)

    const result = await ticketService.resendTicketEmail(ticket.ticketId, customEmail.trim() || undefined)
    setSendingEmail(false)

    if (result.success) {
      setEmailNotice({
        type: 'success',
        text: result.message || 'Đã gửi vé điện tử kèm mã QR tới email của bạn thành công!',
      })
      setTimeout(() => setShowEmailModal(false), 3500)
    } else {
      setEmailNotice({
        type: 'error',
        text: result.message || 'Không thể gửi email vé. Vui lòng kiểm tra lại địa chỉ email.',
      })
    }
  }

  // 7. Xử lý hủy vé
  const handleCancel = async () => {
    if (!ticket) return
    setCancelling(true)
    const result = await ticketService.cancelTicket(ticket.ticketId)
    setCancelling(false)

    if (result.success) {
      setCancelSuccess(true)
      setCancelConfirm(false)
      setTicket((prev) => (prev ? { ...prev, status: 'CANCELLED' } : prev))
      onCancelled?.(ticket.ticketId)
    } else {
      setError(result.message || 'Không thể hủy vé')
      setCancelConfirm(false)
    }
  }

  const canCancel =
    ticket &&
    (ticket.status === 'PAID' || ticket.status === 'RESERVED' || ticket.status === 'VALID')

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount)

  if (!ticketId) return null

  const statusColor = ticket
    ? TICKET_STATUS_COLOR[ticket.status] ?? TICKET_STATUS_COLOR['PENDING']
    : null

  // Dữ liệu nội dung QR (ưu tiên chuỗi mã hóa HMAC của PR #16)
  const qrStringValue =
    ticket?.qrData ||
    (ticket
      ? `ICTU-PASS:${ticket.ticketCode}:${ticket.passengerName}:${ticket.seatNumber}:${ticket.status}`
      : '')

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 overscroll-contain animate-in fade-in duration-150"
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết vé xe điện tử"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="relative w-full max-w-xl max-h-[92vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col will-change-transform">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-gradient-to-r from-emerald-50/90 via-white to-slate-50 shrink-0 no-print">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-[#005A36] text-white shadow-sm shrink-0">
                <Ticket size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-extrabold text-slate-900">Chi Tiết Vé Điện Tử</h3>
                  {ticket && statusColor && (
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
                    >
                      {TICKET_STATUS_LABEL[ticket.status]}
                    </span>
                  )}
                  {isOffline && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      <WifiOff size={10} />
                      <span>Ngoại tuyến</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {ticket ? `Mã vé: ${ticket.ticketCode}` : 'Hệ thống vé xe buýt thông minh ICTU Transit'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Đóng modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* Banner thông báo Offline Mode nếu đang ngoại tuyến */}
          {isOffline && (
            <div className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-semibold flex items-center justify-between shrink-0 no-print">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 animate-pulse shrink-0" />
                <span>Bạn đang mở vé ở chế độ Ngoại tuyến. Mã QR đã lưu vào bộ nhớ tạm để sẵn sàng quét vé.</span>
              </div>
            </div>
          )}

          {/* Body content */}
          <div className="overflow-y-auto p-4 sm:p-6 space-y-4 text-slate-700 text-sm">
            {loading && (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <Loader2 className="w-9 h-9 text-[#005A36] animate-spin" />
                <p className="text-xs text-slate-500 font-medium">Đang xác thực và tải thông tin vé...</p>
              </div>
            )}

            {!loading && error && !ticket && (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 p-5 text-xs text-rose-800 space-y-3 text-center">
                <AlertTriangle className="w-7 h-7 text-rose-600 mx-auto" />
                <p className="font-bold text-sm">{error}</p>
                <button
                  type="button"
                  onClick={loadTicket}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors"
                >
                  Thử lại
                </button>
              </div>
            )}

            {!loading && ticket && (
              <div id="printable-ticket-card" className="space-y-4">
                {/* 1. THANH CÔNG CỤ TỐI ƯU ĐỘ SÁNG MÀN HÌNH QUÉT VÉ */}
                <div className="rounded-2xl bg-gradient-to-r from-emerald-50/80 via-white to-amber-50/80 border border-emerald-200/70 p-3 flex flex-wrap items-center justify-between gap-2.5 text-xs no-print">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-xl ${isHighBrightness ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                      <Sun className={`w-4 h-4 ${isHighBrightness ? 'animate-spin-slow' : ''}`} />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block">Tối ưu độ sáng quét vé:</span>
                      <span className="text-[11px] text-slate-500">
                        {isWakeLockActive ? 'Màn hình giữ sáng liên tục (Screen Wake Lock)' : 'Tăng độ tương phản màn hình để camera dễ nhận diện'}
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
                      id="toggle-brightness-mode-btn"
                    >
                      {isHighBrightness ? '⚡ Siêu Sáng: BẬT' : 'Độ sáng chuẩn'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsFullscreenQr(true)}
                      className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors"
                      title="Phóng to mã QR toàn màn hình"
                      id="fullscreen-qr-btn"
                    >
                      <Maximize2 size={16} />
                    </button>
                  </div>
                </div>

                {/* 2. KHỐI THẺ VÉ VÀ MÃ QR CHỐNG LÀM GIẢ */}
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

                  {/* Tia laser quét nhẹ nhàng (Scanner Sweep Effect) */}
                  <div className="relative inline-block mx-auto mb-3">
                    <div
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isHighBrightness
                          ? 'bg-white border-slate-900/10 shadow-lg'
                          : 'bg-white border-emerald-100 shadow-xs'
                      }`}
                    >
                      {ticket.qrDataUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={ticket.qrDataUrl}
                          alt={`Mã QR vé ${ticket.ticketCode}`}
                          className="w-44 h-44 object-contain mx-auto transition-transform hover:scale-105"
                          id="qr-ticket-image"
                        />
                      ) : (
                        <div className="p-1 bg-white">
                          <QRCodeSVG
                            value={qrStringValue}
                            size={176}
                            level="H"
                            includeMargin={true}
                            fgColor="#000000"
                            bgColor="#ffffff"
                            style={{ width: '176px', height: '176px', display: 'block', aspectRatio: '1/1' }}
                            className="shrink-0 aspect-square"
                          />
                        </div>
                      )}
                    </div>

                    {/* Laser Scanner sweep line animation */}
                    <div
                      className="absolute inset-x-3 h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_8px_#10b981] animate-pulse pointer-events-none"
                      style={{ top: '50%' }}
                    />
                  </div>

                  {/* Thông tin vé dưới mã QR */}
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 font-mono font-black text-sm border border-emerald-200">
                      <span>{ticket.ticketCode}</span>
                    </div>

                    <div className="text-sm font-extrabold text-slate-900">
                      {ticket.routeName || 'Tuyến xe buýt ICTU Transit'}
                    </div>

                    <div className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
                      <span className="font-semibold text-slate-700">{ticket.origin}</span>
                      <span>➔</span>
                      <span className="font-semibold text-slate-700">{ticket.destination}</span>
                    </div>

                    {/* Badge Chữ ký số HMAC-SHA256 & AES-256 */}
                    <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] text-[#005A36] font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#005A36]" />
                      <span>Mã QR đã mã hóa chống giả mạo HMAC-SHA256 & AES-256</span>
                    </div>
                  </div>

                  {/* Hướng dẫn hành khách quét vé */}
                  <div className="mt-3.5 rounded-xl bg-emerald-50 border border-emerald-200/90 p-2.5 text-[11px] text-emerald-950 font-medium">
                    Đưa mã QR trên màn hình lại gần mắt đọc máy quét tự động ở cửa lên xe buýt. Cổng soát vé sẽ tự động mở khi có tiếng bíp xác nhận.
                  </div>
                </div>

                {/* 3. THÔNG TIN CHI TIẾT LỘ TRÌNH, GHẾ VÀ XE */}
                <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-3.5">
                  <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2.5">
                    <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                      <Clock className="w-4 h-4 text-[#005A36]" />
                      <span>Giờ khởi hành:</span>
                    </div>
                    <span className="font-bold text-slate-900 text-sm">{formatDate(ticket.departureTime)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-[10px] text-slate-400 font-bold block">Vị trí ghế</span>
                      <span className="text-base font-black text-[#005A36] font-mono block mt-0.5">
                        Ghế {ticket.seatNumber}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {ticket.seatType || 'Ghế tiêu chuẩn'}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-[10px] text-slate-400 font-bold block">Giá vé</span>
                      <span className="text-base font-black text-slate-900 font-mono block mt-0.5">
                        {formatPrice(ticket.price)}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold">Đã thanh toán</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate text-slate-700 font-medium">
                        Hành khách: <strong>{ticket.passengerName}</strong>
                      </span>
                    </div>
                    {ticket.vehiclePlate && (
                      <div className="flex items-center gap-2">
                        <Bus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono text-slate-700 font-bold">
                          Biển số xe: {ticket.vehiclePlate}
                        </span>
                      </div>
                    )}
                    {ticket.passengerPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono text-slate-700">
                          SĐT: {ticket.passengerPhone}
                        </span>
                      </div>
                    )}
                    {ticket.bookingCode && (
                      <div className="flex items-center gap-2">
                        <Ticket className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono text-slate-700">
                          Mã đơn: {ticket.bookingCode}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. HÀNG NÚT LƯU VÉ, TẢI ẢNH, IN PDF, GỬI EMAIL */}
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
                    {/* Nút tải ảnh PNG */}
                    <button
                      type="button"
                      onClick={handleDownloadImage}
                      disabled={isDownloading}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs hover:border-[#005A36] transition-all cursor-pointer disabled:opacity-50"
                      id="download-ticket-image-btn"
                    >
                      {isDownloading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#005A36]" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-[#005A36]" />
                      )}
                      <span>Tải ảnh vé (PNG)</span>
                    </button>

                    {/* Nút In vé / Lưu PDF */}
                    <button
                      type="button"
                      onClick={handlePrintPdf}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs hover:border-[#005A36] transition-all cursor-pointer"
                      id="print-ticket-pdf-btn"
                    >
                      <Printer className="w-3.5 h-3.5 text-blue-600" />
                      <span>In vé / Lưu PDF</span>
                    </button>

                    {/* Nút gửi lại Email vé */}
                    <button
                      type="button"
                      onClick={() => setShowEmailModal(true)}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs hover:border-[#005A36] transition-all cursor-pointer"
                      id="resend-email-btn"
                    >
                      <Mail className="w-3.5 h-3.5 text-amber-600" />
                      <span>Gửi lại Email vé</span>
                    </button>
                  </div>

                  {/* Form popup gửi email vé */}
                  {showEmailModal && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 space-y-2.5 text-xs animate-in fade-in">
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
                          placeholder="Nhập email nhận vé (để trống để dùng email mặc định)..."
                          className="flex-1 px-3 py-2 rounded-xl bg-white border border-amber-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005A36]"
                        />
                        <button
                          type="button"
                          disabled={sendingEmail}
                          onClick={handleResendEmail}
                          className="px-4 py-2 rounded-xl bg-[#005A36] text-white font-bold text-xs hover:bg-[#00472b] disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                          id="submit-resend-email-btn"
                        >
                          {sendingEmail && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Gửi vé</span>
                        </button>
                      </div>

                      {emailNotice && (
                        <div
                          className={`p-2 rounded-lg text-[11px] font-medium ${
                            emailNotice.type === 'success'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-rose-100 text-rose-900 border border-rose-300'
                          }`}
                        >
                          {emailNotice.text}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 5. CÁC HÀNH ĐỘNG KHÁC (THEO DÕI GPS, ĐỔI VÉ, HỦY VÉ) */}
                <div className="space-y-2 pt-1 no-print">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Realtime GPS tracking link */}
                    <Link
                      href={`/tracking/${ticket.tripId || ticket.ticketId}`}
                      target="_blank"
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-300 text-xs font-black text-[#005A36] transition-all text-center"
                      id={`track-ticket-btn-${ticket.ticketId}`}
                    >
                      <Radio className="w-3.5 h-3.5 text-[#005A36] animate-pulse" />
                      <span>Theo dõi xe buýt realtime</span>
                    </Link>

                    {/* Exchange ticket button */}
                    {(ticket.status === 'PAID' || ticket.status === 'RESERVED' || ticket.status === 'VALID') && (
                      <button
                        type="button"
                        onClick={() => setShowExchangeModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-black text-blue-800 transition-all cursor-pointer"
                        id={`exchange-ticket-btn-${ticket.ticketId}`}
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5 text-blue-700" />
                        <span>Đổi chuyến / đổi ghế</span>
                      </button>
                    )}

                    {/* Feedback button */}
                    {(ticket.status === 'CHECKED_IN' || ticket.status === 'PAID') && (
                      <button
                        type="button"
                        onClick={() => setShowFeedbackModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-xs font-black text-amber-900 transition-all cursor-pointer"
                        id={`feedback-ticket-btn-${ticket.ticketId}`}
                      >
                        <Star className="w-3.5 h-3.5 text-amber-600" />
                        <span>Đánh giá chuyến đi</span>
                      </button>
                    )}

                    {/* Hủy vé button */}
                    {canCancel && !cancelSuccess && (
                      <button
                        type="button"
                        onClick={() => setShowCancelModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-black text-rose-700 transition-all cursor-pointer"
                        id={`cancel-ticket-btn-${ticket.ticketId}`}
                      >
                        <Ban className="w-3.5 h-3.5 text-rose-600" />
                        <span>Hủy vé & Hoàn tiền</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Thông báo hủy thành công */}
                {cancelSuccess && (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-center gap-2.5 text-xs text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Vé đã được hủy thành công. Chính sách hoàn tiền sẽ được xử lý theo quy định.</span>
                  </div>
                )}

                {/* Xác nhận hủy vé */}
                {cancelConfirm && (
                  <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 space-y-2.5 text-xs text-rose-900">
                    <div className="flex items-center gap-2 font-bold text-rose-700">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Xác nhận hủy vé xe buýt này?</span>
                    </div>
                    <p className="text-[11px] text-rose-700">
                      Hủy trước giờ khởi hành trên 2 tiếng được hoàn tiền theo chính sách. Vé sau khi hủy sẽ không thể hoàn tác.
                    </p>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setCancelConfirm(false)}
                        className="flex-1 rounded-xl bg-white border border-slate-200 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Giữ lại vé
                      </button>
                      <button
                        type="button"
                        disabled={cancelling}
                        onClick={handleCancel}
                        className="flex-1 rounded-xl bg-rose-600 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {cancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Đồng ý hủy</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. MÀN HÌNH QR PHÓNG TO SIÊU SÁNG TOÀN MÀN HÌNH (FULLSCREEN SCANNER VIEW) */}
      {isFullscreenQr && ticket && (
        <div
          className="fixed inset-0 z-60 bg-white flex flex-col items-center justify-between p-6 animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          {/* Header Fullscreen */}
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
              className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700"
              title="Thu nhỏ"
            >
              <Minimize2 size={20} />
            </button>
          </div>

          {/* QR Code lớn tối đa */}
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 my-auto">
            <div className="p-5 bg-white rounded-3xl border-4 border-[#005A36] shadow-2xl">
              {ticket.qrDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={ticket.qrDataUrl}
                  alt={ticket.ticketCode}
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
                {ticket.ticketCode}
              </div>
              <div className="text-sm font-bold text-slate-900">
                Ghế {ticket.seatNumber} · {ticket.routeName}
              </div>
              <div className="text-xs text-slate-500">
                Hành khách: {ticket.passengerName}
              </div>
            </div>
          </div>

          {/* Footer Fullscreen */}
          <div className="w-full max-w-sm space-y-3">
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center text-xs text-emerald-950 font-medium">
              Đưa thẳng mã QR vào camera quét vé của xe buýt ICTU để xác thực tự động.
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreenQr(false)}
              className="w-full py-3 rounded-2xl bg-[#005A36] hover:bg-[#00472b] text-white font-bold text-sm shadow-md"
            >
              Quay lại chi tiết vé
            </button>
          </div>
        </div>
      )}

      {/* Exchange ticket modal */}
      {showExchangeModal && ticket && (
        <ExchangeTicketModal
          ticketId={ticket.ticketId}
          ticketCode={ticket.ticketCode}
          onClose={() => setShowExchangeModal(false)}
          onSuccess={() => {
            setShowExchangeModal(false)
            loadTicket()
          }}
        />
      )}

      {/* Cancellation Policy Modal */}
      {showCancelModal && ticket && (
        <CancellationPolicyModal
          ticketId={ticket.ticketId}
          ticketCode={ticket.ticketCode}
          seatNumber={ticket.seatNumber}
          departureTime={ticket.departureTime}
          price={ticket.price}
          onClose={() => setShowCancelModal(false)}
          onSuccess={() => {
            setShowCancelModal(false)
            setTicket((prev) => (prev ? { ...prev, status: 'CANCELLED' } : prev))
            onCancelled?.(ticket.ticketId)
            loadTicket()
          }}
        />
      )}

      {/* Feedback modal */}
      {showFeedbackModal && ticket && (
        <FeedbackModal
          tripId={ticket.tripId || ticket.ticketId}
          tripName={`${ticket.origin} ➔ ${ticket.destination}`}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}

      {/* Print CSS styles */}
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
