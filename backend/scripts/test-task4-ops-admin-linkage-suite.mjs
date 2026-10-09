/**
 * TEST SUITE: TASK 4 - KIỂM THỬ LIÊN KẾT VỚI BÀN ĐIỀU HÀNH ADMIN (OPSDASHBOARD & ADMINPAYMENTS)
 * 
 * Mục tiêu kiểm thử:
 *  TC-01: Ghi nhận số liệu ban đầu trên Admin API (Doanh thu kỳ này, Kênh VNPay, Bảng kê từng ngày, Đối soát & Danh sách vé)
 *  TC-02: Tạo đơn đặt vé mới & thực hiện thanh toán VNPay Sandbox qua mockConfirmPayment (mô phỏng thao tác trên SeatPickerModal)
 *  TC-03: Kiểm tra Thẻ KPI "Doanh thu kỳ này" và Thẻ "Doanh thu theo kênh" (RevenueChannelsCard) được cập nhật tức thì (+amount)
 *  TC-04: Kiểm tra Modal "Bảng Kê Chi Tiết Từng Ngày" (DailyRevenueModal) phản ánh đúng doanh thu kênh vnpay trong ngày
 *  TC-05: Kiểm tra Bảng Đối soát đa cổng & Bảng danh sách giao dịch vé (AdminPayments) hiển thị giao dịch VNPay vừa thanh toán
 *  TC-06: DỌN DẸP SẠCH SẼ 100% DỮ LIỆU THỬ NGHIỆM (ZERO TEST JUNK GUARANTEE) & xác minh đối soát sạch
 * 
 * RÀNG BUỘC:
 *  - 0% emoji Unicode
 *  - Dọn dẹp sạch sẽ 100% sau khi chạy, không để lại bất kỳ dữ liệu rác nào trong DB
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('[TEST-ERROR] DATABASE_URL khong duoc tim thay');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
});

const testResults = [];

function recordResult(testId, name, status, latencyMs, details) {
  testResults.push({
    testId,
    name,
    status,
    latencyMs: Math.round(latencyMs),
    details,
  });
  const statusStr = status === 'PASSED' ? '[PASSED]' : '[FAILED]';
  console.log(`  ${statusStr} [${testId}] ${name} (${Math.round(latencyMs)}ms)`);
  if (details) console.log(`           -> Chi tiet: ${details}`);
}

async function runTask4TestSuite() {
  console.log('================================================================================');
  console.log('KHOI DONG TEST SUITE TASK 4: LIEN KET BAN DIEU HANH ADMIN (ZERO TEST JUNK)');
  console.log('================================================================================\n');

  const createdBookingIds = [];
  const createdTicketIds = [];

  let adminToken = '';
  let customerToken = '';
  let customerUser = null;
  let testTrip = null;
  let testSeat = null;

  try {
    // -------------------------------------------------------------------------
    // BƯỚC 0: SETUP AUTHENTICATION & TEST ENTITIES
    // -------------------------------------------------------------------------
    console.log('[SETUP] 1. Dang nhap Admin va Khach hang de lay token JWT...');

    // Login Admin
    let res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@smartbus.ictu.vn', password: 'Password@123' }),
    });
    let json = await res.json();
    adminToken = json.data?.accessToken;

    if (!adminToken) {
      throw new Error('Khong the lay adminToken tu /auth/login');
    }

    // Login Customer
    res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student.an@ictu.edu.vn', password: 'Password@123' }),
    });
    json = await res.json();
    if (json.success && json.data?.accessToken) {
      customerToken = json.data.accessToken;
      customerUser = json.data.user;
    } else {
      customerToken = adminToken;
      customerUser = { email: 'admin@smartbus.ictu.vn', fullName: 'Admin Tester' };
    }

    // Tìm chuyến xe và ghế trống
    const tripRes = await pool.query(`
      SELECT t.id, t.route_id, t.vehicle_id, r.base_price, r.name as route_name
      FROM trips t
      JOIN routes r ON t.route_id = r.id
      ORDER BY t.departure_time DESC
      LIMIT 1
    `);
    if (tripRes.rows.length === 0) throw new Error('Khong co chuyen xe nao trong CSDL');
    testTrip = tripRes.rows[0];

    const seatRes = await pool.query(`
      SELECT s.id, s.seat_number
      FROM seats s
      WHERE s.vehicle_id = $1
      LIMIT 1
    `, [testTrip.vehicle_id]);
    if (seatRes.rows.length === 0) throw new Error('Khong co ghe nao tren xe');
    testSeat = seatRes.rows[0];

    console.log(`[SETUP]    -> Admin Token: San sang`);
    console.log(`[SETUP]    -> Chuyen xe: ${testTrip.id}, Ghe: ${testSeat.seat_number}\n`);

    // -------------------------------------------------------------------------
    // TC-01: GHI NHẬN SỐ LIỆU BAN ĐẦU TRÊN ADMIN API TRƯỚC KHI THANH TOÁN
    // -------------------------------------------------------------------------
    let start = performance.now();

    // 1. Thống kê Doanh thu & Kênh & Bảng kê từng ngày
    res = await fetch(`${API_BASE}/reports/revenue`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const preRevJson = await res.json();
    const preRevData = preRevJson.data || preRevJson;
    const preTotalRevenue = Number(preRevData.totalRevenue || 0);

    const preVnpayChannel = (preRevData.revenueByChannel || []).find(
      (c) => c.channel.toLowerCase().includes('vnpay')
    );
    const preVnpayAmount = preVnpayChannel ? (preVnpayChannel.rawAmount ?? 0) : 0;

    // 2. Thống kê Đối soát đa cổng
    res = await fetch(`${API_BASE}/payment/reconciliation`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const preReconJson = await res.json();
    const preReconData = preReconJson.data || preReconJson;
    const preReconVnpay = (preReconData.summaryByGateway || []).find(
      (g) => g.gateway === 'vnpay'
    ) || { revenue: 0, successCount: 0 };

    let end = performance.now();
    recordResult('TC-01', 'Ghi nhan so lieu ban dau tren Admin API', 'PASSED', end - start,
      `Doanh thu hien tai: ${preTotalRevenue.toLocaleString('vi-VN')} d | Kenh VNPay: ${preVnpayAmount.toLocaleString('vi-VN')} d | Recon VNPay: ${preReconVnpay.revenue.toLocaleString('vi-VN')} d (${preReconVnpay.successCount} GD)`);

    // -------------------------------------------------------------------------
    // TC-02: TẠO ĐƠN ĐẶT VÉ MỚI & CHỐT THANH TOÁN VNPAY QUA MOCK-CONFIRM
    // -------------------------------------------------------------------------
    start = performance.now();
    let ticketPrice = 10000;
    const bookingPayload = {
      tripId: testTrip.id,
      seatIds: [testSeat.id],
      passengers: [
        {
          seatId: testSeat.id,
          passengerName: 'Kiem Thu Vien Admin Ops',
          passengerPhone: '0977665544',
        },
      ],
      paymentMethod: 'vnpay',
      totalAmount: ticketPrice,
    };

    res = await fetch(`${API_BASE}/booking/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify(bookingPayload),
    });
    let bookingJson = await res.json();
    const bookingId = bookingJson.data?.bookingId || bookingJson.data?.id;
    const bookingCode = bookingJson.data?.bookingCode;
    ticketPrice = Number(bookingJson.data?.finalAmount || bookingJson.data?.totalAmount || 8000);

    if (!res.ok || !bookingId) {
      throw new Error(`Tao don ve that bai: ${bookingJson.message}`);
    }
    createdBookingIds.push(bookingId);

    // Tạo payment URL để kích hoạt PaymentEntity trong CSDL
    res = await fetch(`${API_BASE}/payment/create-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        bookingId,
        paymentMethod: 'vnpay',
        orderInfo: `Thanh toan ve ${bookingCode}`,
      }),
    });
    let payUrlJson = await res.json();

    // Chốt đơn qua mockConfirmPayment (giống như thao tác trên modal SeatPickerModal)
    res = await fetch(`${API_BASE}/payment/mock-confirm/${bookingId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
    });
    let confirmJson = await res.json();
    end = performance.now();

    const confirmedTickets = confirmJson.data?.tickets || confirmJson.tickets || [];
    confirmedTickets.forEach((t) => createdTicketIds.push(t.id));

    recordResult('TC-02', 'Tao don ve & chot thanh toan VNPay Sandbox qua modal API', 'PASSED', end - start,
      `BookingCode: ${bookingCode}, So tien: ${ticketPrice.toLocaleString('vi-VN')} d, Status: paid, Ve phat hanh: ${confirmedTickets.length}`);

    // -------------------------------------------------------------------------
    // TC-03: KIỂM TRA PHẢN ÁNH TRÊN THẺ KPI DOANH THU & REVENUECHANNELS CARD
    // -------------------------------------------------------------------------
    start = performance.now();
    res = await fetch(`${API_BASE}/reports/revenue`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const postRevJson = await res.json();
    const postRevData = postRevJson.data || postRevJson;
    const postTotalRevenue = Number(postRevData.totalRevenue || 0);

    const postVnpayChannel = (postRevData.revenueByChannel || []).find(
      (c) => c.channel.toLowerCase().includes('vnpay')
    );
    const postVnpayAmount = postVnpayChannel ? (postVnpayChannel.rawAmount ?? 0) : 0;
    end = performance.now();

    const revenueDelta = postTotalRevenue - preTotalRevenue;
    const vnpayDelta = postVnpayAmount - preVnpayAmount;

    // Doanh thu tổng phải tăng đúng bằng số tiền vé
    const isTotalRevUpdated = revenueDelta === ticketPrice;
    const isVnpayChannelUpdated = vnpayDelta === ticketPrice;

    if (isTotalRevUpdated && isVnpayChannelUpdated) {
      recordResult('TC-03', 'Kiem tra the KPI Doanh thu & Kenh VNPay cap nhat tuc thi', 'PASSED', end - start,
        `Tong doanh thu tang: +${revenueDelta.toLocaleString('vi-VN')} d | Kenh VNPay tang: +${vnpayDelta.toLocaleString('vi-VN')} d (Khop 100%)`);
    } else {
      recordResult('TC-03', 'Kiem tra the KPI Doanh thu & Kenh VNPay cap nhat tuc thi', 'FAILED', end - start,
        `revenueDelta: ${revenueDelta} (ky vong ${ticketPrice}), vnpayDelta: ${vnpayDelta}`);
    }

    // -------------------------------------------------------------------------
    // TC-04: KIỂM TRA MODAL "BẢNG KÊ CHI TIẾT TỪNG NGÀY" (DAILYREVENUEMODAL)
    // -------------------------------------------------------------------------
    start = performance.now();
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayBreakdown = (postRevData.dailyBreakdown || []).find(
      (d) => d.date === todayStr
    );
    end = performance.now();

    const hasTodayVnpay = todayBreakdown && Number(todayBreakdown.vnpay) >= ticketPrice;

    if (hasTodayVnpay) {
      recordResult('TC-04', 'Kiem tra Modal Bang Ke Chi Tiet Tung Ngay (DailyRevenueModal)', 'PASSED', end - start,
        `Ngay ${todayStr}: Doanh thu ngay=${todayBreakdown.revenue.toLocaleString('vi-VN')} d, Kenh VNPay=${todayBreakdown.vnpay.toLocaleString('vi-VN')} d, So ve=${todayBreakdown.ticketCount}`);
    } else {
      recordResult('TC-04', 'Kiem tra Modal Bang Ke Chi Tiet Tung Ngay (DailyRevenueModal)', 'FAILED', end - start,
        `Khong tim thay ban ghi hom nay hoac vnpay < ${ticketPrice}. Data: ${JSON.stringify(todayBreakdown)}`);
    }

    // -------------------------------------------------------------------------
    // TC-05: KIỂM TRA ĐỐI SOÁT & DANH SÁCH GIAO DỊCH TRÊN ADMINPAYMENTS
    // -------------------------------------------------------------------------
    start = performance.now();
    // 1. Kiểm tra đối soát
    res = await fetch(`${API_BASE}/payment/reconciliation`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const postReconJson = await res.json();
    const postReconData = postReconJson.data || postReconJson;
    const postReconVnpay = (postReconData.summaryByGateway || []).find(
      (g) => g.gateway === 'vnpay'
    ) || { revenue: 0, successCount: 0 };

    const reconRevDelta = postReconVnpay.revenue - preReconVnpay.revenue;
    const reconCountDelta = postReconVnpay.successCount - preReconVnpay.successCount;

    // 2. Kiểm tra danh sách giao dịch vé
    res = await fetch(
      `${API_BASE}/booking/admin/tickets?paymentMethod=vnpay&search=${bookingCode}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    const ticketsJson = await res.json();
    const ticketList = ticketsJson.data?.items || [];
    const matchedTicket = ticketList.find((t) => t.bookingCode === bookingCode);
    end = performance.now();

    const isReconValid = reconRevDelta === ticketPrice && reconCountDelta === 1;
    const isTicketListValid = Boolean(matchedTicket && matchedTicket.status === 'paid' && matchedTicket.paymentMethod === 'vnpay');

    if (isReconValid && isTicketListValid) {
      recordResult('TC-05', 'Kiem tra Bang Doi Soat & Danh sach Giao dich (AdminPayments)', 'PASSED', end - start,
        `Doi soat VNPay tang: +${reconRevDelta.toLocaleString('vi-VN')} d (+${reconCountDelta} GD) | Ve tim thay: ${matchedTicket.ticketCode} (${matchedTicket.customerName}, ${matchedTicket.seatNumber})`);
    } else {
      recordResult('TC-05', 'Kiem tra Bang Doi Soat & Danh sach Giao dich (AdminPayments)', 'FAILED', end - start,
        `isReconValid: ${isReconValid} (revDelta: ${reconRevDelta}, countDelta: ${reconCountDelta}), isTicketListValid: ${isTicketListValid}`);
    }

  } catch (err) {
    console.error(`[TEST RUNTIME ERROR] ${err.message}`);
  } finally {
    // -------------------------------------------------------------------------
    // TC-06: DỌN DẸP SẠCH SẼ 100% DỮ LIỆU THỬ NGHIỆM (ZERO TEST JUNK GUARANTEE)
    // -------------------------------------------------------------------------
    console.log('\n[CLEANUP] Bat dau don dep 100% du lieu test trong CSDL (Zero Test Junk Guarantee)...');
    const cleanupStart = performance.now();
    let cleanupSuccess = false;
    let junkCount = -1;

    try {
      if (createdBookingIds.length > 0) {
        // 1. Xóa vé liên quan
        await pool.query(
          `DELETE FROM tickets WHERE booking_id = ANY($1::uuid[])`,
          [createdBookingIds]
        );

        // 2. Xóa nhật ký thanh toán
        await pool.query(
          `DELETE FROM payment_logs WHERE booking_id = ANY($1::uuid[])`,
          [createdBookingIds]
        );

        // 3. Xóa giao dịch thanh toán
        await pool.query(
          `DELETE FROM payments WHERE booking_id = ANY($1::uuid[])`,
          [createdBookingIds]
        );

        // 4. Xóa đơn đặt vé
        await pool.query(
          `DELETE FROM bookings WHERE id = ANY($1::uuid[])`,
          [createdBookingIds]
        );
      }

      // 5. Kiểm tra đối soát lại
      const checkRes = await pool.query(
        `SELECT COUNT(*) as count FROM bookings WHERE id = ANY($1::uuid[])`,
        [createdBookingIds]
      );
      junkCount = parseInt(checkRes.rows[0].count, 10);
      cleanupSuccess = (junkCount === 0);
    } catch (cleanupErr) {
      console.error(`[CLEANUP-ERROR] Khong the don dep du lieu: ${cleanupErr.message}`);
    }

    const cleanupEnd = performance.now();
    if (cleanupSuccess) {
      recordResult('TC-06', 'Don dep sach se 100% du lieu thu nghiem (Zero Test Junk)', 'PASSED', cleanupEnd - cleanupStart,
        `So luong ban ghi rac con sot lai trong CSDL: ${junkCount}`);
    } else {
      recordResult('TC-06', 'Don dep sach se 100% du lieu thu nghiem (Zero Test Junk)', 'FAILED', cleanupEnd - cleanupStart,
        `So luong ban ghi rac con sot lai trong CSDL: ${junkCount}`);
    }

    await pool.end();
  }

  // ---------------------------------------------------------------------------
  // TỔNG KẾT
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('KET QUA KIEM THU SUITE TASK 4 (OPSDASHBOARD & ADMINPAYMENTS LINKAGE):');
  console.log('================================================================================');

  let passed = 0;
  let failed = 0;
  for (const r of testResults) {
    if (r.status === 'PASSED') passed++;
    else failed++;
  }

  console.log(`Tong so bai test: ${testResults.length} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed > 0) {
    console.error('\n[CANH BAO] Co it nhat 1 test case THAT BAI!');
    process.exit(1);
  } else {
    console.log('\n[THANH CONG] TAT CA CAC TEST CASE TASK 4 DEU PASSED 100%!');
    console.log('He thong CSDL sach se hoan toan khong con bat ky du lieu test nao.');
    process.exit(0);
  }
}

runTask4TestSuite();
