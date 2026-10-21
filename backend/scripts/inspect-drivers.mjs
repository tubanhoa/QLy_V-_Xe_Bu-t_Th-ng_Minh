import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const users = await pool.query(`
    SELECT u.id, u.email, u.full_name, u.phone_number, u.status, u.role_id, r.name as role_name
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.full_name ILIKE '%Hùng%' OR u.email ILIKE '%hung%'
  `);
  console.log('Users matching Hung:');
  console.table(users.rows);

  const profiles = await pool.query(`
    SELECT dp.id, dp.user_id, dp.license_number, dp.license_class, dp.status as license_status, dp.rejection_reason, u.full_name
    FROM driver_profiles dp
    LEFT JOIN users u ON dp.user_id = u.id
    WHERE u.full_name ILIKE '%Hùng%' OR u.email ILIKE '%hung%'
  `);
  console.log('Driver profiles matching Hung:');
  console.table(profiles.rows);

  const allDrivers = await pool.query(`
    SELECT u.id, u.full_name, u.email, u.status as user_status, dp.status as license_status, dp.license_class
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN driver_profiles dp ON u.id = dp.user_id
    WHERE r.name = 'driver'
  `);
  console.log('All drivers and their license statuses:');
  console.table(allDrivers.rows);

  await pool.end();
}

check().catch(console.error);
