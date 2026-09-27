import { describe, it, expect } from 'vitest';

describe('Vietnam Timezone (UTC+7 / Asia/Ho_Chi_Minh) Handling (STT 3)', () => {
  it('should format and represent trip times accurately in Vietnam Timezone (UTC+7)', () => {
    // 06:00:00 sáng ngày 26/09/2026 tại Thái Nguyên (UTC+7) tương ứng với 23:00:00 ngày 25/09/2026 (UTC)
    const tripUtcTime = new Date('2026-09-25T23:00:00.000Z');

    const vnFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const formattedVn = vnFormatter.format(tripUtcTime);
    // formattedVn should be '2026-09-26, 06:00:00'
    expect(formattedVn).toContain('2026-09-26');
    expect(formattedVn).toContain('06:00:00');
  });

  it('should resolve Vietnam local date without day-shift bug when server runs in UTC', () => {
    // Giả sử server đang ở UTC lúc 01:00 AM ngày 26/09/2026 (tại VN đã là 08:00 AM ngày 26/09/2026)
    const testDate = new Date('2026-09-26T01:00:00.000Z');

    const getVnDateString = (date: Date) => {
      return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(date);
    };

    const vnDateStr = getVnDateString(testDate);
    expect(vnDateStr).toBe('2026-09-26');

    // Trường hợp server ở UTC lúc 18:00 ngày 25/09/2026 (tại VN đã là 01:00 AM ngày 26/09/2026)
    const testLateNightUtc = new Date('2026-09-25T18:00:00.000Z');
    const vnNextDayStr = getVnDateString(testLateNightUtc);
    expect(vnNextDayStr).toBe('2026-09-26');
  });

  it('should verify date window covers the full 24h of Vietnam operating day (05:00 to 22:00)', () => {
    const targetDateStr = '2026-09-26';
    const startOfDay = new Date(`${targetDateStr}T00:00:00`);
    const endOfDay = new Date(`${targetDateStr}T23:59:59.999`);

    const morningTrip = new Date(`${targetDateStr}T05:30:00`);
    const eveningTrip = new Date(`${targetDateStr}T21:00:00`);

    expect(morningTrip.getTime()).toBeGreaterThanOrEqual(startOfDay.getTime());
    expect(morningTrip.getTime()).toBeLessThanOrEqual(endOfDay.getTime());

    expect(eveningTrip.getTime()).toBeGreaterThanOrEqual(startOfDay.getTime());
    expect(eveningTrip.getTime()).toBeLessThanOrEqual(endOfDay.getTime());
  });
});
