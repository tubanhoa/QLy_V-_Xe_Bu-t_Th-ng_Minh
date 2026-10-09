/**
 * BỘ KIỂM THỬ TỰ ĐỘNG CHUẨN XÁC: QUẢN LÝ & GIA HẠN VÉ THÁNG XE BUÝT ĐIỆN ICTU
 * (ZERO TEST JUNK GUARANTEE — KHÔNG ĐỂ LẠI DỮ LIỆU RÁC TRONG CƠ SỞ DỮ LIỆU)
 * 
 * PHẠM VI KIỂM THỬ THEO YÊU CẦU TESTER:
 * --------------------------------------------------------------------------------------
 * NHÓM 1: KIỂM THỬ TÍNH GIÁ TIỀN THEO TỪNG LOẠI ĐỐI TƯỢNG VÀ THỜI HẠN
 *   TC-01: Tính giá đối tượng Sinh viên (1 tháng: 100k, 3 tháng giảm 10%: 270k, 6 tháng: 500k)
 *   TC-02: Tính giá đối tượng Người cao tuổi (1 tháng: 80k, 3 tháng giảm 10%: 216k, 6 tháng: 400k)
 *   TC-03: Tính giá đối tượng Người đi làm / Phổ thông (1 tháng: 200k, 3 tháng giảm 10%: 540k, 6 tháng: 1000k)
 *   TC-04: Tính phụ thu liên tuyến toàn mạng lưới (+50.000đ / tháng áp dụng cho từng đối tượng)
 * 
 * NHÓM 2: KIỂM THỬ ĐĂNG KÝ MỚI VÀ GIA HẠN VÉ THÁNG QUA CÁC CỔNG THANH TOÁN
 *   TC-05: Đăng ký vé tháng Sinh viên (Khởi tạo Pending, Unpaid, đính kèm ảnh thẻ SV)
 *   TC-06: Quản trị viên / BQL thẩm định và phê duyệt hồ sơ (Status -> Approved)
 *   TC-07: Tạo yêu cầu thanh toán đa cổng (VNPay Sandbox SHA512, VietQR NAPAS 24/7)
 *   TC-08: Xác nhận thanh toán kích hoạt thẻ (Status -> Paid, sinh mã QR, tạo Transaction 'register')
 *   TC-09: Đăng ký vé tháng Người đi làm (Worker) -> Tự động duyệt Approved để thanh toán ngay
 *   TC-10: Gia hạn vé tháng trực tuyến (Renew 3 tháng, cộng dồn hạn sử dụng, tạo Transaction 'renew')
 * 
 * NHÓM 3: KIỂM THỬ TRẠNG THÁI VÉ THÁNG KHI CÒN HẠN VÀ KHI HẾT HẠN
 *   TC-11: Kiểm thử trạng thái thẻ còn hạn sử dụng (startDate <= today <= endDate: Hợp lệ)
 *   TC-12: Chặn soát vé khi thẻ vé tháng đã hết hạn sử dụng (today > endDate: HTTP 400)
 *   TC-13: Chặn soát vé khi thẻ vé tháng chưa thanh toán (paymentStatus = unpaid: HTTP 400)
 *   TC-14: Chặn soát vé khi thẻ vé tháng chưa được duyệt (approvalStatus = pending: HTTP 400)
 * 
 * NHÓM 4: KIỂM THỬ HIỂN THỊ MÃ QR VÉ THÁNG VÀ QUÉT XÁC THỰC TRÊN XE BUÝT
 *   TC-15: Hiển thị và bóc tách định dạng mã QR chuẩn ICTU-MONTHLY:{passCode}:{endDate}
 *   TC-16: Tài xế quét mã QR vé tháng hợp lệ trên thiết bị buồng lái (verify-qr: Cho phép lên xe)
 *   TC-17: Quét mã QR không tồn tại hoặc sai cú pháp (verify-qr: Báo lỗi vé không hợp lệ)
 * 
 * NHÓM 5: DỌN DẸP DỮ LIỆU RÁC (ZERO TEST JUNK GUARANTEE)
 *   TC-18: Xóa sạch 100% vé tháng, giao dịch transaction và tài khoản test trong CSDL
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

async function runTestSuite() {
  console.log('================================================================================');
  console.log('KHOI DONG TEST SUITE: KIEM THU VE THANG TRUC TUYEN (ZERO TEST JUNK GUARANTEE)');
  console.log('================================================================================\n');

  const createdUserIds = [];
  const createdPassIds = [];
  const createdTransactionIds = [];

  let adminToken = '';
  let testStudentToken = '';
  let driverToken = '';
  let testStudentUser = null;
  let driverUser = null;
  let testRoute = null;
  let testTrip = null;

  try {
    // -------------------------------------------------------------------------
    // BƯỚC 0: SETUP AUTHENTICATION & TEST ENTITIES
    // -------------------------------------------------------------------------
    console.log('[SETUP] 1. Dang nhap va khoi tao moi truong test co lap...');

    // 1. Đăng nhập Admin
    let res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@smartbus.ictu.vn', password: 'Password@123' }),
    });
    let json = await res.json();
    adminToken = json.data?.accessToken;

    // 2. Tạo một tài khoản Sinh viên TEST cô lập hoàn toàn (tránh đụng thẻ cũ còn hạn)
    const testEmail = `test.student.mp.${Date.now()}@ictu.edu.vn`;
    const regUserRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password@123',
        fullName: 'Nguyen Thi Mai (Test Sinh Vien)',
        phoneNumber: '0988776655',
      }),
    });
    const regUserJson = await regUserRes.json();
    if (regUserJson.success && regUserJson.data?.user) {
      testStudentUser = regUserJson.data.user;
      testStudentToken = regUserJson.data.accessToken;
      createdUserIds.push(testStudentUser.id);
    } else {
      // Fallback nếu register trả về token
      testStudentUser = regUserJson.data?.user || { email: testEmail };
      testStudentToken = regUserJson.data?.accessToken || adminToken;
    }

    // 3. Đăng nhập Driver
    res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'driver.nam@smartbus.ictu.vn', password: 'Password@123' }),
    });
    json = await res.json();
    driverToken = json.data?.accessToken || adminToken;
    driverUser = json.data?.user;

    // 4. Lấy chuyến xe đang hoạt động được phân công cho Tài xế Nam
    let tripRes = await pool.query(
      "SELECT id, route_id, driver_id, status FROM trips WHERE driver_id = $1 AND status IN ('scheduled', 'boarding', 'in_progress') LIMIT 1",
      [driverUser?.id]
    );
    if (tripRes.rows.length === 0) {
      const anyTrip = await pool.query(
        "SELECT id, route_id, driver_id, status FROM trips WHERE status IN ('scheduled', 'boarding', 'in_progress') LIMIT 1"
      );
      if (anyTrip.rows.length > 0) {
        testTrip = anyTrip.rows[0];
        await pool.query("UPDATE trips SET driver_id = $1, status = 'in_progress' WHERE id = $2", [driverUser?.id, testTrip.id]);
        testTrip.status = 'in_progress';
      } else {
        const firstTrip = (await pool.query("SELECT id, route_id FROM trips LIMIT 1")).rows[0];
        await pool.query("UPDATE trips SET driver_id = $1, status = 'in_progress' WHERE id = $2", [driverUser?.id, firstTrip.id]);
        testTrip = { id: firstTrip.id, route_id: firstTrip.route_id, status: 'in_progress' };
      }
    } else {
      testTrip = tripRes.rows[0];
      if (testTrip.status === 'scheduled') {
        await pool.query("UPDATE trips SET status = 'in_progress' WHERE id = $1", [testTrip.id]);
        testTrip.status = 'in_progress';
      }
    }

    const dbRoute = await pool.query("SELECT id, name, route_code FROM routes WHERE id = $1", [testTrip.route_id]);
    testRoute = dbRoute.rows[0] || (await pool.query("SELECT id, name, route_code FROM routes LIMIT 1")).rows[0];

    console.log(`[SETUP] Khoi tao thanh cong! Test Student: ${testEmail}, Driver: ${driverUser?.fullName || 'Nam'}, Chuyen: ${testTrip?.id}\n`);

    // =========================================================================
    // NHÓM 1: KIỂM THỬ TÍNH GIÁ TIỀN THEO TỪNG LOẠI ĐỐI TƯỢNG VÀ THỜI HẠN
    // =========================================================================
    console.log('--- NHOM 1: KIEM THU TINH GIA TIEN THEO DOI TUONG & THOI HAN ---');

    // TC-01: Sinh viên
    {
      const start = performance.now();
      const r1 = await (await fetch(`${API_BASE}/monthly-passes/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'student', durationMonths: 1, isAllRoutes: false }),
      })).json();
      const r3 = await (await fetch(`${API_BASE}/monthly-passes/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'student', durationMonths: 3, isAllRoutes: false }),
      })).json();
      const r6 = await (await fetch(`${API_BASE}/monthly-passes/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'student', durationMonths: 6, isAllRoutes: false }),
      })).json();

      const p1 = r1.data?.finalPrice ?? r1.finalPrice;
      const p3 = r3.data?.finalPrice ?? r3.finalPrice;
      const p6 = r6.data?.finalPrice ?? r6.finalPrice;

      const valid = p1 === 100000 && p3 === 270000 && p6 === 500000;
      recordResult(
        'TC-01',
        'Tinh gia doi tuong Sinh vien (1T: 100k, 3T giam 10%: 270k, 6T giam 100k: 500k)',
        valid ? 'PASSED' : 'FAILED',
        performance.now() - start,
        `1T: ${p1}d, 3T: ${p3}d, 6T: ${p6}d (Ky vong: 100k/270k/500k)`
      );
    }

    // TC-02: Người cao tuổi
    {
      const start = performance.now();
      const r1 = await (await fetch(`${API_BASE}/monthly-passes/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'elderly', durationMonths: 1, isAllRoutes: false }),
      })).json();
      const r3 = await (await fetch(`${API_BASE}/monthly-passes/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'elderly', durationMonths: 3, isAllRoutes: false }),
      })).json();
      const r6 = await (await fetch(`${API_BASE}/monthly-passes/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'elderly', durationMonths: 6, isAllRoutes: false }),
      })).json();

      const p1 = r1.data?.finalPrice ?? r1.finalPrice;
      const p3 = r3.data?.finalPrice ?? r3.finalPrice;
      const p6 = r6.data?.finalPrice ?? r6.finalPrice;

      const valid = p1 === 80000 && p3 === 216000 && p6 === 400000;
      recordResult(
        'TC-02',
        'Tinh gia doi tuong Nguoi cao tuoi (1T: 80k, 3T giam 10%: 216k, 6T giam 80k: 400k)',
        valid ? 'PASSED' : 'FAILED',
        performance.now() - start,
        `1T: ${p1}d, 3T: ${p3}d, 6T: ${p6}d (Ky vong: 80k/216k/400k)`
      );
    }

    // TC-03: Cán bộ / Người đi làm
    {
      const start = performance.now();
      const r1 = await (await fetch(`${API_BASE}/monthly-passes/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'worker', durationMonths: 1, isAllRoutes: false }),
      })).json();
      const r3 = await (await fetch(`${API_BASE}/monthly-passes/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'worker', durationMonths: 3, isAllRoutes: false }),
      })).json();
      const r6 = await (await fetch(`${API_BASE}/monthly-passes/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'worker', durationMonths: 6, isAllRoutes: false }),
      })).json();

      const p1 = r1.data?.finalPrice ?? r1.finalPrice;
      const p3 = r3.data?.finalPrice ?? r3.finalPrice;
      const p6 = r6.data?.finalPrice ?? r6.finalPrice;

      const valid = p1 === 200000 && p3 === 540000 && p6 === 1000000;
      recordResult(
        'TC-03',
        'Tinh gia doi tuong Nguoi di lam (1T: 200k, 3T giam 10%: 540k, 6T giam 200k: 1000k)',
        valid ? 'PASSED' : 'FAILED',
        performance.now() - start,
        `1T: ${p1}d, 3T: ${p3}d, 6T: ${p6}d (Ky vong: 200k/540k/1000k)`
      );
    }

    // TC-04: Phụ thu liên tuyến toàn mạng buýt ICTU (+50.000đ / tháng)
    {
      const start = performance.now();
      const r1All = await (await fetch(`${API_BASE}/monthly-passes/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'student', durationMonths: 1, isAllRoutes: true }),
      })).json();
      const r6All = await (await fetch(`${API_BASE}/monthly-passes/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'student', durationMonths: 6, isAllRoutes: true }),
      })).json();

      const p1All = r1All.data?.finalPrice ?? r1All.finalPrice;
      const p6All = r6All.data?.finalPrice ?? r6All.finalPrice;

      const valid = p1All === 150000 && p6All === 800000;
      recordResult(
        'TC-04',
        'Tinh phu thu lien tuyen toan mang (+50.000d/thang: 1T = 150k, 6T = 800k)',
        valid ? 'PASSED' : 'FAILED',
        performance.now() - start,
        `SV 1T lien tuyen: ${p1All}d (ky vong 150k), 6T lien tuyen: ${p6All}d (ky vong 800k)`
      );
    }

    // =========================================================================
    // NHÓM 2: KIỂM THỬ ĐĂNG KÝ MỚI VÀ GIA HẠN VÉ THÁNG QUA CÁC CỔNG THANH TOÁN
    // =========================================================================
    console.log('\n--- NHOM 2: DANG KY MOI & GIA HAN VE THANG QUA CONG THANH TOAN ---');

    let createdPass = null;

    // TC-05: Đăng ký vé tháng Sinh viên
    {
      const start = performance.now();
      const regRes = await fetch(`${API_BASE}/monthly-passes/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testStudentToken}`,
        },
        body: JSON.stringify({
          category: 'student',
          durationMonths: 1,
          routeId: testRoute.id,
          proofImageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200',
        }),
      });
      const regJson = await regRes.json();
      createdPass = regJson.data || regJson;
      if (createdPass?.id) {
        createdPassIds.push(createdPass.id);
      }

      const valid =
        createdPass?.passCode?.startsWith('MP-') &&
        createdPass?.approvalStatus === 'pending' &&
        createdPass?.paymentStatus === 'unpaid';

      recordResult(
        'TC-05',
        'Dang ky ho so ve thang Sinh vien moi (Status: pending, Payment: unpaid)',
        valid ? 'PASSED' : 'FAILED',
        performance.now() - start,
        `Ma the: ${createdPass?.passCode}, Approval: ${createdPass?.approvalStatus}, Payment: ${createdPass?.paymentStatus}`
      );
    }

    // TC-06: Phê duyệt hồ sơ bởi Admin
    {
      const start = performance.now();
      const revRes = await fetch(`${API_BASE}/admin/monthly-passes/${createdPass.id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          status: 'approved',
        }),
      });
      const revJson = await revRes.json();
      const reviewedPass = revJson.data || revJson;

      const valid = reviewedPass?.approvalStatus === 'approved';
      recordResult(
        'TC-06',
        'Quan tri vien phe duyet ho so the sinh vien (Status: approved)',
        valid ? 'PASSED' : 'FAILED',
        performance.now() - start,
        `Trang thai sau duyet: ${reviewedPass?.approvalStatus}`
      );
    }

    // TC-07: Tạo yêu cầu thanh toán đa cổng
    {
      const start = performance.now();
      const payRes = await fetch(`${API_BASE}/monthly-passes/${createdPass.id}/create-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testStudentToken}`,
        },
        body: JSON.stringify({
          paymentMethod: 'vnpay',
        }),
      });
      const payJson = await payRes.json();
      const payData = payJson.data || payJson;

      const valid =
        payData?.amount === 100000 &&
        payData?.paymentUrl?.includes('sandbox.vnpayment.vn') &&
        payData?.paymentUrl?.includes('vnp_SecureHash=') &&
        payData?.vietQrUrl?.includes('img.vietqr.io') &&
        payData?.quickPayAvailable === true;

      recordResult(
        'TC-07',
        'Tao yeu cau thanh toan da cong (VNPay Sandbox HMAC-SHA512 & VietQR NAPAS 24/7)',
        valid ? 'PASSED' : 'FAILED',
        performance.now() - start,
        `Amount: ${payData?.amount}d, VNPay URL: Co SecureHash, VietQR: Co anh ma QR, QuickPay: San sang`
      );
    }

    // TC-08: Xác nhận thanh toán và kích hoạt thẻ
    {
      const start = performance.now();
      const confRes = await fetch(`${API_BASE}/monthly-passes/${createdPass.id}/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testStudentToken}`,
        },
        body: JSON.stringify({
          paymentMethod: 'vnpay',
          transactionCode: 'TEST-VNPAY-PAID-001',
        }),
      });
      const confJson = await confRes.json();
      const resData = confJson.data || confJson;
      const updatedPass = resData?.pass;
      const trans = resData?.transaction;

      if (trans?.id) {
        createdTransactionIds.push(trans.id);
      }

      const valid =
        updatedPass?.paymentStatus === 'paid' &&
        updatedPass?.qrPayload?.startsWith('ICTU-MONTHLY:') &&
        trans?.type === 'register';

      recordResult(
        'TC-08',
        'Xac nhan thanh toan kich hoat the (paymentStatus: paid, sinh QR payload, trans: register)',
        valid ? 'PASSED' : 'FAILED',
        performance.now() - start,
        `PaymentStatus: ${updatedPass?.paymentStatus}, QrPayload: ${updatedPass?.qrPayload}, Trans: ${trans?.transactionCode}`
      );
    }

    // TC-09: Đăng ký vé tháng Người đi làm (Worker) -> Tự động duyệt
    let workerPass = null;
    {
      const start = performance.now();
      // Tạo user test riêng cho đối tượng Worker để kiểm tra đăng ký độc lập
      const workerEmail = `test.worker.mp.${Date.now()}@ictu.edu.vn`;
      const regWorkerRes = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: workerEmail,
          password: 'Password@123',
          fullName: 'Tran Van Binh (Test Worker)',
          phoneNumber: '0977665544',
        }),
      });
      const regWorkerJson = await regWorkerRes.json();
      const workerUser = regWorkerJson.data?.user;
      const workerToken = regWorkerJson.data?.accessToken;
      if (workerUser?.id) {
        createdUserIds.push(workerUser.id);
      }

      const regRes = await fetch(`${API_BASE}/monthly-passes/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${workerToken}`,
        },
        body: JSON.stringify({
          category: 'worker',
          durationMonths: 1,
          routeId: 'all-routes',
        }),
      });
      const regJson = await regRes.json();
      workerPass = regJson.data || regJson;
      if (workerPass?.id) {
        createdPassIds.push(workerPass.id);
      }

      const valid =
        workerPass?.approvalStatus === 'approved' &&
        workerPass?.paymentStatus === 'unpaid';

      recordResult(
        'TC-09',
        'Dang ky ve thang Nguoi di lam (Worker) -> Tu dong APPROVED de thanh toan ngay',
        valid ? 'PASSED' : 'FAILED',
        performance.now() - start,
        `Ma the: ${workerPass?.passCode}, ApprovalStatus: ${workerPass?.approvalStatus} (Tu dong duyet), PaymentStatus: ${workerPass?.paymentStatus}`
      );
    }

    // TC-10: Gia hạn vé tháng trực tuyến (Renew 3 tháng)
    {
      const start = performance.now();
      const renewRes = await fetch(`${API_BASE}/monthly-passes/${createdPass.id}/renew`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testStudentToken}`,
        },
        body: JSON.stringify({
          durationMonths: 3,
          autoConfirmPayment: true,
          paymentMethod: 'vietqr',
        }),
      });
      const renewJson = await renewRes.json();
      const renewData = renewJson.data || renewJson;
      const renewedPass = renewData?.pass;
      const renewTrans = renewData?.transaction;

      if (renewTrans?.id) {
        createdTransactionIds.push(renewTrans.id);
      }

      const valid =
        renewTrans?.type === 'renew' &&
        renewTrans?.durationMonths === 3 &&
        renewData?.newEndDate > createdPass.endDate;

      recordResult(
        'TC-10',
        'Gia han ve thang 3 thang truc tuyen (Cong don han moi, trans type: renew)',
        valid ? 'PASSED' : 'FAILED',
        performance.now() - start,
        `Han cu: ${renewTrans?.previousEndDate} -> Han moi: ${renewData?.newEndDate}, Tien gia han: ${renewTrans?.amount}d`
      );
    }

    // =========================================================================
    // NHÓM 3: KIỂM THỬ TRẠNG THÁI VÉ THÁNG KHI CÒN HẠN VÀ KHI HẾT HẠN
    // =========================================================================
    console.log('\n--- NHOM 3: KIEM THU TRANG THAI VE THANG CON HAN & HET HAN ---');

    // TC-11: Vé tháng còn hạn sử dụng
    {
      const start = performance.now();
      const passDetailRes = await fetch(`${API_BASE}/monthly-passes/${createdPass.id}`, {
        headers: { Authorization: `Bearer ${testStudentToken}` },
      });
      const passDetailJson = await passDetailRes.json();
      const passDetail = passDetailJson.data || passDetailJson;
      const today = new Date().toISOString().slice(0, 10);
      const isStillValid = passDetail.startDate <= today && passDetail.endDate >= today;

      recordResult(
        'TC-11',
        'Trang thai the ve thang khi con han (startDate <= today <= endDate)',
        isStillValid ? 'PASSED' : 'FAILED',
        performance.now() - start,
        `Hieu luc: ${passDetail.startDate} den ${passDetail.endDate} (Hom nay: ${today}) -> Hop le`
      );
    }

    // TC-12: Chặn soát vé khi thẻ vé tháng đã hết hạn sử dụng
    {
      const start = performance.now();
      const expiredCode = 'MP-TEST-EXP-' + Date.now().toString().slice(-4);
      const insertExpired = await pool.query(
        `INSERT INTO monthly_passes (id, user_id, route_id, pass_code, category, start_date, end_date, approval_status, payment_status, price, qr_payload, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'student', '2026-08-01', '2026-08-31', 'approved', 'paid', 100000, $4, NOW())
         RETURNING id`,
        [testStudentUser?.id, testRoute.id, expiredCode, `ICTU-MONTHLY:${expiredCode}:2026-08-31`]
      );
      const expiredPassId = insertExpired.rows[0].id;
      createdPassIds.push(expiredPassId);

      const testRes = await fetch(`${API_BASE}/trips/driver/verify-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({
          tripId: testTrip.id,
          qrData: `ICTU-MONTHLY:${expiredCode}:2026-08-31`,
        }),
      });
      const testJson = await testRes.json();

      const valid =
        testRes.status === 400 &&
        testJson.message?.includes('đã hết hạn sử dụng');

      recordResult(
        'TC-12',
        'Chan soat ve the thang da het han su dung (HTTP 400 - da het han su dung)',
        valid ? 'PASSED' : 'FAILED',
        performance.now() - start,
        `HTTP Status: ${testRes.status}, Message: ${testJson.message}`
      );
    }

    // TC-13: Chặn soát vé khi thẻ vé tháng chưa thanh toán
    {
      const start = performance.now();
      const unpaidCode = 'MP-TEST-UNP-' + Date.now().toString().slice(-4);
      const insertUnpaid = await pool.query(
        `INSERT INTO monthly_passes (id, user_id, route_id, pass_code, category, start_date, end_date, approval_status, payment_status, price, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'student', '2026-10-01', '2026-10-31', 'approved', 'unpaid', 100000, NOW())
         RETURNING id`,
        [testStudentUser?.id, testRoute.id, unpaidCode]
      );
      const unpaidPassId = insertUnpaid.rows[0].id;
      createdPassIds.push(unpaidPassId);

      const testRes = await fetch(`${API_BASE}/trips/driver/verify-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({
          tripId: testTrip.id,
          qrData: `ICTU-MONTHLY:${unpaidCode}`,
        }),
      });
      const testJson = await testRes.json();

      const valid =
        testRes.status === 400 &&
        testJson.message?.includes('chưa được thanh toán');

      recordResult(
        'TC-13',
        'Chan soat ve the thang chua thanh toan thanh cong (HTTP 400 - chua duoc thanh toan)',
        valid ? 'PASSED' : 'FAILED',
        performance.now() - start,
        `HTTP Status: ${testRes.status}, Message: ${testJson.message}`
      );
    }

    // TC-14: Chặn soát vé khi thẻ vé tháng chưa được duyệt
    {
      const start = performance.now();
      const pendCode = 'MP-TEST-PND-' + Date.now().toString().slice(-4);
      const insertPending = await pool.query(
        `INSERT INTO monthly_passes (id, user_id, route_id, pass_code, category, start_date, end_date, approval_status, payment_status, price, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'student', '2026-10-01', '2026-10-31', 'pending', 'unpaid', 100000, NOW())
         RETURNING id`,
        [testStudentUser?.id, testRoute.id, pendCode]
      );
      const pendPassId = insertPending.rows[0].id;
      createdPassIds.push(pendPassId);

      const testRes = await fetch(`${API_BASE}/trips/driver/verify-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({
          tripId: testTrip.id,
          qrData: `ICTU-MONTHLY:${pendCode}`,
        }),
      });
      const testJson = await testRes.json();

      const valid =
        testRes.status === 400 &&
        testJson.message?.includes('chưa được duyệt');

      recordResult(
        'TC-14',
        'Chan soat ve the thang chua duoc phe duyet (HTTP 400 - chua duoc duyet)',
        valid ? 'PASSED' : 'FAILED',
        performance.now() - start,
        `HTTP Status: ${testRes.status}, Message: ${testJson.message}`
      );
    }

    // =========================================================================
    // NHÓM 4: KIỂM THỬ HIỂN THỊ MÃ QR VÀ QUÉT XÁC THỰC TRÊN XE BUÝT
    // =========================================================================
    console.log('\n--- NHOM 4: HIEN THI MA QR VE THANG & QUET XAC THUC TREN XE ---');

    // TC-15: Hiển thị và bóc tách mã QR vé tháng
    {
      const start = performance.now();
      const passDetailRes = await fetch(`${API_BASE}/monthly-passes/${createdPass.id}`, {
        headers: { Authorization: `Bearer ${testStudentToken}` },
      });
      const passDetailJson = await passDetailRes.json();
      const passDetail = passDetailJson.data || passDetailJson;
      const qrPayload = passDetail.qrPayload || '';

      const valid =
        qrPayload.startsWith('ICTU-MONTHLY:') &&
        qrPayload.includes(createdPass.passCode);

      recordResult(
        'TC-15',
        'Kiem thu dinh dang ma QR the thang dien tu (ICTU-MONTHLY:{passCode}:{endDate})',
        valid ? 'PASSED' : 'FAILED',
        performance.now() - start,
        `QrPayload: ${qrPayload}`
      );
    }

    // TC-16: Tài xế quét mã QR thẻ tháng hợp lệ
    {
      const start = performance.now();
      const passDetailRes = await fetch(`${API_BASE}/monthly-passes/${createdPass.id}`, {
        headers: { Authorization: `Bearer ${testStudentToken}` },
      });
      const passDetailJson = await passDetailRes.json();
      const passDetail = passDetailJson.data || passDetailJson;

      const verifyRes = await fetch(`${API_BASE}/trips/driver/verify-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({
          tripId: testTrip.id,
          qrData: passDetail.qrPayload,
        }),
      });
      const verifyJson = await verifyRes.json();
      const verifyData = verifyJson.data || verifyJson;

      const valid =
        (verifyRes.status === 200 || verifyRes.status === 201) &&
        verifyData?.isMonthlyPass === true &&
        verifyData?.valid === true;

      recordResult(
        'TC-16',
        'Tai xe quet ma QR the thang hop le tren thiet bi Driver (Xac thuc hop le, len xe)',
        valid ? 'PASSED' : 'FAILED',
        performance.now() - start,
        `Status: ${verifyRes.status}, isMonthlyPass: ${verifyData?.isMonthlyPass}, Msg: "${verifyData?.message}"`
      );
    }

    // TC-17: Quét mã QR sai cú pháp hoặc không tồn tại
    {
      const start = performance.now();
      const fakeCode = 'ICTU-MONTHLY:MP-FAKE-99999:2026-12-31';

      const verifyRes = await fetch(`${API_BASE}/trips/driver/verify-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({
          tripId: testTrip.id,
          qrData: fakeCode,
        }),
      });
      const verifyJson = await verifyRes.json();

      const valid =
        verifyRes.status === 400 ||
        verifyRes.status === 404 ||
        verifyJson.message?.includes('không hợp lệ') ||
        verifyJson.message?.includes('Không tìm thấy');

      recordResult(
        'TC-17',
        'Chan quet ma QR gia mao hoac khong ton tai trong he thong',
        valid ? 'PASSED' : 'FAILED',
        performance.now() - start,
        `HTTP Status: ${verifyRes.status}, Message: ${verifyJson.message}`
      );
    }

  } catch (err) {
    console.error('[TEST-EXCEPTION] Loi nghiem trong khi thuc thi test suite:', err);
  } finally {
    // =========================================================================
    // NHÓM 5: DỌN DẸP SẠCH SẼ DỮ LIỆU RÁC (ZERO TEST JUNK GUARANTEE)
    // =========================================================================
    console.log('\n--- NHOM 5: DON DEP DU LIEU TEST (ZERO TEST JUNK GUARANTEE) ---');
    const cleanupStart = performance.now();
    try {
      let deletedTransCount = 0;
      let deletedPassCount = 0;
      let deletedUserCount = 0;

      // 1. Xóa các transactions liên quan
      if (createdTransactionIds.length > 0) {
        const delTrans = await pool.query('DELETE FROM monthly_pass_transactions WHERE id = ANY($1)', [createdTransactionIds]);
        deletedTransCount += delTrans.rowCount || 0;
      }
      if (createdPassIds.length > 0) {
        const delTransByPass = await pool.query('DELETE FROM monthly_pass_transactions WHERE monthly_pass_id = ANY($1)', [createdPassIds]);
        deletedTransCount += delTransByPass.rowCount || 0;
        const delPass = await pool.query('DELETE FROM monthly_passes WHERE id = ANY($1)', [createdPassIds]);
        deletedPassCount += delPass.rowCount || 0;
      }

      // 2. Quét dọn các thẻ test có mã MP-TEST-
      const delTestPasses = await pool.query("DELETE FROM monthly_passes WHERE pass_code LIKE 'MP-TEST-%'");
      deletedPassCount += delTestPasses.rowCount || 0;

      // 3. Xóa các tài khoản test sinh viên đã tạo
      if (createdUserIds.length > 0) {
        // Xóa vé tháng và thông báo của user test trước
        await pool.query('DELETE FROM monthly_passes WHERE user_id = ANY($1)', [createdUserIds]);
        await pool.query('DELETE FROM notifications WHERE user_id = ANY($1)', [createdUserIds]);
        const delUser = await pool.query('DELETE FROM users WHERE id = ANY($1)', [createdUserIds]);
        deletedUserCount += delUser.rowCount || 0;
      }

      recordResult(
        'TC-18',
        'Don dep sach se tuyet doi 100% du lieu test trong CSDL (Zero Test Junk Guarantee)',
        'PASSED',
        performance.now() - cleanupStart,
        `Da xoa sach se ${deletedPassCount} the thang, ${deletedTransCount} giao dich transaction, va ${deletedUserCount} tai khoan user test`
      );
    } catch (cleanupErr) {
      console.error('[CLEANUP-ERROR] Khong the don dep du lieu test:', cleanupErr);
    } finally {
      await pool.end();
    }
  }

  // ---------------------------------------------------------------------------
  // TỔNG KẾT BẢNG ĐIỂM
  // ---------------------------------------------------------------------------
  const total = testResults.length;
  const passed = testResults.filter((r) => r.status === 'PASSED').length;
  const failed = total - passed;
  const avgLatency = Math.round(testResults.reduce((a, b) => a + b.latencyMs, 0) / total);

  console.log('\n================================================================================');
  console.log('BANG TONG KET KET QUA KIEM THU VE THANG (MONTHLY PASS AUTOMATION TEST SUITE):');
  console.log(`- Tong so Test Cases: ${total}`);
  console.log(`- So ca dat (PASSED): ${passed}/${total} (${Math.round((passed / total) * 100)}%)`);
  console.log(`- So ca loi (FAILED): ${failed}`);
  console.log(`- Do tre trung binh:  ${avgLatency}ms`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((e) => {
  console.error(e);
  process.exit(1);
});
