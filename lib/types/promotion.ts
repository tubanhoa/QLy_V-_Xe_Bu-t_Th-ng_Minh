/**
 * Types cho module Voucher & Vé tháng
 * Domain: promotion
 * Branch: feature/SBTS-voucher-monthly-pass-fe
 */

// ─── Voucher ──────────────────────────────────────────────────────────────────

export type VoucherDiscountType = 'percentage' | 'fixed_amount'
export type VoucherApplicableType = 'all' | 'single_ticket' | 'monthly_pass'
export type VoucherStatus = 'active' | 'inactive' | 'expired'

export interface VoucherItem {
  id: string
  code: string
  description?: string
  discountType: VoucherDiscountType
  discountValue: number | string
  minOrderValue?: number | string
  maxDiscountAmount?: number | string
  startDate: string
  endDate: string
  usageLimit: number
  usedCount: number
  status: VoucherStatus | string
  applicableType?: VoucherApplicableType
  applicableRouteIds?: string[]
  remainingUses?: number
  dynamicStatus?: 'active' | 'inactive' | 'expired' | 'depleted'
  createdAt?: string
  updatedAt?: string
}

export interface CreateVoucherPayload {
  code: string
  description?: string
  discountType: VoucherDiscountType
  discountValue: number
  minOrderValue?: number
  maxDiscountAmount?: number
  startDate: string
  endDate: string
  usageLimit?: number
  applicableType?: VoucherApplicableType
  applicableRouteIds?: string[]
  status?: 'active' | 'inactive'
}

export interface UpdateVoucherPayload {
  description?: string
  discountType?: VoucherDiscountType
  discountValue?: number
  minOrderValue?: number
  maxDiscountAmount?: number
  startDate?: string
  endDate?: string
  usageLimit?: number
  applicableType?: VoucherApplicableType
  applicableRouteIds?: string[]
  status?: 'active' | 'inactive'
}

export interface ValidateVoucherPayload {
  code: string
  orderAmount: number
  serviceType?: 'single_ticket' | 'monthly_pass' | 'all'
  routeId?: string
}

export interface VoucherValidationResult {
  valid: boolean
  code: string
  voucherId?: string
  discountType: VoucherDiscountType
  discountValue: number
  discountAmount: number
  finalAmount: number
  message?: string
  description?: string
  minOrderValue?: number
}

// ─── Monthly Pass ─────────────────────────────────────────────────────────────

export type MonthlyPassCategory = 'student' | 'elderly' | 'worker'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type MonthlyPassPaymentStatus = 'unpaid' | 'paid' | 'refunded'

export interface RegisterMonthlyPassPayload {
  routeId: string
  category: MonthlyPassCategory
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
  durationMonths?: number
  proofImageUrl?: string
}

export interface MonthlyPass {
  id: string
  passCode: string
  category: MonthlyPassCategory
  approvalStatus: ApprovalStatus
  paymentStatus?: MonthlyPassPaymentStatus
  startDate: string
  endDate: string
  durationMonths?: number
  price: number
  proofImageUrl?: string
  qrPayload?: string
  user?: {
    id: string
    fullName?: string
    name?: string
    email?: string
    phoneNumber?: string
  }
  route?: {
    id: string
    name: string
    origin: string
    destination: string
  }
  createdAt: string
}

export interface MonthlyPassPaymentData {
  passId: string
  passCode: string
  amount: number
  paymentMethod: string
  description: string
  paymentUrl: string
  qrCodeUrl?: string
  qrDataUrl?: string
  vietQrUrl: string
  bankAccount?: {
    bankName: string
    accountNo: string
    accountName: string
  }
  testCard?: {
    bank: string
    cardNumber: string
    cardHolder: string
    issueDate: string
    otp: string
  }
  quickPayAvailable?: boolean
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export const MONTHLY_PASS_CATEGORY_LABEL: Record<MonthlyPassCategory, string> = {
  student: 'Sinh viên (-50%)',
  elderly: 'Người cao tuổi (-60%)',
  worker: 'Công nhân / Nhân viên',
}

export const MONTHLY_PASS_CATEGORY_PRICE: Record<MonthlyPassCategory, number> = {
  student: 100_000,
  elderly: 80_000,
  worker: 200_000,
}

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending: 'Đang xét duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
}

export const APPROVAL_STATUS_COLOR: Record<ApprovalStatus, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  rejected: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
}

