import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InvoiceService } from '../../src/modules/invoice/invoice.service.js';
import { NotificationService } from '../../src/modules/notification/notification.service.js';
import { InvoiceEntity } from '../../src/database/entities/invoice.entity.js';
import { BookingEntity } from '../../src/database/entities/booking.entity.js';
import { PaymentEntity } from '../../src/database/entities/payment.entity.js';
import { TicketEntity } from '../../src/database/entities/ticket.entity.js';
import { vietnameseNumberToWords } from '../../src/modules/invoice/utils/vietnamese-number-to-words.util.js';
import { generateInvoicePdf } from '../../src/modules/invoice/utils/invoice-pdf.util.js';
import { generateInvoiceHtml } from '../../src/modules/invoice/utils/invoice-html.util.js';
import { InvoiceData } from '../../src/modules/invoice/invoice.types.js';

describe('Electronic Invoice & Email System - Unit Tests', () => {
  describe('vietnameseNumberToWords Util', () => {
    it('should convert 0 correctly', () => {
      expect(vietnameseNumberToWords(0)).toBe('Không đồng chẵn');
    });

    it('should convert 50,000 VND correctly', () => {
      expect(vietnameseNumberToWords(50000)).toContain('Năm mươi nghìn đồng');
    });

    it('should convert 108,000 VND correctly', () => {
      expect(vietnameseNumberToWords(108000)).toContain('Một trăm linh tám nghìn đồng');
    });

    it('should convert 1,250,000 VND correctly', () => {
      const words = vietnameseNumberToWords(1250000);
      expect(words).toContain('Một triệu');
      expect(words).toContain('đồng');
    });
  });

  describe('Invoice PDF & HTML Utilities', () => {
    const mockInvoiceData: InvoiceData = {
      id: 'inv-test-id-123',
      invoiceNumber: 'INV-20261001-9999',
      lookupCode: 'ICTU-ABCD1234',
      issuedAt: new Date('2026-10-01T08:00:00Z'),
      seller: {
        name: 'TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG (ICTU)',
        taxCode: '4600123456-001',
        address: 'Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên',
        phone: '1900 1234',
        email: 'smartbus@ictu.edu.vn',
        website: 'https://smartbus.ictu.edu.vn',
      },
      buyer: {
        fullName: 'Nguyễn Văn Test',
        email: 'student.test@ictu.edu.vn',
        phone: '0987654321',
        studentId: 'DTC215180001',
      },
      bookingCode: 'BKG-TEST-001',
      routeName: 'Tuyến số 01: TP. Thái Nguyên - Đại Từ',
      origin: 'Bến xe Thái Nguyên',
      destination: 'Bến xe Đại Từ',
      departureTime: new Date('2026-10-01T09:00:00Z'),
      vehiclePlate: '20B-123.45',
      paymentMethod: 'vnpay',
      paymentTransactionId: 'VNP-20261001-TXN123',
      items: [
        {
          itemNumber: 1,
          description: 'Vé xe buýt tuyến Tuyến số 01: TP. Thái Nguyên - Đại Từ',
          ticketCode: 'TCK-2026-0001',
          seatNumber: 'A01',
          unit: 'Vé',
          quantity: 1,
          unitPrice: 108000,
          totalAmount: 108000,
        },
      ],
      subtotalAmount: 100000,
      discountAmount: 0,
      vatRate: 0.08,
      vatAmount: 8000,
      totalAmount: 108000,
      amountInWords: 'Một trăm linh tám nghìn đồng',
      qrLookupData: 'https://smartbus.ictu.edu.vn/invoices/lookup?code=ICTU-ABCD1234',
    };

    it('should generate valid PDF buffer with %PDF header', async () => {
      const buffer = await generateInvoicePdf(mockInvoiceData);
      expect(buffer).toBeDefined();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);

      // PDF signature in header
      const header = buffer.subarray(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    });

    it('should generate valid HTML containing electronic invoice details and VAT 8%', () => {
      const html = generateInvoiceHtml(mockInvoiceData);
      expect(html).toContain('HÓA ĐƠN ĐIỆN TỬ');
      expect(html).toContain('INV-20261001-9999');
      expect(html).toContain('ICTU-ABCD1234');
      expect(html).toContain('Nguyễn Văn Test');
      expect(html).toContain('Tuyến số 01: TP. Thái Nguyên - Đại Từ');
      expect(html).toContain('8%');
      expect(html).toContain('Một trăm linh tám nghìn đồng');
    });
  });

  describe('InvoiceService', () => {
    let service: InvoiceService;
    let notificationService: NotificationService;
    let invoiceRepo: any;
    let bookingRepo: any;
    let paymentRepo: any;
    let ticketRepo: any;

    const mockPayment: any = {
      id: 'pay-uuid-1',
      transactionId: 'TXN-9999',
      paymentMethod: 'vnpay',
      amount: 108000,
      status: 'success',
      bookingId: 'booking-uuid-1',
      booking: {
        id: 'booking-uuid-1',
        bookingCode: 'BKG-2026-0001',
        finalAmount: 108000,
        discountAmount: 0,
        userId: 'user-uuid-1',
        user: {
          fullName: 'Trần Thị Mai',
          email: 'mai.tt@ictu.edu.vn',
          phoneNumber: '0912345678',
        },
        trip: {
          route: {
            name: 'Tuyến số 02: Gang Thép - Phổ Yên',
            origin: 'Gang Thép',
            destination: 'Phổ Yên',
          },
          vehicle: { licensePlate: '20B-999.88' },
          departureTime: new Date('2026-10-01T14:30:00Z'),
        },
      },
    };

    const mockTickets: any[] = [
      {
        id: 'ticket-uuid-1',
        ticketCode: 'TCK-2026-0099',
        seat: { seatNumber: 'B02' },
        passengerName: 'Trần Thị Mai',
        originalPrice: 108000,
      },
    ];

    beforeEach(async () => {
      invoiceRepo = {
        findOne: vi.fn(),
        create: vi.fn().mockImplementation((dto) => ({ id: 'inv-uuid-new', ...dto })),
        save: vi.fn().mockImplementation(async (inv) => inv),
      };

      bookingRepo = {
        findOne: vi.fn().mockResolvedValue(mockPayment.booking),
      };

      paymentRepo = {
        findOne: vi.fn().mockResolvedValue(mockPayment),
      };

      ticketRepo = {
        find: vi.fn().mockResolvedValue(mockTickets),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          InvoiceService,
          NotificationService,
          { provide: getRepositoryToken(InvoiceEntity), useValue: invoiceRepo },
          { provide: getRepositoryToken(BookingEntity), useValue: bookingRepo },
          { provide: getRepositoryToken(PaymentEntity), useValue: paymentRepo },
          { provide: getRepositoryToken(TicketEntity), useValue: ticketRepo },
        ],
      }).compile();

      service = module.get<InvoiceService>(InvoiceService);
      notificationService = module.get<NotificationService>(NotificationService);
    });

    it('should create an electronic invoice with accurate VAT 8% and invoice numbers', async () => {
      invoiceRepo.findOne.mockResolvedValueOnce(null);

      const invoice = await service.createOrGetInvoice('pay-uuid-1');

      expect(invoice).toBeDefined();
      expect(invoice.invoiceNumber).toMatch(/^INV-\d{8}-\d{4}$/);
      expect(invoice.lookupCode).toMatch(/^ICTU-[A-F0-9]{8}$/);
      expect(invoice.totalAmount).toBe(108000);
      expect(invoice.subtotalAmount).toBe(100000);
      expect(invoice.vatAmount).toBe(8000);
      expect(invoice.vatRate).toBe(0.08);
      expect(invoiceRepo.save).toHaveBeenCalled();
    });

    it('should return existing invoice without duplicate creation (idempotency)', async () => {
      const existingInvoice: any = {
        id: 'inv-existing-uuid',
        invoiceNumber: 'INV-20261001-1111',
        totalAmount: 108000,
      };
      invoiceRepo.findOne.mockResolvedValueOnce(existingInvoice);

      const invoice = await service.createOrGetInvoice('pay-uuid-1');

      expect(invoice.id).toBe('inv-existing-uuid');
      expect(invoiceRepo.create).not.toHaveBeenCalled();
    });

    it('should download PDF buffer successfully', async () => {
      const mockSavedInvoice: any = {
        id: 'inv-uuid-download',
        invoiceNumber: 'INV-20261001-5555',
        totalAmount: 108000,
        subtotalAmount: 100000,
        vatAmount: 8000,
        vatRate: 0.08,
        invoiceData: {
          invoiceNumber: 'INV-20261001-5555',
          lookupCode: 'ICTU-5555AAAA',
          issuedAt: new Date(),
          seller: {
            name: 'TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG (ICTU)',
            taxCode: '4600123456-001',
            address: 'Đường Z115, Thái Nguyên',
            phone: '1900 1234',
            email: 'smartbus@ictu.edu.vn',
            website: 'https://smartbus.ictu.edu.vn',
          },
          buyer: { fullName: 'Trần Thị Mai', email: 'mai.tt@ictu.edu.vn' },
          bookingCode: 'BKG-2026-0001',
          routeName: 'Tuyến số 02: Gang Thép - Phổ Yên',
          departureTime: new Date(),
          paymentMethod: 'vnpay',
          paymentTransactionId: 'TXN-9999',
          items: [],
          subtotalAmount: 100000,
          discountAmount: 0,
          vatRate: 0.08,
          vatAmount: 8000,
          totalAmount: 108000,
          amountInWords: 'Một trăm linh tám nghìn đồng',
        },
      };

      invoiceRepo.findOne.mockResolvedValueOnce(mockSavedInvoice);

      const result = await service.downloadPdf('inv-uuid-download');

      expect(result.buffer).toBeDefined();
      expect(result.buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
      expect(result.filename).toBe('Hoa_Don_INV-20261001-5555.pdf');
    });

    it('should resend invoice email to passenger from transaction history', async () => {
      const mockSavedInvoice: any = {
        id: 'inv-uuid-resend',
        invoiceNumber: 'INV-20261001-7777',
        totalAmount: 108000,
        invoiceData: {
          invoiceNumber: 'INV-20261001-7777',
          lookupCode: 'ICTU-7777BBBB',
          issuedAt: new Date(),
          seller: {
            name: 'TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG (ICTU)',
            taxCode: '4600123456-001',
            address: 'Đường Z115, Thái Nguyên',
            phone: '1900 1234',
            email: 'smartbus@ictu.edu.vn',
            website: 'https://smartbus.ictu.edu.vn',
          },
          buyer: { fullName: 'Trần Thị Mai', email: 'mai.tt@ictu.edu.vn' },
          bookingCode: 'BKG-2026-0001',
          routeName: 'Tuyến số 02: Gang Thép - Phổ Yên',
          departureTime: new Date(),
          items: [],
          totalAmount: 108000,
          subtotalAmount: 100000,
          vatRate: 0.08,
          vatAmount: 8000,
          amountInWords: 'Một trăm linh tám nghìn đồng',
        },
      };

      invoiceRepo.findOne.mockResolvedValueOnce(mockSavedInvoice);

      const resendRes = await service.resendInvoiceEmail('inv-uuid-resend');

      expect(resendRes.success).toBe(true);
      expect(resendRes.recipientEmail).toBe('mai.tt@ictu.edu.vn');
      expect(resendRes.invoiceNumber).toBe('INV-20261001-7777');

      // Verify email was registered in notification history
      const history = notificationService.getSentNotifications({ recipientEmail: 'mai.tt@ictu.edu.vn' });
      expect(history.length).toBeGreaterThan(0);
    });
  });
});
