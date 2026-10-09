# HƯỚNG DẪN KIỂM THỬ CỔNG THANH TOÁN VNPAY SANDBOX (DÀNH CHO ĐỘI TESTER / QA)

Tài liệu này cung cấp toàn bộ thông số cấu hình, tài khoản kiểm thử và kịch bản test cổng thanh toán **VNPay Sandbox** trên môi trường máy cục bộ (Localhost) cho dự án **Smart Bus Ticketing System - ICTU**.

---

## 1. Thông Số Cấu Hình VNPay Sandbox Vận Hành Trong Hệ Thống

Các thông số này đã được tích hợp sẵn trong mã nguồn backend (`.env.example` và fallback code):

| Thông số | Giá trị vận hành | Ghi chú |
| :--- | :--- | :--- |
| **Merchant Code (`vnp_TmnCode`)** | `BDCDEH71` | Mã định danh Merchant Sandbox chính thức |
| **Hash Secret (`vnp_HashSecret`)** | `TJAWJFAONXJGYJULKCPRUYGNVXTCHGUN` | Khóa bí mật tạo chữ ký số HMAC-SHA512 |
| **URL Cổng Thanh Toán** | `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html` | Cổng chuyển hướng VNPay Sandbox |
| **URL Nhận Kết Quả** | `http://localhost:3000/payment/result` | Return URL sau khi thanh toán |

---

## 2. Thông Tin Thẻ Ngân Hàng Kiểm Thử (NCB Sandbox Test Card)

Khi giao diện chuyển hướng sang cổng VNPay hoặc người dùng nhập thông tin thẻ ATM nội địa / quét mã:

- **Ngân hàng phát hành**: **NCB (Ngân hàng Quốc Dân)**
- **Số thẻ**: `9704198526191432198`
- **Tên chủ thẻ**: `NGUYEN VAN A`
- **Ngày phát hành**: `07/15`
- **Mã OTP xác thực**: `123456`

---

## 3. Hướng Dẫn Clone Code & Khởi Động Trên Máy Cục Bộ

### Bước 1: Thiết lập cấu hình Backend
```bash
cd backend
cp .env.example .env
npm install
npm run build
npm run start:dev
```
> **Lưu ý**: Server Backend chạy tại cổng `http://localhost:3001`. File `.env.example` đã điền sẵn 100% thông số VNPay Sandbox, Database Supabase Cloud nên tester clone về có thể chạy ngay không cần cấu hình thêm.

### Bước 2: Thiết lập cấu hình Frontend
```bash
# Tại thư mục gốc dự án
cp .env.example .env.local
npm install
npm run dev
```
> Frontend khởi chạy tại `http://localhost:3000`.

---

## 4. Các Kịch Bản Kiểm Thử Trực Tiếp (Test Scenarios)

### Kịch bản 1: Mua Vé Lượt & Thanh Toán VNPay Sandbox
1. Vào trang chủ: `http://localhost:3000`.
2. Tìm chuyến xe buýt (VD: Tuyến CT-01: ICTU ↔ Bến Xe Thái Nguyên).
3. Chọn chỗ ngồi và chọn phương thức thanh toán: **Cổng thanh toán VNPay**.
4. Quét mã QR thanh toán hoặc chuyển sang trang VNPay Sandbox.
5. Nhập số thẻ test NCB `9704198526191432198` -> OTP `123456`.
6. Hệ thống chuyển về trang kết quả: Vé chuyển trạng thái `PAID`, sinh mã vé `TKT-ICTU-...` và mã QR soát vé.

### Kịch bản 2: Đăng Ký & Thanh Toán Vé Tháng Trực Tuyến
1. Vào trang: `http://localhost:3000/portal/monthly-pass`.
2. Đăng ký vé tháng học sinh/sinh viên (giảm 50% chỉ còn 100.000 VNĐ/tháng).
3. Đăng nhập tài khoản Admin: `admin@smartbus.ictu.vn` / `Password@123`.
4. Vào phân hệ **Hồ Sơ Vé Tháng** (`/portal` -> menu "Hồ Sơ Vé Tháng") -> Bấm **Phê duyệt**.
5. Quay lại tài khoản sinh viên: Bấm **Thanh toán vé tháng**.
6. Hệ thống hiển thị:
   - Ảnh mã **QR VNPay Data URL (Base64 PNG)** render trực tiếp.
   - Nút liên kết chuyển hướng sang cổng VNPay Sandbox Merchant `BDCDEH71`.
   - Thông tin thẻ test NCB Sandbox.
7. Thanh toán thành công -> Thẻ chuyển trạng thái `PAID`, sinh mã QR thẻ tháng `ICTU-MONTHLY:${passCode}:${endDate}`.

### Kịch bản 3: Gia Hạn Vé Tháng (Renew)
1. Trên thẻ tháng hợp lệ, bấm **Gia hạn trực tuyến**.
2. Chọn kỳ hạn: 1 tháng, 3 tháng (giảm 10%), hoặc 6 tháng.
3. Hệ thống tự động tính ngày hết hạn mới (cộng dồn thời hạn thông minh) và tạo đơn thanh toán VNPay Sandbox.

### Kịch bản 4: Kiểm Tra Đối Soát Doanh Thu VNPay Trên Admin Dashboard
1. Đăng nhập Admin (`admin@smartbus.ictu.vn`).
2. Vào **Bàn Điều Hành Trung Tâm**:
   - Thẻ KPI "Doanh thu kỳ này" ghi nhận doanh thu từ VNPay.
   - Thẻ "Doanh thu theo kênh" hiển thị dòng **Ví điện tử VNPAY** kèm tỷ lệ %.
   - Mở "Bảng kê chi tiết từng ngày" -> Xem cột **VNPay**.
3. Vào phân hệ **Thanh Toán & Cổng** (`/portal` -> menu "Thanh Toán & Cổng"):
   - Lọc theo Cổng: chọn **VNPay QR**.
   - Kiểm tra tab **Báo Cáo Đối Soát** và nhật ký giao dịch.

---

## 5. Chạy Test Suite Tự Động Backend (Automated E2E Suite)

Tester có thể chạy bộ kiểm thử tự động 10 Test Cases trong 1 lệnh duy nhất:

```bash
cd backend
npm run test:monthly-pass
```

**Kỳ vọng**: 10/10 Test Cases đạt `[PASSED]`, bao gồm tạo yêu cầu thanh toán VNPay Merchant `BDCDEH71`, sinh mã QR Base64, kích hoạt thẻ và tự dọn dẹp sạch 100% dữ liệu test (Zero Test Junk Guarantee).
