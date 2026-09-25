import type { Metadata } from 'next'
import { AppShell } from '@/components/portal/app-shell'

export const metadata: Metadata = {
  title: 'Bảng điều hành | ICTU Smart Transit Portal',
}

export default function Page() {
  return <AppShell />
}
