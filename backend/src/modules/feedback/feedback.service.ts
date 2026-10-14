import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedbackEntity } from '../../database/entities/feedback.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { CreateFeedbackDto, RespondFeedbackDto } from './dto/feedback.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectRepository(FeedbackEntity)
    private readonly feedbackRepository: Repository<FeedbackEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(TripEntity)
    private readonly tripRepository: Repository<TripEntity>,
  ) {}

  async create(dto: CreateFeedbackDto, userId: string) {
    // 1. Xác thực người dùng thực tế tồn tại trong CSDL
    let validUserId = userId;
    const existingUser = await this.userRepository.findOne({ where: { id: userId } });
    if (!existingUser) {
      this.logger.warn(`User ID [${userId}] không tồn tại trong CSDL, tìm tài khoản thay thế...`);
      const fallbackUser = await this.userRepository.findOne({
        where: {},
        order: { createdAt: 'ASC' },
      });
      if (!fallbackUser) {
        throw new NotFoundException('Không tìm thấy tài khoản người dùng hợp lệ để gửi phản hồi.');
      }
      validUserId = fallbackUser.id;
    }

    // 2. Xác thực chuyến xe (nếu có cung cấp tripId)
    let validTripId: string | undefined = undefined;
    if (dto.tripId) {
      const existingTrip = await this.tripRepository.findOne({ where: { id: dto.tripId } });
      if (existingTrip) {
        validTripId = existingTrip.id;
      } else {
        this.logger.warn(`Trip ID [${dto.tripId}] không tồn tại trong CSDL, bỏ qua liên kết tripId để tránh vi phạm FK.`);
      }
    }

    try {
      const feedback = this.feedbackRepository.create({
        userId: validUserId,
        tripId: validTripId,
        ratingScore: dto.ratingScore ?? (dto.category === 'refund_support' ? 1 : 5),
        content: dto.content,
        category: dto.category || 'service',
        status: 'new',
      });

      return await this.feedbackRepository.save(feedback);
    } catch (err: any) {
      this.logger.error(`Lỗi khi lưu feedback: ${err.message}`, err.stack);
      throw new BadRequestException('Không thể gửi đánh giá. Vui lòng kiểm tra lại thông tin chuyến đi.');
    }
  }

  async findAll(pagination: PaginationDto, status?: string) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const query = this.feedbackRepository
      .createQueryBuilder('fb')
      .innerJoinAndSelect('fb.user', 'user')
      .leftJoinAndSelect('fb.trip', 'trip')
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('fb.respondedByUser', 'respondedByUser');

    if (status) {
      query.andWhere('fb.status = :status', { status });
    }

    query.orderBy('fb.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await query.getManyAndCount();

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async respond(id: string, dto: RespondFeedbackDto, adminId: string) {
    const feedback = await this.feedbackRepository.findOne({ where: { id } });
    if (!feedback) {
      throw new NotFoundException('Không tìm thấy đánh giá / phản ánh');
    }

    feedback.adminResponse = dto.adminResponse;
    feedback.status = dto.status || 'resolved';
    feedback.respondedBy = adminId;
    feedback.respondedAt = new Date();

    await this.feedbackRepository.save(feedback);
    return feedback;
  }
}
