import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ALL_ENTITIES } from '../database/entities/index.js';

export const getDatabaseConfig = (): TypeOrmModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const url = process.env.DATABASE_URL;

  const poolOptions = {
    max: 10, // Giới hạn connection pool tránh cạn kiệt slots Supabase Free Tier
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  };

  if (url) {
    const isCloud = url.includes('supabase') || url.includes('neon') || url.includes('pooler') || url.includes('sslmode=require');
    return {
      type: 'postgres',
      url,
      entities: ALL_ENTITIES,
      synchronize: !isProduction,
      logging: !isProduction,
      ssl: isCloud ? { rejectUnauthorized: false } : undefined,
      extra: poolOptions,
    };
  }

  return {
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME || 'smart_bus_db',
    entities: ALL_ENTITIES,
    synchronize: !isProduction,
    logging: !isProduction,
    extra: poolOptions,
  };
};

