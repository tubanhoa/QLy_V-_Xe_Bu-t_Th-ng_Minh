import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import {
  DriverProfileEntity,
  DriverLicenseStatus,
} from '../../database/entities/driver-profile.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { RoleEntity } from '../../database/entities/role.entity.js';
import { NotificationEntity } from '../../database/entities/notification.entity.js';
import {
  CreateDriverProfileDto,
  UpdateDriverProfileDto,
  ReviewDriverProfileDto,
  ListDriverProfilesQueryDto,
} from './dto/driver-profile.dto.js';
import { Role } from '../../common/constants/roles.constant.js';

@Injectable()
export class DriverProfileService {
  private readonly logger = new Logger(DriverProfileService.name);

  constructor(
    @InjectRepository(DriverProfileEntity)
    private readonly driverProfileRepo: Repository<DriverProfileEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
  ) {}

  /**
   * Lấy danh sách hồ sơ bằng lái của tất cả tài xế kèm số liệu KPI tổng hợp
   */
  async findAll(query: ListDriverProfilesQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    // 1. Lấy tất cả tài khoản có role = driver
    const driverRole = await this.roleRepo.findOne({ where: { name: Role.DRIVER } });
    if (!driverRole) {
      return {
        items: [],
        total: 0,
        page,
        limit,
        kpis: { totalDrivers: 0, approvedCount: 0, pendingCount: 0, rejectedCount: 0, unsubmittedCount: 0 },
      };
    }

    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.role_id = :roleId', { roleId: driverRole.id });

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(user.full_name) LIKE :term OR LOWER(user.email) LIKE :term OR user.phone_number LIKE :term)',
        { term },
      );
    }

    const allDrivers = await qb.orderBy('user.created_at', 'ASC').getMany();

    // 2. Lấy toàn bộ hồ sơ driver_profiles tương ứng
    const profiles = await this.driverProfileRepo.find({
      relations: { approvedByUser: true },
    });
    const profileMap = new Map<string, DriverProfileEntity>();
    for (const p of profiles) {
      profileMap.set(p.userId, p);
    }

    // 3. Kết hợp Driver + Profile
    type CombinedDriverRecord = {
      driver: {
        id: string;
        fullName: string;
        email: string;
        phoneNumber: string | null;
        avatarUrl: string | null;
        status: string;
        createdAt: Date;
      };
      profile: DriverProfileEntity | null;
      status: 'pending' | 'approved' | 'rejected' | 'unsubmitted';
    };

    const combinedList: CombinedDriverRecord[] = allDrivers.map((d) => {
      const p = profileMap.get(d.id) || null;
      const status: 'pending' | 'approved' | 'rejected' | 'unsubmitted' = p
        ? p.status
        : 'unsubmitted';
      return {
        driver: {
          id: d.id,
          fullName: d.fullName,
          email: d.email,
          phoneNumber: d.phoneNumber,
          avatarUrl: d.avatarUrl,
          status: d.status,
          createdAt: d.createdAt,
        },
        profile: p,
        status,
      };
    });

    // 4. Tính toán KPIs tổng quan
    const kpis = {
      totalDrivers: combinedList.length,
      approvedCount: combinedList.filter((item) => item.status === 'approved').length,
      pendingCount: combinedList.filter((item) => item.status === 'pending').length,
      rejectedCount: combinedList.filter((item) => item.status === 'rejected').length,
      unsubmittedCount: combinedList.filter((item) => item.status === 'unsubmitted').length,
    };

    // 5. Lọc theo trạng thái nếu có
    let filtered = combinedList;
    if (query.status && query.status !== 'all') {
      const targetStatus = query.status.toLowerCase();
      filtered = combinedList.filter((item) => item.status === targetStatus);
    }

    // 6. Phân trang
    const total = filtered.length;
    const items = filtered.slice(skip, skip + limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      kpis,
    };
  }

  /**
   * Xem chi tiết hồ sơ bằng lái của một tài xế cụ thể
   */
  async findByDriverId(driverId: string) {
    const user = await this.userRepo.findOne({
      where: { id: driverId },
      relations: { role: true },
    });
    if (!user) {
      throw new NotFoundException(`Không tìm thấy tài xế với ID ${driverId}`);
    }

    const profile = await this.driverProfileRepo.findOne({
      where: { userId: driverId },
      relations: { approvedByUser: true },
    });

    return {
      driver: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        avatarUrl: user.avatarUrl,
        status: user.status,
      },
      profile,
      status: profile ? profile.status : 'unsubmitted',
    };
  }

  /**
   * Admin trực tiếp tạo mới hoặc cập nhật hồ sơ bằng lái cho tài xế
   */
  async upsertProfile(driverId: string, dto: UpdateDriverProfileDto | CreateDriverProfileDto, adminId?: string) {
    const user = await this.userRepo.findOne({ where: { id: driverId } });
    if (!user) {
      throw new NotFoundException(`Không tìm thấy tài khoản tài xế với ID ${driverId}`);
    }

    let profile = await this.driverProfileRepo.findOne({ where: { userId: driverId } });
    if (!profile) {
      profile = this.driverProfileRepo.create({
        userId: driverId,
        licenseNumber: (dto as any).licenseNumber || 'GPLX-D-CHUA-CAP-NHAT',
        licenseClass: (dto as any).licenseClass || 'D',
        frontImageUrl: (dto as any).frontImageUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80',
        status: (dto as any).status || DriverLicenseStatus.PENDING,
      });
    }

    if (dto.licenseNumber) profile.licenseNumber = dto.licenseNumber.trim();
    if (dto.licenseClass) profile.licenseClass = dto.licenseClass.trim();
    if (dto.issueDate !== undefined) profile.issueDate = dto.issueDate;
    if (dto.expiryDate !== undefined) profile.expiryDate = dto.expiryDate;
    if (dto.frontImageUrl) profile.frontImageUrl = dto.frontImageUrl.trim();
    if (dto.backImageUrl !== undefined) profile.backImageUrl = dto.backImageUrl ? dto.backImageUrl.trim() : null;

    if (dto.status) {
      profile.status = dto.status;
      if (dto.status === DriverLicenseStatus.APPROVED) {
        profile.approvedBy = adminId || null;
        profile.approvedAt = new Date();
        profile.rejectionReason = null;
      }
    }

    const saved = await this.driverProfileRepo.save(profile);
    this.logger.log(`Admin ${adminId} đã cập nhật hồ sơ GPLX cho tài xế ${user.fullName} (${driverId})`);
    return saved;
  }

  /**
   * Admin thẩm định hồ sơ: Phê duyệt hoặc từ chối kèm lý do
   */
  async reviewProfile(driverId: string, dto: ReviewDriverProfileDto, adminId: string) {
    const user = await this.userRepo.findOne({ where: { id: driverId } });
    if (!user) {
      throw new NotFoundException(`Không tìm thấy tài xế với ID ${driverId}`);
    }

    let profile = await this.driverProfileRepo.findOne({ where: { userId: driverId } });
    if (!profile) {
      throw new NotFoundException(`Tài xế ${user.fullName} chưa có bản ghi hồ sơ GPLX để thẩm định`);
    }

    if (dto.status === DriverLicenseStatus.REJECTED) {
      if (!dto.rejectionReason || !dto.rejectionReason.trim()) {
        throw new BadRequestException('Vui lòng nhập lý do từ chối cụ thể để thông báo cho tài xế');
      }
      profile.status = DriverLicenseStatus.REJECTED;
      profile.rejectionReason = dto.rejectionReason.trim();
      profile.approvedBy = adminId;
      profile.approvedAt = new Date();
    } else {
      profile.status = DriverLicenseStatus.APPROVED;
      profile.rejectionReason = null;
      profile.approvedBy = adminId;
      profile.approvedAt = new Date();
    }

    const saved = await this.driverProfileRepo.save(profile);

    // Gửi thông báo In-app cho tài xế
    try {
      const isApproved = dto.status === DriverLicenseStatus.APPROVED;
      const notif = this.notificationRepo.create({
        userId: driverId,
        title: isApproved ? 'Hồ sơ GPLX đã được phê duyệt' : 'Hồ sơ GPLX chưa đạt yêu cầu',
        body: isApproved
          ? `Giấy phép lái xe ${profile.licenseClass} (Số: ${profile.licenseNumber}) của bạn đã được Ban Quản Lý phê duyệt hợp lệ. Bạn đã đủ điều kiện nhận ca điều phối xe buýt.`
          : `Hồ sơ GPLX của bạn chưa được duyệt do: ${profile.rejectionReason}. Vui lòng cập nhật lại ảnh chụp rõ nét.`,
        type: 'SYSTEM',
        isRead: false,
      });
      await this.notificationRepo.save(notif);
    } catch (err) {
      this.logger.warn(`Không thể gửi thông báo in-app cho tài xế: ${err}`);
    }

    this.logger.log(`Admin ${adminId} đã xét duyệt hồ sơ GPLX tài xế ${user.fullName} -> ${profile.status}`);
    return saved;
  }
}
