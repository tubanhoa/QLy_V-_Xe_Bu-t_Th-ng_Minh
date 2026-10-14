/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * BỘ KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN: QUẢN LÝ TÀI KHOẢN, PHÂN QUYỀN RBAC & BẢO MẬT HỆ THỐNG
 *
 * Kiểm tra:
 * 1. Đăng nhập / Đăng xuất với từng loại tài khoản (Admin, Manager, Driver, Passenger)
 * 2. RBAC Access Control: Ngăn chặn truy cập trái phép bằng HTTP 403 Forbidden khi sai quyền
 * 3. Admin CRUD tài khoản: Thêm mới, Sửa thông tin, Gán/Đổi Role (Admin, Manager, Driver, Conductor, Passenger)
 * 4. Khóa & Mở khóa tài khoản: Khi bị khóa thì chặn đăng nhập (HTTP 401); khi mở lại thì đăng nhập thành công
 * 5. Đổi mật khẩu cá nhân: Kiểm tra mật khẩu cũ sai (400), đổi mật khẩu hợp lệ và đăng nhập bằng mật khẩu mới
 * 6. Bảo vệ tài khoản Super Admin cốt lõi không thể bị giáng chức hoặc bị khóa
 * 7. ZERO TEST JUNK: Dọn dẹp sạch 100% dữ liệu thử nghiệm sinh ra trong quá trình test
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
  console.log('='.repeat(80));
  console.log('BỘ KIỂM THỬ: QUẢN LÝ TÀI KHOẢN, PHÂN QUYỀN RBAC & BẢO MẬT HỆ THỐNG');
  console.log('='.repeat(80));

  let app;
  let baseUrl;
  const createdUserIds = [];

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

    // Dọn dẹp sơ bộ trước test
    const userRepo = app.get('UserEntityRepository');
    const timestamp = Date.now();

    // -------------------------------------------------------------
    // GIAI ĐOẠN 1: ĐĂNG NHẬP ADMIN VÀ LẤY ACCESS TOKEN
    // -------------------------------------------------------------
    console.log('\n[TEST GROUP 1] Đăng nhập Quản trị viên cấp cao (Admin)...');
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@smartbus.ictu.vn',
        password: 'Password@123',
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200, 'Admin đăng nhập thành công HTTP 200', JSON.stringify(adminLoginData));
    assert(Boolean(adminLoginData.accessToken), 'Nhận Access Token JWT của Admin');
    assert(adminLoginData.user?.role?.toLowerCase() === 'admin', 'Role của Admin là "admin"');
    const adminToken = adminLoginData.accessToken;

    // -------------------------------------------------------------
    // GIAI ĐOẠN 2: TẠO TÀI KHOẢN CÁC ROLES (CRUD)
    // -------------------------------------------------------------
    console.log('\n[TEST GROUP 2] Admin tạo tài khoản cho các Role: Manager, Driver, Conductor, Passenger...');

    // 2.1 Tạo tài khoản Quản lý / Điều hành viên
    const managerEmail = `test-user-manager-${timestamp}@smartbus.ictu.vn`;
    const createManagerRes = await fetch(`${baseUrl}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Nguyễn Văn Quản Lý Test',
        email: managerEmail,
        password: 'Manager@123',
        role: 'manager',
        phoneNumber: '0981112233',
      }),
    });
    const managerCreated = await createManagerRes.json();
    assert(createManagerRes.status === 201, 'Tạo tài khoản Quản lý thành công HTTP 201', JSON.stringify(managerCreated));
    if (managerCreated.id) createdUserIds.push(managerCreated.id);

    // 2.2 Tạo tài khoản Tài xế
    const driverEmail = `test-user-driver-${timestamp}@smartbus.ictu.vn`;
    const createDriverRes = await fetch(`${baseUrl}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Trần Văn Tài Xế Test',
        email: driverEmail,
        password: 'Driver@123',
        role: 'driver',
        phoneNumber: '0982223344',
        faculty: 'Hạng D (Xe buýt 29-45 chỗ)',
      }),
    });
    const driverCreated = await createDriverRes.json();
    assert(createDriverRes.status === 201, 'Tạo tài khoản Tài xế thành công HTTP 201', JSON.stringify(driverCreated));
    if (driverCreated.id) createdUserIds.push(driverCreated.id);

    // 2.3 Tạo tài khoản Hành khách / Sinh viên
    const passengerEmail = `test-passenger-${timestamp}@ictu.edu.vn`;
    const createPassengerRes = await fetch(`${baseUrl}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Lê Thị Hành Khách Test',
        email: passengerEmail,
        password: 'Passenger@123',
        role: 'passenger',
        phoneNumber: '0983334455',
        studentId: `DTC${String(timestamp).slice(-7)}`,
        faculty: 'Công nghệ thông tin',
      }),
    });
    const passengerCreated = await createPassengerRes.json();
    assert(createPassengerRes.status === 201, 'Tạo tài khoản Hành khách thành công HTTP 201', JSON.stringify(passengerCreated));
    if (passengerCreated.id) createdUserIds.push(passengerCreated.id);

    // -------------------------------------------------------------
    // GIAI ĐOẠN 3: ĐĂNG NHẬP VỚI TỪNG VAI TRÒ VÀ KIỂM TRA ROLE
    // -------------------------------------------------------------
    console.log('\n[TEST GROUP 3] Kiểm thử Luồng Đăng nhập với từng loại tài khoản vừa tạo...');

    // Đăng nhập Manager
    const managerLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: managerEmail, password: 'Manager@123' }),
    });
    const managerAuth = await managerLoginRes.json();
    assert(managerLoginRes.status === 200, 'Tài khoản Quản lý đăng nhập thành công', JSON.stringify(managerAuth));
    assert(managerAuth.user?.role === 'manager', 'Vai trò đúng là manager');
    const managerToken = managerAuth.accessToken;

    // Đăng nhập Driver
    const driverLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: driverEmail, password: 'Driver@123' }),
    });
    const driverAuth = await driverLoginRes.json();
    assert(driverLoginRes.status === 200, 'Tài khoản Tài xế đăng nhập thành công', JSON.stringify(driverAuth));
    assert(driverAuth.user?.role === 'driver', 'Vai trò đúng là driver');
    const driverToken = driverAuth.accessToken;

    // Đăng nhập Passenger
    const passengerLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: passengerEmail, password: 'Passenger@123' }),
    });
    const passengerAuth = await passengerLoginRes.json();
    assert(passengerLoginRes.status === 200, 'Tài khoản Hành khách đăng nhập thành công', JSON.stringify(passengerAuth));
    assert(passengerAuth.user?.role === 'passenger', 'Vai trò đúng là passenger');
    const passengerToken = passengerAuth.accessToken;

    // -------------------------------------------------------------
    // GIAI ĐOẠN 4: KIỂM THỬ BẢO MẬT PHÂN QUYỀN RBAC (ROLES GUARD)
    // -------------------------------------------------------------
    console.log('\n[TEST GROUP 4] Kiểm thử RBAC: Ngăn chặn truy cập trái phép bằng HTTP 403 Forbidden...');

    // 4.1 Passenger cố gọi API Quản trị Admin: GET /api/v1/admin/users
    const passCallAdminRes = await fetch(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${passengerToken}` },
    });
    assert(passCallAdminRes.status === 403, 'Hành khách bị chặn gọi API Admin (HTTP 403 Forbidden)');

    // 4.2 Driver cố gọi API Quản trị Admin: GET /api/v1/admin/users
    const driverCallAdminRes = await fetch(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    assert(driverCallAdminRes.status === 403, 'Tài xế bị chặn gọi API Admin (HTTP 403 Forbidden)');

    // 4.3 Manager cố gọi API Quản trị Admin: GET /api/v1/admin/users
    const managerCallAdminRes = await fetch(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert(managerCallAdminRes.status === 403, 'Quản lý/Điều hành bị chặn gọi API Admin Users (HTTP 403 Forbidden)');

    // 4.4 Admin gọi API Quản trị Admin: GET /api/v1/admin/users
    const adminCallAdminRes = await fetch(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminCallAdminRes.status === 200, 'Admin có toàn quyền truy cập API Admin (HTTP 200 OK)');

    // -------------------------------------------------------------
    // GIAI ĐOẠN 5: CẬP NHẬT THÔNG TIN VÀ PHÂN QUYỀN (CHANGE ROLE)
    // -------------------------------------------------------------
    console.log('\n[TEST GROUP 5] Admin cập nhật thông tin và thay đổi vai trò (Role Assignment)...');

    // Sửa thông tin tài khoản passenger
    const updateRes = await fetch(`${baseUrl}/admin/users/${passengerCreated.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Lê Thị Hành Khách (Đã cập nhật)',
        phoneNumber: '0979998877',
      }),
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200, 'Admin sửa thông tin người dùng thành công HTTP 200');
    assert(updateData.fullName === 'Lê Thị Hành Khách (Đã cập nhật)', 'Họ tên được cập nhật chính xác');

    // Gán vai trò mới: đổi passenger thành conductor (Phụ xe)
    const changeRoleRes = await fetch(`${baseUrl}/admin/users/${passengerCreated.id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ role: 'conductor' }),
    });
    const changeRoleData = await changeRoleRes.json();
    assert(changeRoleRes.status === 200, 'Admin gán quyền role "conductor" thành công');
    assert(changeRoleData.role?.name === 'conductor', 'Vai trò mới là conductor');

    // -------------------------------------------------------------
    // GIAI ĐOẠN 6: KHÓA VÀ MỞ KHÓA TÀI KHOẢN (CHANGE STATUS)
    // -------------------------------------------------------------
    console.log('\n[TEST GROUP 6] Khóa và Mở khóa tài khoản (Active vs Locked)...');

    // Khóa tài khoản
    const lockRes = await fetch(`${baseUrl}/admin/users/${passengerCreated.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'locked' }),
    });
    assert(lockRes.status === 200, 'Admin khóa tài khoản thành công HTTP 200');

    // Thử đăng nhập lại bằng tài khoản bị khóa -> Phải nhận HTTP 401
    const loginLockedRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: passengerEmail, password: 'Passenger@123' }),
    });
    assert(loginLockedRes.status === 401, 'Tài khoản bị khóa bị từ chối đăng nhập (HTTP 401 Unauthorized)');

    // Mở khóa lại tài khoản
    const unlockRes = await fetch(`${baseUrl}/admin/users/${passengerCreated.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'active' }),
    });
    assert(unlockRes.status === 200, 'Admin mở khóa tài khoản thành công HTTP 200');

    // Đăng nhập lại sau khi mở khóa -> Thành công!
    const loginUnlockedRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: passengerEmail, password: 'Passenger@123' }),
    });
    assert(loginUnlockedRes.status === 200, 'Tài khoản mở khóa đăng nhập trở lại thành công');

    // -------------------------------------------------------------
    // GIAI ĐOẠN 7: ĐỔI MẬT KHẨU CÁ NHÂN (CHANGE PASSWORD API)
    // -------------------------------------------------------------
    console.log('\n[TEST GROUP 7] Kiểm thử luồng Đổi mật khẩu cá nhân (Change Password)...');
    const unlockedAuth = await loginUnlockedRes.json();
    const freshPassengerToken = unlockedAuth.accessToken;

    // 7.1 Sai mật khẩu cũ -> 400
    const wrongOldPwdRes = await fetch(`${baseUrl}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${freshPassengerToken}`,
      },
      body: JSON.stringify({
        oldPassword: 'SaiMatKhau@123',
        newPassword: 'NewPassword@456',
      }),
    });
    assert(wrongOldPwdRes.status === 400, 'Đổi mật khẩu thất bại khi nhập sai mật khẩu cũ (HTTP 400)');

    // 7.2 Đổi mật khẩu hợp lệ
    const validChangePwdRes = await fetch(`${baseUrl}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${freshPassengerToken}`,
      },
      body: JSON.stringify({
        oldPassword: 'Passenger@123',
        newPassword: 'NewPassword@456',
      }),
    });
    assert(validChangePwdRes.status === 200, 'Đổi mật khẩu mới hợp lệ thành công HTTP 200');

    // 7.3 Đăng nhập bằng mật khẩu mới -> Thành công
    const loginWithNewPwdRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: passengerEmail, password: 'NewPassword@456' }),
    });
    assert(loginWithNewPwdRes.status === 200, 'Đăng nhập thành công với mật khẩu mới');

    // 7.4 Đăng nhập bằng mật khẩu cũ -> Thất bại 401
    const loginWithOldPwdRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: passengerEmail, password: 'Passenger@123' }),
    });
    assert(loginWithOldPwdRes.status === 401, 'Đăng nhập với mật khẩu cũ bị từ chối');

    // -------------------------------------------------------------
    // GIAI ĐOẠN 8: BẢO VỆ TÀI KHOẢN QUẢN TRỊ VIÊN CẤP CAO (ROOT ADMIN)
    // -------------------------------------------------------------
    console.log('\n[TEST GROUP 8] Kiểm thử bảo vệ tài khoản Quản trị viên cấp cao...');
    const adminUser = await userRepo.findOne({ where: { email: 'admin@smartbus.ictu.vn' } });

    if (adminUser) {
      // Cố tình hạ vai trò admin
      const demoteAdminRes = await fetch(`${baseUrl}/admin/users/${adminUser.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ role: 'passenger' }),
      });
      assert(demoteAdminRes.status === 400, 'Chặn hạ quyền tài khoản Admin cấp cao (HTTP 400 Bad Request)');

      // Cố tình khóa tài khoản admin
      const lockAdminRes = await fetch(`${baseUrl}/admin/users/${adminUser.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'locked' }),
      });
      assert(lockAdminRes.status === 400, 'Chặn khóa tài khoản Admin cấp cao (HTTP 400 Bad Request)');
    }

  } catch (error) {
    console.error('Lỗi ngoại lệ trong quá trình chạy test suite:', error);
    failedCount++;
  } finally {
    // -------------------------------------------------------------
    // GIAI ĐOẠN 9: ZERO TEST JUNK - DỌN DẸP SẠCH TOÀN BỘ DATA THỬ NGHIỆM
    // -------------------------------------------------------------
    console.log('\n[CLEANUP] Dọn dẹp an toàn các tài khoản kiểm thử đã tạo (Zero Test Junk)...');
    try {
      if (app) {
        const userRepo = app.get('UserEntityRepository');
        for (const uid of createdUserIds) {
          await userRepo.delete(uid).catch(() => {});
        }

        // Dọn thêm bất kỳ user nào có email test rác
        await userRepo
          .createQueryBuilder()
          .delete()
          .from(UserEntity)
          .where("email LIKE 'test-user-%' OR email LIKE 'test-passenger-%'")
          .execute()
          .catch(() => {});

        console.log(`  Đã xóa sạch ${createdUserIds.length} tài khoản thử nghiệm.`);
        await app.close();
      }
    } catch (cleanErr) {
      console.warn('Lỗi khi cleanup:', cleanErr);
    }

    console.log('\n' + '='.repeat(80));
    console.log(`KẾT QUẢ KIỂM THỬ: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('='.repeat(80));

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTestSuite();
