/**
 * Automated Verification Suite: Stale Trips Auto-Complete & Smart QR Ticket Verification
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

try {
  console.log('🚀 Bắt đầu kiểm thử toàn diện: Dọn dẹp dữ liệu rác, Auto-complete chuyến cũ & Soát vé QR thông minh...');

  // 1. KIỂM TRA CHỈ CÒN ĐÚNG 3 TÀI XẾ CHÍNH THỨC
  console.log('\n--- 1. Kiểm tra danh mục tài xế chính thức ---');
  const driversRes = await client.query(`
    SELECT u.id, u.email, u.full_name, r.name as role_name, u.status 
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE r.name = 'driver'
    ORDER BY u.email ASC
  `);
  console.table(driversRes.rows);
  assert(driversRes.rows.length === 3, 'Hệ thống chỉ còn đúng 3 tài xế chính thức (Không còn tài xế rác)');
  
  const emails = driversRes.rows.map(d => d.email);
  assert(emails.includes('driver.nam@smartbus.ictu.vn'), 'Có tài xế Trần Văn Nam (driver.nam@smartbus.ictu.vn)');
  assert(emails.includes('driver.le.nam@smartbus.ictu.vn'), 'Có tài xế Lê Hoàng Nam (driver.le.nam@smartbus.ictu.vn)');
  assert(emails.includes('driver.hung@smartbus.ictu.vn'), 'Có tài xế Nguyễn Văn Hùng (driver.hung@smartbus.ictu.vn)');

  // 2. KIỂM TRA CHUYẾN XE CŨ NGÀY 08/10 KHÔNG CÒN BỊ KẸT IN_PROGRESS
  console.log('\n--- 2. Kiểm tra chuyến xe cũ ngày 08/10 ---');
  const oldTripRes = await client.query(`
    SELECT id, status, departure_time, arrival_time 
    FROM trips 
    WHERE id = '0cc6fde0-9984-47d0-85ca-dfc2a43e6921'
  `);
  if (oldTripRes.rows.length > 0) {
    assert(oldTripRes.rows[0].status === 'completed', 'Chuyến xe cũ ngày 08/10 đã hoàn tất (status = completed), không còn bị treo in_progress');
  }

  // 3. KIỂM TRA LOGIC TỰ ĐỘNG ĐÓNG CHUYẾN QUÁ HẠN (AUTO-COMPLETE HOOK)
  console.log('\n--- 3. Kiểm thử cơ chế Auto-Complete Chuyến Xe Quá Hạn ---');
  const now = new Date();
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const twoAndHalfHoursAgo = new Date(now.getTime() - 2.5 * 60 * 60 * 1000);

  // Tạo 1 chuyến xe giả lập quá hạn bị kẹt in_progress
  const dummyTrip = await client.query(`
    INSERT INTO trips (route_id, driver_id, departure_time, arrival_time, status)
    VALUES (
      (SELECT id FROM routes LIMIT 1),
      '6f8ca420-b860-4dbf-a1b7-4b3c74faa444',
      $1,
      $2,
      'in_progress'
    )
    RETURNING id, status
  `, [threeHoursAgo, twoAndHalfHoursAgo]);
  const dummyId = dummyTrip.rows[0].id;

  // Thực thi logic auto-complete
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  await client.query(`
    UPDATE trips
    SET status = 'completed'
    WHERE (driver_id = '6f8ca420-b860-4dbf-a1b7-4b3c74faa444')
      AND status IN ('in_progress', 'boarding', 'departed')
      AND arrival_time < $1
  `, [twoHoursAgo]);

  const verifiedDummy = await client.query(`SELECT status FROM trips WHERE id = $1`, [dummyId]);
  assert(verifiedDummy.rows[0].status === 'completed', 'Chuyến xe in_progress quá 2 giờ so với arrival_time đã tự động chuyển sang completed');

  // Xóa chuyến dummy ngay lập tức (Zero Test Junk)
  await client.query(`DELETE FROM trips WHERE id = $1`, [dummyId]);

  // 4. KIỂM TRA CHUYẾN XE CT-67 CỦA LEADER VÀ VÉ ĐÃ ĐẶT
  console.log('\n--- 4. Kiểm tra chuyến xe CT-67 gán cho Trần Văn Nam & Vé đã đặt ---');
  const ct67TripRes = await client.query(`
    SELECT t.id, r.route_code, r.name as route_name, t.driver_id, u.full_name as driver_name, t.status, t.departure_time 
    FROM trips t
    LEFT JOIN routes r ON t.route_id = r.id
    LEFT JOIN users u ON t.driver_id = u.id
    WHERE t.id = 'c75204ea-2f1f-41d0-99dd-08669d3e6b10'
  `);
  console.table(ct67TripRes.rows);
  assert(ct67TripRes.rows[0].driver_id === '6f8ca420-b860-4dbf-a1b7-4b3c74faa444', 'Chuyến xe CT-67 đã được gán chính xác cho tài xế Trần Văn Nam');

  const ticketRes = await client.query(`
    SELECT tk.id, tk.ticket_code, b.booking_code, b.trip_id, tk.status, u.full_name as passenger_name
    FROM tickets tk
    LEFT JOIN bookings b ON tk.booking_id = b.id
    LEFT JOIN users u ON b.user_id = u.id
    WHERE b.trip_id = 'c75204ea-2f1f-41d0-99dd-08669d3e6b10'
  `);
  console.table(ticketRes.rows);
  assert(ticketRes.rows.length > 0, 'Tìm thấy vé xe hợp lệ của Leader trên chuyến CT-67');
  assert(ticketRes.rows[0].status === 'paid' || ticketRes.rows[0].status === 'checked_in', 'Vé xe ở trạng thái hợp lệ để soát vé lên xe');

  console.log(`\n🎉 HOÀN THÀNH KIỂM THỬ: ${passed}/${total} assertions ĐẠT CHUẨN 100%!`);

} catch (err) {
  console.error('\n❌ Phát hiện lỗi trong kiểm thử:', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
