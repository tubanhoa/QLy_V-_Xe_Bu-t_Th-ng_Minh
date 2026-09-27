'use client'

import Link from 'next/link'
import { Bus, Clock, Lock, LogIn, ShieldAlert, Sparkles, UserPlus, X } from 'lucide-react'
import { TripSearchResult } from '@/lib/types/sprint1'

interface AuthPromptModalProps {
  open: boolean
  onClose: () => void
  trip?: TripSearchResult | null
  message?: string
}

export function AuthPromptModal({
  open,
  onClose,
  trip,
  message = 'Để chọn chỗ ngồi, giữ chỗ và áp dụng chính sách trợ giá sinh viên (-50%), quý khách vui lòng đăng nhập tài khoản trước khi thực hiện đặt vé.',
}: AuthPromptModalProps) {
  if (!open) return null

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--'
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
    } catch {
      return isoString.substring(11, 16)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
        {/* Top Header with Forest Green gradient */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#005A36] to-[#004529] p-6 text-white text-center">
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>

          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 shadow-inner mb-3">
            <Lock size={28} className="text-white" />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold tracking-wide uppercase text-emerald-200 mb-1">
            <ShieldAlert size={13} />
            Yêu cầu xác thực tài khoản
          </span>
          <h3 className="text-xl font-black tracking-tight text-white">
            Vui Lòng Đăng Nhập
          </h3>
          <p className="text-xs text-white/80 mt-1 max-w-xs mx-auto">
            Hệ thống đặt vé và giữ chỗ trực tuyến dành riêng cho thành viên & sinh viên
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Trip Summary Card if a trip was selected */}
          {trip && (
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-[#005A36] px-2 py-0.5 text-[11px] font-black text-white">
                  {trip.routeCode}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-[#005A36]">
                  <Clock size={13} />
                  Xuất bến: {formatTime(trip.departureTime)}
                </span>
              </div>
              <p className="font-extrabold text-sm text-slate-900 leading-snug">
                {trip.routeName}
              </p>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-200/60 text-slate-600">
                <span>Giá vé tiêu chuẩn:</span>
                <span className="font-mono font-bold text-slate-900">
                  {Number(trip.basePrice).toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-emerald-800 font-bold">
                <span className="flex items-center gap-1">
                  <Sparkles size={13} className="text-emerald-600" /> Trợ giá Sinh viên:
                </span>
                <span className="font-mono font-black text-[#005A36]">
                  {Number(trip.studentPrice).toLocaleString('vi-VN')}đ (-50%)
                </span>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-600 leading-relaxed text-center">
            {message}
          </p>

          {/* Action CTAs */}
          <div className="space-y-2.5 pt-1">
            <Link
              href="/login?redirect=/"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#005A36] py-3.5 text-sm font-black text-white shadow-md shadow-emerald-950/20 hover:bg-[#004529] active:scale-[0.98] transition-all"
            >
              <LogIn size={18} strokeWidth={2.4} />
              <span>Đăng nhập ngay</span>
            </Link>

            <Link
              href="/register"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#005A36] bg-emerald-50/50 py-3 text-sm font-black text-[#005A36] hover:bg-emerald-100/50 active:scale-[0.98] transition-all"
            >
              <UserPlus size={18} strokeWidth={2.2} />
              <span>Đăng ký tài khoản (Trợ giá HSSV)</span>
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="w-full text-center py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              Để sau, tôi muốn tiếp tục tra cứu
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
