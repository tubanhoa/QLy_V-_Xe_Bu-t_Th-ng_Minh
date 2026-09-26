import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SearchTripsDto } from '../../src/modules/booking/dto/booking.dto.js';

describe('SearchTripsDto & Date Parsing Safety', () => {
  it('should accept search trips query without date (optional fallback)', async () => {
    const rawData = {
      origin: 'ĐH CNTT & TT Thái Nguyên',
      destination: 'Bến xe Trung tâm Thái Nguyên',
    };
    const dto = plainToInstance(SearchTripsDto, rawData);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.date).toBeUndefined();
  });

  it('should safely parse fallback date when date is empty or undefined', () => {
    const resolveDate = (date?: string) => {
      let targetDateStr = date?.trim();
      if (!targetDateStr || isNaN(Date.parse(targetDateStr))) {
        const now = new Date();
        targetDateStr = now.toISOString().split('T')[0];
      }
      return targetDateStr;
    };

    const todayStr = new Date().toISOString().split('T')[0];
    expect(resolveDate(undefined)).toBe(todayStr);
    expect(resolveDate('')).toBe(todayStr);
    expect(resolveDate('invalid-date')).toBe(todayStr);
    expect(resolveDate('2026-10-15')).toBe('2026-10-15');
  });
});
