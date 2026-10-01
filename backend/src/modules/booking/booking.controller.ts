import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Headers,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BookingService } from './booking.service.js';
import {
  HoldSeatsDto,
  CreateBookingDto,
  SearchTripsDto,
  ExchangeTicketDto,
  CancelTicketDto,
  HoldExchangeSeatDto,
  ConfirmExchangeDto,
  ResendTicketByCodeDto,
} from './dto/booking.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RateLimitGuard, RateLimit } from '../../common/guards/rate-limit.guard.js';

@ApiTags('Booking & Tickets')
// TODO: xoá alias VERSION_NEUTRAL và alias 'bookings' sau khi Frontend xác nhận đã đổi hoàn toàn sang /api/v1/booking
@Controller({
  path: ['booking', 'bookings'],
  version: ['1', VERSION_NEUTRAL],
})
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm chuyến xe theo điểm xuất phát, điểm đến và ngày đi' })
  async searchTrips(@Query() dto: SearchTripsDto) {
    return this.bookingService.searchTrips(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post(['hold-seats', 'hold-seat'])
  @ApiOperation({ summary: 'Giữ chỗ ghế tạm thời trong 10 phút (Redis SETNX + TTL)' })
  async holdSeats(@Body() dto: HoldSeatsDto, @CurrentUser('id') userId: string) {
    return this.bookingService.holdSeats(dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post('release-seats')
  @ApiOperation({ summary: 'Hủy giữ chỗ ghế sớm' })
  async releaseSeats(@Body() dto: HoldSeatsDto, @CurrentUser('id') userId: string) {
    return this.bookingService.releaseSeats(dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post('create')
  @ApiOperation({ summary: 'Tạo đơn đặt vé và xuất vé QR (chữ ký số HMAC-SHA256)' })
  async createBooking(@Body() dto: CreateBookingDto, @CurrentUser('id') userId: string) {
    return this.bookingService.createBooking(dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get('my-tickets')
  @ApiOperation({ summary: 'Lịch sử vé đã mua của hành khách' })
  async getMyTickets(@CurrentUser('id') userId: string, @Query() pagination: PaginationDto) {
    return this.bookingService.getMyTickets(userId, pagination);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get('my-tickets/:id')
  @ApiOperation({ summary: 'Chi tiết vé và hiển thị mã QR điện tử của hành khách' })
  async getTicketDetail(@Param('id') ticketId: string, @CurrentUser('id') userId: string) {
    return this.bookingService.getTicketDetail(ticketId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get('tickets/:id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết vé điện tử và dữ liệu mã QR (Hành khách hoặc Nhân viên)' })
  async getTicketDetailById(
    @Param('id') ticketId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole?: string,
  ) {
    return this.bookingService.getTicketDetail(ticketId, userId, userRole);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get('tickets/:id/qr')
  @ApiOperation({ summary: 'Lấy thông tin mã QR chứa dữ liệu mã hóa của vé' })
  async getTicketQr(
    @Param('id') ticketId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole?: string,
  ) {
    return this.bookingService.getTicketQr(ticketId, userId, userRole);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({
    limit: 3,
    windowSeconds: 600,
    perTicketLimit: 1,
    perTicketWindowSeconds: 60,
    actionName: 'gửi lại email vé điện tử',
  })
  @ApiBearerAuth('JWT')
  @Post('tickets/:id/resend-email')
  @ApiOperation({ summary: 'Gửi lại email vé điện tử kèm mã QR (Chống spam: 1 lần/60s/vé, tối đa 3 lần/10 phút)' })
  async resendTicketEmail(
    @Param('id') ticketId: string,
    @CurrentUser('id') userId?: string,
    @Body('email') customEmail?: string,
  ) {
    return this.bookingService.resendTicketEmail(ticketId, userId || undefined, customEmail);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({
    limit: 3,
    windowSeconds: 600,
    perTicketLimit: 1,
    perTicketWindowSeconds: 60,
    actionName: 'gửi lại email vé điện tử',
  })
  @Post('tickets/resend-by-code')
  @ApiOperation({ summary: 'Gửi lại email vé điện tử theo mã vé hoặc mã đơn đặt (Công khai cho khách vãng lai)' })
  async resendTicketEmailByCode(
    @Body() dto: ResendTicketByCodeDto,
  ) {
    return this.bookingService.resendTicketEmailByCode(
      dto.ticketCode || dto.bookingCode,
      dto.email,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get(['tickets/:ticketId/cancellation-policy', ':ticketId/cancellation-policy'])
  @ApiOperation({ summary: 'Kiểm tra điều kiện hủy/đổi vé và tính phí theo thời gian thực' })
  async getCancellationPolicy(
    @Param('ticketId') ticketId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.bookingService.getCancellationPolicy(ticketId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post(['tickets/:ticketId/cancel', 'cancel/:ticketId'])
  @ApiOperation({ summary: 'Gửi yêu cầu hủy vé, giải phóng ghế trống và tự động hoàn tiền' })
  async cancelTicket(
    @Param('ticketId') ticketId: string,
    @Body() dto: CancelTicketDto,
    @CurrentUser('id') userId: string,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
    @Headers('x-idempotency-key') xIdempotencyKeyHeader?: string,
  ) {
    const key = idempotencyKeyHeader || xIdempotencyKeyHeader || dto?.idempotencyKey;
    return this.bookingService.cancelTicket(ticketId, userId, { ...dto, idempotencyKey: key });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get(['tickets/:ticketId/exchange-trips', 'exchange-trips/:ticketId'])
  @ApiOperation({ summary: 'Tìm kiếm chuyến xe thay thế cho luồng đổi vé' })
  async getExchangeTrips(
    @Param('ticketId') ticketId: string,
    @Query('date') date: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.bookingService.getExchangeTrips(ticketId, userId, date);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post(['tickets/:ticketId/hold-exchange-seat', 'hold-exchange-seat/:ticketId'])
  @ApiOperation({ summary: 'Tạm giữ ghế mới 10 phút cho luồng đổi vé (bảo toàn ghế cũ)' })
  async holdExchangeSeat(
    @Param('ticketId') ticketId: string,
    @Body() dto: HoldExchangeSeatDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.bookingService.holdExchangeSeat(ticketId, dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post(['tickets/:ticketId/confirm-exchange', 'tickets/:ticketId/exchange', 'exchange/:ticketId'])
  @ApiOperation({ summary: 'Xác nhận đổi chuyến, tính chênh lệch giá vé và cấp vé QR mới' })
  async confirmExchange(
    @Param('ticketId') ticketId: string,
    @Body() dto: ConfirmExchangeDto,
    @CurrentUser('id') userId: string,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
    @Headers('x-idempotency-key') xIdempotencyKeyHeader?: string,
  ) {
    const key = idempotencyKeyHeader || xIdempotencyKeyHeader || dto?.idempotencyKey;
    return this.bookingService.confirmExchange(ticketId, { ...dto, idempotencyKey: key }, userId);
  }


  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post('cancel-booking/:bookingId')
  @ApiOperation({ summary: 'Hủy đơn đặt vé khi chưa thanh toán và giải phóng ghế ngay lập tức' })
  async cancelBooking(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.bookingService.cancelBooking(bookingId, userId);
  }

  @Public()
  @Post('cleanup-expired')
  @ApiOperation({ summary: 'Quét và cập nhật trạng thái các ghế giữ hoặc đơn vé đã hết hạn' })
  async cleanupExpiredHolds() {
    return this.bookingService.cleanupExpiredHolds();
  }
}
