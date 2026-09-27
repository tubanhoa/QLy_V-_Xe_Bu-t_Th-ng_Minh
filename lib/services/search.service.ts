import {
  BusRoute,
  RouteStationItem,
  SearchTripsQuery,
  Station,
  TripSearchResult,
  UnifiedApiResponse,
} from '@/lib/types/sprint1'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

class SearchService {
  private baseUrl: string

  constructor() {
    this.baseUrl = API_BASE_URL.replace(/\/+$/, '')
  }

  /**
   * Lấy danh sách tuyến xe buýt hoặc tìm kiếm theo từ khóa / trạm đón / trạm trả
   * Endpoint chuẩn: GET /api/v1/routes
   */
  async getRoutes(params?: {
    keyword?: string
    origin?: string
    destination?: string
  }): Promise<UnifiedApiResponse<BusRoute[]>> {
    try {
      const searchParams = new URLSearchParams()
      if (params?.keyword?.trim()) searchParams.append('keyword', params.keyword.trim())
      if (params?.origin?.trim()) searchParams.append('origin', params.origin.trim())
      if (params?.destination?.trim()) searchParams.append('destination', params.destination.trim())

      const url = `${this.baseUrl}/routes${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || `Lỗi tải danh sách tuyến (${response.status})`)
      }

      const resJson = await response.json()
      // Chuẩn hóa response về dạng UnifiedApiResponse
      if (Array.isArray(resJson)) {
        return { success: true, data: resJson }
      }
      return resJson
    } catch (error: any) {
      console.error('[SearchService.getRoutes] Lỗi kết nối API:', error)
      return {
        success: false,
        data: [],
        message: error?.message || 'Không thể kết nối đến máy chủ Backend',
      }
    }
  }

  /**
   * Lấy chi tiết tuyến xe và các trạm dừng
   * Endpoint chuẩn: GET /api/v1/routes/:id
   */
  async getRouteById(id: string): Promise<UnifiedApiResponse<BusRoute | null>> {
    try {
      const response = await fetch(`${this.baseUrl}/routes/${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`Không tìm thấy tuyến xe (${response.status})`)
      }

      const resJson = await response.json()
      return resJson.data ? resJson : { success: true, data: resJson }
    } catch (error: any) {
      console.error(`[SearchService.getRouteById] Lỗi tìm tuyến ${id}:`, error)
      return {
        success: false,
        data: null,
        message: error?.message || 'Không thể lấy thông tin chi tiết tuyến',
      }
    }
  }

  /**
   * Tìm kiếm các chuyến xe theo điểm xuất phát, điểm đến và ngày khởi hành
   * Endpoint chuẩn: GET /api/v1/booking/search
   */
  async searchTrips(query?: SearchTripsQuery): Promise<UnifiedApiResponse<TripSearchResult[]>> {
    try {
      const searchParams = new URLSearchParams()
      if (query?.origin?.trim()) searchParams.append('origin', query.origin.trim())
      if (query?.destination?.trim()) searchParams.append('destination', query.destination.trim())
      if (query?.date?.trim()) searchParams.append('date', query.date.trim())

      const url = `${this.baseUrl}/booking/search${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || `Lỗi tìm chuyến xe (${response.status})`)
      }

      const resJson = await response.json()
      if (Array.isArray(resJson)) {
        return { success: true, data: resJson }
      }
      return resJson
    } catch (error: any) {
      console.error('[SearchService.searchTrips] Lỗi tìm chuyến xe:', error)
      return {
        success: false,
        data: [],
        message: error?.message || 'Không thể kết nối đến hệ thống tìm chuyến',
      }
    }
  }

  /**
   * Tiện ích: Lấy toàn bộ danh sách các trạm dừng duy nhất từ các tuyến xe đang chạy
   * Dùng để populate gợi ý vào combobox / dropdown chọn điểm đi và điểm đến
   */
  async getUniqueStations(): Promise<Station[]> {
    const routesRes = await this.getRoutes()
    if (!routesRes.success || !routesRes.data) return []

    const stationMap = new Map<string, Station>()

    for (const route of routesRes.data) {
      if (route.routeStations && Array.isArray(route.routeStations)) {
        for (const rs of route.routeStations) {
          if (rs.station && !stationMap.has(rs.station.name)) {
            stationMap.set(rs.station.name, rs.station)
          }
        }
      }
    }

    return Array.from(stationMap.values())
  }
}

export const searchService = new SearchService()
