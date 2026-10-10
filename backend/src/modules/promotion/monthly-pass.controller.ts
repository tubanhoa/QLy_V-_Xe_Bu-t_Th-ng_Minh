import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MonthlyPassService } from './monthly-pass.service.js';
import {
  CalculateMonthlyPassPriceDto,
  RegisterMonthlyPassDto,
  ResubmitMonthlyPassProofDto,
  ReviewMonthlyPassDto,
  CreateMonthlyPassPaymentDto,
  ConfirmMonthlyPassPaymentDto,
  RenewMonthlyPassDto,
  ListAdminMonthlyPassesQueryDto,
} from './dto/promotion.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { ApprovalStatus } from '../../common/constants/status.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Monthly Passes')
@Controller()
export class MonthlyPassController {
  constructor(private readonly monthlyPassService: MonthlyPassService) {}

  @Post('monthly-passes/calculate-price')
  @ApiOperation({ summary: 'Tính giá vé tháng theo đối tượng, kỳ hạn và phạm vi tuyến' })
  calculatePrice(@Body() dto: CalculateMonthlyPassPriceDto) {
    return this.monthlyPassService.calculatePrice(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post('monthly-passes/register')
  @ApiOperation({ summary: 'Đăng ký vé tháng xe buýt (Sinh viên, người cao tuổi, công nhân)' })
  async register(@Body() dto: RegisterMonthlyPassDto, @CurrentUser('id') userId: string) {
    return this.monthlyPassService.register(dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get('monthly-passes/my-passes')
  @ApiOperation({ summary: 'Danh sách vé tháng của người dùng' })
  async getMyPasses(@CurrentUser('id') userId: string) {
    return this.monthlyPassService.getMyPasses(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get('monthly-passes/:id')
  @ApiOperation({ summary: 'Xem chi tiết vé tháng' })
  async getPassDetail(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole?: string,
  ) {
    const isAdmin = userRole === Role.ADMIN || userRole === Role.MANAGER;
    return this.monthlyPassService.getPassDetail(id, userId, isAdmin);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get('monthly-passes/:id/history')
  @ApiOperation({ summary: 'Xem lịch sử giao dịch và gia hạn vé tháng' })
  async getPassHistory(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole?: string,
  ) {
    const isAdmin = userRole === Role.ADMIN || userRole === Role.MANAGER;
    return this.monthlyPassService.getPassHistory(id, userId, isAdmin);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post('monthly-passes/:id/create-payment')
  @ApiOperation({ summary: 'Tạo thông tin thanh toán cho vé tháng (VietQR / MoMo / VNPAY)' })
  async createPayment(
    @Param('id') id: string,
    @Body() dto: CreateMonthlyPassPaymentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.monthlyPassService.createPayment(id, dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post('monthly-passes/:id/confirm-payment')
  @ApiOperation({ summary: 'Xác nhận thanh toán vé tháng (Hỗ trợ Demo Quick Pay)' })
  async confirmPayment(
    @Param('id') id: string,
    @Body() dto: ConfirmMonthlyPassPaymentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.monthlyPassService.confirmPayment(id, dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post('monthly-passes/:id/renew')
  @ApiOperation({ summary: 'Gia hạn vé tháng trực tuyến (Cộng dồn thời hạn)' })
  async renew(
    @Param('id') id: string,
    @Body() dto: RenewMonthlyPassDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.monthlyPassService.renew(id, dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Patch('monthly-passes/:id/resubmit-proof')
  @ApiOperation({ summary: 'Cập nhật ảnh minh chứng mới khi bị từ chối và gửi lại yêu cầu duyệt' })
  async resubmitProof(
    @Param('id') id: string,
    @Body() dto: ResubmitMonthlyPassProofDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.monthlyPassService.resubmitProof(id, dto, userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT')
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('admin/monthly-passes')
  @ApiOperation({ summary: 'Danh sách hồ sơ đăng ký vé tháng (Manager, Admin)' })
  async getAdminPasses(
    @Query() query: ListAdminMonthlyPassesQueryDto,
  ) {
    return this.monthlyPassService.getAdminPasses(query, query.status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT')
  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch('admin/monthly-passes/:id/review')
  @ApiOperation({ summary: 'Duyệt hoặc từ chối hồ sơ đăng ký vé tháng (Manager, Admin)' })
  async review(
    @Param('id') id: string,
    @Body() dto: ReviewMonthlyPassDto,
    @CurrentUser('id') reviewerId: string,
  ) {
    return this.monthlyPassService.review(id, dto, reviewerId);
  }
}
