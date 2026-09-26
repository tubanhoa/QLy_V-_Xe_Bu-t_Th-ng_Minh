'use client'

import { useState } from 'react'
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  MapPin,
  Megaphone,
  QrCode,
  Route,
  Search,
  ShieldCheck,
  Ticket,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickAccessModalsProps {
  activeModal: 'routes' | 'news' | 'student-pass' | 'lookup' | null
  onClose: () => void
  onBookSeat?: () => void
}

interface LookupResult {
  code: string
  passenger: string
  seat: string
  trip: string
  status: string
}

export function QuickAccessModals({ activeModal, onClose, onBookSeat }: QuickAccessModalsProps) {
  const [lookupCode, setLookupCode] = useState('')
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)
  const [studentFormSubmitted, setStudentFormSubmitted] = useState(false)

  const handleClose = () => {
    onClose()
    setLookupCode('')
    setLookupResult(null)
    setStudentFormSubmitted(false)
  }

  if (!activeModal) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl max-h-[85vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-gradient-to-r from-emerald-50/80 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[#005A36] text-white shadow-sm">
              {activeModal === 'routes' && <Route size={20} />}
              {activeModal === 'news' && <Megaphone size={20} />}
              {activeModal === 'student-pass' && <GraduationCap size={20} />}
              {activeModal === 'lookup' && <Search size={20} />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {activeModal === 'routes' && 'Mạng Lưới Tuyến Xe Buýt ICTU'}
                {activeModal === 'news' && 'Tin Tức & Lịch Xuất Bến Hôm Nay'}
                {activeModal === 'student-pass' && 'Đăng Ký Vé Tháng HSSV Giảm 50%'}
                {activeModal === 'lookup' && 'Tra Cứu Vé Xe & Ưu Đãi'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">Hệ Thống Xe Buýt Thông Minh ICTU Transit</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="overflow-y-auto p-6 space-y-4 text-slate-700 text-sm">
          {/* Modal 1: Routes List */}
          {activeModal === 'routes' && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 transition-colors hover:border-[#005A36]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-[#005A36] px-2.5 py-1 text-xs font-black text-white">CT-01</span>
                    <span className="font-bold text-slate-900">KTX ICTU ➔ Bến xe Thái Nguyên</span>
                  </div>
                  <span className="text-xs font-bold text-[#005A36]">15.000đ</span>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  Lộ trình: Ký túc xá ➔ Giảng đường C1 ➔ Viện CNTT ➔ Cổng chính ➔ Bến xe Đồng Quang ➔ Quảng trường Võ Nguyên Giáp.
                </p>
                <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-500 border-t border-emerald-100 pt-2">
                  <span>Tần suất: 15 phút/chuyến</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      onBookSeat?.()
                    }}
                    className="font-bold text-[#005A36] hover:underline"
                  >
                    Chọn chỗ chuyến này ➔
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#005A36]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-black text-white">CT-02</span>
                    <span className="font-bold text-slate-900">Campus Loop Liên Trường</span>
                  </div>
                  <span className="text-xs font-bold text-teal-700">10.000đ</span>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  Kết nối: ĐH CNTT & TT ➔ ĐH Sư Phạm ➔ ĐH Y Dược ➔ ĐH Kỹ Thuật Công Nghiệp Thái Nguyên.
                </p>
                <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-500 border-t border-slate-100 pt-2">
                  <span>Tần suất: 20 phút/chuyến</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      onBookSeat?.()
                    }}
                    className="font-bold text-[#005A36] hover:underline"
                  >
                    Chọn chỗ chuyến này ➔
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#005A36]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-black text-white">CT-03</span>
                    <span className="font-bold text-slate-900">Xe Buýt Điện Xanh EV Express</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-800">12.000đ</span>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  Tuyến chuyên gia & giảng viên không phát thải kết nối các khu công nghệ cao và trung tâm nghiên cứu AI.
                </p>
              </div>
            </div>
          )}

          {/* Modal 2: Schedule & News */}
          {activeModal === 'news' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4">
                <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  ƯU ĐÃI THÁNG 9
                </span>
                <h4 className="mt-1 font-bold text-slate-900">Tân sinh viên ICTU - Tặng ngay 30 ngày trải nghiệm vé tháng</h4>
                <p className="mt-1 text-xs text-slate-600">
                  Sinh viên Khóa mới chỉ cần xuất trình giấy báo nhập học hoặc mã hồ sơ trực tuyến để nhận thẻ tháng miễn phí.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate-500">
                  <Clock size={14} /> Khung Giờ Xuất Bến Hôm Nay (CT-01)
                </h4>
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
                  {['06:00', '06:30', '07:00', '07:15', '07:30', '07:45', '08:00', '08:30'].map((time) => (
                    <div key={time} className="rounded-xl border border-slate-200 bg-slate-50 py-2 text-slate-800">
                      {time}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Modal 3: Student Pass Form */}
          {activeModal === 'student-pass' && (
            <div>
              {studentFormSubmitted ? (
                <div className="py-6 text-center space-y-3">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-[#005A36]">
                    <CheckCircle2 size={32} />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">Nộp Hồ Sơ Thành Công!</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Hồ sơ vé tháng của bạn đã được gửi tới Ban Điều phối. Thẻ sẽ được kích hoạt vào tài khoản trong vòng 2 giờ làm việc.
                  </p>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-full bg-[#005A36] px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800"
                  >
                    Đóng cửa sổ
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    setStudentFormSubmitted(true)
                  }}
                  className="space-y-3"
                >
                  <div className="rounded-2xl bg-blue-50 border border-blue-200/80 p-3 text-xs text-blue-900 flex items-center gap-2">
                    <ShieldCheck size={18} className="text-blue-600 shrink-0" />
                    <span>Mức trợ giá 50%: Giá vé chỉ còn <strong>100.000đ/tháng</strong> (không giới hạn lượt đi).</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Mã Sinh Viên ICTU *</label>
                      <input
                        required
                        type="text"
                        placeholder="VD: DTC215480..."
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#005A36]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Họ và Tên *</label>
                      <input
                        required
                        type="text"
                        placeholder="Nguyễn Văn A"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#005A36]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tuyến xe đăng ký *</label>
                    <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#005A36] bg-white">
                      <option>Tuyến CT-01: KTX ICTU ➔ Bến xe Thái Nguyên</option>
                      <option>Tuyến CT-02: Campus Loop Liên Trường</option>
                      <option>Tất cả các tuyến (Liên tuyến ICTU)</option>
                    </select>
                  </div>

                  <div className="rounded-2xl border-2 border-dashed border-slate-200 p-4 text-center cursor-pointer hover:border-[#005A36] transition-colors">
                    <Upload size={22} className="mx-auto text-slate-400 mb-1" />
                    <span className="block text-xs font-bold text-slate-700">Tải ảnh Thẻ Sinh Viên / Giấy báo nhập học</span>
                    <span className="block text-[11px] text-slate-400">Hỗ trợ JPG, PNG dưới 5MB</span>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-[#005A36] py-3 text-xs font-bold text-white shadow-md hover:bg-emerald-800 transition-colors"
                  >
                    Gửi Hồ Sơ Xét Duyệt Vé Tháng
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Modal 4: Lookup Modal */}
          {activeModal === 'lookup' && (
            <div className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!lookupCode.trim()) return
                  setLookupResult({
                    code: lookupCode.toUpperCase(),
                    passenger: 'Nguyễn Văn A',
                    seat: '05B',
                    trip: 'Tuyến CT-01 (07:45)',
                    status: 'Hợp lệ - Đã thanh toán VNPAY',
                  })
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value)}
                  placeholder="Nhập mã vé (VD: ICTU-2026-X89) hoặc SĐT..."
                  className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-[#005A36]"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-[#005A36] px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-800"
                >
                  Tra cứu
                </button>
              </form>

              {lookupResult ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-[#005A36]">{lookupResult.code}</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-[#005A36]">
                      {lookupResult.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                    <div>
                      <span className="text-slate-500">Hành khách:</span>
                      <strong className="block text-slate-800">{lookupResult.passenger}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Số ghế:</span>
                      <strong className="block text-slate-800">{lookupResult.seat} (Tầng 1)</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">Chuyến xe:</span>
                      <strong className="block text-slate-800">{lookupResult.trip}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <QrCode size={36} className="mx-auto text-slate-300 mb-2" />
                  Nhập mã vé được gửi qua tin nhắn SMS hoặc email để kiểm tra thời gian xe đón và mã QR lên xe.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
