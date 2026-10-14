/**
 * Feature: Audit Logs & Security Audit Trail
 * Quản lý nhật ký truy cập, ghi vết thao tác và an ninh hệ thống
 * Ánh xạ Backend Module: backend/src/modules/audit
 */
export { AdminAuditLogs } from '@/components/portal/modules/admin-audit-logs';
export { auditService } from '@/lib/services/audit.service';
export type { AuditLogItem, AuditStatsResponse, GetAuditLogsResponse } from '@/lib/services/audit.service';
