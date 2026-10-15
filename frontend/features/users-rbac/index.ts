/**
 * Feature: Users & Role-Based Access Control (RBAC)
 * Quản lý nhân sự, phân quyền vai trò Super Admin, Dispatcher, Driver, Passenger
 * Ánh xạ Backend Module: backend/src/modules/users & backend/src/modules/auth
 */
export { AdminStaff } from '@/components/portal/modules/admin-staff';
export { userService } from '@/lib/services/user.service';
export { ROLES, ROLE_META, ROLE_NAV, type Role } from '@/lib/rbac';
