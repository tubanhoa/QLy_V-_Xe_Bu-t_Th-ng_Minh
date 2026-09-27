import * as crypto from 'node:crypto';
import QRCode from 'qrcode';

export interface TicketQrPayload {
  ticketCode: string;
  tripId: string;
  seatNumber: string;
  passengerName: string;
  issuedAt: number;
}

/**
 * Signs a payload with HMAC-SHA256
 */
export function signQrPayload(payload: TicketQrPayload, secret: string): { qrData: string; signature: string } {
  const jsonPayload = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(jsonPayload).digest('hex');
  const qrData = JSON.stringify({
    ...payload,
    sig: signature,
  });
  return { qrData, signature };
}

/**
 * Verifies a QR string and extracts payload if valid
 */
export function verifyQrData(
  qrString: string,
  secret: string,
): { valid: boolean; payload?: TicketQrPayload; reason?: string } {
  try {
    const parsed = JSON.parse(qrString);
    const { sig, ...payload } = parsed;

    if (!sig) {
      return { valid: false, reason: 'Chữ ký số không tồn tại' };
    }

    const expectedSignature = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');

    if (sig !== expectedSignature) {
      return { valid: false, reason: 'Chữ ký số không hợp lệ hoặc dữ liệu vé đã bị chỉnh sửa' };
    }

    return { valid: true, payload: payload as TicketQrPayload };
  } catch {
    return { valid: false, reason: 'Định dạng mã QR không hợp lệ' };
  }
}

/**
 * Generates Base64 Data URL representation of a QR Code
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 300,
  });
}
