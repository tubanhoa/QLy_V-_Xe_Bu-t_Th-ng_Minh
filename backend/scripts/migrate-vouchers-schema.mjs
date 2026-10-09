import pg from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  console.log('[MIGRATION] Bắt đầu cập nhật cấu trúc bảng vouchers...');
  try {
    // 1. Thêm cột applicable_type nếu chưa có
    await pool.query(`
      ALTER TABLE vouchers
      ADD COLUMN IF NOT EXISTS applicable_type VARCHAR(30) DEFAULT 'all';
    `);

    // 2. Thêm cột applicable_route_ids nếu chưa có
    await pool.query(`
      ALTER TABLE vouchers
      ADD COLUMN IF NOT EXISTS applicable_route_ids JSONB DEFAULT NULL;
    `);

    // 3. Thêm cột description nếu chưa có
    await pool.query(`
      ALTER TABLE vouchers
      ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;
    `);

    // 4. Thêm cột updated_at nếu chưa có
    await pool.query(`
      ALTER TABLE vouchers
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
    `);

    console.log('[MIGRATION] Cập nhật bảng vouchers thành công 100%!');
  } catch (error) {
    console.error('[MIGRATION] Lỗi cập nhật bảng vouchers:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
