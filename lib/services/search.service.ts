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

export const DEFAULT_ROUTES: BusRoute[] = [
  {
    id: '5f8d76d7-717b-4904-ac52-dd64b0a515c0',
    routeCode: 'CT-01',
    name: 'ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên',
    origin: 'ĐH CNTT & TT Thái Nguyên',
    destination: 'Bến Xe Trung Tâm Thái Nguyên',
    distanceKm: 14.5,
    basePrice: 10000,
    studentPrice: 5000,
    operatingStart: '05:30:00',
    operatingEnd: '21:00:00',
    frequencyMinutes: 20,
    status: 'active',
    routeStations: [
      {
        id: '99fe206e-88d5-4920-ba44-1aa179dd4963',
        routeId: '5f8d76d7-717b-4904-ac52-dd64b0a515c0',
        stationId: '9b6109af-42fb-4cc3-8c43-b6aeb146c12d',
        stopOrder: 1,
        station: {
          id: '9b6109af-42fb-4cc3-8c43-b6aeb146c12d',
          name: 'Trạm ĐH CNTT & TT Thái Nguyên (ICTU)',
          address: 'Đường Z115, Quyết Thắng, TP. Thái Nguyên',
          isHub: true,
        },
      },
      {
        id: 'eaaed515-6771-436f-9d97-a7256ae5894f',
        routeId: '5f8d76d7-717b-4904-ac52-dd64b0a515c0',
        stationId: '9c7dd985-c2b8-45f3-89dd-e81005ecb064',
        stopOrder: 2,
        station: {
          id: '9c7dd985-c2b8-45f3-89dd-e81005ecb064',
          name: 'Trạm Cổng KTX ĐH Thái Nguyên',
          address: 'Đường Lương Ngọc Quyến, TP. Thái Nguyên',
          isHub: false,
        },
      },
      {
        id: '8a0d70df-3497-42b2-9b12-ccc0b9225232',
        routeId: '5f8d76d7-717b-4904-ac52-dd64b0a515c0',
        stationId: 'e3857ce6-b6a9-4e32-b332-49a2d2126c1c',
        stopOrder: 3,
        station: {
          id: 'e3857ce6-b6a9-4e32-b332-49a2d2126c1c',
          name: 'Trạm Ngã 3 Mỏ Chè',
          address: 'Đường Quang Trung, TP. Thái Nguyên',
          isHub: false,
        },
      },
      {
        id: '3083f5c6-c45f-45ca-b651-f90c10c21e6b',
        routeId: '5f8d76d7-717b-4904-ac52-dd64b0a515c0',
        stationId: '0fb02323-7438-4e8f-9fb0-4cbe1c7d2f8c',
        stopOrder: 4,
        station: {
          id: '0fb02323-7438-4e8f-9fb0-4cbe1c7d2f8c',
          name: 'Trạm Bệnh Viện Đa Khoa Trung Ương',
          address: 'Số 479 Lương Ngọc Quyến, TP. Thái Nguyên',
          isHub: true,
        },
      },
      {
        id: '49cc7f0a-fb58-465a-a10c-d7b2570a9c54',
        routeId: '5f8d76d7-717b-4904-ac52-dd64b0a515c0',
        stationId: 'ab50975f-2579-430e-95db-0c949355704c',
        stopOrder: 5,
        station: {
          id: 'ab50975f-2579-430e-95db-0c949355704c',
          name: 'Trạm Bến Xe Trung Tâm Thái Nguyên',
          address: 'Đường Lương Ngọc Quyến, Quang Trung, TP. Thái Nguyên',
          isHub: true,
        },
      },
    ],
  },
  {
    id: '4252a0a9-82a7-48f0-850e-c60488a09016',
    routeCode: 'CT-02',
    name: 'Bến Xe Nam Thái Nguyên ↔ Khu Công Nghiệp Sông Công',
    origin: 'Bến Xe Nam Thái Nguyên',
    destination: 'Khu Công Nghiệp Sông Công',
    distanceKm: 18.0,
    basePrice: 15000,
    studentPrice: 8000,
    operatingStart: '06:00:00',
    operatingEnd: '20:30:00',
    frequencyMinutes: 30,
    status: 'active',
    routeStations: [
      {
        id: 'baf6815d-dad7-4f0a-8631-4da5d280a53c',
        routeId: '4252a0a9-82a7-48f0-850e-c60488a09016',
        stationId: 'fb0a1bab-bfa8-4491-a84a-9679f433ab9a',
        stopOrder: 1,
        station: {
          id: 'fb0a1bab-bfa8-4491-a84a-9679f433ab9a',
          name: 'Trạm Bến Xe Nam Thái Nguyên',
          address: 'Phường Tích Lương, TP. Thái Nguyên',
          isHub: true,
        },
      },
      {
        id: '69a564b7-e8ae-4827-a8ef-1e2578aecf8d',
        routeId: '4252a0a9-82a7-48f0-850e-c60488a09016',
        stationId: '68ff1076-a0d2-4818-a148-84a17949a70a',
        stopOrder: 2,
        station: {
          id: '68ff1076-a0d2-4818-a148-84a17949a70a',
          name: 'Trạm Ngã 4 Tích Lương',
          address: 'Đường 3 Tháng 2, Tích Lương, TP. Thái Nguyên',
          isHub: false,
        },
      },
      {
        id: '2ffeb403-0066-4221-a6e4-86166186146e',
        routeId: '4252a0a9-82a7-48f0-850e-c60488a09016',
        stationId: '1d662b8c-e229-4c15-b330-d86ab7a85a52',
        stopOrder: 3,
        station: {
          id: '1d662b8c-e229-4c15-b330-d86ab7a85a52',
          name: 'Trạm Khu Công Nghiệp Sông Công',
          address: 'KCN Sông Công 1, TP. Sông Công',
          isHub: true,
        },
      },
    ],
  },
]

class SearchService {
  private baseUrl: string

  constructor() {
    const raw = (API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/+$/, '')
    this.baseUrl = raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`
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

      if (response.ok) {
        const resJson = await response.json()
        if (Array.isArray(resJson)) {
          return { success: true, data: resJson }
        }
        if (resJson?.data && Array.isArray(resJson.data)) {
          return { success: true, data: resJson.data }
        }
      }
      throw new Error(`Server returned ${response.status}`)
    } catch (error: any) {
      console.warn('[SearchService.getRoutes] Sử dụng dữ liệu tuyến cấu hình chuẩn Supabase:', error)
      let list = [...DEFAULT_ROUTES]
      if (params?.keyword?.trim()) {
        const kw = params.keyword.trim().toLowerCase()
        list = list.filter(
          (r) =>
            r.routeCode.toLowerCase().includes(kw) ||
            r.name.toLowerCase().includes(kw) ||
            r.origin.toLowerCase().includes(kw) ||
            r.destination.toLowerCase().includes(kw),
        )
      }
      return {
        success: true,
        data: list,
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
      console.warn(`[SearchService.getRouteById] Fallback tuyến ${id}:`, error)
      const found =
        DEFAULT_ROUTES.find(
          (r) => r.id === id || r.routeCode.toLowerCase() === id.toLowerCase(),
        ) || null
      return {
        success: true,
        data: found,
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
    const routesRes = await this.getRoutes()
    const routes = routesRes.success && routesRes.data ? routesRes.data : DEFAULT_ROUTES

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

    return Array.from(stationMap.values())
  }
}

export const searchService = new SearchService()
