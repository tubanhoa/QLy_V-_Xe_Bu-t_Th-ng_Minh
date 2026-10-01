import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { PaymentService } from './payment.service.js';
import {
  CreatePaymentUrlDto,
  RefundTicketDto,
  MoMoIpnDto,
  ZaloPayIpnDto,
  ReconciliationQueryDto,
  GetRefundLogsQueryDto,
} from './dto/payment.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RateLimitGuard, RateLimit } from '../../common/guards/rate-limit.guard.js';

@ApiTags('Payments')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post('create-url')
  @ApiOperation({ summary: 'Tạo URL thanh toán VNPay / MoMo / ZaloPay / BankCard / VietQR' })
  async createPaymentUrl(@Body() dto: CreatePaymentUrlDto, @Req() req: Request) {
    const ip = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress;
    return this.paymentService.createPaymentUrl(dto, ip);
  }

  @Public()
  @Get('vnpay-return')
  @ApiOperation({ summary: 'Callback redirect từ VNPay sau khi khách thanh toán' })
  async handleVNPayReturn(@Query() query: Record<string, string>) {
    return this.paymentService.handleVNPayReturn(query);
  }

  @Public()
  @Get('vnpay-ipn')
  @ApiOperation({ summary: 'Webhook IPN từ VNPay (GET)' })
  async handleVNPayIpnGet(@Query() query: Record<string, string>) {
    return this.paymentService.handleVNPayIpn(query);
  }

  @Public()
  @Post('vnpay-ipn')
  @ApiOperation({ summary: 'Webhook IPN từ VNPay (POST)' })
  async handleVNPayIpnPost(@Query() query: Record<string, string>, @Body() body: Record<string, string>) {
    const params = { ...query, ...body };
    return this.paymentService.handleVNPayIpn(params);
  }

  @Public()
  @Post('momo-ipn')
  @ApiOperation({ summary: 'Webhook IPN từ MoMo (POST)' })
  async handleMoMoIpn(@Body() dto: MoMoIpnDto, @Req() req: Request) {
    const ip = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress;
    return this.paymentService.handleMoMoIpn(dto, ip);
  }

  @Public()
  @Post('zalopay-ipn')
  @ApiOperation({ summary: 'Webhook IPN từ ZaloPay (POST)' })
  async handleZaloPayIpn(@Body() dto: ZaloPayIpnDto, @Req() req: Request) {
    const ip = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress;
    return this.paymentService.handleZaloPayIpn(dto, ip);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get('logs/:paymentId')
  @ApiOperation({ summary: 'Lấy danh sách nhật ký giao dịch (Payment Logs)' })
  async getPaymentLogs(@Param('paymentId') paymentId: string) {
    return this.paymentService.getPaymentLogs(paymentId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Get('reconciliation')
  @ApiOperation({ summary: 'Báo cáo đối soát giao dịch thanh toán (Admin / Manager)' })
  async getReconciliationReport(@Query() query: ReconciliationQueryDto) {
    return this.paymentService.getReconciliationReport(query);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post('cancel/:bookingId')
  @ApiOperation({ summary: 'Hủy thanh toán đơn đặt vé và giải phóng ghế lập tức' })
  async cancelPayment(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentService.cancelPayment(bookingId, userId);
  }

  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({
    limit: 3,
    windowSeconds: 600,
    perTicketLimit: 1,
    perTicketWindowSeconds: 60,
    actionName: 'kích hoạt hoàn tiền vé xe',
  })
  @ApiBearerAuth('JWT')
  @Post('refund/:ticketId')
  @ApiOperation({ summary: 'Kích hoạt hoàn tiền cho vé xe đã hủy (Chống spam: 1 lần/60s/vé, tối đa 3 lần/10 phút)' })
  async refundTicket(
    @Param('ticketId') ticketId: string,
    @Body() dto: RefundTicketDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentService.refundTicket(ticketId, dto, userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, 'ADMIN' as any, 'MANAGER' as any)
  @ApiBearerAuth('JWT')
  @Get(['refund-logs', 'refunds'])
  @ApiOperation({ summary: 'Lấy danh sách log hoàn tiền phục vụ đối soát tài chính' })
  async getRefundLogs(@Query() query: GetRefundLogsQueryDto) {
    return this.paymentService.getRefundLogs(query);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get(['refunds/ticket/:ticketId', 'tickets/:ticketId/refund'])
  @ApiOperation({ summary: 'Lấy thông tin chi tiết hoàn tiền của vé xe (Hành khách hoặc Quản trị viên)' })
  async getRefundDetailByTicket(
    @Param('ticketId') ticketId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole?: string,
  ) {
    return this.paymentService.getRefundDetailByTicketId(ticketId, userId, userRole);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, 'ADMIN' as any, 'MANAGER' as any)
  @ApiBearerAuth('JWT')
  @Get(['refund-logs/:id', 'refunds/:id'])
  @ApiOperation({ summary: 'Xem chi tiết biên bản hoàn tiền và payload đối chiếu của cổng thanh toán' })
  async getRefundLogDetail(@Param('id') id: string) {
    return this.paymentService.getRefundLogDetail(id);
  }
}

