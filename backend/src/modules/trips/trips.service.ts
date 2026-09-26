import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, Not } from 'typeorm';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { RouteEntity } from '../../database/entities/route.entity.js';
import { VehicleEntity } from '../../database/entities/vehicle.entity.js';
import { SeatEntity } from '../../database/entities/seat.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { GenerateTripsDto, DispatchTripDto, UpdateTripStatusDto, VerifyQrDto } from './dto/trip.dto.js';
import { TripStatus, TicketStatus } from '../../common/constants/status.constant.js';
import { verifyQrData } from '../../common/utils/qr-code.util.js';

@Injectable()
export class TripsService {
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
  ) {}

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
        }),
      );

      currentMinutes += intervalMinutes;
    }

    const savedTrips = await this.tripRepository.save(tripsToSave);
    return {
      message: `Đã tự động sinh ${savedTrips.length} chuyến xe cho ngày ${dto.date}`,
      count: savedTrips.length,
      trips: savedTrips,
    };
  }

  async dispatch(dto: DispatchTripDto) {
    const trip = await this.findById(dto.tripId);

    if (dto.vehicleId) {
      const vehicle = await this.vehicleRepository.findOne({ where: { id: dto.vehicleId } });
      if (!vehicle) {
        throw new NotFoundException('Phương tiện không tồn tại');
      }
      trip.vehicleId = vehicle.id;
    }

    if (dto.driverId) {
      const driver = await this.userRepository.findOne({ where: { id: dto.driverId } });
      if (!driver) {
        throw new NotFoundException('Tài xế không tồn tại');
      }
      trip.driverId = driver.id;
    }

    if (dto.conductorId) {
      const conductor = await this.userRepository.findOne({ where: { id: dto.conductorId } });
      if (!conductor) {
        throw new NotFoundException('Phụ xe không tồn tại');
      }
      trip.conductorId = conductor.id;
    }

    await this.tripRepository.save(trip);
    return this.findById(trip.id);
  }

  async findById(id: string) {
    const trip = await this.tripRepository.findOne({
      where: { id },
      relations: { route: true, vehicle: true, driver: true, conductor: true },
    });

    if (!trip) {
      throw new NotFoundException(`Không tìm thấy chuyến xe với ID ${id}`);
    }

    return trip;
  }

  async getSeatMap(tripId: string) {
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

    // Get active tickets for this trip
    const activeTickets = await this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoin('ticket.booking', 'booking')
      .where('booking.tripId = :tripId', { tripId })
      .andWhere('ticket.status NOT IN (:...excluded)', {
        excluded: [TicketStatus.CANCELLED, TicketStatus.EXPIRED],
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

    const seatMap = seats.map((seat) => {
      const bookingInfo = bookedSeatMap.get(seat.id);
      return {
        seatId: seat.id,
        seatNumber: seat.seatNumber,
        rowNumber: seat.rowNumber,
        columnLabel: seat.columnLabel,
        seatType: seat.seatType,
        isBooked: !!bookingInfo,
        bookingStatus: bookingInfo?.status || 'available',
      };
    });

    const totalSeats = seats.length;
    const bookedCount = bookedSeatMap.size;
    const availableCount = totalSeats - bookedCount;

    return {
      tripId: trip.id,
      routeName: trip.route?.name,
      departureTime: trip.departureTime,
      totalSeats,
      bookedCount,
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
      where: {
        driverId,
        departureTime: Between(startOfDay, endOfDay),
      },
      relations: { route: true, vehicle: true },
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
    const secret = process.env.QR_HMAC_SECRET || 'smart-bus-qr-signature-secret-key-2026';
    const verifyResult = verifyQrData(dto.qrData, secret);

    if (!verifyResult.valid || !verifyResult.payload) {
      throw new BadRequestException(verifyResult.reason || 'Mã QR không hợp lệ hoặc đã bị can thiệp');
    }

    const { ticketCode, tripId } = verifyResult.payload;

    const ticket = await this.ticketRepository.findOne({
      where: { ticketCode },
      relations: { booking: true, seat: true },
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy thông tin vé trong hệ thống');
    }

    if (dto.tripId && ticket.booking.tripId !== dto.tripId) {
      throw new BadRequestException('Vé này không thuộc về chuyến xe hiện tại');
    }

    if (ticket.status === TicketStatus.CANCELLED || ticket.status === TicketStatus.EXPIRED) {
      throw new BadRequestException(`Vé đã bị hủy hoặc hết hạn (${ticket.status})`);
    }

    if (ticket.status === TicketStatus.CHECKED_IN) {
      return {
        valid: false,
        alreadyCheckedIn: true,
        message: 'CẢNH BÁO: Vé này đã được soát trước đó!',
        checkedInAt: ticket.checkedInAt,
        passenger: ticket.passengerName,
        seat: ticket.seat?.seatNumber,
      };
    }

    ticket.status = TicketStatus.CHECKED_IN;
    ticket.checkedInAt = new Date();
    if (conductorId) {
      ticket.checkedInBy = conductorId;
    }

    await this.ticketRepository.save(ticket);

    return {
      valid: true,
      success: true,
      message: 'Soát vé thành công! Cho phép hành khách lên xe.',
      passenger: ticket.passengerName,
      seat: ticket.seat?.seatNumber,
      ticketCode: ticket.ticketCode,
      checkedInAt: ticket.checkedInAt,
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
