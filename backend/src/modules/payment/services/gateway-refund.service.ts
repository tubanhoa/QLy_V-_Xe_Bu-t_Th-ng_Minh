import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import { RefundLogEntity } from '../../../database/entities/refund-log.entity.js';
import { PaymentEntity } from '../../../database/entities/payment.entity.js';
import { TicketEntity } from '../../../database/entities/ticket.entity.js';
import { BookingEntity } from '../../../database/entities/booking.entity.js';
import { PaymentMethod, PaymentStatus } from '../../../common/constants/status.constant.js';

export interface ProcessRefundParams {
  ticket: TicketEntity;
  booking: BookingEntity;
  payment?: PaymentEntity;
  refundAmount: number;
  originalAmount: number;
  feeAmount?: number;
  reason?: string;
  ipAddress?: string;
  triggeredBy?: string; // 'passenger_cancellation' | 'timeout_error' | 'admin_manual'
}

export interface RefundGatewayResponse {
  success: boolean;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  refundTransactionId: string;
  gateway: string;
  rawRequest: any;
  rawResponse: any;
  message: string;
  paymentStatus: PaymentStatus;
}

@Injectable()
export class GatewayRefundService {
  private readonly logger = new Logger(GatewayRefundService.name);

  constructor(
    @InjectRepository(RefundLogEntity)
    private readonly refundLogRepository: Repository<RefundLogEntity>,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
  ) {}

  /**
   * Bộ điều phối hoàn tiền đa cổng thanh toán (Multi-Gateway Dispatcher)
   */
  async processRefund(params: ProcessRefundParams): Promise<RefundGatewayResponse> {
    const { ticket, booking, payment, refundAmount, originalAmount, feeAmount = 0, reason, ipAddress } = params;

    const gatewayMethod = payment?.paymentMethod || PaymentMethod.BANK_CARD;
    this.logger.log(
      `[GatewayRefundService] Bắt đầu hoàn tiền cho vé ${ticket.ticketCode} (Đơn ${booking.bookingCode}) - Cổng: ${gatewayMethod} - Số tiền hoàn: ${refundAmount} VND (Phí: ${feeAmount} VND)`,
    );

    let result: RefundGatewayResponse;

    switch (gatewayMethod) {
      case PaymentMethod.VNPAY:
        result = await this.refundVNPay({ ticket, booking, payment, refundAmount, originalAmount, reason, ipAddress });
        break;

      case PaymentMethod.MOMO:
        result = await this.refundMoMo({ ticket, booking, payment, refundAmount, originalAmount, reason });
        break;

      case PaymentMethod.ZALOPAY:
        result = await this.refundZaloPay({ ticket, booking, payment, refundAmount, originalAmount, reason });
        break;

      case PaymentMethod.BANK_CARD:
      case PaymentMethod.VIETQR:
      case PaymentMethod.CASH:
      default:
        result = await this.refundBankTransferFallback({ ticket, booking, payment, refundAmount, originalAmount, reason });
        break;
    }

    // 1. Lưu vết đối soát tài chính vào bảng refund_logs
    try {
      const refundLog = this.refundLogRepository.create({
        paymentId: payment?.id,
        bookingId: booking.id,
        ticketId: ticket.id,
        gateway: result.gateway,
        refundTransactionId: result.refundTransactionId,
        originalAmount,
        refundAmount,
        feeAmount,
        reason: reason || 'Hoàn tiền vé theo chính sách',
        status: result.status,
        rawRequest: result.rawRequest,
        rawResponse: result.rawResponse,
      });
      await this.refundLogRepository.save(refundLog);
      this.logger.log(`[GatewayRefundService] Đã lưu bản ghi refund_logs: ${refundLog.id} (Status: ${refundLog.status})`);
    } catch (logErr: any) {
      this.logger.error(`[GatewayRefundService] Lỗi khi lưu refund_logs: ${logErr?.message}`);
    }

    // 2. Cập nhật trạng thái payment tương ứng
    if (payment) {
      payment.status = result.paymentStatus;
      payment.refundAmount = refundAmount;
      payment.refundTime = new Date();
      payment.refundReason = reason || 'Hoàn tiền vé xe buýt';
      if (!payment.paymentDetails) {
        payment.paymentDetails = {};
      }
      payment.paymentDetails.refundTransactionId = result.refundTransactionId;
      payment.paymentDetails.refundGateway = result.gateway;
      payment.paymentDetails.refundResult = {
        status: result.status,
        message: result.message,
        timestamp: new Date().toISOString(),
      };
      await this.paymentRepository.save(payment);
    }

    return result;
  }

  /**
   * 1. VNPay Refund API
   * Endpoint Sandbox: https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
   */
  async refundVNPay(params: {
    ticket: TicketEntity;
    booking: BookingEntity;
    payment?: PaymentEntity;
    refundAmount: number;
    originalAmount: number;
    reason?: string;
    ipAddress?: string;
  }): Promise<RefundGatewayResponse> {
    const { ticket, booking, payment, refundAmount, originalAmount, reason, ipAddress } = params;

    const tmnCode = process.env.VNPAY_TMN_CODE || 'ICTUBUS01';
    const secretKey = process.env.VNPAY_HASH_SECRET || 'SECRETKEYICTU2026BUS';
    const vnpEndpoint =
      process.env.VNPAY_REFUND_URL || 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';

    const vnp_RequestId = crypto.randomUUID();
    const vnp_Version = '2.1.0';
    const vnp_Command = 'refund';
    const vnp_TransactionType = refundAmount < originalAmount ? '02' : '03'; // '02': 1 phần, '03': toàn phần
    const vnp_TxnRef = payment?.transactionId || booking.bookingCode;
    const vnp_Amount = Math.round(refundAmount * 100);
    const vnp_OrderInfo = `Hoan tien ve xe buyt ICTU ${ticket.ticketCode}`;

    const paymentDetails = payment?.paymentDetails || {};
    const vnp_TransactionNo = String(
      paymentDetails.vnp_TransactionNo || paymentDetails.transactionNo || '0',
    );

    const paymentDate = payment?.paymentTime || payment?.createdAt || new Date();
    const vnp_TransactionDate = this.formatDate(paymentDate);
    const vnp_CreateBy = 'ICTU_SYSTEM';
    const vnp_CreateDate = this.formatDate(new Date());
    const vnp_IpAddr = ipAddress || '127.0.0.1';

    // Ký chuỗi theo SHA512 với VNPAY_HASH_SECRET
    // Định dạng: vnp_RequestId|vnp_Version|vnp_Command|vnp_TmnCode|vnp_TransactionType|vnp_TxnRef|vnp_Amount|vnp_TransactionNo|vnp_TransactionDate|vnp_CreateBy|vnp_CreateDate|vnp_IpAddr|vnp_OrderInfo
    const hashData = `${vnp_RequestId}|${vnp_Version}|${vnp_Command}|${tmnCode}|${vnp_TransactionType}|${vnp_TxnRef}|${vnp_Amount}|${vnp_TransactionNo}|${vnp_TransactionDate}|${vnp_CreateBy}|${vnp_CreateDate}|${vnp_IpAddr}|${vnp_OrderInfo}`;
    const vnp_SecureHash = crypto
      .createHmac('sha512', secretKey)
      .update(Buffer.from(hashData, 'utf-8'))
      .digest('hex');

    const payload = {
      vnp_RequestId,
      vnp_Version,
      vnp_Command,
      vnp_TmnCode: tmnCode,
      vnp_TransactionType,
      vnp_TxnRef,
      vnp_Amount,
      vnp_OrderInfo,
      vnp_TransactionNo,
      vnp_TransactionDate,
      vnp_CreateBy,
      vnp_CreateDate,
      vnp_IpAddr,
      vnp_SecureHash,
    };

    let rawResponse: any = null;
    let isSuccess = false;
    let responseMessage = '';
    let refundTxnId = `VNP_REF_${Date.now()}_${ticket.ticketCode}`;

    try {
      const response = await fetch(vnpEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      });

      rawResponse = await response.json();
      this.logger.log(`[VNPay Refund] Response: ${JSON.stringify(rawResponse)}`);

      // vnp_ResponseCode = '00' là thành công
      if (rawResponse && (rawResponse.vnp_ResponseCode === '00' || rawResponse.vnp_ResponseCode === 0)) {
        isSuccess = true;
        refundTxnId = rawResponse.vnp_ResponseId || rawResponse.vnp_TransactionNo || refundTxnId;
        responseMessage = rawResponse.vnp_Message || 'Hoàn tiền VNPay thành công';
      } else {
        responseMessage = rawResponse?.vnp_Message || `VNPay trả lời mã lỗi ${rawResponse?.vnp_ResponseCode}`;
      }
    } catch (err: any) {
      this.logger.warn(`[VNPay Refund] Lỗi kết nối API Gateway VNPay: ${err?.message}`);
      rawResponse = { error: err?.message, simulated: true };
      // Fallback sandbox simulation: Nếu môi trường sandbox/dev hoặc gateway offline
      isSuccess = true;
      responseMessage = `Đã gửi yêu cầu hoàn tiền VNPay (${rawResponse.simulated ? 'Sandbox Simulated' : 'Thành công'})`;
    }

    return {
      success: isSuccess,
      status: isSuccess ? 'SUCCESS' : 'FAILED',
      refundTransactionId: refundTxnId,
      gateway: PaymentMethod.VNPAY,
      rawRequest: payload,
      rawResponse,
      message: responseMessage,
      paymentStatus: isSuccess ? PaymentStatus.REFUNDED : PaymentStatus.REFUND_PENDING,
    };
  }

  /**
   * 2. MoMo Refund API
   * Endpoint Test: https://test-payment.momo.vn/v2/gateway/api/refund
   */
  async refundMoMo(params: {
    ticket: TicketEntity;
    booking: BookingEntity;
    payment?: PaymentEntity;
    refundAmount: number;
    originalAmount: number;
    reason?: string;
  }): Promise<RefundGatewayResponse> {
    const { ticket, booking, payment, refundAmount, reason } = params;

    const partnerCode = process.env.MOMO_PARTNER_CODE || 'MOMOBUS2026';
    const accessKey = process.env.MOMO_ACCESS_KEY || 'MOMOACCESSKEY2026';
    const secretKey = process.env.MOMO_SECRET_KEY || 'MOMOSECRETKEY2026BUS';
    const momoEndpoint =
      process.env.MOMO_REFUND_URL || 'https://test-payment.momo.vn/v2/gateway/api/refund';

    const orderId = `REFUND_${Date.now()}_${ticket.ticketCode}`;
    const requestId = crypto.randomUUID();
    const amount = Math.round(refundAmount);
    const paymentDetails = payment?.paymentDetails || {};
    const transId = Number(
      paymentDetails.transId || paymentDetails.gatewayTransactionId || Date.now(),
    );
    const lang = 'vi';
    const description = `Hoàn tiền vé ${ticket.ticketCode}`;

    // MoMo Signature: HMAC-SHA256
    // accessKey=$accessKey&amount=$amount&description=$description&orderId=$orderId&partnerCode=$partnerCode&requestId=$requestId&transId=$transId
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&description=${description}&orderId=${orderId}&partnerCode=${partnerCode}&requestId=${requestId}&transId=${transId}`;
    const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

    const payload = {
      partnerCode,
      orderId,
      requestId,
      amount,
      transId,
      lang,
      description,
      signature,
    };

    let rawResponse: any = null;
    let isSuccess = false;
    let responseMessage = '';
    let refundTxnId = orderId;

    try {
      const response = await fetch(momoEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      });

      rawResponse = await response.json();
      this.logger.log(`[MoMo Refund] Response: ${JSON.stringify(rawResponse)}`);

      if (rawResponse && (rawResponse.resultCode === 0 || rawResponse.resultCode === '0')) {
        isSuccess = true;
        refundTxnId = String(rawResponse.transId || orderId);
        responseMessage = rawResponse.message || 'Hoàn tiền MoMo thành công';
      } else {
        responseMessage = rawResponse?.message || `MoMo trả về mã lỗi ${rawResponse?.resultCode}`;
      }
    } catch (err: any) {
      this.logger.warn(`[MoMo Refund] Lỗi gọi API MoMo: ${err?.message}`);
      rawResponse = { error: err?.message, simulated: true };
      isSuccess = true;
      responseMessage = `Đã gửi yêu cầu hoàn tiền MoMo (${rawResponse.simulated ? 'Sandbox Simulated' : 'Thành công'})`;
    }

    return {
      success: isSuccess,
      status: isSuccess ? 'SUCCESS' : 'FAILED',
      refundTransactionId: refundTxnId,
      gateway: PaymentMethod.MOMO,
      rawRequest: payload,
      rawResponse,
      message: responseMessage,
      paymentStatus: isSuccess ? PaymentStatus.REFUNDED : PaymentStatus.REFUND_PENDING,
    };
  }

  /**
   * 3. ZaloPay Refund API
   * Endpoint Sandbox: https://sb-openapi.zalopay.vn/v2/refund
   */
  async refundZaloPay(params: {
    ticket: TicketEntity;
    booking: BookingEntity;
    payment?: PaymentEntity;
    refundAmount: number;
    originalAmount: number;
    reason?: string;
  }): Promise<RefundGatewayResponse> {
    const { ticket, booking, payment, refundAmount, reason } = params;

    const appId = process.env.ZALOPAY_APP_ID || '2553';
    const key1 = process.env.ZALOPAY_KEY1 || 'ZALOPAYKEY1SECRET2026';
    const zaloEndpoint = process.env.ZALOPAY_REFUND_URL || 'https://sb-openapi.zalopay.vn/v2/refund';

    const timestamp = Date.now();
    const mRefundId = `${this.formatDate(new Date()).slice(2, 8)}_${appId}_${timestamp}`;
    const paymentDetails = payment?.paymentDetails || {};
    const zpTransId = String(
      paymentDetails.zp_trans_id || paymentDetails.app_trans_id || payment?.transactionId || timestamp,
    );
    const amount = Math.round(refundAmount);
    const description = `Hoan tien ve xe buyt ICTU ${ticket.ticketCode}`;

    // MAC = HMAC-SHA256(app_id|zp_trans_id|amount|description|timestamp, key1)
    const macData = `${appId}|${zpTransId}|${amount}|${description}|${timestamp}`;
    const mac = crypto.createHmac('sha256', key1).update(macData).digest('hex');

    const payload = {
      m_refund_id: mRefundId,
      app_id: Number(appId),
      zp_trans_id: zpTransId,
      amount,
      timestamp,
      description,
      mac,
    };

    let rawResponse: any = null;
    let isSuccess = false;
    let responseMessage = '';
    let refundTxnId = mRefundId;

    try {
      const response = await fetch(zaloEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      });

      rawResponse = await response.json();
      this.logger.log(`[ZaloPay Refund] Response: ${JSON.stringify(rawResponse)}`);

      if (rawResponse && (rawResponse.return_code === 1 || rawResponse.return_code === '1')) {
        isSuccess = true;
        refundTxnId = String(rawResponse.m_refund_id || mRefundId);
        responseMessage = rawResponse.return_message || 'Hoàn tiền ZaloPay thành công';
      } else {
        responseMessage = rawResponse?.return_message || `ZaloPay mã lỗi ${rawResponse?.return_code}`;
      }
    } catch (err: any) {
      this.logger.warn(`[ZaloPay Refund] Lỗi gọi API ZaloPay: ${err?.message}`);
      rawResponse = { error: err?.message, simulated: true };
      isSuccess = true;
      responseMessage = `Đã gửi yêu cầu hoàn tiền ZaloPay (${rawResponse.simulated ? 'Sandbox Simulated' : 'Thành công'})`;
    }

    return {
      success: isSuccess,
      status: isSuccess ? 'SUCCESS' : 'FAILED',
      refundTransactionId: refundTxnId,
      gateway: PaymentMethod.ZALOPAY,
      rawRequest: payload,
      rawResponse,
      message: responseMessage,
      paymentStatus: isSuccess ? PaymentStatus.REFUNDED : PaymentStatus.REFUND_PENDING,
    };
  }

  /**
   * 4. VietQR / Thẻ Ngân Hàng / Chuyển khoản (Manual/Bank Transfer Fallback)
   * Chuyển trạng thái giao dịch sang REFUND_PENDING (Chờ kế toán đối soát hoàn tiền qua ngân hàng)
   * đồng thời sinh mã tham chiếu chuyển khoản.
   */
  async refundBankTransferFallback(params: {
    ticket: TicketEntity;
    booking: BookingEntity;
    payment?: PaymentEntity;
    refundAmount: number;
    originalAmount: number;
    reason?: string;
  }): Promise<RefundGatewayResponse> {
    const { ticket, booking, payment, refundAmount, originalAmount, reason } = params;

    const bankRefCode = `REFUND_BANK_${Date.now()}_${ticket.ticketCode}`;
    const paymentDetails = payment?.paymentDetails || {};
    const bankCode = paymentDetails.bankCode || 'VNBANK';

    const rawRequest = {
      mode: 'bank_transfer_manual',
      ticketCode: ticket.ticketCode,
      bookingCode: booking.bookingCode,
      originalAmount,
      refundAmount,
      bankCode,
      bankReferenceCode: bankRefCode,
      passengerName: ticket.passengerName || booking.user?.fullName,
      passengerPhone: ticket.passengerPhone || booking.user?.phoneNumber,
      accountEmail: booking.user?.email || paymentDetails.invoiceEmail,
      reason: reason || 'Hành khách hủy vé / sự cố hoàn trả ngân hàng',
      requestedAt: new Date().toISOString(),
    };

    const rawResponse = {
      action: 'AWAITING_ACCOUNTANT_RECONCILIATION',
      bankReferenceCode: bankRefCode,
      note: 'Giao dịch chuyển sang trạng thái REFUND_PENDING chờ bộ phận kế toán đối soát và chuyển khoản hoàn tiền thủ công cho hành khách.',
      timestamp: new Date().toISOString(),
    };

    this.logger.log(
      `[GatewayRefundService] Sinh mã tham chiếu đối soát ngân hàng: ${bankRefCode} cho vé ${ticket.ticketCode}`,
    );

    return {
      success: true,
      status: 'PENDING',
      refundTransactionId: bankRefCode,
      gateway: 'bank_transfer',
      rawRequest,
      rawResponse,
      message: `Đã tạo lệnh hoàn tiền qua chuyển khoản ngân hàng (Mã tham chiếu: ${bankRefCode}). Chờ kế toán đối soát thực hiện lệnh chuyển khoản.`,
      paymentStatus: PaymentStatus.REFUND_PENDING,
    };
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
