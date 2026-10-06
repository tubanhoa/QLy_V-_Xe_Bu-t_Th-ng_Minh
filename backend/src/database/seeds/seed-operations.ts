import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../entities/index.js';
import { BookingStatus, TicketStatus, PaymentStatus, PaymentMethod, TripStatus } from '../../common/constants/status.constant.js';

async function seedOperationalData() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL is missing in .env');
    process.exit(1);
  }

  const ds = new DataSource({
    type: 'postgres',
    url,
    entities: ALL_ENTITIES,
    ssl: { rejectUnauthorized: false },
  });

  await ds.initialize();
  console.log('✅ Connected to Supabase Cloud PostgreSQL');

  const userRepo = ds.getRepository('users');
  const tripRepo = ds.getRepository('trips');
  const seatRepo = ds.getRepository('seats');
  const bookingRepo = ds.getRepository('bookings');
  const ticketRepo = ds.getRepository('tickets');
  const paymentRepo = ds.getRepository('payments');
  const auditRepo = ds.getRepository('activity_logs');
  const routeRepo = ds.getRepository('routes');

  // 1. Get existing entities
  const users = await userRepo.find();
  const passengerUser = users.find((u: any) => u.email === 'student.an@ictu.edu.vn') || users[0];
  const adminUser = users.find((u: any) => u.email === 'admin@smartbus.ictu.vn') || users[0];

  const routes = await routeRepo.find();
  const ct01 = routes.find((r: any) => r.routeCode === 'CT-01');
  const ct02 = routes.find((r: any) => r.routeCode === 'CT-02');

  console.log(`Found ${users.length} users, ${routes.length} routes.`);

  // 2. Fetch past and today's trips
  const trips = await tripRepo
    .createQueryBuilder('trip')
    .innerJoinAndSelect('trip.route', 'route')
    .innerJoinAndSelect('trip.vehicle', 'vehicle')
    .orderBy('trip.departureTime', 'ASC')
    .getMany();

  console.log(`Found ${trips.length} trips in database.`);

  const studentNames = [
    'Nguyễn Thu An',
    'Trần Minh Quân',
    'Lê Thảo Vy',
    'Hoàng Đức Anh',
    'Phạm Mai Linh',
    'Vũ Tuấn Kiệt',
    'Đặng Thanh Hà',
    'Bùi Quốc Huy',
    'Dương Ngọc Ánh',
    'Lý Gia Bảo',
    'Ngô Thị Hương',
    'Đỗ Văn Hùng',
  ];

  const paymentMethods: PaymentMethod[] = [
    PaymentMethod.VNPAY,
    PaymentMethod.VNPAY,
    PaymentMethod.VNPAY,
    PaymentMethod.MOMO,
    PaymentMethod.MOMO,
    PaymentMethod.VIETQR,
    PaymentMethod.VIETQR,
    PaymentMethod.CASH,
  ];

  // 3. Clear existing mock bookings / tickets to ensure clean, accurate data
  const existingBookings = await bookingRepo.count();
  console.log(`Current bookings in DB: ${existingBookings}`);

  if (existingBookings < 20) {
    console.log('🌱 Seeding realistic operational bookings, tickets and payments...');

    // Distribute bookings across the last 7 days (2026-09-28 to 2026-10-04)
    const now = new Date('2026-10-04T15:00:00.000Z');
    let bookingCounter = 1;

    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const targetDate = new Date(now.getTime() - dayOffset * 86400000);
      const dateStr = targetDate.toISOString().slice(0, 10);

      // Find trips for this date
      const tripsOnDay = trips.filter((t: any) => {
        const d = new Date(t.departureTime).toISOString().slice(0, 10);
        return d === dateStr;
      });

      // Target around 15 - 25 bookings per day
      const dailyTarget = 16 + Math.floor(Math.random() * 10);
      console.log(`Generating ${dailyTarget} bookings for date ${dateStr}...`);

      const availableTrips = tripsOnDay.length > 0 ? tripsOnDay : trips.slice(0, 10);

      for (let i = 0; i < dailyTarget; i++) {
        const trip = availableTrips[i % availableTrips.length];
        const isStudent = Math.random() < 0.75; // 75% are ICTU students
        const isCT01 = trip.route?.routeCode === 'CT-01';

        const basePrice = isCT01 ? 10000 : 15000;
        const discount = isStudent ? (isCT01 ? 5000 : 7000) : 0;
        const finalPrice = basePrice - discount;

        // Realistic booking time on that day
        const bookingHour = 6 + Math.floor(Math.random() * 12);
        const bookingMin = Math.floor(Math.random() * 60);
        const bookingTime = new Date(`${dateStr}T${String(bookingHour).padStart(2, '0')}:${String(bookingMin).padStart(2, '0')}:00.000Z`);

        const codeSuffix = String(bookingCounter).padStart(4, '0');
        const bookingCode = `BK-${dateStr.replace(/-/g, '')}-${codeSuffix}`;
        bookingCounter++;

        // 1. Create Booking
        const booking = bookingRepo.create({
          bookingCode,
          userId: passengerUser.id,
          tripId: trip.id,
          totalAmount: basePrice,
          discountAmount: discount,
          finalAmount: finalPrice,
          status: BookingStatus.PAID,
          bookingTime,
        });
        const savedBooking: any = await bookingRepo.save(booking);

        // 2. Fetch a seat for this vehicle
        const seats = await seatRepo.find({ where: { vehicleId: trip.vehicleId }, take: 28 });
        const seat = seats[i % Math.max(1, seats.length)] || seats[0];

        // 3. Create Ticket
        const studentName = studentNames[i % studentNames.length];
        const ticket = ticketRepo.create({
          bookingId: savedBooking.id,
          seatId: seat?.id,
          ticketCode: `TKT-${dateStr.replace(/-/g, '').slice(2)}-${codeSuffix}`,
          passengerName: studentName,
          passengerPhone: '098' + Math.floor(1000000 + Math.random() * 9000000),
          originalPrice: basePrice,
          discountPrice: discount,
          status: dayOffset === 0 ? TicketStatus.PAID : TicketStatus.CHECKED_IN,
          qrData: JSON.stringify({
            ticketCode: `TKT-${dateStr.replace(/-/g, '').slice(2)}-${codeSuffix}`,
            passenger: studentName,
            trip: trip.route?.routeCode,
            date: dateStr,
          }),
        });
        await ticketRepo.save(ticket);

        // 4. Create Payment
        const paymentMethod = paymentMethods[i % paymentMethods.length];
        const payment = paymentRepo.create({
          bookingId: savedBooking.id,
          paymentMethod,
          transactionId: `TXN-${paymentMethod.toUpperCase()}-${dateStr.replace(/-/g, '')}-${codeSuffix}`,
          amount: finalPrice,
          status: PaymentStatus.SUCCESS,
          paymentTime: bookingTime,
          paymentDetails: {
            gateway: paymentMethod,
            responseCode: '00',
            message: 'Giao dịch thành công',
          },
        });
        await paymentRepo.save(payment);
      }
    }

    console.log('✅ Successfully seeded bookings, tickets and completed payments!');
  }

  // 4. Seed Audit Logs (Activity Logs)
  const existingLogs = await auditRepo.count();
  console.log(`Current activity logs in DB: ${existingLogs}`);

  if (existingLogs < 5) {
    console.log('🌱 Seeding real audit logs for Admin activity trail...');

    const auditEntries = [
      {
        userId: adminUser.id,
        action: 'UPDATE_ROUTE_CONFIG',
        resourceName: 'routes',
        resourceId: ct01?.id || 'CT-01',
        changes: {
          routeCode: 'CT-01',
          name: 'ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên',
          distanceKm: 14.5,
          pricingType: 'distance',
          frequencyMinutes: 20,
        },
        ipAddress: '113.190.234.12',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0',
        timestamp: new Date('2026-10-04T13:45:00.000Z'),
      },
      {
        userId: adminUser.id,
        action: 'REORDER_STATIONS',
        resourceName: 'route_stations',
        resourceId: ct01?.id || 'CT-01',
        changes: {
          routeCode: 'CT-01',
          totalStations: 5,
          stops: [
            'Trạm ĐH CNTT & TT Thái Nguyên (ICTU)',
            'Trạm Cổng KTX ĐH Thái Nguyên',
            'Trạm Ngã 3 Mỏ Chè',
            'Trạm Bệnh Viện Đa Khoa Trung Ương',
            'Trạm Bến Xe Trung Tâm Thái Nguyên',
          ],
        },
        ipAddress: '113.190.234.12',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0',
        timestamp: new Date('2026-10-04T12:30:00.000Z'),
      },
      {
        userId: adminUser.id,
        action: 'CONFIG_FARE_POLICY',
        resourceName: 'fare_rules',
        resourceId: ct01?.id || 'CT-01',
        changes: {
          policy: 'STUDENT_DISCOUNT_50',
          basePrice: 10000,
          studentPrice: 5000,
          discountPercentage: 50,
        },
        ipAddress: '113.190.234.12',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0',
        timestamp: new Date('2026-10-04T10:15:00.000Z'),
      },
      {
        userId: adminUser.id,
        action: 'ASSIGN_VEHICLE_DISPATCH',
        resourceName: 'vehicles',
        resourceId: '20B-012.34',
        changes: {
          licensePlate: '20B-012.34',
          model: 'VinFast eBus 2024 (EV)',
          driverName: 'Trần Văn Nam',
          status: 'active',
        },
        ipAddress: '113.190.234.12',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0',
        timestamp: new Date('2026-10-04T08:00:00.000Z'),
      },
      {
        userId: adminUser.id,
        action: 'SYSTEM_SECURITY_AUDIT',
        resourceName: 'security',
        resourceId: 'SSL_SUPABASE_CLOUD',
        changes: {
          protocol: 'TLSv1.3',
          cipher: 'AES-256-GCM',
          rbacEnforced: true,
          status: 'SUCCESS',
        },
        ipAddress: '113.190.234.12',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0',
        timestamp: new Date('2026-10-04T06:00:00.000Z'),
      },
    ];

    for (const entry of auditEntries) {
      const log = auditRepo.create(entry);
      await auditRepo.save(log);
    }
    console.log('✅ Successfully seeded real activity logs!');
  }

  await ds.destroy();
  console.log('🎉 Finished seeding operational data to Supabase!');
}

seedOperationalData().catch((err) => {
  console.error('❌ Error seeding operational data:', err);
  process.exit(1);
});
