import type { Metadata } from 'next'
import { LoginPage } from '@/components/login/login-page'

export const metadata: Metadata = {
  title: 'Đăng nhập tài khoản HSSV | ICTU Transit',
  description: 'Cổng đăng nhập và quản lý vé xe buýt dành cho Học sinh, Sinh viên và Cán bộ trường ĐH CNTT & Truyền Thông',
}

export default function DangNhapPage() {
  return <LoginPage />
}
