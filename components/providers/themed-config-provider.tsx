'use client'

import '@ant-design/v5-patch-for-react-19'
import { App, ConfigProvider, theme } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { useAuth } from '@/lib/auth-context'

export function ThemedConfigProvider({ children }: { children: React.ReactNode }) {
  const { themeMode } = useAuth()
  const isDark = themeMode === 'dark'

  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#005A36',
          colorLink: 'inherit',
          colorLinkHover: '#005A36',
          colorInfo: '#005A36',
          colorSuccess: '#10B981',
          colorWarning: '#F59E0B',
          colorError: '#EF4444',
          borderRadius: 10,
          fontFamily: "var(--font-jakarta), -apple-system, BlinkMacSystemFont, sans-serif",
          colorBgLayout: isDark ? '#0A131C' : '#F4F7F6',
          colorBgContainer: isDark ? '#0F1C27' : '#FFFFFF',
          colorBgElevated: isDark ? '#132330' : '#FFFFFF',
          colorBorderSecondary: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8E6',
        },
        components: {
          Input: { controlHeightLG: 48, paddingInlineLG: 14 },
          Button: {
            controlHeightLG: 48,
            fontWeight: 600,
            primaryShadow: '0 8px 20px -8px rgba(0,168,107,0.55)',
          },
          Layout: {
            siderBg: isDark ? '#07101A' : '#0A131C',
            bodyBg: isDark ? '#0A131C' : '#F4F7F6',
            headerBg: 'transparent',
          },
          Menu: {
            itemBg: 'transparent',
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemColor: 'rgba(203,213,209,0.78)',
            darkItemHoverBg: 'rgba(255,255,255,0.05)',
            darkItemHoverColor: '#FFFFFF',
            darkItemSelectedBg: 'rgba(0,168,107,0.16)',
            darkItemSelectedColor: '#34D399',
            itemSelectedBg: 'rgba(0,168,107,0.10)',
            itemSelectedColor: '#008F5A',
            itemBorderRadius: 10,
            itemHeight: 44,
            itemMarginInline: 10,
            iconSize: 18,
            collapsedIconSize: 18,
          },
          Table: {
            headerBg: isDark ? '#132330' : '#F7FAF9',
            rowHoverBg: isDark ? 'rgba(0,168,107,0.06)' : 'rgba(0,168,107,0.04)',
          },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  )
}
