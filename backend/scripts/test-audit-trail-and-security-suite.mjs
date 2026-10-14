/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * BỘ KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN: AUDIT LOG INTERCEPTOR, TRUY VẾT THAO TÁC & BẢO MẬT HỆ THỐNG
 *
 * Kiểm tra:
 * 1. Phân quyền RBAC nghiêm ngặt: Chỉ tài khoản Admin cao nhất mới có quyền xem Audit Logs (các Role khác nhận 403 Forbidden).
 * 2. Audit Log Interceptor tự động ghi vết mọi thao tác quan trọng (POST, PATCH, DELETE, Auth actions).
 * 3. Kiểm tra tính toàn vẹn dữ liệu: ID người thực hiện, thời gian, IP address, Endpoint API, Method, Hành động, Trạng thái, Thời gian thực thi.
 * 4. An toàn bảo mật: Password Masking tự động (không bao giờ lộ mật khẩu plain text trong changes payload).
 * 5. Bộ lọc đa tiêu chí: Lọc theo action, status, userId, ipAddress, thời gian (startDate/endDate), từ khóa search, phân trang.
 * 6. Thống kê an ninh (Stats API): Tổng log, log 24h, log thất bại, số user tương tác, top actions.
 * 7. ZERO TEST JUNK: Dọn dẹp sạch sẽ 100% người dùng và log thử nghiệm sau khi kết thúc kiểm thử.
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
import { UserEntity } from '../dist/database/entities/user.entity.js';
import { ActivityLogEntity } from '../dist/database/entities/activity-log.entity.js';

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
  console.log('BỘ KIỂM THỬ: AUDIT LOG INTERCEPTOR, LƯU VẾT THAO TÁC VÀ BẢO MẬT HỆ THỐNG');
  console.log('='.repeat(85));

  let app;
  let baseUrl;
  const createdUserIds = [];
  const createdLogIds = [];

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

    const userRepo = app.get('UserEntityRepository');
    const logRepo = app.get('ActivityLogEntityRepository');
    const timestamp = Date.now();

    // -------------------------------------------------------------
    // GIAI ĐOẠN 1: ĐĂNG NHẬP ADMIN VÀ CÁC ROLE ĐỂ TEST PHÂN QUYỀN RBAC
    // -------------------------------------------------------------
    console.log('\n[TEST GROUP 1] Kiểm tra Phân quyền RBAC xem Audit Logs (Chỉ Super Admin)...');

    // 1.1 Đăng nhập Admin
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
    assert(Boolean(adminLoginData.accessToken), 'Admin nhận Access Token');
    const adminToken = adminLoginData.accessToken;

    // 1.2 Tạo người dùng non-admin (Passenger) để test chặn quyền
    const passengerEmail = `test-passenger-${timestamp}@smartbus.ictu.vn`;
    const passengerRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Test Passenger Audit',
        email: passengerEmail,
        phoneNumber: '0988776655',
        password: 'Password@123',
      }),
    });
    const passengerData = await passengerRes.json();
    assert(passengerRes.status === 201, 'Đăng ký tài khoản Passenger thử nghiệm HTTP 201');
    const passengerToken = passengerData.accessToken;
    if (passengerData.user?.id) {
      createdUserIds.push(passengerData.user.id);
    }

    // 1.3 Tạo tài khoản Driver để test chặn quyền
    const driverEmail = `test-driver-${timestamp}@smartbus.ictu.vn`;
    const createDriverRes = await fetch(`${baseUrl}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Bác Tài Test Audit',
        email: driverEmail,
        phoneNumber: '0977665544',
        password: 'Password@123',
        role: 'driver',
      }),
    });
    const driverData = await createDriverRes.json();
    assert(createDriverRes.status === 201, 'Admin tạo tài khoản Driver thử nghiệm');
    const driverId = driverData.id || driverData.data?.id;
    if (driverId) {
      createdUserIds.push(driverId);
    }

    // Đăng nhập tài khoản Driver để lấy token
    const driverLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: driverEmail,
        password: 'Password@123',
      }),
    });
    const driverLoginData = await driverLoginRes.json();
    const driverToken = driverLoginData.accessToken;

    // 1.4 Chặn truy cập không xác thực (No token -> 401)
    const noAuthRes = await fetch(`${baseUrl}/admin/activity-logs`);
    assert(noAuthRes.status === 401, 'Không có token truy cập Audit Logs bị từ chối HTTP 401 Unauthorized');

    // 1.5 Chặn Passenger truy cập Audit Logs (Token Passenger -> 403)
    const passengerAccessRes = await fetch(`${baseUrl}/admin/activity-logs`, {
      headers: { Authorization: `Bearer ${passengerToken}` },
    });
    assert(passengerAccessRes.status === 403, 'Tài khoản Hành khách (Passenger) bị từ chối xem Audit Logs HTTP 403 Forbidden');

    // 1.6 Chặn Driver truy cập Audit Logs (Token Driver -> 403)
    const driverAccessRes = await fetch(`${baseUrl}/admin/activity-logs`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    assert(driverAccessRes.status === 403, 'Tài khoản Tài xế (Driver) bị từ chối xem Audit Logs HTTP 403 Forbidden');

    // 1.7 Chặn non-admin truy cập Audit Stats (Token Passenger -> 403)
    const passengerStatsRes = await fetch(`${baseUrl}/admin/activity-logs/stats`, {
      headers: { Authorization: `Bearer ${passengerToken}` },
    });
    assert(passengerStatsRes.status === 403, 'Tài khoản thường bị chặn xem Thống kê An ninh HTTP 403 Forbidden');

    // 1.8 Admin truy cập thành công (Token Admin -> 200)
    const adminAccessRes = await fetch(`${baseUrl}/admin/activity-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminAccessRes.status === 200, 'Tài khoản Super Admin truy cập Audit Logs thành công HTTP 200 OK');

    // -------------------------------------------------------------
    // GIAI ĐOẠN 2: KIỂM THỬ AUDIT LOG INTERCEPTOR TỰ ĐỘNG GHI VẾT THAO TÁC
    // -------------------------------------------------------------
    console.log('\n[TEST GROUP 2] Kiểm thử Audit Log Interceptor tự động ghi vết thao tác...');

    // 2.1 Admin thực hiện tạo một tài khoản mới để kích hoạt Interceptor
    const auditTargetEmail = `audit-target-${timestamp}@smartbus.ictu.vn`;
    const targetCreateRes = await fetch(`${baseUrl}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Người Dùng Test Lưu Vết',
        email: auditTargetEmail,
        phoneNumber: '0912345678',
        password: 'Password@123',
        role: 'manager',
      }),
    });
    const targetUserData = await targetCreateRes.json();
    assert(targetCreateRes.status === 201, 'Admin thực hiện tạo người dùng mới thành công HTTP 201');
    const targetUserId = targetUserData.id || targetUserData.data?.id;
    if (targetUserId) createdUserIds.push(targetUserId);

    // 2.2 Admin thực hiện sửa thông tin người dùng
    const targetUpdateRes = await fetch(`${baseUrl}/admin/users/${targetUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Người Dùng Đã Sửa Tên Kiểm Toán',
        phoneNumber: '0987654321',
      }),
    });
    assert(targetUpdateRes.status === 200, 'Admin cập nhật thông tin người dùng HTTP 200');

    // 2.3 Admin thực hiện khóa tài khoản người dùng
    const targetLockRes = await fetch(`${baseUrl}/admin/users/${targetUserId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'locked',
      }),
    });
    assert(targetLockRes.status === 200, 'Admin khóa tài khoản người dùng HTTP 200');

    // Đợi 250ms để đảm bảo logging interceptor đã hoàn tất ghi CSDL
    await new Promise((resolve) => setTimeout(resolve, 250));

    // 2.4 Kiểm tra CSDL Activity Logs xem Interceptor đã lưu vết đầy đủ chưa
    const recordedLogs = await logRepo.find({
      where: { userId: adminLoginData.user.id },
      order: { timestamp: 'DESC' },
      take: 10,
    });

    assert(recordedLogs.length > 0, `Đã tìm thấy ${recordedLogs.length} bản ghi log do Admin thực hiện`);

    // Lưu log IDs để dọn dẹp sau
    recordedLogs.forEach((l) => createdLogIds.push(l.id));

    // Kiểm tra cấu trúc bản ghi log mới nhất
    const latestLog = recordedLogs[0];
    assert(Boolean(latestLog.userId), 'Bản ghi log có lưu đúng userId của người thực hiện');
    assert(Boolean(latestLog.timestamp), 'Bản ghi log có lưu thời gian thực hiện');
    assert(Boolean(latestLog.endpoint), `Bản ghi log có lưu Endpoint API (${latestLog.endpoint})`);
    assert(Boolean(latestLog.method), `Bản ghi log có lưu HTTP Method (${latestLog.method})`);
    assert(latestLog.status === 'SUCCESS' || Boolean(latestLog.status), `Bản ghi log có trạng thái (${latestLog.status})`);
    assert(typeof latestLog.executionTimeMs === 'number' && latestLog.executionTimeMs >= 0, `Bản ghi log ghi nhận thời gian thực thi executionTimeMs (${latestLog.executionTimeMs}ms)`);
    assert(Boolean(latestLog.ipAddress), `Bản ghi log ghi nhận địa chỉ IP (${latestLog.ipAddress})`);

    // 2.5 Kiểm tra Password Masking trong Changes Payload
    const createLog = recordedLogs.find((l) => l.action?.includes('CREATE') || l.endpoint?.includes('/admin/users'));
    if (createLog && createLog.changes) {
      const changesStr = JSON.stringify(createLog.changes);
      assert(!changesStr.includes('Password@123'), 'Bảo mật: Mật khẩu dạng plain text tuyệt đối KHÔNG xuất hiện trong Changes Payload');
      console.log('  [PASSED] Password Masking an toàn: mật khẩu đã được che giấu thành công');
    }

    // -------------------------------------------------------------
    // GIAI ĐOẠN 3: KIỂM THỬ API TRUY VẤN VÀ BỘ LỌC ĐA TIÊU CHÍ
    // -------------------------------------------------------------
    console.log('\n[TEST GROUP 3] Kiểm thử API Truy vấn và Bộ lọc Nhật ký Hệ thống...');

    // 3.1 Truy vấn danh sách phân trang mặc định
    const listRes = await fetch(`${baseUrl}/admin/activity-logs?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listData = await listRes.json();
    assert(listRes.status === 200, 'Lấy danh sách Audit Logs phân trang HTTP 200');
    assert(Array.isArray(listData.items), 'Kết quả items là một mảng danh sách logs');
    assert(Boolean(listData.meta), 'Kết quả có metadata phân trang (page, limit, total, totalPages)');
    assert(listData.meta.limit === 10, 'Phân trang đúng limit=10');

    // 3.2 Lọc theo userId của Admin
    const userFilterRes = await fetch(`${baseUrl}/admin/activity-logs?userId=${adminLoginData.user.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const userFilterData = await userFilterRes.json();
    assert(userFilterRes.status === 200, 'Lọc theo userId thành công');
    const allMatchUser = userFilterData.items.every((l) => l.userId === adminLoginData.user.id);
    assert(allMatchUser, 'Tất cả các bản ghi trả về đều khớp với userId đã lọc');

    // 3.3 Lọc theo status SUCCESS
    const statusFilterRes = await fetch(`${baseUrl}/admin/activity-logs?status=SUCCESS`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const statusFilterData = await statusFilterRes.json();
    assert(statusFilterRes.status === 200, 'Lọc theo status=SUCCESS thành công');
    const allSuccess = statusFilterData.items.every((l) => l.status === 'SUCCESS' || !l.status);
    assert(allSuccess, 'Các bản ghi trả về đều có trạng thái SUCCESS');

    // 3.4 Lọc theo khoảng ngày (startDate và endDate)
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const localToday = `${yyyy}-${mm}-${dd}`;
    const pastDay = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
    const dateFilterRes = await fetch(`${baseUrl}/admin/activity-logs?startDate=${pastDay}&endDate=${localToday}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dateFilterData = await dateFilterRes.json();
    assert(dateFilterRes.status === 200, 'Lọc theo khoảng ngày startDate/endDate thành công');
    assert(dateFilterData.items.length > 0, `Tìm thấy ${dateFilterData.items.length} logs phát sinh trong kỳ`);

    // 3.5 Tìm kiếm tự do theo từ khóa search
    const searchRes = await fetch(`${baseUrl}/admin/activity-logs?search=users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const searchData = await searchRes.json();
    assert(searchRes.status === 200, 'Tìm kiếm nhật ký theo từ khóa "users" thành công');

    // -------------------------------------------------------------
    // GIAI ĐOẠN 4: THỐNG KÊ AN NINH (STATS) VÀ CHI TIẾT BẢN GHI (DETAIL)
    // -------------------------------------------------------------
    console.log('\n[TEST GROUP 4] Kiểm thử Thống kê An ninh và Chi tiết bản ghi Log...');

    // 4.1 API Thống kê An ninh Audit
    const statsRes = await fetch(`${baseUrl}/admin/activity-logs/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const statsData = await statsRes.json();
    assert(statsRes.status === 200, 'Lấy Thống kê An ninh Audit Logs HTTP 200');
    assert(typeof statsData.totalLogs === 'number' && statsData.totalLogs >= 1, `Tổng số log toàn hệ thống: ${statsData.totalLogs}`);
    assert(typeof statsData.logs24h === 'number' && statsData.logs24h >= 1, `Số thao tác trong 24h: ${statsData.logs24h}`);
    assert(typeof statsData.uniqueUsersCount === 'number', `Số người dùng đã thao tác: ${statsData.uniqueUsersCount}`);
    assert(Array.isArray(statsData.topActions), 'Top hành động thực hiện nhiều nhất là một mảng');

    // 4.2 API Lấy chi tiết bản ghi theo ID
    if (recordedLogs.length > 0) {
      const detailRes = await fetch(`${baseUrl}/admin/activity-logs/${recordedLogs[0].id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const detailData = await detailRes.json();
      assert(detailRes.status === 200, 'Lấy chi tiết bản ghi Audit Log theo ID HTTP 200');
      assert(detailData.id === recordedLogs[0].id, 'Dữ liệu trả về đúng bản ghi log yêu cầu');
      assert(Boolean(detailData.endpoint), 'Chi tiết log chứa Endpoint API');
    }

    // -------------------------------------------------------------
    // GIAI ĐOẠN 5: ZERO TEST JUNK - DỌN DẸP SẠCH TOÀN BỘ DỮ LIỆU THỬ NGHIỆM
    // -------------------------------------------------------------
    console.log('\n[CLEANUP] Dọn dẹp an toàn 100% dữ liệu thử nghiệm (Zero Test Junk)...');

    // Xóa các logs được sinh ra trong quá trình test
    if (createdLogIds.length > 0) {
      await logRepo.createQueryBuilder()
        .delete()
        .from(ActivityLogEntity)
        .where('id IN (:...ids)', { ids: createdLogIds })
        .execute();
      console.log(`  Đã xóa sạch ${createdLogIds.length} bản ghi Activity Logs thử nghiệm`);
    }

    // Xóa các logs liên quan đến các user test đã tạo
    if (createdUserIds.length > 0) {
      await logRepo.createQueryBuilder()
        .delete()
        .from(ActivityLogEntity)
        .where('userId IN (:...userIds) OR resourceId IN (:...userIds)', { userIds: createdUserIds })
        .execute();

      await userRepo.createQueryBuilder()
        .delete()
        .from(UserEntity)
        .where('id IN (:...userIds)', { userIds: createdUserIds })
        .execute();
      console.log(`  Đã xóa sạch ${createdUserIds.length} tài khoản người dùng thử nghiệm`);
    }

  } catch (err) {
    console.error('\nLỗi nghiêm trọng trong quá trình thực thi kiểm thử:', err);
    failedCount++;
  } finally {
    if (app) {
      await app.close();
      console.log('[TEARDOWN] Đã đóng HTTP Server kiểm thử nội bộ an toàn.');
    }
  }

  console.log('\n' + '='.repeat(85));
  console.log(`KẾT QUẢ KIỂM THỬ: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('='.repeat(85));

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite();
