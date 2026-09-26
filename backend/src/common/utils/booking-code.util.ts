/**
 * Helper to generate standardized system codes
 */

export function generateBookingCode(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BK-${dateStr}-${randomChars}`;
}

export function generateTicketCode(year?: number): string {
  const y = year || new Date().getFullYear();
  const randomChars = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `TKT-ICTU-${y}-${randomChars}`;
}

export function generateMonthlyPassCode(): string {
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MP-${dateStr}-${randomChars}`;
}
