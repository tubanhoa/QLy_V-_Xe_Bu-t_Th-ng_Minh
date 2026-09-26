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
import { CreatePaymentUrlDto, RefundTicketDto } from './dto/payment.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Payments')
@Controller('api/v1/payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post('create-url')
  @ApiOperation({ summary: 'Tạo URL thanh toán VNPay / MoMo / VietQR' })
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Post('refund/:ticketId')
  @ApiOperation({ summary: 'Hoàn tiền vé bị hủy theo chính sách (Manager, Admin)' })
  async refundTicket(@Param('ticketId') ticketId: string, @Body() dto: RefundTicketDto) {
    return this.paymentService.refundTicket(ticketId, dto);
  }
}
