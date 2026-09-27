import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator lấy thông tin user hiện tại từ JWT
 * Hỗ trợ cả các route có guard hoặc route @Public() có kèm header Authorization
 * @example @CurrentUser() user: JwtPayload
 * @example @CurrentUser('id') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    let user = request.user;

    if (!user && request.headers?.authorization) {
      try {
        const token = request.headers.authorization.replace(/^Bearer\s+/i, '');
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          user = payload;
        }
      } catch {
        // bỏ qua nếu token không đúng định dạng
      }
    }

    if (!user) return null;
    return data ? (user[data] || user.sub) : user;
  },
);

