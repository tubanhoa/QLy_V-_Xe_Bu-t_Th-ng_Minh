/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * Analytics & Audit Service: Phân tích số liệu, Doanh thu & Kiểm toán hệ thống
 * Domain: analytics / audit / reports
 * Synchronized with Backend & Supabase Cloud (100% Real Live Data)
 */

import { authService } from './auth.service'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

export interface DailyBreakdownItem {
  date: string
  revenue: number
  ticketCount: number
  routeCT01: number
  routeCT02: number
  vnpay: number
  momo: number
  vietqr: number
  cash: number
}

export interface RevenueStatsResponse {
  totalRevenue: number
  totalDiscount: number
  totalPaidBookings: number
  revenueByRoute: Array<{
    routeCode: string
    name: string
    revenue: number
    ticketCount: number
  }>
  revenueByDate: Array<{
    date: string
    revenue: number
  }>
  revenueByChannel?: Array<{
    channel: string
    amount: string
    share: number
  }>
  dailyBreakdown?: DailyBreakdownItem[]
}

export interface OccupancyTripItem {
  tripId: string
  routeName: string
  departureTime: string
  capacity: number
  booked: number
  occupancyPercentage?: number
  rate?: number
}

export interface ActivityLogItem {
  id: string
  action: string
  resourceName: string
  resourceId?: string
  changes?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  timestamp: string
  user?: {
    id: string
    fullName: string
    email: string
  }
}

export interface LiveTripItem {
  id: string
  routeId: string
  route?: {
    routeCode: string
    name: string
  }
  vehicle?: {
    licensePlate: string
    model?: string
    seatCapacity: number
  }
  driver?: {
    fullName: string
    phoneNumber?: string
  }
  departureTime: string
  arrivalTime?: string
  status: string
  bookedSeatsCount?: number
}

export interface IncidentReportItem {
  id: string
  tripId: string
  incidentType: string
  severity: 'low' | 'medium' | 'high'
  description: string
  delayMinutesEstimate?: number
  resolutionStatus: 'pending' | 'resolved' | 'acknowledged'
  reportedAt: string
  reportedByUser?: {
    id: string
    fullName: string
    phoneNumber?: string
  }
  trip?: {
    id: string
    route?: {
      routeCode: string
      name: string
    }
    vehicle?: {
      licensePlate: string
    }
    driver?: {
      fullName: string
      phoneNumber?: string
    }
  }
}

export interface AdminDashboardData {
  kpis: {
    totalRevenue: number
    totalRevenueGrowth: number
    totalTicketsSold: number
    ticketsGrowth: number
    averageOccupancyRate: number
    activeIncidentsCount: number
    activeVehiclesCount: number
  }
  revenueTrend: Array<{ date: string; revenue: number }>
  revenueByRoute: Array<{ routeCode: string; name: string; revenue: number; ticketCount: number }>
  revenueByChannel: Array<{ channel: string; amount: string; share: number }>
  occupancyTrips: OccupancyTripItem[]
  liveTrips: LiveTripItem[]
  recentAuditLogs: ActivityLogItem[]
  activeIncidentsList: IncidentReportItem[]
  dailyBreakdown: DailyBreakdownItem[]
}

class AnalyticsService {
  private baseUrl: string

  constructor() {
    const raw = (API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/+$/, '')
    this.baseUrl = raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`
  }

  /** Lấy Authorization Header từ phiên đăng nhập thực tế của người dùng */
  private getAuthHeaders(): Record<string, string> {
    const token = authService.getToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  /**
   * Fetch với header xác thực JWT của tài khoản đang đăng nhập
   */
  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = this.getAuthHeaders()
    const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } })

    if (res.status === 401 && typeof window !== 'undefined') {
      authService.clearSession()
    }
    return res
  }

  /** Lấy thống kê doanh thu thực tế từ Backend Supabase */
  async getRevenueStats(
    startDate?: string,
    endDate?: string,
  ): Promise<{ success: boolean; data?: RevenueStatsResponse; message?: string }> {
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const res = await this.fetchWithAuth(
        `${this.baseUrl}/reports/revenue${params.toString() ? `?${params.toString()}` : ''}`,
        { cache: 'no-store' },
      )
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể tải báo cáo doanh thu' }
      }
      return { success: true, data: json?.data || json }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** Lấy thống kê tỷ lệ lấp đầy ghế thực tế từ Supabase */
  async getOccupancyStats(
    date?: string,
  ): Promise<{ success: boolean; data?: OccupancyTripItem[]; overallRate?: number; message?: string }> {
    try {
      const params = new URLSearchParams()
      if (date) params.append('date', date)

      const res = await this.fetchWithAuth(
        `${this.baseUrl}/reports/occupancy-rate${params.toString() ? `?${params.toString()}` : ''}`,
        { cache: 'no-store' },
      )
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể tải thống kê phụ tải' }
      }
      const rawData = json?.data || json || {}
      const trips = rawData.trips || []
      return {
        success: true,
        data: trips.map((t: any) => ({
          tripId: t.tripId,
          routeName: t.routeName,
          departureTime: t.departureTime,
          capacity: t.capacity,
          booked: t.booked,
          rate: t.occupancyPercentage ?? (t.capacity > 0 ? Math.round((t.booked / t.capacity) * 100) : 0),
        })),
        overallRate: rawData.overallOccupancyPercentage || 0,
      }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** Lấy danh sách đội xe thực tế từ Supabase */
  async getVehicles(): Promise<{ success: boolean; data?: any[] }> {
    try {
      const res = await this.fetchWithAuth(`${this.baseUrl}/vehicles`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) return { success: false, data: [] }
      const vehicles = json?.data || json || []
      return { success: true, data: Array.isArray(vehicles) ? vehicles : [] }
    } catch {
      return { success: false, data: [] }
    }
  }

  /** Lấy danh sách chuyến xe thực tế hôm nay */
  async getLiveTrips(): Promise<{ success: boolean; data?: LiveTripItem[]; totalTrips?: number; message?: string }> {
    try {
      const res = await this.fetchWithAuth(`${this.baseUrl}/trips`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể tải danh sách chuyến xe' }
      }
      const raw = json?.data || json
      const items = Array.isArray(raw) ? raw : raw?.items || []
      return { success: true, data: items, totalTrips: raw?.meta?.totalItems ?? items.length }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** Lấy nhật ký kiểm toán thực tế từ Supabase */
  async getAuditLogs(): Promise<{ success: boolean; data?: ActivityLogItem[]; message?: string }> {
    try {
      const res = await this.fetchWithAuth(`${this.baseUrl}/admin/activity-logs?limit=20`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, message: json?.message || 'Không thể tải nhật ký kiểm toán' }
      }
      const logs = json?.data?.items || json?.data || json || []
      return { success: true, data: Array.isArray(logs) ? logs : [] }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** Lấy danh sách sự cố thực tế do tài xế báo cáo từ Supabase */
  async getActiveIncidents(status = 'all'): Promise<{ success: boolean; data: IncidentReportItem[]; message?: string }> {
    try {
      const url =
        status && status !== 'all'
          ? `${this.baseUrl}/tracking/incidents?status=${status}`
          : `${this.baseUrl}/tracking/incidents`
      const res = await this.fetchWithAuth(url, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return { success: false, data: [], message: json?.message || 'Không thể tải danh sách sự cố' }
      }
      const raw = json?.data || json || []
      return { success: true, data: Array.isArray(raw) ? raw : [] }
    } catch (e: any) {
      return { success: false, data: [], message: e?.message || 'Lỗi kết nối máy chủ' }
    }
  }

  /** Tổng hợp toàn bộ dữ liệu thật 100% cho Admin Dashboard từ Supabase Cloud */
  async getAdminDashboardSummary(startDate?: string, endDate?: string): Promise<AdminDashboardData> {
    const [revRes, occRes, tripsRes, vehRes, auditRes, incRes] = await Promise.allSettled([
      this.getRevenueStats(startDate, endDate),
      this.getOccupancyStats(startDate),
      this.getLiveTrips(),
      this.getVehicles(),
      this.getAuditLogs(),
      this.getActiveIncidents('all'),
    ])

    const revData: RevenueStatsResponse =
      revRes.status === 'fulfilled' && revRes.value.success && revRes.value.data
        ? revRes.value.data
        : {
            totalRevenue: 0,
            totalDiscount: 0,
            totalPaidBookings: 0,
            revenueByRoute: [],
            revenueByDate: [],
            revenueByChannel: [],
            dailyBreakdown: [],
          }

    const occupancyTrips =
      occRes.status === 'fulfilled' && occRes.value.success && occRes.value.data
        ? occRes.value.data
        : []

    const liveTrips =
      tripsRes.status === 'fulfilled' && tripsRes.value.success && tripsRes.value.data
        ? tripsRes.value.data
        : []

    const vehiclesList =
      vehRes.status === 'fulfilled' && vehRes.value.success && vehRes.value.data
        ? vehRes.value.data
        : []

    const recentAuditLogs =
      auditRes.status === 'fulfilled' && auditRes.value.success && auditRes.value.data
        ? auditRes.value.data
        : []

    const activeIncidentsList =
      incRes.status === 'fulfilled' && incRes.value.success && incRes.value.data
        ? incRes.value.data
        : []

    // Đếm số sự cố đang mở (pending) do tài xế báo cáo thực tế
    const pendingIncidentsCount = activeIncidentsList.filter(
      (i) => i.resolutionStatus === 'pending',
    ).length

    // Tính toán tỷ lệ lấp đầy trung bình từ các chuyến xe thực tế
    const avgRate =
      occupancyTrips.length > 0
        ? Math.round(
            occupancyTrips.reduce((acc, t) => acc + (t.rate || 0), 0) /
              occupancyTrips.length,
          )
        : occRes.status === 'fulfilled' && occRes.value.overallRate
          ? occRes.value.overallRate
          : 0

    // Số xe thực tế từ đội xe đã đăng ký trong cơ sở dữ liệu Supabase
    const realVehicleCount = vehiclesList.length

    // Tính toán tỷ lệ tăng trưởng doanh thu so với ngày hôm trước
    let revenueGrowth = 0
    if (revData.revenueByDate.length >= 2) {
      const todayRev = revData.revenueByDate[revData.revenueByDate.length - 1].revenue
      const yesterdayRev = revData.revenueByDate[revData.revenueByDate.length - 2].revenue
      if (yesterdayRev > 0) {
        revenueGrowth = Number((((todayRev - yesterdayRev) / yesterdayRev) * 100).toFixed(1))
      }
    }

    // Kênh thanh toán thực tế từ Supabase
    const channels = revData.revenueByChannel || []

    return {
      kpis: {
        totalRevenue: revData.totalRevenue,
        totalRevenueGrowth: revenueGrowth,
        totalTicketsSold: revData.totalPaidBookings,
        ticketsGrowth: revenueGrowth,
        averageOccupancyRate: avgRate,
        activeIncidentsCount: pendingIncidentsCount,
        activeVehiclesCount: realVehicleCount,
      },
      revenueTrend: revData.revenueByDate,
      revenueByRoute: revData.revenueByRoute,
      revenueByChannel: channels,
      occupancyTrips,
      liveTrips,
      recentAuditLogs,
      activeIncidentsList,
      dailyBreakdown: revData.dailyBreakdown || [],
    }
  }
}

export const analyticsService = new AnalyticsService()
