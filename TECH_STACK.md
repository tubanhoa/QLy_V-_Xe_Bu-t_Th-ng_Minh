# 🚀 TỔNG HỢP CÔNG NGHỆ HỆ THỐNG SMART BUS - ICTU
*(Tài liệu tóm tắt ngắn gọn – dễ đọc – dễ nhớ dành cho báo cáo & bảo vệ đồ án)*

---

## 📌 1. FRONTEND (Giao Diện & Trải Nghiệm Người Dùng)

| Thành phần | Công nghệ sử dụng | Điểm nổi bật / Mục đích |
| :--- | :--- | :--- |
| **Framework chính** | **Next.js 16 (App Router)** | Kiến trúc Server/Client Components, tối ưu SEO, build siêu tốc với Turbopack. |
| **Thư viện UI Core** | **React 19 + TypeScript** | Code có định kiểu chặt chẽ (Type-safe), quản lý component trực quan, hạn chế tối đa bug runtime. |
| **Styling & Giao diện** | **Tailwind CSS v4** | Thiết kế linh hoạt, hiện đại (Glassmorphism, Dark/Light mode, responsive cho cả Mobile và Desktop). |
| **Thư viện Hỗ trợ** | **Ant Design (`antd`) + Lucide Icons** | Bảng dữ liệu, modal điều phối, bộ icon hệ thống sắc nét. |
| **Truyền nhận Realtime** | **Server-Sent Events (SSE) + EventSource** | Nhận tọa độ GPS và số phút đếm ngược ETA từ xe buýt liên tục, mượt mà mà không cần F5 trang. |
| **Bảo mật Frontend** | **RBAC Matrix + JWT Storage** | Phân quyền 3 vai trò: Quản trị viên (Super Admin), Điều hành viên (Dispatcher) và Tài xế (Driver). |

---

## ⚙️ 2. BACKEND (Máy Chủ Xử Lý Nghiệp Vụ)

| Thành phần | Công nghệ sử dụng | Điểm nổi bật / Mục đích |
| :--- | :--- | :--- |
| **Framework chính** | **NestJS (Node.js v24)** | Khung kiến trúc doanh nghiệp chuẩn Modular Monolith (Controller – Service – Module – DTO). |
| **Ngôn ngữ** | **TypeScript (ES Modules)** | Chuẩn hóa toàn bộ DTO request/response, code sạch, dễ mở rộng và bảo trì. |
| **Bảo mật & Xác thực** | **Passport JWT + Bcrypt** | Mã hóa mật khẩu bảo mật cao, cấp Access Token có thời hạn kèm Refresh Token. |
| **Kiểm soát & Phòng vệ** | **Rate Limiting Guard** | Giới hạn tần suất gọi API (10 lần/phút đối với tra cứu voucher/vé) để chống spam, DDoS. |
| **Thuật toán GPS & ETA** | **Công thức Haversine** | Tính toán khoảng cách địa lý theo độ cong Trái Đất và ước lượng số phút đến trạm tiếp theo. |
| **Bộ Giả Lập IoT** | **GPS Simulator Engine** | Tự động mô phỏng xe buýt di chuyển dọc theo tọa độ các trạm khi chưa lắp thiết bị phần cứng ngoài đời. |
| **Tài liệu API** | **Swagger / OpenAPI 3.0** | Tự động sinh tài liệu API trực quan tại `http://localhost:3001/api/docs`. |

---

## 🗄️ 3. DATABASE & CACHING (Lưu Trữ Dữ Liệu)

| Thành phần | Công nghệ sử dụng | Điểm nổi bật / Mục đích |
| :--- | :--- | :--- |
| **Cơ sở dữ liệu chính** | **PostgreSQL (v15+)** | Cơ sở dữ liệu quan hệ mạnh mẽ, hỗ trợ lưu trữ tọa độ địa lý, khóa ngoại và toàn vẹn giao dịch (ACID). |
| **Nền tảng Cloud** | **Supabase Cloud Database** | Lưu trữ trên đám mây, kết nối bảo mật qua SSL/TLS v1.3, tự động backup dữ liệu. |
| **ORM (Ánh xạ dữ liệu)** | **TypeORM** | Quản lý quan hệ đa bảng: Users, Roles, Routes, Stations, Vehicles, Trips, Bookings, Tickets, Incidents,... |
| **Bộ nhớ đệm (Cache)** | **Redis (IoRedis)** *(kèm In-Memory fallback)* | Cache vị trí GPS và ETA với độ trễ siêu thấp (**< 5ms**) giúp hệ thống chịu tải cao khi hàng nghìn người cùng xem bản đồ. |

---

## 🔌 4. API & TÍCH HỢP LIÊN KẾT (Integrations)

- **Cổng thanh toán trực tuyến:**
  - Tích hợp chuẩn đa cổng: **VNPay**, **MoMo**, **Mã VietQR Pro** và **ZaloPay** (Cơ chế sinh mã QR động và xử lý Webhook / IPN đối soát tự động).
- **Hóa đơn điện tử VAT:**
  - Tự động bóc tách thuế GTGT (8%), tra cứu trực tuyến bằng mã bí mật và mô phỏng ký số **RSA-SHA256**.
- **Vé xe & Soát vé:**
  - Mã vé QR Code động độc nhất, chống chụp màn hình gian lận bằng cơ chế đếm ngược và kiểm tra trạng thái vé thời gian thực.

---

## 💡 BẬT MÍ: 3 CÂU TRẢ LỜI "GHI ĐIỂM" KHI GIẢNG VIÊN HỎI

1. **"Dữ liệu đang chạy là dữ liệu thật hay giả lập?"**
   > *Dạ thưa Thầy/Cô, toàn bộ dữ liệu người dùng, đội xe, tuyến đường và hơn 140 vé đều là **dữ liệu thật lưu trên cơ sở dữ liệu Supabase Cloud PostgreSQL**. Nhóm chỉ sử dụng cơ chế Simulator để mô phỏng tọa độ di chuyển của thiết bị định vị GPS khi chạy thử nghiệm trong phòng lab.*

2. **"Tại sao nhóm dùng Server-Sent Events (SSE) thay vì WebSocket cho bản đồ GPS?"**
   > *Dạ, vì việc phát tọa độ từ xe buýt về trình duyệt hành khách là luồng dữ liệu **một chiều (Server -> Client)**. Dùng SSE nhẹ hơn WebSocket, tự động kết nối lại khi mất mạng và chạy mượt mà trên giao thức HTTP thông thường mà không tốn tài nguyên duy trì kết nối 2 chiều.*

3. **"Kiến trúc Backend được tổ chức như thế nào?"**
   > *Dạ, Backend được xây dựng theo kiến trúc **Modular Monolith** của NestJS: chia tách rõ ràng thành các module độc lập (Transit, Booking, Tracking, Payment, Promotion, Audit). Khi cần mở rộng quy mô (Scale), nhóm có thể tách module Tracking hoặc Payment thành Microservice riêng biệt rất dễ dàng.*
