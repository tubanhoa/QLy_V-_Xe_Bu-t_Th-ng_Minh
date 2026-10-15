/**
 * Feature: Driver Cockpit & License Approvals
 * Buồng lái tài xế, quản lý hồ sơ và phê duyệt bằng lái xe GPLX
 * Ánh xạ Backend Module: backend/src/modules/driver-profiles
 */
export { AdminDriverLicenses } from '@/components/portal/modules/admin-driver-licenses';
export { DriverCockpit } from '@/components/portal/dashboard/driver-cockpit';
export { DriverDashboard } from '@/components/portal/dashboard/driver-dashboard';
export { DriverScanner } from '@/components/portal/dashboard/driver-scanner';
export { DriverManifest } from '@/components/portal/dashboard/driver-manifest';
export { DriverIncident } from '@/components/portal/dashboard/driver-incident';
export { driverProfileService } from '@/lib/services/driver-profile.service';
