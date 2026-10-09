import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface SendInvoiceEmailParams {
  recipientEmail: string;
  passengerName: string;
  invoiceNumber: string;
  bookingCode: string;
  routeName: string;
  totalAmount: number;
  pdfBuffer: Buffer;
  htmlContent?: string;
  lookupCode?: string;
  issuedAt?: string | Date;
  subtotalAmount?: number;
  vatAmount?: number;
  vatRate?: number;
  items?: Array<{
    itemNumber: number;
    description: string;
    ticketCode?: string;
    seatNumber?: string;
    unitPrice: number;
    quantity: number;
    totalAmount: number;
  }>;
  sellerName?: string;
  sellerTaxCode?: string;
  buyerName?: string;
  buyerPhone?: string;
  studentId?: string;
  faculty?: string;
  ticketCode?: string;
  qrDataUrl?: string;
  origin?: string;
  destination?: string;
  departureTime?: Date | string;
  seatNumber?: string;
  vehiclePlate?: string;
  paymentMethod?: string;
}

export interface SendTicketEmailParams {
  recipientEmail: string;
  passengerName: string;
  bookingCode: string;
  ticketCode: string;
  routeName: string;
  origin?: string;
  destination?: string;
  departureTime: Date | string;
  seatNumber: string;
  vehiclePlate?: string;
  price: number;
  qrDataUrl: string;
}

export interface SendTicketCancellationEmailParams {
  recipientEmail: string;
  passengerName: string;
  bookingCode: string;
  ticketCode: string;
  routeName: string;
  originalPrice: number;
  cancellationFee: number;
  refundAmount: number;
  cancelledAt?: Date | string;
}

export interface RefundEmailDto {
  recipientEmail: string;
  passengerName?: string;
  ticketCode: string;
  bookingCode: string;
  routeName: string;
  seatNumber?: string;
  departureTime?: Date | string;
  originalPrice: number;
  cancellationFeePercent: number;
  feeAmount: number;
  refundAmount: number;
  gateway?: string;
  refundTransactionId?: string;
  estimatedArrivalTime?: string;
  reason?: string;
}

export interface SendTicketExchangeEmailParams {
  recipientEmail: string;
  passengerName: string;
  ticketCode: string;
  bookingCode: string;
  oldRouteName?: string;
  newRouteName: string;
  newOrigin?: string;
  newDestination?: string;
  newDepartureTime: Date | string;
  newSeatNumber: string;
  newVehiclePlate?: string;
  exchangeFee: number;
  priceDifference: number;
  qrDataUrl: string;
}

export interface SentNotificationRecord {
  id: string;
  recipientEmail: string;
  subject: string;
  ticketCode: string;
  bookingCode: string;
  sentAt: Date;
  status: 'sent' | 'failed' | 'logged';
  htmlPreview: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly sentNotifications: SentNotificationRecord[] = [];
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.replace(/\s+/g, '');
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
          tls: {
            rejectUnauthorized: false,
          },
        });
        this.logger.log(`[NotificationService] Transporter SMTP đã sẵn sàng kết nối: ${host}:${port} (${user})`);
      } catch (err: any) {
        this.logger.warn(`[NotificationService] Không thể khởi tạo SMTP transporter: ${err?.message}`);
        this.transporter = null;
      }
    } else {
      this.logger.log(`[NotificationService] Chưa cấu hình SMTP_USER / SMTP_PASS trong .env -> Chạy chế độ fallback (Mock/Log mode)`);
    }
  }

  /**
   * Chuẩn hóa và bảo vệ địa chỉ email người nhận:
   * Chuyển hướng các địa chỉ mock/test không có hòm thư thực tế ngoài đời (@ictu.edu.vn demo, @example.com...)
   * về email của quản trị viên/tester (process.env.SMTP_USER) để:
   * 1. Ngăn chặn 100% lỗi Google Mail "Address not found" (550 Mail Delivery Subsystem Bounce).
   * 2. Đảm bảo tester nhận được email thực tế ngay trên điện thoại để kiểm thử giao diện.
   */
  resolveTargetEmail(recipientEmail: string): { actualTo: string; isRedirected: boolean; originalEmail: string } {
    const trimmed = (recipientEmail || '').trim();
    const adminTestEmail = (process.env.SMTP_USER || '').trim() || 'ductrandanh06@gmail.com';

    // Nhận diện các domain và địa chỉ hạt giống (seed/mock) không có tài khoản Google Workspace thật
    const isMockOrTestEmail =
      trimmed.endsWith('@ictu.edu.vn') ||
      trimmed.endsWith('@smartbus.ictu.vn') ||
      trimmed.endsWith('@example.com') ||
      trimmed.endsWith('@test.com') ||
      trimmed.toLowerCase().includes('student.an') ||
      trimmed.toLowerCase().includes('driver.hung') ||
      trimmed.toLowerCase().includes('test.');

    if (isMockOrTestEmail && trimmed.toLowerCase() !== adminTestEmail.toLowerCase()) {
      this.logger.log(
        `[NotificationService] Chuyển hướng email từ địa chỉ thử nghiệm ${trimmed} -> Hòm thư quản trị viên thực tế ${adminTestEmail}`,
      );
      return { actualTo: adminTestEmail, isRedirected: true, originalEmail: trimmed };
    }

    return { actualTo: trimmed, isRedirected: false, originalEmail: trimmed };
  }

  /**
   * Tự động gửi Email vé điện tử kèm mã QR sau khi thanh toán thành công
   */
  async sendTicketConfirmationEmail(params: SendTicketEmailParams): Promise<boolean> {
    const redirectInfo = this.resolveTargetEmail(params.recipientEmail);
    const subjectPrefix = redirectInfo.isRedirected ? `[Demo: ${params.recipientEmail}] ` : '';
    const subject = `${subjectPrefix}[SmartBus ICTU] Xác nhận vé điện tử thành công - Mã vé: ${params.ticketCode}`;
    const formattedPrice = Number(params.price).toLocaleString('vi-VN');
    const formattedDeparture =
      params.departureTime instanceof Date
        ? params.departureTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        : new Date(params.departureTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    // Chuẩn bị CID Inline Attachment cho các trình đọc email (Gmail, Outlook, Apple Mail...)
    // Vì các dịch vụ như Gmail mặc định sẽ chặn/lọc các thẻ img chứa data:image/png;base64 trực tiếp
    const attachments: EmailAttachment[] = [];
    const qrCid = `ticket-qr-${params.ticketCode.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    let smtpQrSrc = params.qrDataUrl;

    if (params.qrDataUrl && params.qrDataUrl.startsWith('data:image/')) {
      const match = params.qrDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match) {
        const ext = match[1] || 'png';
        const base64Data = match[2];
        attachments.push({
          filename: `ticket-${params.ticketCode}-qr.${ext}`,
          content: Buffer.from(base64Data, 'base64'),
          contentType: `image/${ext}`,
          cid: qrCid,
        } as any);
        smtpQrSrc = `cid:${qrCid}`;
      }
    }

    const renderHtml = (qrImgSrc: string) => `
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml" lang="vi">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Vé Xe Buýt Điện Tử - ${params.ticketCode}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 16px 8px; color: #1e293b; -webkit-text-size-adjust: 100%; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #005A36 0%, #0d9488 100%); color: #ffffff; padding: 28px 20px; text-align: center; }
          .header h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
          .header p { margin: 0; opacity: 0.92; font-size: 14px; font-weight: 500; }
          .content { padding: 24px 20px; }
          .badge-wrapper { text-align: center; margin-bottom: 20px; }
          .success-badge { display: inline-block; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 6px 18px; border-radius: 9999px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
          
          /* Khối hiển thị mã vé xe nổi bật */
          .ticket-code-banner { background: #f0fdf4; border: 2px dashed #059669; border-radius: 12px; padding: 16px 20px; text-align: center; margin-bottom: 24px; }
          .ticket-code-label { font-size: 12px; font-weight: 700; color: #065f46; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px; }
          .ticket-code-val { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 26px; font-weight: 900; color: #005A36; letter-spacing: 2px; margin: 4px 0; word-break: break-all; }
          .ticket-code-sub { font-size: 12.5px; color: #047857; margin-top: 6px; }

          /* Bảng thông tin vé */
          .ticket-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px; }
          .ticket-table { width: 100%; border-collapse: collapse; }
          .ticket-table td { padding: 8px 0; font-size: 14px; vertical-align: top; }
          .ticket-label { color: #64748b; width: 42%; }
          .ticket-value { font-weight: 600; color: #0f172a; text-align: right; width: 58%; }
          .ticket-divider { border-top: 1px dashed #cbd5e1; }

          /* Khu vực QR Pass */
          .qr-section { text-align: center; padding: 24px 16px; background: #ffffff; border-radius: 12px; border: 1.5px solid #10b981; margin-bottom: 24px; box-shadow: 0 2px 10px rgba(0,0,0,0.03); }
          .qr-title { font-size: 13px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
          .qr-img-box { display: inline-block; padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; }
          .qr-image { width: 210px; height: 210px; display: block; margin: 0 auto; }
          .qr-code-display { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 18px; font-weight: 800; color: #005A36; letter-spacing: 1px; margin-top: 12px; }
          .qr-instruction { font-size: 13px; color: #475569; max-width: 90%; margin: 12px auto 0 auto; line-height: 1.5; background: #f8fafc; padding: 10px 14px; border-radius: 8px; border-left: 3px solid #059669; text-align: left; }
          
          .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6; }
        </style>
      </head>
      <body>
        <!-- Preheader Text Ẩn (Chống lỗi dính chữ xem trước trên Gmail Mobile) -->
        <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
          Vé xe buýt điện tử ${params.ticketCode} đã thanh toán thành công. Khởi hành: ${formattedDeparture}. Ghế: ${params.seatNumber}. Giá vé: ${formattedPrice} VND.
          &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy;
        </div>

        <div class="container">
          <div class="header">
            <h1>HỆ THỐNG XE BUÝT THÔNG MINH - SMARTBUS</h1>
            <p>Xác nhận thanh toán và Thẻ lên xe điện tử (E-Ticket Boarding Pass)</p>
          </div>
          <div class="content">
            ${redirectInfo.isRedirected ? `
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 10px 14px; border-radius: 8px; font-size: 12px; margin-bottom: 16px; line-height: 1.5;">
              <strong>MÔI TRƯỜNG THỬ NGHIỆM:</strong> Email này được hệ thống SmartBus ICTU tự động gửi thử nghiệm tới hòm thư của bạn <strong>${redirectInfo.actualTo}</strong> (Địa chỉ gốc của đơn vé: <code>${redirectInfo.originalEmail}</code>).
            </div>` : ''}

            <div class="badge-wrapper">
              <span class="success-badge">✓ ĐÃ THANH TOÁN THÀNH CÔNG (PAID)</span>
            </div>
            
            <p style="margin: 0 0 16px 0; font-size: 15px;">Kính chào quý khách <strong>${params.passengerName}</strong>,</p>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">Giao dịch thanh toán vé xe của quý khách đã hoàn tất. Quý khách vui lòng lưu lại thẻ vé điện tử dưới đây:</p>

            <!-- Khối Mã Vé Nổi Bật Dành Cho Hành Khách -->
            <div class="ticket-code-banner">
              <div class="ticket-code-label">MÃ VÉ XE ĐIỆN TỬ (TICKET CODE)</div>
              <div class="ticket-code-val">${params.ticketCode}</div>
              <div class="ticket-code-sub">Mã đơn đặt: <strong>${params.bookingCode}</strong></div>
            </div>

            <!-- Bảng Chi Tiết Thông Tin Chuyến Xe -->
            <div class="ticket-card">
              <table class="ticket-table">
                <tr>
                  <td class="ticket-label">Mã vé điện tử:</td>
                  <td class="ticket-value" style="color: #005A36; font-family: monospace; font-size: 15px; font-weight: 700;">${params.ticketCode}</td>
                </tr>
                <tr>
                  <td class="ticket-label">Mã đơn đặt vé:</td>
                  <td class="ticket-value" style="font-family: monospace;">${params.bookingCode}</td>
                </tr>
                <tr>
                  <td class="ticket-label">Tuyến xe:</td>
                  <td class="ticket-value">${params.routeName}</td>
                </tr>
                ${params.origin && params.destination ? `
                <tr>
                  <td class="ticket-label">Lộ trình:</td>
                  <td class="ticket-value">${params.origin} ➔ ${params.destination}</td>
                </tr>` : ''}
                <tr>
                  <td class="ticket-label">Thời gian xuất bến:</td>
                  <td class="ticket-value" style="color: #0f172a; font-weight: 700;">${formattedDeparture}</td>
                </tr>
                <tr>
                  <td class="ticket-label">Số ghế:</td>
                  <td class="ticket-value" style="font-size: 16px; color: #0284c7; font-weight: 700;">${params.seatNumber}</td>
                </tr>
                ${params.vehiclePlate ? `
                <tr>
                  <td class="ticket-label">Biển số xe:</td>
                  <td class="ticket-value">${params.vehiclePlate}</td>
                </tr>` : ''}
                <tr class="ticket-divider">
                  <td class="ticket-label" style="padding-top: 12px; font-weight: 700; color: #0f172a;">Giá vé đã thanh toán:</td>
                  <td class="ticket-value" style="padding-top: 12px; color: #16a34a; font-size: 17px; font-weight: 800;">${formattedPrice} VND</td>
                </tr>
              </table>
            </div>

            <!-- Khối Mã QR Soát Vé Khi Lên Xe -->
            <div class="qr-section">
              <div class="qr-title">MÃ QR SOÁT VÉ TỰ ĐỘNG</div>
              <div class="qr-img-box">
                <img class="qr-image" src="${qrImgSrc}" alt="Mã QR Vé Xe ${params.ticketCode}" width="210" height="210" />
              </div>
              <div class="qr-code-display">
                MÃ VÉ: <span>${params.ticketCode}</span>
              </div>
              <div class="qr-instruction">
                <strong>HƯỚNG DẪN LÊN XE:</strong><br/>
                1. Xuất trình mã QR này trên điện thoại cho tài xế hoặc phụ xe khi bước lên xe để thực hiện quét mã tự động.<br/>
                2. Nếu thiết bị không quét được mã QR, quý khách vui lòng đọc <strong>Mã vé: ${params.ticketCode}</strong> để nhân viên đối soát thủ công trên hệ thống.
              </div>
            </div>
          </div>
          <div class="footer">
            <strong>Trường Đại học Công nghệ Thông tin & Truyền thông Thái Nguyên (ICTU)</strong><br/>
            Hệ Thống Quản Lý Vé Xe Buýt Thông Minh - SmartBus ICTU<br/>
            Hotline hỗ trợ hành khách: 1900 1234 | Website: smartbus.ictu.edu.vn
          </div>
        </div>
      </body>
      </html>
    `;

    const htmlContent = renderHtml(params.qrDataUrl); // Giữ base64 cho preview nội bộ / test
    const emailHtml = renderHtml(smtpQrSrc); // Dùng CID inline attachment cho SMTP thực tế

    // Lưu vào hàng đợi thông báo đã gửi
    const record: SentNotificationRecord = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipientEmail: params.recipientEmail,
      subject,
      ticketCode: params.ticketCode,
      bookingCode: params.bookingCode,
      sentAt: new Date(),
      status: 'sent',
      htmlPreview: htmlContent,
    };

    this.sentNotifications.push(record);
    this.logger.log(`[NotificationService] Đã ghi nhận gửi email vé điện tử tới ${params.recipientEmail} (Mã vé: ${params.ticketCode})`);

    if (this.transporter) {
      try {
        const fromAddress =
          process.env.SMTP_FROM ||
          `"Hệ Thống Xe Buýt Thông Minh ICTU" <${process.env.SMTP_USER || 'no-reply@smartbus.ictu.edu.vn'}>`;
        await this.transporter.sendMail({
          from: fromAddress,
          to: redirectInfo.actualTo,
          subject,
          html: emailHtml,
          attachments,
        });
        this.logger.log(`[NotificationService] Đã gửi email vé điện tử thực tế qua SMTP tới: ${redirectInfo.actualTo} (Gốc: ${params.recipientEmail}) kèm inline QR attachment`);
      } catch (err: any) {
        this.logger.error(`[NotificationService] Lỗi gửi email vé qua SMTP tới ${redirectInfo.actualTo}: ${err?.message}`);
        record.status = 'failed';
      }
    }

    return true;
  }

  /**
   * Gửi Email xác nhận hủy vé và thông tin hoàn tiền
   */
  async sendTicketCancellationEmail(params: SendTicketCancellationEmailParams): Promise<boolean> {
    const subject = `[SmartBus ICTU] Xác nhận HỦY VÉ thành công - Mã vé: ${params.ticketCode}`;
    const formattedRefund = Number(params.refundAmount).toLocaleString('vi-VN');
    const formattedFee = Number(params.cancellationFee).toLocaleString('vi-VN');
    const formattedOriginal = Number(params.originalPrice).toLocaleString('vi-VN');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 16px 8px; color: #1e293b; -webkit-text-size-adjust: 100%; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #c0392b 0%, #e74c3c 100%); color: white; padding: 28px 20px; text-align: center; }
          .header h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
          .header p { margin: 0; opacity: 0.92; font-size: 14px; }
          .content { padding: 24px 20px; }
          .badge-wrapper { text-align: center; margin-bottom: 20px; }
          .badge { display: inline-block; background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; padding: 6px 18px; border-radius: 9999px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
          
          /* Khối mã vé đã hủy nổi bật */
          .cancel-banner { background: #fef2f2; border: 2px dashed #dc2626; border-radius: 12px; padding: 16px 20px; text-align: center; margin-bottom: 24px; }
          .cancel-label { font-size: 12px; font-weight: 700; color: #991b1b; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px; }
          .cancel-val { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 26px; font-weight: 900; color: #dc2626; letter-spacing: 2px; margin: 4px 0; word-break: break-all; }
          .cancel-sub { font-size: 12.5px; color: #991b1b; margin-top: 6px; }

          /* Bảng chi tiết */
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px; }
          .table { width: 100%; border-collapse: collapse; }
          .table td { padding: 8px 0; font-size: 14px; vertical-align: top; }
          .label { color: #64748b; width: 45%; }
          .value { font-weight: 600; color: #0f172a; text-align: right; width: 55%; }
          .divider { border-top: 1px dashed #cbd5e1; }

          .note-box { background: #eff6ff; border-left: 3px solid #3b82f6; padding: 12px 14px; border-radius: 6px; font-size: 13px; color: #1e40af; line-height: 1.5; margin-bottom: 20px; }
          .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>HỆ THỐNG XE BUÝT THÔNG MINH - SMARTBUS</h1>
            <p>Xác nhận hủy vé xe buýt điện tử</p>
          </div>
          <div class="content">
            <div class="badge-wrapper">
              <span class="badge">✕ ĐÃ HỦY VÉ THÀNH CÔNG</span>
            </div>
            
            <p style="margin: 0 0 16px 0; font-size: 15px;">Kính chào quý khách <strong>${params.passengerName}</strong>,</p>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">Yêu cầu hủy vé xe buýt của quý khách đã được hệ thống xử lý hoàn tất. Thông tin hủy vé như sau:</p>

            <div class="cancel-banner">
              <div class="cancel-label">MÃ VÉ ĐÃ HỦY (CANCELLED TICKET)</div>
              <div class="cancel-val">${params.ticketCode}</div>
              <div class="cancel-sub">Mã đơn đặt vé: <strong>${params.bookingCode}</strong></div>
            </div>

            <div class="card">
              <table class="table">
                <tr>
                  <td class="label">Mã vé đã hủy:</td>
                  <td class="value" style="color: #dc2626; font-family: monospace; font-size: 15px; font-weight: 700;">${params.ticketCode}</td>
                </tr>
                <tr>
                  <td class="label">Mã đơn đặt:</td>
                  <td class="value" style="font-family: monospace;">${params.bookingCode}</td>
                </tr>
                <tr>
                  <td class="label">Tuyến xe:</td>
                  <td class="value">${params.routeName}</td>
                </tr>
                <tr>
                  <td class="label">Giá vé gốc:</td>
                  <td class="value">${formattedOriginal} VND</td>
                </tr>
                <tr>
                  <td class="label">Phí hủy vé theo quy định:</td>
                  <td class="value" style="color: #b91c1c;">${formattedFee} VND</td>
                </tr>
                <tr class="divider">
                  <td class="label" style="padding-top: 12px; font-weight: 700; color: #0f172a;">Số tiền thực hoàn:</td>
                  <td class="value" style="padding-top: 12px; color: #16a34a; font-size: 17px; font-weight: 800;">${formattedRefund} VND</td>
                </tr>
              </table>
            </div>

            <div class="note-box">
              <strong>Lưu ý:</strong> Số tiền hoàn lại sẽ được tự động hoàn về ví điện tử / tài khoản ngân hàng ban đầu của quý khách theo quy định đối soát. Quý khách vui lòng lưu lại mã vé để liên hệ đối soát khi cần thiết.
            </div>
          </div>
          <div class="footer">
            <strong>Trường Đại học Công nghệ Thông tin & Truyền thông Thái Nguyên (ICTU)</strong><br/>
            Hệ Thống Quản Lý Vé Xe Buýt Thông Minh - SmartBus ICTU<br/>
            Hotline hỗ trợ hành khách: 1900 1234 | Website: smartbus.ictu.edu.vn
          </div>
        </div>
      </body>
      </html>
    `;

    const record: SentNotificationRecord = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipientEmail: params.recipientEmail,
      subject,
      ticketCode: params.ticketCode,
      bookingCode: params.bookingCode,
      sentAt: new Date(),
      status: 'sent',
      htmlPreview: htmlContent,
    };

    this.sentNotifications.push(record);
    this.logger.log(`[NotificationService] Đã gửi email xác nhận hủy vé tới ${params.recipientEmail} (Mã vé: ${params.ticketCode})`);

    if (this.transporter) {
      try {
        const fromAddress =
          process.env.SMTP_FROM ||
          `"Hệ Thống Xe Buýt Thông Minh ICTU" <${process.env.SMTP_USER || 'no-reply@smartbus.ictu.edu.vn'}>`;
        await this.transporter.sendMail({
          from: fromAddress,
          to: params.recipientEmail,
          subject,
          html: htmlContent,
        });
      } catch (err: any) {
        this.logger.error(`[NotificationService] Lỗi gửi email hủy vé qua SMTP: ${err?.message}`);
        record.status = 'failed';
      }
    }

    return true;
  }

  /**
   * HẠNG MỤC 4: Gửi Email xác nhận hoàn tiền vé xe buýt điện tử (Non-blocking Task Queue)
   */
  async sendRefundConfirmationEmail(dto: RefundEmailDto): Promise<boolean> {
    // Đẩy tác vụ gửi email vào hàng đợi ngầm (Task Queue / setImmediate) để không chặn luồng HTTP response
    setImmediate(async () => {
      try {
        await this.executeSendRefundConfirmationEmail(dto);
      } catch (err: any) {
        this.logger.error(`[NotificationService] Lỗi gửi email hoàn tiền trong background task: ${err?.message}`);
      }
    });

    return true;
  }

  private async executeSendRefundConfirmationEmail(dto: RefundEmailDto): Promise<boolean> {
    const subject = `[ICTU Transit] Xác nhận hoàn tiền vé xe buýt điện tử - Mã vé: ${dto.ticketCode}`;
    const formattedOriginal = Number(dto.originalPrice || 0).toLocaleString('vi-VN');
    const formattedFee = Number(dto.feeAmount || 0).toLocaleString('vi-VN');
    const formattedRefund = Number(dto.refundAmount || 0).toLocaleString('vi-VN');

    let gatewayName = 'Tài khoản thanh toán nguồn';
    let timeEstimate = 'Từ 1 - 3 ngày làm việc';
    const gw = (dto.gateway || '').toLowerCase();
    if (gw.includes('momo')) {
      gatewayName = 'Ví điện tử MoMo';
      timeEstimate = 'Ngay lập tức đến 24 giờ';
    } else if (gw.includes('vnpay')) {
      gatewayName = 'Cổng thanh toán VNPay / Thẻ ngân hàng';
      timeEstimate = 'Ví VNPAY: Ngay lập tức đến 24h | Thẻ ATM/Visa: 1 - 3 ngày làm việc';
    } else if (gw.includes('zalo')) {
      gatewayName = 'Ví điện tử ZaloPay';
      timeEstimate = 'Ngay lập tức đến 24 giờ';
    } else if (gw.includes('bank')) {
      gatewayName = 'Chuyển khoản tài khoản ngân hàng nguồn';
      timeEstimate = 'Từ 1 - 3 ngày làm việc (Đối soát ngân hàng)';
    }

    const formattedDeparture = dto.departureTime
      ? (dto.departureTime instanceof Date
          ? dto.departureTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
          : new Date(dto.departureTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }))
      : 'Theo lịch trình chuyến';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #005A36 0%, #0d9488 100%); color: #ffffff; padding: 32px 24px; text-align: center; }
          .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
          .header p { margin: 0; font-size: 14px; opacity: 0.9; }
          .content { padding: 32px 28px; }
          .status-badge { display: inline-block; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 8px 20px; border-radius: 9999px; font-weight: 700; font-size: 14px; margin-bottom: 24px; }
          .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 24px; }
          .row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 14px; }
          .row:last-child { margin-bottom: 0; }
          .label { color: #64748b; font-size: 13.5px; }
          .value { font-weight: 600; color: #0f172a; }
          .highlight-refund { font-size: 20px; font-weight: 800; color: #005A36; }
          .refund-box { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px; }
          .note-box { background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 14px 16px; margin-bottom: 24px; font-size: 13px; color: #1e40af; line-height: 1.5; }
          .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ICTU TRANSIT - SMART BUS</h1>
            <p>Hệ thống Quản lý Vé Xe buýt Thông minh</p>
          </div>
          <div class="content">
            <div style="text-align: center;">
              <span class="status-badge">✓ XÁC NHẬN HOÀN TIỀN VÉ THÀNH CÔNG</span>
            </div>
            <p>Kính chào quý khách <strong>${dto.passengerName || 'Hành khách'}</strong>,</p>
            <p>Yêu cầu hoàn tiền vé xe buýt điện tử của quý khách đã được hệ thống ICTU Transit xử lý thành công. Dưới đây là thông tin biên bản hoàn tiền chi tiết:</p>

            <div class="card">
              <div class="row"><span class="label">Mã vé điện tử:</span><span class="value" style="color: #0284c7; font-family: monospace; font-size: 15px;">${dto.ticketCode}</span></div>
              <div class="row"><span class="label">Mã đơn đặt vé:</span><span class="value" style="font-family: monospace;">${dto.bookingCode}</span></div>
              <div class="row"><span class="label">Tuyến xe:</span><span class="value">${dto.routeName}</span></div>
              <div class="row"><span class="label">Vị trí ghế:</span><span class="value">${dto.seatNumber || 'Ghế tiêu chuẩn'}</span></div>
              <div class="row"><span class="label">Giờ xuất bến dự kiến:</span><span class="value">${formattedDeparture}</span></div>
              ${dto.refundTransactionId ? `<div class="row"><span class="label">Mã giao dịch hoàn (Gateway):</span><span class="value" style="font-family: monospace; font-size: 13px;">${dto.refundTransactionId}</span></div>` : ''}
            </div>

            <div class="refund-box">
              <div class="row"><span class="label">Giá vé gốc:</span><span class="value">${formattedOriginal} VNĐ</span></div>
              <div class="row"><span class="label">Phí hủy vé theo quy định:</span><span class="value" style="color: #b91c1c;">${dto.cancellationFeePercent}% (${formattedFee} VNĐ)</span></div>
              <div class="row" style="border-top: 1.5px dashed #86efac; padding-top: 12px; margin-top: 12px;">
                <span class="label" style="font-weight: 700; color: #166534; font-size: 15px;">Số tiền thực hoàn:</span>
                <span class="highlight-refund"><span style="color:#005A36; font-size:18px; font-weight:bold;">${formattedRefund} VNĐ</span></span>
              </div>
            </div>

            <div class="card">
              <div class="row"><span class="label">Cổng nhận tiền hoàn:</span><span class="value" style="color: #047857;">${gatewayName}</span></div>
              <div class="row"><span class="label">Thời gian tiền về tài khoản:</span><span class="value">${timeEstimate}</span></div>
            </div>

            <div class="note-box">
              <strong>Lưu ý:</strong> Tiền hoàn sẽ được chuyển trực tiếp về ví hoặc tài khoản ngân hàng mà quý khách đã sử dụng để thanh toán trước đó. Nếu sau thời gian trên quý khách chưa nhận được tiền, vui lòng liên hệ tổng đài 1900 1234 kèm mã vé để được hỗ trợ kiểm tra đối soát.
            </div>
          </div>
          <div class="footer">
            <strong>Trường Đại học Công nghệ Thông tin & Truyền thông Thái Nguyên (ICTU)</strong><br/>
            Địa chỉ: Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên, Tỉnh Thái Nguyên<br/>
            Hotline hỗ trợ: 1900 1234 | Email: hotro@smartbus.ictu.edu.vn
          </div>
        </div>
      </body>
      </html>
    `;

    const record: SentNotificationRecord = {
      id: `refund-notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipientEmail: dto.recipientEmail,
      subject,
      ticketCode: dto.ticketCode,
      bookingCode: dto.bookingCode,
      sentAt: new Date(),
      status: 'sent',
      htmlPreview: htmlContent,
    };
    this.sentNotifications.push(record);

    if (this.transporter) {
      try {
        const fromAddress =
          process.env.SMTP_FROM ||
          `"Hệ Thống Xe Buýt Thông Minh ICTU" <${process.env.SMTP_USER || 'no-reply@smartbus.ictu.edu.vn'}>`;
        await this.transporter.sendMail({
          from: fromAddress,
          to: dto.recipientEmail,
          subject,
          html: htmlContent,
        });
        this.logger.log(`[NotificationService] Đã gửi email xác nhận hoàn tiền thành công tới ${dto.recipientEmail}`);
      } catch (err: any) {
        this.logger.error(`[NotificationService] Lỗi gửi email hoàn tiền qua SMTP: ${err?.message}`);
        record.status = 'failed';
      }
    }

    return true;
  }

  /**
   * Gửi Email xác nhận ĐỔI VÉ thành công kèm vé điện tử mới
   */
  async sendTicketExchangeEmail(params: SendTicketExchangeEmailParams): Promise<boolean> {
    const subject = `[SmartBus ICTU] Xác nhận ĐỔI VÉ XE thành công - Mã vé mới: ${params.ticketCode}`;
    const formattedDeparture =
      params.newDepartureTime instanceof Date
        ? params.newDepartureTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        : new Date(params.newDepartureTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const formattedFee = Number(params.exchangeFee).toLocaleString('vi-VN');
    const formattedDiff = Number(params.priceDifference).toLocaleString('vi-VN');

    // Chuẩn bị CID Inline Attachment cho vé mới
    const attachments: EmailAttachment[] = [];
    const qrCid = `ticket-exchange-qr-${params.ticketCode.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    let smtpQrSrc = params.qrDataUrl;

    if (params.qrDataUrl && params.qrDataUrl.startsWith('data:image/')) {
      const match = params.qrDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match) {
        const ext = match[1] || 'png';
        const base64Data = match[2];
        attachments.push({
          filename: `ticket-exchange-${params.ticketCode}-qr.${ext}`,
          content: Buffer.from(base64Data, 'base64'),
          contentType: `image/${ext}`,
          cid: qrCid,
        } as any);
        smtpQrSrc = `cid:${qrCid}`;
      }
    }

    const renderHtml = (qrImgSrc: string) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 16px 8px; color: #1e293b; -webkit-text-size-adjust: 100%; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; padding: 28px 20px; text-align: center; }
          .header h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
          .header p { margin: 0; opacity: 0.92; font-size: 14px; font-weight: 500; }
          .content { padding: 24px 20px; }
          .badge-wrapper { text-align: center; margin-bottom: 20px; }
          .badge { display: inline-block; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 6px 18px; border-radius: 9999px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
          
          /* Khối mã vé mới nổi bật */
          .ticket-code-banner { background: #f0f9ff; border: 2px dashed #0284c7; border-radius: 12px; padding: 16px 20px; text-align: center; margin-bottom: 24px; }
          .ticket-code-label { font-size: 12px; font-weight: 700; color: #0369a1; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px; }
          .ticket-code-val { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 26px; font-weight: 900; color: #0284c7; letter-spacing: 2px; margin: 4px 0; word-break: break-all; }
          .ticket-code-sub { font-size: 12.5px; color: #0369a1; margin-top: 6px; }

          /* Bảng thông tin vé đổi */
          .ticket-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px; }
          .ticket-table { width: 100%; border-collapse: collapse; }
          .ticket-table td { padding: 8px 0; font-size: 14px; vertical-align: top; }
          .ticket-label { color: #64748b; width: 42%; }
          .ticket-value { font-weight: 600; color: #0f172a; text-align: right; width: 58%; }
          .ticket-divider { border-top: 1px dashed #cbd5e1; }

          /* Khu vực QR Pass mới */
          .qr-section { text-align: center; padding: 24px 16px; background: #ffffff; border-radius: 12px; border: 1.5px solid #0284c7; margin-bottom: 24px; box-shadow: 0 2px 10px rgba(0,0,0,0.03); }
          .qr-title { font-size: 13px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
          .qr-img-box { display: inline-block; padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; }
          .qr-image { width: 210px; height: 210px; display: block; margin: 0 auto; }
          .qr-code-display { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 18px; font-weight: 800; color: #0284c7; letter-spacing: 1px; margin-top: 12px; }
          .qr-instruction { font-size: 13px; color: #475569; max-width: 90%; margin: 12px auto 0 auto; line-height: 1.5; background: #f8fafc; padding: 10px 14px; border-radius: 8px; border-left: 3px solid #0284c7; text-align: left; }

          .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>HỆ THỐNG XE BUÝT THÔNG MINH - SMARTBUS</h1>
            <p>Xác nhận Đổi Chuyến và Thẻ lên xe điện tử Mới</p>
          </div>
          <div class="content">
            <div class="badge-wrapper">
              <span class="badge">✓ ĐÃ ĐỔI VÉ THÀNH CÔNG</span>
            </div>
            
            <p style="margin: 0 0 16px 0; font-size: 15px;">Kính chào quý khách <strong>${params.passengerName}</strong>,</p>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">Yêu cầu đổi chuyến của quý khách đã hoàn tất. Thông tin chuyến xe mới và vé xe điện tử mới của quý khách như sau:</p>

            <!-- Khối Mã Vé Mới Nổi Bật -->
            <div class="ticket-code-banner">
              <div class="ticket-code-label">MÃ VÉ MỚI (NEW TICKET CODE)</div>
              <div class="ticket-code-val">${params.ticketCode}</div>
              <div class="ticket-code-sub">Mã đơn đặt: <strong>${params.bookingCode}</strong></div>
            </div>

            <!-- Bảng Chi Tiết Chuyến Xe Mới -->
            <div class="ticket-card">
              <table class="ticket-table">
                <tr>
                  <td class="ticket-label">Mã vé mới:</td>
                  <td class="ticket-value" style="color: #0284c7; font-family: monospace; font-size: 15px; font-weight: 700;">${params.ticketCode}</td>
                </tr>
                <tr>
                  <td class="ticket-label">Mã đơn đặt vé:</td>
                  <td class="ticket-value" style="font-family: monospace;">${params.bookingCode}</td>
                </tr>
                <tr>
                  <td class="ticket-label">Tuyến xe mới:</td>
                  <td class="ticket-value">${params.newRouteName}</td>
                </tr>
                ${params.newOrigin && params.newDestination ? `
                <tr>
                  <td class="ticket-label">Lộ trình mới:</td>
                  <td class="ticket-value">${params.newOrigin} ➔ ${params.newDestination}</td>
                </tr>` : ''}
                <tr>
                  <td class="ticket-label">Thời gian xuất bến mới:</td>
                  <td class="ticket-value" style="color: #0f172a; font-weight: 700;">${formattedDeparture}</td>
                </tr>
                <tr>
                  <td class="ticket-label">Số ghế mới:</td>
                  <td class="ticket-value" style="font-size: 16px; color: #0284c7; font-weight: 700;">${params.newSeatNumber}</td>
                </tr>
                ${params.newVehiclePlate ? `
                <tr>
                  <td class="ticket-label">Biển số xe:</td>
                  <td class="ticket-value">${params.newVehiclePlate}</td>
                </tr>` : ''}
                <tr class="ticket-divider">
                  <td class="ticket-label" style="padding-top: 10px;">Phí đổi chuyến:</td>
                  <td class="ticket-value" style="padding-top: 10px;">${formattedFee} VND</td>
                </tr>
                <tr>
                  <td class="ticket-label">Chênh lệch giá vé:</td>
                  <td class="ticket-value">${formattedDiff} VND</td>
                </tr>
              </table>
            </div>

            <!-- Khối Mã QR Soát Vé Mới -->
            <div class="qr-section">
              <div class="qr-title">MÃ QR SOÁT VÉ MỚI</div>
              <div class="qr-img-box">
                <img class="qr-image" src="${qrImgSrc}" alt="Mã QR Vé Mới ${params.ticketCode}" width="210" height="210" />
              </div>
              <div class="qr-code-display">
                MÃ VÉ MỚI: <span>${params.ticketCode}</span>
              </div>
              <div class="qr-instruction">
                <strong>LƯU Ý QUAN TRỌNG:</strong><br/>
                1. Mã vé và mã QR cũ đã bị hủy vô hiệu lực. Vui lòng chỉ xuất trình mã QR mới này khi lên xe.<br/>
                2. Nếu không quét được mã, quý khách vui lòng đọc <strong>Mã vé mới: ${params.ticketCode}</strong> cho nhân viên soát vé.
              </div>
            </div>
          </div>
          <div class="footer">
            <strong>Trường Đại học Công nghệ Thông tin & Truyền thông Thái Nguyên (ICTU)</strong><br/>
            Hệ Thống Quản Lý Vé Xe Buýt Thông Minh - SmartBus ICTU<br/>
            Hotline hỗ trợ: 1900 1234 | Website: smartbus.ictu.edu.vn
          </div>
        </div>
      </body>
      </html>
    `;

    const htmlContent = renderHtml(params.qrDataUrl);
    const emailHtml = renderHtml(smtpQrSrc);

    const record: SentNotificationRecord = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipientEmail: params.recipientEmail,
      subject,
      ticketCode: params.ticketCode,
      bookingCode: params.bookingCode,
      sentAt: new Date(),
      status: 'sent',
      htmlPreview: htmlContent,
    };

    this.sentNotifications.push(record);
    this.logger.log(`[NotificationService] Đã gửi email đổi vé mới thành công tới ${params.recipientEmail} (Mã vé: ${params.ticketCode})`);

    if (this.transporter) {
      try {
        const fromAddress =
          process.env.SMTP_FROM ||
          `"Hệ Thống Xe Buýt Thông Minh ICTU" <${process.env.SMTP_USER || 'no-reply@smartbus.ictu.edu.vn'}>`;
        await this.transporter.sendMail({
          from: fromAddress,
          to: params.recipientEmail,
          subject,
          html: emailHtml,
          attachments,
        });
      } catch (err: any) {
        this.logger.error(`[NotificationService] Lỗi gửi email đổi vé qua SMTP: ${err?.message}`);
        record.status = 'failed';
      }
    }

    return true;
  }

  /**
   * Tạo giao diện HTML Hóa Đơn Điện Tử chuẩn Responsive, tương thích 100% mọi ứng dụng Email di động (Gmail, Outlook, iOS Mail)
   */
  /**
   * Tạo giao diện HTML Vé Điện Tử & Hóa Đơn Chuẩn Mobile-First (Thẻ Boarding Pass tích hợp mã QR soát vé và tóm tắt thanh toán)
   */
  buildInvoiceEmailHtml(
    params: SendInvoiceEmailParams,
    redirectInfo?: { isRedirected: boolean; originalEmail: string; actualTo: string },
    qrImgSrc?: string,
  ): string {
    const formattedTotal = Number(params.totalAmount).toLocaleString('vi-VN');
    const ticketCode = params.ticketCode || params.items?.[0]?.ticketCode || params.bookingCode;
    const seatNumber = params.seatNumber || params.items?.[0]?.seatNumber || 'Ghế tiêu chuẩn';
    const passengerName = params.passengerName || params.buyerName || 'Hành khách';
    const routeName = params.routeName || 'Tuyến xe buýt thông minh ICTU';
    const origin = params.origin;
    const destination = params.destination;
    const lookupCode = params.lookupCode || params.bookingCode;
    const paymentMethodDisplay = (params.paymentMethod || 'vnpay').toUpperCase();

    let departureStr = 'Khi lên xe';
    if (params.departureTime) {
      const d = params.departureTime instanceof Date ? params.departureTime : new Date(params.departureTime);
      departureStr = d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
      });
    }

    const finalQrSrc = qrImgSrc || params.qrDataUrl || '';

    return `
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml" lang="vi">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Vé Xe Buýt & Hóa Đơn - ${ticketCode}</title>
        <style>
          body { margin: 0; padding: 12px 6px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-text-size-adjust: 100%; }
          .ticket-wrapper { max-width: 440px; margin: 0 auto; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0; }
          .ticket-head { background: linear-gradient(135deg, #005A36 0%, #059669 100%); color: #ffffff; padding: 18px 20px; text-align: center; }
          .brand-title { font-size: 15px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; margin: 0 0 6px 0; }
          .badge-paid { display: inline-block; background: rgba(255, 255, 255, 0.22); border: 1px solid rgba(255, 255, 255, 0.45); padding: 4px 14px; border-radius: 9999px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
          .ticket-body { padding: 22px 18px 16px 18px; text-align: center; }
          .qr-box { display: inline-block; padding: 12px; background: #ffffff; border-radius: 14px; border: 2px solid #10b981; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.15); margin-bottom: 12px; }
          .qr-img { width: 190px; height: 190px; display: block; margin: 0 auto; }
          .ticket-code-tag { display: inline-block; background: #f0fdf4; border: 1px solid #bbf7d0; color: #047857; padding: 5px 12px; border-radius: 6px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 16px; font-weight: 800; letter-spacing: 1px; margin-bottom: 6px; }
          .qr-hint { font-size: 12.5px; color: #059669; font-weight: 600; margin: 0 0 16px 0; }
          .trip-card { background: #f8fafc; border-radius: 12px; padding: 14px 16px; text-align: left; margin-bottom: 16px; border: 1px solid #f1f5f9; }
          .route-header { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
          .route-sub { font-size: 13px; color: #047857; font-weight: 600; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed #e2e8f0; }
          .trip-table { width: 100%; border-collapse: collapse; }
          .trip-table td { padding: 4px 0; font-size: 13px; }
          .t-lbl { color: #64748b; }
          .t-val { color: #0f172a; font-weight: 600; text-align: right; }
          .seat-pill { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 6px; font-weight: 800; font-size: 13px; }
          .dash-divider { border-top: 2px dashed #cbd5e1; margin: 4px 16px; }
          .invoice-box { padding: 16px 18px 20px 18px; text-align: left; }
          .inv-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; }
          .pay-highlight { background: #f0fdf4; border-radius: 10px; padding: 10px 14px; margin-bottom: 10px; border: 1px solid #dcfce7; }
          .pay-amount { font-size: 20px; font-weight: 900; color: #15803d; float: right; }
          .pay-label { font-size: 13px; font-weight: 700; color: #166534; line-height: 24px; }
          .inv-table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .inv-table td { padding: 3px 0; color: #64748b; }
          .inv-v { text-align: right; color: #1e293b; font-weight: 600; }
          .pdf-badge { font-size: 11.5px; color: #334155; background: #f8fafc; padding: 8px 12px; border-radius: 8px; margin-top: 12px; border: 1px solid #e2e8f0; text-align: center; line-height: 1.4; }
          .footer-note { text-align: center; padding: 12px 14px; font-size: 11px; color: #94a3b8; background: #f8fafc; border-top: 1px solid #f1f5f9; line-height: 1.5; }
        </style>
      </head>
      <body>
        <!-- Preheader Ẩn (Chống dính chữ xem trước trên Gmail Mobile) -->
        <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
          Vé xe buýt SmartBus ICTU: Mã ${ticketCode} • Ghế ${seatNumber} • Đã thanh toán ${formattedTotal} đ. Quét mã QR khi lên xe.
          &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy;
        </div>

        <div class="ticket-wrapper">
          <!-- 1. Header Vé Xe Thông Minh -->
          <div class="ticket-head">
            <div class="brand-title">SMARTBUS ICTU • THẺ LÊN XE BUÝT</div>
            <span class="badge-paid">✓ ĐÃ THANH TOÁN (HỢP LỆ)</span>
          </div>

          <!-- 2. Thân Vé: QR Code To Rõ Ở Trung Tâm -->
          <div class="ticket-body">
            ${finalQrSrc ? `
            <div class="qr-box">
              <img class="qr-img" src="${finalQrSrc}" alt="QR Vé Xe ${ticketCode}" width="190" height="190" />
            </div>
            ` : ''}

            <div>
              <span class="ticket-code-tag">MÃ VÉ: ${ticketCode}</span>
            </div>
            <p class="qr-hint">📲 Xuất trình mã QR này cho tài xế/phụ xe quét khi lên xe buýt</p>

            <!-- Chi tiết chuyến đi -->
            <div class="trip-card">
              <div class="route-header">${routeName}</div>
              ${origin && destination ? `<div class="route-sub">${origin} ➔ ${destination}</div>` : ''}

              <table class="trip-table">
                <tr>
                  <td class="t-lbl">Khởi hành:</td>
                  <td class="t-val">${departureStr}</td>
                </tr>
                <tr>
                  <td class="t-lbl">Vị trí ghế:</td>
                  <td class="t-val"><span class="seat-pill">${seatNumber}</span></td>
                </tr>
                ${params.vehiclePlate ? `
                <tr>
                  <td class="t-lbl">Xe buýt:</td>
                  <td class="t-val">${params.vehiclePlate}</td>
                </tr>` : ''}
                <tr>
                  <td class="t-lbl">Hành khách:</td>
                  <td class="t-val">${passengerName}</td>
                </tr>
              </table>
            </div>
          </div>

          <!-- 3. Rãnh Cắt Vé (Ticket Perforation) -->
          <div class="dash-divider"></div>

          <!-- 4. Khối Tóm Tắt Thanh Toán & Hóa Đơn Tinh Gọn -->
          <div class="invoice-box">
            <div class="inv-title">CHI TIẾT THANH TOÁN & HÓA ĐƠN</div>

            <div class="pay-highlight">
              <span class="pay-amount">${formattedTotal} đ</span>
              <span class="pay-label">ĐÃ THANH TOÁN</span>
              <div style="clear: both;"></div>
            </div>

            <table class="inv-table">
              <tr>
                <td>Phương thức:</td>
                <td class="inv-v">${paymentMethodDisplay}</td>
              </tr>
              <tr>
                <td>Mã đơn đặt vé:</td>
                <td class="inv-v" style="font-family: monospace;">${params.bookingCode}</td>
              </tr>
              <tr>
                <td>Số hóa đơn GTGT:</td>
                <td class="inv-v" style="font-family: monospace;">${params.invoiceNumber}</td>
              </tr>
              <tr>
                <td>Mã tra cứu:</td>
                <td class="inv-v" style="font-family: monospace; color: #0284c7;">${lookupCode}</td>
              </tr>
            </table>

            <div class="pdf-badge">
              📎 <strong>Hóa đơn điện tử PDF:</strong> Tệp <code>Hoa_Don_${params.invoiceNumber}.pdf</code> đã được đính kèm ở thư này để bạn lưu trữ và quyết toán chi phí.
            </div>
          </div>

          <!-- 5. Footer Nhỏ Gọn -->
          <div class="footer-note">
            <strong>SmartBus ICTU - Hệ Thống Xe Buýt Thông Minh</strong><br/>
            Hotline: 1900 1234 | Website: smartbus.ictu.edu.vn
            ${redirectInfo?.isRedirected ? `<br/><span style="color: #b45309; font-size: 10px;">* Demo: Chuyển hướng từ ${redirectInfo.originalEmail}</span>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendMail(options: SendMailOptions): Promise<boolean> {
    const redirectInfo = this.resolveTargetEmail(options.to);
    const toAddress = redirectInfo.actualTo;
    const fromAddress =
      process.env.SMTP_FROM ||
      `"Hệ Thống Xe Buýt Thông Minh ICTU" <${process.env.SMTP_USER || 'no-reply@smartbus.ictu.edu.vn'}>`;

    const record: SentNotificationRecord = {
      id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipientEmail: toAddress,
      subject: options.subject,
      ticketCode: '',
      bookingCode: '',
      sentAt: new Date(),
      status: 'sent',
      htmlPreview: options.html,
    };

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: fromAddress,
          to: toAddress,
          subject: options.subject,
          text: options.text,
          html: options.html,
          attachments: options.attachments,
        });
        this.logger.log(`[NotificationService] Đã gửi email thành công qua SMTP tới: ${toAddress} (Gốc: ${options.to}) (Tiêu đề: ${options.subject})`);
        this.sentNotifications.push(record);
        return true;
      } catch (error: any) {
        this.logger.error(`[NotificationService] Lỗi gửi email qua SMTP tới ${toAddress}: ${error?.message}. Ghi nhận log.`);
        record.status = 'failed';
        this.sentNotifications.push(record);
        return false;
      }
    } else {
      this.logger.log(
        `[NotificationService] [Mock/Log Mode] Gửi email tới ${toAddress}: ${options.subject} (Số tệp đính kèm: ${options.attachments?.length || 0})`,
      );
      this.sentNotifications.push(record);
      return true;
    }
  }

  /**
   * Gửi email Hóa đơn điện tử kèm tệp đính kèm PDF
   */
  /**
   * Gửi email Vé Điện Tử & Hóa Đơn Chuẩn Mobile-First kèm mã QR soát vé và tệp PDF đính kèm
   */
  async sendInvoiceEmail(params: SendInvoiceEmailParams): Promise<boolean> {
    const redirectInfo = this.resolveTargetEmail(params.recipientEmail);
    const subjectPrefix = redirectInfo.isRedirected ? `[Demo: ${params.recipientEmail}] ` : '';
    const ticketCodeDisplay = params.ticketCode ? ` - Mã vé: ${params.ticketCode}` : ` - Đơn: ${params.bookingCode}`;
    const subject = `${subjectPrefix}[SmartBus ICTU] Thẻ lên xe & Hóa đơn${ticketCodeDisplay}`;

    const attachments: EmailAttachment[] = [
      {
        filename: `Hoa_Don_${params.invoiceNumber}.pdf`,
        content: params.pdfBuffer,
        contentType: 'application/pdf',
      },
    ];

    let qrCid = '';
    let smtpQrSrc = params.qrDataUrl || '';

    // Chuẩn bị CID Inline Attachment cho ảnh QR để Gmail mobile hiển thị trực tiếp sắc nét
    if (params.qrDataUrl && params.qrDataUrl.startsWith('data:image/')) {
      const match = params.qrDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match) {
        const ext = match[1] || 'png';
        const base64Data = match[2];
        const safeCode = (params.ticketCode || params.bookingCode).replace(/[^a-zA-Z0-9_-]/g, '');
        qrCid = `ticket-qr-${safeCode}`;
        attachments.push({
          filename: `ticket-${safeCode}-qr.${ext}`,
          content: Buffer.from(base64Data, 'base64'),
          contentType: `image/${ext}`,
          cid: qrCid,
        } as any);
        smtpQrSrc = `cid:${qrCid}`;
      }
    }

    const htmlBody = params.htmlContent || this.buildInvoiceEmailHtml(params, redirectInfo, smtpQrSrc);

    return this.sendMail({
      to: redirectInfo.actualTo,
      subject,
      html: htmlBody,
      attachments,
    });
  }

  getSentNotifications(filter?: { ticketCode?: string; recipientEmail?: string }): SentNotificationRecord[] {
    return this.sentNotifications.filter((n) => {
      if (filter?.ticketCode && n.ticketCode !== filter.ticketCode) return false;
      if (filter?.recipientEmail && n.recipientEmail !== filter.recipientEmail) return false;
      return true;
    });
  }

  /**
   * Xóa lịch sử thông báo (phục vụ reset trạng thái kiểm thử)
   */
  clearHistory() {
    this.sentNotifications.length = 0;
  }
}

