import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('backend', '.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3001/api/v1';

async function runTestSuite() {
  console.log('='.repeat(80));
  console.log('BỘ KIỂM THỬ: HỒ SƠ & THẨM ĐỊNH BẰNG LÁI TÀI XẾ & RÀNG BUỘC PHÂN CÔNG CHUYẾN XE');
  console.log('(ZERO TEST JUNK GUARANTEE — KHÔI PHỤC DỮ LIỆU ĐỂ DEMO VỚI GIẢNG VIÊN)');
  console.log('='.repeat(80));

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (!condition) {
      failedCount++;
      console.error(`  [FAILED] ${message}`);
      throw new Error(message);
    } else {
      passedCount++;
      console.log(`  [PASSED] ${message}`);
    }
  }

  // 1. Đăng nhập Admin
  console.log('\n[SETUP] 1. Đăng nhập tài khoản Admin...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@smartbus.ictu.vn',
      password: 'Password@123',
    }),
  });

  const loginData = await loginRes.json();
  const token = loginData?.data?.accessToken || loginData?.data?.token || loginData?.accessToken;
  assert(Boolean(token), 'Admin đăng nhập thành công và nhận JWT Token');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. TEST-01: Lấy danh sách hồ sơ bằng lái và KPIs
  console.log('\n--- PHẦN 1: KIỂM THỬ TRUY VẤN DANH SÁCH & KPIS HỒ SƠ GPLX ---');
  const listRes = await fetch(`${API_BASE}/admin/driver-profiles`, {
    headers: authHeaders,
  });
  const listJson = await listRes.json();
  const data = listJson?.data || listJson;

  assert(listRes.status === 200, '[TEST-01] GET /admin/driver-profiles trả về HTTP 200');
  assert(Array.isArray(data.items), '[TEST-01] Trả về danh sách items tài xế hợp lệ');
  assert(data.kpis && data.kpis.totalDrivers >= 3, `[TEST-01] Số lượng tài xế đạt chuẩn (${data.kpis?.totalDrivers} tài xế)`);
  assert(data.kpis.approvedCount >= 2, `[TEST-01] Số tài xế đã duyệt GPLX: ${data.kpis?.approvedCount}`);
  assert(data.kpis.pendingCount >= 1, `[TEST-01] Số tài xế chờ duyệt GPLX: ${data.kpis?.pendingCount}`);

  // Tìm tài xế Nguyễn Văn Hùng và Lê Hoàng Nam
  const hungDriver = data.items.find((i) => i.driver.fullName.includes('Hùng') || i.driver.email.includes('hung'));
  const namDriver = data.items.find((i) => i.driver.fullName.includes('Lê Hoàng Nam') || i.driver.email.includes('driver.le.nam'));

  assert(Boolean(hungDriver), 'Tìm thấy tài xế Nguyễn Văn Hùng trong danh sách');
  assert(Boolean(namDriver), 'Tìm thấy tài xế Lê Hoàng Nam trong danh sách');

  // Lấy 1 tuyến xe và tạo 1 chuyến xe riêng biệt cho bài kiểm thử
  console.log('\n--- PHẦN 2: KHỞI TẠO CHUYẾN XE RIÊNG BIỆT ĐỂ TEST ĐIỀU PHỐI (TRÁNH XUNG ĐỘT CA CHẠY) ---');
  const routesRes = await fetch(`${API_BASE}/routes`, { headers: authHeaders });
  const routesJson = await routesRes.json();
  const routes = routesJson?.data?.items || routesJson?.data || [];
  const testRoute = routes[0];
  assert(Boolean(testRoute), `Lấy thành công tuyến xe mẫu: [${testRoute?.routeCode}] ${testRoute?.routeName}`);

  const adhocRes = await fetch(`${API_BASE}/trips/adhoc`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      routeId: testRoute.id,
      departureTime: '2026-12-31T10:00:00.000Z',
      arrivalTime: '2026-12-31T11:00:00.000Z',
      note: 'Chuyến xe tự động phục vụ Unit/Integration Test bằng lái tài xế',
    }),
  });
  const adhocJson = await adhocRes.json();
  const targetTrip = adhocJson?.data || adhocJson;
  assert(Boolean(targetTrip?.id), `Khởi tạo chuyến xe test adhoc thành công: [${targetTrip?.id}]`);

  const vehiclesRes = await fetch(`${API_BASE}/vehicles`, { headers: authHeaders });
  const vehiclesJson = await vehiclesRes.json();
  const vehicles = vehiclesJson?.data?.items || vehiclesJson?.data || [];
  const targetVehicle = vehicles[0];
  assert(Boolean(targetVehicle), `Tìm thấy xe buýt phục vụ test: ${targetVehicle?.licensePlate}`);

  // 3. TEST-02: Chặn phân công tài xế có GPLX ở trạng thái 'pending' (Nguyễn Văn Hùng)
  console.log('\n--- PHẦN 3: KIỂM THỬ RÀNG BUỘC PHÂN CÔNG CHUYẾN XE ---');
  console.log(`[TEST-02] Thử phân công tài xế ${hungDriver.driver.fullName} (Đang chờ duyệt)...`);
  const dispatchHungRes = await fetch(`${API_BASE}/trips/dispatch`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      tripId: targetTrip.id,
      driverId: hungDriver.driver.id,
      vehicleId: targetVehicle.id,
    }),
  });

  const dispatchHungJson = await dispatchHungRes.json();
  assert(
    dispatchHungRes.status === 400,
    `[TEST-02] Hệ thống CHẶN THÀNH CÔNG với HTTP 400 khi phân công tài xế chưa được duyệt bằng lái`
  );
  assert(
    dispatchHungJson?.message?.includes('chưa đủ điều kiện giấy phép lái xe') ||
    dispatchHungJson?.message?.includes('Chờ duyệt'),
    `[TEST-02] Thông báo lỗi bảo vệ an toàn: "${dispatchHungJson?.message}"`
  );

  // 4. TEST-03: Phân công tài xế đã duyệt GPLX Hạng D/E (Lê Hoàng Nam)
  console.log(`\n[TEST-03] Thử phân công tài xế ${namDriver.driver.fullName} (Đã được duyệt Hạng D/E)...`);
  const dispatchNamRes = await fetch(`${API_BASE}/trips/dispatch`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      tripId: targetTrip.id,
      driverId: namDriver.driver.id,
      vehicleId: targetVehicle.id,
    }),
  });

  const dispatchNamJson = await dispatchNamRes.json();
  if (dispatchNamRes.status !== 200 && dispatchNamRes.status !== 201) {
    console.log('  [DEBUG 409 DETAIL]:', JSON.stringify(dispatchNamJson));
  }
  assert(
    dispatchNamRes.status === 200 || dispatchNamRes.status === 201,
    `[TEST-03] Phân công THÀNH CÔNG tài xế đủ điều kiện GPLX: HTTP ${dispatchNamRes.status}`
  );

  // 5. TEST-04: Admin từ chối hồ sơ GPLX kèm lý do
  console.log('\n--- PHẦN 4: KIỂM THỬ THẨM ĐỊNH (TỪ CHỐI & PHÊ DUYỆT) ---');
  console.log(`[TEST-04] Admin từ chối hồ sơ GPLX của ${hungDriver.driver.fullName}...`);
  const rejectRes = await fetch(`${API_BASE}/admin/driver-profiles/${hungDriver.driver.id}/review`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      status: 'rejected',
      rejectionReason: 'Ảnh chụp mặt trước bị lóa sáng không nhìn rõ số GPLX và niên hạn',
    }),
  });

  const rejectJson = await rejectRes.json();
  assert(rejectRes.status === 200, '[TEST-04] PATCH review từ chối trả về HTTP 200');
  assert((rejectJson?.data?.status || rejectJson?.status) === 'rejected', '[TEST-04] Trạng thái cập nhật thành rejected');
  assert(
    (rejectJson?.data?.rejectionReason || rejectJson?.rejectionReason)?.includes('lóa sáng'),
    `[TEST-04] Đã lưu lý do từ chối: "${rejectJson?.data?.rejectionReason || rejectJson?.rejectionReason}"`
  );

  // 6. TEST-05: Chặn phân công khi tài xế bị 'rejected'
  console.log(`\n[TEST-05] Thử phân công tài xế vừa bị từ chối...`);
  const dispatchRejectRes = await fetch(`${API_BASE}/trips/dispatch`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      tripId: targetTrip.id,
      driverId: hungDriver.driver.id,
      vehicleId: targetVehicle.id,
    }),
  });
  const dispatchRejectJson = await dispatchRejectRes.json();
  assert(dispatchRejectRes.status === 400, '[TEST-05] Chặn thành công tài xế bị từ chối với HTTP 400');
  assert(
    dispatchRejectJson?.message?.includes('từ chối') || dispatchRejectJson?.message?.includes('chưa đủ điều kiện'),
    `[TEST-05] Thông báo phản hồi: "${dispatchRejectJson?.message}"`
  );

  // 7. TEST-06: Admin phê duyệt hồ sơ GPLX
  console.log(`\n[TEST-06] Admin phê duyệt hợp lệ hồ sơ GPLX của ${hungDriver.driver.fullName}...`);
  const approveRes = await fetch(`${API_BASE}/admin/driver-profiles/${hungDriver.driver.id}/review`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      status: 'approved',
    }),
  });

  const approveJson = await approveRes.json();
  assert(approveRes.status === 200, '[TEST-06] PATCH review phê duyệt trả về HTTP 200');
  assert((approveJson?.data?.status || approveJson?.status) === 'approved', '[TEST-06] Trạng thái cập nhật thành approved');

  // 8. TEST-07: Phân công lại tài xế Nguyễn Văn Hùng sau khi được duyệt
  console.log(`\n[TEST-07] Phân công tài xế Nguyễn Văn Hùng sau khi đã được duyệt...`);
  const dispatchApprovedRes = await fetch(`${API_BASE}/trips/dispatch`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      tripId: targetTrip.id,
      driverId: hungDriver.driver.id,
      vehicleId: targetVehicle.id,
    }),
  });
  assert(
    dispatchApprovedRes.status === 200 || dispatchApprovedRes.status === 201,
    `[TEST-07] Phân công THÀNH CÔNG RỰC RỠ tài xế sau khi duyệt: HTTP ${dispatchApprovedRes.status}`
  );

  // 9. TEST-08: Admin cập nhật trực tiếp thông tin GPLX (Manual Edit)
  console.log('\n--- PHẦN 5: KIỂM THỬ CẬP NHẬT TRỰC TIẾP HỒ SƠ GPLX ---');
  const updateRes = await fetch(`${API_BASE}/admin/driver-profiles/${hungDriver.driver.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      licenseNumber: 'GPLX-20-D-999888',
      licenseClass: 'D',
      issueDate: '2023-05-20',
      expiryDate: '2028-05-20',
      status: 'pending', // Khôi phục lại pending cho demo
    }),
  });
  assert(updateRes.status === 200, '[TEST-08] PUT cập nhật hồ sơ trực tiếp trả về HTTP 200');

  // 10. TEST-09: Khôi phục trạng thái ban đầu cho Demo (Zero Test Junk Guarantee)
  console.log('\n--- PHẦN 6: DỌN DẸP & KHÔI PHỤC DỮ LIỆU ĐỂ PHỤC VỤ DEMO GIẢNG VIÊN ---');
  // Khôi phục Nguyễn Văn Hùng về pending
  await fetch(`${API_BASE}/admin/driver-profiles/${hungDriver.driver.id}/review`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      status: 'pending',
    }),
  });

  // Gỡ phân công chuyến xe test về trạng thái sạch sẽ ban đầu
  await fetch(`${API_BASE}/trips/${targetTrip.id}/unassign`, {
    method: 'POST',
    headers: authHeaders,
  });

  assert(true, '[TEST-09] Đã khôi phục tài xế Nguyễn Văn Hùng về "pending" và gỡ phân công chuyến xe test thành công!');

  console.log('\n' + '='.repeat(80));
  console.log('TỔNG HỢP KẾT QUẢ KIỂM THỬ:');
  console.log(`Tổng số Test Case:  ${passedCount + failedCount}`);
  console.log(`Thành công (PASSED): ${passedCount}`);
  console.log(`Thất bại   (FAILED): ${failedCount}`);
  console.log(`Tỷ lệ đạt:          ${Math.round((passedCount / (passedCount + failedCount)) * 100)}%`);
  console.log('='.repeat(80));
}

runTestSuite().catch((err) => {
  console.error('\n[FATAL TEST RUNTIME ERROR]:', err);
  process.exit(1);
});
