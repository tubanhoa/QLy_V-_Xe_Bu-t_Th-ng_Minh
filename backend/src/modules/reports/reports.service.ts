import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingEntity } from '../../database/entities/booking.entity.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { TicketStatus } from '../../common/constants/status.constant.js';
import { RevenueReportQueryDto, ReportGroupBy } from './dto/revenue-query.dto.js';
import { OccupancyReportQueryDto } from './dto/occupancy-query.dto.js';

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

  /**
   * Thống kê tỷ lệ lấp đầy chỗ & phân tích tối ưu tần suất/quy mô xe (SQL Aggregation)
   * Thay thế hoàn toàn cơ chế N+1 query lặp qua getMany() và getCount(),
   * tính toán trực tiếp trên PostgreSQL engine với thời gian thực thi cực nhanh.
   */
  async getOccupancyRate(queryOrDate?: OccupancyReportQueryDto | string) {
    let query: OccupancyReportQueryDto = {};
    if (typeof queryOrDate === 'string') {
      query = { date: queryOrDate };
    } else if (queryOrDate) {
      query = queryOrDate;
    }

    // 1. Xác định khoảng thời gian start - end
    let startStr: string;
    let endStr: string;
    let displayDate: string;

    if (query.startDate && query.endDate) {
      startStr = `${query.startDate} 00:00:00`;
      endStr = `${query.endDate} 23:59:59.999`;
      displayDate = `${query.startDate} ~ ${query.endDate}`;
    } else if (query.date) {
      startStr = `${query.date} 00:00:00`;
      endStr = `${query.date} 23:59:59.999`;
      displayDate = query.date;
    } else {
      const now = new Date();
      const past30 = new Date(now.getTime() - 30 * 86400000);
      const todayStr = now.toISOString().slice(0, 10);
      const past30Str = past30.toISOString().slice(0, 10);
      startStr = `${past30Str} 00:00:00`;
      endStr = `${todayStr} 23:59:59.999`;
      displayDate = `${past30Str} ~ ${todayStr}`;
    }

    // 2. Xây dựng SQL Aggregation thuần với Parameterized Query an toàn
    const conditions: string[] = [`tr.departure_time >= $1`, `tr.departure_time <= $2`];
    const sqlParams: any[] = [startStr, endStr];

    if (query.routeId) {
      sqlParams.push(query.routeId);
      conditions.push(`tr.route_id = $${sqlParams.length}`);
    }

    if (query.tripId) {
      sqlParams.push(query.tripId);
      conditions.push(`tr.id = $${sqlParams.length}`);
    }

    // Truy vấn tổng hợp tất cả chuyến xe cùng số ghế và số vé đã đặt
    const querySql = `
      SELECT 
        tr.id AS "tripId",
        tr.departure_time AS "departureTime",
        tr.arrival_time AS "arrivalTime",
        tr.status AS "status",
        r.id AS "routeId",
        r.route_code AS "routeCode",
        r.name AS "routeName",
        v.id AS "vehicleId",
        COALESCE(v.license_plate, 'Xe dự phòng') AS "vehiclePlate",
        COALESCE(v.seat_capacity, 28) AS "capacity",
        COUNT(DISTINCT tk.id) FILTER (
          WHERE tk.status NOT IN ('cancelled', 'expired', 'refunded')
        ) AS "bookedCount"
      FROM trips tr
      INNER JOIN routes r ON tr.route_id = r.id
      LEFT JOIN vehicles v ON tr.vehicle_id = v.id
      LEFT JOIN bookings b ON b.trip_id = tr.id
      LEFT JOIN tickets tk ON tk.booking_id = b.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY tr.id, r.id, v.id
      ORDER BY tr.departure_time ASC;
    `;

    const rawRows: any[] = await this.tripRepository.query(querySql, sqlParams);

    const processedTrips = rawRows.map((row) => {
      const capacity = Number(row.capacity) > 0 ? Number(row.capacity) : 28;
      const booked = Number(row.bookedCount || 0);
      const rate = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;

      // 4 cấp độ phụ tải theo chuẩn vận tải công cộng
      let statusLevel: 'OVERLOADED' | 'OPTIMAL' | 'LOW' | 'UNDERUTILIZED' = 'OPTIMAL';
      let statusText = 'Tối ưu';
      if (rate >= 85) {
        statusLevel = 'OVERLOADED';
        statusText = 'Quá tải (>85%)';
      } else if (rate >= 50) {
        statusLevel = 'OPTIMAL';
        statusText = 'Tối ưu (50-85%)';
      } else if (rate >= 30) {
        statusLevel = 'LOW';
        statusText = 'Thấp (30-50%)';
      } else {
        statusLevel = 'UNDERUTILIZED';
        statusText = 'Rỗng khách (<30%)';
      }

      return {
        tripId: row.tripId,
        routeName: row.routeName,
        routeCode: row.routeCode,
        routeId: row.routeId,
        departureTime: row.departureTime,
        arrivalTime: row.arrivalTime,
        vehiclePlate: row.vehiclePlate,
        vehicleId: row.vehicleId,
        capacity,
        booked,
        occupancyPercentage: rate,
        rate,
        statusLevel,
        statusText,
      };
    });

    // 3. Phụ tải theo khung giờ (Hourly Density: 06:00 đến 21:00)
    const hourMap = new Map<number, { booked: number; capacity: number; tripCount: number }>();
    for (let h = 6; h <= 21; h++) {
      hourMap.set(h, { booked: 0, capacity: 0, tripCount: 0 });
    }

    // 4. Ma trận Heatmap: Ngày trong tuần (Thứ 2..CN) x Giờ (6..21)
    const heatmapMap = new Map<string, { booked: number; capacity: number; tripCount: number }>();

    // 5. Phân bổ theo Tuyến xe
    const routeMap = new Map<
      string,
      {
        routeId: string;
        routeCode: string;
        routeName: string;
        booked: number;
        capacity: number;
        tripCount: number;
      }
    >();

    for (const t of processedTrips) {
      const depDate = new Date(t.departureTime);
      const localHour = (depDate.getUTCHours() + 7) % 24;
      const dayOfWeek = depDate.getUTCDay(); // 0: Sunday, 1: Monday...

      // Cập nhật hourly
      if (hourMap.has(localHour)) {
        const hData = hourMap.get(localHour)!;
        hData.booked += t.booked;
        hData.capacity += t.capacity;
        hData.tripCount += 1;
      }

      // Cập nhật heatmap
      const heatKey = `${dayOfWeek}_${localHour}`;
      const heatVal = heatmapMap.get(heatKey) || { booked: 0, capacity: 0, tripCount: 0 };
      heatVal.booked += t.booked;
      heatVal.capacity += t.capacity;
      heatVal.tripCount += 1;
      heatmapMap.set(heatKey, heatVal);

      // Cập nhật route
      const rKey = t.routeId || t.routeCode || t.routeName;
      const rVal = routeMap.get(rKey) || {
        routeId: t.routeId,
        routeCode: t.routeCode,
        routeName: t.routeName,
        booked: 0,
        capacity: 0,
        tripCount: 0,
      };
      rVal.booked += t.booked;
      rVal.capacity += t.capacity;
      rVal.tripCount += 1;
      routeMap.set(rKey, rVal);
    }

    const hourlyDensity = Array.from(hourMap.entries()).map(([hour, val]) => {
      const rate = val.capacity > 0 ? Math.round((val.booked / val.capacity) * 100) : 0;
      const isPeak = (hour >= 6 && hour <= 8) || (hour >= 11 && hour <= 12) || (hour >= 16 && hour <= 18);
      return {
        hour,
        label: `${String(hour).padStart(2, '0')}:00 - ${String(hour).padStart(2, '0')}:59`,
        booked: val.booked,
        capacity: val.capacity,
        rate,
        tripCount: val.tripCount,
        isPeak,
      };
    });

    const dayNames: Record<number, string> = {
      1: 'Thứ 2',
      2: 'Thứ 3',
      3: 'Thứ 4',
      4: 'Thứ 5',
      5: 'Thứ 6',
      6: 'Thứ 7',
      0: 'Chủ nhật',
    };

    const heatmapMatrix = [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
      const hours = [];
      for (let h = 6; h <= 21; h++) {
        const val = heatmapMap.get(`${dayOfWeek}_${h}`) || { booked: 0, capacity: 0, tripCount: 0 };
        const rate = val.capacity > 0 ? Math.round((val.booked / val.capacity) * 100) : 0;
        hours.push({
          hour: h,
          booked: val.booked,
          capacity: val.capacity,
          rate,
          tripCount: val.tripCount,
        });
      }
      return {
        dayOfWeek,
        dayName: dayNames[dayOfWeek],
        hours,
      };
    });

    const occupancyByRoute = Array.from(routeMap.values()).map((r) => {
      const rate = r.capacity > 0 ? Math.round((r.booked / r.capacity) * 100) : 0;
      return {
        routeId: r.routeId,
        routeCode: r.routeCode,
        routeName: r.routeName,
        booked: r.booked,
        capacity: r.capacity,
        tripCount: r.tripCount,
        occupancyRate: rate,
      };
    });

    // 6. Đề xuất điều chỉnh tần suất & quy mô xe (Fleet & Frequency Optimization)
    const totalCapacity = processedTrips.reduce((acc, s) => acc + s.capacity, 0);
    const totalBooked = processedTrips.reduce((acc, s) => acc + s.booked, 0);
    const overallRate = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;

    const overloadedTrips = processedTrips.filter((t) => t.rate >= 85);
    const optimalTrips = processedTrips.filter((t) => t.rate >= 50 && t.rate < 85);
    const lowTrips = processedTrips.filter((t) => t.rate >= 30 && t.rate < 50);
    const underutilizedTrips = processedTrips.filter((t) => t.rate < 30);

    const recommendations: Array<{
      type: 'INCREASE_FREQUENCY' | 'DECREASE_FREQUENCY' | 'LARGER_VEHICLE' | 'SMALLER_VEHICLE' | 'NETWORK_HEALTH';
      title: string;
      message: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      targetRoute?: string;
      targetTime?: string;
    }> = [];

    // Phân tích đề xuất quá tải
    if (overloadedTrips.length > 0) {
      const topOverloaded = overloadedTrips[0];
      const depTime = new Date(topOverloaded.departureTime).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      recommendations.push({
        type: 'INCREASE_FREQUENCY',
        title: `Tăng chuyến hoặc nâng quy mô xe tuyến ${topOverloaded.routeCode || topOverloaded.routeName}`,
        message: `Ghi nhận ${overloadedTrips.length} chuyến xe quá tải (>85%). Điển hình lúc ${depTime} đạt ${topOverloaded.rate}% phụ tải. Đề xuất bổ sung chuyến chạy tăng cường hoặc điều phối xe lớn 35-45 chỗ.`,
        priority: 'HIGH',
        targetRoute: topOverloaded.routeCode || topOverloaded.routeName,
        targetTime: depTime,
      });
    }

    // Phân tích đề xuất rỗng khách
    if (underutilizedTrips.length > 0) {
      const sampleEmpty = underutilizedTrips[0];
      const depTime = new Date(sampleEmpty.departureTime).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      recommendations.push({
        type: 'SMALLER_VEHICLE',
        title: `Giãn chuyến hoặc dùng xe Minibus cho chuyến vắng khách`,
        message: `Có ${underutilizedTrips.length} chuyến xe có tỷ lệ lấp đầy dưới 30% (ví dụ chuyến ${sampleEmpty.routeCode || sampleEmpty.routeName} lúc ${depTime} chỉ đạt ${sampleEmpty.rate}%). Đề xuất chuyển sang xe điện nhỏ 16 chỗ hoặc giãn tần suất để tiết kiệm chi phí.`,
        priority: 'MEDIUM',
        targetRoute: sampleEmpty.routeCode || sampleEmpty.routeName,
        targetTime: depTime,
      });
    }

    // Đề xuất toàn mạng
    if (overallRate >= 75) {
      recommendations.push({
        type: 'NETWORK_HEALTH',
        title: 'Mạng lưới đạt ngưỡng phụ tải cao',
        message: `Tỷ lệ lấp đầy bình quân toàn tuyến đạt ${overallRate}%. Hệ thống vận hành năng suất cao, cần bảo dưỡng định kỳ các xe hoạt động tần suất lớn.`,
        priority: 'LOW',
      });
    } else if (overallRate > 0 && overallRate < 40) {
      recommendations.push({
        type: 'NETWORK_HEALTH',
        title: 'Hiệu suất khai thác toàn mạng còn dư địa',
        message: `Hệ số lấp đầy trung bình chỉ đạt ${overallRate}%. Đề xuất xem xét lại biểu đồ giờ xuất bến phù hợp hơn với lịch học sinh viên ICTU.`,
        priority: 'MEDIUM',
      });
    }

    return {
      date: displayDate,
      overallOccupancyPercentage: overallRate,
      totalTrips: processedTrips.length,
      summary: {
        overallOccupancyPercentage: overallRate,
        totalTrips: processedTrips.length,
        totalCapacity,
        totalBooked,
        overloadedTripsCount: overloadedTrips.length,
        optimalTripsCount: optimalTrips.length,
        lowTripsCount: lowTrips.length,
        underutilizedTripsCount: underutilizedTrips.length,
      },
      hourlyDensity,
      heatmapMatrix,
      occupancyByRoute,
      recommendations,
      trips: processedTrips,
    };
  }
}
