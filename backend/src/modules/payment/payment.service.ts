import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import { PaymentEntity } from '../../database/entities/payment.entity.js';
import { BookingEntity } from '../../database/entities/booking.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { CreatePaymentUrlDto, RefundTicketDto } from './dto/payment.dto.js';
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
  ) {}

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

    if (dto.paymentMethod === PaymentMethod.VNPAY) {
      const paymentUrl = this.buildVNPayUrl({
        amount,
        txnRef,
        orderInfo: dto.orderInfo || `Thanh toan don dat ve ${booking.bookingCode}`,
        ipAddr: dto.ipAddress || reqIp || '127.0.0.1',
      });

      return {
        paymentId: payment.id,
        paymentMethod: dto.paymentMethod,
        paymentUrl,
        amount,
        txnRef,
      };
    }

    // Default or Cash or VietQR
    return {
      paymentId: payment.id,
      paymentMethod: dto.paymentMethod,
      amount,
      txnRef,
      paymentUrl: `https://api.vietqr.io/image/970422-0987654321-compact2.jpg?amount=${amount}&addInfo=${encodeURIComponent(
        booking.bookingCode,
      )}`,
    };
  }

  private buildVNPayUrl(params: {
    amount: number;
    txnRef: string;
    orderInfo: string;
    ipAddr: string;
  }): string {
    const tmnCode = process.env.VNPAY_TMN_CODE || 'ICTUBUS01';
    const secretKey = process.env.VNPAY_HASH_SECRET || 'SECRETKEYICTU2026BUS';
    const vnpUrl = process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    const returnUrl = process.env.VNPAY_RETURN_URL || 'http://localhost:3000/payment/result';

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

    const sortedParams = this.sortObject(vnp_Params);
    const signData = new URLSearchParams(sortedParams).toString();
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    sortedParams['vnp_SecureHash'] = signed;
    return `${vnpUrl}?${new URLSearchParams(sortedParams).toString()}`;
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

    if (isValid && isSuccess) {
      await this.confirmPayment(txnRef, queryParams);
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
      return { RspCode: '97', Message: 'Invalid Checksum' };
    }

    const txnRef = queryParams['vnp_TxnRef'];
    const payment = await this.paymentRepository.findOne({
      where: { transactionId: txnRef },
      relations: { booking: true },
    });

    if (!payment) {
      return { RspCode: '01', Message: 'Order not found' };
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    if (queryParams['vnp_ResponseCode'] === '00') {
      await this.confirmPayment(txnRef, queryParams);
      return { RspCode: '00', Message: 'Confirm Success' };
    } else {
      payment.status = PaymentStatus.FAILED;
      payment.paymentDetails = queryParams;
      await this.paymentRepository.save(payment);
      return { RspCode: '00', Message: 'Confirm Success' };
    }
  }

  private async confirmPayment(txnRef: string, details: Record<string, any>) {
    const payment = await this.paymentRepository.findOne({
      where: { transactionId: txnRef },
      relations: { booking: true },
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

    return {
      success: true,
      message: `Đã hoàn tiền ${refundAmount.toLocaleString('vi-VN')} VND cho vé ${ticket.ticketCode}`,
      refundAmount,
      refundTime: new Date(),
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
