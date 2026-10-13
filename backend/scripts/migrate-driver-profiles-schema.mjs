import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('backend', '.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log('--- KHỞI CHẠY MIGRATION: BẢNG DRIVER_PROFILES (HỒ SƠ BẰNG LÁI TÀI XẾ) ---');

  // 1. Tạo bảng driver_profiles
  await pool.query(`
    CREATE TABLE IF NOT EXISTS driver_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      license_number VARCHAR(50) NOT NULL,
      license_class VARCHAR(10) NOT NULL DEFAULT 'D',
      issue_date DATE,
      expiry_date DATE,
      front_image_url VARCHAR(500) NOT NULL,
      back_image_url VARCHAR(500),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      rejection_reason VARCHAR(300),
      approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_driver_profiles_user_id ON driver_profiles(user_id);
    CREATE INDEX IF NOT EXISTS idx_driver_profiles_status ON driver_profiles(status);
  `);
  console.log('[OK] Đã tạo bảng driver_profiles và các indexes thành công.');

  // 2. Lấy danh sách tài xế hiện có
  const driversRes = await pool.query(`
    SELECT u.id, u.full_name, u.email, u.phone_number
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.name = 'driver'
  `);

  console.log(`[INFO] Tìm thấy ${driversRes.rows.length} tài xế trong hệ thống.`);

  const adminRes = await pool.query(`
    SELECT u.id FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.name = 'admin' LIMIT 1
  `);
  const adminId = adminRes.rows[0]?.id || null;

  for (const driver of driversRes.rows) {
    const existing = await pool.query(
      `SELECT id, status FROM driver_profiles WHERE user_id = $1`,
      [driver.id],
    );

    if (existing.rows.length === 0) {
      // Quyết định trạng thái theo thống nhất:
      // Nguyễn Văn Hùng -> pending (để phục vụ kịch bản demo bị chặn -> vào duyệt -> thành công)
      // Các tài xế khác (Lê Hoàng Nam, Trần Văn Nam) -> approved
      const isHung = (driver.full_name || '').includes('Hùng') || (driver.email || '').includes('hung');
      const status = isHung ? 'pending' : 'approved';
      const licenseClass = isHung ? 'D' : (driver.email.includes('nam@smartbus') ? 'E' : 'D');
      const licenseNumber = isHung
        ? 'GPLX-20-D-199887'
        : `GPLX-20-${licenseClass}-${Math.floor(100000 + Math.random() * 900000)}`;

      await pool.query(
        `INSERT INTO driver_profiles (
          user_id, license_number, license_class, issue_date, expiry_date,
          front_image_url, back_image_url, status, approved_by, approved_at
        ) VALUES (
          $1, $2, $3, '2023-01-15', '2028-01-15',
          'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80',
          $4, $5, $6
        )`,
        [
          driver.id,
          licenseNumber,
          licenseClass,
          status,
          status === 'approved' ? adminId : null,
          status === 'approved' ? new Date() : null,
        ],
      );

      console.log(
        `[SEED] Đã khởi tạo hồ sơ GPLX cho tài xế ${driver.full_name}: Hạng ${licenseClass}, Số: ${licenseNumber}, Status: ${status}`,
      );
    } else {
      console.log(`[SKIP] Tài xế ${driver.full_name} đã có hồ sơ GPLX (Status: ${existing.rows[0].status}).`);
    }
  }

  console.log('--- HOÀN TẤT MIGRATION DRIVER_PROFILES THÀNH CÔNG ---');
  await pool.end();
}

migrate().catch((err) => {
  console.error('[LỖI MIGRATION]:', err);
  process.exit(1);
});
