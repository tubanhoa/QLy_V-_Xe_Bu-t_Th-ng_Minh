import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MonthlyPassEntity } from '../../database/entities/monthly-pass.entity.js';
import { RouteEntity } from '../../database/entities/route.entity.js';
import { RegisterMonthlyPassDto, ReviewMonthlyPassDto } from './dto/promotion.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { MonthlyPassCategory, ApprovalStatus } from '../../common/constants/status.constant.js';
import { generateMonthlyPassCode } from '../../common/utils/booking-code.util.js';

@Injectable()
export class MonthlyPassService {
  constructor(
    @InjectRepository(MonthlyPassEntity)
    private readonly monthlyPassRepository: Repository<MonthlyPassEntity>,
    @InjectRepository(RouteEntity)
    private readonly routeRepository: Repository<RouteEntity>,
  ) {}

  async register(dto: RegisterMonthlyPassDto, userId: string) {
    const route = await this.routeRepository.findOne({ where: { id: dto.routeId } });
    if (!route) {
      throw new NotFoundException('Không tìm thấy tuyến xe buýt');
    }

    // Pricing policy for monthly passes
    let price = 200000; // General worker / normal passenger
    if (dto.category === MonthlyPassCategory.STUDENT) {
      price = 100000; // 50% discount for ICTU students
    } else if (dto.category === MonthlyPassCategory.ELDERLY) {
      price = 80000;
    }

    const passCode = generateMonthlyPassCode();

    const monthlyPass = this.monthlyPassRepository.create({
      userId,
      routeId: dto.routeId,
      passCode,
      category: dto.category,
      startDate: dto.startDate,
      endDate: dto.endDate,
      proofImageUrl: dto.proofImageUrl,
      price,
      approvalStatus: ApprovalStatus.PENDING,
    });

    return this.monthlyPassRepository.save(monthlyPass);
  }

  async getMyPasses(userId: string) {
    return this.monthlyPassRepository.find({
      where: { userId },
      relations: { route: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getAdminPasses(pagination: PaginationDto, status?: ApprovalStatus) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const query = this.monthlyPassRepository
      .createQueryBuilder('pass')
      .innerJoinAndSelect('pass.user', 'user')
      .innerJoinAndSelect('pass.route', 'route')
      .leftJoinAndSelect('pass.approvedByUser', 'approvedByUser');

    if (status) {
      query.andWhere('pass.approvalStatus = :status', { status });
    }

    query.orderBy('pass.createdAt', 'DESC').skip(skip).take(limit);

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

  async review(id: string, dto: ReviewMonthlyPassDto, reviewerId: string) {
    const pass = await this.monthlyPassRepository.findOne({ where: { id } });
    if (!pass) {
      throw new NotFoundException('Không tìm thấy hồ sơ vé tháng');
    }

    pass.approvalStatus = dto.status;
    pass.approvedBy = reviewerId;
    if (dto.rejectionReason) {
      pass.rejectionReason = dto.rejectionReason;
    }

    await this.monthlyPassRepository.save(pass);
    return pass;
  }
}
