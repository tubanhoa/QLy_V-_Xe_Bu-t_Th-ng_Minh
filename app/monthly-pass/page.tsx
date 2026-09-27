import type { Metadata } from 'next'
import { MonthlyPassPage } from '@/components/portal/monthly-pass-page'

export const metadata: Metadata = {
  title: 'Vé tháng | ICTU Smart Transit',
  description:
    'Đăng ký vé tháng xe buýt ICTU với ưu đãi dành riêng cho sinh viên (-50%), người cao tuổi (-60%) và công nhân. Quản lý vé tháng điện tử của bạn.',
}

export default function MonthlyPassRoute() {
  return <MonthlyPassPage />
}
