import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from '../../database/entities/payment.entity.js';
import { PaymentLogEntity } from '../../database/entities/payment-log.entity.js';
import { RefundLogEntity } from '../../database/entities/refund-log.entity.js';
import { BookingEntity } from '../../database/entities/booking.entity.js';
import { TicketEntity } from '../../database/entities/ticket.entity.js';
import { SeatHoldEntity } from '../../database/entities/seat-hold.entity.js';
import { PaymentController } from './payment.controller.js';
import { PaymentService } from './payment.service.js';
import { GatewayRefundService } from './services/gateway-refund.service.js';
import { BookingModule } from '../booking/booking.module.js';
import { InvoiceModule } from '../invoice/invoice.module.js';
import { NotificationModule } from '../notification/notification.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentEntity,
      PaymentLogEntity,
      RefundLogEntity,
      BookingEntity,
      TicketEntity,
      SeatHoldEntity,
    ]),
    forwardRef(() => BookingModule),
    InvoiceModule,
    NotificationModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, GatewayRefundService],
  exports: [PaymentService, GatewayRefundService],
})
export class PaymentModule {}
