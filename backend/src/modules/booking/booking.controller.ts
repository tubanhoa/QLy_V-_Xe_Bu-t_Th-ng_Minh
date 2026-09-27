import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
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
} from './dto/booking.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

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

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post('tickets/:id/resend-email')
  @ApiOperation({ summary: 'Gửi lại email vé điện tử kèm mã QR' })
  async resendTicketEmail(
    @Param('id') ticketId: string,
    @CurrentUser('id') userId: string,
    @Body('email') customEmail?: string,
  ) {
    return this.bookingService.resendTicketEmail(ticketId, userId, customEmail);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post('cancel/:ticketId')
  @ApiOperation({ summary: 'Hủy vé trước giờ khởi hành > 2 tiếng' })
  async cancelTicket(@Param('ticketId') ticketId: string, @CurrentUser('id') userId: string) {
    return this.bookingService.cancelTicket(ticketId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post('exchange/:ticketId')
  @ApiOperation({ summary: 'Đổi vé sang chuyến hoặc ghế mới' })
  async exchangeTicket(
    @Param('ticketId') ticketId: string,
    @Body() dto: ExchangeTicketDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.bookingService.exchangeTicket(ticketId, dto, userId);
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
