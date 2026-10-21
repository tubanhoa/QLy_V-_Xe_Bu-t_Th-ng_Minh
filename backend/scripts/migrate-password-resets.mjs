import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('--- KHỞI TẠO BẢNG PASSWORD_RESETS CHO SINH VIÊN ICTU ---');

    await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(150) NOT NULL,
        student_id VARCHAR(50),
        otp_hash VARCHAR(255) NOT NULL,
        reset_token VARCHAR(255),
        expires_at TIMESTAMPTZ NOT NULL,
        attempts INT DEFAULT 0,
        is_used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for fast lookup
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
      CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(reset_token);
      CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
    `);

    console.log('✅ Bảng password_resets đã được tạo thành công.');
  } catch (error) {
    console.error('❌ Lỗi tạo bảng password_resets:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
