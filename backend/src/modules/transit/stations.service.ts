import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StationEntity } from '../../database/entities/station.entity.js';
import { CreateStationDto, UpdateStationDto } from './dto/transit.dto.js';

@Injectable()
export class StationsService {
  constructor(
    @InjectRepository(StationEntity)
    private readonly stationRepository: Repository<StationEntity>,
  ) {}

  async findAll() {
    return this.stationRepository.find({
      where: { status: 'active' },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string) {
    const station = await this.stationRepository.findOne({
      where: { id },
      relations: { routeStations: { route: true } },
    });

    if (!station) {
      throw new NotFoundException(`Không tìm thấy trạm dừng với ID ${id}`);
    }

    return station;
  }

  async create(dto: CreateStationDto) {
    const station = this.stationRepository.create({
      name: dto.name,
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
      isHub: dto.isHub || false,
      status: 'active',
    });

    return this.stationRepository.save(station);
  }

  async update(id: string, dto: UpdateStationDto) {
    await this.findById(id);

    await this.stationRepository.update(id, {
      ...(dto.name && { name: dto.name }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.latitude !== undefined && { latitude: dto.latitude }),
      ...(dto.longitude !== undefined && { longitude: dto.longitude }),
      ...(dto.isHub !== undefined && { isHub: dto.isHub }),
      ...(dto.status && { status: dto.status }),
    });

    return this.findById(id);
  }
}
