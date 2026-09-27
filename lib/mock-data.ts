export type TripStatus = 'running' | 'arriving' | 'delayed' | 'scheduled'

export interface Trip {
  id: string
  code: string
  route: string
  plate: string
  driver: string
  departure: string
  occupancy: number
  capacity: number
  status: TripStatus
  delayMinutes?: number
}

export interface Kpi {
  key: string
  label: string
  value: string
  delta: string
  progress: number
  hint: string
}

export interface OpenIncident {
  id: string
  title: string
  location: string
  time: string
  severity: 'high' | 'medium' | 'low'
}

export interface RevenueChannel {
  channel: string
  amount: string
  share: number
}

export interface RouteStop {
  name: string
  time: string
  state: 'done' | 'current' | 'upcoming'
}

export const UPCOMING_TRIPS: Trip[] = [
  {
    id: 't1',
    code: 'CT-01-0715',
    route: 'Tuyến 01: ICTU → Bến xe Trung tâm',
    plate: '20B-012.45',
    driver: 'Lê Hoàng Nam',
    departure: '07:15',
    occupancy: 38,
    capacity: 45,
    status: 'running',
  },
  {
    id: 't2',
    code: 'CT-02-0720',
    route: 'Tuyến 02: ICTU → Ga Thái Nguyên',
    plate: '20B-018.62',
    driver: 'Phạm Đức Thắng',
    departure: '07:20',
    occupancy: 41,
    capacity: 45,
    status: 'arriving',
  },
  {
    id: 't3',
    code: 'CP-03-0730',
    route: 'Tuyến Campus: KTX K → Giảng đường C',
    plate: '20B-021.08',
    driver: 'Hoàng Văn Tùng',
    departure: '07:30',
    occupancy: 29,
    capacity: 32,
    status: 'delayed',
    delayMinutes: 5,
  },
  {
    id: 't4',
    code: 'CT-01-0745',
    route: 'Tuyến 01: ICTU → Bến xe Trung tâm',
    plate: '20B-009.77',
    driver: 'Ngô Thị Hạnh',
    departure: '07:45',
    occupancy: 12,
    capacity: 45,
    status: 'scheduled',
  },
  {
    id: 't5',
    code: 'CT-04-0800',
    route: 'Tuyến 04: ICTU → ĐH Thái Nguyên',
    plate: '20B-030.15',
    driver: 'Vũ Minh Khoa',
    departure: '08:00',
    occupancy: 6,
    capacity: 45,
    status: 'scheduled',
  },
]

export const ADMIN_KPIS: Kpi[] = [
  {
    key: 'revenue',
    label: 'Doanh thu hôm nay',
    value: '48,6 tr₫',
    delta: '+12,4%',
    progress: 72,
    hint: '72% mục tiêu ngày',
  },
  {
    key: 'trips',
    label: 'Số chuyến hoàn thành',
    value: '186 / 240',
    delta: '+8 chuyến',
    progress: 78,
    hint: '54 chuyến còn lại',
  },
  {
    key: 'occupancy',
    label: 'Tỷ lệ lấp đầy ghế',
    value: '84%',
    delta: '+3,1%',
    progress: 84,
    hint: 'Cao điểm 06:30 – 08:00',
  },
  {
    key: 'speed',
    label: 'Tốc độ trung bình',
    value: '28 km/h',
    delta: '-1,2 km/h',
    progress: 56,
    hint: 'Ngưỡng an toàn 50 km/h',
  },
]

export const OPEN_INCIDENTS: OpenIncident[] = [
  {
    id: 'i1',
    title: 'Tắc đường kéo dài',
    location: 'Ngã tư Đồng Quang · Tuyến Campus',
    time: '3 phút trước',
    severity: 'high',
  },
  {
    id: 'i2',
    title: 'Cảnh báo áp suất lốp',
    location: 'Xe 20B-018.62 · Tuyến 02',
    time: '11 phút trước',
    severity: 'medium',
  },
  {
    id: 'i3',
    title: 'Máy quét QR mất kết nối',
    location: 'Xe 20B-009.77 · Bến ICTU',
    time: '24 phút trước',
    severity: 'low',
  },
]

export const REVENUE_CHANNELS: RevenueChannel[] = [
  { channel: 'VNPay QR', amount: '21,3 tr₫', share: 44 },
  { channel: 'Ví MoMo', amount: '14,6 tr₫', share: 30 },
  { channel: 'Vé tháng HSSV', amount: '9,2 tr₫', share: 19 },
  { channel: 'Tiền mặt', amount: '3,5 tr₫', share: 7 },
]

export const DRIVER_ROUTE_STOPS: RouteStop[] = [
  { name: 'Bến ICTU (Cổng chính)', time: '07:45', state: 'current' },
  { name: 'Ký túc xá K', time: '07:52', state: 'upcoming' },
  { name: 'Chợ Túc Duyên', time: '08:04', state: 'upcoming' },
  { name: 'Quảng trường Võ Nguyên Giáp', time: '08:15', state: 'upcoming' },
  { name: 'Bến xe Trung tâm', time: '08:28', state: 'upcoming' },
]
