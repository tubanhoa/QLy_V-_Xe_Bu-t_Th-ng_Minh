import PDFDocument from 'pdfkit';
import fs from 'fs';

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

/**
 * Xây dựng tài liệu PDF Báo cáo Doanh thu & Hiệu quả tài chính trình Ban Giám Đốc
 */
export function buildRevenuePdfDocument(data: any, query: any): typeof PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape', // 841.89 x 595.28 points
    margin: 36,
    bufferPages: true,
    info: {
      Title: 'Bao Cao Doanh Thu & Hieu Qua Tai Chinh - ICTU Smart Bus',
      Author: 'Ban Dieu Hanh Smart Bus ICTU',
      Subject: 'Bao Cao Trinh Ban Giam Doc',
    },
  });

  const fontPath = getUnicodeFontPath();
  const hasUnicode = Boolean(fontPath);
  if (fontPath) {
    try {
      doc.font(fontPath);
    } catch {
      doc.font('Helvetica');
    }
  } else {
    doc.font('Helvetica');
  }

  const t = (text: string) => (hasUnicode ? text : removeVietnameseDiacritics(text));

  const startDateStr = query?.startDate || 'Tu dau ky';
  const endDateStr = query?.endDate || 'Den hien tai';
  const exportTimeStr = new Date().toLocaleString('vi-VN');

  // --- HEADER THƯƠNG HIỆU & TIÊU ĐỀ ---
  // Vẽ huy hiệu logo ICTU
  doc.save();
  doc.rect(36, 32, 28, 28).fillAndStroke('#059669', '#047857');
  doc.fillColor('#FFFFFF').fontSize(14).font(fontPath || 'Helvetica-Bold').text('SB', 41, 38);
  doc.restore();

  doc.fillColor('#059669').fontSize(11).font(fontPath || 'Helvetica-Bold').text(t('HỆ THỐNG QUẢN LÝ VÉ XE BUÝT THÔNG MINH ICTU'), 72, 32);
  doc.fillColor('#0F172A').fontSize(17).font(fontPath || 'Helvetica-Bold').text(t('BÁO CÁO DOANH THU & HIỆU QUẢ TÀI CHÍNH'), 72, 46);
  doc.fillColor('#64748B').fontSize(9).font(fontPath || 'Helvetica').text(
    t(`Kỳ thống kê: ${startDateStr} đến ${endDateStr}  |  Ngày lập báo cáo: ${exportTimeStr}  |  Đơn vị: VNĐ`),
    72,
    67,
  );

  // Đường kẻ phân cách
  doc.moveTo(36, 82).lineTo(805, 82).strokeColor('#CBD5E1').lineWidth(1).stroke();

  // --- KHỐI KPIS NỔI BẬT (4 CARDS) ---
  const totalRev = Number(data?.totalRevenue) || 0;
  const totalTickets = Number(data?.totalTickets) || 0;
  const avgPerTicket = totalTickets > 0 ? Math.round(totalRev / totalTickets) : 0;
  const totalTrips = data?.trips?.length || 0;

  const cardWidth = 180;
  const cardHeight = 48;
  const cardY = 90;
  const cards = [
    { label: t('TỔNG DOANH THU'), value: `${totalRev.toLocaleString('vi-VN')} đ`, color: '#059669' },
    { label: t('TỔNG VÉ ĐÃ BÁN'), value: `${totalTickets.toLocaleString('vi-VN')} vé`, color: '#0284C7' },
    { label: t('DOANH THU BÌNH QUÂN/VÉ'), value: `${avgPerTicket.toLocaleString('vi-VN')} đ`, color: '#D97706' },
    { label: t('TỔNG SỐ CA CHẠY'), value: `${totalTrips} chuyến`, color: '#6366F1' },
  ];

  cards.forEach((card, i) => {
    const x = 36 + i * (cardWidth + 12);
    doc.save();
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 6).fillAndStroke('#F8FAFC', '#E2E8F0');
    doc.fillColor('#64748B').fontSize(8).font(fontPath || 'Helvetica-Bold').text(card.label, x + 10, cardY + 8);
    doc.fillColor(card.color).fontSize(13).font(fontPath || 'Helvetica-Bold').text(card.value, x + 10, cardY + 22);
    doc.restore();
  });

  // --- BẢNG KÊ CHI TIẾT CHUYẾN XE ---
  let tableY = 150;
  doc.fillColor('#0F172A').fontSize(11).font(fontPath || 'Helvetica-Bold').text(t('BẢNG KÊ CHI TIẾT DOANH THU TỪNG CHUYẾN XE'), 36, tableY);
  tableY += 16;

  // Header Table
  const cols = [
    { header: t('STT'), x: 36, width: 35, align: 'center' },
    { header: t('MÃ CHUYẾN'), x: 71, width: 140, align: 'left' },
    { header: t('TUYẾN XE'), x: 211, width: 140, align: 'left' },
    { header: t('BIỂN SỐ'), x: 351, width: 75, align: 'center' },
    { header: t('GIỜ XUẤT BẾN'), x: 426, width: 110, align: 'center' },
    { header: t('VÉ BÁN'), x: 536, width: 65, align: 'right' },
    { header: t('DOANH THU (VNĐ)'), x: 601, width: 110, align: 'right' },
    { header: t('LẤP ĐẦY (%)'), x: 711, width: 94, align: 'right' },
  ];

  const drawTableHeader = (y: number) => {
    doc.save();
    doc.rect(36, y, 769, 22).fill('#059669');
    doc.fillColor('#FFFFFF').fontSize(8.5).font(fontPath || 'Helvetica-Bold');
    cols.forEach((col) => {
      doc.text(col.header, col.x + 4, y + 6, {
        width: col.width - 8,
        align: col.align as any,
      });
    });
    doc.restore();
  };

  drawTableHeader(tableY);
  tableY += 22;

  const trips = data?.trips || [];
  if (trips.length === 0) {
    // Không có dữ liệu
    doc.save();
    doc.rect(36, tableY, 769, 36).fillAndStroke('#FEF3C7', '#FDE68A');
    doc.fillColor('#B45309').fontSize(10).font(fontPath || 'Helvetica').text(
      t('Không có phát sinh chuyến xe hoặc doanh thu trong kỳ báo cáo đã chọn.'),
      46,
      tableY + 12,
      { align: 'center', width: 749 },
    );
    doc.restore();
    tableY += 46;
  } else {
    trips.forEach((tr: any, idx: number) => {
      // Sang trang nếu quá dòng
      if (tableY > 500) {
        doc.addPage();
        tableY = 40;
        drawTableHeader(tableY);
        tableY += 22;
      }

      const isZebra = idx % 2 === 1;
      if (isZebra) {
        doc.save();
        doc.rect(36, tableY, 769, 18).fill('#F8FAFC');
        doc.restore();
      }

      // Kẻ viền chân dòng
      doc.moveTo(36, tableY + 18).lineTo(805, tableY + 18).strokeColor('#F1F5F9').lineWidth(0.5).stroke();

      const depDate = tr.departureTime ? new Date(tr.departureTime).toLocaleString('vi-VN') : 'N/A';
      const cap = Number(tr.seatCapacity) || 28;
      const tks = Number(tr.ticketCount) || 0;
      const rev = Number(tr.revenue) || 0;
      const occ = tr.occupancyRate != null ? tr.occupancyRate : Math.round((tks / cap) * 100);

      doc.fillColor('#334155').fontSize(8).font(fontPath || 'Helvetica');
      doc.text(String(idx + 1), cols[0].x + 4, tableY + 5, { width: cols[0].width - 8, align: 'center' });
      doc.text(t(tr.tripId?.slice(0, 18) || `TRIP-${idx + 1}`), cols[1].x + 4, tableY + 5, { width: cols[1].width - 8, align: 'left' });
      doc.text(t(tr.routeCode || tr.routeName || 'Tuyen'), cols[2].x + 4, tableY + 5, { width: cols[2].width - 8, align: 'left' });
      doc.text(t(tr.vehiclePlate || 'Chua gan'), cols[3].x + 4, tableY + 5, { width: cols[3].width - 8, align: 'center' });
      doc.text(depDate, cols[4].x + 4, tableY + 5, { width: cols[4].width - 8, align: 'center' });
      doc.text(`${tks}`, cols[5].x + 4, tableY + 5, { width: cols[5].width - 8, align: 'right' });
      doc.text(`${rev.toLocaleString('vi-VN')} đ`, cols[6].x + 4, tableY + 5, { width: cols[6].width - 8, align: 'right' });
      doc.text(`${occ}%`, cols[7].x + 4, tableY + 5, { width: cols[7].width - 8, align: 'right' });

      tableY += 18;
    });
  }

  // Khối chữ ký ở cuối tài liệu
  if (tableY > 440) {
    doc.addPage();
    tableY = 40;
  } else {
    tableY += 20;
  }

  const sigY = tableY + 10;
  doc.fillColor('#0F172A').fontSize(9).font(fontPath || 'Helvetica-Bold');
  doc.text(t('NGƯỜI LẬP BIỂU'), 100, sigY, { width: 200, align: 'center' });
  doc.text(t('BAN GIÁM ĐỐC PHÊ DUYỆT'), 540, sigY, { width: 200, align: 'center' });

  doc.fillColor('#64748B').fontSize(8).font(fontPath || 'Helvetica');
  doc.text(t('(Ký, ghi rõ họ tên)'), 100, sigY + 12, { width: 200, align: 'center' });
  doc.text(t('(Ký, đóng dấu xác nhận)'), 540, sigY + 12, { width: 200, align: 'center' });

  // ĐÁNH SỐ TRANG TỰ ĐỘNG TRÊN TẤT CẢ CÁC TRANG (Trang X / Y)
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.moveTo(36, 565).lineTo(805, 565).strokeColor('#CBD5E1').lineWidth(0.5).stroke();
    doc.fillColor('#94A3B8').fontSize(7.5).font(fontPath || 'Helvetica').text(
      t(`Smart Bus Ticketing System - ICTU  |  Tài liệu bảo mật nội bộ trình Ban Giám Đốc`),
      36,
      572,
      { align: 'left', width: 400 },
    );
    doc.fillColor('#94A3B8').fontSize(7.5).font(fontPath || 'Helvetica').text(
      t(`Trang ${i + 1} / ${range.count}`),
      405,
      572,
      { align: 'right', width: 400 },
    );
  }

  return doc;
}

/**
 * Xây dựng tài liệu PDF Báo cáo Tỷ lệ lấp đầy & Tối ưu quy mô xe
 */
export function buildOccupancyPdfDocument(data: any, query: any): typeof PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 36,
    bufferPages: true,
    info: {
      Title: 'Bao Cao Ty Le Lap Day & Toi Uu Quy Mo Xe - ICTU Smart Bus',
      Author: 'Ban Dieu Hanh Smart Bus ICTU',
      Subject: 'Bao Cao Trinh Ban Giam Doc',
    },
  });

  const fontPath = getUnicodeFontPath();
  const hasUnicode = Boolean(fontPath);
  if (fontPath) {
    try {
      doc.font(fontPath);
    } catch {
      doc.font('Helvetica');
    }
  } else {
    doc.font('Helvetica');
  }

  const t = (text: string) => (hasUnicode ? text : removeVietnameseDiacritics(text));

  const startDateStr = query?.startDate || query?.date || 'Tu dau ky';
  const endDateStr = query?.endDate || query?.date || 'Den hien tai';
  const exportTimeStr = new Date().toLocaleString('vi-VN');

  // Header thương hiệu
  doc.save();
  doc.rect(36, 32, 28, 28).fillAndStroke('#0284C7', '#0369A1');
  doc.fillColor('#FFFFFF').fontSize(14).font(fontPath || 'Helvetica-Bold').text('OP', 41, 38);
  doc.restore();

  doc.fillColor('#0284C7').fontSize(11).font(fontPath || 'Helvetica-Bold').text(t('HỆ THỐNG QUẢN LÝ VÉ XE BUÝT THÔNG MINH ICTU'), 72, 32);
  doc.fillColor('#0F172A').fontSize(17).font(fontPath || 'Helvetica-Bold').text(t('BÁO CÁO PHÂN TÍCH TỶ LỆ LẤP ĐẦY & TỐI ƯU QUY MÔ XE'), 72, 46);
  doc.fillColor('#64748B').fontSize(9).font(fontPath || 'Helvetica').text(
    t(`Kỳ thống kê: ${startDateStr} đến ${endDateStr}  |  Ngày lập báo cáo: ${exportTimeStr}  |  Chuẩn phụ tải: 28 ghế/xe`),
    72,
    67,
  );

  doc.moveTo(36, 82).lineTo(805, 82).strokeColor('#CBD5E1').lineWidth(1).stroke();

  // KPIs
  const sum = data?.summary || {};
  const overallRate = data?.overallOccupancyPercentage ?? sum.overallOccupancyPercentage ?? 0;
  const totalTrips = sum.totalTrips || data?.totalTrips || 0;
  const totalCap = sum.totalCapacity || 0;
  const totalBkd = sum.totalBooked || 0;

  const cardWidth = 180;
  const cardHeight = 48;
  const cardY = 90;
  const cards = [
    { label: t('HỆ SỐ LẤP ĐẦY BÌNH QUÂN'), value: `${overallRate}%`, color: '#0284C7' },
    { label: t('TỔNG SỐ CA CHẠY'), value: `${totalTrips} chuyến`, color: '#059669' },
    { label: t('CHỖ CUNG ỨNG / ĐÃ ĐẶT'), value: `${totalBkd} / ${totalCap}`, color: '#D97706' },
    { label: t('QUÁ TẢI / RỖNG KHÁCH'), value: `${sum.overloadedTripsCount || 0} / ${sum.underutilizedTripsCount || 0}`, color: '#DC2626' },
  ];

  cards.forEach((card, i) => {
    const x = 36 + i * (cardWidth + 12);
    doc.save();
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 6).fillAndStroke('#F8FAFC', '#E2E8F0');
    doc.fillColor('#64748B').fontSize(8).font(fontPath || 'Helvetica-Bold').text(card.label, x + 10, cardY + 8);
    doc.fillColor(card.color).fontSize(13).font(fontPath || 'Helvetica-Bold').text(card.value, x + 10, cardY + 22);
    doc.restore();
  });

  // Table
  let tableY = 150;
  doc.fillColor('#0F172A').fontSize(11).font(fontPath || 'Helvetica-Bold').text(t('BẢNG KÊ ĐÁNH GIÁ PHỤ TẢI TỪNG CHUYẾN XE'), 36, tableY);
  tableY += 16;

  const cols = [
    { header: t('STT'), x: 36, width: 35, align: 'center' },
    { header: t('MÃ CHUYẾN'), x: 71, width: 140, align: 'left' },
    { header: t('TUYẾN XE'), x: 211, width: 140, align: 'left' },
    { header: t('BIỂN SỐ'), x: 351, width: 75, align: 'center' },
    { header: t('GIỜ XUẤT BẾN'), x: 426, width: 110, align: 'center' },
    { header: t('ĐÃ ĐẶT'), x: 536, width: 55, align: 'right' },
    { header: t('SỨC CHỨA'), x: 591, width: 55, align: 'right' },
    { header: t('LẤP ĐẦY (%)'), x: 646, width: 75, align: 'right' },
    { header: t('ĐÁNH GIÁ VẬN HÀNH'), x: 721, width: 84, align: 'center' },
  ];

  const drawTableHeader = (y: number) => {
    doc.save();
    doc.rect(36, y, 769, 22).fill('#0284C7');
    doc.fillColor('#FFFFFF').fontSize(8.5).font(fontPath || 'Helvetica-Bold');
    cols.forEach((col) => {
      doc.text(col.header, col.x + 4, y + 6, {
        width: col.width - 8,
        align: col.align as any,
      });
    });
    doc.restore();
  };

  drawTableHeader(tableY);
  tableY += 22;

  const trips = data?.trips || [];
  if (trips.length === 0) {
    doc.save();
    doc.rect(36, tableY, 769, 36).fillAndStroke('#FEF3C7', '#FDE68A');
    doc.fillColor('#B45309').fontSize(10).font(fontPath || 'Helvetica').text(
      t('Không có chuyến xe khai thác trong khoảng thời gian đã chọn.'),
      46,
      tableY + 12,
      { align: 'center', width: 749 },
    );
    doc.restore();
    tableY += 46;
  } else {
    trips.forEach((tr: any, idx: number) => {
      if (tableY > 500) {
        doc.addPage();
        tableY = 40;
        drawTableHeader(tableY);
        tableY += 22;
      }

      const isZebra = idx % 2 === 1;
      if (isZebra) {
        doc.save();
        doc.rect(36, tableY, 769, 18).fill('#F8FAFC');
        doc.restore();
      }

      doc.moveTo(36, tableY + 18).lineTo(805, tableY + 18).strokeColor('#F1F5F9').lineWidth(0.5).stroke();

      const depDate = tr.departureTime ? new Date(tr.departureTime).toLocaleString('vi-VN') : 'N/A';
      const cap = Number(tr.seatCapacity) || 28;
      const bkd = Number(tr.bookedSeats) || 0;
      const occ = tr.occupancyPercentage != null ? tr.occupancyPercentage : Math.round((bkd / cap) * 100);
      const lvl = tr.statusLevel || 'NORMAL';

      doc.fillColor('#334155').fontSize(8).font(fontPath || 'Helvetica');
      doc.text(String(idx + 1), cols[0].x + 4, tableY + 5, { width: cols[0].width - 8, align: 'center' });
      doc.text(t(tr.tripId?.slice(0, 18) || `TRIP-${idx + 1}`), cols[1].x + 4, tableY + 5, { width: cols[1].width - 8, align: 'left' });
      doc.text(t(tr.routeCode || tr.routeName || 'Tuyen'), cols[2].x + 4, tableY + 5, { width: cols[2].width - 8, align: 'left' });
      doc.text(t(tr.vehiclePlate || 'Chua gan'), cols[3].x + 4, tableY + 5, { width: cols[3].width - 8, align: 'center' });
      doc.text(depDate, cols[4].x + 4, tableY + 5, { width: cols[4].width - 8, align: 'center' });
      doc.text(`${bkd}`, cols[5].x + 4, tableY + 5, { width: cols[5].width - 8, align: 'right' });
      doc.text(`${cap}`, cols[6].x + 4, tableY + 5, { width: cols[6].width - 8, align: 'right' });
      doc.text(`${occ}%`, cols[7].x + 4, tableY + 5, { width: cols[7].width - 8, align: 'right' });
      doc.text(t(lvl), cols[8].x + 4, tableY + 5, { width: cols[8].width - 8, align: 'center' });

      tableY += 18;
    });
  }

  // Chữ ký
  if (tableY > 440) {
    doc.addPage();
    tableY = 40;
  } else {
    tableY += 20;
  }

  const sigY = tableY + 10;
  doc.fillColor('#0F172A').fontSize(9).font(fontPath || 'Helvetica-Bold');
  doc.text(t('NGƯỜI LẬP BIỂU'), 100, sigY, { width: 200, align: 'center' });
  doc.text(t('BAN GIÁM ĐỐC PHÊ DUYỆT'), 540, sigY, { width: 200, align: 'center' });

  doc.fillColor('#64748B').fontSize(8).font(fontPath || 'Helvetica');
  doc.text(t('(Ký, ghi rõ họ tên)'), 100, sigY + 12, { width: 200, align: 'center' });
  doc.text(t('(Ký, đóng dấu xác nhận)'), 540, sigY + 12, { width: 200, align: 'center' });

  // Đánh số trang
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.moveTo(36, 565).lineTo(805, 565).strokeColor('#CBD5E1').lineWidth(0.5).stroke();
    doc.fillColor('#94A3B8').fontSize(7.5).font(fontPath || 'Helvetica').text(
      t(`Smart Bus Ticketing System - ICTU  |  Báo cáo phân tích phụ tải trình Ban Giám Đốc`),
      36,
      572,
      { align: 'left', width: 400 },
    );
    doc.fillColor('#94A3B8').fontSize(7.5).font(fontPath || 'Helvetica').text(
      t(`Trang ${i + 1} / ${range.count}`),
      405,
      572,
      { align: 'right', width: 400 },
    );
  }

  return doc;
}
