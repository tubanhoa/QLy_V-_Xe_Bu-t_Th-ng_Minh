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

const CACHE_TTL_MS = 60_000 // 60 seconds

class SearchService {
  private baseUrl: string
  private routesCache: { data: BusRoute[]; timestamp: number } | null = null
  private stationsCache: { data: Station[]; timestamp: number } | null = null

  constructor() {
    const raw = (API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/+$/, '')
    this.baseUrl = raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`
  }

  /** Xóa cache khi cần làm mới */
  clearCache() {
    this.routesCache = null
    this.stationsCache = null
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
    const isUnfiltered = !params?.keyword && !params?.origin && !params?.destination
    const now = Date.now()

    if (isUnfiltered && this.routesCache && now - this.routesCache.timestamp < CACHE_TTL_MS) {
      return { success: true, data: this.routesCache.data }
    }

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

      if (response.ok) {
        const resJson = await response.json()
        let routesList: BusRoute[] = []
        if (Array.isArray(resJson)) {
          routesList = resJson
        } else if (resJson?.data && Array.isArray(resJson.data)) {
          routesList = resJson.data
        }

        if (isUnfiltered) {
          this.routesCache = { data: routesList, timestamp: now }
        }
        return { success: true, data: routesList }
      }
      throw new Error(`Server returned ${response.status}`)
    } catch (error: any) {
      console.warn('[SearchService.getRoutes] Lỗi khi truy vấn tuyến xe từ máy chủ:', error)
      return {
        success: false,
        message: 'Không thể tải danh sách tuyến xe từ máy chủ.',
        data: [],
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

      if (response.ok) {
        const resJson = await response.json()
        return resJson.data ? resJson : { success: true, data: resJson }
      }
      throw new Error(`Server returned ${response.status}`)
    } catch (error: any) {
      console.warn(`[SearchService.getRouteById] Không tìm thấy hoặc lỗi kết nối tuyến ${id}:`, error)
      return {
        success: false,
        message: 'Không tìm thấy thông tin tuyến xe trên máy chủ.',
        data: null,
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

      if (response.ok) {
        const resJson = await response.json()
        const trips = Array.isArray(resJson) ? resJson : resJson?.data
        if (Array.isArray(trips)) {
          return { success: true, data: trips }
        }
      }
      throw new Error(`Server status ${response.status}`)
    } catch (error: any) {
      console.warn('[SearchService.searchTrips] Lỗi khi truy vấn chuyến xe từ database:', error)
      return {
        success: false,
        message: 'Không thể kết nối đến máy chủ hoặc chưa có chuyến xe phù hợp.',
        data: [],
      }
    }
  }

  /**
   * Tiện ích: Lấy toàn bộ danh sách các trạm dừng duy nhất từ các tuyến xe đang chạy
   * Dùng để populate gợi ý vào combobox / dropdown chọn điểm đi và điểm đến
   */
  async getUniqueStations(): Promise<Station[]> {
    const now = Date.now()
    if (this.stationsCache && now - this.stationsCache.timestamp < CACHE_TTL_MS) {
      return this.stationsCache.data
    }

    const routesRes = await this.getRoutes()
    const routes = routesRes.success && routesRes.data ? routesRes.data : []

    const stationMap = new Map<string, Station>()

    for (const route of routes) {
      if (route.routeStations && Array.isArray(route.routeStations)) {
        for (const rs of route.routeStations) {
          if (rs.station && !stationMap.has(rs.station.name)) {
            stationMap.set(rs.station.name, rs.station)
          }
        }
      }
    }

    const stationList = Array.from(stationMap.values())
    this.stationsCache = { data: stationList, timestamp: now }
    return stationList
  }
}

export const searchService = new SearchService()
