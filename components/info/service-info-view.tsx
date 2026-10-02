'use client'

import { useEffect, useId, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BadgeAlert,
  BadgeCheck,
  Bell,
  Bus,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  GraduationCap,
  HelpCircle,
  Info,
  MapPin,
  Maximize2,
  PhoneCall,
  QrCode,
  Radio,
  Receipt,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
  Volume2,
  VolumeX,
  Wifi,
  Zap,
} from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { CONTACT } from '@/lib/landing-data'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/utils/haptics'
import { VrStationTourModal } from '@/components/modal/vr-station-tour-modal'

// Bảng biểu phí hoàn hủy chuẩn theo quy định hệ thống ICTU Transit
const REFUND_POLICIES = [
  {
    timeframe: 'Hủy trước giờ khởi hành > 24 giờ',
    leadHours: 24.1,
    refundPercent: 100,
    feePercent: 0,
    status: 'success',
    badge: 'Miễn phí hoàn vé 100%',
    desc: 'Hành khách nhận lại toàn bộ 100% tiền vé. Tiền hoàn tự động trả về thẻ/tài khoản ngân hàng hoặc ví điện tử trong 24 giờ.',
  },
  {
    timeframe: 'Hủy trước giờ khởi hành 12 - 24 giờ',
    leadHours: 18,
    refundPercent: 90,
    feePercent: 10,
    status: 'info',
    badge: 'Khấu trừ 10% phí vận hành',
    desc: 'Hệ thống hoàn lại 90% giá vé, khấu trừ 10% chi phí xử lý hệ thống và bảo lưu vị trí ghế.',
  },
  {
    timeframe: 'Hủy trước giờ khởi hành 02 - 12 giờ',
    leadHours: 6,
    refundPercent: 80,
    feePercent: 20,
    status: 'warning',
    badge: 'Khấu trừ 20% phí vận hành',
    desc: 'Hệ thống hoàn lại 80% giá vé, khấu trừ 20% theo quy định luân chuyển vị trí chỗ ngồi.',
  },
  {
    timeframe: 'Hủy dưới 02 giờ hoặc đã Check-in',
    leadHours: 1,
    refundPercent: 0,
    feePercent: 100,
    status: 'danger',
    badge: 'Không áp dụng hoàn vé',
    desc: 'Vé đã khóa chốt sổ lệnh điều độ hoặc hành khách đã điểm danh qua cổng QR. Không thể hủy hoàn theo Thông tư GTVT.',
  },
]

// Tuyến xe CT-01 và CT-02
const ROUTES_INFO = [
  {
    code: 'CT-01',
    name: 'Tuyến Nội Thành ĐH Thái Nguyên',
    endpoints: 'ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên',
    distance: '14.5 km',
    standardFare: 10000,
    studentFare: 5000,
    frequency: '15 - 20 phút/chuyến',
    operatingTime: '05:30 - 21:00',
    color: 'from-blue-600 to-cyan-600',
    stations: [
      { name: 'ĐH CNTT & TT Thái Nguyên (ICTU)', type: 'Trạm Ga Đầu', hub: true, time: '05:30' },
      { name: 'Trạm Cổng KTX ĐH Thái Nguyên', type: 'Trạm Đón Khách', hub: false, time: '05:42' },
      { name: 'Trạm Ngã 3 Mỏ Chè (Quang Trung)', type: 'Trạm Đón Khách', hub: false, time: '05:54' },
      { name: 'Bệnh Viện Đa Khoa Trung Ương', type: 'Trạm Trung Chuyển', hub: true, time: '06:06' },
      { name: 'Bến Xe Trung Tâm Thái Nguyên', type: 'Trạm Ga Cuối', hub: true, time: '06:20' },
    ],
  },
  {
    code: 'CT-02',
    name: 'Tuyến Liên Khu Công Nghiệp & Nam TP',
    endpoints: 'Bến Xe Nam Thái Nguyên ↔ Khu Công Nghiệp Sông Công',
    distance: '18.0 km',
    standardFare: 15000,
    studentFare: 8000,
    frequency: '25 - 30 phút/chuyến',
    operatingTime: '06:00 - 20:30',
    color: 'from-indigo-600 to-blue-600',
    stations: [
      { name: 'Bến Xe Nam Thái Nguyên', type: 'Trạm Ga Đầu', hub: true, time: '06:00' },
      { name: 'Đại Học Sư Phạm Thái Nguyên', type: 'Trạm Trung Chuyển', hub: true, time: '06:15' },
      { name: 'Đại Học Nông Lâm Thái Nguyên', type: 'Trạm Đón Khách', hub: false, time: '06:28' },
      { name: 'Ngã Tư Sông Công', type: 'Trạm Đón Khách', hub: false, time: '06:45' },
      { name: 'Khu Công Nghiệp Sông Công (KCN 1 & 2)', type: 'Trạm Ga Cuối', hub: true, time: '07:00' },
    ],
  },
]

// Danh mục câu hỏi thường gặp
const FAQ_ITEMS = [
  {
    category: 'Vé & Thanh toán',
    q: 'Làm sao để sinh viên ICTU được hưởng mức giảm giá 50% khi mua vé tháng?',
    a: 'Khi đăng ký tài khoản trên hệ thống, bạn chỉ cần chọn đối tượng "Sinh viên", nhập đúng Mã sinh viên ICTU và tải lên ảnh thẻ sinh viên hoặc ảnh chụp VNeID/giấy báo nhập học. Hệ thống sẽ tự động đối soát dữ liệu với cổng đào tạo ICTU hoặc phê duyệt thủ công trong vòng 2 - 4 giờ làm việc. Sau khi được duyệt, tất cả vé tháng sẽ tự động giảm 50% vĩnh viễn trong thời gian học tập.',
  },
  {
    category: 'Vé & Thanh toán',
    q: 'Tôi có thể thanh toán vé buýt qua những hình thức nào?',
    a: 'Hệ thống ICTU Transit hỗ trợ thanh toán trực tuyến bảo mật đa kênh: Quét mã VietQR chuyển khoản nhanh 24/7 (hỗ trợ tất cả ngân hàng VCB, BIDV, Techcombank, VPBank...), thẻ tín dụng/ghi nợ quốc tế (Visa, Mastercard), ví điện tử MoMo, VNPay-QR và thanh toán một chạm NFC bằng thẻ sinh viên thông minh.',
  },
  {
    category: 'Chính sách hoàn hủy',
    q: 'Thời gian tôi nhận lại tiền sau khi hủy vé là bao lâu?',
    a: 'Đối với giao dịch qua Ví điện tử MoMo / VNPay: Tiền hoàn sẽ về tài khoản ngay lập tức (trong vòng 5 - 15 phút). Đối với thanh toán qua VietQR hoặc thẻ ngân hàng: Thời gian hoàn tiền từ 12 - 24 giờ làm việc tùy thuộc vào ngân hàng thụ hưởng của hành khách. Nếu sau 48 giờ chưa nhận được tiền, vui lòng gọi hotline 1900 8899.',
  },
  {
    category: 'Công nghệ & Geofencing',
    q: 'Tính năng cảnh báo xe sắp đến trạm qua Geofencing hoạt động như thế nào?',
    a: 'Mỗi xe buýt điện thông minh ICTU đều được trang bị thiết bị định vị GPS RTK độ chính xác cao. Khi xe buýt tiến vào bán kính vùng địa lý của trạm (300m trong nội đô hoặc 500m trạm tiêu chuẩn) hoặc thời gian dự kiến đến (ETA) còn dưới 5 phút, máy chủ sẽ tự động gửi thông báo đẩy (Push Notification) kèm chuông báo du dương 3 nốt đến điện thoại của hành khách.',
  },
  {
    category: 'Bảo hiểm & An toàn',
    q: 'Hành khách trên xe buýt ICTU được bảo hiểm như thế nào?',
    a: '100% hành khách sở hữu vé xe buýt hợp lệ (vé lượt hoặc vé tháng điện tử) đều được bảo hiểm trách nhiệm dân sự và tai nạn hành khách toàn diện theo hợp đồng số BH-ICTU-2026 với hạn mức bồi thường tối đa lên đến 100.000.000 VNĐ / người / vụ trong suốt hành trình từ khi lên xe cho đến khi xuống trạm.',
  },
  {
    category: 'Hóa đơn điện tử',
    q: 'Làm thế nào để lấy hóa đơn GTGT điện tử (VAT 8%) để thanh toán cơ quan?',
    a: 'Sau khi thanh toán thành công, hệ thống tự động xuất hóa đơn điện tử hợp lệ theo Nghị định 123/2020/NĐ-CP và Thông tư 78/2021/TT-BTC do Trường Đại học Công nghệ Thông tin & Truyền thông - ĐH Thái Nguyên (MST: 4600123456-001) phát hành. Bạn có thể truy cập trang Tra Cứu Hóa Đơn Điện Tử, nhập mã vé (VD: ICTU-XXXXXX) để xem chữ ký số và tải file PDF/XML hóa đơn gốc.',
  },
]

export function ServiceInfoView() {
  const [activeSection, setActiveSection] = useState('safety')
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0)
  const [faqSearch, setFaqSearch] = useState('')
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0)

  // Interactive Live Refund Calculator State
  const [calcFare, setCalcFare] = useState<number>(10000)
  const [calcPolicyIdx, setCalcPolicyIdx] = useState<number>(0)
  const [copiedCode, setCopiedCode] = useState(false)

  // Interactive Live Geofence Simulator State
  const [simRadius, setSimRadius] = useState<'300' | '500' | '1000'>('500')
  const [simDistance, setSimDistance] = useState<number>(450)
  const [isPlayingChime, setIsPlayingChime] = useState(false)

  // Virtual Tour 360 State (thamquan.ictu.edu.vn)
  const [isVrModalOpen, setIsVrModalOpen] = useState(false)
  const [vrStationTarget, setVrStationTarget] = useState('Trạm Cổng Chính ĐH CNTT & TT Thái Nguyên (ICTU)')

  // Scrollspy & Reading Progress Tracker
  const [readingProgress, setReadingProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight
      const currentScroll = window.scrollY
      if (totalScroll > 0) {
        setReadingProgress(Math.min(100, Math.round((currentScroll / totalScroll) * 100)))
      }

      // Check active sections
      const sections = ['safety', 'insurance', 'geofencing', 'routes', 'refund-policy', 'invoice', 'about', 'faq', 'contact']
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId)
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top <= 180 && rect.bottom >= 180) {
            setActiveSection(sectionId)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Simulator audio trigger
  const handleTestChime = () => {
    setIsPlayingChime(true)
    haptic.play('busArrival')
    setTimeout(() => {
      setIsPlayingChime(false)
    }, 1500)
  }

  // Calculate live refund numbers
  const currentPolicy = REFUND_POLICIES[calcPolicyIdx]
  const refundAmount = Math.round((calcFare * currentPolicy.refundPercent) / 100)
  const feeAmount = calcFare - refundAmount

  // Filtered FAQs
  const filteredFaqs = FAQ_ITEMS.filter(
    (item) =>
      item.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
      item.a.toLowerCase().includes(faqSearch.toLowerCase()) ||
      item.category.toLowerCase().includes(faqSearch.toLowerCase()),
  )

  const handleCopyTaxId = () => {
    navigator.clipboard.writeText('4600123456-001')
    setCopiedCode(true)
    haptic.play('tap')
    setTimeout(() => setCopiedCode(false), 2000)
  }

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white">
      {/* Top Reading Progress Bar */}
      <div
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-700 z-50 transition-all duration-150"
        style={{ width: `${readingProgress}%` }}
        role="progressbar"
        aria-valuenow={readingProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      />

      {/* Sticky Global Top Bar with Back Button */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md transition-all">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="group inline-flex items-center gap-2 rounded-xl border border-blue-200/80 bg-blue-50/70 px-3.5 py-1.5 text-xs font-black text-blue-800 transition-all hover:bg-blue-600 hover:text-white hover:shadow-md hover:shadow-blue-600/20 active:scale-95"
            >
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
              <span>Về Màn Hình Đặt Vé</span>
            </Link>

            <span className="hidden sm:inline-block h-4 w-px bg-slate-200" aria-hidden="true" />

            <div className="hidden sm:flex items-center gap-2">
              <BrandMark size="sm" />
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-tight text-blue-900">ICTU TRANSIT PORTAL</span>
                <span className="text-[10px] font-bold text-slate-500">Cổng Thông Tin & Quy Định Dịch Vụ</span>
              </div>
            </div>
          </div>

          {/* Right Status Indicator & Quick Contact */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span>12 Xe Buýt Điện Đang Vận Hành Ổn Định</span>
            </div>

            <a
              href={`tel:${CONTACT.hotline.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-800 transition-colors hover:border-blue-500 hover:text-blue-700 shadow-xs"
            >
              <PhoneCall size={13} className="text-blue-600" />
              <span>{CONTACT.hotline}</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-900 via-blue-950 to-slate-900 py-16 text-white sm:py-20">
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-0 -left-40 size-96 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 -right-40 size-96 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-blue-500/20 px-4 py-1.5 text-xs font-bold text-cyan-300 backdrop-blur-md mb-6 shadow-inner">
              <Sparkles size={14} className="animate-spin-slow text-cyan-400" />
              <span>Hệ Thống Vận Tải Thông Minh · Trường ĐH CNTT & TT Thái Nguyên</span>
            </div>

            <h1 className="max-w-4xl text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.15]">
              Thông Tin Dịch Vụ, Chính Sách & Mạng Lưới Tuyến Xe Buýt ICTU
            </h1>

            <p className="mt-6 max-w-2xl text-sm font-medium text-slate-300 sm:text-base leading-relaxed">
              Trang thông tin chính thống về an toàn giao dịch trực tuyến, biểu phí hoàn hủy vé minh bạch, chính sách bảo hiểm hành khách toàn diện và công nghệ Geofencing cảnh báo chuyến xe theo thời gian thực.
            </p>

            {/* Live Telemetry Ticker */}
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 w-full max-w-4xl">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md text-left">
                <div className="flex items-center gap-2 text-cyan-400 mb-1">
                  <ShieldCheck size={18} />
                  <span className="text-xs font-bold text-slate-300">Bảo Mật Giao Dịch</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-white">HMAC-SHA256</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Xác thực vé chống quay vòng</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md text-left">
                <div className="flex items-center gap-2 text-emerald-400 mb-1">
                  <Shield size={18} />
                  <span className="text-xs font-bold text-slate-300">Bảo Hiểm Tối Đa</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-white">100 Tr/Vụ</div>
                <div className="text-[11px] text-slate-400 mt-0.5">100% hành khách có vé</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md text-left">
                <div className="flex items-center gap-2 text-blue-400 mb-1">
                  <Radio size={18} />
                  <span className="text-xs font-bold text-slate-300">Geofencing IoT</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-white">300m - 500m</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Cảnh báo xe sắp đến trạm</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md text-left">
                <div className="flex items-center gap-2 text-amber-400 mb-1">
                  <FileText size={18} />
                  <span className="text-xs font-bold text-slate-300">Hóa Đơn Điện Tử</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-white">NĐ 123/2020</div>
                <div className="text-[11px] text-slate-400 mt-0.5">MST: 4600123456-001 (VAT 8%)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Two-Column Layout: Sidebar Navigation + Detailed Content Sections */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Left Column: Sticky Table of Contents (Scrollspy) */}
          <aside className="lg:col-span-3">
            <div className="sticky top-24 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Mục Lục Hướng Dẫn</h2>
              <nav className="flex flex-col gap-1 text-sm font-bold">
                {[
                  { id: 'safety', label: '1. Giao Dịch & Bảo Mật Thanh Toán', icon: ShieldCheck },
                  { id: 'insurance', label: '2. Bảo Hiểm Hành Khách Toàn Diện', icon: Shield },
                  { id: 'geofencing', label: '3. Công Nghệ Geofencing Radar', icon: Radio },
                  { id: 'routes', label: '4. Mạng Lưới Tuyến & Trạm Dừng', icon: Bus },
                  { id: 'refund-policy', label: '5. Chính Sách Vé & Hoàn Hủy', icon: RotateCcw },
                  { id: 'invoice', label: '6. Hóa Đơn Điện Tử (NĐ 123)', icon: FileText },
                  { id: 'about', label: '7. Đơn Vị Vận Hành & MST', icon: GraduationCap },
                  { id: 'faq', label: '8. Câu Hỏi Thường Gặp (FAQ)', icon: HelpCircle },
                  { id: 'contact', label: '9. Kênh Hỗ Trợ 24/7', icon: PhoneCall },
                ].map((item) => {
                  const Icon = item.icon
                  const isActive = activeSection === item.id
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={() => setActiveSection(item.id)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all text-xs',
                        isActive
                          ? 'bg-blue-50 font-black text-blue-700 shadow-xs ring-1 ring-blue-200'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                      )}
                    >
                      <Icon size={16} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                      <span className="truncate">{item.label}</span>
                    </a>
                  )
                })}
              </nav>

              <div className="mt-6 border-t border-slate-100 pt-4">
                <Link
                  href="/"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-black text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95"
                >
                  <Ticket size={16} />
                  <span>Mua Vé Lượt Ngay</span>
                </Link>
              </div>
            </div>
          </aside>

          {/* Right Column: In-Depth Rich Content Modules */}
          <main className="lg:col-span-9 space-y-16">
            {/* SECTION 1: Giao Dịch An Toàn & Bảo Mật Thanh Toán */}
            <article id="safety" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-black text-sm">
                  01
                </span>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                    Giao Dịch An Toàn & Bảo Mật Thanh Toán Trực Tuyến
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">Chuẩn an toàn bảo mật cấp ngân hàng cho cổng thông tin ICTU Transit</p>
                </div>
              </div>

              {/* Graphic Illustration with ICTU Signature Blue Identity */}
              <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 shadow-md">
                <Image
                  src="/images/info-payment-security.jpg"
                  alt="Hệ thống bảo mật thanh toán vé xe buýt thông minh ICTU Transit"
                  width={1280}
                  height={720}
                  className="w-full object-cover transition-transform duration-700 hover:scale-105"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-6">
                  <div className="text-white space-y-1">
                    <span className="inline-block rounded-full bg-blue-600/90 backdrop-blur-md px-3 py-1 text-[11px] font-black tracking-wide text-white uppercase">
                      ICTU Smart Bus Security Architecture
                    </span>
                    <p className="text-sm font-semibold text-slate-200">
                      Mã hóa chuẩn SHA-256 đối với mã QR vé và SHA-512 đối với các giao dịch cổng thanh toán VietQR, MoMo và VNPay.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-3">
                    <ShieldCheck size={20} />
                  </div>
                  <h3 className="text-base font-black text-slate-900">Mã QR Chống Tái Sử Dụng</h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Mỗi vé xe có mã QR động tích hợp chữ ký số và cơ chế Anti-Passback. Ngay sau khi tài xế quét soát vé, mã tự động chuyển trạng thái <code className="text-blue-700 font-bold">CHECKED_IN</code> và vô hiệu hóa lập tức.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 mb-3">
                    <CreditCard size={20} />
                  </div>
                  <h3 className="text-base font-black text-slate-900">Xác Thực IPN Webhook</h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Mọi yêu cầu đối soát thanh toán đều sử dụng chữ ký điện tử HMAC-SHA512 để xác thực nguồn gốc từ ngân hàng đối tác, loại bỏ hoàn toàn nguy cơ giả mạo biên lai chuyển tiền.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mb-3">
                    <Wifi size={20} />
                  </div>
                  <h3 className="text-base font-black text-slate-900">Offline Ticket Cache</h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Vé đã mua được lưu trữ mã hóa cục bộ trên thiết bị của hành khách (IndexedDB/LocalStorage). Khi qua các điểm sóng yếu như vùng đồi chè, mã QR vẫn hiển thị mượt mà để quét lên xe.
                  </p>
                </div>
              </div>
            </article>

            {/* SECTION 2: Bảo Hiểm Hành Khách Toàn Diện */}
            <article id="insurance" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-black text-sm">
                  02
                </span>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                    Bảo Hiểm Hành Khách & Tiêu Chuẩn An Toàn Vận Tải
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">Bảo vệ tối đa 100.000.000 VNĐ / người / vụ cho hành khách ICTU Transit</p>
                </div>
              </div>

              {/* Graphic Illustration with ICTU Campus and Safe Electric Bus */}
              <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 shadow-md">
                <Image
                  src="/images/info-passenger-safety.jpg"
                  alt="Chính sách bảo hiểm hành khách xe buýt điện thông minh ICTU Transit"
                  width={1280}
                  height={720}
                  className="w-full object-cover transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-6">
                  <div className="text-white space-y-1">
                    <span className="inline-block rounded-full bg-emerald-600/90 backdrop-blur-md px-3 py-1 text-[11px] font-black tracking-wide text-white uppercase">
                      Hợp Đồng Bảo Hiểm Số: BH-ICTU-2026/PVI
                    </span>
                    <p className="text-sm font-semibold text-slate-200">
                      Đội xe buýt điện thông minh ICTU với mái vòm an toàn bảo hộ hành khách từ thời điểm bước lên xe cho đến khi rời trạm an toàn.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6 space-y-4">
                <h3 className="text-lg font-black text-blue-900 flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-blue-600" />
                  Quyền Lợi Bảo Hiểm Tự Động Đi Kèm Với Mỗi Vé Hợp Lệ
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs text-slate-700">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="size-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                      <span><strong>Đối tượng thụ hưởng:</strong> 100% hành khách có vé xe buýt lượt hoặc thẻ tháng sinh viên hợp lệ.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="size-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                      <span><strong>Hạn mức bồi thường:</strong> Lên tới <strong>100.000.000 VNĐ / vụ</strong> theo Luật Giao thông Đường bộ và Thông tư bảo hiểm trách nhiệm dân sự.</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="size-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                      <span><strong>Phạm vi bảo hiểm:</strong> Xuyên suốt từ lúc hành khách đặt chân lên cửa xe, trong hành trình di chuyển cho đến khi bước xuống trạm dừng an toàn.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="size-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                      <span><strong>Hỗ trợ bồi thường 24/7:</strong> Đường dây nóng tiếp nhận hồ sơ y tế và giám định khẩn cấp: <strong>1900 8899</strong>.</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            {/* SECTION 3: Công Nghệ Geofencing & Radar Cảnh Báo Trạm Dừng */}
            <article id="geofencing" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-black text-sm">
                  03
                </span>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                    Mạng Lưới Trạm Dừng & Công Nghệ Geofencing Radar
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">Định vị GPS vi sai RTK & cảnh báo đón xe qua hàng rào địa lý thông minh</p>
                </div>
              </div>

              {/* Graphic Illustration for Geofence IoT Radar */}
              <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 shadow-md">
                <Image
                  src="/images/info-geofence-radar.jpg"
                  alt="Bản đồ IoT Geofencing cảnh báo trạm dừng thời gian thực tại Thái Nguyên"
                  width={1280}
                  height={720}
                  className="w-full object-cover transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-6">
                  <div className="text-white space-y-1">
                    <span className="inline-block rounded-full bg-cyan-600/90 backdrop-blur-md px-3 py-1 text-[11px] font-black tracking-wide text-white uppercase">
                      Thai Nguyen Transit Telemetry & Geofence Rings
                    </span>
                    <p className="text-sm font-semibold text-slate-200">
                      Mô phỏng 3 lớp bán kính Geofencing bảo đảm độ trễ cảnh báo dưới 1 giây qua công nghệ Web Push và âm thanh Melodic Transit Chime.
                    </p>
                  </div>
                </div>
              </div>

              {/* ===================================================================
                  INTERACTIVE GEOFENCING RADAR SIMULATOR WIDGET ("THẬT SỰ ĐANG SỐNG")
                  =================================================================== */}
              <div className="rounded-3xl border-2 border-blue-500/30 bg-gradient-to-b from-slate-900 to-blue-950 p-6 sm:p-8 text-white shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex size-3 rounded-full bg-cyan-400 animate-ping" />
                      <h3 className="text-lg font-black text-white">Mô Phỏng Trực Tiếp Vùng Bán Kính Geofencing</h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Kéo thanh trượt khoảng cách để xem hệ thống kích hoạt cảnh báo thông minh và âm báo đến điện thoại.
                    </p>
                  </div>

                  {/* Radius Preset Buttons */}
                  <div className="flex items-center gap-2 bg-white/10 rounded-xl p-1 backdrop-blur-md">
                    {[
                      { val: '300', label: '300m (Nội thành)' },
                      { val: '500', label: '500m (Tiêu chuẩn)' },
                      { val: '1000', label: '1000m (Cao tốc)' },
                    ].map((btn) => (
                      <button
                        key={btn.val}
                        type="button"
                        onClick={() => {
                          setSimRadius(btn.val as any)
                          haptic.play('tap')
                        }}
                        className={cn(
                          'rounded-lg px-2.5 py-1 text-xs font-bold transition-all',
                          simRadius === btn.val
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-300 hover:text-white',
                        )}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Distance Slider & Telemetry Display */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-300">Khoảng cách xe tới trạm đón bạn:</span>
                    <span className="text-cyan-400 font-mono text-base font-black">
                      {simDistance} mét ({Math.max(1, Math.round(simDistance / 100))} phút ETA)
                    </span>
                  </div>

                  <input
                    type="range"
                    min="50"
                    max="1500"
                    step="25"
                    value={simDistance}
                    onChange={(e) => {
                      const newDist = Number(e.target.value)
                      setSimDistance(newDist)
                      if (newDist <= Number(simRadius)) {
                        haptic.play('tap')
                      }
                    }}
                    className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
                  />

                  <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                    <span>50m (Cập bến)</span>
                    <span className="text-blue-400 font-bold">Ngưỡng cảnh báo: {simRadius}m</span>
                    <span>1500m (Đang di chuyển xa)</span>
                  </div>
                </div>

                {/* Simulated Notification Box with Pulse */}
                <div
                  className={cn(
                    'rounded-2xl p-4 sm:p-5 border transition-all duration-300 flex items-center justify-between gap-4',
                    simDistance <= Number(simRadius)
                      ? 'border-emerald-500/80 bg-emerald-950/40 text-emerald-200 shadow-lg shadow-emerald-950/50'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400',
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={cn(
                        'flex size-11 items-center justify-center rounded-xl transition-colors',
                        simDistance <= Number(simRadius)
                          ? 'bg-emerald-500 text-white animate-bounce'
                          : 'bg-slate-800 text-slate-500',
                      )}
                    >
                      <Bell size={20} />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider">
                        {simDistance <= Number(simRadius) ? (
                          <span className="text-emerald-400 flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                            Đã Kích Hoạt Cảnh Báo Xe Vào Trạm ({simDistance}m ≤ {simRadius}m)
                          </span>
                        ) : (
                          <span className="text-slate-400">Trạng thái: Xe ngoài bán kính ({simDistance}m &gt; {simRadius}m)</span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-white mt-0.5">
                        {simDistance <= Number(simRadius)
                          ? `Xe buýt CT-01 đang cách trạm ${simDistance}m (~${Math.max(1, Math.round(simDistance / 100))} phút). Quý khách vui lòng chuẩn bị ra điểm đón!`
                          : `Xe buýt đang di chuyển trên lộ trình bình thường. Cảnh báo sẽ tự động phát khi xe cách dưới ${simRadius}m.`}
                      </p>
                    </div>
                  </div>

                  {/* Chime Test Button */}
                  <button
                    type="button"
                    onClick={handleTestChime}
                    disabled={isPlayingChime}
                    className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white px-3.5 py-2 text-xs font-black shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Volume2 size={16} className={isPlayingChime ? 'animate-pulse text-cyan-300' : ''} />
                    <span className="hidden sm:inline">Phát Chuông 3 Nốt</span>
                  </button>
                </div>
              </div>
            </article>

            {/* SECTION 4: Mạng Lưới Tuyến & Trạm Dừng */}
            <article id="routes" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-black text-sm">
                  04
                </span>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                    Mạng Lưới Tuyến Xe Buýt Thông Minh ICTU
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">Lộ trình kết nối Đại học Công nghệ Thông tin & Truyền thông với toàn tỉnh Thái Nguyên</p>
                </div>
              </div>

              {/* Route Tabs Switcher */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                {ROUTES_INFO.map((r, idx) => (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => {
                      setSelectedRouteIdx(idx)
                      haptic.play('tap')
                    }}
                    className={cn(
                      'rounded-xl px-4 py-2 text-xs sm:text-sm font-black transition-all',
                      selectedRouteIdx === idx
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    Tuyến {r.code} - {r.name}
                  </button>
                ))}
              </div>

              {/* Selected Route Details Card */}
              {(() => {
                const route = ROUTES_INFO[selectedRouteIdx]
                return (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-blue-600 text-white text-xs font-black px-2.5 py-1">
                            {route.code}
                          </span>
                          <h3 className="text-lg font-black text-slate-900">{route.endpoints}</h3>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Chiều dài lộ trình: {route.distance} · Giãn cách {route.frequency}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[11px] font-bold text-slate-400">Vé Thường / Vé Sinh Viên</div>
                          <div className="text-base font-black text-blue-700">
                            {route.standardFare.toLocaleString('vi-VN')}đ <span className="text-xs text-slate-400 font-medium">/</span>{' '}
                            <span className="text-emerald-600">{route.studentFare.toLocaleString('vi-VN')}đ</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Station Timeline View with animated bus */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                        Danh sách trạm dừng & Trạm trung chuyển chính
                      </h4>

                      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-blue-200">
                        {route.stations.map((st, sIdx) => (
                          <div key={st.name} className="relative flex items-start justify-between gap-4 group">
                            {/* Dot Marker */}
                            <span
                              className={cn(
                                'absolute -left-6 sm:-left-8 top-1.5 flex size-4 items-center justify-center rounded-full ring-4 ring-white',
                                st.hub ? 'bg-blue-600' : 'bg-slate-300 group-hover:bg-blue-400',
                              )}
                            />

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black text-slate-900">{st.name}</span>
                                {st.hub && (
                                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-700">
                                    Trạm Hub
                                  </span>
                                )}
                                {st.name.includes('ICTU') && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setVrStationTarget(st.name)
                                      setIsVrModalOpen(true)
                                      haptic.play('tap')
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/80 bg-cyan-50 px-2 py-0.5 text-[10px] font-black text-cyan-800 hover:bg-cyan-100 transition-colors cursor-pointer"
                                    title="Xem thực tế ảo 360 độ điểm chờ xe buýt cổng trường ICTU"
                                  >
                                    <Compass size={12} className="text-cyan-700 animate-spin-slow" />
                                    <span>🕶️ Xem Trạm 360° VR</span>
                                  </button>
                                )}
                              </div>
                              <span className="text-xs text-slate-500">{st.type}</span>
                            </div>

                            <span className="font-mono text-xs font-bold text-slate-400 shrink-0">
                              Lượt đầu: {st.time}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Interactive VR 360 Showcase Banner (Integrated from thamquan.ictu.edu.vn) */}
                      <div className="mt-8 rounded-3xl border border-cyan-300/60 bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 p-6 sm:p-7 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute -right-16 -bottom-16 size-64 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                          <div className="space-y-1.5 max-w-xl">
                            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/20 border border-cyan-400/40 px-3 py-1 text-[11px] font-black text-cyan-300">
                              <Compass size={13} className="animate-spin-slow text-cyan-400" />
                              <span>TÍCH HỢP TÀI NGUYÊN SỐ: THAMQUAN.ICTU.EDU.VN</span>
                            </div>
                            <h4 className="text-base sm:text-lg font-black text-white">
                              Khám Phá Điểm Đón & Toàn Cảnh Khuôn Viên ICTU Qua Thực Tế Ảo 360°
                            </h4>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              Hành khách và tân sinh viên có thể tương tác xoay 360 độ xem trước vị trí bến đón xe buýt tại Cổng Chính, Quảng trường Đổi mới sáng tạo, bãi gửi xe và các khối nhà giảng đường trước khi xe cập bến.
                            </p>
                          </div>

                          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                setVrStationTarget('Trạm Cổng Chính & Khuôn Viên ĐH CNTT & TT Thái Nguyên')
                                setIsVrModalOpen(true)
                                haptic.play('tap')
                              }}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black px-4 py-2.5 text-xs shadow-lg shadow-cyan-400/20 transition-all active:scale-95 cursor-pointer"
                            >
                              <Compass size={15} />
                              <span>Mở Trải Nghiệm VR 360°</span>
                            </button>
                            <a
                              href="https://thamquan.ictu.edu.vn/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white font-bold px-3.5 py-2.5 text-xs transition-colors"
                            >
                              <span>Cổng Gốc ↗</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </article>

            {/* SECTION 5: Chính Sách Vé & Bảng Tính Hoàn Hủy Tự Động */}
            <article id="refund-policy" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-black text-sm">
                  05
                </span>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                    Chính Sách Vé, Vé Tháng & Quy Định Hoàn Hủy
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">Bảng biểu phí hoàn hủy vé minh bạch theo thời gian biểu điều độ của Bộ GTVT</p>
                </div>
              </div>

              {/* Policy Table Matrix */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3.5 sm:px-6">Khung Thời Gian Yêu Cầu Hủy</th>
                      <th className="px-4 py-3.5 text-center">Tỷ Lệ Hoàn Lại</th>
                      <th className="px-4 py-3.5 text-center">Phí Vận Hành</th>
                      <th className="hidden px-4 py-3.5 sm:table-cell">Ghi Chú Điều Khoản</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {REFUND_POLICIES.map((p) => (
                      <tr key={p.timeframe} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-4 sm:px-6 font-bold text-slate-900">
                          {p.timeframe}
                          <div className="sm:hidden text-[11px] font-normal text-slate-500 mt-1">{p.desc}</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span
                            className={cn(
                              'inline-block rounded-full px-2.5 py-1 text-xs font-black',
                              p.refundPercent === 100
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.refundPercent > 0
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-rose-100 text-rose-800',
                            )}
                          >
                            {p.refundPercent}%
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-slate-700">
                          {p.feePercent}%
                        </td>
                        <td className="hidden px-4 py-4 text-xs text-slate-500 sm:table-cell">
                          {p.desc}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ===================================================================
                  INTERACTIVE LIVE REFUND FEE CALCULATOR ("THẬT SỰ ĐANG SỐNG")
                  =================================================================== */}
              <div className="rounded-3xl border-2 border-blue-600/30 bg-white p-6 sm:p-8 shadow-lg space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                    <RotateCcw size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Công Cụ Tính Tiền Hoàn Vé Tự Động Trực Quan</h3>
                    <p className="text-xs text-slate-500">Nhập giá vé và chọn khung giờ hủy để xem kết quả tính toán chi tiết tức thì</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Left inputs */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                        1. Chọn Mức Giá Vé Của Bạn (VND)
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[5000, 10000, 15000].map((fare) => (
                          <button
                            key={fare}
                            type="button"
                            onClick={() => {
                              setCalcFare(fare)
                              haptic.play('tap')
                            }}
                            className={cn(
                              'rounded-xl border py-2.5 text-xs font-black transition-all',
                              calcFare === fare
                                ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-600/20'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                            )}
                          >
                            {fare.toLocaleString('vi-VN')} đ
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                        2. Chọn Thời Điểm Bạn Gửi Yêu Cầu Hủy Vé
                      </label>
                      <div className="space-y-2">
                        {REFUND_POLICIES.map((pol, idx) => (
                          <button
                            key={pol.timeframe}
                            type="button"
                            onClick={() => {
                              setCalcPolicyIdx(idx)
                              haptic.play('tap')
                            }}
                            className={cn(
                              'flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all',
                              calcPolicyIdx === idx
                                ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20'
                                : 'border-slate-200 bg-white hover:bg-slate-50',
                            )}
                          >
                            <span className="text-xs font-bold text-slate-800">{pol.timeframe}</span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[11px] font-black',
                                pol.refundPercent === 100
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : pol.refundPercent > 0
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-rose-100 text-rose-800',
                              )}
                            >
                              Hoàn {pol.refundPercent}%
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right result card */}
                  <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/80 p-6 space-y-4">
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kết Quả Ước Tính Chi Tiết</span>
                      <div className="mt-3 space-y-3 text-xs">
                        <div className="flex justify-between py-1.5 border-b border-slate-200">
                          <span className="text-slate-600">Giá vé ban đầu:</span>
                          <span className="font-bold text-slate-900">{calcFare.toLocaleString('vi-VN')} VNĐ</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-200">
                          <span className="text-slate-600">Phí hủy khấu trừ ({currentPolicy.feePercent}%):</span>
                          <span className="font-bold text-rose-600">-{feeAmount.toLocaleString('vi-VN')} VNĐ</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-200">
                          <span className="text-slate-600">Thời gian nhận tiền:</span>
                          <span className="font-bold text-blue-700">Trong vòng 12 - 24 giờ làm việc</span>
                        </div>
                      </div>

                      <div className="mt-6 rounded-2xl bg-white p-4 border border-slate-200 shadow-xs text-center">
                        <span className="text-xs font-bold text-slate-500">Số Tiền Thực Tế Bạn Nhận Lại</span>
                        <div
                          className={cn(
                            'text-3xl font-black mt-1 font-mono',
                            refundAmount > 0 ? 'text-emerald-600' : 'text-slate-400',
                          )}
                        >
                          {refundAmount.toLocaleString('vi-VN')} VNĐ
                        </div>
                        <span className="inline-block mt-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
                          {currentPolicy.badge}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 italic">
                      * Lưu ý: Tiền sẽ được hoàn tự động về đúng tài khoản hoặc ví điện tử hành khách đã dùng để thanh toán vé.
                    </p>
                  </div>
                </div>
              </div>
            </article>

            {/* SECTION 6: Hóa Đơn Điện Tử Chuẩn Nghị Định 123/2020 */}
            <article id="invoice" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-black text-sm">
                  06
                </span>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                    Hóa Đơn Điện Tử Hợp Pháp (Nghị Định 123/2020/NĐ-CP)
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">Phát hành tự động bởi Trường Đại học Công nghệ Thông tin & Truyền thông - ĐH Thái Nguyên</p>
                </div>
              </div>

              {/* Invoice Specs Box */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <FileCheck2 size={18} className="text-blue-600" />
                      Thông Tin Đơn Vị Phát Hành Hóa Đơn
                    </h3>
                    <div className="space-y-2.5 text-xs text-slate-700">
                      <div>
                        <span className="font-bold text-slate-900">Tên đơn vị bán hàng:</span>
                        <p className="text-slate-600">Trường Đại học Công nghệ Thông tin & Truyền thông - Đại học Thái Nguyên</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">Mã số thuế (MST):</span>
                        <code className="rounded bg-slate-100 px-2 py-0.5 font-mono font-bold text-blue-700">
                          4600123456-001
                        </code>
                        <button
                          type="button"
                          onClick={handleCopyTaxId}
                          className="text-[11px] font-bold text-blue-600 hover:underline"
                        >
                          {copiedCode ? 'Đã sao chép!' : 'Sao chép'}
                        </button>
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">Địa chỉ trụ sở:</span>
                        <p className="text-slate-600">Đường Z115, Xã Quyết Thắng, Thành phố Thái Nguyên, Tỉnh Thái Nguyên</p>
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">Thuế suất GTGT (VAT):</span>
                        <span className="ml-1 inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-800">
                          8% (Theo quy định kích cầu dịch vụ vận tải)
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">Ký hiệu mẫu số hóa đơn:</span>
                        <span className="ml-1 font-mono text-slate-600">1/001 - Ký hiệu: C26TCT</span>
                      </div>
                    </div>
                  </div>

                  {/* Direct Action Link to Lookup Page */}
                  <div className="flex flex-col justify-between rounded-2xl border border-blue-200 bg-blue-50/70 p-6 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-blue-900 font-black text-sm">
                        <Search size={18} />
                        Tra Cứu Hóa Đơn Trực Tuyến Nhanh Chóng
                      </div>
                      <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                        Bạn đã đặt vé và cần tải file hóa đơn điện tử định dạng XML và bản thể hiện PDF có chữ ký số Viettel-CA để nộp quyết toán công tác phí hoặc thanh toán cơ quan?
                      </p>
                    </div>

                    <Link
                      href="/tra-cuu-hoa-don"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-black text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95"
                    >
                      <Receipt size={16} />
                      <span>Đến Trang Tra Cứu Hóa Đơn Điện Tử</span>
                      <ExternalLink size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            </article>

            {/* SECTION 7: Đơn Vị Vận Hành & Giấy Phép Pháp Lý */}
            <article id="about" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-black text-sm">
                  07
                </span>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                    Đơn Vị Quản Lý & Vận Hành Hệ Thống
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">Đơn vị chủ quản và các chứng chỉ, giấy phép vận tải hành khách hợp pháp</p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5 border-b border-slate-100 pb-6">
                  <BrandMark size="lg" />
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      Trường Đại học Công nghệ Thông tin & Truyền thông - Đại học Thái Nguyên
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Hệ Thống Quản Lý & Điều Độ Xe Buýt Thông Minh (ICTU Smart Transit Solution)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <span className="font-bold text-slate-500 block mb-1">Giấy phép kinh doanh vận tải:</span>
                    <span className="font-mono font-black text-slate-900">{CONTACT.license}</span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <span className="font-bold text-slate-500 block mb-1">Cơ quan phê duyệt:</span>
                    <span className="font-bold text-slate-900">Sở Giao thông Vận tải Thái Nguyên</span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <span className="font-bold text-slate-500 block mb-1">Mã định danh đơn vị:</span>
                    <span className="font-mono font-black text-blue-700">ICTU-TRANSIT-TN</span>
                  </div>
                </div>
              </div>
            </article>

            {/* SECTION 8: Câu Hỏi Thường Gặp (FAQ) với Bộ Lọc Tức Thì */}
            <article id="faq" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-black text-sm">
                  08
                </span>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                    Giải Đáp Câu Hỏi Thường Gặp (FAQ)
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">Những thắc mắc phổ biến nhất của sinh viên và hành khách khi sử dụng dịch vụ</p>
                </div>
              </div>

              {/* Instant Search Bar */}
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm câu hỏi: 'hoàn vé', 'vé tháng', 'hóa đơn', 'geofencing'..."
                  value={faqSearch}
                  onChange={(e) => setFaqSearch(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-4 focus:ring-blue-500/10 shadow-xs"
                />
              </div>

              {/* FAQ Accordion List */}
              <div className="space-y-3">
                {filteredFaqs.length > 0 ? (
                  filteredFaqs.map((faq, idx) => {
                    const isOpen = expandedFaq === idx
                    return (
                      <div
                        key={faq.q}
                        className={cn(
                          'rounded-2xl border transition-all duration-200 overflow-hidden',
                          isOpen ? 'border-blue-300 bg-blue-50/30 shadow-xs' : 'border-slate-200 bg-white',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedFaq(isOpen ? null : idx)
                            haptic.play('tap')
                          }}
                          className="flex w-full items-center justify-between p-5 text-left transition-colors"
                        >
                          <div className="flex items-center gap-3 pr-4">
                            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-700 shrink-0">
                              {faq.category}
                            </span>
                            <span className="text-xs sm:text-sm font-black text-slate-900">{faq.q}</span>
                          </div>
                          <ChevronDown
                            size={18}
                            className={cn('text-slate-400 transition-transform duration-200 shrink-0', isOpen && 'rotate-180 text-blue-600')}
                          />
                        </button>

                        {isOpen && (
                          <div className="border-t border-slate-100 px-5 pb-5 pt-3 text-xs sm:text-sm text-slate-600 leading-relaxed animate-fadeIn">
                            {faq.a}
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                    Không tìm thấy câu hỏi phù hợp với từ khóa &ldquo;{faqSearch}&rdquo;. Bạn vui lòng liên hệ tổng đài 1900 8899 để được hỗ trợ trực tiếp.
                  </div>
                )}
              </div>
            </article>

            {/* SECTION 9: Liên Hệ & Hỗ Trợ Khách Hàng 24/7 */}
            <article id="contact" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-black text-sm">
                  09
                </span>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                    Kênh Hỗ Trợ & Tiếp Nhận Phản Hồi 24/7
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">Đội ngũ điều hành trung tâm ICTU Transit luôn sẵn sàng hỗ trợ bạn</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-3">
                    <PhoneCall size={20} />
                  </div>
                  <h3 className="text-sm font-black text-slate-900">Tổng Đài Khẩn Cấp</h3>
                  <p className="mt-1 text-xs text-slate-500">Giải đáp lộ trình, xử lý bỏ quên hành lý trên xe buýt</p>
                  <a
                    href={`tel:${CONTACT.hotline.replace(/\s/g, '')}`}
                    className="mt-3 inline-block font-mono text-base font-black text-blue-700 hover:underline"
                  >
                    {CONTACT.hotline}
                  </a>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 mb-3">
                    <Receipt size={20} />
                  </div>
                  <h3 className="text-sm font-black text-slate-900">Email Hỗ Trợ Kỹ Thuật</h3>
                  <p className="mt-1 text-xs text-slate-500">Tiếp nhận phản hồi vé tháng, xuất hóa đơn VAT</p>
                  <a
                    href={`mailto:${CONTACT.email}`}
                    className="mt-3 inline-block text-xs font-bold text-blue-700 hover:underline break-all"
                  >
                    {CONTACT.email}
                  </a>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mb-3">
                    <MapPin size={20} />
                  </div>
                  <h3 className="text-sm font-black text-slate-900">Văn Phòng Điều Độ</h3>
                  <p className="mt-1 text-xs text-slate-500">Phòng Công tác Học sinh - Sinh viên, Nhà C1, ICTU</p>
                  <span className="mt-3 inline-block text-xs font-bold text-slate-700">
                    Giờ làm việc: 07:30 - 17:30 (Thứ 2 - Thứ 7)
                  </span>
                </div>
              </div>
            </article>

            {/* Bottom Return CTA Banner */}
            <div className="rounded-3xl bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-8 text-white shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white">Sẵn Sàng Cho Chuyến Đi An Toàn Cùng ICTU?</h3>
                <p className="text-xs text-slate-300">
                  Đặt vé xe buýt điện ngay hôm nay để trải nghiệm dịch vụ tiện nghi, hiện đại và thân thiện với môi trường!
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-black text-blue-900 shadow-md transition-all hover:bg-slate-100 active:scale-95"
                >
                  <ArrowLeft size={16} />
                  <span>Về Màn Hình Đặt Vé</span>
                </Link>
                <Link
                  href="/tra-cuu-hoa-don"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-xs font-bold text-white transition-all hover:bg-white/20 active:scale-95"
                >
                  <FileText size={16} />
                  <span>Tra Cứu Hóa Đơn</span>
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Virtual Reality 360 Station Tour Modal (thamquan.ictu.edu.vn) */}
      <VrStationTourModal
        isOpen={isVrModalOpen}
        onClose={() => setIsVrModalOpen(false)}
        stationName={vrStationTarget}
      />
    </div>
  )
}
