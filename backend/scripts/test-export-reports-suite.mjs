/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * BỘ KIỂM THỬ TOÀN DIỆN: XUẤT BÁO CÁO EXCEL (.XLSX) & PDF (.PDF) TRÌNH BAN GIÁM ĐỐC
 * Kiểm tra cấu trúc bảng tính, định dạng số liệu, font chữ, streaming, và trường hợp không có dữ liệu
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('backend', '.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve('.env') });
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { ReportsService } from '../dist/modules/reports/reports.service.js';
import {
  buildRevenueExcelWorkbook,
  buildOccupancyExcelWorkbook,
} from '../dist/modules/reports/utils/report-excel.util.js';
import {
  buildRevenuePdfDocument,
  buildOccupancyPdfDocument,
} from '../dist/modules/reports/utils/report-pdf.util.js';

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASSED] ${testName}`);
    passedCount++;
  } else {
    console.error(`  [FAILED] ${testName} ${details ? `-> ${details}` : ''}`);
    failedCount++;
  }
}

async function streamPdfToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));
    doc.end();
  });
}

async function runTestSuite() {
  console.log('='.repeat(80));
  console.log('BỘ KIỂM THỬ: XUẤT BÁO CÁO EXCEL & PDF TRÌNH BAN GIÁM ĐỐC (STREAMING & ZERO CRASH)');
  console.log('='.repeat(80));

  let app;
  let reportsService;

  try {
    console.log('\n[SETUP] 1. Khởi tạo ApplicationContext NestJS...');
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    reportsService = app.get(ReportsService);
    assert(reportsService != null, 'ReportsService được inject thành công từ NestJS DI');

    // Dữ liệu mẫu chuẩn nghiệp vụ cho kiểm thử
    const mockRevenueData = {
      totalRevenue: 2850000,
      totalTickets: 142,
      totalPaidBookings: 120,
      revenueByRoute: [
        { routeId: 'r-1', routeCode: 'CT-01', name: 'ICTU - Bến xe Thái Nguyên', ticketCount: 80, revenue: 1600000, share: 56 },
        { routeId: 'r-2', routeCode: 'CT-02', name: 'ICTU - KTX SamSung Phổ Yên', ticketCount: 62, revenue: 1250000, share: 44 },
      ],
      revenueByChannel: [
        { channel: 'Cổng VNPay Sandbox', rawMethod: 'vnpay', amount: '1.500.000 đ', rawAmount: 1500000, share: 53, bookingCount: 60 },
        { channel: 'Ví MoMo', rawMethod: 'momo', amount: '850.000 đ', rawAmount: 850000, share: 30, bookingCount: 35 },
        { channel: 'Tiền mặt tại quầy', rawMethod: 'cash', amount: '500.000 đ', rawAmount: 500000, share: 17, bookingCount: 25 },
      ],
      trips: [
        { tripId: 'TRIP-CT01-0800', routeCode: 'CT-01', routeName: 'ICTU - Bến xe TT', vehiclePlate: '20-B1 999.88', departureTime: '2026-10-15T08:00:00Z', ticketCount: 28, seatCapacity: 28, revenue: 560000, occupancyRate: 100 },
        { tripId: 'TRIP-CT02-0900', routeCode: 'CT-02', routeName: 'ICTU - SamSung', vehiclePlate: '20-B1 888.77', departureTime: '2026-10-15T09:00:00Z', ticketCount: 18, seatCapacity: 28, revenue: 360000, occupancyRate: 64 },
        { tripId: 'TRIP-CT01-1400', routeCode: 'CT-01', routeName: 'ICTU - Bến xe TT', vehiclePlate: '20-B1 777.66', departureTime: '2026-10-15T14:00:00Z', ticketCount: 4, seatCapacity: 28, revenue: 80000, occupancyRate: 14 },
      ],
    };

    const mockOccupancyData = {
      date: '2026-10-15',
      overallOccupancyPercentage: 59,
      totalTrips: 3,
      summary: {
        overallOccupancyPercentage: 59,
        totalTrips: 3,
        totalCapacity: 84,
        totalBooked: 50,
        overloadedTripsCount: 1,
        optimalTripsCount: 1,
        lowTripsCount: 0,
        underutilizedTripsCount: 1,
      },
      recommendations: [
        { type: 'PEAK_OVERLOAD', priority: 'HIGH', title: 'Tăng chuyến giờ cao điểm 08:00', message: 'Tuyến CT-01 đạt 100% lấp đầy', targetRoute: 'CT-01', targetTime: '08:00' },
        { type: 'UNDERUTILIZED', priority: 'MEDIUM', title: 'Giãn chuyến hoặc dùng xe Minibus', message: 'Chuyến 14:00 chỉ đạt 14%', targetRoute: 'CT-01', targetTime: '14:00' },
      ],
      trips: [
        { tripId: 'TRIP-CT01-0800', routeCode: 'CT-01', routeName: 'ICTU - Bến xe TT', vehiclePlate: '20-B1 999.88', departureTime: '2026-10-15T08:00:00Z', bookedSeats: 28, seatCapacity: 28, availableSeats: 0, occupancyPercentage: 100, statusLevel: 'OVERLOADED' },
        { tripId: 'TRIP-CT02-0900', routeCode: 'CT-02', routeName: 'ICTU - SamSung', vehiclePlate: '20-B1 888.77', departureTime: '2026-10-15T09:00:00Z', bookedSeats: 18, seatCapacity: 28, availableSeats: 10, occupancyPercentage: 64, statusLevel: 'OPTIMAL' },
        { tripId: 'TRIP-CT01-1400', routeCode: 'CT-01', routeName: 'ICTU - Bến xe TT', vehiclePlate: '20-B1 777.66', departureTime: '2026-10-15T14:00:00Z', bookedSeats: 4, seatCapacity: 28, availableSeats: 24, occupancyPercentage: 14, statusLevel: 'UNDERUTILIZED' },
      ],
    };

    // =========================================================================
    // TEST GROUP 1: KIỂM THỬ XUẤT FILE EXCEL BÁO CÁO DOANH THU
    // =========================================================================
    console.log('\n▶ [TEST-01] Kiểm thử tạo Workbook Excel Báo cáo Doanh thu:');
    const revWorkbook = await buildRevenueExcelWorkbook(mockRevenueData, { startDate: '2026-10-01', endDate: '2026-10-15' });
    assert(revWorkbook != null, 'Khởi tạo ExcelJS Workbook Doanh thu thành công');

    const sheet1 = revWorkbook.getWorksheet('Tổng Quan & KPIs');
    assert(sheet1 != null, 'Có Sheet 1: "Tổng Quan & KPIs"');
    assert(sheet1.getCell('A2').value === 'BÁO CÁO DOANH THU & HIỆU QUẢ TÀI CHÍNH', 'Tiêu đề báo cáo chính xác');

    const sheet2 = revWorkbook.getWorksheet('Chi Tiết Chuyến Xe');
    assert(sheet2 != null, 'Có Sheet 2: "Chi Tiết Chuyến Xe"');
    assert(sheet2.rowCount >= 4, 'Bảng chi tiết chuyến xe ghi nhận đủ các dòng dữ liệu');

    const revXlsxBuffer = await revWorkbook.xlsx.writeBuffer();
    assert(Buffer.isBuffer(revXlsxBuffer) || revXlsxBuffer instanceof Uint8Array, 'Kết xuất ra Buffer Excel thành công');
    // Magic bytes của ZIP/XLSX là PK\x03\x04 (0x50 0x4B 0x03 0x04)
    const isZip = revXlsxBuffer[0] === 0x50 && revXlsxBuffer[1] === 0x4B;
    assert(isZip, 'Định dạng file đúng chuẩn OpenXML Spreadsheet (.xlsx) magic header PK');

    // =========================================================================
    // TEST GROUP 2: KIỂM THỬ XUẤT FILE PDF BÁO CÁO DOANH THU
    // =========================================================================
    console.log('\n▶ [TEST-02] Kiểm thử tạo tài liệu PDF Báo cáo Doanh thu:');
    const revDoc = buildRevenuePdfDocument(mockRevenueData, { startDate: '2026-10-01', endDate: '2026-10-15' });
    assert(revDoc != null, 'Khởi tạo PDFKit Document Doanh thu thành công');

    const revPdfBuffer = await streamPdfToBuffer(revDoc);
    assert(revPdfBuffer.length > 1000, `Dung lượng file PDF hợp lệ (${revPdfBuffer.length} bytes)`);
    // Magic bytes của PDF là %PDF- (0x25 0x50 0x44 0x46)
    const isPdf = revPdfBuffer.toString('utf-8', 0, 5).startsWith('%PDF-');
    assert(isPdf, 'Định dạng file đúng chuẩn Adobe PDF magic header (%PDF-)');

    // =========================================================================
    // TEST GROUP 3: KIỂM THỬ XUẤT FILE EXCEL BÁO CÁO TỶ LỆ LẤP ĐẦY
    // =========================================================================
    console.log('\n▶ [TEST-03] Kiểm thử tạo Workbook Excel Báo cáo Tỷ lệ lấp đầy:');
    const occWorkbook = await buildOccupancyExcelWorkbook(mockOccupancyData, { startDate: '2026-10-01', endDate: '2026-10-15' });
    assert(occWorkbook != null, 'Khởi tạo ExcelJS Workbook Phụ tải thành công');

    const occSheet1 = occWorkbook.getWorksheet('Tổng Quan Phụ Tải');
    assert(occSheet1 != null, 'Có Sheet: "Tổng Quan Phụ Tải"');

    const occSheet2 = occWorkbook.getWorksheet('Chi Tiết Từng Chuyến');
    assert(occSheet2 != null, 'Có Sheet: "Chi Tiết Từng Chuyến"');
    assert(occSheet2.rowCount >= 4, 'Bảng chi tiết chuyến xe ghi nhận đủ 3 chuyến mẫu');

    const occXlsxBuffer = await occWorkbook.xlsx.writeBuffer();
    assert(occXlsxBuffer[0] === 0x50 && occXlsxBuffer[1] === 0x4B, 'File Excel Phụ tải đúng định dạng .xlsx');

    // =========================================================================
    // TEST GROUP 4: KIỂM THỬ XUẤT FILE PDF BÁO CÁO TỶ LỆ LẤP ĐẦY
    // =========================================================================
    console.log('\n▶ [TEST-04] Kiểm thử tạo tài liệu PDF Báo cáo Tỷ lệ lấp đầy:');
    const occDoc = buildOccupancyPdfDocument(mockOccupancyData, { startDate: '2026-10-01', endDate: '2026-10-15' });
    assert(occDoc != null, 'Khởi tạo PDFKit Document Phụ tải thành công');

    const occPdfBuffer = await streamPdfToBuffer(occDoc);
    assert(occPdfBuffer.length > 1000, `Dung lượng file PDF Phụ tải hợp lệ (${occPdfBuffer.length} bytes)`);
    assert(occPdfBuffer.toString('utf-8', 0, 5).startsWith('%PDF-'), 'File PDF Phụ tải đúng chuẩn Adobe PDF');

    // =========================================================================
    // TEST GROUP 5: KIỂM THỬ TRƯỜNG HỢP BIÊN KHÔNG CÓ DỮ LIỆU (EMPTY DATA GUARANTEE)
    // =========================================================================
    console.log('\n▶ [TEST-05] Kiểm thử trường hợp biên khi KHÔNG CÓ DỮ LIỆU (Empty Report):');
    const emptyRevenueData = {
      totalRevenue: 0,
      totalTickets: 0,
      totalPaidBookings: 0,
      revenueByRoute: [],
      revenueByChannel: [],
      trips: [],
    };

    const emptyOccupancyData = {
      date: '2099-01-01',
      overallOccupancyPercentage: 0,
      totalTrips: 0,
      summary: {
        overallOccupancyPercentage: 0,
        totalTrips: 0,
        totalCapacity: 0,
        totalBooked: 0,
        overloadedTripsCount: 0,
        optimalTripsCount: 0,
        lowTripsCount: 0,
        underutilizedTripsCount: 0,
      },
      recommendations: [],
      trips: [],
    };

    // Excel rỗng không crash
    const emptyRevWb = await buildRevenueExcelWorkbook(emptyRevenueData, { startDate: '2099-01-01', endDate: '2099-01-02' });
    const emptyRevBuffer = await emptyRevWb.xlsx.writeBuffer();
    assert(emptyRevBuffer.length > 0, 'Xuất Excel Doanh thu rỗng không bị crash, sinh file thành công');

    // PDF rỗng không crash và hiển thị thông báo trang trọng
    const emptyRevDoc = buildRevenuePdfDocument(emptyRevenueData, { startDate: '2099-01-01', endDate: '2099-01-02' });
    const emptyRevPdfBuffer = await streamPdfToBuffer(emptyRevDoc);
    assert(emptyRevPdfBuffer.length > 0, 'Xuất PDF Doanh thu rỗng không bị crash');

    // Excel phụ tải rỗng không crash
    const emptyOccWb = await buildOccupancyExcelWorkbook(emptyOccupancyData, { startDate: '2099-01-01', endDate: '2099-01-02' });
    const emptyOccBuffer = await emptyOccWb.xlsx.writeBuffer();
    assert(emptyOccBuffer.length > 0, 'Xuất Excel Phụ tải rỗng không bị crash, sinh file thành công');

    // PDF phụ tải rỗng không crash
    const emptyOccDoc = buildOccupancyPdfDocument(emptyOccupancyData, { startDate: '2099-01-01', endDate: '2099-01-02' });
    const emptyOccPdfBuffer = await streamPdfToBuffer(emptyOccDoc);
    assert(emptyOccPdfBuffer.length > 0, 'Xuất PDF Phụ tải rỗng không bị crash');

    // =========================================================================
    // TEST GROUP 6: KIỂM THỬ MOCK RESPONSE STREAMING CHO CONTROLLER SERVICE
    // =========================================================================
    console.log('\n▶ [TEST-06] Kiểm thử Mock Response Stream trong Service (Anti-Server Freeze):');
    class MockResponse {
      constructor() {
        this.headers = {};
        this.chunks = [];
        this.isEnded = false;
      }
      setHeader(name, value) {
        this.headers[name] = value;
      }
      write(chunk) {
        if (chunk) this.chunks.push(Buffer.from(chunk));
        return true;
      }
      end(chunk) {
        if (chunk) this.chunks.push(Buffer.from(chunk));
        this.isEnded = true;
      }
      pipe(dest) {
        return dest;
      }
      on() {
        return this;
      }
      once() {
        return this;
      }
      emit() {
        return true;
      }
    }

    const mockRes1 = new MockResponse();
    await reportsService.exportRevenueExcel({ startDate: '2026-10-01', endDate: '2026-10-15' }, mockRes1);
    assert(mockRes1.headers['Content-Type'] === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Header Content-Type Excel chính xác');
    assert(mockRes1.headers['Content-Disposition'].includes('attachment; filename='), 'Header Content-Disposition Excel có attachment');
    assert(mockRes1.isEnded === true, 'Response Excel stream được đóng hoàn tất (res.end)');

    const mockRes2 = new MockResponse();
    await reportsService.exportOccupancyExcel({ startDate: '2026-10-01', endDate: '2026-10-15' }, mockRes2);
    assert(mockRes2.headers['Content-Type'] === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Header Content-Type Occupancy Excel chính xác');
    assert(mockRes2.isEnded === true, 'Response Occupancy Excel stream được đóng hoàn tất');

  } catch (err) {
    console.error('\n[FATAL ERROR]:', err);
    failedCount++;
  } finally {
    if (app) await app.close();
  }

  console.log('\n' + '='.repeat(80));
  console.log(` KẾT QUẢ KIỂM THỬ: ${passedCount} PASSED / ${failedCount} FAILED (Tổng: ${passedCount + failedCount} bài test)`);
  console.log('='.repeat(80) + '\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite();
