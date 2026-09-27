/**
 * Utility xuất vé điện tử:
 * 1. Tải vé điện tử dạng ảnh PNG chất lượng cao (Retina 2x)
 * 2. In hoặc xuất PDF vé điện tử chuẩn A4/Slip
 */

import type { TicketDetail } from '@/lib/types/ticket'

export async function downloadTicketAsImage(
  ticket: TicketDetail,
  qrImageSource?: string,
): Promise<boolean> {
  if (typeof window === 'undefined') return false

  return new Promise((resolve) => {
    try {
      const scale = 2
      const width = 640
      const height = 920

      const canvas = document.createElement('canvas')
      canvas.width = width * scale
      canvas.height = height * scale
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        resolve(false)
        return
      }

      ctx.scale(scale, scale)

      // 1. Nền thẻ bo tròn màu trắng
      ctx.fillStyle = '#F8FAFC'
      ctx.fillRect(0, 0, width, height)

      // Vẽ thẻ chính
      const margin = 20
      const cardW = width - margin * 2
      const cardH = height - margin * 2

      ctx.fillStyle = '#FFFFFF'
      ctx.shadowColor = 'rgba(0, 90, 54, 0.12)'
      ctx.shadowBlur = 24
      ctx.shadowOffsetY = 8
      roundRect(ctx, margin, margin, cardW, cardH, 28)
      ctx.fill()
      ctx.shadowColor = 'transparent'

      // Viền thẻ
      ctx.strokeStyle = '#E2E8F0'
      ctx.lineWidth = 1.5
      roundRect(ctx, margin, margin, cardW, cardH, 28)
      ctx.stroke()

      // 2. Header thương hiệu ICTU TRANSIT (#005A36)
      const headerH = 110
      ctx.fillStyle = '#005A36'
      roundRectTop(ctx, margin, margin, cardW, headerH, 28)
      ctx.fill()

      // Text Header
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('ICTU SMART TRANSIT', margin + 28, margin + 46)

      ctx.fillStyle = '#A7F3D0'
      ctx.font = '600 12px system-ui, -apple-system, sans-serif'
      ctx.fillText('VÉ XE BUÝT ĐIỆN TỬ THÔNG MINH · CHỮ KÝ SỐ HMAC-SHA256', margin + 28, margin + 74)

      // Badge Trạng thái
      ctx.fillStyle = '#10B981'
      roundRect(ctx, width - margin - 150, margin + 35, 122, 32, 16)
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('ĐÃ THANH TOÁN', width - margin - 89, margin + 56)

      // 3. Khối QR Code ở trung tâm
      const qrBoxSize = 260
      const qrBoxX = (width - qrBoxSize) / 2
      const qrBoxY = margin + headerH + 30

      // Khung viền nét đứt của QR
      ctx.fillStyle = '#ECFDF5'
      roundRect(ctx, qrBoxX - 16, qrBoxY - 16, qrBoxSize + 32, qrBoxSize + 32, 24)
      ctx.fill()
      ctx.strokeStyle = '#6EE7B7'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 6])
      roundRect(ctx, qrBoxX - 16, qrBoxY - 16, qrBoxSize + 32, qrBoxSize + 32, 24)
      ctx.stroke()
      ctx.setLineDash([])

      // Load và vẽ ảnh QR code
      const qrImg = new Image()
      qrImg.crossOrigin = 'anonymous'

      qrImg.onload = () => {
        // Nền trắng chứa QR
        ctx.fillStyle = '#FFFFFF'
        roundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 18)
        ctx.fill()

        ctx.drawImage(qrImg, qrBoxX + 16, qrBoxY + 16, qrBoxSize - 32, qrBoxSize - 32)

        // 4. Thông tin chi tiết vé
        drawTicketDetails(ctx, ticket, width, margin, qrBoxY + qrBoxSize + 45)

        // 5. Trigger download file PNG
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(false)
            return
          }
          const link = document.createElement('a')
          link.download = `ve-dien-tu-ICTU-${ticket.ticketCode || 'PASS'}.png`
          link.href = URL.createObjectURL(blob)
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(link.href)
          resolve(true)
        }, 'image/png')
      }

      qrImg.onerror = () => {
        // Fallback vẽ placeholder nếu ảnh QR lỗi
        ctx.fillStyle = '#FFFFFF'
        roundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 18)
        ctx.fill()
        ctx.fillStyle = '#005A36'
        ctx.font = 'bold 16px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(ticket.ticketCode, width / 2, qrBoxY + qrBoxSize / 2)

        drawTicketDetails(ctx, ticket, width, margin, qrBoxY + qrBoxSize + 45)

        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(false)
            return
          }
          const link = document.createElement('a')
          link.download = `ve-dien-tu-ICTU-${ticket.ticketCode}.png`
          link.href = URL.createObjectURL(blob)
          link.click()
          resolve(true)
        }, 'image/png')
      }

      qrImg.src =
        qrImageSource ||
        ticket.qrDataUrl ||
        `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
          `ICTU-PASS:${ticket.ticketCode}:${ticket.passengerName}`,
        )}`
    } catch (e) {
      console.error('Lỗi khi xuất ảnh vé:', e)
      resolve(false)
    }
  })
}

function drawTicketDetails(
  ctx: CanvasRenderingContext2D,
  ticket: TicketDetail,
  width: number,
  margin: number,
  startY: number,
) {
  // Mã vé nổi bật
  ctx.fillStyle = '#005A36'
  ctx.font = 'bold 20px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(ticket.ticketCode, width / 2, startY)

  ctx.fillStyle = '#64748B'
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
  ctx.fillText('MÃ BẢO MẬT SOÁT VÉ TỰ ĐỘNG', width / 2, startY + 18)

  // Đường kẻ ngang nét đứt
  ctx.strokeStyle = '#E2E8F0'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(margin + 30, startY + 36)
  ctx.lineTo(width - margin - 30, startY + 36)
  ctx.stroke()
  ctx.setLineDash([])

  // Lưới thông tin 4 ô
  const gridY = startY + 56
  const col1X = margin + 35
  const col2X = width / 2 + 15

  // Tuyến xe
  drawField(ctx, 'TUYẾN XE', ticket.routeName || 'Tuyến CT-01 KTX ICTU ↔ Bến Xe TP', col1X, gridY)
  // Khởi hành
  const depTime = new Date(ticket.departureTime).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  drawField(ctx, 'GIỜ KHỞI HÀNH', depTime, col2X, gridY)

  // Ghế ngồi
  drawField(ctx, 'VỊ TRÍ GHẾ', `Ghế ${ticket.seatNumber} (Tầng 1)`, col1X, gridY + 54, '#005A36', true)
  // Biển số xe
  drawField(ctx, 'XE BUÝT ĐIỆN', ticket.vehiclePlate || '20B-999.88', col2X, gridY + 54)

  // Hành khách
  drawField(ctx, 'HÀNH KHÁCH', ticket.passengerName || 'Hành khách ICTU', col1X, gridY + 108)
  // Số điện thoại
  drawField(ctx, 'SỐ ĐIỆN THOẠI', ticket.passengerPhone || '---', col2X, gridY + 108)

  // Hướng dẫn chân vé
  const footerY = heightFromCanvas(gridY + 170)
  ctx.fillStyle = '#065F46'
  ctx.font = '600 11.5px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Đưa mã QR trên lại gần máy quét tại cửa lên xe buýt để mở cổng tự động.', width / 2, footerY)

  ctx.fillStyle = '#94A3B8'
  ctx.font = '500 10px system-ui, -apple-system, sans-serif'
  ctx.fillText('Trung tâm Điều hành Xe buýt Thông minh ICTU Transit · Hotline 1900 6899', width / 2, footerY + 18)
}

function heightFromCanvas(val: number) {
  return val
}

function drawField(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  valColor = '#0F172A',
  isBoldLarge = false,
) {
  ctx.textAlign = 'left'
  ctx.fillStyle = '#64748B'
  ctx.font = 'bold 10px system-ui, -apple-system, sans-serif'
  ctx.fillText(label, x, y)

  ctx.fillStyle = valColor
  ctx.font = isBoldLarge
    ? 'bold 15px system-ui, -apple-system, sans-serif'
    : '600 12.5px system-ui, -apple-system, sans-serif'
  ctx.fillText(value, x, y + 18)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function roundRectTop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/**
 * Mở cửa sổ in ấn hoặc lưu PDF vé điện tử
 */
export function printTicketAsPdf() {
  if (typeof window === 'undefined') return
  window.print()
}
