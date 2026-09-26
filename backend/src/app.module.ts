import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config.js';

import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { TransitModule } from './modules/transit/transit.module.js';
import { TripsModule } from './modules/trips/trips.module.js';
import { BookingModule } from './modules/booking/booking.module.js';
import { PaymentModule } from './modules/payment/payment.module.js';
import { TrackingModule } from './modules/tracking/tracking.module.js';
import { PromotionModule } from './modules/promotion/promotion.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { FeedbackModule } from './modules/feedback/feedback.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { SeedModule } from './database/seeds/seed.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      useFactory: getDatabaseConfig,
    }),
    AuthModule,
    UsersModule,
    TransitModule,
    TripsModule,
    BookingModule,
    PaymentModule,
    TrackingModule,
    PromotionModule,
    ReportsModule,
    FeedbackModule,
    AuditModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
