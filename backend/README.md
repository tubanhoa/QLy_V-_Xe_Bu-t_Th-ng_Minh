# 🚌 Smart Bus Ticketing System — Backend API

**Sprint 1 | Python + FastAPI + MySQL**

---

## 📁 Cấu trúc thư mục

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py      # Gộp tất cả routers
│   │       └── search.py        # 🔍 Router tìm kiếm chuyến xe
│   ├── core/
│   │   ├── config.py            # Cấu hình app (đọc từ .env)
│   │   └── database.py          # SQLAlchemy engine + session
│   ├── models/
│   │   ├── route.py             # ORM: Route, Stop, RouteStop
│   │   ├── trip.py              # ORM: Trip, TripStatus
│   │   ├── bus.py               # ORM: Bus, BusType
│   │   └── seat.py              # ORM: Seat, SeatType
│   ├── schemas/
│   │   └── search.py            # Pydantic schemas (request/response)
│   ├── services/
│   │   └── search_service.py    # Business logic tìm kiếm
│   ├── main.py                  # FastAPI app entry point
│   └── seed.py                  # Seed dữ liệu mẫu
├── tests/
│   └── test_search_schema.py    # Unit tests
├── schema.sql                   # DDL MySQL
├── requirements.txt
├── .env                         # Cấu hình local (không commit)
├── .env.example                 # Template cấu hình
└── start.bat                    # Script khởi động (Windows)
```

---

## ⚙️ Cài đặt

### 1. Yêu cầu
- Python 3.10+
- MySQL 8.0+

### 2. Tạo Database MySQL

```sql
CREATE DATABASE smart_bus_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Hoặc chạy file SQL đầy đủ:
```bash
mysql -u root -p < schema.sql
```

### 3. Cài dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Cấu hình .env

Mở file `.env` và chỉnh `DB_PASSWORD`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=smart_bus_db
DB_USER=root
DB_PASSWORD=your_password   # ← Thay thế ở đây
```

### 5. Chạy server

```bash
uvicorn app.main:app --reload --port 8000
```

Hoặc dùng script Windows:
```bash
start.bat
```

### 6. Seed dữ liệu mẫu

```bash
python -m app.seed
```

---

## 🌐 API Endpoints

| Method | URL | Mô tả |
|--------|-----|-------|
| `POST` | `/api/v1/search/trips` | Tìm kiếm chuyến xe (body JSON) |
| `GET`  | `/api/v1/search/trips` | Tìm kiếm chuyến xe (query params) |
| `GET`  | `/api/v1/search/stops` | Danh sách điểm dừng |
| `GET`  | `/docs` | Swagger UI |
| `GET`  | `/redoc` | ReDoc |

---

## 🧪 Ví dụ sử dụng

### POST /api/v1/search/trips

**Request:**
```json
{
  "origin": "Hà Nội",
  "destination": "Hải Phòng",
  "departure_date": "2026-09-26",
  "passengers": 2
}
```

**Response thành công:**
```json
{
  "success": true,
  "message": "Tìm thấy 3 chuyến xe phù hợp.",
  "meta": {
    "origin_query": "Hà Nội",
    "destination_query": "Hải Phòng",
    "departure_date": "2026-09-26",
    "passengers": 2,
    "total_found": 3,
    "search_at": "2026-09-25T06:40:00"
  },
  "data": [
    {
      "trip_id": 1,
      "route": {
        "id": 1,
        "route_code": "HN-HP-01",
        "name": "Hà Nội – Hải Phòng (Mỹ Đình – Bến xe HP)",
        "origin": { "id": 1, "name": "Bến xe Mỹ Đình", "province": "Hà Nội" },
        "destination": { "id": 3, "name": "Bến xe Hải Phòng", "province": "Hải Phòng" },
        "distance_km": 120.0,
        "duration_minutes": 120
      },
      "departure_time": "2026-09-26T06:00:00",
      "arrival_time": "2026-09-26T08:00:00",
      "duration_minutes": 120,
      "price": 120000.0,
      "total_seats": 34,
      "available_seats": 30,
      "bus_type": "limousine",
      "license_plate": "29B-12345",
      "status": "scheduled"
    }
  ]
}
```

**Response không tìm thấy:**
```json
{
  "success": true,
  "message": "Không có chuyến xe nào từ 'Hà Nội' đến 'Hải Phòng' vào ngày 26/09/2026 với 2 hành khách.",
  "meta": { ... },
  "data": []
}
```

**Response lỗi validation:**
```json
{
  "success": false,
  "message": "Dữ liệu đầu vào không hợp lệ. Vui lòng kiểm tra lại.",
  "errors": [
    { "field": "departure_date", "message": "Ngày đi không được là ngày trong quá khứ" }
  ]
}
```

### GET /api/v1/search/trips (query params)

```
GET /api/v1/search/trips?origin=Hà Nội&destination=Hải Phòng&departure_date=2026-09-26&passengers=1
```

---

## ✅ Validation Rules

| Trường | Quy tắc |
|--------|---------|
| `origin` | Bắt buộc, 2–200 ký tự, tự cắt khoảng trắng |
| `destination` | Bắt buộc, 2–200 ký tự, khác `origin` |
| `departure_date` | Bắt buộc, định dạng `YYYY-MM-DD` hoặc `DD/MM/YYYY`, không phải quá khứ |
| `passengers` | Tùy chọn (mặc định 1), từ 1 đến 50 |

---

## 🔍 Logic tìm kiếm

```
1. Chuẩn hóa input (lowercase, strip whitespace)
2. Tìm các Stop khớp với origin (tìm theo tên, tỉnh, alias)
3. Tìm các Stop khớp với destination
4. Tìm Routes nối origin_stops → destination_stops
5. Lọc Trips:
   - Thuộc routes tìm được
   - Ngày khởi hành = departure_date
   - Trạng thái: scheduled hoặc boarding
   - available_seats ≥ passengers
6. Sắp xếp theo departure_time ASC
7. Build và trả response
```

---

## 🧪 Chạy Tests

```bash
cd backend
pip install pytest
python -m pytest tests/ -v
```

---

## 📊 Database Schema

Xem file [`schema.sql`](./schema.sql) để biết chi tiết DDL.

**Quan hệ chính:**
```
stops ──< route_stops >── routes ──< trips >── buses ──< seats
```
