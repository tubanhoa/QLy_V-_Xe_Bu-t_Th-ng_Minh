/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * Role Constants - Định nghĩa 4 vai trò hệ thống
 */
export enum Role {
  ADMIN = 'admin',
  MANAGER = 'manager',
  DRIVER = 'driver',
  PASSENGER = 'passenger',
}

export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.ADMIN]: 4,
  [Role.MANAGER]: 3,
  [Role.DRIVER]: 2,
  [Role.PASSENGER]: 1,
};
