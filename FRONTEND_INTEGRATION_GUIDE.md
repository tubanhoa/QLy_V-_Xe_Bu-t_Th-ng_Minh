# Hướng Dẫn Tích Hợp Frontend & Backend — Sprint 1
## Dự án: Smart Bus Ticketing System – ICTU

> **Nhánh phát triển:** `frontend/sprint-1`  
> **Người thực hiện Frontend:** Trần Danh Đức (Frontend Team)  
> **Bàn giao cho:** Backend Team (Nông Minh Trí, Nguyễn Quang Vinh, Phạm Đức Việt) & Tester Team

---

## 1. Hướng Dẫn Clone & Khởi Chạy Cho Đội Ngũ Backend

Các thành viên Backend chỉ cần thực hiện 3 bước sau để chạy toàn bộ giao diện Frontend trên máy cục bộ:

```bash
# 1. Clone trực tiếp nhánh frontend/sprint-1
git clone -b frontend/sprint-1 https://github.com/tubanhoa/QLy_V-_Xe_Bu-t_Th-ng_Minh.git

# 2. Di chuyển vào thư mục dự án và cài đặt dependencies
npm install

# 3. Khởi động môi trường phát triển (Next.js 16 Turbopack)
npm run dev
```

Truy cập ứng dụng tại: **`http://localhost:3000`**

---

## 2. Các Màn Hình & Tính Năng Đã Hoàn Thành Theo Sprint 1

| STT | Phân hệ / User Story | Đường dẫn Route | File Component chính | Trạng thái bàn giao |
|---|---|---|---|---|
| **1** | **Landing Page chính** | `/` | `components/landing/landing-page.tsx` | Hoàn thiện 100% UI/UX & Responsive |
| **2** | **Đăng ký tài khoản (Register)** | `/register` | `components/auth/register-form.tsx` | Chuẩn format HSSV (-50%) & Hành khách |
| **3** | **Đăng nhập (Login)** | `/login` | `components/login/login-page.tsx` | Đăng nhập HSSV, Cán bộ & SSO Office 365 |
| **4** | **US-01: Tra cứu tuyến xe** | `/` (Modal Tuyến) | `components/landing/quick-access-modals.tsx` | Tìm trạm đi/đến, lộ trình, tần suất |
| **5** | **US-02: Sơ đồ chọn ghế 28 chỗ** | `/` (Modal Đặt vé) | `components/landing/seat-picker-modal.tsx` | Sơ đồ xe điện 28 chỗ, trạng thái ghế |
| **6** | **US-03: Giữ chỗ tạm thời** | `/` (Modal Đặt vé) | `components/landing/seat-picker-modal.tsx` | Countdown 10:00 khóa ghế, sinh mã giữ chỗ |

---

## 3. Bản Đặc Tả API Contracts Cho Backend (Sprint 1)

Đội ngũ Frontend đã định nghĩa sẵn các kiểu dữ liệu TypeScript tại file:  
`lib/types/sprint1.ts`

### 3.1. API Đăng Ký Tài Khoản (`POST /api/auth/register`)
- **File mẫu đã dựng sẵn:** `app/api/auth/register/route.ts`
- **Request Payload:**
```json
{
  "userType": "student", // "student" | "passenger"
  "fullName": "Nguyễn Văn A",
  "email": "sv.dtc215@ictu.edu.vn",
  "phoneNumber": "0981234567",
  "password": "Password123@",
  "studentId": "DTC215123456",
  "faculty": "Công nghệ Thông tin",
  "studentCardImageUrl": "data:image/png;base64,..." // tùy chọn
}
```
- **Response thành công (201 Created):**
```json
{
  "success": true,
  "message": "Đăng ký tài khoản Sinh viên ICTU thành công!",
  "userId": "usr_k89x12z",
  "data": {
    "id": "usr_k89x12z",
    "fullName": "Nguyễn Văn A",
    "email": "sv.dtc215@ictu.edu.vn",
    "userType": "student",
    "studentId": "DTC215123456",
    "discountApproved": true,
    "createdAt": "2026-09-25T14:00:00.000Z"
  }
}
```

### 3.2. API Tra Cứu Tuyến Xe (`GET /api/routes`)
- **Query params:** `?origin=KTX+ICTU&destination=Ben+xe+Thai+Nguyen`
- **Response mẫu:**
```json
{
  "routes": [
    {
      "id": "route-ct01",
      "code": "CT-01",
      "name": "Tuyến KTX ICTU ➔ Bến xe Thái Nguyên",
      "fareStandard": 10000,
      "fareStudent": 5000,
      "durationMinutes": 25,
      "operatingHours": { "start": "06:00", "end": "21:00", "frequencyMinutes": 15 }
    }
  ]
}
```

### 3.3. API Sơ Đồ Ghế & Giữ Chỗ Tạm Thời (`POST /api/bookings/hold-seat`)
- **Request Payload:**
```json
{
  "tripId": "trip_ct01_0745",
  "seatIds": ["02B"],
  "passengerInfo": {
    "fullName": "Nguyễn Hoàng Long",
    "phoneNumber": "0981234567",
    "studentId": "DTC215..."
  }
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "holdToken": "HOLD_88921_ABC",
  "expiresAt": "2026-09-25T14:15:00.000Z",
  "remainingSeconds": 600,
  "totalAmount": 5000,
  "seatsHeld": ["02B"],
  "message": "Ghế 02B đã được giữ tạm trong 10 phút."
}
```

---

## 4. Công Nghệ & Lưu Ý
- **Next.js 16 (App Router + Turbopack)**: Tất cả mã nguồn chạy theo tiêu chuẩn mới nhất.
- **Tailwind CSS v4 + Ant Design**: Giao diện đồng bộ màu thương hiệu xanh rừng `#005A36`.
- **Backend lưu ý**: Khi viết API, có thể đặt code trong thư mục `app/api/...` của Next.js hoặc dựng server backend độc lập (NestJS / Express / Spring Boot) và chỉ cần cấu hình `NEXT_PUBLIC_API_URL` trong file `.env.local`.
