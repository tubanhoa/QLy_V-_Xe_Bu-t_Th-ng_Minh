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
  buildInvoiceEmailHtml(
    params: SendInvoiceEmailParams,
    redirectInfo?: { isRedirected: boolean; originalEmail: string; actualTo: string },
  ): string {
    const formattedTotal = Number(params.totalAmount).toLocaleString('vi-VN');
    const subtotal = params.subtotalAmount
      ? Number(params.subtotalAmount)
      : Math.round(Number(params.totalAmount) / 1.08);
    const formattedSubtotal = subtotal.toLocaleString('vi-VN');
    const vatAmount = params.vatAmount
      ? Number(params.vatAmount)
      : Number(params.totalAmount) - subtotal;
    const formattedVat = vatAmount.toLocaleString('vi-VN');
    const vatRate = params.vatRate ?? 8;

    const issuedDate = params.issuedAt ? new Date(params.issuedAt) : new Date();
    const dateStr = issuedDate.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    const timeStr = issuedDate.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });

    const lookupCode = params.lookupCode || params.bookingCode;
    const lookupUrl = `http://localhost:3000/tra-cuu-hoa-don?code=${encodeURIComponent(lookupCode)}`;

    const itemsHtml =
      params.items && params.items.length > 0
        ? params.items
            .map(
              (item, idx) => `
            <tr>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: center; color: #64748b;">${idx + 1}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b;">
                <strong>${item.description}</strong><br/>
                <span style="font-size: 11.5px; color: #64748b;">${item.ticketCode ? `Mã vé: <code>${item.ticketCode}</code>` : ''} ${item.seatNumber ? `| Ghế: <strong>${item.seatNumber}</strong>` : ''}</span>
              </td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: center; color: #1e293b;">${item.quantity || 1}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; color: #1e293b;">${Number(item.unitPrice || item.totalAmount).toLocaleString('vi-VN')} đ</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; font-weight: 700; color: #0284c7;">${Number(item.totalAmount).toLocaleString('vi-VN')} đ</td>
            </tr>
          `,
            )
            .join('')
        : `
          <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: center; color: #64748b;">1</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b;">
              <strong>Dịch vụ vận tải hành khách xe buýt thông minh</strong><br/>
              <span style="font-size: 11.5px; color: #64748b;">Tuyến: <strong>${params.routeName}</strong> | Mã đơn vé: <code>${params.bookingCode}</code></span>
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: center; color: #1e293b;">1</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; color: #1e293b;">${formattedSubtotal} đ</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; font-weight: 700; color: #0284c7;">${formattedTotal} đ</td>
          </tr>
        `;

    return `
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml" lang="vi">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Hóa Đơn Điện Tử ${params.invoiceNumber}</title>
        <style type="text/css">
          body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
          table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
          td { vertical-align: top; }
          img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        </style>
      </head>
      <body style="background-color: #f1f5f9; margin: 0; padding: 24px 10px;">
        <!-- Preheader Text Ẩn (Ngăn chặn Gmail gom dòng text body vào snippet xem trước) -->
        <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
          Hóa đơn điện tử số ${params.invoiceNumber} cho đơn đặt vé ${params.bookingCode} đã được phát hành thành công. Mã tra cứu: ${lookupCode}. Tổng thanh toán: ${formattedTotal} VND.
          &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy;
        </div>

        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                
                <!-- 1. Header Banner -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0284c7 0%, #1e3a8a 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
                    <div style="font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #bae6fd; margin-bottom: 4px;">
                      TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN & TRUYỀN THÔNG (ICTU)
                    </div>
                    <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #ffffff;">
                      HÓA ĐƠN GIÁ TRỊ GIA TĂNG (ĐIỆN TỬ)
                    </h1>
                    <div style="font-size: 13px; color: #e0f2fe; margin-top: 4px;">
                      Dịch vụ vận tải hành khách bằng xe buýt thông minh SmartBus ICTU
                    </div>
                    <div style="margin-top: 14px;">
                      <span style="display: inline-block; background-color: #10b981; color: #ffffff; font-size: 12px; font-weight: 700; padding: 4px 14px; border-radius: 9999px; letter-spacing: 0.5px; text-transform: uppercase;">
                        ✓ ĐÃ THANH TOÁN (PAID)
                      </span>
                    </div>
                  </td>
                </tr>

                <!-- 2. Thân Email Nội Dung -->
                <tr>
                  <td style="padding: 24px;">
                    ${redirectInfo?.isRedirected ? `
                    <div style="background-color: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 12px 14px; border-radius: 8px; font-size: 12.5px; margin-bottom: 18px; line-height: 1.5;">
                      <strong>MÔI TRƯỜNG KIỂM THỬ:</strong> Email hóa đơn điện tử này được hệ thống tự động chuyển tiếp tới hòm thư quản trị <strong>${redirectInfo.actualTo}</strong> (Địa chỉ gốc của đơn vé: <code>${redirectInfo.originalEmail}</code>).
                    </div>` : ''}

                    <p style="margin: 0 0 14px 0; font-size: 15px; color: #1e293b;">
                      Kính chào quý khách <strong>${params.passengerName || params.buyerName || 'Hành khách'}</strong>,
                    </p>
                    <p style="margin: 0 0 18px 0; font-size: 14px; color: #475569; line-height: 1.5;">
                      Hệ thống trân trọng gửi quý khách thông tin hóa đơn điện tử cho giao dịch thanh toán đặt vé xe buýt thành công. Chi tiết chứng từ như sau:
                    </p>

                    <!-- Khối Thông Tin Hóa Đơn & Mã Tra Cứu Nổi Bật -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; margin-bottom: 20px;">
                      <tr>
                        <td style="padding: 16px 18px;">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td width="50%" style="padding-bottom: 8px;">
                                <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Số hóa đơn:</div>
                                <div style="font-size: 16px; font-weight: 800; color: #0284c7; font-family: monospace;">${params.invoiceNumber}</div>
                              </td>
                              <td width="50%" style="padding-bottom: 8px; text-align: right;">
                                <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Ký hiệu / Mẫu số:</div>
                                <div style="font-size: 13px; font-weight: 700; color: #334155;">C26TIU (Mẫu 1/001)</div>
                              </td>
                            </tr>
                            <tr>
                              <td width="50%" style="padding-top: 6px; border-top: 1px dashed #e2e8f0;">
                                <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Ngày lập:</div>
                                <div style="font-size: 13px; font-weight: 600; color: #334155;">${dateStr} ${timeStr}</div>
                              </td>
                              <td width="50%" style="padding-top: 6px; border-top: 1px dashed #e2e8f0; text-align: right;">
                                <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Mã đơn đặt vé:</div>
                                <div style="font-size: 13px; font-weight: 700; color: #0f172a; font-family: monospace;">${params.bookingCode}</div>
                              </td>
                            </tr>
                            <tr>
                              <td colspan="2" style="padding-top: 12px; border-top: 1.5px solid #e2e8f0;">
                                <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 14px; text-align: center;">
                                  <div style="font-size: 11.5px; font-weight: 700; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">MÃ TRA CỨU HÓA ĐƠN TRỰC TUYẾN</div>
                                  <div style="font-size: 20px; font-weight: 900; color: #1d4ed8; font-family: monospace; letter-spacing: 2px; margin: 4px 0;">${lookupCode}</div>
                                  <div style="font-size: 11px; color: #3b82f6;">Sử dụng mã này để tra cứu và tải lại hóa đơn gốc tại cổng SmartBus ICTU</div>
                                </div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Nút Kêu Gọi Hành Động (CTA Button) -->
                    <div style="text-align: center; margin: 20px 0 24px 0;">
                      <a href="${lookupUrl}" target="_blank" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 13.5px; font-weight: 700; display: inline-block; box-shadow: 0 4px 10px rgba(2, 132, 199, 0.25);">
                        🔍 Tra Cứu & Tải Hóa Đơn Trực Tuyến →
                      </a>
                    </div>

                    <!-- Bảng Thông Tin Đơn Vị Phát Hành & Khách Hàng -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                      <tr>
                        <td width="50%" style="padding-right: 8px;">
                          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; height: 100%;">
                            <div style="font-size: 11px; font-weight: 700; color: #0284c7; text-transform: uppercase; margin-bottom: 6px;">ĐƠN VỊ BÁN HÀNG</div>
                            <div style="font-size: 12.5px; font-weight: 700; color: #0f172a; line-height: 1.4;">${params.sellerName || 'Trường Đại học Công nghệ Thông tin & Truyền thông Thái Nguyên'}</div>
                            <div style="font-size: 11.5px; color: #64748b; margin-top: 4px;">MST: <strong>${params.sellerTaxCode || '4600123456'}</strong></div>
                          </div>
                        </td>
                        <td width="50%" style="padding-left: 8px;">
                          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; height: 100%;">
                            <div style="font-size: 11px; font-weight: 700; color: #0284c7; text-transform: uppercase; margin-bottom: 6px;">NGƯỜI MUA HÀNG</div>
                            <div style="font-size: 12.5px; font-weight: 700; color: #0f172a; line-height: 1.4;">${params.passengerName || params.buyerName || 'Hành khách'}</div>
                            <div style="font-size: 11.5px; color: #64748b; margin-top: 4px;">
                              ${params.studentId ? `Mã SV: <strong>${params.studentId}</strong> | ` : ''}SĐT: ${params.buyerPhone || 'Đã liên kết'}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Bảng Kê Chi Tiết Hàng Hóa Dịch Vụ -->
                    <div style="font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 8px;">
                      CHI TIẾT DỊCH VỤ VẬN TẢI
                    </div>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
                      <thead>
                        <tr style="background-color: #f8fafc; border-bottom: 1.5px solid #e2e8f0;">
                          <th style="padding: 9px 8px; font-size: 11.5px; font-weight: 700; color: #475569; text-align: center; width: 35px;">STT</th>
                          <th style="padding: 9px 8px; font-size: 11.5px; font-weight: 700; color: #475569; text-align: left;">Tên Dịch Vụ / Tuyến Xe</th>
                          <th style="padding: 9px 8px; font-size: 11.5px; font-weight: 700; color: #475569; text-align: center; width: 45px;">SL</th>
                          <th style="padding: 9px 8px; font-size: 11.5px; font-weight: 700; color: #475569; text-align: right; width: 85px;">Đơn Giá</th>
                          <th style="padding: 9px 8px; font-size: 11.5px; font-weight: 700; color: #475569; text-align: right; width: 95px;">Thành Tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${itemsHtml}
                      </tbody>
                    </table>

                    <!-- Bảng Tổng Kết Tài Chính -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
                      <tr>
                        <td style="font-size: 13px; color: #64748b; padding: 4px 0;">Tiền dịch vụ trước thuế:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #1e293b; text-align: right; padding: 4px 0;">${formattedSubtotal} VND</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #64748b; padding: 4px 0;">Thuế suất GTGT:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #1e293b; text-align: right; padding: 4px 0;">${vatRate}%</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #64748b; padding: 4px 0;">Tiền thuế GTGT:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #1e293b; text-align: right; padding: 4px 0;">${formattedVat} VND</td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; font-weight: 700; color: #0f172a; padding: 8px 0 0 0; border-top: 1.5px dashed #cbd5e1;">TỔNG TIỀN THANH TOÁN:</td>
                        <td style="font-size: 18px; font-weight: 800; color: #16a34a; text-align: right; padding: 8px 0 0 0; border-top: 1.5px dashed #cbd5e1;">${formattedTotal} VND</td>
                      </tr>
                    </table>

                    <!-- Khối Chữ Ký Số & Con Dấu Điện Tử Hợp Lệ -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0fdf4; border: 1.5px dashed #10b981; border-radius: 10px; margin-bottom: 20px;">
                      <tr>
                        <td style="padding: 14px 18px;">
                          <div style="font-size: 12px; font-weight: 800; color: #047857; text-transform: uppercase; margin-bottom: 4px;">
                            ✓ ĐÃ KÝ SỐ ĐIỆN TỬ HỢP LỆ (DIGITALLY SIGNED)
                          </div>
                          <div style="font-size: 12px; color: #065f46; line-height: 1.5;">
                            Ký bởi: <strong>TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG (ICTU)</strong><br/>
                            Ngày ký: ${dateStr} ${timeStr} | Tiêu chuẩn chứng thư số Nhà Nước<br/>
                            Căn cứ pháp lý: Nghị định 123/2020/NĐ-CP & Thông tư 78/2021/TT-BTC của Bộ Tài Chính
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Hướng Dẫn Tệp Đính Kèm PDF -->
                    <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #1e40af; margin-bottom: 20px; line-height: 1.5;">
                      📎 <strong>Tệp đính kèm:</strong> Tệp hóa đơn điện tử định dạng PDF (<code>Hoa_Don_${params.invoiceNumber}.pdf</code>) có chữ ký số điện tử chuẩn đã được đính kèm ở bên dưới email này để quý khách thuận tiện lưu trữ và quyết toán chi phí.
                    </div>
                  </td>
                </tr>

                <!-- 3. Footer Pháp Lý -->
                <tr>
                  <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 24px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6;">
                    <strong>TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN & TRUYỀN THÔNG THÁI NGUYÊN (ICTU)</strong><br/>
                    Địa chỉ: Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên, Tỉnh Thái Nguyên<br/>
                    Hotline hỗ trợ kỹ thuật: 1900 1234 | Email: hotro@smartbus.ictu.edu.vn | Website: smartbus.ictu.edu.vn
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Gửi email chung qua Nodemailer SMTP hoặc Mock logger
   */
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
  async sendInvoiceEmail(params: SendInvoiceEmailParams): Promise<boolean> {
    const redirectInfo = this.resolveTargetEmail(params.recipientEmail);
    const subjectPrefix = redirectInfo.isRedirected ? `[Demo: ${params.recipientEmail}] ` : '';
    const subject = `${subjectPrefix}[SmartBus ICTU] Hóa đơn điện tử ${params.invoiceNumber} - Đơn vé ${params.bookingCode}`;

    const htmlBody = params.htmlContent || this.buildInvoiceEmailHtml(params, redirectInfo);

    return this.sendMail({
      to: redirectInfo.actualTo,
      subject,
      html: htmlBody,
      attachments: [
        {
          filename: `Hoa_Don_${params.invoiceNumber}.pdf`,
          content: params.pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  /**
   * Lấy danh sách các thông báo / email đã gửi (phục vụ đối soát và kiểm thử)
   */
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

