import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceEntity } from '../../database/entities/invoice.entity.js';
import { BookingEntity } from '../../database/entities/booking.entity.js';
import { PaymentEntity } from '../../database/entities/payment.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { InvoiceService } from './invoice.service.js';
import { InvoiceController } from './invoice.controller.js';
import { NotificationModule } from '../notification/notification.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InvoiceEntity,
      BookingEntity,
      PaymentEntity,
      TicketEntity,
    ]),
    NotificationModule,
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
