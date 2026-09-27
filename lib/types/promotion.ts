/**
 * Types cho module Voucher & Vé tháng
 * Domain: promotion
 * Branch: feature/SBTS-voucher-monthly-pass-fe
 */

// ─── Voucher ──────────────────────────────────────────────────────────────────

export interface ValidateVoucherPayload {
  code: string
  orderAmount: number
}

export interface VoucherValidationResult {
  valid: boolean
  code: string
  discountType: 'percentage' | 'fixed_amount'
  discountValue: number
  discountAmount: number
  finalAmount: number
  message?: string
}

// ─── Monthly Pass ─────────────────────────────────────────────────────────────

export type MonthlyPassCategory = 'student' | 'elderly' | 'worker'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface RegisterMonthlyPassPayload {
  routeId: string
  category: MonthlyPassCategory
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
  proofImageUrl?: string
}

export interface MonthlyPass {
  id: string
  passCode: string
  category: MonthlyPassCategory
  approvalStatus: ApprovalStatus
  startDate: string
  endDate: string
  price: number
  proofImageUrl?: string
  route?: {
    id: string
    name: string
    origin: string
    destination: string
  }
  createdAt: string
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
  pending: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  approved: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  rejected: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
}
