import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as crypto from 'node:crypto';
import { PaymentEntity } from '../../database/entities/payment.entity.js';
import { PaymentLogEntity } from '../../database/entities/payment-log.entity.js';
import { BookingEntity } from '../../database/entities/booking.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { SeatHoldEntity } from '../../database/entities/seat-hold.entity.js';
import { SeatLockService } from '../booking/seat-lock.service.js';
import { NotificationService } from '../notification/notification.service.js';
import { InvoiceService } from '../invoice/invoice.service.js';
import { generateQrDataUrl } from '../../common/utils/qr-code.util.js';
import {
  CreatePaymentUrlDto,
  RefundTicketDto,
  MoMoIpnDto,
  ZaloPayIpnDto,
  ReconciliationQueryDto,
} from './dto/payment.dto.js';
import {
  PaymentStatus,
  BookingStatus,
  TicketStatus,
  PaymentMethod,
} from '../../common/constants/status.constant.js';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(BookingEntity)
    private readonly bookingRepository: Repository<BookingEntity>,
    @InjectRepository(TicketEntity)
    private readonly ticketRepository: Repository<TicketEntity>,
    @Optional()
    @InjectRepository(SeatHoldEntity)
    private readonly seatHoldRepository?: Repository<SeatHoldEntity>,
    @Optional()
    @InjectRepository(PaymentLogEntity)
    private readonly paymentLogRepository?: Repository<PaymentLogEntity>,
    @Optional()
    private readonly seatLockService?: SeatLockService,
    @Optional()
    private readonly notificationService?: NotificationService,
    @Optional()
    private readonly invoiceService?: InvoiceService,
  ) {}

  async logPaymentEvent(params: {
    paymentId?: string;
    bookingId?: string;
    bookingCode?: string;
    gateway: string;
    eventType: string;
    requestData?: Record<string, any>;
    responseData?: Record<string, any>;
    status?: string;
    ipAddress?: string;
    errorMessage?: string;
  }) {
    try {
      if (this.paymentLogRepository) {
        const log = this.paymentLogRepository.create({
          paymentId: params.paymentId,
          bookingId: params.bookingId,
          bookingCode: params.bookingCode,
          gateway: params.gateway,
          eventType: params.eventType,
          requestData: params.requestData,
          responseData: params.responseData,
          status: params.status || 'success',
          ipAddress: params.ipAddress,
          errorMessage: params.errorMessage,
        });
        await this.paymentLogRepository.save(log);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to save payment log: ${err?.message}`);
    }
  }

  async createPaymentUrl(dto: CreatePaymentUrlDto, reqIp?: string) {
    const booking = await this.bookingRepository.findOne({
      where: { id: dto.bookingId },
      relations: { tickets: true },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt vé');
    }

    if (booking.status === BookingStatus.PAID) {
      throw new BadRequestException('Đơn đặt vé này đã được thanh toán thành công');
    }

    const amount = Number(booking.finalAmount);
    const txnRef = `${booking.bookingCode}-${Date.now().toString().slice(-4)}`;

    // Create pending payment record
    const payment = this.paymentRepository.create({
      bookingId: booking.id,
      paymentMethod: dto.paymentMethod,
      transactionId: txnRef,
      amount,
      status: PaymentStatus.PENDING,
    });
    await this.paymentRepository.save(payment);

    let paymentUrl = '';
    let qrCode = '';
    const orderInfo = dto.orderInfo || `Thanh toan don dat ve ${booking.bookingCode}`;
    const ipAddr = dto.ipAddress || reqIp || '127.0.0.1';

    if (dto.paymentMethod === PaymentMethod.VNPAY) {
      paymentUrl = this.buildVNPayUrl({
        amount,
        txnRef,
        orderInfo,
        ipAddr,
        bankCode: dto.bankCode,
        returnUrl: dto.returnUrl,
      });
      qrCode = paymentUrl;
    } else if (dto.paymentMethod === PaymentMethod.MOMO) {
      const momoRes = this.buildMoMoUrl({
        amount,
        txnRef,
        orderInfo,
        returnUrl: dto.returnUrl,
      });
      paymentUrl = momoRes.paymentUrl;
      qrCode = momoRes.qrCode;
    } else if (dto.paymentMethod === PaymentMethod.ZALOPAY) {
      const zaloRes = this.buildZaloPayUrl({
        amount,
        txnRef,
        orderInfo,
        bookingId: booking.id,
        returnUrl: dto.returnUrl,
      });
      paymentUrl = zaloRes.paymentUrl;
      qrCode = zaloRes.qrCode;
    } else if (dto.paymentMethod === PaymentMethod.BANK_CARD) {
      paymentUrl = this.buildBankCardUrl({
        amount,
        txnRef,
        orderInfo,
        ipAddr,
        bankCode: dto.bankCode,
        returnUrl: dto.returnUrl,
      });
      qrCode = paymentUrl;
    } else {
      // VIETQR / CASH
      qrCode = `https://api.vietqr.io/image/970422-0987654321-compact2.jpg?amount=${amount}&addInfo=${encodeURIComponent(
        booking.bookingCode,
      )}`;
      paymentUrl = qrCode;
    }

    // Sinh ảnh mã QR Data URL Base64 render trực tiếp trên Frontend / Mobile App
    let qrDataUrl = '';
    try {
      qrDataUrl = await generateQrDataUrl(qrCode);
    } catch {
      qrDataUrl = '';
    }

    // Cập nhật payment_details
    payment.paymentDetails = {
      gateway: dto.paymentMethod,
      bankCode: dto.bankCode,
      orderInfo,
      ipAddress: ipAddr,
      paymentUrl,
      qrCode,
    };
    await this.paymentRepository.save(payment);

    // Ghi nhật ký khởi tạo thanh toán
    await this.logPaymentEvent({
      paymentId: payment.id,
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      gateway: dto.paymentMethod,
      eventType: 'create_url',
      requestData: { dto, reqIp },
      responseData: { paymentUrl, qrCode },
      status: 'success',
      ipAddress: ipAddr,
    });

    return {
      paymentId: payment.id,
      paymentMethod: dto.paymentMethod,
      amount,
      txnRef,
      paymentUrl,
      qrCode,
      qrDataUrl,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };
  }

  private buildVNPayUrl(params: {
    amount: number;
    txnRef: string;
    orderInfo: string;
    ipAddr: string;
    bankCode?: string;
    returnUrl?: string;
  }): string {
    const tmnCode = process.env.VNPAY_TMN_CODE || 'ICTUBUS01';
    const secretKey = process.env.VNPAY_HASH_SECRET || 'SECRETKEYICTU2026BUS';
    const vnpUrl = process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    const returnUrl = params.returnUrl || process.env.VNPAY_RETURN_URL || 'http://localhost:3000/payment/result';

    const date = new Date();
    const createDate = this.formatDate(date);

    const vnp_Params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: params.txnRef,
      vnp_OrderInfo: params.orderInfo,
      vnp_OrderType: 'other',
      vnp_Amount: (params.amount * 100).toString(),
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: params.ipAddr,
      vnp_CreateDate: createDate,
    };

    if (params.bankCode) {
      vnp_Params['vnp_BankCode'] = params.bankCode;
    }

    const sortedParams = this.sortObject(vnp_Params);
    const signData = new URLSearchParams(sortedParams).toString();
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    sortedParams['vnp_SecureHash'] = signed;
    return `${vnpUrl}?${new URLSearchParams(sortedParams).toString()}`;
  }

  private buildMoMoUrl(params: {
    amount: number;
    txnRef: string;
    orderInfo: string;
    returnUrl?: string;
  }): { paymentUrl: string; qrCode: string } {
    const partnerCode = process.env.MOMO_PARTNER_CODE || 'MOMOBUS2026';
    const accessKey = process.env.MOMO_ACCESS_KEY || 'MOMOACCESSKEY2026';
    const secretKey = process.env.MOMO_SECRET_KEY || 'MOMOSECRETKEY2026BUS';
    const redirectUrl = params.returnUrl || process.env.MOMO_RETURN_URL || 'http://localhost:3000/payment/result';
    const ipnUrl = process.env.MOMO_IPN_URL || 'http://localhost:3000/api/v1/payment/momo-ipn';
    const requestId = `${params.txnRef}-${Date.now()}`;
    const orderId = params.txnRef;
    const orderInfo = params.orderInfo;
    const requestType = 'captureWallet';
    const extraData = '';

    const rawSignature = `accessKey=${accessKey}&amount=${params.amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

    const paymentUrl = `https://test-payment.momo.vn/v2/gateway/pay?partnerCode=${partnerCode}&orderId=${orderId}&amount=${params.amount}&signature=${signature}`;
    const qrCode = `2|99|${partnerCode}|${orderId}|${params.amount}|0|0|${params.amount}|${encodeURIComponent(orderInfo)}`;

    return { paymentUrl, qrCode };
  }

  private buildZaloPayUrl(params: {
    amount: number;
    txnRef: string;
    orderInfo: string;
    bookingId: string;
    returnUrl?: string;
  }): { paymentUrl: string; qrCode: string } {
    const appId = process.env.ZALOPAY_APP_ID || '2553';
    const key1 = process.env.ZALOPAY_KEY1 || 'ZALOPAYKEY1SECRET2026';
    const appTime = Date.now();
    const appTransId = `${this.formatDate(new Date()).slice(2, 8)}_${params.txnRef}`;
    const appUser = 'ictu_passenger';
    const embedData = JSON.stringify({ redirecturl: params.returnUrl || 'http://localhost:3000/payment/result' });
    const item = JSON.stringify([{ bookingId: params.bookingId, amount: params.amount }]);

    const data = `${appId}|${appTransId}|${appUser}|${params.amount}|${appTime}|${embedData}|${item}`;
    const mac = crypto.createHmac('sha256', key1).update(data).digest('hex');

    const paymentUrl = `https://gateway.zalopay.vn/openinapp?app_id=${appId}&app_trans_id=${appTransId}&amount=${params.amount}&mac=${mac}`;
    const qrCode = `zalopay://pay?app_id=${appId}&app_trans_id=${appTransId}&amount=${params.amount}&mac=${mac}`;

    return { paymentUrl, qrCode };
  }

  private buildBankCardUrl(params: {
    amount: number;
    txnRef: string;
    orderInfo: string;
    ipAddr: string;
    bankCode?: string;
    returnUrl?: string;
  }): string {
    const effectiveBankCode = params.bankCode || 'VNBANK';
    return this.buildVNPayUrl({
      ...params,
      bankCode: effectiveBankCode,
    });
  }

  async handleVNPayReturn(queryParams: Record<string, string>) {
    const secureHash = queryParams['vnp_SecureHash'];
    delete queryParams['vnp_SecureHash'];
    delete queryParams['vnp_SecureHashType'];

    const secretKey = process.env.VNPAY_HASH_SECRET || 'SECRETKEYICTU2026BUS';
    const sorted = this.sortObject(queryParams);
    const signData = new URLSearchParams(sorted).toString();
    const checkHash = crypto.createHmac('sha512', secretKey).update(Buffer.from(signData, 'utf-8')).digest('hex');

    const isValid = secureHash === checkHash;
    const isSuccess = queryParams['vnp_ResponseCode'] === '00';
    const txnRef = queryParams['vnp_TxnRef'];

    if (isValid) {
      if (isSuccess) {
        await this.confirmPayment(txnRef, queryParams);
      } else {
        await this.failPayment(txnRef, queryParams);
      }
    }

    return {
      isValid,
      isSuccess,
      responseCode: queryParams['vnp_ResponseCode'],
      bookingCode: txnRef ? txnRef.split('-').slice(0, 3).join('-') : null,
      message: isSuccess ? 'Thanh toán thành công' : 'Giao dịch không thành công hoặc đã bị hủy',
    };
  }

  async handleVNPayIpn(queryParams: Record<string, string>) {
    const secureHash = queryParams['vnp_SecureHash'];
    delete queryParams['vnp_SecureHash'];
    delete queryParams['vnp_SecureHashType'];

    const secretKey = process.env.VNPAY_HASH_SECRET || 'SECRETKEYICTU2026BUS';
    const sorted = this.sortObject(queryParams);
    const signData = new URLSearchParams(sorted).toString();
    const checkHash = crypto.createHmac('sha512', secretKey).update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash !== checkHash) {
      await this.logPaymentEvent({
        gateway: PaymentMethod.VNPAY,
        eventType: 'ipn_received',
        requestData: queryParams,
        status: 'failed',
        errorMessage: 'Invalid VNPay checksum',
      });
      return { RspCode: '97', Message: 'Invalid Checksum' };
    }

    const txnRef = queryParams['vnp_TxnRef'];
    const payment = await this.paymentRepository.findOne({
      where: { transactionId: txnRef },
      relations: { booking: true },
    });

    if (!payment) {
      await this.logPaymentEvent({
        gateway: PaymentMethod.VNPAY,
        eventType: 'ipn_not_found',
        requestData: queryParams,
        status: 'failed',
        errorMessage: 'Order not found',
      });
      return { RspCode: '01', Message: 'Order not found' };
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    if (queryParams['vnp_ResponseCode'] === '00') {
      await this.confirmPayment(txnRef, queryParams);
      return { RspCode: '00', Message: 'Confirm Success' };
    } else {
      await this.failPayment(txnRef, queryParams);
      return { RspCode: '00', Message: 'Confirm Success' };
    }
  }

  async handleMoMoIpn(dto: MoMoIpnDto, clientIp?: string) {
    const secretKey = process.env.MOMO_SECRET_KEY || 'MOMOSECRETKEY2026BUS';
    const accessKey = process.env.MOMO_ACCESS_KEY || 'MOMOACCESSKEY2026';

    const rawSignature = `accessKey=${accessKey}&amount=${dto.amount}&extraData=${dto.extraData || ''}&message=${dto.message || ''}&orderId=${dto.orderId}&orderInfo=${dto.orderInfo || ''}&orderType=${dto.orderType || ''}&partnerCode=${dto.partnerCode || ''}&payType=${dto.payType || ''}&requestId=${dto.requestId || ''}&responseTime=${dto.responseTime || ''}&resultCode=${dto.resultCode}&transId=${dto.transId || ''}`;
    const calculatedSignature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

    if (dto.signature !== calculatedSignature) {
      await this.logPaymentEvent({
        gateway: PaymentMethod.MOMO,
        eventType: 'ipn_received',
        requestData: dto as any,
        status: 'failed',
        ipAddress: clientIp,
        errorMessage: 'Invalid MoMo IPN signature',
      });
      return { message: 'Invalid signature', resultCode: 97 };
    }

    const isSuccess = Number(dto.resultCode) === 0;
    if (isSuccess) {
      await this.confirmPayment(dto.orderId, dto);
    } else {
      await this.failPayment(dto.orderId, dto);
    }

    await this.logPaymentEvent({
      gateway: PaymentMethod.MOMO,
      eventType: isSuccess ? 'ipn_success' : 'ipn_failed',
      requestData: dto as any,
      responseData: { resultCode: dto.resultCode, message: dto.message },
      status: isSuccess ? 'success' : 'failed',
      ipAddress: clientIp,
    });

    return { message: isSuccess ? 'Success' : 'Payment Failed', resultCode: dto.resultCode };
  }

  async handleZaloPayIpn(dto: ZaloPayIpnDto, clientIp?: string) {
    const key2 = process.env.ZALOPAY_KEY2 || process.env.ZALOPAY_KEY1 || 'ZALOPAYKEY1SECRET2026';
    const calculatedMac = crypto.createHmac('sha256', key2).update(dto.data).digest('hex');

    if (dto.mac !== calculatedMac) {
      await this.logPaymentEvent({
        gateway: PaymentMethod.ZALOPAY,
        eventType: 'ipn_received',
        requestData: dto as any,
        status: 'failed',
        ipAddress: clientIp,
        errorMessage: 'Invalid ZaloPay MAC signature',
      });
      return { return_code: -1, return_message: 'mac not equal' };
    }

    let dataObj: Record<string, any> = {};
    try {
      dataObj = JSON.parse(dto.data);
    } catch {
      dataObj = { raw: dto.data };
    }

    const appTransId = dataObj.app_trans_id || '';
    const txnRef = appTransId.includes('_') ? appTransId.substring(appTransId.indexOf('_') + 1) : appTransId;

    let payment = await this.paymentRepository.findOne({
      where: { transactionId: txnRef },
    });
    if (!payment && appTransId) {
      payment = await this.paymentRepository.findOne({
        where: { transactionId: appTransId },
      });
    }

    if (!payment) {
      await this.logPaymentEvent({
        gateway: PaymentMethod.ZALOPAY,
        eventType: 'ipn_not_found',
        requestData: dto as any,
        status: 'failed',
        ipAddress: clientIp,
        errorMessage: `Payment with txnRef ${txnRef} not found`,
      });
      return { return_code: 2, return_message: 'order not found' };
    }

    await this.confirmPayment(payment.transactionId, dataObj);

    await this.logPaymentEvent({
      paymentId: payment.id,
      bookingId: payment.bookingId,
      gateway: PaymentMethod.ZALOPAY,
      eventType: 'ipn_success',
      requestData: dto as any,
      responseData: { return_code: 1, return_message: 'success' },
      status: 'success',
      ipAddress: clientIp,
    });

    return { return_code: 1, return_message: 'success' };
  }

  async confirmPayment(txnRef: string, details: Record<string, any>) {
    const payment = await this.paymentRepository.findOne({
      where: { transactionId: txnRef },
      relations: {
        booking: {
          user: true,
          trip: { route: true, vehicle: true },
        },
      },
    });

    if (!payment) return;

    payment.status = PaymentStatus.SUCCESS;
    payment.paymentTime = new Date();
    payment.paymentDetails = details;
    await this.paymentRepository.save(payment);

    // Update booking status to PAID
    await this.bookingRepository.update(payment.bookingId, {
      status: BookingStatus.PAID,
    });

    // Update tickets status to PAID
    await this.ticketRepository.update(
      { bookingId: payment.bookingId },
      { status: TicketStatus.PAID },
    );

    const tickets = await this.ticketRepository.find({
      where: { bookingId: payment.bookingId },
      relations: { seat: true },
    });

    // Cập nhật trạng thái SeatHoldEntity sang 'booked'
    if (this.seatHoldRepository && payment.booking?.tripId) {
      const seatIds = tickets.map((t) => t.seatId);
      if (seatIds.length > 0) {
        await this.seatHoldRepository.update(
          { tripId: payment.booking.tripId, seatId: In(seatIds) },
          { status: 'booked' },
        );
      }
    }

    // Ghi log thanh toán thành công
    await this.logPaymentEvent({
      paymentId: payment.id,
      bookingId: payment.bookingId,
      bookingCode: payment.booking?.bookingCode,
      gateway: payment.paymentMethod || 'gateway',
      eventType: 'payment_success',
      responseData: details,
      status: 'success',
    });

    // Tự động gửi Email/Thông báo kèm vé điện tử và hình ảnh mã QR sau khi thanh toán thành công
    if (this.notificationService && payment.booking?.user?.email) {
      for (const ticket of tickets) {
        let qrDataUrl = '';
        if (ticket.qrData) {
          qrDataUrl = await generateQrDataUrl(ticket.qrData);
        }
        await this.notificationService.sendTicketConfirmationEmail({
          recipientEmail: payment.booking.user.email,
          passengerName: ticket.passengerName || payment.booking.user.fullName,
          bookingCode: payment.booking.bookingCode,
          ticketCode: ticket.ticketCode,
          routeName: payment.booking.trip?.route?.name || 'Tuyến xe buýt thông minh ICTU',
          origin: payment.booking.trip?.route?.origin,
          destination: payment.booking.trip?.route?.destination,
          departureTime: payment.booking.trip?.departureTime || new Date(),
          seatNumber: ticket.seat?.seatNumber || 'Ghế tiêu chuẩn',
          vehiclePlate: payment.booking.trip?.vehicle?.licensePlate,
          price: ticket.originalPrice,
          qrDataUrl,
        });
      }
    }

    // Tự động khởi tạo hóa đơn điện tử và gửi email kèm file PDF đính kèm ngay sau khi thanh toán thành công
    if (this.invoiceService) {
      try {
        await this.invoiceService.generateAndSendInvoiceForPayment(payment.id);
      } catch (err: any) {
        this.logger.error(`[PaymentService] Lỗi khi tự động khởi tạo/gửi hóa đơn điện tử cho payment ${payment.id}: ${err?.message}`);
      }
    }
  }

  async failPayment(txnRef: string, details?: Record<string, any>) {
    const payment = await this.paymentRepository.findOne({
      where: { transactionId: txnRef },
      relations: { booking: { tickets: true } },
    });

    if (!payment) return;

    payment.status = PaymentStatus.FAILED;
    payment.paymentDetails = details || {};
    await this.paymentRepository.save(payment);

    // Ghi log thanh toán thất bại
    await this.logPaymentEvent({
      paymentId: payment.id,
      bookingId: payment.bookingId,
      bookingCode: payment.booking?.bookingCode,
      gateway: payment.paymentMethod || 'gateway',
      eventType: 'payment_failed',
      responseData: details,
      status: 'failed',
      errorMessage: details?.message || 'Thanh toán thất bại hoặc bị hủy',
    });

    if (payment.booking) {
      payment.booking.status = BookingStatus.CANCELLED;
      await this.bookingRepository.save(payment.booking);

      const tickets = payment.booking.tickets || [];
      if (tickets.length > 0) {
        await this.ticketRepository.update(
          { bookingId: payment.bookingId },
          { status: TicketStatus.CANCELLED },
        );

        const seatIds = tickets.map((t) => t.seatId);
        if (this.seatHoldRepository) {
          await this.seatHoldRepository.update(
            { tripId: payment.booking.tripId, seatId: In(seatIds) },
            { status: 'released' },
          );
        }

        if (this.seatLockService) {
          await this.seatLockService.releaseSeats(
            payment.booking.tripId,
            seatIds,
            payment.booking.userId,
          );
        }
      }
    }
  }

  async cancelPayment(bookingId: string, userId?: string) {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: { tickets: true, payments: true },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt vé');
    }

    if (userId && booking.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên đơn đặt vé này');
    }

    if (booking.status === BookingStatus.PAID) {
      throw new BadRequestException('Đơn hàng đã thanh toán thành công, không thể hủy');
    }

    booking.status = BookingStatus.CANCELLED;
    await this.bookingRepository.save(booking);

    const tickets = booking.tickets || [];
    if (tickets.length > 0) {
      await this.ticketRepository.update(
        { bookingId: booking.id },
        { status: TicketStatus.CANCELLED },
      );

      const seatIds = tickets.map((t) => t.seatId);
      if (this.seatHoldRepository) {
        await this.seatHoldRepository.update(
          { tripId: booking.tripId, seatId: In(seatIds) },
          { status: 'released' },
        );
      }

      if (this.seatLockService) {
        await this.seatLockService.releaseSeats(booking.tripId, seatIds, booking.userId);
      }
    }

    if (booking.payments) {
      for (const p of booking.payments) {
        if (p.status === PaymentStatus.PENDING) {
          p.status = PaymentStatus.FAILED;
          await this.paymentRepository.save(p);
        }
      }
    }

    await this.logPaymentEvent({
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      gateway: 'system',
      eventType: 'cancel_payment',
      requestData: { bookingId, userId },
      status: 'success',
    });

    return {
      success: true,
      message: 'Đã hủy thanh toán và giải phóng ghế thành công',
      bookingId: booking.id,
    };
  }

  async refundTicket(ticketId: string, dto: RefundTicketDto) {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: {
        booking: {
          payments: true,
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy vé xe');
    }

    if (ticket.status !== TicketStatus.CANCELLED) {
      throw new BadRequestException('Chỉ có thể hoàn tiền cho vé đã ở trạng thái đã hủy (CANCELLED)');
    }

    const pct = dto.refundPercentage !== undefined ? dto.refundPercentage : 100;
    const refundAmount = Math.round((Number(ticket.originalPrice) * pct) / 100);

    const payment = ticket.booking.payments?.[0];
    if (payment) {
      payment.status = PaymentStatus.REFUNDED;
      payment.refundTime = new Date();
      payment.refundAmount = refundAmount;
      payment.refundReason = dto.reason || 'Hoàn tiền vé bị hủy';
      await this.paymentRepository.save(payment);
    }

    await this.logPaymentEvent({
      paymentId: payment?.id,
      bookingId: ticket.bookingId,
      bookingCode: ticket.booking?.bookingCode,
      gateway: payment?.paymentMethod || 'gateway',
      eventType: 'refund',
      requestData: { ticketId, dto },
      responseData: { refundAmount },
      status: 'success',
    });

    return {
      success: true,
      message: `Đã hoàn tiền ${refundAmount.toLocaleString('vi-VN')} VND cho vé ${ticket.ticketCode}`,
      refundAmount,
      refundTime: new Date(),
    };
  }

  async getPaymentLogs(paymentId: string) {
    if (!this.paymentLogRepository) return [];
    return this.paymentLogRepository.find({
      where: { paymentId },
      order: { createdAt: 'DESC' },
    });
  }

  async getReconciliationReport(query: ReconciliationQueryDto) {
    if (!this.paymentLogRepository) {
      return { totalLogs: 0, totalSuccessfulPayments: 0, totalRevenue: 0, logs: [] };
    }

    const qb = this.paymentLogRepository.createQueryBuilder('log');
    if (query.gateway) {
      qb.andWhere('log.gateway = :gateway', { gateway: query.gateway });
    }
    if (query.status) {
      qb.andWhere('log.status = :status', { status: query.status });
    }
    if (query.startDate) {
      qb.andWhere('log.createdAt >= :startDate', { startDate: new Date(query.startDate) });
    }
    if (query.endDate) {
      qb.andWhere('log.createdAt <= :endDate', { endDate: new Date(`${query.endDate}T23:59:59.999Z`) });
    }
    qb.orderBy('log.createdAt', 'DESC');
    const logs = await qb.getMany();

    const paymentWhere: any = { status: PaymentStatus.SUCCESS };
    if (query.gateway) {
      paymentWhere.paymentMethod = query.gateway;
    }
    const successfulPayments = await this.paymentRepository.find({
      where: paymentWhere,
    });

    const totalRevenue = successfulPayments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0,
    );

    return {
      totalLogs: logs.length,
      totalSuccessfulPayments: successfulPayments.length,
      totalRevenue,
      logs,
    };
  }

  private sortObject(obj: Record<string, string>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      if (obj[key] !== null && obj[key] !== undefined && obj[key] !== '') {
        sorted[encodeURIComponent(key)] = encodeURIComponent(obj[key]).replace(/%20/g, '+');
      }
    }
    return sorted;
  }

  private formatDate(date: Date): string {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const h = pad(date.getHours());
    const min = pad(date.getMinutes());
    const s = pad(date.getSeconds());
    return `${y}${m}${d}${h}${min}${s}`;
  }
}
