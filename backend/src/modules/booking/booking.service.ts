import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { BookingEntity } from '../../database/entities/booking.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { SeatEntity } from '../../database/entities/seat.entity.js';
import { VoucherEntity } from '../../database/entities/voucher.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { SeatLockService } from './seat-lock.service.js';
import {
  HoldSeatsDto,
  CreateBookingDto,
  SearchTripsDto,
  ExchangeTicketDto,
} from './dto/booking.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { BookingStatus, TicketStatus, TripStatus } from '../../common/constants/status.constant.js';
import { generateBookingCode, generateTicketCode } from '../../common/utils/booking-code.util.js';
import { signQrPayload, generateQrDataUrl } from '../../common/utils/qr-code.util.js';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(BookingEntity)
    private readonly bookingRepository: Repository<BookingEntity>,
    @InjectRepository(TicketEntity)
    private readonly ticketRepository: Repository<TicketEntity>,
    @InjectRepository(TripEntity)
    private readonly tripRepository: Repository<TripEntity>,
    @InjectRepository(SeatEntity)
    private readonly seatRepository: Repository<SeatEntity>,
    @InjectRepository(VoucherEntity)
    private readonly voucherRepository: Repository<VoucherEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly seatLockService: SeatLockService,
  ) {}

  async searchTrips(dto: SearchTripsDto) {
    const startOfDay = new Date(`${dto.date}T00:00:00`);
    const endOfDay = new Date(`${dto.date}T23:59:59.999`);

    const query = this.tripRepository
      .createQueryBuilder('trip')
      .innerJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .where('trip.departureTime BETWEEN :start AND :end', {
        start: startOfDay,
        end: endOfDay,
      })
      .andWhere('trip.status != :cancelled', { cancelled: TripStatus.CANCELLED });

    if (dto.origin) {
      query.andWhere(
        '(LOWER(route.origin) LIKE :origin OR LOWER(route.name) LIKE :origin)',
        { origin: `%${dto.origin.toLowerCase()}%` },
      );
    }

    if (dto.destination) {
      query.andWhere(
        '(LOWER(route.destination) LIKE :dest OR LOWER(route.name) LIKE :dest)',
        { dest: `%${dto.destination.toLowerCase()}%` },
      );
    }

    query.orderBy('trip.departureTime', 'ASC');

    const trips = await query.getMany();

    const results = await Promise.all(
      trips.map(async (trip) => {
        const capacity = trip.vehicle?.seatCapacity || 28;

        const bookedCount = await this.ticketRepository
          .createQueryBuilder('ticket')
          .innerJoin('ticket.booking', 'booking')
          .where('booking.tripId = :tripId', { tripId: trip.id })
          .andWhere('ticket.status NOT IN (:...excluded)', {
            excluded: [TicketStatus.CANCELLED, TicketStatus.EXPIRED],
          })
          .getCount();

        const availableSeats = Math.max(0, capacity - bookedCount);

        return {
          id: trip.id,
          routeId: trip.routeId,
          routeName: trip.route?.name,
          routeCode: trip.route?.routeCode,
          origin: trip.route?.origin,
          destination: trip.route?.destination,
          departureTime: trip.departureTime,
          arrivalTime: trip.arrivalTime,
          status: trip.status,
          basePrice: Number(trip.route?.basePrice) || 10000,
          studentPrice: Number(trip.route?.studentPrice) || 5000,
          totalSeats: capacity,
          availableSeats,
          vehiclePlate: trip.vehicle?.licensePlate,
          vehicleType: trip.vehicle?.vehicleType,
        };
      }),
    );

    return results;
  }

  async holdSeats(dto: HoldSeatsDto, userId: string) {
    const trip = await this.tripRepository.findOne({ where: { id: dto.tripId } });
    if (!trip) {
      throw new NotFoundException('Không tìm thấy chuyến xe');
    }

    // Check if any seat is already booked in database
    const alreadyBooked = await this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoin('ticket.booking', 'booking')
      .where('booking.tripId = :tripId', { tripId: dto.tripId })
      .andWhere('ticket.seatId IN (:...seatIds)', { seatIds: dto.seatIds })
      .andWhere('ticket.status NOT IN (:...excluded)', {
        excluded: [TicketStatus.CANCELLED, TicketStatus.EXPIRED],
      })
      .getMany();

    if (alreadyBooked.length > 0) {
      throw new ConflictException('Một số ghế đã có người đặt, vui lòng chọn ghế khác');
    }

    const result = await this.seatLockService.holdSeats(dto.tripId, dto.seatIds, userId, 600);

    if (!result.success) {
      throw new ConflictException('Ghế đang được giữ bởi hành khách khác. Vui lòng thử lại sau');
    }

    const expiresAt = new Date(Date.now() + 600 * 1000);

    return {
      success: true,
      message: 'Giữ chỗ thành công trong 10 phút!',
      tripId: dto.tripId,
      lockedSeats: result.lockedSeats,
      expiresAt,
    };
  }

  async releaseSeats(dto: HoldSeatsDto, userId: string) {
    await this.seatLockService.releaseSeats(dto.tripId, dto.seatIds, userId);
    return { success: true, message: 'Đã hủy giữ chỗ thành công' };
  }

  async createBooking(dto: CreateBookingDto, userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Người dùng không hợp lệ');
    }

    const trip = await this.tripRepository.findOne({
      where: { id: dto.tripId },
      relations: { route: true, vehicle: true },
    });

    if (!trip) {
      throw new NotFoundException('Không tìm thấy chuyến xe');
    }

    const seatIds = dto.passengers.map((p) => p.seatId);
    const seats = await this.seatRepository.find({
      where: { id: In(seatIds) },
    });

    if (seats.length !== seatIds.length) {
      throw new BadRequestException('Một hoặc nhiều ghế được chọn không tồn tại');
    }

    // Check if seats already booked in database
    const existingTickets = await this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoin('ticket.booking', 'booking')
      .where('booking.tripId = :tripId', { tripId: dto.tripId })
      .andWhere('ticket.seatId IN (:...seatIds)', { seatIds })
      .andWhere('ticket.status NOT IN (:...excluded)', {
        excluded: [TicketStatus.CANCELLED, TicketStatus.EXPIRED],
      })
      .getMany();

    if (existingTickets.length > 0) {
      throw new ConflictException('Một số ghế đã có người đặt mua trước');
    }

    // Calculate prices
    const isStudent = !!user.studentId;
    const unitPrice = isStudent
      ? Number(trip.route.studentPrice) || Math.round(Number(trip.route.basePrice) * 0.5)
      : Number(trip.route.basePrice);

    let totalAmount = unitPrice * dto.passengers.length;
    let discountAmount = 0;
    let voucher: VoucherEntity | null = null;

    if (dto.voucherCode) {
      voucher = await this.voucherRepository.findOne({
        where: { code: dto.voucherCode.toUpperCase(), status: 'active' },
      });

      if (voucher) {
        const today = new Date().toISOString().slice(0, 10);
        if (voucher.startDate <= today && voucher.endDate >= today) {
          if (totalAmount >= Number(voucher.minOrderValue)) {
            if (voucher.discountType === 'percentage') {
              discountAmount = Math.round((totalAmount * Number(voucher.discountValue)) / 100);
              if (voucher.maxDiscountAmount && discountAmount > Number(voucher.maxDiscountAmount)) {
                discountAmount = Number(voucher.maxDiscountAmount);
              }
            } else {
              discountAmount = Number(voucher.discountValue);
            }
            // Increment usage
            voucher.usedCount += 1;
            await this.voucherRepository.save(voucher);
          }
        }
      }
    }

    const finalAmount = Math.max(0, totalAmount - discountAmount);
    const bookingCode = generateBookingCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const booking = this.bookingRepository.create({
      bookingCode,
      userId,
      tripId: trip.id,
      voucherId: voucher?.id,
      totalAmount,
      discountAmount,
      finalAmount,
      status: BookingStatus.PENDING,
      expiresAt,
    });

    const savedBooking = await this.bookingRepository.save(booking);

    // Create tickets with signed QR
    const qrSecret = process.env.QR_HMAC_SECRET || 'smart-bus-qr-signature-secret-key-2026';
    const ticketsToSave: TicketEntity[] = [];

    const seatMap = new Map<string, SeatEntity>();
    seats.forEach((s) => seatMap.set(s.id, s));

    for (const passenger of dto.passengers) {
      const seat = seatMap.get(passenger.seatId)!;
      const ticketCode = generateTicketCode();

      const qrPayload = {
        ticketCode,
        tripId: trip.id,
        seatNumber: seat.seatNumber,
        passengerName: passenger.passengerName,
        issuedAt: Date.now(),
      };

      const { qrData, signature } = signQrPayload(qrPayload, qrSecret);

      ticketsToSave.push(
        this.ticketRepository.create({
          bookingId: savedBooking.id,
          seatId: seat.id,
          ticketCode,
          qrData,
          qrSignatureHash: signature,
          passengerName: passenger.passengerName,
          passengerPhone: passenger.passengerPhone || user.phoneNumber,
          originalPrice: unitPrice,
          discountPrice: unitPrice,
          status: TicketStatus.RESERVED,
        }),
      );
    }

    const savedTickets = await this.ticketRepository.save(ticketsToSave);

    return {
      bookingId: savedBooking.id,
      bookingCode: savedBooking.bookingCode,
      totalAmount: savedBooking.totalAmount,
      discountAmount: savedBooking.discountAmount,
      finalAmount: savedBooking.finalAmount,
      status: savedBooking.status,
      expiresAt: savedBooking.expiresAt,
      trip: {
        id: trip.id,
        routeName: trip.route?.name,
        departureTime: trip.departureTime,
      },
      tickets: savedTickets.map((t) => ({
        id: t.id,
        ticketCode: t.ticketCode,
        passengerName: t.passengerName,
        seatNumber: seatMap.get(t.seatId)?.seatNumber,
        price: t.originalPrice,
      })),
    };
  }

  async getMyTickets(userId: string, pagination: PaginationDto) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;

    const [tickets, total] = await this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoinAndSelect('ticket.booking', 'booking')
      .innerJoinAndSelect('booking.trip', 'trip')
      .innerJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('ticket.seat', 'seat')
      .where('booking.userId = :userId', { userId })
      .orderBy('ticket.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      items: tickets.map((t) => ({
        ticketId: t.id,
        ticketCode: t.ticketCode,
        bookingCode: t.booking?.bookingCode,
        passengerName: t.passengerName,
        seatNumber: t.seat?.seatNumber,
        status: t.status,
        price: t.originalPrice,
        routeName: t.booking?.trip?.route?.name,
        departureTime: t.booking?.trip?.departureTime,
        createdAt: t.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTicketDetail(ticketId: string, userId: string) {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: {
        booking: {
          trip: {
            route: true,
            vehicle: true,
          },
        },
        seat: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy vé xe');
    }

    if (ticket.booking.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền truy cập vé này');
    }

    let qrDataUrl = '';
    if (ticket.qrData) {
      qrDataUrl = await generateQrDataUrl(ticket.qrData);
    }

    return {
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      bookingCode: ticket.booking?.bookingCode,
      passengerName: ticket.passengerName,
      passengerPhone: ticket.passengerPhone,
      seatNumber: ticket.seat?.seatNumber,
      seatType: ticket.seat?.seatType,
      status: ticket.status,
      price: ticket.originalPrice,
      routeName: ticket.booking?.trip?.route?.name,
      origin: ticket.booking?.trip?.route?.origin,
      destination: ticket.booking?.trip?.route?.destination,
      departureTime: ticket.booking?.trip?.departureTime,
      vehiclePlate: ticket.booking?.trip?.vehicle?.licensePlate,
      qrDataUrl,
      checkedInAt: ticket.checkedInAt,
      createdAt: ticket.createdAt,
    };
  }

  async cancelTicket(ticketId: string, userId: string) {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: {
        booking: {
          trip: true,
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy vé xe');
    }

    if (ticket.booking.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền hủy vé này');
    }

    if (ticket.status === TicketStatus.CANCELLED || ticket.status === TicketStatus.CHECKED_IN) {
      throw new BadRequestException(`Không thể hủy vé ở trạng thái ${ticket.status}`);
    }

    // Policy: Cancel at least 2 hours before departure
    const departureTime = new Date(ticket.booking.trip.departureTime).getTime();
    const now = Date.now();
    const diffHours = (departureTime - now) / (1000 * 60 * 60);

    if (diffHours < 2) {
      throw new BadRequestException('Chỉ được hủy vé trước giờ khởi hành tối thiểu 2 tiếng theo quy định');
    }

    ticket.status = TicketStatus.CANCELLED;
    await this.ticketRepository.save(ticket);

    return {
      success: true,
      message: 'Hủy vé thành công. Số tiền sẽ được xem xét hoàn trả theo chính sách.',
      ticketId: ticket.id,
      status: ticket.status,
    };
  }

  async exchangeTicket(ticketId: string, dto: ExchangeTicketDto, userId: string) {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: {
        booking: {
          trip: true,
        },
        seat: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy vé xe');
    }

    if (ticket.booking.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền đổi vé này');
    }

    if (ticket.status !== TicketStatus.PAID && ticket.status !== TicketStatus.RESERVED) {
      throw new BadRequestException('Chỉ vé đã thanh toán hoặc đã đặt mới có thể đổi chuyến');
    }

    // Check departure > 2h
    const departureTime = new Date(ticket.booking.trip.departureTime).getTime();
    if ((departureTime - Date.now()) / (1000 * 60 * 60) < 2) {
      throw new BadRequestException('Chỉ được đổi vé trước giờ khởi hành tối thiểu 2 tiếng');
    }

    const newTrip = await this.tripRepository.findOne({ where: { id: dto.newTripId } });
    if (!newTrip) {
      throw new NotFoundException('Không tìm thấy chuyến xe mới');
    }

    const newSeat = await this.seatRepository.findOne({ where: { id: dto.newSeatId } });
    if (!newSeat) {
      throw new NotFoundException('Không tìm thấy ghế mới');
    }

    // Check if new seat is already booked on new trip
    const existing = await this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoin('ticket.booking', 'booking')
      .where('booking.tripId = :tripId', { tripId: dto.newTripId })
      .andWhere('ticket.seatId = :seatId', { seatId: dto.newSeatId })
      .andWhere('ticket.status NOT IN (:...excluded)', {
        excluded: [TicketStatus.CANCELLED, TicketStatus.EXPIRED],
      })
      .getOne();

    if (existing) {
      throw new ConflictException('Ghế này trên chuyến mới đã có người đặt');
    }

    // Update ticket
    ticket.seatId = newSeat.id;
    ticket.booking.tripId = newTrip.id;
    await this.bookingRepository.save(ticket.booking);

    // Re-sign QR
    const qrSecret = process.env.QR_HMAC_SECRET || 'smart-bus-qr-signature-secret-key-2026';
    const { qrData, signature } = signQrPayload(
      {
        ticketCode: ticket.ticketCode,
        tripId: newTrip.id,
        seatNumber: newSeat.seatNumber,
        passengerName: ticket.passengerName,
        issuedAt: Date.now(),
      },
      qrSecret,
    );

    ticket.qrData = qrData;
    ticket.qrSignatureHash = signature;
    await this.ticketRepository.save(ticket);

    return {
      success: true,
      message: 'Đổi vé sang chuyến mới thành công!',
      ticketId: ticket.id,
      newTripId: newTrip.id,
      newSeatNumber: newSeat.seatNumber,
    };
  }
}
