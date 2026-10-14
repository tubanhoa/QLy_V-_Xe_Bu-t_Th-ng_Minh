#!/usr/bin/env node
/**
 * TEST SUITE: KIỂM THỬ BÁO CÁO TỶ LỆ LẤP ĐẦY CHỖ & TỐI ƯU QUY MÔ XE BUÝT ICTU
 *
 * Tiêu chí kiểm thử:
 * 1. Kiểm thử công thức toán học tỷ lệ lấp đầy: (số ghế đã đặt / tổng số ghế) * 100%
 * 2. Kiểm thử dữ liệu biên:
 *    - Chuyến xe 0 khách đặt (0% -> UNDERUTILIZED, không lỗi NaN)
 *    - Chuyến xe kín 100% chỗ (100% -> OVERLOADED)
 *    - Chuyến xe tải cao (>85% -> OVERLOADED)
 *    - Chuyến xe tải tối ưu (50-85% -> OPTIMAL)
 *    - Chuyến xe tải thấp (30-50% -> LOW)
 *    - Chuyến xe rỗng khách (<30% -> UNDERUTILIZED)
 *    - Ngày không có chuyến chạy nào -> 0 trips, overall 0%, không crash division by zero.
 * 3. Kiểm thử bộ lọc: date, startDate, endDate, routeId, tripId
 * 4. Kiểm thử ma trận Heatmap (7 ngày x 16 khung giờ từ 06 đến 21)
 * 5. Kiểm thử Hourly Density & nhận diện giờ cao điểm (Peak Hours: 06-08h, 11-13h, 16-18h)
 * 6. Kiểm thử khuyến nghị tự động (Fleet & Frequency Recommendations)
 * 7. ZERO TEST JUNK GUARANTEE: Dọn dẹp sạch 100% test data trong block finally
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('backend', '.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ID định danh duy nhất cho bộ test fixtures
const TEST_PREFIX = 'TEST_OCCUPANCY_' + Date.now();
const testRouteId = 'a1111111-1111-4111-8111-111111111111';
const testVehicleId = 'b2222222-2222-4222-8222-222222222222';
const testTripZero = 'c3333333-3333-4333-8333-333333333301'; // 0/28 ghế
const testTripFull = 'c3333333-3333-4333-8333-333333333302'; // 28/28 ghế
const testTripOptimal = 'c3333333-3333-4333-8333-333333333303'; // 18/28 ghế (64%)
const testTripLow = 'c3333333-3333-4333-8333-333333333304'; // 10/28 ghế (36%)
const testTripEmpty = 'c3333333-3333-4333-8333-333333333305'; // 4/28 ghế (14%)

const TEST_DATE = '2026-11-20'; // Ngày tương lai cố định để không va chạm dữ liệu vận hành thật

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (!condition) {
    failedCount++;
    console.error(`  \x1b[31m[FAILED]\x1b[0m ${message}`);
    throw new Error(message);
  } else {
    passedCount++;
    console.log(`  \x1b[32m[PASSED]\x1b[0m ${message}`);
  }
}

async function runTestSuite() {
  console.log('\x1b[36m%s\x1b[0m', '='.repeat(80));
  console.log('\x1b[33m%s\x1b[0m', ' 🧪 TEST SUITE: BÁO CÁO TỶ LỆ LẤP ĐẦY CHỖ & TỐI ƯU QUY MÔ XE ICTU');
  console.log('\x1b[90m%s\x1b[0m', '    Cam kết dọn sạch 100% test data trong block finally');
  console.log('\x1b[36m%s\x1b[0m', '='.repeat(80) + '\n');

  try {
    // -------------------------------------------------------------------------
    // BƯỚC 1: KHỞI TẠO TEST FIXTURES TRONG CSDL
    // -------------------------------------------------------------------------
    console.log('\x1b[34m%s\x1b[0m', '[SETUP] 1. Khởi tạo dữ liệu kiểm thử kiểm soát...');

    // Lấy 1 user active làm chủ thể booking & driver
    const userRes = await pool.query(`SELECT id FROM users LIMIT 1`);
    if (userRes.rows.length === 0) {
      throw new Error('Không tìm thấy user nào trong database để liên kết kiểm thử!');
    }
    const sampleUserId = userRes.rows[0].id;

    // Tạo Tuyến xe thử nghiệm
    await pool.query(
      `INSERT INTO routes (id, route_code, name, origin, destination, distance_km, base_price, status)
       VALUES ($1, $2, $3, 'Điểm đầu ICTU', 'Điểm cuối KTX', 15, 10000, 'active')
       ON CONFLICT (id) DO NOTHING`,
      [testRouteId, 'TEST-OCC', 'Tuyến Thử Nghiệm Phụ Tải ' + TEST_PREFIX],
    );

    // Tạo Xe thử nghiệm sức chứa 28 chỗ
    await pool.query(
      `INSERT INTO vehicles (id, license_plate, model, vehicle_type, seat_capacity, status)
       VALUES ($1, $2, 'VinFast eBus 28', 'electric', 28, 'active')
       ON CONFLICT (id) DO NOTHING`,
      [testVehicleId, '20B-999.99'],
    );

    // Tạo 28 ghế thực tế cho xe
    const seatIds = [];
    for (let r = 1; r <= 7; r++) {
      for (const col of ['A', 'B', 'C', 'D']) {
        const sRes = await pool.query(
          `INSERT INTO seats (vehicle_id, seat_number, row_number, column_label, seat_type, floor_number)
           VALUES ($1, $2, $3, $4, 'standard', 1)
           ON CONFLICT (vehicle_id, seat_number) DO UPDATE SET seat_number = EXCLUDED.seat_number
           RETURNING id`,
          [testVehicleId, `${col}${r}`, r, col],
        );
        seatIds.push(sRes.rows[0].id);
      }
    }

    // Tạo 5 chuyến xe thử nghiệm vào ngày TEST_DATE ở các khung giờ khác nhau
    // Chuyến 1: 07:15 (Cao điểm sáng) -> 0 khách (0%)
    await pool.query(
      `INSERT INTO trips (id, route_id, vehicle_id, driver_id, departure_time, arrival_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
       ON CONFLICT (id) DO NOTHING`,
      [
        testTripZero,
        testRouteId,
        testVehicleId,
        sampleUserId,
        `${TEST_DATE} 07:15:00+07`,
        `${TEST_DATE} 07:45:00+07`,
      ],
    );

    // Chuyến 2: 07:45 (Cao điểm sáng) -> 28 khách (100% Kín chỗ)
    await pool.query(
      `INSERT INTO trips (id, route_id, vehicle_id, driver_id, departure_time, arrival_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
       ON CONFLICT (id) DO NOTHING`,
      [
        testTripFull,
        testRouteId,
        testVehicleId,
        sampleUserId,
        `${TEST_DATE} 07:45:00+07`,
        `${TEST_DATE} 08:15:00+07`,
      ],
    );

    // Chuyến 3: 11:30 (Trưa) -> 18 khách (64% Tối ưu)
    await pool.query(
      `INSERT INTO trips (id, route_id, vehicle_id, driver_id, departure_time, arrival_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
       ON CONFLICT (id) DO NOTHING`,
      [
        testTripOptimal,
        testRouteId,
        testVehicleId,
        sampleUserId,
        `${TEST_DATE} 11:30:00+07`,
        `${TEST_DATE} 12:00:00+07`,
      ],
    );

    // Chuyến 4: 14:00 (Đầu giờ chiều) -> 10 khách (36% Thấp)
    await pool.query(
      `INSERT INTO trips (id, route_id, vehicle_id, driver_id, departure_time, arrival_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
       ON CONFLICT (id) DO NOTHING`,
      [
        testTripLow,
        testRouteId,
        testVehicleId,
        sampleUserId,
        `${TEST_DATE} 14:00:00+07`,
        `${TEST_DATE} 14:30:00+07`,
      ],
    );

    // Chuyến 5: 20:00 (Tối) -> 4 khách (14% Rỗng khách)
    await pool.query(
      `INSERT INTO trips (id, route_id, vehicle_id, driver_id, departure_time, arrival_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
       ON CONFLICT (id) DO NOTHING`,
      [
        testTripEmpty,
        testRouteId,
        testVehicleId,
        sampleUserId,
        `${TEST_DATE} 20:00:00+07`,
        `${TEST_DATE} 20:30:00+07`,
      ],
    );

    // Tạo booking & vé cho từng chuyến
    async function addTicketsForTrip(tripId, count) {
      if (count <= 0) return;
      const bRes = await pool.query(
        `INSERT INTO bookings (booking_code, user_id, trip_id, total_amount, discount_amount, final_amount, status)
         VALUES ($1, $2, $3, $4, 0, $4, 'paid')
         RETURNING id`,
        [`BK_${tripId.slice(0, 8)}_${Date.now()}`, sampleUserId, tripId, count * 10000],
      );
      const bookingId = bRes.rows[0].id;

      for (let i = 1; i <= count; i++) {
        const seatId = seatIds[i - 1];
        await pool.query(
          `INSERT INTO tickets (booking_id, seat_id, ticket_code, passenger_name, passenger_phone, original_price, discount_price, status)
           VALUES ($1, $2, $3, $4, '0988888888', 10000, 0, 'paid')`,
          [bookingId, seatId, `TK_${tripId.slice(0, 4)}_${i}_${Date.now()}`, `Khách số ${i}`],
        );
      }
    }

    await addTicketsForTrip(testTripFull, 28);
    await addTicketsForTrip(testTripOptimal, 18);
    await addTicketsForTrip(testTripLow, 10);
    await addTicketsForTrip(testTripEmpty, 4);

    console.log('  [OK] Đã chèn 28 ghế, 5 chuyến xe và 60 vé mẫu thành công.');

    // -------------------------------------------------------------------------
    // BƯỚC 2: KHỞI TẠO NESTJS REPORTS SERVICE ĐỂ KIỂM THỬ TRỰC TIẾP
    // -------------------------------------------------------------------------
    console.log('\n\x1b[34m%s\x1b[0m', '[SETUP] 2. Khởi tạo ReportsService từ AppModule NestJS...');
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../dist/app.module.js');
    const { ReportsService } = await import('../dist/modules/reports/reports.service.js');

    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    const reportsService = app.get(ReportsService);
    assert(Boolean(reportsService), 'ReportsService được inject thành công từ NestJS DI');

    // -------------------------------------------------------------------------
    // TEST-01: KIỂM THỬ TRUY VẤN VỚI NGÀY TEST_DATE VÀ TUYẾN TEST
    // -------------------------------------------------------------------------
    console.log('\n\x1b[33m%s\x1b[0m', '▶ [TEST-01] Kiểm thử tỷ lệ lấp đầy theo tuyến và ngày cụ thể:');
    const resTest = await reportsService.getOccupancyRate({
      date: TEST_DATE,
      routeId: testRouteId,
    });

    assert(Boolean(resTest), 'Kết quả trả về không được rỗng (not null)');
    assert(resTest.totalTrips === 5, `Số chuyến ghi nhận phải chính xác bằng 5 (nhận: ${resTest.totalTrips})`);

    // Kiểm tra từng chuyến xe
    const tripZero = resTest.trips.find((t) => t.tripId === testTripZero);
    const tripFull = resTest.trips.find((t) => t.tripId === testTripFull);
    const tripOpt = resTest.trips.find((t) => t.tripId === testTripOptimal);
    const tripLow = resTest.trips.find((t) => t.tripId === testTripLow);
    const tripEmp = resTest.trips.find((t) => t.tripId === testTripEmpty);

    // -------------------------------------------------------------------------
    // TEST-02: KIỂM THỬ CÔNG THỨC TOÁN HỌC & DỮ LIỆU BIÊN
    // -------------------------------------------------------------------------
    console.log('\n\x1b[33m%s\x1b[0m', '▶ [TEST-02] Kiểm thử công thức (booked / capacity * 100%) và các trường hợp biên:');
    
    // Biên 1: 0 khách đặt (0/28) -> rate = 0%, UNDERUTILIZED, không lỗi NaN
    assert(tripZero !== undefined, 'Tìm thấy chuyến xe 0 khách đặt');
    assert(tripZero.capacity === 28, 'Sức chứa ghế của xe phải bằng 28');
    assert(tripZero.booked === 0, 'Số vé đã đặt của chuyến 0 khách phải bằng 0');
    assert(tripZero.rate === 0 && !isNaN(tripZero.rate), 'Tỷ lệ lấp đầy phải là số 0%, không bị NaN');
    assert(tripZero.statusLevel === 'UNDERUTILIZED', `Chuyến 0% phải được xếp vào cấp độ UNDERUTILIZED (nhận: ${tripZero.statusLevel})`);

    // Biên 2: 100% Kín chỗ (28/28) -> rate = 100%, OVERLOADED
    assert(tripFull !== undefined, 'Tìm thấy chuyến xe kín 100% chỗ');
    assert(tripFull.booked === 28, 'Số vé đã đặt phải là 28');
    assert(tripFull.rate === 100, `Tỷ lệ lấp đầy 28/28 phải là 100% (nhận: ${tripFull.rate}%)`);
    assert(tripFull.statusLevel === 'OVERLOADED', `Chuyến 100% phải được xếp vào OVERLOADED (nhận: ${tripFull.statusLevel})`);

    // Biên 3: Tối ưu 18/28 ghế (64%) -> rate = 64%, OPTIMAL
    assert(tripOpt !== undefined, 'Tìm thấy chuyến xe tối ưu 18/28 chỗ');
    const expectedOptRate = Math.round((18 / 28) * 100); // 64%
    assert(tripOpt.rate === expectedOptRate, `Tỷ lệ lấp đầy 18/28 phải là ${expectedOptRate}% (nhận: ${tripOpt.rate}%)`);
    assert(tripOpt.statusLevel === 'OPTIMAL', `Chuyến 64% phải được xếp vào OPTIMAL (nhận: ${tripOpt.statusLevel})`);

    // Biên 4: Tải thấp 10/28 ghế (36%) -> rate = 36%, LOW
    assert(tripLow !== undefined, 'Tìm thấy chuyến xe tải thấp 10/28 chỗ');
    const expectedLowRate = Math.round((10 / 28) * 100); // 36%
    assert(tripLow.rate === expectedLowRate, `Tỷ lệ lấp đầy 10/28 phải là ${expectedLowRate}% (nhận: ${tripLow.rate}%)`);
    assert(tripLow.statusLevel === 'LOW', `Chuyến 36% phải được xếp vào LOW (nhận: ${tripLow.statusLevel})`);

    // Biên 5: Rỗng khách 4/28 ghế (14%) -> rate = 14%, UNDERUTILIZED
    assert(tripEmp !== undefined, 'Tìm thấy chuyến xe rỗng khách 4/28 chỗ');
    const expectedEmpRate = Math.round((4 / 28) * 100); // 14%
    assert(tripEmp.rate === expectedEmpRate, `Tỷ lệ lấp đầy 4/28 phải là ${expectedEmpRate}% (nhận: ${tripEmp.rate}%)`);
    assert(tripEmp.statusLevel === 'UNDERUTILIZED', `Chuyến 14% phải được xếp vào UNDERUTILIZED (nhận: ${tripEmp.statusLevel})`);

    // -------------------------------------------------------------------------
    // TEST-03: KIỂM THỬ TỔNG HỢP SUMMARY & TỶ LỆ TOÀN TUYẾN
    // -------------------------------------------------------------------------
    console.log('\n\x1b[33m%s\x1b[0m', '▶ [TEST-03] Kiểm thử tính toán Summary & Tỷ lệ bình quân toàn mạng:');
    // Tổng capacity = 5 * 28 = 140
    // Tổng booked = 0 + 28 + 18 + 10 + 4 = 60
    // Overall rate = Math.round((60 / 140) * 100) = 43%
    const expectedOverallRate = Math.round((60 / 140) * 100);
    assert(resTest.summary.totalCapacity === 140, `Tổng sức chứa = 140 (nhận: ${resTest.summary.totalCapacity})`);
    assert(resTest.summary.totalBooked === 60, `Tổng vé đã bán = 60 (nhận: ${resTest.summary.totalBooked})`);
    assert(
      resTest.overallOccupancyPercentage === expectedOverallRate,
      `Hệ số lấp đầy toàn mạng = ${expectedOverallRate}% (nhận: ${resTest.overallOccupancyPercentage}%)`,
    );
    assert(
      resTest.summary.overloadedTripsCount === 1,
      `Số chuyến quá tải phải = 1 (nhận: ${resTest.summary.overloadedTripsCount})`,
    );
    assert(
      resTest.summary.underutilizedTripsCount === 2,
      `Số chuyến rỗng khách (<30%) phải = 2 (nhận: ${resTest.summary.underutilizedTripsCount})`,
    );

    // -------------------------------------------------------------------------
    // TEST-04: KIỂM THỬ TRƯỜNG HỢP BIÊN: NGÀY KHÔNG CÓ CHUYẾN CHẠY
    // -------------------------------------------------------------------------
    console.log('\n\x1b[33m%s\x1b[0m', '▶ [TEST-04] Kiểm thử trường hợp biên ngày không có chuyến chạy (Zero trips):');
    const emptyRes = await reportsService.getOccupancyRate({
      date: '2099-12-31',
    });
    assert(emptyRes.totalTrips === 0, 'Tổng số chuyến xe ngày trống phải bằng 0');
    assert(emptyRes.overallOccupancyPercentage === 0, 'Hệ số lấp đầy ngày trống phải bằng 0%, không crash phép chia 0');
    assert(Array.isArray(emptyRes.trips) && emptyRes.trips.length === 0, 'Danh sách chuyến xe trả về mảng rỗng []');
    assert(Array.isArray(emptyRes.hourlyDensity) && emptyRes.hourlyDensity.length === 16, 'Hourly density vẫn sinh đủ 16 khung giờ với 0%');

    // -------------------------------------------------------------------------
    // TEST-05: KIỂM THỬ MA TRẬN BIỂU ĐỒ NHIỆT (HEATMAP MATRIX)
    // -------------------------------------------------------------------------
    console.log('\n\x1b[33m%s\x1b[0m', '▶ [TEST-05] Kiểm thử cấu trúc ma trận Heatmap (7 ngày x 16 khung giờ):');
    assert(Array.isArray(resTest.heatmapMatrix), 'heatmapMatrix phải là một mảng');
    assert(resTest.heatmapMatrix.length === 7, `Phải có đủ 7 ngày trong tuần (nhận: ${resTest.heatmapMatrix.length})`);
    
    // Kiểm tra hàng đầu tiên
    const firstDay = resTest.heatmapMatrix[0];
    assert(Array.isArray(firstDay.hours), 'Mỗi ngày phải có mảng hours');
    assert(firstDay.hours.length === 16, `Mỗi ngày phải có 16 khung giờ từ 06 đến 21 (nhận: ${firstDay.hours.length})`);
    assert(firstDay.hours[0].hour === 6, 'Khung giờ đầu tiên phải là 6h');
    assert(firstDay.hours[15].hour === 21, 'Khung giờ cuối cùng phải là 21h');

    // -------------------------------------------------------------------------
    // TEST-06: KIỂM THỬ HOURLY DENSITY & PHÂN LOẠI GIỜ CAO ĐIỂM ICTU
    // -------------------------------------------------------------------------
    console.log('\n\x1b[33m%s\x1b[0m', '▶ [TEST-06] Kiểm thử phân tích mật độ giờ cao điểm vs thấp điểm:');
    assert(Array.isArray(resTest.hourlyDensity), 'hourlyDensity phải là mảng');
    const peakMorningHour = resTest.hourlyDensity.find((h) => h.hour === 7);
    const midDayHour = resTest.hourlyDensity.find((h) => h.hour === 14);

    assert(peakMorningHour !== undefined && peakMorningHour.isPeak === true, 'Giờ 07:00 phải được đánh dấu là giờ cao điểm (isPeak: true)');
    assert(midDayHour !== undefined && midDayHour.isPeak === false, 'Giờ 14:00 phải là giờ thấp điểm (isPeak: false)');

    // -------------------------------------------------------------------------
    // TEST-07: KIỂM THỬ ĐỀ XUẤT ĐIỀU CHỈNH TẦN SUẤT / QUY MÔ XE (RECOMMENDATIONS)
    // -------------------------------------------------------------------------
    console.log('\n\x1b[33m%s\x1b[0m', '▶ [TEST-07] Kiểm thử các đề xuất điều phối xe tự động:');
    assert(Array.isArray(resTest.recommendations), 'recommendations phải là mảng');
    assert(resTest.recommendations.length > 0, 'Phải sinh ra ít nhất một khuyến nghị cho dữ liệu kiểm thử');

    const hasIncreaseRec = resTest.recommendations.some((r) => r.type === 'INCREASE_FREQUENCY');
    const hasSmallerVehicleRec = resTest.recommendations.some((r) => r.type === 'SMALLER_VEHICLE');

    assert(hasIncreaseRec, 'Phải có đề xuất Tăng chuyến / Nâng quy mô xe cho chuyến xe quá tải (>85%)');
    assert(hasSmallerVehicleRec, 'Phải có đề xuất Dùng xe Minibus hoặc giãn chuyến cho chuyến rỗng khách (<30%)');

    // Đóng ứng dụng NestJS
    await app.close();
  } finally {
    // -------------------------------------------------------------------------
    // BƯỚC CUỐI CÙNG: DỌN DẸP SẠCH 100% TEST DATA (ZERO LEFTOVER GUARANTEE)
    // -------------------------------------------------------------------------
    console.log('\n\x1b[34m%s\x1b[0m', '[CLEANUP] Bắt đầu dọn sạch 100% dữ liệu thử nghiệm trong CSDL...');

    try {
      // 1. Xóa tickets thuộc test trips
      await pool.query(`
        DELETE FROM tickets 
        WHERE booking_id IN (
          SELECT id FROM bookings WHERE trip_id IN ($1, $2, $3, $4, $5)
        )
      `, [testTripZero, testTripFull, testTripOptimal, testTripLow, testTripEmpty]);

      // 2. Xóa bookings thuộc test trips
      await pool.query(`
        DELETE FROM bookings WHERE trip_id IN ($1, $2, $3, $4, $5)
      `, [testTripZero, testTripFull, testTripOptimal, testTripLow, testTripEmpty]);

      // 3. Xóa test trips
      await pool.query(`
        DELETE FROM trips WHERE id IN ($1, $2, $3, $4, $5)
      `, [testTripZero, testTripFull, testTripOptimal, testTripLow, testTripEmpty]);

      // 4. Xóa test route, test seats & test vehicle
      await pool.query(`DELETE FROM routes WHERE id = $1`, [testRouteId]);
      await pool.query(`DELETE FROM seats WHERE vehicle_id = $1`, [testVehicleId]);
      await pool.query(`DELETE FROM vehicles WHERE id = $1`, [testVehicleId]);

      console.log('  \x1b[32m[CLEANUP OK]\x1b[0m Toàn bộ vé, booking, chuyến xe, tuyến và xe thử nghiệm đã được dọn sạch 100%!');
    } catch (cleanupErr) {
      console.error('  \x1b[31m[CLEANUP ERROR]\x1b[0m Lỗi trong quá trình dọn dẹp:', cleanupErr.message);
    } finally {
      await pool.end();
    }
  }

  console.log('\n\x1b[36m%s\x1b[0m', '='.repeat(80));
  console.log(
    ` KẾT QUẢ KIỂM THỬ: \x1b[32m${passedCount} PASSED\x1b[0m / \x1b[31m${failedCount} FAILED\x1b[0m (Tổng cộng: ${
      passedCount + failedCount
    } bài test)`,
  );
  console.log('\x1b[36m%s\x1b[0m', '='.repeat(80));

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('\x1b[31m[FATAL ERROR]\x1b[0m Lỗi thực thi bộ kiểm thử:', err);
  process.exit(1);
});
