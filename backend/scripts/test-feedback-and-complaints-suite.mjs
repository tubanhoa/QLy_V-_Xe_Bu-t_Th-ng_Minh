/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * BỘ KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN: ĐÁNH GIÁ CHẤT LƯỢNG CHUYẾN ĐI & XỬ LÝ PHẢN ÁNH / KHIẾU NẠI
 *
 * Kiểm tra:
 * 1. Điều kiện gửi đánh giá: Chặn gửi đánh giá khi chuyến đi chưa hoàn thành (SCHEDULED -> 400 Bad Request).
 * 2. Đánh giá thành công khi chuyến đi đã hoàn thành (COMPLETED -> 201 Created).
 * 3. Upload ảnh minh chứng và gửi khiếu nại/phản ánh dịch vụ kèm ảnh.
 * 4. Quản lý phản ánh của Admin: Lọc đa tiêu chí (số sao 1-5, trạng thái, loại complaint/rating, search từ khóa).
 * 5. Admin gửi phản hồi: Cập nhật trạng thái 'resolved', lưu adminResponse và gửi thông báo cho khách.
 * 6. ZERO TEST JUNK: Dọn dẹp sạch sẽ 100% dữ liệu thử nghiệm sau khi hoàn tất.
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
import { TripEntity } from '../dist/database/entities/trip.entity.js';
import { FeedbackEntity } from '../dist/database/entities/feedback.entity.js';
import { RouteEntity } from '../dist/database/entities/route.entity.js';
import { ActivityLogEntity } from '../dist/database/entities/activity-log.entity.js';
import { NotificationEntity } from '../dist/database/entities/notification.entity.js';
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
  console.log('BỘ KIỂM THỬ: ĐÁNH GIÁ CHẤT LƯỢNG CHUYẾN ĐI & QUẢN LÝ PHẢN ÁNH / KHIẾU NẠI');
  console.log('='.repeat(85));

  let app;
  let baseUrl;
  const createdUserIds = [];
  const createdTripIds = [];
  const createdFeedbackIds = [];

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
    const tripRepo = app.get('TripEntityRepository');
    const routeRepo = app.get('RouteEntityRepository');
    const feedbackRepo = app.get('FeedbackEntityRepository');
    const logRepo = app.get('ActivityLogEntityRepository');
    const notifRepo = app.get('NotificationEntityRepository');
    const timestamp = Date.now();

    // -------------------------------------------------------------
    // GIAI ĐOẠN 1: ĐĂNG NHẬP ADMIN & TẠO DỮ LIỆU THỬ NGHIỆM
    // -------------------------------------------------------------
    console.log('\n[TEST GROUP 1] Đăng nhập Admin và chuẩn bị dữ liệu chuyến đi thử nghiệm...');

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
    const adminToken = adminLoginData.accessToken;

    // 1.2 Tạo người dùng hành khách thử nghiệm
    const passengerEmail = `test-passenger-fb-${timestamp}@smartbus.ictu.vn`;
    const passengerRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Hành Khách Test Feedback',
        email: passengerEmail,
        phoneNumber: '0987112233',
        password: 'Password@123',
      }),
    });
    const passengerData = await passengerRes.json();
    assert(passengerRes.status === 201, 'Đăng ký tài khoản hành khách thử nghiệm');
    const passengerToken = passengerData.accessToken;
    const passengerId = passengerData.user?.id;
    if (passengerId) createdUserIds.push(passengerId);

    // 1.3 Chuẩn bị 2 chuyến xe: 1 chuyến SCHEDULED (chưa hoàn thành), 1 chuyến COMPLETED (đã hoàn thành)
    const existingRoute = await routeRepo.findOne({ where: {} });
    assert(Boolean(existingRoute), `Lấy tuyến đường mẫu [${existingRoute?.routeCode || ''}]`);

    // Chuyến xe 1: SCHEDULED
    const tripScheduled = tripRepo.create({
      routeId: existingRoute.id,
      departureTime: new Date(Date.now() + 3600000), // 1h nữa mới chạy
      status: TripStatus.SCHEDULED,
    });
    await tripRepo.save(tripScheduled);
    createdTripIds.push(tripScheduled.id);

    // Chuyến xe 2: COMPLETED
    const tripCompleted = tripRepo.create({
      routeId: existingRoute.id,
      departureTime: new Date(Date.now() - 7200000), // 2h trước
      actualDeparture: new Date(Date.now() - 7200000),
      actualArrival: new Date(Date.now() - 3600000),
      status: TripStatus.COMPLETED,
    });
    await tripRepo.save(tripCompleted);
    createdTripIds.push(tripCompleted.id);

    // -------------------------------------------------------------
    // GIAI ĐOẠN 2: KIỂM THỬ ĐIỀU KIỆN ĐÁNH GIÁ CHUYẾN XE (RATING)
    // -------------------------------------------------------------
    console.log('\n[TEST GROUP 2] Kiểm thử điều kiện đánh giá chất lượng chuyến xe...');

    // 2.1 Thử gửi đánh giá chuyến đi CHƯA HOÀN THÀNH (SCHEDULED) -> Bắt buộc bị từ chối 400 Bad Request
    const rateScheduledRes = await fetch(`${baseUrl}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${passengerToken}`,
      },
      body: JSON.stringify({
        tripId: tripScheduled.id,
        ratingScore: 5,
        content: 'Chuyến xe rất tốt nhưng chưa chạy xong mà đã đánh giá',
      }),
    });
    const rateScheduledData = await rateScheduledRes.json();
    assert(
      rateScheduledRes.status === 400,
      'Chặn đánh giá chuyến xe chưa hoàn thành HTTP 400 Bad Request',
      rateScheduledData.message,
    );
    assert(
      rateScheduledData.message?.includes('COMPLETED') || rateScheduledData.message?.includes('hoàn thành'),
      'Thông báo lỗi rõ ràng yêu cầu chuyến xe phải COMPLETED',
    );

    // 2.2 Gửi đánh giá chuyến xe ĐÃ HOÀN THÀNH (COMPLETED) -> Thành công 201 Created
    const rateCompletedRes = await fetch(`${baseUrl}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${passengerToken}`,
      },
      body: JSON.stringify({
        tripId: tripCompleted.id,
        ratingScore: 5,
        category: 'cleanliness',
        content: 'Xe buýt điện chạy rất êm, máy lạnh mát rượi và khoang hành khách sạch sẽ!',
      }),
    });
    const rateCompletedData = await rateCompletedRes.json();
    assert(rateCompletedRes.status === 201, 'Gửi đánh giá chuyến xe đã hoàn thành thành công HTTP 201');
    const createdRatingId = rateCompletedData.id || rateCompletedData.data?.id;
    if (createdRatingId) createdFeedbackIds.push(createdRatingId);
    assert(Boolean(createdRatingId), 'Bản ghi đánh giá sao được tạo với ID hợp lệ');

    // -------------------------------------------------------------
    // GIAI ĐOẠN 3: KIỂM THỬ UPLOAD ẢNH MINH CHỨNG & GỬI KHIẾU NẠI DỊCH VỤ
    // -------------------------------------------------------------
    console.log('\n[TEST GROUP 3] Kiểm thử Upload ảnh minh chứng và gửi Phản ánh/Khiếu nại...');

    // 3.1 Tải ảnh minh chứng qua API upload-proof bằng Base64 JPEG hợp lệ (Magic Bytes FF D8 FF)
    // 1x1 pixel JPEG Base64
    const validJpegBase64 =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    const uploadRes = await fetch(`${baseUrl}/upload/feedback-proof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${passengerToken}`,
      },
      body: JSON.stringify({
        fileBase64: validJpegBase64,
        filename: 'proof-complaint.jpg',
        mimeType: 'image/jpeg',
      }),
    });
    const uploadData = await uploadRes.json();
    assert(uploadRes.status === 200 || uploadRes.status === 201, 'Upload ảnh minh chứng thành công', JSON.stringify(uploadData));
    assert(Boolean(uploadData.url), `Nhận URL ảnh minh chứng lưu trên máy chủ: ${uploadData.url}`);
    const proofUrl = uploadData.url;

    // 3.2 Gửi Khiếu nại dịch vụ kèm ảnh minh chứng vừa upload
    const complaintRes = await fetch(`${baseUrl}/feedback/complaint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${passengerToken}`,
      },
      body: JSON.stringify({
        title: 'Tài xế bỏ trạm đón cổng phụ ICTU sáng nay',
        category: 'driver_attitude',
        content: 'Lúc 7h15 sáng nay tôi đứng tại trạm cổng phụ nhưng tài xế không mở cửa đón sinh viên...',
        tripId: tripCompleted.id,
        ticketCode: 'TIC-TEST-12345',
        ratingScore: 1,
        attachments: [proofUrl],
      }),
    });
    const complaintData = await complaintRes.json();
    assert(complaintRes.status === 201, 'Gửi phản ánh/khiếu nại kèm ảnh minh chứng thành công HTTP 201');
    const createdComplaintId = complaintData.id || complaintData.data?.id;
    if (createdComplaintId) createdFeedbackIds.push(createdComplaintId);

    // Kiểm tra CSDL
    const savedComplaint = await feedbackRepo.findOne({ where: { id: createdComplaintId } });
    assert(savedComplaint?.type === 'complaint', 'Bản ghi được phân loại chính xác type="complaint"');
    assert(savedComplaint?.status === 'new', 'Trạng thái ban đầu của khiếu nại là status="new"');
    assert(Array.isArray(savedComplaint?.attachments) && savedComplaint.attachments.length > 0, 'Lưu đầy đủ mảng URL ảnh minh chứng');

    // -------------------------------------------------------------
    // GIAI ĐOẠN 4: KIỂM THỬ CRUD QUẢN LÝ PHẢN ÁNH DÀNH CHO ADMIN
    // -------------------------------------------------------------
    console.log('\n[TEST GROUP 4] Kiểm thử CRUD Quản lý Phản ánh cho Admin (Bộ lọc đa tiêu chí)...');

    // 4.1 Chặn người dùng không có token xem danh sách (401)
    const unauthRes = await fetch(`${baseUrl}/admin/feedback`);
    assert(unauthRes.status === 401, 'Không có token bị từ chối HTTP 401 Unauthorized');

    // 4.2 Chặn hành khách thường xem danh sách quản lý (403 Forbidden)
    const forbiddenRes = await fetch(`${baseUrl}/admin/feedback`, {
      headers: { Authorization: `Bearer ${passengerToken}` },
    });
    assert(forbiddenRes.status === 403, 'Tài khoản Hành khách bị chặn xem quản lý HTTP 403 Forbidden');

    // 4.3 Admin xem danh sách (200 OK) kèm thống kê Stats
    const adminListRes = await fetch(`${baseUrl}/admin/feedback?page=1&limit=20`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminListData = await adminListRes.json();
    assert(adminListRes.status === 200, 'Admin lấy danh sách phản ánh thành công HTTP 200 OK');
    assert(Array.isArray(adminListData.items), 'Trả về mảng danh sách phản ánh');
    assert(Boolean(adminListData.meta), 'Có metadata phân trang (page, limit, total, totalPages)');
    assert(Boolean(adminListData.stats), 'Có khối thống kê KPI an ninh và chất lượng (stats)');
    assert(typeof adminListData.stats.avgRating === 'number', `Điểm đánh giá trung bình: ${adminListData.stats.avgRating}`);

    // 4.4 Lọc theo mức độ đánh giá: ratingScore=5
    const filterStar5Res = await fetch(`${baseUrl}/admin/feedback?ratingScore=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const filterStar5Data = await filterStar5Res.json();
    assert(filterStar5Res.status === 200, 'Lọc theo 5 sao thành công');
    const allStar5 = filterStar5Data.items.every((f) => f.ratingScore === 5);
    assert(allStar5, 'Tất cả các bản ghi trả về đều có ratingScore = 5');

    // 4.5 Lọc theo loại: type=complaint
    const filterComplaintRes = await fetch(`${baseUrl}/admin/feedback?type=complaint`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const filterComplaintData = await filterComplaintRes.json();
    assert(filterComplaintRes.status === 200, 'Lọc theo khiếu nại (complaint) thành công');
    const allComplaints = filterComplaintData.items.every((f) => f.type === 'complaint');
    assert(allComplaints, 'Tất cả các bản ghi trả về đều là loại complaint');

    // 4.6 Tìm kiếm theo từ khóa search
    const searchRes = await fetch(`${baseUrl}/admin/feedback?search=camera`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(searchRes.status === 200, 'Tìm kiếm phản ánh theo từ khóa thành công');

    // -------------------------------------------------------------
    // GIAI ĐOẠN 5: KIỂM THỬ ADMIN PHẢN HỒI VÀ GỬI THÔNG BÁO CHO KHÁCH
    // -------------------------------------------------------------
    console.log('\n[TEST GROUP 5] Kiểm thử Admin phản hồi khiếu nại và gửi thông báo/email cho khách...');

    const responseText = 'Ban Quản Trị đã trích xuất camera hành trình, phê bình lái xe và gửi lời xin lỗi chân thành tới bạn.';
    const respondRes = await fetch(`${baseUrl}/admin/feedback/${createdComplaintId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        adminResponse: responseText,
        status: 'resolved',
      }),
    });
    const respondData = await respondRes.json();
    assert(respondRes.status === 200, 'Admin gửi phản hồi thành công HTTP 200 OK');
    assert(respondData.adminResponse === responseText, 'Nội dung phản hồi được cập nhật chuẩn xác');
    assert(respondData.status === 'resolved', 'Trạng thái chuyển thành "resolved"');
    assert(Boolean(respondData.respondedAt), 'Ghi nhận thời điểm phản hồi respondedAt');

    // 5.2 Kiểm tra Hành khách xem lại lịch sử đánh giá của mình qua GET /feedback/my
    const myFeedbacksRes = await fetch(`${baseUrl}/feedback/my`, {
      headers: { Authorization: `Bearer ${passengerToken}` },
    });
    const myFeedbacksData = await myFeedbacksRes.json();
    assert(myFeedbacksRes.status === 200, 'Hành khách xem lịch sử phản ánh của mình HTTP 200');
    const myItem = myFeedbacksData.items?.find((f) => f.id === createdComplaintId);
    assert(Boolean(myItem), 'Hành khách nhìn thấy khiếu nại của mình trong lịch sử');
    assert(myItem?.adminResponse === responseText, 'Hành khách nhìn thấy câu trả lời chính thức của Ban Quản Trị');

    // -------------------------------------------------------------
    // GIAI ĐOẠN 6: ZERO TEST JUNK - DỌN DẸP SẠCH TOÀN BỘ DỮ LIỆU THỬ NGHIỆM
    // -------------------------------------------------------------
    console.log('\n[CLEANUP] Dọn dẹp an toàn 100% dữ liệu thử nghiệm (Zero Test Junk)...');

    // Xóa feedback test
    if (createdFeedbackIds.length > 0) {
      await feedbackRepo.createQueryBuilder()
        .delete()
        .from(FeedbackEntity)
        .where('id IN (:...ids)', { ids: createdFeedbackIds })
        .execute();
      console.log(`  Đã xóa sạch ${createdFeedbackIds.length} bản ghi Feedback & Khiếu nại thử nghiệm`);
    }

    // Xóa trips test
    if (createdTripIds.length > 0) {
      await tripRepo.createQueryBuilder()
        .delete()
        .from(TripEntity)
        .where('id IN (:...ids)', { ids: createdTripIds })
        .execute();
      console.log(`  Đã xóa sạch ${createdTripIds.length} chuyến xe thử nghiệm`);
    }

    // Xóa notifications test
    if (createdUserIds.length > 0 && notifRepo) {
      await notifRepo.createQueryBuilder()
        .delete()
        .from(NotificationEntity)
        .where('userId IN (:...ids)', { ids: createdUserIds })
        .execute();
      console.log(`  Đã xóa sạch thông báo in-app thử nghiệm`);
    }

    // Xóa activity logs test phát sinh
    if (createdUserIds.length > 0 && logRepo) {
      await logRepo.createQueryBuilder()
        .delete()
        .from(ActivityLogEntity)
        .where('userId IN (:...ids) OR resourceId IN (:...ids)', { ids: createdUserIds })
        .execute();
      console.log(`  Đã xóa sạch Activity Logs thử nghiệm liên quan`);
    }

    // Xóa user test
    if (createdUserIds.length > 0) {
      await userRepo.createQueryBuilder()
        .delete()
        .from(UserEntity)
        .where('id IN (:...ids)', { ids: createdUserIds })
        .execute();
      console.log(`  Đã xóa sạch ${createdUserIds.length} người dùng thử nghiệm`);
    }

  } catch (err) {
    console.error('\nLỗi nghiêm trọng trong quá trình kiểm thử:', err);
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
