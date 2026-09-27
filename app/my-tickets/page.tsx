import type { Metadata } from 'next'
import { MyTicketsPage } from '@/components/portal/my-tickets-page'

export const metadata: Metadata = {
  title: 'Vé Của Tôi & Lịch Sử Vé Điện Tử | ICTU Smart Transit',
  description: 'Quản lý vé xe buýt thông minh, xuất mã QR quét cổng tự động, đổi vé và theo dõi lộ trình thời gian thực.',
}

export default function MyTicketsRoute() {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-8 shadow-xl">
      <MyTicketsPage />
    </div>
  )
}
