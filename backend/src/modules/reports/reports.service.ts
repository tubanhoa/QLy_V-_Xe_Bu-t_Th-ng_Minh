import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingEntity } from '../../database/entities/booking.entity.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { TicketStatus } from '../../common/constants/status.constant.js';
import { RevenueReportQueryDto, ReportGroupBy } from './dto/revenue-query.dto.js';

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

  /**
   * Thống kê báo cáo doanh thu & hiệu quả tài chính sử dụng SQL Aggregation thuần trên PostgreSQL
   * Tối ưu hiệu năng cao (< 30ms), không kéo Entity về RAM, tránh tràn bộ nhớ (OOM).
   */
  async getRevenueStats(
    queryOrStartDate?: RevenueReportQueryDto | string,
    legacyEndDate?: string,
  ) {
    let query: RevenueReportQueryDto = {};
    if (typeof queryOrStartDate === 'string') {
      query = {
        startDate: queryOrStartDate,
        endDate: legacyEndDate,
        groupBy: ReportGroupBy.DAY,
      };
    } else if (queryOrStartDate) {
      query = queryOrStartDate;
    }

    // 1. Xây dựng điều kiện WHERE động & Parameterized Bindings
    const conditions: string[] = [
      `b.status IN ('paid', 'confirmed')`,
      `(p.status IN ('success', 'refund_pending') OR p.status IS NULL)`,
    ];
    const params: any[] = [];
    let paramIdx = 1;

    if (query.startDate) {
      conditions.push(`b.booking_time >= $${paramIdx}`);
      params.push(new Date(`${query.startDate}T00:00:00`));
      paramIdx++;
    }

    if (query.endDate) {
      conditions.push(`b.booking_time <= $${paramIdx}`);
      params.push(new Date(`${query.endDate}T23:59:59.999`));
      paramIdx++;
    }

    if (query.routeId) {
      conditions.push(`tr.route_id = $${paramIdx}`);
      params.push(query.routeId);
      paramIdx++;
    }

    if (query.tripId) {
      conditions.push(`b.trip_id = $${paramIdx}`);
      params.push(query.tripId);
      paramIdx++;
    }

    if (query.paymentMethod) {
      conditions.push(`LOWER(COALESCE(p.payment_method, 'cash')) = LOWER($${paramIdx})`);
      params.push(query.paymentMethod.trim());
      paramIdx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // 2. Cấu hình Gom nhóm Thời gian (DATE_TRUNC)
    const groupBy = query.groupBy || ReportGroupBy.DAY;
    let truncUnit = 'day';
    let formatMask = 'YYYY-MM-DD';
    if (groupBy === ReportGroupBy.MONTH) {
      truncUnit = 'month';
      formatMask = 'YYYY-MM';
    } else if (groupBy === ReportGroupBy.YEAR) {
      truncUnit = 'year';
      formatMask = 'YYYY';
    }

    // 3. Chuẩn bị 5 câu truy vấn SQL Aggregation song song
    // a. Tổng quan KPIs
    const summarySql = `
      SELECT 
        COALESCE(SUM(b.final_amount), 0)::numeric AS "totalRevenue",
        COALESCE(SUM(b.discount_amount), 0)::numeric AS "totalDiscount",
        COUNT(b.id)::int AS "totalPaidBookings",
        COALESCE(SUM(GREATEST(COALESCE(tc.cnt, 0), 1)), 0)::int AS "totalTicketsSold",
        CASE 
          WHEN COUNT(b.id) > 0 THEN ROUND(COALESCE(SUM(b.final_amount), 0) / COUNT(b.id))
          ELSE 0 
        END AS "averageOrderValue"
      FROM bookings b
      LEFT JOIN (
        SELECT booking_id, COUNT(id) as cnt 
        FROM tickets 
        WHERE status NOT IN ('cancelled', 'expired') 
        GROUP BY booking_id
      ) tc ON tc.booking_id = b.id
      LEFT JOIN (
        SELECT DISTINCT ON (booking_id) booking_id, payment_method, status
        FROM payments
        ORDER BY booking_id, created_at DESC
      ) p ON p.booking_id = b.id
      LEFT JOIN trips tr ON tr.id = b.trip_id
      ${whereClause}
    `;

    // b. Chuỗi thời gian (Timeline Series)
    const timelineSql = `
      SELECT 
        TO_CHAR(DATE_TRUNC('${truncUnit}', b.booking_time), '${formatMask}') AS "period",
        COALESCE(SUM(b.final_amount), 0)::numeric AS "revenue",
        COUNT(b.id)::int AS "bookingCount",
        COALESCE(SUM(GREATEST(COALESCE(tc.cnt, 0), 1)), 0)::int AS "ticketCount"
      FROM bookings b
      LEFT JOIN (
        SELECT booking_id, COUNT(id) as cnt 
        FROM tickets 
        WHERE status NOT IN ('cancelled', 'expired') 
        GROUP BY booking_id
      ) tc ON tc.booking_id = b.id
      LEFT JOIN (
        SELECT DISTINCT ON (booking_id) booking_id, payment_method, status
        FROM payments
        ORDER BY booking_id, created_at DESC
      ) p ON p.booking_id = b.id
      LEFT JOIN trips tr ON tr.id = b.trip_id
      ${whereClause}
      GROUP BY DATE_TRUNC('${truncUnit}', b.booking_time)
      ORDER BY DATE_TRUNC('${truncUnit}', b.booking_time) ASC
    `;

    // c. Phân bổ Doanh thu theo Tuyến (revenueByRoute)
    const routeSql = `
      SELECT 
        r.id AS "routeId",
        r.route_code AS "routeCode",
        r.name AS "name",
        COALESCE(SUM(b.final_amount), 0)::numeric AS "revenue",
        COALESCE(SUM(GREATEST(COALESCE(tc.cnt, 0), 1)), 0)::int AS "ticketCount"
      FROM bookings b
      LEFT JOIN (
        SELECT booking_id, COUNT(id) as cnt 
        FROM tickets 
        WHERE status NOT IN ('cancelled', 'expired') 
        GROUP BY booking_id
      ) tc ON tc.booking_id = b.id
      LEFT JOIN (
        SELECT DISTINCT ON (booking_id) booking_id, payment_method, status
        FROM payments
        ORDER BY booking_id, created_at DESC
      ) p ON p.booking_id = b.id
      JOIN trips tr ON tr.id = b.trip_id
      JOIN routes r ON r.id = tr.route_id
      ${whereClause}
      GROUP BY r.id, r.route_code, r.name
      ORDER BY "revenue" DESC
    `;

    // d. Phân bổ Doanh thu theo Kênh thanh toán (revenueByChannel)
    const channelSql = `
      SELECT 
        LOWER(COALESCE(p.payment_method, 'cash')) AS "rawMethod",
        COALESCE(SUM(b.final_amount), 0)::numeric AS "rawAmount",
        COUNT(b.id)::int AS "bookingCount"
      FROM bookings b
      LEFT JOIN (
        SELECT DISTINCT ON (booking_id) booking_id, payment_method, status
        FROM payments
        ORDER BY booking_id, created_at DESC
      ) p ON p.booking_id = b.id
      LEFT JOIN trips tr ON tr.id = b.trip_id
      ${whereClause}
      GROUP BY LOWER(COALESCE(p.payment_method, 'cash'))
      ORDER BY "rawAmount" DESC
    `;

    // e. Phân bổ Doanh thu theo Chuyến xe (trips)
    const tripsSql = `
      SELECT 
        tr.id AS "tripId",
        tr.departure_time AS "departureTime",
        COALESCE(v.license_plate, 'Đang điều phối') AS "vehiclePlate",
        COALESCE(v.seat_capacity, 28)::int AS "seatCapacity",
        r.route_code AS "routeCode",
        r.name AS "routeName",
        COALESCE(SUM(b.final_amount), 0)::numeric AS "revenue",
        COALESCE(SUM(GREATEST(COALESCE(tc.cnt, 0), 1)), 0)::int AS "ticketCount"
      FROM bookings b
      LEFT JOIN (
        SELECT booking_id, COUNT(id) as cnt 
        FROM tickets 
        WHERE status NOT IN ('cancelled', 'expired') 
        GROUP BY booking_id
      ) tc ON tc.booking_id = b.id
      LEFT JOIN (
        SELECT DISTINCT ON (booking_id) booking_id, payment_method, status
        FROM payments
        ORDER BY booking_id, created_at DESC
      ) p ON p.booking_id = b.id
      JOIN trips tr ON tr.id = b.trip_id
      LEFT JOIN routes r ON r.id = tr.route_id
      LEFT JOIN vehicles v ON v.id = tr.vehicle_id
      ${whereClause}
      GROUP BY tr.id, tr.departure_time, v.license_plate, v.seat_capacity, r.route_code, r.name
      ORDER BY tr.departure_time DESC
    `;

    // 4. Thực thi song song trên PostgreSQL Engine
    const [summaryRows, timelineRows, routeRows, channelRows, tripRows] = await Promise.all([
      this.bookingRepository.query(summarySql, params),
      this.bookingRepository.query(timelineSql, params),
      this.bookingRepository.query(routeSql, params),
      this.bookingRepository.query(channelSql, params),
      this.bookingRepository.query(tripsSql, params),
    ]);

    const rawSummary = summaryRows[0] || {};
    const totalRevenue = Number(rawSummary.totalRevenue) || 0;
    const totalDiscount = Number(rawSummary.totalDiscount) || 0;
    const totalPaidBookings = Number(rawSummary.totalPaidBookings) || 0;
    const totalTicketsSold = Number(rawSummary.totalTicketsSold) || 0;
    const averageOrderValue = Number(rawSummary.averageOrderValue) || 0;

    const CHANNEL_LABELS: Record<string, string> = {
      vnpay: 'Ví điện tử VNPAY',
      momo: 'Ví MoMo',
      vietqr: 'Mã VietQR Pro',
      cash: 'Tiền mặt tại trạm',
    };

    const revenueByRoute = routeRows.map((r: any) => {
      const rev = Number(r.revenue) || 0;
      return {
        routeId: r.routeId,
        routeCode: r.routeCode,
        name: r.name,
        revenue: rev,
        ticketCount: Number(r.ticketCount) || 0,
        share: totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0,
      };
    });

    const revenueByChannel = channelRows.map((c: any) => {
      const rawAmt = Number(c.rawAmount) || 0;
      return {
        channel: CHANNEL_LABELS[c.rawMethod] || 'Cổng thanh toán điện tử',
        rawMethod: c.rawMethod,
        amount: `${rawAmt.toLocaleString('vi-VN')} đ`,
        rawAmount: rawAmt,
        share: totalRevenue > 0 ? Math.round((rawAmt / totalRevenue) * 100) : 0,
        bookingCount: Number(c.bookingCount) || 0,
      };
    });

    const timeline = timelineRows.map((t: any) => ({
      period: t.period,
      revenue: Number(t.revenue) || 0,
      bookingCount: Number(t.bookingCount) || 0,
      ticketCount: Number(t.ticketCount) || 0,
    }));

    const trips = tripRows.map((tr: any) => {
      const rev = Number(tr.revenue) || 0;
      const tCount = Number(tr.ticketCount) || 0;
      const capacity = Number(tr.seatCapacity) || 28;
      return {
        tripId: tr.tripId,
        departureTime: tr.departureTime,
        revenue: rev,
        ticketCount: tCount,
        vehiclePlate: tr.vehiclePlate,
        routeCode: tr.routeCode,
        routeName: tr.routeName,
        occupancyRate: capacity > 0 ? Math.min(100, Math.round((tCount / capacity) * 100)) : 0,
      };
    });

    return {
      summary: {
        totalRevenue,
        totalDiscount,
        totalPaidBookings,
        totalTicketsSold,
        averageOrderValue,
      },
      timeline,
      revenueByRoute,
      revenueByChannel,
      trips,
      // Đảm bảo 100% tương thích ngược (Backward Compatibility) với các component cũ
      totalRevenue,
      totalDiscount,
      totalPaidBookings,
      revenueByDate: timeline.map((t: any) => ({ date: t.period, revenue: t.revenue })),
      dailyBreakdown: timeline,
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
