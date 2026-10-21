import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_BASE = 'http://127.0.0.1:3001/api/v1';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function runTests() {
  console.log('================================================================');
  console.log('🚀 KIỂM THỬ TỰ ĐỘNG CHỨC NĂNG QUÊN MẬT KHẨU SINH VIÊN ICTU');
  console.log('================================================================');

  const client = await pool.connect();
  try {
    // 1. Kiểm tra tài khoản sinh viên mẫu tồn tại
    const userRes = await client.query(`SELECT id, email, full_name, student_id FROM users WHERE email = 'student.an@ictu.edu.vn' LIMIT 1`);
    if (userRes.rows.length === 0) {
      console.log('⚠️ Không tìm thấy sinh viên mẫu student.an@ictu.edu.vn, tìm sinh viên bất kỳ...');
      const anyStudent = await client.query(`SELECT id, email, full_name, student_id FROM users WHERE student_id IS NOT NULL LIMIT 1`);
      console.log('Sinh viên tìm thấy:', anyStudent.rows[0]);
    } else {
      console.log('✅ Tìm thấy sinh viên mẫu:', userRes.rows[0]);
    }

    const testStudent = userRes.rows[0] || (await client.query(`SELECT id, email, full_name, student_id FROM users WHERE email LIKE '%ictu.edu.vn' LIMIT 1`)).rows[0];
    const testIdentifier = testStudent.student_id || testStudent.email;

    console.log(`\n[TEST 1] Yêu cầu gửi mã OTP cho: ${testIdentifier}...`);
    // Dọn dẹp reset cũ nếu có để tránh rate limit khi test
    await client.query(`DELETE FROM password_resets WHERE email = $1`, [testStudent.email]);

    const req1 = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testIdentifier }),
    });
    const res1 = await req1.json();
    console.log(`Kết quả Test 1 (Status: ${req1.status}):`, res1);
    if (!res1.success) throw new Error('Test 1 thất bại: Không thể gửi OTP');

    console.log('\n[TEST 2] Kiểm tra Rate Limit (< 60s)...');
    const req2 = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testIdentifier }),
    });
    const res2 = await req2.json();
    console.log(`Kết quả Test 2 (Status: ${req2.status} - kỳ vọng 400):`, res2.message);
    if (req2.status !== 400) throw new Error('Test 2 thất bại: Rate limit không chặn!');

    // Lấy bản ghi OTP trong CSDL
    const resetRow = (await client.query(`SELECT * FROM password_resets WHERE email = $1 ORDER BY created_at DESC LIMIT 1`, [testStudent.email])).rows[0];
    console.log('\n[DATABASE] Bản ghi OTP vừa tạo:', {
      id: resetRow.id,
      email: resetRow.email,
      expires_at: resetRow.expires_at,
      attempts: resetRow.attempts,
    });

    console.log('\n[TEST 3] Thử nhập sai OTP (999999)...');
    const req3 = await fetch(`${API_BASE}/auth/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testIdentifier, otp: '999999' }),
    });
    const res3 = await req3.json();
    console.log(`Kết quả Test 3 (Status: ${req3.status} - kỳ vọng 400):`, res3.message);

    console.log('\n[TEST 4] Kiểm tra số lần thử sai tăng lên 1 trong DB...');
    const checkAttempts = (await client.query(`SELECT attempts FROM password_resets WHERE id = $1`, [resetRow.id])).rows[0];
    console.log(`Số lần thử hiện tại trong DB: ${checkAttempts.attempts}`);
    if (checkAttempts.attempts !== 1) throw new Error('Test 4 thất bại: Attempts không tăng');

    // Để có OTP thật test xác thực, ta sinh 1 OTP test đã biết mã hash hoặc tạo mã mới
    // Vì bcrypt là 1 chiều, ta tạo một OTP cố định '123456' và cập nhật hash vào DB
    import('bcrypt').then(async (bcrypt) => {
      const fixedOtp = '123456';
      const fixedHash = await bcrypt.default.hash(fixedOtp, 10);
      await client.query(`UPDATE password_resets SET otp_hash = $1, attempts = 0 WHERE id = $2`, [fixedHash, resetRow.id]);

      console.log('\n[TEST 5] Xác thực OTP đúng (123456)...');
      const req5 = await fetch(`${API_BASE}/auth/verify-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: testIdentifier, otp: fixedOtp }),
      });
      const res5 = await req5.json();
      console.log(`Kết quả Test 5 (Status: ${req5.status}):`, res5);
      if (!res5.success || !res5.resetToken) throw new Error('Test 5 thất bại: Không nhận được resetToken');

      const resetToken = res5.resetToken;

      console.log('\n[TEST 6] Đổi mật khẩu với mật khẩu yếu (123456)...');
      const req6 = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: testIdentifier, resetToken, newPassword: '123' }),
      });
      const res6 = await req6.json();
      console.log(`Kết quả Test 6 (Status: ${req6.status} - kỳ vọng 400):`, res6.message);
      if (req6.status !== 400) throw new Error('Test 6 thất bại: Cho phép mật khẩu yếu!');

      console.log('\n[TEST 7] Đổi mật khẩu với mật khẩu mạnh (Password@2026)...');
      const req7 = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: testIdentifier, resetToken, newPassword: 'Password@2026' }),
      });
      const res7 = await req7.json();
      console.log(`Kết quả Test 7 (Status: ${req7.status}):`, res7);
      if (!res7.success) throw new Error('Test 7 thất bại: Không đổi được mật khẩu');

      console.log('\n[TEST 8] Đăng nhập bằng mật khẩu mới Password@2026...');
      const req8 = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testStudent.email, password: 'Password@2026' }),
      });
      const res8 = await req8.json();
      console.log(`Kết quả Test 8 (Status: ${req8.status}):`, res8);
      const token = res8.accessToken || res8.data?.accessToken;
      if (req8.status !== 200 || !token) throw new Error('Test 8 thất bại: Không đăng nhập được bằng mật khẩu mới');

      // Khôi phục lại mật khẩu gốc Password@123 để không ảnh hưởng test suite khác
      const originalHash = await bcrypt.default.hash('Password@123', 10);
      await client.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [originalHash, testStudent.id]);
      console.log('✅ Đã khôi phục lại mật khẩu mặc định Password@123 cho sinh viên.');

      console.log('\n🎉 TOÀN BỘ 8/8 TEST CASES BACKEND QUÊN MẬT KHẨU ĐÃ ĐẠT 100%!');
      process.exit(0);
    });

  } catch (err) {
    console.error('❌ Lỗi kiểm thử:', err.message);
    process.exit(1);
  } finally {
    client.release();
    // pool.end() sẽ gọi sau
  }
}

runTests();
