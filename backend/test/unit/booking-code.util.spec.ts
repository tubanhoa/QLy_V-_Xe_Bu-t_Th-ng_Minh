import { describe, it, expect } from 'vitest';
import {
  generateBookingCode,
  generateTicketCode,
  generateMonthlyPassCode,
} from '../../src/common/utils/booking-code.util.js';

describe('Booking & Ticket Code Generator Utilities', () => {
  it('should generate valid booking code format: BK-YYYYMMDD-XXXX', () => {
    const code = generateBookingCode();
    expect(code).toMatch(/^BK-\d{8}-[A-Z0-9]{4}$/);
  });

  it('should generate valid ticket code format: TKT-ICTU-YYYY-XXXXX', () => {
    const code = generateTicketCode(2026);
    expect(code).toMatch(/^TKT-ICTU-2026-[A-Z0-9]{5}$/);
  });

  it('should generate valid monthly pass code format: MP-YYYYMM-XXXX', () => {
    const code = generateMonthlyPassCode();
    expect(code).toMatch(/^MP-\d{6}-[A-Z0-9]{4}$/);
  });
});
