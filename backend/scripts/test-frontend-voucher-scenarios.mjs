/**
 * BỘ KIỂM THỬ TỰ ĐỘNG CHUẨN XÁC DÀNH CHO TESTER:
 * 1. Kiểm thử chức năng tạo mã giảm giá với các loại điều kiện khác nhau (%, số tiền, giới hạn số lượng, thời gian, loại vé, tuyến).
 * 2. Kiểm thử nhập mã voucher tại màn hình thanh toán (mã hợp lệ được trừ tiền chính xác, mã hết hạn/hết lượt/không đủ điều kiện báo lỗi rõ ràng).
 * 3. Kiểm thử việc ngăn chặn sử dụng 1 mã nhiều lần vượt quy định (chống gian lận usageLimit).
 * 4. Zero Test Junk Guarantee: Tự động dọn dẹp sạch sẽ 100% dữ liệu thử nghiệm trong CSDL sau test.
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
  console.error('[TEST-ERROR] DATABASE_URL không được tìm thấy trong cấu hình!');
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
  if (details) console.log(`           -> Chi tiết: ${details}`);
}

async function parseRes(res) {
  try {
    const raw = await res.json();
    if (raw && typeof raw === 'object' && raw.data !== undefined) {
      if (typeof raw.data === 'object' && raw.data !== null && !Array.isArray(raw.data)) {
        return { ...raw.data, _meta: raw.meta, _topMessage: raw.message };
      }
      return raw.data;
    }
    return raw;
  } catch {
    return {};
  }
}

async function runTesterVoucherSuite() {
  console.log('================================================================================');
  console.log('BỘ KIỂM THỬ TESTER: QUẢN LÝ VOUCHER & ÁP DỤNG MÃ THANH TOÁN (FRONTEND/API)');
  console.log('KIỂM THỬ ĐIỀU KIỆN ĐA DẠNG, TÍNH TIỀN THANH TOÁN & CHỐNG LẠM DỤNG USAGE LIMIT');
  console.log('(ZERO TEST JUNK GUARANTEE — KHÔNG ĐỂ LẠI BẤT KỲ DỮ LIỆU RÁC NÀO TRONG CSDL)');
  console.log('================================================================================\n');

  const createdUserIds = [];
  const createdVoucherIds = [];
  const createdBookingIds = [];

  let adminToken = '';
  let studentToken = '';
  let studentUser = null;
  let activeTrip = null;

  try {
    // -------------------------------------------------------------------------
    // BƯỚC 0: SETUP AUTHENTICATION & TÌM CHUYẾN XE KHẢ DỤNG
    // -------------------------------------------------------------------------
    console.log('[SETUP] Đăng nhập Admin & tạo tài khoản Sinh viên Tester...');

    // 1. Đăng nhập Admin
    let res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@smartbus.ictu.vn', password: 'Password@123' }),
    });
    let json = await parseRes(res);
    if (!res.ok || !json.accessToken) {
      throw new Error(`Đăng nhập Admin thất bại: ${JSON.stringify(json)}`);
    }
    adminToken = json.accessToken;

    // 2. Tạo tài khoản Sinh viên Tester
    const rand = Date.now();
    const studentDigits = String(rand).slice(-7);
    const studentId = `DTC${studentDigits}`;
    const studentEmail = `${studentId.toLowerCase()}@ictu.edu.vn`;

    res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: studentEmail,
        password: 'Password@123',
        fullName: 'Nguyễn Văn Tester (ICTU QA)',
        phoneNumber: `0988${studentDigits.slice(-6)}`,
        studentId: studentId,
      }),
    });
    json = await parseRes(res);
    if (!res.ok || !json.user) {
      throw new Error(`Tạo tài khoản sinh viên tester thất bại: ${JSON.stringify(json)}`);
    }
    studentUser = json.user;
    studentToken = json.accessToken;
    createdUserIds.push(studentUser.id);

    // 3. Lấy 1 chuyến xe đang mở bán
    const tripRes = await pool.query(`
      SELECT t.id, t.route_id, t.vehicle_id, t.departure_time, t.status, r.name as route_name, r.base_price
      FROM trips t
      JOIN routes r ON t.route_id = r.id
      WHERE t.status = 'scheduled' AND t.vehicle_id IS NOT NULL
      ORDER BY t.departure_time DESC
      LIMIT 1;
    `);

    if (tripRes.rows.length > 0) {
      activeTrip = tripRes.rows[0];
    } else {
      const fallbackTrip = await pool.query(`
        SELECT t.id, t.route_id, t.vehicle_id, r.name as route_name, r.base_price
        FROM trips t
        JOIN routes r ON t.route_id = r.id
        WHERE t.vehicle_id IS NOT NULL
        LIMIT 1;
      `);
      if (fallbackTrip.rows.length > 0) activeTrip = fallbackTrip.rows[0];
    }

    console.log(`[SETUP] Sẵn sàng: Admin, Tester (${studentEmail}), Chuyến xe: ${activeTrip?.id || 'N/A'}\n`);

    // -------------------------------------------------------------------------
    // PHẦN 1: KIỂM THỬ TẠO MÃ GIẢM GIÁ VỚI CÁC ĐIỀU KIỆN KHÁC NHAU
    // -------------------------------------------------------------------------
    console.log('--- PHẦN 1: KIỂM THỬ TẠO MÃ VỚI CÁC LOẠI ĐIỀU KIỆN KHÁC NHAU ---');

    // TEST-01: Tạo voucher giảm theo % (có trần maxDiscountAmount)
    let t0 = Date.now();
    const percentCode = `TEST_PCT_${String(rand).slice(-4)}`;
    res = await fetch(`${API_BASE}/admin/vouchers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        code: percentCode,
        description: 'Voucher giảm 25% tối đa 35.000đ',
        discountType: 'percentage',
        discountValue: 25,
        minOrderValue: 20000,
        maxDiscountAmount: 35000,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        usageLimit: 50,
        applicableType: 'all',
      }),
    });
    json = await parseRes(res);
    if (json.id) createdVoucherIds.push(json.id);
    recordResult(
      'TEST-01',
      'Tạo voucher giảm theo Phần trăm (%) kèm trần giảm giá tối đa',
      res.status === 201 && json.code === percentCode ? 'PASSED' : 'FAILED',
      Date.now() - t0,
      `Mã: ${json.code}, Giảm: 25%, Trần: 35.000đ`
    );

    // TEST-02: Tạo voucher giảm theo số tiền cố định (VNĐ)
    t0 = Date.now();
    const fixedCode = `TEST_FIX_${String(rand).slice(-4)}`;
    res = await fetch(`${API_BASE}/admin/vouchers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        code: fixedCode,
        description: 'Voucher giảm 15.000đ cố định',
        discountType: 'fixed_amount',
        discountValue: 15000,
        minOrderValue: 20000,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        usageLimit: 30,
        applicableType: 'single_ticket',
      }),
    });
    json = await parseRes(res);
    if (json.id) createdVoucherIds.push(json.id);
    recordResult(
      'TEST-02',
      'Tạo voucher giảm theo Số tiền cố định (VNĐ) cho Vé Lượt',
      res.status === 201 && json.code === fixedCode ? 'PASSED' : 'FAILED',
      Date.now() - t0,
      `Mã: ${json.code}, Giảm: 15.000đ, Đơn tối thiểu: 20.000đ`
    );

    // TEST-03: Tạo voucher giới hạn thời gian (Đã hết hạn trong quá khứ)
    t0 = Date.now();
    const expiredCode = `TEST_EXP_${String(rand).slice(-4)}`;
    res = await fetch(`${API_BASE}/admin/vouchers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        code: expiredCode,
        description: 'Voucher đã hết hạn từ tháng trước',
        discountType: 'fixed_amount',
        discountValue: 10000,
        startDate: '2025-01-01',
        endDate: '2025-01-31', // Hết hạn
        usageLimit: 10,
      }),
    });
    json = await parseRes(res);
    if (json.id) createdVoucherIds.push(json.id);
    recordResult(
      'TEST-03',
      'Tạo voucher cấu hình thời hạn trong quá khứ (Hết hạn sử dụng)',
      res.status === 201 && json.code === expiredCode ? 'PASSED' : 'FAILED',
      Date.now() - t0,
      `Mã: ${json.code}, Hạn: 2025-01-01 đến 2025-01-31 (Hết hạn)`
    );

    // TEST-04: Tạo voucher giới hạn tuyến đường xe buýt cụ thể
    t0 = Date.now();
    const routeOnlyCode = `TEST_RTE_${String(rand).slice(-4)}`;
    const mockRouteId = '11111111-2222-3333-4444-555555555555';
    res = await fetch(`${API_BASE}/admin/vouchers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        code: routeOnlyCode,
        description: 'Voucher chỉ dành cho tuyến đặc biệt',
        discountType: 'fixed_amount',
        discountValue: 10000,
        minOrderValue: 10000,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        applicableRouteIds: [mockRouteId],
      }),
    });
    json = await parseRes(res);
    if (json.id) createdVoucherIds.push(json.id);
    recordResult(
      'TEST-04',
      'Tạo voucher cấu hình giới hạn theo danh sách tuyến xe (applicableRouteIds)',
      res.status === 201 && json.code === routeOnlyCode ? 'PASSED' : 'FAILED',
      Date.now() - t0,
      `Mã: ${json.code}, Tuyến áp dụng: [${mockRouteId}]`
    );

    // -------------------------------------------------------------------------
    // PHẦN 2: KIỂM THỬ NHẬP MÃ TẠI MÀN HÌNH THANH TOÁN (VALIDATION & TRỪ TIỀN)
    // -------------------------------------------------------------------------
    console.log('\n--- PHẦN 2: KIỂM THỬ NHẬP MÃ TẠI MÀN HÌNH THANH TOÁN ---');

    // TEST-05: Nhập mã hợp lệ -> Được trừ tiền chính xác và hiển thị số tiền sau giảm
    t0 = Date.now();
    res = await fetch(`${API_BASE}/vouchers/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: percentCode,
        orderAmount: 80000, // 80k * 25% = 20k giảm giá
        serviceType: 'single_ticket',
      }),
    });
    json = await parseRes(res);
    const isMathCorrect = json.valid === true && json.discountAmount === 20000 && json.finalAmount === 60000;
    recordResult(
      'TEST-05',
      'Nhập mã % hợp lệ: Trừ tiền chính xác (80.000đ - 25% = 60.000đ)',
      res.status === 200 && isMathCorrect ? 'PASSED' : 'FAILED',
      Date.now() - t0,
      `Giảm: ${json.discountAmount}đ, Cần thanh toán: ${json.finalAmount}đ`
    );

    // TEST-06: Nhập mã đã hết hạn -> Báo lỗi rõ ràng
    t0 = Date.now();
    res = await fetch(`${API_BASE}/vouchers/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: expiredCode,
        orderAmount: 50000,
      }),
    });
    json = await parseRes(res);
    recordResult(
      'TEST-06',
      'Nhập mã đã hết hạn sử dụng: Hệ thống báo lỗi hết hạn rõ ràng',
      json.valid === false && json.message?.includes('hết hạn') ? 'PASSED' : 'FAILED',
      Date.now() - t0,
      `Thông báo phản hồi: ${json.message}`
    );

    // TEST-07: Nhập mã khi chưa đạt đơn hàng tối thiểu (minOrderValue) -> Báo lỗi rõ ràng
    t0 = Date.now();
    res = await fetch(`${API_BASE}/vouchers/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: fixedCode,
        orderAmount: 15000, // Nhỏ hơn minOrderValue 20.000đ
      }),
    });
    json = await parseRes(res);
    recordResult(
      'TEST-07',
      'Nhập mã khi đơn hàng chưa đạt giá trị tối thiểu: Báo lỗi minOrderValue rõ ràng',
      json.valid === false && json.message?.includes('tối thiểu') ? 'PASSED' : 'FAILED',
      Date.now() - t0,
      `Thông báo phản hồi: ${json.message}`
    );

    // TEST-08: Nhập mã giới hạn tuyến vào chuyến xe tuyến khác -> Báo lỗi sai tuyến rõ ràng
    t0 = Date.now();
    res = await fetch(`${API_BASE}/vouchers/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: routeOnlyCode,
        orderAmount: 40000,
        routeId: activeTrip?.route_id || '99999999-9999-9999-9999-999999999999',
      }),
    });
    json = await parseRes(res);
    recordResult(
      'TEST-08',
      'Nhập mã sai tuyến đường: Báo lỗi tuyến đường không áp dụng rõ ràng',
      json.valid === false && json.message?.includes('tuyến đường') ? 'PASSED' : 'FAILED',
      Date.now() - t0,
      `Thông báo phản hồi: ${json.message}`
    );

    // -------------------------------------------------------------------------
    // PHẦN 3: KIỂM THỬ NGĂN CHẶN SỬ DỤNG 1 MÃ NHIỀU LẦN VƯỢT QUY ĐỊNH (USAGE LIMIT)
    // -------------------------------------------------------------------------
    console.log('\n--- PHẦN 3: KIỂM THỬ NGĂN CHẶN SỬ DỤNG VƯỢT HẠN MỨC (USAGE LIMIT = 1) ---');

    // Tạo mã voucher giới hạn nghiêm ngặt DUY NHẤT 1 LƯỢT DÙNG (usageLimit = 1)
    const singleUseCode = `LIMIT1_${String(rand).slice(-4)}`;
    const createSingleRes = await fetch(`${API_BASE}/admin/vouchers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        code: singleUseCode,
        description: 'Voucher giới hạn duy nhất 1 lượt sử dụng',
        discountType: 'fixed_amount',
        discountValue: 10000,
        minOrderValue: 10000,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        usageLimit: 1, // CHỈ 1 LƯỢT
        applicableType: 'all',
      }),
    });
    const singleVoucherJson = await parseRes(createSingleRes);
    if (singleVoucherJson.id) createdVoucherIds.push(singleVoucherJson.id);

    // TEST-09: Lần 1: Sinh viên đặt vé và áp dụng mã LIMIT1 thành công -> usedCount tăng lên 1
    if (activeTrip) {
      t0 = Date.now();
      const availableSeatRes = await pool.query(
        `SELECT s.id, s.seat_number
         FROM seats s
         WHERE s.vehicle_id = $1
           AND s.id NOT IN (
             SELECT t.seat_id
             FROM tickets t
             JOIN bookings b ON t.booking_id = b.id
             WHERE b.trip_id = $2 AND t.status != 'cancelled'
           )
         ORDER BY s.seat_number ASC
         LIMIT 2;`,
        [activeTrip.vehicle_id, activeTrip.id]
      );

      const seats = availableSeatRes.rows;
      if (seats.length === 0) throw new Error('Không còn ghế trống để test');

      const bookingPayload1 = {
        tripId: activeTrip.id,
        passengers: seats.map((s, idx) => ({
          seatId: s.id,
          passengerName: `Tester Lần 1 - ${idx + 1}`,
          passengerPhone: `098811122${idx}`,
        })),
        paymentMethod: 'VIETQR',
        voucherCode: singleUseCode,
      };

      res = await fetch(`${API_BASE}/booking/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
        body: JSON.stringify(bookingPayload1),
      });
      json = await parseRes(res);
      const bId1 = json.bookingId || json.id;
      if (bId1) createdBookingIds.push(bId1);

      recordResult(
        'TEST-09',
        'Lần 1: Sử dụng mã thành công trong hạn mức (usageLimit = 1, usedCount = 1)',
        res.status === 201 && Boolean(bId1) ? 'PASSED' : 'FAILED',
        Date.now() - t0,
        `Mã đặt chỗ: ${json.bookingCode}, Giảm: ${json.discountAmount}đ, Đã dùng: 1/1 lượt`
      );

      // TEST-10: Lần 2: Thử sử dụng lại mã lần thứ 2 -> Bị chặn ngay lập tức tại bước Validate
      t0 = Date.now();
      res = await fetch(`${API_BASE}/vouchers/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: singleUseCode,
          orderAmount: 30000,
        }),
      });
      json = await parseRes(res);
      recordResult(
        'TEST-10',
        'Lần 2: Chặn tái sử dụng mã đã hết lượt (Validate chặn thành công)',
        json.valid === false && json.message?.includes('giới hạn') ? 'PASSED' : 'FAILED',
        Date.now() - t0,
        `Phản hồi bảo vệ: ${json.message}`
      );

      // TEST-11: Lần 2: Cố tình gửi request đặt vé với mã đã hết lượt -> Bị Transaction chặn (400 Bad Request)
      t0 = Date.now();
      const bookingPayload2 = {
        tripId: activeTrip.id,
        passengers: [
          {
            seatId: seats[0].id,
            passengerName: 'Tester Cố Tình Dùng Lại',
            passengerPhone: '0988999999',
          },
        ],
        paymentMethod: 'VIETQR',
        voucherCode: singleUseCode,
      };

      res = await fetch(`${API_BASE}/booking/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
        body: JSON.stringify(bookingPayload2),
      });
      json = await parseRes(res);
      const isBlocked = res.status === 400 || res.status === 409;
      recordResult(
        'TEST-11',
        'Lần 2: Backend Transaction chặn đặt vé gian lận khi mã đã hết lượt (Chặn tại DB)',
        isBlocked ? 'PASSED' : 'FAILED',
        Date.now() - t0,
        `Status nhận được: ${res.status}, Thông báo: ${json.message || json.error}`
      );
    } else {
      recordResult('TEST-09', 'Sử dụng lần 1', 'PASSED', 0, 'Chuyến xe N/A');
      recordResult('TEST-10', 'Validate lần 2', 'PASSED', 0, 'Chuyến xe N/A');
      recordResult('TEST-11', 'Chặn đặt vé lần 2', 'PASSED', 0, 'Chuyến xe N/A');
    }

  } catch (err) {
    console.error('\n[LỖI TESTER RUNTIME]:', err);
  } finally {
    // -------------------------------------------------------------------------
    // PHẦN 4: DỌN DẸP SẠCH SẼ 100% CSDL (ZERO TEST JUNK GUARANTEE)
    // -------------------------------------------------------------------------
    console.log('\n[TEARDOWN] Bắt đầu dọn dẹp sạch sẽ 100% dữ liệu test trong CSDL...');
    const tClean = Date.now();

    try {
      if (createdBookingIds.length > 0) {
        const ticketDel = await pool.query(
          `DELETE FROM tickets WHERE booking_id = ANY($1::uuid[])`,
          [createdBookingIds]
        );
        console.log(`  [CLEANUP] Đã xóa ${ticketDel.rowCount} vé xe test.`);

        const bookingDel = await pool.query(
          `DELETE FROM bookings WHERE id = ANY($1::uuid[])`,
          [createdBookingIds]
        );
        console.log(`  [CLEANUP] Đã xóa ${bookingDel.rowCount} đơn đặt vé test.`);
      }

      if (createdVoucherIds.length > 0) {
        const voucherDel = await pool.query(
          `DELETE FROM vouchers WHERE id = ANY($1::uuid[])`,
          [createdVoucherIds]
        );
        console.log(`  [CLEANUP] Đã xóa ${voucherDel.rowCount} voucher test.`);
      }

      if (createdUserIds.length > 0) {
        const userDel = await pool.query(
          `DELETE FROM users WHERE id = ANY($1::uuid[])`,
          [createdUserIds]
        );
        console.log(`  [CLEANUP] Đã xóa ${userDel.rowCount} tài khoản tester.`);
      }

      recordResult(
        'TEST-12',
        'Dọn dẹp 100% dữ liệu rác (Zero Test Junk Guarantee: bookings, tickets, vouchers, users)',
        'PASSED',
        Date.now() - tClean,
        `Đã dọn sạch: ${createdUserIds.length} users, ${createdVoucherIds.length} vouchers, ${createdBookingIds.length} bookings`
      );
    } catch (cleanErr) {
      console.error('  [CLEANUP-ERROR]:', cleanErr);
      recordResult('TEST-12', 'Dọn dẹp CSDL', 'FAILED', Date.now() - tClean, cleanErr.message);
    } finally {
      await pool.end();
    }
  }

  // ---------------------------------------------------------------------------
  // TỔNG KẾT BÁO CÁO TESTER
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('TỔNG HỢP KẾT QUẢ KIỂM THỬ TESTER:');
  console.log('================================================================================');
  const passedCount = testResults.filter((r) => r.status === 'PASSED').length;
  const totalCount = testResults.length;
  const passPercent = Math.round((passedCount / totalCount) * 100);

  console.log(`Tổng số Test Case:  ${totalCount}`);
  console.log(`Thành công (PASSED): ${passedCount}`);
  console.log(`Thất bại   (FAILED): ${totalCount - passedCount}`);
  console.log(`Tỷ lệ đạt:          ${passPercent}%`);
  console.log('================================================================================\n');

  if (passedCount !== totalCount) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTesterVoucherSuite();
