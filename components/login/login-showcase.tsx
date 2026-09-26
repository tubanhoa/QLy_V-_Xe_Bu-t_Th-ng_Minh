import { QrCode, Radio, Zap, type LucideIcon } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { TransitRoutesBackdrop } from './transit-routes-backdrop'

interface TelemetryStat {
  icon: LucideIcon
  value: string
  label: string
  live?: boolean
}

const STATS: TelemetryStat[] = [
  { icon: Radio, value: '12', label: 'Xe buýt điện đang vận hành thời gian thực', live: true },
  { icon: Zap, value: '100%', label: 'Zero Emission · 99,4% đúng giờ' },
  { icon: QrCode, value: '28.500+', label: 'Lượt quét mã QR không tiếp xúc/ngày' },
]

export function LoginShowcase() {
  return (
    <section
      aria-label="Giới thiệu hệ thống"
      className="relative hidden overflow-hidden bg-gradient-to-br from-[#0A131C] via-[#0A1A1F] to-[#042828] text-white lg:flex lg:w-[55%] lg:flex-col lg:justify-between lg:p-12 xl:p-16"
    >
      <TransitRoutesBackdrop />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-32 size-[28rem] rounded-full bg-emerald-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 right-0 size-[32rem] rounded-full bg-teal-400/10 blur-3xl"
      />

      <div className="relative flex items-center gap-3">
        <BrandMark size="md" />
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-wide">ICTU TRANSIT</p>
          <p className="text-xs text-white/50">Smart Bus Ticketing System</p>
        </div>
      </div>

      <div className="relative max-w-xl">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          Mạng lưới đang hoạt động
        </p>
        <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
          ICTU SMART TRANSIT PORTAL
        </h1>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-white/65">
          Hệ Thống Điều Hành & Đặt Vé Xe Buýt Công Nghệ Số
        </p>

        <ul className="mt-10 flex flex-col gap-3">
          {STATS.map(({ icon: Icon, value, label, live }) => (
            <li
              key={label}
              className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 backdrop-blur-sm transition-colors hover:border-emerald-400/25"
            >
              <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                {live && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0A131C]" />
                  </span>
                )}
              </span>
              <p className="text-sm text-white/70">
                <span className="mr-1.5 text-base font-bold text-white">{value}</span>
                {label}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-white/40">
        © 2026 Trường ĐH Công nghệ Thông tin & Truyền thông – ĐH Thái Nguyên
      </p>
    </section>
  )
}
