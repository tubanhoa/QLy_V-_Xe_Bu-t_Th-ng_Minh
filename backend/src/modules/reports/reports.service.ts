import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingEntity } from '../../database/entities/booking.entity.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { BookingStatus, TicketStatus } from '../../common/constants/status.constant.js';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(BookingEntity)
    private readonly bookingRepository: Repository<BookingEntity>,
    @InjectRepository(TripEntity)
    private readonly tripRepository: Repository<TripEntity>,
    @InjectRepository(TicketEntity)
    private readonly ticketRepository: Repository<TicketEntity>,
  ) {}

  async getRevenueStats(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : new Date(Date.now() - 30 * 86400000);
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : new Date();

    const qb = this.bookingRepository
      .createQueryBuilder('booking')
      .innerJoinAndSelect('booking.trip', 'trip')
      .innerJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('booking.payments', 'payment')
      .where('LOWER(booking.status) IN (:...statuses)', { statuses: ['paid', 'confirmed'] });

    if (startDate || endDate) {
      qb.andWhere('booking.bookingTime BETWEEN :start AND :end', { start, end });
    }

    let bookings = await qb.getMany();

    // Nếu không truyền startDate cụ thể và trong khoảng 30 ngày chưa có thì lấy dữ liệu thực tế gần nhất
    if (bookings.length === 0 && !startDate) {
      bookings = await this.bookingRepository
        .createQueryBuilder('booking')
        .innerJoinAndSelect('booking.trip', 'trip')
        .innerJoinAndSelect('trip.route', 'route')
        .leftJoinAndSelect('booking.payments', 'payment')
        .where('LOWER(booking.status) IN (:...statuses)', { statuses: ['paid', 'confirmed'] })
        .orderBy('booking.bookingTime', 'DESC')
        .take(300)
        .getMany();
    }

    let totalRevenue = 0;
    let totalDiscount = 0;
    const revenueByRouteMap = new Map<string, { routeCode: string; name: string; revenue: number; ticketCount: number }>();
    const revenueByDateMap = new Map<string, number>();
    const revenueByChannelMap = new Map<string, number>();

    const CHANNEL_LABELS: Record<string, string> = {
      vnpay: 'Ví điện tử VNPAY',
      momo: 'Ví MoMo',
      vietqr: 'Mã VietQR Pro',
      cash: 'Tiền mặt tại trạm',
    };

    const dailyBreakdownMap = new Map<
      string,
      {
        date: string;
        revenue: number;
        ticketCount: number;
        routeCT01: number;
        routeCT02: number;
        vnpay: number;
        momo: number;
        vietqr: number;
        cash: number;
      }
    >();

    for (const b of bookings) {
      const amount = Number(b.finalAmount);
      totalRevenue += amount;
      totalDiscount += Number(b.discountAmount);

      const routeCode = b.trip?.route?.routeCode || 'UNKNOWN';
      const routeName = b.trip?.route?.name || 'Chưa xác định';
      const existingRoute = revenueByRouteMap.get(routeCode) || {
        routeCode,
        name: routeName,
        revenue: 0,
        ticketCount: 0,
      };
      existingRoute.revenue += amount;
      existingRoute.ticketCount += 1;
      revenueByRouteMap.set(routeCode, existingRoute);

      const dateStr = new Date(b.bookingTime).toISOString().slice(0, 10);
      revenueByDateMap.set(dateStr, (revenueByDateMap.get(dateStr) || 0) + amount);

      const rawMethod = b.payments?.[0]?.paymentMethod?.toLowerCase() || 'vnpay';
      const channelLabel = CHANNEL_LABELS[rawMethod] || 'Cổng thanh toán điện tử';
      revenueByChannelMap.set(channelLabel, (revenueByChannelMap.get(channelLabel) || 0) + amount);

      // Cập nhật Bảng kê chi tiết theo ngày
      const dayItem = dailyBreakdownMap.get(dateStr) || {
        date: dateStr,
        revenue: 0,
        ticketCount: 0,
        routeCT01: 0,
        routeCT02: 0,
        vnpay: 0,
        momo: 0,
        vietqr: 0,
        cash: 0,
      };
      dayItem.revenue += amount;
      dayItem.ticketCount += 1;
      if (routeCode === 'CT-01') dayItem.routeCT01 += amount;
      else if (routeCode === 'CT-02') dayItem.routeCT02 += amount;

      if (rawMethod === 'vnpay') dayItem.vnpay += amount;
      else if (rawMethod === 'momo') dayItem.momo += amount;
      else if (rawMethod === 'vietqr') dayItem.vietqr += amount;
      else if (rawMethod === 'cash') dayItem.cash += amount;

      dailyBreakdownMap.set(dateStr, dayItem);
    }

    const revenueByChannel = Array.from(revenueByChannelMap.entries()).map(([channel, amount]) => ({
      channel,
      amount: `${amount.toLocaleString('vi-VN')} đ`,
      rawAmount: amount,
      share: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0,
    }));

    const dailyBreakdown = Array.from(dailyBreakdownMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return {
      totalRevenue,
      totalDiscount,
      totalPaidBookings: bookings.length,
      revenueByRoute: Array.from(revenueByRouteMap.values()),
      revenueByDate: Array.from(revenueByDateMap.entries()).map(([date, revenue]) => ({
        date,
        revenue,
      })),
      revenueByChannel,
      dailyBreakdown,
    };
  }

  async getOccupancyRate(date?: string) {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const start = new Date(`${targetDate}T00:00:00`);
    const end = new Date(`${targetDate}T23:59:59.999`);

    const trips = await this.tripRepository
      .createQueryBuilder('trip')
      .innerJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .where('trip.departureTime BETWEEN :start AND :end', { start, end })
      .getMany();

    const stats = await Promise.all(
      trips.map(async (trip) => {
        const capacity = trip.vehicle?.seatCapacity || 28;
        const booked = await this.ticketRepository
          .createQueryBuilder('ticket')
          .innerJoin('ticket.booking', 'booking')
          .where('booking.tripId = :tripId', { tripId: trip.id })
          .andWhere('ticket.status NOT IN (:...excluded)', {
            excluded: [TicketStatus.CANCELLED, TicketStatus.EXPIRED],
          })
          .getCount();

        const rate = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;

        return {
          tripId: trip.id,
          routeName: trip.route?.name,
          departureTime: trip.departureTime,
          capacity,
          booked,
          occupancyPercentage: rate,
        };
      }),
    );

    const totalCapacity = stats.reduce((acc, s) => acc + s.capacity, 0);
    const totalBooked = stats.reduce((acc, s) => acc + s.booked, 0);
    const overallRate = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;

    return {
      date: targetDate,
      overallOccupancyPercentage: overallRate,
      totalTrips: trips.length,
      trips: stats,
    };
  }
}
