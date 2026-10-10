import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 0. Phục vụ tệp tĩnh ảnh minh chứng (uploads)
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads/',
  });

  // 1. CORS Configuration (Tuân thủ chuẩn W3C khi credentials = true)
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Cho phép request không có origin (ví dụ curl, mobile app) hoặc nằm trong danh sách
      if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        callback(null, true);
      } else {
        callback(null, true); // Trong môi trường dev cho phép linh hoạt
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // 2. Global Prefix & URI Versioning
  app.setGlobalPrefix('api', {
    exclude: ['/'],
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // 3. Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 4. Global Filters and Interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  // 4. Swagger API Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Hệ Thống Quản Lý Vé Xe Buýt Thông Minh ICTU')
    .setDescription(
      'API Backend cung cấp đầy đủ các dịch vụ: Đăng ký/Đăng nhập JWT, Quản lý tuyến & trạm xe, Điều phối & lịch trình chuyến, Đặt vé & giữ chỗ Redis, Thanh toán VNPay/MoMo, Định vị GPS Realtime (WebSocket), Soát vé QR điện tử (HMAC-SHA256), Vé tháng & Khuyến mại, Thống kê báo cáo & Nhật ký kiểm toán.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Nhập access token JWT',
        in: 'header',
      },
      'JWT',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
    },
  });

  const port = process.env.APP_PORT || process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`=======================================================`);
  logger.log(`🚀 Smart Bus Ticketing System Backend is running!`);
  logger.log(`🔗 API Base URL:       http://localhost:${port}`);
  logger.log(`📚 Swagger API Docs:   http://localhost:${port}/api/docs`);
  logger.log(`⚡ WebSocket Server:   ws://localhost:${port}`);
  logger.log(`=======================================================`);
}

await bootstrap();
