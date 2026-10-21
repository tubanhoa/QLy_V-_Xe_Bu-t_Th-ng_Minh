import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function purge() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('--- BẮT ĐẦU DỌN DẸP CHUYẾN XE MỒ CÔI CỦA CÁC TUYẾN ĐÃ XÓA ---');

    // 1. Feedback
    const fbRes = await client.query(`
      UPDATE feedback 
      SET trip_id = NULL 
      WHERE trip_id IN (SELECT id FROM trips WHERE route_id IN (SELECT id FROM routes WHERE status = 'deleted'))
    `);
    console.log(`1. Cập nhật feedback: ${fbRes.rowCount} bản ghi.`);

    // 2. Seat holds
    const shRes = await client.query(`
      DELETE FROM seat_holds 
      WHERE trip_id IN (SELECT id FROM trips WHERE route_id IN (SELECT id FROM routes WHERE status = 'deleted'))
    `);
    console.log(`2. Xóa seat_holds: ${shRes.rowCount} bản ghi.`);

    // 3. Vehicle tracking
    const vtRes = await client.query(`
      DELETE FROM vehicle_tracking 
      WHERE trip_id IN (SELECT id FROM trips WHERE route_id IN (SELECT id FROM routes WHERE status = 'deleted'))
    `);
    console.log(`3. Xóa vehicle_tracking: ${vtRes.rowCount} bản ghi.`);

    // 4. Trip incidents
    const tiRes = await client.query(`
      DELETE FROM trip_incidents 
      WHERE trip_id IN (SELECT id FROM trips WHERE route_id IN (SELECT id FROM routes WHERE status = 'deleted'))
    `);
    console.log(`4. Xóa trip_incidents: ${tiRes.rowCount} bản ghi.`);

    // 5. Payments, invoices, tickets, bookings test
    const deletedTripsSubquery = `
      SELECT id FROM trips WHERE route_id IN (SELECT id FROM routes WHERE status = 'deleted')
    `;
    const deletedBookingsSubquery = `
      SELECT id FROM bookings WHERE trip_id IN (${deletedTripsSubquery})
    `;
    const deletedPaymentsSubquery = `
      SELECT id FROM payments WHERE booking_id IN (${deletedBookingsSubquery})
    `;

    const rfRes = await client.query(`
      DELETE FROM refund_logs WHERE payment_id IN (${deletedPaymentsSubquery})
    `).catch(() => ({ rowCount: 0 }));
    console.log(`5a. Xóa refund_logs: ${rfRes.rowCount} bản ghi.`);

    const plRes = await client.query(`
      DELETE FROM payment_logs WHERE payment_id IN (${deletedPaymentsSubquery})
    `).catch(() => ({ rowCount: 0 }));
    console.log(`5b. Xóa payment_logs: ${plRes.rowCount} bản ghi.`);

    const invRes = await client.query(`
      DELETE FROM invoices WHERE payment_id IN (${deletedPaymentsSubquery})
    `).catch(() => ({ rowCount: 0 }));
    console.log(`5c. Xóa invoices: ${invRes.rowCount} bản ghi.`);

    const payRes = await client.query(`
      DELETE FROM payments WHERE booking_id IN (${deletedBookingsSubquery})
    `).catch(() => ({ rowCount: 0 }));
    console.log(`5d. Xóa payments: ${payRes.rowCount} bản ghi.`);

    const tkRes = await client.query(`
      DELETE FROM tickets WHERE booking_id IN (${deletedBookingsSubquery})
    `).catch(() => ({ rowCount: 0 }));
    console.log(`5e. Xóa tickets: ${tkRes.rowCount} bản ghi.`);

    const bkRes = await client.query(`
      DELETE FROM bookings WHERE trip_id IN (${deletedTripsSubquery})
    `).catch(() => ({ rowCount: 0 }));
    console.log(`5f. Xóa bookings: ${bkRes.rowCount} bản ghi.`);

    // 6. Xóa các chuyến xe thuộc các tuyến đã bị xóa
    const trRes = await client.query(`
      DELETE FROM trips 
      WHERE route_id IN (SELECT id FROM routes WHERE status = 'deleted')
    `);
    console.log(`6. XÓA THÀNH CÔNG ${trRes.rowCount} CHUYẾN XE MỒ CÔI KHỎI BẢNG TRIPS!`);

    await client.query('COMMIT');
    console.log('--- HOÀN TẤT DỌN DẸP CSDL THÀNH CÔNG ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('LỖI KHI DỌN DẸP CSDL:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

purge().catch(console.error);
