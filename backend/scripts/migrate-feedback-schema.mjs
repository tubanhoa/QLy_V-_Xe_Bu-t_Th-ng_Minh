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
  console.log('[MIGRATION] Bắt đầu nâng cấp cấu trúc bảng feedback (Đánh giá & Khiếu nại)...');
  try {
    // 1. Thêm cột type ('rating' | 'complaint' | 'suggestion')
    await pool.query(`
      ALTER TABLE feedback
      ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'rating';
    `);

    // 2. Thêm cột title (tiêu đề phản ánh/khiếu nại)
    await pool.query(`
      ALTER TABLE feedback
      ADD COLUMN IF NOT EXISTS title VARCHAR(200) DEFAULT NULL;
    `);

    // 3. Thêm cột attachments (danh sách URLs ảnh minh chứng dạng JSONB)
    await pool.query(`
      ALTER TABLE feedback
      ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT NULL;
    `);

    // 4. Thêm cột ticket_code (mã vé liên quan nếu có)
    await pool.query(`
      ALTER TABLE feedback
      ADD COLUMN IF NOT EXISTS ticket_code VARCHAR(50) DEFAULT NULL;
    `);

    // 5. Tạo các index tối ưu hóa tìm kiếm & lọc
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback (type);
      CREATE INDEX IF NOT EXISTS idx_feedback_rating_score ON feedback (rating_score);
      CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at);
    `);

    console.log('[MIGRATION] Nâng cấp cấu trúc bảng feedback thành công 100%!');
  } catch (error) {
    console.error('[MIGRATION] Lỗi nâng cấp bảng feedback:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
