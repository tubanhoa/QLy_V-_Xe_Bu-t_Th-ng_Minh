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
   * Tự động gửi Email vé điện tử kèm mã QR sau khi thanh toán thành công
   */
  async sendTicketConfirmationEmail(params: SendTicketEmailParams): Promise<boolean> {
    const subject = `[SmartBus ICTU] Xác nhận vé điện tử thành công - Mã vé: ${params.ticketCode}`;
    const formattedPrice = Number(params.price).toLocaleString('vi-VN');
    const formattedDeparture =
      params.departureTime instanceof Date
        ? params.departureTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        : new Date(params.departureTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #333; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; letter-spacing: 0.5px; }
          .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; }
          .content { padding: 24px; }
          .success-badge { display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 13px; margin-bottom: 20px; }
          .ticket-card { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 18px; margin-bottom: 20px; }
          .ticket-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
          .ticket-label { color: #64748b; }
          .ticket-value { font-weight: 600; color: #0f172a; }
          .qr-section { text-align: center; padding: 20px 0; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
          .qr-image { width: 220px; height: 220px; display: block; margin: 0 auto 12px auto; }
          .qr-instruction { font-size: 13px; color: #64748b; max-width: 80%; margin: 0 auto; line-height: 1.5; }
          .footer { background: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>HỆ THỐNG XE BUÝT THÔNG MINH - SMARTBUS</h1>
            <p>Xác nhận thanh toán và phát hành Vé Điện Tử</p>
          </div>
          <div class="content">
            <div style="text-align: center;">
              <span class="success-badge">THANH TOÁN THÀNH CÔNG</span>
            </div>
            <p>Kính chào quý khách <strong>${params.passengerName}</strong>,</p>
            <p>Hệ thống đã nhận được thanh toán cho đơn đặt vé của quý khách. Dưới đây là thông tin vé điện tử chính thức:</p>
            
            <div class="ticket-card">
              <div class="ticket-row"><span class="ticket-label">Mã vé:</span><span class="ticket-value" style="color: #2563eb;">${params.ticketCode}</span></div>
              <div class="ticket-row"><span class="ticket-label">Mã đơn đặt:</span><span class="ticket-value">${params.bookingCode}</span></div>
              <div class="ticket-row"><span class="ticket-label">Tuyến xe:</span><span class="ticket-value">${params.routeName}</span></div>
              ${params.origin && params.destination ? `<div class="ticket-row"><span class="ticket-label">Lộ trình:</span><span class="ticket-value">${params.origin} ➔ ${params.destination}</span></div>` : ''}
              <div class="ticket-row"><span class="ticket-label">Thời gian khởi hành:</span><span class="ticket-value">${formattedDeparture}</span></div>
              <div class="ticket-row"><span class="ticket-label">Số ghế:</span><span class="ticket-value" style="font-size: 16px; color: #0284c7;">${params.seatNumber}</span></div>
              ${params.vehiclePlate ? `<div class="ticket-row"><span class="ticket-label">Biển số xe:</span><span class="ticket-value">${params.vehiclePlate}</span></div>` : ''}
              <div class="ticket-row" style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px;"><span class="ticket-label">Giá vé:</span><span class="ticket-value" style="color: #16a34a; font-size: 16px;">${formattedPrice} VND</span></div>
            </div>

            <div class="qr-section">
              <img class="qr-image" src="${params.qrDataUrl}" alt="Mã QR Vé Xe ${params.ticketCode}" />
              <div class="qr-instruction">
                <strong>HƯỚNG DẪN LÊN XE:</strong><br/>
                Vui lòng xuất trình mã QR này cho tài xế hoặc phụ xe khi lên xe để thực hiện quét mã soát vé tự động.
              </div>
            </div>
          </div>
          <div class="footer">
            <p>Email này được tạo tự động bởi Hệ Thống Quản Lý Vé Xe Buýt Thông Minh ICTU.</p>
            <p>Tổng đài hỗ trợ hành khách: 1900 1234 | Website: smartbus.ictu.vn</p>
          </div>
        </div>
      </body>
      </html>
    `;

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
          to: params.recipientEmail,
          subject,
          html: htmlContent,
        });
        this.logger.log(`[NotificationService] Đã gửi email vé điện tử thực tế qua SMTP tới: ${params.recipientEmail}`);
      } catch (err: any) {
        this.logger.error(`[NotificationService] Lỗi gửi email vé qua SMTP tới ${params.recipientEmail}: ${err?.message}`);
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
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #333; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #c0392b 0%, #e74c3c 100%); color: white; padding: 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 24px; }
          .badge { display: inline-block; background: #fee2e2; color: #b91c1c; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 13px; margin-bottom: 20px; }
          .card { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 18px; margin-bottom: 20px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
          .label { color: #64748b; }
          .value { font-weight: 600; color: #0f172a; }
          .footer { background: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>HỆ THỐNG XE BUÝT THÔNG MINH - SMARTBUS</h1>
            <p>Xác nhận hủy vé xe buýt</p>
          </div>
          <div class="content">
            <div style="text-align: center;">
              <span class="badge">ĐÃ HỦY VÉ THÀNH CÔNG</span>
            </div>
            <p>Kính chào quý khách <strong>${params.passengerName}</strong>,</p>
            <p>Yêu cầu hủy vé xe buýt của quý khách đã được hệ thống xử lý thành công. Dưới đây là thông tin chi tiết:</p>
            <div class="card">
              <div class="row"><span class="label">Mã vé đã hủy:</span><span class="value" style="color: #dc2626;">${params.ticketCode}</span></div>
              <div class="row"><span class="label">Mã đơn đặt:</span><span class="value">${params.bookingCode}</span></div>
              <div class="row"><span class="label">Tuyến xe:</span><span class="value">${params.routeName}</span></div>
              <div class="row"><span class="label">Giá vé gốc:</span><span class="value">${formattedOriginal} VND</span></div>
              <div class="row"><span class="label">Phí hủy vé:</span><span class="value" style="color: #b91c1c;">${formattedFee} VND</span></div>
              <div class="row" style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px;">
                <span class="label">Số tiền hoàn lại:</span><span class="value" style="color: #16a34a; font-size: 16px;">${formattedRefund} VND</span>
              </div>
            </div>
            <p style="font-size: 13px; color: #64748b;">Số tiền hoàn lại sẽ được tự động hoàn về tài khoản thanh toán ban đầu của quý khách theo quy định của ngân hàng/cổng thanh toán.</p>
          </div>
          <div class="footer">
            <p>Hệ Thống Quản Lý Vé Xe Buýt Thông Minh ICTU - Tổng đài: 1900 1234</p>
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
    const subject = `[SmartBus ICTU] Xác nhận ĐỔI VÉ XE thành công - Mã vé: ${params.ticketCode}`;
    const formattedDeparture =
      params.newDepartureTime instanceof Date
        ? params.newDepartureTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        : new Date(params.newDepartureTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const formattedFee = Number(params.exchangeFee).toLocaleString('vi-VN');
    const formattedDiff = Number(params.priceDifference).toLocaleString('vi-VN');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #333; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: white; padding: 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 24px; }
          .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 13px; margin-bottom: 20px; }
          .card { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 18px; margin-bottom: 20px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
          .label { color: #64748b; }
          .value { font-weight: 600; color: #0f172a; }
          .qr-section { text-align: center; padding: 20px 0; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
          .qr-image { width: 220px; height: 220px; display: block; margin: 0 auto 12px auto; }
          .footer { background: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>HỆ THỐNG XE BUÝT THÔNG MINH - SMARTBUS</h1>
            <p>Xác nhận Đổi Vé Xe Buýt Thành Công</p>
          </div>
          <div class="content">
            <div style="text-align: center;">
              <span class="badge">ĐỔI VÉ THÀNH CÔNG</span>
            </div>
            <p>Kính chào quý khách <strong>${params.passengerName}</strong>,</p>
            <p>Yêu cầu đổi chuyến của quý khách đã hoàn tất. Thông tin chuyến xe mới của quý khách như sau:</p>
            <div class="card">
              <div class="row"><span class="label">Mã vé:</span><span class="value" style="color: #0284c7;">${params.ticketCode}</span></div>
              <div class="row"><span class="label">Mã đơn đặt:</span><span class="value">${params.bookingCode}</span></div>
              <div class="row"><span class="label">Tuyến xe mới:</span><span class="value">${params.newRouteName}</span></div>
              ${params.newOrigin && params.newDestination ? `<div class="row"><span class="label">Lộ trình:</span><span class="value">${params.newOrigin} ➔ ${params.newDestination}</span></div>` : ''}
              <div class="row"><span class="label">Thời gian xuất bến mới:</span><span class="value">${formattedDeparture}</span></div>
              <div class="row"><span class="label">Số ghế mới:</span><span class="value" style="font-size: 16px; color: #0284c7;">${params.newSeatNumber}</span></div>
              ${params.newVehiclePlate ? `<div class="row"><span class="label">Biển số xe:</span><span class="value">${params.newVehiclePlate}</span></div>` : ''}
              <div class="row"><span class="label">Phí đổi vé:</span><span class="value">${formattedFee} VND</span></div>
              <div class="row"><span class="label">Chênh lệch đã xử lý:</span><span class="value">${formattedDiff} VND</span></div>
            </div>

            <div class="qr-section">
              <img class="qr-image" src="${params.qrDataUrl}" alt="Mã QR Vé Mới" />
              <div style="font-size: 13px; color: #64748b;">Mã QR cũ đã vô hiệu. Vui lòng sử dụng mã QR mới này khi lên xe.</div>
            </div>
          </div>
          <div class="footer">
            <p>Hệ Thống Quản Lý Vé Xe Buýt Thông Minh ICTU - Tổng đài: 1900 1234</p>
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
          html: htmlContent,
        });
      } catch (err: any) {
        this.logger.error(`[NotificationService] Lỗi gửi email đổi vé qua SMTP: ${err?.message}`);
        record.status = 'failed';
      }
    }

    return true;
  }

  /**
   * Gửi email chung qua Nodemailer SMTP hoặc Mock logger
   */
  async sendMail(options: SendMailOptions): Promise<boolean> {
    const fromAddress =
      process.env.SMTP_FROM ||
      `"Hệ Thống Xe Buýt Thông Minh ICTU" <${process.env.SMTP_USER || 'no-reply@smartbus.ictu.edu.vn'}>`;

    const record: SentNotificationRecord = {
      id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipientEmail: options.to,
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
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
          attachments: options.attachments,
        });
        this.logger.log(`[NotificationService] Đã gửi email thành công qua SMTP tới: ${options.to} (Tiêu đề: ${options.subject})`);
        this.sentNotifications.push(record);
        return true;
      } catch (error: any) {
        this.logger.error(`[NotificationService] Lỗi gửi email qua SMTP: ${error?.message}. Ghi nhận log.`);
        record.status = 'failed';
        this.sentNotifications.push(record);
        return false;
      }
    } else {
      this.logger.log(
        `[NotificationService] [Mock/Log Mode] Gửi email tới ${options.to}: ${options.subject} (Số tệp đính kèm: ${options.attachments?.length || 0})`,
      );
      this.sentNotifications.push(record);
      return true;
    }
  }

  /**
   * Gửi email Hóa đơn điện tử kèm tệp đính kèm PDF
   */
  async sendInvoiceEmail(params: SendInvoiceEmailParams): Promise<boolean> {
    const subject = `[SmartBus ICTU] Hóa đơn điện tử ${params.invoiceNumber} - Đơn vé ${params.bookingCode}`;
    const formattedTotal = Number(params.totalAmount).toLocaleString('vi-VN');

    const htmlBody =
      params.htmlContent ||
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 16px;">
          <h2 style="color: #1e3a8a; margin: 0; font-size: 22px;">HÓA ĐƠN ĐIỆN TỬ - SMARTBUS ICTU</h2>
          <p style="color: #64748b; font-size: 13px; margin: 6px 0 0 0;">Dịch vụ vận tải hành khách bằng xe buýt thông minh</p>
        </div>
        
        <p style="margin-top: 20px;">Kính chào quý khách <strong>${params.passengerName}</strong>,</p>
        <p>Hệ thống trân trọng gửi quý khách hóa đơn điện tử cho giao dịch thanh toán đặt vé xe buýt thành công.</p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 14px 18px; margin: 18px 0; border-radius: 4px;">
          <p style="margin: 4px 0;"><strong>Số hóa đơn:</strong> <span style="color: #2563eb; font-weight: bold;">${params.invoiceNumber}</span></p>
          <p style="margin: 4px 0;"><strong>Mã đơn vé:</strong> <code>${params.bookingCode}</code></p>
          <p style="margin: 4px 0;"><strong>Tuyến xe:</strong> ${params.routeName}</p>
          <p style="margin: 4px 0;"><strong>Tổng tiền thanh toán:</strong> <span style="color: #059669; font-weight: bold; font-size: 16px;">${formattedTotal} VND</span></p>
        </div>

        <p>Tệp hóa đơn điện tử định dạng <strong>PDF chuẩn có chữ ký số điện tử</strong> đã được đính kèm ở bên dưới email này.</p>
        <p style="color: #64748b; font-size: 13px;">Quý khách có thể xem và tải lại hóa đơn bất cứ lúc nào từ phần Lịch sử đặt vé trong ứng dụng.</p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
        <div style="font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.6;">
          <strong>Trường Đại học Công nghệ Thông tin & Truyền thông Thái Nguyên (ICTU)</strong><br/>
          Địa chỉ: Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên, Tỉnh Thái Nguyên<br/>
          Hotline hỗ trợ: 1900 1234 | Email: hotro@smartbus.ictu.edu.vn
        </div>
      </div>
    `;

    return this.sendMail({
      to: params.recipientEmail,
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

