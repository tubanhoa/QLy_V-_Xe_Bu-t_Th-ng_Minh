import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from '../../src/modules/booking/booking.service.js';
import { Repository } from 'typeorm';
import { BookingEntity } from '../../database/entities/booking.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { SeatEntity } from '../../database/entities/seat.entity.js';
import { VoucherEntity } from '../../database/entities/voucher.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { SeatLockService } from '../../src/modules/booking/seat-lock.service.js';

describe('BookingService - Invalid Date Parsing & Fallback (STT 3)', () => {
  let bookingService: BookingService;
  let mockTripRepo: any;
  let mockTicketRepo: any;
  let mockQueryBuilder: any;

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

  it('should not crash with RangeError when date is malformed string like "32/13/2026"', async () => {
    // Trước khi fix: new Date('32/13/2026') -> Invalid Date -> crash 500 RangeError
    // Sau khi fix: an toàn fallback về ngày hiện tại, không crash
    await expect(
      bookingService.searchTrips({ date: '32/13/2026' }),
    ).resolves.not.toThrow();

    const whereCalls = mockQueryBuilder.where.mock.calls;
    const betweenCall = whereCalls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('trip.departureTime BETWEEN :start AND :end'),
    );

    expect(betweenCall).toBeDefined();
    const { start, end } = betweenCall[1];
    expect(start).toBeInstanceOf(Date);
    expect(end).toBeInstanceOf(Date);
    expect(isNaN(start.getTime())).toBe(false);
    expect(isNaN(end.getTime())).toBe(false);
  });

  it('should safely fallback for random garbage strings or nonexistent calendar dates', async () => {
    const invalidDates = ['invalid-date-string', '2026-99-99', 'undefined', 'null', '  '];

    for (const invalidDate of invalidDates) {
      await expect(
        bookingService.searchTrips({ date: invalidDate }),
      ).resolves.not.toThrow();
    }
  });

  it('should preserve valid ISO format dates when provided correctly', async () => {
    await bookingService.searchTrips({ date: '2026-10-15' });

    const whereCalls = mockQueryBuilder.where.mock.calls;
    const betweenCall = whereCalls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('trip.departureTime BETWEEN :start AND :end'),
    );

    const { start } = betweenCall[1];
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(9); // 0-indexed month 9 is October
    expect(start.getDate()).toBe(15);
  });
});
