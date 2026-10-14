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
import {
  CreateFeedbackDto,
  CreateComplaintDto,
  QueryFeedbackDto,
  RespondFeedbackDto,
} from './dto/feedback.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Feedback & Ratings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
@Controller()
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post('feedback')
  @ApiOperation({ summary: 'Gửi đánh giá sao sau khi chuyến xe hoàn thành (Hành khách)' })
  async create(@Body() dto: CreateFeedbackDto, @CurrentUser('id') userId: string) {
    return this.feedbackService.create(dto, userId);
  }

  @Post('feedback/complaint')
  @ApiOperation({ summary: 'Gửi phản ánh / khiếu nại chất lượng dịch vụ kèm ảnh minh chứng (Hành khách)' })
  async createComplaint(@Body() dto: CreateComplaintDto, @CurrentUser('id') userId: string) {
    return this.feedbackService.createComplaint(dto, userId);
  }

  @Get('feedback/my')
  @ApiOperation({ summary: 'Xem lịch sử đánh giá & khiếu nại của chính mình (Hành khách)' })
  async findMyFeedbacks(@Query() query: QueryFeedbackDto, @CurrentUser('id') userId: string) {
    query.userId = userId;
    return this.feedbackService.findAll(query);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('admin/feedback')
  @ApiOperation({ summary: 'Xem danh sách phản ánh & đánh giá (Quản lý, Admin)' })
  async findAll(@Query() query: QueryFeedbackDto) {
    return this.feedbackService.findAll(query);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('admin/feedback/:id')
  @ApiOperation({ summary: 'Xem chi tiết phản ánh / khiếu nại (Quản lý, Admin)' })
  async findById(@Param('id') id: string) {
    return this.feedbackService.findById(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch('admin/feedback/:id')
  @ApiOperation({ summary: 'Phản hồi khiếu nại & gửi câu trả lời cho hành khách (Quản lý, Admin)' })
  async respond(
    @Param('id') id: string,
    @Body() dto: RespondFeedbackDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.feedbackService.respond(id, dto, adminId);
  }
}
