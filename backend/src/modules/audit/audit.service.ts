import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLogEntity } from '../../database/entities/activity-log.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { QueryAuditLogsDto } from './dto/query-audit.dto.js';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(ActivityLogEntity)
    private readonly activityLogRepository: Repository<ActivityLogEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  /**
   * Ghi vết thao tác kiểm toán vào CSDL (Audit Trail)
   */
  async log(params: {
    action: string;
    resourceName: string;
    resourceId?: string;
    endpoint?: string;
    method?: string;
    status?: string;
    executionTimeMs?: number;
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
        endpoint: params.endpoint,
        method: params.method,
        status: params.status || 'SUCCESS',
        executionTimeMs: params.executionTimeMs,
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

  /**
   * Truy vấn và lọc danh sách nhật ký hệ thống đa tiêu chí kèm phân trang
   */
  async findAll(query: QueryAuditLogsDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(Math.max(1, query.limit || 20), 100);
    const skip = (page - 1) * limit;

    const qb = this.activityLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .select([
        'log.id',
        'log.userId',
        'log.action',
        'log.resourceName',
        'log.resourceId',
        'log.endpoint',
        'log.method',
        'log.status',
        'log.executionTimeMs',
        'log.changes',
        'log.ipAddress',
        'log.userAgent',
        'log.timestamp',
        'user.id',
        'user.fullName',
        'user.email',
      ]);

    // 1. Tìm kiếm text tự do
    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(log.action) LIKE :s OR LOWER(log.resourceName) LIKE :s OR LOWER(COALESCE(log.endpoint, \'\')) LIKE :s OR log.ipAddress LIKE :s OR LOWER(COALESCE(user.fullName, \'\')) LIKE :s OR LOWER(COALESCE(user.email, \'\')) LIKE :s)',
        { s },
      );
    }

    // 2. Lọc theo Hành động
    if (query.action && query.action.trim()) {
      qb.andWhere('LOWER(log.action) = LOWER(:action)', { action: query.action.trim() });
    }

    // 3. Lọc theo Tài nguyên tác động
    if (query.resourceName && query.resourceName.trim()) {
      qb.andWhere('LOWER(log.resourceName) = LOWER(:resourceName)', {
        resourceName: query.resourceName.trim(),
      });
    }

    // 4. Lọc theo ID người thực hiện
    if (query.userId && query.userId.trim()) {
      qb.andWhere('log.userId = :userId', { userId: query.userId.trim() });
    }

    // 5. Lọc theo Địa chỉ IP
    if (query.ipAddress && query.ipAddress.trim()) {
      qb.andWhere('log.ipAddress LIKE :ipAddress', {
        ipAddress: `%${query.ipAddress.trim()}%`,
      });
    }

    // 6. Lọc theo Trạng thái
    if (query.status && query.status.trim()) {
      qb.andWhere('LOWER(COALESCE(log.status, \'success\')) = LOWER(:status)', {
        status: query.status.trim(),
      });
    }

    // 7. Lọc theo khoảng thời gian
    if (query.startDate) {
      let start: Date;
      if (query.startDate.length <= 10) {
        const [y, m, d] = query.startDate.split('-').map(Number);
        start = new Date(y, m - 1, d, 0, 0, 0, 0);
      } else {
        start = new Date(query.startDate);
      }
      if (!isNaN(start.getTime())) {
        qb.andWhere('log.timestamp >= :startDate', { startDate: start.toISOString() });
      }
    }

    if (query.endDate) {
      let end: Date;
      if (query.endDate.length <= 10) {
        const [y, m, d] = query.endDate.split('-').map(Number);
        end = new Date(y, m - 1, d, 23, 59, 59, 999);
      } else {
        end = new Date(query.endDate);
      }
      if (!isNaN(end.getTime())) {
        qb.andWhere('log.timestamp <= :endDate', { endDate: end.toISOString() });
      }
    }

    qb.orderBy('log.timestamp', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

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

  /**
   * Xem chi tiết một bản ghi nhật ký kiểm toán theo ID
   */
  async findById(id: string) {
    const log = await this.activityLogRepository.findOne({
      where: { id },
      relations: { user: true },
    });

    if (!log) {
      throw new NotFoundException(`Không tìm thấy bản ghi nhật ký với ID: ${id}`);
    }

    return log;
  }

  /**
   * Thống kê tổng hợp tình hình an ninh & lưu vết hệ thống
   */
  async getStats() {
    const totalLogs = await this.activityLogRepository.count();

    const past24hDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logs24h = await this.activityLogRepository
      .createQueryBuilder('log')
      .where('log.timestamp >= :past24h', { past24h: past24hDate.toISOString() })
      .getCount();

    const failedLogs = await this.activityLogRepository
      .createQueryBuilder('log')
      .where(
        "LOWER(log.status) = 'failed' OR LOWER(log.status) = 'error' OR log.status LIKE '4%' OR log.status LIKE '5%'",
      )
      .getCount();

    const uniqueUsersCountRaw = await this.activityLogRepository
      .createQueryBuilder('log')
      .select('COUNT(DISTINCT log.userId)', 'count')
      .where('log.userId IS NOT NULL')
      .getRawOne();

    const topActionsRaw = await this.activityLogRepository
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(log.id)', 'count')
      .groupBy('log.action')
      .orderBy('COUNT(log.id)', 'DESC')
      .limit(6)
      .getRawMany();

    return {
      totalLogs,
      logs24h,
      failedLogs,
      uniqueUsersCount: parseInt(uniqueUsersCountRaw?.count || '0', 10),
      topActions: topActionsRaw.map((r) => ({
        action: r.action,
        count: parseInt(r.count, 10),
      })),
    };
  }
}
