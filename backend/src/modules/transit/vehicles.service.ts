import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VehicleEntity } from '../../database/entities/vehicle.entity.js';
import { SeatEntity } from '../../database/entities/seat.entity.js';
import { CreateVehicleDto } from './dto/transit.dto.js';
import { SeatType, VehicleStatus } from '../../common/constants/status.constant.js';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepository: Repository<VehicleEntity>,
    @InjectRepository(SeatEntity)
    private readonly seatRepository: Repository<SeatEntity>,
  ) {}

  async findAll() {
    return this.vehicleRepository.find({
      order: { licensePlate: 'ASC' },
    });
  }

  async findById(id: string) {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id },
      relations: { seats: true },
    });

    if (!vehicle) {
      throw new NotFoundException(`Không tìm thấy xe với ID ${id}`);
    }

    return vehicle;
  }

  async getSeats(vehicleId: string) {
    await this.findById(vehicleId);
    return this.seatRepository.find({
      where: { vehicleId },
      order: {
        rowNumber: 'ASC',
        columnLabel: 'ASC',
      },
    });
  }

  async create(dto: CreateVehicleDto) {
    const existing = await this.vehicleRepository.findOne({
      where: { licensePlate: dto.licensePlate.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException(`Xe có biển số ${dto.licensePlate} đã tồn tại`);
    }

    const seatCapacity = dto.seatCapacity || 28;

    const vehicle = this.vehicleRepository.create({
      licensePlate: dto.licensePlate.toUpperCase(),
      model: dto.model || 'VinFast eBus 2024',
      vehicleType: dto.vehicleType || 'electric',
      seatCapacity,
      manufactureYear: dto.manufactureYear || new Date().getFullYear(),
      batteryCapacityKwh: dto.batteryCapacityKwh || 281.9,
      status: VehicleStatus.ACTIVE,
    });

    const savedVehicle = await this.vehicleRepository.save(vehicle);

    // Auto-generate 28 seats (7 rows x 4 seats: A, B aisle C, D)
    const seatsToSave: SeatEntity[] = [];
    const cols = ['A', 'B', 'C', 'D'];
    const totalRows = Math.ceil(seatCapacity / cols.length);

    let count = 0;
    for (let r = 1; r <= totalRows; r++) {
      for (const col of cols) {
        if (count >= seatCapacity) break;
        count++;
        const rowStr = r < 10 ? `0${r}` : `${r}`;
        const seatNumber = `${rowStr}${col}`;
        const isPriority = r === 1; // First row is priority for elderly/disabled

        seatsToSave.push(
          this.seatRepository.create({
            vehicleId: savedVehicle.id,
            seatNumber,
            rowNumber: r,
            columnLabel: col,
            seatType: isPriority ? SeatType.PRIORITY : SeatType.STANDARD,
            floorNumber: 1,
          }),
        );
      }
    }

    await this.seatRepository.save(seatsToSave);

    return this.findById(savedVehicle.id);
  }
}
