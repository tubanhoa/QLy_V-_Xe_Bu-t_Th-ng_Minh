import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
  ExecutionContext,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import * as crypto from 'node:crypto';

import { PaymentController } from '../src/modules/payment/payment.controller.js';
import { PaymentService } from '../src/modules/payment/payment.service.js';
import { BookingController } from '../src/modules/booking/booking.controller.js';
import { BookingService } from '../src/modules/booking/booking.service.js';
import { SeatLockService } from '../src/modules/booking/seat-lock.service.js';
import { NotificationService } from '../src/modules/notification/notification.service.js';
import { TripsService } from '../src/modules/trips/trips.service.js';

import { PaymentEntity } from '../src/database/entities/payment.entity.js';
import { PaymentLogEntity } from '../src/database/entities/payment-log.entity.js';
import { BookingEntity } from '../src/database/entities/booking.entity.js';
import { TicketEntity } from '../src/database/entities/ticket.entity.js';
import { SeatHoldEntity } from '../src/database/entities/seat-hold.entity.js';
import { TripEntity } from '../src/database/entities/trip.entity.js';
import { RouteEntity } from '../src/database/entities/route.entity.js';
import { VehicleEntity } from '../src/database/entities/vehicle.entity.js';
import { SeatEntity } from '../src/database/entities/seat.entity.js';
import { UserEntity } from '../src/database/entities/user.entity.js';
import { VoucherEntity } from '../src/database/entities/voucher.entity.js';

import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor.js';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../src/common/guards/roles.guard.js';
import {
  TripStatus,
  TicketStatus,
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
} from '../src/common/constants/status.constant.js';
import { Role } from '../src/common/constants/roles.constant.js';

describe('Payment Gateways (MoMo, VNPay, ZaloPay, Thẻ ngân hàng), IPN Webhooks, Auto Seat Release & Payment Logs Spec', () => {
  let app: INestApplication;

  // Mock Users
  const mockUserPassenger = {
    id: 'user-pass-uuid-101',
    email: 'passenger@ictu.edu.vn',
    fullName: 'Hoàng Văn Khách',
    phoneNumber: '0981234567',
    role: Role.PASSENGER,
  };

  const mockUserAdmin = {
    id: 'user-admin-uuid-999',
    email: 'admin@ictu.edu.vn',
    fullName: 'Quản Trị Viên Hệ Thống',
    phoneNumber: '0988888888',
    role: Role.ADMIN,
  };

  const createMockToken = (user: any) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ ...user, sub: user.id })).toString('base64url');
    return `Bearer ${header}.${payload}.mockSignature`;
  };

  const tokenPassenger = createMockToken(mockUserPassenger);
  const tokenAdmin = createMockToken(mockUserAdmin);

  // Mock Entities
  const mockTripId = 'trip-gateway-test-uuid';
  const mockVehicleId = 'vehicle-gw-test-uuid';
  const mockRouteId = 'route-gw-test-uuid';

  const mockRoute = {
    id: mockRouteId,
    routeCode: 'CT-01',
    name: 'Tuyến CT-01 Thái Nguyên - ICTU',
    origin: 'Bến xe Thái Nguyên',
    destination: 'Trường Đại học CNTT & TT',
  };

  const mockVehicle = {
    id: mockVehicleId,
    licensePlate: '20B-777.99',
    vehicleType: 'electric_bus',
    seatCapacity: 10,
  };

  const mockTrip = {
    id: mockTripId,
    routeId: mockRouteId,
    vehicleId: mockVehicleId,
    departureTime: new Date(Date.now() + 24 * 3600 * 1000),
    status: TripStatus.SCHEDULED,
    route: mockRoute,
    vehicle: mockVehicle,
  };

  const mockSeat1 = {
    id: 'seat-gw-1',
    vehicleId: mockVehicleId,
    seatNumber: '05A',
  };

  const mockSeat2 = {
    id: 'seat-gw-2',
    vehicleId: mockVehicleId,
    seatNumber: '05B',
  };

  // In-memory data
  const storedBookings: any[] = [];
  const storedPayments: any[] = [];
  const storedTickets: any[] = [];
  const storedHolds: any[] = [];
  const storedLogs: any[] = [];
  const sentEmails: any[] = [];

  beforeAll(async () => {
    // Populate Initial Booking for user
    const initBooking: any = {
      id: 'booking-gw-uuid-1',
      bookingCode: 'ICTU-BK-GW-001',
      userId: mockUserPassenger.id,
      tripId: mockTripId,
      totalAmount: 30000,
      discountAmount: 0,
      finalAmount: 30000,
      status: BookingStatus.PENDING,
      paymentMethod: PaymentMethod.VNPAY,
      createdAt: new Date(),
      user: mockUserPassenger,
      trip: mockTrip,
      tickets: [],
    };

    const initTicket: any = {
      id: 'ticket-gw-uuid-1',
      bookingId: initBooking.id,
      seatId: mockSeat1.id,
      ticketCode: 'TKT-GW-001',
      originalPrice: 30000,
      finalPrice: 30000,
      status: TicketStatus.RESERVED,
      qrData: 'ENCRYPTED_TICKET_QR_DATA_001',
      passengerName: 'Hoàng Văn Khách',
      passengerPhone: '0981234567',
      seat: mockSeat1,
      booking: initBooking,
    };

    initBooking.tickets = [initTicket];

    const initSeatHold: any = {
      id: 'hold-gw-uuid-1',
      tripId: mockTripId,
      seatId: mockSeat1.id,
      userId: mockUserPassenger.id,
      bookingId: initBooking.id,
      status: 'holding',
      heldAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };

    storedBookings.push(initBooking);
    storedTickets.push(initTicket);
    storedHolds.push(initSeatHold);

    // Mock Repositories
    const mockPaymentRepo = {
      create: (data: any) => ({
        id: `payment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date(),
        status: PaymentStatus.PENDING,
        ...data,
      }),
      save: (data: any) => {
        const existingIdx = storedPayments.findIndex((p) => p.id === data.id);
        if (existingIdx >= 0) {
          storedPayments[existingIdx] = { ...storedPayments[existingIdx], ...data };
          return Promise.resolve(storedPayments[existingIdx]);
        }
        storedPayments.push(data);
        return Promise.resolve(data);
      },
      findOne: (opts: any) => {
        let p: any = null;
        if (opts?.where?.id) {
          p = storedPayments.find((item) => item.id === opts.where.id);
        } else if (opts?.where?.transactionId) {
          p = storedPayments.find((item) => item.transactionId === opts.where.transactionId);
        }
        if (!p) return Promise.resolve(null);

        const res = { ...p };
        if (opts?.relations?.booking) {
          const b = storedBookings.find((item) => item.id === p.bookingId);
          if (b) {
            res.booking = {
              ...b,
              user: mockUserPassenger,
              trip: mockTrip,
              tickets: storedTickets.filter((t) => t.bookingId === b.id),
            };
          }
        }
        return Promise.resolve(res);
      },
      find: (opts: any) => {
        let list = [...storedPayments];
        if (opts?.where?.status) {
          list = list.filter((p) => p.status === opts.where.status);
        }
        if (opts?.where?.paymentMethod) {
          list = list.filter((p) => p.paymentMethod === opts.where.paymentMethod);
        }
        return Promise.resolve(list);
      },
    };

    const mockPaymentLogRepo = {
      create: (data: any) => ({
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date(),
        status: 'success',
        ...data,
      }),
      save: (data: any) => {
        storedLogs.push(data);
        return Promise.resolve(data);
      },
      find: (opts: any) => {
        let list = [...storedLogs];
        if (opts?.where?.paymentId) {
          list = list.filter((l) => l.paymentId === opts.where.paymentId);
        }
        return Promise.resolve(list);
      },
      createQueryBuilder: () => ({
        andWhere: function () { return this; },
        orderBy: function () { return this; },
        getMany: () => Promise.resolve(storedLogs),
      }),
    };

    const mockBookingRepo = {
      findOne: (opts: any) => {
        const b = storedBookings.find((item) => item.id === opts?.where?.id);
        if (!b) return Promise.resolve(null);
        return Promise.resolve({
          ...b,
          tickets: storedTickets.filter((t) => t.bookingId === b.id),
          payments: storedPayments.filter((p) => p.bookingId === b.id),
          user: mockUserPassenger,
          trip: mockTrip,
        });
      },
      save: (data: any) => {
        const idx = storedBookings.findIndex((b) => b.id === data.id);
        if (idx >= 0) {
          Object.assign(storedBookings[idx], data);
          return Promise.resolve(storedBookings[idx]);
        }
        storedBookings.push(data);
        return Promise.resolve(data);
      },
      update: (crit: any, data: any) => {
        const targetId = typeof crit === 'string' ? crit : crit.id;
        const b = storedBookings.find((item) => item.id === targetId);
        if (b) {
          Object.assign(b, data);
        }
        return Promise.resolve({ affected: 1 });
      },
    };

    const mockTicketRepo = {
      find: (opts: any) => {
        let list = [...storedTickets];
        if (opts?.where?.bookingId) {
          list = list.filter((t) => t.bookingId === opts.where.bookingId);
        }
        return Promise.resolve(list);
      },
      findOne: (opts: any) => {
        const t = storedTickets.find((item) => item.id === opts?.where?.id);
        if (!t) return Promise.resolve(null);
        const b = storedBookings.find((item) => item.id === t.bookingId);
        return Promise.resolve({
          ...t,
          booking: {
            ...b,
            payments: storedPayments.filter((p) => p.bookingId === t.bookingId),
          },
        });
      },
      save: (data: any) => {
        const idx = storedTickets.findIndex((t) => t.id === data.id);
        if (idx >= 0) {
          storedTickets[idx] = { ...storedTickets[idx], ...data };
          return Promise.resolve(storedTickets[idx]);
        }
        storedTickets.push(data);
        return Promise.resolve(data);
      },
      update: (crit: any, data: any) => {
        const tickets = storedTickets.filter((t) => t.bookingId === crit.bookingId);
        for (const t of tickets) {
          Object.assign(t, data);
        }
        return Promise.resolve({ affected: tickets.length });
      },
    };

    const mockSeatHoldRepo = {
      update: (crit: any, data: any) => {
        for (const h of storedHolds) {
          if (h.tripId === crit.tripId) {
            Object.assign(h, data);
          }
        }
        return Promise.resolve({ affected: 1 });
      },
      find: () => Promise.resolve(storedHolds),
    };

    const mockSeatLockService = {
      releaseSeats: (tripId: string, seatIds: string[], userId: string) => {
        for (const h of storedHolds) {
          if (h.tripId === tripId && seatIds.includes(h.seatId)) {
            h.status = 'released';
          }
        }
        return Promise.resolve();
      },
    };

    const mockNotificationService = {
      sendTicketConfirmationEmail: (params: any) => {
        sentEmails.push(params);
        return Promise.resolve({ success: true });
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(PaymentEntity),
          useValue: mockPaymentRepo,
        },
        {
          provide: getRepositoryToken(PaymentLogEntity),
          useValue: mockPaymentLogRepo,
        },
        {
          provide: getRepositoryToken(BookingEntity),
          useValue: mockBookingRepo,
        },
        {
          provide: getRepositoryToken(TicketEntity),
          useValue: mockTicketRepo,
        },
        {
          provide: getRepositoryToken(SeatHoldEntity),
          useValue: mockSeatHoldRepo,
        },
        {
          provide: SeatLockService,
          useValue: mockSeatLockService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          const auth = req.headers['authorization'];
          if (!auth || !auth.startsWith('Bearer ')) return false;
          try {
            const parts = auth.split(' ')[1].split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
            req.user = payload;
            return true;
          } catch {
            return false;
          }
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          const user = req.user;
          if (!user) return false;
          // Reconciliation route requires ADMIN or MANAGER
          const path = req.url || '';
          if (path.includes('reconciliation')) {
            return user.role === Role.ADMIN || user.role === Role.MANAGER;
          }
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalInterceptors(new TransformResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // --- TEST SUITE: 10 TEST CASES ---

  it('1. [VNPay Gateway] Khởi tạo thanh toán VNPay -> Trả về paymentUrl có chữ ký HMAC-SHA512, qrCode và qrDataUrl', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payment/create-url')
      .set('Authorization', tokenPassenger)
      .send({
        bookingId: 'booking-gw-uuid-1',
        paymentMethod: PaymentMethod.VNPAY,
        orderInfo: 'Thanh toan don dat ve VNPay',
      });

    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(data).toHaveProperty('paymentId');
    expect(data.paymentMethod).toBe(PaymentMethod.VNPAY);
    expect(data.amount).toBe(30000);
    expect(data.paymentUrl).toContain('sandbox.vnpayment.vn/paymentv2/vpcpay.html');
    expect(data.paymentUrl).toContain('vnp_SecureHash=');
    expect(data.paymentUrl).toContain('vnp_TmnCode=');
    expect(data.qrCode).toBe(data.paymentUrl);
    expect(data.qrDataUrl).toMatch(/^data:image\/png;base64,/);

    // Kiểm tra PaymentLog được ghi lại
    const createLogs = storedLogs.filter((l) => l.eventType === 'create_url' && l.gateway === PaymentMethod.VNPAY);
    expect(createLogs.length).toBeGreaterThan(0);
    expect(createLogs[0].status).toBe('success');
  });

  it('2. [MoMo Gateway] Khởi tạo thanh toán MoMo -> Trả về paymentUrl, mã QR MoMo và qrDataUrl', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payment/create-url')
      .set('Authorization', tokenPassenger)
      .send({
        bookingId: 'booking-gw-uuid-1',
        paymentMethod: PaymentMethod.MOMO,
        orderInfo: 'Thanh toan don dat ve MoMo',
      });

    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(data.paymentMethod).toBe(PaymentMethod.MOMO);
    expect(data.paymentUrl).toContain('test-payment.momo.vn/v2/gateway/pay');
    expect(data.paymentUrl).toContain('partnerCode=');
    expect(data.paymentUrl).toContain('signature=');
    expect(data.qrCode).toContain('2|99|');
    expect(data.qrDataUrl).toMatch(/^data:image\/png;base64,/);

    const momoLogs = storedLogs.filter((l) => l.eventType === 'create_url' && l.gateway === PaymentMethod.MOMO);
    expect(momoLogs.length).toBeGreaterThan(0);
  });

  it('3. [ZaloPay Gateway] Khởi tạo thanh toán ZaloPay -> Trả về link mở app ZaloPay và mac HMAC-SHA256', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payment/create-url')
      .set('Authorization', tokenPassenger)
      .send({
        bookingId: 'booking-gw-uuid-1',
        paymentMethod: PaymentMethod.ZALOPAY,
        orderInfo: 'Thanh toan don dat ve ZaloPay',
      });

    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(data.paymentMethod).toBe(PaymentMethod.ZALOPAY);
    expect(data.paymentUrl).toContain('gateway.zalopay.vn/openinapp');
    expect(data.paymentUrl).toContain('mac=');
    expect(data.qrCode).toContain('zalopay://pay?app_id=');
    expect(data.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('4. [Bank Card / Thẻ ngân hàng] Khởi tạo thanh toán thẻ ATM / Visa qua cổng liên kết với bankCode chuẩn', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payment/create-url')
      .set('Authorization', tokenPassenger)
      .send({
        bookingId: 'booking-gw-uuid-1',
        paymentMethod: PaymentMethod.BANK_CARD,
        bankCode: 'NCB',
        orderInfo: 'Thanh toan the ATM NCB',
      });

    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(data.paymentMethod).toBe(PaymentMethod.BANK_CARD);
    expect(data.paymentUrl).toContain('vnp_BankCode=NCB');
    expect(data.paymentUrl).toContain('vnp_SecureHash=');
    expect(data.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('5. [MoMo IPN Success] Webhook IPN MoMo thành công -> Xác thực HMAC-SHA256, đổi status PAID, giữ ghế booked và gửi email vé điện tử', async () => {
    // Tạo payment MoMo trước
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/payment/create-url')
      .set('Authorization', tokenPassenger)
      .send({
        bookingId: 'booking-gw-uuid-1',
        paymentMethod: PaymentMethod.MOMO,
      });

    const txnRef = createRes.body.data.txnRef;
    const amount = 30000;
    const secretKey = 'MOMOSECRETKEY2026BUS';
    const accessKey = 'MOMOACCESSKEY2026';
    const partnerCode = 'MOMOBUS2026';
    const orderInfo = 'Thanh toan don dat ve';
    const requestId = `${txnRef}-req`;
    const resultCode = 0;
    const transId = '1234567890';
    const orderType = 'momo_wallet';
    const payType = 'qr';
    const responseTime = Date.now();
    const extraData = '';
    const message = 'Successful.';

    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${txnRef}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
    const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

    const ipnRes = await request(app.getHttpServer())
      .post('/api/v1/payment/momo-ipn')
      .send({
        partnerCode,
        orderId: txnRef,
        requestId,
        amount,
        orderInfo,
        orderType,
        transId,
        resultCode,
        message,
        payType,
        responseTime,
        extraData,
        signature,
      });

    expect(ipnRes.status).toBe(201);
    expect(ipnRes.body.resultCode).toBe(0);
    expect(ipnRes.body.message).toBe('Success');

    // Kiểm tra trạng thái Booking, Ticket, SeatHold
    const booking = storedBookings.find((b) => b.id === 'booking-gw-uuid-1');
    expect(booking.status).toBe(BookingStatus.PAID);

    const ticket = storedTickets.find((t) => t.bookingId === 'booking-gw-uuid-1');
    expect(ticket.status).toBe(TicketStatus.PAID);

    const hold = storedHolds.find((h) => h.bookingId === 'booking-gw-uuid-1');
    expect(hold.status).toBe('booked');

    // Kiểm tra email thông báo vé điện tử đã được gửi kèm QR Code
    expect(sentEmails.length).toBeGreaterThan(0);
    const lastEmail = sentEmails[sentEmails.length - 1];
    expect(lastEmail.recipientEmail).toBe(mockUserPassenger.email);
    expect(lastEmail.bookingCode).toBe(booking.bookingCode);
    expect(lastEmail.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('6. [MoMo IPN Failure] Webhook IPN MoMo thất bại -> Xác thực signature, chuyển FAILED/CANCELLED và giải phóng ghế trống', async () => {
    // Chuẩn bị một booking mới chưa thanh toán
    const failedBooking: any = {
      id: 'booking-gw-uuid-fail',
      bookingCode: 'ICTU-BK-FAIL-001',
      userId: mockUserPassenger.id,
      tripId: mockTripId,
      totalAmount: 30000,
      finalAmount: 30000,
      status: BookingStatus.PENDING,
      paymentMethod: PaymentMethod.MOMO,
      createdAt: new Date(),
    };
    const failedTicket: any = {
      id: 'ticket-gw-uuid-fail',
      bookingId: failedBooking.id,
      seatId: mockSeat2.id,
      ticketCode: 'TKT-GW-FAIL-001',
      originalPrice: 30000,
      status: TicketStatus.RESERVED,
      seat: mockSeat2,
    };
    const failedHold: any = {
      id: 'hold-gw-uuid-fail',
      tripId: mockTripId,
      seatId: mockSeat2.id,
      userId: mockUserPassenger.id,
      bookingId: failedBooking.id,
      status: 'holding',
    };
    storedBookings.push(failedBooking);
    storedTickets.push(failedTicket);
    storedHolds.push(failedHold);

    // Khởi tạo payment
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/payment/create-url')
      .set('Authorization', tokenPassenger)
      .send({
        bookingId: failedBooking.id,
        paymentMethod: PaymentMethod.MOMO,
      });

    const txnRef = createRes.body.data.txnRef;
    const amount = 30000;
    const secretKey = 'MOMOSECRETKEY2026BUS';
    const accessKey = 'MOMOACCESSKEY2026';
    const partnerCode = 'MOMOBUS2026';
    const orderInfo = 'Thanh toan don dat ve';
    const requestId = `${txnRef}-fail`;
    const resultCode = 49; // Khách hủy giao dịch
    const transId = '9999999999';
    const orderType = 'momo_wallet';
    const payType = 'qr';
    const responseTime = Date.now();
    const extraData = '';
    const message = 'Giao dich bi huy boi nguoi dung';

    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${txnRef}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
    const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

    const ipnRes = await request(app.getHttpServer())
      .post('/api/v1/payment/momo-ipn')
      .send({
        partnerCode,
        orderId: txnRef,
        requestId,
        amount,
        orderInfo,
        orderType,
        transId,
        resultCode,
        message,
        payType,
        responseTime,
        extraData,
        signature,
      });

    expect(ipnRes.status).toBe(201);
    expect(ipnRes.body.resultCode).toBe(49);

    // Kiểm tra booking bị CANCELLED, vé CANCELLED, ghế được giải phóng
    expect(failedBooking.status).toBe(BookingStatus.CANCELLED);
    expect(failedTicket.status).toBe(TicketStatus.CANCELLED);
    expect(failedHold.status).toBe('released');

    // Kiểm tra PaymentLog ghi nhận event payment_failed
    const failLogs = storedLogs.filter((l) => l.eventType === 'payment_failed' && l.bookingId === failedBooking.id);
    expect(failLogs.length).toBeGreaterThan(0);
    expect(failLogs[0].status).toBe('failed');
  });

  it('7. [ZaloPay IPN Success] Webhook IPN ZaloPay thành công -> Xác thực MAC HMAC-SHA256, đổi status PAID', async () => {
    // Tạo booking mới cho ZaloPay
    const zaloBooking: any = {
      id: 'booking-gw-uuid-zalo',
      bookingCode: 'ICTU-BK-ZALO-001',
      userId: mockUserPassenger.id,
      tripId: mockTripId,
      totalAmount: 30000,
      finalAmount: 30000,
      status: BookingStatus.PENDING,
      paymentMethod: PaymentMethod.ZALOPAY,
      createdAt: new Date(),
    };
    const zaloTicket: any = {
      id: 'ticket-gw-uuid-zalo',
      bookingId: zaloBooking.id,
      seatId: mockSeat1.id,
      ticketCode: 'TKT-GW-ZALO-001',
      originalPrice: 30000,
      status: TicketStatus.RESERVED,
      seat: mockSeat1,
    };
    storedBookings.push(zaloBooking);
    storedTickets.push(zaloTicket);

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/payment/create-url')
      .set('Authorization', tokenPassenger)
      .send({
        bookingId: zaloBooking.id,
        paymentMethod: PaymentMethod.ZALOPAY,
      });

    const txnRef = createRes.body.data.txnRef;
    const key2 = 'ZALOPAYKEY1SECRET2026';

    const dataObj = {
      app_id: 2553,
      app_trans_id: `260928_${txnRef}`,
      app_time: Date.now(),
      app_user: 'ictu_passenger',
      amount: 30000,
      embed_data: '{}',
      item: '[]',
      zp_trans_id: 123456789,
      server_time: Date.now(),
      channel: 38,
      merchant_user_id: 'ictu_passenger',
    };

    const dataStr = JSON.stringify(dataObj);
    const mac = crypto.createHmac('sha256', key2).update(dataStr).digest('hex');

    const ipnRes = await request(app.getHttpServer())
      .post('/api/v1/payment/zalopay-ipn')
      .send({
        data: dataStr,
        mac,
      });

    expect(ipnRes.status).toBe(201);
    expect(ipnRes.body.return_code).toBe(1);
    expect(ipnRes.body.return_message).toBe('success');

    expect(zaloBooking.status).toBe(BookingStatus.PAID);
    expect(zaloTicket.status).toBe(TicketStatus.PAID);
  });

  it('8. [IPN Security / Checksum Verification] Từ chối Webhook có chữ ký không hợp lệ, không đổi trạng thái đơn hàng', async () => {
    const invalidSignatureRes = await request(app.getHttpServer())
      .post('/api/v1/payment/momo-ipn')
      .send({
        orderId: 'ICTU-BK-FAKE-001',
        amount: 50000,
        resultCode: 0,
        signature: 'invalid_malicious_signature_hash',
      });

    expect(invalidSignatureRes.status).toBe(201);
    expect(invalidSignatureRes.body.resultCode).toBe(97);
    expect(invalidSignatureRes.body.message).toBe('Invalid signature');

    // Tương tự với ZaloPay sai MAC
    const invalidZaloRes = await request(app.getHttpServer())
      .post('/api/v1/payment/zalopay-ipn')
      .send({
        data: JSON.stringify({ app_trans_id: 'fake_trans' }),
        mac: 'wrong_mac_hash',
      });

    expect(invalidZaloRes.status).toBe(201);
    expect(invalidZaloRes.body.return_code).toBe(-1);
    expect(invalidZaloRes.body.return_message).toBe('mac not equal');
  });

  it('9. [Payment Cancellation & Seat Release] Hành khách chủ động hủy thanh toán -> Hủy đơn và giải phóng ghế lập tức', async () => {
    // Tạo booking mới đang pending
    const cancelBooking: any = {
      id: 'booking-gw-uuid-cancel',
      bookingCode: 'ICTU-BK-CANCEL-001',
      userId: mockUserPassenger.id,
      tripId: mockTripId,
      totalAmount: 30000,
      finalAmount: 30000,
      status: BookingStatus.PENDING,
      paymentMethod: PaymentMethod.VNPAY,
      createdAt: new Date(),
    };
    const cancelTicket: any = {
      id: 'ticket-gw-uuid-cancel',
      bookingId: cancelBooking.id,
      seatId: mockSeat1.id,
      ticketCode: 'TKT-GW-CANCEL-001',
      originalPrice: 30000,
      status: TicketStatus.RESERVED,
      seat: mockSeat1,
    };
    const cancelHold: any = {
      id: 'hold-gw-uuid-cancel',
      tripId: mockTripId,
      seatId: mockSeat1.id,
      userId: mockUserPassenger.id,
      bookingId: cancelBooking.id,
      status: 'holding',
    };
    storedBookings.push(cancelBooking);
    storedTickets.push(cancelTicket);
    storedHolds.push(cancelHold);

    const cancelRes = await request(app.getHttpServer())
      .post(`/api/v1/payment/cancel/${cancelBooking.id}`)
      .set('Authorization', tokenPassenger)
      .send();

    expect(cancelRes.status).toBe(201);
    expect(cancelRes.body.success).toBe(true);
    expect(cancelRes.body.message).toContain('Đã hủy thanh toán và giải phóng ghế thành công');

    expect(cancelBooking.status).toBe(BookingStatus.CANCELLED);
    expect(cancelTicket.status).toBe(TicketStatus.CANCELLED);
    expect(cancelHold.status).toBe('released');
  });

  it('10. [Payment Logs & Đối soát giao dịch] Tra cứu nhật ký đối soát chi tiết và báo cáo tổng hợp doanh thu/số lượng', async () => {
    // 1. Tra cứu logs theo paymentId
    const samplePayment = storedPayments[0];
    expect(samplePayment).toBeDefined();

    const logsRes = await request(app.getHttpServer())
      .get(`/api/v1/payment/logs/${samplePayment.id}`)
      .set('Authorization', tokenPassenger);

    expect(logsRes.status).toBe(200);
    const logs = logsRes.body.data;
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]).toHaveProperty('eventType');
    expect(logs[0]).toHaveProperty('gateway');

    // 2. Tra cứu báo cáo đối soát (Reconciliation) bởi Quản trị viên (Role: ADMIN)
    const reconRes = await request(app.getHttpServer())
      .get('/api/v1/payment/reconciliation?gateway=vnpay')
      .set('Authorization', tokenAdmin);

    expect(reconRes.status).toBe(200);
    const reconData = reconRes.body.data;
    expect(reconData).toHaveProperty('totalLogs');
    expect(reconData).toHaveProperty('totalSuccessfulPayments');
    expect(reconData).toHaveProperty('totalRevenue');
    expect(Array.isArray(reconData.logs)).toBe(true);
  });
});
