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

    const bookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .innerJoinAndSelect('booking.trip', 'trip')
      .innerJoinAndSelect('trip.route', 'route')
      .where('booking.status = :status', { status: BookingStatus.PAID })
      .andWhere('booking.bookingTime BETWEEN :start AND :end', { start, end })
      .getMany();

    let totalRevenue = 0;
    let totalDiscount = 0;
    const revenueByRouteMap = new Map<string, { routeCode: string; name: string; revenue: number; ticketCount: number }>();
    const revenueByDateMap = new Map<string, number>();

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
    }

    return {
      totalRevenue,
      totalDiscount,
      totalPaidBookings: bookings.length,
      revenueByRoute: Array.from(revenueByRouteMap.values()),
      revenueByDate: Array.from(revenueByDateMap.entries()).map(([date, revenue]) => ({
        date,
        revenue,
      })),
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
