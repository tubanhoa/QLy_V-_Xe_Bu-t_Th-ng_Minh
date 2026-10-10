import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { VoucherService } from './voucher.service.js';
import {
  CreateVoucherDto,
  UpdateVoucherDto,
  ValidateVoucherDto,
  QueryVoucherDto,
} from './dto/promotion.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RateLimitGuard, RateLimit } from '../../common/guards/rate-limit.guard.js';

@ApiTags('Vouchers & Promotions')
@Controller()
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  /**
   * Khách hàng kiểm tra và tính toán giảm giá của voucher trước khi đặt vé
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 20, windowSeconds: 60, actionName: 'tra cứu mã giảm giá' })
  @Post('vouchers/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kiểm tra và tính toán mức giảm giá của voucher (Public / Passenger)' })
  async validate(@Body() dto: ValidateVoucherDto) {
    return this.voucherService.validate(dto);
  }

  /**
   * Tạo mã voucher khuyến mại mới (Dành cho Marketing, Quản lý, Admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Post(['vouchers', 'admin/vouchers'])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo mã voucher khuyến mại mới (Marketing, Manager, Admin)' })
  async create(@Body() dto: CreateVoucherDto) {
    return this.voucherService.create(dto);
  }

  /**
   * Danh sách tất cả các voucher khuyến mại trong hệ thống
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Get('admin/vouchers')
  @ApiOperation({ summary: 'Danh sách các voucher khuyến mại (Hỗ trợ tìm kiếm, lọc status, phân trang)' })
  async findAll(@Query() query: QueryVoucherDto) {
    return this.voucherService.findAll(query);
  }

  /**
   * Xem chi tiết một mã voucher
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Get('admin/vouchers/:id')
  @ApiOperation({ summary: 'Xem chi tiết một mã voucher theo ID hoặc mã Code' })
  @ApiParam({ name: 'id', description: 'UUID hoặc mã voucher (Code)' })
  async findOne(@Param('id') id: string) {
    return this.voucherService.findOne(id);
  }

  /**
   * Chỉnh sửa thông tin mã voucher
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Patch('admin/vouchers/:id')
  @ApiOperation({ summary: 'Chỉnh sửa thông tin voucher (Marketing, Manager, Admin)' })
  @ApiParam({ name: 'id', description: 'UUID của voucher cần chỉnh sửa' })
  async update(@Param('id') id: string, @Body() dto: UpdateVoucherDto) {
    return this.voucherService.update(id, dto);
  }

  /**
   * Kích hoạt hoặc Hủy kích hoạt nhanh mã voucher (Toggle status active / inactive)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Patch('admin/vouchers/:id/toggle-status')
  @ApiOperation({ summary: 'Bật / Tắt trạng thái kích hoạt của voucher (Toggle active / inactive)' })
  @ApiParam({ name: 'id', description: 'UUID của voucher' })
  async toggleStatus(@Param('id') id: string) {
    return this.voucherService.toggleStatus(id);
  }

  /**
   * Xóa mã voucher an toàn
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Delete('admin/vouchers/:id')
  @ApiOperation({ summary: 'Xóa mã voucher chưa từng được sử dụng (Manager, Admin)' })
  @ApiParam({ name: 'id', description: 'UUID của voucher cần xóa' })
  async delete(@Param('id') id: string) {
    return this.voucherService.delete(id);
  }
}
