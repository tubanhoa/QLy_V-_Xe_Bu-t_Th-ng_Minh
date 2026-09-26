import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLogEntity } from '../../database/entities/activity-log.entity.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(ActivityLogEntity)
    private readonly activityLogRepository: Repository<ActivityLogEntity>,
  ) {}

  async log(params: {
    action: string;
    resourceName: string;
    resourceId?: string;
    changes?: Record<string, any>;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const entry = this.activityLogRepository.create({
      action: params.action,
      resourceName: params.resourceName,
      resourceId: params.resourceId,
      changes: params.changes,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return this.activityLogRepository.save(entry);
  }

  async findAll(
    pagination: PaginationDto,
    action?: string,
    resourceName?: string,
    userId?: string,
  ) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const query = this.activityLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .select([
        'log.id',
        'log.action',
        'log.resourceName',
        'log.resourceId',
        'log.changes',
        'log.ipAddress',
        'log.userAgent',
        'log.timestamp',
        'user.id',
        'user.fullName',
        'user.email',
      ]);

    if (action) {
      query.andWhere('log.action = :action', { action });
    }

    if (resourceName) {
      query.andWhere('log.resourceName = :resourceName', { resourceName });
    }

    if (userId) {
      query.andWhere('log.userId = :userId', { userId });
    }

    query.orderBy('log.timestamp', 'DESC').skip(skip).take(limit);

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
}
