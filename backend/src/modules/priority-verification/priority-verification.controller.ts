import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PriorityVerificationService } from './priority-verification.service.js';
import { CreatePriorityVerificationDto } from './dto/create-priority-verification.dto.js';
import { ReviewPriorityVerificationDto } from './dto/review-priority-verification.dto.js';
import { ListPriorityVerificationsQueryDto } from './dto/list-priority-verifications-query.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';

@ApiTags('Priority Verification (HSSV & Người Cao Tuổi)')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller()
export class PriorityVerificationController {
  constructor(
    private readonly priorityVerificationService: PriorityVerificationService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. ENDPOINTS DÀNH CHO KHÁCH HÀNG (PASSENGER)
  // ---------------------------------------------------------------------------
  @Post(['users/priority-verification', 'priority-verifications'])
  @ApiOperation({
    summary: 'Khách hàng gửi yêu cầu xác thực đối tượng ưu đãi (HSSV / Người cao tuổi)',
  })
  @ApiResponse({ status: 201, description: 'Gửi hồ sơ thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc đang có hồ sơ chờ duyệt' })
  async submitVerification(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePriorityVerificationDto,
  ) {
    return this.priorityVerificationService.submitVerification(userId, dto);
  }

  @Get(['users/priority-verification/my', 'priority-verifications/my'])
  @ApiOperation({
    summary: 'Khách hàng tra cứu trạng thái và lịch sử hồ sơ xác thực ưu đãi của mình',
  })
  async getMyVerifications(@CurrentUser('id') userId: string) {
    return this.priorityVerificationService.getMyVerifications(userId);
  }

  // ---------------------------------------------------------------------------
  // 2. ENDPOINTS DÀNH CHO HR / ADMIN / MANAGER THẨM ĐỊNH HỒ SƠ
  // ---------------------------------------------------------------------------
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('admin/priority-verifications')
  @ApiOperation({
    summary: 'Danh sách hồ sơ xác thực ưu đãi cần duyệt (HR, Manager, Admin)',
  })
  async findAllForAdmin(@Query() query: ListPriorityVerificationsQueryDto) {
    return this.priorityVerificationService.findAllForAdmin(query);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('admin/priority-verifications/:id')
  @ApiOperation({
    summary: 'Xem chi tiết một hồ sơ xác thực ưu đãi (HR, Manager, Admin)',
  })
  async findByIdForAdmin(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.priorityVerificationService.findByIdForAdmin(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch('admin/priority-verifications/:id/review')
  @ApiOperation({
    summary: 'Phê duyệt hoặc từ chối hồ sơ ưu đãi (Kèm cập nhật User Tier và gửi thông báo)',
  })
  @ApiResponse({ status: 200, description: 'Thao tác thành công' })
  @ApiResponse({ status: 400, description: 'Thiếu lý do từ chối hoặc ID không hợp lệ' })
  async reviewVerification(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') reviewerId: string,
    @Body() dto: ReviewPriorityVerificationDto,
  ) {
    return this.priorityVerificationService.reviewVerification(id, reviewerId, dto);
  }
}
