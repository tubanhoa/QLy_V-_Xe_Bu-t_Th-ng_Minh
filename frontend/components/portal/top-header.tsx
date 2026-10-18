import { useEffect, useRef, useState, useMemo } from 'react'
import { Avatar, Badge, Breadcrumb, Dropdown, Popover, type MenuProps } from 'antd'
import {
  Bell,
  ChevronRight,
  LogOut,
  Menu as MenuIcon,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  User,
  KeyRound,
  X,
  Bus,
  CalendarDays,
  Navigation,
  AlertTriangle,
  Route,
  CreditCard,
  Ticket,
  Tag,
  Receipt,
  Users,
  IdCard,
  FileBarChart2,
  LayoutDashboard,
  Clock,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { analyticsService, type IncidentReportItem } from '@/lib/services/analytics.service'
import { tripService, type TripItem } from '@/lib/services/trip.service'
import { ROLE_META, type NavItem, type Role } from '@/lib/rbac'
import { cn } from '@/lib/utils'

/** Chuẩn hóa xâu tiếng Việt có dấu về không dấu để tìm kiếm thông minh */
function removeVietnameseTones(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

const PORTAL_NAV_SEARCH_ITEMS = [
  {
    key: 'dashboard',
    label: 'Dashboard Điều Hành',
    desc: 'Live KPI doanh thu, biểu đồ phụ tải tuyến, chỉ số thời gian thực',
    icon: LayoutDashboard,
    tags: ['dashboard', 'tong quan', 'kpi', 'doanh thu', 'bieu do'],
  },
  {
    key: 'schedule',
    label: 'Lịch Trình Chạy Xe & Điều Phối',
    desc: 'Lập lịch, phân ca tài xế, điều xe, đóng chuyến quá hạn',
    icon: CalendarDays,
    tags: ['lich trinh', 'dieu phoi', 'chuyen xe', 'phan ca', 'dong chuyen', 'schedule', 'ca chay', '20b', 'chuyen'],
  },
  {
    key: 'gps',
    label: 'Bản Đồ Giám Sát GPS Trực Tuyến',
    desc: 'Theo dõi vị trí xe buýt thời gian thực & bộ giả lập IoT',
    icon: Navigation,
    tags: ['ban do', 'gps', 'dinh vi', 'giam sat', 'iot', 'lo trinh', 'vi tri'],
  },
  {
    key: 'incidents',
    label: 'Cảnh Báo & Xử Lý Sự Cố',
    desc: 'Giám sát sự cố kỹ thuật, tắc đường, trễ chuyến, va quẹt',
    icon: AlertTriangle,
    tags: ['su co', 'canh bao', 'tac duong', 'hong xe', 'cham gio', 'incidents'],
  },
  {
    key: 'routes',
    label: 'Tuyến Xe & Trạm Dừng',
    desc: 'Quản lý lộ trình tuyến buýt, geofence, trạm đón trả khách',
    icon: Route,
    tags: ['tuyen xe', 'tram dung', 'diem don', 'diem tra', 'lo trinh', 'routes'],
  },
  {
    key: 'fleet',
    label: 'Đội Xe Buýt Điện & Sơ Đồ Ghế',
    desc: 'Quản lý phương tiện, biển số, tải trọng, sơ đồ 28 ghế',
    icon: Bus,
    tags: ['doi xe', 'xe buyt', 'bien so', 'so do ghe', 'xe dien', 'fleet', '20b', 'xe'],
  },
  {
    key: 'driver-licenses',
    label: 'Hồ Sơ & Bằng Lái Tài Xế (GPLX)',
    desc: 'Thẩm định giấy phép lái xe Hạng D/E, hồ sơ lái xe an toàn',
    icon: IdCard,
    tags: ['bang lai', 'gplx', 'ho so tai xe', 'tham dinh', 'hang d', 'hang e', 'driver license'],
  },
  {
    key: 'staff',
    label: 'Nhân Sự & Phân Quyền Vận Hành',
    desc: 'Tài xế, phụ xe, điều độ viên, phân quyền RBAC',
    icon: Users,
    tags: ['nhan su', 'tai xe', 'phu xe', 'dieu do', 'phan quyen', 'staff'],
  },
  {
    key: 'payments',
    label: 'Vé Xe & Cổng Thanh Toán',
    desc: 'Lịch sử giao dịch VNPay, MoMo, kiểm tra mã vé, soát vé',
    icon: CreditCard,
    tags: ['ve xe', 'thanh toan', 'vnpay', 'momo', 'giao dich', 'soat ve', 'payments'],
  },
  {
    key: 'passes',
    label: 'Vé Tháng & Trợ Giá Sinh Viên HSSV',
    desc: 'Chính sách ưu đãi sinh viên ICTU trợ giá 50%, quản lý thẻ tháng',
    icon: Ticket,
    tags: ['ve thang', 'the thang', 'sinh vien', 'hssv', 'tro gia', '50%', 'passes'],
  },
  {
    key: 'vouchers',
    label: 'Mã Giảm Giá & Voucher',
    desc: 'Phát hành mã khuyến mại, chiến dịch ưu đãi chuyến xe',
    icon: Tag,
    tags: ['voucher', 'ma giam gia', 'khuyen mai', 'uu dai', 'giam gia'],
  },
  {
    key: 'invoices',
    label: 'Hóa Đơn Điện Tử VAT',
    desc: 'Tra cứu, ký số điện tử & xuất tệp PDF hóa đơn',
    icon: Receipt,
    tags: ['hoa don', 'vat', 'ky so', 'pdf', 'invoices'],
  },
  {
    key: 'reports',
    label: 'Báo Cáo Doanh Thu & Sản Lượng',
    desc: 'Thống kê sản lượng khách, doanh thu theo tuyến, ca chạy',
    icon: FileBarChart2,
    tags: ['bao cao', 'doanh thu', 'san luong', 'thong ke', 'reports'],
  },
  {
    key: 'user-profile',
    label: 'Hồ Sơ Cá Nhân & Bằng Lái Của Tôi',
    desc: 'Cập nhật thông tin tài khoản, ảnh đại diện, bằng lái xe cá nhân',
    icon: User,
    tags: ['ho so ca nhan', 'tai khoan', 'thong tin', 'profile'],
  },
]

interface TopHeaderProps {
  collapsed: boolean
  onToggleCollapse: () => void
  onOpenMobileNav: () => void
  activeItem: NavItem
  onNavigate?: (key: string) => void
  onLogout: () => void
}

const iconButton =
  'press inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-brand/30 hover:text-foreground'

export function TopHeader({
  collapsed,
  onToggleCollapse,
  onOpenMobileNav,
  activeItem,
  onNavigate,
  onLogout,
}: TopHeaderProps) {
  const { user, role, themeMode, toggleTheme } = useAuth()
  const searchRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const [incidents, setIncidents] = useState<IncidentReportItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [foundTrips, setFoundTrips] = useState<TripItem[]>([])
  const [isSearchingTrips, setIsSearchingTrips] = useState(false)

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Phím tắt Ctrl + K mở tìm kiếm, Escape để đóng
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
        setIsSearchOpen(true)
      }
      if (event.key === 'Escape') {
        setIsSearchOpen(false)
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Tra cứu dữ liệu chuyến xe thời gian thực (Debounced 250ms)
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setFoundTrips([])
      setIsSearchingTrips(false)
      return
    }

    setIsSearchingTrips(true)
    const timer = setTimeout(async () => {
      try {
        const res = await tripService.getTrips({ search: q, limit: 5 })
        if (res.success && res.data) {
          setFoundTrips(res.data.items || [])
        }
      } catch {
        // ignore
      } finally {
        setIsSearchingTrips(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Lọc phân hệ chức năng phù hợp theo từ khóa
  const filteredNavItems = useMemo(() => {
    const qClean = removeVietnameseTones(searchQuery)
    const qRaw = searchQuery.toLowerCase().trim()
    if (!qRaw) {
      // Khi chưa gõ gì, hiện 4 module điều hành thông dụng nhất
      return PORTAL_NAV_SEARCH_ITEMS.filter((item) =>
        ['schedule', 'gps', 'fleet', 'passes'].includes(item.key)
      )
    }
    return PORTAL_NAV_SEARCH_ITEMS.filter((item) => {
      const labelClean = removeVietnameseTones(item.label)
      const descClean = removeVietnameseTones(item.desc)
      return (
        item.key.toLowerCase().includes(qRaw) ||
        item.label.toLowerCase().includes(qRaw) ||
        labelClean.includes(qClean) ||
        item.desc.toLowerCase().includes(qRaw) ||
        descClean.includes(qClean) ||
        item.tags.some((tag) => tag.includes(qClean) || tag.includes(qRaw))
      )
    })
  }, [searchQuery])

  if (!user) return null

  const profileItems: MenuProps['items'] = [
    {
      key: 'profile-info',
      disabled: true,
      label: (
        <div className="py-1">
          <p className="text-sm font-semibold text-foreground">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      ),
    },
    { type: 'divider' },
    {
      key: 'user-profile',
      icon: <User size={16} strokeWidth={1.75} className="text-emerald-600" aria-hidden="true" />,
      label: 'Hồ sơ cá nhân & Bằng lái',
    },
    {
      key: 'change-password',
      icon: <KeyRound size={16} strokeWidth={1.75} className="text-blue-600" aria-hidden="true" />,
      label: 'Đổi mật khẩu tài khoản',
    },
    { type: 'divider' },
    {
      key: 'logout',
      danger: true,
      icon: <LogOut size={16} strokeWidth={1.75} className="text-red-500" aria-hidden="true" />,
      label: 'Đăng xuất',
    },
  ]

  const portalRole: Role =
    role === 'driver' ? 'driver' : role === 'dispatcher' || role === 'manager' ? 'dispatcher' : 'admin'

  const handleProfileClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'user-profile' || key === 'change-password') {
      if (typeof onNavigate === 'function') {
        onNavigate('profile')
      }
    } else if (key === 'logout') {
      onLogout()
    }
  }

  const pendingIncidents = incidents.filter((i: IncidentReportItem) => i.resolutionStatus === 'pending')
  const pendingCount = pendingIncidents.length

  const notifications = (
    <div className="w-80 p-1">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <p className="text-sm font-semibold text-foreground">Cảnh báo từ tài xế</p>
        <span className="text-[11px] font-medium text-muted-foreground">
          {pendingCount > 0 ? `${pendingCount} chưa xử lý` : 'Bình thường'}
        </span>
      </div>
      {incidents.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Không có sự cố nào trên các tuyến xe buýt
        </p>
      ) : (
        <ul className="mt-2.5 flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
          {incidents.slice(0, 5).map((incident: IncidentReportItem) => {
            const isResolved = incident.resolutionStatus === 'resolved'
            return (
              <li
                key={incident.id}
                className={cn(
                  'rounded-xl border p-2.5 text-xs transition-colors',
                  isResolved
                    ? 'border-border/60 bg-muted/20 opacity-70'
                    : 'border-amber-500/30 bg-amber-500/[0.04]',
                )}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-semibold text-foreground">
                    {incident.trip?.route?.routeCode ? `Tuyến ${incident.trip.route.routeCode}` : 'Sự cố hành trình'}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.2 rounded font-medium',
                      isResolved
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-amber-500/10 text-amber-600',
                    )}
                  >
                    {isResolved ? 'Đã xử lý' : 'Đang xử lý'}
                  </span>
                </div>
                <p className="text-muted-foreground line-clamp-2">{incident.description}</p>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{incident.reportedByUser?.fullName || 'Tài xế'}</span>
                  <span>{new Date(incident.reportedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
          className={cn(iconButton, 'hidden md:inline-flex')}
        >
          {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.75} /> : <PanelLeftClose size={18} strokeWidth={1.75} />}
        </button>
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Mở menu điều hướng"
          className={cn(iconButton, 'md:hidden')}
        >
          <MenuIcon size={18} strokeWidth={1.75} />
        </button>

        <div className="min-w-0 flex-1 lg:flex-none">
          <p className="truncate text-sm font-semibold text-foreground sm:hidden">{activeItem.label}</p>
          <Breadcrumb
            separator={<ChevronRight size={14} className="mt-1 text-muted-foreground" aria-hidden="true" />}
            items={[
              { title: ROLE_META[portalRole].label },
              { title: <span className="font-semibold text-foreground">{activeItem.label}</span> },
            ]}
            className="hidden truncate sm:block"
          />
        </div>

        <div ref={searchContainerRef} className="relative mx-auto hidden w-full max-w-md lg:block">
          <div className="relative">
            <span className="sr-only">Tìm kiếm biển số, mã chuyến, chức năng</span>
            <Search
              size={16}
              strokeWidth={1.75}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={searchRef}
              type="text"
              placeholder="Tìm biển số, mã chuyến, chức năng..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setIsSearchOpen(true)
              }}
              onFocus={() => setIsSearchOpen(true)}
              className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-20 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-brand/40 focus:ring-4 focus:ring-brand/10"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Xóa tìm kiếm"
                >
                  <X size={14} />
                </button>
              )}
              <kbd className="pointer-events-none rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted-foreground">
                Ctrl + K
              </kbd>
            </div>
          </div>

          {/* DROPDOWN KẾT QUẢ TÌM KIẾM TOÀN CỤC */}
          {isSearchOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-border/90 bg-card/95 backdrop-blur-md p-2.5 shadow-2xl animate-in fade-in slide-from-top-1 duration-150 max-h-[460px] overflow-y-auto custom-sidebar-scroll">
              {/* Nhóm 1: Chức năng & Phân hệ điều hành */}
              {filteredNavItems.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span>{searchQuery.trim() ? 'Phân hệ & Chức năng phù hợp' : 'Gợi ý phân hệ nhanh'}</span>
                    <span className="text-[10px] lowercase font-normal">{filteredNavItems.length} mục</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {filteredNavItems.slice(0, 5).map((item) => {
                      const Icon = item.icon
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            onNavigate?.(item.key)
                            setIsSearchOpen(false)
                            setSearchQuery('')
                          }}
                          className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-muted/70 transition-colors group cursor-pointer"
                        >
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <Icon size={15} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              {item.label}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">{item.desc}</p>
                          </div>
                          <ArrowRight size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Nhóm 2: Chuyến xe tìm thấy thời gian thực */}
              {isSearchingTrips && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 size={13} className="animate-spin text-emerald-600" />
                  <span>Đang tra cứu dữ liệu chuyến xe...</span>
                </div>
              )}

              {!isSearchingTrips && foundTrips.length > 0 && (
                <div className="border-t border-border/60 pt-2 mb-1">
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span>Chuyến xe & Biển số xe ({foundTrips.length})</span>
                    <span className="text-[10px] text-emerald-600 font-semibold lowercase">nhấn để xem ca</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {foundTrips.map((trip) => {
                      const depTime = trip.departureTime
                        ? new Date(trip.departureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                        : '--:--'
                      const depDate = trip.departureTime
                        ? new Date(trip.departureTime).toLocaleDateString('vi-VN')
                        : ''
                      return (
                        <button
                          key={trip.id}
                          type="button"
                          onClick={() => {
                            onNavigate?.('schedule')
                            setIsSearchOpen(false)
                            setSearchQuery('')
                          }}
                          className="w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-muted/70 transition-colors group cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                {trip.route?.routeCode || 'ICTU'}
                              </span>
                              <span className="text-xs font-semibold text-foreground truncate">
                                {trip.route?.name || 'Tuyến xe buýt'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1">
                                <Clock size={11} /> {depTime} ({depDate})
                              </span>
                              {trip.vehicle?.licensePlate && (
                                <span className="flex items-center gap-1 font-mono font-bold text-foreground">
                                  <Bus size={11} /> {trip.vehicle.licensePlate}
                                </span>
                              )}
                              {trip.driver?.fullName && (
                                <span className="truncate">TX: {trip.driver.fullName}</span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-full shrink-0">
                            {trip.status === 'completed'
                              ? 'Hoàn thành'
                              : trip.status === 'in_progress'
                              ? 'Đang chạy'
                              : 'Chờ chạy'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Trạng thái không có kết quả */}
              {searchQuery.trim() && !isSearchingTrips && filteredNavItems.length === 0 && foundTrips.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs font-semibold text-foreground">Không tìm thấy kết quả phù hợp</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Thử tìm với từ khóa khác như <em>&ldquo;Lịch trình&rdquo;</em>, <em>&ldquo;GPS&rdquo;</em>, <em>&ldquo;20B&rdquo;</em>, hoặc <em>&ldquo;Thái Nguyên&rdquo;</em>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 xl:flex">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="whitespace-nowrap text-xs font-medium text-emerald-700 dark:text-emerald-300">
              GPS Server: 18ms · All Nodes Active
            </span>
          </div>

          <Popover content={notifications} trigger="click" placement="bottomRight" arrow={false}>
            <button type="button" aria-label={`Thông báo, ${pendingCount} cảnh báo`} className={iconButton}>
              <Badge count={pendingCount} size="small" offset={[4, -4]}>
                <Bell size={18} strokeWidth={1.75} className="text-muted-foreground" />
              </Badge>
            </button>
          </Popover>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={themeMode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            className={iconButton}
          >
            <span className={cn('transition-transform duration-500', themeMode === 'dark' && 'rotate-180')}>
              {themeMode === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
            </span>
          </button>

          <Dropdown
            menu={{ items: profileItems, onClick: handleProfileClick }}
            trigger={['click']}
            placement="bottomRight"
          >
            <button
              type="button"
              aria-label="Menu tài khoản"
              className="press flex items-center gap-2.5 rounded-xl border border-transparent p-1 pr-1 transition-colors hover:border-border hover:bg-card sm:pr-3"
            >
              <Avatar size={32} style={{ background: 'linear-gradient(135deg,#00A86B,#00B4A0)', fontWeight: 700 }}>
                {user.initials}
              </Avatar>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block max-w-64 truncate text-sm font-bold text-foreground" title={user.name}>
                  {user.name}
                </span>
                <span className="block text-[11px] font-medium text-muted-foreground">{user.roleTitle}</span>
              </span>
            </button>
          </Dropdown>
        </div>
      </div>
    </header>
  )
}
