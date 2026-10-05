import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RouteEntity } from '../../database/entities/route.entity.js';
import { RouteStationEntity } from '../../database/entities/route-station.entity.js';
import { StationEntity } from '../../database/entities/station.entity.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import {
  CreateRouteDto,
  UpdateRouteDto,
  SearchRouteDto,
  UpdatePricingDto,
  CalculateFareDto,
  AddRouteStationDto,
  BulkUpdateRouteStationsDto,
} from './dto/transit.dto.js';
import { TicketStatus, TripStatus } from '../../common/constants/status.constant.js';

@Injectable()
export class RoutesService {
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
        .orderBy('route.routeCode', 'ASC')
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
        .orderBy('route.routeCode', 'ASC')
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

    // Tự động kích hoạt lịch chạy hôm nay và phân quyền trực tiếp cho Tài xế + Xe buýt
    const today = new Date();
    const sampleTimes = ['07:00', '09:30', '13:30', '15:30', '17:30', '19:00'];
    const durationMin = dto.estimatedDurationMinutes || 40;

    const tripsToCreate = sampleTimes.map((t) => {
      const [h, m] = t.split(':').map(Number);
      const dep = new Date(today);
      dep.setHours(h, m, 0, 0);
      const arr = new Date(dep.getTime() + durationMin * 60 * 1000);

      const trip = new TripEntity();
      trip.routeId = savedRoute.id;
      if (dto.assignedVehicleId) trip.vehicleId = dto.assignedVehicleId;
      if (dto.assignedDriverId) trip.driverId = dto.assignedDriverId;
      trip.departureTime = dep;
      trip.arrivalTime = arr;
      trip.status = TripStatus.SCHEDULED;
      return trip;
    });

    try {
      await this.tripRepository.save(tripsToCreate);
    } catch (tripErr: any) {
      console.warn('[RoutesService.create] Lỗi khi tự động sinh chuyến xe mẫu:', tripErr);
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

  async delete(id: string) {
    await this.findById(id);

    // 1. RÀNG BUỘC TOÀN VẸN VỚI CHUYẾN XE (TripEntity)
    // Không cho phép xóa nếu có chuyến xe ở trạng thái scheduled, in_progress, hoặc delayed
    const activeTripsCount = await this.tripRepository.count({
      where: {
        routeId: id,
        status: In([
          TripStatus.SCHEDULED,
          TripStatus.IN_PROGRESS,
          TripStatus.DELAYED,
          TripStatus.BOARDING,
          TripStatus.DEPARTED,
        ]),
      },
    });

    if (activeTripsCount > 0) {
      throw new ConflictException('Tuyến đường đang có chuyến xe hoạt động hoặc đã lên lịch chạy.');
    }

    // 2. RÀNG BUỘC TOÀN VẸN VỚI VÉ XE (TicketEntity qua Booking -> Trip)
    // Không cho phép xóa nếu đã phát sinh vé chưa hủy
    const activeTicketsCount = await this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoin('ticket.booking', 'booking')
      .innerJoin('booking.trip', 'trip')
      .where('trip.routeId = :routeId', { routeId: id })
      .andWhere('ticket.status NOT IN (:...cancelledStatuses)', {
        cancelledStatuses: [TicketStatus.CANCELLED, TicketStatus.REFUNDED],
      })
      .getCount();

    if (activeTicketsCount > 0) {
      throw new ConflictException(
        'Tuyến đường đã phát sinh giao dịch đặt vé của hành khách. Vui lòng chuyển trạng thái sang tạm ngưng (inactive) thay vì xóa.',
      );
    }

    // Thực hiện soft delete
    await this.routeRepository.update(id, { status: 'deleted' });
    return { message: 'Đã xóa tuyến xe thành công' };
  }

  // =========================================================================
  // QUẢN LÝ THỨ TỰ TRẠM DỪNG TRÊN TUYẾN (ROUTE_STATIONS)
  // =========================================================================

  async bulkUpdateStations(routeId: string, dto: BulkUpdateRouteStationsDto) {
    await this.findById(routeId);

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
