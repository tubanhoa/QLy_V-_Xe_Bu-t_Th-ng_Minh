import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * Layout đơn giản cho trang /my-tickets
 * Có header với back button để quay lại trang chủ
 * Sử dụng dark background phù hợp với thiết kế hệ thống
 */
export default function MyTicketsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060a0f]">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-40 border-b border-white/6 bg-[#060a0f]/90 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors group"
            id="back-to-home-link"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Trang chủ</span>
          </Link>
          <div className="w-px h-4 bg-white/15" />
          <span className="text-sm font-medium text-white/70">Vé của tôi</span>
        </div>
      </div>

      {children}
    </div>
  )
}
