/**
 * Feature: Tickets, QR Pass & Exchange/Cancellation
 * Quản lý vé của tôi, QR Code soát vé thời gian thực, đổi chuyến và hủy vé tự động
 * Ánh xạ Backend Module: backend/src/modules/booking
 */
export { MyTicketsPage } from '@/components/portal/my-tickets-page';
export { TicketDetailModal } from '@/components/portal/ticket-detail-modal';
export { ExchangeTicketModal } from '@/components/portal/exchange-ticket-modal';
export { CancellationPolicyModal } from '@/components/portal/cancellation-policy-modal';
export { ticketService } from '@/lib/services/ticket.service';
export { exchangeService } from '@/lib/services/exchange.service';
