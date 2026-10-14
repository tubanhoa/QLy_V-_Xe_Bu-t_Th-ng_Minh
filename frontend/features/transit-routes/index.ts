/**
 * Feature: Transit Routes, Stops & Bus Fleet Management
 * Quản lý tuyến đường xe buýt, các trạm dừng, cấu hình giá vé và đội xe
 * Ánh xạ Backend Module: backend/src/modules/transit
 */
export { AdminRoutes } from '@/components/portal/modules/admin-routes';
export { AdminFleet } from '@/components/portal/modules/admin-fleet';
export { transitService } from '@/lib/services/transit.service';
export { vehicleService } from '@/lib/services/vehicle.service';
