import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, DataSource, LessThanOrEqual } from 'typeorm';
import { BookingEntity } from '../../database/entities/booking.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { SeatEntity } from '../../database/entities/seat.entity.js';
import { VoucherEntity } from '../../database/entities/voucher.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { SeatHoldEntity } from '../../database/entities/seat-hold.entity.js';
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
    @Optional()
    @InjectRepository(SeatHoldEntity)
    private readonly seatHoldRepository?: Repository<SeatHoldEntity>,
    @Optional()
    private readonly dataSource?: DataSource,
  ) {}

  async searchTrips(dto: SearchTripsDto) {
    let targetDateStr = dto?.date?.trim();
    if (!targetDateStr) {
      const now = new Date();
      targetDateStr = now.toISOString().split('T')[0];
    } else {
      const isIsoFormat = /^\d{4}-\d{2}-\d{2}$/.test(targetDateStr);
      if (!isIsoFormat || isNaN(Date.parse(targetDateStr))) {
        throw new BadRequestException('Định dạng ngày không hợp lệ');
      }
      const [year, month, day] = targetDateStr.split('-').map(Number);
      const testDate = new Date(year, month - 1, day);
      if (
        testDate.getFullYear() !== year ||
        testDate.getMonth() !== month - 1 ||
        testDate.getDate() !== day
      ) {
        throw new BadRequestException('Định dạng ngày không hợp lệ');
      }
    }

    const startOfDay = new Date(`${targetDateStr}T00:00:00`);
    const endOfDay = new Date(`${targetDateStr}T23:59:59.999`);

    const query = this.tripRepository
      .createQueryBuilder('trip')
      .innerJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .where('trip.departureTime BETWEEN :start AND :end', {
        start: startOfDay,
        end: endOfDay,
      })
      .andWhere('trip.status != :cancelled', { cancelled: TripStatus.CANCELLED });

    if (dto.origin?.trim()) {
      query.andWhere(
        `(LOWER(route.origin) LIKE :origin OR LOWER(route.name) LIKE :origin OR EXISTS (
          SELECT 1 FROM route_stations rs_o
          JOIN stations s_o ON rs_o.station_id = s_o.id
          WHERE rs_o.route_id = route.id AND LOWER(s_o.name) LIKE :origin
        ))`,
        { origin: `%${dto.origin.trim().toLowerCase()}%` },
      );
    }

    if (dto.destination?.trim()) {
      query.andWhere(
        `(LOWER(route.destination) LIKE :dest OR LOWER(route.name) LIKE :dest OR EXISTS (
          SELECT 1 FROM route_stations rs_d
          JOIN stations s_d ON rs_d.station_id = s_d.id
          WHERE rs_d.route_id = route.id AND LOWER(s_d.name) LIKE :dest
        ))`,
        { dest: `%${dto.destination.trim().toLowerCase()}%` },
      );
    }

    if (dto.origin?.trim() && dto.destination?.trim()) {
      query.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM route_stations rs_from
          JOIN stations s_from ON rs_from.station_id = s_from.id
          JOIN route_stations rs_to ON rs_to.route_id = rs_from.route_id
          JOIN stations s_to ON rs_to.station_id = s_to.id
          WHERE rs_from.route_id = route.id
            AND LOWER(s_from.name) LIKE :origin
            AND LOWER(s_to.name) LIKE :dest
            AND rs_from.stop_order >= rs_to.stop_order
        )`,
        {
          origin: `%${dto.origin.trim().toLowerCase()}%`,
          dest: `%${dto.destination.trim().toLowerCase()}%`,
        },
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
          .andWhere('(booking.status != :pendingStatus OR booking.expiresAt > :now)', {
            pendingStatus: BookingStatus.PENDING,
            now: new Date(),
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
    const trip = await this.tripRepository.findOne({
      where: { id: dto.tripId },
      relations: { vehicle: true },
    });
    if (!trip) {
      throw new NotFoundException('Không tìm thấy chuyến xe');
    }

    if (
      trip.status === TripStatus.CANCELLED ||
      trip.status === TripStatus.COMPLETED ||
      trip.status === TripStatus.DEPARTED
    ) {
      throw new BadRequestException('Chuyến xe không ở trạng thái nhận đặt vé');
    }

    const seats = await this.seatRepository.find({
      where: { id: In(dto.seatIds) },
    });
    if (seats.length !== dto.seatIds.length) {
      throw new BadRequestException('Một hoặc nhiều ghế được chọn không tồn tại');
    }

    if (trip.vehicleId) {
      const invalidSeats = seats.filter((s) => s.vehicleId !== trip.vehicleId);
      if (invalidSeats.length > 0) {
        throw new BadRequestException('Một hoặc nhiều ghế không thuộc phương tiện của chuyến xe này');
      }
    }

    const seatNumberMap = new Map(seats.map((s) => [s.id, s.seatNumber]));
    const now = new Date();

    // Check if any seat is already booked in database (loại trừ các booking pending đã hết hạn)
    const alreadyBooked = await this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoin('ticket.booking', 'booking')
      .leftJoinAndSelect('ticket.seat', 'seat')
      .where('booking.tripId = :tripId', { tripId: dto.tripId })
      .andWhere('ticket.seatId IN (:...seatIds)', { seatIds: dto.seatIds })
      .andWhere('ticket.status NOT IN (:...excluded)', {
        excluded: [TicketStatus.CANCELLED, TicketStatus.EXPIRED],
      })
      .andWhere('(booking.status != :pendingStatus OR booking.expiresAt > :now)', {
        pendingStatus: BookingStatus.PENDING,
        now,
      })
      .getMany();

    if (alreadyBooked.length > 0) {
      const failedSeatNumbers = alreadyBooked.map((t) => t.seat?.seatNumber || t.seatId);
      throw new ConflictException({
        message: 'Một số ghế đã có người đặt mua trước, vui lòng chọn ghế khác',
        failedSeats: failedSeatNumbers,
      });
    }

    // Kiểm tra trong CSDL: ngăn người dùng khác chọn ghế đang được giữ còn hiệu lực
    if (this.seatHoldRepository) {
      const activeDbHolds = await this.seatHoldRepository
        .createQueryBuilder('hold')
        .where('hold.tripId = :tripId', { tripId: dto.tripId })
        .andWhere('hold.seatId IN (:...seatIds)', { seatIds: dto.seatIds })
        .andWhere('hold.status = :status', { status: 'holding' })
        .andWhere('hold.expiresAt > :now', { now })
        .getMany();

      const heldByOthers = activeDbHolds.filter((h) => h.userId !== userId);
      if (heldByOthers.length > 0) {
        const failedSeatNumbers = heldByOthers.map((h) => seatNumberMap.get(h.seatId) || h.seatId);
        throw new ConflictException({
          message: 'Ghế đang được giữ bởi hành khách khác. Vui lòng thử lại sau',
          failedSeats: failedSeatNumbers,
        });
      }
    }

    const result = await this.seatLockService.holdSeats(dto.tripId, dto.seatIds, userId, 600);

    if (!result.success) {
      const failedSeatNumbers = result.failedSeats.map((id) => seatNumberMap.get(id) || id);
      throw new ConflictException({
        message: 'Ghế đang được giữ bởi hành khách khác. Vui lòng thử lại sau',
        failedSeats: failedSeatNumbers,
      });
    }

    const startTime = now;
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const holdToken = `HOLD_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Lưu thông tin ghế đang được giữ vào cơ sở dữ liệu
    if (this.seatHoldRepository) {
      // Đánh dấu các bản ghi giữ trước đó của cùng user trên các ghế này thành 'released'
      await this.seatHoldRepository
        .createQueryBuilder()
        .update(SeatHoldEntity)
        .set({ status: 'released' })
        .where('tripId = :tripId AND userId = :userId AND seatId IN (:...seatIds) AND status = :status', {
          tripId: dto.tripId,
          userId,
          seatIds: result.lockedSeats,
          status: 'holding',
        })
        .execute();

      const holds = result.lockedSeats.map((seatId) =>
        this.seatHoldRepository!.create({
          tripId: dto.tripId,
          seatId,
          userId,
          holdToken,
          status: 'holding',
          createdAt: startTime,
          expiresAt,
        }),
      );
      await this.seatHoldRepository.save(holds);
    }

    return {
      success: true,
      message: 'Giữ chỗ thành công trong 10 phút!',
      holdToken,
      tripId: dto.tripId,
      lockedSeats: result.lockedSeats,
      lockedSeatNumbers: result.lockedSeats.map((id) => seatNumberMap.get(id) || id),
      startTime,
      expiresAt,
      remainingSeconds: 600,
    };
  }

  async releaseSeats(dto: HoldSeatsDto, userId: string) {
    await this.seatLockService.releaseSeats(dto.tripId, dto.seatIds, userId);
    if (this.seatHoldRepository) {
      await this.seatHoldRepository
        .createQueryBuilder()
        .update(SeatHoldEntity)
        .set({ status: 'released' })
        .where('tripId = :tripId AND userId = :userId AND seatId IN (:...seatIds) AND status = :status', {
          tripId: dto.tripId,
          userId,
          seatIds: dto.seatIds,
          status: 'holding',
        })
        .execute();
    }
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

    if (
      trip.status === TripStatus.CANCELLED ||
      trip.status === TripStatus.COMPLETED ||
      trip.status === TripStatus.DEPARTED
    ) {
      throw new BadRequestException('Chuyến xe không ở trạng thái nhận đặt vé');
    }

    const seatIds = dto.passengers.map((p) => p.seatId);
    const seats = await this.seatRepository.find({
      where: { id: In(seatIds) },
    });

    if (seats.length !== seatIds.length) {
      throw new BadRequestException('Một hoặc nhiều ghế được chọn không tồn tại');
    }

    if (trip.vehicleId) {
      const invalidSeats = seats.filter((s) => s.vehicleId !== trip.vehicleId);
      if (invalidSeats.length > 0) {
        throw new BadRequestException('Một hoặc nhiều ghế không thuộc phương tiện của chuyến xe này');
      }
    }

    const seatMap = new Map<string, SeatEntity>();
    seats.forEach((s) => seatMap.set(s.id, s));

    // Chống Race Condition: Kiểm tra quyền sở hữu lock ghế, ngăn chặn cướp ghế đang giữ
    for (const seatId of seatIds) {
      const lockInfo = await this.seatLockService.isSeatLocked(dto.tripId, seatId);
      if (lockInfo.isLocked && lockInfo.userId && lockInfo.userId !== userId) {
        const seat = seatMap.get(seatId);
        throw new ConflictException({
          message: `Ghế ${seat?.seatNumber || seatId} đang được giữ bởi hành khách khác. Không thể đặt vé.`,
          failedSeats: [seat?.seatNumber || seatId],
        });
      }
    }

    if (this.seatHoldRepository) {
      const activeDbHolds = await this.seatHoldRepository
        .createQueryBuilder('hold')
        .where('hold.tripId = :tripId', { tripId: dto.tripId })
        .andWhere('hold.seatId IN (:...seatIds)', { seatIds })
        .andWhere('hold.status = :status', { status: 'holding' })
        .andWhere('hold.expiresAt > :now', { now: new Date() })
        .getMany();

      const foreignHold = activeDbHolds.find((h) => h.userId !== userId);
      if (foreignHold) {
        const seat = seatMap.get(foreignHold.seatId);
        throw new ConflictException({
          message: `Ghế ${seat?.seatNumber || foreignHold.seatId} đang được giữ bởi hành khách khác. Không thể đặt vé.`,
          failedSeats: [seat?.seatNumber || foreignHold.seatId],
        });
      }
    }

    // Calculate prices
    const isStudent = !!user.studentId;
    const unitPrice = isStudent
      ? Number(trip.route.studentPrice) || Math.round(Number(trip.route.basePrice) * 0.5)
      : Number(trip.route.basePrice);

    let totalAmount = unitPrice * dto.passengers.length;
    let discountAmount = 0;
    let voucher: VoucherEntity | null = null;

    // Sử dụng Database Transaction khi có DataSource để đảm bảo tính toàn vẹn tuyệt đối
    const queryRunner = this.dataSource ? this.dataSource.createQueryRunner() : null;
    if (queryRunner) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }

    try {
      const manager = queryRunner ? queryRunner.manager : null;
      const ticketRepo = manager ? manager.getRepository(TicketEntity) : this.ticketRepository;
      const bookingRepo = manager ? manager.getRepository(BookingEntity) : this.bookingRepository;
      const voucherRepo = manager ? manager.getRepository(VoucherEntity) : this.voucherRepository;

      // Double check bên trong transaction xem ghế đã bị ai mua trước chưa
      const existingTickets = await ticketRepo
        .createQueryBuilder('ticket')
        .innerJoin('ticket.booking', 'booking')
        .leftJoinAndSelect('ticket.seat', 'seat')
        .where('booking.tripId = :tripId', { tripId: dto.tripId })
        .andWhere('ticket.seatId IN (:...seatIds)', { seatIds })
        .andWhere('ticket.status NOT IN (:...excluded)', {
          excluded: [TicketStatus.CANCELLED, TicketStatus.EXPIRED],
        })
        .getMany();

      if (existingTickets.length > 0) {
        const failedSeatNumbers = existingTickets.map((t) => t.seat?.seatNumber || t.seatId);
        throw new ConflictException({
          message: 'Một số ghế đã có người đặt mua trước',
          failedSeats: failedSeatNumbers,
        });
      }

      if (dto.voucherCode) {
        voucher = await voucherRepo.findOne({
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
              await voucherRepo.save(voucher);
            }
          }
        }
      }

      const finalAmount = Math.max(0, totalAmount - discountAmount);
      const bookingCode = generateBookingCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const booking = bookingRepo.create({
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

      const savedBooking = await bookingRepo.save(booking);

      // Create tickets with signed QR
      const qrSecret = process.env.QR_HMAC_SECRET || 'smart-bus-qr-signature-secret-key-2026';
      const ticketsToSave: TicketEntity[] = [];

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
          ticketRepo.create({
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

      const savedTickets = await ticketRepo.save(ticketsToSave);

      if (queryRunner) {
        await queryRunner.commitTransaction();
      }

      // Sau khi transaction commit thành công, giải phóng lock ghế ngay lập tức
      await this.seatLockService.releaseSeats(dto.tripId, seatIds, userId);

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
    } catch (error) {
      if (queryRunner) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      if (queryRunner) {
        await queryRunner.release();
      }
    }
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

  async cleanupExpiredHolds() {
    const now = new Date();
    if (this.seatHoldRepository) {
      await this.seatHoldRepository
        .createQueryBuilder()
        .update(SeatHoldEntity)
        .set({ status: 'expired' })
        .where('status = :status AND expiresAt <= :now', { status: 'holding', now })
        .execute();
    }

    const expiredBookings = await this.bookingRepository.find({
      where: {
        status: BookingStatus.PENDING,
        expiresAt: LessThanOrEqual(now),
      },
      relations: { tickets: true },
    });

    for (const booking of expiredBookings) {
      booking.status = BookingStatus.EXPIRED;
      await this.bookingRepository.save(booking);

      if (booking.tickets && booking.tickets.length > 0) {
        await this.ticketRepository.update(
          { bookingId: booking.id },
          { status: TicketStatus.EXPIRED },
        );
      }
    }

    return { success: true, expiredBookingsCount: expiredBookings.length };
  }

  async cancelBooking(bookingId: string, userId?: string) {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: { tickets: true },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt vé');
    }

    if (userId && booking.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên đơn đặt vé này');
    }

    if (booking.status === BookingStatus.PAID) {
      throw new BadRequestException('Đơn hàng đã thanh toán thành công, không thể hủy trực tiếp');
    }

    booking.status = BookingStatus.CANCELLED;
    await this.bookingRepository.save(booking);

    const seatIds = (booking.tickets || []).map((t) => t.seatId);
    if (booking.tickets && booking.tickets.length > 0) {
      await this.ticketRepository.update(
        { bookingId: booking.id },
        { status: TicketStatus.CANCELLED },
      );
    }

    if (seatIds.length > 0) {
      if (this.seatHoldRepository) {
        await this.seatHoldRepository.update(
          { tripId: booking.tripId, seatId: In(seatIds) },
          { status: 'released' },
        );
      }
      await this.seatLockService.releaseSeats(booking.tripId, seatIds, booking.userId);
    }

    return {
      success: true,
      message: 'Đã hủy đơn đặt vé và giải phóng ghế thành công',
      bookingId: booking.id,
    };
  }
}
