import { SetMetadata } from '@nestjs/common';
import { Role } from '../constants/roles.constant.js';

export const ROLES_KEY = 'roles';

/**
 * Decorator phân quyền theo vai trò
 * @example @Roles(Role.ADMIN, Role.MANAGER)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
