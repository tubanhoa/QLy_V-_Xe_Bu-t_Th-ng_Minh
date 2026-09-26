import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 1. CORS Configuration
  app.enableCors({
    origin: '*',
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
