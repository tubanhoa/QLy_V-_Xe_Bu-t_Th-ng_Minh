'use client'

/**
 * Component hiển thị danh sách vé của hành khách kèm cảnh báo sự cố
 * Alias cho MyTicketsPage phục vụ module tickets
 */

import { MyTicketsPage } from '@/components/portal/my-tickets-page'

export function MyTicketsView() {
  return <MyTicketsPage />
}

export default MyTicketsView
export { MyTicketsPage }
