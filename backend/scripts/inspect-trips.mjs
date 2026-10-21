import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('backend', '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const routes = await pool.query('SELECT id, route_code, name, status FROM routes ORDER BY route_code');
  console.log('--- ALL ROUTES IN DB ---');
  console.table(routes.rows);

  const tripsByRoute = await pool.query(`
    SELECT 
      COALESCE(r.route_code, 'NO_ROUTE') as route_code,
      COALESCE(r.name, 'NO_NAME') as route_name,
      COALESCE(r.status, 'NO_ROUTE') as route_status,
      t.trip_type,
      COUNT(t.id) as trip_count
    FROM trips t
    LEFT JOIN routes r ON t.route_id = r.id
    GROUP BY r.route_code, r.name, r.status, t.trip_type
    ORDER BY r.route_code, t.trip_type
  `);
  console.log('\n--- TRIPS GROUPED BY ROUTE & TRIP_TYPE ---');
  console.table(tripsByRoute.rows);

  const totalTrips = await pool.query('SELECT count(*) as total FROM trips');
  console.log(`\nTOTAL TRIPS IN DB: ${totalTrips.rows[0].total}`);

  // Check rolling window (now to now + 3 days)
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfRollingWindow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 23, 59, 59, 999);
  
  const rollingWindowTrips = await pool.query(`
    SELECT 
      COALESCE(r.route_code, 'NO_ROUTE') as route_code,
      COALESCE(r.name, 'NO_NAME') as route_name,
      COALESCE(r.status, 'NO_ROUTE') as route_status,
      t.trip_type,
      COUNT(t.id) as trip_count
    FROM trips t
    LEFT JOIN routes r ON t.route_id = r.id
    WHERE t.departure_time BETWEEN $1 AND $2
    GROUP BY r.route_code, r.name, r.status, t.trip_type
    ORDER BY r.route_code, t.trip_type
  `, [startOfDay.toISOString(), endOfRollingWindow.toISOString()]);
  console.log('\n--- TRIPS IN ROLLING WINDOW (T+3) ---');
  console.table(rollingWindowTrips.rows);

  await pool.end();
}

check().catch(console.error);
