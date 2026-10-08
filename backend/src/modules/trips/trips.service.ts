import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
  Optional,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, Not } from 'typeorm';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { RouteEntity } from '../../database/entities/route.entity.js';
import { VehicleEntity } from '../../database/entities/vehicle.entity.js';
import { SeatEntity } from '../../database/entities/seat.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { SeatHoldEntity } from '../../database/entities/seat-hold.entity.js';
import { MonthlyPassEntity } from '../../database/entities/monthly-pass.entity.js';
import { GenerateTripsDto, DispatchTripDto, UpdateTripStatusDto, VerifyQrDto, CreateAdhocTripDto } from './dto/trip.dto.js';
import { ListTripsQueryDto } from './dto/list-trips-query.dto.js';
import {
  TripStatus,
  TicketStatus,
  BookingStatus,
  ApprovalStatus,
  VehicleStatus,
  UserStatus,
} from '../../common/constants/status.constant.js';
import { verifyQrData } from '../../common/utils/qr-code.util.js';
import { SeatLockService } from '../booking/seat-lock.service.js';
import { NotificationCenterService } from '../notification/notification-center.service.js';
import { FcmService } from '../notification/fcm.service.js';

// Map DTO field names to actual DB column names
const SORT_COLUMN_MAP: Record<string, string> = {
  departureTime: 'trip.departureTime',
  status: 'trip.status',
  createdAt: 'trip.createdAt',
};

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    @InjectRepository(TripEntity)
    private readonly tripRepository: Repository<TripEntity>,
    @InjectRepository(RouteEntity)
    private readonly routeRepository: Repository<RouteEntity>,
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepository: Repository<VehicleEntity>,
    @InjectRepository(SeatEntity)
    private readonly seatRepository: Repository<SeatEntity>,
    @InjectRepository(TicketEntity)
    private readonly ticketRepository: Repository<TicketEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @Optional()
    @InjectRepository(MonthlyPassEntity)
    private readonly monthlyPassRepository?: Repository<MonthlyPassEntity>,
    @Inject(forwardRef(() => SeatLockService))
    @Optional()
    private readonly seatLockService?: SeatLockService,
    @Optional()
    @InjectRepository(SeatHoldEntity)
    private readonly seatHoldRepository?: Repository<SeatHoldEntity>,
    @Optional()
    private readonly notificationCenterService?: NotificationCenterService,
    @Optional()
    private readonly fcmService?: FcmService,
  ) {}

  /**
   * GET /api/v1/trips — Danh sách chuyến xe cho Admin/Manager
   * Hỗ trợ filter (date, routeId, status, excludeDeparted), pagination, sort
   */
  async findAll(query: ListTripsQueryDto) {
    const {
      date,
      routeId,
      status,
      tripType,
      assignmentStatus,
      excludeDeparted,
      page = 1,
      limit = 20,
      sortBy = 'departureTime',
      sortOrder = 'ASC',
    } = query;

    const qb = this.tripRepository
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .leftJoinAndSelect('trip.driver', 'driver')
      .leftJoinAndSelect('trip.conductor', 'conductor');

    // Filter by date or Rolling Window (T+3 days)
    if (date) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        throw new BadRequestException('Định dạng ngày không hợp lệ (YYYY-MM-DD)');
      }
      const startOfDay = new Date(date + 'T00:00:00.000Z');
      const endOfDay = new Date(date + 'T23:59:59.999Z');
      qb.andWhere('trip.departureTime BETWEEN :start AND :end', {
        start: startOfDay.toISOString(),
        end: endOfDay.toISOString(),
      });
    } else {
      // Default: Cửa sổ lập lịch trượt (Rolling Window: Hôm nay + 3 ngày tới)
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfRollingWindow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 23, 59, 59, 999);
      qb.andWhere('trip.departureTime BETWEEN :start AND :end', {
        start: startOfDay.toISOString(),
        end: endOfRollingWindow.toISOString(),
      });
    }

    // Filter by routeId
    if (routeId) {
      qb.andWhere('trip.routeId = :routeId', { routeId });
    }

    // Filter by status
    if (status) {
      qb.andWhere('trip.status = :status', { status });
    }

    // Filter by tripType (regular / adhoc / special)
    if (tripType && tripType !== 'all') {
      qb.andWhere('trip.tripType = :tripType', { tripType });
    }

    // Filter by assignmentStatus (assigned / unassigned)
    if (assignmentStatus === 'assigned') {
      qb.andWhere('trip.vehicleId IS NOT NULL AND trip.driverId IS NOT NULL');
    } else if (assignmentStatus === 'unassigned') {
      qb.andWhere('(trip.vehicleId IS NULL OR trip.driverId IS NULL)');
    }

    // STT6: Exclude departed trips
    if (excludeDeparted) {
      qb.andWhere('trip.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: [
          TripStatus.DEPARTED,
          TripStatus.IN_PROGRESS,
          TripStatus.COMPLETED,
        ],
      });
    }

    // Sorting (whitelist validated by DTO)
    const sortColumn = SORT_COLUMN_MAP[sortBy] || 'trip.departureTime';
    qb.orderBy(sortColumn, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    // Execute query
    const [items, totalItems] = await qb.getManyAndCount();

    return {
      items,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async generateSchedule(dto: GenerateTripsDto) {
    const route = await this.routeRepository.findOne({ where: { id: dto.routeId } });
    if (!route) {
      throw new NotFoundException(`Không tìm thấy tuyến xe với ID ${dto.routeId}`);
    }

    const startTimeStr = dto.startTime || route.operatingStart || '06:00:00';
    const endTimeStr = dto.endTime || route.operatingEnd || '20:00:00';
    const intervalMinutes = dto.intervalMinutes || route.frequencyMinutes || 30;

    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);

    const baseDate = new Date(`${dto.date}T00:00:00`);
    const tripsToSave: TripEntity[] = [];

    let currentMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (intervalMinutes <= 0) {
      throw new BadRequestException('Tần suất chạy xe (intervalMinutes) phải lớn hơn 0 phút');
    }

    if (currentMinutes >= endMinutes) {
      throw new BadRequestException(
        `Giờ bắt đầu xuất bến (${startTimeStr}) phải sớm hơn giờ kết thúc ca chạy (${endTimeStr})`,
      );
    }

    // Estimate trip duration in minutes from route distance or default 45 mins
    const estimatedTripMinutes = route.distanceKm ? Math.round(Number(route.distanceKm) * 2.5) : 45;

    while (currentMinutes <= endMinutes) {
      const depHour = Math.floor(currentMinutes / 60);
      const depMin = currentMinutes % 60;

      const departureTime = new Date(baseDate);
      departureTime.setHours(depHour, depMin, 0, 0);

      const arrivalTime = new Date(departureTime);
      arrivalTime.setMinutes(arrivalTime.getMinutes() + estimatedTripMinutes);

      tripsToSave.push(
        this.tripRepository.create({
          routeId: route.id,
          departureTime,
          arrivalTime,
          status: TripStatus.SCHEDULED,
          tripType: 'regular',
        }),
      );

      currentMinutes += intervalMinutes;
    }

    const savedTrips = await this.tripRepository.save(tripsToSave);
    return {
      message: `Đã tự động sinh ${savedTrips.length} chuyến xe định kỳ (chờ phân công) cho ngày ${dto.date}`,
      count: savedTrips.length,
      trips: savedTrips,
    };
  }

  /**
   * Kiểm tra xung đột lịch trình (Double-booking):
   * Đảm bảo xe, tài xế hoặc phụ xe không bị xếp trùng 2 chuyến chạy đè giờ nhau
   */
  private async checkScheduleConflict(
    entityType: 'vehicle' | 'driver' | 'conductor',
    entityId: string,
    excludeTripId: string | null,
    departureTime: Date,
    arrivalTime: Date,
  ): Promise<TripEntity | null> {
    let whereClause = 'trip.driverId = :entityId';
    if (entityType === 'vehicle') {
      whereClause = 'trip.vehicleId = :entityId';
    } else if (entityType === 'conductor') {
      whereClause = 'trip.conductorId = :entityId';
    }

    const qb = this.tripRepository
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.route', 'route')
      .andWhere(whereClause, { entityId })
      .andWhere('trip.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: [TripStatus.CANCELLED, TripStatus.COMPLETED],
      })
      .andWhere('trip.departureTime < :tripArrival', { tripArrival: arrivalTime.toISOString() })
      .andWhere(
        '(trip.arrivalTime > :tripDeparture OR (trip.arrivalTime IS NULL AND trip.departureTime > :minDeparture))',
        {
          tripDeparture: departureTime.toISOString(),
          minDeparture: new Date(departureTime.getTime() - 45 * 60 * 1000).toISOString(),
        },
      );

    if (excludeTripId) {
      qb.andWhere('trip.id != :excludeTripId', { excludeTripId });
    }

    return qb.getOne();
  }

  async createAdhocTrip(dto: CreateAdhocTripDto) {
    const route = await this.routeRepository.findOne({ where: { id: dto.routeId } });
    if (!route) {
      throw new NotFoundException(`Không tìm thấy tuyến xe với ID ${dto.routeId}`);
    }

    const departure = new Date(dto.departureTime);
    let arrival: Date;
    if (dto.arrivalTime) {
      arrival = new Date(dto.arrivalTime);
    } else {
      const estimatedTripMinutes = route.distanceKm ? Math.round(Number(route.distanceKm) * 2.5) : 45;
      arrival = new Date(departure.getTime() + estimatedTripMinutes * 60 * 1000);
    }

    if (dto.vehicleId) {
      const vehicle = await this.vehicleRepository.findOne({ where: { id: dto.vehicleId } });
      if (!vehicle) {
        throw new NotFoundException('Phương tiện xe buýt không tồn tại');
      }
      const conflict = await this.checkScheduleConflict('vehicle', vehicle.id, null, departure, arrival);
      if (conflict) {
        const timeStr = new Date(conflict.departureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
        throw new ConflictException(
          `Xung đột lịch trình: Xe buýt ${vehicle.licensePlate} đã có lịch chạy chuyến "${conflict.route?.name || 'Tuyến khác'}" lúc ${timeStr}. Vui lòng chọn xe khác!`,
        );
      }
    }

    if (dto.driverId) {
      const driver = await this.userRepository.findOne({ where: { id: dto.driverId } });
      if (!driver) {
        throw new NotFoundException('Tài xế không tồn tại');
      }
      const conflict = await this.checkScheduleConflict('driver', driver.id, null, departure, arrival);
      if (conflict) {
        const timeStr = new Date(conflict.departureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
        throw new ConflictException(
          `Xung đột lịch trình: Tài xế ${driver.fullName || driver.phoneNumber} đã có ca chạy chuyến "${conflict.route?.name || 'Tuyến khác'}" lúc ${timeStr}. Vui lòng phân công tài xế khác!`,
        );
      }
    }

    if (dto.conductorId) {
      const conductor = await this.userRepository.findOne({ where: { id: dto.conductorId } });
      if (!conductor) {
        throw new NotFoundException('Phụ xe không tồn tại');
      }
      const conflict = await this.checkScheduleConflict('conductor', conductor.id, null, departure, arrival);
      if (conflict) {
        const timeStr = new Date(conflict.departureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
        throw new ConflictException(
          `Xung đột lịch trình: Phụ xe ${conductor.fullName || conductor.phoneNumber} đã có ca làm việc trên chuyến "${conflict.route?.name || 'Tuyến khác'}" lúc ${timeStr}. Vui lòng chọn phụ xe khác!`,
        );
      }
    }

    const trip = this.tripRepository.create({
      routeId: route.id,
      vehicleId: dto.vehicleId || undefined,
      driverId: dto.driverId || undefined,
      conductorId: dto.conductorId || undefined,
      departureTime: departure,
      arrivalTime: arrival,
      status: TripStatus.SCHEDULED,
      tripType: dto.tripType || 'adhoc',
      note: dto.note || undefined,
    });

    const saved = await this.tripRepository.save(trip);
    return this.findById(saved.id);
  }

  /**
   * Hủy toàn bộ phân công của chuyến xe: Gỡ xe buýt, tài xế và phụ xe (Manager, Admin)
   */
  async unassign(tripId: string) {
    const trip = await this.findById(tripId);

    if (trip.status === TripStatus.COMPLETED || trip.status === TripStatus.CANCELLED) {
      throw new BadRequestException(`Không thể hủy phân công chuyến xe đã kết thúc hoặc đã bị hủy (${trip.status})`);
    }

    const oldDriverId = trip.driverId;
    const oldConductorId = trip.conductorId;
    const routeCode = trip.route?.routeCode || '';
    const depDate = new Date(trip.departureTime);
    const depTimeStr = depDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const depDateStr = depDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    trip.vehicleId = null as any;
    trip.vehicle = null as any;
    trip.driverId = null as any;
    trip.driver = null as any;
    trip.conductorId = null as any;
    trip.conductor = null as any;

    await this.tripRepository.save(trip);
    const updatedTrip = await this.findById(trip.id);

    // Gửi thông báo giải phóng ca trực cho tài xế và phụ xe cũ
    if (this.notificationCenterService) {
      try {
        if (oldDriverId) {
          const title = `Thông báo hủy ca chạy: Chuyến ${routeCode} lúc ${depTimeStr}`;
          const message = `Ca chạy lúc ${depTimeStr} ngày ${depDateStr} trên chuyến ${routeCode} đã được điều hành viên hủy phân công để bố trí lại.`;
          await this.notificationCenterService.saveNotification({
            userId: oldDriverId,
            tripId: updatedTrip.id,
            type: 'TRIP_UNASSIGNED',
            title,
            message,
            deepLink: '/portal/driver',
            data: { tripId: updatedTrip.id, routeCode },
          });
          if (this.fcmService) {
            await this.fcmService.sendPushToUser(oldDriverId, title, message, {
              tripId: updatedTrip.id,
              deepLink: '/portal/driver',
            });
          }
        }

        if (oldConductorId) {
          const title = `Thông báo hủy ca trực: Chuyến ${routeCode} lúc ${depTimeStr}`;
          const message = `Ca trực lúc ${depTimeStr} ngày ${depDateStr} trên chuyến ${routeCode} đã được điều hành viên hủy phân công để bố trí lại.`;
          await this.notificationCenterService.saveNotification({
            userId: oldConductorId,
            tripId: updatedTrip.id,
            type: 'TRIP_UNASSIGNED',
            title,
            message,
            deepLink: '/portal/driver',
            data: { tripId: updatedTrip.id, routeCode },
          });
          if (this.fcmService) {
            await this.fcmService.sendPushToUser(oldConductorId, title, message, {
              tripId: updatedTrip.id,
              deepLink: '/portal/driver',
            });
          }
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi gửi thông báo unassign chuyến xe: ${err.message}`);
      }
    }

    return {
      success: true,
      message: 'Đã hủy phân công xe buýt, tài xế và phụ xe thành công',
      data: updatedTrip,
    };
  }

  async dispatch(dto: DispatchTripDto) {
    if (dto.unassignAll) {
      return this.unassign(dto.tripId);
    }

    const trip = await this.findById(dto.tripId);

    if (trip.status === TripStatus.COMPLETED || trip.status === TripStatus.CANCELLED) {
      throw new BadRequestException(`Không thể điều phối chuyến xe đã kết thúc hoặc đã bị hủy (${trip.status})`);
    }

    const departure = new Date(trip.departureTime);
    let arrival: Date;
    if (trip.arrivalTime) {
      arrival = new Date(trip.arrivalTime);
    } else {
      const durationMs = (trip.route?.estimatedDurationMinutes || 60) * 60 * 1000;
      arrival = new Date(departure.getTime() + durationMs);
    }

    // 1. XỬ LÝ PHƯƠNG TIỆN XE BUÝT
    let vehicle: VehicleEntity | null = null;
    if (dto.vehicleId === null || dto.vehicleId === '') {
      // Yêu cầu gỡ bỏ xe buýt
      trip.vehicleId = null as any;
      trip.vehicle = null as any;
    } else if (dto.vehicleId) {
      vehicle = await this.vehicleRepository.findOne({ where: { id: dto.vehicleId } });
      if (!vehicle) {
        throw new NotFoundException('Phương tiện xe buýt không tồn tại');
      }

      // Kiểm tra trạng thái xe (chỉ cho phép ACTIVE)
      if (vehicle.status !== VehicleStatus.ACTIVE) {
        throw new BadRequestException(
          `Xe buýt ${vehicle.licensePlate} đang trong trạng thái bảo dưỡng hoặc ngừng hoạt động (${vehicle.status}), không thể phân công!`,
        );
      }

      // Ràng buộc 1: Chống làm mất ghế của hành khách (seatCapacity < bookedCount)
      const bookedCount = await this.ticketRepository
        .createQueryBuilder('ticket')
        .innerJoin('ticket.booking', 'booking')
        .where('booking.tripId = :tripId', { tripId: trip.id })
        .andWhere('ticket.status NOT IN (:...excluded)', {
          excluded: [TicketStatus.CANCELLED, TicketStatus.EXPIRED],
        })
        .getCount();

      if (vehicle.seatCapacity < bookedCount) {
        throw new BadRequestException(
          `Không thể điều phối xe ${vehicle.licensePlate} (${vehicle.seatCapacity} chỗ) vì chuyến này đã có ${bookedCount} hành khách đặt vé! Vui lòng chọn xe có sức chứa tối thiểu ${bookedCount} chỗ.`,
        );
      }

      // Ràng buộc 2: Chống xung đột lịch trình (Double-booking cho xe buýt)
      const conflict = await this.checkScheduleConflict('vehicle', vehicle.id, trip.id, departure, arrival);
      if (conflict) {
        const timeStr = new Date(conflict.departureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
        throw new ConflictException(
          `Xung đột lịch trình: Xe buýt ${vehicle.licensePlate} đã có lịch chạy chuyến "${conflict.route?.name || 'Tuyến khác'}" lúc ${timeStr}. Vui lòng chọn xe khác!`,
        );
      }

      trip.vehicleId = vehicle.id;
    } else if (trip.vehicle) {
      vehicle = trip.vehicle;
    } else if (trip.vehicleId) {
      vehicle = await this.vehicleRepository.findOne({ where: { id: trip.vehicleId } });
    }

    // 2. XỬ LÝ TÀI XẾ
    const oldDriverId = trip.driverId;
    let driver: UserEntity | null = null;
    if (dto.driverId === null || dto.driverId === '') {
      // Yêu cầu gỡ bỏ tài xế
      trip.driverId = null as any;
      trip.driver = null as any;
    } else if (dto.driverId) {
      driver = await this.userRepository.findOne({
        where: { id: dto.driverId },
        relations: { role: true },
      });
      if (!driver) {
        throw new NotFoundException('Tài xế không tồn tại');
      }

      // Kiểm tra trạng thái tài xế (phải ACTIVE)
      if (driver.status !== UserStatus.ACTIVE) {
        throw new BadRequestException(
          `Tài xế ${driver.fullName} đang bị khóa hoặc chưa kích hoạt (${driver.status}), không thể phân công!`,
        );
      }

      // Kiểm tra vai trò tài xế
      const allowedRoles = ['driver', 'admin', 'manager'];
      const roleName = driver.role?.name?.toLowerCase();
      if (roleName && !allowedRoles.includes(roleName)) {
        throw new BadRequestException(
          `Người dùng ${driver.fullName} không có vai trò tài xế (vai trò hiện tại: ${driver.role?.name || 'Không xác định'})!`,
        );
      }

      // Kiểm tra bằng lái hợp lệ (Hạng D hoặc Hạng E theo Luật Giao thông Đường bộ)
      const license = (driver.faculty || '').toUpperCase().trim();
      const isValidLicense =
        /\b(D|E|FD|FE)\b/i.test(license) ||
        license.includes('HẠNG D') ||
        license.includes('HẠNG E') ||
        license.includes('BẰNG D') ||
        license.includes('BẰNG E') ||
        license.includes('GPLX D') ||
        license.includes('GPLX E');

      if (!isValidLicense) {
        throw new BadRequestException(
          `Tài xế ${driver.fullName} không đủ điều kiện giấy phép lái xe để điều khiển xe buýt chở khách (Yêu cầu tối thiểu GPLX Hạng D hoặc Hạng E, hiện có: "${driver.faculty || 'Chưa cập nhật'}"). Vui lòng cập nhật GPLX hợp lệ trước khi phân công!`,
        );
      }

      // Ràng buộc 3: Chống xung đột lịch trình (Double-booking cho tài xế)
      const conflict = await this.checkScheduleConflict('driver', driver.id, trip.id, departure, arrival);
      if (conflict) {
        const timeStr = new Date(conflict.departureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
        throw new ConflictException(
          `Xung đột lịch trình: Tài xế ${driver.fullName || driver.phoneNumber} đã có ca chạy chuyến "${conflict.route?.name || 'Tuyến khác'}" lúc ${timeStr}. Vui lòng chọn tài xế khác!`,
        );
      }

      trip.driverId = driver.id;
    }

    // 3. XỬ LÝ PHỤ XE
    const oldConductorId = trip.conductorId;
    let conductor: UserEntity | null = null;
    if (dto.conductorId === null || dto.conductorId === '') {
      // Yêu cầu gỡ bỏ phụ xe
      trip.conductorId = null as any;
      trip.conductor = null as any;
    } else if (dto.conductorId) {
      conductor = await this.userRepository.findOne({
        where: { id: dto.conductorId },
        relations: { role: true },
      });
      if (!conductor) {
        throw new NotFoundException('Phụ xe không tồn tại');
      }

      // Kiểm tra trạng thái phụ xe (phải ACTIVE)
      if (conductor.status !== UserStatus.ACTIVE) {
        throw new BadRequestException(
          `Phụ xe ${conductor.fullName} đang bị khóa hoặc chưa kích hoạt (${conductor.status}), không thể phân công!`,
        );
      }

      // Ràng buộc 4: Chống xung đột lịch trình (Double-booking cho phụ xe)
      const conflict = await this.checkScheduleConflict('conductor', conductor.id, trip.id, departure, arrival);
      if (conflict) {
        const timeStr = new Date(conflict.departureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
        throw new ConflictException(
          `Xung đột lịch trình: Phụ xe ${conductor.fullName} đã có ca làm việc trên chuyến "${conflict.route?.name || 'Tuyến khác'}" lúc ${timeStr}. Vui lòng chọn phụ xe khác!`,
        );
      }

      trip.conductorId = conductor.id;
    }

    await this.tripRepository.save(trip);
    const updatedTrip = await this.findById(trip.id);

    // Tự động gửi thông báo lịch trình làm việc khi dispatch thành công
    if (this.notificationCenterService) {
      try {
        const departureDate = new Date(updatedTrip.departureTime);
        const departureTimeStr = departureDate.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const departureDateStr = departureDate.toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        const routeCode = updatedTrip.route?.routeCode || '';
        const routeName = updatedTrip.route?.name || 'Tuyến xe buýt ICTU';
        const licensePlate = updatedTrip.vehicle?.licensePlate || vehicle?.licensePlate || 'xe buýt';

        // 1. Phân công mới cho tài xế
        if (dto.driverId && driver) {
          const title = `Phân công ca chạy mới: Chuyến ${routeCode} lúc ${departureTimeStr}`;
          const message = `Bạn đã được phân công ca chạy xe ${licensePlate} trên tuyến ${routeName}. Giờ xuất bến: ${departureTimeStr} ngày ${departureDateStr}.`;
          await this.notificationCenterService.saveNotification({
            userId: driver.id,
            tripId: updatedTrip.id,
            type: 'TRIP_ASSIGNED',
            title,
            message,
            deepLink: '/portal/driver',
            data: {
              tripId: updatedTrip.id,
              routeCode,
              licensePlate,
              departureTime: updatedTrip.departureTime,
            },
          });
          if (this.fcmService) {
            await this.fcmService.sendPushToUser(driver.id, title, message, {
              tripId: updatedTrip.id,
              deepLink: '/portal/driver',
            });
          }
        }

        // 2. Phân công mới cho phụ xe
        if (dto.conductorId && conductor) {
          const title = `Phân công ca chạy mới: Chuyến ${routeCode} lúc ${departureTimeStr}`;
          const message = `Bạn đã được phân công ca trực trên xe ${licensePlate} tuyến ${routeName}. Giờ xuất bến: ${departureTimeStr} ngày ${departureDateStr}.`;
          await this.notificationCenterService.saveNotification({
            userId: conductor.id,
            tripId: updatedTrip.id,
            type: 'TRIP_ASSIGNED',
            title,
            message,
            deepLink: '/portal/driver',
            data: {
              tripId: updatedTrip.id,
              routeCode,
              licensePlate,
              departureTime: updatedTrip.departureTime,
            },
          });
          if (this.fcmService) {
            await this.fcmService.sendPushToUser(conductor.id, title, message, {
              tripId: updatedTrip.id,
              deepLink: '/portal/driver',
            });
          }
        }

        // 3. Cơ chế điều chuyển: Nếu đổi tài xế khác so với phân công cũ hoặc hủy gán tài xế
        if (oldDriverId && (dto.driverId === null || dto.driverId === '' || (dto.driverId && oldDriverId !== dto.driverId))) {
          const title = `Thông báo điều chuyển ca chạy: Chuyến ${routeCode}`;
          const message = `Ca chạy lúc ${departureTimeStr} ngày ${departureDateStr} của bạn đã được quản lý điều chuyển hoặc hủy phân công để sắp xếp lại.`;
          await this.notificationCenterService.saveNotification({
            userId: oldDriverId,
            tripId: updatedTrip.id,
            type: 'TRIP_UNASSIGNED',
            title,
            message,
            deepLink: '/portal/driver',
            data: { tripId: updatedTrip.id, routeCode },
          });
          if (this.fcmService) {
            await this.fcmService.sendPushToUser(oldDriverId, title, message, {
              tripId: updatedTrip.id,
              deepLink: '/portal/driver',
            });
          }
        }

        // 4. Cơ chế điều chuyển: Nếu đổi phụ xe khác so với phân công cũ hoặc hủy gán phụ xe
        if (oldConductorId && (dto.conductorId === null || dto.conductorId === '' || (dto.conductorId && oldConductorId !== dto.conductorId))) {
          const title = `Thông báo điều chuyển ca trực: Chuyến ${routeCode}`;
          const message = `Ca trực lúc ${departureTimeStr} ngày ${departureDateStr} của bạn đã được quản lý điều chuyển hoặc hủy phân công để sắp xếp lại.`;
          await this.notificationCenterService.saveNotification({
            userId: oldConductorId,
            tripId: updatedTrip.id,
            type: 'TRIP_UNASSIGNED',
            title,
            message,
            deepLink: '/portal/driver',
            data: { tripId: updatedTrip.id, routeCode },
          });
          if (this.fcmService) {
            await this.fcmService.sendPushToUser(oldConductorId, title, message, {
              tripId: updatedTrip.id,
              deepLink: '/portal/driver',
            });
          }
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi gửi thông báo phân công chuyến xe: ${err.message}`);
      }
    }

    return updatedTrip;
  }

  /**
   * Gửi lại thông báo & lịch trình làm việc đến Tài xế và Phụ xe (Manager, Admin)
   * POST /api/v1/trips/:id/notify-crew
   */
  async notifyCrew(tripId: string) {
    const trip = await this.tripRepository.findOne({
      where: { id: tripId },
      relations: { route: true, vehicle: true, driver: true, conductor: true },
    });

    if (!trip) {
      throw new NotFoundException(`Không tìm thấy chuyến xe với ID ${tripId}`);
    }

    if (!trip.driverId && !trip.conductorId) {
      throw new BadRequestException('Chuyến xe chưa được phân công tài xế hoặc phụ xe để gửi thông báo!');
    }

    const bookedCount = await this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoin('ticket.booking', 'booking')
      .where('booking.tripId = :tripId', { tripId: trip.id })
      .andWhere('ticket.status NOT IN (:...excluded)', {
        excluded: [TicketStatus.CANCELLED, TicketStatus.EXPIRED],
      })
      .getCount();

    const depDate = new Date(trip.departureTime);
    const departureTimeStr = depDate.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const departureDateStr = depDate.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const arrivalTimeStr = trip.arrivalTime
      ? new Date(trip.arrivalTime).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : 'Theo lộ trình';
    const seatCapacity = trip.vehicle?.seatCapacity || 29;
    const licensePlate = trip.vehicle?.licensePlate || 'Chưa gán xe';
    const routeName = trip.route?.name || 'Tuyến buýt ICTU';
    const routeCode = trip.route?.routeCode || '';

    const title = `📋 Lịch trình ca chạy: Chuyến ${routeCode} (${departureTimeStr} - ${departureDateStr})`;
    const body = `Tuyến: ${routeName} | Xe: ${licensePlate} | Giờ chạy: ${departureTimeStr} - ${arrivalTimeStr} | Sức chứa: ${seatCapacity} chỗ (Đã đặt: ${bookedCount} vé).`;

    if (this.notificationCenterService) {
      if (trip.driverId) {
        await this.notificationCenterService.saveNotification({
          userId: trip.driverId,
          tripId: trip.id,
          type: 'TRIP_ASSIGNED',
          title,
          message: body,
          deepLink: '/portal/driver',
          data: {
            tripId: trip.id,
            routeCode,
            licensePlate,
            departureTime: trip.departureTime,
            bookedCount,
            seatCapacity,
          },
        });
        if (this.fcmService) {
          await this.fcmService.sendPushToUser(trip.driverId, title, body, {
            tripId: trip.id,
            deepLink: '/portal/driver',
          });
        }
      }

      if (trip.conductorId) {
        await this.notificationCenterService.saveNotification({
          userId: trip.conductorId,
          tripId: trip.id,
          type: 'TRIP_ASSIGNED',
          title,
          message: body,
          deepLink: '/portal/driver',
          data: {
            tripId: trip.id,
            routeCode,
            licensePlate,
            departureTime: trip.departureTime,
            bookedCount,
            seatCapacity,
          },
        });
        if (this.fcmService) {
          await this.fcmService.sendPushToUser(trip.conductorId, title, body, {
            tripId: trip.id,
            deepLink: '/portal/driver',
          });
        }
      }
    }

    return {
      success: true,
      message: 'Đã gửi thông báo lịch trình làm việc đến tổ xe thành công',
      data: {
        tripId: trip.id,
        notifiedDriverId: trip.driverId || null,
        notifiedConductorId: trip.conductorId || null,
      },
    };
  }

  async findById(id: string) {
    let trip: TripEntity | null = null;
    try {
      trip = await this.tripRepository.findOne({
        where: { id },
        relations: { route: true, vehicle: true, driver: true, conductor: true },
      });
    } catch {
      throw new NotFoundException(`Không tìm thấy chuyến xe với ID ${id}`);
    }

    if (!trip) {
      throw new NotFoundException(`Không tìm thấy chuyến xe với ID ${id}`);
    }

    return trip;
  }

  async getSeatMap(tripId: string, currentUserId?: string) {
    const trip = await this.findById(tripId);

    let vehicleId = trip.vehicleId;
    if (!vehicleId) {
      const defaultVehicle = await this.vehicleRepository.findOne({
        where: {},
        relations: { seats: true },
      });
      if (defaultVehicle) {
        vehicleId = defaultVehicle.id;
      }
    }

    let seats: SeatEntity[] = [];
    if (vehicleId) {
      seats = await this.seatRepository.find({
        where: { vehicleId },
        order: { rowNumber: 'ASC', columnLabel: 'ASC' },
      });
    }

    const now = new Date();

    // Get active tickets for this trip (loại trừ các booking pending đã hết thời gian giữ 10 phút)
    const activeTickets = await this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoin('ticket.booking', 'booking')
      .where('booking.tripId = :tripId', { tripId })
      .andWhere('ticket.status NOT IN (:...excluded)', {
        excluded: [TicketStatus.CANCELLED, TicketStatus.EXPIRED],
      })
      .andWhere('(booking.status != :pendingStatus OR booking.expiresAt > :now)', {
        pendingStatus: BookingStatus.PENDING,
        now,
      })
      .select(['ticket.id', 'ticket.seatId', 'ticket.status', 'ticket.passengerName'])
      .getMany();

    const bookedSeatMap = new Map<string, { status: string; passengerName: string }>();
    for (const t of activeTickets) {
      bookedSeatMap.set(t.seatId, {
        status: t.status,
        passengerName: t.passengerName,
      });
    }

    const dbHoldsMap = new Map<string, { userId: string; expiresAt: number }>();
    if (this.seatHoldRepository) {
      const activeDbHolds = await this.seatHoldRepository
        .createQueryBuilder('hold')
        .where('hold.tripId = :tripId', { tripId })
        .andWhere('hold.status = :status', { status: 'holding' })
        .andWhere('hold.expiresAt > :now', { now })
        .getMany();
      for (const h of activeDbHolds) {
        dbHoldsMap.set(h.seatId, {
          userId: h.userId,
          expiresAt: new Date(h.expiresAt).getTime(),
        });
      }
    }

    const lockedSeatsMap = this.seatLockService
      ? await this.seatLockService.getLockedSeatsForTrip(tripId)
      : new Map<string, { userId: string; expiresAt: number }>();

    // Merge lockedSeatsMap and dbHoldsMap (tự động bỏ qua các bản ghi đã quá hạn -> ghế còn trống)
    const effectiveHoldsMap = new Map<string, { userId: string; expiresAt: number }>();
    for (const [seatId, info] of lockedSeatsMap.entries()) {
      if (info.expiresAt > now.getTime()) {
        effectiveHoldsMap.set(seatId, info);
      }
    }
    for (const [seatId, info] of dbHoldsMap.entries()) {
      if (info.expiresAt > now.getTime()) {
        effectiveHoldsMap.set(seatId, info);
      }
    }

    let holdingCount = 0;
    const seatMap = seats.map((seat) => {
      const bookingInfo = bookedSeatMap.get(seat.id);
      if (bookingInfo) {
        return {
          seatId: seat.id,
          seatNumber: seat.seatNumber,
          rowNumber: seat.rowNumber,
          columnLabel: seat.columnLabel,
          seatType: seat.seatType,
          isBooked: true,
          bookingStatus: bookingInfo.status || 'booked',
          isHeldByMe: false,
          holdExpiresAt: null,
        };
      }

      const lockInfo = effectiveHoldsMap.get(seat.id);
      if (lockInfo) {
        holdingCount++;
        const isHeldByMe = currentUserId ? lockInfo.userId === currentUserId : false;
        return {
          seatId: seat.id,
          seatNumber: seat.seatNumber,
          rowNumber: seat.rowNumber,
          columnLabel: seat.columnLabel,
          seatType: seat.seatType,
          isBooked: false,
          bookingStatus: 'holding',
          isHeldByMe,
          holdExpiresAt: new Date(lockInfo.expiresAt).toISOString(),
        };
      }

      return {
        seatId: seat.id,
        seatNumber: seat.seatNumber,
        rowNumber: seat.rowNumber,
        columnLabel: seat.columnLabel,
        seatType: seat.seatType,
        isBooked: false,
        bookingStatus: 'available',
        isHeldByMe: false,
        holdExpiresAt: null,
      };
    });

    const totalSeats = seats.length;
    const bookedCount = bookedSeatMap.size;
    const availableCount = Math.max(0, totalSeats - bookedCount - holdingCount);

    return {
      tripId: trip.id,
      routeName: trip.route?.name,
      departureTime: trip.departureTime,
      vehiclePlate: trip.vehicle?.licensePlate,
      totalSeats,
      bookedCount,
      holdingCount,
      availableCount,
      seats: seatMap,
    };
  }

  async getDriverTodayTrips(driverId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return this.tripRepository.find({
      where: [
        {
          driverId,
          departureTime: Between(startOfDay, endOfDay),
        },
        {
          conductorId: driverId,
          departureTime: Between(startOfDay, endOfDay),
        },
      ],
      relations: { route: true, vehicle: true, driver: true, conductor: true },
      order: { departureTime: 'ASC' },
    });
  }

  async getManifest(tripId: string) {
    await this.findById(tripId);

    const tickets = await this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoinAndSelect('ticket.booking', 'booking')
      .leftJoinAndSelect('ticket.seat', 'seat')
      .where('booking.tripId = :tripId', { tripId })
      .andWhere('ticket.status NOT IN (:...excluded)', {
        excluded: [TicketStatus.CANCELLED, TicketStatus.EXPIRED],
      })
      .orderBy('seat.rowNumber', 'ASC')
      .addOrderBy('seat.columnLabel', 'ASC')
      .getMany();

    return {
      tripId,
      totalPassengers: tickets.length,
      manifest: tickets.map((t) => ({
        ticketId: t.id,
        ticketCode: t.ticketCode,
        seatNumber: t.seat?.seatNumber,
        passengerName: t.passengerName,
        passengerPhone: t.passengerPhone,
        status: t.status,
        checkedInAt: t.checkedInAt,
      })),
    };
  }

  async verifyQr(dto: VerifyQrDto, conductorId?: string) {
    const rawInput = (dto.qrData || '').trim();
    if (!rawInput) {
      throw new BadRequestException('Mã vé hoặc dữ liệu QR không được để trống');
    }

    // 0. Kiểm tra trạng thái chuyến xe hiện tại của tài xế
    const currentTrip = dto.tripId
      ? await this.tripRepository.findOne({
          where: { id: dto.tripId },
          relations: { route: true, vehicle: true },
        })
      : null;

    if (
      currentTrip &&
      (currentTrip.status === TripStatus.COMPLETED || currentTrip.status === TripStatus.CANCELLED)
    ) {
      throw new BadRequestException(
        `Chuyến xe hiện tại đã kết thúc hoặc đã bị hủy (${currentTrip.status}), không thể tiếp nhận soát vé!`,
      );
    }

    let ticketCode = '';
    let passCode = '';

    // 1. Nhận diện định dạng mã (Vé lượt TKT-* hoặc Thẻ vé tháng MP-* / ICTU-MONTHLY:*)
    if (rawInput.startsWith('{')) {
      // Dữ liệu mã QR có cấu trúc JSON kèm chữ ký số HMAC-SHA256
      const secret = process.env.QR_HMAC_SECRET || 'smart-bus-qr-signature-secret-key-2026';
      const verifyResult = verifyQrData(rawInput, secret);
      if (!verifyResult.valid) {
        throw new BadRequestException('Chữ ký số không hợp lệ hoặc dữ liệu vé đã bị can thiệp');
      }
      if (verifyResult.payload) {
        if (verifyResult.payload.passCode) {
          passCode = verifyResult.payload.passCode;
        } else if (verifyResult.payload.ticketCode) {
          ticketCode = verifyResult.payload.ticketCode;
        }
      }
    } else if (rawInput.startsWith('ICTU-MONTHLY:')) {
      const parts = rawInput.split(':');
      passCode = (parts[1] || '').trim().toUpperCase();
    } else if (rawInput.startsWith('MP-') || rawInput.includes('MP-20')) {
      const match = rawInput.match(/MP-[A-Za-z0-9_-]+/i);
      passCode = match ? match[0].toUpperCase() : rawInput.toUpperCase();
    } else if (rawInput.startsWith('ICTU-PASS:')) {
      const parts = rawInput.split(':');
      const extracted = (parts[1] || '').trim().toUpperCase();
      if (extracted.startsWith('MP-') || extracted.startsWith('PASS-')) {
        passCode = extracted;
      } else {
        ticketCode = extracted;
      }
    } else if (rawInput.toUpperCase().startsWith('TKT-') || rawInput.toUpperCase().includes('TKT-ICTU-')) {
      const match = rawInput.match(/TKT-ICTU-[A-Za-z0-9_-]+/i) || rawInput.match(/TKT-[A-Za-z0-9_-]+/i);
      ticketCode = match ? match[0].toUpperCase() : rawInput.toUpperCase();
    } else {
      ticketCode = rawInput.toUpperCase();
    }

    // 2. NHÁNH A: XÁC THỰC THẺ VÉ THÁNG HSSV (Monthly Pass)
    if (passCode && this.monthlyPassRepository) {
      const monthlyPass = await this.monthlyPassRepository.findOne({
        where: { passCode },
        relations: { user: true, route: true },
      });

      if (monthlyPass) {
        // Kiểm tra phê duyệt
        if (monthlyPass.approvalStatus !== ApprovalStatus.APPROVED) {
          throw new BadRequestException(
            `Thẻ vé tháng ${monthlyPass.passCode} chưa được duyệt (Trạng thái: ${monthlyPass.approvalStatus})`,
          );
        }

        // Kiểm tra hạn sử dụng
        const today = new Date().toISOString().slice(0, 10);
        if (today < monthlyPass.startDate || today > monthlyPass.endDate) {
          throw new BadRequestException(
            `Thẻ vé tháng ${monthlyPass.passCode} đã hết hạn sử dụng (Hiệu lực: ${monthlyPass.startDate} đến ${monthlyPass.endDate})`,
          );
        }

        // Kiểm tra đúng tuyến
        if (
          currentTrip &&
          monthlyPass.routeId &&
          monthlyPass.routeId !== 'all-routes' &&
          currentTrip.routeId !== monthlyPass.routeId
        ) {
          return {
            valid: false,
            success: false,
            isWrongTrip: true,
            isMonthlyPass: true,
            alreadyCheckedIn: false,
            message: `CẢNH BÁO: Thẻ vé tháng đăng ký tuyến "${monthlyPass.route?.name || 'Tuyến khác'}", không áp dụng cho chuyến "${currentTrip.route?.name || 'Tuyến này'}"!`,
            passenger: monthlyPass.user?.fullName || 'Hành khách vé tháng',
            ticketCode: monthlyPass.passCode,
            correctTrip: {
              tripId: currentTrip.id,
              routeName: monthlyPass.route?.name || 'Tuyến đã đăng ký',
            },
          };
        }

        // Thẻ vé tháng hợp lệ
        return {
          valid: true,
          success: true,
          alreadyCheckedIn: false,
          isWrongTrip: false,
          isMonthlyPass: true,
          category: monthlyPass.category,
          message: 'Thẻ vé tháng HSSV hợp lệ! Cho phép hành khách lên xe.',
          passenger: monthlyPass.user?.fullName || 'Hành khách vé tháng',
          seat: 'Ghế tự do (Vé tháng HSSV)',
          ticketCode: monthlyPass.passCode,
          bookingCode: `PASS-${monthlyPass.passCode}`,
          status: 'APPROVED',
          checkedInAt: new Date().toISOString(),
          checkedInBy: conductorId || 'DRIVER',
        };
      }
    }

    // 3. NHÁNH B: XÁC THỰC VÉ LƯỢT ĐIỆN TỬ (Ticket)
    if (!ticketCode && !passCode) {
      throw new BadRequestException('Không thể nhận diện mã vé hoặc thẻ tháng từ dữ liệu cung cấp');
    }

    const searchCode = ticketCode || passCode;
    const ticket = await this.ticketRepository.findOne({
      where: { ticketCode: searchCode },
      relations: {
        booking: {
          trip: {
            route: true,
            vehicle: true,
            driver: true,
          },
        },
        seat: true,
      },
    });

    if (!ticket) {
      // Fallback thử tìm trong monthly_passes nếu mã không có tiền tố MP
      const fallbackPass = this.monthlyPassRepository
        ? await this.monthlyPassRepository.findOne({
            where: { passCode: searchCode },
            relations: { user: true, route: true },
          })
        : null;
      if (fallbackPass) {
        if (fallbackPass.approvalStatus !== ApprovalStatus.APPROVED) {
          throw new BadRequestException(
            `Thẻ vé tháng ${fallbackPass.passCode} chưa được duyệt (Trạng thái: ${fallbackPass.approvalStatus})`,
          );
        }
        return {
          valid: true,
          success: true,
          alreadyCheckedIn: false,
          isWrongTrip: false,
          isMonthlyPass: true,
          category: fallbackPass.category,
          message: 'Thẻ vé tháng HSSV hợp lệ! Cho phép hành khách lên xe.',
          passenger: fallbackPass.user?.fullName || 'Hành khách vé tháng',
          seat: 'Ghế tự do (Vé tháng HSSV)',
          ticketCode: fallbackPass.passCode,
          bookingCode: `PASS-${fallbackPass.passCode}`,
          status: 'APPROVED',
          checkedInAt: new Date().toISOString(),
          checkedInBy: conductorId || 'DRIVER',
        };
      }

      throw new NotFoundException(`Không tìm thấy vé hoặc thẻ tháng mang mã "${searchCode}" trong hệ thống`);
    }

    // Kiểm tra các trạng thái vé bị hủy hoặc hết hạn
    if (ticket.status === TicketStatus.CANCELLED || ticket.status === TicketStatus.EXPIRED) {
      throw new BadRequestException(`Vé ${ticket.ticketCode} đã bị hủy hoặc hết hạn (${ticket.status})`);
    }

    // Kiểm tra chuyến xe của vé đã kết thúc chưa
    const ticketTrip = ticket.booking?.trip;
    if (
      ticketTrip &&
      (ticketTrip.status === TripStatus.COMPLETED || ticketTrip.status === TripStatus.CANCELLED)
    ) {
      throw new BadRequestException(`Chuyến xe của vé này đã kết thúc hoặc đã bị hủy (${ticketTrip.status})`);
    }

    // Bắt buộc vé phải ở trạng thái đã thanh toán (PAID) mới được soát vé lên xe
    if (ticket.status === TicketStatus.RESERVED) {
      throw new BadRequestException('Vé chưa được thanh toán thành công. Không thể soát vé lên xe!');
    }

    // Kiểm tra vé có thuộc đúng chuyến xe hiện tại không
    const ticketTripId = ticket.booking?.tripId || ticket.booking?.trip?.id;
    if (dto.tripId && ticketTripId && ticketTripId !== dto.tripId) {
      throw new BadRequestException('Mã vé này không thuộc về chuyến xe hiện tại');
    }

    // Kiểm tra vé đã được soát trước đó (Trùng lặp check-in)
    if (ticket.status === TicketStatus.CHECKED_IN) {
      return {
        success: false,
        valid: false,
        alreadyCheckedIn: true,
        isWrongTrip: false,
        message: 'CẢNH BÁO: Vé này đã được soát trước đó!',
        checkedInAt: ticket.checkedInAt,
        checkedInBy: ticket.checkedInBy,
        passenger: ticket.passengerName,
        seat: ticket.seat?.seatNumber,
        ticketCode: ticket.ticketCode,
      };
    }

    if (ticket.status !== TicketStatus.PAID) {
      throw new BadRequestException(`Trạng thái vé không hợp lệ để soát vé: ${ticket.status}`);
    }

    // Soát vé thành công -> Đánh dấu CHECKED_IN
    ticket.status = TicketStatus.CHECKED_IN;
    ticket.checkedInAt = new Date();
    if (conductorId) {
      ticket.checkedInBy = conductorId;
    }

    await this.ticketRepository.save(ticket);

    return {
      valid: true,
      success: true,
      alreadyCheckedIn: false,
      isWrongTrip: false,
      isMonthlyPass: false,
      message: 'Soát vé thành công! Cho phép hành khách lên xe.',
      passenger: ticket.passengerName,
      seat: ticket.seat?.seatNumber,
      ticketCode: ticket.ticketCode,
      bookingCode: ticket.booking?.bookingCode,
      status: ticket.status,
      checkedInAt: ticket.checkedInAt,
      checkedInBy: ticket.checkedInBy,
    };
  }

  async updateStatus(tripId: string, status: TripStatus) {
    const trip = await this.findById(tripId);

    trip.status = status;
    if (status === TripStatus.DEPARTED || status === TripStatus.IN_PROGRESS) {
      if (!trip.actualDeparture) {
        trip.actualDeparture = new Date();
      }
    } else if (status === TripStatus.COMPLETED) {
      if (!trip.actualArrival) {
        trip.actualArrival = new Date();
      }
    }

    await this.tripRepository.save(trip);
    return trip;
  }
}
