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
  console.log('[MIGRATION] Bắt đầu nâng cấp cấu trúc bảng activity_logs (Audit Trail)...');
  try {
    // 1. Thêm cột endpoint nếu chưa có
    await pool.query(`
      ALTER TABLE activity_logs
      ADD COLUMN IF NOT EXISTS endpoint VARCHAR(255) DEFAULT NULL;
    `);

    // 2. Thêm cột method nếu chưa có
    await pool.query(`
      ALTER TABLE activity_logs
      ADD COLUMN IF NOT EXISTS method VARCHAR(10) DEFAULT NULL;
    `);

    // 3. Thêm cột status nếu chưa có
    await pool.query(`
      ALTER TABLE activity_logs
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'SUCCESS';
    `);

    // 4. Thêm cột execution_time_ms nếu chưa có
    await pool.query(`
      ALTER TABLE activity_logs
      ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER DEFAULT 0;
    `);

    // 5. Tạo các index tối ưu truy vấn kiểm toán và an ninh
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_status ON activity_logs (status);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_endpoint ON activity_logs (endpoint);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs (action);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs (user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs (timestamp);
    `);

    console.log('[MIGRATION] Nâng cấp cấu trúc bảng activity_logs thành công 100%!');
  } catch (error) {
    console.error('[MIGRATION] Lỗi nâng cấp bảng activity_logs:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
