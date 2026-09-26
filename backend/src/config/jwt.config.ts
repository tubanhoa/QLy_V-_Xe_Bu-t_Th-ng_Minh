export const getJwtConfig = () => ({
  secret: process.env.JWT_SECRET || 'smart-bus-jwt-access-secret-key-2026',
  expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'smart-bus-jwt-refresh-secret-key-2026',
  refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as `${number}${'s' | 'm' | 'h' | 'd'}`,
});
