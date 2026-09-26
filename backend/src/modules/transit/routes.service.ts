import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RouteEntity } from '../../database/entities/route.entity.js';
import { RouteStationEntity } from '../../database/entities/route-station.entity.js';
import { CreateRouteDto, UpdateRouteDto, SearchRouteDto } from './dto/transit.dto.js';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(RouteEntity)
    private readonly routeRepository: Repository<RouteEntity>,
    @InjectRepository(RouteStationEntity)
    private readonly routeStationRepository: Repository<RouteStationEntity>,
  ) {}

  async findAll(query?: SearchRouteDto) {
    const hasFilter =
      Boolean(query?.keyword?.trim()) ||
      Boolean(query?.origin?.trim()) ||
      Boolean(query?.destination?.trim());

    if (!hasFilter) {
      return this.routeRepository
        .createQueryBuilder('route')
        .leftJoinAndSelect('route.routeStations', 'routeStations')
        .leftJoinAndSelect('routeStations.station', 'station')
        .where('route.status = :status', { status: 'active' })
        .orderBy('route.routeCode', 'ASC')
        .addOrderBy('routeStations.stopOrder', 'ASC')
        .getMany();
    }

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

    // Bước 2: Query lại FULL route kèm FULL danh sách routeStations (không lọc trên collection con)
    return this.routeRepository
      .createQueryBuilder('route')
      .leftJoinAndSelect('route.routeStations', 'routeStations')
      .leftJoinAndSelect('routeStations.station', 'station')
      .where('route.id IN (:...matchingIds)', { matchingIds })
      .orderBy('route.routeCode', 'ASC')
      .addOrderBy('routeStations.stopOrder', 'ASC')
      .getMany();
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

    return route;
  }

  async create(dto: CreateRouteDto) {
    const existing = await this.routeRepository.findOne({
      where: { routeCode: dto.routeCode.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException(`Mã tuyến ${dto.routeCode} đã tồn tại`);
    }

    const route = this.routeRepository.create({
      routeCode: dto.routeCode.toUpperCase(),
      name: dto.name,
      origin: dto.origin,
      destination: dto.destination,
      distanceKm: dto.distanceKm,
      basePrice: dto.basePrice,
      studentPrice: dto.studentPrice || Math.round(dto.basePrice * 0.5),
      operatingStart: dto.operatingStart,
      operatingEnd: dto.operatingEnd,
      frequencyMinutes: dto.frequencyMinutes,
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

    return this.findById(savedRoute.id);
  }

  async update(id: string, dto: UpdateRouteDto) {
    await this.findById(id);

    await this.routeRepository.update(id, {
      ...(dto.name && { name: dto.name }),
      ...(dto.origin && { origin: dto.origin }),
      ...(dto.destination && { destination: dto.destination }),
      ...(dto.distanceKm !== undefined && { distanceKm: dto.distanceKm }),
      ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
      ...(dto.studentPrice !== undefined && { studentPrice: dto.studentPrice }),
      ...(dto.operatingStart && { operatingStart: dto.operatingStart }),
      ...(dto.operatingEnd && { operatingEnd: dto.operatingEnd }),
      ...(dto.frequencyMinutes !== undefined && { frequencyMinutes: dto.frequencyMinutes }),
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
    await this.routeRepository.update(id, { status: 'deleted' });
    return { message: 'Đã xóa tuyến xe thành công' };
  }
}
