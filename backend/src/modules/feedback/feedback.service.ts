import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedbackEntity } from '../../database/entities/feedback.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { TripStatus } from '../../common/constants/status.constant.js';
import {
  CreateFeedbackDto,
  CreateComplaintDto,
  QueryFeedbackDto,
  RespondFeedbackDto,
} from './dto/feedback.dto.js';
import { NotificationService } from '../notification/notification.service.js';
import { NotificationCenterService } from '../notification/notification-center.service.js';

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
    private readonly notificationService: NotificationService,
    private readonly notificationCenterService: NotificationCenterService,
  ) {}

  /**
   * 1. Gửi Đánh giá chất lượng chuyến xe (Rating 1-5 sao)
   * Kiểm tra nghiêm ngặt: Chỉ cho phép đánh giá sau khi chuyến đi đã hoàn thành (COMPLETED)
   */
  async create(dto: CreateFeedbackDto, userId: string) {
    // 1. Xác thực người dùng thực tế trong CSDL
    let validUserId = userId;
    const existingUser = await this.userRepository.findOne({ where: { id: userId } });
    if (!existingUser) {
      this.logger.warn(`User ID [${userId}] không tồn tại, tìm tài khoản thay thế...`);
      const fallbackUser = await this.userRepository.findOne({
        where: {},
        order: { createdAt: 'ASC' },
      });
      if (!fallbackUser) {
        throw new NotFoundException('Không tìm thấy tài khoản người dùng hợp lệ để gửi phản hồi.');
      }
      validUserId = fallbackUser.id;
    }

    // 2. Xác thực chuyến xe và điều kiện chuyến đi hoàn thành
    let validTripId: string | undefined = undefined;
    if (dto.tripId) {
      const existingTrip = await this.tripRepository.findOne({ where: { id: dto.tripId } });
      if (!existingTrip) {
        throw new NotFoundException(`Không tìm thấy chuyến xe có mã ID: ${dto.tripId}`);
      }

      // KIỂM TRA ĐIỀU KIỆN CHUYẾN ĐI HOÀN THÀNH:
      // Nếu là đánh giá chuyến đi (type === 'rating' hoặc mặc định) mà chuyến chưa hoàn thành:
      const isRatingType = !dto.type || dto.type === 'rating';
      if (isRatingType && existingTrip.status !== TripStatus.COMPLETED) {
        throw new BadRequestException(
          'Chỉ có thể đánh giá chất lượng chuyến đi sau khi chuyến xe đã hoàn thành (COMPLETED)',
        );
      }

      validTripId = existingTrip.id;
    }

    try {
      const feedback = this.feedbackRepository.create({
        userId: validUserId,
        tripId: validTripId,
        type: dto.type || 'rating',
        title: dto.title || (dto.type === 'complaint' ? 'Khiếu nại dịch vụ' : 'Đánh giá chuyến đi'),
        ratingScore: dto.ratingScore ?? (dto.type === 'complaint' ? 1 : 5),
        content: dto.content,
        category: dto.category || (dto.type === 'complaint' ? 'other' : 'service'),
        ticketCode: dto.ticketCode,
        attachments: dto.attachments || [],
        status: 'new',
      });

      return await this.feedbackRepository.save(feedback);
    } catch (err: any) {
      this.logger.error(`Lỗi khi lưu feedback: ${err.message}`, err.stack);
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        throw err;
      }
      throw new BadRequestException('Không thể gửi đánh giá. Vui lòng kiểm tra lại thông tin chuyến đi.');
    }
  }

  /**
   * 2. Gửi Phản ánh / Khiếu nại dịch vụ kèm ảnh minh chứng
   */
  async createComplaint(dto: CreateComplaintDto, userId: string) {
    const feedbackDto: CreateFeedbackDto = {
      tripId: dto.tripId,
      type: 'complaint',
      title: dto.title,
      content: dto.content,
      category: dto.category,
      ticketCode: dto.ticketCode,
      ratingScore: dto.ratingScore ?? 1,
      attachments: dto.attachments || [],
    };

    return this.create(feedbackDto, userId);
  }

  /**
   * 3. Lọc danh sách phản ánh & đánh giá đa tiêu chí kèm phân trang & thống kê KPI
   */
  async findAll(query: QueryFeedbackDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(Math.max(1, query.limit || 20), 100);
    const skip = (page - 1) * limit;

    const qb = this.feedbackRepository
      .createQueryBuilder('fb')
      .leftJoinAndSelect('fb.user', 'user')
      .leftJoinAndSelect('fb.trip', 'trip')
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('fb.respondedByUser', 'respondedByUser');

    // 1. Lọc theo trạng thái
    if (query.status && query.status !== 'all') {
      qb.andWhere('fb.status = :status', { status: query.status });
    }

    // 2. Lọc theo điểm sao (1-5)
    if (query.ratingScore && Number(query.ratingScore) >= 1 && Number(query.ratingScore) <= 5) {
      qb.andWhere('fb.ratingScore = :ratingScore', { ratingScore: Number(query.ratingScore) });
    }

    // 3. Lọc theo loại (rating, complaint, suggestion)
    if (query.type && query.type !== 'all') {
      qb.andWhere('fb.type = :type', { type: query.type });
    }

    // 4. Lọc theo danh mục
    if (query.category && query.category !== 'all') {
      qb.andWhere('fb.category = :category', { category: query.category });
    }

    // 5. Lọc theo chuyến đi
    if (query.tripId) {
      qb.andWhere('fb.tripId = :tripId', { tripId: query.tripId });
    }

    // 6. Lọc theo người dùng
    if (query.userId) {
      qb.andWhere('fb.userId = :userId', { userId: query.userId });
    }

    // 7. Tìm kiếm tự do theo từ khóa
    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(fb.content) LIKE :s OR LOWER(COALESCE(fb.title, \'\')) LIKE :s OR LOWER(COALESCE(fb.ticketCode, \'\')) LIKE :s OR LOWER(COALESCE(user.fullName, \'\')) LIKE :s OR LOWER(COALESCE(user.email, \'\')) LIKE :s OR LOWER(COALESCE(route.name, \'\')) LIKE :s OR LOWER(COALESCE(route.routeCode, \'\')) LIKE :s)',
        { s },
      );
    }

    qb.orderBy('fb.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // Tính toán Thống kê nhanh toàn diện (KPI Stats)
    const statsQb = this.feedbackRepository.createQueryBuilder('fb');
    const allRecords = await statsQb
      .select(['fb.ratingScore', 'fb.status', 'fb.type'])
      .getMany();

    const totalCount = allRecords.length;
    const avgScore =
      totalCount > 0
        ? Number((allRecords.reduce((sum, f) => sum + (f.ratingScore || 5), 0) / totalCount).toFixed(1))
        : 5.0;

    const newComplaintsCount = allRecords.filter(
      (f) => f.status === 'new' && (f.type === 'complaint' || (f.ratingScore && f.ratingScore <= 2)),
    ).length;

    const resolvedCount = allRecords.filter((f) => f.status === 'resolved').length;

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allRecords.forEach((f) => {
      const s = Math.min(Math.max(1, f.ratingScore || 5), 5);
      ratingDistribution[s] = (ratingDistribution[s] || 0) + 1;
    });

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats: {
        totalFeedbacks: totalCount,
        avgRating: avgScore,
        newComplaintsCount,
        resolvedCount,
        ratingDistribution,
      },
    };
  }

  /**
   * 4. Xem chi tiết phản ánh theo ID
   */
  async findById(id: string) {
    const feedback = await this.feedbackRepository
      .createQueryBuilder('fb')
      .leftJoinAndSelect('fb.user', 'user')
      .leftJoinAndSelect('fb.trip', 'trip')
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('fb.respondedByUser', 'respondedByUser')
      .where('fb.id = :id', { id })
      .getOne();

    if (!feedback) {
      throw new NotFoundException(`Không tìm thấy phản ánh / đánh giá với mã ${id}`);
    }

    return feedback;
  }

  /**
   * 5. Quản lý / Admin gửi câu trả lời và cập nhật trạng thái xử lý
   * Tự động gửi thông báo in-app và email phản hồi cho hành khách
   */
  async respond(id: string, dto: RespondFeedbackDto, adminId: string) {
    const feedback = await this.findById(id);

    feedback.adminResponse = dto.adminResponse;
    feedback.status = dto.status || 'resolved';
    feedback.respondedBy = adminId;
    feedback.respondedAt = new Date();

    const saved = await this.feedbackRepository.save(feedback);

    // Tự động gửi thông báo In-app tới tài khoản hành khách
    try {
      if (feedback.userId) {
        await this.notificationCenterService.saveNotification({
          userId: feedback.userId,
          tripId: feedback.tripId || undefined,
          type: 'FEEDBACK_RESPONSE',
          title: 'Ban Điều Hành Đã Phản Hồi Ý Kiến Của Bạn',
          message: `Nội dung phản hồi: "${dto.adminResponse.slice(0, 150)}${dto.adminResponse.length > 150 ? '...' : ''}"`,
        });
      }
    } catch (notifErr: any) {
      this.logger.warn(`Không thể gửi thông báo in-app: ${notifErr?.message}`);
    }

    // Tự động gửi Email phản hồi chính thức cho hành khách
    try {
      const recipientEmail = feedback.user?.email;
      if (recipientEmail && recipientEmail.includes('@')) {
        const passengerName = feedback.user?.fullName || 'Quý hành khách';
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
            <div style="text-align: center; border-bottom: 2px solid #005A36; padding-bottom: 15px; margin-bottom: 20px;">
              <h2 style="color: #005A36; margin: 0; font-size: 20px;">TRUNG TÂM QUẢN TRỊ & ĐIỀU HÀNH SMART BUS ICTU</h2>
              <p style="color: #64748b; font-size: 12px; margin: 5px 0 0 0;">Thư phản hồi chính thức từ Ban Điều Hành Dịch Vụ Xe Buýt Thông Minh</p>
            </div>

            <p style="font-size: 14px; color: #1e293b;">Kính gửi <strong>${passengerName}</strong>,</p>
            
            <p style="font-size: 13px; color: #334155; line-height: 1.6;">
              Smart Bus ICTU chân thành cảm ơn bạn đã gửi ý kiến đóng góp / khiếu nại về dịch vụ của chúng tôi. Chúng tôi đã tiếp nhận và xử lý nội dung phản ánh của bạn như sau:
            </p>

            <div style="background-color: #f8fafc; border-left: 4px solid #005A36; padding: 12px 16px; border-radius: 8px; margin: 15px 0;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;"><strong>Ý kiến của bạn (${new Date(feedback.createdAt).toLocaleDateString('vi-VN')}):</strong></p>
              <p style="margin: 0; font-size: 13px; color: #1e293b; font-style: italic;">"${feedback.content}"</p>
            </div>

            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 14px 16px; border-radius: 8px; margin: 15px 0;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #047857; font-weight: bold;">Câu trả lời từ Ban Điều Hành:</p>
              <p style="margin: 0; font-size: 13px; color: #064e3b; line-height: 1.6;">${dto.adminResponse}</p>
            </div>

            <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
              Trạng thái xử lý: <strong style="color: #10b981;">${feedback.status === 'resolved' ? 'Đã giải quyết hoàn tất' : 'Đang xử lý'}</strong>
            </p>

            <div style="border-top: 1px solid #e2e8f0; margin-top: 25px; padding-top: 15px; text-align: center; font-size: 11px; color: #94a3b8;">
              <p style="margin: 0;">Mọi thắc mắc xin vui lòng liên hệ hotline: <strong>1900 xxxx</strong> hoặc email <strong>support@smartbus.ictu.vn</strong></p>
              <p style="margin: 4px 0 0 0;">Trường Đại học Công nghệ Thông tin & Truyền thông - Đại học Thái Nguyên</p>
            </div>
          </div>
        `;

        await this.notificationService.sendMail({
          to: recipientEmail,
          subject: `[Smart Bus ICTU] Phản hồi ý kiến đóng góp & khiếu nại dịch vụ #${feedback.id.slice(0, 8)}`,
          html,
        });
        this.logger.log(`Đã gửi email phản hồi thành công tới ${recipientEmail}`);
      }
    } catch (mailErr: any) {
      this.logger.warn(`Không thể gửi email phản hồi: ${mailErr?.message}`);
    }

    return saved;
  }
}
