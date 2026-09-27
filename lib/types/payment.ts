export type PaymentGateway =
  | 'vnpay'
  | 'momo'
  | 'zalopay'
  | 'bank_card'
  | 'vietqr'
  | 'cash'

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUNDED'

export interface CreatePaymentUrlPayload {
  bookingId: string
  paymentMethod: PaymentGateway
  orderInfo?: string
  bankCode?: string
  ipAddress?: string
}

export interface PaymentUrlResponseData {
  bookingId: string
  orderId?: string
  paymentUrl: string
  qrCode?: string
  qrDataUrl?: string // Base64 data:image/png;base64,... từ Backend
  deeplink?: string
  expiresAt: string | number
  amount: number
  paymentMethod: PaymentGateway
}

export interface PaymentLogItem {
  id: string
  paymentId: string
  bookingCode?: string
  action: 'create_url' | 'payment_success' | 'payment_failed' | 'cancel_payment' | 'refund' | 'ipn_received'
  gateway: string
  amount: number
  message: string
  rawPayload?: Record<string, any>
  createdAt: string
}

export interface GatewayReconciliationItem {
  gateway: string
  gatewayName: string
  totalRevenue: number
  transactionCount: number
  successCount: number
  failedCount: number
  refundCount: number
}

export interface PaymentReconciliationData {
  period: string
  totalRevenue: number
  totalTransactions: number
  totalRefunds: number
  gateways: GatewayReconciliationItem[]
  recentLogs: PaymentLogItem[]
}
