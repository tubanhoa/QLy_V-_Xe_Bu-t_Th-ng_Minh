/**
 * Tiện ích bản đồ và lộ trình OSRM Road Routing (Grab / Be Style)
 * Hỗ trợ các màn hình: Dispatcher GPS Map, Driver Cockpit HUD, Driver Dashboard Mini-Map
 */

export interface StationLocation {
  id: string
  name: string
  order: number
  lat: number
  lng: number
  shortName?: string
  etaMinutes?: number
  isPassed?: boolean
  isNext?: boolean
}

/** Tọa độ các điểm mốc tiêu chuẩn tại TP. Thái Nguyên (ICTU -> Bến xe Trung Tâm) */
export const DEFAULT_THAI_NGUYEN_STOPS: StationLocation[] = [
  {
    id: 'st-01',
    order: 1,
    name: 'ĐH CNTT & TT Thái Nguyên (ICTU)',
    shortName: 'Cổng chính ICTU',
    lat: 21.585284,
    lng: 105.807361,
  },
  {
    id: 'st-02',
    order: 2,
    name: 'Ký túc xá Sinh viên ICTU',
    shortName: 'KTX Sinh viên',
    lat: 21.587123,
    lng: 105.803521,
  },
  {
    id: 'st-03',
    order: 3,
    name: 'Đại học Sư Phạm Thái Nguyên',
    shortName: 'ĐH Sư Phạm',
    lat: 21.58321,
    lng: 105.82845,
  },
  {
    id: 'st-04',
    order: 4,
    name: 'Ngã tư Mỏ Bạch / Bến xe Đồng Quang',
    shortName: 'BX Đồng Quang',
    lat: 21.58645,
    lng: 105.83612,
  },
  {
    id: 'st-05',
    order: 5,
    name: 'Quảng trường Võ Nguyên Giáp',
    shortName: 'Quảng Trường',
    lat: 21.59325,
    lng: 105.8451,
  },
  {
    id: 'st-06',
    order: 6,
    name: 'Bến xe Trung tâm TP. Thái Nguyên',
    shortName: 'Bến xe TT',
    lat: 21.57962,
    lng: 105.84435,
  },
]

/**
 * Gọi OSRM Routing API công cộng để trích xuất hình học mặt đường thực tế
 * Tự động fallback về đường thẳng nếu OSRM timeout hoặc mạng ngoại tuyến
 */
export async function fetchRoadGeometry(
  stations: Array<{ lat: number; lng: number }>,
): Promise<Array<[number, number]>> {
  if (stations.length < 2) {
    return stations.map((s) => [s.lat, s.lng])
  }

  try {
    const coordsStr = stations.map((s) => `${s.lng.toFixed(6)},${s.lat.toFixed(6)}`).join(';')
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      if (data?.routes?.[0]?.geometry?.coordinates?.length) {
        return data.routes[0].geometry.coordinates.map((pt: [number, number]) => [pt[1], pt[0]])
      }
    }
  } catch {
    // Fallback nối thẳng trạm an toàn
  }

  return stations.map((s) => [s.lat, s.lng])
}

/**
 * Tính khoảng cách (mét) giữa 2 tọa độ GPS theo công thức Haversine
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3 // Bán kính Trái Đất (m)
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return Math.round(R * c)
}

/**
 * Tính góc phương vị (bearing) từ điểm A đến điểm B (0 - 360 độ)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const y = Math.sin(deltaLambda) * Math.cos(phi2)
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda)

  const theta = Math.atan2(y, x)
  const bearing = ((theta * 180) / Math.PI + 360) % 360
  return Math.round(bearing)
}
