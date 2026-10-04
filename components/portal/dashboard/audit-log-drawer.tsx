'use client'

import React from 'react'
import {
  X,
  ShieldAlert,
  Clock,
  User,
  Globe,
  Terminal,
  FileText,
  Activity,
  CheckCircle2,
} from 'lucide-react'
import type { ActivityLogItem } from '@/lib/services/analytics.service'

interface AuditLogDrawerProps {
  isOpen: boolean
  onClose: () => void
  logs: ActivityLogItem[]
}

export function AuditLogDrawer({ isOpen, onClose, logs }: AuditLogDrawerProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <aside
        className="w-full max-w-xl h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-250"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                Nhật Ký Kiểm Toán Hệ Thống (Audit Trail)
              </h3>
              <p className="text-xs text-slate-500">
                Ghi vết bảo mật mọi thay đổi tuyến, trạm, giá vé và điều phối
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Security Summary Banner */}
        <div className="p-4 mx-5 mt-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Audit Logger: Đang ghi nhận tự động
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {logs.length} bản ghi gần nhất
          </span>
        </div>

        {/* Logs List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {logs.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              Chưa có bản ghi kiểm toán nào phát sinh trong phiên.
            </div>
          ) : (
            logs.map((log) => {
              const dateStr = new Date(log.timestamp).toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })

              return (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-indigo-400 transition-all space-y-2.5 text-xs shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-mono font-black text-[11px]">
                      {log.action}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                      <Clock size={11} />
                      <span>{dateStr}</span>
                    </span>
                  </div>

                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    Thao tác trên tài nguyên: <code className="text-emerald-600 font-mono font-bold">{log.resourceName}</code> {log.resourceId ? `(${log.resourceId})` : ''}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-700/60 pt-2">
                    <span className="flex items-center gap-1">
                      <User size={11} className="text-slate-400" />
                      <span>{log.user?.fullName || log.user?.email || 'Hệ thống'}</span>
                    </span>

                    {log.ipAddress && (
                      <span className="flex items-center gap-1 font-mono">
                        <Globe size={11} className="text-slate-400" />
                        <span>IP: {log.ipAddress}</span>
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </aside>
    </div>
  )
}
