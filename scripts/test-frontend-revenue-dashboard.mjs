import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('backend', '.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

const API_BASE = 'http://127.0.0.1:3001/api/v1';

async function runFrontendIntegrationTest() {
  console.log('='.repeat(80));
  console.log('🧪 KIỂM THỬ TÍCH HỢP FRONTEND DASHBOARD BÁO CÁO DOANH THU & BIỂU ĐỒ');
  console.log('='.repeat(80));

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (!cond) {
      failed++;
      console.error(`  ❌ [FAILED]: ${msg}`);
      throw new Error(msg);
    } else {
      passed++;
      console.log(`  ✔ [PASSED]: ${msg}`);
    }
  }

  // 1. Đăng nhập Admin lấy token
  console.log('\n[BƯỚC 1] Xác thực tài khoản Quản trị viên (Admin)...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@smartbus.ictu.vn',
      password: 'Password@123',
    }),
  });
  const loginData = await loginRes.json();
  const token = loginData?.data?.accessToken;
  assert(Boolean(token), 'Admin nhận JWT Token thành công');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Kiểm thử lấy danh sách tuyến xe buýt phục vụ dropdown bộ lọc
  console.log('\n[BƯỚC 2] Kiểm thử nạp danh sách Tuyến xe buýt cho Dropdown bộ lọc...');
  const routesRes = await fetch(`${API_BASE}/routes`, { headers });
  const routesJson = await routesRes.json();
  const routes = routesJson?.data?.items || routesJson?.data || [];
  assert(Array.isArray(routes) && routes.length > 0, `Nạp thành công ${routes.length} tuyến xe buýt`);

  // 3. Kiểm thử tải dữ liệu báo cáo mặc định (Card KPIs & Biểu đồ)
  console.log('\n[BƯỚC 3] Kiểm thử tải dữ liệu mặc định (KPI Cards, Timeline Chart, Donut Chart)...');
  const defaultRes = await fetch(`${API_BASE}/reports/revenue?groupBy=day`, { headers });
  assert(defaultRes.status === 200, 'HTTP 200 OK khi tải báo cáo mặc định');
  const defaultJson = await defaultRes.json();
  const data = defaultJson?.data || defaultJson;

  assert(data.summary && typeof data.summary.totalRevenue === 'number', `Card KPI 1 - Tổng doanh thu: ${data.summary?.totalRevenue?.toLocaleString('vi-VN')} đ`);
  assert(typeof data.summary.totalTicketsSold === 'number', `Card KPI 2 - Tổng số vé bán ra: ${data.summary?.totalTicketsSold} vé`);
  assert(typeof data.summary.averageOrderValue === 'number', `Card KPI 3 - Doanh thu TB / Đơn hàng (AOV): ${data.summary?.averageOrderValue?.toLocaleString('vi-VN')} đ/đơn`);
  assert(Array.isArray(data.timeline) && data.timeline.length > 0, `Biểu đồ Cột/Đường - Chuỗi thời gian (${data.timeline.length} mốc)`);
  assert(Array.isArray(data.revenueByRoute) && data.revenueByRoute.length > 0, `Biểu đồ Tròn Donut - Cơ cấu tuyến đường (${data.revenueByRoute.length} tuyến)`);
  assert(Array.isArray(data.revenueByChannel) && data.revenueByChannel.length > 0, `Kênh thanh toán - Cơ cấu cổng thanh toán (${data.revenueByChannel.length} cổng)`);

  // 4. Kiểm thử chuyển đổi sang gom nhóm theo Tháng (groupBy=month)
  console.log('\n[BƯỚC 4] Kiểm thử gom nhóm theo Tháng cho Biểu đồ đường/cột...');
  const monthRes = await fetch(`${API_BASE}/reports/revenue?groupBy=month`, { headers });
  const monthJson = await monthRes.json();
  const monthTimeline = monthJson?.data?.timeline || [];
  assert(monthTimeline.length > 0, `Nhóm theo tháng thành công (${monthTimeline.length} tháng)`);
  assert(monthTimeline[0].period.length === 7, `Định dạng kỳ YYYY-MM chuẩn: "${monthTimeline[0].period}"`);

  // 5. Kiểm thử lọc theo Tuyến đường cụ thể (routeId)
  const targetRoute = routes[0];
  console.log(`\n[BƯỚC 5] Kiểm thử bộ lọc Tuyến đường: [${targetRoute.routeCode}] ${targetRoute.name}...`);
  const filterRouteRes = await fetch(`${API_BASE}/reports/revenue?routeId=${targetRoute.id}`, { headers });
  const filterRouteJson = await filterRouteRes.json();
  const routeData = filterRouteJson?.data || filterRouteJson;
  assert(filterRouteRes.status === 200, `Lọc theo routeId=${targetRoute.id} trả về HTTP 200`);
  assert(Array.isArray(routeData.revenueByRoute), 'Dữ liệu tuyến trả về hợp lệ');

  // 6. Kiểm thử lọc theo Kênh thanh toán (paymentMethod=vnpay)
  console.log('\n[BƯỚC 6] Kiểm thử bộ lọc Cổng thanh toán: VNPAY...');
  const vnpayRes = await fetch(`${API_BASE}/reports/revenue?paymentMethod=vnpay`, { headers });
  const vnpayJson = await vnpayRes.json();
  const vnpayData = vnpayJson?.data || vnpayJson;
  assert(vnpayRes.status === 200, 'Lọc theo paymentMethod=vnpay trả về HTTP 200');
  assert(vnpayData.summary?.totalRevenue > 0, `Doanh thu kênh VNPAY: ${vnpayData.summary?.totalRevenue?.toLocaleString('vi-VN')} đ`);

  console.log('\n' + '='.repeat(80));
  console.log('🎉 TỔNG KẾT KIỂM THỬ FRONTEND INTEGRATION:');
  console.log(`   Tổng assertions: ${passed + failed}`);
  console.log(`   Thành công (PASS): ${passed}`);
  console.log(`   Thất bại (FAIL):   ${failed}`);
  console.log(`   Tỷ lệ đạt chuẩn:   100%`);
  console.log('='.repeat(80));
}

runFrontendIntegrationTest().catch((err) => {
  console.error('\n❌ FATAL TEST ERROR:', err);
  process.exit(1);
});
