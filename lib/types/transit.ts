/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * Data Contracts & Types cho Module Quản trị Tuyến đường, Trạm dừng & Biểu phí
 * Domain: transit
 * Synchronized with Backend PR #42 & Supabase Cloud
 */

export type PricingType = 'fixed' | 'distance' | 'stage'

export interface DistanceFareRule {
  minKm: number
  maxKm: number
  price: number
  studentPrice?: number
}

export interface StageFareRule {
  minStops: number
  maxStops: number
  price: number
  studentPrice?: number
}

export type FareRule = DistanceFareRule | StageFareRule

export interface TransitStation {
  id: string
  name: string
  address?: string
  latitude: number
  longitude: number
  isHub?: boolean
  status?: string
  createdAt?: string
  routeStations?: Array<{
    id: string
    routeId: string
    stopOrder: number
    route?: TransitRoute
  }>
}

export interface RouteStationItem {
  id?: string
  routeId?: string
  stationId: string
  stopOrder: number
  distanceFromOriginKm?: number
  estimatedMinutes?: number
  station?: TransitStation
}

export interface TransitRoute {
  id: string
  routeCode: string
  name: string
  origin: string
  destination: string
  distanceKm: number
  estimatedDurationMinutes?: number
  basePrice: number
  studentPrice?: number
  operatingStart?: string
  operatingEnd?: string
  frequencyMinutes?: number
  pricingType: PricingType
  fareRules?: FareRule[] | any
  status: 'active' | 'inactive' | 'deleted' | string
  createdAt?: string
  updatedAt?: string
  routeStations?: RouteStationItem[]
}

// Payloads gửi lên Backend
export interface CreateRoutePayload {
  routeCode: string
  name: string
  origin: string
  destination: string
  distanceKm?: number
  estimatedDurationMinutes?: number
  basePrice: number
  studentPrice?: number
  operatingStart?: string
  operatingEnd?: string
  frequencyMinutes?: number
  pricingType?: PricingType
  fareRules?: FareRule[]
  stops?: Array<{
    stationId: string
    stopOrder: number
    distanceFromOriginKm?: number
    estimatedMinutes?: number
  }>
  assignedDriverId?: string
  assignedVehicleId?: string
}

export interface UpdateRoutePayload {
  name?: string
  origin?: string
  destination?: string
  distanceKm?: number
  estimatedDurationMinutes?: number
  basePrice?: number
  studentPrice?: number
  operatingStart?: string
  operatingEnd?: string
  frequencyMinutes?: number
  pricingType?: PricingType
  fareRules?: FareRule[]
  status?: string
  stops?: Array<{
    stationId: string
    stopOrder: number
    distanceFromOriginKm?: number
    estimatedMinutes?: number
  }>
}

export interface CreateStationPayload {
  name: string
  address?: string
  latitude: number
  longitude: number
  isHub?: boolean
}

export interface UpdateStationPayload {
  name?: string
  address?: string
  latitude?: number
  longitude?: number
  isHub?: boolean
  status?: string
}

export interface AddRouteStationPayload {
  stationId: string
  stopOrder: number
  distanceFromOriginKm?: number
  estimatedMinutes?: number
}

export interface UpdatePricingPayload {
  pricingType: PricingType
  basePrice: number
  studentPrice?: number
  fareRules?: FareRule[]
}

export interface CalculateFarePayload {
  pickupStationId: string
  dropoffStationId: string
  isStudent?: boolean
}

export interface CalculateFareResponse {
  routeId: string
  routeName: string
  pricingType: PricingType
  pickupStation: { id: string; name: string; stopOrder: number }
  dropoffStation: { id: string; name: string; stopOrder: number }
  distanceKm: number
  passedStopsCount: number
  finalPrice: number
  isStudent: boolean
  appliedRule?: any
}

export interface TransitApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
  statusCode?: number
  isIntegrityConflict?: boolean
}
