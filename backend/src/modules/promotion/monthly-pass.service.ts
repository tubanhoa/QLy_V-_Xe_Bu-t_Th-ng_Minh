import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MonthlyPassEntity } from '../../database/entities/monthly-pass.entity.js';
import { MonthlyPassTransactionEntity } from '../../database/entities/monthly-pass-transaction.entity.js';
import { RouteEntity } from '../../database/entities/route.entity.js';
import {
  CalculateMonthlyPassPriceDto,
  RegisterMonthlyPassDto,
  ReviewMonthlyPassDto,
  CreateMonthlyPassPaymentDto,
  ConfirmMonthlyPassPaymentDto,
  RenewMonthlyPassDto,
} from './dto/promotion.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import {
  MonthlyPassCategory,
  ApprovalStatus,
  MonthlyPassPaymentStatus,
  PaymentMethod,
} from '../../common/constants/status.constant.js';
import { generateMonthlyPassCode } from '../../common/utils/booking-code.util.js';
import { NotificationCenterService } from '../notification/notification-center.service.js';

export interface MonthlyPassPriceBreakdown {
  category: MonthlyPassCategory;
  durationMonths: number;
  isAllRoutes: boolean;
  baseMonthlyPrice: number;
  grossAmount: number;
  durationDiscountPercent: number;
  durationDiscountAmount: number;
  routeSurcharge: number;
  finalPrice: number;
}

@Injectable()
export class MonthlyPassService {
  constructor(
    @InjectRepository(MonthlyPassEntity)
    private readonly monthlyPassRepository: Repository<MonthlyPassEntity>,
    @InjectRepository(MonthlyPassTransactionEntity)
    private readonly transactionRepository: Repository<MonthlyPassTransactionEntity>,
    @InjectRepository(RouteEntity)
    private readonly routeRepository: Repository<RouteEntity>,
    @Optional()
    private readonly notificationCenterService?: NotificationCenterService,
  ) {}

  /**
   * Tính giá vé tháng theo đối tượng, kỳ hạn và phạm vi tuyến
   */
  calculatePrice(dto: CalculateMonthlyPassPriceDto): MonthlyPassPriceBreakdown {
    const duration = [1, 3, 6].includes(Number(dto.durationMonths))
      ? Number(dto.durationMonths)
      : 1;

    const isAllRoutes =
      dto.isAllRoutes !== undefined
        ? Boolean(dto.isAllRoutes)
        : (!dto.routeId || dto.routeId === 'all-routes' || dto.routeId === 'all');

    // 1. Giá cơ sở theo đối tượng (1 tháng)
    let baseMonthlyPrice = 200000; // Worker / phổ thông
    if (dto.category === MonthlyPassCategory.STUDENT) {
      baseMonthlyPrice = 100000; // Trợ giá 50% cho SV ICTU
    } else if (dto.category === MonthlyPassCategory.ELDERLY) {
      baseMonthlyPrice = 80000; // Trợ giá 60% cho người cao tuổi
    }

    const grossAmount = baseMonthlyPrice * duration;

    // 2. Chiết khấu theo kỳ hạn
    let durationDiscountPercent = 0;
    let durationDiscountAmount = 0;
    if (duration === 3) {
      durationDiscountPercent = 10;
      durationDiscountAmount = Math.round(grossAmount * 0.1);
    } else if (duration === 6) {
      durationDiscountPercent = 16.67;
      if (dto.category === MonthlyPassCategory.STUDENT) {
        durationDiscountAmount = grossAmount - 500000; // 600k - 100k = 500k
      } else if (dto.category === MonthlyPassCategory.ELDERLY) {
        durationDiscountAmount = grossAmount - 400000; // 480k - 80k = 400k
      } else {
        durationDiscountAmount = grossAmount - 1000000; // 1200k - 200k = 1000k
      }
    }

    const discountedBase = grossAmount - durationDiscountAmount;

    // 3. Phụ thu vé liên tuyến toàn mạng buýt ICTU (+50.000 VND / tháng)
    const routeSurcharge = isAllRoutes ? 50000 * duration : 0;
    const finalPrice = discountedBase + routeSurcharge;

    return {
      category: dto.category,
      durationMonths: duration,
      isAllRoutes,
      baseMonthlyPrice,
      grossAmount,
      durationDiscountPercent,
      durationDiscountAmount,
      routeSurcharge,
      finalPrice,
    };
  }

  /**
   * Đăng ký vé tháng mới (Sinh viên / Phổ thông)
   */
  async register(dto: RegisterMonthlyPassDto, userId: string) {
    const isAllRoutes =
      !dto.routeId || dto.routeId === 'all-routes' || dto.routeId === 'all';

    let routeId: string | null = null;
    let routeName = 'Liên tuyến toàn mạng ICTU';

    if (!isAllRoutes && dto.routeId) {
      const route = await this.routeRepository.findOne({ where: { id: dto.routeId } });
      if (!route) {
        throw new NotFoundException(`Không tìm thấy tuyến xe buýt với ID: ${dto.routeId}`);
      }
      routeId = route.id;
      routeName = route.name;
    }

    const durationMonths = [1, 3, 6].includes(Number(dto.durationMonths))
      ? Number(dto.durationMonths)
      : 1;

    // Tính giá vé tháng
    const priceBreakdown = this.calculatePrice({
      category: dto.category,
      durationMonths,
      isAllRoutes,
      routeId: routeId || 'all-routes',
    });

    const passCode = generateMonthlyPassCode();

    // Tính ngày bắt đầu và ngày kết thúc
    const todayStr = new Date().toISOString().slice(0, 10);
    const startDate = dto.startDate || todayStr;
    const startObj = new Date(startDate);
    startObj.setMonth(startObj.getMonth() + durationMonths);
    const endDate = dto.endDate || startObj.toISOString().slice(0, 10);

    const monthlyPass = this.monthlyPassRepository.create({
      userId,
      routeId,
      passCode,
      category: dto.category,
      startDate,
      endDate,
      durationMonths,
      proofImageUrl: dto.proofImageUrl || null,
      price: priceBreakdown.finalPrice,
      approvalStatus: ApprovalStatus.PENDING,
      paymentStatus: MonthlyPassPaymentStatus.UNPAID,
      qrPayload: `ICTU-MONTHLY:${passCode}:${endDate}`,
    });

    const saved = await this.monthlyPassRepository.save(monthlyPass);

    // Gửi thông báo xác nhận đã tiếp nhận hồ sơ
    if (this.notificationCenterService && userId) {
      await this.notificationCenterService
        .saveNotification({
          userId,
          type: 'SYSTEM',
          title: 'Hồ sơ vé tháng đã được tiếp nhận',
          message: `Hồ sơ đăng ký vé tháng ${passCode} (${routeName}) của bạn đã được gửi thành công. Vui lòng chờ Ban Quản Lý thẩm định.`,
          deepLink: '/portal/monthly-pass',
          data: {
            passId: saved.id,
            passCode: saved.passCode,
            status: saved.approvalStatus,
          },
        })
        .catch(() => {});
    }

    return {
      ...saved,
      priceBreakdown,
    };
  }

  /**
   * Tạo yêu cầu thanh toán cho vé tháng (VietQR / MoMo / VNPAY)
   */
  async createPayment(id: string, dto: CreateMonthlyPassPaymentDto, userId: string) {
    const pass = await this.monthlyPassRepository.findOne({
      where: { id },
      relations: { route: true, user: true },
    });

    if (!pass) {
      throw new NotFoundException('Không tìm thấy thông tin vé tháng');
    }

    if (pass.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thanh toán cho vé tháng này');
    }

    if (pass.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new BadRequestException(
        `Hồ sơ vé tháng chưa được phê duyệt (Trạng thái: ${pass.approvalStatus}). Vui lòng chờ xét duyệt trước khi thanh toán.`,
      );
    }

    if (pass.paymentStatus === MonthlyPassPaymentStatus.PAID) {
      throw new BadRequestException('Vé tháng này đã được thanh toán thành công trước đó.');
    }

    const amount = Number(pass.price) || 100000;
    const paymentMethod = dto.paymentMethod || PaymentMethod.VIETQR;
    const paymentDesc = `ICTU MP ${pass.passCode}`;

    // Tạo link VietQR chuẩn NAPAS 24/7
    const vietQrUrl = `https://img.vietqr.io/image/TCB-1903678999999-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(
      paymentDesc,
    )}&accountName=${encodeURIComponent('CONG TY XE BUYT DIEN ICTU')}`;

    return {
      passId: pass.id,
      passCode: pass.passCode,
      amount,
      paymentMethod,
      description: paymentDesc,
      bankAccount: {
        bankName: 'Techcombank',
        accountNo: '1903678999999',
        accountName: 'CONG TY XE BUYT DIEN ICTU',
      },
      qrCodeUrl: vietQrUrl,
      quickPayAvailable: true,
    };
  }

  /**
   * Xác nhận thanh toán vé tháng (Hỗ trợ Demo Quick Pay trong 1 giây)
   */
  async confirmPayment(id: string, dto: ConfirmMonthlyPassPaymentDto, userId: string) {
    const pass = await this.monthlyPassRepository.findOne({
      where: { id },
      relations: { route: true, user: true },
    });

    if (!pass) {
      throw new NotFoundException('Không tìm thấy thông tin vé tháng');
    }

    if (pass.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên vé tháng này');
    }

    if (pass.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new BadRequestException('Hồ sơ vé tháng chưa được duyệt. Không thể xác nhận thanh toán.');
    }

    if (pass.paymentStatus === MonthlyPassPaymentStatus.PAID) {
      return {
        message: 'Vé tháng đã được thanh toán trước đó',
        pass,
      };
    }

    // 1. Cập nhật trạng thái vé tháng
    pass.paymentStatus = MonthlyPassPaymentStatus.PAID;
    const qrPayload = `ICTU-MONTHLY:${pass.passCode}:${pass.endDate}`;
    pass.qrPayload = qrPayload;
    await this.monthlyPassRepository.save(pass);

    // 2. Ghi nhận giao dịch thanh toán vào bảng lịch sử
    const transactionCode =
      dto.transactionCode || `MP-PAY-${Date.now().toString().slice(-6)}`;

    const transaction = this.transactionRepository.create({
      monthlyPassId: pass.id,
      userId: pass.userId,
      type: 'register',
      durationMonths: pass.durationMonths || 1,
      previousEndDate: undefined,
      newEndDate: pass.endDate,
      amount: pass.price,
      paymentMethod: dto.paymentMethod || PaymentMethod.VIETQR,
      paymentStatus: 'completed',
      transactionCode,
      notes: `Thanh toán đăng ký vé tháng ${pass.passCode} thành công`,
    });

    await this.transactionRepository.save(transaction);

    // 3. Gửi thông báo kích hoạt vé tháng thành công
    if (this.notificationCenterService && pass.userId) {
      await this.notificationCenterService
        .saveNotification({
          userId: pass.userId,
          type: 'SYSTEM',
          title: 'Kích hoạt vé tháng thành công',
          message: `Thẻ vé tháng ${pass.passCode} của bạn đã được thanh toán và kích hoạt thành công. Mã QR điện tử đã sẵn sàng để soát vé trên xe buýt!`,
          deepLink: '/portal/monthly-pass',
          data: {
            passId: pass.id,
            passCode: pass.passCode,
            endDate: pass.endDate,
            qrPayload,
          },
        })
        .catch(() => {});
    }

    return {
      message: 'Thanh toán vé tháng thành công',
      pass,
      transaction,
    };
  }

  /**
   * Gia hạn vé tháng trực tuyến (Cộng dồn thời hạn thông minh)
   */
  async renew(id: string, dto: RenewMonthlyPassDto, userId: string) {
    const pass = await this.monthlyPassRepository.findOne({
      where: { id },
      relations: { route: true, user: true },
    });

    if (!pass) {
      throw new NotFoundException('Không tìm thấy thông tin vé tháng');
    }

    if (pass.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền gia hạn vé tháng này');
    }

    if (pass.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new BadRequestException('Hồ sơ vé tháng chưa được duyệt. Không thể gia hạn.');
    }

    const durationMonths = [1, 3, 6].includes(Number(dto.durationMonths))
      ? Number(dto.durationMonths)
      : 1;

    // Tính phí gia hạn
    const priceBreakdown = this.calculatePrice({
      category: pass.category,
      durationMonths,
      isAllRoutes: !pass.routeId,
      routeId: pass.routeId || 'all-routes',
    });

    // Cộng dồn thời hạn thông minh:
    // Nếu thẻ còn hạn (endDate >= hôm nay) -> cộng nối tiếp từ endDate cũ
    // Nếu thẻ đã hết hạn (endDate < hôm nay) -> cộng nối tiếp từ hôm nay
    const todayStr = new Date().toISOString().slice(0, 10);
    const previousEndDate = pass.endDate;
    const baseDateStr = pass.endDate >= todayStr ? pass.endDate : todayStr;

    const baseDate = new Date(baseDateStr);
    baseDate.setMonth(baseDate.getMonth() + durationMonths);
    const newEndDate = baseDate.toISOString().slice(0, 10);

    // Nếu chọn Demo Quick Pay (autoConfirmPayment = true)
    if (dto.autoConfirmPayment) {
      pass.endDate = newEndDate;
      pass.durationMonths = durationMonths;
      pass.paymentStatus = MonthlyPassPaymentStatus.PAID;
      pass.qrPayload = `ICTU-MONTHLY:${pass.passCode}:${newEndDate}`;
      await this.monthlyPassRepository.save(pass);

      const transactionCode = `MP-RNW-${Date.now().toString().slice(-6)}`;
      const transaction = this.transactionRepository.create({
        monthlyPassId: pass.id,
        userId: pass.userId,
        type: 'renew',
        durationMonths,
        previousEndDate,
        newEndDate,
        amount: priceBreakdown.finalPrice,
        paymentMethod: dto.paymentMethod || PaymentMethod.VIETQR,
        paymentStatus: 'completed',
        transactionCode,
        notes: `Gia hạn vé tháng ${durationMonths} tháng thành công`,
      });
      await this.transactionRepository.save(transaction);

      // Gửi thông báo gia hạn thành công
      if (this.notificationCenterService && pass.userId) {
        await this.notificationCenterService
          .saveNotification({
            userId: pass.userId,
            type: 'SYSTEM',
            title: 'Gia hạn vé tháng thành công',
            message: `Thẻ vé tháng ${pass.passCode} đã được gia hạn thêm ${durationMonths} tháng. Thời hạn mới đến ngày ${newEndDate}.`,
            deepLink: '/portal/monthly-pass',
            data: {
              passId: pass.id,
              passCode: pass.passCode,
              previousEndDate,
              newEndDate,
            },
          })
          .catch(() => {});
      }

      return {
        message: `Gia hạn vé tháng thành công thêm ${durationMonths} tháng`,
        pass,
        transaction,
        newEndDate,
        priceBreakdown,
      };
    }

    // Luồng thanh toán thông thường: Trả về báo giá và thông tin chuyển khoản VietQR
    const paymentDesc = `ICTU RNW ${pass.passCode}`;
    const amount = priceBreakdown.finalPrice;
    const vietQrUrl = `https://img.vietqr.io/image/TCB-1903678999999-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(
      paymentDesc,
    )}&accountName=${encodeURIComponent('CONG TY XE BUYT DIEN ICTU')}`;

    return {
      passId: pass.id,
      passCode: pass.passCode,
      durationMonths,
      previousEndDate,
      newEndDate,
      priceBreakdown,
      paymentInfo: {
        amount,
        description: paymentDesc,
        bankAccount: {
          bankName: 'Techcombank',
          accountNo: '1903678999999',
          accountName: 'CONG TY XE BUYT DIEN ICTU',
        },
        qrCodeUrl: vietQrUrl,
      },
    };
  }

  /**
   * Xem danh sách vé tháng của cá nhân người dùng
   */
  async getMyPasses(userId: string) {
    const passes = await this.monthlyPassRepository.find({
      where: { userId },
      relations: { route: true, transactions: true },
      order: { createdAt: 'DESC' },
    });

    // Đảm bảo qrPayload luôn có giá trị hiển thị cho vé đã thanh toán
    return passes.map((p) => {
      if (!p.qrPayload && p.paymentStatus === MonthlyPassPaymentStatus.PAID) {
        p.qrPayload = `ICTU-MONTHLY:${p.passCode}:${p.endDate}`;
      }
      return p;
    });
  }

  /**
   * Xem chi tiết vé tháng
   */
  async getPassDetail(id: string, userId: string, isAdmin = false) {
    const pass = await this.monthlyPassRepository.findOne({
      where: { id },
      relations: { route: true, user: true, approvedByUser: true, transactions: true },
    });

    if (!pass) {
      throw new NotFoundException('Không tìm thấy vé tháng');
    }

    if (!isAdmin && pass.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xem thông tin vé tháng này');
    }

    return pass;
  }

  /**
   * Xem lịch sử giao dịch và gia hạn của vé tháng
   */
  async getPassHistory(id: string, userId: string, isAdmin = false) {
    const pass = await this.monthlyPassRepository.findOne({
      where: { id },
      relations: { route: true },
    });

    if (!pass) {
      throw new NotFoundException('Không tìm thấy vé tháng');
    }

    if (!isAdmin && pass.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xem lịch sử vé tháng này');
    }

    const transactions = await this.transactionRepository.find({
      where: { monthlyPassId: id },
      order: { createdAt: 'DESC' },
    });

    return {
      pass: {
        id: pass.id,
        passCode: pass.passCode,
        category: pass.category,
        approvalStatus: pass.approvalStatus,
        paymentStatus: pass.paymentStatus,
        startDate: pass.startDate,
        endDate: pass.endDate,
        routeName: pass.route?.name || 'Liên tuyến toàn mạng ICTU',
      },
      history: transactions,
    };
  }

  /**
   * Danh sách hồ sơ vé tháng dành cho Quản lý / Admin
   */
  async getAdminPasses(pagination: PaginationDto, status?: ApprovalStatus) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const query = this.monthlyPassRepository
      .createQueryBuilder('pass')
      .innerJoinAndSelect('pass.user', 'user')
      .leftJoinAndSelect('pass.route', 'route')
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

  /**
   * Duyệt hoặc từ chối hồ sơ đăng ký vé tháng
   */
  async review(id: string, dto: ReviewMonthlyPassDto, reviewerId: string) {
    const pass = await this.monthlyPassRepository.findOne({
      where: { id },
      relations: { route: true },
    });
    if (!pass) {
      throw new NotFoundException('Không tìm thấy hồ sơ vé tháng');
    }

    pass.approvalStatus = dto.status;
    pass.approvedBy = reviewerId;
    if (dto.rejectionReason) {
      pass.rejectionReason = dto.rejectionReason;
    }

    await this.monthlyPassRepository.save(pass);

    // Gửi thông báo hệ thống cho sinh viên/hành khách
    if (this.notificationCenterService && pass.userId) {
      const isApproved = dto.status === ApprovalStatus.APPROVED;
      await this.notificationCenterService
        .saveNotification({
          userId: pass.userId,
          type: 'SYSTEM',
          title: isApproved ? 'Hồ sơ vé tháng được phê duyệt' : 'Hồ sơ vé tháng bị từ chối',
          message: isApproved
            ? `Chúc mừng! Hồ sơ vé tháng của bạn (Mã: ${pass.passCode}) đã được phê duyệt thành công. Vui lòng thanh toán để nhận thẻ điện tử và mã QR lên xe!`
            : `Rất tiếc! Hồ sơ vé tháng của bạn (Mã: ${pass.passCode}) đã bị từ chối. Lý do: ${dto.rejectionReason || 'Thông tin không hợp lệ'}.`,
          deepLink: '/portal/monthly-pass',
          data: {
            passId: pass.id,
            passCode: pass.passCode,
            status: dto.status,
          },
        })
        .catch(() => {});
    }

    return pass;
  }
}
