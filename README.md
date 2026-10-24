# Smart Bus Ticketing System (SBTS) - ICTU
## Hệ Thống Đặt Vé & Quản Lý Vận Tải Xe Buýt Thông Minh Cấp Doanh Nghiệp
**Trường Đại học Công nghệ Thông tin và Truyền thông (ICTU) - Đại học Thái Nguyên**

[![Next.js](https://img.shields.io/badge/Next.js-16.3.3-000000?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-20232A?style=flat-square&logo=react)](https://react.dev/)
[![NestJS](https://img.shields.io/badge/NestJS-11.0.0-E0234E?style=flat-square&logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20Supabase-336791?style=flat-square&logo=postgresql)](https://supabase.com/)
[![Redis](https://img.shields.io/badge/Redis-Upstash%20Distributed-DC382D?style=flat-square&logo=redis)](https://redis.io/)
[![Vitest](https://img.shields.io/badge/Vitest-36%20Suites%20Passed%20(322%2F322)-729B1B?style=flat-square&logo=vitest)](https://vitest.dev/)
[![KienTruc](https://img.shields.io/badge/KienTruc-Monorepo%20Clean%20Architecture-005A36?style=flat-square)](https://github.com/tubanhoa/QLy_V-_Xe_Bu-t_Th-ng_Minh)
[![BaoMat](https://img.shields.io/badge/BaoMat-HMAC--SHA256%20%7C%20RBAC%20Cap%204-blue?style=flat-square)](https://github.com/tubanhoa/QLy_V-_Xe_Bu-t_Th-ng_Minh)

---

## Mục Lục Tổng Hợp
1. [Tổng Quan Dự Án & Mục Tiêu Kỹ Thuật](#1-tổng-quan-dự-án--mục-tiêu-kỹ-thuật)
2. [Đặc Tả Thuật Toán & Cơ Sở Toán Học](#2-đặc-tả-thuật-toán--cơ-sở-toán-học)
3. [Sơ Đồ 1: Kiến Trúc Phân Tầng Hệ Thống (Mô Hình C4)](#3-sơ-đồ-1-kiến-trúc-phân-tầng-hệ-thống-mô-hình-c4)
4. [Sơ Đồ 2: Cơ Sở Dữ Liệu Thực Thể Quan Hệ (ERD)](#4-sơ-đồ-2-cơ-sở-dữ-liệu-thực-thể-quan-hệ-erd)
5. [Sơ Đồ 3: Quy Trình Giữ Chỗ & Khóa Phân Tán (Distributed Seat-Lock)](#5-sơ-đồ-3-quy-trình-giữ-chỗ--khóa-phân-tán-distributed-seat-lock)
6. [Sơ Đồ 4: Luồng Xử Lý Định Vị GPS & Cảnh Báo Geofencing Thời Gian Thực](#6-sơ-đồ-4-luồng-xử-lý-định-vị-gps--cảnh-báo-geofencing-thời-gian-thực)
7. [Sơ Đồ 5: Máy Trạng Thái Soát Vé QR & Cơ Chế Chống Gian Lận](#7-sơ-đồ-5-máy-trạng-thái-soát-vé-qr--cơ-chế-chống-gian-lận)
8. [Sơ Đồ 6: Cấu Trúc Mã Nguồn Monorepo Hướng Tính Năng](#8-sơ-đồ-6-cấu-trúc-mã-nguồn-monorepo-hướng-tính-năng)
9. [Ma Trận Phân Quyền Truy Cập (RBAC Matrix)](#9-ma-trận-phân-quyền-truy-cập-rbac-matrix)
10. [Chính Sách Hoàn Tiền & Đổi Vé Tự Động](#10-chính-sách-hoàn-tiền--đổi-vé-tự-động)
11. [Hướng Dẫn Cài Đặt & Triển Khai Hệ Thống](#11-hướng-dẫn-cài-đặt--triển-khai-hệ-thống)
12. [Báo Cáo Kiểm Thử Tự Động & Chỉ Số Chất Lượng](#12-báo-cáo-kiểm-thử-tự-động--chỉ-số-chất-lượng)
13. [Thông Tin Bản Quyền & Đơn Vị Quản Lý](#13-thông-tin-bản-quyền--đơn-vị-quản-lý)

---

## 1. Tổng Quan Dự Án & Mục Tiêu Kỹ Thuật

**Hệ Thống Đặt Vé & Quản Lý Xe Buýt Thông Minh (SBTS)** là giải pháp chuyển đổi số toàn diện cho mạng lưới giao thông đưa đón sinh viên, giảng viên và cán bộ tại **Trường Đại học Công nghệ Thông tin & Truyền thông - Đại học Thái Nguyên (ICTU)**.

Hệ thống giải quyết triệt để các hạn chế của mô hình xe buýt truyền thống thông qua việc áp dụng các tiêu chuẩn kỹ thuật phần mềm cấp công nghiệp:
* **Khóa Chỗ Phân Tán Chống Xung Đột (Concurrency Safety)**: Triệt tiêu hoàn toàn hiện tượng tranh chấp ghế (Race Condition) trong các đợt cao điểm đăng ký chuyến nhờ cơ chế khóa nguyên tử phân tán trên nền Redis.
* **Xác Thực Mật Mã Không Phụ Thuộc Mạng (Zero-Trust Cryptographic Validation)**: Vé điện tử được ký số bảo mật bằng thuật toán HMAC-SHA256, hỗ trợ thiết bị quét của tài xế kiểm tra tính toàn vẹn ngay cả khi mất kết nối mạng.
* **Giám Sát Vận Hành Thời Gian Thực (Real-Time Telemetry & Geofencing)**: Thu nhận và lọc nhiễu tọa độ GPS của đoàn xe, tự động kích hoạt thông báo đẩy khi xe tiến vào vùng bán kính tiếp cận trạm dừng.
* **Đối Soát & Thanh Toán Tự Động (Deterministic Settlement)**: Đồng bộ hai chiều với Cổng thanh toán quốc gia VNPay Sandbox, tự động thu hồi ghế chưa thanh toán khi quá hạn giữ chỗ 10 phút.

## 2. Sơ Đồ 1: Kiến Trúc Phân Tầng Hệ Thống (Mô Hình C4)

Kiến trúc hệ thống được xây dựng theo mô hình Micro-monolith phân tầng nghiêm ngặt, kết hợp xử lý sự kiện bất đồng bộ và bộ nhớ đệm phân tán:

```mermaid
graph TB
    subgraph Tang_Trinh_Dien ["TẦNG TRÌNH DIỄN (CLIENTS & PRESENTATION LAYER)"]
        WebPassenger["Cổng Thông Tin Hành Khách<br/>Next.js 16 App Router / React 19"]
        MobileDriver["Giao Diện Soát Vé Di Động<br/>PWA Camera Scanner / Bộ Nhớ Đệm Offline"]
        AdminConsole["Bảng Điều Khiển Quản Trị & Vận Hành<br/>Recharts / Bản Đồ Leaflet / Mẫu In A4"]
    end

    subgraph Tang_Bao_Mat ["TẦNG CỔNG KẾT NỐI & BẢO MẬT (GATEWAY & SECURITY)"]
        NginxProxy["Máy Chủ Proxy Ngược & Cắt SSL"]
        ThrottlerGuard["Bộ Giới Hạn Tần Suất & Chống Spam"]
        JWTAuthenticator["Bộ Xác Thực JWT & Đảo Token"]
        RBACInterceptor["Bộ Kiểm Soát Phân Quyền Vai Trò"]
    end

    subgraph Tang_Nghiep_Vu ["TẦNG XỬ LÝ NGHIỆP VỤ (NESTJS MICRO-MONOLITH APPLICATION CORE)"]
        TransitSvc["Module Quản Lý Mạng Lưới Tuyến<br/>Danh Sách Trạm, Khoảng Cách Haversine"]
        TripDispatchSvc["Module Điều Phối Lịch Trình & Kíp Lái<br/>Bộ Sinh Lịch Trình Tự Động 4 Ngày"]
        BookingLockSvc["Dịch Vụ Đặt Vé & Khóa Ghế Phân Tán<br/>Quản Trị Khóa Nguyên Tử 10 Phút"]
        PaymentSvc["Động Cơ Thanh Toán & Đối Soát<br/>VNPay Sandbox, Xác Minh Mã Băm Bảo Mật"]
        TrackingGateway["Cổng Định Vị & Theo Dõi Trực Tuyến<br/>WebSocket WSS, Lọc Nhiễu, Ra-đa ETA"]
        AuditEngine["Bộ Ghi Nhật Ký Hệ Thống & Báo Cáo<br/>Lưu Vết Biến Động, Xuất Excel, Kết Xuất PDF"]
        NotificationHub["Trung Tâm Điều Phối Thông Báo<br/>Thông Báo Đẩy FCM, Gửi Vé Mail SMTP"]
    end

    subgraph Tang_Luu_Tru ["TẦNG LƯU TRỮ DỮ LIỆU & BỘ NHỚ ĐỆM (PERSISTENCE & CACHE)"]
        PostgresCluster[("Cơ Sở Dữ Liệu PostgreSQL 16 (Supabase)<br/>Giao Dịch ACID, Ràng Buộc Khóa Ngoại, PostGIS")]
        RedisCluster[("Động Cơ Bộ Nhớ Đệm Redis (Upstash)<br/>Khóa Phân Tán, Tọa Độ GPS, Xuất/Nhận Tin")]
        FileRepository[("Kho Lưu Trữ Tệp Tĩnh<br/>Minh Chứng HSSV, Bằng Lái Xe, Hóa Đơn")]
    end

    subgraph Dịch_Vu_Ngoai ["DỊCH VỤ NGOÀI & TÍCH HỢP ĐỐI TÁC (EXTERNAL INTEGRATIONS)"]
        VNPayGateway["Cổng Thanh Toán Quốc Gia VNPay"]
        FirebaseFCM["Hạ Tầng Thông Báo Đẩy Firebase FCM"]
        SMTPServer["Máy Chủ Chuyển Tiếp Thư Google SMTP"]
        OSRMEngine["Hệ Thống Bản Đồ Mã Nguồn Mở OSRM"]
    end

    WebPassenger --> NginxProxy
    MobileDriver --> NginxProxy
    AdminConsole --> NginxProxy

    NginxProxy --> ThrottlerGuard --> JWTAuthenticator --> RBACInterceptor

    RBACInterceptor --> TransitSvc
    RBACInterceptor --> TripDispatchSvc
    RBACInterceptor --> BookingLockSvc
    RBACInterceptor --> PaymentSvc
    RBACInterceptor --> TrackingGateway
    RBACInterceptor --> AuditEngine
    RBACInterceptor --> NotificationHub

    BookingLockSvc -.->|Thiết Lập / Giải Phóng Khóa| RedisCluster
    TrackingGateway -.->|Truyền Luồng Tọa Độ Trực Tuyến| RedisCluster
    TransitSvc --> PostgresCluster
    TripDispatchSvc --> PostgresCluster
    BookingLockSvc --> PostgresCluster
    PaymentSvc --> PostgresCluster
    AuditEngine --> PostgresCluster

    PaymentSvc <==>|Xác Thực Chữ Ký Kiểm Tra| VNPayGateway
    NotificationHub ==>|Giao Thức Thông Báo Web Push| FirebaseFCM
    NotificationHub ==>|Gửi Thư Điện Tử Kèm Tệp PDF| SMTPServer
    TrackingGateway ==>|Ma Trận Đường Đi & Cự Ly| OSRMEngine
```

---

## 3. Sơ Đồ 2: Cơ Sở Dữ Liệu Thực Thể Quan Hệ (ERD)

Cơ sở dữ liệu quan hệ được chuẩn hóa theo tiêu chuẩn Chuẩn 3 (3NF) nhằm đảm bảo toàn vẹn giao dịch tài chính, ngăn ngừa dị thường cập nhật và thực thi đầy đủ ràng buộc khóa ngoại:

```mermaid
erDiagram
    ROLES ||--o{ USERS : "phân_vai_trò"
    USERS ||--o{ DRIVER_PROFILES : "mở_rộng"
    USERS ||--o{ BOOKINGS : "thực_hiện"
    USERS ||--o{ MONTHLY_PASSES : "sở_hữu"
    USERS ||--o{ FEEDBACKS : "đánh_giá"
    USERS ||--o{ ACTIVITY_LOGS : "gây_ra"

    ROUTES ||--o{ ROUTE_STATIONS : "bao_gồm"
    STATIONS ||--o{ ROUTE_STATIONS : "neo_vị_trí"
    ROUTES ||--o{ TRIPS : "vận_hành"

    VEHICLES ||--o{ SEATS : "chứa"
    VEHICLES ||--o{ TRIPS : "phân_công"
    USERS ||--o{ TRIPS : "điều_khiển"

    TRIPS ||--o{ BOOKINGS : "danh_sách"
    TRIPS ||--o{ TRIP_INCIDENTS : "ghi_nhận"

    BOOKINGS ||--o{ TICKETS : "phát_hành"
    SEATS ||--o{ TICKETS : "chỉ_định"
    BOOKINGS ||--o{ PAYMENTS : "thanh_toán"
    VOUCHERS ||--o{ BOOKINGS : "khấu_trừ"

    ROLES {
        uuid id PK "Khóa chính UUID"
        varchar name "Tên vai trò: ADMIN, DISPATCHER, DRIVER, PASSENGER"
        varchar description "Mô tả trách nhiệm"
        timestamp created_at "Thời điểm tạo"
    }

    USERS {
        uuid id PK "Khóa chính UUID"
        varchar email UK "Email duy nhất"
        varchar phone_number "Số điện thoại"
        varchar password_hash "Chuỗi băm mật khẩu Bcrypt"
        varchar full_name "Họ và tên đầy đủ"
        varchar student_id "Mã sinh viên ICTU"
        varchar faculty "Khoa / Đơn vị công tác"
        varchar status "Trạng thái: active, inactive, pending"
        uuid role_id FK "Liên kết vai trò"
    }

    DRIVER_PROFILES {
        uuid id PK "Khóa chính hồ sơ lái xe"
        uuid user_id FK "Liên kết tài khoản"
        varchar license_number UK "Số giấy phép lái xe"
        varchar license_class "Hạng bằng lái: D, E"
        date license_expiry "Ngày hết hạn bằng lái"
        varchar approval_status "Trạng thái duyệt: approved, pending"
    }

    ROUTES {
        uuid id PK "Khóa chính tuyến đường"
        varchar route_code UK "Mã định danh tuyến: CT-01, CT-02"
        varchar name "Tên gọi tuyến xe buýt"
        varchar origin "Điểm xuất phát"
        varchar destination "Điểm kết thúc"
        decimal distance_km "Tổng cự ly tuyến đường"
        decimal base_price "Giá vé phổ thông"
        decimal student_price "Giá vé trợ giá sinh viên"
        varchar status "Trạng thái: active, inactive, deleted"
    }

    STATIONS {
        uuid id PK "Khóa chính trạm dừng"
        varchar name "Tên trạm đón trả khách"
        decimal latitude "Vĩ độ WGS84"
        decimal longitude "Kinh độ WGS84"
        boolean is_hub "Trạm trung chuyển lớn"
        varchar status "Trạng thái hoạt động"
    }

    ROUTE_STATIONS {
        uuid id PK "Khóa chính thứ tự trạm"
        uuid route_id FK "Liên kết tuyến"
        uuid station_id FK "Liên kết trạm"
        int stop_order "Thứ tự ghé đón: 1..N"
        decimal distance_from_origin_km "Cự ly từ điểm xuất phát"
        int estimated_minutes "Thời gian hành trình dự kiến"
    }

    VEHICLES {
        uuid id PK "Khóa chính phương tiện"
        varchar license_plate UK "Biển số đăng ký xe"
        varchar model "Dòng xe vận hành"
        varchar vehicle_type "Loại xe: electric, diesel"
        int seat_capacity "Tổng số ghế: 28"
        varchar status "Trạng thái: active, maintenance"
    }

    SEATS {
        uuid id PK "Khóa chính vị trí ghế"
        uuid vehicle_id FK "Liên kết xe"
        varchar seat_number "Mã ghế: 01A đến 07D"
        int row_number "Số hàng: 1 đến 7"
        varchar column_label "Cột: A, B, C, D"
        varchar seat_type "Loại ghế: standard, priority"
    }

    TRIPS {
        uuid id PK "Khóa chính chuyến xe"
        uuid route_id FK "Liên kết tuyến"
        uuid vehicle_id FK "Liên kết xe buýt"
        uuid driver_id FK "Liên kết tài xế"
        timestamp departure_time "Giờ khởi hành"
        timestamp arrival_time "Giờ dự kiến đến"
        varchar status "scheduled, boarding, in_progress, completed, cancelled"
    }

    BOOKINGS {
        uuid id PK "Khóa chính đơn đặt"
        varchar booking_code UK "Mã giao dịch: ICTU-XXXXXX"
        uuid user_id FK "Liên kết khách hàng"
        uuid trip_id FK "Liên kết chuyến"
        uuid voucher_id FK "Liên kết mã giảm giá"
        decimal original_amount "Số tiền gốc"
        decimal discount_amount "Số tiền chiết khấu"
        decimal final_amount "Số tiền thực thanh toán"
        varchar status "pending, confirmed, cancelled, refunded"
    }

    TICKETS {
        uuid id PK "Khóa chính vé điện tử"
        uuid booking_id FK "Liên kết đơn đặt"
        uuid seat_id FK "Liên kết vị trí ghế"
        varchar ticket_code UK "Mã tra cứu vé"
        varchar passenger_name "Tên hành khách"
        varchar qr_signature "Chữ ký số kiểm tra HMAC-SHA256"
        varchar status "reserved, paid, boarded, cancelled, refunded, expired"
    }

    PAYMENTS {
        uuid id PK "Khóa chính hóa đơn"
        uuid booking_id FK "Liên kết đơn đặt"
        varchar payment_method "vnpay, student_wallet, cash"
        varchar transaction_ref UK "Mã giao dịch ngân hàng"
        decimal amount "Số tiền thanh toán"
        varchar status "pending, completed, failed, refunded"
    }

    VOUCHERS {
        uuid id PK "Khóa chính voucher"
        varchar code UK "Mã khuyến mại: ICTU2026"
        varchar discount_type "percentage, fixed_amount"
        decimal discount_value "Giá trị chiết khấu"
        decimal min_order_value "Giá trị đơn tối thiểu"
        date end_date "Ngày hết hạn"
        varchar status "active, expired"
    }
```

---

## 4. Sơ Đồ 3: Quy Trình Giữ Chỗ & Khóa Phân Tán (Distributed Seat-Lock)

Luồng giao dịch tuần tự mô tả chi tiết các bước xác lập trạng thái giữa bộ nhớ đệm phân tán, cơ sở dữ liệu quan hệ, cổng thanh toán quốc gia và hệ thống thông báo:

```mermaid
sequenceDiagram
    autonumber
    actor HanhKhach as Hành Khách / Sinh Viên
    participant UngDungWeb as Cổng Web Next.js
    participant DichVuDatVe as Dịch Vụ Đặt Vé NestJS
    participant BoNhoRedis as Động Cơ Khóa Redis
    participant CSDLPostgres as Cơ Sở Dữ Liệu PostgreSQL
    participant CongThanhToan as Cổng Thanh Toán VNPay
    participant DichVuThu as Hệ Thống Gửi Email SMTP

    HanhKhach->>UngDungWeb: Chọn Tuyến, Ngày, Chuyến và Vị trí ghế (VD: 04C)
    UngDungWeb->>DichVuDatVe: POST /api/v1/booking/hold-seat { tripId, seatNumber: "04C" }

    rect rgb(240, 244, 250)
        Note over DichVuDatVe,BoNhoRedis: Kiểm Tra Khóa Phân Tán Nguyên Tử
        DichVuDatVe->>BoNhoRedis: SET seat_lock:tripId:04C userId NX PX 600000
        alt Ghế đang bị khóa bởi hành khách khác
            BoNhoRedis-->>DichVuDatVe: nil
            DichVuDatVe-->>UngDungWeb: 409 Conflict ("Vị trí ghế 04C đang được giữ bởi người khác")
            UngDungWeb-->>HanhKhach: Báo lỗi va chạm ghế & tải lại sơ đồ xe
        else Xác lập khóa thành công
            BoNhoRedis-->>DichVuDatVe: OK
            DichVuDatVe->>CSDLPostgres: INSERT INTO bookings, tickets (status = 'reserved')
            DichVuDatVe-->>UngDungWeb: 201 Created { bookingId, holdExpiresAt }
            UngDungWeb-->>HanhKhach: Bắt đầu đếm ngược thời gian 10:00
        end
    end

    HanhKhach->>UngDungWeb: Xác nhận đơn & Chọn thanh toán Cổng VNPay
    UngDungWeb->>DichVuDatVe: POST /api/v1/payment/create-url { bookingId }
    DichVuDatVe->>DichVuDatVe: Sinh chuỗi truy vấn kèm mã băm HMAC-SHA512
    DichVuDatVe-->>UngDungWeb: Trả về URL chuyển hướng thanh toán
    UngDungWeb->>CongThanhToan: Chuyển hướng trình duyệt đến Cổng VNPay

    HanhKhach->>CongThanhToan: Nhập thông tin thẻ ATM Sandbox & xác nhận OTP
    CongThanhToan->>DichVuDatVe: Webhook IPN Callback bất đồng bộ (GET /api/v1/payment/vnpay-ipn)

    rect rgb(240, 250, 240)
        Note over DichVuDatVe,CSDLPostgres: Đối Soát Giao Dịch & Kích Hoạt Vé Số Hóa
        DichVuDatVe->>DichVuDatVe: Xác minh mã băm toàn vẹn (vnp_SecureHash)
        DichVuDatVe->>CSDLPostgres: UPDATE payments SET status = 'completed'
        DichVuDatVe->>CSDLPostgres: UPDATE bookings SET status = 'confirmed'
        DichVuDatVe->>CSDLPostgres: UPDATE tickets SET status = 'paid', qr_signature = HMAC(payload)
        DichVuDatVe->>BoNhoRedis: DEL seat_lock:tripId:04C (Giải phóng khóa giữ chỗ)
        DichVuDatVe-->>CongThanhToan: HTTP 200 OK { RspCode: "00", Message: "Xác nhận thành công" }
    end

    DichVuDatVe->>DichVuThu: Xếp hàng gửi thư kèm tệp vé điện tử PDF + Mã QR
    DichVuThu-->>HanhKhach: Hộp thư đến nhận vé: "Đặt vé xe buýt thành công!"
    CongThanhToan-->>UngDungWeb: Chuyển hướng người dùng về trang /payment/result
    UngDungWeb-->>HanhKhach: Hiển thị thông báo thành công & Thẻ lên xe điện tử
```

---

## 5. Sơ Đồ 4: Luồng Xử Lý Định Vị GPS & Cảnh Báo Geofencing Thời Gian Thực

Hạ tầng viễn thông thu nhận dữ liệu không gian tần số cao từ phương tiện và tính toán vùng bao quanh trạm dừng cố định:

```mermaid
flowchart TD
    ThietBiXe["Thiết Bị Tài Xế / GPS Phương Tiện<br/>Phát luồng tọa độ: vĩ độ, kinh độ, tốc độ, góc hướng"]
    CongWSS["Cổng Kết Nối WebSocket WSS<br/>/tracking/gps-stream"]
    BoLocNhiễu["Bộ Lọc Nhiễu Động Học Kalman<br/>Bác bỏ vận tốc bất thường > 150 km/h hoặc chu kỳ < 1s"]
    RedisKhongGian["Bộ Nhớ Không Gian Redis<br/>GEOADD bus_positions kinh_độ vĩ_độ mã_chuyến"]
    
    KiemTraKhoangCach{"Đánh Giá Khoảng Cách Haversine<br/>Khoảng cách tới trạm kế tiếp &le; 500m?"}
    DuDoanETA["Động Cơ Dự Báo Thời Gian Đến (ETA)<br/>Khoảng cách / Vận tốc + Thời gian trễ sự cố"]
    PhatThongBao["Trung Tâm Điều Phối Thông Báo<br/>Firebase Cloud Messaging (FCM Web Push)"]
    BanDoTrucTuyen["Giao Diện Bản Đồ Trực Tuyến<br/>Cập nhật vị trí tức thời trên nền Leaflet"]
    CanhBaoHanhKhach["Thông Báo Đẩy Tới Điện Thoại Sinh Viên:<br/>'Xe buýt sắp cập trạm đón bạn trong 3 phút nữa!'"]

    ThietBiXe -->|Truyền tin WSS định kỳ mỗi 5 giây| CongWSS
    CongWSS --> BoLocNhiễu
    BoLocNhiễu --> RedisKhongGian
    RedisKhongGian --> BanDoTrucTuyen
    
    BoLocNhiễu --> DuDoanETA
    DuDoanETA --> KiemTraKhoangCach
    KiemTraKhoangCach -- "ĐÚNG (Đi vào vùng Geofence)" --> PhatThongBao
    KiemTraKhoangCach -- "SAI (Đang trên đường đi)" --> BanDoTrucTuyen
    PhatThongBao --> CanhBaoHanhKhach
```

---

## 6. Sơ Đồ 5: Máy Trạng Thái Soát Vé QR & Cơ Chế Chống Gian Lận

Sơ đồ máy trạng thái dưới đây thể hiện quy trình thẩm định 3 lớp nghiêm ngặt được thực thi trên thiết bị quét của phụ xe/tài xế tại cửa xe:

```mermaid
stateDiagram-v2
    [*] --> DocMaQR: Máy quét đọc chuỗi ký tự từ mã QR
    
    DocMaQR --> KiemTraChuKy: Tách gói tin & tính toán mã băm HMAC-SHA256
    KiemTraChuKy --> SaiChuKy: Mã băm không khớp hoặc dữ liệu bị sửa đổi
    SaiChuKy --> [*]: Từ chối 400 ("Chữ ký điện tử của vé không hợp lệ")

    KiemTraChuKy --> DoiChieuChuyen: Đối chiếu Mã chuyến của vé với Chuyến xe hiện tại
    DoiChieuChuyen --> SaiChuyenXe: Mã chuyến của vé khác chuyến xe đang chạy
    SaiChuyenXe --> [*]: Cảnh báo 400 ("Khách lên sai chuyến xe buýt")

    DoiChieuChuyen --> KiemTraTrangThai: Kiểm tra trạng thái vé trong cơ sở dữ liệu
    KiemTraTrangThai --> DaLenXe: Trạng thái hiện tại = 'boarded'
    DaLenXe --> [*]: Bác bỏ 400 ("Vé đã được quét lên xe trước đó")

    KiemTraTrangThai --> VeVoHieu: Trạng thái nằm trong ('cancelled', 'expired', 'refunded')
    VeVoHieu --> [*]: Từ chối 400 ("Vé đã bị hủy hoặc hết hạn sử dụng")

    KiemTraTrangThai --> ChapThuan: Trạng thái hiện tại = 'paid'
    ChapThuan --> CapNhatCSDL: Ghi nhận status = 'boarded', checkedInAt = NOW()
    CapNhatCSDL --> PhapAmBao: Phát âm thanh Ting Ting và rung phản hồi Haptic
    PhapAmBao --> [*]: Xác nhận hành khách lên xe an toàn
```

---

## 7. Sơ Đồ 6: Cấu Trúc Mã Nguồn Monorepo Hướng Tính Năng

Dự án tuân thủ kiến trúc **Monorepo Tách Biệt Sạch Sẽ (Clean Separation Monorepo)**, phân lập hoàn toàn mã nguồn giao diện người dùng với lõi xử lý nghiệp vụ backend:

```mermaid
graph LR
    GocMonorepo["smart-bus-ticketing-system"]
    
    subgraph Frontend_Workspace ["Thư Mục Giao Diện: frontend/ (Next.js 16 + React 19)"]
        FE_App["app/ (Điều hướng App Router, Layouts, Slugs động)"]
        FE_Features["features/ (Mã nguồn nghiệp vụ đóng gói theo tính năng)"]
        FE_Components["components/ (Các thành phần UI dùng chung, Biểu mẫu, Bảng biểu)"]
        FE_Lib["lib/ (Dịch vụ gọi API, Quản lý phiên, Tiện ích)"]
        FE_Hooks["hooks/ (React Custom Hooks: useSeatLock, useTracking)"]
    end

    subgraph Backend_Workspace ["Thư Mục Xử Lý: backend/ (NestJS 11 + TypeORM)"]
        BE_Modules["src/modules/ (16 Modules nghiệp vụ vi hạt)"]
        BE_Database["src/database/ (Thực thể TypeORM, Khởi tạo dữ liệu mẫu)"]
        BE_Common["src/common/ (Bộ lọc ngoại lệ, Bộ chặn RBAC, Bộ chuyển đổi)"]
        BE_Config["src/config/ (Cấu hình Cơ sở dữ liệu, Redis, JWT, Mail)"]
        BE_Tests["test/ (36 Bộ kiểm thử tự động Unit & Integration)"]
    end

    subgraph Dieu_Phoi_Chung ["Thư Mục Điều Phối Dự Án"]
        PkgJson["package.json (Tập lệnh điều phối chạy toàn hệ thống)"]
        DevScript["scripts/start-dev.mjs (Quản lý tiến trình chạy song song)"]
        BatchLauncher["start-dev.bat (Kịch bản khởi động 1 chạm trên Windows)"]
    end

    GocMonorepo --> Frontend_Workspace
    GocMonorepo --> Backend_Workspace
    GocMonorepo --> Dieu_Phoi_Chung
```

### Bảng Phân Rã Các Phân Hệ Backend
| Phân Hệ Nghiệp Vụ | Trách Nhiệm & Ranh Giới Kiến Trúc |
| :--- | :--- |
| `src/modules/auth` | Phát hành và thu hồi JWT, mã hóa mật khẩu bằng Bcrypt, bảo vệ chống brute-force. |
| `src/modules/transit` | Quản trị mạng lưới tuyến đường, các trạm dừng cố định, lộ trình ghé đón và tính toán cước phí Haversine. |
| `src/modules/trips` | Lập lịch trình vận tải, phân công phương tiện và kíp lái, tự động sinh dữ liệu quay vòng 4 ngày. |
| `src/modules/booking` | Quản lý lựa chọn chỗ ngồi, xác lập khóa phân tán Redis, tạo đơn đặt vé và vòng đời vé. |
| `src/modules/payment` | Tích hợp cổng thanh toán VNPay, xác thực chữ ký an toàn, xử lý Webhook IPN đối soát. |
| `src/modules/tracking` | Thu nhận luồng tọa độ WebSocket, lọc nhiễu vận tốc GPS, tính toán cự ly và kích hoạt Geofencing. |
| `src/modules/promotion` | Quản lý mã giảm giá ưu đãi sinh viên và tiếp nhận đăng ký cấp mới/gia hạn vé tháng. |
| `src/modules/feedback` | Đánh giá chất lượng phục vụ sau chuyến đi, ghi nhận khiếu nại và hình ảnh phản ánh. |
| `src/modules/audit` | Lưu trữ nhật ký biến động hệ thống, địa chỉ IP thực hiện, định danh tác nhân và dữ liệu trước/sau. |
| `src/modules/reports` | Tổng hợp báo cáo doanh thu tài chính, tỷ lệ lấp đầy ghế, xuất file Excel và kết xuất mẫu in A4 PDF. |

---

## 8. Ma Trận Phân Quyền Truy Cập (RBAC Matrix)

Cơ chế phân quyền được bảo vệ nghiêm ngặt ở cả tầng định tuyến HTTP (`RolesGuard`) và tầng truy vấn dữ liệu theo 4 cấp độ người dùng:

| Danh Mục Nghiệp Vụ | Quản Trị Viên (Admin) | Điều Hành Viên (Dispatcher) | Tài Xế / Kíp Lái (Driver) | Hành Khách / Sinh Viên (Passenger) |
| :--- | :---: | :---: | :---: | :---: |
| Tra cứu thông tin tuyến, trạm & lịch trình | Xem | Xem | Xem | Xem |
| Giữ chỗ ghế ngồi & Tạo đơn đặt vé | Chặn | Chặn | Chặn | Tạo mới / Xem |
| Thanh toán trực tuyến Cổng VNPay | Chặn | Chặn | Chặn | Tạo mới |
| Tự hủy vé hoặc Đổi chuyến sang giờ khác | Chặn | Chặn | Chặn | Cập nhật |
| Soát vé điện tử QR bằng máy quét di động | Chặn | Chặn | Thực thi | Chặn |
| Phát luồng tọa độ GPS hành trình xe | Chặn | Chặn | Thực thi | Chặn |
| Báo cáo sự cố phát sinh trên đường | Chặn | Chặn | Tạo mới | Chặn |
| Điều động xe, tài xế & phụ xe theo ca | Toàn quyền | Toàn quyền | Chặn | Chặn |
| Ràng buộc khóa đổi xe khi đang chạy (`IN_PROGRESS`) | Bắt buộc | Bắt buộc | Chặn | Chặn |
| Thẩm định hồ sơ ưu đãi HSSV / Bằng lái | Toàn quyền | Toàn quyền | Chặn | Chặn |
| Tạo mới, Cập nhật & Xóa mềm tuyến đường | Toàn quyền | Chặn | Chặn | Chặn |
| Quản lý kho Voucher & Mã khuyến mại | Toàn quyền | Chặn | Chặn | Chặn |
| Xem vết kiểm toán hệ thống (Audit Logs) | Toàn quyền | Chặn | Chặn | Chặn |
| Báo cáo doanh thu, Tỷ lệ lấp đầy, Xuất Excel/PDF | Toàn quyền | Toàn quyền | Chặn | Chặn |

---

## 9. Chính Sách Hoàn Tiền & Đổi Vé Tự Động

Để bảo vệ quyền lợi chính đáng của hành khách đồng thời hạn chế tình trạng đặt giữ chỗ ảo gây lãng phí ghế ngồi, hệ thống áp dụng biểu phí hoàn vé tự động:

```
+---------------------------------------------------------------------------------------------------+
|                            CÁC KHUNG THỜI GIAN ÁP DỤNG BIỂU PHÍ HOÀN VÉ                           |
+---------------------------------------------------------------------------------------------------+
|  Thời gian đến giờ chạy >= 12 giờ |  Tỷ lệ hoàn tiền: 100% mệnh giá  |  Phí hủy vé: 0%            |
|                                   |  Phí đổi chuyến: 0%              |  Trạng thái: Cho phép      |
+-----------------------------------+----------------------------------+----------------------------+
|  Từ 2 giờ đến dưới 12 giờ         |  Tỷ lệ hoàn tiền: 90% mệnh giá   |  Phí hủy vé: 10%           |
|                                   |  Phí đổi chuyến: 5%              |  Trạng thái: Cho phép      |
+-----------------------------------+----------------------------------+----------------------------+
|  Từ 15 phút đến dưới 2 giờ        |  Tỷ lệ hoàn tiền: 80% mệnh giá   |  Phí hủy vé: 20%           |
|                                   |  Phí đổi chuyến: 10%             |  Trạng thái: Cho phép      |
+-----------------------------------+----------------------------------+----------------------------+
|  Dưới 15 phút trước giờ chạy      |  Tỷ lệ hoàn tiền: 0%             |  Phí hủy vé: 100%          |
|                                   |  Phí đổi chuyến: Khóa chức năng  |  Trạng thái: Từ chối (400) |
+-----------------------------------+----------------------------------+----------------------------+
```

### Quy Tắc Làm Mát (Cooling-off Period)
Bất kể chuyến xe sắp khởi hành, nếu vé được hủy trong vòng **30 phút kể từ thời điểm đặt vé thành công** (`NOW() - createdAt <= 30 phút`), hành khách được hưởng chính sách hoàn trả **100% số tiền** mà không phải chịu bất kỳ khoản khấu trừ nào.

---

## 10. Hướng Dẫn Cài Đặt & Triển Khai Hệ Thống

### 10.1. Yêu Cầu Môi Trường Tiên Quyết
* **Môi trường thực thi**: Node.js phiên bản `v20.x`, `v22.x` hoặc `v24.x LTS`.
* **Trình quản lý gói**: `npm` (tích hợp sẵn theo Node.js) hoặc `pnpm`.
* **Hệ quản trị cơ sở dữ liệu**: PostgreSQL 16 trở lên có cài đặt tiện ích mở rộng PostGIS và uuid-ossp (khuyên dùng dịch vụ Cloud Supabase).
* **Bộ nhớ đệm phân tán**: Redis Server phiên bản 6.0 trở lên hoặc Upstash Redis.

### 10.2. Cài Đặt Các Thư Viện Phụ Thuộc
Chạy câu lệnh cài đặt tự động cho cả hai phân hệ Frontend và Backend từ thư mục gốc của dự án:
```bash
npm --prefix backend install && npm --prefix frontend install
```

### 10.3. Cấu Hình Biến Môi Trường (`backend/.env`)
Sao chép mẫu cấu hình và khai báo các thông số vận hành tại tệp `backend/.env`:
```ini
# Cấu hình Cổng Dịch Vụ
PORT=3001
NODE_ENV=production

# Kết Nối Cơ Sở Dữ Liệu PostgreSQL (Supabase Pooler)
DATABASE_URL=postgresql://postgres.xxx:xxx@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require

# Kết Nối Bộ Nhớ Đệm Redis Phân Tán
REDIS_URL=redis://default:xxx@xxx.upstash.io:6379

# Khóa Bí Mật Ký Số & Xác Thực JWT
JWT_SECRET=ICTU_SMART_BUS_JWT_ENTERPRISE_SECRET_KEY_2026
JWT_EXPIRATION=7d

# Thông Tin Đăng Nhập Cổng Thanh Toán VNPay Sandbox
VNPAY_TMN_CODE=BDCDEH71
VNPAY_HASH_SECRET=TJAWJFAONXJGYJULKCPRUYGNVXTCHGUN
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3000/payment/result

# Dịch Vụ Chuyển Tiếp Email Giao Dịch (SMTP Google)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=smartbus.ictu@gmail.com
MAIL_PASS=xxxx-xxxx-xxxx-xxxx
MAIL_FROM="Smart Bus ICTU" <smartbus.ictu@gmail.com>
```

### 10.4. Khởi Chạy Ứng Dụng
```bash
# Lựa chọn 1: Khởi chạy song song cả Frontend (Cổng 3000) và Backend (Cổng 3001)
npm run dev

# Lựa chọn 2: Khởi chạy nhanh 1 chạm trên hệ điều hành Windows
start-dev.bat
```

### 10.5. Biên Dịch Đóng Gói Bản Phát Hành (Production Build)
Kiểm tra tính toàn vẹn của mã nguồn trước khi triển khai:
```bash
# Biên dịch Backend NestJS sang mã Javascript tối ưu
npm --prefix backend run build

# Biên dịch Frontend Next.js kết xuất các trang tĩnh và Server Components
npm --prefix frontend run build
```

---

## 11. Báo Cáo Kiểm Thử Tự Động & Chỉ Số Chất Lượng

Toàn bộ hệ sinh thái mã nguồn được kiểm soát chất lượng bởi **36 bộ kiểm thử tự động** viết trên nền Vitest, xác thực 100% các hợp đồng giao dịch, ràng buộc dữ liệu và xử lý ngoại lệ biên:

```bash
# Kích hoạt toàn bộ bộ kiểm thử tự động
npm run test:backend
```

### Bảng Tổng Hợp Kết Quả Thực Thi Kiểm Thử
```
--------------------------------------------------------------------------------
BẢNG TỔNG KẾT KIỂM THỬ TỰ ĐỘNG VITEST (36/36 FILE ĐẠT TIÊU CHUẨN)
--------------------------------------------------------------------------------
 [ĐẠT] test/search-hardening.spec.ts                            (3 ca kiểm thử)
 [ĐẠT] test/real-endpoints-verification.spec.ts                 (4 ca kiểm thử)
 [ĐẠT] test/tracking-realtime-and-eta.spec.ts                   (17 ca kiểm thử)
 [ĐẠT] test/incident-flow-integration.spec.ts                   (7 ca kiểm thử)
 [ĐẠT] test/ticket-cancel-and-exchange.spec.ts                  (10 ca kiểm thử)
 [ĐẠT] test/auth-register-integration.spec.ts                   (13 ca kiểm thử)
 [ĐẠT] test/transit-management-and-integrity.spec.ts            (16 ca kiểm thử)
 [ĐẠT] test/trip-dispatch-and-crew-notification.spec.ts         (10 ca kiểm thử)
 [ĐẠT] test/security-and-auth-hardening.spec.ts                (10 ca kiểm thử)
 [ĐẠT] test/seat-hold-payment.spec.ts                           (10 ca kiểm thử)
 [ĐẠT] test/qr-ticket-notification.spec.ts                     (10 ca kiểm thử)
 [ĐẠT] test/qa/sprint1-core-features.spec.ts                   (32 ca kiểm thử)
 [ĐẠT] test/qa/sprint2-advanced-features.spec.ts               (17 ca kiểm thử)
 [ĐẠT] test/entrypoint-standardization.spec.ts                 (12 ca kiểm thử)
 [ĐẠT] test/unit/conductor-creation-and-dispatch-constraints   (10 ca kiểm thử)
 [ĐẠT] test/unit/auth-register.spec.ts                         (15 ca kiểm thử)
 [ĐẠT] test/unit/anti-spam-and-email.spec.ts                   (4 ca kiểm thử)
 [ĐẠT] test/unit/trips-vietnam-timezone.spec.ts                (3 ca kiểm thử)
 [ĐẠT] test/unit/notification-controller-and-service.spec.ts   (7 ca kiểm thử)
 [ĐẠT] test/qa/sprint3-geofencing-push-notification.spec.ts    (17 ca kiểm thử)
 [ĐẠT] test/qa/sprint2-geofencing-notification.spec.ts         (17 ca kiểm thử)
 [ĐẠT] ... và 15 bộ kiểm thử đơn vị độc lập khác ...

 Tổng số file kiểm thử: 36 file (Đạt 100%)
 Tổng số ca kiểm thử:   322 ca kiểm thử (Đạt 100%)
 Thời gian thực thi:    21.68 giây
 Mã lỗi trả về:         0 (Không phát sinh lỗi hoặc suy thoái phần mềm)
--------------------------------------------------------------------------------
```

---

## 12. Thông Tin Bản Quyền & Đơn Vị Quản Lý

* **Cơ quan chủ quản**: Trường Đại học Công nghệ Thông tin và Truyền thông (ICTU) - Đại học Thái Nguyên
* **Khoa phụ trách chuyên môn**: Khoa Công nghệ Thông tin & Khoa Kỹ thuật Phần mềm
* **Định danh sản phẩm**: Đồ án tốt nghiệp chuyên ngành Kỹ thuật Phần mềm / Bản phát hành chính thức `Release v1.0.0`
* **Quyền sở hữu trí tuệ**: © 2026 Smart Bus Ticketing System - ICTU. Mọi quyền được bảo lưu.
