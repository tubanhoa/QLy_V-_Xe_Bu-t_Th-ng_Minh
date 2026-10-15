/**
 * Feature: Financial & Revenue Reports, Excel/PDF Export
 * Báo cáo doanh thu, biểu đồ tương tác, xuất file Excel & PDF trình Ban Giám Đốc
 * Ánh xạ Backend Module: backend/src/modules/reports
 */
export { AdminReports } from '@/components/portal/modules/admin-reports';
export { analyticsService } from '@/lib/services/analytics.service';
export type {
  DailyBreakdownItem,
  RevenueReportQueryParams,
  RevenueTimelineItem,
  RevenueRouteItem,
} from '@/lib/services/analytics.service';
