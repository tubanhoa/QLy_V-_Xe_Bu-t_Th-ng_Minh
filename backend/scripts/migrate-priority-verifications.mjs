import dotenv from 'dotenv';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runMigration() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('[MIGRATION] Dang cap nhat bang users va tao bang priority_verifications...');
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS priority_category VARCHAR(20) DEFAULT 'regular';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'unverified';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_by UUID;

      CREATE TABLE IF NOT EXISTS priority_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(20) NOT NULL DEFAULT 'student',
        student_id VARCHAR(50),
        school_name VARCHAR(150),
        id_card_number VARCHAR(20),
        front_image_url TEXT NOT NULL,
        back_image_url TEXT,
        portrait_image_url TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        rejection_reason TEXT,
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_priority_verifications_user_id ON priority_verifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_priority_verifications_status ON priority_verifications(status);
    `);
    console.log('[MIGRATION] Hoan tat cap nhat schema thanh cong 100%!');
  } catch (err) {
    console.error('[MIGRATION-ERROR]', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
