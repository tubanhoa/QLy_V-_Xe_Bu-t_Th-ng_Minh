import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Đánh dấu endpoint là public (không cần JWT)
 * @example @Public()
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
