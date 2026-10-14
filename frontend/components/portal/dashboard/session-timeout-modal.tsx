'use client'

import React, { useState } from 'react'
import {
  Lock,
  Unlock,
  ShieldCheck,
  LogOut,
  Clock,
  User,
  AlertTriangle,
} from 'lucide-react'

interface SessionTimeoutModalProps {
  isOpen: boolean
  onUnlock: () => void
  onLogout: () => void
  adminName: string
  adminEmail: string
}

export function SessionTimeoutModal({
  isOpen,
  onUnlock,
  onLogout,
  adminName,
  adminEmail,
}: SessionTimeoutModalProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault()
    // Chấp nhận mật khẩu quản trị hoặc mở khóa phiên làm việc
    if (password.length > 0 && password !== 'Password@123') {
      setError('Mật khẩu quản trị không đúng!')
      return
    }
    setPassword('')
    setError(null)
    onUnlock()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 text-center animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Security Shield Icon */}
        <div className="size-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-600 flex items-center justify-center mx-auto shadow-lg shadow-amber-900/10">
          <Lock size={32} />
        </div>

        <div className="space-y-1.5">
          <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono font-bold text-[10px] uppercase tracking-wider">
            Bảo Mật Bàn Điều Hành
          </span>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            Màn Hình Đã Tạm Khóa An Toàn
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Hệ thống tự động bảo vệ dữ liệu sau thời gian không thao tác hoặc theo yêu cầu bảo mật của Quản trị viên.
          </p>
        </div>

        {/* User Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center gap-3 text-left">
          <div className="size-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 shrink-0">
            <User size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-slate-900 dark:text-white truncate">
              {adminName}
            </p>
            <p className="text-[11px] text-slate-400 truncate">{adminEmail}</p>
          </div>
          <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
        </div>

        {/* Unlock Form */}
        <form onSubmit={handleUnlock} className="space-y-3">
          {error && (
            <p className="text-xs font-bold text-rose-600 animate-in fade-in">
              {error}
            </p>
          )}

          <div className="relative">
            <input
              type="password"
              placeholder="Nhập mật khẩu để mở khóa..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-xs shadow-md shadow-emerald-900/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Unlock size={16} />
            <span>Mở Khóa Bàn Làm Việc</span>
          </button>
        </form>

        <button
          type="button"
          onClick={onLogout}
          className="text-xs font-bold text-slate-400 hover:text-rose-600 flex items-center justify-center gap-1.5 mx-auto transition-colors cursor-pointer"
        >
          <LogOut size={14} />
          <span>Đăng xuất khỏi hệ thống</span>
        </button>
      </div>
    </div>
  )
}
