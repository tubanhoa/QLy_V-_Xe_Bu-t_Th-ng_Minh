'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  MapPin,
  Megaphone,
  QrCode,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Ticket,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { searchService } from '@/lib/services/search.service'
import { BusRoute } from '@/lib/types/sprint1'

interface QuickAccessModalsProps {
  activeModal: 'routes' | 'news' | 'student-pass' | 'lookup' | null
  onClose: () => void
  onBookSeat?: (route?: BusRoute) => void
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

  // State cho danh sách tuyến buýt lấy từ Backend thật
  const [routes, setRoutes] = useState<BusRoute[]>([])
  const [routesLoading, setRoutesLoading] = useState(false)
  const [routesError, setRoutesError] = useState<string | null>(null)
  const [routeSearchKeyword, setRouteSearchKeyword] = useState('')
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null)

  useEffect(() => {
    if (activeModal === 'routes') {
      loadRoutes()
    }
  }, [activeModal])

  const loadRoutes = async (keyword?: string) => {
    setRoutesLoading(true)
    setRoutesError(null)
    try {
      const res = await searchService.getRoutes(keyword ? { keyword } : undefined)
      if (res.success && res.data) {
        setRoutes(res.data)
      } else {
        setRoutesError(res.message || 'Không thể tải danh sách tuyến buýt từ máy chủ')
      }
    } catch (err: any) {
      setRoutesError(err?.message || 'Lỗi kết nối máy chủ')
    } finally {
      setRoutesLoading(false)
    }
  }

  const handleRouteSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadRoutes(routeSearchKeyword)
  }

  const handleClose = () => {
    onClose()
    setLookupCode('')
    setLookupResult(null)
    setStudentFormSubmitted(false)
    setRouteSearchKeyword('')
    setExpandedRouteId(null)
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
          {/* Modal 1: Routes List - Lấy dữ liệu thật từ Backend */}
          {activeModal === 'routes' && (
            <div className="space-y-3.5">
              {/* Thanh tìm kiếm tuyến nhanh */}
              <form onSubmit={handleRouteSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={routeSearchKeyword}
                    onChange={(e) => setRouteSearchKeyword(e.target.value)}
                    placeholder="Tìm theo mã tuyến (CT-01) hoặc tên trạm..."
                    className="w-full rounded-xl border border-slate-200 pl-9 pr-3.5 py-2 text-xs text-slate-800 outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]/20"
                  />
                  {routeSearchKeyword && (
                    <button
                      type="button"
                      onClick={() => {
                        setRouteSearchKeyword('')
                        loadRoutes('')
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={routesLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#005A36] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#004529] active:scale-95 disabled:opacity-70 transition-all"
                >
                  {routesLoading ? <Loader2 size={14} className="animate-spin" /> : <span>Lọc</span>}
                </button>
              </form>

              {/* Trạng thái Loading */}
              {routesLoading && (
                <div className="space-y-3 py-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 animate-pulse">
                    <div className="h-5 w-48 rounded-md bg-slate-200" />
                    <div className="mt-3 h-3 w-full rounded-md bg-slate-200" />
                    <div className="mt-2 h-3 w-3/4 rounded-md bg-slate-200" />
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 animate-pulse">
                    <div className="h-5 w-44 rounded-md bg-slate-200" />
                    <div className="mt-3 h-3 w-full rounded-md bg-slate-200" />
                  </div>
                </div>
              )}

              {/* Trạng thái Lỗi */}
              {!routesLoading && routesError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                    <span>Không thể tải dữ liệu tuyến xe</span>
                  </div>
                  <p className="text-[11px] text-rose-600 pl-6">{routesError}</p>
                  <div className="pl-6 pt-1">
                    <button
                      type="button"
                      onClick={() => loadRoutes(routeSearchKeyword)}
                      className="inline-flex items-center gap-1.5 font-bold text-rose-800 underline hover:text-rose-950"
                    >
                      <RefreshCw size={12} />
                      <span>Thử lại</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Trạng thái Không có kết quả */}
              {!routesLoading && !routesError && routes.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs space-y-2">
                  <Route size={36} className="mx-auto text-slate-300" />
                  <p className="font-semibold text-slate-600">Không tìm thấy tuyến xe nào phù hợp</p>
                  <p className="text-[11px]">Hãy thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.</p>
                </div>
              )}

              {/* Danh sách Tuyến xe thật từ Backend */}
              {!routesLoading && !routesError && routes.map((route) => {
                const isExpanded = expandedRouteId === route.id
                const stations = route.routeStations || []
                const basePriceNum = Number(route.basePrice || 10000)
                const studentPriceNum = Number(route.studentPrice || 5000)
                const startHour = route.operatingStart?.substring(0, 5) || '05:30'
                const endHour = route.operatingEnd?.substring(0, 5) || '21:00'

                return (
                  <div
                    key={route.id}
                    className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 transition-all hover:border-[#005A36] hover:bg-emerald-50/70"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="rounded-lg bg-[#005A36] px-2.5 py-1 text-xs font-black text-white shadow-xs">
                          {route.routeCode}
                        </span>
                        <div>
                          <h4 className="font-bold text-slate-900 leading-snug">{route.name}</h4>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {route.distanceKm ? `${route.distanceKm} km · ` : ''}
                            Tần suất: {route.frequencyMinutes || 15} phút/chuyến
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="block text-xs font-extrabold text-[#005A36]">
                          {basePriceNum.toLocaleString('vi-VN')}đ
                        </span>
                        <span className="inline-block rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          HSSV: {studentPriceNum.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    </div>

                    {/* Lộ trình tóm tắt */}
                    <div className="mt-2.5 text-xs text-slate-600 bg-white/70 rounded-xl p-2.5 border border-emerald-100">
                      <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
                        <Clock size={12} className="text-[#005A36]" />
                        <span>Giờ hoạt động: <strong>{startHour} - {endHour}</strong></span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-700">
                        <strong>Xuất phát:</strong> {route.origin} ➔ <strong>Đích:</strong> {route.destination}
                      </p>
                    </div>

                    {/* Chi tiết các trạm dừng (Collapsible) */}
                    {stations.length > 0 && (
                      <div className="mt-2.5">
                        <button
                          type="button"
                          onClick={() => setExpandedRouteId(isExpanded ? null : route.id)}
                          className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-[#005A36]"
                        >
                          <span>{isExpanded ? 'Ẩn lộ trình chi tiết' : `Xem toàn bộ ${stations.length} trạm dừng`}</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2.5 space-y-2 border-l-2 border-emerald-400 pl-3 ml-1.5 py-1 text-xs">
                            {stations
                              .sort((a, b) => a.stopOrder - b.stopOrder)
                              .map((rs, idx) => (
                                <div key={rs.id || idx} className="relative flex items-start gap-2">
                                  <span className="size-2 rounded-full bg-[#005A36] ring-4 ring-emerald-100 mt-1 shrink-0 -ml-[17px]" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-900">{rs.station?.name}</span>
                                      {rs.station?.isHub && (
                                        <span className="rounded bg-teal-100 px-1.5 py-0.2 text-[9px] font-bold text-teal-800">
                                          Trạm trung chuyển
                                        </span>
                                      )}
                                    </div>
                                    {rs.station?.address && (
                                      <p className="text-[10px] text-slate-500">{rs.station.address}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer card */}
                    <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-500 border-t border-emerald-100/80 pt-2.5">
                      <span className="text-[11px] text-slate-500">100% Xe Buýt Điện Xanh</span>
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          onBookSeat?.(route)
                        }}
                        className="inline-flex items-center gap-1 font-bold text-[#005A36] hover:underline hover:text-emerald-800"
                      >
                        <span>Đặt chỗ chuyến này</span>
                        <span>➔</span>
                      </button>
                    </div>
                  </div>
                )
              })}
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
