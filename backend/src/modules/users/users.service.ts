import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import bcrypt from 'bcrypt';
import { UserEntity } from '../../database/entities/user.entity.js';
import { RoleEntity } from '../../database/entities/role.entity.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { CreateUserDto, UpdateUserDto, ChangeRoleDto, ChangeStatusDto } from './dto/user.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { Role } from '../../common/constants/roles.constant.js';
import { UserStatus, TripStatus } from '../../common/constants/status.constant.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(TripEntity)
    private readonly tripRepository: Repository<TripEntity>,
    @InjectRepository(TicketEntity)
    private readonly ticketRepository: Repository<TicketEntity>,
  ) {}

  async findAll(
    pagination: PaginationDto,
    search?: string,
    role?: string,
    status?: string,
    classification?: string,
  ) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .select([
        'user.id',
        'user.fullName',
        'user.email',
        'user.phoneNumber',
        'user.avatarUrl',
        'user.studentId',
        'user.faculty',
        'user.idCardNumber',
        'user.status',
        'user.createdAt',
        'user.updatedAt',
        'role.id',
        'role.name',
        'role.description',
      ]);

    if (search) {
      query.andWhere(
        '(LOWER(user.fullName) LIKE :search OR LOWER(user.email) LIKE :search OR user.phoneNumber LIKE :search OR user.studentId LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    if (role) {
      query.andWhere('role.name = :role', { role });
    }

    if (status) {
      query.andWhere('user.status = :status', { status });
    }

    if (classification === 'official') {
      query.andWhere(
        "user.email NOT LIKE 'integration-test-%' AND user.email NOT LIKE 'alias-test-%' AND user.email NOT LIKE 'trips-test-%' AND user.email NOT LIKE 'test.cloud%'",
      );
    } else if (classification === 'test') {
      query.andWhere(
        "(user.email LIKE 'integration-test-%' OR user.email LIKE 'alias-test-%' OR user.email LIKE 'trips-test-%' OR user.email LIKE 'test.cloud%')",
      );
    }

    query.orderBy('user.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await query.getManyAndCount();

    const isTestEmail = (email: string) => {
      const lower = (email || '').toLowerCase();
      return (
        lower.startsWith('integration-test-') ||
        lower.startsWith('alias-test-') ||
        lower.startsWith('trips-test-passenger-') ||
        lower.startsWith('test.cloud@') ||
        lower.includes('test-passenger-') ||
        lower.includes('test-user-')
      );
    };

    const taggedItems = items.map((u) => ({
      ...u,
      isTestAccount: isTestEmail(u.email),
      classification: isTestEmail(u.email) ? 'test' : 'official',
    }));

    return {
      items: taggedItems,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { role: true },
    });

    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng với ID ${id}`);
    }

    const { passwordHash, refreshTokenHash, ...result } = user;
    return result;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Email này đã tồn tại trong hệ thống');
    }

    let role = await this.roleRepository.findOne({
      where: { name: dto.role },
    });

    if (!role) {
      role = this.roleRepository.create({
        name: dto.role,
        description: dto.role === Role.CONDUCTOR ? 'Phụ xe / Soát vé viên' : `Vai trò ${dto.role}`,
      });
      await this.roleRepository.save(role);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.userRepository.create({
      fullName: dto.fullName,
      email: dto.email.toLowerCase(),
      phoneNumber: dto.phoneNumber,
      passwordHash,
      roleId: role.id,
      studentId: dto.studentId,
      faculty: dto.faculty,
      idCardNumber: dto.idCardNumber,
      status: UserStatus.ACTIVE,
    });

    const saved = await this.userRepository.save(user);
    const { passwordHash: _, refreshTokenHash: __, ...result } = saved;
    return { ...result, role: role.name };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findById(id);

    await this.userRepository.update(id, {
      ...(dto.fullName && { fullName: dto.fullName }),
      ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
      ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      ...(dto.studentId !== undefined && { studentId: dto.studentId }),
      ...(dto.faculty !== undefined && { faculty: dto.faculty }),
      ...(dto.idCardNumber !== undefined && { idCardNumber: dto.idCardNumber }),
    });

    return this.findById(id);
  }

  async changeRole(id: string, dto: ChangeRoleDto) {
    const user = await this.findById(id);

    const role = await this.roleRepository.findOne({
      where: { name: dto.role },
    });

    if (!role) {
      throw new BadRequestException(`Vai trò ${dto.role} không tồn tại`);
    }

    await this.userRepository.update(id, { roleId: role.id });
    return this.findById(id);
  }

  async changeStatus(id: string, dto: ChangeStatusDto) {
    await this.findById(id);
    await this.userRepository.update(id, { status: dto.status });
    return this.findById(id);
  }

  async remove(id: string) {
    const user = await this.findById(id);

    // Không cho phép xóa các tài khoản admin cốt lõi
    if (user.email === 'admin@smartbus.ictu.vn' || user.email === 'narukun2812@gmail.com') {
      throw new BadRequestException('Không thể xóa tài khoản Quản trị viên cấp cao của hệ thống');
    }

    // Xóa an toàn các ràng buộc dữ liệu phụ nếu có
    await this.userRepository.query(`DELETE FROM notifications WHERE user_id = $1`, [id]).catch(() => {});
    await this.userRepository.query(`DELETE FROM notification_preferences WHERE user_id = $1`, [id]).catch(() => {});
    await this.userRepository.query(`DELETE FROM device_tokens WHERE user_id = $1`, [id]).catch(() => {});
    await this.userRepository.query(`DELETE FROM seat_holds WHERE user_id = $1`, [id]).catch(() => {});
    await this.userRepository.query(`DELETE FROM activity_logs WHERE user_id = $1`, [id]).catch(() => {});
    await this.userRepository.query(`DELETE FROM feedback WHERE user_id = $1`, [id]).catch(() => {});
    await this.userRepository.query(`DELETE FROM monthly_passes WHERE user_id = $1`, [id]).catch(() => {});

    await this.userRepository.delete(id);
    return { success: true, message: `Đã xóa tài khoản [${user.email}] thành công` };
  }

  async cleanupTestData() {
    const testPatterns = [
      'integration-test-%',
      'alias-test-%',
      'trips-test-%',
      'test.cloud%',
      '%test-passenger-%',
      '%test-user-%',
    ];

    const usersToDelete = await this.userRepository
      .createQueryBuilder('user')
      .where(
        testPatterns.map((_, i) => `user.email LIKE :p${i}`).join(' OR '),
        testPatterns.reduce((acc, p, i) => ({ ...acc, [`p${i}`]: p }), {}),
      )
      .getMany();

    if (usersToDelete.length === 0) {
      return {
        success: true,
        deletedCount: 0,
        message: 'Không tìm thấy tài khoản kiểm thử nào cần xóa. Cơ sở dữ liệu sạch 100%!',
      };
    }

    const testIds = usersToDelete.map((u) => u.id);

    // Xóa an toàn các bảng phụ thuộc
    await this.userRepository.query(`DELETE FROM notifications WHERE user_id = ANY($1)`, [testIds]).catch(() => {});
    await this.userRepository.query(`DELETE FROM notification_preferences WHERE user_id = ANY($1)`, [testIds]).catch(() => {});
    await this.userRepository.query(`DELETE FROM device_tokens WHERE user_id = ANY($1)`, [testIds]).catch(() => {});
    await this.userRepository.query(`DELETE FROM seat_holds WHERE user_id = ANY($1)`, [testIds]).catch(() => {});
    await this.userRepository.query(`DELETE FROM activity_logs WHERE user_id = ANY($1)`, [testIds]).catch(() => {});
    await this.userRepository.query(`DELETE FROM feedback WHERE user_id = ANY($1)`, [testIds]).catch(() => {});
    await this.userRepository.query(`DELETE FROM monthly_passes WHERE user_id = ANY($1)`, [testIds]).catch(() => {});

    await this.userRepository.query(`DELETE FROM users WHERE id = ANY($1)`, [testIds]);

    return {
      success: true,
      deletedCount: usersToDelete.length,
      deletedEmails: usersToDelete.map((u) => u.email),
      message: `Đã dọn dẹp thành công ${usersToDelete.length} tài khoản kiểm thử và dữ liệu rác.`,
    };
  }

  async getDriverActivity(driverId: string) {
    const driver = await this.userRepository.findOne({
      where: { id: driverId },
      relations: { role: true },
    });

    if (!driver) {
      throw new NotFoundException(`Không tìm thấy tài khoản tài xế với ID ${driverId}`);
    }

    // 1. Lấy danh sách chuyến xe phụ trách (15 chuyến gần nhất)
    const trips = await this.tripRepository.find({
      where: { driverId },
      relations: { route: true, vehicle: true },
      order: { departureTime: 'DESC' },
      take: 15,
    });

    // 2. Thống kê số lượng chuyến
    const totalTrips = await this.tripRepository.count({ where: { driverId } });
    const completedTrips = await this.tripRepository.count({
      where: { driverId, status: TripStatus.COMPLETED },
    });
    const inProgressTrips = await this.tripRepository.count({
      where: { driverId, status: TripStatus.IN_PROGRESS },
    });

    // 3. Tổng số lượt vé đã soát thành công bởi tài xế này
    const totalTicketsCheckedIn = await this.ticketRepository.count({
      where: { checkedInBy: driverId },
    });

    // 4. Lịch sử 10 lượt soát vé gần nhất
    const recentCheckIns = await this.ticketRepository.find({
      where: { checkedInBy: driverId },
      relations: {
        booking: {
          trip: {
            route: true,
          },
        },
        seat: true,
      },
      order: { checkedInAt: 'DESC' },
      take: 10,
    });

    return {
      driver: {
        id: driver.id,
        fullName: driver.fullName,
        email: driver.email,
        phoneNumber: driver.phoneNumber,
        idCardNumber: driver.idCardNumber,
        status: driver.status,
        licenseClass: driver.faculty || 'Hạng D (Xe 29-45 chỗ)',
        role: driver.role?.name || 'driver',
        createdAt: driver.createdAt,
      },
      stats: {
        totalTrips,
        completedTrips,
        inProgressTrips,
        totalTicketsCheckedIn,
      },
      trips: trips.map((t) => ({
        id: t.id,
        departureTime: t.departureTime,
        status: t.status,
        routeName: t.route?.name || 'Tuyến buýt ICTU',
        routeCode: t.route?.routeCode,
        vehiclePlate: t.vehicle?.licensePlate || 'Chưa gán xe',
        capacity: t.vehicle?.seatCapacity,
      })),
      recentCheckIns: recentCheckIns.map((t) => ({
        ticketCode: t.ticketCode,
        passengerName: t.passengerName,
        seatNumber: t.seat?.seatNumber || 'Ghế tiêu chuẩn',
        routeName: t.booking?.trip?.route?.name || 'Tuyến buýt ICTU',
        checkedInAt: t.checkedInAt,
      })),
    };
  }
}
