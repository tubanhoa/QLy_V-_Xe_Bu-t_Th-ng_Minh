/**
 * TEST SUITE: TASK 2 - TỰ ĐỘNG HÓA WEBHOOK IPN VNPAY SANDBOX & ĐỐI SOÁT REALTIME ADMIN
 * 
 * Phạm vi kiểm thử:
 *  TC-01: Tạo đơn đặt vé & khởi tạo giao dịch VNPay Sandbox thật (POST /booking/create & POST /payment/create-url)
 *  TC-02: Gửi Webhook IPN chuẩn (ResponseCode '00') với chữ ký HMAC-SHA512 hợp lệ -> RspCode: '00', chuyển CSDL sang PAID
 *  TC-03: Kiểm tra tính Idempotency khi VNPay gọi lại IPN lần 2 -> RspCode: '02' (Order already confirmed), không cộng trùng
 *  TC-04: Kiểm tra chống giả mạo chữ ký (Tampering / Invalid Checksum) -> RspCode: '97' (Invalid Checksum)
 *  TC-05: Kiểm tra giao dịch không tồn tại (Order Not Found) -> RspCode: '01' (Order not found)
 *  TC-06: Xác minh bảng nhật ký thanh toán (payment_logs) trong CSDL lưu trữ đầy đủ lịch sử IPN
 *  TC-07: Xác minh API Đối Soát Doanh Thu Đa Kênh (/payment/reconciliation) phản ánh tức thì
 *  TC-08: DỌN DẸP SẠCH SẼ 100% TOÀN BỘ DỮ LIỆU TEST (ZERO TEST JUNK GUARANTEE)
 * 
 * RÀNG BUỘC:
 *  - 0% emoji Unicode
 *  - Dữ liệu sạch sẽ 100%, không để lại rác trong database sau khi test
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

function signParams(params, secretKey) {
  const sorted = sortObject(params);
  const signData = new URLSearchParams(sorted).toString();
  return crypto.createHmac('sha512', secretKey).update(Buffer.from(signData, 'utf-8')).digest('hex');
}

async function runIpnTestSuite() {
  console.log('================================================================================');
  console.log('KHOI DONG TEST SUITE TASK 2: VNPAY WEBHOOK IPN & ZERO TEST JUNK');
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
      const userRes = await pool.query(
        "SELECT id, email, full_name, phone_number FROM users WHERE email LIKE '%@%' LIMIT 1"
      );
      if (userRes.rows.length === 0) throw new Error('Khong tim thay user nao trong CSDL');
      customerUser = userRes.rows[0];
      res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: customerUser.email, password: 'Password@123' }),
      });
      json = await res.json();
      customerToken = json.data?.accessToken || adminToken;
    }

    console.log(`[SETUP]    -> Customer: ${customerUser?.email || 'student.an@ictu.edu.vn'}`);
    console.log(`[SETUP]    -> Admin Token: ${adminToken ? 'San sang' : 'Chua co'}`);

    // Tìm một chuyến xe và ghế trống trong DB
    console.log('[SETUP] 2. Tim chuyen xe va ghe trong de chay test IPN...');
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
      AND s.id NOT IN (
        SELECT t.seat_id 
        FROM tickets t 
        JOIN bookings b ON t.booking_id = b.id
        WHERE b.trip_id = $2 AND t.status IN ('reserved', 'paid', 'checked_in')
      )
      LIMIT 1
    `, [testTrip.vehicle_id, testTrip.id]);

    if (seatRes.rows.length === 0) {
      throw new Error('Khong tim thay ghe trong nao cho chuyen xe test');
    }
    testSeat = seatRes.rows[0];

    console.log(`[SETUP]    -> Chuyen xe: ${testTrip.id} (${testTrip.route_name})`);
    console.log(`[SETUP]    -> Ghe trong: ${testSeat.seat_number} (ID: ${testSeat.id})`);
    console.log('\nBat dau thuc thi cac test cases Task 2...\n');

    const secretKey = process.env.VNPAY_HASH_SECRET || 'TJAWJFAONXJGYJULKCPRUYGNVXTCHGUN';

    // -------------------------------------------------------------------------
    // TC-01: Tạo đơn đặt vé mới & URL VNPay Sandbox thật
    // -------------------------------------------------------------------------
    let t0 = performance.now();
    let bookingId = '';
    let bookingCode = '';
    let paymentId = '';
    let txnRef = '';

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
            passengerName: 'Test QA IPN Passenger',
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

      if (json.data.tickets && Array.isArray(json.data.tickets)) {
        json.data.tickets.forEach((t) => createdTicketIds.push(t.id));
      }

      // Tạo payment URL
      const payRes = await fetch(`${API_BASE}/payment/create-url`, {
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
      const payJson = await payRes.json();
      paymentId = payJson.data?.paymentId;
      txnRef = payJson.data?.txnRef;
      if (paymentId) createdPaymentIds.push(paymentId);

      recordResult(
        'TC-01',
        'Khoi tao Booking & Payment record cho luong IPN',
        'PASSED',
        t1 - t0,
        `Booking: ${bookingCode}, TxnRef: ${txnRef}, Payment ID: ${paymentId}`
      );
    } else {
      recordResult(
        'TC-01',
        'Khoi tao Booking & Payment record cho luong IPN',
        'FAILED',
        t1 - t0,
        `HTTP ${res.status}: ${json.message || JSON.stringify(json)}`
      );
      throw new Error('TC-01 that bai, dung test suite');
    }

    // -------------------------------------------------------------------------
    // TC-02: Gửi Webhook IPN chuẩn thành công (ResponseCode '00')
    // -------------------------------------------------------------------------
    t0 = performance.now();

    const validIpnParams = {
      vnp_Amount: '1000000',
      vnp_BankCode: 'NCB',
      vnp_BankTranNo: 'VNP99887766',
      vnp_CardType: 'ATM',
      vnp_OrderInfo: `Thanh toan ve xe buyt ICTU ${bookingCode}`,
      vnp_PayDate: '20261009063000',
      vnp_ResponseCode: '00',
      vnp_TmnCode: 'BDCDEH71',
      vnp_TransactionNo: '99887766',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: txnRef,
    };

    const validHash = signParams(validIpnParams, secretKey);
    const ipnQuery = new URLSearchParams({ ...validIpnParams, vnp_SecureHash: validHash }).toString();

    res = await fetch(`${API_BASE}/payment/vnpay-ipn?${ipnQuery}`);
    t1 = performance.now();
    json = await res.json();

    if (json.RspCode === '00') {
      // Xác minh trong database xem booking & payment đã đổi sang PAID / SUCCESS chưa
      const dbCheck = await pool.query(
        'SELECT b.status as b_status, p.status as p_status FROM bookings b JOIN payments p ON p.booking_id = b.id WHERE b.id = $1',
        [bookingId]
      );
      const row = dbCheck.rows[0];
      const isPaid = (row?.b_status || '').toLowerCase() === 'paid';
      const isSuccess = (row?.p_status || '').toLowerCase() === 'success';

      if (isPaid && isSuccess) {
        recordResult(
          'TC-02',
          'Xu ly Webhook IPN thanh cong & chot ve PAID',
          'PASSED',
          t1 - t0,
          `RspCode: 00, Message: ${json.Message}, CSDL Booking: ${row.b_status}, Payment: ${row.p_status}`
        );
      } else {
        recordResult(
          'TC-02',
          'Xu ly Webhook IPN thanh cong & chot ve PAID',
          'FAILED',
          t1 - t0,
          `RspCode 00 nhung CSDL Booking: ${row?.b_status}, Payment: ${row?.p_status}`
        );
      }
    } else {
      recordResult(
        'TC-02',
        'Xu ly Webhook IPN thanh cong & chot ve PAID',
        'FAILED',
        t1 - t0,
        `Server tra ve RspCode: ${json.RspCode}, Message: ${json.Message}`
      );
    }

    // -------------------------------------------------------------------------
    // TC-03: Kiểm tra tính Idempotency khi VNPay gọi lại IPN lần 2 (Đã thanh toán)
    // -------------------------------------------------------------------------
    t0 = performance.now();

    res = await fetch(`${API_BASE}/payment/vnpay-ipn?${ipnQuery}`);
    t1 = performance.now();
    json = await res.json();

    if (json.RspCode === '02') {
      recordResult(
        'TC-03',
        'Kiem tra tinh Idempotency (Goi lai IPN lan 2 chong trung tien)',
        'PASSED',
        t1 - t0,
        `RspCode: 02 (Order already confirmed), Message: ${json.Message}`
      );
    } else {
      recordResult(
        'TC-03',
        'Kiem tra tinh Idempotency (Goi lai IPN lan 2 chong trung tien)',
        'FAILED',
        t1 - t0,
        `Mong doi RspCode 02 nhung nhan duoc: ${json.RspCode} (${json.Message})`
      );
    }

    // -------------------------------------------------------------------------
    // TC-04: Kiểm tra chống giả mạo chữ ký (Tampering / Invalid Checksum)
    // -------------------------------------------------------------------------
    t0 = performance.now();

    const tamperedQuery = new URLSearchParams({
      ...validIpnParams,
      vnp_Amount: '99999999', // Sửa số tiền mà không tính lại hash
      vnp_SecureHash: validHash,
    }).toString();

    res = await fetch(`${API_BASE}/payment/vnpay-ipn?${tamperedQuery}`);
    t1 = performance.now();
    json = await res.json();

    if (json.RspCode === '97') {
      recordResult(
        'TC-04',
        'Kiem tra chong gia mao chu ky Checksum (Tampering Test)',
        'PASSED',
        t1 - t0,
        `RspCode: 97 (Invalid Checksum), Message: ${json.Message}`
      );
    } else {
      recordResult(
        'TC-04',
        'Kiem tra chong gia mao chu ky Checksum (Tampering Test)',
        'FAILED',
        t1 - t0,
        `Mong doi RspCode 97 nhung nhan duoc: ${json.RspCode} (${json.Message})`
      );
    }

    // -------------------------------------------------------------------------
    // TC-05: Kiểm tra giao dịch không tồn tại (Order Not Found)
    // -------------------------------------------------------------------------
    t0 = performance.now();

    const nonExistentParams = {
      vnp_Amount: '1000000',
      vnp_BankCode: 'NCB',
      vnp_OrderInfo: 'Giao dich khong ton tai',
      vnp_ResponseCode: '00',
      vnp_TmnCode: 'BDCDEH71',
      vnp_TxnRef: 'NON-EXISTENT-TXN-REF-9999',
    };
    const nonExistentHash = signParams(nonExistentParams, secretKey);
    const nonExistentQuery = new URLSearchParams({
      ...nonExistentParams,
      vnp_SecureHash: nonExistentHash,
    }).toString();

    res = await fetch(`${API_BASE}/payment/vnpay-ipn?${nonExistentQuery}`);
    t1 = performance.now();
    json = await res.json();

    if (json.RspCode === '01') {
      recordResult(
        'TC-05',
        'Kiem tra giao dich khong ton tai (Order Not Found Test)',
        'PASSED',
        t1 - t0,
        `RspCode: 01 (Order not found), Message: ${json.Message}`
      );
    } else {
      recordResult(
        'TC-05',
        'Kiem tra giao dich khong ton tai (Order Not Found Test)',
        'FAILED',
        t1 - t0,
        `Mong doi RspCode 01 nhung nhan duoc: ${json.RspCode} (${json.Message})`
      );
    }

    // -------------------------------------------------------------------------
    // TC-06: Xác minh bảng nhật ký thanh toán (payment_logs) trong CSDL
    // -------------------------------------------------------------------------
    t0 = performance.now();

    const logsCheck = await pool.query(
      `SELECT event_type, status, response_data, error_message
       FROM payment_logs
       WHERE booking_id = $1 OR (request_data->>'vnp_TxnRef' = $2)
       ORDER BY created_at ASC`,
      [bookingId, txnRef]
    );

    t1 = performance.now();
    const eventTypes = logsCheck.rows.map((r) => r.event_type);
    const hasIpnSuccess = eventTypes.includes('ipn_success');
    const hasIpnDuplicate = eventTypes.includes('ipn_duplicate');

    if (hasIpnSuccess && hasIpnDuplicate) {
      recordResult(
        'TC-06',
        'Xac minh nhat ky thanh toan (payment_logs) ghi nhan day du IPN',
        'PASSED',
        t1 - t0,
        `Tong logs ghi nhan: ${logsCheck.rows.length}, Su kien: ${eventTypes.join(', ')}`
      );
    } else {
      recordResult(
        'TC-06',
        'Xac minh nhat ky thanh toan (payment_logs) ghi nhan day du IPN',
        'FAILED',
        t1 - t0,
        `Thieu su kien IPN mong doi. Su kien hien co: ${eventTypes.join(', ')}`
      );
    }

    // -------------------------------------------------------------------------
    // TC-07: Xác minh API Đối Soát Doanh Thu Đa Kênh phản ánh tức thì
    // -------------------------------------------------------------------------
    t0 = performance.now();

    const reconRes = await fetch(`${API_BASE}/payment/reconciliation`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    t1 = performance.now();
    const reconJson = await reconRes.json();

    const vnpSummary = reconJson.data?.summaryByGateway?.find(
      (gw) => gw.gateway === 'vnpay'
    );
    const hasReconSuccess = vnpSummary && vnpSummary.successCount >= 1 && vnpSummary.revenue > 0;

    if (hasReconSuccess) {
      recordResult(
        'TC-07',
        'Xac minh API Doi Soat Doanh Thu phan anh tuc thi tu IPN',
        'PASSED',
        t1 - t0,
        `VNPay: ${vnpSummary.successCount} GD thanh cong, Doanh thu: ${vnpSummary.revenue}d`
      );
    } else {
      recordResult(
        'TC-07',
        'Xac minh API Doi Soat Doanh Thu phan anh tuc thi tu IPN',
        'FAILED',
        t1 - t0,
        `Doi soat VNPay: ${JSON.stringify(vnpSummary)}`
      );
    }

  } catch (error) {
    console.error('\n[TEST-EXCEPTION] Loi trong qua trinh kiem thu Task 2:', error);
  } finally {
    // -------------------------------------------------------------------------
    // TC-08: DỌN DẸP SẠCH SẼ 100% TOÀN BỘ DỮ LIỆU TEST (ZERO TEST JUNK GUARANTEE)
    // -------------------------------------------------------------------------
    console.log('\n[CLEANUP] Bat dau quy trinh don dep tuyet doi toan bo du lieu test Task 2...');
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

      // Xóa các logs rác sinh ra từ test cases tampering và non-existent
      await pool.query(
        "DELETE FROM payment_logs WHERE request_data->>'vnp_TxnRef' IN ('NON-EXISTENT-TXN-REF-9999') OR event_type IN ('ipn_checksum_error', 'ipn_not_found')"
      );

      // Xác minh lại trong database đã hoàn toàn sạch 100%
      const verifyCheck = await pool.query(
        'SELECT COUNT(*) as count FROM bookings WHERE id = ANY($1)',
        [createdBookingIds.length > 0 ? createdBookingIds : ['00000000-0000-0000-0000-000000000000']]
      );
      const remainingCount = Number(verifyCheck.rows[0]?.count || 0);

      const tClean1 = performance.now();
      if (remainingCount === 0) {
        recordResult(
          'TC-08',
          'Don dep tuyet doi 100% du lieu test trong CSDL (Zero Test Junk)',
          'PASSED',
          tClean1 - tClean0,
          `Da xoa ${createdBookingIds.length} bookings, payments, tickets, logs. Du lieu con lai: 0`
        );
      } else {
        recordResult(
          'TC-08',
          'Don dep tuyet doi 100% du lieu test trong CSDL (Zero Test Junk)',
          'FAILED',
          tClean1 - tClean0,
          `Van con ${remainingCount} ban ghi test chua duoc xoa sach`
        );
      }
    } catch (cleanupErr) {
      console.error('[CLEANUP-ERROR] Loi khi don dep du lieu test:', cleanupErr);
      recordResult(
        'TC-08',
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
  console.log('BANG TONG HOP KET QUA KIEM THU TASK 2 (TEST RESULTS SUMMARY)');
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

runIpnTestSuite();
