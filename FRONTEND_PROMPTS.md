# THƯ VIỆN PROMPTS THIẾT KẾ FRONTEND UI/UX
## DỰ ÁN: HỆ THỐNG VÉ XE BUÝT THÔNG MINH (SMART BUS TICKETING SYSTEM - ICTU)

Tài liệu này lưu trữ toàn bộ các câu lệnh Prompt chuẩn chuyên nghiệp (Prompt Engineering) và tài liệu đặc tả thiết kế giao diện được tối ưu hóa riêng cho các công cụ AI Canvas (như **v0.dev, Claude Artifacts, Lovable, Bolt.new, Cursor Canvas, ChatGPT Canvas**), phản ánh **100% thiết kế thực tế đang hoạt động trong mã nguồn hệ thống**.

---

## MỤC LỤC
1. [Hướng dẫn sử dụng chung cho Canvas AI](#1-hướng-dẫn-sử-dụng-chung-cho-canvas-ai)
2. [Bộ Design Tokens & Hệ màu Vietcombank Green kết hợp Smart Transit](#2-bộ-design-tokens--hệ-màu-vietcombank-green-kết-hợp-smart-transit)
3. [PROMPT 1: DỰNG KHUNG ADMIN PORTAL (LOGIN + RBAC LAYOUT + RESPONSIVE)](#3-prompt-1-dựng-khung-admin-portal-login--rbac-layout--responsive)
4. [PROMPT 2: LANDING PAGE ZERO-SCROLL (CHUẨN VIETCOMBANK + BỘ THẺ 3D CUỘN CHUỘT)](#4-prompt-2-landing-page-zero-scroll-chuẩn-vietcombank--bộ-thẻ-3d-cuộn-chuột)
5. [PROMPT 3: SƠ ĐỒ 28 GHẾ XE BUÝT ĐIỆN & ĐẶT VÉ QR MỘT CHẠM](#5-prompt-3-sơ-đồ-28-ghế-xe-buýt-điện--đặt-vé-qr-một-chạm)
6. [PROMPT 4: PHÂN HỆ DI ĐỘNG TÀI XẾ / PHỤ XE (MÁY QUÉT QR, MANIFEST & SỰ CỐ)](#6-prompt-4-phân-hệ-di-động-tài-xế--phụ-xe-máy-quét-qr-manifest--sự-cố)
7. [PROMPT 5: PHÂN HỆ ĐIỀU HÀNH VIÊN (RADAR GPS 12 XE, DUYỆT THẺ SV, ĐIỀU ĐỘ)](#7-prompt-5-phân-hệ-điều-hành-viên-radar-gps-12-xe-duyệt-thẻ-sv-điều-độ)
8. [PROMPT 6: PHÂN HỆ SUPER ADMIN (QUẢN TRỊ TUYẾN, ĐỘI XE, DOANH THU & XUẤT BÁO CÁO)](#8-prompt-6-phân-hệ-super-admin-quản-trị-tuyến-đội-xe-doanh-thu--xuất-báo-cáo)
9. [Bảng theo dõi tiến độ hoàn thành các phân hệ](#9-bảng-theo-dõi-tiến-độ-hoàn-thành-các-phân-hệ)

---

## 1. Hướng dẫn sử dụng chung cho Canvas AI

Khi sử dụng các công cụ Canvas AI (v0, Lovable, Claude 3.7 Sonnet Artifacts, Bolt.new, Cursor):
- **Bước 1:** Chọn Prompt tương ứng với phân hệ cần sinh mã (Mục 3 đến Mục 8).
- **Bước 2:** Dán vào khung chat của Canvas AI và tạo Project mới (chọn chế độ Next.js / React + TypeScript + Ant Design 5 / Tailwind CSS).
- **Bước 3:** Sử dụng tính năng chọn vùng (Select Element / Point & Click) kết hợp với các chỉ dẫn CSS Tokens ở Mục 2 để tinh chỉnh chi tiết.

---

## 2. Bộ Design Tokens & Hệ màu Vietcombank Green kết hợp Smart Transit

### 2.1. Bảng mã màu chuẩn thương hiệu (Brand Palette)

Hệ thống kết hợp giữa **màu xanh đậm uy tín của Vietcombank** và **màu xanh neon/lime công nghệ của di chuyển xanh (VinBus / Grab Tech)**:

```typescript
export const smartBusThemeTokens = {
  // Thương hiệu chính: Vietcombank Pine Green
  brandPrimary: '#005A36',         // Màu xanh đậm chủ đạo Vietcombank
  brandPrimaryHover: '#007044',    // Hover xanh sáng hơn
  brandPrimaryActive: '#004328',   // Bấm giữ

  // Điểm nhấn năng động & Nút CTA chính:
  brandAccentLime: '#C3E82C',      // Electric Lime (nút Tìm Chuyến, Đặt Vé, Huy hiệu)
  brandAccentHover: '#d2f347',     // Hover Lime sáng rực
  brandEcoGreen: '#00A86B',        // Dynamic Transit Green (xe buýt, trạm đón)

  // Bề mặt & Kính mờ (Glassmorphism):
  glassBg: 'rgba(255, 255, 255, 0.12)',
  glassBorder: 'rgba(255, 255, 255, 0.3)',
  glassBlur: '15px',

  // Văn bản & Tương phản:
  textDark: '#0F172A',            // Slate 900
  textMuted: '#475569',           // Slate 600
  textLight: '#F8FAFC',           // Trắng sáng
}
```

### 2.2. Đặc tả CSS Glassmorphism chuẩn (`.glass-card`)

Áp dụng cho bộ thẻ 3D xoay cuộn chuột và các thanh công cụ nổi:

```css
.glass-card {
  width: 240px;
  height: 360px;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    inset 0 -1px 0 rgba(255, 255, 255, 0.1),
    inset 0 0 20px 10px rgba(255, 255, 255, 1);
  position: relative;
  overflow: hidden;
}

.glass-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.8),
    transparent
  );
}
```

### 2.3. Quy chuẩn Icon Vector & Không dùng Emoji OS

> 🚫 **NGUYÊN TẮC BẮT BUỘC:** Tuyệt đối **KHÔNG SỬ DỤNG EMOJI HỆ ĐIỀU HÀNH** (📊, 👥, 🚌, 🚨, 💳, 🎫...).  
> ✅ **THAY THẾ BẰNG:** Hệ thống **Vector SVG Icons đồng bộ (Lucide React)** (`strokeWidth: 1.75`), bo góc nét vẽ mềm, kết hợp hiệu ứng chuyển động xúc giác (`active:scale-95`).

---

## 3. PROMPT 1: DỰNG KHUNG ADMIN PORTAL (LOGIN + RBAC LAYOUT + RESPONSIVE)

```markdown
### SYSTEM CONTEXT & ROLE
You are a Principal Frontend Architect with deep expertise in React 18+, TypeScript, Ant Design 5 (antd), Tailwind CSS, and Lucide Icons (`lucide-react`).

### CRITICAL DIRECTIVES
- Zero OS emojis in the UI. Exclusively use vector SVG icons from `lucide-react`.
- Primary Brand Color: `#005A36` (Vietcombank Green) with `#00A86B` (Transit Green).
- Fluid haptic button feel (`active:scale-[0.97] transition-all`).

### SCREENS & SPECIFICATIONS
1. **Futuristic Tech-Mobility Login Screen (/login):**
   - Split Layout: Left panel (55%) features glowing transit lines, Thai Nguyen tea hills backdrop, and 3 live telemetry badges.
   - Right panel (45%) features a glassmorphic login card with Ant Design form fields (Email @ictu.edu.vn, Password).
   - Fast Role Switcher with sliding pill: Super Admin, Điều hành viên, Tài xế.

2. **Master Application Shell (AppShell.tsx):**
   - Desktop Collapsible Sider: Brand emblem, user badge with live pulse indicator, and role-filtered navigation menu:
     - Admin: Dashboard, Nhân sự & RBAC, Tuyến & Trạm, Đội xe & Sơ đồ ghế, Vé & Thanh toán, Vé tháng HSSV, Báo cáo & Nhật ký, Cài đặt.
     - Dispatcher: Bàn làm việc điều hành, Lập lịch & Điều tài xế, Bản đồ GPS 12 xe, Duyệt vé tháng HSSV, Trung tâm sự cố, Đánh giá khiếu nại.
     - Driver: Chuyến xe hôm nay, Máy quét vé QR, Danh sách hành khách (Manifest), Báo cáo sự cố khẩn cấp.
   - TopHeader: Sider toggle, breadcrumbs, Ctrl+K quick search bar, live GPS latency pill (`18ms`), notification badge, theme switch, user profile dropdown.
   - Mobile View (< 768px): Collapsible bottom sheet for navigation, touch-friendly tactile cards.
```

---

## 4. PROMPT 2: LANDING PAGE ZERO-SCROLL (CHUẨN VIETCOMBANK + BỘ THẺ 3D CUỘN CHUỘT)

```markdown
### SYSTEM CONTEXT & ROLE
You are a Senior Creative Frontend Specialist and UI/UX Director specializing in cutting-edge single-viewport (Zero-Scroll) web applications and Vietcombank design standards.

### PROJECT OVERVIEW: ICTU SMART TRANSIT LANDING PAGE
Build a single-viewport (`h-screen max-h-screen overflow-hidden`) landing page that presents a stunning, wow-factor first impression.

### DETAILED DESIGN SPECIFICATIONS
1. **Background & Atmosphere:**
   - Fullscreen background image of Thai Nguyen Tea Hills (`tea-hills-hero.jpg`).
   - Radial & linear atmosphere overlays: White gradient on the left (58%) ensuring high text readability while keeping the green landscape vibrant on the right.

2. **Dual-Tier Transparent Header:**
   - Tier 1 (Utility Bar): Audience segment pill tabs (Cá nhân / Sinh viên, Cán bộ Giảng viên, Doanh nghiệp), Hotline 24/7 (`1900 8899`), Tra cứu vé, Language selector (VI/EN), and button linking to `/login`.
   - Tier 2 (Main Header): Brand emblem "ICTU TRANSIT - Hệ Thống Xe Buýt Thông Minh", mega-nav links with subtle hover underlines, and button "ĐẶT VÉ TRỰC TUYẾN" in high-contrast Lime `#C3E82C`.

3. **Middle Viewport Stage (Hero Section):**
   - Left Column (Greeting & Search-First Bar):
     - Dynamic time-of-day greeting (Chào buổi sáng / Buổi chiều / Buổi tối).
     - Badge: "BỘ SƯU TẬP THẺ THÔNG MINH ICTU 2026" in `#005A36` glass pill.
     - Bold Heading: "Hành Trình Xanh Cùng ICTU Smart Transit".
     - Compact Search-First Booking Bar:
       - Inputs: Điểm đón (e.g. KTX ICTU), Điểm đến (e.g. Bến xe Thái Nguyên), Giờ chạy (e.g. 07:45).
       - Quick route pills: [Tất cả] [CT-01] [CT-02] [CT-03].
       - Action CTA Button: "TÌM CHUYẾN XE" (Electric Lime `#C3E82C`, text `#005A36`, font-black).
   - Right Column (Interactive 3D Card Fan):
     - 4 high-end smart bus cards (ICTU Transit Visa Green, Gold Member, Diamond Student, Platinum Eco).
     - Styled with `.glass-card` specifications (`width: 240px; height: 360px; backdrop-filter: blur(15px); border-radius: 20px; border: 1px solid rgba(255,255,255,0.3)`).
     - Interactive 3D Perspective (`perspective: 1200px`) that smoothly rotates and cycles through cards when the user scrolls the mouse wheel (`window.addEventListener('wheel')`).
     - Subtitle note below cards: "Cuộn chuột để khám phá bộ thẻ 3D" with animated mouse icon.

4. **Floating Quick Access Glass Section:**
   - Positioned at the bottom of the viewport as a floating glass bar (`bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl rounded-2xl p-2.5 mx-auto max-w-5xl`).
   - 5 Tactile Mobile App Action Buttons:
     1. Tra cứu lộ trình tuyến xe
     2. Đăng ký vé tháng HSSV (Trợ giá 50%)
     3. Soát vé điện tử QR Code
     4. Tin tức & Lịch chạy xe
     5. Mạng lưới trạm & Radar GPS
   - Clicking opens corresponding interactive modal dialogs.

5. **Floating 24/7 Mascot Support Bot:**
   - Positioned fixed in bottom-right corner with live greeting speech bubble, instant support chatbot dialog, FAQ answers, and hotlines.
```

---

## 5. PROMPT 3: SƠ ĐỒ 28 GHẾ XE BUÝT ĐIỆN & ĐẶT VÉ QR MỘT CHẠM

```markdown
### SYSTEM CONTEXT & ROLE
Build an interactive Bus Seat Picker Modal & One-Touch Electronic QR Ticket Generation system (`SeatPickerModal.tsx`).

### SPECIFICATIONS
1. **Trip Header Info:**
   - Route display: "Tuyến CT-01: KTX ICTU ➔ Bến xe Thái Nguyên".
   - Time: "07:45 (Sáng)", Base Price: 15,000 VND / vé.
   - Interactive departure time selector: [06:15] [07:00] [07:45] [08:30] [09:15] [10:00].

2. **28-Seat Bus Layout Simulator:**
   - 2 columns (A & B) with central aisle:
     - Hàng A: A01 -> A14 (14 ghế bên trái)
     - Hàng B: B01 -> B14 (14 ghế bên phải)
   - 4 Clear Color Coded States:
     - Available (Trắng / Slate-100)
     - Selected (Xanh lá `#00A86B` / `#005A36` kèm dấu tích checkmark)
     - Occupied (Xám nhạt `bg-slate-200`, không cho bấm)
     - Priority Seat (Màu vàng hổ phách `amber-100` viền `amber-300` dành cho người cao tuổi / phụ nữ mang thai)
   - Driver cabin layout indicator at the top with steering wheel icon.

3. **10-Minute Seat Lock TTL Countdown:**
   - Prominent countdown timer (`09:59`) displayed at top right of seat map.
   - Prevents race conditions and simulates Redis distributed locking.

4. **Passenger Information Form:**
   - Full name, Phone number, Student ID (optional for 50% discount).
   - Voucher code input with one-click apply button.

5. **Payment Gateway Integration:**
   - Selection between VNPay QR, Ví MoMo, and VietQR 247.
   - Payment confirmation step with countdown and simulated success callback.

6. **Electronic QR Ticket Receipt Modal:**
   - High-definition SVG QR code generated with ticket hash (`TKT-ICTU-2026-XXXX`).
   - Detailed trip receipt: Route, seat numbers, departure time, total paid amount, passenger contact.
   - Action buttons: "Lưu mã vé", "Tải ảnh vé QR", "Đóng".
```

---

## 6. PROMPT 4: PHÂN HỆ DI ĐỘNG TÀI XẾ / PHỤ XE (MÁY QUÉT QR, MANIFEST & SỰ CỐ)

```markdown
### SYSTEM CONTEXT & ROLE
Build the mobile-first Driver and Conductor handheld module within the Smart Bus system, optimized for touch interaction on phones and tablets.

### SCREENS & COMPONENTS
1. **Driver Dashboard (`DriverDashboard.tsx`):**
   - Active Trip Card: Route CT-01, vehicle plate `20B-189.26`, departure `07:45`, passenger board count (24/28).
   - Big tactile action buttons: [Mở Máy Quét Soát Vé] and [Xem Danh Sách 28 Khách].
   - Quick shift status toggle (Đang chạy / Nghỉ giữa ca).

2. **Real-time QR Camera Viewfinder Scanner (`DriverScanner.tsx`):**
   - Camera viewfinder frame simulator with animated scanning laser bar.
   - Flashlight toggle button, camera flip button, scan sound toggle.
   - Ticket Validation Results:
     - SUCCESS CARD: Green highlight, "VÉ HỢP LỆ - CHECK-IN THÀNH CÔNG", Passenger name, Seat number (e.g. A03), Ticket code.
     - REJECT CARD: Red highlight, "VÉ ĐÃ SỬ DỤNG HOẶC KHÔNG HỢP LỆ", warning details.
   - Offline Verification Engine support with local cache badge.

3. **28-Passenger Manifest (`DriverManifest.tsx`):**
   - Complete manifest of all 28 seats for the current trip.
   - Search bar by passenger name, seat number, or phone number.
   - Filter tabs: [Tất cả 28] [Đã lên xe 24] [Chưa lên xe 4].
   - One-tap check-in action button for manual check-in when passengers run out of phone battery.

4. **Tactile Emergency Incident Reporter (`DriverIncident.tsx`):**
   - 4 large quick-tap emergency buttons:
     1. Tắc đường nghiêm trọng (`AlertTriangle`)
     2. Sự cố kỹ thuật / Xịt lốp (`Wrench`)
     3. Va chạm giao thông (`ShieldAlert`)
     4. Sự cố thời tiết / Ngập úng (`CloudRain`)
   - Estimated delay selector pills: [+10 phút] [+20 phút] [+30 phút] [+45 phút].
   - Live dispatch status showing acknowledgment from Dispatcher center.

5. **Driver Bottom Navigation Bar (`DriverBottomNav.tsx`):**
   - Fixed mobile bottom navigation with 4 touch targets: Chuyến đi, Máy quét QR (nổi bật với floating button), Danh sách khách, Báo sự cố.
```

---

## 7. PROMPT 5: PHÂN HỆ ĐIỀU HÀNH VIÊN (RADAR GPS 12 XE, DUYỆT THẺ SV, ĐIỀU ĐỘ)

```markdown
### SYSTEM CONTEXT & ROLE
Build the Dispatcher & Fleet Operations Console (`dispatcher-*.tsx`) for transit monitoring and approval workflows.

### MODULES & SPECIFICATIONS
1. **Live Fleet GPS Radar Map (`DispatcherGpsMap.tsx`):**
   - Interactive radar console monitoring 12 smart electric buses across 3 routes (CT-01, CT-02, CT-03).
   - Route filter selector, live vehicle list with real-time speed (km/h), VinFast battery % level, occupancy (e.g. 24/28), and delay status.
   - Vehicle cards with quick driver call and route rerouting actions.

2. **Student Pass Approval Hub (`DispatcherStudentApproval.tsx`):**
   - Management table of 12 pending student monthly pass applications (ICTU, ĐH Sư Phạm, ĐH Y Dược).
   - Photo inspection modal allowing dispatchers to zoom in on uploaded student ID cards.
   - Actions: One-click "Phê duyệt" (issues pass code with 50% discount) or "Từ chối" (with predefined rejection reason selector).

3. **Trip Scheduling & Driver Roster Dispatch (`DispatcherSchedule.tsx`):**
   - Daily timetable schedule grid showing all shifts from 06:00 to 21:00.
   - Driver assignment dropdown, vehicle plate assignment dropdown, headway frequency controls, and instant dispatch trigger.

4. **Incident Monitoring Center (`DispatcherIncidents.tsx`):**
   - Real-time queue of reported road delays and vehicle malfunctions from drivers.
   - Priority status badges (Cao, Trung bình, Thấp), estimated delay times, and resolution dispatch controls.
```

---

## 8. PROMPT 6: PHÂN HỆ SUPER ADMIN (QUẢN TRỊ TUYẾN, ĐỘI XE, DOANH THU & XUẤT BÁO CÁO)

```markdown
### SYSTEM CONTEXT & ROLE
Build the Super Admin Control Center (`admin-*.tsx`) for system configuration, fleet assets, staff RBAC, financial reconciliation, and analytics reports.

### MODULES & SPECIFICATIONS
1. **Route & Station Network Management (`AdminRoutes.tsx`):**
   - Comprehensive CRUD table for bus routes (CT-01, CT-02, CT-03).
   - Sequence of bus stations with geofence distance (km), estimated transit minutes, base fare pricing, and active/pause toggles.
   - Modal for adding/editing routes with station order dragging.

2. **Fleet Asset Management (`AdminFleet.tsx`):**
   - 12 fleet vehicles (VinFast eBus electric and Hyundai clean diesel).
   - License plate registry, seat capacity (28 seats, 45 seats), battery/fuel gauge, technical inspection expiration dates, and maintenance logs.

3. **Payment Transactions & Refund Console (`AdminPayments.tsx`):**
   - Financial ledger tracking VNPay, MoMo, and VietQR transactions.
   - Transaction status filtering (Thành công, Chờ xử lý, Đã hoàn tiền).
   - Modal for processing ticket refunds (Hoàn tiền vé hủy) with policy validation and reason logging.

4. **Staff Directory & 4-Role RBAC Management (`AdminStaff.tsx`):**
   - Personnel directory of Administrators, Dispatchers, Drivers, and Conductors.
   - Quick role switcher, contact details, account lock/unlock switch, and staff ID badges.

5. **Financial Analytics & Audit Log Reports (`AdminReports.tsx`):**
   - Revenue charts by day/week/month and route occupancy breakdown (78% - 92%).
   - Export buttons: "Xuất Báo Cáo Excel (.xlsx)" and "Xuất Báo Cáo PDF (.pdf)" with loading states and download simulation.
   - Audit trail tab recording system logins, route edits, student pass approvals, and refunds.

6. **System Operational Threshold Settings (`AdminSettings.tsx`):**
   - Seat lock TTL duration (10 minutes).
   - Real-time GPS ping interval (3 seconds).
   - Geofence station alert radius (500 meters).
   - Student subsidy discount rate (50%).
```

---

## 9. Bảng theo dõi tiến độ hoàn thành các phân hệ

| Mã Prompt | Tên Phân Hệ & Giao Diện | File Component Mã Nguồn Thực Tế | Tình trạng |
| :---: | :--- | :--- | :---: |
| **PROMPT 1** | **Khung Admin Portal & Phân quyền RBAC 4 vai trò** | `components/portal/app-shell.tsx`<br/>`components/login/login-form.tsx` | ✅ Đã hoàn thành 100% |
| **PROMPT 2** | **Landing Page Zero-Scroll chuẩn Vietcombank & Thẻ 3D** | `components/landing/landing-page.tsx`<br/>`components/landing/vietcombank-hero.tsx` | ✅ Đã hoàn thành 100% |
| **PROMPT 3** | **Sơ đồ 28 ghế xe buýt điện & Đặt vé QR một chạm** | `components/landing/seat-picker-modal.tsx`<br/>`components/landing/quick-access-modals.tsx` | ✅ Đã hoàn thành 100% |
| **PROMPT 4** | **Phân hệ Di động Tài xế (Máy quét QR & Manifest)** | `components/portal/dashboard/driver-scanner.tsx`<br/>`components/portal/dashboard/driver-manifest.tsx`<br/>`components/portal/dashboard/driver-incident.tsx` | ✅ Đã hoàn thành 100% |
| **PROMPT 5** | **Phân hệ Điều hành viên (Radar GPS 12 xe & Duyệt thẻ SV)** | `components/portal/modules/dispatcher-gps-map.tsx`<br/>`components/portal/modules/dispatcher-student-approval.tsx`<br/>`components/portal/modules/dispatcher-schedule.tsx` | ✅ Đã hoàn thành 100% |
| **PROMPT 6** | **Phân hệ Super Admin (Tuyến, Đội xe, Doanh thu & Báo cáo)**| `components/portal/modules/admin-routes.tsx`<br/>`components/portal/modules/admin-fleet.tsx`<br/>`components/portal/modules/admin-payments.tsx`<br/>`components/portal/modules/admin-reports.tsx` | ✅ Đã hoàn thành 100% |

---
*Tài liệu được cập nhật đồng bộ với toàn bộ mã nguồn Frontend ICTU Smart Transit.*
