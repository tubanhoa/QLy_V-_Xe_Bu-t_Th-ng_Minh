# 🚌 SMART BUS TICKETING SYSTEM - ICTU
### Hệ Thống Đặt Vé & Quản Lý Xe Buýt Thông Minh Trường ĐH Công Nghệ Thông Tin & Truyền Thông (ICTU) - Đại Học Thái Nguyên

[![Next.js](https://img.shields.io/badge/Next.js-16.3.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![NestJS](https://img.shields.io/badge/NestJS-11.0.0-E0234E?style=for-the-badge&logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20Supabase-4169E1?style=for-the-badge&logo=postgresql)](https://supabase.com/)
[![Redis](https://img.shields.io/badge/Redis-Upstash%20Distributed-DC382D?style=for-the-badge&logo=redis)](https://redis.io/)
[![Vitest](https://img.shields.io/badge/Vitest-36%20Files%20Passed%20(322%2F322)-6E9F18?style=for-the-badge&logo=vitest)](https://vitest.dev/)
[![Security](https://img.shields.io/badge/Auth-HMAC--SHA256%20%7C%20RBAC-green?style=for-the-badge)](https://github.com/tubanhoa/QLy_V-_Xe_Bu-t_Th-ng_Minh)
[![Status](https://img.shields.io/badge/Release-v1.0.0%20Production%20Ready-success?style=for-the-badge)](https://github.com/tubanhoa/QLy_V-_Xe_Bu-t_Th-ng_Minh)

---

## 📑 MỤC LỤC TỔNG HỢP (TABLE OF CONTENTS)
1. [Giới Thiệu Tổng Quan & Bối Cảnh Nghiên Cứu](#1-giới-thiệu-tổng-quan--bối-cảnh-nghiên-cứu)
2. [Sơ Đồ 1: Kiến Trúc Tổng Thể Hệ Thống (System Architecture)](#2-sơ-đồ-1-kiến-trúc-tổng-thể-hệ-thống-system-architecture)
3. [Sơ Đồ 2: Cơ Sở Dữ Liệu Thực Thể Quan Hệ (ERD - Database Schema)](#3-sơ-đồ-2-cơ-sở-dữ-liệu-thực-thể-quan-hệ-erd---database-schema)
4. [Sơ Đồ 3: Luồng Đặt Vé & Khóa Chỗ Phân Tán (Distributed Seat-Lock Flow)](#4-sơ-đồ-3-luồng-đặt-vé--khóa-chỗ-phân-tán-distributed-seat-lock-flow)
5. [Sơ Đồ 4: Giám Sát GPS & Cảnh Báo Geofencing Thời Gian Thực](#5-sơ-đồ-4-giám-sát-gps--cảnh-báo-geofencing-thời-gian-thực)
6. [Sơ Đồ 5: Luồng Soát Vé QR & Chống Gian Lận (QR Verification & Anti-Fraud)](#6-sơ-đồ-5-luồng-soát-vé-qr--chống-gian-lận-qr-verification--anti-fraud)
7. [Sơ Đồ 6: Cấu Trúc Mã Nguồn Monorepo (Clean Feature-Driven)](#7-sơ-đồ-6-cấu-trúc-mã-nguồn-monorepo-clean-feature-driven)
8. [Ma Trận Phân Quyền & Vai Trò (RBAC Matrix)](#8-ma-trận-phân-quyền--vai-trò-rbac-matrix)
9. [Chính Sách Hủy & Đổi Vé Tự Động (Cancellation & Exchange Policy)](#9-chính-sách-hủy--đổi-vé-tự-động-cancellation--exchange-policy)
10. [Hướng Dẫn Cài Đặt & Triển Khai (Deployment Guide)](#10-hướng-dẫn-cài-đặt--triển-khai-deployment-guide)
11. [Báo Cáo Kiểm Thử Tự Động (Automated Testing Report)](#11-báo-cáo-kiểm-thử-tự-động-automated-testing-report)
12. [Đội Ngũ Thực Hiện & Đơn Vị Bảo Trợ](#12-đội-ngũ-thực-hiện--đơn-vị-bảo-trợ)

---

## 1. Giới Thiệu Tổng Quan & Bối Cảnh Nghiên Cứu

**SMART BUS TICKETING SYSTEM (ICTU)** là giải pháp chuyển đổi số toàn diện cho giao thông thông minh nội bộ và liên kết đô thị tại **Trường Đại học Công nghệ Thông tin & Truyền thông - Đại học Thái Nguyên (ICTU)**.

Hệ thống giải quyết triệt để các bài toán thực tiễn:
* **Chống tranh chấp ghế (Race Condition)**: Sử dụng kỹ thuật khóa phân tán với Redis TTL khi có hàng trăm sinh viên cùng đặt vé giờ cao điểm.
* **Vé điện tử bảo mật cao**: Mã hóa chữ ký điện tử HMAC-SHA256, tự động vô hiệu hóa vé khi hành khách lên sai chuyến hoặc vé đã quét.
* **Minh bạch hóa lộ trình & điều vận**: Theo dõi xe trực tiếp trên bản đồ số, phát cảnh báo khi xe sắp cập bến qua công nghệ Geofencing.
* **Tự động hóa tài chính & báo cáo**: Tích hợp thanh toán quốc gia VNPay Sandbox, quản lý vé tháng, đối soát doanh thu xuất file Excel và mẫu in PDF khổ A4.

---

## 2. Sơ Đồ 1: Kiến Trúc Tổng Thể Hệ Thống (System Architecture)

Hệ thống được thiết kế theo kiến trúc **Micro-monolith phân tầng (Layered Architecture)** kết hợp luồng xử lý bất đồng bộ Event-Driven và Distributed Cache:

```mermaid
graph TB
    subgraph Presentation_Layer ["TẦNG TRÌNH DIỄN (CLIENTS & PRESENTATION LAYER)"]
        PassengerApp["📱 Passenger Web App<br/>(Next.js 16 App Router / Responsive)"]
        DriverApp["📲 Driver Mobile Scanner PWA<br/>(Camera QR Scanner / Offline Cache)"]
        AdminPortal["💻 Dispatcher & Admin Portal<br/>(Quản trị, Giám sát GPS, Báo cáo A4)"]
    end

    subgraph Gateway_Security ["TẦNG BẢO MẬT & ĐIỀU PHỐI (GATEWAY & SECURITY)"]
        ReverseProxy["Reverse Proxy / Nginx"]
        RateLimiter["Rate Limiter & Anti-Spam Guard"]
        JWT_Guard["JWT Auth Guard & Refresh Rotation"]
        RBAC_Guard["RBAC Permission Guard (Roles & Scopes)"]
    end

    subgraph Backend_Core ["TẦNG XỬ LÝ NGHIỆP VỤ (NESTJS MICRO-MONOLITH APPLICATION CORE)"]
        AuthModule["🔐 Auth & Identity Module<br/>(Bcrypt, JWT, Role Permissions)"]
        TransitModule["🚌 Transit & Route Module<br/>(Haversine Distance, Route Stations)"]
        TripsModule["📅 Trip Scheduling & Dispatch<br/>(Rolling Window 4-Day Generator)"]
        BookingModule["💺 Booking & Seat-Lock Service<br/>(Distributed Lock, 10-Min Reservation)"]
        PaymentModule["💳 Payment & VNPay Service<br/>(HMAC Checksum, IPN Webhook)"]
        TrackingModule["📍 Tracking & Geofencing Gateway<br/>(WebSocket WSS, Station ETA Radar)"]
        ReportModule["📊 Reporting & Audit Engine<br/>(Excel Export, PDF Renderer)"]
        NotificationModule["🔔 Notification Center<br/>(FCM Web Push, Nodemailer SMTP)"]
    end

    subgraph Data_Storage ["TẦNG DỮ LIỆU & BỘ NHỚ ĐỆM (DATA PERSISTENCE & CACHE)"]
        PostgresDB[("🐘 PostgreSQL 16 (Supabase Cloud)<br/>ACID Relational, Foreign Keys, PostGIS")]
        RedisCache[("⚡ Redis Distributed Cache (Upstash)<br/>Seat Lock TTL, GPS Lat/Lng, Pub/Sub")]
        FileStorage[("📁 File Storage / Uploads<br/>HSSV Proofs, GPLX, Service Invoices")]
    end

    subgraph External_Integrations ["DỊCH VỤ NGOÀI (EXTERNAL INTEGRATIONS)"]
        VNPay["🏦 VNPay Payment Gateway Sandbox"]
        FCM["📲 Firebase Cloud Messaging (FCM)"]
        SMTP["📧 Google SMTP Server (Nodemailer)"]
        OSRM["🗺️ OpenStreetMap / OSRM Routing"]
    end

    %% Presentation to Gateway
    PassengerApp --> ReverseProxy
    DriverApp --> ReverseProxy
    AdminPortal --> ReverseProxy

    ReverseProxy --> RateLimiter --> JWT_Guard --> RBAC_Guard

    %% Gateway to Modules
    RBAC_Guard --> AuthModule
    RBAC_Guard --> TransitModule
    RBAC_Guard --> TripsModule
    RBAC_Guard --> BookingModule
    RBAC_Guard --> PaymentModule
    RBAC_Guard --> TrackingModule
    RBAC_Guard --> ReportModule
    RBAC_Guard --> NotificationModule

    %% Modules to Storage
    BookingModule -.->|SETNX seat_lock| RedisCache
    TrackingModule -.->|GPS Cache & ETA| RedisCache
    AuthModule --> PostgresDB
    TransitModule --> PostgresDB
    TripsModule --> PostgresDB
    BookingModule --> PostgresDB
    PaymentModule --> PostgresDB
    ReportModule --> PostgresDB

    %% Modules to External
    PaymentModule <==>|Redirect / IPN Callback| VNPay
    NotificationModule ==>|Push Notification| FCM
    NotificationModule ==>|Send PDF Tickets| SMTP
    TrackingModule ==>|Map Routing Data| OSRM
```

---

## 3. Sơ Đồ 2: Cơ Sở Dữ Liệu Thực Thể Quan Hệ (ERD - Database Schema)

Hệ thống cơ sở dữ liệu quan hệ được thiết kế chuẩn hóa bậc 3 (3NF) với đầy đủ ràng buộc toàn vẹn khóa ngoại (Foreign Keys), chỉ mục tìm kiếm và khóa logic chống rò rỉ:

```mermaid
erDiagram
    ROLES ||--o{ USERS : "has"
    USERS ||--o{ DRIVER_PROFILES : "owns"
    USERS ||--o{ BOOKINGS : "creates"
    USERS ||--o{ MONTHLY_PASSES : "registers"
    USERS ||--o{ FEEDBACKS : "submits"
    USERS ||--o{ ACTIVITY_LOGS : "triggers"

    ROUTES ||--o{ ROUTE_STATIONS : "contains"
    STATIONS ||--o{ ROUTE_STATIONS : "located_at"
    ROUTES ||--o{ TRIPS : "scheduled_for"
    
    VEHICLES ||--o{ SEATS : "configured_with"
    VEHICLES ||--o{ TRIPS : "assigned_to"
    USERS ||--o{ TRIPS : "drives"

    TRIPS ||--o{ BOOKINGS : "booked_on"
    TRIPS ||--o{ TRIP_INCIDENTS : "logs"

    BOOKINGS ||--o{ TICKETS : "contains"
    SEATS ||--o{ TICKETS : "reserved_for"
    BOOKINGS ||--o{ PAYMENTS : "paid_by"
    VOUCHERS ||--o{ BOOKINGS : "discounted_by"

    ROLES {
        uuid id PK
        varchar name "ADMIN | DISPATCHER | DRIVER | PASSENGER"
        varchar description
    }

    USERS {
        uuid id PK
        varchar email UK
        varchar phone_number
        varchar password_hash
        varchar full_name
        varchar student_id
        varchar faculty
        varchar status "active | inactive | pending_approval"
        uuid role_id FK
    }

    DRIVER_PROFILES {
        uuid id PK
        uuid user_id FK
        varchar license_number UK
        varchar license_class "D | E"
        date license_expiry
        varchar approval_status "approved | pending | rejected"
    }

    ROUTES {
        uuid id PK
        varchar route_code UK "CT-01, CT-02"
        varchar name
        varchar origin
        varchar destination
        decimal distance_km
        decimal base_price
        decimal student_price
        varchar status "active | inactive | deleted"
    }

    STATIONS {
        uuid id PK
        varchar name
        decimal latitude
        decimal longitude
        boolean is_hub
    }

    ROUTE_STATIONS {
        uuid id PK
        uuid route_id FK
        uuid station_id FK
        int stop_order
        decimal distance_from_origin_km
        int estimated_minutes
    }

    VEHICLES {
        uuid id PK
        varchar license_plate UK
        varchar model
        varchar vehicle_type "electric | diesel"
        int seat_capacity "28"
        varchar status "active | maintenance | inactive"
    }

    SEATS {
        uuid id PK
        uuid vehicle_id FK
        varchar seat_number "01A -> 07D"
        int row_number
        varchar column_label "A | B | C | D"
        varchar seat_type "standard | priority"
    }

    TRIPS {
        uuid id PK
        uuid route_id FK
        uuid vehicle_id FK
        uuid driver_id FK
        timestamp departure_time
        timestamp arrival_time
        varchar status "scheduled | boarding | in_progress | completed | cancelled"
    }

    BOOKINGS {
        uuid id PK
        varchar booking_code UK "ICTU-XXXXXX"
        uuid user_id FK
        uuid trip_id FK
        uuid voucher_id FK
        decimal original_amount
        decimal discount_amount
        decimal final_amount
        varchar status "pending | confirmed | cancelled | refunded"
    }

    TICKETS {
        uuid id PK
        uuid booking_id FK
        uuid seat_id FK
        varchar ticket_code UK
        varchar passenger_name
        varchar qr_signature "HMAC-SHA256"
        varchar status "reserved | paid | boarded | cancelled | refunded | expired"
    }

    PAYMENTS {
        uuid id PK
        uuid booking_id FK
        varchar payment_method "vnpay | student_wallet | cash"
        varchar transaction_ref UK
        decimal amount
        varchar status "pending | completed | failed | refunded"
    }

    VOUCHERS {
        uuid id PK
        varchar code UK "ICTU2026, VETHANG_50K"
        varchar discount_type "percentage | fixed_amount"
        decimal discount_value
        decimal min_order_value
        date end_date
        varchar status "active | expired"
    }
```

---

## 4. Sơ Đồ 3: Luồng Đặt Vé & Khóa Chỗ Phân Tán (Distributed Seat-Lock Flow)

Để ngăn chặn hiện tượng tranh chấp ghế (2 hành khách cùng chọn một ghế tại cùng một thời điểm), hệ thống áp dụng cơ chế **Atomic Distributed Lock với Redis TTL 10 phút**:

```mermaid
sequenceDiagram
    autonumber
    actor Passenger as 🧑‍🎓 Sinh Viên / Hành Khách
    participant FE as 🖥️ Next.js Web App
    participant BE as ⚙️ NestJS Booking Service
    participant Redis as ⚡ Redis Lock Cache
    participant DB as 🐘 PostgreSQL (Supabase)
    participant VNPay as 🏦 Cổng VNPay Sandbox
    participant Mailer as 📧 Nodemailer Mail Service

    Passenger->>FE: Chọn tuyến, ngày đi, chuyến xe & số ghế (VD: 03B)
    FE->>BE: POST /api/v1/booking/hold-seat { tripId, seatNumber: "03B" }
    
    rect rgb(240, 248, 255)
        Note over BE,Redis: Cơ chế Khóa Phân Tán (Distributed Lock)
        BE->>Redis: SET seat_lock:tripId:03B userId NX PX 600000 (10 phút)
        alt Ghế đã bị người khác khóa
            Redis-->>BE: Nil (Lock Failed)
            BE-->>FE: 409 Conflict ("Ghế 03B đang được giữ chỗ bởi hành khách khác")
            FE-->>Passenger: Hiển thị cảnh báo ghế bận & cập nhật lại sơ đồ
        else Khóa thành công
            Redis-->>BE: OK (Lock Acquired)
            BE->>DB: INSERT INTO bookings & tickets (status = 'reserved')
            BE-->>FE: 201 Created { bookingId, holdExpiresAt: 10 mins }
            FE-->>Passenger: Bắt đầu đếm ngược 10:00 & hiển thị nút thanh toán
        end
    end

    Passenger->>FE: Bấm "Thanh Toán VNPay" (hoặc Áp mã giảm giá Voucher)
    FE->>BE: POST /api/v1/payment/create-url { bookingId }
    BE->>BE: Tạo URL VNPay kèm chữ ký kiểm tra HMAC-SHA512
    BE-->>FE: Trả về Payment Redirect URL
    FE->>VNPay: Chuyển hướng hành khách tới Cổng thanh toán VNPay

    Passenger->>VNPay: Quét mã QR / Nhập thẻ ATM Sandbox & xác nhận OTP
    VNPay->>BE: Webhook IPN Callback (GET /api/v1/payment/vnpay-ipn)
    
    rect rgb(245, 255, 245)
        Note over BE,DB: Đối Soát Giao Dịch & Kích Hoạt Vé
        BE->>BE: Xác minh chữ ký vnp_SecureHash từ VNPay
        BE->>DB: UPDATE payments SET status = 'completed'
        BE->>DB: UPDATE bookings SET status = 'confirmed'
        BE->>DB: UPDATE tickets SET status = 'paid', qr_signature = HMAC(ticketCode)
        BE->>Redis: DEL seat_lock:tripId:03B (Giải phóng khóa giữ chỗ)
        BE-->>VNPay: Trả về RspCode: '00' (Xác nhận thành công)
    end

    BE->>Mailer: Gửi email tự động kèm vé điện tử PDF + QR Code
    Mailer-->>Passenger: Hộp thư đến: "Vé xe buýt ICTU đã thanh toán thành công!"
    VNPay-->>FE: Chuyển hướng hành khách về /payment/result?bookingCode=...
    FE-->>Passenger: Hiển thị màn hình Chúc mừng & Vé điện tử QR
```

---

## 5. Sơ Đồ 4: Giám Sát GPS & Cảnh Báo Geofencing Thời Gian Thực

Hệ thống cho phép hiển thị vị trí phương tiện liên tục và tự động phát cảnh báo khi xe chuẩn bị vào trạm dừng:

```mermaid
flowchart TD
    DriverGPS["📱 Thiết bị Tài xế / GPS Tracker<br/>(Vĩ độ, Kinh độ, Tốc độ, Hướng)"]
    WebSocketGW["📡 WebSocket Gateway (WSS)<br/>/tracking/gps-stream"]
    KalmanFilter["🛡️ Bộ Lọc Dữ Liệu GPS<br/>(Loại bỏ nhiễu, Vận tốc > 150km/h Outlier)"]
    RedisGeo["⚡ Redis Geospatial Cache<br/>GEOADD bus_locations tripId Lat Lon"]
    
    GeofenceEngine["🎯 Geofencing Evaluation Engine<br/>Tính khoảng cách tới Trạm kế tiếp (Haversine)"]
    CheckRadius{"Khoảng cách d < 500m<br/>hoặc ETA < 3 phút?"}
    
    PushService["🔔 Notification Center<br/>(Firebase Cloud Messaging Web Push)"]
    LiveMapClient["🗺️ Bản Đồ Trực Tuyến Hành Khách<br/>(Leaflet Realtime Marker Update)"]
    AlertPassenger["📢 Thông Báo Sinh Viên:<br/>'Xe buýt sắp cập trạm đón bạn!'"]

    DriverGPS -->|Ping mỗi 5s| WebSocketGW
    WebSocketGW --> KalmanFilter
    KalmanFilter --> RedisGeo
    RedisGeo --> LiveMapClient
    
    KalmanFilter --> GeofenceEngine
    GeofenceEngine --> CheckRadius
    CheckRadius -- "ĐÚNG (Trúng Geofence)" --> PushService
    CheckRadius -- "SAI (Còn xa trạm)" --> LiveMapClient
    PushService --> AlertPassenger
```

---

## 6. Sơ Đồ 5: Luồng Soát Vé QR & Chống Gian Lận (QR Verification & Anti-Fraud)

Quy trình soát vé tại cửa xe buýt được bảo vệ 3 lớp chống vé giả, vé dùng lại hoặc lên sai chuyến:

```mermaid
stateDiagram-v2
    [*] --> ScanQR: Tài xế quét mã QR bằng Mobile PWA Scanner
    
    ScanQR --> CheckHMAC: Giải mã Payload & Kiểm tra chữ ký HMAC-SHA256
    CheckHMAC --> InvalidTicket: Chữ ký không khớp / Dữ liệu bị can thiệp
    InvalidTicket --> [*]: ❌ 400 Bad Request ("Chữ ký số không hợp lệ")

    CheckHMAC --> CheckTrip: Đối chiếu TripID của vé với Chuyến xe đang chạy
    CheckTrip --> WrongTrip: TripID của vé ≠ Chuyến xe hiện tại
    WrongTrip --> [*]: ⚠️ 400 Bad Request ("Sai chuyến xe! Vé dành cho chuyến khác")

    CheckTrip --> CheckStatus: Kiểm tra trạng thái vé trong cơ sở dữ liệu
    CheckStatus --> AlreadyBoarded: Trạng thái = 'boarded'
    AlreadyBoarded --> [*]: ⛔ 400 Bad Request ("Vé đã được quét lên xe trước đó")

    CheckStatus --> ExpiredTicket: Trạng thái = 'expired' hoặc 'cancelled'
    ExpiredTicket --> [*]: ❌ 400 Bad Request ("Vé đã hủy hoặc hết hạn sử dụng")

    CheckStatus --> ValidCheckIn: Trạng thái = 'paid'
    ValidCheckIn --> UpdateStatus: Cập nhật status = 'boarded', actualCheckIn = NOW()
    UpdateStatus --> TriggerSound: Phát âm thanh Ting Ting ✅ & Rung haptic điện thoại
    TriggerSound --> [*]: Cho phép hành khách lên xe an toàn!
```

---

## 7. Sơ Đồ 6: Cấu Trúc Mã Nguồn Monorepo (Clean Feature-Driven)

```mermaid
graph LR
    Root["SMART BUS TICKETING SYSTEM (ICTU)"]
    
    subgraph Frontend_Tree ["📁 frontend/ (Next.js 16 + React 19)"]
        F_App["app/ (App Router & Pages)"]
        F_Features["features/ (Feature-Driven Business Code)"]
        F_Components["components/ (Shared Layouts, Modals, Forms)"]
        F_Lib["lib/ (API Client, RBAC, Auth Context)"]
        F_Public["public/ (Assets, Logos, Static Data)"]
    end

    subgraph Backend_Tree ["📁 backend/ (NestJS 11 + TypeORM)"]
        B_Modules["src/modules/ (16 Nghiệp Vụ Micro-Monolith)"]
        B_DB["src/database/ (Entities, Seeds, Schema SQL)"]
        B_Common["src/common/ (Guards, Filters, Interceptors)"]
        B_Test["test/ (36 Automated Test Suites)"]
    end

    subgraph Root_Orchestration ["📁 scripts/ & configs"]
        S_Dev["scripts/start-dev.mjs (Song song FE + BE)"]
        S_Bat["start-dev.bat (1 chạm khởi động)"]
        S_Docs["docs/ (Tài liệu SRS & Sprint Reports)"]
    end

    Root --> Frontend_Tree
    Root --> Backend_Tree
    Root --> Root_Orchestration
```

---

## 8. Ma Trận Phân Quyền & Vai Trò (RBAC Matrix)

Hệ thống phân định rạch ròi 4 cấp độ quyền hạn truy cập:

| Mã quyền / Nghiệp vụ | 🧑‍💼 Admin (Quản trị) | 🎛️ Dispatcher (Điều hành) | 👨‍✈️ Driver (Tài xế/Phụ xe) | 🧑‍🎓 Passenger (Hành khách) |
| :--- | :---: | :---: | :---: | :---: |
| **Tra cứu chuyến & Lộ trình trạm** | ✅ | ✅ | ✅ | ✅ |
| **Đặt vé, Giữ chỗ & Thanh toán VNPay** | ❌ | ❌ | ❌ | ✅ |
| **Hủy vé & Đổi chuyến tự động** | ❌ | ❌ | ❌ | ✅ |
| **Đăng ký & Nạp tiền Vé tháng sinh viên** | ❌ | ❌ | ❌ | ✅ |
| **Đánh giá chuyến đi & Gửi khiếu nại** | ❌ | ❌ | ❌ | ✅ |
| **Quét vé QR PWA Camera Scanner** | ❌ | ❌ | ✅ | ❌ |
| **Cập nhật tọa độ GPS hành trình xe** | ❌ | ❌ | ✅ | ❌ |
| **Gửi cảnh báo sự cố dọc đường** | ❌ | ❌ | ✅ | ❌ |
| **Phân công ca chạy, xe & tài xế** | ✅ | ✅ | ❌ | ❌ |
| **Khóa điều xe an toàn (`IN_PROGRESS`)** | ✅ | ✅ | ❌ | ❌ |
| **Thẩm định hồ sơ ưu đãi HSSV / CCCD** | ✅ | ✅ | ❌ | ❌ |
| **Quản trị Tuyến, Trạm & Biểu giá** | ✅ | ❌ | ❌ | ❌ |
| **Quản lý Voucher & Khuyến mại** | ✅ | ❌ | ❌ | ❌ |
| **Dashboard Doanh thu & Tỷ lệ lấp đầy** | ✅ | ✅ | ❌ | ❌ |
| **Xuất báo cáo PDF Khổ A4 & Excel dòng tiền**| ✅ | ✅ | ❌ | ❌ |
| **Xem Nhật ký Hệ thống (Audit Logs)** | ✅ | ❌ | ❌ | ❌ |

---

## 9. Chính Sách Hủy & Đổi Vé Tự Động (Cancellation & Exchange Policy)

Hệ thống áp dụng chính sách hoàn vé thông minh bảo vệ quyền lợi sinh viên và chống giữ chỗ ảo:

```mermaid
gantt
    title Mức Phí Hủy Vé Tự Động Dựa Theo Thời Gian Khởi Hành
    dateFormat X
    axisFormat %s giờ

    section Chính Sách Hoàn Tiền
    Khởi hành >= 12h (Hoàn 100%, Phí 0%)      :crit, 0, 12
    Khởi hành 2h - 12h (Hoàn 90%, Phí 10%)    :active, 12, 22
    Khởi hành 15m - 2h (Hoàn 80%, Phí 20%)    :done, 22, 23.75
    Khởi hành < 15 phút (Không thể hủy)      :milestone, 23.75, 24
```

* **Quy tắc làm mát (Cooling-off Period)**: Nếu vé vừa đặt trong vòng **30 phút**, hành khách được phép hủy nhận lại **100% tiền** bất kể thời gian khởi hành của chuyến.
* **Đổi vé sang chuyến khác**:
  * Trước giờ chạy ≥ 12 giờ: Miễn phí đổi vé.
  * Trước 2h - 12h: Phí đổi vé 5% giá trị vé.
  * Trước 15m - 2h: Phí đổi vé 10% giá trị vé.
  * Trước < 15 phút: Khóa chức năng đổi vé.

---

## 10. Hướng Dẫn Cài Đặt & Triển Khai (Deployment Guide)

### 1. Yêu cầu hệ điều hành & môi trường
* **Node.js**: Phiên bản `v20.x`, `v22.x` hoặc `v24.x LTS`.
* **Trình quản lý gói**: `npm` (mặc định kèm theo Node) hoặc `pnpm`.
* **Database**: PostgreSQL 16 trở lên có hỗ trợ tiện ích mở rộng PostGIS.
* **Cache**: Redis Server 6.x trở lên hoặc Cloud Upstash.

### 2. Cài đặt các thư viện phụ thuộc (Dependencies)
```bash
# Cài đặt toàn bộ Monorepo chỉ với 1 dòng lệnh
npm --prefix backend install && npm --prefix frontend install
```

### 3. Cấu hình biến môi trường (`backend/.env`)
Tạo tệp `backend/.env` với các tham số mẫu:
```env
# Server Configuration
PORT=3001
NODE_ENV=development

# PostgreSQL Database (Supabase Pooler)
DATABASE_URL=postgresql://postgres.xxx:xxx@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require

# Redis Distributed Cache
REDIS_URL=redis://default:xxx@xxx.upstash.io:6379

# JWT Secret Keys
JWT_SECRET=ICTU_SMART_BUS_SECRET_2026_PRODUCTION_KEY
JWT_EXPIRATION=7d

# VNPay Payment Gateway Sandbox
VNPAY_TMN_CODE=BDCDEH71
VNPAY_HASH_SECRET=TJAWJFAONXJGYJULKCPRUYGNVXTCHGUN
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3000/payment/result

# Email Delivery (Google App Password)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=smartbus.ictu@gmail.com
MAIL_PASS=xxxx-xxxx-xxxx-xxxx
MAIL_FROM="Smart Bus ICTU" <smartbus.ictu@gmail.com>
```

### 4. Khởi động hệ thống (Single Command)
```bash
# Khởi động song song cả Backend (Port 3001) và Frontend (Port 3000)
npm run dev

# Hoặc khởi chạy nhanh trên Windows
start-dev.bat
```

---

## 11. Báo Cáo Kiểm Thử Tự Động (Automated Testing Report)

Hệ thống được kiểm thử tự động toàn diện bằng **Vitest** với độ phủ bao quát tất cả luồng dữ liệu thực tế và mô phỏng:

```bash
# Chạy bộ kiểm thử tự động
npm run test:backend
```

```
================================================================================
                    AUTOMATED TEST EXECUTION SUMMARY
================================================================================
 ✓ test/search-hardening.spec.ts (3 tests)
 ✓ test/real-endpoints-verification.spec.ts (4 tests)
 ✓ test/tracking-realtime-and-eta.spec.ts (17 tests)
 ✓ test/incident-flow-integration.spec.ts (7 tests)
 ✓ test/ticket-cancel-and-exchange.spec.ts (10 tests)
 ✓ test/auth-register-integration.spec.ts (13 tests)
 ✓ test/transit-management-and-integrity.spec.ts (16 tests)
 ✓ test/trip-dispatch-and-crew-notification.spec.ts (10 tests)
 ✓ test/security-and-auth-hardening.spec.ts (10 tests)
 ✓ test/seat-hold-payment.spec.ts (10 tests)
 ✓ test/qr-ticket-notification.spec.ts (10 tests)
 ✓ test/qa/sprint1-core-features.spec.ts (32 tests)
 ✓ test/qa/sprint2-advanced-features.spec.ts (17 tests)
 ✓ test/entrypoint-standardization.spec.ts (12 tests)
 ✓ test/unit/conductor-creation-and-dispatch-constraints.spec.ts (10 tests)
 ✓ ... and 21 other unit test suites ...

 Test Files  36 passed (36)
      Tests  322 passed (322)
   Duration  ~20.5s (Transform: 12.9s, Tests execution: 51.6s parallelized)
   Status    100% PASSED (0 ERRORS, 0 REGRESSIONS)
================================================================================
```

---

## 12. Đội Ngũ Thực Hiện & Đơn Vị Bảo Trợ

* **Đơn vị chủ trì**: Trường Đại học Công nghệ Thông tin & Truyền thông - Đại học Thái Nguyên (ICTU)
* **Chương trình đào tạo**: Kỹ sư Công nghệ Thông tin & Kỹ thuật Phần mềm
* **Sản phẩm bàn giao**: Bản phát hành chính thức `Release v1.0.0`
* **Bản quyền**: © 2026 SMART BUS TICKETING SYSTEM - ICTU. Mọi quyền được bảo lưu.
