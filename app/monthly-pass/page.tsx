import type { Metadata } from 'next'
import { MonthlyPassPage } from '@/components/portal/monthly-pass-page'

export const metadata: Metadata = {
  title: 'Đăng Ký Vé Tháng HSSV Giảm 50% | ICTU Smart Transit',
  description: 'Đăng ký vé tháng xe buýt thông minh trợ giá 50% dành cho sinh viên ICTU, người cao tuổi và công nhân.',
}

export default function MonthlyPassRoute() {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-8 shadow-xl">
      <MonthlyPassPage />
    </div>
  )
}
