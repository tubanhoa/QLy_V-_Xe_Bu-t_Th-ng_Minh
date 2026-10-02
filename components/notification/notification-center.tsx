'use client'

/**
 * Trung Tâm Thông Báo (Notification Center Popover & Drawer)
 * Domain: notifications & geofencing
 * Branch: feature/SBTS-frontend-geofencing-and-push-notification
 */

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Bell,
  Bus,
  MapPin,
  Clock,
  Ticket,
  AlertTriangle,
  Sparkles,
  CheckCheck,
  Check,
  X,
  Sliders,
  Radio,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { haptic } from '@/lib/utils/haptics'
import { NotificationPreferencesModal } from './notification-preferences-modal'
import type { NotificationItem, NotificationType } from '@/lib/types/notification'
import type { UseNotificationsReturn } from '@/hooks/use-notifications'

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
  notificationController: UseNotificationsReturn
  onOpenPreferences?: () => void
}

type TabFilter = 'all' | 'transit' | 'tickets' | 'promo'

export function NotificationCenter({
  isOpen,
  onClose,
  notificationController,
}: NotificationCenterProps) {
  const {
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    preferences,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    updatePreferences,
    triggerMockGeofenceAlert,
  } = notificationController

  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false)

  if (!isOpen) return null

  // Lọc thông báo theo Tab
  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'transit') {
      return (
        item.type === 'STATION_APPROACHING_PICKUP' ||
        item.type === 'STATION_APPROACHING_DROPOFF' ||
        item.type === 'BUS_APPROACHING'
      )
    }
    if (activeTab === 'tickets') {
      return (
        item.type === 'TICKET_BOOKED' ||
        item.type === 'TRIP_DELAY' ||
        item.type === 'TRIP_CANCELLED'
      )
    }
    if (activeTab === 'promo') {
      return item.type === 'PROMOTION' || item.type === 'SYSTEM'
    }
    return true
  })

  // Định dạng thời gian tương đối
  const formatRelativeTime = (isoString: string) => {
    try {
      const now = Date.now()
      const time = new Date(isoString).getTime()
      const diffMinutes = Math.floor((now - time) / (60 * 1000))

      if (diffMinutes < 1) return 'Vừa xong'
      if (diffMinutes < 60) return `${diffMinutes} phút trước`
      const diffHours = Math.floor(diffMinutes / 60)
      if (diffHours < 24) return `${diffHours} giờ trước`
      const diffDays = Math.floor(diffHours / 24)
      return `${diffDays} ngày trước`
    } catch {
      return 'Gần đây'
    }
  }

  // Render Icon theo Loại thông báo
  const renderNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'STATION_APPROACHING_PICKUP':
        return (
          <div className="size-9 rounded-xl bg-emerald-100 text-[#005A36] border border-emerald-300 flex items-center justify-center shrink-0">
            <Bus className="size-4.5 animate-pulse" />
          </div>
        )
      case 'STATION_APPROACHING_DROPOFF':
        return (
          <div className="size-9 rounded-xl bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center shrink-0">
            <MapPin className="size-4.5" />
          </div>
        )
      case 'TICKET_BOOKED':
        return (
          <div className="size-9 rounded-xl bg-teal-100 text-teal-700 border border-teal-300 flex items-center justify-center shrink-0">
            <Ticket className="size-4.5" />
          </div>
        )
      case 'TRIP_DELAY':
      case 'TRIP_CANCELLED':
        return (
          <div className="size-9 rounded-xl bg-rose-100 text-rose-700 border border-rose-300 flex items-center justify-center shrink-0">
            <AlertTriangle className="size-4.5" />
          </div>
        )
      case 'PROMOTION':
        return (
          <div className="size-9 rounded-xl bg-purple-100 text-purple-700 border border-purple-300 flex items-center justify-center shrink-0">
            <Sparkles className="size-4.5" />
          </div>
        )
      default:
        return (
          <div className="size-9 rounded-xl bg-slate-100 text-slate-700 border border-slate-300 flex items-center justify-center shrink-0">
            <Bell className="size-4.5" />
          </div>
        )
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => {
          haptic.play('pop')
          onClose()
        }}
        className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-200"
      />

      {/* Popover Card / Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trung tâm thông báo"
        className="fixed top-18 right-2 sm:right-6 lg:right-10 z-50 w-[calc(100vw-16px)] sm:w-[420px] max-h-[82vh] flex flex-col rounded-3xl border border-white/80 bg-white/95 shadow-2xl shadow-slate-900/20 backdrop-blur-xl text-slate-800 animate-in zoom-in-95 slide-in-from-top-3 duration-200 overflow-hidden ring-1 ring-slate-900/5"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4.5 pb-3 border-b border-slate-100 bg-white/50">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-emerald-50 border border-emerald-200 text-[#005A36] flex items-center justify-center">
              <Bell className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <span>Thông Báo</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2">
                    {unreadCount}
                  </span>
                )}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Mark all as read button */}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold text-[#005A36] hover:bg-emerald-50 transition-colors cursor-pointer"
                title="Đánh dấu tất cả đã đọc"
              >
                <CheckCheck className="size-3.5" />
                <span className="hidden xs:inline">Đã đọc tất cả</span>
              </button>
            )}

            {/* Preferences Gear */}
            <button
              type="button"
              onClick={() => {
                haptic.play('tap')
                setIsPreferencesOpen(true)
              }}
              className="size-8 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              title="Cài đặt thông báo"
            >
              <Sliders className="size-4" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                haptic.play('pop')
                onClose()
              }}
              className="size-8 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Đóng thông báo"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 bg-slate-50/70 border-b border-slate-100 overflow-x-auto no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => {
              haptic.play('select')
              setActiveTab('all')
            }}
            className={`px-3 py-1 rounded-xl font-extrabold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#005A36] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Tất cả ({notifications.length})
          </button>

          <button
            type="button"
            onClick={() => {
              haptic.play('select')
              setActiveTab('transit')
            }}
            className={`px-3 py-1 rounded-xl font-extrabold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'transit'
                ? 'bg-[#005A36] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Đón & Xuống xe
          </button>

          <button
            type="button"
            onClick={() => {
              haptic.play('select')
              setActiveTab('tickets')
            }}
            className={`px-3 py-1 rounded-xl font-extrabold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'tickets'
                ? 'bg-[#005A36] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Vé & Chuyến
          </button>

          <button
            type="button"
            onClick={() => {
              haptic.play('select')
              setActiveTab('promo')
            }}
            className={`px-3 py-1 rounded-xl font-extrabold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'promo'
                ? 'bg-[#005A36] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Ưu đãi
          </button>
        </div>

        {/* Notifications Scrollable List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1 max-h-[52vh]">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 px-6 flex flex-col items-center text-center">
              <div className="size-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#005A36] mb-3">
                <Check className="size-6" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-800">Không có thông báo mới</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Mọi hành trình và vé xe của bạn đang được cập nhật liên tục theo thời gian thực.
              </p>
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const deepLink = item.data?.deepLink

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (!item.isRead) markAsRead(item.id)
                  }}
                  className={`relative group rounded-2xl p-3 transition-all flex items-start gap-3 cursor-pointer ${
                    item.isRead
                      ? 'bg-transparent hover:bg-slate-50/80 opacity-80 hover:opacity-100'
                      : 'bg-emerald-50/40 hover:bg-emerald-50/70 border border-emerald-100 shadow-2xs'
                  }`}
                >
                  {/* Unread indicator dot */}
                  {!item.isRead && (
                    <span className="absolute top-3.5 right-3 size-2 rounded-full bg-[#005A36] ring-2 ring-emerald-200" />
                  )}

                  {/* Icon */}
                  {renderNotificationIcon(item.type)}

                  {/* Body content */}
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-black text-slate-900 leading-snug">
                        {item.title}
                      </h4>
                    </div>

                    <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {item.body}
                    </p>

                    {/* Geofence Metadata Chips */}
                    {item.data?.distanceMeters && (
                      <div className="mt-2 flex items-center gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 text-[#005A36] px-1.5 py-0.2 font-black border border-emerald-300">
                          <MapPin className="size-3" />
                          {item.data.distanceMeters}m
                        </span>
                        {item.data.etaMinutes && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 text-amber-800 px-1.5 py-0.2 font-black border border-amber-300">
                            <Clock className="size-3" />
                            ~{item.data.etaMinutes} phút
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{formatRelativeTime(item.createdAt)}</span>

                      {/* Deep Link Button */}
                      {deepLink && (
                        <Link
                          href={deepLink}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!item.isRead) markAsRead(item.id)
                            onClose()
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#005A36] hover:underline"
                        >
                          <span>Xem chi tiết</span>
                          <ChevronRight className="size-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer with Demo Simulator Button (Perfect for Lecturer Demo) */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              triggerMockGeofenceAlert()
              haptic.play('busArrival')
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100 active:scale-98 text-[#005A36] font-extrabold py-2 px-3 text-xs transition-all cursor-pointer"
            id="btn-simulate-geofence-trigger"
            title="Thử nghiệm thông báo khi xe buýt tiến vào bán kính <= 500m"
          >
            <Radio className="size-3.5 text-[#005A36] animate-pulse" />
            <span>Mô phỏng: Xe buýt vào vùng Geofence (&le; 500m)</span>
          </button>
        </div>
      </div>

      {/* Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        preferences={preferences}
        onSave={updatePreferences}
      />
    </>
  )
}
