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
import { RegisterMonthlyPassDto, ReviewMonthlyPassDto } from './dto/promotion.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { ApprovalStatus } from '../../common/constants/status.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Monthly Passes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
@Controller()
export class MonthlyPassController {
  constructor(private readonly monthlyPassService: MonthlyPassService) {}

  @Post('monthly-passes/register')
  @ApiOperation({ summary: 'Đăng ký vé tháng xe buýt (Sinh viên, người cao tuổi, công nhân)' })
  async register(@Body() dto: RegisterMonthlyPassDto, @CurrentUser('id') userId: string) {
    return this.monthlyPassService.register(dto, userId);
  }

  @Get('monthly-passes/my-passes')
  @ApiOperation({ summary: 'Danh sách vé tháng của người dùng' })
  async getMyPasses(@CurrentUser('id') userId: string) {
    return this.monthlyPassService.getMyPasses(userId);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('admin/monthly-passes')
  @ApiOperation({ summary: 'Danh sách hồ sơ đăng ký vé tháng (Manager, Admin)' })
  async getAdminPasses(
    @Query() pagination: PaginationDto,
    @Query('status') status?: ApprovalStatus,
  ) {
    return this.monthlyPassService.getAdminPasses(pagination, status);
  }

  @UseGuards(RolesGuard)
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
