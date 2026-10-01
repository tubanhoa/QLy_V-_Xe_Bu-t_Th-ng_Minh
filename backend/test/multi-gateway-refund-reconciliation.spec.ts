import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
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
import { GatewayRefundService } from '../src/modules/payment/services/gateway-refund.service.js';
import { BookingController } from '../src/modules/booking/booking.controller.js';
import { BookingService } from '../src/modules/booking/booking.service.js';
import { SeatLockService } from '../src/modules/booking/seat-lock.service.js';
import { NotificationService } from '../src/modules/notification/notification.service.js';

import { PaymentEntity } from '../src/database/entities/payment.entity.js';
import { PaymentLogEntity } from '../src/database/entities/payment-log.entity.js';
import { RefundLogEntity } from '../src/database/entities/refund-log.entity.js';
import { BookingEntity } from '../src/database/entities/booking.entity.js';
import { TicketEntity } from '../src/database/entities/ticket.entity.js';
import { TripEntity } from '../src/database/entities/trip.entity.js';
import { RouteEntity } from '../src/database/entities/route.entity.js';
import { VehicleEntity } from '../src/database/entities/vehicle.entity.js';
import { SeatEntity } from '../src/database/entities/seat.entity.js';
import { VoucherEntity } from '../src/database/entities/voucher.entity.js';
import { UserEntity } from '../src/database/entities/user.entity.js';
import { SeatHoldEntity } from '../src/database/entities/seat-hold.entity.js';

import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../src/common/guards/roles.guard.js';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor.js';
import {
  PaymentStatus,
  BookingStatus,
  TicketStatus,
  TripStatus,
  PaymentMethod,
} from '../src/common/constants/status.constant.js';
import { Role } from '../src/common/constants/roles.constant.js';

describe('Multi-Gateway Refund & Reconciliation System (MoMo, VNPay, ZaloPay, Bank)', () => {
  let app: INestApplication;
  let gatewayRefundService: GatewayRefundService;
  let paymentService: PaymentService;
  let notificationService: NotificationService;

  // In-memory mock storage
  let storedPayments: any[] = [];
  let storedRefundLogs: any[] = [];
  let storedPaymentLogs: any[] = [];
  let storedBookings: any[] = [];
  let storedTickets: any[] = [];
  let storedHolds: any[] = [];
  let sentNotifications: any[] = [];

  const mockUserPassenger = {
    id: 'user-passenger-001',
    fullName: 'Nguyễn Văn Hoàn',
    email: 'passenger.refund@ictu.edu.vn',
    phoneNumber: '0987654321',
    role: Role.PASSENGER,
  };

  const mockAdminUser = {
    id: 'user-admin-001',
    fullName: 'Admin Kế Toán',
    email: 'admin.ketoan@ictu.edu.vn',
    role: Role.ADMIN,
  };

  let simulatedCurrentUser: any = mockUserPassenger;

  const mockRoute = {
    id: 'route-hanoi-thainguyen',
    name: 'Hà Nội - Thái Nguyên (ICTU Transit)',
    origin: 'Bến xe Mỹ Đình',
    destination: 'Trường Đại học CNTT & TT Thái Nguyên',
  };

  const nowMs = Date.now();
  const mockTripFar = {
    id: 'trip-far-28h',
    departureTime: new Date(nowMs + 28 * 60 * 60 * 1000), // > 24h
    status: TripStatus.SCHEDULED,
    route: mockRoute,
  };

  const mockTripMid = {
    id: 'trip-mid-15h',
    departureTime: new Date(nowMs + 15 * 60 * 60 * 1000), // 12h - 24h
    status: TripStatus.SCHEDULED,
    route: mockRoute,
  };

  const mockTripCancelled = {
    id: 'trip-cancelled-due-weather',
    departureTime: new Date(nowMs + 5 * 60 * 60 * 1000),
    status: TripStatus.CANCELLED,
    route: mockRoute,
  };

  const mockSeatA1 = {
    id: 'seat-uuid-a1',
    seatNumber: 'A1',
  };

  const resolveTrip = (tripId?: string) => {
    if (tripId === mockTripMid.id) return mockTripMid;
    if (tripId === mockTripCancelled.id) return mockTripCancelled;
    return mockTripFar;
  };

  let originalFetch: typeof global.fetch;

  beforeAll(async () => {
    originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('vnpayment') || urlStr.includes('vnpay')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              vnp_ResponseCode: '00',
              vnp_Message: 'Giao dich thanh cong',
              vnp_ResponseId: 'VNP_TEST_MOCK_TXN_001',
              vnp_TransactionNo: '99887766',
            }),
        });
      }
      if (urlStr.includes('momo')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              resultCode: 0,
              message: 'Hoan tien MoMo thanh cong',
              transId: 987654321,
            }),
        });
      }
      if (urlStr.includes('zalopay')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              returncode: 1,
              returnmessage: 'Hoan tien ZaloPay thanh cong',
              mrefundid: 'ZLP_TEST_MOCK_REF_001',
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });
    }) as any;

    const mockPaymentRepo = {
      create: (data: any) => ({
        id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date(),
        status: PaymentStatus.PENDING,
        ...data,
      }),
      save: (data: any) => {
        const idx = storedPayments.findIndex((p) => p.id === data.id);
        if (idx >= 0) {
          Object.assign(storedPayments[idx], data);
          return Promise.resolve(storedPayments[idx]);
        }
        storedPayments.push(data);
        return Promise.resolve(data);
      },
      findOne: (opts: any) => {
        let p = null;
        if (opts?.where?.id) {
          p = storedPayments.find((item) => item.id === opts.where.id);
        } else if (opts?.where?.transactionId) {
          p = storedPayments.find((item) => item.transactionId === opts.where.transactionId);
        } else if (opts?.where?.bookingId) {
          p = storedPayments.find((item) => item.bookingId === opts.where.bookingId);
        }
        if (!p) return Promise.resolve(null);

        if (opts?.relations?.booking) {
          const b = storedBookings.find((item) => item.id === p.bookingId);
          if (b) {
            p.booking = {
              ...b,
              user: mockUserPassenger,
              trip: resolveTrip(b.tripId),
              payments: storedPayments.filter((item) => item.bookingId === b.id),
            };
          }
        }
        return Promise.resolve(p);
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

    const mockRefundLogRepo = {
      create: (data: any) => ({
        id: `reflog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date(),
        ...data,
      }),
      save: (data: any) => {
        const idx = storedRefundLogs.findIndex((r) => r.id === data.id);
        if (idx >= 0) {
          storedRefundLogs[idx] = { ...storedRefundLogs[idx], ...data };
          return Promise.resolve(storedRefundLogs[idx]);
        }
        storedRefundLogs.push(data);
        return Promise.resolve(data);
      },
      findOne: (opts: any) => {
        const log = storedRefundLogs.find((r) => r.id === opts?.where?.id);
        if (!log) return Promise.resolve(null);
        return Promise.resolve({
          ...log,
          payment: storedPayments.find((p) => p.id === log.paymentId),
          booking: storedBookings.find((b) => b.id === log.bookingId),
          ticket: storedTickets.find((t) => t.id === log.ticketId),
        });
      },
      createQueryBuilder: () => {
        let list = [...storedRefundLogs];
        return {
          leftJoinAndSelect: function () {
            return this;
          },
          andWhere: function (clause: string, params: any) {
            if (params?.gateway) {
              list = list.filter((r) => r.gateway === params.gateway);
            }
            if (params?.status) {
              list = list.filter((r) => r.status === params.status);
            }
            if (params?.ticketCode) {
              list = list.filter((r) => r.ticketCode?.includes(params.ticketCode));
            }
            return this;
          },
          orderBy: function () {
            return this;
          },
          skip: function (s: number) {
            list = list.slice(s);
            return this;
          },
          take: function (t: number) {
            list = list.slice(0, t);
            return this;
          },
          getManyAndCount: () => Promise.resolve([list, storedRefundLogs.length]),
          select: function () {
            return this;
          },
          addSelect: function () {
            return this;
          },
          getRawOne: () => {
            const totalRefunded = storedRefundLogs.reduce(
              (sum, r) => sum + Number(r.refundAmount || 0),
              0,
            );
            const totalFee = storedRefundLogs.reduce((sum, r) => sum + Number(r.feeAmount || 0), 0);
            return Promise.resolve({ totalRefunded, totalFee });
          },
        };
      },
    };

    const mockPaymentLogRepo = {
      create: (data: any) => ({
        id: `plog-${Date.now()}`,
        createdAt: new Date(),
        status: 'success',
        ...data,
      }),
      save: (data: any) => {
        storedPaymentLogs.push(data);
        return Promise.resolve(data);
      },
      find: () => Promise.resolve(storedPaymentLogs),
      createQueryBuilder: () => ({
        andWhere: function () {
          return this;
        },
        orderBy: function () {
          return this;
        },
        getMany: () => Promise.resolve(storedPaymentLogs),
      }),
    };

    const mockTicketRepo = {
      save: (data: any) => {
        const idx = storedTickets.findIndex((t) => t.id === data.id);
        if (idx >= 0) {
          storedTickets[idx] = { ...storedTickets[idx], ...data };
          return Promise.resolve(storedTickets[idx]);
        }
        storedTickets.push(data);
        return Promise.resolve(data);
      },
      findOne: (opts: any) => {
        let t = null;
        if (opts?.where?.id) {
          t = storedTickets.find((item) => item.id === opts.where.id);
        } else if (opts?.where?.ticketCode) {
          t = storedTickets.find((item) => item.ticketCode === opts.where.ticketCode);
        }
        if (!t) return Promise.resolve(null);

        const res = { ...t };
        if (opts?.relations?.booking) {
          const b = storedBookings.find((item) => item.id === t.bookingId);
          if (b) {
            res.booking = {
              ...b,
              user: mockUserPassenger,
              trip: resolveTrip(b.tripId),
              payments: storedPayments.filter((p) => p.bookingId === b.id),
            };
          }
        }
        if (opts?.relations?.seat) {
          res.seat = mockSeatA1;
        }
        return Promise.resolve(res);
      },
      find: (opts: any) => {
        let list = [...storedTickets];
        if (opts?.where?.bookingId) {
          list = list.filter((t) => t.bookingId === opts.where.bookingId);
        }
        return Promise.resolve(list);
      },
      update: (crit: any, data: any) => {
        for (const t of storedTickets) {
          if (crit.bookingId && t.bookingId === crit.bookingId) {
            Object.assign(t, data);
          }
        }
        return Promise.resolve({ affected: 1 });
      },
      count: () => Promise.resolve(0),
    };

    const mockBookingRepo = {
      findOne: (opts: any) => {
        const b = storedBookings.find((item) => item.id === opts?.where?.id);
        if (!b) return Promise.resolve(null);
        return Promise.resolve({
          ...b,
          user: mockUserPassenger,
          trip: resolveTrip(b.tripId),
          tickets: storedTickets.filter((t) => t.bookingId === b.id),
          payments: storedPayments.filter((p) => p.bookingId === b.id),
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
        if (b) Object.assign(b, data);
        return Promise.resolve({ affected: 1 });
      },
    };

    const mockSeatHoldRepo = {
      update: () => Promise.resolve({ affected: 1 }),
      find: () => Promise.resolve(storedHolds),
    };

    const mockSeatLockService = {
      releaseSeats: () => Promise.resolve(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController, BookingController],
      providers: [
        PaymentService,
        GatewayRefundService,
        BookingService,
        NotificationService,
        { provide: SeatLockService, useValue: mockSeatLockService },
        { provide: getRepositoryToken(PaymentEntity), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(PaymentLogEntity), useValue: mockPaymentLogRepo },
        { provide: getRepositoryToken(RefundLogEntity), useValue: mockRefundLogRepo },
        { provide: getRepositoryToken(TicketEntity), useValue: mockTicketRepo },
        { provide: getRepositoryToken(BookingEntity), useValue: mockBookingRepo },
        { provide: getRepositoryToken(SeatHoldEntity), useValue: mockSeatHoldRepo },
        { provide: getRepositoryToken(TripEntity), useValue: {} },
        { provide: getRepositoryToken(RouteEntity), useValue: {} },
        { provide: getRepositoryToken(VehicleEntity), useValue: {} },
        { provide: getRepositoryToken(SeatEntity), useValue: {} },
        { provide: getRepositoryToken(VoucherEntity), useValue: {} },
        { provide: getRepositoryToken(UserEntity), useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = simulatedCurrentUser;
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.setGlobalPrefix('api');
    app.useGlobalInterceptors(new TransformResponseInterceptor());
    await app.init();

    gatewayRefundService = moduleFixture.get<GatewayRefundService>(GatewayRefundService);
    paymentService = moduleFixture.get<PaymentService>(PaymentService);
    notificationService = moduleFixture.get<NotificationService>(NotificationService);
  });

  afterAll(async () => {
    if (originalFetch) {
      global.fetch = originalFetch;
    }
    if (app) await app.close();
  });

  beforeEach(() => {
    simulatedCurrentUser = mockUserPassenger;
    storedPayments = [];
    storedRefundLogs = [];
    storedPaymentLogs = [];
    storedBookings = [];
    storedTickets = [];
    storedHolds = [];
    sentNotifications = [];
  });

  // =========================================================================
  // HẠNG MỤC 1: GATEWAY REFUND CLIENTS (VNPay, MoMo, ZaloPay, Bank Transfer)
  // =========================================================================
  describe('HẠNG MỤC 1: Xây dựng Gateway Refund Client (MoMo, VNPay, ZaloPay, Bank)', () => {
    it('1.1. VNPay Refund Client: sinh payload chuẩn, SHA512 hash, đúng transactionType (02 một phần / 03 toàn phần)', async () => {
      const mockTicket: any = { ticketCode: 'TKT-VNPAY-001', originalPrice: 100000 };
      const mockBooking: any = { bookingCode: 'BK-VNPAY-001' };
      const mockPayment: any = {
        transactionId: 'VNPAY-TXN-123456',
        paymentMethod: PaymentMethod.VNPAY,
        paymentDetails: { vnp_TransactionNo: '98765432' },
        createdAt: new Date(),
      };

      // Hoàn toàn phần (100% -> '03')
      const resultFull = await gatewayRefundService.refundVNPay({
        ticket: mockTicket,
        booking: mockBooking,
        payment: mockPayment,
        refundAmount: 100000,
        originalAmount: 100000,
        reason: 'Hủy vé trước 24h hoàn 100%',
      });

      expect(resultFull.rawRequest).toBeDefined();
      expect(resultFull.rawRequest.vnp_Command).toBe('refund');
      expect(resultFull.rawRequest.vnp_TransactionType).toBe('03');
      expect(resultFull.rawRequest.vnp_Amount).toBe(100000 * 100);
      expect(resultFull.rawRequest.vnp_OrderInfo).toContain('TKT-VNPAY-001');
      expect(resultFull.rawRequest.vnp_SecureHash).toBeDefined();
      expect(resultFull.rawRequest.vnp_SecureHash.length).toBe(128); // SHA-512 hex 128 chars

      // Hoàn một phần (90% -> '02')
      const resultPartial = await gatewayRefundService.refundVNPay({
        ticket: mockTicket,
        booking: mockBooking,
        payment: mockPayment,
        refundAmount: 90000,
        originalAmount: 100000,
        reason: 'Hủy vé trước 15h hoàn 90%',
      });

      expect(resultPartial.rawRequest.vnp_TransactionType).toBe('02');
      expect(resultPartial.rawRequest.vnp_Amount).toBe(90000 * 100);
    });

    it('1.2. MoMo Refund Client: sinh payload chuẩn, HMAC-SHA256 signature, transId gốc và orderId', async () => {
      const mockTicket: any = { ticketCode: 'TKT-MOMO-001', originalPrice: 80000 };
      const mockBooking: any = { bookingCode: 'BK-MOMO-001' };
      const mockPayment: any = {
        transactionId: 'MOMO-ORDER-999',
        paymentMethod: PaymentMethod.MOMO,
        paymentDetails: { transId: 2345678901 },
      };

      const result = await gatewayRefundService.refundMoMo({
        ticket: mockTicket,
        booking: mockBooking,
        payment: mockPayment,
        refundAmount: 80000,
        originalAmount: 80000,
        reason: 'Hoàn tiền MoMo',
      });

      expect(result.rawRequest).toBeDefined();
      expect(result.rawRequest.partnerCode).toBeDefined();
      expect(result.rawRequest.orderId).toContain('REFUND_');
      expect(result.rawRequest.amount).toBe(80000);
      expect(result.rawRequest.transId).toBe(2345678901);
      expect(result.rawRequest.signature).toBeDefined();
      expect(result.rawRequest.signature.length).toBe(64); // SHA-256 hex 64 chars
    });

    it('1.3. ZaloPay Refund Client: sinh m_refund_id, zp_trans_id, amount và mac HMAC-SHA256', async () => {
      const mockTicket: any = { ticketCode: 'TKT-ZALO-001', originalPrice: 50000 };
      const mockBooking: any = { bookingCode: 'BK-ZALO-001' };
      const mockPayment: any = {
        transactionId: 'ZALO-TXN-111',
        paymentMethod: PaymentMethod.ZALOPAY,
        paymentDetails: { zp_trans_id: '99887766' },
      };

      const result = await gatewayRefundService.refundZaloPay({
        ticket: mockTicket,
        booking: mockBooking,
        payment: mockPayment,
        refundAmount: 50000,
        originalAmount: 50000,
      });

      expect(result.rawRequest).toBeDefined();
      expect(result.rawRequest.app_id).toBeDefined();
      expect(result.rawRequest.zp_trans_id).toBe('99887766');
      expect(result.rawRequest.amount).toBe(50000);
      expect(result.rawRequest.mac).toBeDefined();
      expect(result.rawRequest.mac.length).toBe(64);
    });

    it('1.4. Bank Transfer Fallback: chuyển sang REFUND_PENDING, sinh mã tham chiếu chuyển khoản ngân hàng', async () => {
      const mockTicket: any = { ticketCode: 'TKT-BANK-001', originalPrice: 60000 };
      const mockBooking: any = { bookingCode: 'BK-BANK-001' };
      const mockPayment: any = {
        id: 'pay-bank-01',
        paymentMethod: PaymentMethod.BANK_CARD,
        amount: 60000,
        paymentDetails: { bankCode: 'NCB' },
      };

      const result = await gatewayRefundService.refundBankTransferFallback({
        ticket: mockTicket,
        booking: mockBooking,
        payment: mockPayment,
        refundAmount: 60000,
        originalAmount: 60000,
      });

      expect(result.status).toBe('PENDING');
      expect(result.paymentStatus).toBe(PaymentStatus.REFUND_PENDING);
      expect(result.refundTransactionId).toContain('REFUND_BANK_');
      expect(result.rawResponse.action).toBe('AWAITING_ACCOUNTANT_RECONCILIATION');
    });
  });

  // =========================================================================
  // HẠNG MỤC 2: LOGIC TÍNH PHÍ VÀ KÍCH HOẠT HOÀN TIỀN (DUAL TRIGGER LOGIC)
  // =========================================================================
  describe('HẠNG MỤC 2: Dual Trigger Logic (Kịch bản A: Hủy vé chủ động & Kịch bản B: Timeout)', () => {
    it('2.1. [Kịch bản A: Trước 24h] Hủy vé trước >= 24h -> Phí hủy 0%, Hoàn tiền 100%, ghi vết refund_logs', async () => {
      const booking: any = {
        id: 'bk-kban-a-24h',
        bookingCode: 'ICTU-BK-A24H',
        userId: mockUserPassenger.id,
        tripId: mockTripFar.id,
        status: BookingStatus.PAID,
        finalAmount: 100000,
      };
      const ticket: any = {
        id: 'tkt-kban-a-24h',
        ticketCode: 'ICTU-TK-A24H',
        bookingId: booking.id,
        seatId: mockSeatA1.id,
        originalPrice: 100000,
        status: TicketStatus.PAID,
      };
      const payment: any = {
        id: 'pay-kban-a-24h',
        bookingId: booking.id,
        paymentMethod: PaymentMethod.VNPAY,
        amount: 100000,
        status: PaymentStatus.SUCCESS,
        transactionId: 'VNP-24H-001',
        paymentDetails: { vnp_TransactionNo: '11223344' },
      };

      storedBookings.push(booking);
      storedTickets.push(ticket);
      storedPayments.push(payment);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/payment/refund/${ticket.id}`)
        .send({ reason: 'Hành khách chủ động hủy vé trước 24h' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe(TicketStatus.REFUNDED);
      expect(res.body.cancellationFeePercent).toBe(0);
      expect(res.body.cancellationFee).toBe(0);
      expect(res.body.refundAmount).toBe(100000);

      // Kiểm tra lưu vết đối soát trong refund_logs
      expect(storedRefundLogs.length).toBe(1);
      const log = storedRefundLogs[0];
      expect(log.gateway).toBe(PaymentMethod.VNPAY);
      expect(log.status).toBe('SUCCESS');
      expect(Number(log.refundAmount)).toBe(100000);
      expect(Number(log.feeAmount)).toBe(0);
      expect(log.refundTransactionId).toBeDefined();
    });

    it('2.2. [Kịch bản A: 12h - 24h] Hủy vé trong 12h - 24h -> Phí hủy 10%, Hoàn tiền 90%', async () => {
      const booking: any = {
        id: 'bk-kban-a-15h',
        bookingCode: 'ICTU-BK-A15H',
        userId: mockUserPassenger.id,
        tripId: mockTripMid.id,
        status: BookingStatus.PAID,
        finalAmount: 100000,
      };
      const ticket: any = {
        id: 'tkt-kban-a-15h',
        ticketCode: 'ICTU-TK-A15H',
        bookingId: booking.id,
        seatId: mockSeatA1.id,
        originalPrice: 100000,
        status: TicketStatus.PAID,
      };
      const payment: any = {
        id: 'pay-kban-a-15h',
        bookingId: booking.id,
        paymentMethod: PaymentMethod.MOMO,
        amount: 100000,
        status: PaymentStatus.SUCCESS,
        transactionId: 'MOMO-15H-001',
      };

      storedBookings.push(booking);
      storedTickets.push(ticket);
      storedPayments.push(payment);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/payment/refund/${ticket.id}`)
        .send({ reason: 'Hủy vé trước 15 tiếng' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.cancellationFeePercent).toBe(10);
      expect(res.body.cancellationFee).toBe(10000);
      expect(res.body.refundAmount).toBe(90000);

      // Kiểm tra refund_logs lưu rõ số tiền chênh lệch
      const log = storedRefundLogs[0];
      expect(log.gateway).toBe(PaymentMethod.MOMO);
      expect(Number(log.originalAmount)).toBe(100000);
      expect(Number(log.feeAmount)).toBe(10000);
      expect(Number(log.refundAmount)).toBe(90000);
    });

    it('2.3. [Kịch bản B: Auto-Refund] Webhook báo thành công nhưng chuyến xe đã bị hủy đột xuất -> Tự động hoàn tiền 100%', async () => {
      const booking: any = {
        id: 'bk-auto-refund-timeout',
        bookingCode: 'ICTU-BK-TIMEOUT',
        userId: mockUserPassenger.id,
        tripId: mockTripCancelled.id, // Chuyến xe bị CANCELLED
        status: BookingStatus.CANCELLED,
        finalAmount: 50000,
        trip: mockTripCancelled,
      };
      const ticket: any = {
        id: 'tkt-auto-refund-timeout',
        ticketCode: 'ICTU-TK-TIMEOUT',
        bookingId: booking.id,
        seatId: mockSeatA1.id,
        originalPrice: 50000,
        status: TicketStatus.CANCELLED,
      };
      const payment: any = {
        id: 'pay-auto-refund-timeout',
        bookingId: booking.id,
        transactionId: 'TXN-TIMEOUT-999',
        paymentMethod: PaymentMethod.VNPAY,
        amount: 50000,
        status: PaymentStatus.PENDING,
      };

      storedBookings.push(booking);
      storedTickets.push(ticket);
      storedPayments.push(payment);

      // Gọi confirmPayment giả lập IPN Webhook gửi đến sau khi chuyến xe bị hủy
      await paymentService.confirmPayment('TXN-TIMEOUT-999', {
        vnp_ResponseCode: '00',
        vnp_TransactionNo: '99887766',
      });

      // Kiểm tra trạng thái giao dịch đã chuyển sang hoàn tiền
      expect(payment.refundAmount).toBe(50000);
      expect(payment.refundReason).toBe('Tự động hoàn tiền do đơn vé timeout / sự cố chuyến xe');

      // Kiểm tra bản ghi refund_logs được tự động sinh
      expect(storedRefundLogs.length).toBe(1);
      const log = storedRefundLogs[0];
      expect(Number(log.refundAmount)).toBe(50000);
      expect(log.reason).toBe('Tự động hoàn tiền do đơn vé timeout / sự cố chuyến xe');
    });
  });

  // =========================================================================
  // HẠNG MỤC 3 & 5: ĐỐI SOÁT TÀI CHÍNH & API CONTROLLER
  // =========================================================================
  describe('HẠNG MỤC 3 & 5: Entity lưu vết đối soát và danh mục API Controller', () => {
    beforeEach(() => {
      simulatedCurrentUser = mockAdminUser;
      // Tạo sẵn 3 bản ghi refund_logs mẫu
      storedRefundLogs = [
        {
          id: 'ref-log-001',
          paymentId: 'pay-001',
          bookingId: 'bk-001',
          ticketId: 'tkt-001',
          gateway: 'vnpay',
          refundTransactionId: 'VNP_REF_001',
          originalAmount: 100000,
          refundAmount: 100000,
          feeAmount: 0,
          reason: 'Hủy vé trước 24h',
          status: 'SUCCESS',
          rawRequest: { command: 'refund' },
          rawResponse: { vnp_ResponseCode: '00' },
          createdAt: new Date(),
        },
        {
          id: 'ref-log-002',
          paymentId: 'pay-002',
          bookingId: 'bk-002',
          ticketId: 'tkt-002',
          gateway: 'momo',
          refundTransactionId: 'MOMO_REF_002',
          originalAmount: 50000,
          refundAmount: 45000,
          feeAmount: 5000,
          reason: 'Hủy vé 12-24h',
          status: 'SUCCESS',
          rawRequest: { requestType: 'refund' },
          rawResponse: { resultCode: 0 },
          createdAt: new Date(),
        },
        {
          id: 'ref-log-003',
          paymentId: 'pay-003',
          bookingId: 'bk-003',
          ticketId: 'tkt-003',
          gateway: 'bank_transfer',
          refundTransactionId: 'REFUND_BANK_003',
          originalAmount: 70000,
          refundAmount: 70000,
          feeAmount: 0,
          reason: 'Chuyển khoản thủ công',
          status: 'PENDING',
          rawRequest: { mode: 'manual' },
          rawResponse: { action: 'AWAITING_ACCOUNTANT_RECONCILIATION' },
          createdAt: new Date(),
        },
      ];
    });

    it('3.1. [GET /api/v1/payment/refund-logs] Báo cáo đối soát tổng hợp và danh sách giao dịch hoàn tiền', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/payment/refund-logs')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.data.length).toBe(3);
      expect(data.total).toBe(3);
      expect(data.totalRefundedAmount).toBe(215000); // 100k + 45k + 70k
      expect(data.totalFeeAmount).toBe(5000);
    });

    it('3.2. [GET /api/v1/payment/refunds] Hỗ trợ alias endpoint GET /refunds theo yêu cầu nghiệp vụ', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/payment/refunds')
        .query({ gateway: 'vnpay' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.data[0].gateway).toBe('vnpay');
    });

    it('3.3. [GET /api/v1/payment/refunds/:id] Xem chi tiết biên bản hoàn tiền và payload đối chiếu', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/payment/refunds/ref-log-001')
        .expect(200);

      expect(res.body.success).toBe(true);
      const detail = res.body.data;
      expect(detail.id).toBe('ref-log-001');
      expect(detail.refundTransactionId).toBe('VNP_REF_001');
      expect(detail.rawRequest).toBeDefined();
      expect(detail.rawResponse).toBeDefined();
    });
  });

  // =========================================================================
  // HẠNG MỤC 4: EMAIL XÁC NHẬN HOÀN TIỀN
  // =========================================================================
  describe('HẠNG MỤC 4: Gửi Thông Báo / Email Xác Nhận Hoàn Tiền', () => {
    it('4.1. sendRefundConfirmationEmail: nội dung chuẩn HTML, số tiền hoàn định dạng màu #005A36, thông tin cổng nhận', async () => {
      const result = await notificationService.sendRefundConfirmationEmail({
        recipientEmail: 'passenger.test@ictu.edu.vn',
        passengerName: 'Trần Văn Khách',
        ticketCode: 'ICTU-TK-EMAIL-01',
        bookingCode: 'ICTU-BK-EMAIL-01',
        routeName: 'Tuyến CT-01 Bến Xe - ICTU',
        seatNumber: 'A2',
        originalPrice: 100000,
        cancellationFeePercent: 10,
        feeAmount: 10000,
        refundAmount: 90000,
        gateway: 'vnpay',
        refundTransactionId: 'VNP_TEST_9988',
      });

      expect(result).toBe(true);

      // Chờ background non-blocking task queue (setImmediate) xử lý xong
      await new Promise((resolve) => setTimeout(resolve, 60));

      const sentList = notificationService.getSentNotifications({
        ticketCode: 'ICTU-TK-EMAIL-01',
      });
      expect(sentList.length).toBe(1);

      const sent = sentList[0];
      expect(sent.subject).toContain('[ICTU Transit] Xác nhận hoàn tiền vé xe buýt điện tử');
      expect(sent.subject).toContain('ICTU-TK-EMAIL-01');

      // Kiểm tra HTML có đủ các tiêu chí yêu cầu
      expect(sent.htmlPreview).toContain('Tuyến CT-01 Bến Xe - ICTU');
      expect(sent.htmlPreview).toContain('100.000 VNĐ'); // Giá gốc
      expect(sent.htmlPreview).toContain('10% (10.000 VNĐ)'); // Phí hủy
      expect(sent.htmlPreview).toContain('color:#005A36; font-size:18px; font-weight:bold;'); // Highlight tiền hoàn
      expect(sent.htmlPreview).toContain('90.000 VNĐ'); // Số tiền thực hoàn
      expect(sent.htmlPreview).toContain('Cổng thanh toán VNPay'); // Cổng nhận
      expect(sent.htmlPreview).toContain('Thời gian tiền về tài khoản'); // Thời gian tiền về
    });
  });
});
