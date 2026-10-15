import Link from 'next/link'
import { ArrowLeft, Home, LayoutDashboard } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 text-center">
      <div className="size-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mb-4">
        <LayoutDashboard size={32} />
      </div>
      <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">404 - Không tìm thấy trang</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md">
        Đường dẫn bạn truy cập hiện không tồn tại hoặc đã được chuyển hướng sang Bảng Điều Hành Trung Tâm.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <LayoutDashboard size={15} />
          <span>Vào Bảng Điều Hành (Dashboard)</span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
        >
          <Home size={15} />
          <span>Về Trang Chủ</span>
        </Link>
      </div>
    </div>
  )
}
