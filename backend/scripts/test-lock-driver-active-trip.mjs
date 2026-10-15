/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * BỘ KIỂM THỬ TỰ ĐỘNG: CHẶN ĐỔI TÀI XẾ & XE BUÝT KHI CHUYẾN XE ĐANG HOẠT ĐỘNG
 *
 * Kiểm tra:
 * 1. Đăng nhập Admin lấy JWT Bearer token hợp lệ.
 * 2. Chặn điều phối (dispatch) đổi tài xế/xe khi chuyến xe ở trạng thái IN_PROGRESS -> 400 Bad Request.
 * 3. Chặn hủy phân công (unassign) khi chuyến xe ở trạng thái IN_PROGRESS -> 400 Bad Request.
 * 4. Chặn điều phối khi chuyến xe ở trạng thái DEPARTED (Đã xuất bến) -> 400 Bad Request.
 * 5. Chặn điều phối khi chuyến xe ở trạng thái BOARDING (Đang đón khách) -> 400 Bad Request.
 * 6. Cho phép điều phối hợp lệ khi chuyến xe ở trạng thái SCHEDULED (Chờ chạy) -> 200/201 OK.
 * 7. Kiểm tra Audit Log: Xác minh ghi nhận hành vi bị chặn an toàn với action 'DISPATCH_BLOCKED_TRIP_ACTIVE'.
 * 8. ZERO TEST JUNK: Dọn dẹp sạch sẽ 100% dữ liệu thử nghiệm sau khi hoàn tất.
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('backend', '.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve('.env') });
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { TripStatus } from '../dist/common/constants/status.constant.js';

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASSED] ${testName}`);
    passedCount++;
  } else {
    console.error(`  [FAILED] ${testName} ${details ? `-> ${details}` : ''}`);
    failedCount++;
  }
}

async function runTestSuite() {
  console.log('='.repeat(85));
  console.log('BỘ KIỂM THỬ: CHẶN ĐỔI TÀI XẾ & XE KHI CHUYẾN XE ĐANG CHẠY (IN_PROGRESS/DEPARTED/BOARDING)');
  console.log('='.repeat(85));

  let app;
  let baseUrl;
  let adminToken;
  const createdTripIds = [];

  try {
    console.log('\n[SETUP] 1. Khởi tạo NestJS HTTP Server kiểm thử nội bộ...');
    app = await NestFactory.create(AppModule, { logger: false });

    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? 3000 : address.port;
    baseUrl = `http://localhost:${port}/api/v1`;
    console.log(`  Server test đang lắng nghe tại: ${baseUrl}`);

    const tripRepo = app.get('TripEntityRepository');
    const routeRepo = app.get('RouteEntityRepository');
    const userRepo = app.get('UserEntityRepository');
    const vehicleRepo = app.get('VehicleEntityRepository');
    const auditRepo = app.get('ActivityLogEntityRepository');

    // 1.1 Đăng nhập Admin lấy token
    console.log('\n[AUTH] Đăng nhập Admin để lấy JWT token điều phối...');
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@smartbus.ictu.vn',
        password: 'Password@123',
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200, 'Admin đăng nhập thành công HTTP 200');
    adminToken = adminLoginData.accessToken;
    assert(Boolean(adminToken), 'Nhận access token hợp lệ của Admin');

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };

    // Tìm tài nguyên phục vụ test
    const route = await routeRepo.findOne({ where: { status: 'active' } });
    const profileRepo = app.get('DriverProfileEntityRepository');
    const approvedProfiles = await profileRepo.find({
      where: { status: 'approved' },
      relations: { user: true },
      take: 10,
    });
    let driverList = approvedProfiles.map((p) => p.user).filter(Boolean);

    if (driverList.length < 2) {
      const allUsers = await userRepo.find({ take: 20 });
      driverList = allUsers.filter((u) => u.email && u.email.startsWith('driver.'));
    }

    const vehicle = await vehicleRepo.findOne({ where: { status: 'active' } });

    if (!route || driverList.length < 2 || !vehicle) {
      throw new Error('Cơ sở dữ liệu thiếu Route, Vehicle hoặc tối thiểu 2 Drivers đủ điều kiện GPLX.');
    }

    const driver1 = driverList[0];
    const driver2 = driverList[1];
    console.log(`  Route: ${route.routeCode} (${route.name})`);
    console.log(`  Driver 1 (GPLX Approved): ${driver1.fullName} (${driver1.id})`);
    console.log(`  Driver 2 (GPLX Approved): ${driver2.fullName} (${driver2.id})`);
    console.log(`  Vehicle: ${vehicle.licensePlate} (${vehicle.id})`);

    // Tạo chuyến xe thử nghiệm ở trạng thái IN_PROGRESS
    console.log('\n[TEST GIAI ĐOẠN 1] Tạo chuyến xe thử nghiệm đang lăn bánh (status = IN_PROGRESS)...');
    const now = new Date();
    const testTrip = tripRepo.create({
      routeId: route.id,
      driverId: driver1.id,
      vehicleId: vehicle.id,
      departureTime: new Date(now.getTime() - 15 * 60 * 1000), // đã xuất phát 15 phút trước
      arrivalTime: new Date(now.getTime() + 30 * 60 * 1000),
      status: TripStatus.IN_PROGRESS,
      tripType: 'regular',
      note: 'TEST CHUYẾN XE ĐANG LĂN BÁNH TRÊN ĐƯỜNG',
    });
    const savedTrip = await tripRepo.save(testTrip);
    createdTripIds.push(savedTrip.id);
    console.log(`  Đã tạo Trip ID: ${savedTrip.id} với trạng thái: ${savedTrip.status}`);

    // TEST CASE 1: Cố tình đổi tài xế khi chuyến xe đang IN_PROGRESS
    console.log('\n[TEST CASE 1] Thử đổi sang Tài xế 2 khi chuyến xe đang IN_PROGRESS...');
    const dispatchRes1 = await fetch(`${baseUrl}/trips/dispatch`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        tripId: savedTrip.id,
        driverId: driver2.id,
        vehicleId: vehicle.id,
      }),
    });
    const json1 = await dispatchRes1.json();
    assert(dispatchRes1.status === 400, 'Server phải từ chối đổi tài xế với HTTP 400 Bad Request', `Nhận HTTP ${dispatchRes1.status}`);
    assert(
      (json1.message || '').includes('Nghiêm cấm thay đổi tài xế hoặc phương tiện khi chuyến xe đang hoạt động'),
      'Thông báo lỗi phải nêu rõ quy chuẩn an toàn vận tải và trạng thái chuyến',
      json1.message
    );

    // TEST CASE 2: Cố tình hủy phân công (unassignAll) khi chuyến xe đang IN_PROGRESS
    console.log('\n[TEST CASE 2] Thử hủy phân công (unassignAll) khi chuyến xe đang IN_PROGRESS...');
    const dispatchRes2 = await fetch(`${baseUrl}/trips/dispatch`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        tripId: savedTrip.id,
        unassignAll: true,
      }),
    });
    const json2 = await dispatchRes2.json();
    assert(dispatchRes2.status === 400, 'Server phải từ chối unassign với HTTP 400 Bad Request', `Nhận HTTP ${dispatchRes2.status}`);
    assert(
      (json2.message || '').includes('Nghiêm cấm hủy phân công hoặc thay đổi nhân sự'),
      'Thông báo lỗi phải nêu rõ cấm hủy phân công khi chuyến xe đang hoạt động',
      json2.message
    );

    // TEST CASE 3: Kiểm tra với trạng thái DEPARTED (Đã xuất bến)
    console.log('\n[TEST CASE 3] Cập nhật chuyến xe sang DEPARTED và thử đổi tài xế...');
    await tripRepo.update(savedTrip.id, { status: TripStatus.DEPARTED });
    const dispatchRes3 = await fetch(`${baseUrl}/trips/dispatch`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        tripId: savedTrip.id,
        driverId: driver2.id,
        vehicleId: vehicle.id,
      }),
    });
    const json3 = await dispatchRes3.json();
    assert(dispatchRes3.status === 400, 'Server phải từ chối khi chuyến DEPARTED với HTTP 400', `Nhận HTTP ${dispatchRes3.status}`);
    assert(
      (json3.message || '').includes('Đã xuất bến'),
      'Thông báo lỗi phải hiển thị trạng thái tiếng Việt: Đã xuất bến',
      json3.message
    );

    // TEST CASE 4: Kiểm tra với trạng thái BOARDING (Đang đón khách tại bến)
    console.log('\n[TEST CASE 4] Cập nhật chuyến xe sang BOARDING và thử đổi tài xế...');
    await tripRepo.update(savedTrip.id, { status: TripStatus.BOARDING });
    const dispatchRes4 = await fetch(`${baseUrl}/trips/dispatch`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        tripId: savedTrip.id,
        driverId: driver2.id,
        vehicleId: vehicle.id,
      }),
    });
    const json4 = await dispatchRes4.json();
    assert(dispatchRes4.status === 400, 'Server phải từ chối khi chuyến BOARDING với HTTP 400', `Nhận HTTP ${dispatchRes4.status}`);
    assert(
      (json4.message || '').includes('Đang đón khách tại bến'),
      'Thông báo lỗi phải hiển thị trạng thái tiếng Việt: Đang đón khách tại bến',
      json4.message
    );

    // TEST CASE 5: Kiểm tra Audit Log an toàn vận tải
    console.log('\n[TEST CASE 5] Kiểm tra bản ghi Audit Log an toàn (DISPATCH_BLOCKED_TRIP_ACTIVE)...');
    const blockedLogs = await auditRepo.find({
      where: {
        action: 'DISPATCH_BLOCKED_TRIP_ACTIVE',
        resourceId: savedTrip.id,
      },
      order: { timestamp: 'DESC' },
    });
    assert(blockedLogs.length > 0, `Đã ghi nhận ${blockedLogs.length} bản ghi Audit Log an toàn vi phạm điều phối`, `Tìm thấy ${blockedLogs.length}`);
    if (blockedLogs.length > 0) {
      const latestLog = blockedLogs[0];
      assert(
        latestLog.status === 'SAFETY_BLOCKED',
        'Audit Log status phải là SAFETY_BLOCKED',
        latestLog.status
      );
      assert(
        latestLog.changes?.tripId === savedTrip.id,
        'Audit Log changes phải chứa đúng tripId bị chặn',
        JSON.stringify(latestLog.changes)
      );
    }

    // TEST CASE 6: Kiểm tra khi chuyến xe ở trạng thái SCHEDULED (Chờ chạy) -> Phải cho phép điều phối
    console.log('\n[TEST CASE 6] Cập nhật chuyến xe về SCHEDULED (Chờ chạy 2 giờ tới) và điều phối...');
    const futureDep = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const futureArr = new Date(futureDep.getTime() + 45 * 60 * 1000);
    await tripRepo.update(savedTrip.id, {
      status: TripStatus.SCHEDULED,
      departureTime: futureDep,
      arrivalTime: futureArr,
    });

    const dispatchRes5 = await fetch(`${baseUrl}/trips/dispatch`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        tripId: savedTrip.id,
        driverId: driver2.id,
        vehicleId: vehicle.id,
      }),
    });
    const json5 = await dispatchRes5.json().catch(() => ({}));
    assert(
      dispatchRes5.status === 200 || dispatchRes5.status === 201,
      `Khi chuyến SCHEDULED, điều phối phải thành công (HTTP ${dispatchRes5.status})`,
      `Nhận HTTP ${dispatchRes5.status} - ${json5.message || ''}`
    );

    const reloadedTrip = await tripRepo.findOne({ where: { id: savedTrip.id } });
    assert(
      reloadedTrip?.driverId === driver2.id,
      'Tài xế của chuyến xe SCHEDULED đã được cập nhật thành công sang Driver 2',
      `DriverId: ${reloadedTrip?.driverId}`
    );

  } catch (err) {
    console.error('\n[LỖI TRONG QUÁ TRÌNH KIỂM THỬ]:', err.message);
    failedCount++;
  } finally {
    // CLEANUP: Dọn dẹp an toàn 100% dữ liệu test
    console.log('\n[CLEANUP] Dọn dẹp an toàn 100% dữ liệu thử nghiệm (Zero Test Junk)...');
    try {
      if (app) {
        const tripRepo = app.get('TripEntityRepository');
        const auditRepo = app.get('ActivityLogEntityRepository');
        const notifRepo = app.get('NotificationEntityRepository');

        for (const tripId of createdTripIds) {
          await notifRepo.delete({ tripId }).catch(() => {});
          await auditRepo.delete({ resourceId: tripId }).catch(() => {});
          await tripRepo.delete({ id: tripId }).catch(() => {});
          console.log(`  Đã xóa sạch chuyến xe thử nghiệm: ${tripId}`);
        }
        await app.close();
        console.log('[TEARDOWN] Đã đóng HTTP Server kiểm thử an toàn.');
      }
    } catch (cleanupErr) {
      console.warn('  Lỗi khi dọn dẹp dữ liệu kiểm thử:', cleanupErr.message);
    }

    console.log('\n' + '='.repeat(85));
    console.log(`KẾT QUẢ KIỂM THỬ: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('='.repeat(85));

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTestSuite();
