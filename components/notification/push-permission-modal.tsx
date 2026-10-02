'use client'

/**
 * Modal Xin Cấp Quyền Thông Báo Đẩy (Web Push Permission Handler)
 * Domain: notifications & geofencing
 * Branch: feature/SBTS-frontend-geofencing-and-push-notification
 */

import React, { useState, useEffect } from 'react'
import {
  BellRing,
  Bus,
  MapPin,
  ShieldCheck,
  X,
  Check,
  Sparkles,
} from 'lucide-react'
import { haptic } from '@/lib/utils/haptics'
import { notificationService } from '@/lib/services/notification.service'

const PERMISSION_PROMPTED_KEY = 'ictu_push_permission_prompted_v1'

interface PushPermissionModalProps {
  forceOpen?: boolean
  onClose?: () => void
}

export function PushPermissionModal({
  forceOpen = false,
  onClose,
}: PushPermissionModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }

    setPermissionState(Notification.permission)

    if (forceOpen) {
      setIsOpen(true)
      return
    }

    // Tự động gợi ý nếu người dùng chưa từng được hỏi và trạng thái đang là default
    const hasPrompted = localStorage.getItem(PERMISSION_PROMPTED_KEY)
    if (!hasPrompted && Notification.permission === 'default') {
      const timer = setTimeout(() => {
        setIsOpen(true)
      }, 3500)
      return () => clearTimeout(timer)
    }
  }, [forceOpen])

  if (!isOpen) return null

  const handleDismiss = () => {
    haptic.play('pop')
    if (typeof window !== 'undefined') {
      localStorage.setItem(PERMISSION_PROMPTED_KEY, 'true')
    }
    setIsOpen(false)
    onClose?.()
  }

  const handleRequestPermission = async () => {
    setIsProcessing(true)
    haptic.play('select')

    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const permission = await Notification.requestPermission()
        setPermissionState(permission)

        if (permission === 'granted') {
          haptic.play('busArrival')
          // Tạo một token đại diện cho Web Browser Client và gửi lên Backend
          const mockToken = `fcm_web_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
          await notificationService.registerDeviceToken({
            token: mockToken,
            platform: 'WEB',
            deviceModel: navigator.userAgent.slice(0, 50),
          })
        }
      }
    } catch (e) {
      console.warn('[PushPermissionModal] Lỗi yêu cầu cấp quyền:', e)
    } finally {
      setIsProcessing(false)
      if (typeof window !== 'undefined') {
        localStorage.setItem(PERMISSION_PROMPTED_KEY, 'true')
      }
      setIsOpen(false)
      onClose?.()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-emerald-300/40 bg-white p-6 shadow-2xl shadow-slate-900/40 text-slate-800 animate-in zoom-in-95 duration-200">
        {/* Glow ambient */}
        <div className="absolute -right-12 -top-12 size-36 rounded-full bg-emerald-100 blur-2xl pointer-events-none" />

        {/* Hero Visual Icon */}
        <div className="relative flex flex-col items-center text-center">
          <div className="relative size-16 rounded-3xl bg-emerald-50 border border-emerald-200 text-[#005A36] flex items-center justify-center shadow-inner">
            <BellRing className="size-8 animate-bounce text-[#005A36]" />
            <span className="absolute -top-1 -right-1 size-4 rounded-full bg-[#005A36] ring-4 ring-white flex items-center justify-center">
              <Bus className="size-2 text-white" />
            </span>
          </div>

          <h3 className="mt-4 text-lg font-black text-slate-900 leading-tight">
            Nhận Cảnh Báo Xe Buýt Tự Động
          </h3>

          <p className="mt-2 text-xs text-slate-600 leading-relaxed max-w-xs">
            Hệ thống sẽ gửi thông báo đẩy đến trình duyệt khi xe buýt cách điểm đón của bạn <strong className="text-[#005A36] font-extrabold">&le; 500m</strong> hoặc <strong className="text-[#005A36] font-extrabold">5 phút chạy xe</strong>.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="mt-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 p-3 text-xs space-y-2 text-slate-700">
          <div className="flex items-center gap-2">
            <Check className="size-4 text-[#005A36] shrink-0" />
            <span>Không bao giờ bị lỡ chuyến xe buýt</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="size-4 text-[#005A36] shrink-0" />
            <span>Cảnh báo xuống trạm đúng điểm cần đến</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="size-4 text-[#005A36] shrink-0" />
            <span>Chống spam tin nhắn (chỉ gửi 1 lần duy nhất)</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={handleRequestPermission}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#005A36] hover:bg-emerald-700 active:scale-95 text-white font-black py-3 text-sm transition-all shadow-md shadow-emerald-950/20 cursor-pointer disabled:opacity-50"
            id="btn-allow-push-notifications"
          >
            <BellRing className="size-4" />
            <span>{isProcessing ? 'Đang kích hoạt...' : 'Bật Thông Báo Ngay'}</span>
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-full rounded-2xl py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            id="btn-dismiss-push-notifications"
          >
            Để sau (Không kích hoạt)
          </button>
        </div>
      </div>
    </div>
  )
}
