import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, DataSource, LessThanOrEqual, MoreThan } from 'typeorm';
import { BookingEntity } from '../../database/entities/booking.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { SeatEntity } from '../../database/entities/seat.entity.js';
import { VoucherEntity } from '../../database/entities/voucher.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { SeatHoldEntity } from '../../database/entities/seat-hold.entity.js';
import { PaymentEntity } from '../../database/entities/payment.entity.js';
import { RefundLogEntity } from '../../database/entities/refund-log.entity.js';
import { SeatLockService } from './seat-lock.service.js';
import { PaymentService } from '../payment/payment.service.js';
import {
  HoldSeatsDto,
  CreateBookingDto,
  SearchTripsDto,
  ExchangeTicketDto,
  CancelTicketDto,
  HoldExchangeSeatDto,
  ConfirmExchangeDto,
  AdminTicketsQueryDto,
} from './dto/booking.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { BookingStatus, TicketStatus, TripStatus, PaymentStatus } from '../../common/constants/status.constant.js';
import { Role } from '../../common/constants/roles.constant.js';
import { generateBookingCode, generateTicketCode } from '../../common/utils/booking-code.util.js';
import { signQrPayload, generateQrDataUrl } from '../../common/utils/qr-code.util.js';
import { NotificationService } from '../notification/notification.service.js';

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
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository?: Repository<PaymentEntity>,
    @Optional()
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService?: PaymentService,
    @Optional()
    private readonly dataSource?: DataSource,
    @Optional()
    private readonly notificationService?: NotificationService,
  ) {}

  private readonly activeTicketLocks = new Set<string>();
  private readonly idempotencyRecords = new Map<string, { result: any; createdAt: number }>();

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
    if (trips.length === 0) return [];

    const tripIds = trips.map((t) => t.id);

    // Tối ưu hóa truy vấn hàng loạt (Batch Query): Gom toàn bộ số vé đã đặt chỉ với 1 truy vấn GROUP BY duy nhất
    const rawCounts = await this.ticketRepository
      .createQueryBuilder('ticket')
      .select('booking.tripId', 'tripId')
      .addSelect('COUNT(ticket.id)', 'bookedCount')
      .innerJoin('ticket.booking', 'booking')
      .where('booking.tripId IN (:...tripIds)', { tripIds })
      .andWhere('ticket.status NOT IN (:...excluded)', {
        excluded: [TicketStatus.CANCELLED, TicketStatus.EXPIRED],
      })
      .andWhere('(booking.status != :pendingStatus OR booking.expiresAt > :now)', {
        pendingStatus: BookingStatus.PENDING,
        now: new Date(),
      })
      .groupBy('booking.tripId')
      .getRawMany();

    const bookedCountMap = new Map<string, number>();
    rawCounts.forEach((r) => {
      bookedCountMap.set(r.tripId, parseInt(r.bookedCount, 10) || 0);
    });

    const nowMs = Date.now();
    const results = trips.map((trip) => {
      const capacity = trip.vehicle?.seatCapacity || 28;
      const bookedCount = bookedCountMap.get(trip.id) || 0;
      const availableSeats = Math.max(0, capacity - bookedCount);
      const isAdhoc = trip.tripType === 'adhoc' || trip.tripType === 'special';
      const createdTimeMs = trip.createdAt ? new Date(trip.createdAt).getTime() : 0;
      const isNew = isAdhoc || (nowMs - createdTimeMs <= 24 * 60 * 60 * 1000);
      const isBookable =
        trip.status === TripStatus.SCHEDULED || trip.status === TripStatus.BOARDING;

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
        isBookable,
        basePrice: Number(trip.route?.basePrice) || 10000,
        studentPrice: Number(trip.route?.studentPrice) || 5000,
        totalSeats: capacity,
        availableSeats,
        vehiclePlate: trip.vehicle?.licensePlate,
        vehicleType: trip.vehicle?.vehicleType,
        createdAt: trip.createdAt,
        routeCreatedAt: trip.route?.createdAt,
        isAdhoc,
        isNew,
      };
    });

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
        .andWhere('(booking.status != :pendingStatus OR booking.expiresAt > :now)', {
          pendingStatus: BookingStatus.PENDING,
          now: new Date(),
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
          bookingCode: savedBooking.bookingCode,
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
      .leftJoinAndSelect('booking.payments', 'payments')
      .where('booking.userId = :userId', { userId })
      .orderBy('ticket.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      items: tickets.map((t) => {
        let refundInfo: any = null;
        if (t.status === TicketStatus.CANCELLED || t.status === TicketStatus.REFUNDED) {
          const p = t.booking?.payments?.[0];
          const original = Number(t.originalPrice || 10000);
          const refAmount = p?.refundAmount != null ? Number(p.refundAmount) : original;
          const fee = Math.max(0, original - refAmount);
          refundInfo = {
            refundAmount: refAmount,
            originalPrice: original,
            cancellationFee: fee,
            feePercent: original > 0 ? Math.round((fee / original) * 100) : 0,
            refundMethod: p?.paymentMethod || 'vnpay',
            status: p?.status === PaymentStatus.REFUNDED ? 'SUCCESS' : 'PENDING',
            refundTransactionId: p?.transactionId ? `RF-${p.transactionId}` : null,
            refundTime: p?.refundTime || t.createdAt,
            estimatedArrival: 'Ngay lập tức đến 24 giờ',
          };
        }
        return {
          ticketId: t.id,
          ticketCode: t.ticketCode,
          bookingCode: t.booking?.bookingCode,
          passengerName: t.passengerName,
          seatNumber: t.seat?.seatNumber,
          status: t.status,
          price: t.originalPrice,
          tripId: t.booking?.trip?.id,
          routeName: t.booking?.trip?.route?.name,
          departureTime: t.booking?.trip?.departureTime,
          refundInfo,
          createdAt: t.createdAt,
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAdminTickets(query: AdminTicketsQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const qb = this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoinAndSelect('ticket.booking', 'booking')
      .leftJoinAndSelect('booking.user', 'user')
      .leftJoinAndSelect('booking.trip', 'trip')
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('ticket.seat', 'seat')
      .leftJoinAndSelect('booking.payments', 'payments');

    if (query.status && query.status !== 'all') {
      qb.andWhere('ticket.status = :status', { status: query.status });
    }

    if (query.paymentMethod && query.paymentMethod !== 'all') {
      qb.andWhere('payments.paymentMethod = :method', { method: query.paymentMethod });
    }

    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(ticket.ticketCode) LIKE :s OR LOWER(booking.bookingCode) LIKE :s OR LOWER(ticket.passengerName) LIKE :s OR LOWER(ticket.passengerPhone) LIKE :s OR LOWER(user.email) LIKE :s)',
        { s },
      );
    }

    qb.orderBy('ticket.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [tickets, total] = await qb.getManyAndCount();

    return {
      items: tickets.map((t) => {
        const payment = t.booking?.payments?.[0];
        return {
          id: t.id,
          ticketCode: t.ticketCode,
          bookingCode: t.booking?.bookingCode || 'N/A',
          customerName: t.passengerName || t.booking?.user?.fullName || 'Hành khách',
          phone: t.passengerPhone || t.booking?.user?.phoneNumber || 'N/A',
          email: t.booking?.user?.email || 'N/A',
          route: t.booking?.trip?.route?.name || 'Tuyến xe ICTU',
          seatNumber: t.seat?.seatNumber || 'N/A',
          amount: Number(t.originalPrice || t.booking?.totalAmount || 10000),
          paymentMethod: payment?.paymentMethod || 'vnpay',
          status: t.status,
          createdAt: t.createdAt,
          departureTime: t.booking?.trip?.departureTime,
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTicketDetail(ticketId: string, userId?: string, userRole?: string) {
    const isPrivileged =
      userRole === Role.ADMIN ||
      userRole === Role.MANAGER ||
      userRole === Role.DRIVER;

    const ticket = await this.ticketRepository.findOne({
      where: [{ id: ticketId }, { ticketCode: ticketId }],
      relations: {
        booking: {
          user: true,
          trip: {
            route: true,
            vehicle: true,
          },
          payments: true,
        },
        seat: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy vé xe');
    }

    if (userId && !isPrivileged && ticket.booking.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền truy cập vé này');
    }

    let qrDataUrl = '';
    if (ticket.qrData) {
      qrDataUrl = await generateQrDataUrl(ticket.qrData);
    }

    let refundInfo: any = null;
    if (ticket.status === TicketStatus.CANCELLED || ticket.status === TicketStatus.REFUNDED) {
      let refundLog: any = null;
      if (this.dataSource) {
        try {
          refundLog = await this.dataSource.getRepository(RefundLogEntity).findOne({
            where: [{ ticketId: ticket.id }, { bookingId: ticket.bookingId }],
            order: { createdAt: 'DESC' },
          });
        } catch {
          // Fallback
        }
      }

      const payment = ticket.booking?.payments?.[0];
      const originalPrice = Number(ticket.originalPrice || 10000);

      if (refundLog) {
        const orig = Number(refundLog.originalAmount || originalPrice);
        const fee = Number(refundLog.feeAmount || 0);
        refundInfo = {
          refundAmount: Number(refundLog.refundAmount),
          originalPrice: orig,
          cancellationFee: fee,
          feePercent: orig > 0 ? Math.round((fee / orig) * 100) : 0,
          refundMethod: refundLog.gateway || payment?.paymentMethod || 'vnpay',
          status: refundLog.status || 'SUCCESS',
          refundTransactionId: refundLog.refundTransactionId || (payment?.transactionId ? `RF-${payment.transactionId}` : null),
          refundTime: refundLog.createdAt,
          estimatedArrival: refundLog.gateway === 'bank_transfer' ? '1 - 3 ngày làm việc' : 'Ngay lập tức đến 24 giờ',
          reason: refundLog.reason,
        };
      } else if (payment && (payment.status === PaymentStatus.REFUNDED || payment.refundAmount != null)) {
        const refAmount = Number(payment.refundAmount != null ? payment.refundAmount : originalPrice);
        const fee = Math.max(0, originalPrice - refAmount);
        refundInfo = {
          refundAmount: refAmount,
          originalPrice,
          cancellationFee: fee,
          feePercent: originalPrice > 0 ? Math.round((fee / originalPrice) * 100) : 0,
          refundMethod: payment.paymentMethod || 'vnpay',
          status: payment.status === PaymentStatus.REFUNDED ? 'SUCCESS' : 'PENDING',
          refundTransactionId: payment.transactionId ? `RF-${payment.transactionId}` : null,
          refundTime: payment.refundTime || ticket.createdAt || new Date(),
          estimatedArrival: 'Ngay lập tức đến 24 giờ',
          reason: payment.refundReason || 'Hoàn tiền theo chính sách',
        };
      }
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
      tripId: ticket.booking?.trip?.id,
      routeName: ticket.booking?.trip?.route?.name,
      origin: ticket.booking?.trip?.route?.origin,
      destination: ticket.booking?.trip?.route?.destination,
      departureTime: ticket.booking?.trip?.departureTime,
      vehiclePlate: ticket.booking?.trip?.vehicle?.licensePlate,
      qrData: ticket.qrData,
      qrDataUrl,
      signature: ticket.qrSignatureHash,
      checkedInAt: ticket.checkedInAt,
      checkedInBy: ticket.checkedInBy,
      refundInfo,
      createdAt: ticket.createdAt,
    };
  }

  /**
   * Lấy thông tin hoàn tiền chi tiết của vé (Hành khách hoặc Quản trị viên)
   */
  async getTicketRefundDetail(ticketId: string, userId?: string, userRole?: string) {
    const detail = await this.getTicketDetail(ticketId, userId, userRole);
    if (!detail.refundInfo) {
      const original = Number(detail.price || 10000);
      return {
        ticketId: detail.ticketId,
        ticketCode: detail.ticketCode,
        status: detail.status === TicketStatus.REFUNDED ? 'SUCCESS' : 'PENDING',
        refundAmount: original,
        originalPrice: original,
        cancellationFee: 0,
        feePercent: 0,
        refundMethod: 'vnpay',
        refundTransactionId: `RF-${detail.ticketCode}`,
        refundTime: new Date(),
        estimatedArrival: 'Ngay lập tức đến 24 giờ',
        reason: 'Hủy vé theo chính sách hoàn tiền tự động',
      };
    }
    return detail.refundInfo;
  }

  async getTicketQr(ticketId: string, userId?: string, userRole?: string) {
    const isPrivileged =
      userRole === Role.ADMIN ||
      userRole === Role.MANAGER ||
      userRole === Role.DRIVER;

    const ticket = await this.ticketRepository.findOne({
      where: [{ id: ticketId }, { ticketCode: ticketId }],
      relations: {
        booking: true,
        seat: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy vé xe');
    }

    if (userId && !isPrivileged && ticket.booking.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền truy cập vé này');
    }

    let qrData = ticket.qrData;
    let signature = ticket.qrSignatureHash;
    if (!qrData) {
      const qrSecret = process.env.QR_HMAC_SECRET || 'smart-bus-qr-signature-secret-key-2026';
      const signed = signQrPayload(
        {
          ticketCode: ticket.ticketCode,
          bookingCode: ticket.booking?.bookingCode,
          tripId: ticket.booking?.tripId,
          seatNumber: ticket.seat?.seatNumber || '',
          passengerName: ticket.passengerName,
          issuedAt: ticket.createdAt?.getTime() || Date.now(),
        },
        qrSecret,
      );
      qrData = signed.qrData;
      signature = signed.signature;
      ticket.qrData = qrData;
      ticket.qrSignatureHash = signature;
      await this.ticketRepository.save(ticket);
    }

    const qrDataUrl = await generateQrDataUrl(qrData);

    return {
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      bookingCode: ticket.booking?.bookingCode,
      passengerName: ticket.passengerName,
      seatNumber: ticket.seat?.seatNumber,
      status: ticket.status,
      qrData,
      qrDataUrl,
      signature,
      issuedAt: ticket.createdAt,
    };
  }

  async resendTicketEmail(ticketId: string, userId?: string, customEmail?: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketId);
    let ticket: TicketEntity | null = null;
    const relations = {
      booking: {
        user: true,
        trip: { route: true, vehicle: true },
      },
      seat: true,
    };

    if (isUuid) {
      ticket = await this.ticketRepository.findOne({
        where: [{ id: ticketId }, { ticketCode: ticketId }],
        relations,
      });
    } else {
      ticket = await this.ticketRepository.findOne({
        where: [{ ticketCode: ticketId }],
        relations,
      });
      if (!ticket) {
        try {
          ticket = await this.ticketRepository.findOne({
            where: [{ id: ticketId }],
            relations,
          });
        } catch {
          // Bỏ qua lỗi cú pháp UUID trong PostgreSQL
        }
      }
    }

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy vé xe');
    }


    if (userId && ticket.booking?.userId && ticket.booking.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên vé này');
    }

    const recipientEmail = customEmail?.trim() || ticket.booking?.user?.email;
    if (!recipientEmail) {
      throw new BadRequestException('Không tìm thấy địa chỉ email để gửi vé');
    }

    let qrDataUrl = '';
    if (ticket.qrData) {
      qrDataUrl = await generateQrDataUrl(ticket.qrData);
    }

    if (this.notificationService) {
      await this.notificationService.sendTicketConfirmationEmail({
        recipientEmail,
        passengerName: ticket.passengerName || ticket.booking?.user?.fullName,
        bookingCode: ticket.booking?.bookingCode,
        ticketCode: ticket.ticketCode,
        routeName: ticket.booking?.trip?.route?.name || 'Tuyến xe buýt thông minh ICTU',
        origin: ticket.booking?.trip?.route?.origin,
        destination: ticket.booking?.trip?.route?.destination,
        departureTime: ticket.booking?.trip?.departureTime || new Date(),
        seatNumber: ticket.seat?.seatNumber || 'Ghế tiêu chuẩn',
        vehiclePlate: ticket.booking?.trip?.vehicle?.licensePlate,
        price: ticket.originalPrice,
        qrDataUrl,
      });
    }

    return {
      success: true,
      message: `Đã gửi lại vé điện tử thành công tới email ${recipientEmail}`,
      recipientEmail,
    };
  }

  /**
   * Gửi lại email vé điện tử công khai theo Mã vé hoặc Mã đơn đặt vé (Khách vãng lai / Không bắt buộc JWT)
   */
  async resendTicketEmailByCode(code?: string, customEmail?: string) {
    if (!code || !code.trim()) {
      throw new BadRequestException('Vui lòng cung cấp mã vé hoặc mã đơn đặt vé');
    }

    const cleanCode = code.trim();
    const isCodeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanCode);

    // 1. Tìm theo ticketCode hoặc ticketId
    const ticketRelations = {
      booking: {
        user: true,
        trip: { route: true, vehicle: true },
      },
      seat: true,
    };

    let ticket = await this.ticketRepository.findOne({
      where: isCodeUuid ? [{ ticketCode: cleanCode }, { id: cleanCode }] : [{ ticketCode: cleanCode }],
      relations: ticketRelations,
    });

    if (!ticket && !isCodeUuid) {
      try {
        ticket = await this.ticketRepository.findOne({
          where: [{ id: cleanCode }],
          relations: ticketRelations,
        });
      } catch {
        // Bỏ qua lỗi cú pháp UUID trong PostgreSQL
      }
    }

    // 2. Nếu không tìm thấy theo mã vé, thử tìm theo mã đơn đặt vé (bookingCode)
    if (!ticket) {
      const bookingRelations = {
        user: true,
        trip: { route: true, vehicle: true },
        tickets: { seat: true },
      };

      let booking = await this.bookingRepository.findOne({
        where: isCodeUuid ? [{ bookingCode: cleanCode }, { id: cleanCode }] : [{ bookingCode: cleanCode }],
        relations: bookingRelations,
      });

      if (!booking && !isCodeUuid) {
        try {
          booking = await this.bookingRepository.findOne({
            where: [{ id: cleanCode }],
            relations: bookingRelations,
          });
        } catch {
          // Bỏ qua lỗi cú pháp UUID trong PostgreSQL
        }
      }


      if (!booking) {
        throw new NotFoundException(`Không tìm thấy vé hoặc đơn đặt vé với mã: ${cleanCode}`);
      }

      if (!booking.tickets || booking.tickets.length === 0) {
        throw new NotFoundException(`Đơn đặt ${cleanCode} không chứa vé nào khả dụng`);
      }

      ticket = booking.tickets[0];
      ticket.booking = booking;
    }

    const recipientEmail = customEmail?.trim() || ticket.booking?.user?.email;
    if (!recipientEmail) {
      throw new BadRequestException('Không tìm thấy địa chỉ email để gửi vé. Vui lòng nhập email nhận vé.');
    }

    let qrDataUrl = '';
    if (ticket.qrData) {
      qrDataUrl = await generateQrDataUrl(ticket.qrData);
    }

    if (this.notificationService) {
      await this.notificationService.sendTicketConfirmationEmail({
        recipientEmail,
        passengerName: ticket.passengerName || ticket.booking?.user?.fullName,
        bookingCode: ticket.booking?.bookingCode,
        ticketCode: ticket.ticketCode,
        routeName: ticket.booking?.trip?.route?.name || 'Tuyến xe buýt thông minh ICTU',
        origin: ticket.booking?.trip?.route?.origin,
        destination: ticket.booking?.trip?.route?.destination,
        departureTime: ticket.booking?.trip?.departureTime || new Date(),
        seatNumber: ticket.seat?.seatNumber || 'Ghế tiêu chuẩn',
        vehiclePlate: ticket.booking?.trip?.vehicle?.licensePlate,
        price: ticket.originalPrice,
        qrDataUrl,
      });
    }

    return {
      success: true,
      message: `Đã gửi lại vé điện tử thành công tới email ${recipientEmail}`,
      recipientEmail,
      ticketCode: ticket.ticketCode,
      bookingCode: ticket.booking?.bookingCode,
    };
  }

  /**
   * Tính toán điều kiện hủy/đổi vé theo thời gian thực
   * Hỗ trợ Hủy vé Linh hoạt ICTU Transit: Cho phép hủy bất cứ lúc nào trước giờ xe chạy (hoặc chưa soát vé lên xe), hoàn 100% tiền và giải phóng ghế lập tức
   */
  calculateCancellationAndExchangePolicy(ticket: TicketEntity, trip: TripEntity) {
    const departureTime = new Date(trip.departureTime).getTime();
    const now = Date.now();
    const diffHours = (departureTime - now) / (1000 * 60 * 60);
    const originalPrice = Number(ticket.originalPrice) || 0;

    const policyRules = [
      { condition: 'Trước giờ khởi hành >= 24h', cancellationFeePercent: 0, refundPercent: 100, exchangeFeePercent: 0 },
      { condition: 'Trước giờ khởi hành từ 12h đến 24h', cancellationFeePercent: 10, refundPercent: 90, exchangeFeePercent: 5 },
      { condition: 'Trước giờ khởi hành từ 2h đến 12h', cancellationFeePercent: 20, refundPercent: 80, exchangeFeePercent: 10 },
      { condition: 'Trước giờ khởi hành < 2h hoặc đã chạy', canCancel: false, canExchange: false, refundPercent: 0 },
    ];

    if (ticket.status === TicketStatus.CANCELLED) {
      return {
        canCancel: false,
        canExchange: false,
        hoursUntilDeparture: Math.max(0, Number(diffHours.toFixed(1))),
        originalPrice,
        cancellationFeePercent: 0,
        cancellationFeeAmount: 0,
        refundAmount: 0,
        exchangeFeePercent: 0,
        exchangeFeeAmount: 0,
        reason: 'Vé đã ở trạng thái đã hủy (CANCELLED)',
        policyRules,
      };
    }

    if (ticket.status === TicketStatus.CHECKED_IN) {
      return {
        canCancel: false,
        canExchange: false,
        hoursUntilDeparture: Math.max(0, Number(diffHours.toFixed(1))),
        originalPrice,
        cancellationFeePercent: 0,
        cancellationFeeAmount: 0,
        refundAmount: 0,
        exchangeFeePercent: 0,
        exchangeFeeAmount: 0,
        reason: 'Vé đã được soát lên xe (CHECKED_IN), không thể hủy hoặc đổi chuyến',
        policyRules,
      };
    }

    if (ticket.status === TicketStatus.EXPIRED) {
      return {
        canCancel: false,
        canExchange: false,
        hoursUntilDeparture: Math.max(0, Number(diffHours.toFixed(1))),
        originalPrice,
        cancellationFeePercent: 0,
        cancellationFeeAmount: 0,
        refundAmount: 0,
        exchangeFeePercent: 0,
        exchangeFeeAmount: 0,
        reason: 'Vé đã hết hạn sử dụng',
        policyRules,
      };
    }

    if (trip?.status === TripStatus.COMPLETED) {
      return {
        canCancel: false,
        canExchange: false,
        hoursUntilDeparture: 0,
        originalPrice,
        cancellationFeePercent: 0,
        cancellationFeeAmount: 0,
        refundAmount: 0,
        exchangeFeePercent: 0,
        exchangeFeeAmount: 0,
        reason: 'Chuyến xe đã hoàn thành hành trình, không thể hủy vé',
        policyRules,
      };
    }

    if (diffHours < 2) {
      return {
        canCancel: false,
        canExchange: false,
        hoursUntilDeparture: Math.max(0, Number(diffHours.toFixed(1))),
        originalPrice,
        cancellationFeePercent: 100,
        cancellationFeeAmount: originalPrice,
        refundAmount: 0,
        exchangeFeePercent: 100,
        exchangeFeeAmount: originalPrice,
        reason: 'Chỉ được hủy hoặc đổi vé trước giờ khởi hành tối thiểu 2 tiếng theo quy định',
        policyRules,
      };
    }

    let cancellationFeePercent = 0;
    let exchangeFeePercent = 0;

    if (diffHours >= 24) {
      cancellationFeePercent = 0;
      exchangeFeePercent = 0;
    } else if (diffHours >= 12) {
      cancellationFeePercent = 10;
      exchangeFeePercent = 5;
    } else {
      cancellationFeePercent = 20;
      exchangeFeePercent = 10;
    }

    const cancellationFeeAmount = Math.round((originalPrice * cancellationFeePercent) / 100);
    const refundAmount = originalPrice - cancellationFeeAmount;
    const exchangeFeeAmount = Math.round((originalPrice * exchangeFeePercent) / 100);

    return {
      canCancel: true,
      canExchange: true,
      hoursUntilDeparture: Math.max(0, Number(diffHours.toFixed(1))),
      originalPrice,
      cancellationFeePercent,
      cancellationFeeAmount,
      refundAmount,
      exchangeFeePercent,
      exchangeFeeAmount,
      policyRules,
    };
  }

  /**
   * API Kiểm tra điều kiện và tính phí hủy/đổi vé theo thời gian
   */
  async getCancellationPolicy(ticketId: string, userId?: string, userRole?: string) {
    const ticket = await this.ticketRepository.findOne({
      where: [{ id: ticketId }, { ticketCode: ticketId }],
      relations: {
        booking: {
          trip: { route: true, vehicle: true },
          user: true,
        },
        seat: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy vé xe trong hệ thống');
    }

    const isAdminOrStaff =
      userRole === Role.ADMIN ||
      userRole === Role.MANAGER ||
      userRole === 'admin' ||
      userRole === 'manager';

    if (userId && ticket.booking.userId !== userId && !isAdminOrStaff) {
      throw new ForbiddenException('Bạn không có quyền xem thông tin vé này');
    }

    const policy = this.calculateCancellationAndExchangePolicy(ticket, ticket.booking.trip);
    return {
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      passengerName: ticket.passengerName,
      seatNumber: ticket.seat?.seatNumber,
      departureTime: ticket.booking.trip?.departureTime,
      ticketStatus: ticket.status,
      ...policy,
    };
  }

  /**
   * API Hủy vé: Cập nhật trạng thái vé, giải phóng ghế trống lập tức và tự động hoàn tiền
   * Tích hợp Idempotency Key và Khóa bi quan (Pessimistic Lock / Concurrency Control) ngăn chặn race condition & hoàn tiền kép
   */
  async cancelTicket(
    ticketId: string,
    userId: string,
    dto?: CancelTicketDto,
    userRole?: string,
  ) {
    // 1. Kiểm tra Idempotency Key: Nếu request trùng lặp đã xử lý thành công, trả về kết quả đã lưu ngay lập tức
    if (dto?.idempotencyKey && this.idempotencyRecords.has(dto.idempotencyKey)) {
      return this.idempotencyRecords.get(dto.idempotencyKey)!.result;
    }

    // 2. Concurrency Lock: Ngăn chặn 2 request hủy cùng một vé gửi đến đồng thời (Pessimistic Lock)
    if (this.activeTicketLocks.has(ticketId)) {
      throw new ConflictException(
        'Yêu cầu hủy vé này đang được xử lý đồng thời. Vui lòng không gửi yêu cầu trùng lặp.',
      );
    }
    this.activeTicketLocks.add(ticketId);

    try {
      const ticket = await this.ticketRepository.findOne({
        where: [{ id: ticketId }, { ticketCode: ticketId }],
        relations: {
          booking: {
            trip: { route: true },
            user: true,
            payments: true,
          },
          seat: true,
        },
      });

      if (!ticket) {
        throw new NotFoundException('Không tìm thấy vé xe');
      }

      const isAdminOrStaff =
        userRole === Role.ADMIN ||
        userRole === Role.MANAGER ||
        userRole === 'admin' ||
        userRole === 'manager';

      if (ticket.booking.userId !== userId && !isAdminOrStaff) {
        throw new ForbiddenException('Bạn không có quyền hủy vé này');
      }

      // 3. Ngăn chặn hủy vé đã bị hủy hoặc đã hoàn tiền trước đó
      if (ticket.status === TicketStatus.CANCELLED || ticket.status === TicketStatus.REFUNDED) {
        throw new BadRequestException('Vé này đã bị hủy hoặc hoàn tiền trước đó');
      }

      // 4. Ngăn chặn hủy vé khi hành khách đã được soát lên xe (CHECKED_IN)
      if (ticket.status === TicketStatus.CHECKED_IN) {
        throw new BadRequestException('Vé đã được soát lên xe (CHECKED_IN), không thể hủy hoặc yêu cầu hoàn tiền!');
      }

      const policy = this.calculateCancellationAndExchangePolicy(ticket, ticket.booking.trip);
      if (!policy.canCancel) {
        throw new BadRequestException(policy.reason || 'Vé không đủ điều kiện để hủy');
      }

      const previousStatus = ticket.status;
      ticket.status = TicketStatus.CANCELLED;
      await this.ticketRepository.save(ticket);

      // 4. Giải phóng ghế trống lập tức trong CSDL và in-memory
      if (this.seatHoldRepository) {
        await this.seatHoldRepository.update(
          { tripId: ticket.booking.tripId, seatId: ticket.seatId },
          { status: 'released' },
        );
      }
      if (this.seatLockService) {
        await this.seatLockService.releaseSeats(ticket.booking.tripId, [ticket.seatId]);
      }

      // 5. Tự động xử lý quy trình hoàn tiền qua cổng thanh toán (chống hoàn tiền gấp đôi tuyệt đối)
      let refundProcessed = false;
      let refundTxnId: string | null = null;
      let gatewayResult: any = null;
      if (previousStatus === TicketStatus.PAID) {
        const payment =
          ticket.booking.payments?.[0] ||
          (this.paymentRepository ? await this.paymentRepository.findOne({ where: { bookingId: ticket.bookingId } }) : null);

        if (payment && payment.status !== PaymentStatus.REFUNDED) {
          if (policy.refundAmount > 0) {
            if (this.paymentService) {
              gatewayResult = await this.paymentService.processRefund({
                ticket,
                booking: ticket.booking,
                payment,
                refundAmount: policy.refundAmount,
                originalAmount: policy.originalPrice,
                feeAmount: policy.cancellationFeeAmount,
                reason: dto?.reason || 'Hành khách hủy vé theo quy định',
                triggeredBy: 'passenger_cancellation',
              });
              refundTxnId = gatewayResult?.refundTransactionId || null;
              refundProcessed = true;
            } else {
              payment.status = PaymentStatus.REFUNDED;
              payment.refundTime = new Date();
              payment.refundAmount = policy.refundAmount;
              payment.refundReason = dto?.reason || 'Hành khách hủy vé theo quy định';
              if (this.paymentRepository) {
                await this.paymentRepository.save(payment);
              }
              refundProcessed = true;
            }
          }
        }
      }

      // 6. Nếu toàn bộ vé trong đơn đặt đều đã bị hủy -> cập nhật booking sang CANCELLED
      const remainingActiveTickets = await this.ticketRepository.count({
        where: {
          bookingId: ticket.bookingId,
          status: In([TicketStatus.RESERVED, TicketStatus.PAID, TicketStatus.CHECKED_IN]),
        },
      });
      if (remainingActiveTickets === 0) {
        ticket.booking.status = BookingStatus.CANCELLED;
        await this.bookingRepository.save(ticket.booking);
      }

      // 7. Tự động gửi Email xác nhận hủy vé và hoàn tiền cho hành khách
      const recipientEmail =
        ticket.booking.user?.email ||
        ticket.booking.payments?.[0]?.paymentDetails?.invoiceEmail;

      if (this.notificationService && recipientEmail) {
        await this.notificationService.sendTicketCancellationEmail({
          recipientEmail,
          passengerName: ticket.passengerName || ticket.booking.user?.fullName,
          bookingCode: ticket.booking.bookingCode,
          ticketCode: ticket.ticketCode,
          routeName: ticket.booking.trip?.route?.name || 'Tuyến xe buýt thông minh',
          originalPrice: policy.originalPrice,
          cancellationFee: policy.cancellationFeeAmount,
          refundAmount: policy.refundAmount,
          cancelledAt: new Date(),
        });
      }

      const result = {
        success: true,
        message: `Hủy vé ${ticket.ticketCode} thành công. ${policy.refundAmount > 0 ? `Số tiền hoàn lại là ${policy.refundAmount.toLocaleString('vi-VN')} VND.` : 'Vé không được hoàn tiền theo chính sách.'}`,
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        status: TicketStatus.CANCELLED,
        refundStatus: policy.refundAmount > 0 ? 'REFUNDED' : 'NO_REFUND',
        originalPrice: policy.originalPrice,
        cancellationFee: policy.cancellationFeeAmount,
        refundAmount: policy.refundAmount,
        refundProcessed,
        refundTransactionId: refundTxnId,
        seatReleased: true,
      };

      if (dto?.idempotencyKey) {
        this.idempotencyRecords.set(dto.idempotencyKey, {
          result,
          createdAt: Date.now(),
        });
      }

      return result;
    } finally {
      this.activeTicketLocks.delete(ticketId);
    }
  }


  /**
   * API Tìm kiếm chuyến mới cho luồng đổi chuyến
   */
  async getExchangeTrips(ticketId: string, userId: string, dateStr?: string) {
    const ticket = await this.ticketRepository.findOne({
      where: [{ id: ticketId }, { ticketCode: ticketId }],
      relations: {
        booking: {
          trip: { route: true, vehicle: true },
        },
        seat: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy vé xe');
    }

    if (ticket.booking.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên vé này');
    }

    const policy = this.calculateCancellationAndExchangePolicy(ticket, ticket.booking.trip);
    if (!policy.canExchange) {
      throw new BadRequestException(policy.reason || 'Vé không đủ điều kiện để đổi chuyến');
    }

    const currentTrip = ticket.booking.trip;
    let queryDate = dateStr?.trim();
    if (!queryDate) {
      queryDate = new Date(currentTrip.departureTime).toISOString().split('T')[0];
    }

    const startOfDay = new Date(`${queryDate}T00:00:00`);
    const endOfDay = new Date(`${queryDate}T23:59:59.999`);
    const now = new Date();

    const trips = await this.tripRepository
      .createQueryBuilder('trip')
      .innerJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .where('trip.routeId = :routeId', { routeId: currentTrip.routeId })
      .andWhere('trip.id != :currentTripId', { currentTripId: currentTrip.id })
      .andWhere('trip.departureTime BETWEEN :start AND :end', { start: startOfDay, end: endOfDay })
      .andWhere('trip.departureTime > :now', { now })
      .andWhere('trip.status != :cancelled', { cancelled: TripStatus.CANCELLED })
      .orderBy('trip.departureTime', 'ASC')
      .getMany();

    const result = [];
    for (const trip of trips) {
      const seatCapacity = trip.vehicle?.seatCapacity || 40;
      const bookedCount = await this.ticketRepository
        .createQueryBuilder('ticket')
        .innerJoin('ticket.booking', 'booking')
        .where('booking.tripId = :tripId', { tripId: trip.id })
        .andWhere('ticket.status NOT IN (:...excluded)', {
          excluded: [TicketStatus.CANCELLED, TicketStatus.EXPIRED],
        })
        .getCount();

      let holdCount = 0;
      if (this.seatHoldRepository) {
        holdCount = await this.seatHoldRepository.count({
          where: {
            tripId: trip.id,
            status: 'holding',
            expiresAt: MoreThan(now),
          },
        });
      }

      const availableSeats = Math.max(0, seatCapacity - bookedCount - holdCount);
      const newTripPrice = Number(trip.route?.basePrice) || policy.originalPrice;
      const priceDifference = (newTripPrice + policy.exchangeFeeAmount) - policy.originalPrice;

      result.push({
        tripId: trip.id,
        routeCode: trip.route?.routeCode,
        routeName: trip.route?.name,
        origin: trip.route?.origin,
        destination: trip.route?.destination,
        departureTime: trip.departureTime,
        vehiclePlate: trip.vehicle?.licensePlate,
        availableSeats,
        tripPrice: newTripPrice,
        exchangeFee: policy.exchangeFeeAmount,
        estimatedDifference: priceDifference,
      });
    }

    return {
      currentTicket: {
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        seatNumber: ticket.seat?.seatNumber,
        currentDepartureTime: currentTrip.departureTime,
        originalPrice: policy.originalPrice,
      },
      availableTrips: result,
    };
  }

  /**
   * API Tạm giữ chỗ 10 phút trên chuyến mới cho luồng đổi vé (bảo toàn ghế cũ)
   */
  async holdExchangeSeat(ticketId: string, dto: HoldExchangeSeatDto, userId: string) {
    const ticket = await this.ticketRepository.findOne({
      where: [{ id: ticketId }, { ticketCode: ticketId }],
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
      throw new ForbiddenException('Bạn không có quyền thao tác trên vé này');
    }

    const policy = this.calculateCancellationAndExchangePolicy(ticket, ticket.booking.trip);
    if (!policy.canExchange) {
      throw new BadRequestException(policy.reason || 'Vé không đủ điều kiện để đổi chuyến');
    }

    const newTrip = await this.tripRepository.findOne({ where: { id: dto.newTripId } });
    if (!newTrip) {
      throw new NotFoundException('Không tìm thấy chuyến xe mới');
    }

    const newSeat = await this.seatRepository.findOne({ where: { id: dto.newSeatId } });
    if (!newSeat) {
      throw new NotFoundException('Không tìm thấy ghế mới');
    }

    // 1. Kiểm tra ghế mới đã được đặt chưa
    const existingTicket = await this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoin('ticket.booking', 'booking')
      .where('booking.tripId = :tripId', { tripId: dto.newTripId })
      .andWhere('ticket.seatId = :seatId', { seatId: dto.newSeatId })
      .andWhere('ticket.status NOT IN (:...excluded)', {
        excluded: [TicketStatus.CANCELLED, TicketStatus.EXPIRED],
      })
      .getOne();

    if (existingTicket) {
      throw new ConflictException('Ghế này trên chuyến mới đã có người đặt');
    }

    // 2. Kiểm tra ghế mới có ai khác đang giữ chỗ không
    const now = new Date();
    if (this.seatHoldRepository) {
      const activeHold = await this.seatHoldRepository
        .createQueryBuilder('hold')
        .where('hold.tripId = :tripId', { tripId: dto.newTripId })
        .andWhere('hold.seatId = :seatId', { seatId: dto.newSeatId })
        .andWhere('hold.status = :status', { status: 'holding' })
        .andWhere('hold.expiresAt > :now', { now })
        .getOne();

      if (activeHold && activeHold.userId !== userId) {
        throw new ConflictException('Ghế này đang được một hành khách khác tạm giữ');
      }
    }

    // 3. Tạo giữ chỗ 10 phút trên chuyến mới (ghế cũ của vé vẫn giữ nguyên)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const holdToken = `hold-ex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (this.seatHoldRepository) {
      const hold = this.seatHoldRepository.create({
        tripId: dto.newTripId,
        seatId: dto.newSeatId,
        userId,
        holdToken,
        status: 'holding',
        expiresAt,
      });
      await this.seatHoldRepository.save(hold);
    }

    if (this.seatLockService) {
      await this.seatLockService.holdSeats(dto.newTripId, [dto.newSeatId], userId, 600);
    }

    return {
      success: true,
      message: 'Đã tạm giữ chỗ trên chuyến mới thành công trong 10 phút. Ghế cũ của bạn vẫn được bảo toàn.',
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      newTripId: dto.newTripId,
      newSeatId: dto.newSeatId,
      newSeatNumber: newSeat.seatNumber,
      holdExpiresAt: expiresAt,
    };
  }

  /**
   * API Xác nhận đổi chuyến: Tính chênh lệch giá, giải phóng ghế cũ, cấp ghế mới, ký số lại QR và gửi email vé mới
   */
  async confirmExchange(ticketId: string, dto: ConfirmExchangeDto, userId: string) {
    if (dto?.idempotencyKey && this.idempotencyRecords.has(dto.idempotencyKey)) {
      return this.idempotencyRecords.get(dto.idempotencyKey)!.result;
    }

    if (this.activeTicketLocks.has(ticketId)) {
      throw new ConflictException(
        'Yêu cầu đổi vé này đang được xử lý đồng thời. Vui lòng không gửi yêu cầu trùng lặp.',
      );
    }
    this.activeTicketLocks.add(ticketId);

    try {
      const ticket = await this.ticketRepository.findOne({
        where: [{ id: ticketId }, { ticketCode: ticketId }],
        relations: {
          booking: {
            trip: { route: true, vehicle: true },
            user: true,
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

      const policy = this.calculateCancellationAndExchangePolicy(ticket, ticket.booking.trip);
      if (!policy.canExchange) {
        throw new BadRequestException(policy.reason || 'Vé không đủ điều kiện để đổi chuyến');
      }

      const oldTripId = ticket.booking.tripId;
      const oldSeatId = ticket.seatId;
      const oldSeatNumber = ticket.seat?.seatNumber;
      const oldRouteName = ticket.booking.trip?.route?.name;

      const newTrip = await this.tripRepository.findOne({
        where: { id: dto.newTripId },
        relations: { route: true, vehicle: true },
      });
      if (!newTrip) {
        throw new NotFoundException('Không tìm thấy chuyến xe mới');
      }

      const newSeat = await this.seatRepository.findOne({ where: { id: dto.newSeatId } });
      if (!newSeat) {
        throw new NotFoundException('Không tìm thấy ghế mới');
      }

      // Kiểm tra trùng ghế trên chuyến mới
      const existing = await this.ticketRepository
        .createQueryBuilder('ticket')
        .innerJoin('ticket.booking', 'booking')
        .where('booking.tripId = :tripId', { tripId: dto.newTripId })
        .andWhere('ticket.seatId = :seatId', { seatId: dto.newSeatId })
        .andWhere('ticket.id != :ticketId', { ticketId: ticket.id })
        .andWhere('ticket.status NOT IN (:...excluded)', {
          excluded: [TicketStatus.CANCELLED, TicketStatus.EXPIRED],
        })
        .getOne();

      if (existing) {
        throw new ConflictException('Ghế này trên chuyến mới đã có người đặt');
      }

      // Tính toán chênh lệch giá vé và phí đổi vé
      const oldPrice = Number(ticket.originalPrice);
      const newTripPrice = Number(newTrip.route?.basePrice) || oldPrice;
      const exchangeFee = policy.exchangeFeeAmount;
      const totalNewCost = newTripPrice + exchangeFee;
      const priceDifference = totalNewCost - oldPrice;

      // 1. Giải phóng ghế cũ trên chuyến cũ
      if (this.seatHoldRepository) {
        await this.seatHoldRepository.update(
          { tripId: oldTripId, seatId: oldSeatId },
          { status: 'released' },
        );
      }
      if (this.seatLockService) {
        await this.seatLockService.releaseSeats(oldTripId, [oldSeatId]);
      }

      // 2. Chuyển seat hold ghế mới sang 'booked'
      if (this.seatHoldRepository) {
        const activeHold = await this.seatHoldRepository.findOne({
          where: { tripId: dto.newTripId, seatId: dto.newSeatId, status: 'holding' },
        });
        if (activeHold) {
          activeHold.status = 'booked';
          await this.seatHoldRepository.save(activeHold);
        } else {
          const bookedHold = this.seatHoldRepository.create({
            tripId: dto.newTripId,
            seatId: dto.newSeatId,
            userId,
            holdToken: `booked-${Date.now()}`,
            status: 'booked',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          });
          await this.seatHoldRepository.save(bookedHold);
        }
      }

      // 3. Cập nhật TicketEntity sang chuyến mới & ghế mới
      ticket.seatId = newSeat.id;
      ticket.booking.tripId = newTrip.id;
      await this.bookingRepository.save(ticket.booking);

      // 4. Ký số lại mã QR mới
      const qrSecret = process.env.QR_HMAC_SECRET || 'smart-bus-qr-signature-secret-key-2026';
      const { qrData, signature } = signQrPayload(
        {
          ticketCode: ticket.ticketCode,
          bookingCode: ticket.booking.bookingCode,
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

      const qrDataUrl = await generateQrDataUrl(qrData);

      // 5. Tự động gửi Email thông báo đổi vé thành công
      const recipientEmail = ticket.booking.user?.email;
      if (this.notificationService && recipientEmail) {
        await this.notificationService.sendTicketExchangeEmail({
          recipientEmail,
          passengerName: ticket.passengerName || ticket.booking.user?.fullName,
          ticketCode: ticket.ticketCode,
          bookingCode: ticket.booking.bookingCode,
          oldRouteName,
          newRouteName: newTrip.route?.name || 'Tuyến xe buýt ICTU',
          newOrigin: newTrip.route?.origin,
          newDestination: newTrip.route?.destination,
          newDepartureTime: newTrip.departureTime,
          newSeatNumber: newSeat.seatNumber,
          newVehiclePlate: newTrip.vehicle?.licensePlate,
          exchangeFee,
          priceDifference,
          qrDataUrl,
        });
      }

      const result = {
        success: true,
        message: 'Đổi vé sang chuyến mới thành công!',
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        oldSeatNumber,
        newTripId: newTrip.id,
        newSeatNumber: newSeat.seatNumber,
        newDepartureTime: newTrip.departureTime,
        exchangeFee,
        priceDifference,
        qrData,
        qrDataUrl,
      };

      if (dto?.idempotencyKey) {
        this.idempotencyRecords.set(dto.idempotencyKey, {
          result,
          createdAt: Date.now(),
        });
      }

      return result;
    } finally {
      this.activeTicketLocks.delete(ticketId);
    }
  }


  async exchangeTicket(ticketId: string, dto: ExchangeTicketDto, userId: string) {
    return this.confirmExchange(ticketId, dto, userId);
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
