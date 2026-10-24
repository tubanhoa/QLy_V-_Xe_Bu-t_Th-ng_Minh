# 🚌 SMART BUS TICKETING SYSTEM - ICTU
### Hệ Thống Đặt Vé & Quản Lý Xe Buýt Thông Minh Trường ĐH Công Nghệ Thông Tin & Truyền Thông (ICTU)

[![Next.js](https://img.shields.io/badge/Next.js-16.3.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![NestJS](https://img.shields.io/badge/NestJS-11.0.0-E0234E?style=for-the-badge&logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=for-the-badge&logo=postgresql)](https://supabase.com/)
[![Redis](https://img.shields.io/badge/Redis-Upstash-DC382D?style=for-the-badge&logo=redis)](https://redis.io/)
[![Vitest](https://img.shields.io/badge/Vitest-36%20Files%20Passed-6E9F18?style=for-the-badge&logo=vitest)](https://vitest.dev/)
[![Status](https://img.shields.io/badge/Release-v1.0.0%20Ready-success?style=for-the-badge)](https://github.com/tubanhoa/QLy_V-_Xe_Bu-t_Th-ng_Minh)

---

## 📌 Giới Thiệu Dự Án (Project Overview)

**SMART BUS TICKETING SYSTEM (ICTU)** là giải pháp chuyển đổi số toàn diện cho mạng lưới xe buýt đưa đón sinh viên, giảng viên và cán bộ tại **Trường Đại học Công nghệ Thông tin & Truyền thông - Đại học Thái Nguyên**.

Hệ thống được phát triển theo kiến trúc **Monorepo Công Nghiệp (Clean Separation & Feature-Driven Architecture)**, tích hợp thuật toán định vị thời gian thực, cơ chế khóa chỗ phân tán chống xung đột, mã hóa vé QR bảo mật, cổng thanh toán trực tuyến và hệ thống phân tích quản trị điều hành vận tải thông minh.

---

## ✨ Tính Năng Nổi Bật (Key Features)

### 1. Hành Khách & Sinh Viên (Passenger & Student Experience)
* 💺 **Đặt vé & Giữ chỗ Real-time**: Sơ đồ xe 28 chỗ chuẩn thực tế (01A - 07D), cơ chế giữ chỗ 10 phút sử dụng Redis TTL chống tranh chấp (Race Condition).
* 🎟️ **Soát vé QR Động & Vé điện tử**: Mã hóa HMAC-SHA256, gửi vé PDF kèm mã QR qua Email tức thì.
* 💳 **Thanh toán Đa kênh & Trợ giá Sinh viên**: Tích hợp cổng VNPay Sandbox, thẻ sinh viên tích hợp, áp dụng Voucher giảm giá và Đăng ký vé tháng trực tuyến.
* 📍 **Theo dõi Xe buýt & Bán kính Geofencing**: Xem vị trí xe di chuyển trên bản đồ thực tế, tính toán thời gian xe đến trạm (Station ETA) và phát thông báo khi xe cách trạm dưới 500m.
* 🔄 **Hủy vé & Đổi vé linh hoạt**: Chính sách hoàn tiền tự động theo bậc thời gian (≥12h hoàn 100%, 2h-12h hoàn 90%, 15m-2h hoàn 80%).

### 2. Tài Xế & Phụ Xe (Driver & Crew Operations)
* 📱 **Giao diện Soát vé Mobile PWA**: Quét mã QR tốc độ cao bằng Camera điện thoại hoặc máy quét cầm tay, hỗ trợ chế độ Offline Cache.
* 🚨 **Cảnh báo Lên sai chuyến**: Nhận diện tức thì vé của chuyến khác, hành khách đã lên xe hoặc vé đã hết hạn.
* 🗺️ **Điều hướng & Cập nhật GPS**: Cập nhật tọa độ phương tiện định kỳ lên máy chủ điều phối qua WebSocket và REST fallback.
* ⚠️ **Báo cáo Sự cố Hành trình**: Gửi cảnh báo kẹt xe, hỏng xe, tai nạn trực tiếp về trung tâm điều hành.

### 3. Điều Hành Viên & Quản Lý Tuyến (Dispatcher Portal)
* 📋 **Điều phối Xe & Kíp lái**: Phân công tài xế, phụ xe theo biểu đồ ca trực, tự động kiểm tra tính hợp lệ của Giấy phép lái xe (GPLX).
* 🛡️ **Khóa điều xe an toàn**: Ngăn chặn tuyệt đối việc đổi xe/tài xế khi chuyến xe đang chạy (`IN_PROGRESS`).
* 🏢 **Quản trị Tuyến & Trạm**: Thiết lập lộ trình liên trạm, định giá theo chặng/khoảng cách (Haversine Formula), tự động tính cước chênh lệch.
* 🎓 **Thẩm định Hồ sơ Ưu đãi**: Phê duyệt thẻ sinh viên K22/K23, đối tượng chính sách và người cao tuổi với Lightbox soi ảnh trực quan.

### 4. Quản Trị Viên & Lãnh Đạo (Admin & Executive Analytics)
* 📊 **Dashboard Doanh thu & Tỷ lệ lấp đầy**: Báo cáo trực quan theo ngày/tháng/tuyến, đường mục tiêu KPI doanh thu, biểu đồ trực quan Recharts.
* 📑 **Xuất Báo cáo Chuẩn**: Xuất file Excel chi tiết dòng tiền và mẫu in PDF Khổ A4 trình Ban Giám Hiệu.
* 📜 **Nhật ký Kiểm toán Hệ thống (Audit Logs)**: Ghi lại đầy đủ mọi thay đổi dữ liệu trọng yếu, địa chỉ IP, User-Agent và payload trước/sau.
* 👥 **Phân quyền RBAC 4 Cấp độ**: Admin, Dispatcher, Driver, Passenger với Guard bảo vệ cấp Router và Database.

---

## 🏛️ Cấu Trúc Dự Án (Monorepo Architecture)

```
SMART BUS TICKETING SYSTEM - ICTU/
├── 📁 frontend/                     # Next.js 16 (App Router) + React 19 + TailwindCSS + Ant Design
│   ├── app/                         # Routing & Layouts (/dang-nhap, /portal, /mobile/scanner, ...)
│   ├── features/                    # Feature-Driven Modules (booking, dispatch, tracking, reports, ...)
│   ├── components/                  # UI Components, Modals, Tables, Forms
│   └── lib/                         # API Client Services, Auth Context, Types
├── 📁 backend/                      # NestJS 11 + TypeORM + PostgreSQL (Supabase) + Redis
│   ├── src/modules/                 # 16 Modules nghiệp vụ độc lập (transit, trips, booking, payment, ...)
│   ├── src/database/                # Entities, Migrations, Seed Service (Rolling window 4 ngày)
│   ├── src/common/                  # RBAC Guards, Exception Filters, Response Interceptors
│   └── test/                        # 36 File kiểm thử tự động (Unit & Integration)
├── 📁 docs/                         # Đặc tả tài liệu kỹ thuật SRS, Báo cáo kiểm thử Sprint 1 & Sprint 2
├── 📁 scripts/                      # Kịch bản khởi động song song dev server và kiểm thử tự động
├── 📄 PROJECT_STRUCTURE.md          # Tài liệu chi tiết cấu trúc thư mục
├── 📄 TECH_STACK.md                 # Tài liệu chuyên sâu về kiến trúc công nghệ
├── 📄 package.json                  # Monorepo Orchestration script
└── ⚙️ start-dev.bat                 # Khởi động 1 chạm cả Frontend và Backend trên Windows
```

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

| Phân hệ | Công nghệ | Mục đích sử dụng |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16 (Turbopack)** | Tối ưu SEO, SSR, App Router hiệu năng cao |
| **Giao diện & UI** | **Tailwind CSS + Ant Design 5** | Light Theme chuẩn nhận diện ICTU `#005A36` |
| **Bản đồ Realtime** | **Leaflet + OpenStreetMap** | Hiển thị lộ trình xe chạy, trạm dừng, GPS live |
| **Backend Framework** | **NestJS 11 + TypeScript** | Kiến trúc Enterprise Module, Dependency Injection |
| **Cơ sở dữ liệu** | **PostgreSQL (Supabase Cloud)** | Lưu trữ quan hệ ACID, ràng buộc khóa ngoại chặt chẽ |
| **Bộ nhớ đệm (Cache)**| **Redis (Upstash / Local)** | Distributed Lock giữ chỗ ghế, Cache lộ trình, Pub/Sub |
| **Kiểm thử tự động** | **Vitest + Supertest** | 36 test files, 322 test cases pass 100% |
| **Thanh toán & Mail** | **VNPay API + Nodemailer (SMTP)** | Cổng thanh toán quốc gia, Email vé kèm mã QR |

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Động (Quick Start)

### 1. Yêu cầu môi trường
* **Node.js**: Phiên bản `>= 20.0.0` (Khuyên dùng `22.x` hoặc `24.x`)
* **Trình quản lý gói**: `npm` hoặc `pnpm`
* **Git**: Phiên bản mới nhất

### 2. Cài đặt Dependencies
Cài đặt dependencies cho cả Monorepo:
```bash
# Cài đặt cho Backend
cd backend
npm install

# Cài đặt cho Frontend
cd ../frontend
npm install
```

### 3. Cấu hình Biến Môi Trường (.env)
Sao chép file cấu hình mẫu tại `backend/.env.example` thành `backend/.env`:
```env
PORT=3001
DATABASE_URL=postgresql://postgres.xxx:xxx@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
REDIS_URL=redis://default:xxx@xxx.upstash.io:6379
JWT_SECRET=ICTU_SMART_BUS_JWT_SECRET_2026_KEY
VNPAY_TMN_CODE=BDCDEH71
VNPAY_HASH_SECRET=TJAWJFAONXJGYJULKCPRUYGNVXTCHGUN
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
MAIL_USER=smartbus.ictu@gmail.com
MAIL_PASS=your-smtp-app-password
```

### 4. Khởi động Ứng dụng (1 Chạm)
Tại thư mục gốc dự án:
```bash
# Cách 1: Chạy song song cả Frontend (Port 3000) và Backend (Port 3001) qua Node script
npm run dev

# Cách 2: Bấm đúp vào file start-dev.bat (Windows)
start-dev.bat
```

Sau khi khởi động:
* **Frontend Web & Portal**: `http://localhost:3000`
* **Backend REST API**: `http://localhost:3001/api/v1`
* **Swagger API Docs**: `http://localhost:3001/api/docs`

---

## 🧪 Kiểm Thử Tự Động (Automated Testing)

Toàn bộ hệ thống được bảo vệ bởi bộ test tự động Vitest bao phủ 100% các kịch bản nghiệp vụ trọng yếu:

```bash
# Chạy toàn bộ 36 file kiểm thử backend
npm run test:backend
```

**Kết quả kiểm thử:**
```
 Test Files  36 passed (36)
      Tests  322 passed (322)
   Duration  ~20s
```

---

## 👥 Đội Ngũ Phát Triển & Bản Quyền

* **Đơn vị bảo trợ**: Trường Đại học Công nghệ Thông tin & Truyền thông - Đại học Thái Nguyên (ICTU)
* **Khoa**: Công nghệ Thông tin & Kỹ thuật Phần mềm
* **Phiên bản hiện tại**: `1.0.0 (Production Release)`
* **Giấy phép**: Đồ án tốt nghiệp / Dự án nghiên cứu ứng dụng ICTU © 2026. Mọi quyền được bảo lưu.
