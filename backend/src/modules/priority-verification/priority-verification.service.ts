import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import {
  PriorityVerificationEntity,
  PriorityCategory,
  VerificationStatus,
} from '../../database/entities/priority-verification.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { NotificationCenterService } from '../notification/notification-center.service.js';
import { NotificationService } from '../notification/notification.service.js';
import { CreatePriorityVerificationDto } from './dto/create-priority-verification.dto.js';
import { ReviewPriorityVerificationDto } from './dto/review-priority-verification.dto.js';
import { ListPriorityVerificationsQueryDto } from './dto/list-priority-verifications-query.dto.js';

@Injectable()
export class PriorityVerificationService {
  private readonly logger = new Logger(PriorityVerificationService.name);

  constructor(
    @InjectRepository(PriorityVerificationEntity)
    private readonly verificationRepository: Repository<PriorityVerificationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly notificationCenterService: NotificationCenterService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Khách hàng gửi yêu cầu xác thực đối tượng ưu đãi (HSSV / Người cao tuổi)
   */
  async submitVerification(userId: string, dto: CreatePriorityVerificationDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy thông tin tài khoản người dùng');
    }

    // 1. Kiểm tra chống spam: Không cho phép gửi nếu đang có hồ sơ PENDING
    const pendingRequest = await this.verificationRepository.findOne({
      where: {
        userId,
        status: VerificationStatus.PENDING,
      },
    });

    if (pendingRequest) {
      throw new BadRequestException(
        'Bạn đang có một hồ sơ xác thực đối tượng ưu đãi đang chờ Ban Quản Lý xét duyệt. Vui lòng chờ kết quả trước khi gửi hồ sơ mới.',
      );
    }

    // 2. Kiểm tra nếu tài khoản đã được xác thực đối tượng này rồi
    if (
      user.verificationStatus === 'verified' &&
      user.priorityCategory === dto.category
    ) {
      throw new BadRequestException(
        `Tài khoản của bạn đã được xác thực thành công đối tượng ưu đãi (${dto.category === PriorityCategory.STUDENT ? 'Sinh viên' : 'Người cao tuổi'}).`,
      );
    }

    // 3. Tạo mới yêu cầu xác thực
    const verification = this.verificationRepository.create({
      userId,
      category: dto.category,
      studentId: dto.studentId || user.studentId || null,
      schoolName: dto.schoolName || user.faculty || null,
      idCardNumber: dto.idCardNumber || user.idCardNumber || null,
      frontImageUrl: dto.frontImageUrl,
      backImageUrl: dto.backImageUrl || null,
      portraitImageUrl: dto.portraitImageUrl || null,
      status: VerificationStatus.PENDING,
    });

    const saved = await this.verificationRepository.save(verification);

    // Cập nhật trạng thái user sang pending
    user.verificationStatus = 'pending';
    if (dto.studentId) user.studentId = dto.studentId;
    if (dto.idCardNumber) user.idCardNumber = dto.idCardNumber;
    await this.userRepository.save(user);

    // Bắn thông báo xác nhận đã nhận hồ sơ
    try {
      await this.notificationCenterService.saveNotification({
        userId,
        type: 'SYSTEM',
        title: 'Hồ sơ xác thực ưu đãi đã được gửi',
        message: `Hồ sơ xác thực đối tượng ${dto.category === PriorityCategory.STUDENT ? 'Sinh viên' : 'Người cao tuổi'} của bạn đã được tiếp nhận. Ban Quản Lý / Nhân sự ICTU sẽ xét duyệt trong vòng 2–4 giờ làm việc.`,
        deepLink: '/portal',
        data: { verificationId: saved.id },
      });
    } catch (e: any) {
      this.logger.warn(`Không thể lưu notification in-app: ${e.message}`);
    }

    return {
      message: 'Gửi hồ sơ xác thực đối tượng ưu đãi thành công',
      data: saved,
    };
  }

  /**
   * Khách hàng tra cứu lịch sử hồ sơ xác thực của chính mình
   */
  async getMyVerifications(userId: string) {
    const list = await this.verificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const user = await this.userRepository.findOne({ where: { id: userId } });

    return {
      priorityCategory: user?.priorityCategory || 'regular',
      verificationStatus: user?.verificationStatus || 'unverified',
      verifiedAt: user?.verifiedAt || null,
      history: list,
    };
  }

  /**
   * HR / Admin lấy danh sách hồ sơ cần duyệt (kèm phân trang, lọc, tìm kiếm)
   */
  async findAllForAdmin(query: ListPriorityVerificationsQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.verificationRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.user', 'u')
      .leftJoinAndSelect('v.reviewedByUser', 'reviewer')
      .orderBy('v.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.status && query.status !== 'all') {
      qb.andWhere('v.status = :status', { status: query.status });
    }

    if (query.category && query.category !== 'all') {
      qb.andWhere('v.category = :category', { category: query.category });
    }

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        '(u.fullName ILIKE :term OR u.email ILIKE :term OR v.studentId ILIKE :term OR v.idCardNumber ILIKE :term)',
        { term },
      );
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Xem chi tiết một hồ sơ xác thực (HR / Admin)
   */
  async findByIdForAdmin(id: string) {
    const item = await this.verificationRepository.findOne({
      where: { id },
      relations: {
        user: true,
        reviewedByUser: true,
      },
    });

    if (!item) {
      throw new NotFoundException(`Không tìm thấy hồ sơ xác thực với ID: ${id}`);
    }

    return item;
  }

  /**
   * HR / Admin duyệt hoặc từ chối hồ sơ ưu đãi (Kèm cập nhật User Tier và gửi Email/Push Notification)
   */
  async reviewVerification(
    id: string,
    reviewerId: string,
    dto: ReviewPriorityVerificationDto,
  ) {
    const verification = await this.verificationRepository.findOne({
      where: { id },
      relations: { user: true },
    });

    if (!verification) {
      throw new NotFoundException(`Không tìm thấy hồ sơ xác thực với ID: ${id}`);
    }

    const user = verification.user;
    if (!user) {
      throw new NotFoundException('Không tìm thấy thông tin tài khoản người dùng tương ứng');
    }

    const categoryLabel =
      verification.category === PriorityCategory.STUDENT
        ? 'Sinh viên (Trợ giá 50%)'
        : 'Người cao tuổi (Trợ giá 60%)';

    const now = new Date();

    if (dto.status === 'approved') {
      // 1. Cập nhật hồ sơ
      verification.status = VerificationStatus.VERIFIED;
      verification.reviewedBy = reviewerId;
      verification.reviewedAt = now;
      verification.rejectionReason = null;
      await this.verificationRepository.save(verification);

      // 2. Cập nhật tài khoản người dùng sang hạng ưu đãi
      user.priorityCategory = verification.category;
      user.verificationStatus = 'verified';
      user.verifiedAt = now;
      user.verifiedBy = reviewerId;
      if (verification.studentId) user.studentId = verification.studentId;
      if (verification.idCardNumber) user.idCardNumber = verification.idCardNumber;
      await this.userRepository.save(user);

      // 3. Bắn Push Notification in-app
      try {
        await this.notificationCenterService.saveNotification({
          userId: user.id,
          type: 'SYSTEM',
          title: 'Hồ sơ ưu đãi đã được phê duyệt',
          message: `Chúc mừng bạn! Hồ sơ đối tượng ${categoryLabel} của bạn đã được phê duyệt thành công. Tài khoản của bạn hiện đã được áp dụng mức giá trợ giá cho mọi chuyến xe!`,
          deepLink: '/portal',
          data: { verificationId: verification.id, status: 'approved' },
        });
      } catch (e: any) {
        this.logger.warn(`Lỗi lưu notification in-app: ${e.message}`);
      }

      // 4. Gửi Email HTML chúc mừng
      await this.sendApprovalEmail(user, verification);

      return {
        message: `Phê duyệt hồ sơ ưu đãi thành công cho người dùng: ${user.fullName}`,
        data: verification,
      };
    } else {
      // Nhánh REJECTED: Bắt buộc phải có lý do từ chối
      if (!dto.rejectionReason || !dto.rejectionReason.trim()) {
        throw new BadRequestException('Vui lòng nhập lý do từ chối cụ thể để hướng dẫn khách hàng');
      }

      const reason = dto.rejectionReason.trim();

      verification.status = VerificationStatus.REJECTED;
      verification.rejectionReason = reason;
      verification.reviewedBy = reviewerId;
      verification.reviewedAt = now;
      await this.verificationRepository.save(verification);

      // Cập nhật trạng thái user
      user.verificationStatus = 'rejected';
      await this.userRepository.save(user);

      // Bắn Push Notification in-app
      try {
        await this.notificationCenterService.saveNotification({
          userId: user.id,
          type: 'SYSTEM',
          title: 'Hồ sơ xác thực ưu đãi chưa đạt yêu cầu',
          message: `Hồ sơ xác thực đối tượng ${categoryLabel} của bạn chưa được duyệt. Lý do: "${reason}". Vui lòng bổ sung minh chứng hợp lệ.`,
          deepLink: '/portal',
          data: { verificationId: verification.id, status: 'rejected', reason },
        });
      } catch (e: any) {
        this.logger.warn(`Lỗi lưu notification in-app: ${e.message}`);
      }

      // Gửi Email HTML từ chối kèm lý do
      await this.sendRejectionEmail(user, verification, reason);

      return {
        message: `Đã từ chối hồ sơ ưu đãi của người dùng: ${user.fullName}`,
        data: verification,
      };
    }
  }

  /**
   * Template Email thông báo phê duyệt hồ sơ ưu đãi thành công
   */
  private async sendApprovalEmail(user: UserEntity, verification: PriorityVerificationEntity) {
    const isStudent = verification.category === PriorityCategory.STUDENT;
    const categoryTitle = isStudent ? 'Sinh Viên ICTU' : 'Người Cao Tuổi';
    const discountRate = isStudent ? '50%' : '60%';

    const html = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #005A36 0%, #003B23 100%); color: #ffffff; padding: 32px 24px; text-align: center; }
          .badge { display: inline-block; background: #10b981; color: #ffffff; padding: 4px 12px; border-radius: 9999px; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
          .content { padding: 32px 24px; }
          .card { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 20px; margin: 20px 0; }
          .btn { display: inline-block; background: #005A36; color: #ffffff !important; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 14px; margin-top: 10px; }
          .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="badge">HỒ SƠ ĐÃ ĐƯỢC PHÊ DUYỆT</span>
            <h1 style="margin: 12px 0 0 0; font-size: 22px; font-weight: 800;">Xác Thực Đối Tượng Ưu Đãi Thành Công</h1>
            <p style="margin: 6px 0 0 0; opacity: 0.85; font-size: 13px;">Hệ thống Xe Buýt Thông Minh ICTU</p>
          </div>
          <div class="content">
            <p>Kính gửi <strong>${user.fullName}</strong>,</p>
            <p>Ban Quản Lý & Nhân sự ICTU Transit xin vui mừng thông báo: Hồ sơ đăng ký đối tượng ưu tiên <strong>${categoryTitle}</strong> của bạn đã được kiểm duyệt và <strong>chính thức phê duyệt</strong>!</p>
            
            <div class="card">
              <h3 style="margin: 0 0 12px 0; color: #005A36; font-size: 15px; font-weight: 800;">Thông Tin Ưu Đãi Tài Khoản:</h3>
              <p style="margin: 4px 0; font-size: 13px;">• Họ và tên: <strong>${user.fullName}</strong></p>
              <p style="margin: 4px 0; font-size: 13px;">• Email: <strong>${user.email}</strong></p>
              ${verification.studentId ? `<p style="margin: 4px 0; font-size: 13px;">• Mã sinh viên: <strong>${verification.studentId}</strong></p>` : ''}
              ${verification.idCardNumber ? `<p style="margin: 4px 0; font-size: 13px;">• Số CCCD: <strong>${verification.idCardNumber}</strong></p>` : ''}
              <p style="margin: 4px 0; font-size: 13px;">• Hạng đối tượng: <strong>${categoryTitle}</strong></p>
              <p style="margin: 4px 0; font-size: 13px; color: #047857;">• Quyền lợi trợ giá: <strong>Giảm ${discountRate}</strong> toàn bộ vé lượt và vé tháng</p>
            </div>

            <p style="font-size: 13px; line-height: 1.6;">Từ thời điểm này, mỗi khi bạn đặt vé hoặc mua vé tháng trực tuyến trên ứng dụng, hệ thống sẽ tự động áp dụng mức giá trợ giá ưu đãi mà không cần thẩm định lại.</p>

            <div style="text-align: center; margin: 28px 0 10px 0;">
              <a href="${process.env.APP_URL || 'http://localhost:3000'}" class="btn">Trải Nghiệm Đặt Vé Ngay</a>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0;">Trường Đại học Công nghệ Thông tin & Truyền thông — Đại học Thái Nguyên</p>
            <p style="margin: 4px 0 0 0;">Hotline hỗ trợ: 1900 6868 · Email: hotro@smartbus.ictu.edu.vn</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.notificationService.sendMail({
        to: user.email,
        subject: `[ICTU Transit] Chúc mừng! Hồ sơ ưu đãi ${categoryTitle} của bạn đã được phê duyệt`,
        html,
        text: `Chúc mừng ${user.fullName}! Hồ sơ ưu đãi ${categoryTitle} của bạn đã được duyệt thành công. Bạn được giảm ${discountRate} giá vé.`,
      });
    } catch (err: any) {
      this.logger.error(`Lỗi gửi email duyệt hồ sơ tới ${user.email}: ${err.message}`);
    }
  }

  /**
   * Template Email thông báo từ chối hồ sơ ưu đãi (Kèm lý do cụ thể)
   */
  private async sendRejectionEmail(
    user: UserEntity,
    verification: PriorityVerificationEntity,
    rejectionReason: string,
  ) {
    const isStudent = verification.category === PriorityCategory.STUDENT;
    const categoryTitle = isStudent ? 'Sinh Viên ICTU' : 'Người Cao Tuổi';

    const html = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: #ffffff; padding: 32px 24px; text-align: center; }
          .badge { display: inline-block; background: #fff1f2; color: #be123c; padding: 4px 12px; border-radius: 9999px; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
          .content { padding: 32px 24px; }
          .reason-box { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 16px; padding: 20px; margin: 20px 0; color: #9f1239; }
          .btn { display: inline-block; background: #be123c; color: #ffffff !important; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 14px; margin-top: 10px; }
          .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="badge">THÔNG BÁO THẨM ĐỊNH HỒ SƠ</span>
            <h1 style="margin: 12px 0 0 0; font-size: 22px; font-weight: 800;">Hồ Sơ Xác Thực Chưa Đạt Yêu Cầu</h1>
            <p style="margin: 6px 0 0 0; opacity: 0.85; font-size: 13px;">Hệ thống Xe Buýt Thông Minh ICTU</p>
          </div>
          <div class="content">
            <p>Kính gửi <strong>${user.fullName}</strong>,</p>
            <p>Ban Quản Lý & Nhân sự ICTU Transit đã xem xét hồ sơ đăng ký đối tượng ưu đãi <strong>${categoryTitle}</strong> của bạn. Rất tiếc, hồ sơ hiện tại chưa đủ điều kiện phê duyệt vì lý do sau:</p>
            
            <div class="reason-box">
              <strong style="display: block; font-size: 14px; margin-bottom: 6px;">Lý do không đạt:</strong>
              <p style="margin: 0; font-size: 13px; font-style: italic;">&ldquo;${rejectionReason}&rdquo;</p>
            </div>

            <p style="font-size: 13px; line-height: 1.6;"><strong>Hướng dẫn bổ sung:</strong> Vui lòng chụp lại ảnh minh chứng (Thẻ sinh viên hoặc Thẻ CCCD) rõ nét, đủ ánh sáng, không bị mờ nhòe hoặc lóa sáng, hiển thị rõ họ tên và hạn sử dụng thẻ, sau đó gửi lại yêu cầu để chúng tôi hỗ trợ xét duyệt nhanh nhất.</p>

            <div style="text-align: center; margin: 28px 0 10px 0;">
              <a href="${process.env.APP_URL || 'http://localhost:3000'}/portal" class="btn">Gửi Lại Ảnh Minh Chứng</a>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0;">Trường Đại học Công nghệ Thông tin & Truyền thông — Đại học Thái Nguyên</p>
            <p style="margin: 4px 0 0 0;">Hotline hỗ trợ: 1900 6868 · Email: hotro@smartbus.ictu.edu.vn</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.notificationService.sendMail({
        to: user.email,
        subject: `[ICTU Transit] Thông báo kết quả thẩm định hồ sơ ưu đãi ${categoryTitle}`,
        html,
        text: `Kính gửi ${user.fullName}, hồ sơ ưu đãi ${categoryTitle} của bạn chưa đạt yêu cầu do: ${rejectionReason}. Vui lòng nộp lại ảnh minh chứng rõ nét.`,
      });
    } catch (err: any) {
      this.logger.error(`Lỗi gửi email từ chối hồ sơ tới ${user.email}: ${err.message}`);
    }
  }
}
