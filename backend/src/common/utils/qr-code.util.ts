import * as crypto from 'node:crypto';
import QRCode from 'qrcode';

export interface TicketQrPayload {
  ticketCode: string;
  tripId: string;
  seatNumber: string;
  passengerName: string;
  issuedAt: number;
  bookingCode?: string;
}

/**
 * Sắp xếp các khóa của payload để tạo chuỗi JSON chuẩn hóa (canonical),
 * đảm bảo hash chữ ký số luôn nhất quán giữa các môi trường và định dạng.
 */
export function canonicalizePayload(payload: Record<string, any>): string {
  const sortedKeys = Object.keys(payload).sort();
  const sortedObj: Record<string, any> = {};
  for (const key of sortedKeys) {
    sortedObj[key] = payload[key];
  }
  return JSON.stringify(sortedObj);
}

/**
 * Ký số dữ liệu vé bằng HMAC-SHA256 để chống làm giả và can thiệp vé
 */
export function signQrPayload(
  payload: TicketQrPayload,
  secret: string = process.env.QR_HMAC_SECRET || 'smart-bus-qr-signature-secret-key-2026',
): { qrData: string; signature: string } {
  const canonicalString = canonicalizePayload(payload);
  const signature = crypto.createHmac('sha256', secret).update(canonicalString).digest('hex');
  const qrData = JSON.stringify({
    ...payload,
    sig: signature,
  });
  return { qrData, signature };
}

/**
 * Xác minh tính hợp lệ của mã QR và chữ ký số chống làm giả
 */
export function verifyQrData(
  qrString: string,
  secret: string = process.env.QR_HMAC_SECRET || 'smart-bus-qr-signature-secret-key-2026',
): { valid: boolean; payload?: TicketQrPayload; reason?: string } {
  try {
    const parsed = typeof qrString === 'string' ? JSON.parse(qrString) : qrString;
    const { sig, ...payload } = parsed;

    if (!sig) {
      return { valid: false, reason: 'Chữ ký số không tồn tại' };
    }

    // Kiểm tra tương thích cả chuỗi canonical và plain JSON
    const expectedCanonical = crypto
      .createHmac('sha256', secret)
      .update(canonicalizePayload(payload))
      .digest('hex');
    const expectedPlain = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (sig !== expectedCanonical && sig !== expectedPlain) {
      return { valid: false, reason: 'Chữ ký số không hợp lệ hoặc dữ liệu vé đã bị chỉnh sửa' };
    }

    return { valid: true, payload: payload as TicketQrPayload };
  } catch {
    return { valid: false, reason: 'Định dạng mã QR không hợp lệ' };
  }
}

/**
 * Mã hóa dữ liệu vé thành chuỗi token an toàn AES-256-CBC
 */
export function encryptQrPayload(
  payload: TicketQrPayload,
  secretKey: string = process.env.QR_HMAC_SECRET || 'smart-bus-qr-signature-secret-key-2026',
): string {
  const key = crypto.createHash('sha256').update(secretKey).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const json = canonicalizePayload(payload);
  let encrypted = cipher.update(json, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return `${iv.toString('base64')}.${encrypted}`;
}

/**
 * Giải mã chuỗi token AES-256-CBC
 */
export function decryptQrPayload(
  encryptedToken: string,
  secretKey: string = process.env.QR_HMAC_SECRET || 'smart-bus-qr-signature-secret-key-2026',
): TicketQrPayload | null {
  try {
    const [ivBase64, cipherText] = encryptedToken.split('.');
    if (!ivBase64 || !cipherText) return null;
    const key = crypto.createHash('sha256').update(secretKey).digest();
    const iv = Buffer.from(ivBase64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(cipherText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted) as TicketQrPayload;
  } catch {
    return null;
  }
}

/**
 * Sinh hình ảnh mã QR định dạng Base64 Data URL (PNG)
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 300,
  });
}
