import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RouteEntity } from '../../database/entities/route.entity.js';
import { RouteStationEntity } from '../../database/entities/route-station.entity.js';
import { StationEntity } from '../../database/entities/station.entity.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { VehicleEntity } from '../../database/entities/vehicle.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { DriverProfileEntity, DriverLicenseStatus } from '../../database/entities/driver-profile.entity.js';
import { NotificationCenterService } from '../notification/notification-center.service.js';
import {
  CreateRouteDto,
  UpdateRouteDto,
  SearchRouteDto,
  UpdatePricingDto,
  CalculateFareDto,
  AddRouteStationDto,
  BulkUpdateRouteStationsDto,
} from './dto/transit.dto.js';
import { TicketStatus, TripStatus, VehicleStatus, UserStatus } from '../../common/constants/status.constant.js';
import { Role } from '../../common/constants/roles.constant.js';

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(
    @InjectRepository(RouteEntity)
    private readonly routeRepository: Repository<RouteEntity>,
    @InjectRepository(RouteStationEntity)
    private readonly routeStationRepository: Repository<RouteStationEntity>,
    @InjectRepository(StationEntity)
    private readonly stationRepository: Repository<StationEntity>,
    @InjectRepository(TripEntity)
    private readonly tripRepository: Repository<TripEntity>,
    @InjectRepository(TicketEntity)
    private readonly ticketRepository: Repository<TicketEntity>,
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepository: Repository<VehicleEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @Optional()
    @InjectRepository(DriverProfileEntity)
    private readonly driverProfileRepository?: Repository<DriverProfileEntity>,
    @Optional()
    private readonly notificationCenterService?: NotificationCenterService,
  ) {}

  private calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Bán kính Trái Đất (km)
    const dLat = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
    const dLon = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((Number(lat1) * Math.PI) / 180) *
        Math.cos((Number(lat2) * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
  }

  async findAll(query?: SearchRouteDto) {
    const hasFilter =
      Boolean(query?.keyword?.trim()) ||
      Boolean(query?.origin?.trim()) ||
      Boolean(query?.destination?.trim());

    let routes: RouteEntity[] = [];

    if (!hasFilter) {
      routes = await this.routeRepository
        .createQueryBuilder('route')
        .leftJoinAndSelect('route.routeStations', 'routeStations')
        .leftJoinAndSelect('routeStations.station', 'station')
        .where('route.status = :status', { status: 'active' })
        .orderBy('route.createdAt', 'DESC')
        .addOrderBy('route.routeCode', 'ASC')
        .addOrderBy('routeStations.stopOrder', 'ASC')
        .getMany();
    } else {
      // Bước 1: Dùng subquery EXISTS xác định route.id thoả mãn điều kiện lọc
      const idQuery = this.routeRepository
        .createQueryBuilder('route')
        .select('route.id', 'id')
        .where('route.status = :status', { status: 'active' });

      if (query?.keyword?.trim()) {
        idQuery.andWhere(
          '(LOWER(route.routeCode) LIKE :keyword OR LOWER(route.name) LIKE :keyword)',
          { keyword: `%${query.keyword.trim().toLowerCase()}%` },
        );
      }

      if (query?.origin?.trim()) {
        idQuery.andWhere(
          `(LOWER(route.origin) LIKE :origin OR EXISTS (
            SELECT 1 FROM route_stations rs_o
            JOIN stations s_o ON rs_o.station_id = s_o.id
            WHERE rs_o.route_id = route.id AND LOWER(s_o.name) LIKE :origin
          ))`,
          { origin: `%${query.origin.trim().toLowerCase()}%` },
        );
      }

      if (query?.destination?.trim()) {
        idQuery.andWhere(
          `(LOWER(route.destination) LIKE :destination OR EXISTS (
            SELECT 1 FROM route_stations rs_d
            JOIN stations s_d ON rs_d.station_id = s_d.id
            WHERE rs_d.route_id = route.id AND LOWER(s_d.name) LIKE :destination
          ))`,
          { destination: `%${query.destination.trim().toLowerCase()}%` },
        );
      }

      if (query?.origin?.trim() && query?.destination?.trim()) {
        idQuery.andWhere(
          `NOT EXISTS (
            SELECT 1 FROM route_stations rs_from
            JOIN stations s_from ON rs_from.station_id = s_from.id
            JOIN route_stations rs_to ON rs_to.route_id = rs_from.route_id
            JOIN stations s_to ON rs_to.station_id = s_to.id
            WHERE rs_from.route_id = route.id
              AND LOWER(s_from.name) LIKE :origin
              AND LOWER(s_to.name) LIKE :destination
              AND rs_from.stop_order >= rs_to.stop_order
          )`,
          {
            origin: `%${query.origin.trim().toLowerCase()}%`,
            destination: `%${query.destination.trim().toLowerCase()}%`,
          },
        );
      }

      const matchingRows = await idQuery.getRawMany();
      const matchingIds = matchingRows.map((r: { id: string }) => r.id);

      if (matchingIds.length === 0) {
        return [];
      }

      // Bước 2: Query lại FULL route kèm FULL danh sách routeStations
      routes = await this.routeRepository
        .createQueryBuilder('route')
        .leftJoinAndSelect('route.routeStations', 'routeStations')
        .leftJoinAndSelect('routeStations.station', 'station')
        .where('route.id IN (:...matchingIds)', { matchingIds })
        .orderBy('route.createdAt', 'DESC')
        .addOrderBy('route.routeCode', 'ASC')
        .addOrderBy('routeStations.stopOrder', 'ASC')
        .getMany();
    }

    return routes.map((r) => ({
      ...r,
      totalStations: r.routeStations?.length || 0,
    }));
  }

  async findById(id: string) {
    const route = await this.routeRepository.findOne({
      where: { id },
      relations: { routeStations: { station: true } },
      order: {
        routeStations: { stopOrder: 'ASC' },
      },
    });

    if (!route) {
      throw new NotFoundException(`Không tìm thấy tuyến xe với ID ${id}`);
    }

    return {
      ...route,
      totalStations: route.routeStations?.length || 0,
    };
  }

  async create(dto: CreateRouteDto) {
    const routeCode = dto.routeCode.toUpperCase().trim();
    const existing = await this.routeRepository.findOne({
      where: { routeCode },
    });

    if (existing) {
      throw new ConflictException(`Mã tuyến ${routeCode} đã tồn tại`);
    }

    // 1. Kiểm tra an toàn phương tiện nếu có chỉ định xe ban đầu
    if (dto.assignedVehicleId) {
      const vehicle = await this.vehicleRepository.findOne({ where: { id: dto.assignedVehicleId } });
      if (!vehicle) {
        throw new NotFoundException('Phương tiện xe buýt không tồn tại');
      }
      if (vehicle.status !== VehicleStatus.ACTIVE) {
        throw new BadRequestException(
          `Xe buýt ${vehicle.licensePlate} đang trong trạng thái bảo dưỡng hoặc ngừng hoạt động (${vehicle.status}), không thể phân công vào tuyến!`,
        );
      }
    }

    // 2. Kiểm tra an toàn tài xế & giấy phép lái xe nếu có chỉ định tài xế ban đầu
    if (dto.assignedDriverId) {
      const driver = await this.userRepository.findOne({ where: { id: dto.assignedDriverId } });
      if (!driver) {
        throw new NotFoundException('Tài xế không tồn tại');
      }
      if (driver.status !== UserStatus.ACTIVE) {
        throw new BadRequestException(`Tài xế ${driver.fullName} đang bị khóa hoặc chưa kích hoạt (${driver.status})!`);
      }
      if (this.driverProfileRepository) {
        const profile = await this.driverProfileRepository.findOne({ where: { userId: driver.id } });
        if (!profile || profile.status !== DriverLicenseStatus.APPROVED) {
          const statusText = !profile
            ? 'Chưa nộp hồ sơ GPLX'
            : profile.status === DriverLicenseStatus.PENDING
            ? 'Chờ thẩm định'
            : 'Đã bị từ chối';
          throw new BadRequestException(
            `Tài xế ${driver.fullName} chưa đủ điều kiện GPLX để điều khiển xe buýt chở khách (Trạng thái hồ sơ: "${statusText}"). Vui lòng thẩm định và phê duyệt bằng lái trước khi phân công!`,
          );
        }
      }
    }

    const route = this.routeRepository.create({
      routeCode,
      name: dto.name,
      origin: dto.origin,
      destination: dto.destination,
      distanceKm: dto.distanceKm,
      estimatedDurationMinutes: dto.estimatedDurationMinutes,
      basePrice: dto.basePrice,
      studentPrice: dto.studentPrice !== undefined ? dto.studentPrice : Math.round(dto.basePrice * 0.5),
      operatingStart: dto.operatingStart,
      operatingEnd: dto.operatingEnd,
      frequencyMinutes: dto.frequencyMinutes,
      pricingType: dto.pricingType || 'fixed',
      fareRules: dto.fareRules || null,
      status: 'active',
    });

    const savedRoute = await this.routeRepository.save(route);

    if (dto.stops && dto.stops.length > 0) {
      const stopsToSave = dto.stops.map((stop) =>
        this.routeStationRepository.create({
          routeId: savedRoute.id,
          stationId: stop.stationId,
          stopOrder: stop.stopOrder,
          distanceFromOriginKm: stop.distanceFromOriginKm,
          estimatedMinutes: stop.estimatedMinutes,
        }),
      );
      await this.routeStationRepository.save(stopsToSave);
    }

    // TỰ ĐỘNG SINH LỊCH TRÌNH CHUYẾN XE (Rolling 7-day schedule)
    // Tự động sinh chuyến theo giờ mở tuyến (operatingStart), giờ đóng tuyến (operatingEnd), và tần suất (frequencyMinutes)
    try {
      const startStr = dto.operatingStart || '06:00:00';
      const endStr = dto.operatingEnd || '21:00:00';
      const [startH, startM] = startStr.split(':').map((v) => parseInt(v, 10) || 0);
      const [endH, endM] = endStr.split(':').map((v) => parseInt(v, 10) || 0);
      const freqMin = dto.frequencyMinutes && dto.frequencyMinutes > 0 ? dto.frequencyMinutes : 30;

      let startTotalMin = startH * 60 + startM;
      let endTotalMin = endH * 60 + endM;

      // Hỗ trợ trường hợp giờ chạy mở lúc 00:00 hoặc chạy đêm
      if (endTotalMin <= startTotalMin) {
        endTotalMin = 24 * 60;
      }

      const dailyTimeSlots: Array<{ h: number; m: number }> = [];
      let curMin = startTotalMin;
      while (curMin <= endTotalMin && dailyTimeSlots.length < 30) {
        const h = Math.floor(curMin / 60) % 24;
        const m = curMin % 60;
        dailyTimeSlots.push({ h, m });
        curMin += freqMin;
      }

      if (dailyTimeSlots.length === 0) {
        dailyTimeSlots.push({ h: startH, m: startM });
      }

      const durationMin = dto.estimatedDurationMinutes || 30;
      const tripsToCreate: TripEntity[] = [];
      const now = new Date();

      // Tự động gán xe buýt và tài xế khả dụng nếu không truyền lên
      let assignedVehId = dto.assignedVehicleId;
      let assignedDrvId = dto.assignedDriverId;

      if (!assignedVehId) {
        const defaultVehicle = await this.vehicleRepository.findOne({
          where: { status: VehicleStatus.ACTIVE },
          order: { createdAt: 'ASC' },
        });
        if (defaultVehicle) assignedVehId = defaultVehicle.id;
      }

      if (!assignedDrvId) {
        const defaultDriver = await this.userRepository.findOne({
          where: { role: { name: Role.DRIVER }, status: UserStatus.ACTIVE },
          relations: { role: true },
          order: { createdAt: 'ASC' },
        });
        if (defaultDriver) assignedDrvId = defaultDriver.id;
      }

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + dayOffset);

        for (const slot of dailyTimeSlots) {
          const dep = new Date(targetDate);
          dep.setHours(slot.h, slot.m, 0, 0);
          const arr = new Date(dep.getTime() + durationMin * 60 * 1000);

          const trip = new TripEntity();
          trip.routeId = savedRoute.id;
          // CHUẨN HÓA NGHIỆP VỤ ĐIỀU PHỐI:
          // Ngày đầu tiên (dayOffset === 0) gán xe và tài xế mẫu phục vụ kiểm thử và demo ngay.
          // Các ngày tiếp theo (dayOffset > 0) để trống xe và tài xế (SCHEDULED chờ phân công)
          // để Điều hành viên sắp xếp ca trực xoay vòng, tránh khóa cứng tài xế 15h/ngày cả tuần.
          if (dayOffset === 0) {
            if (assignedVehId) trip.vehicleId = assignedVehId;
            if (assignedDrvId) trip.driverId = assignedDrvId;
          }
          trip.departureTime = dep;
          trip.arrivalTime = arr;
          // Nếu chuyến đã quá khứ hơn 30 phút thì đánh dấu COMPLETED, ngược lại là SCHEDULED
          trip.status =
            dep.getTime() < now.getTime() - 30 * 60 * 1000
              ? TripStatus.COMPLETED
              : TripStatus.SCHEDULED;
          trip.tripType = 'regular';
          tripsToCreate.push(trip);
        }
      }

      // ĐẶC BIỆT DÀNH CHO DEMO: Đảm bảo ngày hôm nay luôn có ít nhất 1 chuyến khởi hành sắp tới (sau 20 phút)
      const hasUpcomingToday = tripsToCreate.some(
        (t) =>
          t.departureTime.toDateString() === now.toDateString() &&
          t.departureTime.getTime() > now.getTime() + 5 * 60 * 1000,
      );

      if (!hasUpcomingToday) {
        const demoDep = new Date(now.getTime() + 20 * 60 * 1000); // 20 phút tới
        const demoArr = new Date(demoDep.getTime() + durationMin * 60 * 1000);
        const demoTrip = new TripEntity();
        demoTrip.routeId = savedRoute.id;
        if (assignedVehId) demoTrip.vehicleId = assignedVehId;
        if (assignedDrvId) demoTrip.driverId = assignedDrvId;
        demoTrip.departureTime = demoDep;
        demoTrip.arrivalTime = demoArr;
        demoTrip.status = TripStatus.SCHEDULED;
        demoTrip.tripType = 'regular';
        tripsToCreate.push(demoTrip);
      }

      if (tripsToCreate.length > 0) {
        await this.tripRepository.save(tripsToCreate);
        this.logger.log(
          `[RoutesService.create] Đã tự động khởi tạo ${tripsToCreate.length} chuyến xe trong 7 ngày tới cho tuyến: ${savedRoute.routeCode} (${savedRoute.name})`,
        );

        // Gửi thông báo phân công cho Tài xế nếu có
        if (assignedDrvId && this.notificationCenterService) {
          try {
            const vehicle = assignedVehId
              ? await this.vehicleRepository.findOne({ where: { id: assignedVehId } })
              : null;
            const licensePlate = vehicle?.licensePlate || 'Xe buýt ICTU';

            const summaryTitle = `📋 Phân công tuyến mới: ${savedRoute.routeCode} (${savedRoute.name})`;
            const summaryMsg = `Bạn đã được phân công phụ trách tuyến ${savedRoute.routeCode} - ${savedRoute.name} (Phương tiện: ${licensePlate}) với tổng cộng ${tripsToCreate.length} ca chạy trong 7 ngày tới. Vui lòng kiểm tra lịch trình làm việc trên ứng dụng.`;

            await this.notificationCenterService.saveNotification({
              userId: assignedDrvId,
              type: 'TRIP_ASSIGNED',
              title: summaryTitle,
              message: summaryMsg,
              deepLink: '/portal/driver',
              data: {
                routeId: savedRoute.id,
                routeCode: savedRoute.routeCode,
                routeName: savedRoute.name,
                licensePlate,
                totalTripsCreated: tripsToCreate.length,
              },
            });
          } catch (notifErr: any) {
            this.logger.warn(`[RoutesService.create] Lỗi khi gửi thông báo phân công: ${notifErr?.message}`);
          }
        }
      }
    } catch (tripErr: any) {
      this.logger.warn(`[RoutesService.create] Lỗi khi tự động sinh chuyến xe: ${tripErr?.message}`);
    }

    return this.findById(savedRoute.id);
  }

  async update(id: string, dto: UpdateRouteDto) {
    await this.findById(id);

    await this.routeRepository.update(id, {
      ...(dto.name && { name: dto.name }),
      ...(dto.origin && { origin: dto.origin }),
      ...(dto.destination && { destination: dto.destination }),
      ...(dto.distanceKm !== undefined && { distanceKm: dto.distanceKm }),
      ...(dto.estimatedDurationMinutes !== undefined && { estimatedDurationMinutes: dto.estimatedDurationMinutes }),
      ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
      ...(dto.studentPrice !== undefined && { studentPrice: dto.studentPrice }),
      ...(dto.operatingStart && { operatingStart: dto.operatingStart }),
      ...(dto.operatingEnd && { operatingEnd: dto.operatingEnd }),
      ...(dto.frequencyMinutes !== undefined && { frequencyMinutes: dto.frequencyMinutes }),
      ...(dto.pricingType && { pricingType: dto.pricingType }),
      ...(dto.fareRules !== undefined && { fareRules: dto.fareRules }),
      ...(dto.status && { status: dto.status }),
    });

    // Đồng bộ lại giờ đến (arrivalTime) cho các chuyến tương lai khi thay đổi thời lượng tuyến
    if (dto.estimatedDurationMinutes !== undefined && dto.estimatedDurationMinutes > 0) {
      try {
        const now = new Date();
        const futureTrips = await this.tripRepository
          .createQueryBuilder('trip')
          .where('trip.routeId = :routeId', { routeId: id })
          .andWhere('trip.departureTime > :now', { now })
          .andWhere('trip.status NOT IN (:...doneStatuses)', {
            doneStatuses: [TripStatus.COMPLETED, TripStatus.CANCELLED],
          })
          .getMany();

        if (futureTrips.length > 0) {
          for (const trip of futureTrips) {
            trip.arrivalTime = new Date(
              new Date(trip.departureTime).getTime() + dto.estimatedDurationMinutes * 60 * 1000,
            );
          }
          await this.tripRepository.save(futureTrips);
          this.logger.log(
            `[RoutesService.update] Đã đồng bộ lại giờ đến (arrivalTime) cho ${futureTrips.length} chuyến tương lai theo thời gian hành trình mới (${dto.estimatedDurationMinutes} phút)`,
          );
        }
      } catch (err: any) {
        this.logger.warn(`[RoutesService.update] Không thể cập nhật giờ đến chuyến tương lai: ${err?.message}`);
      }
    }

    if (dto.stops) {
      await this.routeStationRepository.delete({ routeId: id });
      const stopsToSave = dto.stops.map((stop) =>
        this.routeStationRepository.create({
          routeId: id,
          stationId: stop.stationId,
          stopOrder: stop.stopOrder,
          distanceFromOriginKm: stop.distanceFromOriginKm,
          estimatedMinutes: stop.estimatedMinutes,
        }),
      );
      await this.routeStationRepository.save(stopsToSave);
    }

    return this.findById(id);
  }

  async delete(id: string, force = false) {
    await this.findById(id);

    // 1. RÀNG BUỘC TOÀN VẸN VỚI VÉ XE (TicketEntity qua Booking -> Trip)
    // Không cho phép xóa nếu đã phát sinh vé chưa hủy (trừ khi có cờ force = true cho Admin dọn dẹp)
    const activeTicketsCount = await this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoin('ticket.booking', 'booking')
      .innerJoin('booking.trip', 'trip')
      .where('trip.routeId = :routeId', { routeId: id })
      .andWhere('ticket.status NOT IN (:...cancelledStatuses)', {
        cancelledStatuses: [TicketStatus.CANCELLED, TicketStatus.REFUNDED],
      })
      .getCount();

    if (activeTicketsCount > 0 && !force) {
      throw new ConflictException(
        'Tuyến đường đã phát sinh giao dịch đặt vé của hành khách. Bạn có thể chọn "Xóa Cưỡng Chế" nếu đây là dữ liệu thử nghiệm, hoặc chuyển trạng thái sang tạm ngưng (inactive).',
      );
    }

    if (force && activeTicketsCount > 0) {
      // Xóa cưỡng chế: Hủy toàn bộ vé và booking test liên quan của các chuyến thuộc tuyến này
      await this.ticketRepository.query(
        `UPDATE tickets
         SET status = 'cancelled'
         WHERE booking_id IN (
           SELECT b.id FROM bookings b
           JOIN trips t ON b.trip_id = t.id
           WHERE t.route_id = $1
         )`,
        [id],
      );

      await this.ticketRepository.query(
        `UPDATE bookings
         SET status = 'cancelled'
         WHERE trip_id IN (
           SELECT t.id FROM trips t
           WHERE t.route_id = $1
         )`,
        [id],
      );
    }

    // 2. XỬ LÝ CHUYẾN XE: Nếu xóa cưỡng chế (force = true) thì dọn dẹp triệt để các chuyến xe test; ngược lại chỉ hủy chuyến chưa chạy
    if (force) {
      const trips = await this.tripRepository.find({ where: { routeId: id }, select: { id: true } });
      if (trips.length > 0) {
        const tripIds = trips.map((t) => t.id);
        await this.tripRepository.query('UPDATE feedback SET trip_id = NULL WHERE trip_id = ANY($1)', [tripIds]).catch(() => {});
        await this.tripRepository.query('DELETE FROM seat_holds WHERE trip_id = ANY($1)', [tripIds]).catch(() => {});
        await this.tripRepository.query('DELETE FROM vehicle_tracking WHERE trip_id = ANY($1)', [tripIds]).catch(() => {});
        await this.tripRepository.query('DELETE FROM trip_incidents WHERE trip_id = ANY($1)', [tripIds]).catch(() => {});
        const bookings = await this.tripRepository.query('SELECT id FROM bookings WHERE trip_id = ANY($1)', [tripIds]);
        if (bookings && bookings.length > 0) {
          const bIds = bookings.map((b: any) => b.id);
          await this.tripRepository.query('DELETE FROM refund_logs WHERE payment_id IN (SELECT id FROM payments WHERE booking_id = ANY($1))', [bIds]).catch(() => {});
          await this.tripRepository.query('DELETE FROM payment_logs WHERE payment_id IN (SELECT id FROM payments WHERE booking_id = ANY($1))', [bIds]).catch(() => {});
          await this.tripRepository.query('DELETE FROM invoices WHERE payment_id IN (SELECT id FROM payments WHERE booking_id = ANY($1))', [bIds]).catch(() => {});
          await this.tripRepository.query('DELETE FROM payments WHERE booking_id = ANY($1)', [bIds]).catch(() => {});
          await this.tripRepository.query('DELETE FROM tickets WHERE booking_id = ANY($1)', [bIds]).catch(() => {});
          await this.tripRepository.query('DELETE FROM bookings WHERE trip_id = ANY($1)', [tripIds]).catch(() => {});
        }
        await this.tripRepository.query('DELETE FROM trips WHERE route_id = $1', [id]);
      }
    } else {
      await this.tripRepository
        .createQueryBuilder()
        .update(TripEntity)
        .set({ status: TripStatus.CANCELLED })
        .where('route_id = :routeId', { routeId: id })
        .andWhere('status NOT IN (:...doneStatuses)', {
          doneStatuses: [TripStatus.COMPLETED, TripStatus.CANCELLED],
        })
        .execute();
    }

    // Thực hiện soft delete tuyến xe
    await this.routeRepository.update(id, { status: 'deleted' });
    return {
      message: force
        ? 'Đã xóa cưỡng chế tuyến xe và hủy toàn bộ dữ liệu vé/chuyến test thành công'
        : 'Đã xóa tuyến xe và hủy các chuyến xe chưa có vé thành công',
    };
  }

  // =========================================================================
  // QUẢN LÝ THỨ TỰ TRẠM DỪNG TRÊN TUYẾN (ROUTE_STATIONS)
  // =========================================================================

  async bulkUpdateStations(routeId: string, dto: BulkUpdateRouteStationsDto) {
    await this.findById(routeId);

    if (!dto.stops || dto.stops.length < 2) {
      throw new BadRequestException('Lộ trình tuyến xe bắt buộc phải có ít nhất 2 trạm dừng (Điểm đầu & Điểm cuối)!');
    }

    // Xóa các trạm cũ
    await this.routeStationRepository.delete({ routeId });

    if (dto.stops && dto.stops.length > 0) {
      const stopsToSave = dto.stops.map((stop) =>
        this.routeStationRepository.create({
          routeId,
          stationId: stop.stationId,
          stopOrder: stop.stopOrder,
          distanceFromOriginKm: stop.distanceFromOriginKm,
          estimatedMinutes: stop.estimatedMinutes,
        }),
      );
      await this.routeStationRepository.save(stopsToSave);
    }

    return this.findById(routeId);
  }

  async addStation(routeId: string, dto: AddRouteStationDto) {
    await this.findById(routeId);

    // Kiểm tra xem trạm đã tồn tại trong hệ thống chưa
    const station = await this.stationRepository.findOne({ where: { id: dto.stationId } });
    if (!station) {
      throw new NotFoundException(`Không tìm thấy trạm dừng với ID ${dto.stationId}`);
    }

    // Kiểm tra xem trạm đã có trên lộ trình tuyến này chưa
    const existingOnRoute = await this.routeStationRepository.findOne({
      where: { routeId, stationId: dto.stationId },
    });
    if (existingOnRoute) {
      throw new ConflictException('Trạm dừng này đã có trong lộ trình tuyến xe');
    }

    // Lấy toàn bộ trạm hiện có sắp xếp theo stopOrder
    const currentStations = await this.routeStationRepository.find({
      where: { routeId },
      order: { stopOrder: 'ASC' },
    });

    const targetStopOrder = dto.stopOrder;

    // Dồn thứ tự các trạm từ stopOrder chỉ định về sau (tăng 1)
    // Để tránh trùng unique constraint [routeId, stopOrder], ta tạm thời cộng offset lớn hoặc duyệt ngược
    for (let i = currentStations.length - 1; i >= 0; i--) {
      const rs = currentStations[i];
      if (rs.stopOrder >= targetStopOrder) {
        rs.stopOrder += 1;
        await this.routeStationRepository.save(rs);
      }
    }

    // Lưu trạm mới vào vị trí stopOrder chỉ định
    const newRouteStation = this.routeStationRepository.create({
      routeId,
      stationId: dto.stationId,
      stopOrder: targetStopOrder,
      distanceFromOriginKm: dto.distanceFromOriginKm,
      estimatedMinutes: dto.estimatedMinutes,
    });
    await this.routeStationRepository.save(newRouteStation);

    return this.findById(routeId);
  }

  async removeStation(routeId: string, stationId: string) {
    await this.findById(routeId);

    const rsToDelete = await this.routeStationRepository.findOne({
      where: { routeId, stationId },
    });

    if (!rsToDelete) {
      throw new NotFoundException('Trạm dừng không thuộc lộ trình tuyến này');
    }

    await this.routeStationRepository.delete({ id: rsToDelete.id });

    // Đánh số lại thứ tự stopOrder liên tục từ 1..N
    const remaining = await this.routeStationRepository.find({
      where: { routeId },
      order: { stopOrder: 'ASC' },
    });

    for (let i = 0; i < remaining.length; i++) {
      const rs = remaining[i];
      const correctOrder = i + 1;
      if (rs.stopOrder !== correctOrder) {
        rs.stopOrder = correctOrder;
        await this.routeStationRepository.save(rs);
      }
    }

    return this.findById(routeId);
  }

  // =========================================================================
  // CẤU HÌNH GIÁ VÉ & TÍNH TOÁN GIÁ VÉ TỨC THÌ
  // =========================================================================

  async updatePricing(routeId: string, dto: UpdatePricingDto) {
    await this.findById(routeId);

    const studentPrice =
      dto.studentPrice !== undefined ? dto.studentPrice : Math.round(dto.basePrice * 0.5);

    await this.routeRepository.update(routeId, {
      pricingType: dto.pricingType,
      basePrice: dto.basePrice,
      studentPrice,
      fareRules: dto.fareRules || null,
    });

    return this.findById(routeId);
  }

  async calculateFare(routeId: string, dto: CalculateFareDto) {
    const route = await this.routeRepository.findOne({
      where: { id: routeId },
      relations: { routeStations: { station: true } },
      order: { routeStations: { stopOrder: 'ASC' } },
    });

    if (!route) {
      throw new NotFoundException(`Không tìm thấy tuyến xe với ID ${routeId}`);
    }

    const stops = route.routeStations || [];
    const pickup = stops.find((s) => s.stationId === dto.pickupStationId);
    const dropoff = stops.find((s) => s.stationId === dto.dropoffStationId);

    if (!pickup || !dropoff) {
      throw new NotFoundException('Trạm đón hoặc trả không thuộc lộ trình tuyến này');
    }

    if (pickup.stopOrder >= dropoff.stopOrder) {
      throw new BadRequestException('Trạm đón phải trước trạm trả trên lộ trình xe chạy');
    }

    const stationsPassed = dropoff.stopOrder - pickup.stopOrder;

    // Tính khoảng cách di chuyển
    let distanceKm = 0;
    const hasOriginDistances =
      pickup.distanceFromOriginKm !== null &&
      dropoff.distanceFromOriginKm !== null &&
      Number(dropoff.distanceFromOriginKm) > Number(pickup.distanceFromOriginKm);

    if (hasOriginDistances) {
      distanceKm = Number(
        (Number(dropoff.distanceFromOriginKm) - Number(pickup.distanceFromOriginKm)).toFixed(2),
      );
    } else if (pickup.station && dropoff.station) {
      distanceKm = this.calculateHaversineKm(
        pickup.station.latitude,
        pickup.station.longitude,
        dropoff.station.latitude,
        dropoff.station.longitude,
      );
    }

    let finalPrice = Number(route.basePrice);
    let appliedRule: any = { type: 'base_fare', description: 'Đồng giá toàn tuyến' };
    const isStudent = Boolean(dto.isStudent);
    const baseStudentPrice = Number(route.studentPrice || Math.round(Number(route.basePrice) * 0.5));

    if (route.pricingType === 'fixed') {
      finalPrice = isStudent ? baseStudentPrice : Number(route.basePrice);
      appliedRule = { type: 'fixed', description: 'Đồng giá toàn tuyến' };
    } else if (route.pricingType === 'distance') {
      const rules = Array.isArray(route.fareRules) ? route.fareRules : [];
      const matched = rules.find((r: any) => {
        const min = Number(r.minKm ?? 0);
        const max = Number(r.maxKm ?? 999999);
        return distanceKm >= min && distanceKm <= max;
      });

      if (matched) {
        finalPrice = isStudent
          ? Number(matched.studentPrice ?? Math.round(Number(matched.price) * 0.5))
          : Number(matched.price);
        appliedRule = matched;
      } else {
        finalPrice = isStudent ? baseStudentPrice : Number(route.basePrice);
        appliedRule = { type: 'fallback_base_price', description: 'Áp dụng giá cơ sở' };
      }
    } else if (route.pricingType === 'stage') {
      const rules = Array.isArray(route.fareRules) ? route.fareRules : [];
      const matched = rules.find((r: any) => {
        const min = Number(r.minStage ?? r.minStations ?? 0);
        const max = Number(r.maxStage ?? r.maxStations ?? 999999);
        return stationsPassed >= min && stationsPassed <= max;
      });

      if (matched) {
        finalPrice = isStudent
          ? Number(matched.studentPrice ?? Math.round(Number(matched.price) * 0.5))
          : Number(matched.price);
        appliedRule = matched;
      } else {
        finalPrice = isStudent ? baseStudentPrice : Number(route.basePrice);
        appliedRule = { type: 'fallback_base_price', description: 'Áp dụng giá cơ sở' };
      }
    }

    return {
      routeId: route.id,
      routeCode: route.routeCode,
      routeName: route.name,
      pricingType: route.pricingType,
      pickupStation: {
        id: pickup.station.id,
        name: pickup.station.name,
        stopOrder: pickup.stopOrder,
      },
      dropoffStation: {
        id: dropoff.station.id,
        name: dropoff.station.name,
        stopOrder: dropoff.stopOrder,
      },
      stationsPassed,
      distanceKm,
      isStudent,
      basePrice: Number(route.basePrice),
      studentPrice: baseStudentPrice,
      finalPrice,
      appliedRule,
    };
  }
}
