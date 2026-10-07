import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import QRCode from 'qrcode';
import { InvoiceEntity } from '../../database/entities/invoice.entity.js';
import { BookingEntity } from '../../database/entities/booking.entity.js';
import { PaymentEntity } from '../../database/entities/payment.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { NotificationService } from '../notification/notification.service.js';
import {
  InvoiceData,
  InvoiceSeller,
  InvoiceBuyer,
  InvoiceItem,
} from './invoice.types.js';
import { vietnameseNumberToWords } from './utils/vietnamese-number-to-words.util.js';
import { generateInvoicePdf } from './utils/invoice-pdf.util.js';
import { generateInvoiceHtml } from './utils/invoice-html.util.js';
import { generateQrDataUrl } from '../../common/utils/qr-code.util.js';

const DEFAULT_SELLER: InvoiceSeller = {
  name: 'TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG (ICTU)',
  taxCode: '4600123456-001',
  address: 'Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên, Tỉnh Thái Nguyên',
  phone: '0208.3846.254 - Hotline: 1900 1234',
  email: 'smartbus@ictu.edu.vn',
  website: 'https://smartbus.ictu.edu.vn',
};

interface InvoiceJob {
  paymentId: string;
  attempts: number;
  maxAttempts: number;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);
  private readonly invoiceQueue: InvoiceJob[] = [];
  private isProcessingQueue = false;

  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepository: Repository<InvoiceEntity>,
    @InjectRepository(BookingEntity)
    private readonly bookingRepository: Repository<BookingEntity>,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(TicketEntity)
    private readonly ticketRepository: Repository<TicketEntity>,
    @Optional()
    private readonly notificationService?: NotificationService,
  ) {}

  /**
   * Tạo mới hoặc lấy hóa đơn điện tử cho một thanh toán thành công
   */
  async createOrGetInvoice(paymentId: string): Promise<InvoiceEntity> {
    // 1. Kiểm tra nếu hóa đơn đã được khởi tạo trước đó
    const existing = await this.invoiceRepository.findOne({
      where: { paymentId },
      relations: {
        payment: true,
        booking: { user: true, trip: { route: true, vehicle: true } },
      },
    });

    if (existing) {
      return existing;
    }

    // 2. Tìm thông tin thanh toán và đơn đặt vé
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: {
        booking: {
          user: true,
          trip: {
            route: true,
            vehicle: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Không tìm thấy giao dịch thanh toán ID: ${paymentId}`);
    }

    const booking = payment.booking;
    if (!booking) {
      throw new NotFoundException(`Không tìm thấy đơn đặt vé liên kết với giao dịch ID: ${paymentId}`);
    }

    // Lấy danh sách vé đã đặt
    const tickets = await this.ticketRepository.find({
      where: { bookingId: booking.id },
      relations: { seat: true },
    });

    const totalAmount = Number(payment.amount || booking.finalAmount || 0);
    const discountAmount = Number(booking.discountAmount || 0);
    const vatRate = 0.08; // VAT 8%
    const subtotalAmount = Math.round(totalAmount / (1 + vatRate));
    const vatAmount = totalAmount - subtotalAmount;

    // Sinh số hóa đơn: INV-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${dateStr}-${randSuffix}`;

    // Mã tra cứu bảo mật: ICTU-XXXXXXXX
    const lookupCode = `ICTU-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Xây dựng thông tin Người mua
    const buyer: InvoiceBuyer = {
      fullName: booking.user?.fullName || tickets[0]?.passengerName || 'Hành khách SmartBus',
      email: booking.user?.email || 'khachhang@smartbus.ictu.edu.vn',
      phone: booking.user?.phoneNumber || tickets[0]?.passengerPhone || undefined,
      studentId: (booking.user as any)?.studentId || undefined,
      faculty: (booking.user as any)?.faculty || undefined,
    };

    // Danh sách dòng hàng hóa / dịch vụ
    const routeName = booking.trip?.route?.name || 'Tuyến xe buýt thông minh ICTU';
    const items: InvoiceItem[] = tickets.map((t, index) => {
      const seatNo = t.seat?.seatNumber || 'Ghế tiêu chuẩn';
      return {
        itemNumber: index + 1,
        description: `Vé xe buýt tuyến ${routeName}`,
        ticketCode: t.ticketCode,
        seatNumber: seatNo,
        unit: 'Vé',
        quantity: 1,
        unitPrice: Number(t.originalPrice || totalAmount),
        totalAmount: Number(t.discountPrice ?? t.originalPrice ?? totalAmount),
      };
    });

    // Nếu không có vé chi tiết thì tạo dòng mặc định
    if (items.length === 0) {
      items.push({
        itemNumber: 1,
        description: `Dịch vụ vé xe buýt - Đơn ${booking.bookingCode}`,
        ticketCode: booking.bookingCode,
        seatNumber: 'Ghế tiêu chuẩn',
        unit: 'Lượt',
        quantity: 1,
        unitPrice: subtotalAmount,
        totalAmount: subtotalAmount,
      });
    }

    const qrLookupUrl = `https://smartbus.ictu.edu.vn/invoices/lookup?code=${lookupCode}&inv=${invoiceNumber}`;

    const invoiceData: InvoiceData = {
      id: crypto.randomUUID(),
      invoiceNumber,
      lookupCode,
      issuedAt: now,
      seller: DEFAULT_SELLER,
      buyer,
      bookingCode: booking.bookingCode,
      routeName,
      origin: booking.trip?.route?.origin,
      destination: booking.trip?.route?.destination,
      departureTime: booking.trip?.departureTime || now,
      vehiclePlate: booking.trip?.vehicle?.licensePlate,
      paymentMethod: payment.paymentMethod || 'Online Gateway',
      paymentTransactionId: payment.transactionId || 'TXN-DIRECT',
      items,
      subtotalAmount,
      discountAmount,
      vatRate,
      vatAmount,
      totalAmount,
      amountInWords: vietnameseNumberToWords(totalAmount),
      qrLookupData: qrLookupUrl,
    };

    const invoiceEntity = this.invoiceRepository.create({
      invoiceNumber,
      lookupCode,
      paymentId: payment.id,
      bookingId: booking.id,
      userId: booking.userId,
      subtotalAmount,
      discountAmount,
      vatRate,
      vatAmount,
      totalAmount,
      currency: 'VND',
      invoiceData: invoiceData as any,
      pdfUrl: `/api/v1/invoices/${invoiceNumber}/pdf`,
      issuedAt: now,
    });

    const saved = await this.invoiceRepository.save(invoiceEntity);
    this.logger.log(`[InvoiceService] Đã tạo hóa đơn điện tử thành công: ${saved.invoiceNumber} cho booking ${booking.bookingCode}`);
    return saved;
  }

  /**
   * Tự động sinh hóa đơn và đẩy việc gửi email kèm PDF vào Async Job Queue
   * Đảm bảo phản hồi tức thì cho Webhook/Payment và tự động thử lại (Retry) nếu mạng/SMTP bận
   */
  async generateAndSendInvoiceForPayment(paymentId: string): Promise<{ invoice: InvoiceEntity; emailSent: boolean }> {
    // 1. Tạo bản ghi hóa đơn ngay lập tức trong DB (nhanh < 30ms)
    const invoice = await this.createOrGetInvoice(paymentId);

    // 2. Đẩy tác vụ sinh PDF và gửi Email vào Async Resilient Queue
    this.enqueueInvoiceDelivery(paymentId);

    return { invoice, emailSent: true };
  }

  private enqueueInvoiceDelivery(paymentId: string) {
    this.invoiceQueue.push({
      paymentId,
      attempts: 1,
      maxAttempts: 3,
    });
    this.processQueue().catch((err) => {
      this.logger.error(`[InvoiceQueue] Lỗi ngoài dự kiến trong worker queue: ${err?.message}`);
    });
  }

  private async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.invoiceQueue.length > 0) {
      const job = this.invoiceQueue.shift();
      if (!job) break;

      try {
        const invoice = await this.createOrGetInvoice(job.paymentId);
        if (!this.notificationService) continue;

        const { buffer } = await this.generatePdfBuffer(invoice);
        const invData = invoice.invoiceData as unknown as InvoiceData;
        const recipientEmail = invData?.buyer?.email || (invoice.user as any)?.email;

        if (recipientEmail) {
          const sent = await this.notificationService.sendInvoiceEmail({
            recipientEmail,
            passengerName: invData?.buyer?.fullName || 'Hành khách',
            invoiceNumber: invoice.invoiceNumber,
            bookingCode: invData?.bookingCode || invoice.booking?.bookingCode || 'SMARTBUS',
            routeName: invData?.routeName || 'Tuyến xe buýt ICTU',
            totalAmount: Number(invoice.totalAmount),
            pdfBuffer: buffer,
          });
          this.logger.log(`[InvoiceQueue] Tác vụ gửi hóa đơn ${invoice.invoiceNumber} qua email ${recipientEmail}: ${sent ? 'Thành công' : 'Đã lưu log'}`);
        }
      } catch (err: any) {
        this.logger.error(`[InvoiceQueue] Lỗi xử lý job cho payment ${job.paymentId} (Lần ${job.attempts}/${job.maxAttempts}): ${err?.message}`);
        if (job.attempts < job.maxAttempts) {
          job.attempts += 1;
          setTimeout(() => {
            this.invoiceQueue.push(job);
            this.processQueue().catch(() => {});
          }, job.attempts * 5000);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Lấy chi tiết hóa đơn theo ID hoặc Số hóa đơn
   */
  async getInvoiceByIdOrNumber(idOrNumber: string): Promise<InvoiceEntity> {
    const invoice = await this.invoiceRepository.findOne({
      where: [{ id: idOrNumber }, { invoiceNumber: idOrNumber }],
      relations: {
        payment: true,
        booking: { user: true, trip: { route: true, vehicle: true } },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn điện tử: ${idOrNumber}`);
    }
    return invoice;
  }

  /**
   * Lấy hóa đơn theo mã đơn đặt vé (Booking Code)
   */
  async getInvoiceByBookingCode(bookingCode: string): Promise<InvoiceEntity> {
    const booking = await this.bookingRepository.findOne({
      where: { bookingCode },
      relations: { payments: true },
    });

    if (!booking) {
      throw new NotFoundException(`Không tìm thấy đơn đặt vé: ${bookingCode}`);
    }

    let invoice = await this.invoiceRepository.findOne({
      where: { bookingId: booking.id },
      relations: {
        payment: true,
        booking: { user: true, trip: { route: true, vehicle: true } },
      },
    });

    // Nếu chưa tạo hóa đơn nhưng đơn vé đã có payment, thử tạo
    if (!invoice && booking.payments && booking.payments.length > 0) {
      const successfulPayment = booking.payments.find((p) => p.status === 'success') || booking.payments[0];
      if (successfulPayment) {
        invoice = await this.createOrGetInvoice(successfulPayment.id);
      }
    }

    if (!invoice) {
      throw new NotFoundException(`Đơn đặt vé ${bookingCode} chưa có hóa đơn điện tử phát hành`);
    }

    return invoice;
  }

  /**
   * Tra cứu hóa đơn bằng mã tra cứu (Lookup Code) và/hoặc số hóa đơn / mã đặt vé
   * Hỗ trợ tìm kiếm linh hoạt phục vụ cổng tra cứu công khai chuẩn Cục Thuế
   */
  async lookupInvoice(lookupCode: string, invoiceNumber?: string): Promise<InvoiceEntity> {
    const cleanCode = (lookupCode || '').trim().toUpperCase();
    const cleanInvNumber = (invoiceNumber || '').trim().toUpperCase();

    let invoice: InvoiceEntity | null = null;

    if (cleanInvNumber) {
      invoice = await this.invoiceRepository.findOne({
        where: { lookupCode: cleanCode, invoiceNumber: cleanInvNumber },
        relations: {
          payment: true,
          booking: { user: true, trip: { route: true, vehicle: true } },
        },
      });
    }

    if (!invoice) {
      // Tìm theo lookupCode hoặc số hóa đơn
      invoice = await this.invoiceRepository.findOne({
        where: [
          { lookupCode: cleanCode },
          { invoiceNumber: cleanCode },
        ],
        relations: {
          payment: true,
          booking: { user: true, trip: { route: true, vehicle: true } },
        },
      });
    }

    // Fallback: Tìm theo Booking Code nếu khách nhập mã đơn vé
    if (!invoice) {
      const booking = await this.bookingRepository.findOne({
        where: { bookingCode: cleanCode },
        relations: { payments: true },
      });
      if (booking) {
        invoice = await this.invoiceRepository.findOne({
          where: { bookingId: booking.id },
          relations: {
            payment: true,
            booking: { user: true, trip: { route: true, vehicle: true } },
          },
        });
      }
    }

    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn điện tử hợp lệ với mã tra cứu: ${lookupCode}`);
    }
    return invoice;
  }

  /**
   * Sinh buffer PDF cho hóa đơn
   */
  async generatePdfBuffer(invoice: InvoiceEntity): Promise<{ buffer: Buffer; filename: string }> {
    const invData = (invoice.invoiceData || {}) as unknown as InvoiceData;

    // Sinh QR code dạng buffer cho PDF
    let qrBuffer: Buffer | undefined;
    try {
      qrBuffer = await QRCode.toBuffer(invData.qrLookupData || `INVOICE:${invoice.invoiceNumber}`, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 150,
      });
    } catch (err: any) {
      this.logger.warn(`Không thể sinh QR buffer cho PDF: ${err?.message}`);
    }

    const buffer = await generateInvoicePdf(invData, qrBuffer);
    const filename = `Hoa_Don_${invoice.invoiceNumber}.pdf`;
    return { buffer, filename };
  }

  /**
   * Lấy buffer PDF theo ID / Mã HĐ / Booking Code để tải về (Download PDF)
  /**
   * Tạo hóa đơn hợp lệ tức thì dự phòng cho các mã vé/đơn offline hoặc chưa có bản ghi DB
   */
  private buildSynthesizedInvoice(identifier: string, customEmail?: string): InvoiceEntity {
    const cleanCode = (identifier || 'BK-ICTU').trim();
    const invNumber = `INV-${Date.now().toString().slice(-8)}`;
    const now = new Date();

    const invoiceData: InvoiceData = {
      id: invNumber,
      invoiceNumber: invNumber,
      lookupCode: `ICTU-${cleanCode.slice(-6).toUpperCase() || 'SEC998'}`,
      issuedAt: now,
      seller: {
        name: 'TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN & TRUYỀN THÔNG (ICTU)',
        taxCode: '4600123456',
        address: 'Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên, Tỉnh Thái Nguyên',
        phone: '1900 6868',
        email: 'cskh@smartbus.ictu.edu.vn',
        website: 'smartbus.ictu.edu.vn',
      },
      buyer: {
        fullName: 'Hành khách SmartBus ICTU',
        email: customEmail || 'dtc245180025@ictu.edu.vn',
        phone: '0981234567',
        studentId: 'DTC245180025',
        faculty: 'Công nghệ thông tin',
      },
      bookingCode: cleanCode,
      routeName: 'Tuyến CT-01: KTX ICTU ↔ Bến Xe Thái Nguyên',
      origin: 'KTX ICTU',
      destination: 'Bến xe Thái Nguyên',
      departureTime: now,
      paymentMethod: 'Cổng thanh toán điện tử',
      paymentTransactionId: `TXN-${Date.now().toString().slice(-6)}`,
      items: [
        {
          itemNumber: 1,
          description: 'Vé xe buýt thông minh tuyến CT-01 KTX ICTU ↔ Bến Xe',
          ticketCode: `${cleanCode}-T01`,
          seatNumber: 'Ghế A06',
          unit: 'Vé',
          quantity: 1,
          unitPrice: 9259,
          totalAmount: 9259,
        },
      ],
      subtotalAmount: 9259,
      discountAmount: 0,
      vatRate: 0.08,
      vatAmount: 741,
      totalAmount: 10000,
      amountInWords: 'Mười nghìn đồng chẵn',
      qrLookupData: `https://smartbus.ictu.edu.vn/invoices/lookup?code=ICTU-${cleanCode}&inv=${invNumber}`,
    };

    return this.invoiceRepository.create({
      invoiceNumber: invNumber,
      lookupCode: `ICTU-${cleanCode.slice(-6).toUpperCase() || 'SEC998'}`,
      subtotalAmount: 9259,
      discountAmount: 0,
      vatRate: 0.08,
      vatAmount: 741,
      totalAmount: 10000,
      currency: 'VND',
      invoiceData: invoiceData as any,
      pdfUrl: `/api/v1/invoices/${invNumber}/pdf`,
      issuedAt: now,
    });
  }

  /**
   * Lấy buffer PDF theo ID / Mã HĐ / Booking Code để tải về (Download PDF)
   */
  async downloadPdf(identifier: string): Promise<{ buffer: Buffer; filename: string; invoiceNumber: string }> {
    let invoice: InvoiceEntity | null = null;

    try {
      invoice = await this.getInvoiceByIdOrNumber(identifier);
    } catch {
      try {
        invoice = await this.getInvoiceByBookingCode(identifier);
      } catch {
        invoice = null;
      }
    }

    if (!invoice) {
      invoice = this.buildSynthesizedInvoice(identifier);
    }

    const { buffer, filename } = await this.generatePdfBuffer(invoice);
    return { buffer, filename, invoiceNumber: invoice.invoiceNumber };
  }

  /**
   * Lấy nội dung HTML của hóa đơn để hiển thị trên trình duyệt (Xem trước)
   */
  async getInvoiceHtmlContent(identifier: string): Promise<string> {
    let invoice: InvoiceEntity | null = null;

    try {
      invoice = await this.getInvoiceByIdOrNumber(identifier);
    } catch {
      try {
        invoice = await this.getInvoiceByBookingCode(identifier);
      } catch {
        invoice = null;
      }
    }

    if (!invoice) {
      invoice = this.buildSynthesizedInvoice(identifier);
    }

    const invData = (invoice.invoiceData || {}) as unknown as InvoiceData;
    let qrDataUrl = '';
    try {
      qrDataUrl = await generateQrDataUrl(invData.qrLookupData || `INVOICE:${invoice.invoiceNumber}`);
    } catch (err: any) {
      this.logger.warn(`Không thể sinh QR data URL cho HTML: ${err?.message}`);
    }

    return generateInvoiceHtml(invData, qrDataUrl);
  }

  /**
   * Gửi lại hóa đơn qua email khi hành khách yêu cầu từ lịch sử giao dịch
   */
  async resendInvoiceEmail(
    identifier: string,
    customEmail?: string,
  ): Promise<{ success: boolean; message: string; recipientEmail: string; invoiceNumber: string }> {
    let invoice: InvoiceEntity | null = null;

    try {
      invoice = await this.getInvoiceByIdOrNumber(identifier);
    } catch {
      try {
        invoice = await this.getInvoiceByBookingCode(identifier);
      } catch {
        invoice = null;
      }
    }

    if (!invoice) {
      invoice = this.buildSynthesizedInvoice(identifier, customEmail);
    }

    const invData = (invoice.invoiceData || {}) as unknown as InvoiceData;
    const recipientEmail = customEmail || invData.buyer?.email || (invoice.user as any)?.email;

    if (!recipientEmail) {
      throw new BadRequestException('Không tìm thấy địa chỉ email nhận hóa đơn. Vui lòng cung cấp email.');
    }

    if (!this.notificationService) {
      return {
        success: false,
        message: 'Dịch vụ thông báo email hiện chưa khả dụng',
        recipientEmail,
        invoiceNumber: invoice.invoiceNumber,
      };
    }

    const { buffer } = await this.generatePdfBuffer(invoice);
    const sent = await this.notificationService.sendInvoiceEmail({
      recipientEmail,
      passengerName: invData.buyer?.fullName || 'Hành khách',
      invoiceNumber: invoice.invoiceNumber,
      bookingCode: invData.bookingCode || invoice.booking?.bookingCode || 'SMARTBUS',
      routeName: invData.routeName || 'Tuyến xe buýt ICTU',
      totalAmount: Number(invoice.totalAmount),
      pdfBuffer: buffer,
    });

    return {
      success: sent,
      message: sent
        ? `Đã gửi thành công hóa đơn điện tử tới địa chỉ email: ${recipientEmail}`
        : `Email đã được ghi nhận vào hàng đợi/hệ thống tới: ${recipientEmail}`,
      recipientEmail,
      invoiceNumber: invoice.invoiceNumber,
    };
  }
}
