import {
  AlertTriangle,
  Armchair,
  Bus,
  CalendarDays,
  Compass,
  CreditCard,
  FileBarChart2,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Navigation,
  QrCode,
  Radio,
  Route,
  ShieldAlert,
  Siren,
  SlidersHorizontal,
  Ticket,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type Role = 'admin' | 'dispatcher' | 'driver'

export const ROLES: Role[] = ['admin', 'dispatcher', 'driver']

export interface StaffUser {
  name: string
  staffId: string
  email: string
  roleTitle: string
  initials: string
}

export interface NavItem {
  key: string
  label: string
  description: string
  icon: LucideIcon
  badge?: number
}

export interface RoleMeta {
  label: string
  shortLabel: string
  icon: LucideIcon
  staff: StaffUser
}

export const ROLE_META: Record<Role, RoleMeta> = {
  admin: {
    label: 'Super Admin',
    shortLabel: 'Admin',
    icon: ShieldAlert,
    staff: {
      name: 'Trần Minh Quân',
      staffId: 'ICTU-AD-001',
      email: 'admin@ictu.edu.vn',
      roleTitle: 'Quản trị hệ thống',
      initials: 'MQ',
    },
  },
  dispatcher: {
    label: 'Điều hành viên',
    shortLabel: 'Điều hành',
    icon: Radio,
    staff: {
      name: 'Nguyễn Văn A',
      staffId: 'ICTU-OP-089',
      email: 'dieuhanh@ictu.edu.vn',
      roleTitle: 'Điều hành',
      initials: 'VA',
    },
  },
  driver: {
    label: 'Tài xế / Phụ xe',
    shortLabel: 'Tài xế',
    icon: Bus,
    staff: {
      name: 'Lê Hoàng Nam',
      staffId: 'ICTU-DR-214',
      email: 'taixe01@ictu.edu.vn',
      roleTitle: 'Tài xế Tuyến 01',
      initials: 'HN',
    },
  },
}

export const ROLE_NAV: Record<Role, NavItem[]> = {
  admin: [
    {
      key: 'dashboard',
      label: 'Dashboard Điều hành',
      description: 'Live KPI doanh thu, biểu đồ phụ tải tuyến',
      icon: LayoutDashboard,
    },
    {
      key: 'staff',
      label: 'Nhân sự & Phân quyền',
      description: 'Users, tài xế, phụ xe, phân quyền RBAC',
      icon: Users,
    },
    {
      key: 'routes',
      label: 'Tuyến & Trạm dừng',
      description: 'Routes, geofence trạm đón, định giá chặng',
      icon: Route,
    },
    {
      key: 'fleet',
      label: 'Đội xe & Sơ đồ ghế',
      description: 'Fleet vehicles, loại xe, layout ghế',
      icon: Bus,
    },
    {
      key: 'payments',
      label: 'Vé & Cổng thanh toán',
      description: 'Giao dịch VNPay/MoMo, hoàn tiền',
      icon: CreditCard,
    },
    {
      key: 'passes',
      label: 'Vé tháng & Trợ giá HSSV',
      description: 'Chính sách ưu đãi sinh viên ICTU, voucher',
      icon: Ticket,
    },
    {
      key: 'reports',
      label: 'Báo cáo & Nhật ký',
      description: 'Audit logs, báo cáo tài chính & viễn thông',
      icon: FileBarChart2,
    },
    {
      key: 'settings',
      label: 'Cài đặt hệ thống',
      description: 'Tần suất chuyến, ngưỡng cảnh báo trễ',
      icon: SlidersHorizontal,
    },
  ],
  dispatcher: [
    {
      key: 'dashboard',
      label: 'Bàn làm việc Điều hành',
      description: 'Live fleet dispatch operations',
      icon: LayoutDashboard,
    },
    {
      key: 'schedule',
      label: 'Phân lịch & Điều tài xế',
      description: 'Trip scheduling & driver rosters',
      icon: CalendarDays,
    },
    {
      key: 'gps',
      label: 'Bản đồ Giám sát GPS',
      description: 'Vị trí xe, tốc độ, trễ giờ thời gian thực',
      icon: Navigation,
    },
    {
      key: 'student-pass',
      label: 'Duyệt Vé tháng HSSV',
      description: 'Duyệt thẻ sinh viên, hình ảnh thẻ, gia hạn',
      icon: GraduationCap,
      badge: 12,
    },
    {
      key: 'incidents',
      label: 'Trung tâm Cảnh báo',
      description: 'Tắc đường, sự cố kỹ thuật, xe hỏng',
      icon: AlertTriangle,
      badge: 3,
    },
    {
      key: 'feedback',
      label: 'Đánh giá & Khiếu nại',
      description: 'Passenger feedback hub',
      icon: MessageSquare,
    },
  ],
  driver: [
    {
      key: 'driver-trip',
      label: 'Chuyến xe hôm nay',
      description: 'Lộ trình, giờ xuất bến, trạm đón',
      icon: Compass,
    },
    {
      key: 'scanner',
      label: 'Máy quét vé QR',
      description: 'Camera scanner quét vé online/offline',
      icon: QrCode,
    },
    {
      key: 'manifest',
      label: 'Danh sách hành khách',
      description: 'Passenger manifest & sơ đồ ghế',
      icon: Armchair,
    },
    {
      key: 'incident-report',
      label: 'Báo cáo sự cố',
      description: 'One-touch quick incident alert',
      icon: Siren,
    },
  ],
}
