export type DriverLicenseStatus = 'pending' | 'approved' | 'rejected' | 'unsubmitted'

export type DriverLicenseClass = 'D' | 'E' | 'FD' | 'FE'

export interface DriverProfile {
  id: string
  userId: string
  licenseNumber: string
  licenseClass: string
  issueDate?: string | null
  expiryDate?: string | null
  frontImageUrl: string
  backImageUrl?: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejectionReason?: string | null
  approvedBy?: string | null
  approvedByUser?: {
    id: string
    fullName: string
    email: string
  } | null
  approvedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface DriverWithProfileItem {
  driver: {
    id: string
    fullName: string
    email: string
    phoneNumber?: string | null
    avatarUrl?: string | null
    status: string
    createdAt: string
  }
  profile: DriverProfile | null
  status: DriverLicenseStatus
}

export interface DriverProfileKPIs {
  totalDrivers: number
  approvedCount: number
  pendingCount: number
  rejectedCount: number
  unsubmittedCount: number
}

export interface ListDriverProfilesResponse {
  items: DriverWithProfileItem[]
  total: number
  page: number
  limit: number
  totalPages: number
  kpis: DriverProfileKPIs
}

export interface UpdateDriverProfilePayload {
  licenseNumber?: string
  licenseClass?: string
  issueDate?: string
  expiryDate?: string
  frontImageUrl?: string
  backImageUrl?: string
  status?: 'pending' | 'approved' | 'rejected'
}

export interface ReviewDriverProfilePayload {
  status: 'approved' | 'rejected'
  rejectionReason?: string
}
