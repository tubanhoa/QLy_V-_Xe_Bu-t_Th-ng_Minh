import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RouteEntity } from '../../database/entities/route.entity.js';
import { RouteStationEntity } from '../../database/entities/route-station.entity.js';
import { CreateRouteDto, UpdateRouteDto } from './dto/transit.dto.js';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(RouteEntity)
    private readonly routeRepository: Repository<RouteEntity>,
    @InjectRepository(RouteStationEntity)
    private readonly routeStationRepository: Repository<RouteStationEntity>,
  ) {}

  async findAll() {
    return this.routeRepository.find({
      where: { status: 'active' },
      relations: { routeStations: { station: true } },
      order: {
        routeCode: 'ASC',
        routeStations: { stopOrder: 'ASC' },
      },
    });
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
