import type { Metadata } from 'next'
import { LoginPage } from '@/components/login/login-page'

export const metadata: Metadata = {
  title: 'Đăng nhập | ICTU Smart Transit Portal',
}

export default function Page() {
  return <LoginPage />
}
