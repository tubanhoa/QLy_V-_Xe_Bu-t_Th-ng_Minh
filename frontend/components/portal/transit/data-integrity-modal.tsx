'use client'

import React from 'react'
import {
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  PowerOff,
  X,
  Info,
} from 'lucide-react'

interface DataIntegrityModalProps {
  isOpen: boolean
  onClose: () => void
  entityType: 'route' | 'station'
  title?: string
  conflictMessage: string
  onDeactivateRoute?: () => void
  isDeactivating?: boolean
}

export function DataIntegrityModal({
  isOpen,
  onClose,
  entityType,
  title,
  conflictMessage,
  onDeactivateRoute,
  isDeactivating = false,
}: DataIntegrityModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Icon & Title */}
        <div className="flex items-start gap-4">
          <div className="size-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-xs">
            <ShieldAlert size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold text-[10px] uppercase tracking-wider">
                {entityType === 'route' ? 'Ràng Buộc Tuyến' : 'Ràng Buộc Trạm'}
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                HTTP 409 Conflict
              </span>
            </div>
            <h3 className="mt-1 text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
              {title || 'Không Thể Xóa Do Ràng Buộc Hệ Thống'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-xl transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Thông báo chi tiết từ Backend */}
        <div className="rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-extrabold text-xs">
            <AlertTriangle size={15} className="shrink-0 text-rose-600" />
            <span>Nguyên nhân từ cơ sở dữ liệu:</span>
          </div>
          <p className="text-xs text-rose-900 dark:text-rose-200 font-medium leading-relaxed">
            {conflictMessage}
          </p>
        </div>

        {/* Giải thích & Hướng dẫn an toàn dữ liệu */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 p-3.5 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
          <div className="font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
            <Info size={14} className="text-emerald-600" />
            <span>Chính sách Toàn vẹn Dữ liệu Vận tải:</span>
          </div>
          <p className="text-[11px] leading-normal text-slate-500 dark:text-slate-400">
            Hệ thống ngăn chặn xóa cứng để bảo vệ lịch sử vé đã bán, hóa đơn điện tử và các chuyến xe đang lăn bánh. Bạn nên chuyển trạng thái sang <strong>Tạm ngưng hoạt động</strong>.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          {entityType === 'route' && onDeactivateRoute && (
            <button
              type="button"
              onClick={onDeactivateRoute}
              disabled={isDeactivating}
              className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-98 text-white font-black text-xs shadow-md shadow-amber-900/10 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            >
              <PowerOff size={16} />
              <span>
                {isDeactivating
                  ? 'Đang chuyển trạng thái...'
                  : 'Chuyển Tuyến Sang Tạm Ngưng (Inactive)'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Đã hiểu, giữ nguyên dữ liệu</span>
          </button>
        </div>
      </div>
    </div>
  )
}
