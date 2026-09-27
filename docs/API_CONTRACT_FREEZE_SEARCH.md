# 🔒 API CONTRACT FREEZE: MODULE TÌM KIẾM TUYẾN & CHUYẾN XE (SEARCH)

> **Trạng thái:** `FROZEN & VERIFIED (ĐÃ CHỐT HỢP ĐỒNG API)`  
> **Phiên bản:** `1.0.0`  
> **Môi trường áp dụng:** Toàn bộ môi trường Dev / Staging / Production  
> **Tài liệu tham chiếu:** Đợt 1 Audit, PR #3, PR #5, PR #6

---

## 📌 QUY TẮC CHUNG VỀ ENTRY POINT & FORMAT PHẢN HỒI

1. **Base URL chuẩn:**  
   - Tất cả các endpoint chuẩn bắt buộc có tiền tố: `/api/v1/...`
   - *Lưu ý về Alias:* Các URL không có version như `/api/routes`, `/api/booking`, `/api/bookings` hiện chỉ là alias tạm thời hỗ trợ tương thích ngược. **Các alias này sẽ bị xóa bỏ hoàn toàn sau khi Frontend xác nhận hoàn tất tích hợp**. Khuyến nghị Frontend sử dụng `/api/v1/...` ngay từ đầu.
2. **Quy chuẩn định dạng Response chuẩn hóa (Unified Response Format):**
   - **Thành công (HTTP 2xx):**
     ```json
     {
       "success": true,
       "data": ...,
       "message": "Thao tác thành công"
     }
     ```
   - **Thất bại / Lỗi (HTTP 4xx, 5xx):**
     ```json
     {
       "success": false,
       "message": "Mô tả lỗi chi tiết hoặc thông điệp thân thiện",
       "errorCode": "Bad Request | Not Found | Unauthorized | ...",
       "statusCode": 400,
       "timestamp": "2026-09-26T16:51:57.890Z",
       "path": "/api/v1/..."
     }
     ```
3. **Cơ chế kiểm soát dữ liệu đầu vào (Strict Validation):**
   - Backend đã bật `forbidNonWhitelisted: true`. Bất kỳ query param hoặc body field thừa nào không nằm trong DTO sẽ bị từ chối ngay lập tức với mã lỗi `400 Bad Request`.

---

## 🚀 DANH SÁCH 2 ENDPOINT ĐÃ AUDIT & CHỐT HỢP ĐỒNG

### 1. Tra cứu Tuyến Xe Buýt (`GET /api/v1/routes`)

- **Mục đích:** Lấy danh sách các tuyến xe buýt đang hoạt động, lộ trình trạm dừng đầy đủ (bao gồm cả điểm đầu, điểm cuối và các trạm trung gian theo đúng thứ tự).
- **Phương thức:** `GET`
- **Đường dẫn chuẩn:** `/api/v1/routes`
- **Query Parameters:**
  | Tên tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
  | :--- | :--- | :---: | :--- |
  | `keyword` | `string` | Không | Lọc theo mã tuyến (VD: `CT-01`) hoặc tên tuyến. Không phân biệt hoa thường. |
  | `origin` | `string` | Không | Tìm kiếm theo trạm xuất phát hoặc bất kỳ trạm dừng trung gian nào (VD: `Cổng KTX`). |
  | `destination`| `string` | Không | Tìm kiếm theo trạm kết thúc hoặc bất kỳ trạm dừng trung gian nào (VD: `Bệnh Viện`). |

#### Response Mẫu Thật 1: Tra cứu không filter (Lấy toàn bộ tuyến đang chạy)
- **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "6e376ad8-12f4-4d5e-a49f-fd6a613aa61b",
      "routeCode": "CT-01",
      "name": "ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên",
      "origin": "ĐH CNTT & TT Thái Nguyên",
      "destination": "Bến Xe Trung Tâm Thái Nguyên",
      "distanceKm": 15.5,
      "basePrice": 10000,
      "studentPrice": 5000,
      "operatingStart": "05:30:00",
      "operatingEnd": "21:00:00",
      "frequencyMinutes": 15,
      "status": "active",
      "createdAt": "2026-09-26T00:00:00.000Z",
      "updatedAt": "2026-09-26T00:00:00.000Z",
      "routeStations": [
        {
          "id": "b0f745e6-b615-46aa-ab1d-2856f6ba3a8b",
          "routeId": "6e376ad8-12f4-4d5e-a49f-fd6a613aa61b",
          "stationId": "060d4b88-122e-4b7e-9769-ad8064be48ce",
          "stopOrder": 1,
          "distanceFromStartKm": 0,
          "durationFromStartMinutes": 0,
          "station": {
            "id": "060d4b88-122e-4b7e-9769-ad8064be48ce",
            "name": "Trạm ĐH CNTT & TT Thái Nguyên (ICTU)",
            "address": "Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên",
            "latitude": 21.5855,
            "longitude": 105.8072,
            "isHub": true,
            "status": "active",
            "createdAt": "2026-09-26T00:00:00.000Z"
          }
        },
        {
          "id": "bfa86ca3-1c39-44cb-b80c-c68469d72b20",
          "routeId": "6e376ad8-12f4-4d5e-a49f-fd6a613aa61b",
          "stationId": "051fe444-ea04-4b53-bfa4-013061614f10",
          "stopOrder": 2,
          "distanceFromStartKm": 3.2,
          "durationFromStartMinutes": 8,
          "station": {
            "id": "051fe444-ea04-4b53-bfa4-013061614f10",
            "name": "Trạm Cổng KTX ĐH Thái Nguyên",
            "address": "Phường Quang Trung, TP. Thái Nguyên",
            "latitude": 21.579,
            "longitude": 105.815,
            "isHub": false,
            "status": "active",
            "createdAt": "2026-09-26T00:00:00.000Z"
          }
        },
        {
          "id": "2d94e222-777e-40e1-ad15-eeff958d042f",
          "routeId": "6e376ad8-12f4-4d5e-a49f-fd6a613aa61b",
          "stationId": "9d7e5590-f916-43ad-8d3e-ae89c89420bf",
          "stopOrder": 3,
          "distanceFromStartKm": 7.5,
          "durationFromStartMinutes": 18,
          "station": {
            "id": "9d7e5590-f916-43ad-8d3e-ae89c89420bf",
            "name": "Trạm Ngã 3 Mỏ Chè",
            "address": "Phường Phan Đình Phùng, TP. Thái Nguyên",
            "latitude": 21.567,
            "longitude": 105.832,
            "isHub": false,
            "status": "active",
            "createdAt": "2026-09-26T00:00:00.000Z"
          }
        },
        {
          "id": "f5a0e9a7-47fc-4e67-bf84-7589d70034a7",
          "routeId": "6e376ad8-12f4-4d5e-a49f-fd6a613aa61b",
          "stationId": "50c4aa86-cf5a-4b08-8e64-be573a649fb9",
          "stopOrder": 4,
          "distanceFromStartKm": 11.8,
          "durationFromStartMinutes": 28,
          "station": {
            "id": "50c4aa86-cf5a-4b08-8e64-be573a649fb9",
            "name": "Trạm Bệnh Viện Đa Khoa Trung Ương",
            "address": "Đường Lương Ngọc Quyến, TP. Thái Nguyên",
            "latitude": 21.554,
            "longitude": 105.845,
            "isHub": true,
            "status": "active",
            "createdAt": "2026-09-26T00:00:00.000Z"
          }
        },
        {
          "id": "713437aa-659f-4318-ae2d-ba13fbcf3994",
          "routeId": "6e376ad8-12f4-4d5e-a49f-fd6a613aa61b",
          "stationId": "1ad3c75c-3fef-4899-b1d6-8488e04b4d68",
          "stopOrder": 5,
          "distanceFromStartKm": 15.5,
          "durationFromStartMinutes": 40,
          "station": {
            "id": "1ad3c75c-3fef-4899-b1d6-8488e04b4d68",
            "name": "Trạm Bến Xe Trung Tâm Thái Nguyên",
            "address": "Đường Tân Lập, TP. Thái Nguyên",
            "latitude": 21.542,
            "longitude": 105.86,
            "isHub": true,
            "status": "active",
            "createdAt": "2026-09-26T00:00:00.000Z"
          }
        }
      ]
    },
    {
      "id": "8a44b1c2-3d5e-4f6a-9b8c-1e2d3f4a5b6c",
      "routeCode": "CT-02",
      "name": "ĐH CNTT & TT ↔ Khu Đô Thị Picenza",
      "origin": "ĐH CNTT & TT Thái Nguyên",
      "destination": "Khu Đô Thị Picenza",
      "distanceKm": 18,
      "basePrice": 12000,
      "studentPrice": 6000,
      "operatingStart": "06:00:00",
      "operatingEnd": "20:30:00",
      "frequencyMinutes": 20,
      "status": "active",
      "createdAt": "2026-09-26T00:00:00.000Z",
      "updatedAt": "2026-09-26T00:00:00.000Z",
      "routeStations": [
        {
          "id": "9b1c2d3e-4f5a-6b7c-8d9e-0f1a2b3c4d5e",
          "routeId": "8a44b1c2-3d5e-4f6a-9b8c-1e2d3f4a5b6c",
          "stationId": "060d4b88-122e-4b7e-9769-ad8064be48ce",
          "stopOrder": 1,
          "distanceFromStartKm": 0,
          "durationFromStartMinutes": 0,
          "station": {
            "id": "060d4b88-122e-4b7e-9769-ad8064be48ce",
            "name": "Trạm ĐH CNTT & TT Thái Nguyên (ICTU)",
            "address": "Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên",
            "latitude": 21.5855,
            "longitude": 105.8072,
            "isHub": true,
            "status": "active",
            "createdAt": "2026-09-26T00:00:00.000Z"
          }
        },
        {
          "id": "a2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d",
          "routeId": "8a44b1c2-3d5e-4f6a-9b8c-1e2d3f4a5b6c",
          "stationId": "9d7e5590-f916-43ad-8d3e-ae89c89420bf",
          "stopOrder": 2,
          "distanceFromStartKm": 8,
          "durationFromStartMinutes": 20,
          "station": {
            "id": "9d7e5590-f916-43ad-8d3e-ae89c89420bf",
            "name": "Trạm Ngã 3 Mỏ Chè",
            "address": "Phường Phan Đình Phùng, TP. Thái Nguyên",
            "latitude": 21.567,
            "longitude": 105.832,
            "isHub": false,
            "status": "active",
            "createdAt": "2026-09-26T00:00:00.000Z"
          }
        },
        {
          "id": "b3c4d5e6-f7a8-9b0c-1d2e-3f4a5b6c7d8e",
          "routeId": "8a44b1c2-3d5e-4f6a-9b8c-1e2d3f4a5b6c",
          "stationId": "50c4aa86-cf5a-4b08-8e64-be573a649fb9",
          "stopOrder": 3,
          "distanceFromStartKm": 18,
          "durationFromStartMinutes": 45,
          "station": {
            "id": "50c4aa86-cf5a-4b08-8e64-be573a649fb9",
            "name": "Trạm Bệnh Viện Đa Khoa Trung Ương",
            "address": "Đường Lương Ngọc Quyến, TP. Thái Nguyên",
            "latitude": 21.554,
            "longitude": 105.845,
            "isHub": true,
            "status": "active",
            "createdAt": "2026-09-26T00:00:00.000Z"
          }
        }
      ]
    }
  ],
  "message": "Thao tác thành công"
}
```

#### Response Mẫu Thật 2: Tra cứu theo trạm trung gian (VD: `GET /api/v1/routes?origin=Cổng KTX`)
- **HTTP Status:** `200 OK`
- Tuyến `CT-01` được lọc chính xác vì có chứa trạm `Cổng KTX`, **toàn bộ 5 trạm `routeStations` của tuyến vẫn được giữ trọn vẹn** (không bị cắt xén):
```json
{
  "success": true,
  "data": [
    {
      "id": "6e376ad8-12f4-4d5e-a49f-fd6a613aa61b",
      "routeCode": "CT-01",
      "name": "ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên",
      "origin": "ĐH CNTT & TT Thái Nguyên",
      "destination": "Bến Xe Trung Tâm Thái Nguyên",
      "distanceKm": 15.5,
      "basePrice": 10000,
      "studentPrice": 5000,
      "operatingStart": "05:30:00",
      "operatingEnd": "21:00:00",
      "frequencyMinutes": 15,
      "status": "active",
      "createdAt": "2026-09-26T00:00:00.000Z",
      "updatedAt": "2026-09-26T00:00:00.000Z",
      "routeStations": [
        { "stopOrder": 1, "station": { "name": "Trạm ĐH CNTT & TT Thái Nguyên (ICTU)" } },
        { "stopOrder": 2, "station": { "name": "Trạm Cổng KTX ĐH Thái Nguyên" } },
        { "stopOrder": 3, "station": { "name": "Trạm Ngã 3 Mỏ Chè" } },
        { "stopOrder": 4, "station": { "name": "Trạm Bệnh Viện Đa Khoa Trung Ương" } },
        { "stopOrder": 5, "station": { "name": "Trạm Bến Xe Trung Tâm Thái Nguyên" } }
      ]
    }
  ],
  "message": "Thao tác thành công"
}
```

#### Response Mẫu Thật 3: Không tìm thấy kết quả phù hợp (VD: `GET /api/v1/routes?keyword=KHONG_TON_TAI`)
- **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "data": [],
  "message": "Thao tác thành công"
}
```

---

### 2. Tìm kiếm Chuyến Xe theo Lộ trình & Ngày (`GET /api/v1/booking/search`)

- **Mục đích:** Khách hàng tìm chuyến xe cụ thể để đặt chỗ theo trạm đi, trạm đến và ngày khởi hành.
- **Phương thức:** `GET`
- **Đường dẫn chuẩn:** `/api/v1/booking/search`
- **Query Parameters:**
  | Tên tham số | Kiểu dữ liệu | Bắt buộc | Mô tả & Ràng buộc |
  | :--- | :--- | :---: | :--- |
  | `origin` | `string` | Không | Điểm/trạm xuất phát (VD: `ĐH CNTT & TT Thái Nguyên`). |
  | `destination`| `string` | Không | Điểm/trạm kết thúc (VD: `Bến Xe Trung Tâm Thái Nguyên`). Ràng buộc logic: trạm đón phải đứng trước trạm trả trong lộ trình (`stopOrder(origin) < stopOrder(destination)`). |
  | `date` | `string` | Không | Ngày đi định dạng chuẩn ISO: `YYYY-MM-DD` (VD: `2026-09-26`).<br>- **Nếu không truyền:** Mặc định an toàn fallback về ngày hôm nay.<br>- **Nếu truyền sai định dạng:** Bị chặn với lỗi `400 Bad Request`. |

- **Quy tắc sắp xếp (Sorting):** Tất cả các chuyến xe trả về **bắt buộc được sắp xếp tăng dần theo giờ khởi hành (`departureTime` ASC)**.

#### Response Mẫu Thật 1: Tìm chuyến thành công
- **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "ff592dd6-2091-4c10-b879-3615dc2f91c0",
      "routeId": "6e376ad8-12f4-4d5e-a49f-fd6a613aa61b",
      "routeName": "ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên",
      "routeCode": "CT-01",
      "origin": "ĐH CNTT & TT Thái Nguyên",
      "destination": "Bến Xe Trung Tâm Thái Nguyên",
      "departureTime": "2026-09-26T00:00:00.000Z",
      "arrivalTime": "2026-09-26T00:45:00.000Z",
      "status": "scheduled",
      "basePrice": 10000,
      "studentPrice": 5000,
      "totalSeats": 28,
      "availableSeats": 28,
      "vehiclePlate": "20B-012.34",
      "vehicleType": "electric"
    },
    {
      "id": "603146af-0f31-45a3-9edd-92debefe7342",
      "routeId": "6e376ad8-12f4-4d5e-a49f-fd6a613aa61b",
      "routeName": "ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên",
      "routeCode": "CT-01",
      "origin": "ĐH CNTT & TT Thái Nguyên",
      "destination": "Bến Xe Trung Tâm Thái Nguyên",
      "departureTime": "2026-09-26T01:00:00.000Z",
      "arrivalTime": "2026-09-26T01:45:00.000Z",
      "status": "scheduled",
      "basePrice": 10000,
      "studentPrice": 5000,
      "totalSeats": 28,
      "availableSeats": 28,
      "vehiclePlate": "20B-012.34",
      "vehicleType": "electric"
    },
    {
      "id": "1e891671-b16d-4a48-94fd-e0d51ecd058d",
      "routeId": "6e376ad8-12f4-4d5e-a49f-fd6a613aa61b",
      "routeName": "ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên",
      "routeCode": "CT-01",
      "origin": "ĐH CNTT & TT Thái Nguyên",
      "destination": "Bến Xe Trung Tâm Thái Nguyên",
      "departureTime": "2026-09-26T02:00:00.000Z",
      "arrivalTime": "2026-09-26T02:45:00.000Z",
      "status": "scheduled",
      "basePrice": 10000,
      "studentPrice": 5000,
      "totalSeats": 28,
      "availableSeats": 28,
      "vehiclePlate": "20B-012.34",
      "vehicleType": "electric"
    }
  ],
  "message": "Thao tác thành công"
}
```

#### Response Mẫu Thật 2: Khi KHÔNG truyền `date`
- **Request:** `GET /api/v1/booking/search?origin=ĐH CNTT & TT Thái Nguyên&destination=Bến Xe Trung Tâm Thái Nguyên`
- **HTTP Status:** `200 OK`
- Hệ thống tự động lấy ngày hiện tại của máy chủ làm bộ lọc, trả về mảng danh sách chuyến bình thường.

#### Response Mẫu Thật 3: Khi truyền `date` sai định dạng
- **Request:** `GET /api/v1/booking/search?date=32/13/2026`
- **HTTP Status:** `400 Bad Request`
```json
{
  "success": false,
  "message": "Định dạng ngày không hợp lệ",
  "errorCode": "Bad Request",
  "statusCode": 400,
  "timestamp": "2026-09-26T16:51:57.890Z",
  "path": "/api/v1/booking/search?date=32%2F13%2F2026"
}
```

#### Response Mẫu Thật 4: Khi không tìm thấy chuyến nào trong ngày (hoặc trạm ngược chiều)
- **HTTP Status:** `200 OK`
```json
{
  "success": true,
  "data": [],
  "message": "Thao tác thành công"
}
```

---

## ⚠️ CẢNH BÁO QUAN TRỌNG: CÁC ENDPOINT HIỆN CHƯA QUA AUDIT

> ### 🛑 LƯU Ý BẮT BUỘC DÀNH CHO FRONTEND:
> Các endpoint dưới đây **HIỆN CHƯA QUA REVIEW & AUDIT CHÍNH THỨC**:
> - **`GET /api/v1/trips/:id/seat-map`** *(Lấy sơ đồ cấu hình ghế)*
> - **`POST /api/v1/booking/hold-seats`** *(Giữ chỗ 10 phút trên Redis)*
> - **`POST /api/v1/booking/create`** *(Tạo đơn đặt vé và xuất vé QR)*
>
> **Đội ngũ Frontend có thể gọi thử nghiệm (Mock/Trial Integration) nhưng TUYỆT ĐỐI KHÔNG coi đây là Contract đã đóng băng ổn định. Request payload, cấu trúc Response, và cơ chế xử lý lỗi của các endpoint này có thể sẽ thay đổi trong đợt bàn giao tiếp theo.**

---

## 📋 TỔNG KẾT BẢNG FIELD ĐỐI SOÁT DỮ LIỆU FRONTEND CẦN LƯU Ý

Để tránh lệch trường giữa Frontend và Backend, Frontend đối chiếu chính xác theo bảng sau:

| Tên trường Backend hiện có | Kiểu dữ liệu | Ý nghĩa | Lưu ý quan trọng |
| :--- | :--- | :--- | :--- |
| `basePrice` | `number` | Giá vé người lớn / tiêu chuẩn | Frontend **dùng `basePrice`**, KHÔNG dùng `fareStandard`. |
| `studentPrice` | `number` | Giá vé ưu đãi cho Học sinh / Sinh viên | Đã tính sẵn mức trợ giá. |
| `distanceKm` | `number` | Độ dài tuyến tính bằng km | Kiểu float (VD: `15.5`). |
| `operatingStart` | `string` | Giờ mở tuyến buổi sáng | Định dạng `HH:mm:ss`. |
| `operatingEnd` | `string` | Giờ đóng tuyến buổi tối | Định dạng `HH:mm:ss`. |
| `frequencyMinutes` | `number` | Giãn cách giữa các chuyến (phút) | VD: `15`. |
| `totalSeats` | `number` | Tổng số ghế của xe trên chuyến | Mặc định `28`. |
| `availableSeats` | `number` | Số ghế còn trống thực tế tại thời điểm gọi | Đã trừ các vé đã đặt và ghế đang giữ chỗ. |
