/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * Maps & Transit Geo-Intelligence Service
 * Cung cấp:
 * 1. Danh mục địa điểm / trạm dừng trọng điểm Thái Nguyên & Google Maps Geocoding
 * 2. Tính toán cự ly hành trình (Haversine Formula x 1.25 hệ số đường bộ thực tế)
 * 3. Ước tính thời gian xe buýt chạy (vận tốc nội đô 25-28 km/h + thời gian ghé trạm)
 * 4. Đề xuất biểu giá cước theo cự ly
 */

import { TransitStation } from '@/lib/types/transit'

export interface PlaceItem {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  isHub?: boolean
  source: 'station' | 'poi' | 'google_maps'
}

export interface RouteMetrics {
  distanceKm: number
  estimatedDurationMinutes: number
  suggestedBasePrice: number
  suggestedStudentPrice: number
}

// Danh mục địa điểm trọng điểm (POI) khu vực Thái Nguyên phục vụ xe buýt ICTU
export const THAI_NGUYEN_KEY_POIS: PlaceItem[] = [
  {
    id: 'poi-ictu',
    name: 'Trường Đại học Công nghệ Thông tin & Truyền thông (ICTU)',
    address: 'Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên',
    latitude: 21.5852,
    longitude: 105.8066,
    isHub: true,
    source: 'poi',
  },
  {
    id: 'poi-ktx-ictu',
    name: 'Ký Túc Xá Sinh Viên ICTU',
    address: 'Khu nội trú ICTU, Đường Z115, TP. Thái Nguyên',
    latitude: 21.5861,
    longitude: 105.8052,
    isHub: true,
    source: 'poi',
  },
  {
    id: 'poi-tnu',
    name: 'Đại học Thái Nguyên (Khu trung tâm điều hành)',
    address: 'Phường Tân Thịnh, TP. Thái Nguyên',
    latitude: 21.5947,
    longitude: 105.8155,
    isHub: true,
    source: 'poi',
  },
  {
    id: 'poi-su-pham',
    name: 'Trường Đại học Sư Phạm Thái Nguyên',
    address: 'Số 20 Lương Ngọc Quyến, Phường Quang Trung, TP. Thái Nguyên',
    latitude: 21.5968,
    longitude: 105.8284,
    isHub: true,
    source: 'poi',
  },
  {
    id: 'poi-y-duoc',
    name: 'Trường Đại học Y Dược Thái Nguyên',
    address: 'Số 284 Lương Ngọc Quyến, Phường Quang Trung, TP. Thái Nguyên',
    latitude: 21.5954,
    longitude: 105.8341,
    isHub: false,
    source: 'poi',
  },
  {
    id: 'poi-nong-lam',
    name: 'Trường Đại học Nông Lâm Thái Nguyên',
    address: 'Đường Mỏ Bạch, Xã Quyết Thắng, TP. Thái Nguyên',
    latitude: 21.6022,
    longitude: 105.8095,
    isHub: false,
    source: 'poi',
  },
  {
    id: 'poi-bx-dong-quang',
    name: 'Bến xe Khách Đồng Quang ★ Hub',
    address: 'Đường Hoàng Văn Thụ, Phường Đồng Quang, TP. Thái Nguyên',
    latitude: 21.5841,
    longitude: 105.8398,
    isHub: true,
    source: 'poi',
  },
  {
    id: 'poi-bx-trung-tam',
    name: 'Bến xe Trung tâm Thái Nguyên',
    address: 'Phường Thịnh Đán, TP. Thái Nguyên',
    latitude: 21.5694,
    longitude: 105.8239,
    isHub: true,
    source: 'poi',
  },
  {
    id: 'poi-quang-truong',
    name: 'Quảng trường Võ Nguyên Giáp',
    address: 'Phường Trưng Vương, TP. Thái Nguyên',
    latitude: 21.5919,
    longitude: 105.8447,
    isHub: true,
    source: 'poi',
  },
  {
    id: 'poi-ga-thai-nguyen',
    name: 'Ga Đường Sắt Thái Nguyên',
    address: 'Đường Ga, Phường Quang Trung, TP. Thái Nguyên',
    latitude: 21.5905,
    longitude: 105.8318,
    isHub: false,
    source: 'poi',
  },
  {
    id: 'poi-bv-da-khoa-tw',
    name: 'Bệnh viện Đa khoa Trung ương Thái Nguyên',
    address: 'Số 479 Lương Ngọc Quyến, TP. Thái Nguyên',
    latitude: 21.5926,
    longitude: 105.8362,
    isHub: false,
    source: 'poi',
  },
  {
    id: 'poi-kcn-song-cong',
    name: 'Khu Công Nghiệp Sông Công I & II',
    address: 'Thành phố Sông Công, Thái Nguyên',
    latitude: 21.4889,
    longitude: 105.8421,
    isHub: true,
    source: 'poi',
  },
  {
    id: 'poi-samsung-pho-yen',
    name: 'Tổ hợp Công nghệ SamSung Phổ Yên (SEVT)',
    address: 'KCN Yên Bình, Phổ Yên, Thái Nguyên',
    latitude: 21.4385,
    longitude: 105.8762,
    isHub: true,
    source: 'poi',
  },
]

/**
 * Tính khoảng cách cung tròn bề mặt Trái đất (Haversine formula)
 * Kết hợp hệ số đường bộ thực tế (Road Curvature Factor = 1.25)
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0

  const R = 6371 // Bán kính Trái đất (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const directDistance = R * c

  // Hệ số uốn lượn của mạng lưới đường đô thị & cao tốc (1.25)
  const roadDistance = directDistance * 1.25
  return Math.round(roadDistance * 10) / 10
}

/**
 * Ước tính thời gian chạy xe buýt:
 * - Vận tốc thương mại xe buýt điện nội đô: 25 - 28 km/h (~ 2.2 phút/km)
 * - Mỗi trạm dừng đón/trả khách: +1.5 đến 2 phút
 */
export function estimateBusDurationMinutes(
  distanceKm: number,
  stopsCount: number = 2,
): number {
  if (distanceKm <= 0) return 15
  const drivingMinutes = (distanceKm / 26) * 60
  const dwellMinutes = Math.max(0, stopsCount - 2) * 2 // 2 trạm đầu cuối không tính dwell
  const total = Math.round(drivingMinutes + dwellMinutes)
  return Math.max(15, total)
}

/**
 * Đề xuất khung giá vé tiêu chuẩn:
 * - Dưới 8km: 7.000 VND
 * - 8km - 15km: 10.000 VND
 * - 15km - 25km: 15.000 VND
 * - Trên 25km: 20.000 VND
 * - Vé HSSV ICTU: Giảm 50%
 */
export function suggestFareByDistance(distanceKm: number): {
  basePrice: number
  studentPrice: number
} {
  let basePrice = 10000
  if (distanceKm <= 8) basePrice = 7000
  else if (distanceKm <= 15) basePrice = 10000
  else if (distanceKm <= 25) basePrice = 15000
  else basePrice = 20000

  return {
    basePrice,
    studentPrice: Math.round(basePrice * 0.5),
  }
}

/**
 * Tính toán toàn bộ chỉ số hành trình giữa 2 địa điểm
 */
export function calculateRouteMetrics(
  originPlace: PlaceItem,
  destPlace: PlaceItem,
  intermediateStopsCount: number = 0,
): RouteMetrics {
  const dist = calculateHaversineDistanceKm(
    originPlace.latitude,
    originPlace.longitude,
    destPlace.latitude,
    destPlace.longitude,
  )
  const duration = estimateBusDurationMinutes(dist, 2 + intermediateStopsCount)
  const fare = suggestFareByDistance(dist)

  return {
    distanceKm: dist,
    estimatedDurationMinutes: duration,
    suggestedBasePrice: fare.basePrice,
    suggestedStudentPrice: fare.studentPrice,
  }
}

/**
 * Tìm kiếm địa điểm từ danh sách Trạm có sẵn trong Database + POI Thái Nguyên
 */
export function searchAvailablePlaces(
  keyword: string,
  systemStations: TransitStation[] = [],
): PlaceItem[] {
  // Chuyển đổi trạm hệ thống sang PlaceItem
  const stationPlaces: PlaceItem[] = systemStations.map((st) => ({
    id: st.id,
    name: st.name,
    address: st.address || 'Thái Nguyên',
    latitude: Number(st.latitude) || 21.5852,
    longitude: Number(st.longitude) || 105.8066,
    isHub: st.isHub,
    source: 'station',
  }))

  // Kết hợp không trùng lặp
  const allPlaces = [...stationPlaces]
  for (const poi of THAI_NGUYEN_KEY_POIS) {
    if (!allPlaces.some((p) => p.name.toLowerCase() === poi.name.toLowerCase())) {
      allPlaces.push(poi)
    }
  }

  if (!keyword.trim()) return allPlaces

  const normalized = keyword.toLowerCase().trim()
  return allPlaces.filter(
    (p) =>
      p.name.toLowerCase().includes(normalized) ||
      p.address.toLowerCase().includes(normalized),
  )
}
