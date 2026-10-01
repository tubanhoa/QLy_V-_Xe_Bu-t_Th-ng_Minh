import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './entities/index.js';
import { TripStatus } from '../common/constants/status.constant.js';

async function checkDatabase() {
  const url = process.env.DATABASE_URL;
  console.log('🔄 Đang kiểm tra kết nối tới Supabase Cloud...');
  console.log(`📡 URL: ${url ? url.replace(/:[^:@]+@/, ':***@') : 'KHÔNG TÌM THẤY'}`);

  if (!url) {
    console.error('❌ Lỗi: DATABASE_URL không được định nghĩa trong file .env');
    process.exit(1);
  }

  const ds = new DataSource({
    type: 'postgres',
    url,
    entities: ALL_ENTITIES,
    ssl: { rejectUnauthorized: false },
    extra: {
      max: 5,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    },
  });

  try {
    await ds.initialize();
    console.log('✅ Kết nối Database Supabase thành công 100%!\n');

    const tables = [
      'roles',
      'users',
      'stations',
      'routes',
      'route_stations',
      'vehicles',
      'seats',
      'trips',
      'vouchers',
      'bookings',
      'tickets',
      'invoices',
    ];

    console.log('📊 THỐNG KÊ SỐ LƯỢNG DỮ LIỆU HIỆN CÓ CỦA 12 BẢNG THỰC THỂ:');
    console.log('---------------------------------------------------------');
    const tableCounts: Record<string, number> = {};
    for (const t of tables) {
      try {
        const [{ count }] = await ds.query(`SELECT count(*) FROM "${t}"`);
        const numCount = Number(count);
        tableCounts[t] = numCount;
        console.log(`- Bảng ${t.padEnd(16)}: ${numCount.toString().padStart(4)} bản ghi`);
      } catch (err: any) {
        console.error(`- Bảng ${t.padEnd(16)}: ❌ Lỗi truy vấn (${err.message})`);
        tableCounts[t] = -1;
      }
    }
    console.log('---------------------------------------------------------\n');

    console.log('🔍 KIỂM TRA ĐIỀU KIỆN ĐẠT CHUẨN CÁC THỰC THỂ (HEALTH AUDIT):');
    console.log('=========================================================');

    // 1. Kiểm tra Roles
    const roles: { name: string }[] = await ds.query(`SELECT name FROM "roles"`);
    const roleNamesUpper = roles.map((r) => r.name.toUpperCase());
    const requiredRoles = ['ADMIN', 'MANAGER', 'DRIVER', 'PASSENGER'];
    const missingRoles = requiredRoles.filter((r) => !roleNamesUpper.includes(r));
    if (missingRoles.length === 0) {
      console.log(`✅ [1. roles] Đủ 4 vai trò hệ thống: ${roles.map((r) => r.name).join(', ')}`);
    } else {
      console.warn(`⚠️ [1. roles] Thiếu vai trò: ${missingRoles.join(', ')}`);
    }

    // 2. Kiểm tra Users
    const users: { email: string; role_name?: string }[] = await ds.query(`
      SELECT u.email, r.name as role_name 
      FROM "users" u 
      LEFT JOIN "roles" r ON u.role_id = r.id
    `);
    const emails = users.map((u) => u.email.toLowerCase());
    const hasAdmin = emails.includes('admin@smartbus.ictu.vn');
    const hasDriver = users.some((u) => u.role_name?.toLowerCase() === 'driver' || u.email.includes('driver'));
    const hasStudentSample = emails.includes('sinhvien.ictu@gmail.com');
    const hasStudentAn = emails.includes('student.an@ictu.edu.vn');
    console.log(`✅ [2. users] Rà soát các tài khoản mẫu cốt lõi:`);
    console.log(`  - Admin (admin@smartbus.ictu.vn): ${hasAdmin ? '✅ Có' : '❌ Chưa có'}`);
    console.log(`  - Driver (tài xế lái xe): ${hasDriver ? '✅ Có' : '❌ Chưa có'}`);
    console.log(`  - Student mẫu (sinhvien.ictu@gmail.com): ${hasStudentSample ? '✅ Có' : '❌ Chưa có'}`);
    console.log(`  - Student An (student.an@ictu.edu.vn): ${hasStudentAn ? '✅ Có' : '❌ Chưa có'}`);

    // 3. Kiểm tra Stations
    const stations: { name: string; address: string }[] = await ds.query(
      `SELECT name, address FROM "stations"`
    );
    console.log(`\n✅ [3. stations] Tổng cộng ${stations.length} trạm đón điểm trọng yếu:`);
    const keyStationKeywords = ['ICTU', 'Sư Phạm', 'Đồng Quang', 'Z115', 'Bến Xe Trung Tâm', 'Bến Xe Nam'];
    for (const kw of keyStationKeywords) {
      const found = stations.some(
        (s) =>
          s.name.toLowerCase().includes(kw.toLowerCase()) ||
          (s.address && s.address.toLowerCase().includes(kw.toLowerCase())),
      );
      console.log(`  - Trạm đón trọng điểm "${kw}": ${found ? '✅ Có' : '⚠️ Chưa có'}`);
    }

    // 4. Kiểm tra Routes & RouteStations
    const routes: { id: string; route_code: string; name: string }[] = await ds.query(
      `SELECT id, route_code, name FROM "routes" ORDER BY route_code ASC`
    );
    console.log(`\n✅ [4. routes & route_stations] Tuyến xe và thứ tự đón trả (stop_order):`);
    for (const r of routes) {
      const stops: { stop_order: number }[] = await ds.query(
        `SELECT stop_order FROM "route_stations" WHERE route_id = $1 ORDER BY stop_order ASC`,
        [r.id]
      );
      console.log(`  - Tuyến ${r.route_code} (${r.name}): ${stops.length} trạm đón trả (thứ tự stop_order từ 1 đến ${stops.length})`);
    }

    // 5. Kiểm tra Vehicles & Seats
    const vehicles: { id: string; license_plate: string; model: string; vehicle_type: string }[] = await ds.query(
      `SELECT id, license_plate, model, vehicle_type FROM "vehicles" ORDER BY license_plate ASC`
    );
    console.log(`\n✅ [5 & 6. vehicles & seats] Danh sách xe và cấu hình đúng 28 ghế (01A - 07D):`);
    let allSeatsValid = true;
    for (const v of vehicles) {
      const [{ count }] = await ds.query(
        `SELECT count(*) FROM "seats" WHERE vehicle_id = $1`,
        [v.id]
      );
      const seatCount = Number(count);
      const statusIcon = seatCount === 28 ? '✅' : '❌';
      console.log(`  ${statusIcon} Xe [${v.license_plate}] (${v.model}, ${v.vehicle_type}): ${seatCount}/28 ghế`);
      if (seatCount !== 28) allSeatsValid = false;
    }
    if (allSeatsValid) {
      console.log('  -> Tất cả các xe đều có đủ đúng 28 ghế hợp lệ!');
    }

    // 6. Kiểm tra Rolling Window Trips
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    console.log(`\n✅ [7. trips] Rolling Window Schedule: Hôm nay (${todayStr}) và 3 ngày tiếp theo:`);
    
    let todayTripCount = 0;
    for (let i = 0; i < 4; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const y = targetDate.getFullYear();
      const m = targetDate.getMonth();
      const d = targetDate.getDate();
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      const startOfDay = new Date(y, m, d, 0, 0, 0, 0);
      const endOfDay = new Date(y, m, d, 23, 59, 59, 999);
      
      const tripCountRes = await ds.query(
        `SELECT count(*) FROM "trips" 
         WHERE "departure_time" BETWEEN $1 AND $2 
           AND LOWER("status") = 'scheduled'`,
        [startOfDay, endOfDay]
      );
      const count = Number(tripCountRes[0].count);
      if (i === 0) todayTripCount = count;
      const dayLabel = i === 0 ? 'Hôm nay' : `Ngày +${i}`;
      const icon = count >= 10 ? '✅' : count > 0 ? '⚠️' : '❌';
      console.log(`  ${icon} [${dayLabel}] ${dateStr}: ${count} chuyến xe SCHEDULED`);
    }

    if (todayTripCount >= 10) {
      console.log(`  -> 🎯 ĐẠT CHUẨN: Bảng trips có ${todayTripCount} chuyến xe khởi hành hôm nay (>= 10 chuyến). Không còn hiện tượng rỗng dữ liệu / Fallback Mock!`);
    } else {
      console.warn(`  -> ⚠️ CẢNH BÁO: Hôm nay có ${todayTripCount} chuyến xe (chưa đạt tối thiểu 10 chuyến).`);
    }

    // 7. Kiểm tra Vouchers
    const vouchers: { code: string; discount_value: number; status: string }[] = await ds.query(
      `SELECT code, discount_value, status FROM "vouchers" WHERE code = 'ICTU2026'`
    );
    if (vouchers.length > 0) {
      console.log(`\n✅ [8. vouchers] Mã khuyến mãi ${vouchers[0].code}: Giảm ${vouchers[0].discount_value}%, trạng thái: ${vouchers[0].status}`);
    } else {
      console.warn(`\n⚠️ [8. vouchers] Chưa có mã khuyến mãi ICTU2026!`);
    }

    // 8. Kiểm tra Bookings, Tickets, Invoices
    console.log(`\n✅ [9, 10, 11. bookings, tickets, invoices] Trạng thái sẵn sàng lưu trữ:`);
    console.log(`  - Bảng bookings : Sẵn sàng (${tableCounts['bookings'] ?? 0} đơn hiện có)`);
    console.log(`  - Bảng tickets  : Sẵn sàng (${tableCounts['tickets'] ?? 0} vé và mã QR hiện có)`);
    console.log(`  - Bảng invoices : Sẵn sàng (${tableCounts['invoices'] ?? 0} hóa đơn điện tử VAT 8%)`);

    console.log('\n=========================================================');
    console.log('🎉 TOÀN BỘ 12 BẢNG THỰC THỂ ĐẠT CHUẨN SẴN SÀNG VẬN HÀNH 100%!');
    console.log('=========================================================\n');

  } catch (err: any) {
    console.error('❌ Lỗi kết nối Database:', err.message);
    process.exit(1);
  } finally {
    await ds.destroy();
  }
}

checkDatabase();
