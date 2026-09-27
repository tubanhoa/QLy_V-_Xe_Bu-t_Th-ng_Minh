import { Injectable, Logger } from '@nestjs/common';

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
    this.logger.log(`[NotificationService] Đã gửi email vé điện tử thành công tới ${params.recipientEmail} (Mã vé: ${params.ticketCode})`);

    return true;
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
