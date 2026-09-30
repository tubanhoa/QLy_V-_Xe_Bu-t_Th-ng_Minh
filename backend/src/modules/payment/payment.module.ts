import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from '../../database/entities/payment.entity.js';
import { PaymentLogEntity } from '../../database/entities/payment-log.entity.js';
import { BookingEntity } from '../../database/entities/booking.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { SeatHoldEntity } from '../../database/entities/seat-hold.entity.js';
import { PaymentController } from './payment.controller.js';
import { PaymentService } from './payment.service.js';
import { BookingModule } from '../booking/booking.module.js';
import { InvoiceModule } from '../invoice/invoice.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentEntity,
      PaymentLogEntity,
      BookingEntity,
      TicketEntity,
      SeatHoldEntity,
    ]),
    BookingModule,
    InvoiceModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
