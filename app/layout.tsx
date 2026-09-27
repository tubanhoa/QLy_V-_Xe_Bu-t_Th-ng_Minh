import { Analytics } from '@vercel/analytics/next'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { ThemedConfigProvider } from '@/components/providers/themed-config-provider'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ICTU Smart Transit Portal | Hệ thống điều hành xe buýt thông minh',
  description:
    'Cổng quản trị Hệ thống Vé Xe Buýt Thông Minh ICTU: điều hành đội xe, giám sát GPS thời gian thực, quản lý vé và soát vé QR.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F7F6' },
    { media: '(prefers-color-scheme: dark)', color: '#0A131C' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" className={jakarta.variable} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <AntdRegistry>
          <AuthProvider>
            <ThemedConfigProvider>{children}</ThemedConfigProvider>
          </AuthProvider>
        </AntdRegistry>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
