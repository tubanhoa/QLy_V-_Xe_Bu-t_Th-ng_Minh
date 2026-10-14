import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLogEntity } from '../../database/entities/activity-log.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(ActivityLogEntity)
    private readonly activityLogRepository: Repository<ActivityLogEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
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
    try {
      let validUserId: string | undefined = undefined;
      if (params.userId) {
        const userExists = await this.userRepository.findOne({
          where: { id: params.userId },
          select: { id: true },
        });
        if (userExists) {
          validUserId = userExists.id;
        }
      }

      const entry = this.activityLogRepository.create({
        action: params.action,
        resourceName: params.resourceName,
        resourceId: params.resourceId,
        changes: params.changes,
        userId: validUserId,
        ipAddress: params.ipAddress || '127.0.0.1',
        userAgent: params.userAgent || 'SmartBus System Client',
      });

      return await this.activityLogRepository.save(entry);
    } catch (err: any) {
      this.logger.warn(`Không thể ghi activity log [${params.action}]: ${err?.message}`);
      return null;
    }
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
