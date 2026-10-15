/**
 * Feature: Electronic Invoices (E-Invoice)
 * Quản lý hóa đơn điện tử, xuất hóa đơn VAT và tra cứu mã hóa đơn
 * Ánh xạ Backend Module: backend/src/modules/invoice
 */
export { AdminInvoices } from '@/components/portal/modules/admin-invoices';
export { InvoicePreviewModal } from '@/components/invoice/invoice-preview-modal';
export { invoiceService } from '@/lib/services/invoice.service';
export type { InvoiceData, InvoiceItem, InvoiceBuyer, InvoiceSeller } from '@/lib/types/invoice';
