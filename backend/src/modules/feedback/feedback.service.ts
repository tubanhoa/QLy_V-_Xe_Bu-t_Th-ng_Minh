import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedbackEntity } from '../../database/entities/feedback.entity.js';
import { CreateFeedbackDto, RespondFeedbackDto } from './dto/feedback.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(FeedbackEntity)
    private readonly feedbackRepository: Repository<FeedbackEntity>,
  ) {}

  async create(dto: CreateFeedbackDto, userId: string) {
    const feedback = this.feedbackRepository.create({
      userId,
      tripId: dto.tripId,
      ratingScore: dto.ratingScore,
      content: dto.content,
      category: dto.category || 'service',
      status: 'new',
    });

    return this.feedbackRepository.save(feedback);
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
