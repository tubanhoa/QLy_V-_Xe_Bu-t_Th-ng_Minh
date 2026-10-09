import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Ticket,
  Gift,
  Percent,
  Tag,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Bus,
  ChevronLeft,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Kho Voucher & Ưu Đãi Di Chuyển | ICTU Smart Transit',
  description:
    'Tổng hợp mã giảm giá vé xe buýt điện thông minh ICTU, ưu đãi chào tân sinh viên và vé tháng trợ giá.',
}

const PUBLIC_VOUCHERS = [
  {
    code: 'ICTU2026',
    title: 'Chào Đón Tân Sinh Viên K22 ICTU',
    description: 'Giảm 20% tối đa 30.000đ cho mọi chuyến buýt điện thông minh toàn mạng lưới Thái Nguyên',
    discount: 'GIẢM 20%',
    minOrder: '20.000đ',
    maxDiscount: '30.000đ',
    type: 'Tất cả loại vé',
    badge: 'HOT NHẤT',
    badgeColor: 'bg-rose-500 text-white',
    expiry: '31/12/2026',
  },
  {
    code: 'ICTU_BUS10K',
    title: 'Trợ Giá Kích Cầu Vé Lượt',
    description: 'Giảm thẳng 10.000đ trực tiếp khi đặt vé lượt trực tuyến trên Cổng thông tin ICTU Transit',
    discount: 'GIẢM 10.000đ',
    minOrder: '10.000đ',
    maxDiscount: '10.000đ',
    type: 'Vé lượt 28 chỗ',
    badge: 'TIẾT KIỆM',
    badgeColor: 'bg-emerald-600 text-white',
    expiry: '31/12/2026',
  },
  {
    code: 'VETHANG_50K',
    title: 'Ưu Đãi Đăng Ký & Gia Hạn Vé Tháng',
    description: 'Khấu trừ ngay 50.000đ khi đăng ký mới hoặc gia hạn vé tháng xe buýt học sinh sinh viên',
    discount: 'GIẢM 50.000đ',
    minOrder: '100.000đ',
    maxDiscount: '50.000đ',
    type: 'Vé tháng HSSV',
    badge: 'ĐẶC QUYỀN HSSV',
    badgeColor: 'bg-amber-500 text-white',
    expiry: '31/12/2026',
  },
  {
    code: 'CUOITUAN_VUI',
    title: 'Di Chuyển Cuối Tuần Vui Vẻ',
    description: 'Giảm 15% tối đa 20.000đ cho các chuyến xe buýt khởi hành vào Thứ 7 và Chủ Nhật hàng tuần',
    discount: 'GIẢM 15%',
    minOrder: '20.000đ',
    maxDiscount: '20.000đ',
    type: 'Vé lượt cuối tuần',
    badge: 'CUỐI TUẦN',
    badgeColor: 'bg-purple-600 text-white',
    expiry: '31/12/2026',
  },
]

export default function VouchersPage() {
  return (
    <div className="min-h-screen bg-[#F0F7F4] text-slate-900 flex flex-col justify-between">
      {/* Top Banner */}
      <header className="bg-gradient-to-r from-[#005A36] via-[#007044] to-emerald-800 text-white py-8 px-4 sm:px-8 relative overflow-hidden shadow-lg">
        <div className="max-w-5xl mx-auto relative z-10 space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-200 hover:text-white transition-colors bg-white/10 px-3 py-1 rounded-full backdrop-blur-md"
          >
            <ChevronLeft size={14} />
            <span>Về trang chủ đặt vé</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-0.5 text-xs font-black backdrop-blur-md">
                <Sparkles size={13} className="text-amber-300" />
                <span>ICTU Transit Rewards</span>
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                Kho Voucher & Khuyến Mại Đi Xe Buýt
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100 max-w-xl">
                Thu thập và sử dụng mã ưu đãi để nhận mức giá vé tốt nhất trên toàn bộ mạng lưới xe buýt điện thông minh
              </p>
            </div>

            <Link
              href="/?openTickets=true"
              className="inline-flex items-center gap-2 rounded-xl bg-white text-[#005A36] px-4 py-2.5 text-xs font-black shadow-md hover:bg-emerald-50 active:scale-95 transition-all self-start sm:self-auto"
            >
              <Ticket size={15} />
              <span>Ví vé của tôi</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="size-5 text-[#005A36]" />
            <h2 className="text-lg font-black text-slate-900">
              Mã Giảm Giá Đang Mở Cho Hành Khách
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            {PUBLIC_VOUCHERS.length} chương trình kích cầu
          </span>
        </div>

        {/* Voucher Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PUBLIC_VOUCHERS.map((v) => (
            <div
              key={v.code}
              className="rounded-3xl border border-emerald-900/10 bg-white p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 relative overflow-hidden group"
            >
              {/* Badge góc phải */}
              <span
                className={`absolute top-4 right-4 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-2xs ${v.badgeColor}`}
              >
                {v.badge}
              </span>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-600 to-[#005A36] text-white shadow-2xs">
                    <Tag size={18} />
                  </div>
                  <div>
                    <span className="font-mono font-black text-lg text-[#005A36] block tracking-tight">
                      {v.code}
                    </span>
                    <span className="text-xs font-black text-amber-600 block">
                      {v.discount}
                    </span>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-slate-900 leading-tight pt-1">
                  {v.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {v.description}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-500 border-t border-slate-100">
                  <span>Đơn tối thiểu: <strong>{v.minOrder}</strong></span>
                  <span>Áp dụng: <strong>{v.type}</strong></span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} /> HSD: {v.expiry}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <Link
                href={`/?openVouchers=true`}
                className="w-full py-2.5 rounded-xl bg-[#005A36] hover:bg-emerald-800 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 text-center"
              >
                <span>Thu thập & Sử dụng ngay</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>

        {/* Thông tin chính sách */}
        <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50/60 p-5 space-y-2 text-xs text-emerald-950">
          <div className="flex items-center gap-2 font-black text-sm text-[#005A36]">
            <ShieldCheck size={18} />
            <span>Quy định sử dụng Voucher & Mã giảm giá thông minh</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1 text-xs">
            <li>Mỗi đơn đặt chỗ chỉ được áp dụng 01 mã giảm giá hợp lệ.</li>
            <li>Hệ thống tự động kiểm tra điều kiện đơn hàng tối thiểu và giới hạn số lượt sử dụng trong thời gian thực.</li>
            <li>Sau khi áp dụng mã thành công, số tiền cần thanh toán sẽ được khấu trừ tức thì trước khi tạo mã QR hoặc chuyển hướng thanh toán.</li>
          </ul>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        Hệ Thống Quản Lý Vé Xe Buýt Điện Thông Minh ICTU Transit · Bản Quyền 2026
      </footer>
    </div>
  )
}
