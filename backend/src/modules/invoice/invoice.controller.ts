import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Res,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { IsEmail, IsOptional } from 'class-validator';
import { InvoiceService } from './invoice.service.js';
import { Public } from '../../common/decorators/public.decorator.js';

export class ResendEmailDto {
  @IsOptional()
  @IsEmail({}, { message: 'Địa chỉ email nhận hóa đơn không hợp lệ' })
  email?: string;
}

@ApiTags('Invoices - Hóa Đơn Điện Tử')
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Public()
  @Get('lookup')
  @ApiOperation({ summary: 'Tra cứu hóa đơn điện tử trực tuyến bằng mã tra cứu (Lookup Code)' })
  @ApiQuery({ name: 'code', description: 'Mã tra cứu hóa đơn bí mật (ví dụ: ICTU-A9F34D12)' })
  @ApiQuery({ name: 'invoice', required: false, description: 'Số hóa đơn (ví dụ: INV-20261001-1234)' })
  async lookupInvoice(
    @Query('code') lookupCode: string,
    @Query('invoice') invoiceNumber?: string,
  ) {
    if (!lookupCode) {
      throw new BadRequestException('Vui lòng cung cấp mã tra cứu hóa đơn (code)');
    }
    return this.invoiceService.lookupInvoice(lookupCode, invoiceNumber);
  }

  @Public()
  @Get('booking/:bookingCode')
  @ApiOperation({ summary: 'Lấy thông tin hóa đơn theo mã đơn đặt vé' })
  async getByBookingCode(@Param('bookingCode') bookingCode: string) {
    return this.invoiceService.getInvoiceByBookingCode(bookingCode);
  }

  @Public()
  @Get('booking/:bookingCode/pdf')
  @ApiOperation({ summary: 'Tải tệp PDF hóa đơn điện tử theo mã đơn đặt vé' })
  async downloadPdfByBookingCode(
    @Param('bookingCode') bookingCode: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.invoiceService.downloadPdf(bookingCode);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  }

  @Public()
  @Post('booking/:bookingCode/resend-email')
  @ApiOperation({ summary: 'Gửi lại hóa đơn qua email theo mã đơn đặt vé từ lịch sử giao dịch' })
  async resendEmailByBookingCode(
    @Param('bookingCode') bookingCode: string,
    @Body() dto: ResendEmailDto,
  ) {
    return this.invoiceService.resendInvoiceEmail(bookingCode, dto?.email);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết hóa đơn điện tử theo ID hoặc Số hóa đơn' })
  async getById(@Param('id') id: string) {
    return this.invoiceService.getInvoiceByIdOrNumber(id);
  }

  @Public()
  @Get(':id/html')
  @ApiOperation({ summary: 'Xem trước hóa đơn điện tử giao diện chuẩn HTML' })
  async getInvoiceHtml(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const html = await this.invoiceService.getInvoiceHtmlContent(id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Public()
  @Get(':id/pdf')
  @ApiOperation({ summary: 'Tải về hóa đơn điện tử dạng tệp PDF' })
  async downloadPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.invoiceService.downloadPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  }

  @Public()
  @Post(':id/resend-email')
  @ApiOperation({ summary: 'Gửi lại hóa đơn điện tử qua email cho hành khách' })
  async resendEmail(
    @Param('id') id: string,
    @Body() dto: ResendEmailDto,
  ) {
    return this.invoiceService.resendInvoiceEmail(id, dto?.email);
  }

  @Public()
  @Post('payment/:paymentId/generate')
  @ApiOperation({ summary: 'Khởi tạo hóa đơn điện tử thủ công cho giao dịch thanh toán' })
  async generateForPayment(@Param('paymentId') paymentId: string) {
    return this.invoiceService.generateAndSendInvoiceForPayment(paymentId);
  }
}
