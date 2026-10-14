import ExcelJS from 'exceljs';

/**
 * Định dạng giao diện bảng tính Excel chuyên nghiệp cho Báo cáo Ban Giám Đốc
 */
const BRAND_PRIMARY = '059669'; // Emerald Green
const BRAND_DARK = '0F172A'; // Slate Dark
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF' + BRAND_PRIMARY },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: 'Arial',
  size: 11,
  bold: true,
  color: { argb: 'FFFFFFFF' },
};
const TITLE_FONT: Partial<ExcelJS.Font> = {
  name: 'Arial',
  size: 16,
  bold: true,
  color: { argb: 'FF' + BRAND_DARK },
};
const SUBTITLE_FONT: Partial<ExcelJS.Font> = {
  name: 'Arial',
  size: 10,
  italic: true,
  color: { argb: 'FF475569' },
};
const CELL_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

/**
 * Tạo Workbook Báo cáo Doanh thu & Hiệu quả tài chính
 */
export async function buildRevenueExcelWorkbook(data: any, query: any): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smart Bus Ticketing System - ICTU';
  workbook.lastModifiedBy = 'Admin / Ban Giam Doc';
  workbook.created = new Date();

  const startDateStr = query?.startDate || 'Từ đầu kỳ';
  const endDateStr = query?.endDate || 'Đến hiện tại';
  const exportTimeStr = new Date().toLocaleString('vi-VN');

  // =========================================================================
  // SHEET 1: TỔNG QUAN DOANH THU & KPIS
  // =========================================================================
  const sheet1 = workbook.addWorksheet('Tổng Quan & KPIs', {
    views: [{ showGridLines: true }],
  });

  // 1. Tiêu đề thương hiệu
  sheet1.mergeCells('A1:F1');
  const titleCell = sheet1.getCell('A1');
  titleCell.value = 'HỆ THỐNG QUẢN LÝ VÉ XE BUÝT THÔNG MINH ICTU';
  titleCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF' + BRAND_PRIMARY } };
  titleCell.alignment = { vertical: 'middle' };

  sheet1.mergeCells('A2:F2');
  const mainTitleCell = sheet1.getCell('A2');
  mainTitleCell.value = 'BÁO CÁO DOANH THU & HIỆU QUẢ TÀI CHÍNH';
  mainTitleCell.font = TITLE_FONT;
  mainTitleCell.alignment = { vertical: 'middle' };

  sheet1.mergeCells('A3:F3');
  const subTitleCell = sheet1.getCell('A3');
  subTitleCell.value = `Kỳ báo cáo: ${startDateStr} - ${endDateStr} | Thời điểm xuất: ${exportTimeStr}`;
  subTitleCell.font = SUBTITLE_FONT;

  sheet1.addRow([]);

  // 2. Khối KPI Tóm tắt
  const kpiStartRow = 5;
  sheet1.getCell(`A${kpiStartRow}`).value = 'I. CHỈ SỐ TÀI CHÍNH CỐT LÕI (CORE KPIS)';
  sheet1.getCell(`A${kpiStartRow}`).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF' + BRAND_PRIMARY } };

  sheet1.getRow(kpiStartRow + 1).values = ['Chỉ Số', 'Giá Trị', 'Đơn Vị', 'Ghi Chú'];
  sheet1.getRow(kpiStartRow + 1).eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = CELL_BORDER;
  });

  const totalRev = Number(data?.totalRevenue) || 0;
  const totalTickets = Number(data?.totalTickets) || 0;
  const avgPerTicket = totalTickets > 0 ? Math.round(totalRev / totalTickets) : 0;
  const totalTrips = data?.trips?.length || 0;

  const kpiData = [
    ['Tổng doanh thu thực nhận', totalRev, 'VNĐ', 'Sau khi trừ hoàn/hủy hợp lệ'],
    ['Tổng số vé đã bán', totalTickets, 'Vé', 'Bao gồm vé lượt & vé tháng'],
    ['Doanh thu bình quân mỗi vé', avgPerTicket, 'VNĐ/vé', 'Hệ số khai thác vé'],
    ['Tổng số ca chạy khai thác', totalTrips, 'Chuyến xe', 'Dữ liệu vận hành thực tế'],
  ];

  kpiData.forEach((row, idx) => {
    const rowObj = sheet1.addRow(row);
    rowObj.eachCell((cell, colNum) => {
      cell.border = CELL_BORDER;
      cell.font = { name: 'Arial', size: 10 };
      if (colNum === 2 && typeof row[1] === 'number') {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      }
    });
  });

  sheet1.addRow([]);

  // 3. Cơ cấu kênh thanh toán
  const channelStartRow = sheet1.rowCount + 1;
  sheet1.getCell(`A${channelStartRow}`).value = 'II. CƠ CẤU DOANH THU THEO PHƯƠNG THỨC THANH TOÁN';
  sheet1.getCell(`A${channelStartRow}`).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF' + BRAND_PRIMARY } };

  sheet1.addRow(['Phương Thức Thanh Toán', 'Doanh Thu (VNĐ)', 'Số Giao Dịch', 'Tỷ Trọng (%)']);
  sheet1.lastRow!.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = CELL_BORDER;
  });

  const channels = data?.revenueByChannel || [];
  if (channels.length === 0) {
    sheet1.addRow(['Không có giao dịch phát sinh', 0, 0, '0.0%']);
  } else {
    channels.forEach((c: any) => {
      const row = sheet1.addRow([
        c.channel || c.rawMethod || 'Khác',
        Number(c.rawAmount) || 0,
        Number(c.bookingCount) || 0,
        (Number(c.share) || 0) / 100,
      ]);
      row.getCell(2).numFmt = '#,##0 "đ"';
      row.getCell(3).numFmt = '#,##0';
      row.getCell(4).numFmt = '0.0%';
      row.eachCell((cell) => {
        cell.border = CELL_BORDER;
        cell.font = { name: 'Arial', size: 10 };
      });
    });
  }

  sheet1.addRow([]);

  // 4. Doanh thu theo tuyến xe
  const routeStartRow = sheet1.rowCount + 1;
  sheet1.getCell(`A${routeStartRow}`).value = 'III. HIỆU QUẢ DOANH THU THEO TUYẾN XE';
  sheet1.getCell(`A${routeStartRow}`).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF' + BRAND_PRIMARY } };

  sheet1.addRow(['Mã Tuyến', 'Tên Tuyến Xe Buýt', 'Số Vé Bán', 'Doanh Thu (VNĐ)', 'Tỷ Trọng Tuyến (%)']);
  sheet1.lastRow!.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = CELL_BORDER;
  });

  const routes = data?.revenueByRoute || [];
  if (routes.length === 0) {
    sheet1.addRow(['N/A', 'Không có dữ liệu tuyến', 0, 0, '0.0%']);
  } else {
    routes.forEach((r: any) => {
      const row = sheet1.addRow([
        r.routeCode || 'N/A',
        r.name || 'Tuyến không xác định',
        Number(r.ticketCount) || 0,
        Number(r.revenue) || 0,
        (Number(r.share) || 0) / 100,
      ]);
      row.getCell(3).numFmt = '#,##0';
      row.getCell(4).numFmt = '#,##0 "đ"';
      row.getCell(5).numFmt = '0.0%';
      row.eachCell((cell) => {
        cell.border = CELL_BORDER;
        cell.font = { name: 'Arial', size: 10 };
      });
    });
  }

  // Tự động căn chỉnh độ rộng cột Sheet 1
  sheet1.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const valStr = cell.value ? cell.value.toString() : '';
      if (valStr.length > maxLength) maxLength = Math.min(valStr.length + 3, 50);
    });
    column.width = maxLength;
  });

  // =========================================================================
  // SHEET 2: BẢNG KÊ CHI TIẾT CHUYẾN XE
  // =========================================================================
  const sheet2 = workbook.addWorksheet('Chi Tiết Chuyến Xe', {
    views: [{ showGridLines: true }],
  });

  sheet2.addRow([
    'STT',
    'Mã Chuyến',
    'Tuyến Xe',
    'Biển Số Xe',
    'Giờ Khởi Hành',
    'Số Vé Đã Bán',
    'Sức Chứa Xe',
    'Doanh Thu (VNĐ)',
    'Tỷ Lệ Lấp Đầy (%)',
  ]);
  sheet2.getRow(1).eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = CELL_BORDER;
  });

  const trips = data?.trips || [];
  if (trips.length === 0) {
    sheet2.addRow(['1', 'N/A', 'Không có chuyến xe phát sinh trong kỳ', 'N/A', 'N/A', 0, 28, 0, 0]);
  } else {
    trips.forEach((tr: any, idx: number) => {
      const depDate = tr.departureTime ? new Date(tr.departureTime).toLocaleString('vi-VN') : 'N/A';
      const cap = Number(tr.seatCapacity) || 28;
      const tks = Number(tr.ticketCount) || 0;
      const rev = Number(tr.revenue) || 0;
      const occ = tr.occupancyRate != null ? tr.occupancyRate / 100 : tks / cap;

      const row = sheet2.addRow([
        idx + 1,
        tr.tripId || `TRIP-${idx + 1}`,
        tr.routeCode || tr.routeName || 'Tuyến',
        tr.vehiclePlate || 'Chưa gán',
        depDate,
        tks,
        cap,
        rev,
        occ,
      ]);
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(6).numFmt = '#,##0';
      row.getCell(7).numFmt = '#,##0';
      row.getCell(8).numFmt = '#,##0 "đ"';
      row.getCell(9).numFmt = '0.0%';

      row.eachCell((cell) => {
        cell.border = CELL_BORDER;
        cell.font = { name: 'Arial', size: 10 };
      });
    });
  }

  // Tự động căn chỉnh độ rộng cột Sheet 2
  sheet2.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const valStr = cell.value ? cell.value.toString() : '';
      if (valStr.length > maxLength) maxLength = Math.min(valStr.length + 3, 40);
    });
    column.width = maxLength;
  });

  return workbook;
}

/**
 * Tạo Workbook Báo cáo Tỷ lệ lấp đầy & Tối ưu quy mô xe
 */
export async function buildOccupancyExcelWorkbook(data: any, query: any): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smart Bus Ticketing System - ICTU';
  workbook.lastModifiedBy = 'Admin / Ban Giam Doc';
  workbook.created = new Date();

  const startDateStr = query?.startDate || query?.date || 'Từ đầu kỳ';
  const endDateStr = query?.endDate || query?.date || 'Đến hiện tại';
  const exportTimeStr = new Date().toLocaleString('vi-VN');

  // =========================================================================
  // SHEET 1: TỔNG QUAN PHỤ TẢI & ĐỀ XUẤT ĐIỀU PHỐI
  // =========================================================================
  const sheet1 = workbook.addWorksheet('Tổng Quan Phụ Tải', {
    views: [{ showGridLines: true }],
  });

  // Tiêu đề
  sheet1.mergeCells('A1:F1');
  sheet1.getCell('A1').value = 'HỆ THỐNG QUẢN LÝ VÉ XE BUÝT THÔNG MINH ICTU';
  sheet1.getCell('A1').font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF' + BRAND_PRIMARY } };

  sheet1.mergeCells('A2:F2');
  sheet1.getCell('A2').value = 'BÁO CÁO PHÂN TÍCH TỶ LỆ LẤP ĐẦY & TỐI ƯU QUY MÔ XE';
  sheet1.getCell('A2').font = TITLE_FONT;

  sheet1.mergeCells('A3:F3');
  sheet1.getCell('A3').value = `Kỳ thống kê: ${startDateStr} - ${endDateStr} | Thời điểm xuất: ${exportTimeStr}`;
  sheet1.getCell('A3').font = SUBTITLE_FONT;

  sheet1.addRow([]);

  // KPIs
  const kpiStartRow = 5;
  sheet1.getCell(`A${kpiStartRow}`).value = 'I. CHỈ SỐ LẤP ĐẦY TOÀN MẠNG';
  sheet1.getCell(`A${kpiStartRow}`).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF' + BRAND_PRIMARY } };

  sheet1.addRow(['Chỉ Số Vận Hành', 'Giá Trị', 'Đơn Vị', 'Phân Loại']);
  sheet1.lastRow!.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = CELL_BORDER;
  });

  const sum = data?.summary || {};
  const overallRate = (data?.overallOccupancyPercentage || sum.overallOccupancyPercentage || 0) / 100;

  const kpis = [
    ['Hệ số lấp đầy bình quân toàn mạng', overallRate, 'Tỷ lệ %', 'Chỉ tiêu trọng yếu'],
    ['Tổng số ca chạy khai thác', sum.totalTrips || data?.totalTrips || 0, 'Chuyến', 'Toàn bộ mạng lưới'],
    ['Tổng ghế cung ứng trên tuyến', sum.totalCapacity || 0, 'Chỗ ngồi', 'Năng lực thiết kế'],
    ['Tổng ghế hành khách đã đặt', sum.totalBooked || 0, 'Vé đặt', 'Nhu cầu thực tế'],
    ['Chuyến quá tải (> 85%)', sum.overloadedTripsCount || 0, 'Chuyến', 'Cần tăng chuyến/nâng quy mô'],
    ['Chuyến tối ưu (50% - 85%)', sum.optimalTripsCount || 0, 'Chuyến', 'Vận hành đạt chuẩn'],
    ['Chuyến tải thấp (30% - 50%)', sum.lowTripsCount || 0, 'Chuyến', 'Cân nhắc điều chỉnh'],
    ['Chuyến rỗng khách (< 30%)', sum.underutilizedTripsCount || 0, 'Chuyến', 'Nguy cơ lãng phí nhiên liệu'],
  ];

  kpis.forEach((row) => {
    const r = sheet1.addRow(row);
    r.eachCell((cell, colNum) => {
      cell.border = CELL_BORDER;
      cell.font = { name: 'Arial', size: 10 };
      if (colNum === 2) {
        if (typeof row[1] === 'number') {
          cell.numFmt = row[2] === 'Tỷ lệ %' ? '0.0%' : '#,##0';
          cell.alignment = { horizontal: 'right' };
        }
      }
    });
  });

  sheet1.addRow([]);

  // Đề xuất điều phối
  const recStartRow = sheet1.rowCount + 1;
  sheet1.getCell(`A${recStartRow}`).value = 'II. ĐỀ XUẤT ĐIỀU PHỐI ĐỘI XE TỰ ĐỘNG';
  sheet1.getCell(`A${recStartRow}`).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF' + BRAND_PRIMARY } };

  sheet1.addRow(['Mức Độ Ưu Tiên', 'Hạng Mục Khuyến Nghị', 'Nội Dung Chi Tiết', 'Tuyến/Khung Giờ Áp Dụng']);
  sheet1.lastRow!.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = CELL_BORDER;
  });

  const recs = data?.recommendations || [];
  if (recs.length === 0) {
    sheet1.addRow(['INFO', 'Không có khuyến nghị đặc biệt', 'Mạng lưới vận hành ổn định', 'Toàn mạng']);
  } else {
    recs.forEach((rc: any) => {
      const r = sheet1.addRow([
        rc.priority || 'MEDIUM',
        rc.title || 'Đề xuất',
        rc.message || '',
        `${rc.targetRoute || 'Toàn tuyến'} (${rc.targetTime || 'Toàn thời gian'})`,
      ]);
      r.eachCell((cell) => {
        cell.border = CELL_BORDER;
        cell.font = { name: 'Arial', size: 10 };
      });
    });
  }

  // Auto width Sheet 1
  sheet1.columns.forEach((column) => {
    let maxLength = 14;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const valStr = cell.value ? cell.value.toString() : '';
      if (valStr.length > maxLength) maxLength = Math.min(valStr.length + 3, 55);
    });
    column.width = maxLength;
  });

  // =========================================================================
  // SHEET 2: BẢNG KÊ CHUYẾN XE & TRẠNG THÁI PHỤ TẢI
  // =========================================================================
  const sheet2 = workbook.addWorksheet('Chi Tiết Từng Chuyến', {
    views: [{ showGridLines: true }],
  });

  sheet2.addRow([
    'STT',
    'Mã Chuyến',
    'Tuyến Xe',
    'Biển Số Xe',
    'Giờ Xuất Bến',
    'Ghế Đã Đặt',
    'Sức Chứa',
    'Ghế Trống',
    'Tỷ Lệ Lấp Đầy (%)',
    'Đánh Giá Vận Hành',
    'Doanh Thu (VNĐ)',
  ]);
  sheet2.getRow(1).eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = CELL_BORDER;
  });

  const trips = data?.trips || [];
  if (trips.length === 0) {
    sheet2.addRow(['1', 'N/A', 'Không có dữ liệu chuyến xe', 'N/A', 'N/A', 0, 28, 28, 0, 'N/A', 0]);
  } else {
    trips.forEach((tr: any, idx: number) => {
      const depDate = tr.departureTime ? new Date(tr.departureTime).toLocaleString('vi-VN') : 'N/A';
      const cap = Number(tr.seatCapacity) || 28;
      const bkd = Number(tr.bookedSeats) || 0;
      const avail = Number(tr.availableSeats ?? cap - bkd);
      const occ = (Number(tr.occupancyPercentage) || 0) / 100;
      const rev = Number(tr.revenue) || 0;

      const row = sheet2.addRow([
        idx + 1,
        tr.tripId || `TRIP-${idx + 1}`,
        tr.routeCode || tr.routeName || 'Tuyến',
        tr.vehiclePlate || 'Chưa gán',
        depDate,
        bkd,
        cap,
        avail,
        occ,
        tr.statusLevel || 'NORMAL',
        rev,
      ]);
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(6).numFmt = '#,##0';
      row.getCell(7).numFmt = '#,##0';
      row.getCell(8).numFmt = '#,##0';
      row.getCell(9).numFmt = '0.0%';
      row.getCell(11).numFmt = '#,##0 "đ"';

      row.eachCell((cell) => {
        cell.border = CELL_BORDER;
        cell.font = { name: 'Arial', size: 10 };
      });
    });
  }

  // Auto width Sheet 2
  sheet2.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const valStr = cell.value ? cell.value.toString() : '';
      if (valStr.length > maxLength) maxLength = Math.min(valStr.length + 3, 40);
    });
    column.width = maxLength;
  });

  return workbook;
}
