/**
 * SMART BUS TICKETING SYSTEM - ICTU
 * Role Constants - Định nghĩa 4 vai trò hệ thống
 */
export enum Role {
  ADMIN = 'admin',
  MANAGER = 'manager',
  DRIVER = 'driver',
  CONDUCTOR = 'conductor',
  PASSENGER = 'passenger',
}

export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.ADMIN]: 5,
  [Role.MANAGER]: 4,
  [Role.DRIVER]: 3,
  [Role.CONDUCTOR]: 2,
  [Role.PASSENGER]: 1,
};
