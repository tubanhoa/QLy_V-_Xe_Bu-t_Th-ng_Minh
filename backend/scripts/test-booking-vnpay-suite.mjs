/**
 * TEST SUITE: TÍCH HỢP CỔNG THANH TOÁN VNPAY SANDBOX & ĐỒNG BỘ ADMIN DASHBOARD
 * 
 * Phạm vi kiểm thử:
 *  TC-01: Tạo đơn đặt vé mới (POST /api/v1/booking/create) -> status: PENDING, tickets: RESERVED
 *  TC-02: Tạo URL thanh toán VNPay Sandbox (POST /api/v1/payment/create-url) -> paymentUrl, qrDataUrl Base64, DB payment PENDING
 *  TC-03: Xử lý VNPay Return callback với chữ ký số HMAC-SHA512 (GET /api/v1/payment/vnpay-return) -> xác thực chữ ký, cập nhật PAID
 *  TC-04: Kiểm tra phản ánh dữ liệu thật vào Admin Tickets & Đối soát đa cổng (GET /api/v1/booking/admin/tickets & GET /api/v1/payment/reconciliation)
 *  TC-05: Kiểm tra xác nhận thanh toán qua API confirm (POST /api/v1/payment/mock-confirm/:bookingId)
 *  TC-06: DỌN DẸP SẠCH SẼ 100% TOÀN BỘ DỮ LIỆU TEST (ZERO TEST JUNK GUARANTEE)
 * 
 * RÀNG BUỘC:
 *  - 0% emoji Unicode
 *  - Tự động dọn dẹp sạch sẽ 100% dữ liệu test sau khi hoàn tất
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
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

function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    if (obj[key] !== null && obj[key] !== undefined && obj[key] !== '') {
      sorted[encodeURIComponent(key)] = encodeURIComponent(obj[key]).replace(/%20/g, '+');
    }
  }
  return sorted;
}

async function runTestSuite() {
  console.log('================================================================================');
  console.log('KHOI DONG TEST SUITE: TICH HOP VNPAY SANDBOX & ADMIN DASHBOARD (ZERO TEST JUNK)');
  console.log('================================================================================\n');

  const createdBookingIds = [];
  const createdPaymentIds = [];
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
    console.log('[SETUP] 1. Dang nhap lay JWT token cho Admin va Khach hang...');

    // Login Admin
    let res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@smartbus.ictu.vn', password: 'Password@123' }),
    });
    let json = await res.json();
    adminToken = json.data?.accessToken;

    if (!adminToken) {
      // Fallback: Tìm hoặc tạo token qua DB
      const adminQuery = await pool.query(
        "SELECT u.id, u.email FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'admin' LIMIT 1"
      );
      if (adminQuery.rows.length === 0) throw new Error('Khong tim thay tai khoan admin trong DB');
      adminToken = 'mock-admin-token';
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
      // Lấy user bất kỳ từ DB
      const userRes = await pool.query(
        "SELECT id, email, full_name, phone_number FROM users WHERE email LIKE '%@%' LIMIT 1"
      );
      if (userRes.rows.length === 0) throw new Error('Khong tim thay user nao trong CSDL');
      customerUser = userRes.rows[0];
      // Login với mật khẩu chung
      res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: customerUser.email, password: 'Password@123' }),
      });
      json = await res.json();
      customerToken = json.data?.accessToken || adminToken;
    }

    console.log(`[SETUP]    -> Customer: ${customerUser?.email || 'test@ictu.vn'}`);
    console.log(`[SETUP]    -> Admin Token: ${adminToken ? 'San sang' : 'Chua co'}`);

    // Tìm một chuyến xe và ghế trống trong DB
    console.log('[SETUP] 2. Tim chuyen xe va ghe trong de chay test booking...');
    const tripRes = await pool.query(`
      SELECT t.id, t.route_id, t.vehicle_id, r.base_price, r.name as route_name
      FROM trips t
      JOIN routes r ON t.route_id = r.id
      ORDER BY t.departure_time DESC
      LIMIT 1
    `);

    if (tripRes.rows.length === 0) {
      throw new Error('Khong tim thay chuyen xe nao trong co so du lieu');
    }
    testTrip = tripRes.rows[0];

    const seatRes = await pool.query(`
      SELECT s.id, s.seat_number
      FROM seats s
      WHERE s.vehicle_id = $1
      LIMIT 1
    `, [testTrip.vehicle_id]);

    if (seatRes.rows.length === 0) {
      throw new Error('Khong tim thay ghe nao tren xe cua chuyen duoc chon');
    }
    testSeat = seatRes.rows[0];

    console.log(`[SETUP]    -> Chuyen xe: ${testTrip.id} (${testTrip.route_name})`);
    console.log(`[SETUP]    -> Ghe kiem thu: ${testSeat.seat_number} (ID: ${testSeat.id})`);
    console.log('\nBat dau thuc thi cac test cases...\n');

    // -------------------------------------------------------------------------
    // TC-01: Tạo đơn đặt vé mới (POST /api/v1/booking/create)
    // -------------------------------------------------------------------------
    let t0 = performance.now();
    let bookingCode = '';
    let bookingId = '';

    res = await fetch(`${API_BASE}/booking/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        tripId: testTrip.id,
        seatIds: [testSeat.id],
        passengers: [
          {
            seatId: testSeat.id,
            passengerName: 'Test QA VNPay Passenger',
            passengerPhone: '0981234567',
          },
        ],
        paymentMethod: 'vnpay',
        totalAmount: 10000,
      }),
    });

    let t1 = performance.now();
    json = await res.json();

    if (res.ok && json.data?.bookingId) {
      bookingId = json.data.bookingId;
      bookingCode = json.data.bookingCode;
      createdBookingIds.push(bookingId);

      // Lưu lại ticket IDs để dọn dẹp
      if (json.data.tickets && Array.isArray(json.data.tickets)) {
        json.data.tickets.forEach((t) => createdTicketIds.push(t.id));
      }

      recordResult(
        'TC-01',
        'Tao don dat ve moi qua API (booking/create)',
        'PASSED',
        t1 - t0,
        `Booking ID: ${bookingId}, Code: ${bookingCode}, Status: ${json.data.status || 'PENDING'}`
      );
    } else {
      recordResult(
        'TC-01',
        'Tao don dat ve moi qua API (booking/create)',
        'FAILED',
        t1 - t0,
        `HTTP ${res.status}: ${json.message || JSON.stringify(json)}`
      );
      throw new Error('TC-01 that bai, dung test suite');
    }

    // -------------------------------------------------------------------------
    // TC-02: Tạo URL thanh toán VNPay Sandbox (POST /api/v1/payment/create-url)
    // -------------------------------------------------------------------------
    t0 = performance.now();
    let paymentId = '';
    let txnRef = '';
    let paymentUrl = '';

    res = await fetch(`${API_BASE}/payment/create-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        bookingId,
        paymentMethod: 'vnpay',
        orderInfo: `Thanh toan ve xe buyt ICTU ${bookingCode}`,
      }),
    });

    t1 = performance.now();
    json = await res.json();

    if (res.ok && json.data?.paymentUrl) {
      paymentId = json.data.paymentId;
      txnRef = json.data.txnRef;
      paymentUrl = json.data.paymentUrl;
      createdPaymentIds.push(paymentId);

      const hasTmn = paymentUrl.includes('BDCDEH71');
      const hasHash = paymentUrl.includes('vnp_SecureHash');
      const hasQr = Boolean(json.data.qrDataUrl);

      if (hasTmn && hasHash && hasQr) {
        recordResult(
          'TC-02',
          'Khoi tao URL VNPay Sandbox & ma QR Base64 (payment/create-url)',
          'PASSED',
          t1 - t0,
          `TMN: BDCDEH71, TxnRef: ${txnRef}, QR Base64 Length: ${json.data.qrDataUrl.length}`
        );
      } else {
        recordResult(
          'TC-02',
          'Khoi tao URL VNPay Sandbox & ma QR Base64 (payment/create-url)',
          'FAILED',
          t1 - t0,
          `Thieu thong so VNPay hop le tren URL: ${paymentUrl}`
        );
      }
    } else {
      recordResult(
        'TC-02',
        'Khoi tao URL VNPay Sandbox & ma QR Base64 (payment/create-url)',
        'FAILED',
        t1 - t0,
        `HTTP ${res.status}: ${json.message || JSON.stringify(json)}`
      );
    }

    // -------------------------------------------------------------------------
    // TC-03: Xử lý VNPay Return HMAC-SHA512 Callback (GET /api/v1/payment/vnpay-return)
    // -------------------------------------------------------------------------
    t0 = performance.now();
    const secretKey = process.env.VNPAY_HASH_SECRET || 'TJAWJFAONXJGYJULKCPRUYGNVXTCHGUN';

    const vnpQueryParams = {
      vnp_Amount: '1000000',
      vnp_BankCode: 'NCB',
      vnp_BankTranNo: 'VNP14890022',
      vnp_CardType: 'ATM',
      vnp_OrderInfo: `Thanh toan ve xe buyt ICTU ${bookingCode}`,
      vnp_PayDate: '20261009054500',
      vnp_ResponseCode: '00',
      vnp_TmnCode: 'BDCDEH71',
      vnp_TransactionNo: '14890022',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: txnRef,
    };

    const sortedParams = sortObject(vnpQueryParams);
    const signData = new URLSearchParams(sortedParams).toString();
    const checkHash = crypto.createHmac('sha512', secretKey).update(Buffer.from(signData, 'utf-8')).digest('hex');
    sortedParams['vnp_SecureHash'] = checkHash;

    const queryStr = new URLSearchParams({ ...vnpQueryParams, vnp_SecureHash: checkHash }).toString();
    const returnUrlWithParams = `${API_BASE}/payment/vnpay-return?${queryStr}`;
    res = await fetch(returnUrlWithParams);
    t1 = performance.now();
    json = await res.json();

    if (res.ok && json.data?.isValid && json.data?.isSuccess) {
      // Xác nhận trong CSDL xem booking và tickets đã chuyển sang PAID chưa
      const checkDb = await pool.query(
        'SELECT status FROM bookings WHERE id = $1',
        [bookingId]
      );
      const statusLower = (checkDb.rows[0]?.status || '').toLowerCase();
      const isPaidInDb = statusLower === 'paid';

      if (isPaidInDb) {
        recordResult(
          'TC-03',
          'Xu ly VNPay Return HMAC-SHA512 Callback & chot ve PAID',
          'PASSED',
          t1 - t0,
          `Xac thuc HMAC-SHA512: Hop le, CSDL Booking: ${checkDb.rows[0]?.status}`
        );
      } else {
        recordResult(
          'TC-03',
          'Xu ly VNPay Return HMAC-SHA512 Callback & chot ve PAID',
          'FAILED',
          t1 - t0,
          `API tra ve thanh cong nhung CSDL Booking van la: ${checkDb.rows[0]?.status}`
        );
      }
    } else {
      recordResult(
        'TC-03',
        'Xu ly VNPay Return HMAC-SHA512 Callback & chot ve PAID',
        'FAILED',
        t1 - t0,
        `HTTP ${res.status}: ${json.message || JSON.stringify(json)}`
      );
    }

    // -------------------------------------------------------------------------
    // TC-04: Kiểm tra phản ánh dữ liệu thật vào Admin Tickets & Đối soát đa cổng
    // -------------------------------------------------------------------------
    t0 = performance.now();

    const [adminTicketsRes, reconRes] = await Promise.all([
      fetch(`${API_BASE}/booking/admin/tickets?search=${bookingCode}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
      fetch(`${API_BASE}/payment/reconciliation`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
    ]);

    t1 = performance.now();
    const adminTicketsJson = await adminTicketsRes.json();
    const reconJson = await reconRes.json();

    const foundInTickets = adminTicketsJson.data?.items?.some(
      (item) => item.bookingCode === bookingCode && (item.paymentMethod || '').toLowerCase() === 'vnpay'
    );

    const vnpSummary = reconJson.data?.summaryByGateway?.find(
      (gw) => gw.gateway === 'vnpay'
    );
    const hasReconData = vnpSummary && vnpSummary.successCount >= 1 && vnpSummary.revenue > 0;

    if (foundInTickets && hasReconData) {
      recordResult(
        'TC-04',
        'Phan anh giao dich VNPay that vao Admin Tickets & Doi soat',
        'PASSED',
        t1 - t0,
        `Ve xuat hien tai Admin Tickets (${bookingCode}), Doi soat VNPay: ${vnpSummary.successCount} GD / ${vnpSummary.revenue}d`
      );
    } else {
      recordResult(
        'TC-04',
        'Phan anh giao dich VNPay that vao Admin Tickets & Doi soat',
        'FAILED',
        t1 - t0,
        `FoundInTickets: ${Boolean(foundInTickets)}, HasReconData: ${Boolean(hasReconData)}`
      );
    }

    // -------------------------------------------------------------------------
    // TC-05: Kiểm tra xác nhận thanh toán trực tiếp qua API confirm
    // -------------------------------------------------------------------------
    t0 = performance.now();

    // Tìm ghế thứ 2 chưa ai đặt để test sub-booking
    const seat2Res = await pool.query(`
      SELECT s.id, s.seat_number
      FROM seats s
      WHERE s.vehicle_id = $1 AND s.id != $2
      LIMIT 1
    `, [testTrip.vehicle_id, testSeat.id]);

    const testSeat2 = seat2Res.rows[0] || testSeat;

    // Tạo thêm 1 booking phụ để test confirm endpoint độc lập
    const subBookingRes = await fetch(`${API_BASE}/booking/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        tripId: testTrip.id,
        seatIds: [testSeat2.id],
        passengers: [
          {
            seatId: testSeat2.id,
            passengerName: 'Test QA Sub Passenger',
            passengerPhone: '0981234567',
          },
        ],
        paymentMethod: 'cash',
        totalAmount: 10000,
      }),
    });
    const subBookingJson = await subBookingRes.json();
    const subBookingId = subBookingJson.data?.bookingId;
    if (subBookingId) {
      createdBookingIds.push(subBookingId);
      if (subBookingJson.data.tickets) {
        subBookingJson.data.tickets.forEach((t) => createdTicketIds.push(t.id));
      }

      // Gọi confirm
      const confirmRes = await fetch(`${API_BASE}/payment/mock-confirm/${subBookingId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      t1 = performance.now();
      const confirmJson = await confirmRes.json();

      if (confirmRes.ok && confirmJson.success) {
        recordResult(
          'TC-05',
          'Xac nhan thanh toan truc tiep qua API mock-confirm',
          'PASSED',
          t1 - t0,
          `Booking ${subBookingId} da chot thanh toan thanh cong`
        );
      } else {
        recordResult(
          'TC-05',
          'Xac nhan thanh toan truc tiep qua API mock-confirm',
          'FAILED',
          t1 - t0,
          `HTTP ${confirmRes.status}: ${confirmJson.message}`
        );
      }
    } else {
      recordResult(
        'TC-05',
        'Xac nhan thanh toan truc tiep qua API mock-confirm',
        'FAILED',
        t1 - t0,
        'Khong the tao sub-booking kiem thu'
      );
    }

  } catch (error) {
    console.error('\n[TEST-EXCEPTION] Loi nghiem trong trong qua trinh kiem thu:', error);
  } finally {
    // -------------------------------------------------------------------------
    // TC-06: DỌN DẸP SẠCH SẼ 100% TOÀN BỘ DỮ LIỆU TEST (ZERO TEST JUNK GUARANTEE)
    // -------------------------------------------------------------------------
    console.log('\n[CLEANUP] Bat dau quy trinh don dep tuyet doi toan bo du lieu test...');
    const tClean0 = performance.now();

    try {
      if (createdBookingIds.length > 0) {
        // 1. Xóa payment logs
        await pool.query(
          'DELETE FROM payment_logs WHERE booking_id = ANY($1)',
          [createdBookingIds]
        );

        // 2. Xóa payments
        await pool.query(
          'DELETE FROM payments WHERE booking_id = ANY($1)',
          [createdBookingIds]
        );

        // 3. Xóa tickets
        await pool.query(
          'DELETE FROM tickets WHERE booking_id = ANY($1)',
          [createdBookingIds]
        );

        // 4. Xóa bookings
        await pool.query(
          'DELETE FROM bookings WHERE id = ANY($1)',
          [createdBookingIds]
        );

        // 5. Giải phóng seat holds nếu có
        await pool.query(
          'DELETE FROM seat_holds WHERE user_id = $1',
          [customerUser?.id || '00000000-0000-0000-0000-000000000000']
        );
      }

      // Kiểm tra lại xác nhận database đã hoàn toàn sạch
      const verifyCheck = await pool.query(
        'SELECT COUNT(*) as count FROM bookings WHERE id = ANY($1)',
        [createdBookingIds.length > 0 ? createdBookingIds : ['00000000-0000-0000-0000-000000000000']]
      );
      const remainingCount = Number(verifyCheck.rows[0]?.count || 0);

      const tClean1 = performance.now();
      if (remainingCount === 0) {
        recordResult(
          'TC-06',
          'Don dep tuyet doi 100% du lieu test trong CSDL (Zero Test Junk)',
          'PASSED',
          tClean1 - tClean0,
          `Da xoa ${createdBookingIds.length} bookings, payments, tickets. Du lieu con lai trong DB: 0`
        );
      } else {
        recordResult(
          'TC-06',
          'Don dep tuyet doi 100% du lieu test trong CSDL (Zero Test Junk)',
          'FAILED',
          tClean1 - tClean0,
          `Van con ${remainingCount} ban ghi test chua duoc xoa sach`
        );
      }
    } catch (cleanupErr) {
      console.error('[CLEANUP-ERROR] Loi khi don dep du lieu test:', cleanupErr);
      recordResult(
        'TC-06',
        'Don dep tuyet doi 100% du lieu test trong CSDL (Zero Test Junk)',
        'FAILED',
        0,
        cleanupErr.message
      );
    } finally {
      await pool.end();
    }
  }

  // ---------------------------------------------------------------------------
  // TỔNG HỢP KẾT QUẢ TEST
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('BANG TONG HOP KET QUA KIEM THU (TEST RESULTS SUMMARY)');
  console.log('================================================================================');

  const passedCount = testResults.filter((r) => r.status === 'PASSED').length;
  const failedCount = testResults.filter((r) => r.status === 'FAILED').length;
  const totalCount = testResults.length;

  console.table(
    testResults.map((r) => ({
      'Mã Test': r.testId,
      'Tên Kịch Bản': r.name,
      'Kết Quả': r.status,
      'Độ Trễ': `${r.latencyMs} ms`,
    }))
  );

  console.log(`\nTong so kiem thu: ${totalCount}`);
  console.log(`  PASSED: ${passedCount} / ${totalCount} (${Math.round((passedCount / totalCount) * 100)}%)`);
  console.log(`  FAILED: ${failedCount} / ${totalCount}`);
  console.log('================================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite();
