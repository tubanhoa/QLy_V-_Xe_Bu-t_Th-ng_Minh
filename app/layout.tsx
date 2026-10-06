import { Analytics } from '@vercel/analytics/next'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import type { Metadata, Viewport } from 'next'
import { Be_Vietnam_Pro } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { ThemedConfigProvider } from '@/components/providers/themed-config-provider'
import './globals.css'

const beVietnamPro = Be_Vietnam_Pro({
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  subsets: ['latin', 'vietnamese'],
  variable: '--font-be-vietnam-pro',
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
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SmartBus ICTU',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#005A36' },
    { media: '(prefers-color-scheme: dark)', color: '#0A131C' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} font-sans`} suppressHydrationWarning>
      <body className="font-sans antialiased selection:bg-emerald-500/20 selection:text-emerald-900 dark:selection:bg-emerald-500/30 dark:selection:text-emerald-200" suppressHydrationWarning>
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
