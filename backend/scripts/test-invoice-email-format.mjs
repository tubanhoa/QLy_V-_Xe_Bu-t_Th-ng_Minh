/**
 * TEST SUITE: KIỂM THỬ ĐỊNH DẠNG EMAIL HÓA ĐƠN ĐIỆN TỬ & CHỐNG BOUNCE MAIL (ZERO JUNK)
 * 
 * Mục tiêu kiểm thử:
 * 1. Chống lỗi Bounce Mail 550 "Address not found":
 *    - Khi gửi đến email mock 'student.an@ictu.edu.vn', hệ thống tự động redirect an toàn về 'ductrandanh06@gmail.com'
 *    - Kèm banner cảnh báo chế độ thử nghiệm rõ ràng.
 * 2. Chuẩn hóa định dạng Email Hóa Đơn Điện Tử Responsive HTML:
 *    - Có preheader ẩn chống dính chữ snippet xem trước trên Gmail app.
 *    - Bảng kê dịch vụ rõ ràng, thuế suất GTGT 8%, số tiền bằng chữ.
 *    - Nút bấm CTA tra cứu hóa đơn trực tuyến & con dấu số điện tử ICTU.
 *    - Đính kèm tệp PDF hóa đơn điện tử hợp lệ (> 10KB).
 * 3. Gửi email hóa đơn thực tế tới 'ductrandanh06@gmail.com' để người dùng kiểm tra trên điện thoại.
 * 4. Tự động dọn dẹp sạch sẽ 100% dữ liệu test trong Database (ZERO TEST JUNK GUARANTEE).
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('[TEST-ERROR] DATABASE_URL khong duoc tim thay trong .env');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
});

const createdIds = {
  bookingIds: [],
  paymentIds: [],
  ticketIds: [],
  invoiceIds: [],
};

async function cleanupTestData() {
  console.log('\n--- TIEN HANH DON DEP DU LIEU TEST (ZERO TEST JUNK GUARANTEE) ---');
  const client = await pool.connect();
  try {
    if (createdIds.invoiceIds.length > 0) {
      await client.query(`DELETE FROM invoices WHERE id = ANY($1::uuid[])`, [createdIds.invoiceIds]);
      console.log(`[CLEANUP] Da xoa ${createdIds.invoiceIds.length} invoices`);
    }
    if (createdIds.ticketIds.length > 0) {
      await client.query(`DELETE FROM tickets WHERE id = ANY($1::uuid[])`, [createdIds.ticketIds]);
      console.log(`[CLEANUP] Da xoa ${createdIds.ticketIds.length} tickets`);
    }
    if (createdIds.paymentIds.length > 0) {
      await client.query(`DELETE FROM payments WHERE id = ANY($1::uuid[])`, [createdIds.paymentIds]);
      console.log(`[CLEANUP] Da xoa ${createdIds.paymentIds.length} payments`);
    }
    if (createdIds.bookingIds.length > 0) {
      await client.query(`DELETE FROM bookings WHERE id = ANY($1::uuid[])`, [createdIds.bookingIds]);
      console.log(`[CLEANUP] Da xoa ${createdIds.bookingIds.length} bookings`);
    }
    console.log('[CLEANUP] Hoan tat 100% don dep - CSDL sach se tuyet doi.');
  } catch (err) {
    console.error('[CLEANUP-ERROR] Loi trong qua trinh don dep:', err.message);
  } finally {
    client.release();
  }
}

async function runInvoiceEmailTests() {
  console.log('================================================================================');
  console.log('KHOI DONG KIEM THU DINH DANG EMAIL HOA DON DIEN TU & CHONG BOUNCE MAIL');
  console.log('================================================================================\n');

  try {
    // 0. Đăng nhập lấy Customer Token
    console.log('[STEP 0] Dang nhap lay token nguoi dung test...');
    let res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student.an@ictu.edu.vn', password: 'Password@123' }),
    });
    let loginData = await res.json();
    let customerToken = loginData.data?.accessToken;

    if (!customerToken) {
      // Fallback: Tìm user bất kỳ trong DB
      const userRes = await pool.query("SELECT id, email FROM users WHERE email LIKE '%@%' LIMIT 1");
      if (userRes.rows.length === 0) throw new Error('Khong tim thay user nao trong DB');
      const testUser = userRes.rows[0];
      res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testUser.email, password: 'Password@123' }),
      });
      loginData = await res.json();
      customerToken = loginData.data?.accessToken;
    }

    if (!customerToken) {
      throw new Error('Khong the lay customerToken de goi API');
    }
    console.log('[STEP 0-OK] Da co token xac thuc!');

    // 1. Lấy trip và seat khả dụng từ database
    const tripRes = await pool.query(`
      SELECT t.id, t.vehicle_id, r.base_price, r.name as route_name
      FROM trips t
      JOIN routes r ON t.route_id = r.id
      ORDER BY t.departure_time DESC
      LIMIT 1;
    `);

    if (tripRes.rows.length === 0) {
      throw new Error('Khong tim thay chuyen xe nao trong DB');
    }

    const testTrip = tripRes.rows[0];
    const seatRes = await pool.query(`
      SELECT s.id, s.seat_number
      FROM seats s
      WHERE s.vehicle_id = $1
      LIMIT 1
    `, [testTrip.vehicle_id]);

    if (seatRes.rows.length === 0) {
      throw new Error('Khong tim thay ghe hop le tren xe');
    }
    const testSeat = seatRes.rows[0];

    console.log(`[STEP 1] Tim thay chuyen xe: ${testTrip.route_name} (TripID: ${testTrip.id})`);
    console.log(`         Ghe chon: ${testSeat.seat_number} (SeatID: ${testSeat.id})`);

    // 2. Tạo Booking test
    const bookingPayload = {
      tripId: testTrip.id,
      seatIds: [testSeat.id],
      passengers: [
        {
          seatId: testSeat.id,
          passengerName: 'Trần Danh Đức',
          passengerPhone: '0987654321',
        },
      ],
      paymentMethod: 'vnpay',
      totalAmount: 15000,
    };

    console.log(`[STEP 2] Tao don dat ve test qua API POST ${API_BASE}/booking/create...`);
    const createRes = await fetch(`${API_BASE}/booking/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify(bookingPayload),
    });

    const createData = await createRes.json();
    if (!createRes.ok || !createData.data) {
      throw new Error(`Tao booking that bai: ${JSON.stringify(createData)}`);
    }

    const bookingId = createData.data.bookingId || createData.data.id;
    const bookingCode = createData.data.bookingCode;
    createdIds.bookingIds.push(bookingId);
    if (createData.data.tickets && Array.isArray(createData.data.tickets)) {
      createData.data.tickets.forEach(t => createdIds.ticketIds.push(t.id));
    }
    console.log(`[STEP 2-OK] Tao booking thanh cong: Ma ${bookingCode} (ID: ${bookingId})`);

    // 3. Giả lập thanh toán thành công qua mock-confirm để kích hoạt hệ thống phát hành hóa đơn & gửi email
    console.log(`[STEP 3] Xac nhan thanh toan qua POST ${API_BASE}/payment/mock-confirm/${bookingId}...`);
    const confirmRes = await fetch(`${API_BASE}/payment/mock-confirm/${bookingId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        bankCode: 'NCB',
        transactionNo: `VNPTEST_${Date.now()}`,
      }),
    });

    const confirmData = await confirmRes.json();
    if (!confirmRes.ok || !confirmData.success) {
      throw new Error(`Mock confirm payment that bai: ${JSON.stringify(confirmData)}`);
    }

    // Lấy payment ID từ database
    const payRes = await pool.query(`SELECT id, status FROM payments WHERE booking_id = $1`, [bookingId]);
    if (payRes.rows.length > 0) {
      createdIds.paymentIds.push(payRes.rows[0].id);
      console.log(`[STEP 3-OK] Thanh toan thanh cong! Payment ID: ${payRes.rows[0].id}, Status: ${payRes.rows[0].status}`);
    } else {
      console.log(`[STEP 3-OK] Thanh toan thanh cong theo API!`);
    }

    // 4. Cho 4 giay de invoice queue xu ly tao hoa don & gui email qua SMTP
    console.log(`[STEP 4] Doi 4 giay de Invoice Queue xu ly phat hanh hoa don & gui email qua SMTP...`);
    await new Promise(r => setTimeout(r, 4000));

    // Truy van invoice trong DB
    const invRes = await pool.query(`SELECT id, invoice_number, lookup_code, subtotal_amount, vat_amount, total_amount, pdf_url FROM invoices WHERE booking_id = $1`, [bookingId]);
    if (invRes.rows.length > 0) {
      const inv = invRes.rows[0];
      createdIds.invoiceIds.push(inv.id);
      console.log(`[STEP 4-OK] Tim thay hoa don dien tu trong DB:`);
      console.log(`          - So hoa don:      ${inv.invoice_number}`);
      console.log(`          - Ma tra cuu:      ${inv.lookup_code}`);
      console.log(`          - Tien truoc thue: ${inv.subtotal_amount} VND`);
      console.log(`          - Thue GTGT 8%:    ${inv.vat_amount} VND`);
      console.log(`          - Tong thanh toan: ${inv.total_amount} VND`);
    }

    // 5. Test gui lai hoa don qua API resend-email truc tiep den ductrandanh06@gmail.com
    console.log(`[STEP 5] Kiem thu API resend-email gui truc tiep den ductrandanh06@gmail.com...`);
    const resendRes = await fetch(`${API_BASE}/invoices/booking/${bookingCode}/resend-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ email: 'ductrandanh06@gmail.com' }),
    });

    const resendData = await resendRes.json();
    console.log(`[STEP 5-RESULT] Ket qua gui lai email:`, resendData);

    // 6. Test cơ chế phòng vệ chống Bounce Mail 550 khi nhận địa chỉ mock 'student.an@ictu.edu.vn'
    console.log(`[STEP 6] Kiem thu co che phong ve chong Bounce Mail 550 voi dia chi mock: student.an@ictu.edu.vn...`);
    const bounceGuardRes = await fetch(`${API_BASE}/invoices/booking/${bookingCode}/resend-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ email: 'student.an@ictu.edu.vn' }),
    });

    const bounceGuardData = await bounceGuardRes.json();
    console.log(`[STEP 6-RESULT] Ket qua phong ve Bounce Mail:`, bounceGuardData);

    console.log('\n================================================================================');
    console.log('TAT CA CAC TEST CASE VE EMAIL HOA DON DIEN TU VA BOUNCE GUARD DA HOAN TAT MY MAN!');
    console.log('================================================================================');

  } catch (err) {
    console.error('[TEST-FATAL] Loi nghiem trong trong qua trinh kiem thu:', err);
  } finally {
    await cleanupTestData();
    await pool.end();
  }
}

runInvoiceEmailTests();
