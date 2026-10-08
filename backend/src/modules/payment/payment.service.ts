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
import { RefundLogEntity } from '../../database/entities/refund-log.entity.js';
import { BookingEntity } from '../../database/entities/booking.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { SeatHoldEntity } from '../../database/entities/seat-hold.entity.js';
import { SeatLockService } from '../booking/seat-lock.service.js';
import { NotificationService } from '../notification/notification.service.js';
import { InvoiceService } from '../invoice/invoice.service.js';
import { GatewayRefundService, ProcessRefundParams } from './services/gateway-refund.service.js';
import { generateQrDataUrl } from '../../common/utils/qr-code.util.js';
import {
  CreatePaymentUrlDto,
  RefundTicketDto,
  MoMoIpnDto,
  ZaloPayIpnDto,
  ReconciliationQueryDto,
  GetRefundLogsQueryDto,
} from './dto/payment.dto.js';
import {
  PaymentStatus,
  BookingStatus,
  TicketStatus,
  TripStatus,
  PaymentMethod,
} from '../../common/constants/status.constant.js';
import { Role } from '../../common/constants/roles.constant.js';

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
    @InjectRepository(RefundLogEntity)
    private readonly refundLogRepository?: Repository<RefundLogEntity>,
    @Optional()
    private readonly gatewayRefundService?: GatewayRefundService,
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
      paymentDetails: {
        invoiceEmail: dto.invoiceEmail?.trim() || (booking.user as any)?.email,
        bankCode: dto.bankCode,
        ipAddress: dto.ipAddress || reqIp || '127.0.0.1',
      },
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
    const tmnCode = process.env.VNPAY_TMN_CODE || 'BDCDEH71';
    const secretKey = process.env.VNPAY_HASH_SECRET || 'TJAWJFAONXJGYJULKCPRUYGNVXTCHGUN';
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

    const secretKey = process.env.VNPAY_HASH_SECRET || 'TJAWJFAONXJGYJULKCPRUYGNVXTCHGUN';
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

  async handleVNPayIpn(queryParams: Record<string, string>, clientIp?: string) {
    const secureHash = queryParams['vnp_SecureHash'];
    delete queryParams['vnp_SecureHash'];
    delete queryParams['vnp_SecureHashType'];

    const secretKey = process.env.VNPAY_HASH_SECRET || 'TJAWJFAONXJGYJULKCPRUYGNVXTCHGUN';
    const sorted = this.sortObject(queryParams);
    const signData = new URLSearchParams(sorted).toString();
    const checkHash = crypto.createHmac('sha512', secretKey).update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash !== checkHash) {
      await this.logPaymentEvent({
        gateway: PaymentMethod.VNPAY,
        eventType: 'ipn_checksum_error',
        requestData: queryParams,
        responseData: { RspCode: '97', Message: 'Invalid Checksum' },
        status: 'failed',
        ipAddress: clientIp,
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
        responseData: { RspCode: '01', Message: 'Order not found' },
        status: 'failed',
        ipAddress: clientIp,
        errorMessage: 'Order not found',
      });
      return { RspCode: '01', Message: 'Order not found' };
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      await this.logPaymentEvent({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        bookingCode: payment.booking?.bookingCode,
        gateway: PaymentMethod.VNPAY,
        eventType: 'ipn_duplicate',
        requestData: queryParams,
        responseData: { RspCode: '02', Message: 'Order already confirmed' },
        status: 'success',
        ipAddress: clientIp,
      });
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    if (queryParams['vnp_ResponseCode'] === '00') {
      await this.confirmPayment(txnRef, queryParams);
      await this.logPaymentEvent({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        bookingCode: payment.booking?.bookingCode,
        gateway: PaymentMethod.VNPAY,
        eventType: 'ipn_success',
        requestData: queryParams,
        responseData: { RspCode: '00', Message: 'Confirm Success' },
        status: 'success',
        ipAddress: clientIp,
      });
      return { RspCode: '00', Message: 'Confirm Success' };
    } else {
      await this.failPayment(txnRef, queryParams);
      await this.logPaymentEvent({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        bookingCode: payment.booking?.bookingCode,
        gateway: PaymentMethod.VNPAY,
        eventType: 'ipn_failed',
        requestData: queryParams,
        responseData: { RspCode: '00', Message: 'Confirm Success' },
        status: 'failed',
        ipAddress: clientIp,
        errorMessage: `VNPay returned response code: ${queryParams['vnp_ResponseCode']}`,
      });
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

    if (payment.status === PaymentStatus.SUCCESS || payment.status === PaymentStatus.REFUNDED) {
      return;
    }

    const tickets = await this.ticketRepository.find({
      where: { bookingId: payment.bookingId },
      relations: { seat: true },
    });

    // KỊCH BẢN B: TỰ ĐỘNG HOÀN TIỀN KHI GIAO DỊCH BỊ LỖI / TIMEOUT / QUÁ HẠN GIỮ CHỖ (AUTO-REFUND ON SYSTEM ERROR)
    // 1. Kiểm tra đơn vé đã timeout (>10 phút hoặc quá expiresAt) hoặc bị hủy / hết hạn
    const bookingCreatedDate = payment.booking?.bookingTime || (payment.booking as any)?.createdAt;
    const isBookingTimedOut =
      (payment.booking?.expiresAt && new Date(payment.booking.expiresAt).getTime() < Date.now()) ||
      (bookingCreatedDate && Date.now() - new Date(bookingCreatedDate).getTime() > 10 * 60 * 1000);

    const isBookingExpiredOrCancelled =
      payment.booking &&
      (payment.booking.status === BookingStatus.CANCELLED ||
        payment.booking.status === BookingStatus.EXPIRED ||
        Boolean(isBookingTimedOut));

    // 2. Kiểm tra chuyến xe đã bị hủy đột xuất
    const isTripCancelled =
      payment.booking?.trip && payment.booking.trip.status === TripStatus.CANCELLED;

    // 3. Kiểm tra ghế đã bị mất do quá hạn giữ chỗ (SeatHold expired) và đã bị khách khác mua mất
    let isSeatLost = false;
    if (payment.booking?.tripId && tickets.length > 0) {
      const seatIds = tickets.map((t) => t.seatId);
      if (typeof this.ticketRepository.createQueryBuilder === 'function') {
        const conflictTicketCount = await this.ticketRepository
          .createQueryBuilder('t')
          .where('t.seatId IN (:...seatIds)', { seatIds })
          .andWhere('t.bookingId != :bookingId', { bookingId: payment.bookingId })
          .andWhere('t.status = :paidStatus', { paidStatus: TicketStatus.PAID })
          .getCount();

        if (conflictTicketCount > 0 && isBookingExpiredOrCancelled) {
          isSeatLost = true;
        }
      } else if (typeof this.ticketRepository.find === 'function') {
        const conflictTickets = await this.ticketRepository.find({
          where: {
            seatId: In(seatIds),
            status: TicketStatus.PAID,
          },
        });
        if (
          conflictTickets &&
          conflictTickets.some((t) => t.bookingId !== payment.bookingId) &&
          isBookingExpiredOrCancelled
        ) {
          isSeatLost = true;
        }
      }
    }

    if (isBookingExpiredOrCancelled || isTripCancelled || isSeatLost) {
      const autoRefundReason = 'Tự động hoàn tiền do đơn vé timeout / sự cố chuyến xe';
      const fullAmount = Number(payment.amount || 0);

      this.logger.warn(
        `[Auto-Refund] Kích hoạt hoàn tiền tự động 100% cho giao dịch ${txnRef} (Booking: ${payment.booking?.bookingCode}) do: ${
          isTripCancelled
            ? 'Chuyến xe đã bị hủy đột xuất'
            : isSeatLost
            ? 'Ghế đã bị đặt bởi khách khác do hết hạn giữ chỗ'
            : 'Đơn đặt vé đã timeout / hủy'
        }`,
      );

      // Cập nhật trạng thái payment
      payment.status = PaymentStatus.REFUND_PENDING;
      payment.paymentTime = new Date();
      payment.refundAmount = fullAmount;
      payment.refundTime = new Date();
      payment.refundReason = autoRefundReason;
      payment.paymentDetails = {
        ...payment.paymentDetails,
        ...details,
        autoRefundTriggered: true,
        autoRefundReason,
      };
      await this.paymentRepository.save(payment);

      // Cập nhật vé sang CANCELLED
      await this.ticketRepository.update(
        { bookingId: payment.bookingId },
        { status: TicketStatus.CANCELLED },
      );

      // Gọi gateway refund thực hiện hoàn 100% tiền
      let refundResult: any = null;
      if (this.gatewayRefundService) {
        const dummyTicket = tickets[0] || ({
          id: payment.bookingId,
          ticketCode: payment.booking?.bookingCode || txnRef,
          originalPrice: fullAmount,
        } as TicketEntity);

        refundResult = await this.gatewayRefundService.processRefund({
          ticket: dummyTicket,
          booking: payment.booking,
          payment,
          refundAmount: fullAmount,
          originalAmount: fullAmount,
          feeAmount: 0,
          reason: autoRefundReason,
          triggeredBy: 'timeout_error',
        });
      }

      // Gửi email xác nhận hoàn tiền 100% cho hành khách
      if (
        this.notificationService &&
        payment.booking?.user?.email &&
        typeof this.notificationService.sendRefundConfirmationEmail === 'function'
      ) {
        await this.notificationService.sendRefundConfirmationEmail({
          recipientEmail: payment.booking.user.email,
          passengerName: payment.booking.user.fullName,
          ticketCode: tickets[0]?.ticketCode || payment.booking.bookingCode,
          bookingCode: payment.booking.bookingCode,
          routeName: payment.booking.trip?.route?.name || 'Tuyến xe buýt ICTU',
          seatNumber: tickets.map((t) => t.seat?.seatNumber).filter(Boolean).join(', ') || 'Ghế đã chọn',
          departureTime: payment.booking.trip?.departureTime,
          originalPrice: fullAmount,
          cancellationFeePercent: 0,
          feeAmount: 0,
          refundAmount: fullAmount,
          gateway: payment.paymentMethod || 'gateway',
          refundTransactionId: refundResult?.refundTransactionId,
          reason: autoRefundReason,
        });
      }

      await this.logPaymentEvent({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        bookingCode: payment.booking?.bookingCode,
        gateway: payment.paymentMethod || 'gateway',
        eventType: 'auto_refund_timeout',
        responseData: { details, refundResult, reason: autoRefundReason },
        status: 'success',
      });

      return;
    }

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

  async mockConfirmPayment(bookingId: string, userId?: string) {
    const payment = await this.paymentRepository.findOne({
      where: { bookingId },
      order: { createdAt: 'DESC' },
    });

    if (payment) {
      await this.confirmPayment(payment.transactionId, {
        gateway: payment.paymentMethod || 'sandbox_mock',
        status: 'PAID',
        confirmedBy: userId || 'system',
        confirmedAt: new Date().toISOString(),
        isDemoMock: true,
      });
      return { success: true, message: 'Đã xác nhận thanh toán thành công' };
    }

    await this.bookingRepository.update(bookingId, { status: BookingStatus.PAID });
    await this.ticketRepository.update({ bookingId }, { status: TicketStatus.PAID });
    return { success: true, message: 'Đã cập nhật trạng thái vé sang Đã thanh toán (PAID)' };
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

  /**
   * Bộ điều phối gọi sang GatewayRefundService
   */
  async processRefund(params: {
    ticket: TicketEntity;
    booking: BookingEntity;
    payment?: PaymentEntity;
    refundAmount: number;
    originalAmount: number;
    feeAmount?: number;
    reason?: string;
    ipAddress?: string;
    triggeredBy?: string;
  }) {
    if (this.gatewayRefundService) {
      return this.gatewayRefundService.processRefund(params);
    }

    // Fallback nếu GatewayRefundService không được cung cấp (ví dụ môi trường mock test)
    if (params.payment) {
      params.payment.status = PaymentStatus.REFUNDED;
      params.payment.refundTime = new Date();
      params.payment.refundAmount = params.refundAmount;
      params.payment.refundReason = params.reason || 'Hoàn tiền vé xe buýt';
      await this.paymentRepository.save(params.payment);
      return {
        success: true,
        status: 'SUCCESS' as const,
        refundTransactionId: `REF_${Date.now()}_${params.ticket.ticketCode}`,
        gateway: params.payment.paymentMethod || 'gateway',
        rawRequest: null,
        rawResponse: null,
        message: 'Hoàn tiền thành công',
        paymentStatus: PaymentStatus.REFUNDED,
      };
    }
    return null;
  }

  /**
   * KÍCH HOẠT HOÀN TIỀN CHO VÉ XE ĐÃ HỦY THEO CHÍNH SÁCH
   */
  async refundTicket(ticketId: string, dto: RefundTicketDto, userId?: string) {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: {
        booking: {
          user: true,
          trip: { route: true, vehicle: true },
          payments: true,
        },
        seat: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy vé xe');
    }

    if (ticket.status !== TicketStatus.CANCELLED && ticket.status !== TicketStatus.PAID) {
      throw new BadRequestException('Chỉ có thể hoàn tiền cho vé đã ở trạng thái đã thanh toán hoặc đã hủy');
    }

    // 1. Tính toán số tiền hoàn dựa trên Quy định hủy vé (Dual Trigger Policy)
    let refundPct = dto.refundPercentage;
    let feePct = 0;
    const originalPrice = Number(ticket.originalPrice || 0);

    if (refundPct === undefined) {
      const departureTime = ticket.booking?.trip?.departureTime
        ? new Date(ticket.booking.trip.departureTime)
        : null;

      if (departureTime) {
        const diffHours = (departureTime.getTime() - Date.now()) / (1000 * 60 * 60);
        if (diffHours >= 24) {
          refundPct = 100;
          feePct = 0;
        } else if (diffHours >= 12) {
          refundPct = 90;
          feePct = 10;
        } else if (diffHours >= 2) {
          refundPct = 80;
          feePct = 20;
        } else {
          refundPct = 0;
          feePct = 100;
        }
      } else {
        refundPct = 100;
        feePct = 0;
      }
    } else {
      feePct = Math.max(0, 100 - refundPct);
    }

    const feeAmount = Math.round((originalPrice * feePct) / 100);
    const refundAmount = Math.max(0, Math.round((originalPrice * refundPct) / 100));

    // 2. Cập nhật trạng thái vé và giải phóng ghế lập tức
    ticket.status = TicketStatus.REFUNDED;
    await this.ticketRepository.save(ticket);

    if (this.seatHoldRepository && ticket.booking?.tripId) {
      await this.seatHoldRepository.update(
        { tripId: ticket.booking.tripId, seatId: ticket.seatId },
        { status: 'released' },
      );
    }
    if (this.seatLockService && ticket.booking?.tripId) {
      await this.seatLockService.releaseSeats(ticket.booking.tripId, [ticket.seatId]);
    }

    // 3. Thực thi nghiệp vụ hoàn tiền qua GatewayRefundService
    const payment = ticket.booking?.payments?.[0];
    const reason = dto.reason || 'Hành khách hủy vé theo quy định';
    let gatewayResult: any = null;

    if (this.gatewayRefundService && payment && refundAmount > 0) {
      gatewayResult = await this.gatewayRefundService.processRefund({
        ticket,
        booking: ticket.booking,
        payment,
        refundAmount,
        originalAmount: originalPrice,
        feeAmount,
        reason,
        triggeredBy: 'passenger_cancellation',
      });
    } else if (payment) {
      payment.status = refundAmount > 0 ? PaymentStatus.REFUNDED : PaymentStatus.FAILED;
      payment.refundTime = new Date();
      payment.refundAmount = refundAmount;
      payment.refundReason = reason;
      await this.paymentRepository.save(payment);
    }

    // 4. Gửi email xác nhận hoàn tiền (Non-blocking Task Queue)
    if (this.notificationService) {
      const recipientEmail =
        ticket.booking.user?.email ||
        payment?.paymentDetails?.invoiceEmail ||
        (payment?.paymentDetails as any)?.email;

      if (recipientEmail && typeof this.notificationService.sendRefundConfirmationEmail === 'function') {
        await this.notificationService.sendRefundConfirmationEmail({
          recipientEmail,
          passengerName: ticket.passengerName || ticket.booking.user?.fullName,
          ticketCode: ticket.ticketCode,
          bookingCode: ticket.booking.bookingCode,
          routeName: ticket.booking.trip?.route?.name || 'Tuyến xe buýt thông minh ICTU',
          seatNumber: ticket.seat?.seatNumber,
          departureTime: ticket.booking.trip?.departureTime,
          originalPrice,
          cancellationFeePercent: feePct,
          feeAmount,
          refundAmount,
          gateway: gatewayResult?.gateway || payment?.paymentMethod || 'gateway',
          refundTransactionId: gatewayResult?.refundTransactionId,
          reason,
        });
      }
    }

    // 5. Ghi nhật ký thanh toán
    await this.logPaymentEvent({
      paymentId: payment?.id,
      bookingId: ticket.bookingId,
      bookingCode: ticket.booking?.bookingCode,
      gateway: payment?.paymentMethod || 'gateway',
      eventType: 'refund',
      requestData: { ticketId, dto, userId },
      responseData: { refundAmount, feeAmount, gatewayResult },
      status: 'success',
    });

    return {
      success: true,
      message: `Đã hoàn tiền ${refundAmount.toLocaleString('vi-VN')} VND cho vé ${ticket.ticketCode}`,
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      status: ticket.status,
      originalPrice,
      cancellationFee: feeAmount,
      cancellationFeePercent: feePct,
      refundAmount,
      refundTransactionId: gatewayResult?.refundTransactionId,
      gateway: gatewayResult?.gateway || payment?.paymentMethod,
      refundTime: new Date(),
    };
  }

  /**
   * HẠNG MỤC 3 & 5: Lấy danh sách logs hoàn tiền phục vụ đối soát tài chính
   */
  async getRefundLogs(query: GetRefundLogsQueryDto) {
    if (!this.refundLogRepository) {
      return {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        totalRefundedAmount: 0,
        totalFeeAmount: 0,
      };
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.refundLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.payment', 'payment')
      .leftJoinAndSelect('log.booking', 'booking')
      .leftJoinAndSelect('log.ticket', 'ticket');

    if (query.gateway) {
      qb.andWhere('log.gateway = :gateway', { gateway: query.gateway });
    }
    if (query.status) {
      qb.andWhere('log.status = :status', { status: query.status.toUpperCase() });
    }
    if (query.startDate) {
      qb.andWhere('log.createdAt >= :startDate', { startDate: new Date(query.startDate) });
    }
    if (query.endDate) {
      qb.andWhere('log.createdAt <= :endDate', {
        endDate: new Date(`${query.endDate}T23:59:59.999Z`),
      });
    }
    if (query.ticketCode) {
      qb.andWhere('ticket.ticketCode ILIKE :ticketCode', {
        ticketCode: `%${query.ticketCode.trim()}%`,
      });
    }
    if (query.bookingCode) {
      qb.andWhere('booking.bookingCode ILIKE :bookingCode', {
        bookingCode: `%${query.bookingCode.trim()}%`,
      });
    }

    qb.orderBy('log.createdAt', 'DESC');

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    // Tính tổng số tiền đã hoàn và tổng phí hủy phục vụ đối soát tài chính
    const sumResult = await this.refundLogRepository
      .createQueryBuilder('r')
      .select('SUM(r.refundAmount)', 'totalRefunded')
      .addSelect('SUM(r.feeAmount)', 'totalFee')
      .getRawOne();

    const totalRefundedAmount = Number(sumResult?.totalRefunded || 0);
    const totalFeeAmount = Number(sumResult?.totalFee || 0);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalRefundedAmount,
      totalFeeAmount,
    };
  }

  /**
   * HẠNG MỤC 3: Xem chi tiết biên bản hoàn tiền và payload đối chiếu của cổng thanh toán
   */
  async getRefundLogDetail(id: string) {
    if (!this.refundLogRepository) {
      throw new NotFoundException('RefundLog repository không khả dụng');
    }

    const log = await this.refundLogRepository.findOne({
      where: { id },
      relations: {
        payment: true,
        booking: { user: true, trip: { route: true } },
        ticket: { seat: true },
      },
    });

    if (!log) {
      throw new NotFoundException(`Không tìm thấy biên bản hoàn tiền với ID: ${id}`);
    }

    return log;
  }

  /**
   * Lấy thông tin chi tiết hoàn tiền của vé cho hành khách hoặc quản trị viên
   */
  async getRefundDetailByTicketId(ticketId: string, userId?: string, userRole?: string) {
    const isPrivileged =
      userRole === Role.ADMIN ||
      userRole === Role.MANAGER ||
      userRole === Role.DRIVER;

    const ticket = await this.ticketRepository.findOne({
      where: [{ id: ticketId }, { ticketCode: ticketId }],
      relations: {
        booking: { user: true, payments: true, trip: { route: true } },
        seat: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy vé xe');
    }

    if (userId && !isPrivileged && ticket.booking.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền truy cập thông tin hoàn tiền của vé này');
    }

    let log: any = null;
    if (this.refundLogRepository) {
      log = await this.refundLogRepository.findOne({
        where: [{ ticketId: ticket.id }, { bookingId: ticket.bookingId }],
        order: { createdAt: 'DESC' },
      });
    }

    const payment = ticket.booking?.payments?.[0];
    const originalPrice = Number(ticket.originalPrice || 10000);

    if (log) {
      const orig = Number(log.originalAmount || originalPrice);
      const fee = Number(log.feeAmount || 0);
      return {
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        status: log.status || 'SUCCESS',
        refundAmount: Number(log.refundAmount),
        originalPrice: orig,
        cancellationFee: fee,
        feePercent: orig > 0 ? Math.round((fee / orig) * 100) : 0,
        refundMethod: log.gateway || payment?.paymentMethod || 'vnpay',
        refundTransactionId: log.refundTransactionId || (payment?.transactionId ? `RF-${payment.transactionId}` : null),
        refundTime: log.createdAt,
        estimatedArrival: log.gateway === 'bank_transfer' ? '1 - 3 ngày làm việc' : 'Ngay lập tức đến 24 giờ',
        reason: log.reason || 'Hủy vé theo chính sách hoàn tiền',
      };
    }

    if (payment && (payment.status === PaymentStatus.REFUNDED || payment.refundAmount != null)) {
      const refAmount = Number(payment.refundAmount != null ? payment.refundAmount : originalPrice);
      const fee = Math.max(0, originalPrice - refAmount);
      return {
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        status: payment.status === PaymentStatus.REFUNDED ? 'SUCCESS' : 'PENDING',
        refundAmount: refAmount,
        originalPrice,
        cancellationFee: fee,
        feePercent: originalPrice > 0 ? Math.round((fee / originalPrice) * 100) : 0,
        refundMethod: payment.paymentMethod || 'vnpay',
        refundTransactionId: payment.transactionId ? `RF-${payment.transactionId}` : null,
        refundTime: payment.refundTime || ticket.createdAt || new Date(),
        estimatedArrival: 'Ngay lập tức đến 24 giờ',
        reason: payment.refundReason || 'Hoàn tiền theo chính sách',
      };
    }

    return {
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      status: ticket.status === TicketStatus.REFUNDED ? 'SUCCESS' : 'PENDING',
      refundAmount: originalPrice,
      originalPrice,
      cancellationFee: 0,
      feePercent: 0,
      refundMethod: payment?.paymentMethod || 'vnpay',
      refundTransactionId: `RF-${ticket.ticketCode}`,
      refundTime: ticket.createdAt || new Date(),
      estimatedArrival: '1 - 24 giờ làm việc',
      reason: 'Hủy vé và xử lý hoàn tiền tự động',
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

    // Tổng hợp đối soát theo từng cổng thanh toán thực tế 100% từ CSDL
    const allPayments = await this.paymentRepository.find();
    const GATEWAYS = ['vnpay', 'momo', 'zalopay', 'vietqr', 'cash'];
    const summaryByGateway = GATEWAYS.map((gw) => {
      const gwPayments = allPayments.filter((p) => (p.paymentMethod || '').toLowerCase() === gw);
      const successful = gwPayments.filter((p) => p.status === PaymentStatus.SUCCESS);
      const refunded = gwPayments.filter((p) => p.status === PaymentStatus.REFUNDED);
      const pendingOrFailed = gwPayments.filter(
        (p) => p.status !== PaymentStatus.SUCCESS && p.status !== PaymentStatus.REFUNDED,
      );
      const revenue = successful.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      return {
        gateway: gw,
        total: gwPayments.length,
        successCount: successful.length,
        failedCount: pendingOrFailed.length,
        refundCount: refunded.length,
        revenue,
      };
    });

    return {
      totalLogs: logs.length,
      totalSuccessfulPayments: successfulPayments.length,
      totalRevenue,
      logs,
      summaryByGateway,
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
