import dotenv from 'dotenv';
import path from 'path';
import pg from '../backend/node_modules/pg/lib/index.js';

dotenv.config({ path: path.resolve('backend', '.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const API_BASE = 'http://127.0.0.1:3001/api/v1';

async function runTesterVerification() {
  console.log('='.repeat(85));
  console.log('🕵️  BỘ KIỂM THỬ TOÀN DIỆN QA/TESTER: BÁO CÁO DOANH THU & HIỆU QUẢ TÀI CHÍNH');
  console.log('    (ĐỐI SOÁT TRỰC TIẾP CSDL SUPABASE, BỘ LỌC ĐA CHIỀU, PHÂN QUYỀN RBAC & BẢO MẬT)');
  console.log('='.repeat(85));

  let passed = 0;
  let failed = 0;

  function assert(condition, message, detail = '') {
    if (!condition) {
      failed++;
      console.error(`  ❌ [FAIL]: ${message} ${detail ? `-> (${detail})` : ''}`);
      throw new Error(message);
    } else {
      passed++;
      console.log(`  ✔ [PASS]: ${message} ${detail ? `| ${detail}` : ''}`);
    }
  }

  // =========================================================================
  // PHẦN 1: ĐỐI SOÁT TÍNH CHÍNH XÁC CỦA SỐ LIỆU SO VỚI LỊCH SỬ GIAO DỊCH THỰC TẾ CSDL
  // =========================================================================
  console.log('\n--- PHẦN 1: ĐỐI SOÁT CHÍNH XÁC SỐ LIỆU BÁO CÁO VS CSDL SUPABASE POSTGRESQL ---');

  // 1.1 Query trực tiếp CSDL đếm số liệu thô
  const dbSummaryQuery = `
    SELECT 
      COALESCE(SUM(b.final_amount), 0)::bigint AS "dbRevenue",
      COALESCE(SUM(b.discount_amount), 0)::bigint AS "dbDiscount",
      COUNT(DISTINCT b.id)::int AS "dbBookings"
    FROM bookings b
    WHERE b.status IN ('paid', 'confirmed');
  `;
  const dbSummaryRes = await pool.query(dbSummaryQuery);
  const dbSummary = dbSummaryRes.rows[0];

  // Đếm cả số vé vật lý trong bảng tickets và số vé theo logic nghiệp vụ booking
  const dbPhysicalTicketsRes = await pool.query(`
    SELECT COUNT(t.id)::int AS "cnt"
    FROM tickets t
    INNER JOIN bookings b ON b.id = t.booking_id
    WHERE b.status IN ('paid', 'confirmed') AND t.status NOT IN ('cancelled', 'expired');
  `);
  const physicalTicketsCount = dbPhysicalTicketsRes.rows[0].cnt;

  const dbAggTicketsRes = await pool.query(`
    SELECT COALESCE(SUM(GREATEST(COALESCE(tc.cnt, 0), 1)), 0)::int AS "cnt"
    FROM bookings b
    LEFT JOIN (
      SELECT booking_id, COUNT(id) as cnt 
      FROM tickets 
      WHERE status NOT IN ('cancelled', 'expired') 
      GROUP BY booking_id
    ) tc ON tc.booking_id = b.id
    WHERE b.status IN ('paid', 'confirmed');
  `);
  const dbTicketsCount = dbAggTicketsRes.rows[0].cnt;

  console.log(`  [CSDL Thực tế]: Tổng doanh thu: ${Number(dbSummary.dbRevenue).toLocaleString('vi-VN')} đ | Bookings: ${dbSummary.dbBookings} | Vé quy đổi: ${dbTicketsCount} (Vé vật lý: ${physicalTicketsCount})`);

  // 1.2 Đăng nhập Admin và gọi API
  const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smartbus.ictu.vn', password: 'Password@123' }),
  });
  const adminToken = (await adminLoginRes.json()).data.accessToken;

  const apiReportRes = await fetch(`${API_BASE}/reports/revenue`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const apiReportJson = await apiReportRes.json();
  const apiData = apiReportJson.data;

  // 1.3 Đối chiếu khớp 100% từng số liệu
  assert(
    Number(apiData.summary.totalRevenue) === Number(dbSummary.dbRevenue),
    'Doanh thu tổng API khớp 100% với CSDL PostgreSQL',
    `API: ${apiData.summary.totalRevenue} đ == CSDL: ${dbSummary.dbRevenue} đ`
  );
  assert(
    Number(apiData.summary.totalPaidBookings) === Number(dbSummary.dbBookings),
    'Số lượng Bookings khớp 100% với CSDL',
    `API: ${apiData.summary.totalPaidBookings} == CSDL: ${dbSummary.dbBookings}`
  );
  assert(
    Number(apiData.summary.totalTicketsSold) === Number(dbTicketsCount),
    'Số lượng Vé bán ra khớp 100% với CSDL',
    `API: ${apiData.summary.totalTicketsSold} == CSDL: ${dbTicketsCount}`
  );
  assert(
    Number(apiData.summary.totalDiscount) === Number(dbSummary.dbDiscount),
    'Tổng tiền trợ giá/Voucher khớp 100% với CSDL',
    `API: ${apiData.summary.totalDiscount} đ == CSDL: ${dbSummary.dbDiscount} đ`
  );

  // 1.4 Đối chiếu doanh thu theo từng tuyến xe với CSDL
  const dbRoutesQuery = `
    SELECT 
      r.route_code AS "routeCode",
      COALESCE(SUM(b.final_amount), 0)::bigint AS "routeRevenue",
      COALESCE(SUM(GREATEST(COALESCE(tc.cnt, 0), 1)), 0)::int AS "routeTickets"
    FROM routes r
    INNER JOIN trips tr ON tr.route_id = r.id
    INNER JOIN bookings b ON b.trip_id = tr.id AND b.status IN ('paid', 'confirmed')
    LEFT JOIN (
      SELECT booking_id, COUNT(id) as cnt 
      FROM tickets 
      WHERE status NOT IN ('cancelled', 'expired') 
      GROUP BY booking_id
    ) tc ON tc.booking_id = b.id
    GROUP BY r.id, r.route_code
    ORDER BY "routeRevenue" DESC;
  `;
  const dbRoutesRes = await pool.query(dbRoutesQuery);
  for (const rRow of dbRoutesRes.rows) {
    const apiRoute = apiData.revenueByRoute.find((r) => r.routeCode === rRow.routeCode);
    assert(
      Boolean(apiRoute),
      `Tuyến [${rRow.routeCode}] có mặt đầy đủ trong báo cáo API`,
      `CSDL: ${rRow.routeCode}`
    );
    assert(
      Number(apiRoute.revenue) === Number(rRow.routeRevenue),
      `Doanh thu tuyến [${rRow.routeCode}] khớp 100% với CSDL`,
      `API: ${apiRoute.revenue} đ == CSDL: ${rRow.routeRevenue} đ`
    );
  }

  // =========================================================================
  // PHẦN 2: KIỂM THỬ BỘ LỌC THEO THỜI GIAN VÀ TUYẾN XE
  // =========================================================================
  console.log('\n--- PHẦN 2: KIỂM THỬ BỘ LỌC ĐA CHIỀU (THỜI GIAN, TUYẾN XE, KÊNH THANH TOÁN) ---');

  // 2.1 Lọc ngày cụ thể có giao dịch: 2026-10-10 (40.000 đ)
  const filterDateRes = await fetch(`${API_BASE}/reports/revenue?startDate=2026-10-10&endDate=2026-10-10`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const filterDateJson = await filterDateRes.json();
  assert(filterDateRes.status === 200, 'Lọc ngày cụ thể 2026-10-10 trả về HTTP 200');
  assert(
    filterDateJson.data.summary.totalRevenue === 40000,
    'Doanh thu ngày 2026-10-10 khớp chính xác 40.000 đ',
    `Doanh thu: ${filterDateJson.data.summary.totalRevenue} đ (${filterDateJson.data.summary.totalPaidBookings} booking)`
  );

  // 2.2 Lọc khoảng ngày toàn bộ kỳ: 2026-10-08 đến 2026-10-12
  const filterRangeRes = await fetch(`${API_BASE}/reports/revenue?startDate=2026-10-08&endDate=2026-10-12`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const filterRangeJson = await filterRangeRes.json();
  assert(filterRangeRes.status === 200, 'Lọc khoảng ngày 2026-10-08 đến 2026-10-12 trả về HTTP 200');
  assert(
    filterRangeJson.data.summary.totalRevenue === 107000,
    'Tổng doanh thu toàn kỳ khớp chính xác 107.000 đ',
    `Doanh thu: ${filterRangeJson.data.summary.totalRevenue} đ`
  );

  // 2.2 Lọc ngày không có giao dịch (Ngày tương lai)
  const emptyDateRes = await fetch(`${API_BASE}/reports/revenue?startDate=2026-12-01&endDate=2026-12-05`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const emptyDateJson = await emptyDateRes.json();
  assert(emptyDateRes.status === 200, 'Lọc khoảng ngày không có giao dịch trả về HTTP 200');
  assert(emptyDateJson.data.summary.totalRevenue === 0, 'Xử lý chuẩn xác khi doanh thu bằng 0');
  assert(emptyDateJson.data.timeline.length === 0, 'Timeline trả về mảng rỗng [] không bị null crash');

  // 2.3 Lọc theo tuyến xe CT-02
  const ct02Route = apiData.revenueByRoute.find((r) => r.routeCode === 'CT-02');
  if (ct02Route?.routeId) {
    const filterRouteRes = await fetch(`${API_BASE}/reports/revenue?routeId=${ct02Route.routeId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const filterRouteJson = await filterRouteRes.json();
    assert(filterRouteRes.status === 200, 'Lọc theo tuyến CT-02 trả về HTTP 200');
    assert(
      filterRouteJson.data.summary.totalRevenue === ct02Route.revenue,
      `Doanh thu sau lọc bằng đúng doanh thu tuyến CT-02 (${ct02Route.revenue} đ)`,
      `Nhận diện đúng: ${filterRouteJson.data.revenueByRoute[0]?.routeCode}`
    );
  }

  // 2.4 Lọc kết hợp Tuyến xe + Khoảng thời gian
  if (ct02Route?.routeId) {
    const comboRes = await fetch(
      `${API_BASE}/reports/revenue?routeId=${ct02Route.routeId}&startDate=2026-10-08&endDate=2026-10-12`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const comboJson = await comboRes.json();
    assert(comboRes.status === 200, 'Lọc kết hợp Tuyến CT-02 + Khoảng ngày trả về HTTP 200');
    assert(comboJson.data.summary.totalRevenue === 32000, 'Kết quả lọc kết hợp khớp chính xác 32.000 đ');
  }

  // =========================================================================
  // PHẦN 3: KIỂM THỬ PHÂN QUYỀN TRUY CẬP (RBAC SECURITY TESTING)
  // =========================================================================
  console.log('\n--- PHẦN 3: KIỂM THỬ BẢO MẬT PHÂN QUYỀN TRUY CẬP (RBAC GUARDS) ---');

  // 3.1 Khách vãng lai (Chưa đăng nhập / Unauthenticated)
  const unauthRes = await fetch(`${API_BASE}/reports/revenue`);
  assert(
    unauthRes.status === 401,
    'Chặn truy cập khách vãng lai không có token với HTTP 401 Unauthorized',
    `Status: ${unauthRes.status}`
  );

  // 3.2 Tài khoản Quản lý (MANAGER) -> Được phép truy cập
  const managerLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manager@smartbus.ictu.vn', password: 'Password@123' }),
  });
  const managerToken = (await managerLoginRes.json())?.data?.accessToken;
  if (managerToken) {
    const managerRes = await fetch(`${API_BASE}/reports/revenue`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert(
      managerRes.status === 200,
      'Cho phép tài khoản Điều hành / Quản lý (MANAGER) truy cập báo cáo',
      `HTTP ${managerRes.status}`
    );
  } else {
    console.log('  ⚠️ Bỏ qua test Manager (tài khoản manager chưa seed)');
  }

  // 3.3 Tài khoản Tài xế (DRIVER) -> BỊ CHẶN 403 FORBIDDEN
  const driverLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'driver.nam@smartbus.ictu.vn', password: 'Password@123' }),
  });
  const driverToken = (await driverLoginRes.json())?.data?.accessToken;
  if (driverToken) {
    const driverRes = await fetch(`${API_BASE}/reports/revenue`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    assert(
      driverRes.status === 403,
      'CHẶN THÀNH CÔNG tài khoản Tài xế (DRIVER) với HTTP 403 Forbidden',
      `HTTP ${driverRes.status} (Bảo mật quyền hạn)`
    );
  }

  // 3.4 Tài khoản Hành khách / Sinh viên (PASSENGER) -> BỊ CHẶN 403 FORBIDDEN
  const studentLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student.an@ictu.edu.vn', password: 'Password@123' }),
  });
  const studentToken = (await studentLoginRes.json())?.data?.accessToken;
  if (studentToken) {
    const studentRes = await fetch(`${API_BASE}/reports/revenue`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(
      studentRes.status === 403,
      'CHẶN THÀNH CÔNG tài khoản Sinh viên/Khách (PASSENGER) với HTTP 403 Forbidden',
      `HTTP ${studentRes.status} (Bảo mật quyền hạn)`
    );
  }

  await pool.end();

  console.log('\n' + '='.repeat(85));
  console.log('🎉 TỔNG KẾT BÁO CÁO KIỂM THỬ QA/TESTER:');
  console.log(`   Tổng số Test Cases: ${passed + failed}`);
  console.log(`   Thành công (PASSED): ${passed}`);
  console.log(`   Thất bại   (FAILED): ${failed}`);
  console.log(`   Tỷ lệ đạt chuẩn:     100%`);
  console.log('='.repeat(85));
}

runTesterVerification().catch((err) => {
  console.error('\n❌ FATAL TEST RUNTIME ERROR:', err);
  process.exit(1);
});
