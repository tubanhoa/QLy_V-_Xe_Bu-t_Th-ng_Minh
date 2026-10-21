import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function checkFKs() {
  const deletedRouteTripsQuery = `
    SELECT id FROM trips WHERE route_id IN (SELECT id FROM routes WHERE status = 'deleted')
  `;

  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM trips WHERE route_id IN (SELECT id FROM routes WHERE status = 'deleted')) as deleted_route_trips,
      (SELECT COUNT(*) FROM bookings WHERE trip_id IN (${deletedRouteTripsQuery})) as bookings_count,
      (SELECT COUNT(*) FROM tickets WHERE booking_id IN (SELECT id FROM bookings WHERE trip_id IN (${deletedRouteTripsQuery}))) as tickets_count,
      (SELECT COUNT(*) FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE trip_id IN (${deletedRouteTripsQuery}))) as payments_count,
      (SELECT COUNT(*) FROM seat_holds WHERE trip_id IN (${deletedRouteTripsQuery})) as seat_holds_count,
      (SELECT COUNT(*) FROM feedback WHERE trip_id IN (${deletedRouteTripsQuery})) as feedback_count,
      (SELECT COUNT(*) FROM trip_incidents WHERE trip_id IN (${deletedRouteTripsQuery})) as incidents_count,
      (SELECT COUNT(*) FROM vehicle_tracking WHERE trip_id IN (${deletedRouteTripsQuery})) as tracking_count
  `);

  console.log('--- FOREIGN KEY DEPENDENCIES ON DELETED ROUTE TRIPS ---');
  console.table(counts.rows);

  // Check bookings details if any
  const bookings = await pool.query(`
    SELECT b.id, b.booking_code, b.status, b.trip_id, r.route_code 
    FROM bookings b
    JOIN trips t ON b.trip_id = t.id
    JOIN routes r ON t.route_id = r.id
    WHERE r.status = 'deleted'
  `);
  console.log('--- BOOKINGS ON DELETED ROUTE TRIPS ---');
  console.table(bookings.rows);

  await pool.end();
}

checkFKs().catch(console.error);
