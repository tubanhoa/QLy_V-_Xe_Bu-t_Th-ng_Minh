import type { Metadata } from 'next'
import { MyTicketsPage } from '@/components/portal/my-tickets-page'

export const metadata: Metadata = {
  title: 'Vé của tôi | ICTU Smart Transit',
  description:
    'Xem lịch sử vé xe buýt đã mua, tra cứu mã QR và quản lý vé điện tử của bạn trên hệ thống Smart Bus Ticketing ICTU.',
}

export default function MyTicketsRoute() {
  return <MyTicketsPage />
}
