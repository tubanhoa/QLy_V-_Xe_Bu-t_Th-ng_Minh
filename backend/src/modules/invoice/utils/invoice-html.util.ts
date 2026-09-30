import { InvoiceData } from '../invoice.types.js';

export function generateInvoiceHtml(invoice: InvoiceData, qrDataUrl?: string): string {
  const issuedDate = new Date(invoice.issuedAt);
  const day = String(issuedDate.getDate()).padStart(2, '0');
  const month = String(issuedDate.getMonth() + 1).padStart(2, '0');
  const year = issuedDate.getFullYear();

  const formattedSubtotal = Number(invoice.subtotalAmount).toLocaleString('vi-VN');
  const formattedVat = Number(invoice.vatAmount).toLocaleString('vi-VN');
  const formattedDiscount = Number(invoice.discountAmount).toLocaleString('vi-VN');
  const formattedTotal = Number(invoice.totalAmount).toLocaleString('vi-VN');

  const itemsRows = invoice.items
    .map(
      (item) => `
      <tr>
        <td style="text-align: center; padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">${item.itemNumber}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">
          <strong>${item.description}</strong><br/>
          <span style="font-size: 12px; color: #64748b;">Mã vé: <code>${item.ticketCode}</code> | Số ghế: <strong>${item.seatNumber}</strong></span>
        </td>
        <td style="text-align: center; padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">${item.unit}</td>
        <td style="text-align: center; padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">${item.quantity}</td>
        <td style="text-align: right; padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">${Number(item.unitPrice).toLocaleString('vi-VN')} đ</td>
        <td style="text-align: right; padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${Number(item.totalAmount).toLocaleString('vi-VN')} đ</td>
      </tr>
    `,
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hóa Đơn Điện Tử - ${invoice.invoiceNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
    
    * { box-sizing: border-box; }
    body {
      font-family: 'Roboto', 'Segoe UI', Tahoma, sans-serif;
      margin: 0;
      padding: 24px;
      background-color: #f1f5f9;
      color: #1e293b;
      font-size: 14px;
      line-height: 1.5;
    }
    .invoice-wrapper {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 36px 40px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      position: relative;
    }
    .no-print-bar {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-bottom: 20px;
    }
    .btn {
      padding: 8px 18px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid transparent;
      transition: all 0.2s;
    }
    .btn-primary {
      background-color: #0284c7;
      color: #ffffff;
    }
    .btn-primary:hover { background-color: #0369a1; }
    .btn-outline {
      background-color: #ffffff;
      color: #475569;
      border-color: #cbd5e1;
    }
    .btn-outline:hover { background-color: #f8fafc; }

    .header-top {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .seller-brand h2 {
      margin: 0 0 6px 0;
      color: #0369a1;
      font-size: 20px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .seller-info {
      font-size: 12px;
      color: #475569;
      line-height: 1.6;
    }
    .invoice-meta {
      text-align: right;
    }
    .invoice-meta h1 {
      margin: 0 0 4px 0;
      color: #0f172a;
      font-size: 22px;
      text-transform: uppercase;
    }
    .invoice-meta .subtitle {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .meta-tag {
      display: inline-block;
      background: #f0fdf4;
      color: #166534;
      border: 1px solid #bbf7d0;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .meta-detail {
      font-size: 12px;
      color: #334155;
    }

    .buyer-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .buyer-title {
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 8px;
      font-size: 13px;
      text-transform: uppercase;
    }
    .buyer-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px 16px;
      font-size: 13px;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .items-table th {
      background-color: #f1f5f9;
      color: #475569;
      font-weight: 600;
      padding: 10px 8px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
    }

    .summary-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 24px;
    }
    .summary-table {
      width: 340px;
      font-size: 13px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
    }
    .summary-row.total {
      border-top: 2px solid #0284c7;
      margin-top: 6px;
      padding-top: 10px;
      font-size: 16px;
      font-weight: 700;
      color: #0284c7;
    }

    .in-words-box {
      background: #eff6ff;
      border: 1px dashed #bfdbfe;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 28px;
      font-size: 13px;
    }

    .signatures-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
    }
    .signature-box {
      width: 45%;
      text-align: center;
    }
    .signature-title {
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .signature-sub {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 12px;
    }
    .digital-seal {
      display: inline-block;
      border: 2px solid #16a34a;
      border-radius: 8px;
      padding: 10px 14px;
      background: #f0fdf4;
      color: #166534;
      text-align: left;
      font-size: 11px;
      line-height: 1.4;
      margin-top: 8px;
    }

    .lookup-qr-box {
      text-align: center;
      padding: 8px;
    }
    .lookup-qr-box img {
      width: 90px;
      height: 90px;
    }

    .footer-note {
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      margin-top: 28px;
      border-top: 1px solid #f1f5f9;
      padding-top: 12px;
    }

    @media print {
      body { background-color: #ffffff; padding: 0; }
      .invoice-wrapper { box-shadow: none; padding: 0; max-width: 100%; }
      .no-print-bar { display: none; }
    }
  </style>
</head>
<body>

  <div class="invoice-wrapper">
    <div class="no-print-bar">
      <button class="btn btn-outline" onclick="window.print()">🖨️ In Hóa Đơn</button>
      <a class="btn btn-primary" href="/api/v1/invoices/${invoice.id}/pdf">⬇️ Tải Bản PDF</a>
    </div>

    <div class="header-top">
      <div class="seller-brand">
        <h2>${invoice.seller.name}</h2>
        <div class="seller-info">
          <div><strong>Mã số thuế:</strong> ${invoice.seller.taxCode}</div>
          <div><strong>Địa chỉ:</strong> ${invoice.seller.address}</div>
          <div><strong>Hotline:</strong> ${invoice.seller.phone} | <strong>Email:</strong> ${invoice.seller.email}</div>
          <div><strong>Website:</strong> ${invoice.seller.website}</div>
        </div>
      </div>
      <div class="invoice-meta">
        <h1>HÓA ĐƠN ĐIỆN TỬ</h1>
        <div class="subtitle">(Dịch vụ vé xe buýt thông minh)</div>
        <div class="meta-tag">ĐÃ THANH TOÁN</div>
        <div class="meta-detail"><strong>Ký hiệu:</strong> 1C26TNB</div>
        <div class="meta-detail"><strong>Số HĐ:</strong> <span style="color: #0284c7; font-weight: bold;">${invoice.invoiceNumber}</span></div>
        <div class="meta-detail"><strong>Mã tra cứu:</strong> <code>${invoice.lookupCode}</code></div>
        <div class="meta-detail"><strong>Ngày lập:</strong> Ngày ${day} tháng ${month} năm ${year}</div>
      </div>
    </div>

    <div class="buyer-box">
      <div class="buyer-title">Thông tin khách hàng (Người mua)</div>
      <div class="buyer-grid">
        <div><strong>Họ và tên:</strong> ${invoice.buyer.fullName}</div>
        <div><strong>Email:</strong> ${invoice.buyer.email}</div>
        <div><strong>Số điện thoại:</strong> ${invoice.buyer.phone || 'Chưa cung cấp'}</div>
        <div><strong>Mã HSSV / Khoa:</strong> ${invoice.buyer.studentId ? `${invoice.buyer.studentId} (${invoice.buyer.faculty || 'ICTU'})` : 'Hành khách vãng lai'}</div>
        <div><strong>Mã đơn đặt vé:</strong> <code>${invoice.bookingCode}</code></div>
        <div><strong>Hình thức thanh toán:</strong> ${invoice.paymentMethod}</div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 50px; text-align: center;">STT</th>
          <th>Tên dịch vụ / Lộ trình xe buýt</th>
          <th style="width: 70px; text-align: center;">ĐVT</th>
          <th style="width: 70px; text-align: center;">Số lượng</th>
          <th style="width: 120px; text-align: right;">Đơn giá</th>
          <th style="width: 120px; text-align: right;">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div class="summary-section">
      <div class="summary-table">
        <div class="summary-row">
          <span style="color: #64748b;">Tổng tiền dịch vụ:</span>
          <span>${formattedSubtotal} đ</span>
        </div>
        ${
          invoice.discountAmount > 0
            ? `
        <div class="summary-row" style="color: #16a34a;">
          <span>Giảm giá / Ưu đãi Voucher:</span>
          <span>-${formattedDiscount} đ</span>
        </div>`
            : ''
        }
        <div class="summary-row">
          <span style="color: #64748b;">Thuế suất GTGT (${invoice.vatRate * 100}%):</span>
          <span>${formattedVat} đ</span>
        </div>
        <div class="summary-row total">
          <span>Tổng cộng thanh toán:</span>
          <span>${formattedTotal} đ</span>
        </div>
      </div>
    </div>

    <div class="in-words-box">
      <strong>Số tiền viết bằng chữ:</strong> <em>${invoice.amountInWords}</em>
    </div>

    <div class="signatures-section">
      <div class="signature-box">
        <div class="signature-title">NGƯỜI MUA HÀNG</div>
        <div class="signature-sub">(Ký, ghi rõ họ tên nếu có nhu cầu)</div>
        <div style="font-size: 12px; color: #64748b; padding-top: 30px;">
          Xác nhận điện tử qua tài khoản: ${invoice.buyer.email}
        </div>
      </div>

      <div class="lookup-qr-box">
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Tra cứu hóa đơn" />` : ''}
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Mã QR tra cứu</div>
      </div>

      <div class="signature-box">
        <div class="signature-title">ĐƠN VỊ CUNG CẤP DỊCH VỤ</div>
        <div class="signature-sub">(Ký số điện tử)</div>
        <div class="digital-seal">
          <div>✓ <strong>KÝ BỞI:</strong> ${invoice.seller.name}</div>
          <div>✓ <strong>NGÀY KÝ:</strong> ${day}/${month}/${year}</div>
          <div>✓ <strong>TÌNH TRẠNG:</strong> HÓA ĐƠN HỢP LỆ THEO NĐ 123/2020/NĐ-CP</div>
        </div>
      </div>
    </div>

    <div class="footer-note">
      Hóa đơn điện tử được khởi tạo và lưu trữ trên hệ thống máy chủ SmartBus ICTU.<br/>
      Quý khách có thể tra cứu hóa đơn trực tuyến với Mã tra cứu: <strong>${invoice.lookupCode}</strong> tại https://smartbus.ictu.vn/tra-cuu-hoa-don
    </div>
  </div>

</body>
</html>
  `;
}
