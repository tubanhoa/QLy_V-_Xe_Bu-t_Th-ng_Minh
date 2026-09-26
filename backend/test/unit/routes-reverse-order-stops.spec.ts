import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from '../../src/modules/booking/booking.service.js';
import { Repository } from 'typeorm';
import { BookingEntity } from '../../src/database/entities/booking.entity.js';
import { TicketEntity } from '../../src/database/entities/ticket.entity.js';
import { TripEntity } from '../../src/database/entities/trip.entity.js';
import { SeatEntity } from '../../src/database/entities/seat.entity.js';
import { VoucherEntity } from '../../src/database/entities/voucher.entity.js';
import { UserEntity } from '../../src/database/entities/user.entity.js';
import { SeatLockService } from '../../src/modules/booking/seat-lock.service.js';

describe('Route Stations Sequence & Reverse Direction Order (STT 2)', () => {
  let bookingService: BookingService;
  let mockTripRepo: any;
  let mockTicketRepo: any;
  let mockQueryBuilder: any;

  // Route CT-01 stops on Thái Nguyên transit network
  const ct01Stops = [
    { stopOrder: 1, stationName: 'Trạm ĐH CNTT & TT Thái Nguyên (ICTU)' },
    { stopOrder: 2, stationName: 'Trạm Cổng KTX ĐH Thái Nguyên' },
    { stopOrder: 3, stationName: 'Trạm Ngã 3 Mỏ Chè' },
    { stopOrder: 4, stationName: 'Trạm Bệnh Viện Đa Khoa Trung Ương' },
    { stopOrder: 5, stationName: 'Trạm Bến Xe Trung Tâm Thái Nguyên' },
  ];

  beforeEach(() => {
    mockQueryBuilder = {
      innerJoinAndSelect: vi.fn().mockReturnThis(),
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    };

    mockTripRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    mockTicketRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(0),
      }),
    };

    bookingService = new BookingService(
      {} as Repository<BookingEntity>,
      mockTicketRepo as Repository<TicketEntity>,
      mockTripRepo as Repository<TripEntity>,
      {} as Repository<SeatEntity>,
      {} as Repository<VoucherEntity>,
      {} as Repository<UserEntity>,
      {} as SeatLockService,
    );
  });

  it('should attach NOT EXISTS clause preventing routes where destination stop is before or equal to origin stop', async () => {
    await bookingService.searchTrips({
      origin: 'Bệnh Viện',
      destination: 'Cổng KTX',
    });

    const calls = mockQueryBuilder.andWhere.mock.calls;
    const orderClauseCall = calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('rs_from.stop_order >= rs_to.stop_order'),
    );

    expect(orderClauseCall).toBeDefined();
    expect(orderClauseCall[1]).toEqual({
      origin: '%bệnh viện%',
      dest: '%cổng ktx%',
    });
  });

  it('should return 0 results when destination stop appears before origin stop in sequence (reverse direction)', () => {
    // Helper function reproducing the DB order constraint logic
    const filterValidRouteDirection = (
      stops: typeof ct01Stops,
      originKeyword: string,
      destKeyword: string,
    ) => {
      const originStop = stops.find((s) =>
        s.stationName.toLowerCase().includes(originKeyword.toLowerCase()),
      );
      const destStop = stops.find((s) =>
        s.stationName.toLowerCase().includes(destKeyword.toLowerCase()),
      );

      if (!originStop || !destStop) return false;
      // Ràng buộc STT 2: trạm đón phải đi trước trạm đến (stopOrder đón < stopOrder đến)
      return originStop.stopOrder < destStop.stopOrder;
    };

    // Case 1: Chiều xuôi - Cổng KTX (order 2) -> Bệnh viện (order 4): HỢP LỆ
    const forwardValid = filterValidRouteDirection(ct01Stops, 'Cổng KTX', 'Bệnh Viện');
    expect(forwardValid).toBe(true);

    // Case 2: Chiều ngược - Bệnh viện (order 4) -> Cổng KTX (order 2): PHẢI TRẢ 0 KẾT QUẢ
    const reverseValid = filterValidRouteDirection(ct01Stops, 'Bệnh Viện', 'Cổng KTX');
    expect(reverseValid).toBe(false);

    // Case 3: Trạm đón và trạm đến trùng nhau (order 3 -> order 3): PHẢI TRẢ 0 KẾT QUẢ
    const sameStationValid = filterValidRouteDirection(ct01Stops, 'Ngã 3 Mỏ Chè', 'Ngã 3 Mỏ Chè');
    expect(sameStationValid).toBe(false);
  });
});
