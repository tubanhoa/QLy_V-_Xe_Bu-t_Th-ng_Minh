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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service.js';
import { CreateFeedbackDto, RespondFeedbackDto } from './dto/feedback.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Feedback & Ratings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
@Controller('api/v1')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post('feedback')
  @ApiOperation({ summary: 'Gửi đánh giá sao và phản ánh chất lượng chuyến xe (Hành khách)' })
  async create(@Body() dto: CreateFeedbackDto, @CurrentUser('id') userId: string) {
    return this.feedbackService.create(dto, userId);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('admin/feedback')
  @ApiOperation({ summary: 'Xem danh sách phản ánh & đánh giá của khách hàng (Manager, Admin)' })
  @ApiQuery({ name: 'status', required: false, example: 'new' })
  async findAll(@Query() pagination: PaginationDto, @Query('status') status?: string) {
    return this.feedbackService.findAll(pagination, status);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch('admin/feedback/:id')
  @ApiOperation({ summary: 'Phản hồi khiếu nại / xử lý đánh giá (Manager, Admin)' })
  async respond(
    @Param('id') id: string,
    @Body() dto: RespondFeedbackDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.feedbackService.respond(id, dto, adminId);
  }
}
