import type { Metadata } from 'next'
import { LandingPage } from '@/components/landing/landing-page'

export const metadata: Metadata = {
  title: 'ICTU Smart Transit | Hệ Thống Vé Xe Buýt Thông Minh',
  description:
    'Mạng lưới xe buýt điện thông minh phục vụ sinh viên, cán bộ giảng viên và nhân dân Thái Nguyên: đặt vé QR một chạm, vé tháng HSSV trợ giá 50%, theo dõi xe qua GPS thời gian thực.',
}

export default function HomePage() {
  return <LandingPage />
}
