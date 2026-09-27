import { describe, it, expect } from 'vitest';
import { signQrPayload, verifyQrData } from '../../src/common/utils/qr-code.util.js';

describe('QR Code Signature & Verification Utility', () => {
  const secret = 'super-secret-key-12345';
  const mockPayload = {
    ticketCode: 'TKT-ICTU-2026-TEST',
    tripId: 'trip-uuid-1',
    seatNumber: '02A',
    passengerName: 'Nguyễn Văn Test',
    issuedAt: Date.now(),
  };

  it('should sign and verify valid ticket QR data successfully', () => {
    const { qrData, signature } = signQrPayload(mockPayload, secret);

    expect(signature).toBeDefined();
    expect(typeof signature).toBe('string');
    expect(signature.length).toBe(64); // SHA-256 hex is 64 chars

    const result = verifyQrData(qrData, secret);
    expect(result.valid).toBe(true);
    expect(result.payload?.ticketCode).toBe('TKT-ICTU-2026-TEST');
    expect(result.payload?.seatNumber).toBe('02A');
  });

  it('should reject QR data with tampered seat number or passenger name', () => {
    const { qrData } = signQrPayload(mockPayload, secret);
    const parsed = JSON.parse(qrData);

    // Tamper the payload: change seat 02A -> 01A
    parsed.seatNumber = '01A';
    const tamperedQrData = JSON.stringify(parsed);

    const result = verifyQrData(tamperedQrData, secret);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Chữ ký số không hợp lệ');
  });

  it('should reject verification with incorrect secret key', () => {
    const { qrData } = signQrPayload(mockPayload, secret);
    const result = verifyQrData(qrData, 'wrong-secret-key');

    expect(result.valid).toBe(false);
  });
});
