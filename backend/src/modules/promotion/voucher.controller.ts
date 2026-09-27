import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { VoucherService } from './voucher.service.js';
import { CreateVoucherDto, ValidateVoucherDto } from './dto/promotion.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Vouchers & Promotions')
@Controller()
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  @Public()
  @Post('vouchers/validate')
  @ApiOperation({ summary: 'Kiểm tra và tính toán giảm giá của mã voucher' })
  async validate(@Body() dto: ValidateVoucherDto) {
    return this.voucherService.validate(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Post('vouchers')
  @ApiOperation({ summary: 'Tạo mã voucher khuyến mại mới (Manager, Admin)' })
  async create(@Body() dto: CreateVoucherDto) {
    return this.voucherService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth('JWT')
  @Get('admin/vouchers')
  @ApiOperation({ summary: 'Danh sách các voucher khuyến mại (Manager, Admin)' })
  async findAll(@Query() pagination: PaginationDto) {
    return this.voucherService.findAll(pagination);
  }
}
