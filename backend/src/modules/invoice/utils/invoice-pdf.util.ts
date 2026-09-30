import PDFDocument from 'pdfkit';
import fs from 'fs';
import { InvoiceData } from '../invoice.types.js';

function removeVietnameseDiacritics(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function getUnicodeFontPath(): string | null {
  const candidatePaths = [
    'C:\\Windows\\Fonts\\arial.ttf',
    'C:\\Windows\\Fonts\\tahoma.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

export async function generateInvoicePdf(invoice: InvoiceData, qrBuffer?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: `Hoa Don Dien Tu - ${invoice.invoiceNumber}`,
        Author: 'He Thong Quan Ly Ve Xe Buyt Thong Minh ICTU',
        Subject: 'Hoa Don Dien Tu Dich Vu Van Tai Hanh Khach',
        Keywords: 'e-invoice, smartbus, ictu, ve xe buyt',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    const fontPath = getUnicodeFontPath();
    const hasUnicodeFont = Boolean(fontPath);

    if (fontPath) {
      try {
        doc.font(fontPath);
      } catch {
        doc.font('Helvetica');
      }
    } else {
      doc.font('Helvetica');
    }

    const t = (text: string) => (hasUnicodeFont ? text : removeVietnameseDiacritics(text));

    const issuedDate = new Date(invoice.issuedAt);
    const day = String(issuedDate.getDate()).padStart(2, '0');
    const month = String(issuedDate.getMonth() + 1).padStart(2, '0');
    const year = issuedDate.getFullYear();

    // 1. Header (Seller & Title)
    doc.fontSize(14).fillColor('#0284c7').text(t(invoice.seller.name.toUpperCase()), 40, 40);
    doc.fontSize(9).fillColor('#475569');
    doc.text(`${t('Mã số thuế:')} ${invoice.seller.taxCode}`, 40, 58);
    doc.text(`${t('Địa chỉ:')} ${t(invoice.seller.address)}`, 40, 70, { width: 300 });
    doc.text(`${t('Hotline:')} ${invoice.seller.phone}  |  Email: ${invoice.seller.email}`, 40, 92);

    // Invoice Meta Right Box
    doc.fontSize(16).fillColor('#0f172a').text(t('HÓA ĐƠN ĐIỆN TỬ'), 340, 40, { align: 'right' });
    doc.fontSize(9).fillColor('#64748b').text(t('(Vé vận tải hành khách xe buýt)'), 340, 58, { align: 'right' });
    doc.fillColor('#16a34a').text(t('TRẠNG THÁI: ĐÃ THANH TOÁN'), 340, 70, { align: 'right' });
    doc.fillColor('#334155');
    doc.text(`${t('Số HĐ:')} ${invoice.invoiceNumber}`, 340, 82, { align: 'right' });
    doc.text(`${t('Mã tra cứu:')} ${invoice.lookupCode}`, 340, 94, { align: 'right' });
    doc.text(`${t('Ngày lập:')} ${day}/${month}/${year}`, 340, 106, { align: 'right' });

    // Decorative line
    doc.moveTo(40, 122).lineTo(555, 122).lineWidth(1.5).strokeColor('#0284c7').stroke();

    // 2. Buyer Info Box
    doc.rect(40, 130, 515, 68).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fontSize(10).fillColor('#0369a1').text(t('THÔNG TIN KHÁCH HÀNG (NGƯỜI MUA)'), 50, 138);

    doc.fontSize(9).fillColor('#1e293b');
    doc.text(`${t('Họ và tên:')} ${t(invoice.buyer.fullName)}`, 50, 154);
    doc.text(`Email: ${invoice.buyer.email}`, 50, 168);
    doc.text(`${t('Điện thoại:')} ${invoice.buyer.phone || t('Chưa cung cấp')}`, 50, 182);

    doc.text(`${t('Mã đơn đặt vé:')} ${invoice.bookingCode}`, 300, 154);
    doc.text(`${t('Đối tượng:')} ${invoice.buyer.studentId ? `${invoice.buyer.studentId} (${t(invoice.buyer.faculty || 'ICTU')})` : t('Hành khách vãng lai')}`, 300, 168);
    doc.text(`${t('Thanh toán:')} ${invoice.paymentMethod}`, 300, 182);

    // 3. Table Header
    let y = 210;
    doc.rect(40, y, 515, 22).fillAndStroke('#f1f5f9', '#cbd5e1');
    doc.fontSize(9).fillColor('#475569');
    doc.text(t('STT'), 45, y + 6, { width: 30, align: 'center' });
    doc.text(t('Dịch vụ / Tuyến xe'), 80, y + 6, { width: 230 });
    doc.text(t('ĐVT'), 315, y + 6, { width: 35, align: 'center' });
    doc.text(t('SL'), 355, y + 6, { width: 35, align: 'center' });
    doc.text(t('Đơn giá (VND)'), 395, y + 6, { width: 75, align: 'right' });
    doc.text(t('Thành tiền (VND)'), 475, y + 6, { width: 75, align: 'right' });

    y += 22;

    // Table rows
    invoice.items.forEach((item) => {
      doc.rect(40, y, 515, 30).strokeColor('#e2e8f0').stroke();
      doc.fontSize(9).fillColor('#0f172a');
      doc.text(String(item.itemNumber), 45, y + 8, { width: 30, align: 'center' });
      doc.text(t(item.description), 80, y + 4, { width: 230 });
      doc.fontSize(8).fillColor('#64748b').text(`${t('Vé:')} ${item.ticketCode} | ${t('Ghế:')} ${item.seatNumber}`, 80, y + 16, { width: 230 });
      doc.fontSize(9).fillColor('#0f172a');
      doc.text(t(item.unit), 315, y + 8, { width: 35, align: 'center' });
      doc.text(String(item.quantity), 355, y + 8, { width: 35, align: 'center' });
      doc.text(Number(item.unitPrice).toLocaleString('vi-VN'), 395, y + 8, { width: 75, align: 'right' });
      doc.text(Number(item.totalAmount).toLocaleString('vi-VN'), 475, y + 8, { width: 75, align: 'right' });
      y += 30;
    });

    // 4. Financial Summary
    y += 10;
    const summaryRightX = 360;
    doc.fontSize(9).fillColor('#475569');
    doc.text(`${t('Tổng tiền cước trước thuế:')}`, summaryRightX, y);
    doc.fillColor('#0f172a').text(`${Number(invoice.subtotalAmount).toLocaleString('vi-VN')} VND`, 470, y, { width: 85, align: 'right' });

    if (invoice.discountAmount > 0) {
      y += 14;
      doc.fillColor('#16a34a').text(`${t('Giảm giá ưu đãi (Voucher):')}`, summaryRightX, y);
      doc.text(`-${Number(invoice.discountAmount).toLocaleString('vi-VN')} VND`, 470, y, { width: 85, align: 'right' });
    }

    y += 14;
    doc.fillColor('#475569').text(`${t(`Thuế suất GTGT (${invoice.vatRate * 100}%):`)}`, summaryRightX, y);
    doc.fillColor('#0f172a').text(`${Number(invoice.vatAmount).toLocaleString('vi-VN')} VND`, 470, y, { width: 85, align: 'right' });

    y += 16;
    doc.moveTo(summaryRightX, y).lineTo(555, y).lineWidth(1).strokeColor('#0284c7').stroke();
    y += 6;
    doc.fontSize(11).fillColor('#0284c7').text(t('TỔNG CỘNG THANH TOÁN:'), summaryRightX - 30, y);
    doc.fontSize(11).text(`${Number(invoice.totalAmount).toLocaleString('vi-VN')} VND`, 450, y, { width: 105, align: 'right' });

    // Amount in words box
    y += 24;
    doc.rect(40, y, 515, 24).fillAndStroke('#eff6ff', '#bfdbfe');
    doc.fontSize(9).fillColor('#1e40af');
    doc.text(`${t('Số tiền viết bằng chữ:')} ${t(invoice.amountInWords)}`, 48, y + 7, { width: 500 });

    // 5. Signatures and Stamp Section
    y += 36;
    doc.fontSize(9).fillColor('#0f172a');
    doc.text(t('NGƯỜI MUA HÀNG'), 70, y, { align: 'center', width: 140 });
    doc.fontSize(8).fillColor('#64748b').text(t('(Ký, xác nhận điện tử)'), 70, y + 12, { align: 'center', width: 140 });

    doc.fontSize(9).fillColor('#0f172a');
    doc.text(t('ĐƠN VỊ BÁN HÀNG'), 370, y, { align: 'center', width: 160 });
    doc.fontSize(8).fillColor('#64748b').text(t('(Ký số điện tử tự động)'), 370, y + 12, { align: 'center', width: 160 });

    // Digital signature badge
    const sealY = y + 28;
    doc.rect(370, sealY, 160, 48).fillAndStroke('#f0fdf4', '#22c55e');
    doc.fontSize(8).fillColor('#15803d');
    doc.text(`[✓] ${t('KÝ SỐ BỞI:')}`, 376, sealY + 6);
    doc.text(t(invoice.seller.name), 376, sealY + 16, { width: 150 });
    doc.text(`${t('NGÀY KÝ:')} ${day}/${month}/${year}`, 376, sealY + 34);

    // QR Code for Invoice Lookup if provided
    if (qrBuffer) {
      try {
        doc.image(qrBuffer, 245, y + 10, { width: 65, height: 65 });
        doc.fontSize(7).fillColor('#64748b').text(t('Mã tra cứu HĐ'), 235, y + 78, { width: 85, align: 'center' });
      } catch {
        // Ignore QR embed failure if buffer is invalid
      }
    }

    // 6. Footer Legal Note
    doc.fontSize(7.5).fillColor('#94a3b8');
    doc.text(
      t('Hóa đơn điện tử được khởi tạo và lưu trữ theo Nghị định 123/2020/NĐ-CP và Thông tư 78/2021/TT-BTC trên hệ thống SmartBus ICTU.'),
      40,
      760,
      { align: 'center', width: 515 },
    );

    doc.end();
  });
}
