import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  const trimmed = email.trim()
  // RFC 5322 compatible regular expression
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(trimmed)
}

/**
 * Chuẩn hóa URL ảnh minh chứng thẻ sinh viên / CCCD / nhân viên.
 * Nếu là đường dẫn tương đối từ backend (/uploads/...) -> tự động trỏ đến http://localhost:3001/uploads/...
 */
export function formatProofUrl(url?: string | null): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80'
  }
  const clean = url.trim()
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean
  }
  if (clean.startsWith('/uploads/')) {
    return `http://localhost:3001${clean}`
  }
  if (clean.startsWith('uploads/')) {
    return `http://localhost:3001/${clean}`
  }
  return clean
}
