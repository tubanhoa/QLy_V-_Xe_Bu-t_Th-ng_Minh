/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * Vehicle Service: Quản trị Phương tiện xe buýt, Sơ đồ ghế, Tình trạng kỹ thuật
 * Domain: transit/vehicles
 * Synchronized with Backend VehiclesController & Supabase Cloud
 */

import { authService } from './auth.service'

export interface Vehicle {
  id: string
  licensePlate: string
  model: string
  vehicleType: 'electric' | 'diesel' | string
  seatCapacity: number
  manufactureYear?: number
  batteryCapacityKwh?: number | string
  status: 'active' | 'maintenance' | 'retired'
  createdAt?: string
}

export interface Seat {
  id: string
  vehicleId: string
  seatNumber: string
  rowNumber: number
  columnLabel: string
  seatType: 'standard' | 'priority'
  floorNumber: number
}

export interface CreateVehiclePayload {
  licensePlate: string
  model?: string
  vehicleType?: 'electric' | 'diesel'
  seatCapacity?: number
  manufactureYear?: number
  batteryCapacityKwh?: number
}

export interface VehicleApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

class VehicleService {
  private baseUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

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

  /** Lấy danh sách toàn bộ phương tiện xe buýt */
  async getVehicles(): Promise<VehicleApiResponse<Vehicle[]>> {
    try {
      const res = await fetch(`${this.baseUrl}/vehicles`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          data: [],
          message: json?.message || 'Không thể tải danh sách phương tiện',
        }
      }
      return json
    } catch (err: any) {
      return {
        success: false,
        data: [],
        message: err.message || 'Lỗi kết nối máy chủ phương tiện',
      }
    }
  }

  /** Lấy thông tin chi tiết một xe */
  async getVehicleById(id: string): Promise<VehicleApiResponse<Vehicle | null>> {
    try {
      const res = await fetch(`${this.baseUrl}/vehicles/${id}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          data: null,
          message: json?.message || 'Không tìm thấy xe',
        }
      }
      return json
    } catch (err: any) {
      return {
        success: false,
        data: null,
        message: err.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /** Lấy cấu hình sơ đồ ghế của xe (28 ghế) */
  async getVehicleSeats(vehicleId: string): Promise<VehicleApiResponse<Seat[]>> {
    try {
      const res = await fetch(`${this.baseUrl}/vehicles/${vehicleId}/seats`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          data: [],
          message: json?.message || 'Không thể tải sơ đồ ghế',
        }
      }
      return json
    } catch (err: any) {
      return {
        success: false,
        data: [],
        message: err.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /** Thêm phương tiện mới và tự động sinh 28 ghế */
  async createVehicle(payload: CreateVehiclePayload): Promise<VehicleApiResponse<Vehicle | null>> {
    try {
      const res = await fetch(`${this.baseUrl}/vehicles`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          data: null,
          message: json?.message || 'Không thể thêm phương tiện',
        }
      }
      return json
    } catch (err: any) {
      return {
        success: false,
        data: null,
        message: err.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /** Đổi trạng thái xe (active, maintenance, retired) */
  async updateStatus(
    id: string,
    status: 'active' | 'maintenance' | 'retired',
  ): Promise<VehicleApiResponse<Vehicle | null>> {
    try {
      const res = await fetch(`${this.baseUrl}/vehicles/${id}/status`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ status }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          data: null,
          message: json?.message || 'Không thể cập nhật trạng thái xe',
        }
      }
      return json
    } catch (err: any) {
      return {
        success: false,
        data: null,
        message: err.message || 'Lỗi kết nối máy chủ',
      }
    }
  }

  /** Xóa phương tiện */
  async deleteVehicle(id: string): Promise<VehicleApiResponse<null>> {
    try {
      const res = await fetch(`${this.baseUrl}/vehicles/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        return {
          success: false,
          data: null,
          message: json?.message || 'Không thể xóa xe này',
        }
      }
      return json
    } catch (err: any) {
      return {
        success: false,
        data: null,
        message: err.message || 'Lỗi kết nối máy chủ',
      }
    }
  }
}

export const vehicleService = new VehicleService()
