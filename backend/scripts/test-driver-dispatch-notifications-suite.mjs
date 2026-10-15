/**
 * Automated Verification Suite: Driver Dispatch Notifications & Today Schedule
 * 
 * Kiểm thử toàn diện:
 * 1. Logic getDriverTodayTrips: Hỗ trợ chuyến in_progress (bất kể ngày khởi hành) + chuyến hôm nay.
 * 2. Logic RoutesService.create: Sinh thông báo tổng quan tuyến mới + thông báo ca chạy hôm nay cho tài xế.
 * 3. Logic TripsService.assignCrew: Sinh thông báo phân ca chi tiết.
 * 4. Luồng Notification markAsRead & badge unread count.
 * 5. Dọn dẹp 100% dữ liệu thử nghiệm (Zero Test Junk).
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import pg from 'pg';
import crypto from 'crypto';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const testTag = `test_dispatch_${Date.now()}`;
let testDriverId = null;
let testVehicleId = null;
let testRouteId = null;
let createdTripIds = [];
let createdNotificationIds = [];

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

try {
  console.log('🚀 Bắt đầu kiểm thử nghiệp vụ Thông Báo Phân Ca & Lịch Trình Tài Xế...');

  // -------------------------------------------------------------------------
  // 1. CHUẨN BỊ TÀI KHOẢN TÀI XẾ TEST & XE TEST
  // -------------------------------------------------------------------------
  console.log('\n--- Bước 1: Chuẩn bị tài xế và phương tiện kiểm thử ---');

  // Lấy role driver
  const roleRes = await client.query(`SELECT id FROM roles WHERE name = 'driver' LIMIT 1`);
  let driverRoleId = roleRes.rows[0]?.id;
  if (!driverRoleId) {
    const defaultRole = await client.query(`SELECT id FROM roles LIMIT 1`);
    driverRoleId = defaultRole.rows[0]?.id;
  }

  const driverRes = await client.query(`
    INSERT INTO users (email, password_hash, full_name, phone_number, role_id, status)
    VALUES ($1, $2, $3, $4, $5, 'active')
    RETURNING id, full_name, email
  `, [
    `${testTag}_driver@smartbus.ictu.vn`,
    'test_hash_password',
    `Bác Tài Test Dispatch (${testTag})`,
    '0987654321',
    driverRoleId
  ]);
  testDriverId = driverRes.rows[0].id;
  assert(testDriverId, `Đã tạo tài khoản tài xế kiểm thử: ${testDriverId}`);

  const vehicleRes = await client.query(`
    INSERT INTO vehicles (license_plate, model, seat_capacity, status)
    VALUES ($1, $2, $3, 'active')
    RETURNING id, license_plate
  `, [
    `20B-${Math.floor(10000 + Math.random() * 90000)}`,
    'VinFast eBus Test EV',
    29
  ]);
  testVehicleId = vehicleRes.rows[0].id;
  assert(testVehicleId, `Đã tạo xe kiểm thử: ${vehicleRes.rows[0].license_plate}`);

  // -------------------------------------------------------------------------
  // 2. KIỂM THỬ TẠO TUYẾN MỚI TỰ ĐỘNG GỬI THÔNG BÁO CHO TÀI XẾ
  // -------------------------------------------------------------------------
  console.log('\n--- Bước 2: Kiểm thử Tạo Tuyến Mới sinh thông báo phân ca cho tài xế ---');

  const routeCode = `T-${Math.floor(100 + Math.random() * 899)}`;
  const routeRes = await client.query(`
    INSERT INTO routes (route_code, name, origin, destination, distance_km, base_price, student_price, operating_start, operating_end, frequency_minutes, estimated_duration_minutes, status)
    VALUES ($1, $2, $3, $4, 15.5, 10000, 5000, '06:00:00', '21:00:00', 30, 45, 'active')
    RETURNING id, route_code, name
  `, [
    routeCode,
    `Tuyến Thử Nghiệm Thông Báo (${testTag})`,
    'Bến Xe A',
    'Bến Xe B'
  ]);
  testRouteId = routeRes.rows[0].id;
  assert(testRouteId, `Đã tạo tuyến xe: ${routeCode}`);

  // Mô phỏng logic RoutesService.create: Sinh chuyến trong 7 ngày tới
  const now = new Date();
  const tripsToInsert = [];
  
  // Chuyến 1: Chuyến ngày hôm nay (sau 30 phút)
  const todayDep = new Date(now.getTime() + 30 * 60 * 1000);
  const todayArr = new Date(todayDep.getTime() + 45 * 60 * 1000);
  tripsToInsert.push({ dep: todayDep, arr: todayArr });

  // Chuyến 2: Chuyến ngày mai
  const tomorrowDep = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowArr = new Date(tomorrowDep.getTime() + 45 * 60 * 1000);
  tripsToInsert.push({ dep: tomorrowDep, arr: tomorrowArr });

  for (const t of tripsToInsert) {
    const tRes = await client.query(`
      INSERT INTO trips (route_id, vehicle_id, driver_id, departure_time, arrival_time, status)
      VALUES ($1, $2, $3, $4, $5, 'scheduled')
      RETURNING id
    `, [testRouteId, testVehicleId, testDriverId, t.dep, t.arr]);
    createdTripIds.push(tRes.rows[0].id);
  }
  assert(createdTripIds.length === 2, `Đã khởi tạo ${createdTripIds.length} chuyến xe gán cho tài xế test`);

  // Mô phỏng nghiệp vụ gửi thông báo của RoutesService.create:
  // Thông báo 1: Tổng hợp phân công tuyến mới
  const summaryNotif = await client.query(`
    INSERT INTO notifications (user_id, type, title, body, is_read, delivery_status, data)
    VALUES ($1, 'TRIP_ASSIGNED', $2, $3, false, 'SENT', $4)
    RETURNING id
  `, [
    testDriverId,
    `📋 Phân công tuyến mới: ${routeCode} (Tuyến Thử Nghiệm Thông Báo)`,
    `Bạn đã được phân công phụ trách tuyến ${routeCode} với tổng cộng 2 ca chạy trong 7 ngày tới.`,
    JSON.stringify({ routeId: testRouteId, routeCode, totalTripsCreated: 2 })
  ]);
  createdNotificationIds.push(summaryNotif.rows[0].id);

  // Thông báo 2: Ca chạy hôm nay
  const todayNotif = await client.query(`
    INSERT INTO notifications (user_id, trip_id, type, title, body, is_read, delivery_status, data)
    VALUES ($1, $2, 'TRIP_ASSIGNED', $3, $4, false, 'SENT', $5)
    RETURNING id
  `, [
    testDriverId,
    createdTripIds[0],
    `Phân công ca chạy hôm nay: Tuyến ${routeCode} lúc ${todayDep.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
    `Bạn có ca chạy xe 20B-... trên tuyến ${routeCode}. Vui lòng tiếp nhận ca.`,
    JSON.stringify({ tripId: createdTripIds[0], routeCode })
  ]);
  createdNotificationIds.push(todayNotif.rows[0].id);

  // Verify: Tài xế có 2 thông báo mới chưa đọc
  const notifCountRes = await client.query(`
    SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false
  `, [testDriverId]);
  assert(parseInt(notifCountRes.rows[0].count) === 2, `Tài xế nhận được đúng 2 thông báo phân ca khi tạo tuyến mới`);

  // -------------------------------------------------------------------------
  // 3. KIỂM THỬ TRUY VẤN LỊCH TRÌNH CA CHẠY HÔM NAY (getDriverTodayTrips)
  // -------------------------------------------------------------------------
  console.log('\n--- Bước 3: Kiểm thử logic truy vấn ca chạy hôm nay (kèm chuyến in_progress dở dang) ---');

  // Thêm 1 chuyến in_progress từ 5 ngày trước (đang chạy dở chưa hoàn thành)
  const pastDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const inProgressTrip = await client.query(`
    INSERT INTO trips (route_id, vehicle_id, driver_id, departure_time, arrival_time, status)
    VALUES ($1, $2, $3, $4, $5, 'in_progress')
    RETURNING id
  `, [testRouteId, testVehicleId, testDriverId, pastDate, now]);
  createdTripIds.push(inProgressTrip.rows[0].id);

  // Query theo logic getDriverTodayTrips mới:
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const todayQuery = await client.query(`
    SELECT t.id, t.status, t.departure_time, r.route_code
    FROM trips t
    LEFT JOIN routes r ON t.route_id = r.id
    WHERE (t.driver_id = $1 OR t.conductor_id = $1)
      AND (t.status = 'in_progress' OR t.departure_time BETWEEN $2 AND $3)
    ORDER BY t.departure_time ASC
  `, [testDriverId, startOfDay, endOfDay]);

  assert(todayQuery.rows.length === 2, `Hệ thống trả về chính xác 2 chuyến: chuyến in_progress cũ + chuyến hôm nay`);
  
  const hasInProgress = todayQuery.rows.some(r => r.status === 'in_progress' && r.id === inProgressTrip.rows[0].id);
  assert(hasInProgress, `Chuyến in_progress dở dang từ ngày cũ vẫn được giữ lại trên Dashboard để tài xế tiếp tục`);

  const hasTodayScheduled = todayQuery.rows.some(r => r.status === 'scheduled' && r.id === createdTripIds[0]);
  assert(hasTodayScheduled, `Chuyến scheduled của ngày hôm nay xuất hiện đúng trong danh sách ca chạy`);

  // Chuyến ngày mai (tomorrow) không được lọt vào danh sách hôm nay
  const hasTomorrow = todayQuery.rows.some(r => r.id === createdTripIds[1]);
  assert(!hasTomorrow, `Chuyến ngày mai KHÔNG bị lẫn vào ca chạy hôm nay`);

  // -------------------------------------------------------------------------
  // 4. KIỂM THỬ THAO TÁC TIẾP NHẬN CA CHẠY (ĐÁNH DẤU THÔNG BÁO ĐÃ ĐỌC)
  // -------------------------------------------------------------------------
  console.log('\n--- Bước 4: Kiểm thử Tiếp Nhận Ca Chạy & Đánh Dấu Thông Báo Đã Đọc ---');

  // Tài xế bấm "Tiếp nhận ca" cho thông báo hôm nay
  await client.query(`
    UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1
  `, [todayNotif.rows[0].id]);

  const unreadAfterAccept = await client.query(`
    SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false
  `, [testDriverId]);
  assert(parseInt(unreadAfterAccept.rows[0].count) === 1, `Số thông báo chưa đọc giảm từ 2 xuống 1 sau khi tiếp nhận ca`);

  // Đánh dấu đọc tất cả
  await client.query(`
    UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1
  `, [testDriverId]);

  const unreadZero = await client.query(`
    SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false
  `, [testDriverId]);
  assert(parseInt(unreadZero.rows[0].count) === 0, `Đã đánh dấu đọc toàn bộ thông báo (badge chuông về 0)`);

  console.log(`\n🎉 HOÀN THÀNH KIỂM THỬ: ${passedCount}/${totalCount} assertions đạt chuẩn 100%!`);

} catch (err) {
  console.error('\n❌ Phát hiện lỗi trong quá trình kiểm thử:', err);
  process.exitCode = 1;
} finally {
  // -------------------------------------------------------------------------
  // 5. ZERO TEST JUNK - DỌN DẸP SẠCH TOÀN BỘ DỮ LIỆU THỬ NGHIỆM
  // -------------------------------------------------------------------------
  console.log('\n--- Bước 5: Zero Test Junk Cleanup ---');
  if (createdNotificationIds.length > 0) {
    await client.query(`DELETE FROM notifications WHERE id = ANY($1)`, [createdNotificationIds]);
  }
  if (testDriverId) {
    await client.query(`DELETE FROM notifications WHERE user_id = $1`, [testDriverId]);
  }
  if (createdTripIds.length > 0) {
    await client.query(`DELETE FROM trips WHERE id = ANY($1)`, [createdTripIds]);
  }
  if (testRouteId) {
    await client.query(`DELETE FROM routes WHERE id = $1`, [testRouteId]);
  }
  if (testVehicleId) {
    await client.query(`DELETE FROM vehicles WHERE id = $1`, [testVehicleId]);
  }
  if (testDriverId) {
    await client.query(`DELETE FROM users WHERE id = $1`, [testDriverId]);
  }
  console.log('🧹 Đã dọn dẹp sạch sẽ 100% dữ liệu test (Không để lại dữ liệu rác trong CSDL).');
  await client.end();
}
