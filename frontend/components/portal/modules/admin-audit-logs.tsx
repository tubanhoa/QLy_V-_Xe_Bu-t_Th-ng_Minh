'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  RefreshCw,
  Eye,
  X,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  ArrowUpDown,
  Lock,
  Unlock,
  KeyRound,
  UserCheck,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Download,
  Terminal,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react'
import {
  auditService,
  type AuditLogItem,
  type AuditStatsResponse,
} from '@/lib/services/audit.service'

export function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [stats, setStats] = useState<AuditStatsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)

  // Phân trang
  const [page, setPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(20)
  const [total, setTotal] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)

  // Bộ lọc đa tiêu chí
  const [search, setSearch] = useState<string>('')
  const [selectedAction, setSelectedAction] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [filterIp, setFilterIp] = useState<string>('')
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7d' | '30d' | 'custom'>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Modal chi tiết log
  const [inspectingLog, setInspectingLog] = useState<AuditLogItem | null>(null)

  // Xử lý áp dụng Date Preset
  const handleDatePresetChange = (preset: 'all' | 'today' | '7d' | '30d' | 'custom') => {
    setDatePreset(preset)
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    if (preset === 'all') {
      setStartDate('')
      setEndDate('')
    } else if (preset === 'today') {
      setStartDate(todayStr)
      setEndDate(todayStr)
    } else if (preset === '7d') {
      const past = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
      setStartDate(past)
      setEndDate(todayStr)
    } else if (preset === '30d') {
      const past = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
      setStartDate(past)
      setEndDate(todayStr)
    }
    setPage(1)
  }

  // Nạp dữ liệu logs và stats
  const fetchAuditData = useCallback(async () => {
    setLoading(true)
    try {
      const [logsRes, statsRes] = await Promise.all([
        auditService.getAuditLogs({
          page,
          limit,
          search: search.trim() || undefined,
          action: selectedAction !== 'all' ? selectedAction : undefined,
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
          ipAddress: filterIp.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
        auditService.getAuditStats(),
      ])

      if (logsRes.success && logsRes.data) {
        setLogs(logsRes.data.items || [])
        setTotal(logsRes.data.meta.total || 0)
        setTotalPages(logsRes.data.meta.totalPages || 1)
      }

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data)
      }
    } catch (err) {
      console.error('[AdminAuditLogs] Lỗi tải dữ liệu audit logs:', err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [page, limit, search, selectedAction, selectedStatus, filterIp, startDate, endDate])

  useEffect(() => {
    fetchAuditData()
  }, [fetchAuditData])

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchAuditData()
  }

  const handleResetFilters = () => {
    setSearch('')
    setSelectedAction('all')
    setSelectedStatus('all')
    setFilterIp('')
    setDatePreset('all')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  // Copy JSON payload
  const handleCopyJson = (payload: any) => {
    if (!payload) return
    const text = JSON.stringify(payload, null, 2)
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Xuất file JSON các bản ghi log hiện tại
  const handleExportJson = () => {
    if (logs.length === 0) return
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Phân loại style hiển thị cho Action
  const getActionBadgeStyle = (act: string) => {
    const a = (act || '').toUpperCase()
    if (a.includes('LOGIN')) {
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
    }
    if (a.includes('ROLE') || a.includes('ADMIN')) {
      return 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800'
    }
    if (a.includes('LOCK') || a.includes('DELETE') || a.includes('CANCEL')) {
      return 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800'
    }
    if (a.includes('PASSWORD') || a.includes('AUTH')) {
      return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
    }
    if (a.includes('CREATE') || a.includes('REGISTER')) {
      return 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800'
    }
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE AUDIT TRAIL
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
              <ShieldCheck size={11} />
              Cơ chế tự động Interceptor
            </span>
            {stats && stats.failedLogs > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/40">
                <AlertTriangle size={11} />
                {stats.failedLogs} Thao tác cảnh báo/lỗi
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-normal text-slate-900 dark:text-white">
            Nhật Ký Truy Cập & Kiểm Toán Hệ Thống (Audit Logs)
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Lưu vết tự động toàn diện: Đăng nhập, thay đổi quyền hạn RBAC, cấu hình đội xe và lịch trình chạy xe.
          </p>
        </div>

        {/* Nút hành động */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportJson}
            disabled={logs.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Tải tệp JSON nhật ký hiển thị"
          >
            <Download size={14} />
            <span>Xuất JSON</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Đồng bộ</span>
          </button>
        </div>
      </div>

      {/* 2. Thẻ KPI Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng bản ghi kiểm toán</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {stats.totalLogs.toLocaleString('vi-VN')}
            </p>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Lưu vết an toàn trong CSDL</span>
          </div>

          <div className="p-4 rounded-3xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 shadow-xs">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Thao tác 24h qua</span>
            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
              +{stats.logs24h.toLocaleString('vi-VN')}
            </p>
            <span className="text-[10px] text-emerald-600/80 mt-0.5 block">Lưu lượng truy cập gần nhất</span>
          </div>

          <div className="p-4 rounded-3xl bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 shadow-xs">
            <span className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Cảnh báo / Lỗi thực thi</span>
            <p className="text-2xl font-black text-red-700 dark:text-red-300 mt-1">
              {stats.failedLogs.toLocaleString('vi-VN')}
            </p>
            <span className="text-[10px] text-red-600/80 mt-0.5 block">HTTP 4xx / 5xx cần chú ý</span>
          </div>

          <div className="p-4 rounded-3xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 shadow-xs">
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Người dùng tương tác</span>
            <p className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-1">
              {stats.uniqueUsersCount.toLocaleString('vi-VN')}
            </p>
            <span className="text-[10px] text-purple-600/80 mt-0.5 block">Định danh phát sinh thay đổi</span>
          </div>
        </div>
      )}

      {/* 3. Bộ lọc đa tiêu chí (Multi-criteria Filters) */}
      <div className="flex flex-col gap-3 p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Hàng 1: Preset Thời gian & Trạng thái */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
              <Calendar size={13} />
              <span>Thời gian:</span>
            </span>
            {[
              { key: 'all', label: 'Tất cả' },
              { key: 'today', label: 'Hôm nay' },
              { key: '7d', label: '7 ngày qua' },
              { key: '30d', label: '30 ngày qua' },
              { key: 'custom', label: 'Tùy chọn' },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handleDatePresetChange(p.key as any)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  datePreset === p.key
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Activity size={13} />
              <span>Trạng thái:</span>
            </span>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value)
                setPage(1)
              }}
              className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none cursor-pointer shadow-xs"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="SUCCESS">Thành công (SUCCESS)</option>
              <option value="FAILED">Thất bại / Lỗi (FAILED)</option>
            </select>
          </div>
        </div>

        {/* Hàng 2: Date Pickers (nếu chọn custom) & Bộ lọc Search, Action, IP */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Ô tìm kiếm từ khóa */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Tìm hành động, endpoint, IP, email, họ tên..."
              className="h-10 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-3 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none shadow-xs"
            />
          </div>

          {/* Lọc theo Loại hành động */}
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value)
              setPage(1)
            }}
            className="h-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-slate-700 dark:text-slate-300 focus:border-emerald-500 focus:outline-none cursor-pointer shadow-xs"
          >
            <option value="all">Tất cả loại hành động</option>
            <option value="LOGIN">Đăng nhập (LOGIN)</option>
            <option value="REGISTER">Đăng ký (REGISTER)</option>
            <option value="CREATE_USER">Tạo người dùng (CREATE_USER)</option>
            <option value="UPDATE_USER">Sửa người dùng (UPDATE_USER)</option>
            <option value="CHANGE_ROLE">Phân quyền (CHANGE_ROLE)</option>
            <option value="CHANGE_STATUS">Khóa/Mở tài khoản (CHANGE_STATUS)</option>
            <option value="CHANGE_PASSWORD">Đổi mật khẩu (CHANGE_PASSWORD)</option>
            <option value="CREATE_BOOKING">Đặt vé (CREATE_BOOKING)</option>
            <option value="CHECKIN_TICKET">Soát vé (CHECKIN_TICKET)</option>
            <option value="CANCEL_TICKET">Hủy vé (CANCEL_TICKET)</option>
            <option value="CREATE_VOUCHER">Tạo Voucher (CREATE_VOUCHER)</option>
          </select>

          {/* Lọc theo IP */}
          <input
            type="text"
            value={filterIp}
            onChange={(e) => {
              setFilterIp(e.target.value)
              setPage(1)
            }}
            placeholder="Lọc IP (vd: 127.0.0.1)"
            className="h-10 w-36 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-mono text-slate-800 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none shadow-xs"
          />

          {/* Tuỳ chọn khoảng ngày (chỉ hiện khi datePreset === 'custom') */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setPage(1)
                }}
                className="h-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-mono text-slate-700 dark:text-slate-300 shadow-xs"
              />
              <span className="text-slate-400 text-xs">đến</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setPage(1)
                }}
                className="h-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-mono text-slate-700 dark:text-slate-300 shadow-xs"
              />
            </div>
          )}

          {/* Nút Reset bộ lọc */}
          <button
            type="button"
            onClick={handleResetFilters}
            className="h-10 px-3.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all cursor-pointer"
          >
            Đặt lại
          </button>
        </div>
      </div>

      {/* 4. Bảng Audit Logs */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
              <tr>
                <th className="p-4 pl-6 w-40 whitespace-nowrap">Thời điểm</th>
                <th className="p-4 w-44 whitespace-nowrap">Hành động</th>
                <th className="p-4 min-w-[260px] whitespace-nowrap">Endpoint & Method</th>
                <th className="p-4 min-w-[200px] whitespace-nowrap">Người thực hiện</th>
                <th className="p-4 w-36 whitespace-nowrap">Địa chỉ IP</th>
                <th className="p-4 w-28 whitespace-nowrap">Trạng thái</th>
                <th className="p-4 pr-6 w-24 text-right whitespace-nowrap">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-xs text-slate-400">
                    <RefreshCw size={22} className="animate-spin text-emerald-600 mx-auto mb-2" />
                    Đang nạp nhật ký lưu vết hệ thống...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-xs text-slate-400">
                    Không tìm thấy bản ghi nhật ký phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isFailed =
                    (log.status || '').toUpperCase() === 'FAILED' ||
                    (log.status || '').startsWith('4') ||
                    (log.status || '').startsWith('5')

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Thời điểm */}
                      <td className="p-4 pl-6 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(log.timestamp).toLocaleDateString('vi-VN')}
                        </div>
                      </td>

                      {/* Hành động */}
                      <td className="p-4 w-44 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getActionBadgeStyle(
                            log.action
                          )}`}
                        >
                          <Terminal size={12} className="shrink-0" />
                          <span>{log.action}</span>
                        </span>
                      </td>

                      {/* Endpoint & Method */}
                      <td className="p-4 min-w-[260px]">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              log.method === 'POST'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                : log.method === 'PATCH' || log.method === 'PUT'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : log.method === 'DELETE'
                                ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {log.method || 'POST'}
                          </span>
                          <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[260px]" title={log.endpoint || ''}>
                            {log.endpoint || `/${log.resourceName}`}
                          </span>
                        </div>
                        {typeof log.executionTimeMs === 'number' && (
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                            Độ trễ: {log.executionTimeMs} ms
                          </span>
                        )}
                      </td>

                      {/* Người thực hiện */}
                      <td className="p-4 min-w-[200px]">
                        {log.user ? (
                          <div>
                            <p className="font-bold text-xs text-slate-900 dark:text-white">
                              {log.user.fullName}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              {log.user.email}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 italic">
                              Hệ thống / Vãng lai
                            </span>
                            {log.userId && (
                              <span className="text-[10px] font-mono text-slate-400 block">
                                ID: {log.userId.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Địa chỉ IP */}
                      <td className="p-4 w-36 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {log.ipAddress || '127.0.0.1'}
                      </td>

                      {/* Trạng thái */}
                      <td className="p-4 w-28 whitespace-nowrap">
                        {isFailed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40">
                            <span className="size-1.5 rounded-full bg-red-500 shrink-0" />
                            <span>FAILED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                            <span className="size-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                            <span>SUCCESS</span>
                          </span>
                        )}
                      </td>

                      {/* Nút Xem chi tiết */}
                      <td className="p-4 pr-6 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setInspectingLog(log)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                          title="Xem toàn bộ payload thay đổi"
                        >
                          <Eye size={13} />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Phân trang (Pagination Bar) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span>Hiển thị</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value))
                setPage(1)
              }}
              className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>bản ghi mỗi trang · Tổng số <strong>{total}</strong> logs</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">
              Trang <strong>{page}</strong> / <strong>{totalPages || 1}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                title="Trang trước"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                title="Trang sau"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Modal Xem Chi Tiết Log & Payload Changes */}
      {inspectingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center font-bold">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Chi Tiết Bản Ghi Kiểm Toán
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    ID: {inspectingLog.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-sidebar-scroll">
              {/* Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 font-semibold block mb-0.5">Hành động:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {inspectingLog.action}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-0.5">Trạng thái:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {inspectingLog.status || 'SUCCESS'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-0.5">Thời điểm:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {new Date(inspectingLog.timestamp).toLocaleString('vi-VN')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-0.5">Địa chỉ IP:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {inspectingLog.ipAddress || '127.0.0.1'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-0.5">Endpoint API:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {inspectingLog.method || 'POST'} {inspectingLog.endpoint || `/${inspectingLog.resourceName}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-0.5">Người thực hiện:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {inspectingLog.user ? `${inspectingLog.user.fullName} (${inspectingLog.user.email})` : 'Hệ thống / Vãng lai'}
                  </span>
                </div>
              </div>

              {/* User Agent */}
              <div>
                <span className="text-slate-400 font-semibold block mb-1">User Agent / Thiết bị:</span>
                <p className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all">
                  {inspectingLog.userAgent || 'SmartBus System Client'}
                </p>
              </div>

              {/* JSON Changes Payload */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5">
                    <Terminal size={14} className="text-emerald-500" />
                    <span>Dữ liệu thay đổi (Changes Payload JSON):</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyJson(inspectingLog.changes)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copied ? 'Đã sao chép' : 'Sao chép JSON'}</span>
                  </button>
                </div>

                <pre className="rounded-2xl bg-slate-950 p-4 font-mono text-[11px] text-emerald-400 border border-slate-800 max-h-64 overflow-y-auto custom-sidebar-scroll">
                  {inspectingLog.changes
                    ? JSON.stringify(inspectingLog.changes, null, 2)
                    : '// Không có payload bổ sung'}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
