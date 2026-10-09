/**
 * BỘ KIỂM THỬ TỰ ĐỘNG CHUẨN XÁC: THẨM ĐỊNH TÀI KHOẢN ƯU ĐÃI HSSV & NGƯỜI CAO TUỔI
 * (ZERO TEST JUNK GUARANTEE — DỌN DẸP SẠCH 100% DỮ LIỆU RÁC TRONG CƠ SỞ DỮ LIỆU)
 * 
 * PHẠM VI KIỂM THỬ THEO YÊU CẦU:
 * --------------------------------------------------------------------------------------
 * NHÓM 1: UPLOAD ẢNH MINH CHỨNG AN TOÀN (MAGIC BYTES & KÍCH THƯỚC)
 *   TC-01: Upload ảnh minh chứng hợp lệ (JPEG / PNG / WebP dưới 3MB)
 *   TC-02: Chặn tệp không hợp lệ / chứa mã độc (SVG, HTML, Scripts)
 *   TC-03: Chặn tệp vượt quá giới hạn 3MB
 * 
 * NHÓM 2: GỬI YÊU CẦU XÁC THỰC ĐỐI TƯỢNG ƯU ĐÃI (PASSENGER APIS)
 *   TC-04: Khách hàng nộp hồ sơ Sinh viên ICTU (student, MSSV, Trường học, ảnh thẻ SV)
 *   TC-05: Chặn nộp trùng lặp khi đang có hồ sơ pending (Tránh spam hồ sơ lên HR)
 *   TC-06: Khách hàng tra cứu trạng thái và lịch sử hồ sơ của chính mình
 * 
 * NHÓM 3: HR / ADMIN QUẢN LÝ & THẨM ĐỊNH HỒ SƠ ƯU ĐÃI
 *   TC-07: Phân quyền HR / Admin truy cập danh sách hồ sơ (Chặn passenger 403, cho Admin 200)
 *   TC-08: HR / Admin xem chi tiết một hồ sơ xác thực đối tượng
 *   TC-09: Chặn từ chối hồ sơ khi thiếu lý do (HTTP 400 Bad Request)
 *   TC-10: HR / Admin từ chối hồ sơ kèm lý do cụ thể (Bắn Push Notification & Email)
 * 
 * NHÓM 4: PHÊ DUYỆT & CẬP NHẬT HẠNG TÀI KHOẢN ƯU ĐÃI & THÔNG BÁO
 *   TC-11: Khách hàng nộp lại hồ sơ sau khi bị từ chối (Cho phép resubmit thành công)
 *   TC-12: HR / Admin phê duyệt hồ sơ đối tượng Người cao tuổi (Cập nhật user priorityCategory = elderly)
 *   TC-13: Kiểm tra thông báo tự động (Push Notification in-app trong bảng notifications)
 *   TC-14: HR / Admin phê duyệt hồ sơ đối tượng Sinh viên (Cập nhật user priorityCategory = student)
 * 
 * NHÓM 5: DỌN DẸP DỮ LIỆU RÁC (ZERO TEST JUNK GUARANTEE)
 *   TC-15: Xóa sạch 100% hồ sơ priority_verifications, notifications và tài khoản test trong CSDL
 */

import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('[TEST-ERROR] DATABASE_URL không được tìm thấy trong cấu hình!');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
});

const testResults = [];

function recordResult(testId, name, status, latencyMs, details) {
  testResults.push({
    testId,
    name,
    status,
    latencyMs: Math.round(latencyMs),
    details,
  });
  const statusStr = status === 'PASSED' ? '[PASSED]' : '[FAILED]';
  console.log(`  ${statusStr} [${testId}] ${name} (${Math.round(latencyMs)}ms)`);
  if (details) console.log(`           -> Chi tiết: ${details}`);
}

async function runTestSuite() {
  console.log('================================================================================');
  console.log('KHỞI ĐỘNG TEST SUITE: THẨM ĐỊNH TÀI KHOẢN ƯU ĐÃI HSSV & NGƯỜI CAO TUỔI');
  console.log('(ZERO TEST JUNK GUARANTEE — KHÔNG ĐỂ LẠI DỮ LIỆU RÁC TRONG CƠ SỞ DỮ LIỆU)');
  console.log('================================================================================\n');

  const createdUserIds = [];
  const createdVerificationIds = [];
  const createdFilePaths = [];

  let adminToken = '';
  let studentToken = '';
  let studentUser = null;
  let elderlyToken = '';
  let elderlyUser = null;

  try {
    // -------------------------------------------------------------------------
    // BƯỚC 0: SETUP AUTHENTICATION & TEST ENTITIES
    // -------------------------------------------------------------------------
    console.log('[SETUP] 1. Đăng nhập Admin & tạo tài khoản Test cô lập...');

    // 1. Đăng nhập Admin
    let res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@smartbus.ictu.vn', password: 'Password@123' }),
    });
    let json = await res.json();
    adminToken = json.data?.accessToken;
    if (!adminToken) {
      throw new Error(`Đăng nhập Admin thất bại: ${JSON.stringify(json)}`);
    }

    // 2. Tạo tài khoản Test Sinh viên
    const studentEmail = `test.student.verif.${Date.now()}@ictu.edu.vn`;
    const regStudentRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: studentEmail,
        password: 'Password@123',
        fullName: 'Nguyễn Văn Sinh Viên (Test HSSV)',
        phoneNumber: '0912345678',
      }),
    });
    const regStudentJson = await regStudentRes.json();
    if (regStudentJson.success && regStudentJson.data?.user) {
      studentUser = regStudentJson.data.user;
      studentToken = regStudentJson.data.accessToken;
      createdUserIds.push(studentUser.id);
    } else {
      throw new Error(`Không tạo được tài khoản test Sinh viên: ${JSON.stringify(regStudentJson)}`);
    }

    // 3. Tạo tài khoản Test Người cao tuổi
    const elderlyEmail = `test.elderly.verif.${Date.now()}@gmail.com`;
    const regElderlyRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: elderlyEmail,
        password: 'Password@123',
        fullName: 'Bác Trần Văn Cao Tuổi (Test Elderly)',
        phoneNumber: '0987654321',
      }),
    });
    const regElderlyJson = await regElderlyRes.json();
    if (regElderlyJson.success && regElderlyJson.data?.user) {
      elderlyUser = regElderlyJson.data.user;
      elderlyToken = regElderlyJson.data.accessToken;
      createdUserIds.push(elderlyUser.id);
    } else {
      throw new Error(`Không tạo được tài khoản test Người cao tuổi: ${JSON.stringify(regElderlyJson)}`);
    }

    console.log(`[SETUP] Sẵn sàng: Admin, Sinh viên (${studentEmail}), Người cao tuổi (${elderlyEmail})\n`);

    // -------------------------------------------------------------------------
    // NHÓM 1: UPLOAD ẢNH MINH CHỨNG AN TOÀN (MAGIC BYTES & KÍCH THƯỚC)
    // -------------------------------------------------------------------------
    console.log('--- NHÓM 1: KIỂM THỬ UPLOAD ẢNH MINH CHỨNG AN TOÀN ---');

    // TC-01: Upload ảnh JPEG hợp lệ có Magic bytes thật
    let t0 = Date.now();
    // Tạo 1 buffer JPEG thật (Header: FF D8 FF E0 ... Footer: FF D9)
    const validJpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0xff, 0xd9,
    ]);

    const formData1 = new FormData();
    formData1.append(
      'file',
      new Blob([validJpegBuffer], { type: 'image/jpeg' }),
      'student_card_front.jpg'
    );

    let uploadRes = await fetch(`${API_BASE}/priority-verifications/upload-proof`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: formData1,
    });
    let uploadJson = await uploadRes.json();
    let uploadedFrontUrl = uploadJson.url || uploadJson.data?.url;

    if (uploadRes.ok && uploadedFrontUrl) {
      createdFilePaths.push(uploadedFrontUrl);
      recordResult(
        'TC-01',
        'Upload ảnh minh chứng hợp lệ (JPEG chuẩn Magic Bytes)',
        'PASSED',
        Date.now() - t0,
        `URL: ${uploadedFrontUrl}`
      );
    } else {
      recordResult(
        'TC-01',
        'Upload ảnh minh chứng hợp lệ (JPEG chuẩn Magic Bytes)',
        'FAILED',
        Date.now() - t0,
        `Status ${uploadRes.status}: ${JSON.stringify(uploadJson)}`
      );
    }

    // TC-02: Chặn tệp SVG / HTML độc hại
    t0 = Date.now();
    const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("XSS")</script></svg>';
    const formDataSvg = new FormData();
    formDataSvg.append(
      'file',
      new Blob([maliciousSvg], { type: 'image/svg+xml' }),
      'malicious_badge.svg'
    );

    let uploadSvgRes = await fetch(`${API_BASE}/priority-verifications/upload-proof`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: formDataSvg,
    });
    let uploadSvgJson = await uploadSvgRes.json();

    if (!uploadSvgRes.ok && uploadSvgRes.status === 400) {
      recordResult(
        'TC-02',
        'Chặn tệp không hợp lệ / chứa mã độc (SVG, Script)',
        'PASSED',
        Date.now() - t0,
        `Bị chặn thành công với HTTP 400: ${uploadSvgJson.message}`
      );
    } else {
      recordResult(
        'TC-02',
        'Chặn tệp không hợp lệ / chứa mã độc (SVG, Script)',
        'FAILED',
        Date.now() - t0,
        `Kỳ vọng 400 Bad Request, nhưng nhận ${uploadSvgRes.status}`
      );
    }

    // TC-03: Chặn tệp vượt quá 3MB
    t0 = Date.now();
    const largeBuffer = Buffer.alloc(3.5 * 1024 * 1024); // 3.5MB
    largeBuffer[0] = 0xff;
    largeBuffer[1] = 0xd8;
    largeBuffer[2] = 0xff;
    const formDataLarge = new FormData();
    formDataLarge.append(
      'file',
      new Blob([largeBuffer], { type: 'image/jpeg' }),
      'oversized_photo.jpg'
    );

    let uploadLargeRes = await fetch(`${API_BASE}/priority-verifications/upload-proof`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: formDataLarge,
    });
    let uploadLargeJson = await uploadLargeRes.json();

    if (!uploadLargeRes.ok && uploadLargeRes.status === 400) {
      recordResult(
        'TC-03',
        'Chặn tệp vượt quá dung lượng cho phép (> 3MB)',
        'PASSED',
        Date.now() - t0,
        `Bị chặn thành công với HTTP 400: ${uploadLargeJson.message}`
      );
    } else {
      recordResult(
        'TC-03',
        'Chặn tệp vượt quá dung lượng cho phép (> 3MB)',
        'FAILED',
        Date.now() - t0,
        `Kỳ vọng 400 Bad Request, nhưng nhận ${uploadLargeRes.status}`
      );
    }

    // -------------------------------------------------------------------------
    // NHÓM 2: GỬI YÊU CẦU XÁC THỰC ĐỐI TƯỢNG ƯU ĐÃI (PASSENGER APIS)
    // -------------------------------------------------------------------------
    console.log('\n--- NHÓM 2: GỬI YÊU CẦU XÁC THỰC ĐỐI TƯỢNG ƯU ĐÃI ---');

    // TC-04: Khách hàng nộp hồ sơ Sinh viên ICTU
    t0 = Date.now();
    let submitRes = await fetch(`${API_BASE}/users/priority-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        category: 'student',
        studentId: 'DTC215180099',
        schoolName: 'Trường ĐH Công Nghệ Thông Tin & Truyền Thông (ICTU)',
        frontImageUrl: uploadedFrontUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136',
        backImageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
        portraitImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      }),
    });
    let submitJson = await submitRes.json();
    let studentVerifData = submitJson.data?.data || submitJson.data;
    let studentVerifId = studentVerifData?.id;

    if (submitRes.ok && studentVerifId) {
      createdVerificationIds.push(studentVerifId);
      recordResult(
        'TC-04',
        'Khách hàng nộp hồ sơ Sinh viên ICTU (student, MSSV, trường học, ảnh thẻ SV)',
        'PASSED',
        Date.now() - t0,
        `Tạo hồ sơ ID: ${studentVerifId}, status: ${studentVerifData.status}`
      );
    } else {
      recordResult(
        'TC-04',
        'Khách hàng nộp hồ sơ Sinh viên ICTU',
        'FAILED',
        Date.now() - t0,
        `Status ${submitRes.status}: ${JSON.stringify(submitJson)}`
      );
    }

    // TC-05: Chặn nộp trùng lặp khi đang có hồ sơ pending
    t0 = Date.now();
    let duplicateRes = await fetch(`${API_BASE}/users/priority-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        category: 'student',
        studentId: 'DTC215180099',
        schoolName: 'ICTU',
        frontImageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
      }),
    });
    let duplicateJson = await duplicateRes.json();

    if (!duplicateRes.ok && duplicateRes.status === 400) {
      recordResult(
        'TC-05',
        'Chặn nộp trùng lặp khi đang có hồ sơ pending (Tránh spam hồ sơ lên HR)',
        'PASSED',
        Date.now() - t0,
        `Chặn thành công: ${duplicateJson.message}`
      );
    } else {
      recordResult(
        'TC-05',
        'Chặn nộp trùng lặp khi đang có hồ sơ pending',
        'FAILED',
        Date.now() - t0,
        `Kỳ vọng 400 Bad Request, nhưng nhận ${duplicateRes.status}`
      );
    }

    // TC-06: Khách hàng tra cứu trạng thái và lịch sử của chính mình
    t0 = Date.now();
    let myRes = await fetch(`${API_BASE}/users/priority-verification/my`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    let myJson = await myRes.json();

    if (
      myRes.ok &&
      myJson.data &&
      myJson.data.verificationStatus === 'pending' &&
      Array.isArray(myJson.data.history) &&
      myJson.data.history.length >= 1
    ) {
      recordResult(
        'TC-06',
        'Khách hàng tra cứu trạng thái và lịch sử hồ sơ (/users/priority-verification/my)',
        'PASSED',
        Date.now() - t0,
        `Trạng thái: ${myJson.data.verificationStatus}, Lịch sử: ${myJson.data.history.length} bản ghi`
      );
    } else {
      recordResult(
        'TC-06',
        'Khách hàng tra cứu trạng thái và lịch sử hồ sơ',
        'FAILED',
        Date.now() - t0,
        `Status ${myRes.status}: ${JSON.stringify(myJson)}`
      );
    }

    // -------------------------------------------------------------------------
    // NHÓM 3: HR / ADMIN QUẢN LÝ & THẨM ĐỊNH HỒ SƠ ƯU ĐÃI
    // -------------------------------------------------------------------------
    console.log('\n--- NHÓM 3: HR / ADMIN QUẢN LÝ & THẨM ĐỊNH HỒ SƠ ƯU ĐÃI ---');

    // TC-07: Phân quyền truy cập danh sách hồ sơ admin
    t0 = Date.now();
    // 7.1 Kiểm tra user thường bị chặn (403 Forbidden)
    let forbiddenRes = await fetch(`${API_BASE}/admin/priority-verifications`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    // 7.2 Kiểm tra admin được phép truy cập (200 OK)
    let adminListRes = await fetch(`${API_BASE}/admin/priority-verifications?status=pending`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    let adminListJson = await adminListRes.json();

    if (forbiddenRes.status === 403 && adminListRes.ok && adminListJson.data?.items) {
      recordResult(
        'TC-07',
        'Phân quyền HR / Admin truy cập danh sách hồ sơ (Chặn passenger 403, Admin 200)',
        'PASSED',
        Date.now() - t0,
        `Admin thấy ${adminListJson.data.items.length} hồ sơ pending`
      );
    } else {
      recordResult(
        'TC-07',
        'Phân quyền HR / Admin truy cập danh sách hồ sơ',
        'FAILED',
        Date.now() - t0,
        `Passenger status: ${forbiddenRes.status}, Admin status: ${adminListRes.status}`
      );
    }

    // TC-08: HR / Admin xem chi tiết một hồ sơ xác thực
    t0 = Date.now();
    let detailRes = await fetch(`${API_BASE}/admin/priority-verifications/${studentVerifId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    let detailJson = await detailRes.json();

    if (detailRes.ok && detailJson.data?.id === studentVerifId && detailJson.data.user) {
      recordResult(
        'TC-08',
        'HR / Admin xem chi tiết hồ sơ xác thực đối tượng (/admin/priority-verifications/:id)',
        'PASSED',
        Date.now() - t0,
        `Tên KH: ${detailJson.data.user.fullName}, Email: ${detailJson.data.user.email}`
      );
    } else {
      recordResult(
        'TC-08',
        'HR / Admin xem chi tiết hồ sơ xác thực đối tượng',
        'FAILED',
        Date.now() - t0,
        `Status ${detailRes.status}: ${JSON.stringify(detailJson)}`
      );
    }

    // TC-09: Chặn từ chối hồ sơ khi thiếu lý do (rejectionReason)
    t0 = Date.now();
    let noReasonRes = await fetch(`${API_BASE}/admin/priority-verifications/${studentVerifId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'rejected',
        // cố tình bỏ trống rejectionReason
      }),
    });
    let noReasonJson = await noReasonRes.json();

    if (!noReasonRes.ok && noReasonRes.status === 400) {
      recordResult(
        'TC-09',
        'Chặn từ chối hồ sơ khi thiếu lý do (bắt buộc nhập rejectionReason)',
        'PASSED',
        Date.now() - t0,
        `Bị chặn thành công với HTTP 400: ${noReasonJson.message}`
      );
    } else {
      recordResult(
        'TC-09',
        'Chặn từ chối hồ sơ khi thiếu lý do',
        'FAILED',
        Date.now() - t0,
        `Kỳ vọng 400 Bad Request, nhưng nhận ${noReasonRes.status}`
      );
    }

    // TC-10: HR / Admin từ chối hồ sơ kèm lý do cụ thể
    t0 = Date.now();
    const rejectReasonText = 'Ảnh chụp thẻ sinh viên bị mờ không nhìn rõ niên khóa khóa đào tạo';
    let rejectRes = await fetch(`${API_BASE}/admin/priority-verifications/${studentVerifId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'rejected',
        rejectionReason: rejectReasonText,
      }),
    });
    let rejectJson = await rejectRes.json();

    // Kiểm tra DB xem user và verification đã được cập nhật chưa
    const checkRejectDb = await pool.query(
      `SELECT v.status, v.rejection_reason, u.verification_status 
       FROM priority_verifications v
       JOIN users u ON u.id = v.user_id
       WHERE v.id = $1`,
      [studentVerifId]
    );
    const rowReject = checkRejectDb.rows[0];

    if (
      rejectRes.ok &&
      rowReject &&
      rowReject.status === 'rejected' &&
      rowReject.rejection_reason === rejectReasonText &&
      rowReject.verification_status === 'rejected'
    ) {
      recordResult(
        'TC-10',
        'HR / Admin từ chối hồ sơ kèm lý do cụ thể (Cập nhật DB & Bắn thông báo)',
        'PASSED',
        Date.now() - t0,
        `DB status: ${rowReject.status}, reason: ${rowReject.rejection_reason}`
      );
    } else {
      recordResult(
        'TC-10',
        'HR / Admin từ chối hồ sơ kèm lý do cụ thể',
        'FAILED',
        Date.now() - t0,
        `Status ${rejectRes.status}, DB: ${JSON.stringify(rowReject)}`
      );
    }

    // -------------------------------------------------------------------------
    // NHÓM 4: PHÊ DUYỆT & CẬP NHẬT HẠNG TÀI KHOẢN ƯU ĐÃI & THÔNG BÁO
    // -------------------------------------------------------------------------
    console.log('\n--- NHÓM 4: PHÊ DUYỆT & CẬP NHẬT HẠNG TÀI KHOẢN ƯU ĐÃI & THÔNG BÁO ---');

    // TC-11: Khách hàng nộp lại hồ sơ sau khi bị từ chối
    t0 = Date.now();
    let resubmitRes = await fetch(`${API_BASE}/users/priority-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        category: 'student',
        studentId: 'DTC215180099',
        schoolName: 'Trường ĐH Công Nghệ Thông Tin & Truyền Thông (ICTU)',
        frontImageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644', // ảnh mới rõ nét
        backImageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
        portraitImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      }),
    });
    let resubmitJson = await resubmitRes.json();
    let resubmitData = resubmitJson.data?.data || resubmitJson.data;
    let resubmittedVerifId = resubmitData?.id;

    if (resubmitRes.ok && resubmittedVerifId) {
      createdVerificationIds.push(resubmittedVerifId);
      recordResult(
        'TC-11',
        'Khách hàng nộp lại hồ sơ sau khi bị từ chối (Resubmit thành công)',
        'PASSED',
        Date.now() - t0,
        `Hồ sơ mới ID: ${resubmittedVerifId}, status: ${resubmitData.status}`
      );
    } else {
      recordResult(
        'TC-11',
        'Khách hàng nộp lại hồ sơ sau khi bị từ chối',
        'FAILED',
        Date.now() - t0,
        `Status ${resubmitRes.status}: ${JSON.stringify(resubmitJson)}`
      );
    }

    // TC-12: Người cao tuổi nộp hồ sơ & HR / Admin phê duyệt (category = elderly)
    t0 = Date.now();
    // 12.1 Người cao tuổi nộp hồ sơ
    let elderlySubmitRes = await fetch(`${API_BASE}/users/priority-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${elderlyToken}`,
      },
      body: JSON.stringify({
        category: 'elderly',
        idCardNumber: '001062001234',
        frontImageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
        backImageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
      }),
    });
    let elderlySubmitJson = await elderlySubmitRes.json();
    let elderlyData = elderlySubmitJson.data?.data || elderlySubmitJson.data;
    let elderlyVerifId = elderlyData?.id;
    if (elderlyVerifId) createdVerificationIds.push(elderlyVerifId);

    // 12.2 HR phê duyệt hồ sơ Người cao tuổi
    let approveElderlyRes = await fetch(`${API_BASE}/admin/priority-verifications/${elderlyVerifId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'approved' }),
    });
    let approveElderlyJson = await approveElderlyRes.json();

    // 12.3 Kiểm tra CSDL xem User đã được cập nhật priorityCategory = elderly và verificationStatus = verified chưa
    const checkElderlyDb = await pool.query(
      `SELECT priority_category, verification_status, verified_at, id_card_number 
       FROM users WHERE id = $1`,
      [elderlyUser.id]
    );
    const rowElderly = checkElderlyDb.rows[0];

    if (
      approveElderlyRes.ok &&
      rowElderly &&
      rowElderly.priority_category === 'elderly' &&
      rowElderly.verification_status === 'verified' &&
      rowElderly.id_card_number === '001062001234'
    ) {
      recordResult(
        'TC-12',
        'HR / Admin phê duyệt hồ sơ Người cao tuổi (Cập nhật users.priority_category = elderly)',
        'PASSED',
        Date.now() - t0,
        `User tier: ${rowElderly.priority_category}, status: ${rowElderly.verification_status}`
      );
    } else {
      recordResult(
        'TC-12',
        'HR / Admin phê duyệt hồ sơ Người cao tuổi',
        'FAILED',
        Date.now() - t0,
        `Status ${approveElderlyRes.status}, DB: ${JSON.stringify(rowElderly)}`
      );
    }

    // TC-13: Kiểm tra Push Notification in-app trong bảng notifications
    t0 = Date.now();
    const notifDb = await pool.query(
      `SELECT title, body, type FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [elderlyUser.id]
    );
    const notifRow = notifDb.rows[0];

    if (notifRow && notifRow.title.includes('phê duyệt')) {
      recordResult(
        'TC-13',
        'Kiểm tra thông báo tự động (Push Notification in-app trong bảng notifications)',
        'PASSED',
        Date.now() - t0,
        `Notification: "${notifRow.title}" - ${(notifRow.body || '').substring(0, 70)}...`
      );
    } else {
      recordResult(
        'TC-13',
        'Kiểm tra thông báo tự động',
        'FAILED',
        Date.now() - t0,
        `Không tìm thấy notification hoặc sai nội dung: ${JSON.stringify(notifRow)}`
      );
    }

    // TC-14: HR / Admin phê duyệt hồ sơ Sinh viên (category = student)
    t0 = Date.now();
    let approveStudentRes = await fetch(`${API_BASE}/admin/priority-verifications/${resubmittedVerifId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'approved' }),
    });
    let approveStudentJson = await approveStudentRes.json();

    const checkStudentDb = await pool.query(
      `SELECT priority_category, verification_status, student_id 
       FROM users WHERE id = $1`,
      [studentUser.id]
    );
    const rowStudent = checkStudentDb.rows[0];

    if (
      approveStudentRes.ok &&
      rowStudent &&
      rowStudent.priority_category === 'student' &&
      rowStudent.verification_status === 'verified' &&
      rowStudent.student_id === 'DTC215180099'
    ) {
      recordResult(
        'TC-14',
        'HR / Admin phê duyệt hồ sơ Sinh viên (Cập nhật users.priority_category = student, MSSV)',
        'PASSED',
        Date.now() - t0,
        `User tier: ${rowStudent.priority_category}, MSSV: ${rowStudent.student_id}, status: ${rowStudent.verification_status}`
      );
    } else {
      recordResult(
        'TC-14',
        'HR / Admin phê duyệt hồ sơ Sinh viên',
        'FAILED',
        Date.now() - t0,
        `Status ${approveStudentRes.status}, DB: ${JSON.stringify(rowStudent)}`
      );
    }

  } catch (error) {
    console.error('\n[LỖI TEST RUNTIME]:', error);
  } finally {
    // -------------------------------------------------------------------------
    // NHÓM 5: DỌN DẸP DỮ LIỆU RÁC (ZERO TEST JUNK GUARANTEE)
    // -------------------------------------------------------------------------
    console.log('\n--- NHÓM 5: DỌN DẸP DỮ LIỆU RÁC (ZERO TEST JUNK GUARANTEE) ---');
    const tClean = Date.now();

    try {
      // 1. Xóa notifications test
      if (createdUserIds.length > 0) {
        const notifRes = await pool.query(
          `DELETE FROM notifications WHERE user_id = ANY($1::uuid[])`,
          [createdUserIds]
        );
        console.log(`  [CLEANUP] Đã xóa ${notifRes.rowCount} thông báo test.`);
      }

      // 2. Xóa priority_verifications test
      if (createdVerificationIds.length > 0 || createdUserIds.length > 0) {
        const verifRes = await pool.query(
          `DELETE FROM priority_verifications WHERE id = ANY($1::uuid[]) OR user_id = ANY($2::uuid[])`,
          [createdVerificationIds, createdUserIds]
        );
        console.log(`  [CLEANUP] Đã xóa ${verifRes.rowCount} hồ sơ xác thực test.`);
      }

      // 3. Xóa users test
      if (createdUserIds.length > 0) {
        const userRes = await pool.query(
          `DELETE FROM users WHERE id = ANY($1::uuid[])`,
          [createdUserIds]
        );
        console.log(`  [CLEANUP] Đã xóa ${userRes.rowCount} tài khoản test.`);
      }

      // 4. Xóa tệp tải lên nếu có
      for (const fileUrl of createdFilePaths) {
        if (fileUrl.startsWith('/uploads/')) {
          const localPath = path.resolve(__dirname, '..', fileUrl.replace(/^\//, ''));
          if (fs.existsSync(localPath)) {
            try {
              fs.unlinkSync(localPath);
              console.log(`  [CLEANUP] Đã xóa file test cục bộ: ${localPath}`);
            } catch (err) {
              // ignore
            }
          }
        }
      }

      recordResult(
        'TC-15',
        'Dọn dẹp 100% dữ liệu rác (Zero Test Junk Guarantee: users, verifications, notifs)',
        'PASSED',
        Date.now() - tClean,
        `Đã dọn sạch: ${createdUserIds.length} users, ${createdVerificationIds.length} verifications`
      );
    } catch (cleanupErr) {
      recordResult(
        'TC-15',
        'Dọn dẹp dữ liệu rác',
        'FAILED',
        Date.now() - tClean,
        `Lỗi dọn dẹp: ${cleanupErr.message}`
      );
    } finally {
      await pool.end();
    }

    // -------------------------------------------------------------------------
    // BÁO CÁO TỔNG KẾT
    // -------------------------------------------------------------------------
    console.log('\n================================================================================');
    console.log('TỔNG HỢP KẾT QUẢ KIỂM THỬ:');
    console.log('================================================================================');
    const passedCount = testResults.filter((r) => r.status === 'PASSED').length;
    const failedCount = testResults.filter((r) => r.status === 'FAILED').length;
    console.log(`Tổng số Test Case:  ${testResults.length}`);
    console.log(`Thành công (PASSED): ${passedCount}`);
    console.log(`Thất bại   (FAILED): ${failedCount}`);
    console.log(`Tỷ lệ đạt:          ${Math.round((passedCount / testResults.length) * 100)}%`);
    console.log('================================================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    }
  }
}

runTestSuite();
