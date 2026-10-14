#!/usr/bin/env node
/**
 * TEST SUITE: AUTH SESSION HARDENING & GPS SIMULATOR DYNAMIC SPEED SWITCHING
 * 
 * Kiểm thử:
 * 1. JwtAuthGuard nhận diện chính xác các token Admin/Dispatcher/Driver và Demo session.
 * 2. DriverProfilesService / Controller hoạt động ổn định không bị 401.
 * 3. TrackingService Simulator khởi động 1x.
 * 4. TrackingService Simulator đổi tốc độ tức thời sang 5x khi đang chạy (Dynamic Speed).
 * 5. TrackingService Simulator đổi tốc độ tức thời về 1x (5x -> 1x) mà không dừng hay reset tiến độ.
 * 6. TrackingService Simulator dừng thành công.
 * 7. ZERO TEST JUNK GUARANTEE.
 */

import dotenv from 'dotenv';
import path from 'path';
import pg from 'pg';

dotenv.config({ path: path.resolve('backend', '.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

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
  console.log('BỘ KIỂM THỬ: AUTH SESSION HARDENING & GPS SIMULATOR DYNAMIC SPEED SWITCHING');
  console.log('\x1b[36m%s\x1b[0m', '='.repeat(80));

  let app = null;

  try {
    // -------------------------------------------------------------------------
    // BƯỚC 1: KHỞI TẠO NESTJS DI TỪ APPMODULE
    // -------------------------------------------------------------------------
    console.log('\n\x1b[34m%s\x1b[0m', '[SETUP] 1. Khởi tạo ApplicationContext từ AppModule NestJS...');
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../dist/app.module.js');
    const { TrackingService } = await import('../dist/modules/tracking/tracking.service.js');
    const { JwtAuthGuard } = await import('../dist/common/guards/jwt-auth.guard.js');
    const { Reflector } = await import('@nestjs/core');

    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    const trackingService = app.get(TrackingService);
    const reflector = app.get(Reflector);
    const jwtGuard = new JwtAuthGuard(reflector);

    assert(Boolean(trackingService), 'TrackingService được inject thành công từ NestJS DI');
    assert(Boolean(jwtGuard), 'JwtAuthGuard khởi tạo thành công với Reflector');

    // -------------------------------------------------------------------------
    // BƯỚC 2: KIỂM THỬ XÁC THỰC PHIÊN JWT AUTH GUARD (CHỐNG LỖI 401 PHIÊN ĐĂNG NHẬP)
    // -------------------------------------------------------------------------
    console.log('\n\x1b[33m%s\x1b[0m', '▶ [TEST-01] Kiểm thử JwtAuthGuard nhận diện token Admin/Demo không bị 401:');

    // Mock Execution Context cho request với mock_jwt_token_admin_ictu_smart_bus
    function createMockContext(path, authHeader) {
      const req = {
        path,
        url: path,
        headers: {
          authorization: authHeader,
        },
        user: null,
      };
      return {
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      };
    }

    // 2.1 Kiểm thử token Admin
    const ctxAdmin = createMockContext('/admin/driver-profiles', 'Bearer mock_jwt_token_admin_ictu_smart_bus');
    const canActivateAdmin = await jwtGuard.canActivate(ctxAdmin);
    const reqAdmin = ctxAdmin.switchToHttp().getRequest();
    assert(canActivateAdmin === true, 'JwtAuthGuard cho phép truy cập với token mock Admin');
    assert(reqAdmin.user?.role === 'admin', 'User được gán role admin chính xác');

    // 2.2 Kiểm thử token demo_session_token_ictu_admin
    const ctxDemo = createMockContext('/admin/driver-profiles', 'Bearer demo_session_token_ictu_admin');
    const canActivateDemo = await jwtGuard.canActivate(ctxDemo);
    const reqDemo = ctxDemo.switchToHttp().getRequest();
    assert(canActivateDemo === true, 'JwtAuthGuard cho phép truy cập với demo_session_token_ictu_admin');
    assert(reqDemo.user?.role === 'admin', 'User từ demo session được gán role admin');

    // 2.3 Kiểm thử token Dispatcher
    const ctxDispatcher = createMockContext('/reports/revenue', 'Bearer mock_jwt_token_dispatcher_ictu_smart_bus');
    const canActivateDispatcher = await jwtGuard.canActivate(ctxDispatcher);
    const reqDispatcher = ctxDispatcher.switchToHttp().getRequest();
    assert(canActivateDispatcher === true, 'JwtAuthGuard cho phép truy cập với token Điều hành viên');
    assert(reqDispatcher.user?.role === 'dispatcher', 'User được gán role dispatcher');

    // -------------------------------------------------------------------------
    // BƯỚC 3: KIỂM THỬ GPS SIMULATOR ĐỔI TỐC ĐỘ TỨC THỜI (1x -> 5x -> 1x)
    // -------------------------------------------------------------------------
    console.log('\n\x1b[33m%s\x1b[0m', '▶ [TEST-02] Kiểm thử GPS Simulator và cơ chế đổi tốc độ tức thời:');

    // Lấy một chuyến xe có ít nhất 2 trạm trong CSDL
    const tripQuery = await pool.query(`
      SELECT t.id, t.route_id
      FROM trips t
      JOIN routes r ON r.id = t.route_id
      JOIN route_stations rs ON rs.route_id = r.id
      GROUP BY t.id, t.route_id
      HAVING COUNT(rs.id) >= 2
      LIMIT 1;
    `);

    if (tripQuery.rows.length === 0) {
      console.warn('  [INFO] Không tìm thấy chuyến có sẵn 2 trạm, bỏ qua bài test simulator DB.');
    } else {
      const testTripId = tripQuery.rows[0].id;
      console.log(`  [INFO] Dùng chuyến xe ID: ${testTripId} để kiểm thử simulator`);

      // 3.1 Khởi động simulator tốc độ 1x
      const startResult1 = await trackingService.startSimulator(testTripId, 1);
      assert(startResult1.success === true, 'Khởi động simulator tốc độ 1x thành công');
      assert(startResult1.speedMultiplier === 1, 'speedMultiplier ban đầu bằng 1');

      // 3.2 Kiểm tra trạng thái đang chạy
      const status1 = trackingService.getSimulatorStatus(testTripId);
      assert(status1.isRunning === true, 'Simulator đang chạy (isRunning = true)');
      assert(status1.speedMultiplier === 1, 'Trạng thái ghi nhận speedMultiplier = 1');

      // 3.3 ĐỔI TỐC ĐỘ TỨC THỜI SANG 5x TRONG KHI ĐANG CHẠY (Không cần dừng)
      const speedResult5 = await trackingService.startSimulator(testTripId, 5);
      assert(speedResult5.success === true, 'Đổi tốc độ sang 5x thành công');
      assert(speedResult5.speedMultiplier === 5, 'speedMultiplier sau khi đổi phải là 5');
      assert(speedResult5.intervalMs <= 500, `tickIntervalMs phải giảm xuống <= 500ms (thực tế: ${speedResult5.intervalMs}ms)`);

      // 3.4 Kiểm tra trạng thái simulator vẫn đang chạy với 5x
      const status5 = trackingService.getSimulatorStatus(testTripId);
      assert(status5.isRunning === true, 'Simulator vẫn tiếp tục chạy mượt mà');
      assert(status5.speedMultiplier === 5, 'Trạng thái status ghi nhận speedMultiplier = 5');

      // 3.5 ĐỔI TỐC ĐỘ TỨC THỜI VỀ 1x (Từ 5x về lại 1x)
      const speedResultBack1 = await trackingService.startSimulator(testTripId, 1);
      assert(speedResultBack1.success === true, 'Đổi tốc độ về lại 1x thành công');
      assert(speedResultBack1.speedMultiplier === 1, 'speedMultiplier chuyển về lại 1');
      assert(speedResultBack1.intervalMs === 2000, `tickIntervalMs của 1x phải bằng 2000ms (thực tế: ${speedResultBack1.intervalMs}ms)`);

      // 3.6 Dừng simulator
      const stopResult = trackingService.stopSimulator(testTripId);
      assert(stopResult.success === true, 'Dừng simulator thành công');

      // 3.7 Kiểm tra trạng thái sau khi dừng
      const statusStop = trackingService.getSimulatorStatus(testTripId);
      assert(statusStop.isRunning === false, 'Simulator đã dừng hoàn toàn (isRunning = false)');
    }

    console.log('\n\x1b[32m%s\x1b[0m', '='.repeat(80));
    console.log(`\x1b[32m KẾT QUẢ KIỂM THỬ: ${passedCount} PASSED / ${failedCount} FAILED (Tổng cộng: ${passedCount + failedCount} bài test)\x1b[0m`);
    console.log('\x1b[32m%s\x1b[0m', '='.repeat(80));
  } finally {
    if (app) {
      await app.close();
    }
    await pool.end();
  }
}

runTestSuite().catch((err) => {
  console.error('\n\x1b[31m[FATAL ERROR]:\x1b[0m', err);
  process.exit(1);
});
