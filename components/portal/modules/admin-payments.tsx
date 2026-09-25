'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  CreditCard,
  Download,
  Filter,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react'

interface TransactionItem {
  id: string
  bookingCode: string
  customerName: string
  phone: string
  route: string
  amount: number
  paymentMethod: 'VNPay' | 'MoMo' | 'Napas' | 'ICTU SmartCard'
  status: 'success' | 'refunded' | 'failed'
  createdAt: string
}

const INITIAL_TRANSACTIONS: TransactionItem[] = [
  {
    id: 'TXN-99812',
    bookingCode: 'BK-0745-14A',
    customerName: 'Nguyễn Hoàng Long',
    phone: '0981.445.667',
    route: 'Tuyến 01',
    amount: 10000,
    paymentMethod: 'VNPay',
    status: 'success',
    createdAt: 'Hôm nay, 07:15',
  },
  {
    id: 'TXN-99811',
    bookingCode: 'BK-0800-02B',
    customerName: 'Trần Văn Mạnh',
    phone: '0912.778.899',
    route: 'Tuyến 02',
    amount: 8000,
    paymentMethod: 'MoMo',
    status: 'success',
    createdAt: 'Hôm nay, 07:05',
  },
  {
    id: 'TXN-99810',
    bookingCode: 'BK-PASS-098',
    customerName: 'Hoàng Thùy Dung',
    phone: '0977.112.233',
    route: 'Vé tháng Tuyến 01 (HSSV)',
    amount: 100000,
    paymentMethod: 'VNPay',
    status: 'success',
    createdAt: 'Hôm qua, 18:30',
  },
  {
    id: 'TXN-99809',
    bookingCode: 'BK-0700-06A',
    customerName: 'Lê Tuấn Kiệt',
    phone: '0964.556.778',
    route: 'Tuyến 01',
    amount: 10000,
    paymentMethod: 'MoMo',
    status: 'refunded',
    createdAt: 'Hôm qua, 15:20',
  },
]

export function AdminPayments() {
  const [transactions, setTransactions] = useState<TransactionItem[]>(INITIAL_TRANSACTIONS)
  const [search, setSearch] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleRefund = (id: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'refunded' } : t))
    )
    setFeedback(`Đã thực hiện hoàn tiền thành công cho giao dịch ${id}!`)
    setTimeout(() => setFeedback(null), 3000)
  }

  const filtered = transactions.filter(
    (t) =>
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.customerName.toLowerCase().includes(search.toLowerCase()) ||
      t.bookingCode.toLowerCase().includes(search.toLowerCase())
  )

  const totalSuccess = transactions
    .filter((t) => t.status === 'success')
    .reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Quản Lý Vé & Cổng Thanh Toán
          </h1>
          <p className="text-sm text-muted-foreground">
            Lịch sử giao dịch trực tuyến qua cổng VNPay, MoMo và đối soát hoàn vé
          </p>
        </div>

        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm theo mã giao dịch, tên khách..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-xs sm:text-sm text-foreground focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {feedback && (
        <div className="animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-500" />
          {feedback}
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Tổng doanh thu hôm nay</p>
          <p className="mt-1 text-2xl font-bold text-[#00A86B]">
            {totalSuccess.toLocaleString('vi-VN')} đ
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Kênh VNPay Sandbox</p>
          <p className="mt-1 text-2xl font-bold text-foreground">110.000 đ</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Kênh MoMo Sandbox</p>
          <p className="mt-1 text-2xl font-bold text-foreground">18.000 đ</p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="p-4 pl-6">Mã giao dịch</th>
                <th className="p-4">Khách hàng</th>
                <th className="p-4">Tuyến & Dịch vụ</th>
                <th className="p-4">Số tiền</th>
                <th className="p-4">Phương thức</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 pr-6 text-right">Hoàn tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 pl-6 font-mono text-xs font-semibold text-foreground">
                    {item.id}
                    <span className="block text-[11px] text-muted-foreground">{item.bookingCode}</span>
                  </td>
                  <td className="p-4 text-xs">
                    <p className="font-semibold text-foreground">{item.customerName}</p>
                    <p className="text-muted-foreground">{item.phone}</p>
                  </td>
                  <td className="p-4 text-xs font-medium text-foreground">{item.route}</td>
                  <td className="p-4 font-mono text-xs font-bold text-foreground">
                    {item.amount.toLocaleString('vi-VN')} đ
                  </td>
                  <td className="p-4 text-xs">
                    <span className="rounded-lg bg-accent px-2 py-0.5 font-medium text-foreground">
                      {item.paymentMethod}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        item.status === 'success'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : item.status === 'refunded'
                          ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                      }`}
                    >
                      {item.status === 'success'
                        ? 'Thành công'
                        : item.status === 'refunded'
                        ? 'Đã hoàn tiền'
                        : 'Thất bại'}
                    </span>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    {item.status === 'success' ? (
                      <button
                        type="button"
                        onClick={() => handleRefund(item.id)}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                      >
                        Hoàn vé
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
