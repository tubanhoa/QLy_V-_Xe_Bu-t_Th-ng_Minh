import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('backend', '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function purge() {
  console.log('--- BẮT ĐẦU DỌN DẸP CHUYẾN CŨ, TRÙNG LẶP VÀ TUYẾN NGƯNG HOẠT ĐỘNG ---');

  const targetTrips = await pool.query(`
    SELECT id FROM trips
    WHERE status IN ('completed', 'cancelled')
       OR route_id IN (SELECT id FROM routes WHERE status IN ('inactive', 'deleted'))
       OR id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY route_id, departure_time ORDER BY created_at DESC, id DESC) as rn
            FROM trips
            WHERE status = 'scheduled'
          ) sub
          WHERE rn > 1
       )
  `);

  if (!targetTrips.rows || targetTrips.rows.length === 0) {
    console.log('Không có chuyến xe nào cần dọn dẹp.');
    await pool.end();
    return;
  }

  const tripIds = targetTrips.rows.map(t => t.id);
  console.log(`Tìm thấy ${tripIds.length} chuyến xe cần xóa.`);

  // Xóa cascade an toàn
  const fbRes = await pool.query('UPDATE feedback SET trip_id = NULL WHERE trip_id = ANY($1)', [tripIds]);
  console.log(`- Đã gỡ liên kết ${fbRes.rowCount} phản hồi (feedback).`);

  const shRes = await pool.query('DELETE FROM seat_holds WHERE trip_id = ANY($1)', [tripIds]);
  console.log(`- Đã xóa ${shRes.rowCount} giữ chỗ (seat_holds).`);

  const vtRes = await pool.query('DELETE FROM vehicle_tracking WHERE trip_id = ANY($1)', [tripIds]);
  console.log(`- Đã xóa ${vtRes.rowCount} bản ghi định vị (vehicle_tracking).`);

  const tiRes = await pool.query('DELETE FROM trip_incidents WHERE trip_id = ANY($1)', [tripIds]);
  console.log(`- Đã xóa ${tiRes.rowCount} sự cố (trip_incidents).`);

  const bookings = await pool.query('SELECT id FROM bookings WHERE trip_id = ANY($1)', [tripIds]);
  if (bookings.rows && bookings.rows.length > 0) {
    const bIds = bookings.rows.map(b => b.id);
    await pool.query('DELETE FROM refund_logs WHERE payment_id IN (SELECT id FROM payments WHERE booking_id = ANY($1))', [bIds]).catch(() => {});
    await pool.query('DELETE FROM payment_logs WHERE payment_id IN (SELECT id FROM payments WHERE booking_id = ANY($1))', [bIds]).catch(() => {});
    await pool.query('DELETE FROM invoices WHERE payment_id IN (SELECT id FROM payments WHERE booking_id = ANY($1))', [bIds]).catch(() => {});
    const pRes = await pool.query('DELETE FROM payments WHERE booking_id = ANY($1)', [bIds]).catch(() => ({ rowCount: 0 }));
    const tkRes = await pool.query('DELETE FROM tickets WHERE booking_id = ANY($1)', [bIds]).catch(() => ({ rowCount: 0 }));
    const bkRes = await pool.query('DELETE FROM bookings WHERE trip_id = ANY($1)', [tripIds]);
    console.log(`- Đã xóa ${bkRes.rowCount} booking, ${tkRes.rowCount} ticket, ${pRes.rowCount} payment của các chuyến cũ.`);
  }

  const delTrips = await pool.query('DELETE FROM trips WHERE id = ANY($1)', [tripIds]);
  console.log(`- ĐÃ XÓA THÀNH CÔNG ${delTrips.rowCount} CHUYẾN XE!`);

  const remainRes = await pool.query(`
    SELECT t.id, r.route_code, r.name, t.departure_time, t.arrival_time, t.status
    FROM trips t
    JOIN routes r ON t.route_id = r.id
    ORDER BY t.departure_time ASC
  `);
  console.log('\n--- CÁC CHUYẾN XE CÒN LẠI TRONG DATABASE ---');
  console.table(remainRes.rows);

  await pool.end();
}

purge().catch(err => {
  console.error('Lỗi khi dọn dẹp:', err);
  pool.end();
});
