'use client'

/**
 * Modal Cài Đặt Tùy Chọn Nhận Thông Báo (Notification Preferences)
 * Domain: notifications & geofencing
 * Branch: feature/SBTS-frontend-geofencing-and-push-notification
 */

import React, { useState, useEffect } from 'react'
import {
  Bell,
  Smartphone,
  Mail,
  MessageSquare,
  ShieldCheck,
  Check,
  X,
  Radio,
  Sliders,
} from 'lucide-react'
import { haptic } from '@/lib/utils/haptics'
import type { NotificationPreferences } from '@/lib/types/notification'

interface NotificationPreferencesModalProps {
  isOpen: boolean
  onClose: () => void
  preferences: NotificationPreferences | null
  onSave: (prefs: Partial<NotificationPreferences>) => Promise<boolean>
}

export function NotificationPreferencesModal({
  isOpen,
  onClose,
  preferences,
  onSave,
}: NotificationPreferencesModalProps) {
  const [pushEnabled, setPushEnabled] = useState(true)
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [smsEnabled, setSmsEnabled] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    if (preferences) {
      setPushEnabled(preferences.pushEnabled ?? true)
      setEmailEnabled(preferences.emailEnabled ?? true)
      setSmsEnabled(preferences.smsEnabled ?? false)
    }
  }, [preferences])

  if (!isOpen) return null

  const handleToggle = (key: 'push' | 'email' | 'sms') => {
    haptic.play('select')
    if (key === 'push') setPushEnabled((v) => !v)
    if (key === 'email') setEmailEnabled((v) => !v)
    if (key === 'sms') setSmsEnabled((v) => !v)
  }

  const handleSave = async () => {
    setIsSaving(true)
    haptic.play('tap')
    try {
      const ok = await onSave({
        pushEnabled,
        emailEnabled,
        smsEnabled,
      })
      if (ok) {
        setSavedSuccess(true)
        haptic.play('success')
        setTimeout(() => {
          setSavedSuccess(false)
          onClose()
        }, 1200)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl shadow-slate-900/30 text-slate-800 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#005A36] flex items-center justify-center">
              <Sliders className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Cài Đặt Thông Báo</h3>
              <p className="text-xs text-slate-500 font-medium">Tùy chỉnh kênh nhận thông báo xe buýt</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              haptic.play('pop')
              onClose()
            }}
            className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
            aria-label="Đóng cài đặt"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Channel Options */}
        <div className="mt-4 space-y-3.5">
          {/* Option 1: Push Notification & Geofencing */}
          <div
            onClick={() => handleToggle('push')}
            className={`flex items-start justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
              pushEnabled
                ? 'bg-emerald-50/60 border-emerald-200/80 shadow-2xs'
                : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 size-8 rounded-xl flex items-center justify-center ${
                  pushEnabled ? 'bg-[#005A36] text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                <Smartphone className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-900">Thông báo đẩy (Push FCM)</span>
                  <span className="rounded-full bg-emerald-100 text-[#005A36] text-[10px] font-black px-2 py-0.2 border border-emerald-300">
                    Khuyên dùng
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Cảnh báo tự động khi xe cách trạm đón/xuống &le; 500m hoặc &le; 5 phút.
                </p>
              </div>
            </div>

            {/* Switch Toggle */}
            <div
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 shrink-0 mt-1 ${
                pushEnabled ? 'bg-[#005A36]' : 'bg-slate-300'
              }`}
            >
              <div
                className={`bg-white size-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  pushEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>

          {/* Option 2: Email Thông Báo */}
          <div
            onClick={() => handleToggle('email')}
            className={`flex items-start justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
              emailEnabled
                ? 'bg-emerald-50/60 border-emerald-200/80 shadow-2xs'
                : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 size-8 rounded-xl flex items-center justify-center ${
                  emailEnabled ? 'bg-[#005A36] text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                <Mail className="size-4" />
              </div>
              <div>
                <span className="text-sm font-extrabold text-slate-900">Email Vé & Hóa đơn VAT</span>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Gửi mã QR vé điện tử và tệp PDF hóa đơn điện tử về hòm thư của bạn.
                </p>
              </div>
            </div>

            {/* Switch Toggle */}
            <div
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 shrink-0 mt-1 ${
                emailEnabled ? 'bg-[#005A36]' : 'bg-slate-300'
              }`}
            >
              <div
                className={`bg-white size-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  emailEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>

          {/* Option 3: SMS Tin Nhắn Khẩn Cấp */}
          <div
            onClick={() => handleToggle('sms')}
            className={`flex items-start justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
              smsEnabled
                ? 'bg-emerald-50/60 border-emerald-200/80 shadow-2xs'
                : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 size-8 rounded-xl flex items-center justify-center ${
                  smsEnabled ? 'bg-[#005A36] text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                <MessageSquare className="size-4" />
              </div>
              <div>
                <span className="text-sm font-extrabold text-slate-900">Tin nhắn SMS khẩn cấp</span>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Chỉ nhận SMS khi chuyến xe bị hủy hoặc có sự cố thay đổi lộ trình lớn.
                </p>
              </div>
            </div>

            {/* Switch Toggle */}
            <div
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 shrink-0 mt-1 ${
                smsEnabled ? 'bg-[#005A36]' : 'bg-slate-300'
              }`}
            >
              <div
                className={`bg-white size-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  smsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#005A36] hover:bg-emerald-700 active:scale-95 text-white font-black px-5 py-2 text-xs transition-all shadow-md shadow-emerald-950/20 cursor-pointer disabled:opacity-50"
            id="btn-save-notification-prefs"
          >
            {savedSuccess ? (
              <>
                <Check className="size-4 text-emerald-300" />
                <span>Đã lưu!</span>
              </>
            ) : isSaving ? (
              <span>Đang lưu...</span>
            ) : (
              <span>Lưu Cài Đặt</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
