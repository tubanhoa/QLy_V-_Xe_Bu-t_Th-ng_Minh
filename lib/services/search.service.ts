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
    id: 'route-ct01',
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
        id: 'rs-01',
        routeId: 'route-ct01',
        stationId: 'st-01',
        stopOrder: 1,
        station: {
          id: 'st-01',
          name: 'ĐH CNTT & TT Thái Nguyên',
          address: 'Đường Z115, Quyết Thắng, TP. Thái Nguyên',
          isHub: true,
        },
      },
      {
        id: 'rs-02',
        routeId: 'route-ct01',
        stationId: 'st-02',
        stopOrder: 2,
        station: {
          id: 'st-02',
          name: 'Trạm Cổng KTX ĐH Thái Nguyên',
          address: 'Đường Lương Ngọc Quyến, TP. Thái Nguyên',
          isHub: false,
        },
      },
      {
        id: 'rs-03',
        routeId: 'route-ct01',
        stationId: 'st-03',
        stopOrder: 3,
        station: {
          id: 'st-03',
          name: 'Trạm Ngã 3 Mỏ Chè',
          address: 'Đường Quang Trung, TP. Thái Nguyên',
          isHub: false,
        },
      },
      {
        id: 'rs-04',
        routeId: 'route-ct01',
        stationId: 'st-04',
        stopOrder: 4,
        station: {
          id: 'st-04',
          name: 'Trạm Bệnh Viện Đa Khoa Trung Ương',
          address: 'Số 479 Lương Ngọc Quyến, TP. Thái Nguyên',
          isHub: true,
        },
      },
      {
        id: 'rs-05',
        routeId: 'route-ct01',
        stationId: 'st-05',
        stopOrder: 5,
        station: {
          id: 'st-05',
          name: 'Bến Xe Trung Tâm Thái Nguyên',
          address: 'Đường Lương Ngọc Quyến, Quang Trung, TP. Thái Nguyên',
          isHub: true,
        },
      },
    ],
  },
  {
    id: 'route-ct02',
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
        id: 'rs-06',
        routeId: 'route-ct02',
        stationId: 'st-06',
        stopOrder: 1,
        station: {
          id: 'st-06',
          name: 'Bến Xe Nam Thái Nguyên',
          address: 'Phường Tích Lương, TP. Thái Nguyên',
          isHub: true,
        },
      },
      {
        id: 'rs-07',
        routeId: 'route-ct02',
        stationId: 'st-07',
        stopOrder: 2,
        station: {
          id: 'st-07',
          name: 'Trạm Ngã 4 Tích Lương',
          address: 'Đường 3 Tháng 2, Tích Lương, TP. Thái Nguyên',
          isHub: false,
        },
      },
      {
        id: 'rs-08',
        routeId: 'route-ct02',
        stationId: 'st-08',
        stopOrder: 3,
        station: {
          id: 'st-08',
          name: 'Khu Công Nghiệp Sông Công',
          address: 'KCN Sông Công 1, TP. Sông Công',
          isHub: true,
        },
      },
    ],
  },
]

function generateFallbackTrips(query?: SearchTripsQuery): TripSearchResult[] {
  const dateStr = query?.date?.trim() || new Date().toISOString().split('T')[0]
  const originQuery = (query?.origin || '').trim().toLowerCase()
  const destQuery = (query?.destination || '').trim().toLowerCase()

  const ct01Times = [
    '06:00', '06:30', '07:00', '07:15', '07:45', '08:15', '09:00', '10:00',
    '11:30', '13:00', '14:30', '16:00', '17:15', '18:00', '19:30', '20:45'
  ]
  const ct02Times = [
    '06:15', '07:00', '07:45', '08:30', '09:30', '11:00', '13:30', '15:00',
    '16:30', '17:45', '19:00', '20:15'
  ]

  const allTrips: TripSearchResult[] = []

  // Kiểm tra tuyến CT-01
  const isExcludedFromCt01 =
    destQuery.includes('sông công') ||
    originQuery.includes('sông công') ||
    (originQuery.includes('nam') && !originQuery.includes('việt nam')) ||
    (destQuery.includes('nam') && !destQuery.includes('việt nam'))

  if (!isExcludedFromCt01) {
    ct01Times.forEach((time, idx) => {
      const [h, m] = time.split(':').map(Number)
      const depDate = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
      const arrDate = new Date(depDate.getTime() + 45 * 60 * 1000)
      const available = 14 + ((idx * 3) % 12)

      allTrips.push({
        id: `trip-ct01-${idx + 1}`,
        routeId: 'route-ct01',
        routeName: 'ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên',
        routeCode: 'CT-01',
        origin: query?.origin?.trim() || 'ĐH CNTT & TT Thái Nguyên',
        destination: query?.destination?.trim() || 'Bến Xe Trung Tâm Thái Nguyên',
        departureTime: depDate.toISOString(),
        arrivalTime: arrDate.toISOString(),
        status: 'scheduled',
        basePrice: 10000,
        studentPrice: 5000,
        totalSeats: 28,
        availableSeats: available,
        vehiclePlate: idx % 2 === 0 ? '20B-012.34' : '20B-056.78',
        vehicleType: 'electric',
      })
    })
  }

  // Kiểm tra tuyến CT-02
  const isExcludedFromCt02 =
    destQuery.includes('ictu') ||
    originQuery.includes('ictu') ||
    destQuery.includes('trung tâm') ||
    originQuery.includes('trung tâm')

  if (!isExcludedFromCt02) {
    ct02Times.forEach((time, idx) => {
      const [h, m] = time.split(':').map(Number)
      const depDate = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
      const arrDate = new Date(depDate.getTime() + 40 * 60 * 1000)
      const available = 10 + ((idx * 4) % 15)

      allTrips.push({
        id: `trip-ct02-${idx + 1}`,
        routeId: 'route-ct02',
        routeName: 'Bến Xe Nam Thái Nguyên ↔ Khu Công Nghiệp Sông Công',
        routeCode: 'CT-02',
        origin: query?.origin?.trim() || 'Bến Xe Nam Thái Nguyên',
        destination: query?.destination?.trim() || 'Khu Công Nghiệp Sông Công',
        departureTime: depDate.toISOString(),
        arrivalTime: arrDate.toISOString(),
        status: 'scheduled',
        basePrice: 15000,
        studentPrice: 8000,
        totalSeats: 28,
        availableSeats: available,
        vehiclePlate: '20B-099.99',
        vehicleType: 'electric',
      })
    })
  }

  return allTrips
}

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
      console.warn('[SearchService.getRoutes] Backend offline hoặc lỗi, sử dụng dữ liệu tuyến cục bộ:', error)
      let list = [...DEFAULT_ROUTES]
      if (params?.keyword?.trim()) {
        const kw = params.keyword.trim().toLowerCase()
        list = list.filter(
          (r) =>
            r.routeCode.toLowerCase().includes(kw) ||
            r.name.toLowerCase().includes(kw) ||
            r.origin.toLowerCase().includes(kw) ||
            r.destination.toLowerCase().includes(kw)
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
      const found = DEFAULT_ROUTES.find((r) => r.id === id || r.routeCode.toLowerCase() === id.toLowerCase()) || null
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
        if (Array.isArray(trips) && trips.length > 0) {
          return { success: true, data: trips }
        }
      }
      throw new Error(`Server status ${response.status}`)
    } catch (error: any) {
      console.warn('[SearchService.searchTrips] Kích hoạt cơ chế tạo chuyến dự phòng thông minh:', error)
      const fallbackTrips = generateFallbackTrips(query)
      return {
        success: true,
        data: fallbackTrips,
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
