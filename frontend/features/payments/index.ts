/**
 * Feature: Payments & Gateway Integrations
 * Quản lý giao dịch thanh toán trực tuyến (VNPay Sandbox, IPN, hoàn tiền)
 * Ánh xạ Backend Module: backend/src/modules/payment
 */
export { AdminPayments } from '@/components/portal/modules/admin-payments';
export { AutoRefundAlertModal } from '@/components/portal/auto-refund-alert-modal';
export { RefundDetailModal } from '@/components/portal/refund-detail-modal';
export { paymentService } from '@/lib/services/payment.service';
export type {
  PaymentGateway,
  PaymentStatus,
  PaymentLogItem,
  PaymentReconciliationData,
  CreatePaymentUrlPayload,
} from '@/lib/types/payment';
