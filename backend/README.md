# 🚌 Hệ Thống Quản Lý Vé Xe Buýt Thông Minh ICTU — Backend API

> **Dự án:** Smart Bus Ticketing System  
> **Trường Đại học Công nghệ Thông tin & Truyền thông — Đại học Thái Nguyên (ICTU)**  
> **Tech Stack:** NestJS 12 + TypeScript (ESM) + TypeORM + PostgreSQL 16 (PostGIS) + Redis + Socket.io + Swagger

---

## 📋 Mục lục

1. [Tính năng cốt lõi](#1-tính-năng-cốt-lõi)
2. [Yêu cầu hệ thống & Cài đặt](#2-yêu-cầu-hệ-thống--cài-đặt)
3. [Tài khoản thử nghiệm mặc định (Seed Data)](#3-tài-khoản-thử-nghiệm-mặc-định-seed-data)
4. [Tài liệu API Swagger](#4-tài-liệu-api-swagger)
5. [Định vị GPS Realtime & WebSocket](#5-định-vị-gps-realtime--websocket)
6. [Tích hợp Cổng thanh toán (VNPay / MoMo / VietQR)](#6-tích-hợp-cổng-thanh-toán-vnpay--momo--vietqr)
7. [Cấu trúc mã nguồn](#7-cấu-trúc-mã-nguồn)
8. [Kiểm thử (Tests)](#8-kiểm-thử-tests)

---

## 1. Tính năng cốt lõi

- 🔐 **Xác thực & Phân quyền RBAC 4 vai trò:** `admin`, `manager`, `driver`, `passenger` với JWT Access Token (15m) + Refresh Token rotation (7d).
- 🛣️ **Vận hành giao thông (Transit):** Tuyến xe (`routes`), trạm dừng GPS (`stations`), trạm trung gian (`route_stations`), phương tiện xe điện (`vehicles`) và sơ đồ 28 ghế tiêu chuẩn/ưu tiên (`seats`).
- ⏱️ **Lịch trình & Điều phối (Trips):** Tự động sinh chuyến theo ngày và tần suất, gán xe/tài xế/phụ xe, sơ đồ ghế realtime, danh sách hành khách (manifest).
- 🎫 **Đặt vé & Giữ chỗ chống Race Condition:**
  - Khóa ghế tạm thời 10 phút qua Redis `SETNX` + TTL (tự động fallback in-memory nếu không bật Redis).
  - Xuất vé điện tử QR Code có **chữ ký số HMAC-SHA256** chống làm giả và can thiệp thông tin.
- 💳 **Thanh toán điện tử:** Tích hợp VNPay Sandbox (tính checksum HMAC-SHA512, return URL, webhook IPN idempotent) và mã VietQR.
- 📡 **GPS Realtime & Geofencing:**
  - WebSocket Gateway (Socket.io) phòng theo chuyến `trip:{tripId}`.
  - Tự động tính khoảng cách bằng công thức **Haversine** và bắn thông báo `passenger:station-alert` khi xe cách trạm < 500m.
- 🎟️ **Vé tháng & Khuyến mại:** Đăng ký vé tháng ưu đãi sinh viên (-50%), xét duyệt thẻ SV, quản lý mã voucher giảm giá.
- 📊 **Thống kê báo cáo & Kiểm toán:** Doanh thu theo tuyến/ngày, tỷ lệ lấp đầy ghế, nhật ký hoạt động hệ thống (`activity_logs`).

---

## 2. Yêu cầu hệ thống & Cài đặt

### 2.1. Cài đặt môi trường

- **Node.js:** >= 20.x
- **Docker Desktop** (tùy chọn nhưng khuyến nghị cho PostgreSQL & Redis)

### 2.2. Khởi động PostgreSQL & Redis bằng Docker

```bash
cd backend
docker compose up -d
```

### 2.3. Khởi chạy Backend

```bash
# 1. Cài đặt thư viện
npm install

# 2. Cấu hình biến môi trường
cp .env.example .env

# 3. Chạy ở chế độ phát triển (auto-reload)
npm run start:dev
```

Server sẽ tự động khởi động tại:  
- **API URL:** `http://localhost:3001`  
- **Tài liệu Swagger:** `http://localhost:3001/api/docs`  
- **WebSocket Gateway:** `ws://localhost:3001`

---

## 3. Tài khoản thử nghiệm mặc định (Seed Data)

Khi backend khởi động lần đầu, hệ thống sẽ tự động khởi tạo dữ liệu mẫu:

| Vai trò | Email đăng nhập | Mật khẩu mặc định | Ghi chú |
|---|---|---|---|
| **Admin** | `admin@smartbus.ictu.vn` | `Password@123` | Quản trị toàn hệ thống |
| **Manager** | `manager@smartbus.ictu.vn` | `Password@123` | Quản lý tuyến, điều phối |
| **Driver** | `driver.nam@smartbus.ictu.vn` | `Password@123` | Tài xế / Soát vé QR |
| **Passenger** | `student.an@ictu.edu.vn` | `Password@123` | Sinh viên ICTU (hưởng ưu đãi SV) |

### Dữ liệu mẫu đã sinh sẵn:
- **Tuyến CT-01:** ĐH CNTT & TT Thái Nguyên (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên (5 trạm dừng có toạ độ GPS thực tế).
- **Phương tiện:** 3 xe buýt điện VinFast eBus 28 chỗ (Biển số: `20B-012.34`, `20B-056.78`, `20B-099.99`).
- **Chuyến xe:** 11 chuyến xe mẫu trải dài từ 07:00 đến 18:00 hôm nay.
- **Mã Voucher:** `ICTU2026` (Giảm 20% tối đa 20.000 VND).

---

## 4. Tài liệu API Swagger

Truy cập đường dẫn: **`http://localhost:3001/api/docs`**

Swagger UI cho phép test trực tiếp toàn bộ 50+ API endpoints:
- Đăng ký / Đăng nhập lấy Bearer Token
- Click nút **Authorize** ở góc phải màn hình, dán token để test các API yêu cầu đăng nhập.

---

## 5. Định vị GPS Realtime & WebSocket

### 5.1. Kết nối Socket.io Client (Frontend)

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

// 1. Tham gia phòng chuyến xe
socket.emit('join-trip', { tripId: 'your-trip-id' });

// 2. Lắng nghe toạ độ xe cập nhật (mỗi 3 giây)
socket.on('passenger:bus-location', (data) => {
  console.log('Toạ độ xe buýt:', data.latitude, data.longitude, data.speedKmh);
});

// 3. Lắng nghe cảnh báo xe sắp tới trạm (< 500m)
socket.on('passenger:station-alert', (alert) => {
  console.log(`Thông báo: ${alert.message} (khoảng cách: ${alert.distanceMeters}m)`);
});
```

### 5.2. Tài xế phát toạ độ GPS

```typescript
socket.emit('driver:update-location', {
  tripId: 'your-trip-id',
  latitude: 21.587123,
  longitude: 105.811234,
  speedKmh: 35.5,
  headingDegrees: 120.0,
  batteryPercent: 88.5,
});
```

---

## 6. Tích hợp Cổng thanh toán (VNPay / MoMo / VietQR)

1. Gọi `POST /api/v1/payment/create-url` với `{ bookingId, paymentMethod: "vnpay" }`.
2. Backend sinh URL thanh toán có chữ ký HMAC-SHA512 gửi tới cổng Sandbox VNPay.
3. Khách thanh toán xong, VNPay redirect về `GET /api/v1/payment/vnpay-return` và bắn webhook ngầm `POST /api/v1/payment/vnpay-ipn`.
4. Backend tự động cập nhật trạng thái đơn vé sang `PAID` và kích hoạt vé điện tử.

---

## 7. Cấu trúc mã nguồn

```
backend/
├── src/
│   ├── common/             # Constants, Guards, Decorators, Filters, Interceptors, Utils
│   ├── config/             # Database, JWT, Redis configurations
│   ├── database/
│   │   ├── entities/       # 17 TypeORM Entities (UUID, Relations, Indexes)
│   │   ├── seeds/          # Tự động nạp dữ liệu mẫu ban đầu
│   │   └── schema.sql      # Script SQL thuần PostgreSQL 16 + PostGIS
│   ├── modules/
│   │   ├── auth/           # Đăng ký, đăng nhập JWT, refresh token
│   │   ├── users/          # Quản lý người dùng, phân quyền RBAC
│   │   ├── transit/        # Tuyến xe, trạm dừng, xe buýt, ghế ngồi
│   │   ├── trips/          # Sinh lịch trình, điều phối chuyến, soát vé QR
│   │   ├── booking/        # Đặt vé, giữ chỗ Redis TTL, hủy vé, đổi vé
│   │   ├── payment/        # VNPay, MoMo, VietQR, hoàn tiền
│   │   ├── tracking/       # WebSocket Gateway, GPS tracking, geofence alert
│   │   ├── promotion/      # Vé tháng sinh viên, mã voucher giảm giá
│   │   ├── reports/        # Doanh thu, tỷ lệ lấp đầy ghế
│   │   ├── feedback/       # Đánh giá sao, phản ánh dịch vụ
│   │   └── audit/          # Nhật ký hoạt động hệ thống
│   ├── app.module.ts
│   └── main.ts
├── test/                   # Vitest unit & e2e test suites
├── docker-compose.yml       # Môi trường PostgreSQL (PostGIS) & Redis
└── package.json
```

---

## 8. Kiểm thử (Tests)

Chạy bộ kiểm thử tự động với Vitest:

```bash
# Chạy tất cả unit tests
npm test

# Chạy ở chế độ theo dõi (watch mode)
npm run test:watch
```
